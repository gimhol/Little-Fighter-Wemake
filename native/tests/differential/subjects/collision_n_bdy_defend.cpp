#include <cstdio>
#include <fstream>
#include <string>
#include <variant>
#include <vector>

#include "lfw/collision/fall.h"
#include "lfw/collision/handlers.h"
#include "lfw/collision/handlers2.h"
#include "lfw/collision/handlers3.h"
#include "lfw/collision/is_fall.h"
#include "lfw/collision/n_bdy_defend.h"
#include "lfw/collision/n_bdy_normal.h"
#include "lfw/core/value.h"
#include "lfw/defines/itr_effect.h"
#include "lfw/defines/state_enum.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::collision::Collision;
using lfw::collision::Cube;
using lfw::collision::FallEnv;
using lfw::collision::Handlers2Env;
using lfw::collision::Handlers3Env;
using lfw::collision::HandlersEnv;
using lfw::collision::ItrVelocity;
using lfw::collision::NbdDefendEnv;
using lfw::collision::NbdyNormalEnv;
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

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<lfw::NullTag>(v);
}

Value g_collision_dataset;

// 窄接口退役后 `buff_entity()` 这条读面已不在实体面上：TS 台面对应的是个没人读的
// `buff_entity = { id: "buff" }` 字段 ⇒ 台面照旧留一个同形的空壳，观测点不在这里。
struct FakeBuff : lfw::Entity {
  explicit FakeBuff(std::u16string id) : Entity(fx::shared_world(), Value()) {
    this->id = std::move(id);
  }
};

// 切片 4CE：碰撞族窄接口（`INdbdyDefendEntity` / `IH3Entity` 等）退役 ⇒ 台面假实体就是真
// `lfw::Entity`，与 TS 台面同形；观测点只剩「实体面自己写一遍」的那几条虚函数，其余读面
//（`data_indexes_of` / `cpoint_*` / `holding_base_type`）由实体从台面给的 `data()` / `frame` /
// `dataset()` 上取。
struct Fake : lfw::Entity {
  std::u16string _id;
  Value _hp = Value(50.0);
  Value _hp_r = Value(50.0);
  Value _fall = Value(30.0);
  Value _fall_max = Value(100.0);
  Value _defend = Value(3.0);
  Value _defend_max = Value(50.0);
  Value _defend_ratio;
  Value _resting = Value(0.0);
  Value _src_emitter;
  Value _shaking;
  Value _motionless;
  Value _itr_fall = Value(7.0);
  Value _hit_sounds;
  Value _ice;
  Value _elec_dur = Value(7.0);
  Value _state;
  Value _facing = Value(1.0);
  Value _fire;
  Value _crit;
  Value _holding;
  Value _team = Value(0.0);
  Value _base_type;
  Value _armor;
  Value _in_the_sky;
  Value _dizzy;
  Value _grand_injured;
  Value _injured;
  Value _backhurtact;
  Value _fronthurtact;
  bool _bearer = false;
  double _ground_y = 0;
  double _toughness = 9;
  double _toughness_max = 9;
  FakeBuff _buff;
  Value _dataset_values;
  Value _data_raw;
  // `Entity::data()` 返回 `const Value&` ⇒ 镜像必须是成员（不能返回临时量）。
  mutable Value _data_out;

  explicit Fake(std::u16string id) : Entity(fx::shared_world(), Value()), _buff(id) {
    this->id = std::move(id);
    _id = this->id;
    // TS 台面的 `_armor = undefined`：实体面的 `armor` 也要是「没设过」（结构体默认 `NullTag`）。
    armor = Value();
    set_type(Value(8.0));
    sync_frame();
  }

  void set_type(const Value& t) {
    auto o = std::make_shared<lfw::Object>();
    o->set(u"type", t);
    _data_raw = Value(o);
  }

  // TS 台面的 `get frame()` 只交出 `cpoint` 的那两个动作；实体面的 `cpoint_backhurtact()` /
  // `cpoint_fronthurtact()` 只写一遍、从 `frame` 上取 ⇒ 台面把这个形状钉进 `frame`。
  void sync_frame() {
    auto cp = std::make_shared<lfw::Object>();
    cp->set(u"backhurtact", _backhurtact);
    cp->set(u"fronthurtact", _fronthurtact);
    auto fr = std::make_shared<lfw::Object>();
    fr->set(u"id", Value(std::u16string(u"f1")));
    fr->set(u"cpoint", Value(cp));
    frame = Value(fr);
  }

  double hp() const override { return lfw::to_number(_hp); }
  void set_hp(double v) override {
    _hp = Value(v);
    g_log.push_back(s_of(_id) + ":set_hp:" + num(v));
  }
  double hp_r() const override { return lfw::to_number(_hp_r); }
  void set_hp_r(double v) override {
    _hp_r = Value(v);
    g_log.push_back(s_of(_id) + ":set_hp_r:" + num(v));
  }
  double toughness() const override { return _toughness; }
  void set_toughness(double v) override {
    _toughness = v;
    g_log.push_back(s_of(_id) + ":set_toughness:" + num(v));
  }
  double toughness_max() const override { return _toughness_max; }
  // TS 台面的 `get data()`：`data_indexes_of` / `is_fighter_data` 都从这条读面上取。
  const Value& data() const override {
    auto o = std::make_shared<lfw::Object>();
    o->set(u"type", lfw::field_or(_data_raw, u"type"));
    auto base = std::make_shared<lfw::Object>();
    base->set(u"hit_sounds", _hit_sounds);
    o->set(u"base", Value(base));
    auto idx = std::make_shared<lfw::Object>();
    idx->set(u"fire", _fire);
    idx->set(u"critical_hit", _crit);
    idx->set(u"dizzy", _dizzy);
    idx->set(u"grand_injured", _grand_injured);
    idx->set(u"injured", _injured);
    idx->set(u"ice", _ice);
    o->set(u"indexes", Value(idx));
    _data_out = Value(o);
    return _data_out;
  }
  Value dataset(const std::u16string& key) const override {
    if (key == u"electrify_duration") return _elec_dur;
    // `Entity::itr_fall()`（非虚，实体面只写一遍）读 `itr.fall ?? dataset("itr_fall")`：
    // TS 台面用 `itr_fall(itr)` 方法交出这个值，这里改从 `dataset` 交出去。
    if (key == u"itr_fall") return _itr_fall;
    if (key == u"itr_shaking" || key == u"itr_motionless") {
      const Value own = lfw::field_or(_dataset_values, key.c_str());
      if (!std::holds_alternative<std::monostate>(own)) return own;
      return lfw::field_or(g_collision_dataset, key.c_str());
    }
    return lfw::field_or(_dataset_values, key.c_str());
  }
  double resting() const override { return lfw::to_number(_resting); }
  void set_resting(double v) override {
    _resting = Value(v);
    g_log.push_back(s_of(_id) + ":set_resting:" + num(v));
  }
  double fall_value() const override { return lfw::to_number(_fall); }
  void set_fall_value(double v) override {
    _fall = Value(v);
    g_log.push_back(s_of(_id) + ":set_fall_value:" + num(v));
  }
  double fall_value_max() const override { return lfw::to_number(_fall_max); }
  double defend_value() const override { return lfw::to_number(_defend); }
  void set_defend_value(double v) override {
    _defend = Value(v);
    g_log.push_back(s_of(_id) + ":set_defend_value:" + num(v));
  }
  // TS 台面的 `get defend_value_max()` 故意回 `this._defend`（手办缺陷照抄）。
  double defend_value_max() const override { return lfw::to_number(_defend); }
  // TS 台面的 `get defend_ratio()`：`_defend_ratio ?? world.dataset.defend_ratio`。
  // `Entity::set_defend_ratio()` 非虚，但这条链上没人写它 ⇒ 只用虚的读面镜像即可。
  double defend_ratio() const override {
    return nullish(_defend_ratio) ? lfw::to_number(lfw::field_or(g_collision_dataset, u"defend_ratio"))
                                  : lfw::to_number(_defend_ratio);
  }
  Entity& set_shaking(double v) override {
    shaking = v;
    g_log.push_back(s_of(_id) + ":set_shaking:" + num(v));
    return *this;
  }
  Entity& set_motionless(double v) override {
    motionless = v;
    g_log.push_back(s_of(_id) + ":set_motionless:" + num(v));
    return *this;
  }

  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    std::string s = s_of(_id) + ":set_velocity";
    if (!nullish(x)) {
      velocity.x = lfw::to_number(x);
      s += ":" + render(x);
    }
    if (!nullish(y)) {
      velocity.y = lfw::to_number(y);
      s += ":" + render(y);
    }
    if (!nullish(z)) {
      velocity.z = lfw::to_number(z);
      s += ":" + render(z);
    }
    g_log.push_back(s);
  }

  lfw::EnterFrameResult enter_frame_by_id(const Value& frame_ref, bool fallback) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame_by_id:" + render(frame_ref));
    return lfw::EnterFrameResult::Gone;
  }
  void play_sound(const Value& sounds) override {
    g_log.push_back(s_of(_id) + ":play_sound:" + render(sounds));
  }

  // TS 台面把 `spark_point` 桩成 `[a.left, b.top, a.near]`（真算法要走 `world.mt` + 交汇盒，
  // 两边都省掉：TS 台面的桩和这里逐字相同）。
  void spark_point(const Cube& a, const Cube& b, double& x, double& y, double& z) const override {
    x = a.left;
    y = b.top;
    z = a.near;
    g_log.push_back("sp:" + num(x) + ":" + num(y) + ":" + num(z));
  }
  double ground_y() const override { return _ground_y; }

  Value state() const override { return _state; }
};

Fake g_att(u"A");
Fake g_vic(u"V");
Collision g_c;
HandlersEnv g_henv;
Handlers2Env g_h2;
Handlers3Env g_h3;
FallEnv g_fall;
NbdyNormalEnv g_nb;
NbdDefendEnv g_nbd;
Value g_itr_motionless;
bool g_armor_work = false;
ItrVelocity g_iv;

Value is_fall_graph() {
  auto v = std::make_shared<lfw::Object>();
  v->set(u"fall_value", g_vic._fall);
  v->set(u"hp", g_vic._hp);
  v->set(u"is_on_ground", Value(g_vic.position.y <= g_vic._ground_y));
  auto fr = std::make_shared<lfw::Object>();
  fr->set(u"state", g_vic._state);
  v->set(u"frame", Value(fr));
  v->set(u"data", g_vic.data());
  auto c = std::make_shared<lfw::Object>();
  c->set(u"victim", Value(v));
  return Value(c);
}

ItrVelocity seam_velocity(Collision&) {
  ItrVelocity r = g_iv;
  const Value effect = lfw::field_or(g_c.itr, u"effect");
  const bool position_based =
      lfw::strict_equals(effect, Value(static_cast<double>(lfw::ItrEffect::FireExplosion))) ||
      lfw::strict_equals(effect, Value(static_cast<double>(lfw::ItrEffect::Explosion))) ||
      lfw::strict_equals(g_att._state,
                         Value(static_cast<double>(lfw::StateEnum::HeavyWeapon_InTheSky)));
  const double direction = position_based ? -1.0 : lfw::to_number(g_att._facing);
  r.x = g_iv.x * direction;
  r.y = lfw::collision::is_fall(is_fall_graph()) ? g_iv.y : 0.0;
  r.x_direction = Value(direction);
  return r;
}

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
  g_henv.attacker_set_arest = [](const Collision&, double v) { g_log.push_back("A:set_arest:" + num(v)); };
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
  g_h2.hp_recoverability = []() { return lfw::field_or(g_collision_dataset, u"hp_recoverability"); };
  g_h2.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att._id) return &g_att;
    if (id == g_vic._id) return &g_vic;
    return nullptr;
  };
  g_h2.summary_apply_damage = [](lfw::Entity* a, const Value& injury, lfw::Entity* v,
                                 const Value& prev_hp) {
    g_log.push_back("summary:" + s_of(a->id) + ":" + render(injury) + ":" + s_of(v->id) + ":" +
                    render(prev_hp));
  };
  g_h2.is_fighter = [](const lfw::Entity& e) {
    return lfw::entity::is_fighter_data(e.data());
  };
  g_h2.calc_velocity = seam_velocity;
  lfw::collision::set_handlers2_env(g_h2);

  g_h3.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att._id) return &g_att;
    if (id == g_vic._id) return &g_vic;
    return nullptr;
  };
  g_h3.is_ball = [](const lfw::Entity& e) { return lfw::entity::is_ball_data(e.data()); };
  g_h3.is_weapon = [](const lfw::Entity& e) { return lfw::entity::is_weapon_data(e.data()); };
  g_h3.spark_point = [](const Collision&, const Cube& a, const Cube& b, double& x, double& y, double& z) {
    x = a.left;
    y = b.top;
    z = a.near;
    g_log.push_back("sp:" + num(x) + ":" + num(y) + ":" + num(z));
  };
  g_h3.spark = [](double x, double y, double z, const Value& type) {
    g_log.push_back("spark:" + num(x) + ":" + num(y) + ":" + num(z) + ":" + render(type));
  };
  g_h3.play_sound_global = [](const Value& sounds, double x, double y, double z) {
    g_log.push_back("snd3:" + render(sounds) + ":" + num(x) + ":" + num(y) + ":" + num(z));
  };
  g_h3.is_armor_work = [](Collision&) { return g_armor_work; };
  lfw::collision::set_handlers3_env(g_h3);

  g_fall.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att._id) return &g_att;
    if (id == g_vic._id) return &g_vic;
    return nullptr;
  };
  g_fall.is_fighter = [](const lfw::Entity& e) {
    return lfw::entity::is_fighter_data(e.data());
  };
  g_fall.spark = [](const Value& x, const Value& y, const Value& z, const Value& type) {
    g_log.push_back("spark:" + render(x) + ":" + render(y) + ":" + render(z) + ":" + render(type));
  };
  g_fall.calc_velocity = seam_velocity;
  lfw::collision::set_fall_env(g_fall);

  g_nb.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att._id) return &g_att;
    if (id == g_vic._id) return &g_vic;
    return nullptr;
  };
  g_nb.is_fighter = [](const lfw::Entity& e) {
    return lfw::entity::is_fighter_data(e.data());
  };
  g_nb.is_fall = [](Collision&) { return lfw::collision::is_fall(is_fall_graph()); };
  g_nb.spark = [](const Value& x, const Value& y, const Value& z, const Value& type) {
    g_log.push_back("spark:" + render(x) + ":" + render(y) + ":" + render(z) + ":" + render(type));
  };
  g_nb.calc_velocity = seam_velocity;
  lfw::collision::set_nbdy_normal_env(g_nb);

  g_nbd.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att._id) return &g_att;
    if (id == g_vic._id) return &g_vic;
    return nullptr;
  };
  g_nbd.calc_velocity = seam_velocity;
  g_nbd.spark = [](const Value& x, const Value& y, const Value& z, const Value& type) {
    g_log.push_back("spark:" + render(x) + ":" + render(y) + ":" + render(z) + ":" +
                    render(type));
  };
  g_nbd.dispatch = [](const Collision&, const std::u16string& type, const Value& action) {
    g_log.push_back("dispatch:" + s_of(type) + ":" + render(action));
  };
  lfw::collision::set_nbd_defend_env(g_nbd);
}

std::string side_text(const Fake& f) {
  return s_of(f._id) + ".hp=" + render(f._hp) + " " + s_of(f._id) + ".hp_r=" + render(f._hp_r) +
         " " + s_of(f._id) + ".tough=" + num(f._toughness) + "/" + num(f._toughness_max) + " " +
         s_of(f._id) + ".armor=" + render(f._armor) + " " + s_of(f._id) +
         ".state=" + render(f._state) + " " + s_of(f._id) + ".face=" + render(f._facing) + " " +
         s_of(f._id) + ".fall=" + render(f._fall) + " " + s_of(f._id) +
         ".fall_max=" + render(f._fall_max) + " " + s_of(f._id) + ".defend=" + render(f._defend) +
         " " + s_of(f._id) + ".resting=" + render(f._resting) + " " + s_of(f._id) +
         ".vel=" + num(f.velocity.x) + "/" + num(f.velocity.y) + "/" + num(f.velocity.z);
}

std::string state_text() {
  std::string s = side_text(g_att) + " " + side_text(g_vic);
  s += " inj=" + render(g_c.injury) + " inj_r=" + render(g_c.injury_r) +
       " rinj=" + render(g_c.real_injury);
  return s;
}

void walk_side(Fake& f, const std::string& field, const std::vector<std::string>& tok, size_t& i) {
  if (field == "hp") {
    f._hp = parse_value(tok, i);
  } else if (field == "hp_r") {
    f._hp_r = parse_value(tok, i);
  } else if (field == "tough") {
    f._toughness = trace::to_double(tok[i++]);
  } else if (field == "tough_max") {
    f._toughness_max = trace::to_double(tok[i++]);
  } else if (field == "armor") {
    f._armor = parse_value(tok, i);
    f.armor = f._armor;
  } else if (field == "state") {
    f._state = parse_value(tok, i);
  } else if (field == "face") {
    f._facing = parse_value(tok, i);
    f.facing = lfw::to_number(f._facing);
  } else if (field == "team") {
    f._team = parse_value(tok, i);
  } else if (field == "base_type") {
    f._base_type = parse_value(tok, i);
  } else if (field == "bearer") {
    f._bearer = tok[i++] == "1";
  } else if (field == "type") {
    f.set_type(parse_value(tok, i));
  } else if (field == "velx") {
    f.velocity.x = trace::to_double(tok[i++]);
  } else if (field == "vely") {
    f.velocity.y = trace::to_double(tok[i++]);
  } else if (field == "velz") {
    f.velocity.z = trace::to_double(tok[i++]);
  } else if (field == "posx") {
    f.position.x = trace::to_double(tok[i++]);
  } else if (field == "posy") {
    f.position.y = trace::to_double(tok[i++]);
  } else if (field == "posz") {
    f.position.z = trace::to_double(tok[i++]);
  } else if (field == "ground_y") {
    f._ground_y = trace::to_double(tok[i++]);
  } else if (field == "fall") {
    f._fall = parse_value(tok, i);
  } else if (field == "fall_max") {
    f._fall_max = parse_value(tok, i);
  } else if (field == "defend") {
    f._defend = parse_value(tok, i);
  } else if (field == "defend_ratio") {
    f._defend_ratio = parse_value(tok, i);
  } else if (field == "itr_fall") {
    f._itr_fall = parse_value(tok, i);
  } else if (field == "resting") {
    f._resting = parse_value(tok, i);
  } else if (field == "fire") {
    f._fire = parse_value(tok, i);
  } else if (field == "crit") {
    f._crit = parse_value(tok, i);
  } else if (field == "dizzy") {
    f._dizzy = parse_value(tok, i);
  } else if (field == "grand_injured") {
    f._grand_injured = parse_value(tok, i);
  } else if (field == "injured") {
    f._injured = parse_value(tok, i);
  } else if (field == "backhurtact") {
    f._backhurtact = parse_value(tok, i);
    f.sync_frame();
  } else if (field == "fronthurtact") {
    f._fronthurtact = parse_value(tok, i);
    f.sync_frame();
  } else if (field == "holding") {
    f._holding = parse_value(tok, i);
  } else if (field == "ice") {
    f._ice = parse_value(tok, i);
  } else if (field == "hit_sounds") {
    f._hit_sounds = parse_value(tok, i);
  } else if (field == "src_emitter") {
    f._src_emitter = parse_value(tok, i);
  } else if (field == "motionless") {
    f._motionless = parse_value(tok, i);
  } else if (field == "in_the_sky") {
    f._in_the_sky = parse_value(tok, i);
  } else if (field == "dataset") {
    f._dataset_values = parse_value(tok, i);
  } else {
    std::fprintf(stderr, "unknown side field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void run() {
  lfw::collision::handle_itr_normal_bdy_defend(g_c);
  std::printf("run hit || %s | %s\n", join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_n_bdy_defend <case-file>\n");
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
        g_collision_dataset = g_c.dataset;
      } else if (sub == "rest") {
        g_c.rest = trace::to_double(t[i++]);
      } else if (sub == "itr_motionless") {
        g_itr_motionless = parse_value(t, i);
      } else if (sub == "bframe") {
        g_c.bframe = parse_value(t, i);
      } else if (sub == "aframe") {
        g_c.aframe = parse_value(t, i);
      } else if (sub == "bdy") {
        g_c.bdy = parse_value(t, i);
      } else if (sub == "armorwork") {
        g_armor_work = t[i++] == "1";
      } else if (sub == "velx") {
        g_iv.x = trace::to_double(t[i++]);
      } else if (sub == "vely") {
        g_iv.y = trace::to_double(t[i++]);
      } else if (sub == "velz") {
        g_iv.z = trace::to_double(t[i++]);
      } else if (sub == "acube") {
        const Value v = parse_value(t, i);
        g_c.a_cube.left = lfw::to_number(lfw::field_or(v, u"left"));
        g_c.a_cube.right = lfw::to_number(lfw::field_or(v, u"right"));
        g_c.a_cube.bottom = lfw::to_number(lfw::field_or(v, u"bottom"));
        g_c.a_cube.top = lfw::to_number(lfw::field_or(v, u"top"));
        g_c.a_cube.near = lfw::to_number(lfw::field_or(v, u"near"));
        g_c.a_cube.far = lfw::to_number(lfw::field_or(v, u"far"));
      } else if (sub == "bcube") {
        const Value v = parse_value(t, i);
        g_c.b_cube.left = lfw::to_number(lfw::field_or(v, u"left"));
        g_c.b_cube.right = lfw::to_number(lfw::field_or(v, u"right"));
        g_c.b_cube.bottom = lfw::to_number(lfw::field_or(v, u"bottom"));
        g_c.b_cube.top = lfw::to_number(lfw::field_or(v, u"top"));
        g_c.b_cube.near = lfw::to_number(lfw::field_or(v, u"near"));
        g_c.b_cube.far = lfw::to_number(lfw::field_or(v, u"far"));
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
      run();
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
