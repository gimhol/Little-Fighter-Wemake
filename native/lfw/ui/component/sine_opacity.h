#pragma once

#include "lfw/animation/sine.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/SineOpacity.ts`：args = [min, max, scale, duration, offset]。
class SineOpacity : public UIComponent {
 public:
  static constexpr const char* TAG = "SineOpacity";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  void on_start() override;
  void update(double dt) override;

 protected:
  Sine anim{0, 1, 1};
};

}
}
