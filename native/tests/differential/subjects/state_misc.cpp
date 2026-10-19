#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/state/state_misc.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::state::BallState_Base;
using lfw::state::CharacterState_TransformToLouisEX;
using lfw::state::State_Base;
using lfw::state::State_TransformTo8XXX;
using lfw::state::State_TransformToCatching;
using lfw::state::State_WeaponBroken;
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
  o.set(u"id", Value(std::u16string(u"AUTO")));
  return Value(std::make_shared<lfw::Object>(o));
}

// 切片 4CF：状态族窄接口退役 ⇒ 假实体派生真 `lfw::Entity`（构造用 `fx::shared_world()` 再钉
// `this->id`），只覆写实体面上确实存在的那几条虚方法（`transform` / `transfrom_to_another`
// 现在是虚的，直接覆写）。
struct FakeEnt : lfw::Entity {
  Value _state;
  Value _data;
  Value _find_data;
  Value _find_fighter;
  Value _transform_type;
  Value _shaking;
  Value _motionless;
  Value _vx;
  Value _vy;
  Value _vz;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = std::move(id);
  }

  const Value& data() const override { return _data; }
  Value state() const override { return _state; }
  Value datas_find(const std::u16string& oid) override {
    g_log.push_back(s_of(id) + ":datas_find:" + s_of(oid));
    return _find_data;
  }
  Value datas_find_fighter(const std::u16string& oid) override {
    g_log.push_back(s_of(id) + ":datas_find_fighter:" + s_of(oid));
    return _find_fighter;
  }
  void transform(const Value& data) override {
    g_log.push_back(s_of(id) + ":transform:" + render(data));
    lfw::Object o;
    o.set(u"type", _transform_type);
    _data = Value(std::make_shared<lfw::Object>(std::move(o)));
  }
  bool transfrom_to_another(const std::optional<Value>& data = std::nullopt) override {
    (void)data;
    g_log.push_back(s_of(id) + ":transfrom_to_another");
    return false;
  }
  Value find_auto_frame() const override {
    g_log.push_back(s_of(id) + ":find_auto_frame");
    return marker_frame();
  }
  void world_callbacks_call(const std::u16string& name) override {
    g_log.push_back(s_of(id) + ":world_callbacks_call:" + s_of(name));
  }
  lfw::EnterFrameResult enter_frame(const Value& frame_value,
                                    bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame:" + render(frame_value));
    return lfw::EnterFrameResult::NotFound;
  }
  lfw::EnterFrameResult enter_frame_by_id(const Value& id_value,
                                          bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(id_value));
    return lfw::EnterFrameResult::NotFound;
  }
  Entity& set_shaking(double v) override {
    _shaking = Value(v);
    g_log.push_back(s_of(id) + ":set_shaking:" + render(Value(v)));
    return *this;
  }
  Entity& set_motionless(double v) override {
    _motionless = Value(v);
    g_log.push_back(s_of(id) + ":set_motionless:" + render(Value(v)));
    return *this;
  }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_z() const override { return lfw::to_number(_vz); }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
    if (!std::holds_alternative<std::monostate>(x) && !std::holds_alternative<lfw::NullTag>(x)) {
      _vx = x;
    }
    if (!std::holds_alternative<std::monostate>(y) && !std::holds_alternative<lfw::NullTag>(y)) {
      _vy = y;
    }
    if (!std::holds_alternative<std::monostate>(z) && !std::holds_alternative<lfw::NullTag>(z)) {
      _vz = z;
    }
  }
};

std::vector<FakeEnt*> g_ents;
FakeEnt* g_victim = nullptr;
Value g_state;
std::u16string g_cls = u"weapon_broken";
State_Base* g_state_obj = nullptr;

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
  return "state=" + render(g_state) + " vstate=" + render(v._state) +
         " type=" + render(v.data_type()) + " shaking=" + render(v._shaking) +
         " motionless=" + render(v._motionless) + " vel=[" + render(v._vx) + ":" +
         render(v._vy) + ":" + render(v._vz) + "]";
}

void bind() {
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

void run_make() {
  delete g_state_obj;
  if (g_cls == u"to_catching") {
    g_state_obj = new State_TransformToCatching(g_state);
  } else if (g_cls == u"to_louisex") {
    g_state_obj = new CharacterState_TransformToLouisEX(g_state);
  } else if (g_cls == u"to_8xxx") {
    g_state_obj = new State_TransformTo8XXX(g_state);
  } else if (g_cls == u"ball") {
    g_state_obj = new BallState_Base(g_state);
  } else {
    g_state_obj = new State_WeaponBroken(g_state);
  }
  std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_state_misc <case-file>\n");
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
      } else if (sub == "victim") {
        g_victim = &ent(value_text(parse_value(t, i)));
      } else if (sub == "vstate") {
        if (g_victim != nullptr) g_victim->_state = parse_value(t, i);
      } else if (sub == "vtype") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          lfw::Object o;
          o.set(u"type", v);
          g_victim->_data = Value(std::make_shared<lfw::Object>(o));
        }
      } else if (sub == "finddata") {
        if (g_victim != nullptr) g_victim->_find_data = parse_value(t, i);
      } else if (sub == "findfighter") {
        if (g_victim != nullptr) g_victim->_find_fighter = parse_value(t, i);
      } else if (sub == "transformtype") {
        if (g_victim != nullptr) g_victim->_transform_type = parse_value(t, i);
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
      } else if (what == "landing") {
        if (g_state_obj->on_landing) g_state_obj->on_landing(*g_victim, Value());
        std::printf("run landing || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_state_obj->update(*g_victim);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_state_obj->enter) g_state_obj->enter(*g_victim, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leave") {
        g_state_obj->leave(*g_victim, Value());
        std::printf("run leave || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
