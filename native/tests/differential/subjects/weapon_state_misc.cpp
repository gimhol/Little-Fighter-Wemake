#include <cmath>
#include <cstdio>
#include <fstream>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/weapon_state_misc.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Array;
using lfw::Object;
using lfw::Entity;
using lfw::EnterFrameResult;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::WeaponState_Base;
using lfw::state::WeaponState_InTheSky;
using lfw::state::WeaponState_OnGround;
using lfw::state::WeaponState_OnHand;
using lfw::state::WeaponState_Throwing;
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

// 切片 4CF：状态族窄接口退役 ⇒ 台面假实体派生真 `lfw::Entity`（见 DESIGN §142），只覆写
// 实体面上确实存在的那几条读/写（TS 台面同样只给这几条，见 `weapon_state_misc.ts`）。
//
// 两条实体面口径偏差（与 TS 的任意值语义对不上的地方，台面自己补）：
//   * `motionless` 在实体面是 `double` 字段（TS 是任意值）⇒「真值但数值化是 NaN」这一档
//     （用例里的 `s "abc"`）只能记成占位 `1`：`wsoh_pre_update` 的 `if (!motionless)` 与 TS
//     一致地过，要复刻的 `max("abc", …) === NaN` 由 `bearer_motionless()` 侧给 `NaN`。
//   * `set_team` 收 `std::u16string`（库里 `to_string(e.lfw_new_team())`）⇒ TS 的 `undefined`
//     到这儿成了字面量 `"undefined"`，台面映回 `undefined`（状态行打 `u`）。
//   * `Entity::handle_ground_velocity_decay` 虽已随状态面虚化（切片 4CF 收尾），本台面仍走旧路子：
//     真实现要读六个 friction `dataset` 键（TS 假件把整条换掉、不读），所以那六个键在这里被吞掉，
//     日志由虚方法 `handle_velocity_decay` 补（见下面 `dataset` / `handle_velocity_decay` 的注释）。
//   * `frame_id()` 是非虚读面（读实体自己的 `frame`）⇒ 由 `set_fid` 把镜像灌进实体。
struct FakeEnt : Entity {
  // 台面镜像：与 TS 台面的后备字段一一对应（`undefined` 记为默认 `Value()`）。
  std::u16string _id;
  Value _team;
  Value _new_team;
  Value _motionless;
  bool _motionless_nan = false;
  double _motionless_field = 0;
  mutable bool _in_ground_decay = false;
  bool _has_bearer = false;
  Value _bmotion;
  Value _dh;
  Value _dropping;
  double _hp = 0;
  double _hpr = 0;
  Value _base;
  Value _wt;
  Value _behavior;
  Value _fid;
  Value _onlanding;
  Value _vstate;
  Value _velx;
  Value _vely;
  Value _velz;
  Value _align;
  Value _indexes_flag;
  Value _throw_on_ground;
  Value _just_on_ground;
  Value _isky;
  Value _ithrow;
  Value _gval;

  explicit FakeEnt(std::u16string id) : Entity(fx::shared_world(), Value()) {
    _id = std::move(id);
    this->id = _id;
  }

  // --- 实体面：库读的那几条 -------------------------------------------------
  // TS 的 `get data`：`_indexes_flag` 假值 ⇒ `indexes` 是 `undefined`（表的四项一起没）。
  // `data()` 收 `const Value&` ⇒ 镜像必须是成员，不能返回临时量。
  const Value& data() const override {
    Object o;
    if (lfw::truthy(_indexes_flag)) {
      Object indexes;
      indexes.set(u"throw_on_ground", _throw_on_ground);
      indexes.set(u"just_on_ground", _just_on_ground);
      indexes.set(u"in_the_skys", _isky);
      indexes.set(u"throwings", _ithrow);
      o.set(u"indexes", Value(std::make_shared<Object>(indexes)));
    }
    o.set(u"base", _base);
    _data_mirror = Value(std::make_shared<Object>(o));
    return _data_mirror;
  }
  Value state() const override { return _vstate; }
  // TS 的 `dataset(key)` 只把 `weapon_throwing_gravity` 答成 `_gval`，其余 `undefined`。
  // 六个 friction 键是 `Entity::handle_ground_velocity_decay()` 的头三读（本台面没把它改名覆写，
  // 真实现还在跑）：让真实现读空值并记账，日志由虚方法 `handle_velocity_decay` 补
  // （同 `state_base_proxy.cpp` 的口径）。
  Value dataset(const std::u16string& key) const override {
    if (key == u"friction_factor" || key == u"land_friction_factor" || key == u"friction_x" ||
        key == u"land_friction_x" || key == u"friction_z" || key == u"land_friction_z") {
      if (key == u"friction_factor" || key == u"land_friction_factor") _in_ground_decay = true;
      return Value();
    }
    g_log.push_back(s_of(_id) + ":dataset:" + s_of(key));
    if (key == std::u16string(u"weapon_throwing_gravity")) return _gval;
    return Value();
  }
  double hp() const override { return _hp; }
  double hp_r() const override { return _hpr; }
  Value lfw_new_team() const override { return _new_team; }
  double velocity_y() const override { return lfw::to_number(_vely); }
  double velocity_x() const override { return lfw::to_number(_velx); }
  double velocity_z() const override { return lfw::to_number(_velz); }
  bool has_bearer() const override { return _has_bearer; }
  // 见上面「`motionless` 口径偏差」：非数字真值那一档的 `max` 结果由这儿给 `NaN`。
  Value bearer_motionless() const override {
    if (_motionless_nan) return Value(std::numeric_limits<double>::quiet_NaN());
    return _bmotion;
  }
  Value frame_on_landing() const override { return _onlanding; }
  Value frame_behavior() const override { return _behavior; }
  Value data_base() const override { return _base; }
  // `base_type` 在实体面是原生 `double`（TS 台面的后备字段是任意值）⇒ 过 `to_number`
  // （`undefined` 记成 `NaN`，与 TS 的「表里没有这个键」同义）。
  double base_type() const override { return lfw::to_number(_wt); }

  // --- 实体面：库写的那几条（TS 台面的同名 setter 也是「只记下来」）------------
  void set_hp(double v) override { _hp = v; }
  void set_hp_r(double v) override { _hpr = v; }
  void set_team(std::u16string v) override {
    _team = (v == u"undefined") ? Value() : Value(std::move(v));
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }
  void set_bearer_motionless(const Value& v) override { _bmotion = v; }
  // `drop_hurted` / `dropping` 在实体面是字段（库直接读）⇒ 后备镜像与字段一起写。
  void set_drop_hurted(const Value& v) override { set_dh(v); }
  void set_dropping(bool v) override {
    dropping = v;
    _dropping = Value(v);
  }
  void leave_ground() override { g_log.push_back(s_of(_id) + ":leave_ground"); }
  EnterFrameResult enter_frame(const Value& frame, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame:" + render(frame));
    return EnterFrameResult::NotFound;
  }
  EnterFrameResult enter_frame_by_id(const Value& id, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame_by_id:" + render(id));
    return EnterFrameResult::NotFound;
  }
  // 库的两处调用点实参顺序不同（`hit_ground_rebouncing` 是 (fid, throwings, in_the_skys)、
  // `InTheSky::update` 是 (fid, in_the_skys, throwings)），所以日志按**收到的顺序**打，
  // 与 TS 台面一致。
  Value find_align_frame(const std::u16string& fid, const Value& second,
                         const Value& third) const override {
    g_log.push_back(s_of(_id) + ":find_align_frame:" + render(Value(fid)) + ":" +
                    render(second) + ":" + render(third));
    return _align;
  }
  // 同 `state_base_proxy.cpp` 的口径：`Entity::handle_ground_velocity_decay` 现在虽是虚的，本台面
  // 仍不改名成同名覆写——真实现那六个 friction `dataset` 读已经被 `dataset` 覆写吞掉了，日志就从
  // 它的最后一步（**虚**方法 `handle_velocity_decay`）取，并跳过真实衰减（TS 假件把整条换掉）。
  void handle_velocity_decay(const Value& accx, std::optional<Value> accz,
                             double factor) override {
    (void)accx;
    (void)accz;
    (void)factor;
    if (!_in_ground_decay) return;
    _in_ground_decay = false;
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay");
  }
  // --- 用例面：后备字段 → 实体面（库直接读字段/非虚读面的那几条）---------------
  void set_dh(const Value& v) {
    _dh = v;
    drop_hurted = lfw::truthy(v);
  }
  void set_dropping_env(bool v) {
    dropping = v;
    _dropping = Value(v);
  }
  // 见上面「`motionless` 口径偏差」：非数字真值记占位 `1`，`NaN` 由 bearer 侧给。
  void set_motionless_env(const Value& v) {
    _motionless = v;
    const double d = lfw::to_number(v);
    _motionless_nan = std::isnan(d) && lfw::truthy(v);
    _motionless_field = _motionless_nan ? 1.0 : d;
  }
  // `wsoh_pre_update` 直接读实体的 `motionless` 字段 ⇒ 只在 `pre_update` 期间把它摆上去：
  // `Entity::handle_ground_velocity_decay()` 的早退守卫（`shaking` / `motionless` 非零即退）
  // 读同一个字段，而那条守卫在 TS 假件上不存在（整条换掉了），驱动完就放掉。
  void apply_motionless() { motionless = _motionless_field; }
  void clear_motionless() { motionless = 0; }
  // `frame_id()` 是实体上的非虚读面（读实体自己的 `frame`）⇒ 把镜像灌进实体。
  void set_fid(const Value& v) {
    _fid = v;
    Object o;
    o.set(u"id", _fid);
    frame = Value(std::make_shared<Object>(o));
  }

 private:
  mutable Value _data_mirror;
};

FakeEnt* g_ent = nullptr;
Value g_state;
Value g_velocity;
WeaponState_Base* g_obj = nullptr;
std::u16string g_cls = u"onground";

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

std::string state_text() {
  const FakeEnt& e = *g_ent;
  return "team=" + render(e._team) + " dh=" + render(e._dh) + " hp=" + num(e._hp) +
         " hpr=" + num(e._hpr) + " motionless=" + render(e._motionless) +
         " bmotion=" + render(e._bmotion) + " dropping=" + render(e._dropping);
}

void bind() {
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_weapon_state_misc <case-file>\n");
    return 2;
  }
  bind();
  g_ent = new FakeEnt(u"W1");
  g_state = Value(static_cast<double>(0));

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
      if (sub == "cls") {
        g_cls = value_text(parse_value(t, i));
      } else if (sub == "state") {
        g_state = parse_value(t, i);
      } else if (sub == "newteam") {
        g_ent->_new_team = parse_value(t, i);
      } else if (sub == "team") {
        g_ent->_team = parse_value(t, i);
      } else if (sub == "motionless") {
        g_ent->set_motionless_env(parse_value(t, i));
      } else if (sub == "bearer") {
        g_ent->_has_bearer = lfw::truthy(parse_value(t, i));
      } else if (sub == "bmotion") {
        g_ent->_bmotion = parse_value(t, i);
      } else if (sub == "dh") {
        g_ent->set_dh(parse_value(t, i));
      } else if (sub == "dropping") {
        g_ent->set_dropping_env(lfw::truthy(parse_value(t, i)));
      } else if (sub == "hp") {
        g_ent->_hp = trace::to_double(t[i++]);
      } else if (sub == "hpr") {
        g_ent->_hpr = trace::to_double(t[i++]);
      } else if (sub == "base") {
        g_ent->_base = parse_value(t, i);
      } else if (sub == "wt") {
        g_ent->_wt = parse_value(t, i);
      } else if (sub == "behavior") {
        g_ent->_behavior = parse_value(t, i);
      } else if (sub == "fid") {
        g_ent->set_fid(parse_value(t, i));
      } else if (sub == "onlanding") {
        g_ent->_onlanding = parse_value(t, i);
      } else if (sub == "vstate") {
        g_ent->_vstate = parse_value(t, i);
      } else if (sub == "vx") {
        g_ent->_velx = parse_value(t, i);
      } else if (sub == "vy") {
        g_ent->_vely = parse_value(t, i);
      } else if (sub == "vz") {
        g_ent->_velz = parse_value(t, i);
      } else if (sub == "align") {
        g_ent->_align = parse_value(t, i);
      } else if (sub == "indexes") {
        g_ent->_indexes_flag = parse_value(t, i);
      } else if (sub == "throwg") {
        g_ent->_throw_on_ground = parse_value(t, i);
      } else if (sub == "justg") {
        g_ent->_just_on_ground = parse_value(t, i);
      } else if (sub == "isky") {
        g_ent->_isky = parse_value(t, i);
      } else if (sub == "ithrow") {
        g_ent->_ithrow = parse_value(t, i);
      } else if (sub == "gval") {
        g_ent->_gval = parse_value(t, i);
      } else if (sub == "vel") {
        g_velocity = parse_value(t, i);
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "run") {
      const std::string& what = t[i++];
      if (what == "make") {
        delete g_obj;
        if (g_cls == u"onhand") {
          g_obj = new WeaponState_OnHand(g_state);
        } else if (g_cls == u"throwing") {
          g_obj = new WeaponState_Throwing(g_state);
        } else if (g_cls == u"inthesky") {
          g_obj = new WeaponState_InTheSky(g_state);
        } else {
          g_obj = new WeaponState_OnGround(g_state);
        }
        std::printf("run make || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_obj->enter) g_obj->enter(*g_ent, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_obj->update(*g_ent);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "landing") {
        if (g_obj->on_landing) g_obj->on_landing(*g_ent, g_velocity);
        std::printf("run landing || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "preupdate") {
        // `motionless` 只在这次调用期间按 TS 的值摆上实体字段（见 `apply_motionless` 的注释）。
        g_ent->apply_motionless();
        if (g_obj->pre_update) g_obj->pre_update(*g_ent);
        g_ent->clear_motionless();
        std::printf("run preupdate || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "gravity") {
        const Value r = g_obj->get_gravity ? g_obj->get_gravity(*g_ent) : Value();
        std::printf("run gravity || %s | r=%s | %s\n", join(g_log).c_str(), render(r).c_str(),
                    state_text().c_str());
      } else {
        std::fprintf(stderr, "unknown run '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  delete g_obj;
  return 0;
}
