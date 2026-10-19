#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/character_state_teleport.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::EnterFrameResult;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Base;
using lfw::state::CharacterState_Teleport2FarthestAlly;
using lfw::state::CharacterState_Teleport2NearestEnemy;
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

struct Ref {
  std::u16string id;
  bool fighter = false;
  bool ally = false;
  double hp = 0;
  double x = 0;
  double z = 0;
};

// 切片 4CF：`state::IStateEntity` 退役 ⇒ 台面假实体就是真 `lfw::Entity`（TS 台面同形），
// 观测点只剩实体面那几条虚方法；位置读面收成了 `Entity::position` 直写字段（TS 台面的
// `_px/_py/_pz` 换成实体自己的 `position`）。
struct FakeEnt : lfw::Entity {
  std::u16string _id;
  Value _facing;
  Value _segment;
  double _gy = 0;
  std::vector<Ref> _refs;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()) {
    this->id = id;
    _id = std::move(id);
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
  Value world_entities() const override {
    auto arr = std::make_shared<lfw::Array>();
    for (const Ref& r : _refs) arr->push_back(Value(r.id));
    return Value(arr);
  }
  const Ref* find_ref(const Value& o) const {
    const std::u16string* oid = std::get_if<std::u16string>(&o);
    if (oid == nullptr) return nullptr;
    for (const Ref& r : _refs) {
      if (r.id == *oid) return &r;
    }
    return nullptr;
  }
  bool is_fighter_ref(const Value& o) const override {
    const Ref* r = find_ref(o);
    return r != nullptr && r->fighter;
  }
  bool is_self_ref(const Value& o) const override {
    const std::u16string* oid = std::get_if<std::u16string>(&o);
    return oid != nullptr && *oid == _id;
  }
  bool is_ally_ref(const Value& o) const override {
    const Ref* r = find_ref(o);
    return r != nullptr && r->ally;
  }
  Value ref_hp(const Value& o) const override {
    const Ref* r = find_ref(o);
    return r == nullptr ? Value() : Value(r->hp);
  }
  double ref_position_x(const Value& o) const override {
    const Ref* r = find_ref(o);
    return r == nullptr ? 0 : r->x;
  }
  double ref_position_z(const Value& o) const override {
    const Ref* r = find_ref(o);
    return r == nullptr ? 0 : r->z;
  }
  Value ground_segment(double x, double z) override {
    g_log.push_back(s_of(_id) + ":ground_segment:" + num(x) + ":" + num(z));
    return _segment;
  }
  double ground_y(const Value& segment, double x, double z) override {
    g_log.push_back(s_of(_id) + ":ground_y:" + render(segment) + ":" + num(x) + ":" + num(z));
    return _gy;
  }
};

std::vector<FakeEnt*> g_ents;
FakeEnt* g_victim = nullptr;
Value g_state;
std::u16string g_cls = u"nearest";
CharacterState_Base* g_state_obj = nullptr;

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
  return "id=" + s_of(v._id) + " pos=[" + num(v.position.x) + ":" + num(v.position.y) + ":" +
         num(v.position.z) + "]" + " face=" + render(v._facing) + " seg=" +
         render(v._segment) + " gy=" + num(v._gy);
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
    std::fprintf(stderr, "usage: lfw_trace_character_state_teleport <case-file>\n");
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
      if (sub == "cls") {
        g_cls = value_text(parse_value(t, i));
      } else if (sub == "state") {
        g_state = parse_value(t, i);
      } else if (sub == "victim") {
        g_victim = &ent(value_text(parse_value(t, i)));
      } else if (sub == "facing") {
        if (g_victim != nullptr) {
          g_victim->_facing = parse_value(t, i);
          // TS 台面的 `facing` 是个裸 getter；实体面上 `facing` 是 `double` 字段 ⇒ 直写。
          g_victim->facing = lfw::to_number(g_victim->_facing);
        }
      } else if (sub == "seg") {
        if (g_victim != nullptr) g_victim->_segment = parse_value(t, i);
      } else if (sub == "gy") {
        if (g_victim != nullptr) g_victim->_gy = trace::to_double(t[i++]);
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          g_victim->position.x = lfw::to_number(lfw::field_or(v, u"x"));
          g_victim->position.y = lfw::to_number(lfw::field_or(v, u"y"));
          g_victim->position.z = lfw::to_number(lfw::field_or(v, u"z"));
        }
      } else if (sub == "ent") {
        const Value v = parse_value(t, i);
        if (g_victim != nullptr) {
          Ref r;
          r.id = value_text(lfw::field_or(v, u"id"));
          r.fighter = lfw::truthy(lfw::field_or(v, u"fighter"));
          r.ally = lfw::truthy(lfw::field_or(v, u"ally"));
          r.hp = lfw::to_number(lfw::field_or(v, u"hp"));
          r.x = lfw::to_number(lfw::field_or(v, u"x"));
          r.z = lfw::to_number(lfw::field_or(v, u"z"));
          bool replaced = false;
          for (Ref& it : g_victim->_refs) {
            if (it.id == r.id) {
              it = r;
              replaced = true;
              break;
            }
          }
          if (!replaced) g_victim->_refs.push_back(r);
        }
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
        if (g_cls == u"farthest") {
          g_state_obj = new CharacterState_Teleport2FarthestAlly(g_state);
        } else {
          g_state_obj = new CharacterState_Teleport2NearestEnemy(g_state);
        }
        std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "default") {
        delete g_state_obj;
        if (g_cls == u"farthest") {
          g_state_obj = new CharacterState_Teleport2FarthestAlly();
        } else {
          g_state_obj = new CharacterState_Teleport2NearestEnemy();
        }
        std::printf("run default || %s | state=%s | %s\n", join(g_log).c_str(),
                    render(g_state_obj->state()).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_state_obj->enter) g_state_obj->enter(*g_victim, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
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
