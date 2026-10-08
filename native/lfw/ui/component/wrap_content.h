#pragma once

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/WrapContent.ts`：props = `{ wrapWidth?, wrapHeight? }`（当前仅参与校验）。
class WrapContent : public UIComponent {
 public:
  static constexpr const char* TAG = "WrapContent";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override;

  void on_resume() override;
  void update(double dt) override;
  void apply();
};

}
}
