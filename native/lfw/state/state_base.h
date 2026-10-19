#pragma once

#include <functional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"
#include "lfw/entity/drink_info.h"

namespace lfw {

class Entity;

namespace state {

// 切片 4CF：`state::IStateEntity` 退役 —— 状态逻辑（`state/*`）与三组状态对象
// （`CharacterState_*` / `WeaponState_*` / `BallState_*`）现在直接收 `lfw::Entity&`，
// 原来那 155 个成员的实体面收进了 `Entity`（见 `entity/entity.h` 的「状态面」一节与
// DESIGN §142）。
// 切片 4CP：`StateEnv` 里最后一格 `buff_env` 也退役了（`grant_buff` 从 victim 上取
// `lfw`/`world`，与 TS 同形）⇒ 这个空壳连同 `state_env()` / `set_state_env()` 一并删除。

class State_Base {
 public:
  explicit State_Base(Value state) : _state(std::move(state)) {}
  virtual ~State_Base() = default;

  const Value& state() const { return _state; }

  std::function<void(Entity& e)> pre_update;
  std::function<void(Entity& e, const Value& prev_frame)> enter;
  std::function<void(Entity& e)> on_dead;
  std::function<void(Entity& e, const Value& velocity)> on_landing;
  std::function<Value(Entity& e)> get_gravity;
  std::function<Value(Entity& e)> get_sudden_death_frame;
  std::function<Value(Entity& e)> get_caught_end_frame;
  std::function<Value(Entity& e)> get_auto_frame;
  std::function<Value(Entity& e, const Value& id)> find_frame_by_id;
  std::function<void(Entity& e)> on_leave_ground;

  virtual void update(Entity& e);
  virtual void leave(Entity& e, const Value& next_frame);
  virtual void on_restrict(Entity& e, double x, double y, double z);

 protected:
  Value _state;
};

}
}
