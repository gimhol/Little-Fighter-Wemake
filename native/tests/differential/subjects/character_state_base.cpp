#include <cstdio>
#include <fstream>
#include <limits>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/state/character_state_base.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Base;
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

// 切片 4CF：状态族窄接口退役 ⇒ 台面假实体派生真 `lfw::Entity`（`entity_fixture.h` 的
// `fx::shared_world()`），只覆写状态层要观测的实体面；`env …` 配置直写后备字段/成员
// ⇒ 不产生日志（与 TS 孪生直写 `_*` 一致）。
//
// 台账（4CF 时点）：
//   * `is_on_ground` / `facing` / `position` 现在是 `Entity` 的**普通数据成员**（库直读字段）
//     ⇒ 台面把 `env …` 写进字段；`facing` 另留一枚镜像，保住 TS 的 `undefined` 打印。
//   * `data_indexes_X()` 没了 ⇒ 覆写 `data()` 给 `{indexes, frames}` 镜像即可（非虚的
//     `data_indexes_of(u"X")` 就喂它）；`data_frames()` / `frame_on_landing()` 仍是虚的。
struct FakeEnt : lfw::Entity {
  Value _state;
  Value _hp;
  Value _facing;
  Value _holding_base;
  Value _dataset;
  Value _indexes;
  Value _frames;
  Value _onlanding;
  Value _vx;
  Value _vz;

  explicit FakeEnt(std::u16string eid) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = std::move(eid);
    this->facing = std::numeric_limits<double>::quiet_NaN();
  }

  // `get data()` = `{indexes, frames}`（`data_indexes_of` 喂它；`data()` 返回引用 ⇒ 必须落成员）。
  const Value& data() const override {
    lfw::Object o;
    o.set(u"indexes", _indexes);
    o.set(u"frames", _frames);
    _data_mirror = Value(std::make_shared<lfw::Object>(o));
    return _data_mirror;
  }
  Value data_frames() const override { return _frames; }
  Value frame_on_landing() const override { return _onlanding; }
  Value state() const override { return _state; }
  double hp() const override { return lfw::to_number(_hp); }
  // `this.holding?.base_type`：台面 holding 就是 `env holding` 的裸值。
  Value holding_base_type() const override { return _holding_base; }
  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(id) + ":dataset:" + s_of(key));
    return field_by(_dataset, key);
  }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_z() const override { return lfw::to_number(_vz); }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
    if (!std::holds_alternative<std::monostate>(x) && !std::holds_alternative<lfw::NullTag>(x)) {
      _vx = x;
    }
    if (!std::holds_alternative<std::monostate>(z) && !std::holds_alternative<lfw::NullTag>(z)) {
      _vz = z;
    }
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
  void set_position(const Value& x, const Value& y, const Value& z) override {
    (void)x;
    (void)y;
    (void)z;
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
CharacterState_Base* g_state_obj = nullptr;

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
  const std::string vel = g_victim == nullptr
                              ? std::string("-")
                              : "[" + render(g_victim->_vx) + ":" + render(g_victim->_vz) + "]";
  return "state=" + render(g_state) + " estate=" + render(g_victim->_state) +
         " hp=" + render(g_victim->_hp) +
         " face=" + render(g_victim->_facing) + " onground=" +
         std::string(g_victim->is_on_ground ? "1" : "0") + " holding=" +
         render(g_victim->holding_base_type()) + " vel=" + vel;
}

void bind() {
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

void print_run(const char* what, const Value* ret) {
  const std::string ret_s =
      (ret == nullptr || std::holds_alternative<std::monostate>(*ret)) ? "-" : render(*ret);
  std::printf("run %s || %s | ret=%s | %s\n", what, join(g_log).c_str(), ret_s.c_str(),
              state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_character_state_base <case-file>\n");
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
      } else if (sub == "vstate") {
        if (g_victim != nullptr) g_victim->_state = parse_value(t, i);
      } else if (sub == "victim") {
        g_victim = &ent(value_text(parse_value(t, i)));
      } else if (sub == "hp") {
        if (g_victim != nullptr) g_victim->_hp = parse_value(t, i);
      } else if (sub == "facing") {
        if (g_victim != nullptr) {
          g_victim->_facing = parse_value(t, i);
          // `facing` 现在是普通数据成员（库读 `e.facing`）；镜像只作打印。
          g_victim->facing = lfw::to_number(g_victim->_facing);
        }
      } else if (sub == "onground") {
        if (g_victim != nullptr) g_victim->is_on_ground = trace::to_double(t[i++]) != 0;
      } else if (sub == "holding") {
        // TS 的 `holding` 是 `{base_type: _holdingBase}` ⇒ 端口就是那枚裸值。
        if (g_victim != nullptr) g_victim->_holding_base = parse_value(t, i);
      } else if (sub == "onlanding") {
        if (g_victim != nullptr) g_victim->_onlanding = parse_value(t, i);
      } else if (sub == "dataset") {
        if (g_victim != nullptr) g_victim->_dataset = parse_value(t, i);
      } else if (sub == "indexes") {
        if (g_victim != nullptr) g_victim->_indexes = parse_value(t, i);
      } else if (sub == "frames") {
        if (g_victim != nullptr) g_victim->_frames = parse_value(t, i);
      } else if (sub == "velx") {
        if (g_victim != nullptr) g_victim->_vx = parse_value(t, i);
      } else if (sub == "velz") {
        if (g_victim != nullptr) g_victim->_vz = parse_value(t, i);
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
        g_state_obj = new CharacterState_Base(g_state);
        print_run("make", nullptr);
      } else if (what == "update") {
        g_state_obj->update(*g_victim);
        print_run("update", nullptr);
      } else if (what == "landing") {
        g_state_obj->on_landing(*g_victim, Value());
        print_run("landing", nullptr);
      } else if (what == "up") {
        g_state_obj->on_leave_ground(*g_victim);
        print_run("up", nullptr);
      } else if (what == "auto") {
        const Value r =
            g_state_obj->get_auto_frame ? g_state_obj->get_auto_frame(*g_victim) : Value();
        print_run("auto", &r);
      } else if (what == "sudden") {
        const Value r = g_state_obj->get_sudden_death_frame
                            ? g_state_obj->get_sudden_death_frame(*g_victim)
                            : Value();
        print_run("sudden", &r);
      } else if (what == "caught") {
        const Value r =
            g_state_obj->get_caught_end_frame ? g_state_obj->get_caught_end_frame(*g_victim)
                                              : Value();
        print_run("caught", &r);
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
