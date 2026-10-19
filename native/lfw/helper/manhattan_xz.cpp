#include "lfw/helper/manhattan_xz.h"

#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/round_float.h"
#include "lfw/utils/type_cast.h"

namespace lfw {
namespace helper {

namespace {

// `a` 的 `x/z` 与 `b.position.x/z` 的曼哈顿距离。引用版与实体版只差「谁给出 `a` 的坐标」，
// 几何留在这里一份（也留一个唯一的变异锚点）。
double manhattan_xz_of(double ax, double az, const Value& b) {
  const Value pb = field_or(b, u"position");
  const double dx = ax - to_number(field_or(pb, u"x"));
  const double dz = az - to_number(field_or(pb, u"z"));
  return round_float(abs(dx) + abs(dz));
}

}  // namespace

double manhattan_xz(const Value& a, const Value& b) {
  const Value pa = field_or(a, u"position");
  return manhattan_xz_of(to_number(field_or(pa, u"x")), to_number(field_or(pa, u"z")), b);
}

double manhattan_xz(const Entity& a, const Value& b) {
  return manhattan_xz_of(a.position.x, a.position.z, b);
}

double manhattan_xz(const Entity& a, const Entity& b) {
  return round_float(abs(a.position.x - b.position.x) + abs(a.position.z - b.position.z));
}

}
}
