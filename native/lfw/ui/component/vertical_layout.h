#pragma once

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/VerticalLayout.ts`：args[0] = gap（`num(0) || 0`）。
class VerticalLayout : public UIComponent {
 public:
  static constexpr const char* TAG = "VerticalLayout";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  double gap() { return num(0).value_or(0.0); }
  void update(double dt) override;
};

}
}
