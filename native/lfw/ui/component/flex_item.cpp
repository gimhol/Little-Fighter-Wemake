#include "lfw/ui/component/flex_item.h"

#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

namespace {

const Value& field(const Value& obj, const char16_t* key) {
  static const Value kUndef;
  const Object* const o = as_object(obj);
  if (o == nullptr) return kUndef;
  const Value* const p = o->get(std::u16string(key));
  return p != nullptr ? *p : kUndef;
}

}

const ClazzTag* FlexItem::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& FlexItem::TAGS() {
  static const std::vector<std::u16string> tags{u"FlexItem"};
  return tags;
}

const std::u16string& FlexItem::props_tag() const {
  static const std::u16string tag = u"FlexItem";
  return tag;
}

const Value& FlexItem::props_meta() const {
  static const Value meta = [] {
    auto prop = std::make_shared<Object>();
    prop->set(u"type", Value(u"string"));
    auto oneof = std::make_shared<Array>();
    for (const std::u16string& v : ALL_FLEX_ALIGN()) oneof->push_back(Value(v));
    prop->set(u"oneof", Value(oneof));
    auto o = std::make_shared<Object>();
    o->set(u"align", Value(prop));
    return Value(o);
  }();
  return meta;
}

std::optional<std::u16string> FlexItem::align() {
  const Value* const p = props();
  if (p == nullptr) return std::nullopt;
  const std::u16string* const s = std::get_if<std::u16string>(&field(*p, u"align"));
  if (s == nullptr) return std::nullopt;
  return *s;
}

}
}
