#include "lfw/ui/component/vertical_layout.h"

#include <array>
#include <vector>

#include "lfw/ui/uinode.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace ui {

const ClazzTag* VerticalLayout::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& VerticalLayout::TAGS() {
  static const std::vector<std::u16string> tags{u"VerticalLayout"};
  return tags;
}

void VerticalLayout::update(double dt) {
  (void)dt;
  double max_w = 0;
  double max_h = 0;

  const double cx = node.center.x;
  const double cy = node.center.y;
  std::vector<std::array<double, 3>> pos_list;
  for (UINode* const item : node.children()) {
    if (!item->visible()) continue;
    const double w = item->w();
    const double h = item->h();
    const double z = item->z();
    const double icx = item->center.x;
    const double icy = item->center.y;
    pos_list.insert(pos_list.begin(), {(1 - icx) * w, max_h + (1 - icy) * h, z});
    max_h += item->h() + gap();
    max_w = max(max_w, item->w());
  }

  for (UINode* const item : node.children()) {
    if (!item->visible()) continue;
    const double h = item->h();
    const std::array<double, 3> p = pos_list.back();
    pos_list.pop_back();
    const double yy = p[1] - cy * max_h - h;
    const double xx = cx * max_w - p[0];
    item->move_to(xx, yy, p[2]);
  }
  node.resize(max_w, max_h);
}

}
}
