#pragma once

#include <string>
#include <vector>

#include "lfw/base/fsm.h"
#include "lfw/bot/bot_dataset.h"
#include "lfw/bot/nearest_targets.h"
#include "lfw/bot/state/bot_state_avoiding.h"
#include "lfw/bot/state/bot_state_chasing.h"
#include "lfw/bot/state/bot_state_idle.h"
#include "lfw/bot/state/bot_state_misc.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"

namespace lfw {
namespace bot {

// `enum BotBehavior { Stay = 'Stay', Move = 'Move', Follow = 'Follow' }`（TS 字符串枚举）。
enum class BotBehavior : int {
  Stay = 0,
  Move = 1,
  Follow = 2,
};

const char16_t* bot_behavior_name(BotBehavior v);

// `bot/BotController.ts` 的 `class BotController extends BaseController`。
//
// 端口约定（同 `BallController`）：自己的一切走 `env()`（`CtrlEnv` 的 bot 段，见
// `controller/base_controller.h`）；对家是**实体指针**（`Entity*`，与 TS 同形），需要
// 「`Value` 引用」的读法现走 `entity/entity_ref.h` 的 `ref_of`；world / lfw 走 `env()` 上的几条缝。
//
// ⚠️ 构造 / `reset()` 时还没有 env（TS 的构造函数直接拿着 entity，`fsm.reset(BSE.Idle)`
// 当场读 `stage.*` 并向 `mt` 抽四次签）⇒ 端口把这一步**推迟**到 env 第一次绑定时
// （`set_env`，由 `Entity::refresh_ctrl_env` 触发；`Entity::set_ctrl` 在挂上新控制器后
// 立刻刷一次 env，把时机对齐到 TS 的「构造即 enter」）。
class BotController : public controller::BaseController {
 public:
  static constexpr const char* TAG = "BotController";

  BotController();

  // `fsm.reset(BSE.Idle)` 的推迟执行点（见类注释）。
  void set_env(const controller::CtrlEnv* env) override;
  void reset() override;
  const controller::ControllerResult& update() override;
  // `update_lookup(me, entities)`（`World.step` 每两帧一次）：候选就是实体表（TS 同形）。
  void update_lookup(int me, const std::vector<Entity*>& entities);

  // ---- TS 的公开字段（`readonly` 的照抄）----
  FSM fsm;
  NearestTargets chasings;
  NearestTargets avoidings;
  NearestTargets defends;
  Value dummy{dummy_default()};
  BotBehavior behavior = BotBehavior::Move;
  Value goingto;    // `IVector3 | null`
  const Entity* following = nullptr;  // `Entity | null`
  const Entity* watching = nullptr;   // `Entity | null`
  bool en_out_of_range = false;
  double idle_min_x = -9007199254740991.0;
  double idle_max_x = 9007199254740991.0;
  double idle_min_z = -9007199254740991.0;
  double idle_max_z = 9007199254740991.0;
  Value bot_id;   // `_bot_id: string | undefined`
  Value bot;      // `_bot: IBotData | undefined`
  BotDataSet dataset;
  Value bot_frame;  // `string | undefined`

  // ---- TS 的 getter ----
  double difficulty() const;
  double facing() const;
  const std::u16string& team() const;
  Value en() const;
  Value av() const;
  Value bot_state() const;
  double atk_f_x() const;
  double atk_b_x() const;
  double w_atk_f_x() const;
  double w_atk_b_x() const;
  double r_atk_x() const;
  double d_atk_max_x() const;
  double d_atk_min_x() const;
  double j_atk_x() const;
  double w_atk_m_x() const;
  double w_atk_r_x() const;
  double defend_desire() const;

  // `this.stage.*` / `this.world.*` 的常用读（states 共用）。
  Value stage_value(const std::u16string& key) const;
  double stage_player_l() const;
  double stage_player_r() const;
  double stage_near() const;
  double stage_far() const;
  bool stage_is_stage_finish() const;
  bool stage_is_chapter_finish() const;
  bool has_players_alive() const;
  std::vector<double> get_bound() const;
  MersenneTwister* mt() const;

  // ---- 其余 TS 方法 ----
  bool w_atk_too_far(const Value& o_ref) const;
  bool w_atk_too_close(const Value& o_ref) const;
  bool can_back_off(const Value& o_ref) const;
  bool cornered(const Value& o_ref) const;
  // 返回 `-1 | 1 | 0`。
  double should_run(const std::u16string& where, const Value& target);
  bool is_enter_goto_range(const Value& entity_ref) const;
  bool is_leave_goto_range(const Value& entity_ref) const;
  bool is_leave_chase_range(const Value& target_ref) const;
  bool should_chase(const Entity& e_ref);
  bool should_avoid(const Entity& av_ref);
  // 返回 `0 | 1 | 2`。
  int should_defend(const Entity& e_ref);
  void lookup(const Entity& other);
  // `guess_entity_pos` 的返回：`{x, z, next_x, next_z, next_y}`。
  Value guess_entity_pos(const Value& entity_ref) const;
  double desire(const std::u16string& mark) const;
  double action_desire(const std::u16string& mark);
  void check_bot();
  bool lock_when_stand_and_rest();
  // `LGK[] | false | string`。
  Value handle_action(const std::u16string& where, const Value& action);
  void follow(const Entity& e_ref);
  void move();
  void stay();
  void come(double x, double y, double z);
  void _case(const std::u16string& mark, const std::vector<Value>& args = {});
  bool _false(const std::u16string& mark, const std::vector<Value>& args = {});
  bool _true(const std::u16string& mark, const std::vector<Value>& args = {});
  bool is_leave_avoid_zone(const Value& target_ref) const;
  bool is_enter_avoid_zone(const Value& target_ref) const;
  // `this.entity` 的位置快照引用（`is_*_range` / `closest` / `is_ray_hit` 的 `self`）。
  Value self_ref() const;
  // 「自己」的真实体：真实运行时由 `Entity::refresh_ctrl_env` 给（`env.self`），
  // 差分台面里是 `nullptr` ⇒ 调用点退回 `self_ref()` 的引用版重载。
  Entity* self_entity() const {
    const controller::CtrlEnv* const e = env();
    return e != nullptr ? e->self : nullptr;
  }
  // `chasings/avoidings/defends` 的 `look` / `sort`：有真实体就走实体版（位置活读），
  // 否则走 `self_ref()` 的引用版（台面）。
  void look_target(NearestTargets& nt, const Entity& other);
  void sort_targets(NearestTargets& nt);

  // `dummy` 的 getter / setter（setter 会松掉全部按键）。
  const Value& dummy_value() const { return dummy; }
  void set_dummy(const Value& v);

  static Value dummy_default();

 private:
  double target_dist_bound() const;

  bool idle_init_pending_ = false;

  BotState_Idle idle_;
  BotState_Chasing chasing_;
  BotState_Avoiding avoiding_;
  BotState_Following following_state_;
  BotState_StageEnd stage_end_;
  BotState_Dead dead_;
};

// `dummy_updaters[this.dummy]?.update(this)`（`bot/DummyEnum.ts` 的表）。
void dummy_update(const Value& dummy, BotController& self);

}  // namespace bot
}  // namespace lfw
