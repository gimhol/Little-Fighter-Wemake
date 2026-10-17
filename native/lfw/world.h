#pragma once

#include <cstddef>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/base/fps.h"
#include "lfw/base/no_emit_callbacks.h"
#include "lfw/bg/background.h"
#include "lfw/buff/buff.h"
#include "lfw/camera.h"
#include "lfw/collision/collision.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/i_vector3.h"
#include "lfw/entity/entity.h"
#include "lfw/ground.h"
#include "lfw/player_info.h"
#include "lfw/stage/stage.h"
#include "lfw/transform.h"
#include "lfw/utils/container_help/nested_multi_map.h"
#include "lfw/utils/times.h"
#include "lfw/world_dataset.h"

namespace lfw {

class LFW;

class ITickerOptions;
class Ticker;
class World;
class WorldCollisionHost;

// `Stage` 在 `lfw::stage` 里（TS 的 `stage/Stage.ts`），本文件里用得最多，起个本地别名。
using stage::Stage;

// `Callbacks<IWorldCallbacks>` 的端口替身：TS 每个回调的参数都塞进这个包（`on_cam_move` 两个
// 数、`on_stage_change` 两个 `Stage`、`on_fighter_*` 一个 `Entity`、`on_dataset_change` 一个键
// 加两个值、`on_ups_update` 三个数）。`world` 一律是「触发这次回调的 World」。
struct WorldCallbackArgs {
  World* world = nullptr;
  Entity* entity = nullptr;
  Stage* stage = nullptr;
  Stage* prev_stage = nullptr;
  Value value = Value(NullTag{});
  Value prev = Value(NullTag{});
  std::u16string key;
  double num = 0.0;
  double num2 = 0.0;
  double num3 = 0.0;
  bool flag = false;
};
using WorldCallbacks = CallbacksT<WorldCallbackArgs>;

// `this.renderer`（TS `Ditto.WorldRender`）：渲染未移植 ⇒ 宿主给这一面。
class IWorldRenderer {
 public:
  virtual ~IWorldRenderer() = default;
  virtual void add_entity(Entity& e) = 0;
  virtual void del_entity(Entity& e) = 0;
  virtual void render(double dt) = 0;
  virtual void dispose() = 0;
};

// TS `World.ts`：世界（实体表 / 边界 / 相机 / 场景 / 计分）。
//
// 两处宿主面：`Entity` 侧自 4CJ 起直接读本类；`Stage` 侧自 4CR 起并入本类（原来那个
// `stage::IStageWorld` 窄缝与 `WorldStageView` 转发类都已删除）；`Camera` 侧的三条属性读
// （`world_stage` / `world_bg` / `world_dataset`）自 4CK-1 起也并进来了 —— 那几个名字与 TS 的
// 字段名不撞。
class World {
 public:
  static constexpr const char* TAG = "World";

  World(LFW& lfw, IWorldRenderer& renderer, state::States* states);
  // `virtual`：台面 `fx::TestWorld` / `FakeWorld` / `FakeStageWorld` 派生自本类，而 `LFW::world_`
  // 是 `unique_ptr<World>`（经基类指针删除）⇒ 非虚析构是 UB。
  virtual ~World();

  World(const World&) = delete;
  World& operator=(const World&) = delete;

  // ---- TS 的公开字段（`readonly`）----
  WorldDataset dataset;
  WorldCallbacks callbacks;
  std::vector<std::pair<std::u16string, buff::Buff*>> buffs;
  Ground ground;
  Transform transform;
  // `Map<string, Entity>` —— JS 的 `Map` 是**插入序**，覆盖同键时位置不变 ⇒ 端口用 vector。
  std::vector<std::pair<std::u16string, Entity*>> entity_map;
  std::vector<Entity*> entities;
  std::vector<Entity*> ghosts;
  std::vector<std::pair<std::u16string, Entity*>> puppets;
  // `Set<string>`（插入序 + 判重）。
  std::vector<std::u16string> puppet_teams;
  std::vector<std::pair<std::u16string, collision::Collision>> collisions;
  double pairs_compared = 0.0;
  double render_cost = 0.0;
  bool has_players_alive = false;
  double TU = 1.0;
  double extra_steps = 0.0;
  double extra_step_budget_ms = 16.0;
  std::vector<std::pair<double, double>> ground_weapon_counts;

  LFW& lfw() const { return *lfw_; }
  IWorldRenderer& renderer() const { return *renderer_; }
  Camera& camera() const { return *camera_; }
  // ---- `Stage` 要的 `world.*` 面（切片 4CR：`IStageWorld` 退役后并入本类）----
  // `world.entities` / `world.puppets`（切片 4CU / ck7：`IStageEntity` 退役 ⇒ 直接给真
  // `Entity*`）。`entity_list()` 就是那个真数组；`puppet_list()` 是 `puppets` 的投影缓存
  // （**每次读到同一份投影**：同一个 `vector` 对象、同样的顺序，与 TS 的「同一个数组」等价）。
  virtual std::vector<Entity*>& entity_list();
  virtual std::vector<Entity*>& puppet_list();
  // `world.dataset.difficulty`
  virtual Value difficulty() const { return dataset.get(u"difficulty"); }
  // `world.camera.jump_x(x)`
  virtual void camera_jump_x(const Value& x);

  // ---- TS 里 `Entity` 直接读的 `this.world.*` 面（切片 4CJ：`IEntityHost` 退役后并入本类）----
  // 这七条都是「台面脚本化」的面（旧缝时代的假宿主逐条覆写）⇒ 保持 `virtual` 供台面挂钩。
  // `world.bg.data.dataset?.[key]`
  virtual Value bg_dataset(const std::u16string& key) const;
  // `world.stage.player_l` / `player_r` / `far` / `near` / `id` / `team` /
  // `is_stage_finish` / `is_chapter_finish`
  virtual Value stage_value(const std::u16string& key) const;
  // `world.bg.width` / `.near` / `.far`
  virtual Value bg_value(const std::u16string& key) const;
  // `world.entities.length + world.ghosts.length`
  virtual double entity_count() const;
  // `world.puppets.values()`
  virtual std::vector<Entity*> puppets_values();
  // `opoint.__gen_x?.get(emitter)` 这类表达式字段：函数对象不移植（DESIGN §4.57），
  // 宿主按 `(holder, kind, emitter)` 回答；`nullopt` 表示没有该字段 ⇒ 调用方回落。
  virtual std::optional<Value> gen_field(const Value& holder, const std::u16string& kind,
                                        Entity& emitter);
  // `this.play_sound(...)`：TS 里 `Entity.play_sound` 收尾就调 `lfw.sounds.play`（数组展开也在
  // 这里）；端口把那次调用收成 `World::play_sound(sounds, pos)` 这一条缝 —— 缺省实现即
  // `lfw().sounds_play(...)`（宿主记录 `h:sound=` 的那个面），台面覆写它记 `play_sound:...@...`。
  virtual void play_sound(const Value& sounds, const Value& pos);
  state::States* states() const { return states_; }
  // 碰撞那一刀的宿主（`World::step` 的配对 / `collisions_keeper.handle` 都要它）。
  // 首次用到时才建：它会把 12 个 Env 装到 `collision/` 层的全局缝上（同一时刻只应有一个
  // 活的 World 在用 —— 差分台面一次只跑一个用例，见 DESIGN §78.5）。
  WorldCollisionHost& collision_host();

  // ---- `get bg` / `set bg`：换背景时顺带把缩放交给 transform，并 dispose 旧的 ----
  virtual Background* bg() const { return bg_.get(); }
  virtual void set_bg(std::unique_ptr<Background> v);
  // ---- `get stage` / `set stage` ----
  virtual Stage* stage() const { return stage_.get(); }
  void set_stage(std::unique_ptr<Stage> v);

  // ---- `get player_l()` … `get middle()`：转发 `stage` ----
  double player_l() const;
  double player_r() const;
  double left() const;
  double right() const;
  double near_plane() const;
  double far_plane() const;
  double width() const;
  double depth() const;
  const Background::Middle& middle() const;

  bool paused() const { return paused_ == 1.0; }
  void set_paused(bool v);
  void set_paused_value(double v);
  bool fn_locked() const { return fn_locked_ == 1.0; }
  void set_fn_locked(bool v);
  void set_fn_locked_value(double v);
  const std::vector<std::pair<std::u16string, double>>& counts() const { return counts_; }
  // `world.game_time`（`attach` 写 `_spawn_time`）：台面会脚本化它 ⇒ `virtual`。
  virtual double game_time() const { return game_time_.value(); }
  double lifetime() const { return lifetime_; }
  // 差分台面用的只读探针（TS 里是私有字段）。
  double paused_value() const { return paused_; }
  double fn_locked_value() const { return fn_locked_; }
  bool sleeping() const { return sleeping_; }
  bool need_fps() const { return need_FPS_; }
  bool need_ups() const { return need_UPS_; }
  const FPS& fps() const { return fps_; }
  int render_worker_id() const { return render_worker_id_; }
  Ticker* ticker() const { return update_worker_.get(); }
  const std::vector<std::pair<std::u16string, double>>& team_alive_counts() const {
    return team_alive_counts_;
  }
  // `stage_limit` / `stage.world_pause` / `stage.is_stage_finish` …
  bool stage_limit() const;
  bool world_pause() const;
  bool is_stage_finish() const;
  bool is_chapter_finish() const;

  // ---- TS 里 `Camera.update()` 读的 `world.stage` / `world.bg` / `world.dataset` 三次属性读
  // （切片 4CK-1：`ICameraWorld` 退役后并入本类；`virtual` 供台面脚本化）----
  virtual Value world_stage();
  virtual Value world_bg();
  virtual Value world_dataset();
  // `CollisionCoreEnv::dataset` 用的同一份快照（`world.dataset`）。
  Value dataset_value() const;
  // `new Background(this, data)` 那一处要的 `World*`（`Background` 只前置声明了它）。
  World* world_ptr() { return this; }

  // ---- TS 的方法 ----
  void on_dataset_change(const std::u16string& key, const Value& curr, const Value& prev);  void team_come(const std::u16string& team, double x, double y, double z);
  void team_move(const std::u16string& team);
  void team_stay(const std::u16string& team);
  void team_follow(Entity& target);
  // `add_entities(...entities)`：TS 是变参，端口给单个（调用点都是单个）。
  virtual void add_entities(Entity& e);
  virtual const std::vector<Entity*>& list_entities(const std::u16string& name,
                                            const std::function<bool(Entity&)>& predicate);
  void del_entity(Entity& e);
  // 切片 4CU：`Stage::dispose` 要脚本化这一次删除 ⇒ 加 `virtual`（语义不变）。
  virtual void del_entities(const std::vector<Entity*>& list);
  double fps_value() const;
  void stop_render();
  void start_render();
  void stop_update();
  void sleep();
  void awake();
  double base_step_ms();
  // `on_step_error(e)`：`Ticker` 的 `on_step` 里 catch 到异常时调（端口由台面/宿主调）。
  void on_step_error(const std::u16string& message, bool has_errors);
  // ---- `step` / `update_once` / `catch_up` / `start_update` ----
  void step();
  void update_once(double dt);
  void catch_up();
  void start_update();
  // TS 的公开钩子字段（`this.before_update?.()` / `this.after_update?.()`）。
  std::function<void()> before_update;
  std::function<void()> after_update;
  // 这三条（含上面的 `add_entities` / `list_entities`）都是实体的宿主面 ⇒ 台面脚本化用 `virtual`。
  virtual std::vector<double> get_bound(Entity& e);
  virtual const Vector3& restrict(Entity& e);
  void update_ui();
  void change_bg(const Value& bg_id);
  void change_stage(const Value& stage_id);
  void handle_cmds();
  virtual void mark_players_alive(Entity& e, bool is_alive);
  void collect_dead_buff(buff::Buff& b);
  void add_collision(const collision::Collision& c);
  void render_once(double dt);
  // ---- UI 渲染面（DESIGN D4）：核心每帧对每层的 UI 根节点发一次渲染面调用
  // （TS `WorldRenderer.ts:236-239`）。渲染面在端口是空默认体 ⇒ 这两个数是「发了多少、
  // 其中多少没人画」的探针，宿主在统计行打印（`ignored_images` 同款）。
  long long ui_render_calls() const;
  long long ui_render_unhandled() const;
  void update_camera();
  void spark(double x, double y, double z, const std::u16string& f);
  void etc(double x, double y, double z, const std::u16string& f);
  Value get_bounding(Entity& e, const Value& frame, const Value& info);
  void dispose();
  void add_count(const std::u16string& key, double o);
  void clear();
  void reset_game_time();
  virtual Entity* find_entity(const std::u16string& id) const;
  std::optional<collision::Collision> get_collision(const std::u16string& aid,
                                                   const std::u16string& vid) const;
  bool has_collision(const std::u16string& aid, const std::u16string& vid) const;
  std::vector<collision::Collision> get_collisions(const std::u16string& aid,
                                                   const std::u16string& vid,
                                                   std::vector<collision::Collision> out = {}) const;
  double weapon_section_at(double x) const;
  double random_weapon_x(std::optional<double> exclude_section = std::nullopt);
  double weapon_count_at(double x) const;
  void calc_alives();
  std::u16string game_result(bool refresh);

  // `_gones` / `_alive_players` / `_paused` / … 的只读探针（台面读，TS 里是私有字段）。
  const std::vector<Entity*>& gones() const { return gones_; }
  size_t alive_players_size() const { return alive_players_.size(); }
  const std::vector<buff::Buff*>& dead_buffs() const { return dead_buffs_; }
  double step_error_count() const { return step_error_count_; }
  // TS 的 `this._step_error_count = 0`（`Ticker` 的 `on_step` 成功后复位）。
  void set_step_error_count(double v) { step_error_count_ = v; }

  // `step()` 那一半的挂点（台面写，TS 里是公开字段）。
  void set_need_fps(bool v) { need_FPS_ = v; }
  void set_need_ups(bool v) { need_UPS_ = v; }

 private:
  // `_disposers` 那类「插入序 + 判重」的小表（JS `Map` / `Set` 语义）。
  static Entity* map_get(const std::vector<std::pair<std::u16string, Entity*>>& m,
                         const std::u16string& key);
  static void map_set(std::vector<std::pair<std::u16string, Entity*>>& m, std::u16string key,
                      Entity* value);
  static bool vec_has(const std::vector<std::u16string>& v, const std::u16string& key);
  // `WorldRenderer.ts:187-204` 的帧内比例（`this.tu = world.TU` / `utime` / `dtime` /
  // `dfactor`，逐字照抄；`host/thin` 的录制器另有一份，喂它自己的 `E` 行）。
  double ui_render_dfactor(double dt);
  // `WorldRenderer.ts:236-239` 的每层一次 UI 渲染面调用（见 `world.cpp` 里的位置说明）。
  void render_ui_layers(double dt);

  LFW* lfw_ = nullptr;
  IWorldRenderer* renderer_ = nullptr;
  state::States* states_ = nullptr;
  std::unique_ptr<Background> bg_;
  // `Stage` 侧的实体投影缓存（切片 4CR：`IStageWorld` 退役后从 `WorldStageView` 搬进来）。
  // 存基类指针 ⇒ 不必把 `world.cpp` 内部的 `StageEntityView` 暴露到头文件。
  // `Stage` 读的 `puppets` 投影缓存（切片 4CU：投影元素变成真 `Entity*`，视图类已删）。
  std::vector<Entity*> puppet_list_;
  std::unique_ptr<Stage> stage_;
  std::unique_ptr<Camera> camera_;
  std::unique_ptr<WorldCollisionHost> collision_host_;
  bool sleeping_ = false;
  Value spark_data_ = Value(NullTag{});
  Value etc_data_ = Value(NullTag{});
  bool need_FPS_ = true;
  bool need_UPS_ = true;
  FPS fps_{0.9};
  double lifetime_ = 0.0;
  int render_worker_id_ = 0;
  // `start_render` 闭包里的 `prev_time` / `fix_radio`（每次调用重新开始）。
  double render_prev_time_ = 0.0;
  double render_fix_radio_ = 1.0;
  // UI 渲染面的帧内比例（`WorldRenderer.ts:187-204` 的 `utime` / `dtime` / `dfactor`；
  // `dirty` 只门控 TS 那对 `cam_p0/p1`，属宿主 ⇒ 这里不存）。见 `ui_render_dfactor`。
  double df_utime_ = 0.0;
  double df_dtime_ = 0.0;
  double df_dfactor_ = 1.0;
  std::unique_ptr<Ticker> update_worker_;
  // `new Ticker({step_ms, on_step})` 的那个 options 对象（`World` 持有，`Ticker` 借用）。
  std::unique_ptr<ITickerOptions> update_options_;
  std::map<std::u16string, std::vector<Entity*>> entities_map_;
  std::vector<buff::Buff*> dead_buffs_;
  Times game_time_;
  std::vector<std::pair<std::u16string, double>> counts_;
  std::vector<Entity*> gones_;
  double paused_ = 0.0;
  double fn_locked_ = 0.0;
  std::vector<std::pair<std::u16string, double>> team_alive_counts_;
  std::vector<Entity*> alive_players_;
  NestedMultiMap<std::u16string, std::u16string, collision::Collision> pair_collisions_;
  double step_error_count_ = 0.0;
  double step_error_time_ = 0.0;
  Vector3 restrict_result_;
  std::vector<double> bound_{0.0, 0.0, 0.0, 0.0};
};

}
