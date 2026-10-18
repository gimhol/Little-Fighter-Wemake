#pragma once

#include <functional>
#include <string>

#include "lfw/collision/handlers2.h"
#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace collision {

// 切片 4CE：`IWeaponIsHitEntity` 已退役（与 `fall.h` 同一刀）⇒ 缝里直接是 `lfw::Entity`。
struct SparkPoint {
  Value x;
  Value y;
  Value z;
};

struct WeaponIsHitEnv {
  std::function<Entity*(const std::u16string& id)> find_entity;
  // `victim.spark_point(a_cube, b_cube)`：读活实体。
  std::function<SparkPoint(const Collision& c, const Cube& a, const Cube& b)> spark_point;
  std::function<void(const Value& x, const Value& y, const Value& z,
                     const std::u16string& kind)>
      spark;
  std::function<void(const std::u16string& mark)> mt_mark;
  std::function<Value(const Value& indexes)> mt_pick;
  std::function<ItrVelocity(Collision& c)> calc_velocity;
};

void handle_weapon_is_hit(Collision& c);

const WeaponIsHitEnv& weapon_is_hit_env();
void set_weapon_is_hit_env(const WeaponIsHitEnv& env);

}

}
