#pragma once

#include <vector>

#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace bot {

Value closest(const Value& me, const std::vector<Value>& list);
// 自身是真实体时走这条（位置活读）；`list` 里仍是引用，返回的也是其中一个引用。
Value closest(const Entity& me, const std::vector<Value>& list);

}
}
