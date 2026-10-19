#pragma once

#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace helper {

double manhattan_xz(const Value& a, const Value& b);
// 自身是**真实体**时走这条：位置活读，省掉每帧重建 `Value` 投影（`other` 仍是引用）。
// 台面（差分 `bot` subject）没有 `Entity`，那边继续用上面那条。
double manhattan_xz(const Entity& a, const Value& b);
// 两个真实体之间（目标表里的活目标）。
double manhattan_xz(const Entity& a, const Entity& b);

}
}
