#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/collision/handlers.h"
#include "lfw/collision/handlers2.h"
#include "lfw/collision/handlers3.h"
#include "lfw/core/js_string.h"
#include "lfw/core/value.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Array;
using lfw::Entity;
using lfw::EntityEnum;
using lfw::EnterFrameResult;
using lfw::Object;
using lfw::Value;
using lfw::collision::Collision;
using lfw::collision::Cube;
using lfw::collision::Handlers2Env;
using lfw::collision::Handlers3Env;
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

std::string join(const std::vector<std::string>& xs) {
  std::string out;
  for (size_t i = 0; i < xs.size(); ++i) {
    if (i) out += ",";
    out += xs[i];
  }
  return out;
}

bool absent(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<lfw::NullTag>(v);
}

Value g_dataset;

// 切片 4CE：碰撞族窄接口退役 ⇒ 台面假实体就是真 `lfw::Entity`。
// TS 台面（`collision_handlers3.ts`）只给读面（`id` / `data` / `dataset` / `team` /
// `marks` …）；端口这边能覆写的都覆写，**非虚**的那几条读面（`data_base_hit_sounds()` /
// `data_in_the_skys_first()` / `data_indexes_of()` 都走实体自己的 `data()`，`marks_has()`
// 走 `marks`）就把数据灌进实体本身：
//   * `_data` 只有构造与 `reset` 能写 ⇒ 台面把数据造成**共享**的三层
//     （root / indexes / base）并把 `shared_ptr` 留在手上，之后按用例改内容 ——
//     基类 `data()` / `_data` 看到的就是台面改的那一份（`Value` 持 `shared_ptr`，浅拷贝）；
//   * `marks` / `bearer` / `armor` / `velocity` / `position` 是公开成员，直接写；
//   * `itr_fall()` 非虚且只认 `dataset("itr_fall")` ⇒ 台面在 `dataset` 里把这条键指向
//     自己的 `_itr_fall` 镜像（TS 台面的 `itr_fall()` 返回的就是它）。
struct FakeData {
  std::shared_ptr<Object> root = std::make_shared<Object>();
  std::shared_ptr<Object> indexes = std::make_shared<Object>();
  std::shared_ptr<Object> base = std::make_shared<Object>();
  std::shared_ptr<Array> in_the_skys = std::make_shared<Array>(std::vector<Value>{Value()});

  FakeData() {
    indexes->set(u"ice", Value());
    indexes->set(u"in_the_skys", Value(in_the_skys));
    base->set(u"hit_sounds", Value());
    root->set(u"type", Value(static_cast<double>(EntityEnum::Fighter)));
    root->set(u"indexes", Value(indexes));
    root->set(u"base", Value(base));
  }
};

// `team` 在 TS 台面是任意值（本用例给的是数字），实体面是 `u16string` ⇒ 台面存镜像
// `Value`（dump 印它），`team()` 交出它的字符串投影，`set_team` 再把投影反解回镜像。
bool numeric_text(const std::u16string& s) {
  bool digit = false;
  for (const char16_t c : s) {
    if (c >= u'0' && c <= u'9') {
      digit = true;
      continue;
    }
    if (c == u'.' || c == u'-' || c == u'+' || c == u'e' || c == u'E') continue;
    return false;
  }
  return digit;
}

Value team_value_of(const std::u16string& s) {
  if (s.empty()) return Value();
  return numeric_text(s) ? Value(lfw::string_to_number(s)) : Value(s);
}

std::string sid_of(const Entity* e) { return e == nullptr ? "undefined" : s_of(e->id); }

struct Fake : FakeData, Entity {
  Value _hp = Value(20.0);
  Value _hp_r = Value(20.0);
  Value _fall = Value(5.0);
  Value _fall_max = Value(100.0);
  Value _defend = Value(3.0);
  Value _defend_max = Value(50.0);
  Value _resting = Value(0.0);
  Value _catch_time = Value(0.0);
  Value _catch_time_max = Value(30.0);
  Value _arest;              // TS 默认 undefined
  Value _shaking;            // TS 默认 undefined ⇒ dump 印 `u`
  Value _motionless;         // 同上
  Value _itr_fall = Value(2.0);
  Value _elec = Value(7.0);  // `dataset("electrify_duration")`
  Value _dataset_values;
  Value _base_type;  // TS 默认 undefined
  Value _state;      // TS 默认 undefined
  Value _team;       // TS 默认 undefined（实体面是 `u16string`，见 `team()`）
  Value _toughness = Value(9.0);
  Value _tough_max = Value(9.0);
  mutable std::u16string _team_out;

  explicit Fake(std::u16string id) : Entity(fx::shared_world(), Value(root)) {
    this->id = std::move(id);
  }

  // --- 实体读面（库读，台面给用例值） ---
  double hp() const override { return lfw::to_number(_hp); }
  double hp_r() const override { return lfw::to_number(_hp_r); }
  double toughness() const override { return lfw::to_number(_toughness); }
  double toughness_max() const override { return lfw::to_number(_tough_max); }
  double resting() const override { return lfw::to_number(_resting); }
  double fall_value() const override { return lfw::to_number(_fall); }
  double fall_value_max() const override { return lfw::to_number(_fall_max); }
  double defend_value() const override { return lfw::to_number(_defend); }
  double defend_value_max() const override { return lfw::to_number(_defend_max); }
  double catch_time_max() const override { return lfw::to_number(_catch_time_max); }
  double arest() const override { return lfw::to_number(_arest); }
  double base_type() const override { return lfw::to_number(_base_type); }
  Value state() const override { return _state; }

  const std::u16string& team() const override {
    _team_out = absent(_team) ? std::u16string() : lfw::to_string(_team);
    return _team_out;
  }

  Value dataset(const std::u16string& key) const override {
    if (key == u"electrify_duration") return _elec;
    if (key == u"itr_fall") return _itr_fall;
    const Value own = lfw::field_or(_dataset_values, key.c_str());
    if (!absent(own)) return own;
    return lfw::field_or(g_dataset, key.c_str());
  }
  // --- 实体写面（库写，台面记日志；日志文本逐字对 TS 台面的 setter） ---
  void set_hp(double v) override {
    _hp = Value(v);
    g_log.push_back(s_of(id) + ":set_hp:" + render(_hp));
  }
  void set_hp_r(double v) override {
    _hp_r = Value(v);
    g_log.push_back(s_of(id) + ":set_hp_r:" + render(_hp_r));
  }
  void set_toughness(double v) override {
    _toughness = Value(v);
    g_log.push_back(s_of(id) + ":set_toughness:" + render(_toughness));
  }
  void set_resting(double v) override {
    _resting = Value(v);
    g_log.push_back(s_of(id) + ":set_resting:" + render(_resting));
  }
  void set_fall_value(double v) override {
    _fall = Value(v);
    g_log.push_back(s_of(id) + ":set_fall_value:" + render(_fall));
  }
  void set_defend_value(double v) override {
    _defend = Value(v);
    g_log.push_back(s_of(id) + ":set_defend_value:" + render(_defend));
  }
  Entity& set_catch_time(double value) override {
    _catch_time = Value(value);
    g_log.push_back(s_of(id) + ":set_catch_time:" + render(_catch_time));
    return *this;
  }
  void set_arest(double v) override {
    _arest = Value(v);
    g_log.push_back(s_of(id) + ":set_arest:" + render(_arest));
  }
  void set_team(std::u16string v) override {
    _team = team_value_of(v);
    g_log.push_back(s_of(id) + ":set_team:" + render(_team));
  }
  Entity& set_shaking(double v) override {
    _shaking = Value(v);
    shaking = v;
    g_log.push_back(s_of(id) + ":set_shaking:" + render(_shaking));
    return *this;
  }
  Entity& set_motionless(double v) override {
    _motionless = Value(v);
    motionless = v;
    g_log.push_back(s_of(id) + ":set_motionless:" + render(_motionless));
    return *this;
  }
  Entity& set_catching(Entity* v) override {
    catching = v;
    g_log.push_back(s_of(id) + ":set_catching:" + sid_of(v));
    return *this;
  }
  Entity& set_catcher(Entity* v) override {
    catcher = v;
    g_log.push_back(s_of(id) + ":set_catcher:" + sid_of(v));
    return *this;
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    velocity.x = lfw::to_number(x);
    velocity.y = lfw::to_number(y);
    velocity.z = lfw::to_number(z);
    g_log.push_back(s_of(id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
  }
  // 注意：实体面的 `enter_frame()` **不是虚函数**（`enter_frame_by_id()` 是）⇒ 库经过
  // `Entity*` 调的 `enter_frame` 台面观测不到；本用例的四个 handler 也不走那条路。
  EnterFrameResult enter_frame_by_id(const Value& fid, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(fid));
    return EnterFrameResult::NotFound;
  }
  void play_sound(const Value& sounds) override {
    g_log.push_back(s_of(id) + ":play_sound:" + render(sounds));
  }

  // 用例走位：TS 的 `walkSide` 直接写字段（**不发日志**）⇒ 台面同样只写镜像/实体字段。
  void walk_team(const Value& v) { _team = v; }
  void walk_hit_sounds(const Value& v) { base->set(u"hit_sounds", v); }
  void walk_ice(const Value& v) { indexes->set(u"ice", v); }
  void walk_in_the_sky(const Value& v) { in_the_skys->at(0) = v; }
  void walk_type(const Value& v) { root->set(u"type", v); }
};

Fake g_att(u"A");
Fake g_vic(u"V");
Collision g_c;
HandlersEnv g_henv;
Handlers2Env g_h2;
Handlers3Env g_h3;
lfw::buff::Buff* g_granted = nullptr;
Value g_recov = Value(0.25);
Value g_itr_motionless;
bool g_armorwork = true;

Cube cube_of(const Value& v) {
  Cube c;
  c.left = lfw::to_number(lfw::field_or(v, u"left"));
  c.right = lfw::to_number(lfw::field_or(v, u"right"));
  c.bottom = lfw::to_number(lfw::field_or(v, u"bottom"));
  c.top = lfw::to_number(lfw::field_or(v, u"top"));
  c.near = lfw::to_number(lfw::field_or(v, u"near"));
  c.far = lfw::to_number(lfw::field_or(v, u"far"));
  return c;
}

void bind() {
  fx::shared_lfw().world_override = &fx::shared_world();
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
  g_h2.is_fighter = [](const Entity& e) { return lfw::entity::is_fighter_data(e.data()); };
  g_h2.calc_velocity = [](Collision&) -> ItrVelocity {
    ItrVelocity v;
    v.x = 0;
    v.y = 0;
    v.z = 0;
    v.x_direction = Value(1.0);
    return v;
  };
  lfw::collision::set_handlers2_env(g_h2);

  g_henv.attacker_itr_motionless = [](const Collision&) { return g_itr_motionless; };
  g_henv.attacker_set_motionless = [](const Collision&, const Value& v) {
    g_att._motionless = v;
    g_log.push_back("A:set_motionless:" + render(v));
  };
  g_henv.victim_set_shaking = [](const Collision&, const Value& v) {
    g_vic._shaking = v;
    g_log.push_back("V:set_shaking:" + render(v));
  };
  g_henv.attacker_set_arest = [](const Collision&, double v) { g_log.push_back("A:set_arest:" + num(v)); };
  g_henv.victim_add_v_rest = [](Collision& c) {
    g_log.push_back("add_v_rest:" + s_of(c.vid) + ":" + num(c.rest));
  };
  g_henv.attacker_pick_victim = [](Collision&) {};
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

  g_h3.find_entity = [](const std::u16string& id) -> Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  g_h3.is_ball = [](const Entity& e) { return lfw::entity::is_ball_data(e.data()); };
  g_h3.is_weapon = [](const Entity& e) { return lfw::entity::is_weapon_data(e.data()); };
  g_h3.spark_point = [](const Collision&, const Cube& a, const Cube& b, double& x, double& y, double& z) {
    x = a.left;
    y = b.right;
    z = a.top;
  };
  g_h3.spark = [](double x, double y, double z, const Value& type) {
    g_log.push_back("spark:" + num(x) + ":" + num(y) + ":" + num(z) + ":" + render(type));
  };
  g_h3.play_sound_global = [](const Value& s, double x, double y, double z) {
    g_log.push_back("snd:" + render(s) + ":" + num(x) + ":" + num(y) + ":" + num(z));
  };
  g_h3.is_armor_work = [](Collision&) { return g_armorwork; };
  lfw::collision::set_handlers3_env(g_h3);

  fx::shared_world().on_find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  fx::shared_lfw().on_create_entity = [](const Value&) -> lfw::Entity* { return nullptr; };
  fx::shared_lfw().on_datas_find = [](const std::u16string&) -> Value { return Value(); };
  fx::shared_world().on_buffs_set = [](const std::u16string&, lfw::buff::Buff*) {};
  fx::shared_world().on_buffs_get = [](const std::u16string&) -> lfw::buff::Buff* { return nullptr; };
  fx::shared_lfw().on_create_buff = [](const std::u16string& kind, const std::u16string& id) {
    g_log.push_back("create_buff:" + s_of(kind) + ":" + s_of(id));
    g_granted = new lfw::buff::Buff(fx::shared_lfw(), id, Value(kind));
    return g_granted;
  };
}

std::string side_text(const Fake& f) {
  return s_of(f.id) + ".hp=" + render(f._hp) + " " + s_of(f.id) + ".hp_r=" + render(f._hp_r) +
         " " + s_of(f.id) + ".tough=" + render(f._toughness) + " " + s_of(f.id) +
         ".tough_max=" + render(f._tough_max) + " " + s_of(f.id) + ".vel=" +
         render(Value(f.velocity.x)) + "/" + render(Value(f.velocity.y)) + "/" +
         render(Value(f.velocity.z)) + " " + s_of(f.id) + ".team=" + render(f._team) + " " +
         s_of(f.id) + ".state=" + render(f._state) + " " + s_of(f.id) +
         ".motionless=" + render(f._motionless) + " " + s_of(f.id) +
         ".shaking=" + render(f._shaking);
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
    f.marks.clear();
    if (tok[i++] == "1") f.marks[u"Electrify"] = u"1";
  } else if (field == "elec_dur") {
    f._elec = parse_value(tok, i);
  } else if (field == "itr_fall") {
    f._itr_fall = parse_value(tok, i);
  } else if (field == "hit_sounds") {
    f.walk_hit_sounds(parse_value(tok, i));
  } else if (field == "motionless") {
    f._motionless = parse_value(tok, i);
  } else if (field == "src_emitter") {
    // 实体面 `src_emitter()` 非虚，读的是 `emitters` 的首项 ⇒ 用例值直接落那儿。
    const Value v = parse_value(tok, i);
    f.emitters.clear();
    if (const std::u16string* s = std::get_if<std::u16string>(&v)) {
      if (!s->empty()) f.emitters.push_back(*s);
    }
  } else if (field == "ice") {
    f.walk_ice(parse_value(tok, i));
  } else if (field == "in_the_sky") {
    f.walk_in_the_sky(parse_value(tok, i));
  } else if (field == "type") {
    f.walk_type(parse_value(tok, i));
  } else if (field == "state") {
    f._state = parse_value(tok, i);
  } else if (field == "base_type") {
    f._base_type = parse_value(tok, i);
  } else if (field == "bearer") {
    f.bearer = tok[i++] == "1" ? &g_att : nullptr;
  } else if (field == "team") {
    f.walk_team(parse_value(tok, i));
  } else if (field == "armor") {
    f.armor = parse_value(tok, i);
  } else if (field == "tough") {
    f._toughness = Value(lfw::to_number(parse_value(tok, i)));
  } else if (field == "tough_max") {
    f._tough_max = parse_value(tok, i);
  } else if (field == "velx") {
    f.velocity.x = lfw::to_number(parse_value(tok, i));
  } else if (field == "vely") {
    f.velocity.y = lfw::to_number(parse_value(tok, i));
  } else if (field == "velz") {
    f.velocity.z = lfw::to_number(parse_value(tok, i));
  } else if (field == "posx") {
    f.position.x = lfw::to_number(parse_value(tok, i));
  } else if (field == "posy") {
    f.position.y = lfw::to_number(parse_value(tok, i));
  } else if (field == "posz") {
    f.position.z = lfw::to_number(parse_value(tok, i));
  } else if (field == "dataset") {
    f._dataset_values = parse_value(tok, i);
  } else {
    std::fprintf(stderr, "unknown side field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void run(const std::string& name, const std::vector<std::string>& tok, size_t& i) {
  if (name == "whirlwind") {
    lfw::collision::handle_itr_kind_whirlwind(g_c);
  } else if (name == "ballhit_a") {
    lfw::collision::handle_ball_is_hit_a(g_c);
  } else if (name == "ballhit_b") {
    lfw::collision::handle_ball_is_hit_b(g_c);
  } else if (name == "armor") {
    const bool r = lfw::collision::handle_armor(g_c);
    g_log.push_back(std::string("ret:") + (r ? "1" : "0"));
  } else {
    std::fprintf(stderr, "unknown handler '%s'\n", name.c_str());
    std::exit(2);
  }
  std::printf("run %s || %s | %s\n", name.c_str(), join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_handlers3 <case-file>\n");
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
        g_dataset = parse_value(t, i);
        g_c.dataset = g_dataset;
      } else if (sub == "rest") {
        g_c.rest = trace::to_double(t[i++]);
      } else if (sub == "recov") {
        g_recov = parse_value(t, i);
      } else if (sub == "itr_motionless") {
        g_itr_motionless = parse_value(t, i);
      } else if (sub == "armorwork") {
        g_armorwork = t[i++] == "1";
      } else if (sub == "acube") {
        g_c.a_cube = cube_of(parse_value(t, i));
      } else if (sub == "bcube") {
        g_c.b_cube = cube_of(parse_value(t, i));
      } else if (sub == "a" || sub == "v") {
        const std::string& field = t[i++];
        walk_side(sub == "a" ? g_att : g_vic, field, t, i);
        if (i != t.size()) {
          std::fprintf(stderr, "trailing tokens after side field '%s' at line %d\n", field.c_str(),
                       lineno);
          return 2;
        }
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
