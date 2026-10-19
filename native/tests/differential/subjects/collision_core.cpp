#include <cstdio>
#include <fstream>
#include <map>
#include <string>
#include <vector>

#include "lfw/collision/collision.h"
#include "lfw/core/value.h"
#include "lfw/utils/container_help/field_or.h"

#include "trace_util.h"

namespace {

using lfw::collision::ActorHandle;
using lfw::collision::Collision;
using lfw::collision::CollisionActor;
using lfw::collision::CollisionCoreEnv;
using lfw::collision::CollisionInits;
using lfw::collision::CollisionSnapshot;
using lfw::collision::Cube;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;

struct Engine {
  lfw::Value dataset;
  CollisionActor a;
  CollisionActor v;
  bool is_ally = false;
  bool v_rest = false;
  bool dev = false;
  bool load_ok = false;
  lfw::Value load_names;
  lfw::Value itr;
  lfw::Value bdy;
  lfw::Value pool;
  bool pool_ok = true;
  double pool_handlers = 0;
  double itr_index = 0;
  double bdy_index = 0;
  double id_seq = 0;
};

Engine g_e;
CollisionCoreEnv g_core;
std::vector<std::string> g_log;
Collision* g_slot[2] = {nullptr, nullptr};
int g_cur = 0;
CollisionSnapshot g_snap;

std::string render(const lfw::Value& v) { return to_ascii(render_value(v)); }
std::string num(double d) { return render(lfw::Value(d)); }
std::string flag(bool b) { return b ? "b1" : "b0"; }
std::string s_of(const std::u16string& s) { return to_ascii(s); }

std::u16string u16num(long long v) {
  if (v == 0) return u"0";
  std::u16string s;
  while (v > 0) {
    s.insert(s.begin(), static_cast<char16_t>(u'0' + static_cast<char16_t>(v % 10)));
    v /= 10;
  }
  return s;
}

std::string join(const std::vector<std::string>& xs) {
  std::string out;
  for (size_t i = 0; i < xs.size(); ++i) {
    if (i) out += ",";
    out += xs[i];
  }
  return out;
}

Cube cube_of(const lfw::Value& frame) {
  Cube c;
  const lfw::Value cube = lfw::field_or(frame, u"__cube");
  const lfw::Array* arr = lfw::as_array(cube);
  if (arr == nullptr || arr->size() < 6) return c;
  c.left = lfw::to_number(arr->at(0));
  c.right = lfw::to_number(arr->at(1));
  c.bottom = lfw::to_number(arr->at(2));
  c.top = lfw::to_number(arr->at(3));
  c.near = lfw::to_number(arr->at(4));
  c.far = lfw::to_number(arr->at(5));
  return c;
}

lfw::Value priority_of(double t) {
  if (t == 8) return lfw::Value(0.0);
  if (t == 16) return lfw::Value(1.0);
  if (t == 32) return lfw::Value(2.0);
  if (t == 4) return lfw::Value(3.0);
  return lfw::Value();
}

void bind() {
  g_core.get_bounding = [](const ActorHandle&, const lfw::Value& frame, const lfw::Value&) {
    return cube_of(frame);
  };
  g_core.dataset = []() { return g_e.dataset; };
  g_core.victim_get_v_rest = [](const Collision& c) {
    g_log.push_back("get_v_rest:" + s_of(c.aid) + ":" + flag(g_e.v_rest));
    return g_e.v_rest;
  };
  g_core.attacker_is_ally = [](const Collision&) {
    g_log.push_back("is_ally:" + flag(g_e.is_ally));
    return g_e.is_ally;
  };
  g_core.acquire_collision = []() -> Collision& {
    g_log.push_back("acquire");
    static std::vector<Collision*> pool;
    Collision* c = new Collision();
    if (g_e.pool_ok) {
      const lfw::Object* o = lfw::as_object(g_e.pool);
      if (o != nullptr) c->id = lfw::to_string(lfw::field_or(*o, u"id"));
    }
    c->handlers = std::make_shared<std::vector<std::u16string>>();
    for (double k = 0; k < g_e.pool_handlers; ++k)
      c->handlers->push_back(u"h" + u16num(static_cast<long long>(k)));
    pool.push_back(c);
    return *c;
  };
  g_core.new_id = []() {
    g_e.id_seq += 1;
    g_log.push_back("new_id");
    return u"N" + u16num(static_cast<long long>(g_e.id_seq));
  };
  g_core.dev = []() { return g_e.dev; };
  g_core.log = [](const std::u16string& msg) { g_log.push_back("log:" + s_of(msg)); };
  g_core.tester_debug = [](const lfw::Value& t) {
    g_log.push_back("debug_get");
    return lfw::field_or(t, u"debug");
  };
  g_core.tester_run = [](const lfw::Value& t, Collision&) {
    const bool ret = lfw::truthy(lfw::field_or(t, u"ret"));
    g_log.push_back("tester_run:" + flag(ret));
    return ret;
  };
  g_core.find_entity = [](const std::u16string& id, ActorHandle& out) {
    g_log.push_back("find_entity:" + s_of(id));
    if (id == g_e.a.id) {
      out = ActorHandle::of(g_e.a);
      return true;
    }
    if (id == g_e.v.id) {
      out = ActorHandle::of(g_e.v);
      return true;
    }
    return false;
  };
  g_core.find_object_data = [](const std::u16string& id, lfw::Value& out) {
    g_log.push_back("find_object:" + s_of(id));
    if (id == g_e.a.data_id) {
      out = lfw::field_or(g_e.a.frame, u"__owner");
      return true;
    }
    if (id == g_e.v.data_id) {
      out = lfw::field_or(g_e.v.frame, u"__owner");
      return true;
    }
    return false;
  };
  g_core.priority_of = priority_of;
  g_core.load_handlers = [](Collision& c) {
    g_log.push_back("load_handlers");
    if (!c.handlers) c.handlers = std::make_shared<std::vector<std::u16string>>();
    c.handlers->clear();
    const lfw::Array* names = lfw::as_array(g_e.load_names);
    if (names != nullptr) {
      for (size_t i = 0; i < names->size(); ++i)
        c.handlers->push_back(lfw::to_string(names->at(i)));
    }
    return g_e.load_ok;
  };
}

std::string cube_text(const Cube& c) {
  return num(c.left) + "," + num(c.right) + "," + num(c.bottom) + "," + num(c.top) + "," +
         num(c.near) + "," + num(c.far);
}

std::string state_text(const Collision& c) {
  std::vector<std::string> hs;
  if (c.handlers) {
    for (const std::u16string& h : *c.handlers) hs.push_back(s_of(h));
  }
  std::string s;
  s += "id=" + s_of(c.id);
  s += " aid=" + s_of(c.aid);
  s += " vid=" + s_of(c.vid);
  s += " adata=" + s_of(c.adata_id);
  s += " vdata=" + s_of(c.vdata_id);
  s += " aframe=" + s_of(c.aframe_id);
  s += " bframe=" + s_of(c.bframe_id);
  s += " ith=" + num(c.itr_index);
  s += " bdy=" + num(c.bdy_index);
  s += " ax=" + num(c.ax);
  s += " ay=" + num(c.ay);
  s += " az=" + num(c.az);
  s += " vx=" + num(c.vx);
  s += " vy=" + num(c.vy);
  s += " vz=" + num(c.vz);
  s += " dx=" + num(c.dx);
  s += " dy=" + num(c.dy);
  s += " dz=" + num(c.dz);
  s += " md=" + num(c.m_distance);
  s += " rest=" + num(c.rest);
  s += " prio=" + render(c.priority);
  s += " inj=" + render(c.injury);
  s += " inj_r=" + render(c.injury_r);
  s += " rinj=" + render(c.real_injury);
  s += " rinj_r=" + render(c.real_injury_r);
  s += " nh=" + num(static_cast<double>(hs.size()));
  s += " hs=" + join(hs);
  s += " acl=" + cube_text(c.a_cube);
  s += " bcl=" + cube_text(c.b_cube);
  return s;
}

std::string snap_text(const CollisionSnapshot& s) {
  std::string o;
  o += "aid=" + s_of(s.aid);
  o += " vid=" + s_of(s.vid);
  o += " adata=" + s_of(s.adata_id);
  o += " vdata=" + s_of(s.vdata_id);
  o += " aframe=" + s_of(s.aframe_id);
  o += " bframe=" + s_of(s.bframe_id);
  o += " ith=" + num(s.itr_index);
  o += " bdy=" + num(s.bdy_index);
  o += " ax=" + num(s.ax);
  o += " ay=" + num(s.ay);
  o += " az=" + num(s.az);
  o += " vx=" + num(s.vx);
  o += " vy=" + num(s.vy);
  o += " vz=" + num(s.vz);
  o += " dx=" + num(s.dx);
  o += " dy=" + num(s.dy);
  o += " dz=" + num(s.dz);
  o += " md=" + num(s.m_distance);
  o += " rest=" + num(s.rest);
  return o;
}

std::string op_text() { return join(g_log); }
void clear_log() { g_log.clear(); }

void walk_actor(CollisionActor& t, const std::string& field, const std::vector<std::string>& tok,
                size_t& i) {
  if (field == "id") {
    t.id = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "pos") {
    t.px = lfw::to_number(parse_value(tok, i));
    t.py = lfw::to_number(parse_value(tok, i));
    t.pz = lfw::to_number(parse_value(tok, i));
  } else if (field == "data_id") {
    t.data_id = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "data_type") {
    t.data_type = lfw::to_number(parse_value(tok, i));
  } else if (field == "frame") {
    t.frame = parse_value(tok, i);
  } else if (field == "prefabs") {
    t.itr_prefabs = parse_value(tok, i);
  } else if (field == "bear") {
    t.bear_wpoint_attacking = parse_value(tok, i);
  } else if (field == "marks") {
    t.marks_group_attack = tok[i++] == "1";
  } else if (field == "dropping") {
    t.dropping = tok[i++] == "1";
  } else if (field == "arest") {
    t.arest = parse_value(tok, i);
  } else if (field == "catcher") {
    t.has_catcher = tok[i++] == "1";
  } else if (field == "hurtable") {
    t.catcher_hurtable = parse_value(tok, i);
  } else if (field == "invul") {
    t.invulnerable = parse_value(tok, i);
  } else if (field == "bot_ignore") {
    t.bot_ignore = parse_value(tok, i);
  } else if (field == "team") {
    t.team = parse_value(tok, i);
  } else if (field == "emitter") {
    t.emitter = parse_value(tok, i);
  } else if (field == "spawn") {
    t.spawn_time = parse_value(tok, i);
  } else if (field == "bot") {
    t.is_bot_ctrl = tok[i++] == "1";
  } else {
    std::fprintf(stderr, "unknown actor field '%s'\n", field.c_str());
    std::exit(2);
  }
}

void walk_snap(const std::string& field, const std::vector<std::string>& tok, size_t& i) {
  if (field == "aid") {
    g_snap.aid = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "vid") {
    g_snap.vid = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "adata_id") {
    g_snap.adata_id = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "vdata_id") {
    g_snap.vdata_id = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "aframe_id") {
    g_snap.aframe_id = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "bframe_id") {
    g_snap.bframe_id = trace::parse_js_string_literal(tok[i++]);
  } else if (field == "itr_index") {
    g_snap.itr_index = lfw::to_number(parse_value(tok, i));
  } else if (field == "bdy_index") {
    g_snap.bdy_index = lfw::to_number(parse_value(tok, i));
  } else if (field == "ax") {
    g_snap.ax = lfw::to_number(parse_value(tok, i));
  } else if (field == "ay") {
    g_snap.ay = lfw::to_number(parse_value(tok, i));
  } else if (field == "az") {
    g_snap.az = lfw::to_number(parse_value(tok, i));
  } else if (field == "vx") {
    g_snap.vx = lfw::to_number(parse_value(tok, i));
  } else if (field == "vy") {
    g_snap.vy = lfw::to_number(parse_value(tok, i));
  } else if (field == "vz") {
    g_snap.vz = lfw::to_number(parse_value(tok, i));
  } else if (field == "dx") {
    g_snap.dx = lfw::to_number(parse_value(tok, i));
  } else if (field == "dy") {
    g_snap.dy = lfw::to_number(parse_value(tok, i));
  } else if (field == "dz") {
    g_snap.dz = lfw::to_number(parse_value(tok, i));
  } else if (field == "m_distance") {
    g_snap.m_distance = lfw::to_number(parse_value(tok, i));
  } else if (field == "rest") {
    g_snap.rest = lfw::to_number(parse_value(tok, i));
  } else {
    std::fprintf(stderr, "unknown snap field '%s'\n", field.c_str());
    std::exit(2);
  }
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_collision_core <case-file>\n");
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
    clear_log();
    if (op == "env") {
      if (t.size() < 3) {
        std::fprintf(stderr, "too few operands at line %d\n", lineno);
        return 2;
      }
      const std::string& sub = t[i++];
      if (sub == "dataset") {
        g_e.dataset = parse_value(t, i);
      } else if (sub == "a" || sub == "v") {
        const std::string& field = t[i++];
        walk_actor(sub == "a" ? g_e.a : g_e.v, field, t, i);
      } else if (sub == "ally") {
        g_e.is_ally = t[i++] == "1";
      } else if (sub == "vrest") {
        g_e.v_rest = t[i++] == "1";
      } else if (sub == "dev") {
        g_e.dev = t[i++] == "1";
      } else if (sub == "load_ok") {
        g_e.load_ok = t[i++] == "1";
      } else if (sub == "load_names") {
        g_e.load_names = parse_value(t, i);
      } else if (sub == "itr") {
        g_e.itr = parse_value(t, i);
      } else if (sub == "bdy") {
        g_e.bdy = parse_value(t, i);
      } else if (sub == "pool") {
        g_e.pool = parse_value(t, i);
      } else if (sub == "pool_ok") {
        g_e.pool_ok = t[i++] == "1";
      } else if (sub == "pool_handlers") {
        g_e.pool_handlers = trace::to_double(t[i++]);
      } else if (sub == "idx") {
        g_e.itr_index = trace::to_double(t[i++]);
        g_e.bdy_index = trace::to_double(t[i++]);
      } else if (sub == "new_id_base") {
        g_e.id_seq = trace::to_double(t[i++]);
      } else {
        std::fprintf(stderr, "unknown env '%s' at line %d\n", sub.c_str(), lineno);
        return 2;
      }
      std::printf("env %s\n", sub.c_str());
      continue;
    }
    if (op == "slot") {
      g_cur = static_cast<int>(trace::to_double(t[i++]));
      std::printf("slot %d\n", g_cur);
      continue;
    }
    if (op == "new") {
      CollisionInits inits;
      inits.attacker = ActorHandle::of(g_e.a);
      inits.victim = ActorHandle::of(g_e.v);
      inits.aframe = g_e.a.frame;
      inits.bframe = g_e.v.frame;
      inits.itr = g_e.itr;
      inits.bdy = g_e.bdy;
      inits.itr_index = g_e.itr_index;
      inits.bdy_index = g_e.bdy_index;
      Collision& c = lfw::collision::collision_new(g_core, inits);
      g_slot[g_cur] = &c;
      std::printf("new %s\n", state_text(c).c_str());
      continue;
    }
    if (op == "get") {
      Collision* c = lfw::collision::collision_get(g_core, ActorHandle::of(g_e.a),
                                                   ActorHandle::of(g_e.v));
      if (c == nullptr) {
        std::printf("get no || %s\n", op_text().c_str());
      } else {
        g_slot[g_cur] = c;
        std::printf("get yes %s || %s\n", state_text(*c).c_str(), op_text().c_str());
      }
      continue;
    }
    if (op == "test") {
      if (g_slot[g_cur] == nullptr) {
        std::printf("test no-slot\n");
        continue;
      }
      const bool r = lfw::collision::collision_test(*g_slot[g_cur]);
      std::printf("test %s || %s\n", flag(r).c_str(), op_text().c_str());
      continue;
    }
    if (op == "snap") {
      if (g_slot[g_cur] == nullptr) {
        std::printf("snap no-slot\n");
        continue;
      }
      g_snap = lfw::collision::collision_to_snapshot(*g_slot[g_cur]);
      std::printf("snap %s\n", snap_text(g_snap).c_str());
      continue;
    }
    if (op == "snapset") {
      const std::string& field = t[i++];
      walk_snap(field, t, i);
      std::printf("snapset %s\n", field.c_str());
      continue;
    }
    if (op == "from_snap") {
      Collision* c = lfw::collision::collision_from_snapshot(g_core, g_snap);
      if (c == nullptr) {
        std::printf("from_snap no || %s\n", op_text().c_str());
      } else {
        g_slot[g_cur] = c;
        std::printf("from_snap yes %s || %s\n", state_text(*c).c_str(), op_text().c_str());
      }
      continue;
    }
    if (op == "clone") {
      if (g_slot[g_cur] == nullptr) {
        std::printf("clone no-slot\n");
        continue;
      }
      const int src = g_cur;
      g_cur = src == 0 ? 1 : 0;
      Collision* out = new Collision();
      lfw::collision::collision_clone(g_core, *g_slot[src], *out);
      g_slot[g_cur] = out;
      std::printf("clone %s\n", state_text(*out).c_str());
      continue;
    }
    if (op == "state") {
      if (g_slot[g_cur] == nullptr) {
        std::printf("state no-slot\n");
        continue;
      }
      std::printf("state %s\n", state_text(*g_slot[g_cur]).c_str());
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  return 0;
}
