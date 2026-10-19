#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/state/character_state_dash.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Dash;
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

// 切片 4CF：状态族窄接口退役 ⇒ 台面假实体派生真 `lfw::Entity`（`fx::shared_world()` 是
// `entity_fixture.h` 里进程内共享的最小宿主），只覆写状态层要观测的实体面；台面的配置
// （`env …`）直写后备字段/成员 ⇒ 不产生日志（与 TS 孪生直写 `_*` 一致）。
struct FakeEnt : lfw::Entity {
  Value _dataset;
  Value _facing;
  Value _vx;
  Value _vy;
  Value _vz;
  Value _ground_y;
  double _px = 0;
  double _py = 0;
  double _pz = 0;
  double _ctrl_ud = 0;
  double _ctrl_lr = 0;

  explicit FakeEnt(std::u16string eid) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = std::move(eid);
  }

  double ground_y() const override { return lfw::to_number(_ground_y); }
  double ctrl_ud() const override { return _ctrl_ud; }
  double ctrl_lr() const override { return _ctrl_lr; }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_y() const override { return lfw::to_number(_vy); }
  double velocity_z() const override { return lfw::to_number(_vz); }
  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(id) + ":dataset:" + s_of(key));
    return field_by(_dataset, key);
  }
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
};

std::vector<FakeEnt*> g_ents;
FakeEnt* g_victim = nullptr;
Value g_state;
Value g_prev_state;
CharacterState_Dash* g_state_obj = nullptr;

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
  return "pos=[" + num(v._px) + ":" + num(v._py) + ":" + num(v._pz) + "]" + " ground=" +
         render(v._ground_y) + " vel=[" + render(v._vx) + ":" + render(v._vy) + ":" +
         render(v._vz) + "]" + " face=" + render(v._facing) + " ctrl=" + num(v._ctrl_ud) + "," +
         num(v._ctrl_lr);
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
    std::fprintf(stderr, "usage: lfw_trace_character_state_dash <case-file>\n");
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
      } else if (sub == "prevstate") {
        g_prev_state = parse_value(t, i);
      } else if (sub == "victim") {
        g_victim = &ent(value_text(parse_value(t, i)));
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          g_victim->_px = lfw::to_number(lfw::field_or(v, u"x"));
          g_victim->_py = lfw::to_number(lfw::field_or(v, u"y"));
          g_victim->_pz = lfw::to_number(lfw::field_or(v, u"z"));
          // `position` 现在是实体的普通数据成员：库直接读它（`e.position.x`），
          // 台面的 `_px` 三个只是打印镜像。
          g_victim->position.x = g_victim->_px;
          g_victim->position.y = g_victim->_py;
          g_victim->position.z = g_victim->_pz;
        }
      } else if (sub == "ground_y") {
        if (g_victim != nullptr) g_victim->_ground_y = parse_value(t, i);
      } else if (sub == "velx") {
        if (g_victim != nullptr) g_victim->_vx = parse_value(t, i);
      } else if (sub == "vely") {
        if (g_victim != nullptr) g_victim->_vy = parse_value(t, i);
      } else if (sub == "velz") {
        if (g_victim != nullptr) g_victim->_vz = parse_value(t, i);
      } else if (sub == "facing") {
        if (g_victim != nullptr) {
          g_victim->_facing = parse_value(t, i);
          // `facing` 也是普通数据成员（库读 `e.facing`）；镜像供打印。
          g_victim->facing = lfw::to_number(g_victim->_facing);
        }
      } else if (sub == "ctrlud") {
        if (g_victim != nullptr) g_victim->_ctrl_ud = trace::to_double(t[i++]);
      } else if (sub == "ctrllr") {
        if (g_victim != nullptr) g_victim->_ctrl_lr = trace::to_double(t[i++]);
      } else if (sub == "dataset") {
        if (g_victim != nullptr) g_victim->_dataset = parse_value(t, i);
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
        g_state_obj = new CharacterState_Dash(g_state);
        std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "enter") {
        lfw::Object prev;
        prev.set(u"state", g_prev_state);
        if (g_state_obj->enter) {
          g_state_obj->enter(*g_victim, Value(std::make_shared<lfw::Object>(prev)));
        }
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
