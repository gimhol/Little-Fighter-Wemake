#include "lfw/ui/component/opacity_animation.h"

#include "lfw/animation/delay.h"
#include "lfw/animation/easing.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/easing/ease_linearity.h"

namespace lfw {
namespace ui {

namespace {

const Value& undef() {
  static const Value v;
  return v;
}

const Value& field(const Value& obj, const char16_t* key) {
  const Object* const o = as_object(obj);
  if (o == nullptr) return undef();
  const Value* const p = o->get(std::u16string(key));
  return p != nullptr ? *p : undef();
}

}

const ClazzTag* OpacityAnimation::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& OpacityAnimation::TAGS() {
  static const std::vector<std::u16string> tags{u"OpacityAnimation"};
  return tags;
}

void OpacityAnimation::on_start() {
  std::vector<Animation*> anims;
  std::vector<std::unique_ptr<Animation>> owned;
  const Array* const args = as_array(field(info, u"args"));
  const long len = args != nullptr ? static_cast<long>(args->size()) : 0;
  for (long i = 0; i < len - 2; i += 2) {
    const double opacity = num(static_cast<size_t>(2 + i)).value_or(0.0);
    const double duration = num(static_cast<size_t>(2 + i + 1)).value_or(0.0);
    const double prev_opacity = num(static_cast<size_t>(2 + i - 2)).value_or(opacity);
    if (prev_opacity == opacity) {
      std::unique_ptr<Delay> a = std::make_unique<Delay>(opacity);
      a->set_duration(duration);
      anims.push_back(a.get());
      owned.push_back(std::move(a));
    } else {
      std::unique_ptr<Easing> a = std::make_unique<Easing>(prev_opacity, opacity);
      a->set_duration(duration);
      a->set_easing(ease_linearity);
      anims.push_back(a.get());
      owned.push_back(std::move(a));
    }
  }
  _anim = Sequence(anims);
  _anim.set_fill_mode(1);
  _owned = std::move(owned);

  const bool is_play = bool_(0);
  const bool is_reverse = bool_(1);
  if (is_play) {
    _anim.start(is_reverse);
  } else {
    _anim.end(is_reverse);
  }
}

void OpacityAnimation::update(double dt) {
  if (!_anim.done()) node.set_opacity(_anim.update(dt).value());
  if (_anim.done()) set_enabled(false);
}

void OpacityAnimation::start(std::optional<bool> r) {
  _anim.start(r);
  node.set_opacity(_anim.value());
  set_enabled(true);
}

void OpacityAnimation::stop(std::optional<bool> r) {
  _anim.end(r);
  node.set_opacity(_anim.value());
  set_enabled(false);
}

}
}
