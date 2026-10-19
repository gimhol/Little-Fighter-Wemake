#pragma once

#include <functional>
#include <string>

#include "lfw/collision/collision.h"
#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace collision {

// 切片 4CE：`IH4Entity` 已退役 ⇒ 缝里直接是 `lfw::Entity`。
struct Handlers4Env {
  std::function<Entity*(const std::u16string& id)> find_entity;
  std::function<bool(const Entity& e)> is_fighter;
  // `attacker.find_align_frame(frame_id, throwings, in_the_skys)`：读活实体。
  std::function<Value(const Collision& c, const Value& frame_id, const Value& throwings,
                      const Value& in_the_skys)>
      find_align_frame;
};

const Handlers4Env& handlers4_env();
void set_handlers4_env(const Handlers4Env& env);

void handle_ball_hit_other(Collision& c);
void handle_weapon_hit_other(Collision& c);

}

}
