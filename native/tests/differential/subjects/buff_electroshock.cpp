#include <cstdio>
#include <fstream>
#include <functional>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff_electroshock.h"
#include "lfw/core/value.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::buff::Buff;
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

// 切片 4BY：`buff` 以 `lfw::Entity` 为准入 ⇒ 假实体是真 `Entity`。`data` / `state` /
// `wait` 里 `state` / `data` 仍是 `Value`（实体面同名虚），`wait` 在实体面上是
// `double`（TS 的 `number`），`position` 是实体自己的字段。
struct FakeEnt : lfw::Entity {
  Value _data;
  Value _state;
  bool _wait_set = false;
  double _centery = 0;
  double _height = 0;
  double _pic_h = 0;

  explicit FakeEnt(std::u16string id) : Entity(fx::shared_world(), Value()) { this->id = std::move(id); }

  const Value& data() const override { return _data; }
  Value state() const override { return _state; }
  void set_wait(const Value& v) override {
    Entity::set_wait(v);
    _wait_set = true;
    g_log.push_back(s_of(id) + ":set_wait:" + render(v));
  }
  void set_position(const Value& x, const Value& y, const Value& z) override {
    position.set(lfw::to_number(x), lfw::to_number(y), lfw::to_number(z));
    g_log.push_back(s_of(id) + ":set_position:" + render(x) + ":" + render(y) + ":" + render(z));
  }
  double frame_centery() const override { return _centery; }
  double frame_height() const override { return _height; }
  double frame_pic_h() const override { return _pic_h; }
  void set_frame(const Value& info) override {
    g_log.push_back(s_of(id) + ":set_frame:" + render(lfw::field_or(info, u"id")));
  }
  void buffs_set(const std::u16string& key, Buff* b) override {
    g_log.push_back(s_of(id) + ":buffs_set:" + s_of(key));
    Entity::buffs_set(key, b);
  }
  void buffs_delete(const std::u16string& key) override {
    g_log.push_back(s_of(id) + ":buffs_delete:" + s_of(key));
    Entity::buffs_delete(key);
  }
  void set_outline_alpha(double v) override {
    g_log.push_back(s_of(id) + ":outline_alpha:" + num(v));
  }
  void set_outline_width(double v) override {
    g_log.push_back(s_of(id) + ":outline_width:" + num(v));
  }
  void set_outline_color(std::u16string v) override {
    g_log.push_back(s_of(id) + ":outline_color:" + render(Value(v)));
  }
  lfw::EnterFrameResult enter_frame_by_id(const Value& i, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(i));
    return lfw::EnterFrameResult::Entered;
  }
  Entity& attach(const Value& ghost = Value(false)) override {
    g_log.push_back(s_of(id) + ":attach:" + std::string(lfw::truthy(ghost) ? "1" : "0"));
    return *this;
  }
};

std::vector<FakeEnt*> g_ents;
std::vector<FakeEnt*> g_victims;
std::unique_ptr<Buff> g_buff;
FakeEnt* g_effect = nullptr;
std::u16string g_buff_id = u"B1";
std::u16string g_kind = u"Electroshock";

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

std::string per_victim(const std::function<std::string(const FakeEnt&)>& fn) {
  std::string out = "[";
  for (size_t i = 0; i < g_victims.size(); ++i) {
    if (i) out += ",";
    out += s_of(g_victims[i]->id) + ":" + fn(*g_victims[i]);
  }
  return out + "]";
}

std::string state_text() {
  std::string victims = "[";
  for (size_t i = 0; i < g_victims.size(); ++i) {
    if (i) victims += ",";
    victims += s_of(g_victims[i]->id);
  }
  victims += "]";
  const std::string ticks = g_buff == nullptr ? std::string("-") : num(g_buff->ticks());
  const std::string dur = g_buff == nullptr ? std::string("-") : num(g_buff->duration());
  const std::string life = g_buff == nullptr ? std::string("-") : num(g_buff->lifetime());
  return "id=" + s_of(g_buff_id) + " victims=" + victims + " ticks=" + ticks + " dur=" + dur +
         " life=" + life +
         " state=" + per_victim([](const FakeEnt& e) { return render(e._state); }) +
         " type=" + per_victim([](const FakeEnt& e) { return render(lfw::field_or(e._data, u"type")); }) +
         " wait=" + per_victim([](const FakeEnt& e) {
           return e._wait_set ? num(e.wait) : std::string("u");
         });
}

void bind() {
  fx::shared_lfw().world_override = &fx::shared_world();
  fx::shared_world().on_find_entity = [](const std::u16string& id) -> lfw::Entity* { return find_ent(id); };
  fx::shared_lfw().on_create_entity = [](const Value&) -> lfw::Entity* {
    if (g_effect == nullptr) {
      g_effect = new FakeEnt(u"fx1");
      g_ents.push_back(g_effect);
    }
    return g_effect;
  };
  fx::shared_lfw().on_datas_find = [](const std::u16string& oid) -> Value {
    if (oid.empty()) return Value();
    g_log.push_back("find_data:" + s_of(oid));
    lfw::Object o;
    o.set(u"id", Value(std::u16string(oid)));
    return Value(std::make_shared<lfw::Object>(o));
  };
  fx::shared_world().on_buffs_set = [](const std::u16string& id, Buff*) {
    g_log.push_back("world_buffs_set:" + s_of(id));
  };
  fx::shared_world().on_buffs_get = [](const std::u16string&) -> Buff* { return nullptr; };
  fx::shared_lfw().on_create_buff = [](const std::u16string&, const std::u16string&) -> Buff* { return nullptr; };
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

void run_make() {
  g_buff.reset(new lfw::buff::Buff_Electroshock(fx::shared_lfw(), g_buff_id, Value(g_kind)));
  for (size_t i = 0; i < g_victims.size(); ++i) {
    if (i == 0) {
      g_buff->set_victim(g_victims[i]);
    } else {
      g_buff->add_victim(g_victims[i]);
    }
  }
  std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_buff_electroshock <case-file>\n");
    return 2;
  }
  bind();

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
      if (sub == "id") {
        g_buff_id = value_text(parse_value(t, i));
      } else if (sub == "kind") {
        g_kind = value_text(parse_value(t, i));
      } else if (sub == "victim") {
        FakeEnt* e = &ent(value_text(parse_value(t, i)));
        for (size_t k = 0; k < g_victims.size();) {
          if (g_victims[k] == e) {
            g_victims.erase(g_victims.begin() + static_cast<std::ptrdiff_t>(k));
          } else {
            ++k;
          }
        }
        g_victims.push_back(e);
      } else if (sub == "vtype") {
        if (!g_victims.empty()) {
          lfw::Object o;
          o.set(u"type", parse_value(t, i));
          g_victims.back()->_data = Value(std::make_shared<lfw::Object>(o));
        }
      } else if (sub == "vstate") {
        if (!g_victims.empty()) g_victims.back()->_state = parse_value(t, i);
      } else if (sub == "vwait") {
        if (!g_victims.empty()) {
          g_victims.back()->wait = trace::to_double(t[i++]);
          g_victims.back()->_wait_set = true;
        }
      } else if (sub == "vframe") {
        const Value v = parse_value(t, i);
        if (!g_victims.empty()) {
          g_victims.back()->_centery = lfw::to_number(lfw::field_or(v, u"centery"));
          g_victims.back()->_height = lfw::to_number(lfw::field_or(v, u"height"));
          g_victims.back()->_pic_h = lfw::to_number(lfw::field_or(v, u"pic_h"));
        }
      } else if (sub == "vpos") {
        const Value v = parse_value(t, i);
        if (!g_victims.empty()) {
          g_victims.back()->position.set(lfw::to_number(lfw::field_or(v, u"x")),
                                        lfw::to_number(lfw::field_or(v, u"y")),
                                        lfw::to_number(lfw::field_or(v, u"z")));
        }
      } else if (sub == "duration") {
        g_buff->set_duration(trace::to_double(t[i++]));
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
      } else if (what == "init") {
        g_buff->init();
        std::printf("run init || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "mount") {
        g_buff->mount();
        std::printf("run mount || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "unmount") {
        g_buff->unmount();
        std::printf("run unmount || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "tick") {
        g_buff->update(trace::to_double(t[i++]));
        std::printf("run tick || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else {
        std::fprintf(stderr, "unknown run '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
