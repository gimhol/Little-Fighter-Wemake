#include "lfw/ui/component/horizontal_layout.h"

#include "lfw/ui/uinode.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace ui {

const ClazzTag* HorizontalLayout::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& HorizontalLayout::TAGS() {
  static const std::vector<std::u16string> tags{u"HorizontalLayout"};
  return tags;
}

void HorizontalLayout::update(double dt) {
  (void)dt;
  double w = 0;
  double h = 0;
  for (UINode* const l : node.children()) {
    if (!l->visible()) continue;
    const double y = l->pos.y;
    const double z = l->z();
    l->move_to(w, y, z);
    w += l->w();
    h = max(h, l->h());
  }
  node.resize(w, h);
  UINode* const p = node.parent();
  if (p != nullptr) {
    node.move_to((p->w() - w) / 2, (p->h() - h) / 2);
  }
}

}
}
