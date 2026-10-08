#pragma once

#include <memory>
#include <string>
#include <vector>

#include "lfw/animation/sequence.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/OpacityFlash.ts`（`IPlayable`：start/stop/replay）。
// props：`steps`（透明度1, 时间1, 透明度2, 时间2, …）+ `times`（循环次数，<0 无限）。
class OpacityFlash : public UIComponent {
 public:
  static constexpr const char* TAG = "OpacityFlash";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override;

  void on_start() override;
  void update(double dt) override;

  void start();
  void stop();
  void replay();

  Sequence& anim() { return _anim; }

 protected:
  Sequence _anim;
  std::vector<std::unique_ptr<Animation>> _owned;
};

}
}
