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
using lfw::collision::ActorHandle;
using lfw::collision::CollisionActor;
using lfw::collision::CollisionCoreEnv;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

std::vector<std::string> g_log;
Collision g_c;
CollisionCoreEnv g_core;
bool g_dev = false;
Value g_vdata;
double g_a_state = 0;
double g_v_state = 0;

std::string render(const Value& v) { return to_ascii(render_value(v)); }
std::string s_of(const std::u16string& s) { return to_ascii(s); }

std::string join(const std::vector<std::string>& xs) {
  std::string out;
  for (size_t i = 0; i < xs.size(); ++i) {
    if (i) out += ",";
    out += xs[i];
  }
  return out;
}

std::string flatten(const std::u16string& s) {
  const std::string t = s_of(s);
  std::string out;
  for (size_t i = 0; i < t.size(); ++i) {
    if (t[i] == '\n') {
      out += "\\n";
    } else {
      out += t[i];
    }
  }
  return out;
}

void bind() {
  lfw::collision::KeeperEnv env;
  env.attacker_state = [](const Collision&) { return g_a_state; };
  env.victim_state = [](const Collision&) { return g_v_state; };
  env.call_handler = [](const std::u16string& fn, Collision&) {
    g_log.push_back("handler:" + s_of(fn));
  };
  env.ball_frozen = [](const ActorHandle& first, const ActorHandle& second, const Value&) {
    (void)second;
    return first.id() != u"V";
  };
  env.run_action = [](const std::u16string& type, const Value& action, Collision&) {
    g_log.push_back("action:" + s_of(type) + ":" + render(action));
  };
  env.victim_push_collided = [](Collision& c) {
    g_log.push_back("v_collided:" + s_of(c.victim.id()));
  };
  env.attacker_push_collision = [](Collision& c) {
    g_log.push_back("a_collision:" + s_of(c.attacker.id()));
  };
  env.victim_play_sound = [](const Collision&, const Value& sounds) {
    g_log.push_back("sound:" + render(sounds));
  };
  // `handle` 末尾读 `victim.data.base.hit_sounds`（TS 直读实体数据）⇒ 与本 harness 的
  // `find_object_data` 给同一份 `g_vdata`，观测量不变。
  env.victim_data = [](const Collision&) { return g_vdata; };
  lfw::collision::set_keeper_env(env);

  g_core.dev = []() { return g_dev; };
  g_core.log = [](const std::u16string& msg) { g_log.push_back("dbg:" + flatten(msg)); };
  g_core.tester_run = [](const Value& tester, Collision&) {
    const Value r = lfw::field_or(tester, u"r");
    g_log.push_back("tester:" + render(r));
    return lfw::truthy(r);
  };
  g_core.find_object_data = [](const std::u16string&, Value& out) {
    out = g_vdata;
    return true;
  };
  g_c.core = &g_core;
  g_c.attacker = ActorHandle::of(CollisionActor{});
  g_c.victim = ActorHandle::of(CollisionActor{});
  g_c.attacker.snap_mut().id = u"A";
  g_c.victim.snap_mut().id = u"V";
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

void run_hunt() {
  lfw::collision::collisions_keeper().handle(g_c);
  std::printf("run hunt || %s\n", join(g_log).c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_keeper_handle <case-file>\n");
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
      if (sub == "dev") {
        g_dev = t[i++] == "1";
        if (i != t.size()) {
          std::fprintf(stderr, "trailing tokens at line %d\n", lineno);
          return 2;
        }
      } else if (sub == "data") {
        const Value base = parse_value(t, i);
        lfw::Object o;
        o.set(u"base", base);
        g_vdata = Value(std::make_shared<lfw::Object>(o));
      } else if (sub == "a" || sub == "v") {
        const std::string& field = t[i++];
        if (field == "id") {
          const Value v = parse_value(t, i);
          const std::u16string* s = std::get_if<std::u16string>(&v);
          (sub == "a" ? g_c.attacker.snap_mut().id : g_c.victim.snap_mut().id) =
          s != nullptr ? *s : std::u16string();
        } else if (field == "type") {
          const double n = trace::to_double(t[i++]);
          (sub == "a" ? g_c.attacker.snap_mut().data_type : g_c.victim.snap_mut().data_type) = n;
        } else if (field == "state") {
          const double n = trace::to_double(t[i++]);
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
      run_hunt();
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
