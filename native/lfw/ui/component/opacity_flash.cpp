#include "lfw/ui/component/opacity_flash.h"

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

// TS 缺省 `steps`（props 未给时）。
constexpr double kDefaultSteps[] = {0,   350, 1, 100, 1, 350, 0, 350, 1, 100,
                                    1,   350, 0, 350, 1, 100, 1, 350, 0};

}

const ClazzTag* OpacityFlash::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& OpacityFlash::TAGS() {
  static const std::vector<std::u16string> tags{u"OpacityFlash"};
  return tags;
}

const std::u16string& OpacityFlash::props_tag() const {
  static const std::u16string tag = u"OpacityFlash";
  return tag;
}

const Value& OpacityFlash::props_meta() const {
  static const Value meta = [] {
    auto steps = std::make_shared<Object>();
    steps->set(u"key", Value(u"steps"));
    steps->set(u"type", Value(u"array"));
    auto items = std::make_shared<Object>();
    items->set(u"type", Value(u"number"));
    steps->set(u"items", Value(items));
    steps->set(u"nullable", Value(true));
    steps->set(u"description", Value(u"透明度1, 动画时间，透明度2...."));

    auto times = std::make_shared<Object>();
    times->set(u"key", Value(u"times"));
    times->set(u"type", Value(u"number"));
    times->set(u"nullable", Value(true));
    auto number = std::make_shared<Object>();
    number->set(u"int", Value(true));
    times->set(u"number", Value(number));
    times->set(u"description", Value(u"循环次数，小于0时，无限循环"));

    auto o = std::make_shared<Object>();
    o->set(u"steps", Value(steps));
    o->set(u"times", Value(times));
    return Value(o);
  }();
  return meta;
}

void OpacityFlash::on_start() {
  std::vector<Value> steps;
  bool has_steps = false;
  double times = 1.0;
  if (const Value* const p = props()) {
    if (const Array* const arr = as_array(field(*p, u"steps"))) {
      has_steps = true;
      for (size_t k = 0; k < arr->size(); ++k) steps.push_back(arr->at(k));
    }
    const Value& tv = field(*p, u"times");
    if (const double* const n = std::get_if<double>(&tv)) times = *n;
  }
  if (!has_steps) {
    for (const double v : kDefaultSteps) steps.push_back(Value(v));
  }

  std::vector<Animation*> anims;
  std::vector<std::unique_ptr<Animation>> owned;
  for (size_t i = 1; i < steps.size(); i += 2) {
    if (i + 1 >= steps.size()) break;
    const double* const duration = std::get_if<double>(&steps[i]);
    const double* const next_o = std::get_if<double>(&steps[i + 1]);
    if (next_o == nullptr) break;
    if (duration == nullptr) break;
    const double prev_o = to_number(steps[i - 1]);
    if (prev_o == *next_o) {
      std::unique_ptr<Delay> a = std::make_unique<Delay>(*next_o);
      a->set_duration(*duration);
      anims.push_back(a.get());
      owned.push_back(std::move(a));
    } else {
      std::unique_ptr<Easing> a = std::make_unique<Easing>(prev_o, *next_o);
      a->set_duration(*duration);
      a->set_easing(ease_linearity);
      anims.push_back(a.get());
      owned.push_back(std::move(a));
    }
  }
  _anim = Sequence(anims);
  _owned = std::move(owned);
  _anim.loop().set_times(times);
}

void OpacityFlash::update(double dt) {
  node.set_opacity(_anim.update(dt).value());
}

void OpacityFlash::start() {
  _anim.start(false);
  set_enabled(true);
}

void OpacityFlash::stop() {
  set_enabled(false);
}

void OpacityFlash::replay() {
  _anim.start(false);
  set_enabled(true);
}

}
}
