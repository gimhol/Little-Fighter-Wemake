#include <cmath>
#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <vector>

#include "lfw/collision/handlers2.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Entity;
using lfw::Value;
using lfw::collision::Collision;
using lfw::collision::Handlers2Env;
using lfw::collision::HandlersEnv;
using lfw::collision::ItrVelocity;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;

std::string render(const Value& v) { return to_ascii(render_value(v)); }
std::string s_of(const std::u16string& s) { return to_ascii(s); }
std::string num(double d) { return render(Value(d)); }
std::string flag(bool b) { return b ? "b1" : "b0"; }
// 实体面把 TS 的 `undefined` 记成 `NaN`（`to_number(Value())` 的口径）⇒ 显示时还原成 `u`。
std::string num_or_u(double d) { return std::isnan(d) ? "u" : num(d); }

std::string join(const std::vector<std::string>& xs) {
  std::string out;
  for (size_t i = 0; i < xs.size(); ++i) {
    if (i) out += ",";
    out += xs[i];
  }
  return out;
}

// 切片 4CE：碰撞族窄接口退役 ⇒ 台面假实体派生真 `lfw::Entity`（见 DESIGN §141.4）。
//
// `data()` 是虚的，但 `data_base_hit_sounds()` 不是 —— 它读实体自己的 `_data`。
// 台面构造时把**同一个** `Object` 交给基类（`Value` 里存的是 `shared_ptr`），之后往这个
// 对象里写 `type` / `indexes` / `base.hit_sounds`，基类那几条非虚读面就直接看到新值
// （等价于 TS 台面那个按字段拼出来的 `get data`）。`DataSlot` 是基类列表里排在 `Entity`
// 前面的一层，这样初始化列表里就能把这个对象递进去。
struct DataSlot {
  std::shared_ptr<lfw::Object> obj;
};

struct Fake : DataSlot, Entity {
  // 台面镜像：与 TS 台面的后备字段一一对应。默认值同 TS（`undefined` 记为 `Value()`）。
  Value _hp = Value(20.0);
  Value _hp_r = Value(20.0);
  Value _fall = Value(5.0);
  Value _fall_max = Value(100.0);
  Value _defend = Value(3.0);
  Value _defend_max = Value(50.0);
  Value _resting = Value(0.0);
  Value _catch_time = Value(0.0);
  Value _catch_time_max = Value(30.0);
  Value _itr_fall = Value(2.0);
  Value _elec_dur = Value(7.0);
  Value _weight = Value(1.0);
  Value _facing = Value(1.0);
  Value _type = Value(8.0);
  Value _shaking;
  Value _motionless;
  Value _hit_sounds;
  Value _ice;
  Value _state;
  Value _dataset_values;
  Value _velocity[3] = {Value(0.0), Value(0.0), Value(0.0)};
  double _toughness = 9;

  explicit Fake(std::u16string id)
      : DataSlot{std::make_shared<lfw::Object>()},
        Entity(fx::shared_world(), Value(DataSlot::obj)) {
    this->id = std::move(id);
    rebuild_data();
  }

  void rebuild_data() {
    DataSlot::obj->set(u"type", _type);
    lfw::Object indexes;
    indexes.set(u"ice", _ice);
    DataSlot::obj->set(u"indexes", Value(std::make_shared<lfw::Object>(indexes)));
    lfw::Object base;
    base.set(u"hit_sounds", _hit_sounds);
    DataSlot::obj->set(u"base", Value(std::make_shared<lfw::Object>(base)));
  }

  // --- 实体面：库读的那几条 -----------------------------------------------
  Value dataset(const std::u16string& key) const override {
    // TS 台面的 `itr_fall(itr)` 是整条覆写的；端口这条读面在实体上走
    // `Entity::itr_fall` → `dataset("itr_fall")`，所以这里按同一个口径接上。
    if (key == u"itr_fall") return _itr_fall;
    if (key == u"electrify_duration") return _elec_dur;
    return lfw::field_or(_dataset_values, key.c_str());
  }
  double hp() const override { return lfw::to_number(_hp); }
  double hp_r() const override { return lfw::to_number(_hp_r); }
  double toughness() const override { return _toughness; }
  double resting() const override { return lfw::to_number(_resting); }
  double fall_value() const override { return lfw::to_number(_fall); }
  double fall_value_max() const override { return lfw::to_number(_fall_max); }
  double defend_value() const override { return lfw::to_number(_defend); }
  double defend_value_max() const override { return lfw::to_number(_defend_max); }
  double catch_time_max() const override { return lfw::to_number(_catch_time_max); }

  // --- 实体面：库写的那几条（日志逐字复刻 TS 台面的 setter）---------------
  void set_hp(double v) override {
    _hp = Value(v);
    g_log.push_back(s_of(id) + ":set_hp:" + num(v));
  }
  void set_hp_r(double v) override {
    _hp_r = Value(v);
    g_log.push_back(s_of(id) + ":set_hp_r:" + num(v));
  }
  void set_toughness(double v) override {
    _toughness = v;
    g_log.push_back(s_of(id) + ":set_toughness:" + num(v));
  }
  void set_resting(double v) override {
    _resting = Value(v);
    g_log.push_back(s_of(id) + ":set_resting:" + num(v));
  }
  void set_fall_value(double v) override {
    _fall = Value(v);
    g_log.push_back(s_of(id) + ":set_fall_value:" + num(v));
  }
  void set_defend_value(double v) override {
    _defend = Value(v);
    g_log.push_back(s_of(id) + ":set_defend_value:" + num(v));
  }
  Entity& set_catch_time(double v) override {
    _catch_time = Value(v);
    g_log.push_back(s_of(id) + ":set_catch_time:" + num(v));
    return *this;
  }
  Entity& set_shaking(double v) override {
    _shaking = std::isnan(v) ? Value() : Value(v);
    Entity::set_shaking(v);
    g_log.push_back(s_of(id) + ":set_shaking:" + num_or_u(v));
    return *this;
  }
  Entity& set_catching(Entity* v) override {
    Entity::set_catching(v);
    g_log.push_back(s_of(id) + ":set_catching:" +
                    (v == nullptr ? std::string("undefined") : s_of(v->id)));
    return *this;
  }
  Entity& set_catcher(Entity* v) override {
    Entity::set_catcher(v);
    g_log.push_back(s_of(id) + ":set_catcher:" +
                    (v == nullptr ? std::string("undefined") : s_of(v->id)));
    return *this;
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    _velocity[0] = x;
    _velocity[1] = y;
    _velocity[2] = z;
    g_log.push_back(s_of(id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
  }
  lfw::EnterFrameResult enter_frame(const Value& nf, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame:" + render(nf));
    return lfw::EnterFrameResult::NotFound;
  }
  lfw::EnterFrameResult enter_frame_by_id(const Value& fid, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(fid));
    return lfw::EnterFrameResult::NotFound;
  }
  void play_sound(const Value& sounds) override {
    g_log.push_back(s_of(id) + ":play_sound:" + render(sounds));
  }
};

Fake g_att(u"A");
Fake g_vic(u"V");
Collision g_c;
Handlers2Env g_h2;
HandlersEnv g_henv;
lfw::buff::BuffEnv g_benv;
lfw::buff::Buff* g_granted = nullptr;
Value g_recov = Value(0.25);
Value g_vel = Value(0.0);
Value g_vel_z = Value(0.0);
Value g_itr_motionless;
bool g_is_fighter = true;
Value g_collision_dataset;

void bind() {
  g_h2.warn = [](const std::u16string& m) { g_log.push_back("warn:" + s_of(m)); };
  g_h2.hp_recoverability = []() { return g_recov; };
  g_h2.find_entity = [](const std::u16string& id) -> Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  g_h2.summary_apply_damage = [](Entity* a, const Value& injury, Entity* v,
                                 const Value& prev_hp) {
    g_log.push_back("summary:" + s_of(a->id) + ":" + render(injury) + ":" + s_of(v->id) + ":" +
                    render(prev_hp));
  };
  g_h2.buff_env = []() { return &g_benv; };
  g_h2.is_fighter = [](const Entity& e) { return lfw::entity::is_fighter_data(e.data()); };
  g_h2.calc_velocity = [](Collision&) -> ItrVelocity {
    ItrVelocity v;
    v.x = lfw::to_number(g_vel);
    v.y = 0;
    v.z = lfw::to_number(g_vel_z);
    v.x_direction = Value(1.0);
    return v;
  };
  lfw::collision::set_handlers2_env(g_h2);

  g_henv.attacker_itr_motionless = [](const Collision&) { return g_itr_motionless; };
  g_henv.attacker_set_motionless = [](const Collision&, const Value& v) {
    g_att._motionless = v;
    g_att.motionless = lfw::to_number(v);
    g_log.push_back("A:set_motionless:" + render(v));
  };
  g_henv.victim_set_shaking = [](const Collision&, const Value& v) {
    g_vic._shaking = v;
    g_log.push_back("V:set_shaking:" + render(v));
  };
  g_henv.attacker_set_arest = [](const Collision&, double v) {
    g_log.push_back("A:set_arest:" + num(v));
  };
  g_henv.victim_add_v_rest = [](Collision& c) {
    g_log.push_back("add_v_rest:" + s_of(c.vid) + ":" + num(c.rest));
  };
  g_henv.buff_get = [](const std::u16string& id) {
    g_log.push_back("buff_get:" + s_of(id));
    return false;
  };
  g_henv.buff_lifetime_zero = [](const std::u16string& id) {
    g_log.push_back("lifetime_zero:" + s_of(id));
  };
  g_henv.buff_create = [](const std::u16string& kind, const std::u16string& id) {
    g_log.push_back("create:" + s_of(kind) + ":" + s_of(id));
    return false;
  };
  g_henv.buff_set_attacker = [](const std::u16string&, const std::u16string&) {};
  g_henv.buff_set_victim = [](const std::u16string&, const std::u16string&) {};
  g_henv.buff_mount = [](const std::u16string&) {};
  g_c.env = &g_henv;

  g_benv.find_entity = [](const std::u16string& id) -> Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  g_benv.create_entity = [](const Value&) -> Entity* { return nullptr; };
  g_benv.find_data = [](const std::u16string&) -> Value { return Value(); };
  g_benv.world_buffs_set = [](const std::u16string&, lfw::buff::Buff*) {};
  g_benv.world_buffs_get = [](const std::u16string&) -> lfw::buff::Buff* { return nullptr; };
  g_benv.create_buff = [](const std::u16string& kind, const std::u16string& id) {
    g_log.push_back("create_buff:" + s_of(kind) + ":" + s_of(id));
    g_granted = new lfw::buff::Buff(&g_benv, id, Value(kind));
    return g_granted;
  };
}

std::string side_text(const Fake& f) {
  const std::string id = s_of(f.id);
  return id + ".hp=" + render(f._hp) + " " + id + ".hp_r=" + render(f._hp_r) + " " + id +
         ".fall=" + render(f._fall) + " " + id + ".defend=" + render(f._defend) + " " + id +
         ".resting=" + render(f._resting) + " " + id + ".tough=" + num(f._toughness) + " " + id +
         ".catch_time=" + render(f._catch_time) + " " + id + ".catching=" +
         (f.catching == nullptr ? std::string("-") : s_of(f.catching->id)) + " " + id +
         ".catcher=" + (f.catcher == nullptr ? std::string("-") : s_of(f.catcher->id)) + " " + id +
         ".shaking=" + render(f._shaking) + " " + id + ".motionless=" + render(f._motionless) +
         " " + id + ".vel=" + render(f._velocity[0]) + "/" + render(f._velocity[1]) + "/" +
         render(f._velocity[2]);
}

std::string state_text() {
  std::string s = side_text(g_att) + " " + side_text(g_vic);
  s += " inj=" + render(g_c.injury) + " inj_r=" + render(g_c.injury_r) +
       " rinj=" + render(g_c.real_injury) + " rinj_r=" + render(g_c.real_injury_r);
  s += " buff=" + (g_granted == nullptr
                       ? std::string("none")
                       : num(g_granted->lifetime()) + "/" + num(g_granted->duration()) + "/" +
                             num(g_granted->level()));
  return s;
}

void walk_side(Fake& f, const std::string& field, const std::vector<std::string>& tok, size_t& i) {
  if (field == "hp") {
    f._hp = parse_value(tok, i);
  } else if (field == "hp_r") {
    f._hp_r = parse_value(tok, i);
  } else if (field == "fall") {
    f._fall = parse_value(tok, i);
  } else if (field == "fall_max") {
    f._fall_max = parse_value(tok, i);
  } else if (field == "defend") {
    f._defend = parse_value(tok, i);
  } else if (field == "defend_max") {
    f._defend_max = parse_value(tok, i);
  } else if (field == "resting") {
    f._resting = parse_value(tok, i);
  } else if (field == "catch_max") {
    f._catch_time_max = parse_value(tok, i);
  } else if (field == "catching") {
    f.catching = tok[i++] == "1" ? &g_vic : nullptr;
  } else if (field == "catcher") {
    f.catcher = tok[i++] == "1" ? &g_att : nullptr;
  } else if (field == "marks") {
    if (tok[i++] == "1") {
      f.marks[u"Electrify"] = u"";
    } else {
      f.marks.erase(u"Electrify");
    }
  } else if (field == "elec_dur") {
    f._elec_dur = parse_value(tok, i);
  } else if (field == "itr_fall") {
    f._itr_fall = parse_value(tok, i);
  } else if (field == "hit_sounds") {
    f._hit_sounds = parse_value(tok, i);
    f.rebuild_data();
  } else if (field == "motionless") {
    f._motionless = parse_value(tok, i);
    f.motionless = lfw::to_number(f._motionless);
  } else if (field == "src_emitter") {
    const Value v = parse_value(tok, i);
    const std::u16string* s = std::get_if<std::u16string>(&v);
    f.emitters.clear();
    if (s != nullptr) f.emitters.push_back(*s);
  } else if (field == "ice") {
    f._ice = parse_value(tok, i);
    f.rebuild_data();
  } else if (field == "type") {
    f._type = parse_value(tok, i);
    f.rebuild_data();
  } else if (field == "weight") {
    f._weight = parse_value(tok, i);
  } else if (field == "state") {
    f._state = parse_value(tok, i);
  } else if (field == "face") {
    f._facing = parse_value(tok, i);
  } else if (field == "dataset") {
    f._dataset_values = parse_value(tok, i);
  } else {
    std::fprintf(stderr, "unknown side field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void run(const std::string& name, const std::vector<std::string>& tok, size_t& i) {
  if (name == "injury") {
    double scale = 1;
    bool keep = false;
    if (i < tok.size()) scale = trace::to_double(tok[i++]);
    if (i < tok.size()) keep = tok[i++] == "1";
    lfw::collision::handle_injury(g_c, scale, keep);
  } else if (name == "catch") {
    lfw::collision::handle_itr_catch(g_c);
  } else if (name == "freeze") {
    lfw::collision::handle_itr_kind_freeze(g_c);
  } else if (name == "efreeze") {
    lfw::collision::handle_itr_effect_freeze(g_c);
  } else if (name == "shield") {
    lfw::collision::handle_john_shield_hit_other_ball(g_c);
  } else {
    std::fprintf(stderr, "unknown handler '%s'\n", name.c_str());
    std::exit(2);
  }
  std::printf("run %s || %s | %s\n", name.c_str(), join(g_log).c_str(), state_text().c_str());
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_handlers2 <case-file>\n");
    return 2;
  }
  bind();
  g_c.aid = u"A";
  g_c.vid = u"V";

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;
    g_log.clear();
    g_granted = nullptr;
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "itr") {
        g_c.itr = parse_value(t, i);
      } else if (sub == "dataset") {
        g_c.dataset = parse_value(t, i);
        g_collision_dataset = g_c.dataset;
      } else if (sub == "rest") {
        g_c.rest = trace::to_double(t[i++]);
      } else if (sub == "recov") {
        g_recov = parse_value(t, i);
      } else if (sub == "fighter") {
        (void)t[i++];
      } else if (sub == "vel") {
        g_vel = parse_value(t, i);
      } else if (sub == "velz") {
        g_vel_z = parse_value(t, i);
      } else if (sub == "itr_motionless") {
        g_itr_motionless = parse_value(t, i);
      } else if (sub == "a" || sub == "v") {
        const std::string& field = t[i++];
        walk_side(sub == "a" ? g_att : g_vic, field, t, i);
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "run") {
      run(t[i++], t, i);
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
