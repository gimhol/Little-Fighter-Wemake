#include <cstdio>
#include <fstream>
#include <memory>
#include <optional>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/weapon_state_base.h"
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
// 实体面上确实存在的那几条读/写（TS 台面同样只给这几条，见 `weapon_state_base.ts`）。
//
// 两处「库直接读、台面要观测」的面靠别的缝观测：
//   * `frame_id()`：它是非虚读面（读实体自己的 `frame`），由 `set_fid` 把镜像灌进实体。
struct FakeEnt : Entity {
  // 台面镜像：与 TS 台面的后备字段一一对应（`undefined` 记为默认 `Value()`）。
  std::u16string _id;
  Value _indexes_flag;
  Value _ionground;
  Value _ithrow;
  Value _isky;
  Value _frames;
  Value _onlanding;
  Value _base;
  Value _wt;
  Value _dh;
  Value _state;
  Value _fid;
  double _hp = 0;
  double _hpr = 0;
  Value _align;

  explicit FakeEnt(std::u16string id) : Entity(fx::shared_world(), Value()) {
    _id = std::move(id);
    this->id = _id;
  }

  // --- 实体面：库读的那几条 -------------------------------------------------
  // `data` 是 TS 里那个按 `_indexes_flag` 三态拼出来的 `get data`（`data_indexes_of` 读它）。
  // `data()` 收 `const Value&` ⇒ 镜像必须是成员，不能返回临时量。
  const Value& data() const override {
    Object o;
    o.set(u"frames", _frames);
    const Value flag = _indexes_flag;
    if (lfw::truthy(flag)) {
      Object indexes;
      indexes.set(u"on_ground", _ionground);
      indexes.set(u"throwings", _ithrow);
      indexes.set(u"in_the_skys", _isky);
      o.set(u"indexes", Value(std::make_shared<Object>(indexes)));
    } else if (std::holds_alternative<std::monostate>(flag) ||
               std::holds_alternative<lfw::NullTag>(flag)) {
      Object indexes;
      indexes.set(u"on_ground", Value());
      indexes.set(u"throwings", Value());
      indexes.set(u"in_the_skys", Value());
      o.set(u"indexes", Value(std::make_shared<Object>(indexes)));
    } else {
      o.set(u"indexes", flag);
    }
    o.set(u"base", _base);
    _data_mirror = Value(std::make_shared<Object>(o));
    return _data_mirror;
  }
  bool has_data_indexes() const override { return lfw::truthy(_indexes_flag); }
  Value data_frames() const override { return _frames; }
  Value frame_on_landing() const override { return _onlanding; }
  Value data_base() const override { return _base; }
  // `base_type` 在实体面是原生 `double`（TS 台面的后备字段是任意值）⇒ 过 `to_number`
  // （`undefined` 记成 `NaN`，与 TS 的「表里没有这个键」同义）。
  double base_type() const override { return lfw::to_number(_wt); }
  Value state() const override { return _state; }
  double hp() const override { return _hp; }
  double hp_r() const override { return _hpr; }

  // --- 实体面：库写的那几条（TS 台面的同名 setter 也是「只记下来」）------------
  void set_hp(double v) override { _hp = v; }
  void set_hp_r(double v) override { _hpr = v; }
  // `drop_hurted` 在实体面是 `bool` 字段（库直接读它）⇒ 后备 `_dh` 与字段一起写。
  void set_drop_hurted(const Value& v) override { set_dh(v); }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" +
                    render(z));
  }
  void leave_ground() override { g_log.push_back(s_of(_id) + ":leave_ground"); }
  void set_outline_color(std::u16string v) override {
    g_log.push_back(s_of(_id) + ":outline_color:" + render(Value(std::move(v))));
  }
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
  Value find_align_frame(const std::u16string& fid, const Value& throwings,
                         const Value& in_the_skys) const override {
    g_log.push_back(s_of(_id) + ":find_align_frame:" + render(Value(fid)) + ":" +
                    render(throwings) + ":" + render(in_the_skys));
    return _align;
  }
  // 切片 4CF 收尾：`handle_ground_velocity_decay` 已随状态面虚化 ⇒ 直接同名覆写（与 TS 假件
  // 「整个换掉」同形）；早期它非虚时借 `handle_velocity_decay` 兜的那条路已不需要。
  void handle_ground_velocity_decay(double factor) override {
    (void)factor;
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay");
  }

  // --- 用例面：后备字段 → 实体面（库直接读字段/非虚读面的那几条）---------------
  void set_dh(const Value& v) {
    _dh = v;
    drop_hurted = lfw::truthy(v);
  }
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
Value g_nf;
WeaponState_Base* g_obj = nullptr;

std::string state_text() {
  const FakeEnt& e = *g_ent;
  return "hp=" + num(e._hp) + " hpr=" + num(e._hpr) + " dh=" + render(e._dh);
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
    std::fprintf(stderr, "usage: lfw_trace_weapon_state_base <case-file>\n");
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
      if (sub == "state") {
        g_state = parse_value(t, i);
      } else if (sub == "indexes") {
        g_ent->_indexes_flag = parse_value(t, i);
      } else if (sub == "ionground") {
        g_ent->_ionground = parse_value(t, i);
      } else if (sub == "ithrow") {
        g_ent->_ithrow = parse_value(t, i);
      } else if (sub == "isky") {
        g_ent->_isky = parse_value(t, i);
      } else if (sub == "frames") {
        g_ent->_frames = parse_value(t, i);
      } else if (sub == "onlanding") {
        g_ent->_onlanding = parse_value(t, i);
      } else if (sub == "base") {
        g_ent->_base = parse_value(t, i);
      } else if (sub == "wt") {
        g_ent->_wt = parse_value(t, i);
      } else if (sub == "onground") {
        g_ent->is_on_ground = lfw::truthy(parse_value(t, i));
      } else if (sub == "dh") {
        g_ent->set_dh(parse_value(t, i));
      } else if (sub == "vstate") {
        g_ent->_state = parse_value(t, i);
      } else if (sub == "fid") {
        g_ent->set_fid(parse_value(t, i));
      } else if (sub == "hp") {
        g_ent->_hp = trace::to_double(t[i++]);
      } else if (sub == "hpr") {
        g_ent->_hpr = trace::to_double(t[i++]);
      } else if (sub == "vel") {
        g_velocity = parse_value(t, i);
      } else if (sub == "nf") {
        g_nf = parse_value(t, i);
      } else if (sub == "align") {
        g_ent->_align = parse_value(t, i);
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
        g_obj = new WeaponState_Base(g_state);
        std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "auto") {
        const Value f = g_obj->get_auto_frame ? g_obj->get_auto_frame(*g_ent) : Value();
        std::printf("run auto || %s | fid=%s | %s\n", join(g_log).c_str(), render(f).c_str(),
                    state_text().c_str());
      } else if (what == "landing") {
        if (g_obj->on_landing) g_obj->on_landing(*g_ent, g_velocity);
        std::printf("run landing || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_obj->update(*g_ent);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leaveground") {
        if (g_obj->on_leave_ground) g_obj->on_leave_ground(*g_ent);
        std::printf("run leaveground || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "rebound") {
        g_obj->hit_ground_rebouncing(*g_ent, g_nf, g_velocity);
        std::printf("run rebound || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
