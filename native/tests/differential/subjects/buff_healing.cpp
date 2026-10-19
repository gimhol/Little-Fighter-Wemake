#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff_healing.h"
#include "lfw/buff/buff_mp_healing.h"
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

// 切片 4BY：`buff` 以 `lfw::Entity` 为准入 ⇒ 假实体是真 `Entity`；`hp/hp_r/mp/mp_max`
// 在实体面上是 `double`（TS 的 `number`）。TS 台面允许这四个字段“没设过”
// （`undefined`，显示 `u`）⇒ 这里用 (值, 是否设过) 两件套：实体面读回 `NaN`
// （与 TS 的 `undefined` 参与算术同义），显示面按“设过没有”印 `u`。
struct Stat {
  double v = 0;
  bool set = false;
};

std::string show(const Stat& s) { return s.set ? num(s.v) : "u"; }

struct FakeEnt : lfw::Entity {
  Value _dataset;
  Stat _hp;
  Stat _hp_r;
  Stat _mp;
  Stat _mp_max;
  std::vector<std::pair<std::u16string, std::u16string>> _marks;

  explicit FakeEnt(std::u16string id) : Entity(fx::shared_world(), Value()) { this->id = std::move(id); }

  Value dataset(const std::u16string& key) const override { return lfw::field_or(_dataset, key.c_str()); }
  double hp() const override { return _hp.set ? _hp.v : to_number(Value()); }
  double hp_r() const override { return _hp_r.set ? _hp_r.v : to_number(Value()); }
  void set_hp(double v) override {
    _hp = Stat{v, true};
    g_log.push_back(s_of(id) + ":set_hp:" + num(v));
  }
  double mp() const override { return _mp.set ? _mp.v : to_number(Value()); }
  double mp_max() const override { return _mp_max.set ? _mp_max.v : to_number(Value()); }
  void set_mp(double v) override {
    _mp = Stat{v, true};
    g_log.push_back(s_of(id) + ":set_mp:" + num(v));
  }
  void buffs_set(const std::u16string& key, Buff* b) override {
    g_log.push_back(s_of(id) + ":buffs_set:" + s_of(key));
    Entity::buffs_set(key, b);
  }
  void buffs_delete(const std::u16string& key) override {
    g_log.push_back(s_of(id) + ":buffs_delete:" + s_of(key));
    Entity::buffs_delete(key);
  }

  Value marks_get(const std::u16string& key) const override {
    for (size_t i = 0; i < _marks.size(); ++i) {
      if (_marks[i].first == key) return Value(std::u16string(_marks[i].second));
    }
    return Value();
  }
  void marks_set(const std::u16string& key, const std::u16string& value) override {
    g_log.push_back(s_of(id) + ":set_mark:" + s_of(key) + ":" + s_of(value));
    for (size_t i = 0; i < _marks.size(); ++i) {
      if (_marks[i].first == key) {
        _marks[i].second = value;
        return;
      }
    }
    _marks.emplace_back(key, value);
  }
  bool marks_delete(const std::u16string& key) override {
    for (size_t i = 0; i < _marks.size(); ++i) {
      if (_marks[i].first != key) continue;
      _marks.erase(_marks.begin() + static_cast<std::ptrdiff_t>(i));
      g_log.push_back(s_of(id) + ":del_mark:" + s_of(key));
      return true;
    }
    g_log.push_back(s_of(id) + ":del_mark_miss:" + s_of(key));
    return false;
  }
};

std::vector<FakeEnt*> g_ents;
std::vector<FakeEnt*> g_victims;
std::unique_ptr<Buff> g_buff;
std::u16string g_buff_id = u"B1";
std::u16string g_kind = u"Healing";
std::string g_cls = "healing";

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

std::string marks_text() {
  std::string out = "[";
  for (size_t i = 0; i < g_ents.size(); ++i) {
    if (i) out += ",";
    out += s_of(g_ents[i]->id) + "{";
    for (size_t j = 0; j < g_ents[i]->_marks.size(); ++j) {
      if (j) out += ",";
      out += s_of(g_ents[i]->_marks[j].first) + "=" + s_of(g_ents[i]->_marks[j].second);
    }
    out += "}";
  }
  out += "]";
  return out;
}

std::string stats_text() {
  std::string hp = "hp=[";
  std::string mp = "mp=[";
  for (size_t i = 0; i < g_victims.size(); ++i) {
    if (i) {
      hp += ",";
      mp += ",";
    }
    hp += s_of(g_victims[i]->id) + ":" + show(g_victims[i]->_hp) + "/" +
          show(g_victims[i]->_hp_r);
    mp += s_of(g_victims[i]->id) + ":" + show(g_victims[i]->_mp) + "/" +
          show(g_victims[i]->_mp_max);
  }
  return hp + "] " + mp + "]";
}

std::string state_text() {
  std::string victims = "[";
  for (size_t i = 0; i < g_victims.size(); ++i) {
    if (i) victims += ",";
    victims += s_of(g_victims[i]->id);
  }
  victims += "]";
  const std::string ticks = g_buff == nullptr ? std::string("-") : num(g_buff->ticks());
  const std::string life = g_buff == nullptr ? std::string("-") : num(g_buff->lifetime());
  const std::string dur = g_buff == nullptr ? std::string("-") : num(g_buff->duration());
  return "id=" + s_of(g_buff_id) + " victims=" + victims + " marks=" + marks_text() + " " +
         stats_text() + " ticks=" + ticks + " life=" + life + " dur=" + dur;
}

void bind() {
  fx::shared_lfw().world_override = &fx::shared_world();
  fx::shared_world().on_find_entity = [](const std::u16string& id) -> lfw::Entity* { return find_ent(id); };
  fx::shared_lfw().on_create_entity = [](const Value&) -> lfw::Entity* { return nullptr; };
  fx::shared_lfw().on_datas_find = [](const std::u16string&) -> Value { return Value(); };
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
  if (g_cls == "mp_healing") {
    g_buff.reset(new lfw::buff::Buff_MpHealing(fx::shared_lfw(), g_buff_id, Value(g_kind)));
  } else {
    g_buff.reset(new lfw::buff::Buff_Healing(fx::shared_lfw(), g_buff_id, Value(g_kind)));
  }
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
    std::fprintf(stderr, "usage: lfw_trace_buff_healing <case-file>\n");
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
      } else if (sub == "cls") {
        g_cls = to_ascii(value_text(parse_value(t, i)));
      } else if (sub == "victim") {
        g_victims.push_back(&ent(value_text(parse_value(t, i))));
      } else if (sub == "vdata") {
        if (!g_victims.empty()) g_victims.back()->_dataset = parse_value(t, i);
      } else if (sub == "vhp") {
        const Value v = parse_value(t, i);
        if (!g_victims.empty()) {
          g_victims.back()->_hp = Stat{lfw::to_number(lfw::field_or(v, u"hp")), true};
          g_victims.back()->_hp_r = Stat{lfw::to_number(lfw::field_or(v, u"hp_r")), true};
        }
      } else if (sub == "vmp") {
        const Value v = parse_value(t, i);
        if (!g_victims.empty()) {
          g_victims.back()->_mp = Stat{lfw::to_number(lfw::field_or(v, u"mp")), true};
          g_victims.back()->_mp_max = Stat{lfw::to_number(lfw::field_or(v, u"mp_max")), true};
        }
      } else if (sub == "mark") {
        const Value v = parse_value(t, i);
        if (!g_victims.empty()) {
          g_victims.back()->marks_set(lfw::to_string(lfw::field_or(v, u"key")),
                                      lfw::to_string(lfw::field_or(v, u"value")));
        }
      } else if (sub == "ticks") {
        const double n = trace::to_double(t[i++]);
        g_buff->set_ticks(n);
      } else if (sub == "duration") {
        const double n = trace::to_double(t[i++]);
        g_buff->set_duration(n);
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
      } else if (what == "mount") {
        g_buff->mount();
        std::printf("run mount || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "unmount") {
        g_buff->unmount();
        std::printf("run unmount || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "tick") {
        const double d = trace::to_double(t[i++]);
        g_buff->update(d);
        std::printf("run tick || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "duration") {
        const double amount = trace::to_double(t[i++]);
        const lfw::Entity* e = g_victims.empty() ? nullptr : g_victims[0];
        double out = 0;
        if (e != nullptr) {
          out = g_cls == "mp_healing" ? lfw::buff::Buff_MpHealing::duration_of(*e, amount)
                                      : lfw::buff::Buff_Healing::duration_of(*e, amount);
        }
        std::printf("run duration || %s | d=%s\n", join(g_log).c_str(), num(out).c_str());
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
