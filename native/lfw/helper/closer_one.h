#pragma once

#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace helper {

// `closer_one(s, t1, t2)`：取离 `s` 更近的那个（曼哈顿 xz），都没有就给空值。
// 端口沿用 `manhattan_xz` 的约定：参数是 `Value` 引用（`t1` / `t2` 传空值就表示 TS 的
// `undefined`）；`s` 是真实体时走下面那条（位置活读，且不必先造一份自身投影）。
Value closer_one(const Value& s, const Value& t1, const Value& t2);
Value closer_one(const Entity& s, const Value& t1, const Value& t2);

}
}
