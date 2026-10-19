#pragma once

#include <cstddef>
#include <string>
#include <variant>

#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/defines/entity_group.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace entity {

bool is_fighter_data(const Value& v);
bool is_weapon_data(const Value& v);
bool is_entity_data(const Value& v);
bool is_ball_data(const Value& v);
bool is_fighter(const Value& v);
bool is_ball(const Value& v);
bool is_weapon(const Value& v);
// 实体版：TS 的 `is_fighter(v: any)` 读 `v?.data.type`，`Entity` 直接给 `data()` 就行。
// 调用点原来写的 `is_fighter(ref_of(*e))` 会为了判一个类型白造一整份引用
// （`data` / `frame` / 四个关系槽），这类点在 `stage` / `world` / `ui` 里共 36 处。
bool is_fighter(const Entity& e);
bool is_ball(const Entity& e);
bool is_weapon(const Entity& e);
bool is_entity(const Value& v);
bool is_boss(const Value& v);
bool is_object(const Value& v);
bool is_object_data(const Value& v);
bool is_bg_data(const Value& v);
bool is_base_ctrl(const Value& v);
bool is_bot_ctrl(const Value& v);
// `e.ctrl` 的 `Value` 视图：TS 里控制器是对象（`ctrl.player_id` / `is_bot_ctrl(ctrl)` 都读它），
// 端口把这几面投影成 `Value`。原来长在 `world.cpp` 的匿名命名空间里（供 `IStageEntity` 投影用），
// 切片 4CU（ck7）挪进来给 `Entity::ctrl_view()` 与 `Stage` 共用。
bool is_human_ctrl(const Value& v);
bool is_ball_ctrl(const Value& v);
// `is_bot_ctrl(v: any): v is BotController`（TS 的 `type_check.ts` 读 `v?.__is_bot_ctrl__`）：
// 端口里控制器是对象 ⇒ 这一条直接收对象（`Value` 形状的那条按 `__is_bot_ctrl__` 字段读）。
bool is_bot_ctrl(const controller::BaseController* ctrl);
Value ctrl_view_of(const controller::BaseController* ctrl);

}
}
