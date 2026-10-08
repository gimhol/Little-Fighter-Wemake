#include "lfw/ui/component/hover_behavior.h"

#include <memory>
#include <string>

#include "lfw/core/js_string.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/string_help.h"

namespace lfw {
namespace ui {

const ClazzTag* HoverBehavior::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& HoverBehavior::TAGS() {
  static const std::vector<std::u16string> tags{u"HoverBehavior"};
  return tags;
}

const std::u16string& HoverBehavior::props_tag() const {
  static const std::u16string tag = u"HoverBehavior";
  return tag;
}

const Value& HoverBehavior::props_meta() const {
  static const Value meta = [] {
    auto prop = std::make_shared<Object>();
    prop->set(u"type", Value(u"string"));
    prop->set(u"nullable", Value(true));
    auto o = std::make_shared<Object>();
    o->set(u"behavior", Value(prop));
    return Value(o);
  }();
  return meta;
}

std::u16string HoverBehavior::behavior() {
  const Value* const p = props();
  if (p == nullptr) return u"default";
  const Object* const o = as_object(*p);
  const Value* const b = o != nullptr ? o->get(u"behavior") : nullptr;
  const std::u16string* const s = b != nullptr ? std::get_if<std::u16string>(b) : nullptr;
  if (s == nullptr) return u"default";
  const std::u16string t = to_lower_case(js_trim(*s));
  return t.empty() ? u"default" : t;
}

void HoverBehavior::on_pointer_enter() {
  if (behavior() == u"focus") node.set_focused(true);
}

void HoverBehavior::on_pointer_leave() {
  // `BehaviorMap['focus'][1]` 是空函数。
}

}
}
