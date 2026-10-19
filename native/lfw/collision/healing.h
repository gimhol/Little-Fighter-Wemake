#pragma once

#include <functional>
#include <string>

#include "lfw/buff/buff.h"
#include "lfw/collision/collision.h"
#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace collision {

// 切片 4CE：`IHealingEntity` 已退役 ⇒ 缝里直接是 `lfw::Entity`。
struct HealingEnv {
  std::function<Entity*(const std::u16string& id)> find_entity;
};

const HealingEnv& healing_env();
void set_healing_env(const HealingEnv& env);

void handle_healing(Collision& c);

}

}
