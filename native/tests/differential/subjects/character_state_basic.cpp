#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/state/character_state_basic.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Base;
using lfw::state::CharacterState_Injured;
using lfw::state::CharacterState_Running;
using lfw::state::CharacterState_Standing;
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

Value marker_frame() {
  lfw::Object o;
  o.set(u"id", Value(std::u16string(u"SD")));
  return Value(std::make_shared<lfw::Object>(o));
}

// 切片 4CF：状态族窄接口退役 ⇒ 台面假实体派生真 `lfw::Entity`（`fx::shared_world()`），
// 只覆写状态层要观测的实体面；`env …` 配置直写后备字段/成员 ⇒ 不产生日志。
//
// 台账（4CF 时点）：
//   * `is_on_ground` / `facing` / `position` 现在是普通数据成员 ⇒ 库直读字段，台面写字段。
//   * `data_indexes_X()` 没了 ⇒ 覆写 `data()` 给 `{indexes, frames}` 镜像。
//   * `team()`：端口的 `Entity::team()` 是 `const std::u16string&`（旧接口是 `Value`），
//     而 TS 台面的 `_team` 可以是数字（`env vteam n 3`）⇒ 数值穿不过 `team()`。库把
//     `e.team()` 递给 `holding_set_team`（TS: `e.holding.team = e.team`，即把实体自己的
//     team 写进持有物）；台面在那条虚 setter 里落自己的 `_team` 镜像，逐字复刻 `n3`。
struct FakeEnt : lfw::Entity {
  Value _state;
  Value _hp;
  Value _facing;
  Value _holding_base;
  Value _holding_team;
  Value _dataset;
  Value _indexes;
  Value _frames;
  Value _onlanding;
  Value _vx;
  Value _vz;
  Value _team;
  Value _ground_y;
  double _px = 0;
  double _py = 0;
  double _pz = 0;

  explicit FakeEnt(std::u16string eid) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = std::move(eid);
  }

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
  double ground_y() const override { return lfw::to_number(_ground_y); }
  Value holding_base_type() const override { return _holding_base; }
  void holding_set_team(const Value& v) override {
    (void)v;  // 端口 `team()` 是字符串 ⇒ 用台面自己的 `_team` 镜像（TS 的 `e.team`）。
    _holding_team = _team;
    g_log.push_back(s_of(id) + ":holding_set_team:" + render(_team));
  }
  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(id) + ":dataset:" + s_of(key));
    return field_by(_dataset, key);
  }
  Value get_sudden_death_frame() const override {
    g_log.push_back(s_of(id) + ":get_sudden_death_frame");
    return marker_frame();
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
std::u16string g_cls = u"standing";
bool g_use_default = false;
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
  const FakeEnt& v = *g_victim;
  return "state=" + render(v._state) + " hp=" + render(v._hp) +
         " ground=" + render(v._ground_y) + " pos=[" + num(v._px) + ":" + num(v._py) + ":" +
         num(v._pz) + "]" + " vel=[" + render(v._vx) + ":" + render(v._vz) + "]" +
         " holding=" + render(v._holding_base) + " holding_team=" + render(v._holding_team) +
         " team=" + render(v._team);
}

void bind() {
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

void run_make() {
  delete g_state_obj;
  if (g_cls == u"running") {
    g_state_obj = g_use_default ? new CharacterState_Running() : new CharacterState_Running(g_state);
  } else if (g_cls == u"injured") {
    g_state_obj = g_use_default ? new CharacterState_Injured() : new CharacterState_Injured(g_state);
  } else {
    g_state_obj =
        g_use_default ? new CharacterState_Standing() : new CharacterState_Standing(g_state);
  }
  std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_character_state_basic <case-file>\n");
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
      } else if (sub == "usedefault") {
        g_use_default = trace::to_double(t[i++]) != 0;
      } else if (sub == "victim") {
        g_victim = &ent(value_text(parse_value(t, i)));
      } else if (sub == "hp") {
        if (g_victim != nullptr) g_victim->_hp = parse_value(t, i);
      } else if (sub == "vstate") {
        if (g_victim != nullptr) g_victim->_state = parse_value(t, i);
      } else if (sub == "facing") {
        if (g_victim != nullptr) {
          g_victim->_facing = parse_value(t, i);
          g_victim->facing = lfw::to_number(g_victim->_facing);
        }
      } else if (sub == "vteam") {
        if (g_victim != nullptr) g_victim->_team = parse_value(t, i);
      } else if (sub == "onground") {
        if (g_victim != nullptr) g_victim->is_on_ground = trace::to_double(t[i++]) != 0;
      } else if (sub == "ground_y") {
        if (g_victim != nullptr) g_victim->_ground_y = parse_value(t, i);
      } else if (sub == "holding") {
        if (g_victim != nullptr) {
          g_victim->_holding_base = parse_value(t, i);
          g_victim->_holding_team = Value();
        }
      } else if (sub == "onlanding") {
        if (g_victim != nullptr) g_victim->_onlanding = parse_value(t, i);
      } else if (sub == "dataset") {
        if (g_victim != nullptr) g_victim->_dataset = parse_value(t, i);
      } else if (sub == "indexes") {
        if (g_victim != nullptr) g_victim->_indexes = parse_value(t, i);
      } else if (sub == "frames") {
        if (g_victim != nullptr) g_victim->_frames = parse_value(t, i);
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          g_victim->_px = lfw::to_number(lfw::field_or(v, u"x"));
          g_victim->_py = lfw::to_number(lfw::field_or(v, u"y"));
          g_victim->_pz = lfw::to_number(lfw::field_or(v, u"z"));
          // `position` 是普通数据成员，库直读（`e.position.y`）。
          g_victim->position.x = g_victim->_px;
          g_victim->position.y = g_victim->_py;
          g_victim->position.z = g_victim->_pz;
        }
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
        run_make();
      } else if (what == "update") {
        g_state_obj->update(*g_victim);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_state_obj->enter) g_state_obj->enter(*g_victim, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
