#pragma once

#include <map>
#include <memory>
#include <optional>
#include <utility>
#include <vector>

#include "lfw/animation/sequence.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/ScaleAnimation.ts`：args = [play?, reverse?, (x,y,z), duration, (x,y,z), duration, …]。
class ScaleAnimation : public UIComponent {
 public:
  static constexpr const char* TAG = "ScaleAnimation";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  void on_start() override;
  void update(double dt) override;

  void start(std::optional<bool> v = std::nullopt);
  bool is_end() const { return _seq_anim.done(); }

  Sequence& seq_anim() { return _seq_anim; }

 protected:
  Sequence _seq_anim;
  std::vector<std::unique_ptr<Animation>> _owned;
  std::map<const Animation*, std::pair<Vector3, Vector3>> _values;
};

}
}
