#include "lfw/helper/closer_one.h"

#include <functional>

#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/helper/manhattan_xz.h"

namespace lfw {
namespace helper {

namespace {

// `s` 的两个候选里取近的那个（`s` 是引用还是真实体只差距离怎么算）。
Value closer_of(const std::function<double(const Value&)>& distance_of, const Value& t1,
                const Value& t2) {
  if (truthy(t1) && truthy(t2)) return distance_of(t1) > distance_of(t2) ? t2 : t1;
  if (truthy(t1)) return t1;
  if (truthy(t2)) return t2;
  return Value();
}

}  // namespace

Value closer_one(const Value& s, const Value& t1, const Value& t2) {
  if (!truthy(s)) return Value();
  return closer_of([&s](const Value& t) { return manhattan_xz(s, t); }, t1, t2);
}

Value closer_one(const Entity& s, const Value& t1, const Value& t2) {
  return closer_of([&s](const Value& t) { return manhattan_xz(s, t); }, t1, t2);
}

}
}
