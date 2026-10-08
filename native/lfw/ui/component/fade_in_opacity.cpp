#include "lfw/ui/component/fade_in_opacity.h"

#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

const ClazzTag* FadeInOpacity::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& FadeInOpacity::TAGS() {
  static const std::vector<std::u16string> tags{u"FadeInOpacity"};
  return tags;
}

void FadeInOpacity::on_start() {
  anim.set_duration(num(0).value_or(0.0));
  anim.set_val_1(node.opacity());
}

void FadeInOpacity::update(double dt) {
  anim.update(dt);
  node.set_opacity(anim.value());
}

}
}
