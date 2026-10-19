#pragma once

#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/base/no_emit_callbacks.h"
#include "lfw/collision/collision.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/i_terrain_info.h"
#include "lfw/defines/i_vector3.h"
#include "lfw/entity/drink_info.h"
#include "lfw/entity/enter_frame_result.h"
#include "lfw/utils/math/mersenne_twister.h"
#include "lfw/utils/times.h"

namespace lfw {

namespace buff {
class Buff;
}

namespace state {
class States;
class State_Base;
}

// The renderer slot TS keeps in `Entity.renderer`.
struct IEntityRenderer {
  virtual ~IEntityRenderer() = default;
  virtual void render(double dt, double dfactor) = 0;
};

// `this.world` / `this.lfw` 的落地类型（完整定义在 `world.h`；entity.h 不 include 它，
// 免得和 world.h → entity.h 形成环）。
class World;
class LFW;
class Entity;

// The inline `jumping` record TS keeps on every entity.
struct Jumping {
  double x = 0;
  double y = 0;
  double z = 0;
  double t = 0;
};

// Mirrors `src/LFW/entity/Entity.ts`.  Ported so far: construction / `reset`, the stat
// accessor & notification layer, the velocity / friction / gravity layer, the frame
// lookup & flag handling, the snapshot pair, the per-tick recovery layer, the
// marks / emitter / opoint helpers and the state wiring (`set_state` + `_state`).
// The collision entry points, the enter-frame chain, `update()` and everything that
// needs a real `World` arrive in later slices.
class Entity {
 public:
  static constexpr const char* TAG = "Entity";
  static constexpr double kMotionlessWaitTicks = 16;

  // TS 的 `constructor(world: World, ...)`：直接持真 `World`（`IEntityHost` 那层已退役，
  // 见 DESIGN §146）。
  Entity(World& world, Value data);
  Entity(World& world, Value data, state::States* states);
  // Out of line: `state::State_Base` is incomplete here.
  virtual ~Entity();

  Entity(const Entity&) = delete;
  Entity& operator=(const Entity&) = delete;

  // --- TS fields that are plain data -----------------------------------------
  std::u16string id;
  double wait = 0;
  double variant = 0;
  Value transforms = Value(NullTag{});
  double transform_index = 0;
  Vector3 prev_position;
  Vector3 position;
  Vector3 prev_velocity;
  Vector3 velocity;
  std::vector<std::u16string> emitters;
  std::unique_ptr<DrinkInfo> drink;
  std::vector<Entity*> fuse_bys;
  bool has_fuse_bys = false;
  // TS keeps this as an insertion-ordered `Set`; dedup happens on insert.
  std::vector<std::u16string> copies;
  std::optional<double> dismiss_time;
  Value dismiss_data = Value(NullTag{});
  double stat_bar = 0;
  double fallinjury = 0;
  double throwinjury = 0;
  double facing = 1;
  Value frame;
  Entity* catching = nullptr;
  Entity* catcher = nullptr;
  double aabb_min_x = 0;
  double aabb_max_x = 0;
  double aabb_min_z = 0;
  double aabb_max_z = 0;
  double l_len = 0;
  double r_len = 0;
  Entity* bearer = nullptr;
  Entity* holding = nullptr;
  double motionless = 0;
  double shaking = 0;
  bool bounced = false;
  // TS 里这三条声明成 `number`，但状态层用 `js_add` 累加（`"3" + 1 === "31"`），
  // 所以和 `hp`/`position` 一样保留 JS 的动态值——切片 4CF 的台面把这条差异翻了出来。
  Value lying_a_count = Value(0.0);
  Value lying_d_count = Value(0.0);
  Value lying_c_count = Value(0.0);
  bool drop_hurted = false;
  bool dropping = false;
  double name_visible = 0;
  double wakeup_invuln = 0;
  double dead_gone = 0;
  Value dead_join = Value(NullTag{});
  double ctrl_visible = 0;
  std::vector<std::pair<Value, double>> opoints;
  std::vector<collision::Collision> collision_list;
  std::vector<collision::Collision> collided_list;
  std::optional<collision::Collision> lastest_collided;
  bool is_on_ground = false;
  std::map<std::u16string, buff::Buff*> buffs;
  std::map<std::u16string, std::u16string> marks;
  IEntityRenderer* renderer = nullptr;
  bool puppet = false;
  Jumping jumping;
  ITerrainInfo terrain;
  Value armor = Value(NullTag{});
  Callbacks callbacks;
  std::map<std::u16string, collision::Collision> vrests;
  std::map<std::u16string, collision::Collision> blockers;
  std::map<std::u16string, collision::Collision> superpunchs;

  // --- lifecycle -------------------------------------------------------------
  void reset(Value data);
  void reset(Value data, state::States* states);
  // `set_state(state_code)`: look the code up in the registry, fall back to the
  // per-type `States.fallback` entry, then leave the old state and enter the new one.
  void set_state(const Value& state_code);
  // `this._state` — `null` until `set_state` runs (and again after every `reset`).
  state::State_Base* state_ptr() const { return _state; }

  // --- stat accessors (TS `get x` / `set x`) ---------------------------------
  double lifetime() const { return _lifetime; }
  double spawn_time() const { return _spawn_time; }
  double render_effect_time() const { return _render_effect_time; }
  std::u16string outline_color() const;
  virtual void set_outline_color(std::u16string v);
  // 切片 4CV（ck8）：`Item` 对 `outline_color` 的赋值在 TS 里是**属性写**（原值不强制成字符串），
  // 台面要按原值观测（旧缝的假实体就是在它上面打日志）⇒ 单开一条收 `Value` 的入口；
  // 默认实现与原来 `EntityItem` 适配器一字不差（`to_string` 强制）。
  virtual void set_outline_color_raw(const Value& v) { set_outline_color(to_string(v)); }
  double outline_alpha() const { return _outline_alpha; }
  virtual void set_outline_alpha(double v);
  double outline_width() const { return _outline_width; }
  virtual void set_outline_width(double v);
  Value outline_enabled() const;
  void set_outline_enabled(const Value& v);
  const std::u16string& mix_color() const { return _mix_color; }
  void set_mix_color(std::u16string v);
  double mix_strength() const { return _mix_strength; }
  void set_mix_strength(double v);
  double greyscale() const { return _greyscale; }
  void set_greyscale(double v);

  virtual double ground_y() const { return _ground_y; }
  virtual const Value& data() const { return _data; }
  std::u16string origin_data_id() const;
  virtual Value group() const;
  // 切片 4CU（ck7）：`virtual` 只为台面脚本化（`Stage::ce` 读它）。
  virtual double mounted() const { return _mounted; }
  double ghosted() const { return _ghosted; }
  void set_ghosted(double v) { _ghosted = v; }
  double reserve() const { return _reserve; }
  // 切片 4CF：`set_reserve` 在 `IStateEntity` 上本来是虚的，状态台面的假实体会覆写它。
  virtual void set_reserve(double v);
  double type() const;
  Value itr() const;
  Value bdy() const;

  double toughness_resting_max() const { return _toughness_resting_max; }
  void set_toughness_resting_max(double v);
  double resting_max() const;
  void set_resting_max(double v);
  virtual double resting() const { return _resting; }
  virtual void set_resting(double v);
  virtual double fall_value() const { return _fall_value; }
  virtual void set_fall_value(double v);
  virtual double toughness() const { return _toughness; }
  virtual void set_toughness(double v);
  virtual double toughness_max() const { return _toughness_max; }
  void set_toughness_max(double v);
  double toughness_resting() const { return _toughness_resting; }
  void set_toughness_resting(double v);
  virtual double catch_time_max() const;
  void set_catch_time_max(double v);
  virtual double fall_value_max() const;
  void set_fall_value_max(double v);
  virtual double defend_value() const { return _defend_value; }
  virtual void set_defend_value(double v);
  virtual double defend_value_max() const;
  void set_defend_value_max(double v);
  virtual double defend_ratio() const;
  void set_defend_ratio(double v);

  Value name() const;
  // 切片 4CV（ck8）：`IItemEntity` 退役 ⇒ 这三条收成虚函数（默认实现就是原来的写法，
  // 只为台面脚本化 —— 旧缝的假实体在它们上面打日志）。
  virtual void set_name(const Value& v);
  virtual void set_stat_bar(double v) { stat_bar = v; }
  virtual void set_dead_gone(double v) { dead_gone = v; }
  virtual double mp() const { return _mp; }
  virtual void set_mp(double v);
  virtual double hp_r() const { return _hp_r; }
  virtual void set_hp_r(double v);
  virtual double hp() const { return _hp; }
  virtual void set_hp(double v);
  virtual double mp_max() const;
  virtual void set_mp_max(double v);
  virtual double hp_max() const;
  virtual void set_hp_max(double v);
  virtual const std::u16string& team() const { return _team; }
  virtual void set_team(std::u16string v);
  virtual Value ctrl_view() const;
  const std::u16string* src_emitter() const;
  const std::u16string* emitter() const;
  double blinking() const { return _blinking; }
  void set_blinking(double v);
  double invisible() const { return _invisible; }
  virtual void set_invisible(double v);
  double invulnerable() const { return _invulnerable; }
  virtual void set_invulnerable(double v);
  Value bot_ignore() const;
  controller::BaseController* ctrl() const { return ctrl_; }
  // `e.ctrl` 的 `Value` 视图（`is_bot_ctrl(e.ctrl)` / `e.ctrl.player_id`）：TS 里控制器是
  // 对象，端口把它的读面投影成 `Value`（见 `ctrl_view_of`）。切片 4CU（ck7）：`IStageEntity`
  // 退役后由实体自己回答；`virtual` 只为台面脚本化（假实体直接给一个 `Value`）。
  void set_ctrl(controller::BaseController* v);
  // `this.world` / `this.lfw` 的取用口：`loader/get_val_from_entity` 这类自由函数要问
  // `lfw.is_cheat` / `world.lfw.survival_rank_available`。
  // TS 的 `this.world` / `this.lfw`（`lfw` 的定义在 entity.cpp：`World` 在此不完整）。
  World& world() const { return *world_; }
  LFW& lfw() const;
  void as_key_role(const Value& v);
  void auto_key_role();
  double gravity() const;
  double itr_motionless() const;
  virtual double arest() const { return _arest; }
  virtual void set_arest(double v);
  virtual double weight() const;
  virtual double base_type() const;
  virtual Value state() const;

  // --- 实体面（接口退役：原 `Entity` 的其余读面收进实体；此前由
  //     `EntityViewBase` 转发）---
  virtual double frame_centery() const;
  virtual double frame_height() const;
  virtual double frame_pic_h() const;
  // `victim.buffs.set/delete` —— 与同面的其它条目一样是虚的（台面假实体要观测
  // 这几条调用；`EntityViewBase` 的那两个同名方法是各自链上的转发）。
  virtual void buffs_set(const std::u16string& key, buff::Buff* b) { buffs[key] = b; }
  virtual void buffs_delete(const std::u16string& key) { buffs.erase(key); }
  Value data_indexes_of(const char16_t* key) const;
  virtual Value data_indexes_falling() const { return data_indexes_of(u"falling"); }
  virtual Value data_indexes_in_the_skys() const { return data_indexes_of(u"in_the_skys"); }
  virtual Value data_type() const;
  virtual void set_fallinjury(const Value& v) { fallinjury = to_number(v); }
  virtual void set_wait(const Value& v) { wait = to_number(v); }
  virtual double velocity_y() const { return velocity.y; }
  virtual Value marks_get(const std::u16string& key) const {
    const auto it = marks.find(key);
    return it == marks.end() ? Value() : Value(it->second);
  }
  virtual void marks_set(const std::u16string& key, const std::u16string& value) {
    marks[key] = value;
  }
  virtual bool marks_delete(const std::u16string& key) { return marks.erase(key) > 0; }

  // --- 切片 4CE：碰撞族窄接口退役 ⇒ 原先只在 `EntityCollisionView` 里的那几条读面收进实体 ---
  // 名字对得上 TS 的读法（`e.marks.has(k)` / `e.data.base.hit_sounds` / `e.frame.cpoint?.x`），
  // 与已经上收的 `data_indexes_falling` / `marks_get` 同一待遇：实体面只写一遍。
  bool marks_has(const std::u16string& kind) const {
    return marks.find(kind) != marks.end();
  }
  Value data_base_hit_sounds() const;
  // `this.data.id`——**必须**走虚的 `data()`，台面会替换 `data`（切片 4CF）。
  virtual Value data_id() const;
  Value frame_id() const;
  Value cpoint_backhurtact() const;
  Value cpoint_fronthurtact() const;
  // `this._data.indexes?.in_the_skys` 的第一项（数组取 `[0]`，记录取 `.0`）。
  Value data_in_the_skys_first() const;
  // `this.holding?.base_type()`（没拿武器给 `undefined`）。
  // 切片 4CF：加 `virtual` —— 状态台面的假实体要覆写它（`CharacterState_Base.get_auto_frame` 读它）。
  virtual Value holding_base_type() const;
  // `this.fuse_bys`：TS 是实体数组，实体面把它投影成 id 数组（对称的写入见 `set_fuse_bys`，
  // 与其它台面要观测的写面一样是虚的）。
  Value fuse_bys_of() const;
  virtual void set_fuse_bys(const Value& v);
  virtual void set_dismiss_data(const Value& v) { dismiss_data = v; }
  virtual void set_dismiss_time(const Value& v);
  // `this.play_sound(sounds, pos = this.position)`；单参版本用自身位置。Message 帧的 x 夹取
  // （TS 里就在这个方法里）也在这里 —— 见 `entity.cpp`。
  virtual void play_sound(const Value& sounds, const Value& pos);
  virtual void play_sound(const Value& sounds);
  // `this.spark_point(r0, r1)`：TS 返回 `[x, y, z]`，端口按调用方已有的出参形状给。
  // 切片 4CE：加 `virtual` —— 台面假实体要观测这条调用（TS 台面在 `spark_point` 上打日志）。
  virtual void spark_point(const collision::Cube& a, const collision::Cube& b, double& x, double& y,
                           double& z) const;
  // `A_SET_PROP` / `V_SET_PROP` 的 `entity[name] = value`：端口没有动态字段表 ⇒ 白名单写入
  // （名单外的名字 no-op，DESIGN §78 记偏差）。
  virtual void set_prop(const std::u16string& name, const Value& v);
  // `A_SET_VELOCITY_X` / `A_SET_FACING`：TS 直接写字段，端口收成方法（台面要观测写入）。
  virtual void set_velocity_x(const Value& v) { velocity.x = to_number(v); }
  virtual void set_facing(const Value& v) { facing = to_number(v); }
  virtual Entity& set_shaking(double v);
  virtual Entity& set_motionless(double v);
  virtual Entity& set_catcher(Entity* v);

  // --- 切片 4CF：状态族窄接口退役 ⇒ 原 `state::IStateEntity` 的实体面收进实体 ---
  // 命名与签名跟那个接口逐字对齐（`Entity` 自己已有原生类型的几条除外：那几条由状态层直接
  // 用字段/原生方法，见 DESIGN §142）。
  // 切片 4CG：这一片「照搬占位」开始**落实**，每个表达式都对着 TS 原文。落实顺序按「真数据
  // （`lfw_run` 跑 dist 包）下跑得到」排：输入面 `ctrl_*`、帧面 `frame_*` / `data_*`、持有物
  // `holding_*` / 背人 `bearer_*` / `catcher_*` 先做；`world_*` / `ground_*` / `ref_*` /
  // `datas_find_fighter` 还缺宿主缝或引用身份，留到下一刀（DESIGN §143.4）。
  virtual double velocity_x() const { return velocity.x; }
  virtual double velocity_z() const { return velocity.z; }
  // `const { on_landing } = e.frame`（`state/CharacterState_Base.ts:13`；`WeaponState_Base.ts:22`）。
  virtual Value frame_on_landing() const;
  // `c.victim.frame.behavior`（`defines/CollisionVal.ts:54` 的 `v_frame_behavior`）。
  virtual Value frame_behavior() const;
  // `const { base, indexes } = e.data`（`state/WeaponState_Base.ts:32`）。
  virtual Value data_base() const;
  // `e.data.frames[fid]`（`state/CharacterState_Base.ts:25`）/ `data.frames[indexes]`（武器）。
  virtual Value data_frames() const;
  // `if (!indexes) return void 0`（`state/WeaponState_Base.ts:9`）。
  virtual bool has_data_indexes() const;
  virtual Value frame_info() const { return frame; }
  virtual Value jumping_x() const { return Value(jumping.x); }
  virtual void set_jumping_x(const Value& v) { jumping.x = to_number(v); }
  virtual Value jumping_y() const { return Value(jumping.y); }
  virtual void set_jumping_y(const Value& v) { jumping.y = to_number(v); }
  virtual Value jumping_z() const { return Value(jumping.z); }
  virtual void set_jumping_z(const Value& v) { jumping.z = to_number(v); }
  virtual Value jumping_t() const { return Value(jumping.t); }
  virtual void set_jumping_t(const Value& v) { jumping.t = to_number(v); }
  virtual void set_bounced(const Value& v) { bounced = truthy(v); }
  virtual void set_throwinjury(const Value& v) { throwinjury = to_number(v); }
  virtual void set_drop_hurted(const Value& v) { drop_hurted = truthy(v); }
  virtual void set_dead_join(const Value& v) { dead_join = v; }
  virtual void set_wakeup_invuln(const Value& v) { wakeup_invuln = to_number(v); }
  virtual void set_lying_a_count(const Value& v) { lying_a_count = v; }
  virtual void set_lying_d_count(const Value& v) { lying_d_count = v; }
  virtual void set_lying_c_count(const Value& v) { lying_c_count = v; }
  // `e.position.x = x` 这类**直写**：TS 的 `State_Base.on_restrict` 直接改位置三个字段，
  // 不经过 `set_position`（那里会再触发状态钩子）。
  void assign_position(double x, double y, double z) {
    position.x = x;
    position.y = y;
    position.z = z;
  }
  // 持有物（`this.holding`）、背人（`this.bearer`）、被抱（`this.catcher`）三面 ——
  // 切片 4CG 落实（原 `IStateEntity` 占位），默认体照抄 TS 的 `?.` 语义（没有则什么都不做）。
  virtual bool has_holding() const { return holding != nullptr; }
  // `e.holding?.drink`（`state/CharacterState_Drink.ts:14`）。
  virtual DrinkInfo* holding_drink() const;
  // `holding.hp = holding.hp_r = 1`（`state/CharacterState_Drink.ts:42`）。
  virtual void holding_set_hp(const Value& v);
  virtual void holding_set_hp_r(const Value& v);
  // `holding.set_velocity(vx, vy, 0)`（`state/CharacterState_Drink.ts:45`）。
  virtual void holding_set_velocity(const Value& x, const Value& y, const Value& z);
  // `holding.team = e.team`（`state/CharacterState_Lying.ts:19` 等）。
  virtual void holding_set_team(const Value& v);
  // `holding.lfw.mt.mark = 'drink_drop'` / `holding.lfw.mt.range(-6, 6)`
  // （`state/CharacterState_Drink.ts:41-42`）：`mt` 缝已有，`MersenneTwister::mark/range`
  // 那一层留给下一刀（真数据下只有喝东西状态走这两条）。
  virtual void holding_mt_mark(const std::u16string& mark) { (void)mark; }
  virtual Value holding_mt_range(double lo, double hi) {
    (void)lo;
    (void)hi;
    return Value();
  }
  // `is_weapon(e.holding)`（`state/CharacterState_Walking.ts:29`）。
  virtual bool holding_is_weapon() const;
  virtual bool has_catcher() const { return catcher != nullptr; }
  // `e.catcher?.drop_catching()`（`state/CharacterState_Falling.ts:21`）。
  virtual void catcher_drop_catching();
  virtual bool has_bearer() const { return bearer != nullptr; }
  // `e.bearer.motionless`（`weapon_state_misc` 的 `wsoh_pre_update`）。
  virtual Value bearer_motionless() const;
  // `e.bearer.motionless = v`（同上）。TS 的 `motionless` 是任意值，端口是 `double` 字段
  // ⇒ 走 `to_number`（与实体面其它 `motionless` 写入一致）。
  virtual void set_bearer_motionless(const Value& v);
  // --- 切片 4CG 还没落实的那一组：都要新宿主缝或「引用身份」（DESIGN §143.4）----------
  // `m.world.entities`（`state/CharacterState_Teleport2NearestEnemy.ts:13`）：宿主只有
  // `list_entities` / `puppets`，没有「世界实体表」这条缝。
  virtual Value world_entities() const { return Value(); }
  // `e.lfw.world.etc(x, y, z, '6')`（`state/CharacterState_Lying.ts:52`）：宿主没有这条缝
  // （`entity.cpp` 的 `refresh_ctrl_env` 里 `env.world_etc` 也还是 `nullptr`）。
  virtual void world_etc(double x, double y, double z, const std::u16string& kind) {
    (void)x;
    (void)y;
    (void)z;
    (void)kind;
  }
  // `e.world.callbacks.call("on_fighter_add", e)`（`state/State_TransformTo8XXX.ts:14`）。
  virtual void world_callbacks_call(const std::u16string& name) { (void)name; }
  // `m.world.ground.segment(x, z)` / `.y(seg, x, z)`（teleport 系列）：宿主只有 `ground_step`。
  virtual Value ground_segment(double x, double z) {
    (void)x;
    (void)z;
    return Value();
  }
  virtual double ground_y(const Value& segment, double x, double z) {
    (void)segment;
    (void)x;
    (void)z;
    return 0;
  }
  // teleport / falling 系列拿到的「实体引用」是 `Value`（`entity_ref.h` 的 `ref_of`）：读面
  // 能直接读，写面（`ref_set_velocity`）要身份 ⇒ 需要引用带可查的 `id`，留给下一刀。
  virtual bool is_fighter_ref(const Value& o) const {
    (void)o;
    return false;
  }
  virtual bool is_self_ref(const Value& o) const {
    (void)o;
    return false;
  }
  virtual bool is_ally_ref(const Value& o) const {
    (void)o;
    return false;
  }
  virtual Value ref_hp(const Value& o) const {
    (void)o;
    return Value();
  }
  virtual double ref_position_x(const Value& o) const {
    (void)o;
    return 0;
  }
  virtual double ref_position_z(const Value& o) const {
    (void)o;
    return 0;
  }
  virtual void ref_set_velocity(const Value& who, const Value& x, const Value& y,
                                const Value& z) {
    (void)who;
    (void)x;
    (void)y;
    (void)z;
  }
  // `e.lfw.datas.find_fighter("50")`（`state/CharacterState_TransformToLouisEX.ts:9`）：
  // 只查战士表的那条面还没接（`LFW::datas_fighters_find` 已在，留给后续刀）。
  virtual Value datas_find_fighter(const std::u16string& oid) {
    (void)oid;
    return Value();
  }
  // --- 切片 4CG 落实：控制器面（输入）× 资料面 -----------------------------------
  // `this.ctrl.UD` / `this.ctrl.LR`（`controller/BaseController.ts:56-65`）——`ctrl_` 为空
  // 对应 TS 的「没有控制器」，端口给中性 `0`。
  virtual double ctrl_ud() const;
  virtual double ctrl_lr() const;
  // `is_bot_ctrl(this.ctrl)`（`entity/type_check.ts:29-30`）。
  virtual bool ctrl_is_bot() const;
  // `!!this.keys[k]?.is_end()`（`controller/BaseController.ts:186-187`）。
  virtual bool ctrl_is_end(const std::u16string& key) const;
  // `this.keys.reset_key_list()`（`controller/BaseController.ts:102`）。
  virtual void ctrl_reset_key_list();
  // `world.lfw.new_team`（`LFW.ts:299`：`` team_${++this.__team} ``）。
  virtual Value lfw_new_team() const;
  // `this.lfw.datas.find(oid)`（`buff/Buff.ts:109`）。
  virtual Value datas_find(const std::u16string& oid);

  // 切片 4CG-2：`nf.__judger` 真接线，完全照 TS：加载期 `preprocess_next_frame` 给「`expression`
  // 是字符串」的下帧登记一个编译好的 `Expression<Entity>`（端口不往 `Value` 里塞函数对象，改用
  // 「对象身份 → 判定器」表，见 `loader/preprocess_next_frame.{h,cpp}`），运行时这两条就是
  // TS 的 `!!nf.__judger` 与 `nf.__judger?.run(this)`。
  bool has_next_frame_judge(const Value& nf) const;
  Value next_frame_judge(const Value& nf);

  // --- frame lookup / flags ---------------------------------------------------
  // `find_frame_by_id` falls back to `find_auto_frame()` when the id is unknown;
  // `handle_facing_flag` / `handle_wait_flag` / `get_frame_wait` are the pure flag
  // resolvers `handle_next_frame_result` will use.
  Value find_frame_by_id(const Value& id) const;
  // 切片 4CF：状态台面要覆写这三条（TS 的同名钩子由状态对象提供）。
  virtual Value find_auto_frame() const;
  // 切片 4CF：加 `virtual` —— 武器状态（`WeaponState_Base::hit_ground_rebouncing` /
  // `WeaponState_InTheSky::update`）直接调它，台面要观测这条调用并替换对齐帧。
  virtual Value find_align_frame(const std::u16string& frame_id, const Value& src,
                                 const Value& dst) const;
  // 切片 4CF：加 `virtual` —— 台面只在 `get_prev_frame` 上打日志（行为已由 `set_prev_frame` 定死）。
  virtual Value get_prev_frame() const { return _prev_frame; }
  virtual Value get_sudden_death_frame() const;
  virtual Value get_caught_end_frame();
  double handle_facing_flag(const Value& facing) const;
  // 切片 4CF：`handle_wait_flag` 在 `IStateEntity` 上是虚的，状态台面假实体会覆写它
  // （TS 台面在 `handle_wait_flag` 上打日志，并把等待帧直接判成「不入帧」）。
  virtual double handle_wait_flag(const Value& wait,
                                  const std::optional<Value>& frame = std::nullopt) const;
  double get_frame_wait(const Value& frame) const;

  // --- physics: velocity / friction / gravity --------------------------------
  // `get dvx()` / `get dvy()` / `get dvz()`; a frame without the key yields
  // `undefined`, a falsy one is returned as-is.
  Value dvx() const;
  Value dvy() const;
  Value dvz() const;
  // TS `set_velocity(x?, y?, z?)` — `undefined` / `null` skip the axis.
  virtual void set_velocity(const Value& x, const Value& y, const Value& z);
  // 切片 4CE：加 `virtual` —— `handle_weapon_is_hit` 直接调它，台面要观测这条调用
  // （`collision_weapon_is_hit.ts` 在 `leave_ground` 上打日志）。
  virtual void leave_ground();
  // 切片 4CF：`handle_ground_velocity_decay` 加 `virtual` —— 状态台面假实体会覆写它
  // （TS 台面用「最后一步」口径替掉真实的摩擦衰减）。
  virtual void handle_ground_velocity_decay(double factor = 1);
  virtual void handle_velocity_decay(const Value& accx,
                             std::optional<Value> accz = std::nullopt,
                             double factor = 1);
  void handle_gravity();
  // 切片 4CF：`update_velocity` 加 `virtual` —— 台面假实体会覆写它（TS 台面同口径替换）。
  virtual void update_velocity(const Value& vinfo);
  // `set_position(x?, y?, z?)`: the three axes, then `world.restrict`, the four
  // `on_*_restrict` frame requests plus the `_state.on_restrict` hook (all of them
  // are host/frame requests here), and finally `_ground_y` through `Ground::y`.
  virtual void set_position(const Value& x, const Value& y, const Value& z);
  // `update_position()`: blockers zero the moving axis, then the average-velocity
  // step writes through `set_position`.
  void update_position();

  // --- enter-frame chain -------------------------------------------------------
  // `set_frame` / `enter_frame` / `get_next_frame` were the last blocked cluster of
  // the Entity block: `__judger` is the host seams `has_next_frame_judge` /
  // `next_frame_judge`, `lfw.mt` the `mt()` seam, and `world.restrict` the
  // `world_restrict` seam.
  virtual void set_frame(const Value& v);
  // 切片 4CE：`enter_frame` 加 `virtual` —— 台面假实体要观测「进入哪一帧」这条调用
  // （`collision_ball_frozen` 等 TS 台面在 `enter_frame` 上打日志）。
  virtual EnterFrameResult enter_frame(const Value& nf, bool fallback = false);
  virtual EnterFrameResult enter_frame_by_id(const Value& id, bool fallback = false);
  EnterFrameResult handle_next_frame_result(const Value& result, bool fallback = false);
  Value get_next_frame(const Value& which);
  // `holding?.follow_bearer()` / `catching?.follow_catcher()` — the relation half of
  // `set_frame`; `drop_holding` / `pick` are the two ends of the same relation.
  void follow_bearer();
  void follow_catcher();
  // 切片 4CF：`drop_holding` / `transform` / `transfrom_to_another` 加 `virtual` ——
  // 这三条在 `IStateEntity` 上本来就是虚的，状态台面假实体会覆写它们。
  virtual void drop_holding();
  void pick(Entity& weapon);
  // `transform(data)` / `transfrom_to_another(data?)` (TS keeps the typo).
  virtual void transform(const Value& data);
  virtual bool transfrom_to_another(const std::optional<Value>& data = std::nullopt);

  // --- opoint spawning (`spawn` / `on_spawn` / `attach`) ---------------------------
  // `spawn(opoint, offset_velocity = vec3(0,0,0), facing = this.facing)`：返回 `nullptr`
  // 对应 TS 的 `undefined`（TS 在三个失败分支里打日志 + `debugger`，端口只早退）。
  Entity* spawn(const Value& opoint);
  Entity* spawn(const Value& opoint, const Vector3& offset_velocity, double facing);
  // `on_spawn(emitter, opoint, offset_velocity = vec3(0,0,0), facing): this`
  Entity& on_spawn(Entity& emitter, const Value& opoint, const Vector3& offset_velocity,
                   double facing);
  // `attach(ghost = false): this`
  virtual Entity& attach(const Value& ghost = Value(false));
  // `release()`: the drop / clean of both holding and catching, the `on_disposed`
  // callback, the reset back to the raw data, then `world.del_entity(this)`.
  void release();
  // `apply_opoints(opoints)`: the interval bookkeeping, the `multi` count, the three
  // `spreading` offsets, one `spawn` per count, then the ball-controller `chasing` and
  // the `inherit_speed_*` velocity write.
  void apply_opoints(const Value& opoints);
  // 状态面（切片 4CF）：状态层给的是一组 opoint（`std::vector<Value>`），照原接口收下再转
  // `Value` 数组（`state_base_proxy.cpp` 的 `ice_piece_opoints()` 一处调用）。
  void apply_opoints(const std::vector<Value>& opoints);

  // --- the tick (`update` / `update_ghost`) ------------------------------------
  // `update()`: `mt.case` markers, the recovery decays (v_rest / arest / invisible /
  // invulnerable / blinking including the `Gone` & `Respawn` branches), the opoint
  // tick table, `stat_recovering` / `toughness_recovering`, the wait / motionless
  // bookkeeping, the `handle_gravity → update_velocity → update_position` sub-step
  // loop, then the catch relations, the controller result and the aabb refresh.
  void update();
  // `update_ghost()`: the same skeleton minus the v_rest / arest decays, the opoint
  // tick table, the wait-block motionless branch and the catch / aabb tail.
  void update_ghost();
  // `check_fusion_dismissing()` / `dismiss_fusion(frame_id)`: the fused members follow
  // the lead, and a split shares the hp / mp over every member and re-faces them.
  bool check_fusion_dismissing();
  // 切片 4CF：`dismiss_fusion` 加 `virtual` —— 台面假实体会覆写它（`CharacterState_Falling` 调它）。
  virtual void dismiss_fusion(const std::u16string& frame_id);
  // `update_aabb()`: the frame's `__aabb_*` box plus the `l_len` / `r_len` reach
  // (both flip with `facing`).
  void update_aabb();
  // `update_landable()`: the itr / bdy ground hits, then the land / leave / step
  // decision (a high step leaves the ground, the rest is treated as a slope).
  void update_landable();
  // `update_catching()` / `update_caught()`: the two halves of the catch relation.
  // Each returns whether `update()` must stop right there (`true` = stop).
  bool update_catching();
  bool update_caught();
  // `world.puppets.values()` as the state layer sees it (`IStateEntity::world_puppets`):
  // TS hands over real `Entity` objects, the port builds records the state hooks read
  // (`team` is the one `csl_on_dead` needs today, `id` / `hp` / `position` ride along).
  Value world_puppets() const;
  // `Entity` 作为 `Value` 的“完整视图”（`id` / `team` / `data` / `hp` / `emitters`）：
  // `summary_mgr.apply_damage(cer, injury, this, prev_hp)` 与 `is_boss(this.catching)`
  // 这类把实体当对象读的调用点用它。`ref()` 只带 `id`，是回调用来自证身份的最小视图。
  Value entity_view() const;
  // `ctrl.update()` 之前把控制器要读的那一组值刷进 `CtrlEnv`。TS 的
  // `BaseController.update()` 直接读 `me.frame.{hold,hit,key_down,key_up}`、
  // `me.data.{pre_hitkeys,post_hitkeys,__pre_hitkeys_map,__post_hitkeys_map}`、
  // `me.transforms?.[0]` 的同名映射、`frame.__seq_map` 与 `me.world.dataset.*`；端口把这些
  // 收进 `CtrlEnv`，由实体负责填 —— `world.etc` / `world.team_*` 上游已搬（`World::etc` /
  // `World::team_come|stay|move|follow`），但那五条钩子还没接线 ⇒ 留在空位（调用处都做空检查）。
  void refresh_ctrl_env();

  // --- stat helpers ----------------------------------------------------------
  void reset_armor();
  virtual Entity& set_catching(Entity* v);
  Entity& add_catch_time(double value);
  virtual Entity& set_catch_time(double value);
  // `A_SET_DROPPING`（`drop_holding` 那条链上的 `this.dropping = v`）——台面要观测这条写入。
  virtual void set_dropping(bool v) { dropping = v; }
  virtual Value dataset(const std::u16string& name) const;
  // 只读世界那一层（TS 的状态代码写 `this.world.dataset.X`，端口的状态缝是
  // `e.world_dataset("X")`）。
  // 切片 4CJ：`IEntityHost::world_dataset` 退役后改成直接读 `world().dataset`；台面假实体要观测
  // 「哪一行读了哪个键」（TS 的 `get world()` 是每实例一个打日志的 Proxy）⇒ 加 `virtual`。
  virtual Value world_dataset(const std::u16string& name) const;
  Value itr_fall(const Value& itr) const;

  // --- per-tick recovery (`update()` calls these) ------------------------------
  // Every one of them is a guarded `clamp_add` on a single stat plus its `Times`
  // gate; `get hp_r()` reads the private `_hp_r` the hp branch clamps against.
  void toughness_recovering();
  void fall_value_recovering();
  void defend_value_recovering();
  void stat_recovering();
  void hp_recovering();
  void mp_recovering();

  // --- marks / emitter helpers -------------------------------------------------
  // `set_mark` / `del_mark` are the `Map<string, string>` pair the buff & collision
  // layers write; `prev` / `value` use JS `==` (so a `null` guard behaves like the
  // missing one) and the stored string is compared loosely too.
  bool set_mark(const std::u16string& key, const std::u16string& value,
                const std::optional<Value>& prev = std::nullopt);
  bool del_mark(const std::u16string& key,
                const std::optional<Value>& value = std::nullopt);
  bool is_ally(const Entity& other) const;
  // `this.emitters[idx]` → `world.entity_map.get(...)`; a fractional / negative /
  // out-of-range index behaves like a hole in the JS array (`undefined`).
  Entity* get_emitter(double idx) const;

  // --- v_rest / relation cleanup / blink arming --------------------------------
  // TS keeps three `Map<string, Collision>` — `vrests` plus the `itr.kind`-driven
  // `blockers` / `superpunchs` mirrors.  The port stores collisions **by value**
  // while TS stores one shared object in up to three maps; see DESIGN §51.2.
  void add_v_rest(const collision::Collision& c);
  double get_v_rest(const std::u16string& a_id) const;
  void del_v_rest(const std::u16string& a_id);
  // `get_flag(other)`: `Ally` / `Enemy` by team, `| Dead` when the hp is gone, then
  // `| this.type` — a JS bitwise or, so the type goes through `js_to_int32`.
  double get_flag(const Entity& other) const;
  void clean_holding();
  void clean_catching();
  bool drop_catching();
  // `blink_and_gone` / `blink_and_respawn` write `_blinking` **directly** (no
  // `round_float` / `max(0, …)`; those live in the `blinking` setter) and arm
  // `_after_blink` with the private `FrameId` literal.
  // 切片 4CF：`blink_and_gone` / `blink_and_respawn` 加 `virtual`（`CharacterState_Lying` 调它们，
  // 台面假实体会覆写：TS 台面只记日志，不真的闪）。
  virtual void blink_and_gone(double duration);
  virtual void blink_and_respawn(double duration);
  // `update_itr_bdy_hit_ground(itrs)`: asks the host to enter `itr.on_hit_ground`
  // for every itr whose box has reached the ground line.
  void update_itr_bdy_hit_ground(const Value& itrs);

  // --- snapshot (`to_snapshot` / `read_snapshot`) -----------------------------
  // TS hands over `number[]` / `string[]`; the port keeps `Value` entries so a slot
  // whose TS type allows `null` stays distinguishable from `NaN` in both directions.
  // Both vectors are indexed by `NSlot` / `SSlot` and sized by the caller.
  void to_snapshot(std::vector<Value>& nums, std::vector<std::u16string>& strs) const;
  void read_snapshot(const std::vector<Value>& nums, const std::vector<std::u16string>& strs);
  // `this.copies.add(id)` — `Set.add` keeps the first insertion order and ignores a
  // duplicate, so the ported vector search-and-appends.  Returns whether it inserted.
  bool add_copy(const std::u16string& copy_id);

  // --- harness / platform peek -------------------------------------------------
  // TS keeps these slots private (`_catch_time`, `_toughness_r_value`, the recovery
  // ticks and their ranges); the differential harness reads them through here, and so
  // will the host once it renders stat bars.  The physics peek adds `atom_time` and
  // the `landing_frame` / `_ground_y` writers, because `set_position` / `set_frame`
  // (which would own those two) arrive with later slices.
  double catch_time() const { return _catch_time; }
  double toughness_r_value() const { return _toughness_r_value; }
  double fall_r_value() const { return _fall_r_value; }
  double defend_r_value() const { return _defend_r_value; }
  double toughness_r_tick_max() const { return _toughness_r_tick.max(); }
  double hp_r_tick_max() const { return _hp_r_tick.max(); }
  double mp_r_tick_max() const { return _mp_r_tick.max(); }
  double fall_r_tick_max() const { return _fall_r_tick.max(); }
  double defend_r_tick_max() const { return _defend_r_tick.max(); }
  double atom_time() const { return _atom_time; }
  void set_atom_time(double v) { _atom_time = v; }
  Value landing_frame() const { return _landing_frame; }
  void set_landing_frame(const Value& v) { _landing_frame = v; }
  void set_ground_y(double v) { _ground_y = v; }
  bool from_wait_block() const { return _from_wait_block; }
  void set_from_wait_block(bool v) { _from_wait_block = v; }
  void set_prev_frame(const Value& v) { _prev_frame = v; }
  // `_after_blink` is only ever read by `update()` (unported) and written by the
  // `blink_and_*` pair, so the scene reads it back through here.
  const std::optional<std::u16string>& after_blink() const { return _after_blink; }
  // `_motionless_ticks` — `set_frame` zeroes it; the decay lives in `update()`.
  double motionless_ticks() const { return _motionless_ticks; }
  void set_motionless_ticks(double v) { _motionless_ticks = v; }
  // `_temp_v` / `_prev_cpoint_a` — the landing payload `update_landable` hands to
  // `state.on_landing`, and the cpoint object identity `update_caught` compares.  TS
  // keeps both private; the harness reads them back through here.
  const Vector3& temp_v() const { return _temp_v; }
  const Value& prev_cpoint_a() const { return _prev_cpoint_a; }
  // `this._next_frame_by_id` — the record `enter_frame_by_id` reuses.
  const Value& next_frame_by_id() const { return _next_frame_by_id; }

  // The `this` argument every callback receives.  A listener sees the real object in
  // TS; the port hands over a `Value` view, which is what the ported type checks
  // (`is_self_ref` / `is_ally_ref`) compare against.
  Value ref() const;

 private:
  // `(holder.__gen_x ? holder.__gen_x.get(emitter) : holder.x)`：`emitter` 是接收者
  // （TS 的调用读的是 `emitter` 自己的表达式字段）。
  Value gen_or(const Value& holder, const std::u16string& kind, const Value& fallback) const;

  double _lifetime = 0;
  double _spawn_time = 0;
  double _render_effect_time = 0;
  std::u16string _outline_color;
  double _outline_alpha = 0.8;
  double _outline_width = 1;
  std::optional<double> _outline_enabled;
  std::u16string _mix_color;
  double _mix_strength = 0;
  double _greyscale = 0;
  Value _data;
  std::u16string _origin_data_id;
  double _reserve = 0;
  double _mounted = 0;
  double _ghosted = 0;
  Times _hp_r_tick;
  Times _mp_r_tick;
  double _resting = 0;
  std::optional<double> _resting_max;
  Times _resting_tick;
  double _toughness = 0;
  double _toughness_max = 0;
  Times _toughness_r_tick;
  double _toughness_r_value = 0;
  double _toughness_resting = 0;
  double _toughness_resting_max = 0;
  double _fall_value = 0;
  std::optional<double> _fall_value_max;
  Times _fall_r_tick;
  double _fall_r_value = 0;
  double _defend_value = 0;
  std::optional<double> _defend_value_max;
  Times _defend_r_tick;
  double _defend_r_value = 0;
  std::optional<double> _defend_ratio;
  Value _name = Value(NullTag{});
  double _mp = 0;
  std::optional<double> _mp_max;
  double _hp = 0;
  double _hp_r = 0;
  std::optional<double> _hp_max;
  double _arest = 0;
  double _motionless_ticks = 0;
  double _catch_time = 0;
  std::optional<double> _catch_time_max;
  double _invisible = 0;
  double _invulnerable = 0;
  double _blinking = 0;
  Value _landing_frame = Value(NullTag{});
  std::optional<std::u16string> _after_blink;
  double _ground_y = 0;
  double _prev_ground_y = 0;
  double _atom_time = 0;
  bool _from_wait_block = false;
  Value _prev_frame;
  Value _next_frame_by_id;
  Value _prev_cpoint_a = Value(NullTag{});
  // `_temp_v = Ditto.vec3(0, 0, 0)` — the velocity snapshot `update_landable` copies
  // out before zeroing `velocity.y` and hands to `state.on_landing`.
  Vector3 _temp_v;
  std::u16string _team;
  state::States* states_ = nullptr;
  // `this._state?.on_dead?.(this)` / `this._state?.get_gravity?.(this)` / … — the hooks
  // live on the active state object and now receive the entity itself (切片 4CF：
  // `EntityStateView` 退役，不再需要那层适配).  A missing hook and a state without that
  // optional callback are the same thing in TS.
  state::State_Base* _state = nullptr;
  // 状态钩子要的是**可变**实体：`get_gravity()` / `get_auto_frame()` 这些读点本身是
  // `const` 成员，而钩子体（TS 侧）会改实体。旧实现在同样的位置经 `state_view_` 拿到
  // 非 const 引用 ⇒ 这里用同一个口径（`const_cast`）把可变引用递出去。
  Entity& mutable_self() const { return const_cast<Entity&>(*this); }
  controller::BaseController* ctrl_ = nullptr;
  // `ctrl.update()` 的环境（见 `refresh_ctrl_env`）。
  controller::CtrlEnv _ctrl_env;
  World* world_ = nullptr;

  Value ctrl_ref(controller::BaseController* ctrl) const;
};

// TS `Entity.ts` **底部**那四句模块级注册：
//   `Factory.register_entity(EntityEnum.{Ball,Weapon,Entity,Fighter}, common_creator)`
// C++ 没有模块初始化 ⇒ 由 `LFW` 构造函数（`regist_components()` / `regist_buffs()` 旁边）调一次。
// 与 TS 一致：重复调用只 warn（`Factory::register_entity` 的门）。
void regist_entities();

}
