#pragma once

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/FitChildren.ts`：按子节点 rect 的包围盒收尺寸并调 center。
class FitChildren : public UIComponent {
 public:
  static constexpr const char* TAG = "FitChildren";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  void on_resume() override;
  void update(double dt) override;
  void apply();
};

}
}
