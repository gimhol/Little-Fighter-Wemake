#pragma once

#include <memory>
#include <optional>
#include <vector>

#include "lfw/animation/sequence.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/OpacityAnimation.ts`：args = [play?, reverse?, opacity1, duration1, opacity2, duration2, …]。
class OpacityAnimation : public UIComponent {
 public:
  static constexpr const char* TAG = "OpacityAnimation";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  void on_start() override;
  void update(double dt) override;

  void start(std::optional<bool> r = std::nullopt);
  void stop(std::optional<bool> r = std::nullopt);

  Sequence& anim() { return _anim; }
  bool done() const { return _anim.done(); }

 protected:
  Sequence _anim;
  std::vector<std::unique_ptr<Animation>> _owned;
};

}
}
