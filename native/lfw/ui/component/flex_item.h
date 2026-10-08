#pragma once

#include <optional>
#include <string>

#include "lfw/ui/component/flex_align.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/FlexItem.ts`：props = `{ align }`（`oneof` 四个对齐值）。
class FlexItem : public UIComponent {
 public:
  static constexpr const char* TAG = "FlexItem";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override;

  std::optional<std::u16string> align();
};

}
}
