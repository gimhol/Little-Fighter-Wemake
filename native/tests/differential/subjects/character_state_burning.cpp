#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/character_state_burning.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::EnterFrameResult;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Burning;
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
// 切片 4CJ：`this.world.dataset.X` 读面（`Entity::world_dataset`）已是 `virtual` ⇒ 台面像 TS 那面
// 「每实例一个打日志的 Proxy」一样直接覆写它（不用再挂假宿主）。
struct FakeEnt : lfw::Entity {
  std::u16string _id;
  Value _indexes;
  // `Entity::data()` 返回 `const Value&` ⇒ `{indexes}` 的镜像必须是成员（不能返回临时量）。
  mutable Value _data;
  Value _wdata;
  Value _facing;
  Value _bounced;
  Value _vx;
  Value _vy;
  Value _vz;
  Value _onlanding;
  bool _catcher = false;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = id;
    _id = std::move(id);
  }

  Value world_dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":world_dataset:" + s_of(key));
    return field_by(_wdata, key);
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
  bool has_catcher() const override { return _catcher; }
  void catcher_drop_catching() override {
    g_log.push_back(s_of(_id) + ":catcher_drop_catching");
  }
  void set_bounced(const Value& v) override {
    _bounced = v;
    Entity::set_bounced(v);
    g_log.push_back(s_of(_id) + ":set_bounced:" + render(v));
  }
  void set_facing(const Value& v) override {
    _facing = v;
    Entity::set_facing(v);
    g_log.push_back(s_of(_id) + ":set_facing:" + render(v));
  }
  Value frame_on_landing() const override { return _onlanding; }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_z() const override { return lfw::to_number(_vz); }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(_id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
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
  void handle_ground_velocity_decay(double factor = 1) override {
    (void)factor;
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay");
  }
};

std::vector<FakeEnt*> g_ents;
FakeEnt* g_victim = nullptr;
Value g_state;
Value g_velocity;
CharacterState_Burning* g_state_obj = nullptr;

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
  return "bounced=" + render(v._bounced) + " facing=" + render(v._facing) + " vel=[" +
         render(v._vx) + ":" + render(v._vy) + ":" + render(v._vz) + "]" + " catcher=" +
         std::string(v._catcher ? "1" : "0");
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
    std::fprintf(stderr, "usage: lfw_trace_character_state_burning <case-file>\n");
    return 2;
  }
  bind();
  g_state = Value(static_cast<double>(0));
  g_velocity = Value();

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
      } else if (sub == "indexes") {
        if (g_victim != nullptr) {
          g_victim->_indexes = parse_value(t, i);
          g_victim->sync_data();
        }
      } else if (sub == "wdata") {
        if (g_victim != nullptr) g_victim->_wdata = parse_value(t, i);
      } else if (sub == "facing") {
        if (g_victim != nullptr) {
          g_victim->_facing = parse_value(t, i);
          // 台面配置直写实体字段（不产生日志，与 TS 台面 `victim._facing = v` 一致）。
          g_victim->facing = lfw::to_number(g_victim->_facing);
        }
      } else if (sub == "bounced") {
        if (g_victim != nullptr) {
          g_victim->_bounced = parse_value(t, i);
          // TS 台面的 `bounced` 是个裸值；实体面上是 `bool` 字段 ⇒ 直写（不产生日志）。
          g_victim->bounced = lfw::truthy(g_victim->_bounced);
        }
      } else if (sub == "velx") {
        if (g_victim != nullptr) g_victim->_vx = parse_value(t, i);
      } else if (sub == "vely") {
        if (g_victim != nullptr) g_victim->_vy = parse_value(t, i);
      } else if (sub == "velz") {
        if (g_victim != nullptr) g_victim->_vz = parse_value(t, i);
      } else if (sub == "landingvel") {
        g_velocity = parse_value(t, i);
      } else if (sub == "catcher") {
        if (g_victim != nullptr) g_victim->_catcher = trace::to_double(t[i++]) != 0;
      } else if (sub == "onlanding") {
        if (g_victim != nullptr) g_victim->_onlanding = parse_value(t, i);
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
        g_state_obj = new CharacterState_Burning();
        std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_state_obj->enter) g_state_obj->enter(*g_victim, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_state_obj->update(*g_victim);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leave") {
        g_state_obj->leave(*g_victim, Value());
        std::printf("run leave || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "landing") {
        if (g_state_obj->on_landing) g_state_obj->on_landing(*g_victim, g_velocity);
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
