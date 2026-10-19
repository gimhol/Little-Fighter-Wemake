#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff_healing.h"
#include "lfw/core/value.h"
#include "lfw/state/state_base.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::state::State_Base;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;
Buff* g_created = nullptr;

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

// 切片 4CF：状态族窄接口（`state::IStateEntity`）退役 ⇒ 台面假实体就是真 `lfw::Entity`：
// `State_Base::leave` 的 HealSelf 分支直接在收进来的那个实体上 grant buff（老代码为了给
// `buff` 一个真 `Entity` 才拆出来的 `BuffStub` 随之消失 —— TS 台面的 `world.find_entity`
// 交回的本来就是同一个假件）。观测面（`buffs_set` / `set_mark` / `dataset` / marks 表）
// 与孪生 `state_base.ts` 逐字对应。
struct FakeEnt : lfw::Entity {
  Value _dataset;
  // 缺省 `u`（TS 的 `_vx` / `_vz` 初值是 `undefined`）；库读走 `velocity_x()` /
  // `velocity_z()`（切片 4CF 起收 `double`，`undefined` 只能由 `NaN` 承载）。
  Value _vx;
  Value _vz;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = std::move(id);
  }

  Value dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(id) + ":dataset:" + s_of(key));
    return lfw::field_or(_dataset, key.c_str());
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
    if (!std::holds_alternative<std::monostate>(x) && !std::holds_alternative<lfw::NullTag>(x)) {
      _vx = x;
    }
    if (!std::holds_alternative<std::monostate>(z) && !std::holds_alternative<lfw::NullTag>(z)) {
      _vz = z;
    }
  }
  void set_position(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(id) + ":set_position:" + render(x) + ":" + render(y) + ":" + render(z));
    position.x = lfw::to_number(x);
    position.y = lfw::to_number(y);
    position.z = lfw::to_number(z);
  }
  double velocity_x() const override { return lfw::to_number(_vx); }
  double velocity_z() const override { return lfw::to_number(_vz); }
  void buffs_set(const std::u16string& key, Buff* b) override {
    g_log.push_back(s_of(id) + ":buffs_set:" + s_of(key));
    Entity::buffs_set(key, b);
  }
  void buffs_delete(const std::u16string& key) override {
    g_log.push_back(s_of(id) + ":buffs_delete:" + s_of(key));
    Entity::buffs_delete(key);
  }
  void marks_set(const std::u16string& key, const std::u16string& value) override {
    g_log.push_back(s_of(id) + ":set_mark:" + s_of(key) + ":" + render(Value(value)));
    Entity::marks_set(key, value);
  }
  bool marks_delete(const std::u16string& key) override {
    const bool had = Entity::marks_delete(key);
    g_log.push_back(s_of(id) + (had ? ":del_mark:" : ":del_mark_miss:") + s_of(key));
    return had;
  }
};

std::vector<FakeEnt*> g_ents;
FakeEnt* g_victim = nullptr;
Value g_state;
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
  std::string granted = "-";
  if (g_created != nullptr) {
    granted = s_of(g_created->id()) + ":" + num(g_created->duration());
  }
  std::string marks = "[";
  if (g_victim != nullptr) {
    bool first = true;
    for (const auto& kv : g_victim->marks) {
      if (!first) marks += ",";
      first = false;
      marks += s_of(kv.first) + "=" + render(Value(kv.second));
    }
  }
  marks += "]";
  const std::string pos =
      g_victim == nullptr
          ? std::string("-")
          : "[" + num(g_victim->position.x) + ":" + num(g_victim->position.y) + ":" +
                num(g_victim->position.z) + "]";
  const std::string vel = g_victim == nullptr
                              ? std::string("-")
                              : "[" + render(g_victim->_vx) + ":" + render(g_victim->_vz) + "]";
  return "state=" + render(g_state) + " pos=" + pos + " vel=" + vel + " granted=" + granted +
         " marks=" + marks;
}

void bind() {
  fx::shared_lfw().world_override = &fx::shared_world();
  fx::shared_world().on_find_entity = [](const std::u16string& id) -> lfw::Entity* {
    FakeEnt* e = find_ent(id);
    return e == nullptr ? nullptr : e;
  };
  fx::shared_lfw().on_create_entity = [](const Value&) -> lfw::Entity* { return nullptr; };
  fx::shared_lfw().on_datas_find = [](const std::u16string&) -> Value { return Value(); };
  fx::shared_world().on_buffs_set = [](const std::u16string& id, Buff*) {
    g_log.push_back("world_buffs_set:" + s_of(id));
  };
  fx::shared_world().on_buffs_get = [](const std::u16string&) -> Buff* { return nullptr; };
  fx::shared_lfw().on_create_buff = [](const std::u16string& kind, const std::u16string& id) -> Buff* {
    g_log.push_back("create_buff:" + s_of(kind) + ":" + s_of(id));
    g_created = new lfw::buff::Buff_Healing(fx::shared_lfw(), id, Value(kind));
    return g_created;
  };
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_state_base <case-file>\n");
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
      } else if (sub == "dataset") {
        if (g_victim != nullptr) g_victim->_dataset = parse_value(t, i);
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          g_victim->position.x = lfw::to_number(lfw::field_or(v, u"x"));
          g_victim->position.y = lfw::to_number(lfw::field_or(v, u"y"));
          g_victim->position.z = lfw::to_number(lfw::field_or(v, u"z"));
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
        delete g_state_obj;
        g_state_obj = new State_Base(g_state);
        g_created = nullptr;
        std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leave") {
        g_state_obj->leave(*g_victim, Value());
        std::printf("run leave || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "restrict") {
        const double x = trace::to_double(t[i++]);
        const double y = trace::to_double(t[i++]);
        const double z = trace::to_double(t[i++]);
        g_state_obj->on_restrict(*g_victim, x, y, z);
        std::printf("run restrict || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
