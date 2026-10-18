#include "lfw/entity/target_handle.h"

#include <variant>

#include "lfw/core/same_ref.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/type_cast.h"

namespace lfw {

namespace {

bool value_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

}  // namespace

TargetHandle TargetHandle::of(const Entity& e) {
  TargetHandle h;
  h._entity = &e;
  h._id = e.id;
  h._ref = Value();
  h._ref_built = false;  // 真身体柄：`ref()` 按需从实体取快照
  return h;
}

TargetHandle TargetHandle::of(const Value& ref) {
  TargetHandle h;
  h._ref = ref;
  h._ref_built = true;
  const Value id = field_or(ref, u"id");
  if (const std::u16string* const s = std::get_if<std::u16string>(&id)) h._id = *s;
  return h;
}

// 实体池会复用：指针还在，但 `id` 变了就说明它已经是别人了。
// `id` 为空表示「这个句柄拿不到身份」（差分台面的假实体就是这种），此时无从校验，
// 直接当有效 —— 台面不会复用实体，与 TS 的对象语义一致。
const Entity* TargetHandle::live() const {
  if (_entity == nullptr) return nullptr;
  if (_id.empty()) return _entity;
  return _entity->id == _id ? _entity : nullptr;
}

bool TargetHandle::nullish() const {
  if (_entity != nullptr) return live() == nullptr;
  return value_nullish(_ref);
}

const Entity* TargetHandle::entity() const { return live(); }

const Value& TargetHandle::ref() const {
  if (!_ref_built) {
    // 直接按指针取快照（TS 里也是「对象还在就能读」）。指针被回收的情况由 `refresh()`
    // 先复核 `id` 再下结论（见 `refresh` 的注释）。
    _ref = _entity != nullptr ? ref_of(*_entity) : Value(NullTag{});
    _ref_built = true;
  }
  return _ref;
}

double TargetHandle::x() const {
  if (const Entity* const e = live()) return e->position.x;
  return to_number(field_or(field_or(_ref, u"position"), u"x"));
}

double TargetHandle::z() const {
  if (const Entity* const e = live()) return e->position.z;
  return to_number(field_or(field_or(_ref, u"position"), u"z"));
}

void TargetHandle::refresh() const {
  if (_entity == nullptr) return;
  if (_id.empty() || _entity->id == _id) {
    _ref_built = false;
    return;
  }
  _ref = Value(NullTag{});
  _ref_built = true;
}

bool TargetHandle::same(const TargetHandle& o) const {
  const Entity* const a = live();
  const Entity* const b = o.live();
  // 两个都是真实体：TS 的 `===` 就是对象同一性。
  if (a != nullptr && b != nullptr) return a == b;
  // 两个都是台面的引用：同样是对象同一性（用例里 s1/s2 故意共用同一个 `id`，
  // 按 `id` 比会把它们并成一个，与 TS 的 `Set<Entity>` 不符）。
  if (a == nullptr && b == nullptr) return same_ref(ref(), o.ref());
  // 混合（真实体句柄 vs 引用投影）：只能按 `id` 桥接。
  if (!_id.empty() && !o._id.empty()) return _id == o._id;
  return same_ref(ref(), o.ref());
}

}
