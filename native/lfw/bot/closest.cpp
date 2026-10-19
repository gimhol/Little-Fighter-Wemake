#include "lfw/bot/closest.h"

#include <cstddef>
#include <functional>

#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/type_cast.h"

namespace lfw {
namespace bot {

namespace {

// `me` 的 `x/z` 到 `it` 的曼哈顿距离（`me` 是引用还是真实体只差「谁给出坐标」）。
double distance_xz(double mx, double mz, const Value& it) {
  const Value pi = field_or(it, u"position");
  const double dx = mx - to_number(field_or(pi, u"x"));
  const double dz = mz - to_number(field_or(pi, u"z"));
  return round(abs(dx) + abs(dz));
}

// `list` 里按 `distance_of` 取最近的一个（`undefined` 项跳过）。
Value closest_by(const std::function<double(const Value&)>& distance_of,
                 const std::vector<Value>& list) {
  Value ret;
  double distance = 0;
  for (const Value& it : list) {
    if (!truthy(it)) continue;
    const double d = distance_of(it);
    if (!truthy(ret) || d < distance) {
      ret = it;
      distance = d;
    }
  }
  return ret;
}

}  // namespace

Value closest(const Value& me, const std::vector<Value>& list) {
  const Value pm = field_or(me, u"position");
  return closest_by(
      [&pm](const Value& it) {
        return distance_xz(to_number(field_or(pm, u"x")), to_number(field_or(pm, u"z")), it);
      },
      list);
}

Value closest(const Entity& me, const std::vector<Value>& list) {
  return closest_by(
      [&me](const Value& it) { return distance_xz(me.position.x, me.position.z, it); }, list);
}

}
}
