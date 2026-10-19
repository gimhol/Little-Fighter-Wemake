#include <cstddef>
#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/collision/collision.h"
#include "lfw/collision/handlers.h"
#include "lfw/collision/handlers2.h"
#include "lfw/collision/weapon_is_hit.h"
#include "lfw/core/value.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/entity/enter_frame_result.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::EnterFrameResult;
using lfw::collision::Collision;
using lfw::collision::Cube;
using lfw::collision::Handlers2Env;
using lfw::collision::HandlersEnv;
using lfw::collision::ItrVelocity;
using lfw::collision::SparkPoint;
using lfw::collision::WeaponIsHitEnv;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_u16;

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

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<lfw::NullTag>(v);
}

struct Fake;

Fake* other_of(const Fake& f);

// 切片 4CE：碰撞族窄接口退役 ⇒ 台面假实体就是真 `lfw::Entity`（TS 台面同样只给
// `hp` / `hp_r` / `state` / `team` / `base_type` / `data` / `set_velocity` … 这几条面）。
// 不可虚的面用「镜像」补：
//   * `data_id()` / `data_base_hit_sounds()`（非虚，读私有 `_data`）⇒ 构造时把 `_data`
//     钉在台面自己持有的 `Object` 上，写镜像时同步进去；
//   * `src_emitter()`（非虚，读 `emitters`）⇒ `env a src_emitter <值>` 直接把串落进去。
struct Fake : lfw::Entity {
  // --- TS 假实体字段的镜像（`collision_weapon_is_hit.ts` 的初值）---
  Value _hp = Value(50.0);
  Value _hp_r = Value(50.0);
  double _toughness = 9;
  Value _state;
  Value _face = Value(1.0);
  Value _base_type;
  Value _team = Value(0.0);
  bool _bearer = false;
  bool _dropping = false;
  bool _on_ground = true;
  Value _data_id;
  Value _type = Value(static_cast<double>(lfw::EntityEnum::Fighter));
  Value _throwings;
  Value _in_the_skys;
  double _vel[3] = {0, 0, 0};
  Value _fall = Value(5.0);
  Value _fall_max = Value(100.0);
  Value _defend = Value(3.0);
  Value _resting = Value(0.0);
  Value _catch_time = Value(0.0);
  Value _catch_time_max = Value(30.0);
  Value _arest;
  Value _source_emitter;
  Value _shaking;
  Value _motionless;
  Value _elec_dur = Value(7.0);
  Value _hit_sounds;
  Value _ice;
  Value _dataset_values;
  // `Entity::data()` 返回 `const Value&` ⇒ 镜像必须是成员（不能返回临时量）。
  mutable Value _data_mirror;
  // `team()` 返回 `std::u16string`（TS 的 `team` 是 `unknown`，用例里是数字 3）⇒ 台面把
  // 镜像的 trace 串当载体，写入端再按同一串还原，值类型才不丢。
  std::u16string _team_carrier = u"0";
  // `_data` 指向这个对象（构造时交给基类），非虚的 `data_id()` 因此能跟上台面的改动。
  std::shared_ptr<lfw::Object> _data_obj;
  std::shared_ptr<lfw::Object> _data_base_obj;
  std::shared_ptr<lfw::Object> _data_indexes_obj;

  explicit Fake(std::u16string id)
      : Entity(fx::shared_world(), Value(std::make_shared<lfw::Object>())) {
    this->id = std::move(id);
    // 基类 `_data` 就是我们传进去的那个对象 ⇒ 非虚的 `data_id()` / `data_base_hit_sounds()`
    // 也能跟着台面对镜像的改动走。
    _data_obj = std::get<std::shared_ptr<lfw::Object>>(lfw::Entity::data());
    _data_base_obj = std::make_shared<lfw::Object>();
    _data_indexes_obj = std::make_shared<lfw::Object>();
    sync_data();
    sync_team();
  }

  void sync_team() { _team_carrier = to_u16(render(_team)); }

  void sync_data() {
    lfw::Object* o = _data_obj.get();
    o->set(u"id", _data_id);
    o->set(u"type", _type);
    _data_base_obj->set(u"hit_sounds", _hit_sounds);
    o->set(u"base", Value(_data_base_obj));
    _data_indexes_obj->set(u"throwings", _throwings);
    _data_indexes_obj->set(u"in_the_skys", _in_the_skys);
    o->set(u"indexes", Value(_data_indexes_obj));
  }

  // --- 读面 ---------------------------------------------------------------
  double hp() const override { return lfw::to_number(_hp); }
  double hp_r() const override { return lfw::to_number(_hp_r); }
  double toughness() const override { return _toughness; }
  double weight() const override { return 1.0; }
  double catch_time_max() const override { return lfw::to_number(_catch_time_max); }
  Value state() const override { return _state; }
  double base_type() const override { return lfw::to_number(_base_type); }
  const std::u16string& team() const override { return _team_carrier; }
  const Value& data() const override {
    lfw::Object o;
    o.set(u"type", _type);
    o.set(u"id", _data_id);
    lfw::Object base;
    base.set(u"hit_sounds", _hit_sounds);
    o.set(u"base", Value(std::make_shared<lfw::Object>(base)));
    lfw::Object indexes;
    indexes.set(u"throwings", _throwings);
    indexes.set(u"in_the_skys", _in_the_skys);
    o.set(u"indexes", Value(std::make_shared<lfw::Object>(indexes)));
    _data_mirror = Value(std::make_shared<lfw::Object>(o));
    return _data_mirror;
  }
  Value dataset(const std::u16string& key) const override {
    if (key == u"electrify_duration") return _elec_dur;
    if (key == u"ivx_f" || key == u"ivy_f" || key == u"ivz_f" || key == u"ivy_d")
      return Value(1.0);
    const lfw::Object* d = lfw::as_object(_dataset_values);
    if (d == nullptr) return Value();
    const Value* p = d->get(key);
    return p != nullptr ? *p : Value();
  }

  // --- 写面（库里的写入都在这里落日志）-------------------------------------
  void set_hp(double v) override {
    _hp = Value(v);
    g_log.push_back(s_of(id) + ":set_hp:" + render(_hp));
  }
  void set_hp_r(double v) override {
    _hp_r = Value(v);
    g_log.push_back(s_of(id) + ":set_hp_r:" + render(_hp_r));
  }
  void set_toughness(double v) override {
    _toughness = v;
    g_log.push_back(s_of(id) + ":set_toughness:" + num(v));
  }
  void set_dropping(bool v) override {
    dropping = v;
    _dropping = v;
    g_log.push_back(s_of(id) + ":set_dropping:" + (v ? "1" : "0"));
  }
  void set_team(std::u16string v) override;
  // `Entity::leave_ground` 现在是虚的（父级已改 `entity.h`）⇒ 直接覆写，逐字复刻 TS
  // 假实体那一行（`_on_ground` 是状态行的镜像，真实体成员顺手保持一致）。
  void leave_ground() override {
    _on_ground = false;
    this->is_on_ground = false;
    g_log.push_back(s_of(id) + ":leave_ground");
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    std::string s = s_of(id) + ":set_velocity";
    if (!nullish(x)) {
      _vel[0] = lfw::to_number(x);
      s += ":" + render(x);
    }
    if (!nullish(y)) {
      _vel[1] = lfw::to_number(y);
      s += ":" + render(y);
    }
    if (!nullish(z)) {
      _vel[2] = lfw::to_number(z);
      s += ":" + render(z);
    }
    g_log.push_back(s);
    // TS 假实体在 `set_velocity` 里自己 `leave_ground()`。
    if (_vel[1] > 0) leave_ground();
  }
  EnterFrameResult enter_frame_by_id(const Value& id_value, bool fallback) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(id_value));
    return EnterFrameResult::NotFound;
  }
  void play_sound(const Value& sounds) override {
    g_log.push_back(s_of(id) + ":play_sound:" + render(sounds));
  }
};

Fake g_att(u"A");
Fake g_vic(u"V");

Fake* other_of(const Fake& f) {
  if (&f == &g_att) return &g_vic;
  if (&f == &g_vic) return &g_att;
  return nullptr;
}

// `victim.team = attacker.team`：端口把值收成了 `std::u16string` ⇒ 台面按**来源实体**的
// 镜像还原（本切片唯一的写入点就是这句），镜头里的数字 3 才不会被写成字符串 `"3"`。
void Fake::set_team(std::u16string v) {
  Fake* src = other_of(*this);
  if (src != nullptr && src->team() == v) {
    _team = src->_team;
  } else {
    _team = Value(v);
  }
  sync_team();
  g_log.push_back(s_of(id) + ":set_team:" + render(_team));
}

Collision g_c;
HandlersEnv g_henv;
Handlers2Env g_h2;
WeaponIsHitEnv g_env;
Cube g_acube;
Cube g_bcube;
Value g_itr_motionless;
Value g_recov = Value(0.25);
ItrVelocity g_iv;

void bind() {
  g_henv.attacker_itr_motionless = [](const Collision&) { return g_itr_motionless; };
  g_henv.attacker_set_motionless = [](const Collision&, const Value& v) {
    g_att._motionless = v;
    g_log.push_back("A:set_motionless:" + render(v));
  };
  g_henv.victim_set_shaking = [](const Collision&, const Value& v) {
    g_vic._shaking = v;
    g_log.push_back("V:set_shaking:" + render(v));
  };
  g_henv.attacker_set_arest = [](const Collision&, double v) {
    g_att._arest = Value(v);
    g_log.push_back("A:set_arest:" + num(v));
  };
  g_henv.victim_add_v_rest = [](Collision& c) {
    g_log.push_back("add_v_rest:" + s_of(c.vid) + ":" + num(c.rest));
  };
  g_henv.attacker_pick_victim = [](Collision&) {};
  g_henv.buff_get = [](const std::u16string&) { return false; };
  g_henv.buff_lifetime_zero = [](const std::u16string&) {};
  g_henv.buff_create = [](const std::u16string&, const std::u16string&) { return false; };
  g_henv.buff_set_attacker = [](const std::u16string&, const std::u16string&) {};
  g_henv.buff_set_victim = [](const std::u16string&, const std::u16string&) {};
  g_henv.buff_mount = [](const std::u16string&) {};
  g_c.env = &g_henv;

  g_h2.warn = [](const std::u16string& m) { g_log.push_back("warn:" + s_of(m)); };
  g_h2.hp_recoverability = []() { return g_recov; };
  g_h2.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  g_h2.summary_apply_damage = [](lfw::Entity* a, const Value& injury, lfw::Entity* v,
                                 const Value& prev_hp) {
    g_log.push_back("summary:" + s_of(a->id) + ":" + render(injury) + ":" + s_of(v->id) + ":" +
                    render(prev_hp));
  };
  g_h2.buff_env = []() { return static_cast<const lfw::buff::BuffEnv*>(nullptr); };
  g_h2.is_fighter = [](const lfw::Entity& e) {
    return lfw::entity::is_fighter_data(e.data());
  };
  g_h2.calc_velocity = [](Collision&) {
    ItrVelocity r = g_iv;
    r.x = g_iv.x * g_att.facing;
    return r;
  };
  lfw::collision::set_handlers2_env(g_h2);

  g_env.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  g_env.spark_point = [](const Collision&, const Cube& a, const Cube& b) {
    SparkPoint p;
    p.x = Value(a.left);
    p.y = Value(b.top);
    p.z = Value(a.near);
    g_log.push_back("sp:" + render(p.x) + ":" + render(p.y) + ":" + render(p.z));
    return p;
  };
  g_env.spark = [](const Value& x, const Value& y, const Value& z, const std::u16string& kind) {
    g_log.push_back("spark:" + render(x) + ":" + render(y) + ":" + render(z) + ":" +
                    s_of(kind));
  };
  g_env.mt_mark = [](const std::u16string& m) { g_log.push_back("mark:" + s_of(m)); };
  g_env.mt_pick = [](const Value& indexes) {
    g_log.push_back("pick:" + render(indexes));
    return Value(u"picked");
  };
  g_env.calc_velocity = [](Collision&) {
    ItrVelocity r = g_iv;
    r.x = g_iv.x * g_att.facing;
    return r;
  };
  lfw::collision::set_weapon_is_hit_env(g_env);
}

std::string side_text(const Fake& f) {
  return s_of(f.id) + ".hp=" + render(f._hp) + " " + s_of(f.id) + ".hp_r=" + render(f._hp_r) +
         " " + s_of(f.id) + ".tough=" + num(f._toughness) + " " + s_of(f.id) +
         ".state=" + render(f._state) + " " + s_of(f.id) + ".face=" + render(f._face) + " " +
         s_of(f.id) + ".base_type=" + render(f._base_type) + " " + s_of(f.id) +
         ".team=" + render(f._team) + " " + s_of(f.id) +
         ".bearer=" + (f._bearer ? "1" : "0") + " " + s_of(f.id) +
         ".dropping=" + (f._dropping ? "1" : "0") + " " + s_of(f.id) +
         ".on_ground=" + (f._on_ground ? "1" : "0") + " " + s_of(f.id) +
         ".data_id=" + render(f._data_id) + " " + s_of(f.id) + ".vel=" + num(f._vel[0]) + "/" +
         num(f._vel[1]) + "/" + num(f._vel[2]);
}

std::string state_text() {
  std::string s = side_text(g_att) + " " + side_text(g_vic);
  s += " inj=" + render(g_c.injury) + " inj_r=" + render(g_c.injury_r) +
       " rinj=" + render(g_c.real_injury) + " rinj_r=" + render(g_c.real_injury_r);
  return s;
}

void walk_side(Fake& f, const std::string& field, const std::vector<std::string>& tok,
               size_t& i) {
  if (field == "hp") {
    f._hp = parse_value(tok, i);
  } else if (field == "hp_r") {
    f._hp_r = parse_value(tok, i);
  } else if (field == "tough") {
    f._toughness = trace::to_double(tok[i++]);
  } else if (field == "state") {
    f._state = parse_value(tok, i);
  } else if (field == "face") {
    f._face = parse_value(tok, i);
    // 真实体读的是 `facing`（`double`）；`u` 按 TS 的 `Number(undefined)` = NaN 落。
    f.facing = lfw::to_number(f._face);
  } else if (field == "base_type") {
    f._base_type = parse_value(tok, i);
  } else if (field == "team") {
    f._team = parse_value(tok, i);
    f.sync_team();
  } else if (field == "bearer") {
    f._bearer = tok[i++] == "1";
    f.bearer = f._bearer ? &f : nullptr;
  } else if (field == "drop") {
    f._dropping = tok[i++] == "1";
    f.dropping = f._dropping;
  } else if (field == "data_id") {
    f._data_id = parse_value(tok, i);
    f.sync_data();
  } else if (field == "throwings") {
    f._throwings = parse_value(tok, i);
    f.sync_data();
  } else if (field == "in_the_sky") {
    f._in_the_skys = parse_value(tok, i);
    f.sync_data();
  } else if (field == "velx") {
    f._vel[0] = trace::to_double(tok[i++]);
  } else if (field == "vely") {
    f._vel[1] = trace::to_double(tok[i++]);
  } else if (field == "velz") {
    f._vel[2] = trace::to_double(tok[i++]);
  } else if (field == "on_ground") {
    f._on_ground = tok[i++] == "1";
  } else if (field == "fall") {
    f._fall = parse_value(tok, i);
  } else if (field == "fall_max") {
    f._fall_max = parse_value(tok, i);
  } else if (field == "defend") {
    f._defend = parse_value(tok, i);
  } else if (field == "resting") {
    f._resting = parse_value(tok, i);
  } else if (field == "type") {
    f._type = parse_value(tok, i);
    f.sync_data();
  } else if (field == "src_emitter") {
    f._source_emitter = parse_value(tok, i);
    // `src_emitter()` 不是虚函数（读 `emitters`）⇒ 只有给字符串时才落得进去。
    const std::u16string* e = std::get_if<std::u16string>(&f._source_emitter);
    f.emitters.clear();
    if (e != nullptr) f.emitters.push_back(*e);
  } else if (field == "ice") {
    f._ice = parse_value(tok, i);
  } else if (field == "hit_sounds") {
    f._hit_sounds = parse_value(tok, i);
    f.sync_data();
  } else if (field == "motionless") {
    f._motionless = parse_value(tok, i);
  } else if (field == "dataset") {
    f._dataset_values = parse_value(tok, i);
  } else {
    std::fprintf(stderr, "unknown side field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void run(const std::string& name) {
  if (name == "hit") {
    lfw::collision::handle_weapon_is_hit(g_c);
  } else {
    std::fprintf(stderr, "unknown handler '%s'\n", name.c_str());
    std::exit(2);
  }
  std::printf("run %s || %s | %s\n", name.c_str(), join(g_log).c_str(), state_text().c_str());
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_weapon_is_hit <case-file>\n");
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
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "itr") {
        g_c.itr = parse_value(t, i);
      } else if (sub == "dataset") {
        g_c.dataset = parse_value(t, i);
      } else if (sub == "rest") {
        g_c.rest = trace::to_double(t[i++]);
      } else if (sub == "recov") {
        g_recov = Value(trace::to_double(t[i++]));
      } else if (sub == "itr_motionless") {
        g_itr_motionless = parse_value(t, i);
      } else if (sub == "velx") {
        g_iv.x = trace::to_double(t[i++]);
      } else if (sub == "vely") {
        g_iv.y = trace::to_double(t[i++]);
      } else if (sub == "velz") {
        g_iv.z = trace::to_double(t[i++]);
      } else if (sub == "acube") {
        const Value v = parse_value(t, i);
        g_acube.left = lfw::to_number(lfw::field_or(v, u"left"));
        g_acube.right = lfw::to_number(lfw::field_or(v, u"right"));
        g_acube.bottom = lfw::to_number(lfw::field_or(v, u"bottom"));
        g_acube.top = lfw::to_number(lfw::field_or(v, u"top"));
        g_acube.near = lfw::to_number(lfw::field_or(v, u"near"));
        g_acube.far = lfw::to_number(lfw::field_or(v, u"far"));
        g_c.a_cube = g_acube;
      } else if (sub == "bcube") {
        const Value v = parse_value(t, i);
        g_bcube.left = lfw::to_number(lfw::field_or(v, u"left"));
        g_bcube.right = lfw::to_number(lfw::field_or(v, u"right"));
        g_bcube.bottom = lfw::to_number(lfw::field_or(v, u"bottom"));
        g_bcube.top = lfw::to_number(lfw::field_or(v, u"top"));
        g_bcube.near = lfw::to_number(lfw::field_or(v, u"near"));
        g_bcube.far = lfw::to_number(lfw::field_or(v, u"far"));
        g_c.b_cube = g_bcube;
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
      run(t[i++]);
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
