#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/cases.h"
#include "lfw/core/value.h"
#include "lfw/entity/drink_info.h"
#include "lfw/entity/entity.h"
#include "lfw/state/character_state_drink.h"
#include "lfw/state/state_burning.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/mersenne_twister.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Array;
using lfw::EnterFrameResult;
using lfw::Object;
using lfw::Value;
using lfw::DrinkInfo;
using lfw::buff::Buff;
using lfw::state::CharacterState_Drink;
using lfw::state::State_Base;
using lfw::state::State_Burning;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;
lfw::MersenneTwister g_mt(0.0);

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

// 切片 4CF：`state::IStateEntity` 退役 ⇒ 台面假实体就是真 `lfw::Entity`，只覆写实体面的虚成员。
// 切片 4CJ：`this.world.dataset.X` 读面（`Entity::world_dataset`）已是 `virtual` ⇒ 台面像 TS 那面
// 「每实例一个打日志的 Proxy」一样直接覆写它（不用再挂假宿主）。
struct FakeEnt : lfw::Entity {
  std::u16string _id;
  Value _data_raw;
  Value _indexes;
  Value _frames;
  // `Entity::data()` 返回 `const Value&` ⇒ `{..._data, indexes, frames}` 的合并镜像是成员。
  mutable Value _data;
  Value _onlanding;
  Value _wdata;
  Value _state;
  Value _hbtype;
  bool _catcher = false;
  double _hp = 50;
  double _hpr = 0;
  Value _hp_max = Value(50.0);
  Value _mp = Value(0.0);
  Value _mp_max = Value(0.0);
  Value _vx;
  Value _vy;
  Value _vz;
  Value _facing;
  Value _bounced;
  bool _has_holding = false;
  Value _hold_hp;
  Value _hold_hp_r;
  std::shared_ptr<DrinkInfo> _drink;
  Value _mtrange;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = id;
    _id = std::move(id);
  }

  Value world_dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":world_dataset:" + s_of(key));
    return lfw::field_or(_wdata, key.c_str());
  }

  const Value& data() const override { return _data; }
  // TS：`{...this._data, indexes: this._indexes, frames: this._frames}`
  void sync_data() {
    Object o;
    if (const Object* src = lfw::as_object(_data_raw)) {
      for (const std::u16string& k : src->keys()) {
        const Value* v = src->get(k);
        if (v != nullptr) o.set(k, *v);
      }
    }
    o.set(u"indexes", _indexes);
    o.set(u"frames", _frames);
    _data = Value(std::make_shared<Object>(o));
  }

  Value state() const override { return _state; }
  void set_position(const Value& x, const Value& y, const Value& z) override {
    assign_position(lfw::to_number(x), lfw::to_number(y), lfw::to_number(z));
  }
  void set_outline_color(std::u16string v) override {
    g_log.push_back(s_of(_id) + ":outline_color:" + render(Value(v)));
  }
  EnterFrameResult enter_frame_by_id(const Value& frame_id, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame_by_id:" + render(frame_id));
    return EnterFrameResult::Entered;
  }
  EnterFrameResult enter_frame(const Value& nf, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(_id) + ":enter_frame:" + render(nf));
    return EnterFrameResult::Entered;
  }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_y() const override { return lfw::to_number(_vy); }
  double velocity_z() const override { return lfw::to_number(_vz); }
  double hp() const override { return _hp; }
  void set_hp(double v) override { _hp = v; }
  double hp_r() const override { return _hpr; }
  void set_hp_r(double v) override { _hpr = v; }
  double hp_max() const override { return lfw::to_number(_hp_max); }
  double mp() const override { return lfw::to_number(_mp); }
  void set_mp(double v) override { _mp = Value(v); }
  double mp_max() const override { return lfw::to_number(_mp_max); }
  void set_facing(const Value& v) override {
    _facing = v;
    Entity::set_facing(v);
  }
  void set_bounced(const Value& v) override {
    _bounced = v;
    Entity::set_bounced(v);
  }
  Value data_frames() const override { return _frames; }
  Value frame_on_landing() const override { return _onlanding; }
  bool has_catcher() const override { return _catcher; }
  void catcher_drop_catching() override {
    g_log.push_back(s_of(_id) + ":catcher_drop_catching");
  }
  void drop_holding() override { g_log.push_back(s_of(_id) + ":drop_holding"); }
  bool has_holding() const override { return _has_holding; }
  DrinkInfo* holding_drink() const override { return _drink.get(); }
  void holding_set_hp(const Value& v) override { _hold_hp = v; }
  void holding_set_hp_r(const Value& v) override { _hold_hp_r = v; }
  void holding_set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":holding_set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }
  Value holding_mt_range(double lo, double hi) override {
    g_log.push_back(s_of(_id) + ":holding_mt_range:" + num(lo) + ":" + num(hi));
    return _mtrange;
  }
  void holding_mt_mark(const std::u16string& mark) override {
    g_mt.mark = mark;
    g_log.push_back(s_of(_id) + ":holding_mt_mark:" + render(Value(mark)));
  }
  bool has_data_indexes() const override { return lfw::truthy(_indexes); }
  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":dataset:" + s_of(key));
    return Value();
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }
  void handle_ground_velocity_decay(double factor = 1) override {
    (void)factor;
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay");
  }
  // TS 台面的 `set shaking` / `set motionless` 只打日志（不回写字段）⇒ 这里同形。
  Entity& set_shaking(double v) override {
    g_log.push_back(s_of(_id) + ":set_shaking:" + num(v));
    return *this;
  }
  Entity& set_motionless(double v) override {
    g_log.push_back(s_of(_id) + ":set_motionless:" + num(v));
    return *this;
  }
  void play_sound(const Value& sounds) override {
    g_log.push_back(s_of(_id) + ":play_sound:" + render(sounds));
  }
};

// TS 台面的 `holding` 是个**独立对象**（`drop_holding()` 之后局部引用仍然有效）⇒ 端口的状态层
// 现在抓的是真指针，台面就给它一个只做「写入记账」的假被持有物：hp/hp_r 落到喝的人的
// `_hold_hp`/`_hold_hp_r`（TS 那两个 setter 是静默的），`set_velocity` 打 `holding_set_velocity` 行。
struct FakeHeld : FakeEnt {
  explicit FakeHeld(FakeEnt* owner) : FakeEnt(owner->_id), _owner(owner) {}
  FakeEnt* _owner = nullptr;
  void set_hp(double v) override { _owner->_hold_hp = Value(v); }
  void set_hp_r(double v) override { _owner->_hold_hp_r = Value(v); }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":holding_set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }
};

FakeEnt* g_ent = nullptr;
FakeHeld* g_hold = nullptr;
Value g_state;
Value g_velocity;
State_Base* g_obj = nullptr;
std::u16string g_cls = u"burning";

std::string state_text() {
  const FakeEnt& e = *g_ent;
  const Value drink = e._drink != nullptr ? e._drink->to_snapshot() : Value();
  return "hp=" + num(e._hp) + " hpr=" + num(e._hpr) + " hpmax=" + render(e._hp_max) +
         " mp=" + render(e._mp) + " mpmax=" + render(e._mp_max) + " state=" +
         render(g_obj != nullptr ? g_obj->state() : Value()) + " bounced=" +
         render(e._bounced) + " facing=" + render(e._facing) + " holding=" +
         (e._has_holding ? "1" : "0") + " hhp=" + render(e._hold_hp) +
         " hhpr=" + render(e._hold_hp_r) + " drink=" + render(drink) + " pos=[" +
         num(e.position.x) + ":" + num(e.position.y) + ":" + num(e.position.z) + "]";
}

void bind() {
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_burning_drink <case-file>\n");
    return 2;
  }
  bind();
  g_ent = new FakeEnt(u"E1");
  g_hold = new FakeHeld(g_ent);

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
      } else if (sub == "data") {
        g_ent->_data_raw = parse_value(t, i);
        g_ent->sync_data();
      } else if (sub == "indexes") {
        g_ent->_indexes = parse_value(t, i);
        g_ent->sync_data();
      } else if (sub == "frames") {
        g_ent->_frames = parse_value(t, i);
        g_ent->sync_data();
      } else if (sub == "onlanding") {
        g_ent->_onlanding = parse_value(t, i);
      } else if (sub == "wdata") {
        g_ent->_wdata = parse_value(t, i);
      } else if (sub == "vstate") {
        g_ent->_state = parse_value(t, i);
      } else if (sub == "hbtype") {
        g_ent->_hbtype = parse_value(t, i);
      } else if (sub == "catcher") {
        g_ent->_catcher = lfw::truthy(parse_value(t, i));
      } else if (sub == "onground") {
        // TS 台面的 `is_on_ground` 是个裸 getter；实体面上它是 `bool` 字段 ⇒ 直写。
        g_ent->is_on_ground = lfw::truthy(parse_value(t, i));
      } else if (sub == "hp") {
        g_ent->_hp = trace::to_double(t[i++]);
      } else if (sub == "hpr") {
        g_ent->_hpr = trace::to_double(t[i++]);
      } else if (sub == "hpmax") {
        g_ent->_hp_max = parse_value(t, i);
      } else if (sub == "mp") {
        g_ent->_mp = parse_value(t, i);
      } else if (sub == "mpmax") {
        g_ent->_mp_max = parse_value(t, i);
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        g_ent->position.x = lfw::to_number(lfw::field_or(v, u"x"));
        g_ent->position.y = lfw::to_number(lfw::field_or(v, u"y"));
        g_ent->position.z = lfw::to_number(lfw::field_or(v, u"z"));
      } else if (sub == "vx") {
        g_ent->_vx = parse_value(t, i);
      } else if (sub == "vy") {
        g_ent->_vy = parse_value(t, i);
      } else if (sub == "vz") {
        g_ent->_vz = parse_value(t, i);
      } else if (sub == "facing") {
        g_ent->_facing = parse_value(t, i);
        // 台面配置直写实体字段（不产生日志，与 TS 台面 `ent._facing = v` 一致）。
        g_ent->facing = lfw::to_number(g_ent->_facing);
      } else if (sub == "bounced") {
        g_ent->_bounced = parse_value(t, i);
        g_ent->bounced = lfw::truthy(g_ent->_bounced);
      } else if (sub == "holding") {
        g_ent->_has_holding = lfw::truthy(parse_value(t, i));
        g_ent->holding = g_ent->_has_holding ? g_hold : nullptr;
      } else if (sub == "holdhp") {
        g_ent->_hold_hp = parse_value(t, i);
      } else if (sub == "holdhpr") {
        g_ent->_hold_hp_r = parse_value(t, i);
      } else if (sub == "drink") {
        const Value v = parse_value(t, i);
        if (std::holds_alternative<std::monostate>(v)) {
          g_ent->_drink = nullptr;
        } else {
          g_ent->_drink = std::make_shared<DrinkInfo>(v);
        }
      } else if (sub == "mtrange") {
        g_ent->_mtrange = parse_value(t, i);
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
        if (g_cls == u"drink") {
          g_obj = new CharacterState_Drink(g_state);
        } else {
          g_obj = new State_Burning(g_state);
        }
        std::printf("run make || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "default") {
        delete g_obj;
        if (g_cls == u"drink") {
          g_obj = new CharacterState_Drink();
        } else {
          g_obj = new State_Burning();
        }
        std::printf("run default || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_obj->enter) g_obj->enter(*g_ent, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_obj->update(*g_ent);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leave") {
        g_obj->leave(*g_ent, Value());
        std::printf("run leave || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "landing") {
        if (g_obj->on_landing) g_obj->on_landing(*g_ent, g_velocity);
        std::printf("run landing || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "mtmark") {
        std::printf("run mtmark || %s | mark=%s\n", join(g_log).c_str(),
                    render(Value(g_mt.mark)).c_str());
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
