#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/collision/collision.h"
#include "lfw/collision/keeper.h"
#include "lfw/core/value.h"
#include "lfw/utils/container_help/field_or.h"

#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::collision::Collision;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

Collision g_c;
double g_a_state = 0;
double g_v_state = 0;

std::string render(const Value& v) { return to_ascii(render_value(v)); }
std::string s_of(const std::u16string& s) { return to_ascii(s); }

std::string handlers_text() {
  if (!g_c.handlers) return "null";
  std::string out = "[";
  for (size_t i = 0; i < g_c.handlers->size(); ++i) {
    if (i) out += ",";
    out += s_of(g_c.handlers->at(i));
  }
  out += "]";
  return out;
}

void bind() {
  lfw::collision::KeeperEnv env;
  env.attacker_state = [](const Collision&) { return g_a_state; };
  env.victim_state = [](const Collision&) { return g_v_state; };
  lfw::collision::set_keeper_env(env);
}

void seed_handlers(const Value& v) {
  g_c.handlers = std::make_shared<std::vector<std::u16string>>();
  const lfw::Array* arr = lfw::as_array(v);
  if (arr == nullptr) return;
  for (size_t i = 0; i < arr->size(); ++i) {
    const std::u16string* s = std::get_if<std::u16string>(&arr->at(i));
    if (s != nullptr) g_c.handlers->push_back(*s);
  }
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_keeper <case-file>\n");
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
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "a" || sub == "v") {
        const std::string& field = t[i++];
        const double n = trace::to_double(t[i++]);
        if (field == "type") {
          (sub == "a" ? g_c.attacker.snap_mut().data_type : g_c.victim.snap_mut().data_type) = n;
        } else if (field == "state") {
          (sub == "a" ? g_a_state : g_v_state) = n;
        } else {
          std::fprintf(stderr, "unknown side field '%s' at line %d\n", field.c_str(), lineno);
          return 2;
        }
        if (i != t.size()) {
          std::fprintf(stderr, "trailing tokens after side field '%s' at line %d\n", field.c_str(),
                       lineno);
          return 2;
        }
      } else if (sub == "itr") {
        g_c.itr = parse_value(t, i);
      } else if (sub == "bdy") {
        g_c.bdy = parse_value(t, i);
      } else if (sub == "handlers") {
        seed_handlers(parse_value(t, i));
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "run") {
      const bool ret = lfw::collision::collisions_keeper().load_handlers(g_c);
      std::printf("run load || handlers=%s | ret=%s\n", handlers_text().c_str(),
                  ret ? "1" : "0");
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
