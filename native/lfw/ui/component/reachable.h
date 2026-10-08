#pragma once

#include <string>

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

class ReachableGroup;

// TS `ui/component/Reachable.ts`：args = [group] —— 可被同组 `ReachableGroup` 焦点导航。
class Reachable : public UIComponent {
 public:
  static constexpr const char* TAG = "Reachable";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  std::u16string group_name();
  ReachableGroup* group();
};

}
}
