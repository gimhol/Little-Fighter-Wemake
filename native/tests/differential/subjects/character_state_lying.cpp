#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/state/character_state_lying.h"
#include "lfw/utils/container_help/field_or.h"

#include "entity_fixture.h"
#include "trace_util.h"

namespace {

using lfw::Array;
using lfw::Entity;
using lfw::Object;
using lfw::Value;
using lfw::buff::Buff;
using lfw::state::CharacterState_Lying;
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

std::u16string value_text(const Value& v) {
  const std::u16string* s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

// `world.dataset[key]` / `world.puppets.values()`：TS 侧读假实体的 `world`（Proxy 打日志，
// `puppets` 由 `_puppets` 现搭）。切片 4CJ 后 `Entity::world_dataset` 是虚的（台面像 TS 那样每实例
// 覆写它打日志），`world.puppets.values()` 则在 `TestWorld::on_puppets_values` 上接。

// `world.puppets` 的一员：状态层只读 `team`（`csl_on_dead`），拿只回答 `team` 的小实体顶着。
struct PuppetEnt : lfw::Entity {
  std::u16string _team;
  PuppetEnt() : lfw::Entity(fx::shared_world(), Value()) { id = u"P"; }
  const std::u16string& team() const override { return _team; }
};

// 切片 4CF：`state::IStateEntity` 退役 ⇒ 假实体改成**真 `lfw::Entity`**，只覆写虚成员；
// 库读、但没有虚读面的那几条（`lying_*_count` / `reserve` / `dead_gone` / `wakeup_invuln` /
// `motionless` / `blinking` / `invulnerable` / `hp_max` / `toughness_resting`）在台面配置时
// 顺带写进真字段（配置写入不产生日志，与 TS 侧直写 `f._x` 同款）。
struct FakeEnt : lfw::Entity {
  std::u16string _id;
  Value _gy;
  Value _frameid;
  Value _hp;
  Value _hpr;
  bool _holding = false;
  Value _holdtype;
  Value _holdteam;
  std::u16string _team;
  Value _tough;
  Value _tmax;
  Value _wait;
  std::u16string _held;
  Value _dvals;
  Value _state;
  std::u16string _outline;
  std::vector<std::unique_ptr<PuppetEnt>> _puppet_owned;
  std::vector<Entity*> _puppet_view;

  explicit FakeEnt(std::u16string id) : lfw::Entity(fx::shared_world(), Value()), _id(std::move(id)) {
    this->id = _id;
    rebuild_frame();
  }

  // `world.dataset[key]` / `world.puppets.values()`：TS 台面在 `get world()` 上打日志并现搭
  // `puppets`，端口这面分别是 `Entity::world_dataset`（切片 4CJ 起 `virtual`）与
  // `TestWorld::on_puppets_values`（见 `main` 里的绑定）。
  Value world_dataset(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":world_dataset:" + s_of(key));
    return lfw::field_or(_dvals, key.c_str());
  }

  void rebuild_frame() {
    Object f;
    f.set(u"id", _frameid);
    frame = Value(std::make_shared<Object>(f));
  }

  void set_puppets(const Value& v) {
    _puppet_view.clear();
    _puppet_owned.clear();
    const Array* arr = as_array(v);
    if (arr == nullptr) return;
    for (size_t i = 0; i < arr->size(); ++i) {
      auto p = std::make_unique<PuppetEnt>();
      p->_team = lfw::to_string(arr->at(i));
      _puppet_view.push_back(p.get());
      _puppet_owned.push_back(std::move(p));
    }
  }

  double ground_y() const override { return lfw::to_number(_gy); }
  Value state() const override { return _state; }
  double hp() const override { return lfw::to_number(_hp); }
  double hp_r() const override { return lfw::to_number(_hpr); }
  void set_hp(double v) override { _hp = Value(v); }
  void set_hp_r(double v) override { _hpr = Value(v); }
  const std::u16string& team() const override { return _team; }
  void set_team(std::u16string v) override { _team = std::move(v); }
  bool has_holding() const override { return _holding; }
  Value holding_base_type() const override { return _holdtype; }
  void holding_set_team(const Value& v) override {
    g_log.push_back(s_of(_id) + ":holding_set_team:" + render(v));
    _holdteam = v;
  }
  void drop_holding() override { g_log.push_back(s_of(_id) + ":drop_holding"); }
  double toughness() const override { return lfw::to_number(_tough); }
  double toughness_max() const override { return lfw::to_number(_tmax); }
  void set_toughness(double v) override { _tough = Value(v); }
  void set_wait(const Value& v) override {
    _wait = v;
    wait = lfw::to_number(v);
  }
  void ctrl_reset_key_list() override { g_log.push_back(s_of(_id) + ":ctrl_reset_key_list"); }
  bool ctrl_is_end(const std::u16string& key) const override {
    g_log.push_back(s_of(_id) + ":ctrl_is_end:" + s_of(key));
    return _held.find(key[0]) == std::u16string::npos;
  }
  void set_outline_color(std::u16string v) override { _outline = std::move(v); }
  void world_etc(double x, double y, double z, const std::u16string& kind) override {
    g_log.push_back(s_of(_id) + ":world_etc:" + num(x) + ":" + num(y) + ":" + num(z) + ":" +
                    render(Value(kind)));
  }
  void handle_ground_velocity_decay(double factor = 1) override {
    g_log.push_back(s_of(_id) + ":handle_ground_velocity_decay:" + num(factor));
  }
  void blink_and_respawn(double duration) override {
    g_log.push_back(s_of(_id) + ":blink_and_respawn:" + num(duration));
  }
  void blink_and_gone(double duration) override {
    g_log.push_back(s_of(_id) + ":blink_and_gone:" + num(duration));
  }
};

FakeEnt* g_ent = nullptr;
Value g_state;
CharacterState_Lying* g_obj = nullptr;

std::string state_text() {
  const FakeEnt& e = *g_ent;
  return "pos=[" + num(e.position.x) + "," + num(e.position.y) + "," + num(e.position.z) +
         "] hp=" + render(e._hp) + "/" + render(e._hpr) + "/" + num(e.hp_max()) +
         " team=" + render(Value(e._team)) + " tough=" + render(e._tough) + "/" +
         render(e._tmax) + " trest=" + num(e.toughness_resting()) + " la=" +
         render(e.lying_a_count) + " ld=" + render(e.lying_d_count) + " lc=" +
         render(e.lying_c_count) + " wait=" + render(e._wait) + " holding=" +
         render(Value(e._holding)) + " holdteam=" + render(e._holdteam) + " deadjoin=" +
         render(e.dead_join) + " deadgone=" + num(e.dead_gone) + " reserve=" +
         num(e.reserve()) + " wakeup=" + num(e.wakeup_invuln) + " motionless=" +
         num(e.motionless) + " invul=" + num(e.invulnerable()) + " blink=" +
         num(e.blinking()) + " outline=" + render(Value(e._outline)) + " frameid=" +
         render(e._frameid) + " gy=" + render(e._gy);
}

void bind() {
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_character_state_lying <case-file>\n");
    return 2;
  }
  bind();
  // `world.puppets.values()` 现搭（TS 台面的 `get puppets()` 同款：每次调用才按名单取实体）。
  fx::shared_world().on_puppets_values = []() {
    return g_ent == nullptr ? std::vector<Entity*>() : g_ent->_puppet_view;
  };
  g_ent = new FakeEnt(u"E1");
  g_state = Value(0.0);

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
      if (sub == "state") {
        g_state = parse_value(t, i);
      } else if (sub == "estate") {
        g_ent->_state = parse_value(t, i);
      } else if (sub == "pos") {
        const Value v = parse_value(t, i);
        g_ent->position.set(lfw::to_number(lfw::field_or(v, u"x")),
                            lfw::to_number(lfw::field_or(v, u"y")),
                            lfw::to_number(lfw::field_or(v, u"z")));
      } else if (sub == "gy") {
        g_ent->_gy = parse_value(t, i);
      } else if (sub == "frameid") {
        g_ent->_frameid = parse_value(t, i);
        g_ent->rebuild_frame();
      } else if (sub == "hp") {
        g_ent->_hp = parse_value(t, i);
      } else if (sub == "hpr") {
        g_ent->_hpr = parse_value(t, i);
      } else if (sub == "hpmax") {
        g_ent->set_hp_max(lfw::to_number(parse_value(t, i)));
      } else if (sub == "holding") {
        g_ent->_holding = lfw::truthy(parse_value(t, i));
      } else if (sub == "holdtype") {
        g_ent->_holdtype = parse_value(t, i);
      } else if (sub == "holdteam") {
        g_ent->_holdteam = parse_value(t, i);
      } else if (sub == "team") {
        g_ent->_team = value_text(parse_value(t, i));
      } else if (sub == "tough") {
        g_ent->_tough = parse_value(t, i);
      } else if (sub == "tmax") {
        g_ent->_tmax = parse_value(t, i);
      } else if (sub == "trest") {
        g_ent->set_toughness_resting(lfw::to_number(parse_value(t, i)));
      } else if (sub == "la") {
        g_ent->lying_a_count = parse_value(t, i);
      } else if (sub == "ld") {
        g_ent->lying_d_count = parse_value(t, i);
      } else if (sub == "lc") {
        g_ent->lying_c_count = parse_value(t, i);
      } else if (sub == "wait") {
        g_ent->_wait = parse_value(t, i);
        g_ent->wait = lfw::to_number(g_ent->_wait);
      } else if (sub == "held") {
        g_ent->_held = value_text(parse_value(t, i));
      } else if (sub == "dvals") {
        g_ent->_dvals = parse_value(t, i);
      } else if (sub == "deadjoin") {
        g_ent->dead_join = parse_value(t, i);
      } else if (sub == "deadgone") {
        g_ent->dead_gone = lfw::to_number(parse_value(t, i));
      } else if (sub == "reserve") {
        g_ent->set_reserve(lfw::to_number(parse_value(t, i)));
      } else if (sub == "wakeup") {
        g_ent->wakeup_invuln = lfw::to_number(parse_value(t, i));
      } else if (sub == "motionless") {
        g_ent->set_motionless(lfw::to_number(parse_value(t, i)));
      } else if (sub == "invul") {
        g_ent->set_invulnerable(lfw::to_number(parse_value(t, i)));
      } else if (sub == "blink") {
        g_ent->set_blinking(lfw::to_number(parse_value(t, i)));
      } else if (sub == "outline") {
        g_ent->_outline = value_text(parse_value(t, i));
      } else if (sub == "puppets") {
        g_ent->set_puppets(parse_value(t, i));
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
        delete g_obj;
        g_obj = new CharacterState_Lying(g_state);
        std::printf("run make || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "default") {
        delete g_obj;
        g_obj = new CharacterState_Lying();
        std::printf("run default || %s | s=%s | %s\n", join(g_log).c_str(),
                    render(g_obj->state()).c_str(), state_text().c_str());
      } else if (what == "enter") {
        if (g_obj->enter) g_obj->enter(*g_ent, Value());
        std::printf("run enter || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "update") {
        g_obj->update(*g_ent);
        std::printf("run update || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "leave") {
        g_obj->leave(*g_ent, Value());
        std::printf("run leave || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "dead") {
        if (g_obj->on_dead) g_obj->on_dead(*g_ent);
        std::printf("run dead || %s | %s\n", join(g_log).c_str(), state_text().c_str());
      } else if (what == "findframe") {
        Value r;
        if (g_obj->find_frame_by_id) r = g_obj->find_frame_by_id(*g_ent, Value());
        std::printf("run findframe || %s | r=%s | %s\n", join(g_log).c_str(),
                    render(r).c_str(), state_text().c_str());
      } else {
        std::fprintf(stderr, "unknown run '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      continue;
    }
    std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
    return 2;
  }
  delete g_obj;
  return 0;
}
