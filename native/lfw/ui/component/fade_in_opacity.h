#pragma once

#include "lfw/animation/easing.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/FadeInOpacity.ts`：args = [duration]（缺省 0）。
class FadeInOpacity : public UIComponent {
 public:
  static constexpr const char* TAG = "FadeInOpacity";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  void on_start() override;
  void update(double dt) override;

 protected:
  Easing anim{0, 1};
};

}
}
