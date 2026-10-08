#pragma once

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/PauseHandling.ts`：props = `{ reverse }` —— 按世界暂停状态切 visible。
class PauseHandling : public UIComponent {
 public:
  static constexpr const char* TAG = "PauseHandling";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override;

  void update(double dt) override;
};

}
}
