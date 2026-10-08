#pragma once

#include <string>
#include <vector>

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

class Reachable;
class UINode;

// TS `ui/component/ReachableGroup.ts`：args = [group, direction(lr/ud), binded_layout_id?]。
class ReachableGroup : public UIComponent {
 public:
  static constexpr const char* TAG = "ReachableGroup";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }

  std::u16string group();
  std::u16string direction();
  UINode& binded_layout();

  void on_start() override;
  void on_key_down(LFWKeyEvent& e) override;
  void focus_prev();
  void focus_next();

  std::vector<Reachable*>& reachables() { return _reachables; }

 protected:
  std::vector<Reachable*> _reachables;
};

}
}
