#pragma once

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/HorizontalLayout.ts`：横排子节点并把自己居中到父节点。
class HorizontalLayout : public UIComponent {
 public:
  static constexpr const char* TAG = "HorizontalLayout";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  void update(double dt) override;
};

}
}
