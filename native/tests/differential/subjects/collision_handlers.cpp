#include <cstdio>
#include <fstream>
#include <string>
#include <vector>

#include "lfw/collision/handlers.h"
#include "lfw/core/value.h"

#include "trace_util.h"

namespace {

using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

lfw::collision::Collision g_c;
lfw::collision::HandlersEnv g_env;
std::vector<std::string> g_log;
lfw::Value g_itr_motionless;
lfw::Value g_motionless;
lfw::Value g_shaking;
lfw::Value g_arest;
std::vector<std::u16string> g_buffs;
lfw::Value g_create_ok = lfw::Value(true);

void emit(const std::string& line) { std::printf("%s\n", line.c_str()); }
std::string render(const lfw::Value& v) { return to_ascii(render_value(v)); }
std::string flag(bool b) { return b ? "b1" : "b0"; }
std::string num(double d) { return render(lfw::Value(d)); }

bool has_buff(const std::u16string& id) {
  for (const std::u16string& s : g_buffs) {
    if (s == id) return true;
  }
  return false;
}

void bind() {
  g_env.victim_add_v_rest = [](lfw::collision::Collision& c) {
    g_log.push_back("add_v_rest:" + to_ascii(c.vid) + ":" + num(c.rest));
  };
  g_env.attacker_pick_victim = [](lfw::collision::Collision& c) {
    g_log.push_back("pick:" + to_ascii(c.aid) + ":" + to_ascii(c.vid));
  };
  g_env.attacker_itr_motionless = [](const lfw::collision::Collision&) {
    g_log.push_back("get_itr_motionless");
    return g_itr_motionless;
  };
  g_env.attacker_set_motionless = [](const lfw::collision::Collision&, const lfw::Value& v) {
    g_motionless = v;
    g_log.push_back("set_motionless:" + render(v));
  };
  g_env.victim_set_shaking = [](const lfw::collision::Collision&, const lfw::Value& v) {
    g_shaking = v;
    g_log.push_back("set_shaking:" + render(v));
  };
  g_env.attacker_set_arest = [](const lfw::collision::Collision&, double v) {
    g_arest = lfw::Value(v);
    g_log.push_back("set_arest:" + num(v));
  };
  g_env.buff_get = [](const std::u16string& id) {
    const bool found = has_buff(id);
    g_log.push_back("buff_get:" + to_ascii(id) + ":" + flag(found));
    return found;
  };
  g_env.buff_lifetime_zero = [](const std::u16string& id) {
    g_log.push_back("lifetime_zero:" + to_ascii(id));
  };
  g_env.buff_create = [](const std::u16string& kind, const std::u16string& id) {
    const bool ok = lfw::truthy(g_create_ok);
    g_log.push_back("create:" + to_ascii(kind) + ":" + to_ascii(id) + ":" + flag(ok));
    if (ok) g_buffs.push_back(id);
    return ok;
  };
  g_env.buff_set_attacker = [](const std::u16string& id, const std::u16string& aid) {
    g_log.push_back("set_attacker:" + to_ascii(id) + ":" + to_ascii(aid));
  };
  g_env.buff_set_victim = [](const std::u16string& id, const std::u16string& vid) {
    g_log.push_back("set_victim:" + to_ascii(id) + ":" + to_ascii(vid));
  };
  g_env.buff_mount = [](const std::u16string& id) { g_log.push_back("mount:" + to_ascii(id)); };
  g_c.env = &g_env;
}

std::string state_text() {
  std::string s;
  for (const std::string& e : g_log) s += " " + e;
  return s + " | motionless=" + render(g_motionless) + " shaking=" + render(g_shaking) +
         " arest=" + render(g_arest) + " buffs=" + render(lfw::Value(static_cast<double>(g_buffs.size())));
}

void run(const std::string& name) {
  g_log.clear();
  if (name == "super") {
    lfw::collision::handle_super_punch_me(g_c);
  } else if (name == "picked") {
    lfw::collision::handle_weapon_picked(g_c);
  } else if (name == "stiff") {
    lfw::collision::handle_stiffness(g_c);
  } else if (name == "goto") {
    lfw::collision::handle_body_goto(g_c);
  } else if (name == "rest") {
    lfw::collision::handle_rest(g_c);
  } else if (name == "flute") {
    lfw::collision::handle_itr_kind_magic_flute(g_c);
  } else {
    std::fprintf(stderr, "unknown handler '%s'\n", name.c_str());
    std::exit(2);
  }
  emit("run " + name + state_text());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_handlers <case-file>\n");
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
    if (t.size() < 2) {
      std::fprintf(stderr, "too few operands at line %d\n", lineno);
      return 2;
    }
    size_t i = 1;
    if (op == "env") {
      const std::string& sub = t[i++];
      if (sub == "rest") {
        g_c.rest = trace::to_double(t[i++]);
      } else if (sub == "aid") {
        g_c.aid = trace::parse_js_string_literal(t[i++]);
      } else if (sub == "vid") {
        g_c.vid = trace::parse_js_string_literal(t[i++]);
      } else if (sub == "create_ok") {
        g_create_ok = lfw::Value(t[i++] == "1");
      } else if (sub == "itr_motionless") {
        g_itr_motionless = parse_value(t, i);
      } else if (sub == "itr") {
        g_c.itr = parse_value(t, i);
      } else if (sub == "dataset") {
        g_c.dataset = parse_value(t, i);
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      emit("env " + sub);
      continue;
    }
    if (op == "run") {
      run(t[i++]);
      if (i != t.size()) {
        std::fprintf(stderr, "unexpected trailing token at line %d\n", lineno);
        return 2;
      }
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
