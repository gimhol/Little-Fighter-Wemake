#pragma once

namespace lfw {

// TS `ui/utils/isClass.ts` 的端口模型：JS 靠原型链比对构造函数，C++ 没有 RTTI
// （构建关掉了 `/GR-`）⇒ 用显式的类标签链：每个类自带一个 `ClazzTag`，`parent` 指向基类标签。
// `nullptr` = JS 的 `Function.prototype`（链的终点）。
struct ClazzTag {
  const ClazzTag* parent = nullptr;
};

inline bool is_class(const ClazzTag* cls, const ClazzTag* clazz) {
  for (const ClazzTag* c = cls; c != nullptr; c = c->parent) {
    if (c == clazz) return true;
  }
  return false;
}

}
