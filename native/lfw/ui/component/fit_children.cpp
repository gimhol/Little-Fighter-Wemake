#include "lfw/ui/component/fit_children.h"

#include "lfw/ui/uinode.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace ui {

const ClazzTag* FitChildren::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& FitChildren::TAGS() {
  static const std::vector<std::u16string> tags{u"FitChildren"};
  return tags;
}

void FitChildren::on_resume() {
  apply();
}

void FitChildren::update(double dt) {
  (void)dt;
  apply();
}

void FitChildren::apply() {
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
  node.resize(w, h);
  const double cx = w != 0 ? -min_left / w : 0;
  const double cy = h != 0 ? -min_top / h : 0;
  node.set_center(cx, cy);
}

}
}
