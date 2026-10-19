#include <cstdio>
#include <fstream>
#include <functional>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff_magic_flute.h"
#include "lfw/core/value.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Value;
using lfw::buff::Buff;
using lfw::buff::MagicFluteEnv;
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

// 切片 4BY：`buff` 以 `lfw::Entity` 为准入 ⇒ 假实体是真 `Entity`。实体面上
// `hp` / `hp_r` / `toughness` 是 `double`、`team` 是 `u16string`（TS 的
// `number` / `string`），台面允许它们“没设过”（`undefined`，显示 `u`）⇒ 用
// (值, 是否设过) 两件套；`data` / `state` / `fallinjury` 在实体面上仍是 `Value`。
struct Stat {
  double v = 0;
  bool set = false;
};

std::string show(const Stat& s) { return s.set ? num(s.v) : "u"; }

struct FakeEnt : lfw::Entity {
  Value _type;
  Value _indexes;
  Value _data;
  Value _state;
  Stat _hp;
  Stat _hp_r;
  Value _fallinjury;
  Value _toughness;
  std::u16string _team;
  bool _team_set = false;

  explicit FakeEnt(std::u16string id) : Entity(fx::shared_world(), Value()) { this->id = std::move(id); }

  // TS 的 `get data()`：`this._indexes === undefined ? this._data : {...this._data, indexes}`。
  void rebuild_data() {
    lfw::Object o;
    o.set(u"type", _type);
    if (!std::holds_alternative<std::monostate>(_indexes)) o.set(u"indexes", _indexes);
    _data = Value(std::make_shared<lfw::Object>(o));
  }

  const Value& data() const override { return _data; }
  Value state() const override { return _state; }
  double hp() const override { return _hp.set ? _hp.v : to_number(Value()); }
  double hp_r() const override { return _hp_r.set ? _hp_r.v : to_number(Value()); }
  void set_hp(double v) override {
    _hp = Stat{v, true};
    g_log.push_back(s_of(id) + ":set_hp:" + num(v));
  }
  void set_hp_r(double v) override {
    _hp_r = Stat{v, true};
    g_log.push_back(s_of(id) + ":set_hp_r:" + num(v));
  }
  void set_fallinjury(const Value& v) override {
    _fallinjury = v;
    g_log.push_back(s_of(id) + ":set_fallinjury:" + render(v));
  }
  void set_toughness(double v) override {
    _toughness = Value(v);
    g_log.push_back(s_of(id) + ":set_toughness:" + num(v));
  }
  const std::u16string& team() const override { return _team; }
  void set_team(std::u16string v) override {
    _team = v;
    _team_set = true;
    g_log.push_back(s_of(id) + ":set_team:" + render(Value(v)));
  }
  void set_velocity(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(id) + ":set_velocity:" + render(x) + ":" + render(y) + ":" + render(z));
  }
  void handle_velocity_decay(const Value& accx, std::optional<Value> accz = std::nullopt,
                             double factor = 1) override {
    (void)accz;
    (void)factor;
    g_log.push_back(s_of(id) + ":handle_velocity_decay:" + render(accx));
  }
  lfw::EnterFrameResult enter_frame_by_id(const Value& i, bool fallback = false) override {
    (void)fallback;
    g_log.push_back(s_of(id) + ":enter_frame_by_id:" + render(i));
    return lfw::EnterFrameResult::Entered;
  }
  void set_position(const Value& x, const Value& y, const Value& z) override {
    g_log.push_back(s_of(id) + ":set_position:" + render(x) + ":" + render(y) + ":" + render(z));
  }
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
  Entity& attach(const Value& ghost = Value(false)) override {
    g_log.push_back(s_of(id) + ":attach:" + std::string(lfw::truthy(ghost) ? "1" : "0"));
    return *this;
  }
  double frame_centery() const override { return 0; }
  double frame_height() const override { return 0; }
  double frame_pic_h() const override { return 0; }
};

std::vector<FakeEnt*> g_ents;
std::vector<FakeEnt*> g_victims;
std::unique_ptr<Buff> g_buff;
FakeEnt* g_effect = nullptr;
std::u16string g_buff_id = u"B1";
std::u16string g_kind = u"MagicFlute";
std::u16string g_cls = u"mf1";
std::u16string g_attacker_id;

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
         " hp=" + per_victim([](const FakeEnt& e) { return show(e._hp); }) +
         " hp_r=" + per_victim([](const FakeEnt& e) { return show(e._hp_r); }) +
         " fall=" + per_victim([](const FakeEnt& e) { return render(e._fallinjury); }) +
         " tough=" + per_victim([](const FakeEnt& e) { return render(e._toughness); }) +
         " team=" + per_victim([](const FakeEnt& e) {
           return e._team_set ? render(Value(e._team)) : std::string("u");
         }) +
         " vy=" + per_victim([](const FakeEnt& e) { return num(e.velocity.y); }) +
         " type=" + per_victim([](const FakeEnt& e) {
           return render(lfw::field_or(e._data, u"type"));
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

  MagicFluteEnv menv;
  menv.summary_apply_damage = [](lfw::Entity* a, const Value& injury, lfw::Entity* v,
                                 const Value& prev_hp) {
    g_log.push_back("apply_damage:" + s_of(a->id) + ":" + render(injury) + ":" +
                    s_of(v->id) + ":" + render(prev_hp));
  };
  lfw::buff::set_magic_flute_env(menv);
}

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

void run_make() {
  if (g_cls == u"mf2") {
    g_buff.reset(new lfw::buff::Buff_MagicFlute2(fx::shared_lfw(), g_buff_id, Value(g_kind)));
  } else {
    g_buff.reset(new lfw::buff::Buff_MagicFlute(fx::shared_lfw(), g_buff_id, Value(g_kind)));
  }
  for (size_t i = 0; i < g_victims.size(); ++i) {
    if (i == 0) {
      g_buff->set_victim(g_victims[i]);
    } else {
      g_buff->add_victim(g_victims[i]);
    }
  }
  if (!g_attacker_id.empty()) g_buff->set_attacker_by_id(g_attacker_id);
  std::printf("run make || %s | %s\n", join(g_log).c_str(), state_text().c_str());
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_buff_magic_flute <case-file>\n");
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
        g_cls = value_text(parse_value(t, i));
      } else if (sub == "attacker") {
        g_attacker_id = value_text(parse_value(t, i));
      } else if (sub == "ateam") {
        FakeEnt& a = ent(g_attacker_id);
        a._team = lfw::to_string(parse_value(t, i));
        a._team_set = true;
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
          g_victims.back()->_type = parse_value(t, i);
          g_victims.back()->rebuild_data();
        }
      } else if (sub == "vindexes") {
        if (!g_victims.empty()) {
          g_victims.back()->_indexes = parse_value(t, i);
          g_victims.back()->rebuild_data();
        }
      } else if (sub == "vstate") {
        if (!g_victims.empty()) g_victims.back()->_state = parse_value(t, i);
      } else if (sub == "vhp") {
        if (!g_victims.empty()) {
          g_victims.back()->_hp = Stat{lfw::to_number(parse_value(t, i)), true};
        }
      } else if (sub == "vhp_r") {
        if (!g_victims.empty()) {
          g_victims.back()->_hp_r = Stat{lfw::to_number(parse_value(t, i)), true};
        }
      } else if (sub == "vfallinjury") {
        if (!g_victims.empty()) g_victims.back()->_fallinjury = parse_value(t, i);
      } else if (sub == "vtough") {
        if (!g_victims.empty()) g_victims.back()->_toughness = parse_value(t, i);
      } else if (sub == "vteam") {
        if (!g_victims.empty()) {
          g_victims.back()->_team = lfw::to_string(parse_value(t, i));
          g_victims.back()->_team_set = true;
        }
      } else if (sub == "vvy") {
        if (!g_victims.empty()) g_victims.back()->velocity.y = trace::to_double(t[i++]);
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
