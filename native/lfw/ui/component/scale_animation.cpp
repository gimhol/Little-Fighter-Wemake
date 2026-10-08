#include "lfw/ui/component/scale_animation.h"

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

const ClazzTag* ScaleAnimation::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& ScaleAnimation::TAGS() {
  static const std::vector<std::u16string> tags{u"ScaleAnimation"};
  return tags;
}

void ScaleAnimation::on_start() {
  const Array* const args = as_array(field(info, u"args"));
  const long len = args != nullptr ? static_cast<long>(args->size()) : 0;
  std::vector<Animation*> anims;
  std::vector<std::unique_ptr<Animation>> owned;
  _values.clear();
  for (long i = 0; i < len - 2; i += 2) {
    const Vector3 scale = vec3(static_cast<size_t>(i + 2)).value_or(node.scale);
    const double duration = num(static_cast<size_t>(i + 3)).value_or(0.0);
    const Vector3 prev_scale =
        i == 0 ? scale : vec3(static_cast<size_t>(i)).value_or(scale);
    if (scale.equals(prev_scale)) {
      std::unique_ptr<Delay> a = std::make_unique<Delay>(0.0);
      a->set_duration(duration);
      _values[a.get()] = {prev_scale, scale.clone().sub(prev_scale)};
      anims.push_back(a.get());
      owned.push_back(std::move(a));
    } else {
      std::unique_ptr<Easing> a = std::make_unique<Easing>(0.0, 1.0);
      a->set_duration(duration);
      a->set_easing(ease_linearity);
      _values[a.get()] = {prev_scale, scale.clone().sub(prev_scale)};
      anims.push_back(a.get());
      owned.push_back(std::move(a));
    }
  }
  _seq_anim = Sequence(anims);
  _seq_anim.set_fill_mode(1);
  _owned = std::move(owned);

  const bool is_play = bool_(0);
  const bool is_reverse = bool_(1);
  if (is_play) {
    _seq_anim.start(is_reverse);
  } else {
    _seq_anim.end(is_reverse);
  }
}

void ScaleAnimation::update(double dt) {
  if (!_seq_anim.done()) {
    _seq_anim.update(dt);
    const auto it = _values.find(_seq_anim.curr_anim());
    if (it == _values.end()) return;
    const double value = _seq_anim.value();
    const Vector3& a = it->second.first;
    const Vector3& b = it->second.second;
    node.set_scale(a.x + b.x * value, a.y + b.y * value, a.z + b.z * value);
  } else {
    set_enabled(false);
  }
}

void ScaleAnimation::start(std::optional<bool> v) {
  _seq_anim.start(v);
  set_enabled(true);
}

}
}
