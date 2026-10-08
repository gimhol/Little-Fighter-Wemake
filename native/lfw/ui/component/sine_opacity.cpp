#include "lfw/ui/component/sine_opacity.h"

#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

namespace {

// `Number.MAX_SAFE_INTEGER`
constexpr double kMaxSafeInteger = 9007199254740991.0;

}

const ClazzTag* SineOpacity::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& SineOpacity::TAGS() {
  static const std::vector<std::u16string> tags{u"SineOpacity"};
  return tags;
}

void SineOpacity::on_start() {
  anim.set(num(0).value_or(0.0), num(1).value_or(1.0), num(2).value_or(1.0))
      .set_offset(num(4).value_or(0.0))
      .set_duration(num(3).value_or(kMaxSafeInteger));
}

void SineOpacity::update(double dt) {
  anim.update(dt);
  node.set_opacity(anim.value());
  if (anim.done()) set_enabled(false);
}

}
}
