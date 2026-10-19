#pragma once

#include <functional>
#include <string>

#include "lfw/buff/buff.h"
#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace collision {

// 切片 4CE：`IActionEntity` 已退役 ⇒ 缝里直接是 `lfw::Entity`。
struct ActionEnv {
  std::function<double()> mt_int;
  std::function<void(const std::u16string& mark)> mt_set_mark;
  std::function<bool(const std::u16string& oid, Value& out)> find_data;
  std::function<void(const std::u16string& msg)> broadcast;
  std::function<void(const std::u16string& msg)> alert;
  std::function<Entity*(const std::u16string& id)> find_entity;
  std::function<bool(const Entity& a, const Entity& v)> is_ally;
};

Value run_action(const ActionEnv& env, const std::u16string& type, const Value& action,
                 Entity& attacker, Entity& victim, const Value& injury,
                 const Value& real_injury);

}

}
