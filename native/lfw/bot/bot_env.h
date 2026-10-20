#pragma once

#include <memory>
#include <string>
#include <variant>

#include "lfw/controller/base_controller.h"
#include "lfw/core/same_ref.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace bot {

// `bot/*` 共用的几个投影：TS 里 `BotController` / `BotState_*` 直接读活实体
// （`e.frame.state` / `e.data.base.type ?? 0` / `e.bot_ignore` …），端口的实体侧只有
// `CtrlEnv`（自己）与实体引用（对家）⇒ 这两条读法各收成一个函数，免得各处手抄。

inline bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

inline Value or_nullish(const Value& v, const Value& fallback) {
  return nullish(v) ? fallback : v;
}

// `e.state`（= `e.frame.state`），引用版。
inline Value state_of_ref(const Value& ref) {
  return field_or(field_or(ref, u"frame"), u"state");
}

// `o[key]`（键是运行时算出来的，`field_or` 只收字面量键）。
inline Value field_key(const Value& v, const std::u16string& key) {
  const Object* o = as_object(v);
  if (o == nullptr) return Value();
  const Value* p = o->get(key);
  return p != nullptr ? *p : Value();
}

// `me.state`，自身版（`CtrlEnv.frame` 就是刷新那一刻的 `me.frame`）。
inline Value state_of_env(const controller::CtrlEnv& e) { return field_or(e.frame, u"state"); }

// `e.base_type` = `e.data.base.type ?? 0`
inline Value base_type_of_ref(const Value& ref) {
  return or_nullish(
      field_or(field_or(field_or(ref, u"data"), u"base"), u"type"), Value(0.0));
}

// `e.bot_ignore` = `e.frame.bot_ignore ?? e.data.base.bot_ignore`
inline Value bot_ignore_of_ref(const Value& ref) {
  return or_nullish(
      field_or(field_or(ref, u"frame"), u"bot_ignore"),
      field_or(field_or(field_or(ref, u"data"), u"base"), u"bot_ignore"));
}

// `a == b` / `a === b`（实体身份）：TS 比的是对象同一性；端口的两份引用是各自建出来的
// 投影 ⇒ 有 `id` 就按 `id` 比（`id` 在实体生命周期内唯一），否则退回引用同一性。
inline bool same_entity(const Value& a, const Value& b) {
  if (nullish(a) || nullish(b)) return strict_equals(a, b);
  const Value ia = field_or(a, u"id");
  const Value ib = field_or(b, u"id");
  if (truthy(ia) && truthy(ib)) return strict_equals(ia, ib);
  return same_ref(a, b);
}

// `me.holding?.base_type`（没有持握物时给 `undefined`，不是 0）。
inline Value holding_base_type_of_env(const controller::CtrlEnv& e) {
  if (e.holding == nullptr) return Value();
  return base_type_of_ref(ref_of(*e.holding));
}

// `const self = this.entity` 在端口里的替身：`{ id, position }` —— 只在拿不到真实体
// （`CtrlEnv::self == nullptr`，差分台面）时给 `bot/*` 的引用读法兜底。
inline Value self_ref_of_env(const controller::CtrlEnv& e) {
  Object pos;
  pos.set(u"x", Value(e.px));
  pos.set(u"y", Value(e.py));
  pos.set(u"z", Value(e.pz));
  Object o;
  o.set(u"id", Value(e.id));
  o.set(u"position", Value(std::make_shared<Object>(pos)));
  return Value(std::make_shared<Object>(o));
}

}  // namespace bot
}  // namespace lfw
