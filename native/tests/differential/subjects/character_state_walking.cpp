#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/state/character_state_walking.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Walking;
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

Value marker_frame() {
  lfw::Object o;
  o.set(u"id", Value(std::u16string(u"SD")));
  return Value(std::make_shared<lfw::Object>(o));
}

// 切片 4CF：状态族窄接口退役 ⇒ 台面假实体派生真 `lfw::Entity`（`fx::shared_world()`），
// 只覆写状态层要观测的实体面；`env …` 配置直写后备字段/成员 ⇒ 不产生日志。
//
// 台账（4CF 时点）：
//   * `wait` / `frame` / `position` 现在是普通数据成员（库直读 `e.wait` / `e.frame` /
//     `e.position`）⇒ 台面写字段之外再留打印镜像；`wait` 用 `to_number(Value()) = NaN`
//     表示 TS 的 `undefined`（`truthy(NaN) == false`，与 JS 同口径）。
//   * `data_indexes_X()` 没了 ⇒ 覆写 `data()` 给 `{indexes}` 镜像。
//   * `is_weapon(holding)` = `holding?.data.type === 16`（`entity/type_check.ts`）⇒
//     `holding_is_weapon()` 要连「holding 在不在」一起算。
struct FakeEnt : lfw::Entity {
  Value _hp;
  Value _wait_value;
  Value _frame_info;
  Value _holding_base;
  Value _indexes;
  Value _ground_y;
  double _px = 0;
  double _py = 0;
  double _pz = 0;
  double _wait_flag = 0;
  double _ctrl_ud = 0;
  double _ctrl_lr = 0;
  bool _holding_is_weapon = false;
  bool _holding_defined = false;

  explicit FakeEnt(std::u16string eid) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = std::move(eid);
  }

  const Value& data() const override {
    lfw::Object o;
    o.set(u"indexes", _indexes);
    o.set(u"frames", Value());
    _data_mirror = Value(std::make_shared<lfw::Object>(o));
    return _data_mirror;
  }
  double hp() const override { return lfw::to_number(_hp); }
  void set_wait(const Value& v) override {
    _wait_value = v;
    this->wait = lfw::to_number(v);
    g_log.push_back(s_of(id) + ":set_wait:" + render(v));
  }
  Value holding_base_type() const override { return _holding_base; }
  bool holding_is_weapon() const override { return _holding_defined && _holding_is_weapon; }
  double ctrl_ud() const override { return _ctrl_ud; }
  double ctrl_lr() const override { return _ctrl_lr; }
  double ground_y() const override { return lfw::to_number(_ground_y); }
  // TS: `handle_wait_flag(wait, frame?)` 由台面覆写 ⇒ 端口这条虚钩子的签名照新实体面。
  double handle_wait_flag(const Value& wait, const std::optional<Value>& frame) const override {
    g_log.push_back(s_of(id) + ":handle_wait_flag:" + render(wait) + ":" +
                    render(frame.has_value() ? *frame : Value()));
    return _wait_flag;
  }
  Value get_sudden_death_frame() const override {
    g_log.push_back(s_of(id) + ":get_sudden_death_frame");
    return marker_frame();
  }
  lfw::EnterFrameResult enter_frame(const Value& nf, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame:" + render(nf));
    return lfw::EnterFrameResult::NotFound;
  }
  lfw::EnterFrameResult enter_frame_by_id(const Value& fid, bool fallback = false) override {
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(fid) + ":" +
                    std::string(fallback ? "1" : "0"));
    return lfw::EnterFrameResult::NotFound;
  }
  // TS 台面的 `set_velocity` 是空实现（不打日志）。
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    (void)x;
    (void)y;
    (void)z;
  }
  void set_position(const Value& x, const Value& y, const Value& z) override {
    _px = lfw::to_number(x);
    _py = lfw::to_number(y);
    _pz = lfw::to_number(z);
  }
  void set_outline_color(std::u16string v) override {
    g_log.push_back(s_of(id) + ":outline_color:" + render(Value(std::move(v))));
  }
  void drop_holding() override { g_log.push_back(s_of(id) + ":drop_holding"); }
  void handle_ground_velocity_decay(double factor = 1) override {
    (void)factor;
    g_log.push_back(s_of(id) + ":handle_ground_velocity_decay");
  }

 private:
  mutable Value _data_mirror;
};

std::vector<FakeEnt*> g_ents;
FakeEnt* g_victim = nullptr;
Value g_state;
CharacterState_Walking* g_state_obj = nullptr;

FakeEnt* find_ent(const std::u16string& id) {
  for (size_t i = 0; i < g_ents.size(); ++i) {
    if (g_ents[i]->id == id) return g_ents[i];
  }
  return nullptr;
}

FakeEnt& ent(const std::u16string& id) {
  FakeEnt* e = find_ent(id);
  if (e != nullptr) return *e;
  g_ents.push_back(new FakeEnt(id));
  return *g_ents.back();
}

std::string state_text() {
  const FakeEnt& v = *g_victim;
  return "hp=" + render(v._hp) + " wait=" + render(v._wait_value) +
         " waitflag=" + num(v._wait_flag) + " frame=" + render(v._frame_info) + " pos=[" +
         num(v._px) + ":" + num(v._py) + ":" + num(v._pz) + "]" + " ground=" +
         render(v._ground_y) + " holding=" + render(v._holding_base) + " hweapon=" +
         std::string(v._holding_is_weapon ? "1" : "0") + " ctrl=" +
         std::string(v._ctrl_ud ? "1" : "0") + std::string(v._ctrl_lr ? "1" : "0");
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
    std::fprintf(stderr, "usage: lfw_trace_character_state_walking <case-file>\n");
    return 2;
  }
  bind();
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
      } else if (sub == "victim") {
        g_victim = &ent(value_text(parse_value(t, i)));
      } else if (sub == "hp") {
        if (g_victim != nullptr) g_victim->_hp = parse_value(t, i);
      } else if (sub == "vwait") {
        if (g_victim != nullptr) {
          g_victim->_wait_value = parse_value(t, i);
          // 库直读普通成员 `e.wait`（TS 读的是自有 getter `_waitValue`）。
          g_victim->wait = lfw::to_number(g_victim->_wait_value);
        }
      } else if (sub == "waitflag") {
        if (g_victim != nullptr) g_victim->_wait_flag = trace::to_double(t[i++]);
      } else if (sub == "frame") {
        if (g_victim != nullptr) {
          g_victim->_frame_info = parse_value(t, i);
          // 库把 `e.frame` 递给 `handle_wait_flag`（TS 递的是自有 getter）。
          g_victim->frame = g_victim->_frame_info;
        }
      } else if (sub == "ground_y") {
        if (g_victim != nullptr) g_victim->_ground_y = parse_value(t, i);
      } else if (sub == "indexes") {
        if (g_victim != nullptr) g_victim->_indexes = parse_value(t, i);
      } else if (sub == "ctrlud") {
        if (g_victim != nullptr) g_victim->_ctrl_ud = trace::to_double(t[i++]);
      } else if (sub == "ctrllr") {
        if (g_victim != nullptr) g_victim->_ctrl_lr = trace::to_double(t[i++]);
      } else if (sub == "hweapon") {
        if (g_victim != nullptr) g_victim->_holding_is_weapon = trace::to_double(t[i++]) != 0;
      } else if (sub == "holding") {
        // TS: `_holding = hv === undefined ? undefined : { base_type: hv }`。
        if (g_victim != nullptr) {
          g_victim->_holding_base = parse_value(t, i);
          g_victim->_holding_defined =
              !std::holds_alternative<std::monostate>(g_victim->_holding_base);
        }
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          g_victim->_px = lfw::to_number(lfw::field_or(v, u"x"));
          g_victim->_py = lfw::to_number(lfw::field_or(v, u"y"));
          g_victim->_pz = lfw::to_number(lfw::field_or(v, u"z"));
          g_victim->position.x = g_victim->_px;
          g_victim->position.y = g_victim->_py;
          g_victim->position.z = g_victim->_pz;
        }
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
        delete g_state_obj;
        g_state_obj = new CharacterState_Walking(g_state);
        std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_state_obj->update(*g_victim);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else {
        std::fprintf(stderr, "unknown run '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  delete g_state_obj;
  return 0;
}
