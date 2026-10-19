#include <cstdio>
#include <fstream>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/collision/collision.h"
#include "lfw/collision/healing.h"
#include "lfw/core/value.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::collision::Collision;
using lfw::collision::HealingEnv;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;
lfw::buff::Buff* g_granted = nullptr;
std::string g_granted_attacker;

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

struct Fake;

// 切片 4CE：碰撞族窄接口（`IHealingEntity` 等）退役 ⇒ 台面假实体就是真 `lfw::Entity`
// （TS 台面同样只给 `id` / `dataset` / `buffs_set` 这几条读面，见 `collision_healing.ts`）。
struct Fake : lfw::Entity {
  Value _dataset;

  explicit Fake(std::u16string id) : Entity(fx::shared_world(), Value()) {
    this->id = std::move(id);
  }

  Value dataset(const std::u16string& key) const override {
    return lfw::field_or(_dataset, key.c_str());
  }
};

Fake g_att(u"A");
Fake g_vic(u"V");
Collision g_c;

void bind() {
  fx::shared_lfw().world_override = &fx::shared_world();
  HealingEnv env;
  env.find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  lfw::collision::set_healing_env(env);

  fx::shared_world().on_find_entity = [](const std::u16string& id) -> lfw::Entity* {
    if (id == g_att.id) return &g_att;
    if (id == g_vic.id) return &g_vic;
    return nullptr;
  };
  fx::shared_lfw().on_create_entity = [](const Value&) -> lfw::Entity* { return nullptr; };
  fx::shared_lfw().on_datas_find = [](const std::u16string&) -> Value { return Value(); };
  fx::shared_world().on_buffs_set = [](const std::u16string&, lfw::buff::Buff*) {};
  fx::shared_world().on_buffs_get = [](const std::u16string&) -> lfw::buff::Buff* { return nullptr; };
  fx::shared_lfw().on_create_buff = [](const std::u16string& kind, const std::u16string& id) {
    g_log.push_back("create_buff:" + s_of(kind) + ":" + s_of(id));
    g_granted = new lfw::buff::Buff(fx::shared_lfw(), id, Value(kind));
    return g_granted;
  };
}

std::string side_text(const Fake& f) { return s_of(f.id) + ".dataset=" + render(f._dataset); }

std::string state_text() {
  std::string s = side_text(g_att) + " " + side_text(g_vic);
  s += " buff=";
  if (g_granted == nullptr) {
    s += "none";
  } else {
    s += s_of(g_granted->id()) + "/" + num(g_granted->lifetime()) + "/" +
         num(g_granted->duration()) + "/" + num(g_granted->level()) + "/" +
         s_of(g_granted->attacker_id());
  }
  return s;
}

void walk_side(Fake& f, const std::string& field, const std::vector<std::string>& t, size_t& i) {
  if (field == "dataset") {
    f._dataset = parse_value(t, i);
  } else {
    std::fprintf(stderr, "unknown side field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void run() {
  lfw::collision::handle_healing(g_c);
  std::printf("run heal || %s | %s\n", join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_healing <case-file>\n");
    return 2;
  }
  bind();
  g_c.aid = u"A";
  g_c.vid = u"V";

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
    g_granted = nullptr;
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "itr") {
        g_c.itr = parse_value(t, i);
      } else if (sub == "a" || sub == "v") {
        const std::string& field = t[i++];
        walk_side(sub == "a" ? g_att : g_vic, field, t, i);
        if (i != t.size()) {
          std::fprintf(stderr, "trailing tokens after side field '%s' at line %d\n", field.c_str(),
                       lineno);
          return 2;
        }
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "run") {
      run();
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
