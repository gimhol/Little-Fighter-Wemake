#include "lfw/ui/component/picture.h"

#include "lfw/lfw.h"
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

const ClazzTag* Picture::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& Picture::TAGS() {
  static const std::vector<std::u16string> tags{u"Picture", u"Image"};
  return tags;
}

const std::u16string& Picture::props_tag() const {
  static const std::u16string tag = u"Picture";
  return tag;
}

const Value& Picture::props_meta() const {
  static const Value meta = [] {
    auto width = std::make_shared<Object>();
    width->set(u"type", Value(u"number"));
    width->set(u"nullable", Value(true));
    auto height = std::make_shared<Object>();
    height->set(u"type", Value(u"number"));
    height->set(u"nullable", Value(true));
    auto o = std::make_shared<Object>();
    o->set(u"width", Value(width));
    o->set(u"height", Value(height));
    return Value(o);
  }();
  return meta;
}

Picture::Picture(UINode& layout, const std::u16string& f_name, const Value& info)
    : UIComponent(layout, f_name, info), _img_loader([this]() -> IUIImgLoaderNode* { return this; }) {}

double Picture::width() {
  const Value* const p = props();
  if (p != nullptr) {
    const Value& v = field(*p, u"width");
    if (const double* const d = std::get_if<double>(&v)) return *d;
  }
  return node.w();
}

double Picture::height() {
  const Value* const p = props();
  if (p != nullptr) {
    const Value& v = field(*p, u"height");
    if (const double* const d = std::get_if<double>(&v)) return *d;
  }
  return node.h();
}

std::u16string Picture::src() {
  const Value& image = node.image();
  const Object* const o = as_object(image);
  const Value* const s = o != nullptr ? o->get(u"src") : nullptr;
  if (s != nullptr) {
    if (const std::u16string* const text = std::get_if<std::u16string>(s)) return *text;
  }
  return u"";
}

void Picture::set_src(const std::u16string& v) {
  auto info = std::make_shared<Object>();
  info->set(u"path", Value(v));
  info->set(u"dw", Value(width()));
  info->set(u"dh", Value(height()));
  const UIImgLoadResult result = _img_loader.load(Value(info));
  if (!result.ok) {
    // TS: `.catch(e => Ditto.warn('[Picture::set_src]' + e))`
    const std::u16string text = result.out_of_date ? u"Error: out_of_date" : u"Error: " + result.error;
    lfw().host().warn({Value(u"[Picture::set_src]" + text)});
  }
}

void Picture::set_width(double w) {
  ensure_props();
  props_holder.set_num(u"width", Value(w));
}

void Picture::set_height(double h) {
  ensure_props();
  props_holder.set_num(u"height", Value(h));
}

LFW& Picture::lfw() {
  return UIComponent::lfw();
}

void Picture::set_image(const Value& image) {
  node.set_image(image);
}

void Picture::resize(double w, double h) {
  node.resize(w, h);
}

}
}
