#pragma once

#include <optional>

#include "lfw/animation/easing.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/ScaleClickable.ts`：args = [normal?, hover?, duration?, watch_parent?]。
class ScaleClickable : public UIComponent {
 public:
  static constexpr const char* TAG = "ScaleClickable";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  // TS 成员初始化：`new Easing(normal, hover).set_duration(100)`。
  ScaleClickable(UINode& layout, const std::u16string& f_name, const Value& info)
      : UIComponent(layout, f_name, info) {
    anim.set_duration(100);
  }

  const ClazzTag* clazz() const override { return class_tag(); }

  void on_start() override;
  void update(double dt) override;

  Easing& anim_ref() { return anim; }

 protected:
  double normal_scale = 1;
  double hover_scale = 1.1;
  double press_scale = 0.9;
  Easing anim{1, 1.1};
  std::optional<double> _p;
};

}
}
