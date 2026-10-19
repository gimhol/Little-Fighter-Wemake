#pragma once

#include <functional>
#include <string>

#include "lfw/buff/buff.h"
#include "lfw/collision/collision.h"
#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace collision {

// 切片 4CE：`IH3Entity` 已退役 ⇒ 缝里直接是 `lfw::Entity`。
struct Handlers3Env {
  std::function<Entity*(const std::u16string& id)> find_entity;
  std::function<bool(const Entity& e)> is_ball;
  std::function<bool(const Entity& e)> is_weapon;
  // `victim.spark_point(a_cube, b_cube)`：读的是活实体 ⇒ 收 `Collision`。
  std::function<void(const Collision& c, const Cube& a, const Cube& b, double& x, double& y,
                     double& z)>
      spark_point;
  std::function<void(double x, double y, double z, const Value& type)> spark;
  std::function<void(const Value& sounds, double x, double y, double z)> play_sound_global;
  std::function<bool(Collision& c)> is_armor_work;
};

const Handlers3Env& handlers3_env();
void set_handlers3_env(const Handlers3Env& env);

void handle_itr_kind_whirlwind(Collision& c);
void handle_ball_is_hit_a(Collision& c);
void handle_ball_is_hit_b(Collision& c);
bool handle_armor(Collision& c);

}

}
