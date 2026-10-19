#pragma once

#include <functional>
#include <string>

#include "lfw/collision/n_bdy_normal.h"
#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace collision {

// 切片 4CE：`INdbdyDefendEntity`（含 `INbdyNormalEntity` / `IFallEntity` / `IHandlerEntity`）
// 已退役 ⇒ 缝里直接是 `lfw::Entity`。
struct NbdDefendEnv {
  std::function<Entity*(const std::u16string& id)> find_entity;
  std::function<ItrVelocity(Collision& c)> calc_velocity;
  std::function<void(const Value& x, const Value& y, const Value& z, const Value& type)> spark;
  // `run_action(type, action, attacker, victim, …)`：那两个实体就是碰撞的 a/v。
  std::function<void(const Collision& c, const std::u16string& handler_type, const Value& action)>
      dispatch;
};

void handle_itr_normal_bdy_defend(Collision& c);

const NbdDefendEnv& nbd_defend_env();
void set_nbd_defend_env(const NbdDefendEnv& env);

}

}
