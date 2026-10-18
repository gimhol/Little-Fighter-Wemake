#pragma once

// 台面共享假件（切片 4CJ 从 cmds.cpp 提出）：假 `lfw`（`IWorldLfw`）、假 renderer、
// 假玩家宿主，以及可脚本化的真 `World` 派生 `TestWorld`。
//
// 背景：`IEntityHost` 退役后，实体直接持真 `lfw::World`；台面因此从「实现假宿主」改为
// 「构造真 World（喂假 lfw/renderer）+ 挂 TestWorld 上的脚本钩子」。

#include <cstdio>
#include <fstream>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>


#include "lfw/core/value.h"
#include "lfw/lfw.h"

#include "lfw/camera.h"
#include "lfw/cmds/cmds.h"
#include "lfw/core/value.h"
#include "lfw/defines/cheat_type.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/player_info.h"
#include "lfw/stage/stage.h"
#include "lfw/state/states.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/mersenne_twister.h"
#include "lfw/world.h"

#include "trace_util.h"

namespace lfw {
class ILfwHost;
}

namespace fx {

using lfw::Entity;
using lfw::Value;
using lfw::World;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_u16;


inline std::vector<std::string> g_out;

inline void push(const std::string& line) { g_out.push_back(line); }

inline std::string num(double d) { return trace::num_hex(d); }
inline std::string vstr(const Value& v) { return to_ascii(render_value(v)); }
inline std::string flag(bool b) { return b ? "1" : "0"; }
inline std::string esc(const std::u16string& s) { return trace::esc(s); }

inline lfw::state::States g_states;

// ---------------------------------------------------------------- 假件

class FakeRenderer : public lfw::IWorldRenderer {
 public:
  void add_entity(lfw::Entity& e) override { push("h:radd=" + to_ascii(e.id)); }
  void del_entity(lfw::Entity& e) override { push("h:rdel=" + to_ascii(e.id)); }
  void render(double dt) override { push("h:render=" + num(dt)); }
  void dispose() override { push("h:rdispose"); }
};

inline FakeRenderer g_renderer;

inline lfw::MersenneTwister g_mt{0.0};

inline std::vector<std::unique_ptr<lfw::Entity>> g_created;
inline std::vector<std::u16string> g_cmds;
inline std::vector<Value> g_bg_datas;
inline std::vector<Value> g_stage_datas;
inline std::vector<Value> g_broadcasts;
inline std::vector<std::string> g_cheats;
inline std::vector<Value> g_datas;
inline std::vector<Value> g_fighter_datas;
inline std::vector<Value> g_weapon_datas;
inline std::vector<std::unique_ptr<lfw::PlayerInfo>> g_players;
inline std::vector<std::pair<std::string, lfw::PlayerInfo*>> g_player_map;
inline int g_id_counter = 0;
inline int g_team_counter = 0;
inline std::unique_ptr<World> g_world;

class FakePlayerHost : public lfw::IPlayerInfoHost {
 public:
  void cache_get(const std::u16string&, lfw::PlayerInfoCacheEntry& out) override {
    out.missing = true;
  }
  bool cache_del(const std::u16string&, std::u16string&) override { return true; }
  void cache_put(const lfw::PlayerInfoCachePut&) override {}
  void warn(const std::u16string& text) override { push("h:piwarn=" + esc(text)); }
};

inline FakePlayerHost g_player_host;

inline std::vector<std::unique_ptr<lfw::controller::BaseController>> g_ctrls;

inline lfw::controller::BaseController* make_ctrl(const std::string& kind) {
  if (kind == "none") return nullptr;
  auto c = std::make_unique<lfw::controller::BaseController>();
  c->set_kind(kind == "human", kind == "bot");
  c->set_ball(kind == "ball");
  c->player_id = kind == "base" ? std::u16string() : u"7";
  lfw::Object player;
  player.set(u"id", Value(7.0));
  player.set(u"name", Value(std::u16string(u"P7")));
  player.set(u"mine", Value(true));
  c->player = Value(std::make_shared<lfw::Object>(player));
  lfw::controller::BaseController* raw = c.get();
  g_ctrls.push_back(std::move(c));
  return raw;
}

// 台面实体工厂：`add` op 与 `create_entity*` 缝共用（新实体的 id 来自假 `new_id`）。
inline lfw::Entity* new_fake_entity(World& world, const Value& data) {
  auto e = std::make_unique<lfw::Entity>(world, data, &g_states);
  lfw::Entity* const raw = e.get();
  g_created.push_back(std::move(e));
  return raw;
}

// 台面宿主（切片 4CM）：`lfw::host::HeadlessHost` 的静音版 —— `warn/error/log/debug_msg` 不打印
// （case 的 stdout 是差分比较对象，不能被宿主日志污染），其它一字不改。
//
// ⚠ 定义在 `world_fixture.cpp`（4CL 收尾）：`host/headless_host.h` 会拉进 `<filesystem>` 这类
// MSVC 内部头，而 subject TU 与 `lfw_core` / headless 目标的 RTTI/异常开关不一致，混在同一个 TU
// 里会撞出 `__msvc_heap_algorithms.hpp` 里 `_Iter_diff_t` 那种内建错误（本会话踩过两次）。
// 头里只留前置声明 ⇒ subject 的 TU 再也看不到 `<filesystem>`，也拿不到 `StubHost` 的类体。
class StubHost;
// 只暴露 `ILfwHost&`：`StubHost` 在 subject 的 TU 里是不完整类型，而构造 `LFW` 只需要基类引用。
lfw::ILfwHost& shared_stub_host();

// 台面共享的假 `lfw`。
//
// 切片 4CM：它原来是 `IWorldLfw` 的实现（那是「`LFW` 未移植」年代的窄缝），现在**派生真
// `lfw::LFW`**（宿主用上面的静音 headless 宿主），只覆写各用例脚本化的那些面 ——
// 不覆写的面走 `LFW` 的真实现。这样做的直接理由：`ui::UILayers` / `DatMgr` / `LFW` 自身的
// 真实现都以**具体 `LFW&`** 为入参，假件造不出来就退不掉那几族缝（DESIGN §148/§149）。
// 覆写的面一律**不调真基类**（复现原来假件的语义），因此行为与改之前逐字节一致。
class FakeLfw : public lfw::LFW {
 public:
  FakeLfw() : lfw::LFW(shared_stub_host(), false) {
    // `LFW` 的构造会跑 `regist_buffs()` / `regist_components()`（`Factory` 的**表级单次**登记）
    // ⇒ 真表里会多出 7 个 buff / 一批 UI 组件。台面这个假 `lfw` 在 4CM 之前是「没注册过」的状态
    // （也从没构造过 `LFW`），TS 侧的假件同样没有 ⇒ 这里清空真表以复现旧语义，否则
    // `factory/all` 这类「dump 全局表」的用例会漂移（DESIGN §149.2）。
    lfw::Factory::buff_groups().clear();
    lfw::Factory::buff_creators().clear();
    lfw::Factory::components().clear();
  }

  // ---- `IStageLfw` ----
  lfw::MersenneTwister* mt() override { return &g_mt; }

  Value datas_backgrounds_find(const Value& id) override {
    for (const Value& d : g_bg_datas) {
      if (lfw::strict_equals(lfw::field_or(d, u"id"), id)) {
        push("h:bgfind=" + vstr(lfw::field_or(d, u"id")));
        return d;
      }
    }
    push("h:bgfind=u");
    return Value();
  }

  Value datas_stages_find(const Value& id) override {
    for (const Value& d : g_stage_datas) {
      if (lfw::strict_equals(lfw::field_or(d, u"id"), id)) {
        push("h:stagefind=" + vstr(lfw::field_or(d, u"id")));
        return d;
      }
    }
    push("h:stagefind=u");
    return Value();
  }

  std::u16string new_team() override {
    g_team_counter += 1;
    return u"t" + to_u16(std::to_string(g_team_counter));
  }

  bool players_has(const Value& player_id) const override {
    (void)player_id;
    return false;
  }

  lfw::PlayerInfo* players_get(const Value& player_id) const override {
    push("h:player=" + vstr(player_id));
    for (const std::pair<std::string, lfw::PlayerInfo*>& kv : g_player_map) {
      if (lfw::strict_equals(Value(to_u16(kv.first)), player_id)) return kv.second;
    }
    return nullptr;
  }

  std::function<void()> sounds_play_bgm(const Value& music) override {
    push("h:playbgm=" + vstr(music));
    return []() { push("h:stopbgm"); };
  }

  void sounds_stop_bgm() override { push("h:stopbgm_now"); }

  void sounds_play(const Value& path, const Value& x, const Value& y, const Value& z) override {
    push("h:sound=" + vstr(path) + "," + vstr(x) + "," + vstr(y) + "," + vstr(z));
  }

  void sounds_play_with_load(const Value& path) override {
    push("h:loadplay=" + vstr(path));
  }

  lfw::stage::Expressions<lfw::stage::Stage>::Items end_testers(const Value& owner) override {
    (void)owner;
    return {};
  }

  Value datas_find(const Value& oid) override {
    push("h:datasfind=" + vstr(oid));
    for (const Value& d : g_datas) {
      if (lfw::strict_equals(lfw::field_or(d, u"id"), oid)) return d;
    }
    return Value();
  }

  std::shared_ptr<lfw::Randoming> datas_randoming_by_group(const Value& oid) override {
    (void)oid;
    return nullptr;
  }

  lfw::Entity* create_entity_with_bot(const Value& data) override {
    (void)data;
    return nullptr;
  }

  // ---- `IWorldLfw` ----
  lfw::PlayerInfo* player(const Value& player_id) override {
    push("h:player=" + vstr(player_id));
    for (const std::pair<std::string, lfw::PlayerInfo*>& kv : g_player_map) {
      if (lfw::strict_equals(Value(to_u16(kv.first)), player_id)) return kv.second;
    }
    return nullptr;
  }

  Value get_random_bg(const std::vector<Value>& groups) override {
    std::string list;
    for (const Value& g : groups) {
      if (!list.empty()) list += ",";
      list += vstr(g);
    }
    push("h:randbg=" + list);
    return Value();
  }

  lfw::Entity* create_entity(World& world, const Value& data) override {
    lfw::Entity* const raw = new_fake_entity(world, data);
    push("h:create=" + to_ascii(raw->id));
    return raw;
  }

  lfw::Entity* create_entity_with_player(const std::u16string& player_id, World& world,
                                         const Value& data) override {
    push("h:ceplayer=" + vstr(Value(player_id)));
    return new_fake_entity(world, data);
  }

  lfw::Entity* create_entity_with_bot(const std::u16string& player_id, World& world,
                                      const Value& data) override {
    push("h:cebot=" + vstr(Value(player_id)));
    return new_fake_entity(world, data);
  }

  lfw::Value datas_fighters_find(const lfw::Value& oid) override {
    for (const lfw::Value& d : g_fighter_datas) {
      if (lfw::strict_equals(lfw::field_or(d, u"id"), oid)) {
        push("h:fdatafind=" + vstr(oid));
        return d;
      }
    }
    push("h:fdatafind=u");
    return lfw::Value();
  }

  lfw::Value datas_weapons_of_group(const lfw::Value& group) override {
    push("h:wpgroup=" + vstr(group));
    std::shared_ptr<lfw::Array> arr = std::make_shared<lfw::Array>();
    for (const lfw::Value& d : g_weapon_datas) arr->push_back(d);
    return lfw::Value(arr);
  }

  void entities_add(const lfw::Value& data, double n) override {
    push("h:entadd=" + vstr(lfw::field_or(data, u"id")) + "|" + trace::num_hex(n));
  }

  void random_entity_info(lfw::Entity& e) override { push("h:randominfo=" + to_ascii(e.id)); }

  void cheat_changed(const std::u16string& cmd, bool enabled) override {
    push("h:cheatchanged=" + vstr(Value(cmd)) + "|" + (enabled ? "1" : "0"));
  }

  void recycle_entity(lfw::Entity* e) override {
    push(std::string("h:recycle=") + (e != nullptr ? to_ascii(e->id) : std::string("z")));
  }

  // `lfw.factory.acquire_entity(type)`：假 LFW 没有对象池 ⇒ 恒「没拿到」（台面直接 new）。
  lfw::Entity* acquire_entity(const Value& type) override {
    (void)type;
    return nullptr;
  }

  void recycle_buff(lfw::buff::Buff* b) override {
    (void)b;
    push("h:recyclebuff");
  }

  lfw::controller::BaseController* acquire_invalid_ctrl(World& world) override {
    (void)world;
    push("h:acquire");
    return make_ctrl("base");
  }

  lfw::controller::BaseController* acquire_local_ctrl(const std::u16string& player_id,
                                                      lfw::Entity& entity) override {
    (void)entity;
    push("h:acqlocal=" + vstr(Value(player_id)));
    lfw::controller::BaseController* const c = make_ctrl("human");
    c->player_id = player_id;
    return c;
  }

  void release_ctrl(lfw::controller::BaseController* ctrl) override {
    (void)ctrl;
    push("h:release");
  }

  std::vector<lfw::ui::UINode*> layer_nodes() override { return {}; }

  double mt_range(double min_v, double max_v) override { return g_mt.range(min_v, max_v); }

  bool is_cheat(const std::u16string& name) override {
    push("h:cheat=" + vstr(Value(name)));
    for (const std::string& n : g_cheats) {
      if (n == to_ascii(name)) return true;
    }
    return false;
  }

  std::u16string new_id() override {
    g_id_counter += 1;
    push("h:newid=" + std::to_string(g_id_counter));
    return u"e" + to_u16(std::to_string(g_id_counter));
  }

  void broadcast(const Value& m) override { push("h:broadcast=" + vstr(m)); }

  lfw::controller::BaseController* create_ctrl(const std::u16string& data_id,
                                               const std::u16string& player_id) override {
    push("h:createctrl=" + vstr(Value(data_id)) + ":" + vstr(Value(player_id)));
    return nullptr;
  }

  bool has_cmds() const override { return !g_cmds.empty(); }
  void clear_cmds() override { g_cmds.clear(); }
  void clear_broadcasts() override { g_broadcasts.clear(); }

  void ctrl_update_lookup(lfw::controller::BaseController& ctrl, double index,
                          std::vector<lfw::Entity*>& entities) override {
    (void)ctrl;
    (void)entities;
    push("h:lookup=" + num(index));
  }

  bool dev() const override { return false; }

  void debug(const std::u16string& msg) override { push("h:debug=" + to_ascii(msg)); }

  std::optional<std::u16string> game_mode() const override { return std::nullopt; }
  bool survival_rank_available() const override { return false; }

  // TS 的 `World.handle_cmds` 直接 `CMDS.handle`；端口的这面是 `IWorldLfw::handle_cmds` 缝
  // ⇒ 假件把 `CMDS` 本体接上（不额外记日志，TS 那边没有这一层）。
  void handle_cmds(World& world) override { lfw::cmds::CMDS::handle(world, g_cmds); }

  void ctrl_come(lfw::controller::BaseController& ctrl, double x, double y, double z) override {
    (void)ctrl;
    push("h:come=" + num(x) + "," + num(y) + "," + num(z));
  }

  void ctrl_move(lfw::controller::BaseController& ctrl) override {
    (void)ctrl;
    push("h:movectl");
  }

  void ctrl_stay(lfw::controller::BaseController& ctrl) override {
    (void)ctrl;
    push("h:stay");
  }

  void ctrl_follow(lfw::controller::BaseController& ctrl, lfw::Entity& target) override {
    (void)ctrl;
    (void)target;
    push("h:follow");
  }

  bool ctrl_goingto(const lfw::controller::BaseController& ctrl) const override {
    (void)ctrl;
    return false;
  }

  void warn(const std::u16string& text) override { push("h:warn=" + esc(text)); }
};

// 共享的那一份假 `lfw`（`shared_world()` 的 `TestWorld` 用它供世界）。
inline FakeLfw g_lfw;

// 台面世界：真 `lfw::World`（假 `lfw` + 假 renderer 供起来），把「假宿主」时代那些
// 脚本化的面搬成 `std::function` 钩子。没挂钩子时走 `World` 的真实现。
class TestWorld : public World {
 public:
  TestWorld() : World(g_lfw, g_renderer, &g_states) {}
  // 自带假 `lfw` / renderer / 状态表的台面（`entity.cpp` 的假件比这里的粗件更细，
  // 「假 `lfw` 各家自己写」从 `cmds.cpp` 时代就是这个口径）。
  TestWorld(lfw::LFW& lfw, lfw::IWorldRenderer& renderer, lfw::state::States* states)
      : World(lfw, renderer, states) {}

  std::function<Value(const std::u16string&)> on_bg_dataset;
  std::function<Value(const std::u16string&)> on_stage_value;
  std::function<Value(const std::u16string&)> on_bg_value;
  std::function<Entity*(const std::u16string&)> on_find_entity;
  std::function<std::vector<Entity*>()> on_puppets_values;
  std::function<void(Entity&)> on_add_entities;
  std::function<std::vector<double>(Entity&)> on_get_bound;
  std::function<void(const Value&, const Value&)> on_play_sound;
  std::function<std::optional<Value>(const Value&, const std::u16string&, Entity&)> on_gen_field;
  std::function<void(const std::u16string&)> on_broadcast;
  std::function<Entity*(const Value&)> on_create_entity_with_bot;
  std::function<lfw::controller::BaseController*()> on_acquire_ctrl;
  std::function<lfw::controller::BaseController*(const std::u16string&, const std::u16string&)>
      on_create_ctrl;
  std::function<std::vector<Entity*>(const std::u16string&,
                                     const std::function<bool(Entity&)>&)>
      on_list_entities;
  std::function<double()> on_entity_count;
  std::function<void(Entity&, bool)> on_mark_players_alive;
  std::function<lfw::Vector3(Entity&)> on_restrict;
  std::function<double()> on_game_time;

  Value bg_dataset(const std::u16string& key) const override {
    return on_bg_dataset ? on_bg_dataset(key) : World::bg_dataset(key);
  }
  Value stage_value(const std::u16string& key) const override {
    return on_stage_value ? on_stage_value(key) : World::stage_value(key);
  }
  Value bg_value(const std::u16string& key) const override {
    return on_bg_value ? on_bg_value(key) : World::bg_value(key);
  }
  Entity* find_entity(const std::u16string& id) const override {
    if (on_find_entity) return on_find_entity(id);
    return World::find_entity(id);
  }
  std::vector<Entity*> puppets_values() override {
    if (on_puppets_values) return on_puppets_values();
    return World::puppets_values();
  }
  // 旧缝时代的假宿主整条接管 `add_entities`（TS 台面同样把 `world.add_entities` 换成只打日志的
  // 桩件）⇒ 挂了钩子就不再走真实现，免得凭空多出 `mark_players_alive` 之类的副作用。
  void add_entities(Entity& e) override {
    if (on_add_entities) {
      on_add_entities(e);
      return;
    }
    World::add_entities(e);
  }
  std::vector<double> get_bound(Entity& e) override {
    if (on_get_bound) return on_get_bound(e);
    return World::get_bound(e);
  }
  void play_sound(const Value& sounds, const Value& pos) override {
    if (on_play_sound) {
      on_play_sound(sounds, pos);
      return;
    }
    World::play_sound(sounds, pos);
  }
  std::optional<Value> gen_field(const Value& holder, const std::u16string& kind,
                                Entity& emitter) override {
    if (on_gen_field) return on_gen_field(holder, kind, emitter);
    return World::gen_field(holder, kind, emitter);
  }
  const std::vector<Entity*>& list_entities(const std::u16string& name,
                                            const std::function<bool(Entity&)>& predicate) override {
    if (!on_list_entities) return World::list_entities(name, predicate);
    list_cache_ = on_list_entities(name, predicate);
    return list_cache_;
  }
  double entity_count() const override {
    return on_entity_count ? on_entity_count() : World::entity_count();
  }
  void mark_players_alive(Entity& e, bool is_alive) override {
    if (on_mark_players_alive) {
      on_mark_players_alive(e, is_alive);
      return;
    }
    World::mark_players_alive(e, is_alive);
  }
  const lfw::Vector3& restrict(Entity& e) override {
    if (!on_restrict) return World::restrict(e);
    restrict_result_ = on_restrict(e);
    return restrict_result_;
  }
  double game_time() const override {
    return on_game_time ? on_game_time() : World::game_time();
  }

 private:
  std::vector<Entity*> list_cache_;
  lfw::Vector3 restrict_result_;
};

// 进程内共享的台面世界（Meyers 单例）。名字与 `lfw::Entity::world()` 不撞。
inline TestWorld& shared_world() {
  static TestWorld w;
  return w;
}

// ---- 真 `LFW` 的台面通路（切片 4CL）----
//
// 为什么要有：`ui::UILayers` / `DatMgr` / 整个 `IWorldLfw` 的真实现都以**具体 `LFW&`** 为入参，
// 台面造不出 `LFW` 就退不掉那些缝（4CK-2 就是这么被卡住的）。宿主用上面那个静音 headless 宿主。
// 进程内共享的真 `LFW`（首次用到才构造，`HeadlessHost({}, false)` 不读盘）。
lfw::LFW& shared_real_lfw();

// 挂在真 `LFW` 上的台面世界：那些「真实现需要 `LFW&`」的缝，台面改用这条通路。
TestWorld& shared_real_lfw_world();

}  // namespace fx
