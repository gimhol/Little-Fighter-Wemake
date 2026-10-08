#include "lfw/ui/component/wrap_content.h"

#include "lfw/ui/uinode.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace ui {

const ClazzTag* WrapContent::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& WrapContent::TAGS() {
  static const std::vector<std::u16string> tags{u"WrapContent"};
  return tags;
}

const std::u16string& WrapContent::props_tag() const {
  static const std::u16string tag = u"WrapContent";
  return tag;
}

const Value& WrapContent::props_meta() const {
  static const Value meta = [] {
    auto wrap_height = std::make_shared<Object>();
    wrap_height->set(u"type", Value(u"boolean"));
    wrap_height->set(u"nullable", Value(true));
    auto wrap_width = std::make_shared<Object>();
    wrap_width->set(u"type", Value(u"boolean"));
    wrap_width->set(u"nullable", Value(true));
    auto o = std::make_shared<Object>();
    o->set(u"wrapHeight", Value(wrap_height));
    o->set(u"wrapWidth", Value(wrap_width));
    return Value(o);
  }();
  return meta;
}

void WrapContent::on_resume() {
  apply();
}

void WrapContent::update(double dt) {
  (void)dt;
  apply();
}

void WrapContent::apply() {
  props();
  double min_left = 0;
  double min_top = 0;
  double max_right = 0;
  double max_bottom = 0;
  for (UINode* const child : node.children()) {
    if (!child->visible()) continue;
    const UINode::Rect& r = child->rect();
    min_left = min(r.left, min_left);
    max_right = max(r.right, max_right);
    min_top = min(r.top, min_top);
    max_bottom = max(r.bottom, max_bottom);
  }
  const double w = max_right - min_left;
  const double h = max_bottom - min_top;
  const double cx = w != 0 ? -min_left / w : 0;
  const double cy = h != 0 ? -min_top / h : 0;
  node.resize(w, h);
  node.set_center(cx, cy);
}

}
}
