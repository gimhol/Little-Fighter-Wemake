#include "lfw/ui/component/fade_out_opacity.h"

#include "lfw/animation/delay.h"
#include "lfw/animation/easing.h"
#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

const ClazzTag* FadeOutOpacity::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& FadeOutOpacity::TAGS() {
  static const std::vector<std::u16string> tags{u"FadeOutOpacity"};
  return tags;
}

void FadeOutOpacity::on_start() {
  std::vector<Animation*> anims;
  std::vector<std::unique_ptr<Animation>> owned;
  std::unique_ptr<Delay> d = std::make_unique<Delay>(node.opacity());
  d->set_duration(num(1).value_or(0.0));
  anims.push_back(d.get());
  owned.push_back(std::move(d));
  std::unique_ptr<Easing> e = std::make_unique<Easing>(node.opacity(), 0.0);
  e->set_duration(num(0).value_or(1000.0));
  anims.push_back(e.get());
  owned.push_back(std::move(e));
  _anim = Sequence(anims);
  _owned = std::move(owned);
}

void FadeOutOpacity::update(double dt) {
  _anim.update(dt);
  node.set_opacity(_anim.value());
  if (_anim.done()) set_enabled(false);
}

void FadeOutOpacity::start(std::optional<bool> reverse) {
  set_enabled(true);
  _anim.start(reverse);
}

}
}
