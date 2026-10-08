#pragma once

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/HoverBehavior.ts`：`behavior="focus"` ⇒ 指针进入时聚焦。
class HoverBehavior : public UIComponent {
 public:
  static constexpr const char* TAG = "HoverBehavior";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override;

  // `props.behavior?.trim().toLowerCase() || 'default'`
  std::u16string behavior();
  void on_pointer_enter() override;
  void on_pointer_leave() override;
};

}
}
