#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/character_state_caught_rowing.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::EnterFrameResult;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Base;
using lfw::state::CharacterState_Caught;
using lfw::state::CharacterState_Rowing;
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

Value field_by(const Value& holder, const std::u16string& key) {
  const lfw::Object* o = lfw::as_object(holder);
  if (o == nullptr) return Value();
  const Value* p = o->get(key);
  return p != nullptr ? *p : Value();
}

// 切片 4CF：`state::IStateEntity` 退役 ⇒ 台面假实体就是真 `lfw::Entity`，只覆写实体面的虚成员。
struct FakeEnt : lfw::Entity {
  std::u16string _id;
  Value _dataset;
  Value _indexes;
  // `Entity::data()` 返回 `const Value&` ⇒ `{indexes}` 的镜像必须是成员（不能返回临时量）。
  mutable Value _data;
  Value _onlanding;
  Value _holding;
  Value _vx;
  Value _vy;
  Value _team;
  // `Entity::team()` 返回 `const std::u16string&`（旧接口回 `Value`）⇒ 台面另存一个字符串镜像。
  std::u16string _team_str;
  Value _fall_value;
  Value _fall_value_max;
  Value _holding_team;
  bool _has_holding = false;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = id;
    _id = std::move(id);
  }

  const Value& data() const override { return _data; }
  void sync_data() {
    lfw::Object o;
    o.set(u"indexes", _indexes);
    _data = Value(std::make_shared<lfw::Object>(o));
  }

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
  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":dataset:" + s_of(key));
    return field_by(_dataset, key);
  }
  const std::u16string& team() const override { return _team_str; }
  double fall_value() const override { return lfw::to_number(_fall_value); }
  double fall_value_max() const override { return lfw::to_number(_fall_value_max); }
  void set_fall_value(double v) override {
    _fall_value = Value(v);
    g_log.push_back(s_of(_id) + ":set_fall_value:" + render(Value(v)));
  }
  bool has_holding() const override { return _has_holding; }
  // TS 台面的 `holding.base_type` 是个裸值（可能是字符串）⇒ 镜像按原样回。
  Value holding_base_type() const override { return lfw::field_or(_holding, u"base_type"); }
  void holding_set_team(const Value& v) override {
    // 库把 `e.team()`（`const u16string&`）转成 `Value` 传进来，TS 台面收到的却是 `_team`
    // 的**原始值**（本例是数字）⇒ 这里按原始值记日志/存镜像，保持与孪生逐字一致。
    (void)v;
    _holding_team = _team;
    g_log.push_back(s_of(_id) + ":holding_set_team:" + render(_team));
  }
  void drop_holding() override { g_log.push_back(s_of(_id) + ":drop_holding"); }
  void handle_ground_velocity_decay(double factor = 1) override {
    (void)factor;
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay");
  }
  Value frame_on_landing() const override { return _onlanding; }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_y() const override { return lfw::to_number(_vy); }
  double velocity_z() const override { return lfw::to_number(Value()); }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
    if (!std::holds_alternative<std::monostate>(x) && !std::holds_alternative<lfw::NullTag>(x)) {
      _vx = x;
    }
    if (!std::holds_alternative<std::monostate>(y) && !std::holds_alternative<lfw::NullTag>(y)) {
      _vy = y;
    }
  }
};

std::vector<FakeEnt*> g_ents;
FakeEnt* g_victim = nullptr;
Value g_state;
Value g_prev_state;
std::u16string g_cls = u"caught";
CharacterState_Base* g_state_obj = nullptr;

FakeEnt* find_ent(const std::u16string& id) {
  for (size_t i = 0; i < g_ents.size(); ++i) {
    if (g_ents[i]->_id == id) return g_ents[i];
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
  return "fall=" + render(v._fall_value) + " fallmax=" + render(v._fall_value_max) +
         " vel=[" + render(v._vx) + ":" + render(v._vy) + "]" + " hasholding=" +
         std::string(v._has_holding ? "1" : "0") + " holding=" + render(v.holding_base_type()) +
         " holding_team=" + render(v._holding_team) + " team=" + render(v._team);
}

void bind() {
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

void run_make() {
  delete g_state_obj;
  if (g_cls == u"rowing") {
    g_state_obj = new CharacterState_Rowing(g_state);
  } else {
    g_state_obj = new CharacterState_Caught(g_state);
  }
  std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_character_state_caught_rowing <case-file>\n");
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
      if (sub == "cls") {
        g_cls = value_text(parse_value(t, i));
      } else if (sub == "state") {
        g_state = parse_value(t, i);
      } else if (sub == "prevstate") {
        g_prev_state = parse_value(t, i);
      } else if (sub == "victim") {
        g_victim = &ent(value_text(parse_value(t, i)));
      } else if (sub == "fall") {
        if (g_victim != nullptr) g_victim->_fall_value = parse_value(t, i);
      } else if (sub == "fallmax") {
        if (g_victim != nullptr) g_victim->_fall_value_max = parse_value(t, i);
      } else if (sub == "vteam") {
        if (g_victim != nullptr) {
          g_victim->_team = parse_value(t, i);
          g_victim->_team_str = lfw::to_string(g_victim->_team);
        }
      } else if (sub == "velx") {
        if (g_victim != nullptr) g_victim->_vx = parse_value(t, i);
      } else if (sub == "vely") {
        if (g_victim != nullptr) g_victim->_vy = parse_value(t, i);
      } else if (sub == "has_holding") {
        if (g_victim != nullptr) g_victim->_has_holding = trace::to_double(t[i++]) != 0;
      } else if (sub == "holding") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          lfw::Object o;
          o.set(u"base_type", v);
          g_victim->_holding = Value(std::make_shared<lfw::Object>(o));
          g_victim->_holding_team = Value();
        }
      } else if (sub == "onlanding") {
        if (g_victim != nullptr) g_victim->_onlanding = parse_value(t, i);
      } else if (sub == "dataset") {
        if (g_victim != nullptr) g_victim->_dataset = parse_value(t, i);
      } else if (sub == "indexes") {
        if (g_victim != nullptr) {
          g_victim->_indexes = parse_value(t, i);
          g_victim->sync_data();
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
        run_make();
      } else if (what == "enter") {
        lfw::Object prev;
        prev.set(u"state", g_prev_state);
        if (g_state_obj->enter) g_state_obj->enter(*g_victim, Value(std::make_shared<lfw::Object>(prev)));
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_state_obj->update(*g_victim);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "landing") {
        if (g_state_obj->on_landing) g_state_obj->on_landing(*g_victim, Value());
        std::printf("run landing || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
