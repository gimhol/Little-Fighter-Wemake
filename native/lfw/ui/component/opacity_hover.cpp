#include "lfw/ui/component/opacity_hover.h"

#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

const ClazzTag* OpacityHover::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& OpacityHover::TAGS() {
  static const std::vector<std::u16string> tags{u"OpacityHover"};
  return tags;
}

void OpacityHover::on_start() {
  const double normal = num(0).value_or(anim.val_1());
  const double hover = num(1).value_or(anim.val_2());
  const double duration = num(2).value_or(anim.duration());
  anim.set(normal, hover).set_duration(duration).set_reverse(false);
  _p = num(3);
}

void OpacityHover::update(double dt) {
  UINode& watching = (_p.has_value() && *_p != 0.0) ? *node.parent() : node;
  const bool reverse =
      ((watching.pointer_over() == 0 && !watching.focused()) || watching.pointer_down() != 0);
  node.set_opacity(anim.auto_trip(reverse, dt).value());
}

}
}
