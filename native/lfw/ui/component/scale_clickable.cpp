#include "lfw/ui/component/scale_clickable.h"

#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

const ClazzTag* ScaleClickable::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& ScaleClickable::TAGS() {
  static const std::vector<std::u16string> tags{u"ScaleClickable"};
  return tags;
}

void ScaleClickable::on_start() {
  normal_scale = num(0).value_or(normal_scale);
  hover_scale = num(1).value_or(hover_scale);
  const double duration = num(2).value_or(anim.duration());
  anim.set(normal_scale, hover_scale).set_duration(duration).set_reverse(false);
  _p = num(3);
}

void ScaleClickable::update(double dt) {
  UINode& watching = (_p.has_value() && *_p != 0.0) ? *node.parent() : node;

  anim.set_val_1(watching.pointer_down() != 0 ? press_scale : normal_scale);
  const bool reverse =
      (watching.pointer_over() == 0 && !watching.focused()) || watching.pointer_down() != 0;
  const double value = anim.auto_trip(reverse, dt).value();
  node.set_scale(value, value, value);
}

}
}
