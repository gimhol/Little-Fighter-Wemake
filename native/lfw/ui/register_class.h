#pragma once

#include <string>
#include <vector>

#include "lfw/utils/is_class.h"

namespace lfw {
namespace ui {

// TS `ui/utils/isUIComponentClass.ts` / `isUINodeClass.ts`：JS 直接比构造函数（`instanceof`），
// 端口只有 `ClazzTag` 链 ⇒ 额外维护「类名 → 标签」登记表：schema 里的 `$cls:<类名>` 标记
// 靠它复原出类身份（`is_class(tag, UIComponent::class_tag())` 之类）。
//
// 每个类在自身 .cpp 里注册一次（静态初始化，构造任何实例之前）；台面/组件族的假类由各自注册。
struct UIClassEntry {
  const ClazzTag* tag = nullptr;
  std::u16string name;
};

inline std::vector<UIClassEntry>& ui_class_registry() {
  static std::vector<UIClassEntry> list;
  return list;
}

inline void regist_ui_class(const ClazzTag* tag, const char16_t* name) {
  for (UIClassEntry& e : ui_class_registry()) {
    if (e.name == name) {
      e.tag = tag;
      return;
    }
  }
  ui_class_registry().push_back(UIClassEntry{tag, std::u16string(name)});
}

inline const ClazzTag* find_ui_class(const std::u16string& name) {
  for (const UIClassEntry& e : ui_class_registry()) {
    if (e.name == name) return e.tag;
  }
  return nullptr;
}

}
}
