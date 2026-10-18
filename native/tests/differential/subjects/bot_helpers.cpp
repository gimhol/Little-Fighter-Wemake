#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "lfw/bot/closest.h"
#include "lfw/bot/dummy_enum.h"
#include "lfw/bot/is_ray_hit.h"
#include "lfw/bot/nearest_targets.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/helper/manhattan_xz.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::pair<std::u16string, lfw::Value>> g_ent;
// `is_ray_hit` 这一族现在收**真 `Entity`**（TS 同形）⇒ 用例里那些"实体快照"还要有对应的真实体。
// 这里按名字懒建一份，字段从快照里那一份灌进去（`position` / `facing`）。
std::vector<std::pair<std::u16string, std::unique_ptr<fx::StubEntity>>> g_ent_real;
std::vector<std::pair<std::u16string, lfw::bot::NearestTargets>> g_nt;

std::string render(const lfw::Value& v) { return to_ascii(render_value(v)); }

std::string render_num(double d) { return render(lfw::Value(d)); }

void emit(const std::string& s) { std::printf("%s\n", s.c_str()); }

const lfw::Value* find_ent(const std::u16string& name) {
  for (const auto& kv : g_ent) {
    if (kv.first == name) return &kv.second;
  }
  return nullptr;
}

void put_ent(const std::u16string& name, lfw::Value v) {
  for (auto& kv : g_ent_real) {
    if (kv.first == name) {  // 快照变了 ⇒ 真实体要重建（下一处 `ent_real` 懒建）
      for (std::size_t i = 0; i < g_ent_real.size(); ++i) {
        if (g_ent_real[i].first == name) {
          g_ent_real.erase(g_ent_real.begin() + static_cast<std::ptrdiff_t>(i));
          break;
        }
      }
      break;
    }
  }
  for (auto& kv : g_ent) {
    if (kv.first == name) {
      kv.second = std::move(v);
      return;
    }
  }
  g_ent.push_back(std::make_pair(name, std::move(v)));
}

void del_ent(const std::u16string& name) {
  for (std::size_t i = 0; i < g_ent.size(); ++i) {
    if (g_ent[i].first == name) {
      g_ent.erase(g_ent.begin() + static_cast<std::ptrdiff_t>(i));
      break;
    }
  }
  for (std::size_t i = 0; i < g_ent_real.size(); ++i) {
    if (g_ent_real[i].first == name) {
      g_ent_real.erase(g_ent_real.begin() + static_cast<std::ptrdiff_t>(i));
      break;
    }
  }
}

// 名字 → 真实体（懒建；字段照快照那一份灌。`put_ent`/`del_ent` 会让它失效并重建）。
fx::StubEntity& ent_real(const std::u16string& name, int lineno) {
  for (auto& kv : g_ent_real) {
    if (kv.first == name) return *kv.second;
  }
  const lfw::Value* const snap = find_ent(name);
  if (snap == nullptr) {
    std::fprintf(stderr, "unknown entity '%s' at line %d\n", to_ascii(name).c_str(), lineno);
    std::exit(2);
  }
  auto e = std::make_unique<fx::StubEntity>(name);
  const lfw::Value pos = lfw::field_or(*snap, u"position");
  e->position.x = lfw::to_number(lfw::field_or(pos, u"x"));
  e->position.y = lfw::to_number(lfw::field_or(pos, u"y"));
  e->position.z = lfw::to_number(lfw::field_or(pos, u"z"));
  e->facing = lfw::to_number(lfw::field_or(*snap, u"facing"));
  fx::StubEntity& out = *e;
  g_ent_real.push_back(std::make_pair(name, std::move(e)));
  return out;
}

lfw::bot::NearestTargets* find_nt(const std::u16string& name) {
  for (auto& kv : g_nt) {
    if (kv.first == name) return &kv.second;
  }
  return nullptr;
}

void put_nt(const std::u16string& name, lfw::bot::NearestTargets v) {
  for (auto& kv : g_nt) {
    if (kv.first == name) {
      kv.second = std::move(v);
      return;
    }
  }
  g_nt.push_back(std::make_pair(name, std::move(v)));
}

std::string name_of(const lfw::Value& v) {
  for (const auto& kv : g_ent) {
    if (lfw::strict_equals(kv.second, v)) return to_ascii(kv.first);
  }
  return "?";
}

std::string snap_nt(const std::u16string& name, const lfw::bot::NearestTargets& nt) {
  std::string s = "nt snap " + to_ascii(name) + " max=" + render_num(nt.max());
  const lfw::bot::BotTarget* first = nt.get();
  if (first == nullptr) {
    s += " get=- facing=- x=-";
  } else {
    s += " get=" + name_of(first->entity.ref()) + " facing=" + render(first->facing()) +
         " x=" + render(first->x());
  }
  s += " targets=[";
  for (std::size_t i = 0; i < nt.targets().size(); ++i) {
    if (i != 0) s += ',';
    const lfw::bot::BotTarget& t = nt.targets()[i];
    s += name_of(t.entity.ref()) + ":" + render_num(t.distance) + ":" + render(t.defendable);
  }
  s += "] ents=[";
  for (std::size_t i = 0; i < nt.entities().size(); ++i) {
    if (i != 0) s += ',';
    s += name_of(nt.entities()[i].ref());
  }
  s += "]";
  return s;
}

void dump_dummy_enum() {
  const std::vector<lfw::EnumTextEntry>& entries = lfw::bot::dummy_enum_entries();
  for (std::size_t i = 0; i < entries.size(); ++i) {
    emit("de " + std::to_string(i) + " " + trace::esc(entries[i].name) + " " +
         trace::esc(entries[i].text));
  }
  lfw::Object src;
  for (const std::u16string& id : lfw::bot::dummy_updater_ids()) src.set(id, lfw::Value());
  const lfw::Value holder(std::make_shared<lfw::Object>(src));
  lfw::Array keys;
  for (const std::u16string& k : lfw::object_keys(holder)) keys.push_back(lfw::Value(k));
  emit("de_updaters " + render(lfw::Value(std::make_shared<lfw::Array>(keys))));
}

lfw::Value ent_arg(const std::u16string& name, int lineno) {
  const lfw::Value* v = find_ent(name);
  if (v == nullptr) {
    std::fprintf(stderr, "unknown entity '%s' at line %d\n", to_ascii(name).c_str(), lineno);
    std::exit(2);
  }
  return *v;
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_bot_helpers <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::string line = trace::strip_comment(raw);
    const std::vector<std::string> t = split_ws(line);
    if (t.empty()) continue;
    const std::string& op = t[0];

    if (op == "de") {
      if (t.size() != 1) {
        std::fprintf(stderr, "de takes no operands at line %d\n", lineno);
        return 2;
      }
      dump_dummy_enum();
      continue;
    }

    if (t.size() < 3) {
      std::fprintf(stderr, "too few operands at line %d\n", lineno);
      return 2;
    }

    if (op == "dxz") {
      std::size_t i = 1;
      const std::u16string a_name = trace::parse_js_string_literal(t[i++]);
      const std::u16string b_name = trace::parse_js_string_literal(t[i++]);
      emit("dxz " + to_ascii(a_name) + " " + to_ascii(b_name) + " " +
           render_num(lfw::helper::manhattan_xz(ent_arg(a_name, lineno), ent_arg(b_name, lineno))));
      if (i != t.size()) {
        std::fprintf(stderr, "trailing token(s) at line %d\n", lineno);
        return 2;
      }
      continue;
    }

    if (op == "ray") {
      std::size_t i = 1;
      const std::u16string a_name = trace::parse_js_string_literal(t[i++]);
      const std::u16string b_name = trace::parse_js_string_literal(t[i++]);
      const lfw::Value ray = parse_value(t, i);
      emit("ray " + to_ascii(a_name) + " " + to_ascii(b_name) + " " +
           render(lfw::bot::is_ray_hit(ent_real(a_name, lineno),
                                       ent_real(b_name, lineno), ray)));
      if (i != t.size()) {
        std::fprintf(stderr, "trailing token(s) at line %d\n", lineno);
        return 2;
      }
      continue;
    }

    if (op == "cl") {
      std::size_t i = 1;
      const std::u16string self_name = trace::parse_js_string_literal(t[i++]);
      const lfw::Value self = ent_arg(self_name, lineno);
      std::vector<lfw::Value> list;
      while (i < t.size()) {
        list.push_back(ent_arg(trace::parse_js_string_literal(t[i++]), lineno));
      }
      emit("cl " + to_ascii(self_name) + " n=" + std::to_string(list.size()) +
           " res=" + name_of(lfw::bot::closest(self, list)));
      continue;
    }

    const std::string& sub = t[1];
    const std::u16string name = trace::parse_js_string_literal(t[2]);
    std::size_t i = 3;

    if (op == "ent") {
      if (sub == "put") {
        put_ent(name, parse_value(t, i));
      } else if (sub == "del") {
        del_ent(name);
      } else {
        std::fprintf(stderr, "unknown ent sub '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      emit("ent " + to_ascii(name));
    } else if (op == "nt") {
      if (sub == "new") {
        put_nt(name, lfw::bot::NearestTargets(lfw::to_number(parse_value(t, i))));
      } else {
        lfw::bot::NearestTargets* inst = find_nt(name);
        if (inst == nullptr) {
          std::fprintf(stderr, "unknown nt '%s' at line %d\n", to_ascii(name).c_str(), lineno);
          return 2;
        }
        if (sub == "look") {
          const std::u16string self_name = trace::parse_js_string_literal(t[i++]);
          const std::u16string other_name = trace::parse_js_string_literal(t[i++]);
          const lfw::Value defendable = i < t.size() ? parse_value(t, i) : lfw::Value();
          inst->look(ent_arg(self_name, lineno), ent_arg(other_name, lineno), defendable);
        } else if (sub == "del") {
          const std::u16string target = trace::parse_js_string_literal(t[i++]);
          const lfw::Value* victim = find_ent(target);
          const bool found = victim != nullptr;
          const lfw::Value held = found ? *victim : lfw::Value();
          inst->del([&held, found](const lfw::bot::BotTarget& tgt) {
            return found && tgt.entity.same(lfw::TargetHandle::of(held));
          });
        } else if (sub == "sort") {
          inst->sort(ent_arg(trace::parse_js_string_literal(t[i++]), lineno));
        } else if (sub == "clear") {
          inst->clear();
        } else if (sub != "snap") {
          std::fprintf(stderr, "unknown nt sub '%s' at line %d\n", sub.c_str(), lineno);
          return 2;
        }
      }
      emit(snap_nt(name, *find_nt(name)));
    } else {
      std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
      return 2;
    }

    if (i != t.size()) {
      std::fprintf(stderr, "trailing token(s) at line %d\n", lineno);
      return 2;
    }
  }
  return 0;
}
