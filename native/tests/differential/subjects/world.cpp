// `World`（`native/lfw/world.h`）的 C++ 侧台面。TS 侧是 `subjects/world.ts`，op 一一对应。
//
// 用例：`cases/world/*.txt`。假件（4CO：`IWorldLfw` 退役 ⇒ 假 `lfw` 派生真 `lfw::LFW`）：`IWorldRenderer`、真
// `ui::UINode`（4CT 起 `IWorldUi` 退役）、`IClock`（`Ditto.Clock` / `Ditto.Render`）。实体是真的 `Entity`（切片 4CJ 后
// 直接持有真 `lfw::World`），`step` 那一半（实体推进 / 碰撞配对 / 相机目标）在下一刀。
#include <cmath>
#include <cstdio>
#include <fstream>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "lfw/base/clock.h"
#include "lfw/base/render_scheduler.h"
#include "lfw/base/ticker.h"
#include "lfw/bg/background.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/i_terrain_info.h"
#include "lfw/defines/frame_id.h"
#include "lfw/defines/gone_frame_info.h"
#include "lfw/defines/game_mode.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/player_info.h"
#include "lfw/stage/expressions.h"
#include "lfw/ui/uinode.h"
#include "lfw/state/states.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/mersenne_twister.h"
#include "lfw/world.h"
#include "lfw/world_collision.h"

#include "trace_util.h"
#include "world_fixture.h"

namespace {

using lfw::Value;
using lfw::World;
using trace::num_hex;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_u16;

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

std::string num(double d) { return num_hex(d); }
std::string vstr(const Value& v) { return to_ascii(render_value(v)); }
std::string flag(bool b) { return b ? "1" : "0"; }
std::string esc(const std::u16string& s) { return trace::esc(s); }

// `catching` / `catcher` / `holding` 这类指针字段：没有给 `-`，有就给 id（`esc` 过）。
std::string id_ref(const lfw::Entity* e) { return e == nullptr ? std::string("-") : esc(e->id); }

// `_render_worker_id`：TS 里没装渲染时是 `undefined`，端口用 0 表示「没有句柄」⇒ 两边都打 `u`。
std::string handle_str(int h) { return h == 0 ? "u" : num(static_cast<double>(h)); }

std::u16string vstr_string(const Value& v) {
  const std::u16string* const s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : std::u16string();
}

std::string str_of(const Value& v) { return to_ascii(vstr_string(v)); }

lfw::state::States g_states;

// ---------------------------------------------------------------- 假件

// 前向声明：`FakeClock::tick` 要顺带把到点的一次性定时器跑掉，而那个假件内部要读时钟的 `now`
// ⇒ 定义写在时钟后面。
void fire_due_timeouts();

// 同上：渲染槽的回调也要在时钟推进时跑（raf 语义），而假件定义在时钟后面。
void fire_render_frame();

// `Ditto.Clock`：`now()` 可设、`add` / `del` 记日志。**一次性**语义（真 `Clock.ts` 的
// `flush` 把待发批次跑一遍就清空）——`Ticker` 就靠这个：每次 `tick` 重新 `add`。
class FakeClock : public lfw::IClock {
 public:
  double ms = 0;
  int next = 1;
  std::map<int, std::function<void()>> handles;

  double now() const override { return ms; }
  int add(std::function<void()> handler) override {
    const int id = next++;
    handles.emplace(id, std::move(handler));
    push("h:clockadd=" + std::to_string(id));
    return id;
  }
  void del(int handle) override {
    push("h:clockdel=" + std::to_string(handle));
    handles.erase(handle);
  }
  bool hidden() const override { return false; }

  void tick(double delta) {
    ms += delta;
    push("clock=" + num(ms));
    std::vector<std::function<void()>> list;
    for (const std::pair<const int, std::function<void()>>& kv : handles) list.push_back(kv.second);
    handles.clear();
    for (const std::function<void()>& h : list) h();
    fire_due_timeouts();
    fire_render_frame();
  }
};

FakeClock g_clock;

// `Ditto.Render`（`DittoImpl/Render.ts`）：raf 式的**重复**回调 ⇒ `add` 一次、每帧都跑，
// `del` 才摘。`World::start_render` 的渲染循环按这个语义写（`start_render` 不重新 `add`）。
class FakeRenderScheduler : public lfw::IRenderScheduler {
 public:
  int next = 1;
  std::map<int, std::function<void()>> handles;

  int add(std::function<void()> handler) override {
    const int id = next++;
    handles.emplace(id, std::move(handler));
    push("h:renderadd=" + std::to_string(id));
    return id;
  }
  void del(int handle) override {
    push("h:renderdel=" + std::to_string(handle));
    handles.erase(handle);
  }
  void tick_frame() {
    std::vector<std::function<void()>> list;
    for (const std::pair<const int, std::function<void()>>& kv : handles) list.push_back(kv.second);
    for (const std::function<void()>& h : list) h();
  }
};

FakeRenderScheduler g_render_sched;

void fire_render_frame() { g_render_sched.tick_frame(); }

// `Ditto.Timeout`：`Ticker` 的 `schedule()` 走这一支（`delay > sleep_threshold` 时）。
// `add(handler, timeout)` 是**一次性**的（TS 的 `setTimeout` 语义）⇒ 到点跑完就摘掉。
class FakeTimeout : public lfw::ITimeout {
 public:
  int next = 1;
  std::map<int, std::pair<double, std::function<void()>>> handles;

  int add(std::function<void()> handler, double timeout) override {
    const int id = next++;
    handles.emplace(id, std::make_pair(g_clock.ms + timeout, std::move(handler)));
    push("h:timeoutadd=" + std::to_string(id) + ":" + num(timeout));
    return id;
  }
  void del(int timer_id) override {
    push("h:timeoutdel=" + std::to_string(timer_id));
    handles.erase(timer_id);
  }
  void tick_due() {
    std::vector<std::function<void()>> list;
    for (auto it = handles.begin(); it != handles.end();) {
      if (it->second.first <= g_clock.ms) {
        list.push_back(it->second.second);
        it = handles.erase(it);
      } else {
        ++it;
      }
    }
    for (const std::function<void()>& h : list) h();
  }
};

FakeTimeout g_timeout;

void fire_due_timeouts() { g_timeout.tick_due(); }

class FakeRenderer : public lfw::IWorldRenderer {
 public:
  int render_calls = 0;

  void add_entity(lfw::Entity& e) override { push("h:radd=" + to_ascii(e.id)); }
  void del_entity(lfw::Entity& e) override { push("h:rdel=" + to_ascii(e.id)); }
  // 真渲染器要花时间：假件按「第 i 次渲染花 3 + 2i 毫秒」推进 `g_clock` ⇒ `render_once` 量到的
  // `spent` 非 0（否则 `render_cost` 恒 0，平滑那两行就永远等价）。
  void render(double dt) override {
    push("h:render=" + num(dt));
    g_clock.ms += 3 + 2 * render_calls;
    render_calls += 1;
  }
  void dispose() override { push("h:rdispose"); }
};

FakeRenderer g_renderer;

// 切片 4CT（ck2）：`IWorldUi` 退役 ⇒ 这个假件改成**派生真 `lfw::ui::UINode`**（`World::update_ui`
// 现在直接遍历真节点）；覆写面一字不改 ⇒ 语义等价。构造函数体写到 `g_lfw` 之后（C2065 教训）。
class FakeUi : public lfw::ui::UINode {
 public:
  FakeUi(int index, bool disabled);

  bool disabled() const override { return _disabled; }
  void update(double dt) override {
    push("h:ui=" + std::to_string(_index) + ":" + num(dt));
  }

 private:
  int _index = 0;
  bool _disabled = false;
};

std::vector<std::unique_ptr<FakeUi>> g_uis;

class FakePlayerHost : public lfw::IPlayerInfoHost {
 public:
  void cache_get(const std::u16string&, lfw::PlayerInfoCacheEntry& out) override {
    out.missing = true;
  }
  bool cache_del(const std::u16string&, std::u16string&) override { return true; }
  void cache_put(const lfw::PlayerInfoCachePut&) override {}
  void warn(const std::u16string& text) override { push("h:piwarn=" + esc(text)); }
};

FakePlayerHost g_player_host;

std::vector<std::unique_ptr<lfw::controller::BaseController>> g_ctrls;
std::vector<int> g_ctrl_ids;
std::vector<std::string> g_ctrl_kinds;

int ctrl_id_of(const lfw::controller::BaseController* const c) {
  for (size_t i = 0; i < g_ctrls.size(); ++i) {
    if (g_ctrls[i].get() == c) return g_ctrl_ids[i];
  }
  return -1;
}

std::string ctrl_kind_of(const lfw::controller::BaseController* const c) {
  for (size_t i = 0; i < g_ctrls.size(); ++i) {
    if (g_ctrls[i].get() == c) return g_ctrl_kinds[i];
  }
  return "?";
}

lfw::controller::BaseController* make_ctrl(const std::string& kind) {
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
  g_ctrl_ids.push_back(static_cast<int>(g_ctrls.size()) + 1);
  g_ctrl_kinds.push_back(kind);
  g_ctrls.push_back(std::move(c));
  return raw;
}

std::vector<std::unique_ptr<lfw::Entity>> g_entities;
std::vector<std::string> g_labels;

// `wbulk` 用的最小实体数据（`base` 给 `reset`，`frames` 给 `update`）。
const Value& bulk_data() {
  static const Value data = []() {
    Value frame = Value(std::make_shared<lfw::Object>());
    lfw::Object* const f = std::get<std::shared_ptr<lfw::Object>>(frame).get();
    f->set(u"id", Value(std::u16string(u"0")));
    f->set(u"state", Value(1.0));
    f->set(u"wait", Value(2.0));
    Value frames = Value(std::make_shared<lfw::Object>());
    lfw::Object* const fs = std::get<std::shared_ptr<lfw::Object>>(frames).get();
    fs->set(u"0", frame);
    Value base = Value(std::make_shared<lfw::Object>());
    lfw::Object* const bs = std::get<std::shared_ptr<lfw::Object>>(base).get();
    bs->set(u"name", Value(std::u16string(u"BULK")));
    bs->set(u"resting_max", Value(5.0));
    Value out = Value(std::make_shared<lfw::Object>());
    lfw::Object* const o = std::get<std::shared_ptr<lfw::Object>>(out).get();
    o->set(u"type", Value(8.0));
    o->set(u"base", base);
    o->set(u"frames", frames);
    return out;
  }();
  return data;
}
std::vector<std::unique_ptr<lfw::Entity>> g_created;
std::vector<std::unique_ptr<lfw::PlayerInfo>> g_players;
std::vector<std::pair<std::string, lfw::PlayerInfo*>> g_player_map;
std::vector<bool> g_preds;
std::unique_ptr<World> g_world;

lfw::Entity* ent_of(const std::string& label) {
  for (size_t i = 0; i < g_labels.size(); ++i) {
    if (g_labels[i] == label) return g_entities[i].get();
  }
  return nullptr;
}

lfw::PlayerInfo* player_of(const std::string& pid) {
  for (const std::pair<std::string, lfw::PlayerInfo*>& kv : g_player_map) {
    if (kv.first == pid) return kv.second;
  }
  return nullptr;
}

class FakeLfw : public lfw::LFW {
 public:
  FakeLfw() : lfw::LFW(fx::shared_stub_host(), false) {}

  lfw::MersenneTwister mt_value{0.0};
  std::vector<Value> bg_datas;
  std::vector<Value> stage_datas;
  std::vector<std::pair<std::u16string, Value>> datas;
  std::vector<Value> randbg_script;
  size_t randbg_cursor = 0;
  std::vector<Value> broadcasts;
  std::vector<std::string> cmds;
  bool cmds_has = false;
  bool dev_flag = false;
  bool rank_mode = false;
  bool rank_avail = false;
  int id_counter = 0;
  int team_counter = 0;

  // ---- `lfw.datas` / `lfw.mt` / `lfw.players` / `lfw.sounds` / `lfw.factory` ----
  lfw::MersenneTwister* mt() override { return &mt_value; }

  Value datas_backgrounds_find(const Value& id) override {
    for (const Value& d : bg_datas) {
      if (lfw::strict_equals(lfw::field_or(d, u"id"), id)) {
        push("h:bgfind=" + vstr(lfw::field_or(d, u"id")));
        return d;
      }
    }
    push("h:bgfind=u");
    return Value();
  }

  Value datas_stages_find(const Value& id) override {
    for (const Value& d : stage_datas) {
      if (lfw::strict_equals(lfw::field_or(d, u"id"), id)) {
        push("h:stagefind=" + vstr(lfw::field_or(d, u"id")));
        return d;
      }
    }
    push("h:stagefind=u");
    return Value();
  }

  std::u16string new_team() override {
    team_counter += 1;
    return u"t" + to_u16(std::to_string(team_counter));
  }

  bool players_has(const Value& player_id) const override {
    return player_of(str_of(player_id)) != nullptr;
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
    const std::string key = str_of(oid);
    for (const std::pair<std::u16string, Value>& kv : datas) {
      if (to_ascii(kv.first) == key) return kv.second;
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

  // ---- `lfw.*` 的实体/世界面 ----
  lfw::PlayerInfo* players_get(const Value& player_id) const override {
    push("h:player=" + vstr(player_id));
    return player_of(str_of(player_id));
  }

  lfw::PlayerInfo* player(const Value& player_id) override {
    push("h:player=" + vstr(player_id));
    return player_of(str_of(player_id));
  }

  Value get_random_bg(const std::vector<Value>& groups) override {
    std::string list;
    for (const Value& g : groups) {
      if (!list.empty()) list += ",";
      list += vstr(g);
    }
    push("h:randbg=" + list);
    if (randbg_script.empty()) return Value();
    const size_t at = randbg_cursor < randbg_script.size() ? randbg_cursor : randbg_script.size() - 1;
    const Value out = randbg_script[at];
    if (randbg_cursor < randbg_script.size() - 1) ++randbg_cursor;
    return out;
  }

  lfw::Entity* create_entity(World& world, const Value& data) override {
    auto e = std::make_unique<lfw::Entity>(world, data, &g_states);
    lfw::Entity* raw = e.get();
    g_created.push_back(std::move(e));
    push("h:create=" + to_ascii(raw->id));
    return raw;
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
  void release_ctrl(lfw::controller::BaseController* ctrl) override {
    push("h:release=" + std::to_string(ctrl_id_of(ctrl)));
  }
  lfw::controller::BaseController* acquire_local_ctrl(const std::u16string& player_id,
                                                      lfw::Entity& entity) override {
    (void)player_id;
    (void)entity;
    return make_ctrl("base");
  }
  lfw::Entity* create_entity_with_player(const std::u16string& player_id, World& world,
                                         const Value& data) override {
    (void)player_id;
    (void)world;
    (void)data;
    return nullptr;
  }
  lfw::Entity* create_entity_with_bot(const std::u16string& player_id, World& world,
                                      const Value& data) override {
    (void)player_id;
    (void)world;
    (void)data;
    return nullptr;
  }
  Value datas_fighters_find(const Value& oid) override {
    (void)oid;
    return Value();
  }
  Value datas_weapons_of_group(const Value& group) override {
    (void)group;
    return Value();
  }
  void entities_add(const Value& data, double num) override {
    (void)data;
    (void)num;
  }
  void random_entity_info(lfw::Entity& e) override { (void)e; }
  void cheat_changed(const std::u16string& cmd, bool enabled) override {
    (void)cmd;
    (void)enabled;
  }
  std::vector<lfw::ui::UINode*> layer_nodes() override {
    std::vector<lfw::ui::UINode*> out;
    for (const std::unique_ptr<FakeUi>& ui : g_uis) out.push_back(ui.get());
    return out;
  }
  double mt_range(double min_v, double max_v) override { return mt_value.range(min_v, max_v); }
  bool is_cheat(const std::u16string& name) override {
    push("h:cheat=" + vstr(Value(std::u16string(name))));
    for (const std::string& n : cheat_set) {
      if (n == to_ascii(name)) return true;
    }
    return false;
  }
  std::u16string new_id() override {
    id_counter += 1;
    push("h:newid=" + std::to_string(id_counter));
    return u"e" + to_u16(std::to_string(id_counter));
  }
  void broadcast(const Value& m) override { push("h:broadcast=" + vstr(m)); }
  lfw::controller::BaseController* create_ctrl(const std::u16string& data_id,
                                              const std::u16string& player_id) override {
    push("h:createctrl=" + vstr(Value(std::u16string(data_id))) + ":" +
         vstr(Value(std::u16string(player_id))));
    return nullptr;
  }
  bool has_cmds() const override { return !cmds.empty(); }
  void clear_cmds() override { cmds.clear(); }
  void clear_broadcasts() override { broadcasts.clear(); }
  void ctrl_update_lookup(lfw::controller::BaseController& ctrl, double index,
                          std::vector<lfw::Entity*>& entities) override {
    (void)entities;
    push("h:lookup=" + std::to_string(ctrl_id_of(&ctrl)) + ":" + num(index));
  }
  bool dev() const override { return dev_flag; }
  void debug(const std::u16string& msg) override { push("h:debug=" + to_ascii(msg)); }
  std::optional<std::u16string> game_mode() const override {
    return rank_mode ? std::optional<std::u16string>(lfw::game_mode::kSurvivalRank1P)
                     : std::nullopt;
  }
  bool survival_rank_available() const override { return rank_avail; }
  void handle_cmds(World& world) override {
    (void)world;
    push("h:handlecmds");
  }
  void ctrl_come(lfw::controller::BaseController& ctrl, double x, double y, double z) override {
    push("h:come=" + std::to_string(ctrl_id_of(&ctrl)) + ":" + num(x) + "," + num(y) + "," + num(z));
  }
  void ctrl_move(lfw::controller::BaseController& ctrl) override {
    push("h:movectl=" + std::to_string(ctrl_id_of(&ctrl)));
  }
  void ctrl_stay(lfw::controller::BaseController& ctrl) override {
    push("h:stay=" + std::to_string(ctrl_id_of(&ctrl)));
  }
  void ctrl_follow(lfw::controller::BaseController& ctrl, lfw::Entity& target) override {
    (void)target;
    push("h:follow=" + std::to_string(ctrl_id_of(&ctrl)));
  }
  bool ctrl_goingto(const lfw::controller::BaseController& ctrl) const override {
    return ctrl_kind_of(&ctrl) == "bot";
  }
  void warn(const std::u16string& text) override { push("h:warn=" + esc(text)); }

  std::vector<std::string> cheat_set;
};

FakeLfw g_lfw;

FakeUi::FakeUi(int index, bool disabled)
    : lfw::ui::UINode(g_lfw, lfw::Value()), _index(index), _disabled(disabled) {}

// ---------------------------------------------------------------- 摘要

std::string list_of(const std::vector<lfw::Entity*>& list) {
  if (list.empty()) return "-";
  std::string out;
  for (const lfw::Entity* const e : list) {
    if (!out.empty()) out += ",";
    out += e != nullptr ? to_ascii(e->id) : std::string("z");
  }
  return out;
}

std::string terr(const lfw::ITerrainInfo& t) {
  return esc(t.id) + "," + esc(t.name) + "," + num(t.type) + "," + num(t.x1) + "," + num(t.x2) +
         "," + num(t.z1) + "," + num(t.z2) + "," + num(t.h1) + "," + num(t.h2);
}

std::string dump_entity(const lfw::Entity& e) {
  return to_ascii(e.id) + ":" + esc(e.team()) + ":" + num(e.hp()) + ":" +
         vstr(lfw::field_or(e.frame, u"id")) + ":" + flag(lfw::truthy(Value(e.ghosted()))) + ":" +
         flag(e.puppet) + ":" + num(e.position.x) + ":" + num(e.position.y) + ":" +
         num(e.position.z) + ":" + vstr(e.state()) + ":" + num(e.aabb_min_x) + ":" +
         // 碰撞那一刀（4L）要的观测量：硬直 / 抖动、抓与被抓、持有、vrest 与两张碰撞表。
         num(e.motionless) + ":" + num(e.shaking) + ":" + id_ref(e.catching) + ":" +
         id_ref(e.catcher) + ":" + id_ref(e.holding) + ":" +
         num(static_cast<double>(e.vrests.size())) + ":" +
         num(static_cast<double>(e.collided_list.size())) + ":" +
         num(static_cast<double>(e.collision_list.size())) + ":" + num(e.resting()) + ":" +
         num(e.fall_value()) + ":" + flag(e.is_on_ground) + ":" + num(e.arest()) + ":" +
         // 4P：`Whirlwind` / `weapon_is_hit` / `ball_*` / `handle_injury` 的效果都落在速度上
         // （位置要等下一帧才动）⇒ 把速度也当观测量。
         num(e.velocity.x) + ":" + num(e.velocity.y) + ":" + num(e.velocity.z) + ":" +
         num(e.prev_velocity.x) + ":" + num(e.prev_velocity.y) + ":" + num(e.prev_velocity.z);
}

std::string join_ids(const std::vector<lfw::Entity*>& list) { return list_of(list); }

void dump() {
  World& w = *g_world;
  std::string map_ids;
  for (const std::pair<std::u16string, lfw::Entity*>& kv : w.entity_map) {
    if (!map_ids.empty()) map_ids += ",";
    map_ids += to_ascii(kv.first);
  }
  std::string pups;
  for (const std::pair<std::u16string, lfw::Entity*>& kv : w.puppets) {
    if (!pups.empty()) pups += ",";
    pups += to_ascii(kv.first) + ":" + (kv.second != nullptr ? to_ascii(kv.second->id) : std::string("z"));
  }
  std::string pts;
  for (const std::u16string& t : w.puppet_teams) {
    if (!pts.empty()) pts += ",";
    pts += to_ascii(t);
  }
  std::string talive;
  for (const std::pair<std::u16string, double>& kv : w.team_alive_counts()) {
    if (!talive.empty()) talive += ",";
    talive += to_ascii(kv.first) + ":" + num(kv.second);
  }
  std::string counts;
  for (const std::pair<std::u16string, double>& kv : w.counts()) {
    if (!counts.empty()) counts += ",";
    counts += esc(kv.first) + ":" + num(kv.second);
  }
  std::string gwc;
  for (const std::pair<double, double>& kv : w.ground_weapon_counts) {
    if (!gwc.empty()) gwc += ",";
    gwc += num(kv.first) + ":" + num(kv.second);
  }
  std::string ents;
  for (const lfw::Entity* const e : w.entities) {
    if (e == nullptr) continue;
    if (!ents.empty()) ents += ";";
    ents += dump_entity(*e);
  }
  std::string ghosts;
  for (const lfw::Entity* const e : w.ghosts) {
    if (e == nullptr) continue;
    if (!ghosts.empty()) ghosts += ";";
    ghosts += dump_entity(*e);
  }
  push("dump|bg=" + vstr(Value(w.bg()->id())) + "|st=" + vstr(Value(w.stage()->id())) +
       "|z=" + num(w.transform.scale_x()) + "," + num(w.transform.scale_y()) + "," +
       num(w.transform.scale_z()) +
       "|cam=" + num(w.camera().position.x) + "," + num(w.camera().position.y) +
       "|n=" + std::to_string(w.entities.size()) + "|g=" + std::to_string(w.ghosts.size()) +
       "|map=" + (map_ids.empty() ? std::string("-") : map_ids) +
       "|pup=" + (pups.empty() ? std::string("-") : pups) +
       "|pt=" + (pts.empty() ? std::string("-") : pts) +
       "|col=" + std::to_string(w.collisions.size()) +
       "|talive=" + (talive.empty() ? std::string("-") : talive) +
       "|alive=" + std::to_string(w.alive_players_size()) + "|hpa=" + flag(w.has_players_alive) +
       "|paused=" + num(w.paused_value()) + "|fn=" + num(w.fn_locked_value()) +
       "|sleep=" + flag(w.sleeping()) + "|needf=" + flag(w.need_fps()) +
       "|needu=" + flag(w.need_ups()) + "|life=" + num(w.lifetime()) +
       "|time=" + num(w.game_time()) + "|TU=" + num(w.TU) + "|es=" + num(w.extra_steps) +
       "|rc=" + num(w.render_cost) + "|pc=" + num(w.pairs_compared) + "|fps=" + num(w.fps().value()) +
       "|ticker=" + flag(w.ticker() != nullptr) + "|worker=" + handle_str(w.render_worker_id()) +
       "|cmds=" + std::to_string(g_lfw.cmds.size()) +
       "|bc=" + std::to_string(g_lfw.broadcasts.size()) +
       "|cnt=" + (counts.empty() ? std::string("-") : counts) +
       "|gwc=" + (gwc.empty() ? std::string("-") : gwc) +
       "|ents=" + (ents.empty() ? std::string("-") : ents) +
       "|ghosts=" + (ghosts.empty() ? std::string("-") : ghosts) +
       "|bd=" + num(w.player_l()) + "," + num(w.player_r()) + "," + num(w.left()) + "," +
       num(w.right()) + "," + num(w.near_plane()) + "," + num(w.far_plane()) + "," +
       num(w.width()) + "," + num(w.depth()) + "," + num(w.middle().x) + "," + num(w.middle().z) +
       "|lim=" + flag(w.stage_limit()) + "|wp=" + flag(w.world_pause()) +
       "|sf=" + flag(w.is_stage_finish()) + "|cf=" + flag(w.is_chapter_finish()) +
       "|spt=" + num(w.stage()->phase_time) + "|sft=" + num(w.stage()->time()) +
       "|bgu=" + num(w.bg()->update_times()));
}

double number_arg(const std::vector<std::string>& t, size_t& i, const std::string& op, int lineno) {
  const Value v = parse_value(t, i);
  const double* const d = std::get_if<double>(&v);
  if (d == nullptr) {
    std::fprintf(stderr, "%s expects a number literal at line %d\n", op.c_str(), lineno);
    std::exit(2);
  }
  return *d;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_world.exe <case-file>\n");
    return 2;
  }
  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open %s\n", argv[1]);
    return 2;
  }

  lfw::set_clock(&g_clock);
  lfw::set_timeout(&g_timeout);
  lfw::set_render_scheduler(&g_render_sched);
  // `Ditto.warn(where, text)` 的两参形式（`Stage` 的那一处）。
  lfw::stage::Stage::set_warn([](const std::u16string& where, const std::u16string& text) {
    push("warn:" + to_ascii(where) + ":" + to_ascii(text));
  });

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "wnew") {
      g_world = std::make_unique<World>(g_lfw, g_renderer, &g_states);
      push("new|bg=" + vstr(Value(g_world->bg()->id())) +
           "|st=" + vstr(Value(g_world->stage()->id())) + "|r=1");
    } else if (op == "wdump") {
      dump();
      // 返回类型
    } else if (op == "wds") {
      const std::u16string key = trace::key_of(t[i++]);
      g_world->dataset.set(key, parse_value(t, i));
    } else if (op == "wdsdump") {
      push("ds|" + vstr(g_world->dataset.dump_dataset()));
    } else if (op == "wbgdata") {
      g_lfw.bg_datas.push_back(parse_value(t, i));
    } else if (op == "wstagedata") {
      g_lfw.stage_datas.push_back(parse_value(t, i));
    } else if (op == "wrandbg") {
      g_lfw.randbg_script.clear();
      g_lfw.randbg_cursor = 0;
      while (i < t.size()) g_lfw.randbg_script.push_back(parse_value(t, i));
    } else if (op == "wdatas") {
      const std::u16string oid = trace::key_of(t[i++]);
      const Value v = parse_value(t, i);
      g_lfw.datas.emplace_back(oid, v);
    } else if (op == "wplayer") {
      const std::u16string id = trace::key_of(t[i++]);
      auto p = std::make_unique<lfw::PlayerInfo>(&g_player_host, id, Value(), Value(), Value());
      lfw::PlayerInfo* raw_p = p.get();
      g_players.push_back(std::move(p));
      g_player_map.emplace_back(to_ascii(id), raw_p);
    } else if (op == "wplayerfighter") {
      lfw::PlayerInfo* const p = player_of(to_ascii(trace::key_of(t[i++])));
      const lfw::Entity* const f = p != nullptr ? p->fighter() : nullptr;
      push(std::string("pfighter|") + (f != nullptr ? to_ascii(f->id) : std::string("-")));
    } else if (op == "wcheat") {
      const std::string name = to_ascii(trace::key_of(t[i++]));
      const bool on = t[i++] == "1";
      std::vector<std::string> next;
      for (const std::string& n : g_lfw.cheat_set) {
        if (n != name) next.push_back(n);
      }
      if (on) next.push_back(name);
      g_lfw.cheat_set = next;
    } else if (op == "wmtseed") {
      g_lfw.mt_value.reset(number_arg(t, i, op, lineno));
    } else if (op == "wlayer") {
      const int index = static_cast<int>(g_uis.size());
      g_uis.push_back(std::make_unique<FakeUi>(index, t[i++] == "1"));
    } else if (op == "wcmds") {
      g_lfw.cmds_has = t[i++] == "1";
      g_lfw.cmds = g_lfw.cmds_has ? std::vector<std::string>{"__probe__"}
                                  : std::vector<std::string>();
    } else if (op == "wbcpush") {
      g_lfw.broadcasts.push_back(Value(to_u16(t[i++])));
      push("bcpush=" + std::to_string(g_lfw.broadcasts.size()));
    } else if (op == "wbg") {
      g_world->change_bg(parse_value(t, i));
    } else if (op == "wstage") {
      g_world->change_stage(parse_value(t, i));
    } else if (op == "wmk") {
      const std::string label = t[i++];
      auto e = std::make_unique<lfw::Entity>(*g_world, parse_value(t, i), &g_states);
      lfw::Entity* const raw_e = e.get();
      g_entities.push_back(std::move(e));
      g_labels.push_back(label);
      push("mk|" + label + "|id=" + to_ascii(raw_e->id));
    } else if (op == "wadd") {
      const std::string label = t[i++];
      auto e = std::make_unique<lfw::Entity>(*g_world, parse_value(t, i), &g_states);
      lfw::Entity* const raw_e = e.get();
      g_entities.push_back(std::move(e));
      g_labels.push_back(label);
      g_world->add_entities(*raw_e);
      push("add|" + label + "|id=" + to_ascii(raw_e->id));
    } else if (op == "wreadd") {
      lfw::Entity* const e = ent_of(t[i++]);
      g_world->add_entities(*e);
      push("readd|" + to_ascii(e->id));
    } else if (op == "wgeom") {
      // 切片 4CE：碰撞视图退役 ⇒ 帧几何直接在实体面上读。
      const std::string label = t[i++];
      lfw::Entity* const e = ent_of(label);
      push("geom|" + label + "|cy=" + num(e->frame_centery()) + "|ht=" + num(e->frame_height()) +
           "|ph=" + num(e->frame_pic_h()));
    } else if (op == "wattach") {
      // `Entity::attach`（`Buff::show_effect` 的 `effect.attach(true)` 同路）。
      const std::string label = t[i++];
      const bool on = t[i++] == "1";
      lfw::Entity* const e = ent_of(label);
      e->attach(Value(on));
      push("attach|" + label + "|mounted=" + num(e->mounted()) +
           "|n=" + num(static_cast<double>(g_world->entities.size())) +
           "|g=" + num(static_cast<double>(g_world->ghosts.size())));
    } else if (op == "went") {
      lfw::Entity* const e = ent_of(t[i++]);
      const std::string field = t[i++];
      if (field == "hp") e->set_hp(number_arg(t, i, op, lineno));
      else if (field == "hpr") e->set_hp_r(number_arg(t, i, op, lineno));
      else if (field == "team") e->set_team(trace::key_of(t[i++]));
      else if (field == "puppet") e->puppet = t[i++] == "1";
      else if (field == "ghosted") e->set_ghosted(t[i++] == "1" ? 1.0 : 0.0);
      else if (field == "facing") e->facing = number_arg(t, i, op, lineno);
      else if (field == "pos") {
        const double x = number_arg(t, i, op, lineno);
        const double y = number_arg(t, i, op, lineno);
        const double z = number_arg(t, i, op, lineno);
        e->position.set(x, y, z);
      } else if (field == "ctrl") e->set_ctrl(make_ctrl(t[i++]));
      else if (field == "pid") {
        lfw::controller::BaseController* const c = e->ctrl();
        if (c != nullptr) c->player_id = trace::key_of(t[i++]);
      } else if (field == "mine") {
        lfw::controller::BaseController* const c = e->ctrl();
        const bool m = t[i++] == "1";
        if (c != nullptr) {
          if (std::shared_ptr<lfw::Object>* const obj =
                  std::get_if<std::shared_ptr<lfw::Object>>(&c->player)) {
            if (*obj) (*obj)->set(u"mine", Value(m));
          }
        }
      }
      else if (field == "frame") e->set_frame(parse_value(t, i));
      else if (field == "gone") e->set_frame(lfw::gone_frame_info());
      else if (field == "ground") e->is_on_ground = t[i++] == "1";
      else if (field == "llen") e->l_len = number_arg(t, i, op, lineno);
      else if (field == "rlen") e->r_len = number_arg(t, i, op, lineno);
      else if (field == "bearer") {
        const std::string tok = t[i++];
        e->bearer = tok == "none" ? nullptr : ent_of(tok);
      } else if (field == "catcher") {
        const std::string tok = t[i++];
        e->catcher = tok == "none" ? nullptr : ent_of(tok);
      } else {
        std::fprintf(stderr, "unknown entity field '%s' at line %d\n", field.c_str(), lineno);
        return 2;
      }
      push("ent|" + to_ascii(e->id) + "|" + field);
    } else if (op == "wentump") {
      // 实体被 `_gones` 清运（从 `entities` 摘掉）之后仍然要看得到它的字段
      lfw::Entity* const e = ent_of(t[i++]);
      push("entdump|" + to_ascii(e->id) + "|" + dump_entity(*e));
    } else if (op == "wteamsame") {
      lfw::Entity* const e = ent_of(t[i++]);
      e->set_team(vstr_string(g_world->stage()->team()));
      push("teamsame|" + to_ascii(e->id) + "|" + esc(e->team()));
    } else if (op == "wpred") {
      g_preds.clear();
      while (i < t.size()) g_preds.push_back(t[i++] == "1");
    } else if (op == "wlist") {
      const std::string name = t[i++];
      size_t cursor = 0;
      const std::vector<lfw::Entity*>& r1 = g_world->list_entities(
          to_u16(name), [&cursor](lfw::Entity& o) {
            const bool v = cursor < g_preds.size() ? g_preds[cursor++] : false;
            push("p:" + to_ascii(o.id) + "=" + flag(v));
            return v;
          });
      const std::vector<lfw::Entity*>& r2 = g_world->list_entities(
          to_u16(name), [](lfw::Entity& o) {
            push("q:" + to_ascii(o.id));
            return true;
          });
      // `list_entities` 会往 `_entities_map` 里插新键 ⇒ 第二次拿到的引用的那份 vector
      // 在第一次调用之后不会再变，直接读即可。
      push("list|" + esc(to_u16(name)) + "|r1=" + list_of(r1) + "|r2=" + list_of(r2));
    } else if (op == "wdel") {
      lfw::Entity* const e = ent_of(t[i++]);
      g_world->del_entity(*e);
      push("del|" + to_ascii(e->id));
    } else if (op == "wdels") {
      std::vector<lfw::Entity*> list;
      while (i < t.size()) list.push_back(ent_of(t[i++]));
      g_world->del_entities(list);
      push("dels|" + std::to_string(list.size()));
    } else if (op == "wteam") {
      const std::string what = t[i++];
      const std::u16string team = trace::key_of(t[i++]);
      if (what == "come") {
        const double x = number_arg(t, i, op, lineno);
        const double y = number_arg(t, i, op, lineno);
        const double z = number_arg(t, i, op, lineno);
        g_world->team_come(team, x, y, z);
      } else if (what == "move") g_world->team_move(team);
      else if (what == "stay") g_world->team_stay(team);
      else if (what == "follow") g_world->team_follow(*ent_of(t[i++]));
      else {
        std::fprintf(stderr, "bad team op '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      push("team|" + what + "|" + esc(team));
    } else if (op == "wmark") {
      lfw::Entity* const e = ent_of(t[i++]);
      const bool alive = t[i++] == "1";
      g_world->mark_players_alive(*e, alive);
      push("mark|" + to_ascii(e->id) + "|" + flag(alive) + "|" + flag(g_world->has_players_alive) +
           "|" + std::to_string(g_world->alive_players_size()));
    } else if (op == "wgame") {
      const bool refresh = t[i++] == "1";
      const std::u16string r = g_world->game_result(refresh);
      std::string talive;
      for (const std::pair<std::u16string, double>& kv : g_world->team_alive_counts()) {
        if (!talive.empty()) talive += ",";
        talive += esc(kv.first) + ":" + num(kv.second);
      }
      std::string pts;
      for (const std::u16string& s : g_world->puppet_teams) {
        if (!pts.empty()) pts += ",";
        pts += to_ascii(s);
      }
      push("game=" + (r.empty() ? std::string("-") : esc(r)) +
           "|talive=" + (talive.empty() ? std::string("-") : talive) +
           "|pt=" + (pts.empty() ? std::string("-") : pts));
    } else if (op == "wcount") {
      const std::u16string key = trace::key_of(t[i++]);
      g_world->add_count(key, number_arg(t, i, op, lineno));
    } else if (op == "wcountsdump") {
      std::string out;
      for (const std::pair<std::u16string, double>& kv : g_world->counts()) {
        if (!out.empty()) out += ",";
        out += esc(kv.first) + ":" + num(kv.second);
      }
      push("counts|" + (out.empty() ? std::string("-") : out));
    } else if (op == "wclockset") {
      g_clock.ms = number_arg(t, i, op, lineno);
      push("clock=" + num(g_clock.ms));
    } else if (op == "wtick") {
      g_clock.tick(number_arg(t, i, op, lineno));
    } else if (op == "wrender") {
      g_world->render_once(number_arg(t, i, op, lineno));
      push("rc=" + num(g_world->render_cost));
    } else if (op == "wcam") {
      g_world->update_camera();
    } else if (op == "wcamdest") {
      g_world->camera().destination.x = number_arg(t, i, op, lineno);
      g_world->camera().destination.y = number_arg(t, i, op, lineno);
      push("camdest=" + num(g_world->camera().destination.x) + "," +
           num(g_world->camera().destination.y));
    } else if (op == "wcamt") {
      push("camt=" + num(g_world->camera().destination.x) + "," +
           num(g_world->camera().destination.y));
    } else if (op == "wtrscaleto") {
      const double x = number_arg(t, i, op, lineno);
      const double y = number_arg(t, i, op, lineno);
      const double z = number_arg(t, i, op, lineno);
      const double rate = number_arg(t, i, op, lineno);
      g_world->transform.scale_to(x, y, z, rate);
      push("trscale=" + num(g_world->transform.scale_x()) + "," +
           num(g_world->transform.scale_y()) + "," + num(g_world->transform.scale_z()));
    } else if (op == "wui") {
      g_world->update_ui();
    } else if (op == "wpause") {
      g_world->set_paused_value(number_arg(t, i, op, lineno));
      push("paused=" + num(g_world->paused_value()));
    } else if (op == "wfnlock") {
      g_world->set_fn_locked_value(number_arg(t, i, op, lineno));
      push("fnlock=" + num(g_world->fn_locked_value()));
    } else if (op == "wsleep") {
      g_world->sleep();
      push("sleep=" + flag(g_world->sleeping()));
    } else if (op == "wawake") {
      g_world->awake();
      push("sleep=" + flag(g_world->sleeping()));
    } else if (op == "wstopupdate") {
      g_world->stop_update();
      push("ticker=" + flag(g_world->ticker() != nullptr));
    } else if (op == "wstep") {
      g_world->step();
    } else if (op == "wupdate") {
      g_world->update_once(number_arg(t, i, op, lineno));
    } else if (op == "wcatchup") {
      g_world->catch_up();
    } else if (op == "wrupdate") {
      g_world->start_update();
      push("ticker=" + flag(g_world->ticker() != nullptr));
    } else if (op == "wticker") {
      lfw::Ticker* const tk = g_world->ticker();
      if (tk == nullptr) {
        push("tk=-");
      } else {
        push("tk=" + flag(tk->running()) + ":" + flag(tk->pending()) + ":" + flag(tk->paused()) +
             ":" + num(tk->base()) + ":" + num(tk->span()) + ":" + num(tk->deadline()) + ":" +
             num(tk->last_step()) + ":" + num(tk->rate()) + ":" + num(tk->cost) + ":" +
             num(g_world->TU));
      }
    } else if (op == "whook") {
      const std::string which = t[i++];
      g_world->before_update = nullptr;
      g_world->after_update = nullptr;
      if (which != "none") {
        g_world->before_update = []() { push("h:before"); };
      }
      if (which == "sleep") {
        g_world->before_update = []() {
          push("h:before");
          g_world->sleep();
        };
      }
      if (which == "after" || which == "both") {
        g_world->after_update = []() { push("h:after"); };
      }
      if (which == "setsync") {
        g_world->before_update = []() {
          g_world->dataset.set(u"sync_render", Value(0.0));
          push("h:setsync");
        };
      }
      push("hook=" + which);
    } else if (op == "wextra") {
      g_world->extra_steps = number_arg(t, i, op, lineno);
      push("es=" + num(g_world->extra_steps));
    } else if (op == "wexbudget") {
      g_world->extra_step_budget_ms = number_arg(t, i, op, lineno);
      push("exbudget=" + num(g_world->extra_step_budget_ms));
    } else if (op == "wdev") {
      g_lfw.dev_flag = t[i++] == "1";
      push("dev=" + flag(g_lfw.dev_flag));
    } else if (op == "wneedfps") {
      g_world->set_need_fps(t[i++] == "1");
      push("needf=" + flag(g_world->need_fps()));
    } else if (op == "wneedups") {
      g_world->set_need_ups(t[i++] == "1");
      push("needu=" + flag(g_world->need_ups()));
    } else if (op == "wrstart") {
      g_world->start_render();
      push("worker=" + handle_str(g_world->render_worker_id()));
    } else if (op == "wrstop") {
      g_world->stop_render();
      push("worker=" + handle_str(g_world->render_worker_id()));
    } else if (op == "wbase") {
      push("base=" + num(g_world->base_step_ms()));
    } else if (op == "wfps") {
      const double f = g_world->fps_value();
      push(std::string("fps=") + (std::isnan(f) ? "u" : num(f)));
    } else if (op == "wbound") {
      lfw::Entity* const e = ent_of(t[i++]);
      const std::vector<double> r = g_world->get_bound(*e);
      push("bound|" + to_ascii(e->id) + "|" + num(r[0]) + "," + num(r[1]) + "," + num(r[2]) + "," +
           num(r[3]));
    } else if (op == "wrestrict") {
      lfw::Entity* const e = ent_of(t[i++]);
      const lfw::Vector3& r = g_world->restrict(*e);
      push("restrict|" + to_ascii(e->id) + "|" + num(r.x) + "," + num(r.y) + "," + num(r.z) +
           "|pos=" + num(e->position.x) + "," + num(e->position.y) + "," + num(e->position.z) +
           "|fid=" + vstr(lfw::field_or(e->frame, u"id")) +
           "|terr=" + terr(e->terrain));
    } else if (op == "wbounding") {
      lfw::Entity* const e = ent_of(t[i++]);
      const Value f = parse_value(t, i);
      const Value info = parse_value(t, i);
      const Value r = g_world->get_bounding(*e, f, info);
      push("bounding|" + to_ascii(e->id) + "|" + num(lfw::to_number(lfw::field_or(r, u"left"))) +
           "," + num(lfw::to_number(lfw::field_or(r, u"right"))) +
           "," + num(lfw::to_number(lfw::field_or(r, u"top"))) +
           "," + num(lfw::to_number(lfw::field_or(r, u"bottom"))) +
           "," + num(lfw::to_number(lfw::field_or(r, u"far"))) +
           "," + num(lfw::to_number(lfw::field_or(r, u"near"))));
    } else if (op == "wsection") {
      push("section=" + num(g_world->weapon_section_at(number_arg(t, i, op, lineno))));
    } else if (op == "wrandx") {
      const bool has = i < t.size();
      const double ex = has ? number_arg(t, i, op, lineno) : 0.0;
      push("randx=" + num(g_world->random_weapon_x(has ? std::optional<double>(ex) : std::nullopt)));
    } else if (op == "wcnt") {
      push("wcnt=" + num(g_world->weapon_count_at(number_arg(t, i, op, lineno))));
    } else if (op == "wgsadd") {
      const double section = number_arg(t, i, op, lineno);
      const double count = number_arg(t, i, op, lineno);
      bool replaced = false;
      for (std::pair<double, double>& kv : g_world->ground_weapon_counts) {
        if (kv.first == section) {
          kv.second = count;
          replaced = true;
          break;
        }
      }
      if (!replaced) g_world->ground_weapon_counts.emplace_back(section, count);
    } else if (op == "wgsdump") {
      std::string out;
      for (const std::pair<double, double>& kv : g_world->ground_weapon_counts) {
        if (!out.empty()) out += ",";
        out += num(kv.first) + ":" + num(kv.second);
      }
      push("gwc|" + (out.empty() ? std::string("-") : out));
    } else if (op == "wspark" || op == "wetc") {
      const double x = number_arg(t, i, op, lineno);
      const double y = number_arg(t, i, op, lineno);
      const double z = number_arg(t, i, op, lineno);
      const std::u16string f = vstr_string(parse_value(t, i));
      const size_t before = g_created.size();
      if (op == "wspark") g_world->spark(x, y, z, f);
      else g_world->etc(x, y, z, f);
      if (g_created.size() > before) {
        lfw::Entity& e = *g_created.back();
        if (op == "wspark") {
          push("spark|" + to_ascii(e.id) + "|" + num(e.outline_alpha()) + "," +
               num(e.outline_width()) + "," + esc(e.outline_color()) +
               "|pos=" + num(e.position.x) + "," + num(e.position.y) + "," + num(e.position.z) +
               "|fid=" + vstr(lfw::field_or(e.frame, u"id")) + "|ghosted=" +
               flag(lfw::truthy(Value(e.ghosted()))));
        } else {
          push("etc|" + to_ascii(e.id) + "|pos=" + num(e.position.x) + "," + num(e.position.y) +
               "," + num(e.position.z) + "|fid=" + vstr(lfw::field_or(e.frame, u"id")));
        }
      } else {
        push(op == "wspark" ? "spark|none" : "etc|none");
      }
    } else if (op == "wfill") {
      const double n = number_arg(t, i, op, lineno);
      g_world->ghosts.clear();
      for (double k = 0; k < n; k += 1.0) g_world->ghosts.push_back(nullptr);
      push("fill=" + std::to_string(g_world->ghosts.size()));
    } else if (op == "wbulk") {
      // 只为把 `entities` 撑过 `MAX_DEBUG_ENTITIES`（356）⇒ 造 n 个同数据的真实体，不记日志。
      const double n = number_arg(t, i, op, lineno);
      for (double k = 0; k < n; k += 1.0) {
        auto e = std::make_unique<lfw::Entity>(*g_world, bulk_data(), &g_states);
        lfw::Entity* const raw = e.get();
        g_entities.push_back(std::move(e));
        g_labels.push_back(std::string("bulk"));
        raw->set_ctrl(make_ctrl("base"));
        g_world->add_entities(*raw);
      }
      push("bulk=" + std::to_string(g_world->entities.size()));
    } else if (op == "wcol") {
      const std::u16string id = trace::key_of(t[i++]);
      const std::u16string aid = trace::key_of(t[i++]);
      const std::u16string vid = trace::key_of(t[i++]);
      const double dist = number_arg(t, i, op, lineno);
      lfw::collision::Collision c;
      c.id = id;
      c.aid = aid;
      c.vid = vid;
      c.m_distance = dist;
      g_world->add_collision(c);
      push("col|" + esc(id));
    } else if (op == "wcolsdump") {
      std::string out;
      for (const std::pair<std::u16string, lfw::collision::Collision>& kv : g_world->collisions) {
        if (!out.empty()) out += ",";
        out += esc(kv.first) + ":" + esc(kv.second.aid) + ":" + esc(kv.second.vid) + ":" +
               num(kv.second.m_distance);
      }
      push("cols|" + (out.empty() ? std::string("-") : out));
    } else if (op == "wcolq") {
      const std::u16string aid = trace::key_of(t[i++]);
      const std::u16string vid = trace::key_of(t[i++]);
      const std::optional<lfw::collision::Collision> c = g_world->get_collision(aid, vid);
      const std::vector<lfw::collision::Collision> all = g_world->get_collisions(aid, vid);
      std::string ids;
      for (const lfw::collision::Collision& x : all) {
        if (!ids.empty()) ids += ",";
        ids += esc(x.id);
      }
      push("colq|" + esc(aid) + "," + esc(vid) +
           "|one=" + (c.has_value() ? esc(c->id) + ":" + num(c->m_distance) : std::string("-")) +
           "|has=" + flag(g_world->has_collision(aid, vid)) +
           "|all=" + (ids.empty() ? std::string("-") : ids));
    } else if (op == "wfind") {
      lfw::Entity* const e = g_world->find_entity(trace::key_of(t[i++]));
      push(std::string("find=") + (e != nullptr ? to_ascii(e->id) : std::string("-")));
    } else if (op == "whandle") {
      g_world->handle_cmds();
    } else if (op == "wserr") {
      const double n = number_arg(t, i, op, lineno);
      const bool errs = t[i++] == "1";
      for (double k = 0; k < n; k += 1.0) g_world->on_step_error(u"boom", errs);
      push("serr|n=" + num(n) + "|errs=" + flag(errs) + "|count=" +
           num(g_world->step_error_count()) + "|ticker=" + flag(g_world->ticker() != nullptr));
    } else if (op == "wcb") {
      const std::string name = t[i++];
      if (name == "on_stage_change") {
        g_world->callbacks.on(u"on_stage_change",
                              [](const lfw::WorldCallbacks::Payloads& a) {
                                const lfw::Stage* const s = a[0].stage;
                                const lfw::Stage* const p = a[0].prev_stage;
                                push("cb:on_stage_change=" +
                                     (s != nullptr ? vstr(Value(s->id())) : std::string("u")) + "," +
                                     (p != nullptr ? vstr(Value(p->id())) : std::string("u")));
                              });
      } else if (name == "on_cam_move") {
        g_world->callbacks.on(u"on_cam_move", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_cam_move=" + num(a[0].num) + "," + num(a[0].num2));
        });
      } else if (name == "on_pause_change") {
        g_world->callbacks.on(u"on_pause_change", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_pause_change=" + flag(a[0].flag));
        });
      } else if (name == "on_fn_locked_change") {
        g_world->callbacks.on(u"on_fn_locked_change", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_fn_locked_change=" + num(a[0].num));
        });
      } else if (name == "on_fps_update") {
        g_world->callbacks.on(u"on_fps_update", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_fps_update=" + num(a[0].num));
        });
      } else if (name == "on_fighter_add") {
        g_world->callbacks.on(u"on_fighter_add", [](const lfw::WorldCallbacks::Payloads& a) {
          lfw::Entity* const e = a[0].entity;
          push(std::string("cb:on_fighter_add=") + (e != nullptr ? to_ascii(e->id) : std::string("z")));
        });
      } else if (name == "on_puppet_add") {
        g_world->callbacks.on(u"on_puppet_add", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_puppet_add=" + vstr(Value(a[0].key)));
        });
      } else if (name == "on_dataset_change") {
        g_world->callbacks.on(u"on_dataset_change", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_dataset_change=" + esc(a[0].key) + ":" + vstr(a[0].value) + ":" +
               vstr(a[0].prev));
        });
      } else if (name == "on_counts") {
        g_world->callbacks.on(u"on_counts",
                              [](const lfw::WorldCallbacks::Payloads&) { push("cb:on_counts"); });
      } else if (name == "on_ups_update") {
        g_world->callbacks.on(u"on_ups_update", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_ups_update=" + num(a[0].num) + ":" + num(a[0].num2) + ":" +
               num(a[0].num3));
        });
      } else if (name == "on_fighter_del") {
        g_world->callbacks.on(u"on_fighter_del", [](const lfw::WorldCallbacks::Payloads& a) {
          lfw::Entity* const e = a[0].entity;
          push(std::string("cb:on_fighter_del=") + (e != nullptr ? to_ascii(e->id) : std::string("z")));
        });
      } else if (name == "on_puppet_del") {
        g_world->callbacks.on(u"on_puppet_del", [](const lfw::WorldCallbacks::Payloads& a) {
          push("cb:on_puppet_del=" + vstr(Value(a[0].key)));
        });
      } else if (name == "on_disposed") {
        g_world->callbacks.on(u"on_disposed",
                              [](const lfw::WorldCallbacks::Payloads&) { push("cb:on_disposed"); });
      } else {
        std::fprintf(stderr, "unknown callback '%s' at line %d\n", name.c_str(), lineno);
        return 2;
      }
    } else if (op == "wclear") {
      g_world->clear();
      push("clear|fn=" + num(g_world->fn_locked_value()) + "|cnt=" +
           std::to_string(g_world->counts().size()));
    } else if (op == "wdispose") {
      g_world->dispose();
      push("dispose");
    } else if (op == "wreset") {
      g_world->reset_game_time();
      push("time=" + num(g_world->game_time()));
    } else {
      std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
      return 2;
    }

    if (i != t.size()) {
      std::fprintf(stderr, "trailing token(s) at line %d: %s\n", lineno, raw.c_str());
      return 2;
    }
    for (const std::string& l : g_log) std::printf("%s\n", l.c_str());
    g_log.clear();
  }
  return 0;
}
