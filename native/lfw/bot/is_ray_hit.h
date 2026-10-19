#pragma once

#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace bot {

// TS `is_ray_hit(a: Entity, b: Entity, ray: IBotRay)`：函数体只读 `a.position` / `a.facing`
// 与 `b.position` ⇒ 端口**直接收真实体**（`ray` 是数据，仍是 `Value`）。
//
// 此前收的是 `ref_of()` 造出来的 `Value` 快照：只要快照里 `position` / `facing` 缺名或类型不对，
// `dx` / `dz` / `facing` 就全成 0，射线恒真或恒假（bot 行为整片不触发）。控制器侧要拿到实体
// 就走 `CtrlEnv::resolve`（`ref_of()` 的引用 → `Entity*`），不要再自己搭快照。
Value is_ray_hit(const Entity& a, const Entity& b, const Value& ray);

}  // namespace bot
}  // namespace lfw
