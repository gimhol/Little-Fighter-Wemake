#include "lfw/ui/component/reachable_group.h"

#include <algorithm>

#include "lfw/ui/component/reachable.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace ui {

const ClazzTag* ReachableGroup::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& ReachableGroup::TAGS() {
  static const std::vector<std::u16string> tags{u"ReachableGroup"};
  return tags;
}

std::u16string ReachableGroup::group() {
  const std::optional<std::u16string> s = str(0);
  return s.has_value() ? *s : u"";
}

std::u16string ReachableGroup::direction() {
  const std::optional<std::u16string> s = str(1);
  return s.has_value() ? *s : u"";
}

UINode& ReachableGroup::binded_layout() {
  const std::u16string lid = str(2).value_or(u"");
  if (lid.empty()) return node;
  UINode* const found = node.root().find_child(lid);
  return found != nullptr ? *found : node;
}

void ReachableGroup::on_start() {
  const std::u16string grp = group();
  std::vector<UIComponent*> const found = node.root().search_components(
      Reachable::class_tag(),
      [&grp](UIComponent& v) { return static_cast<Reachable&>(v).group_name() == grp ? UIFind::Yes : UIFind::No; });
  _reachables.clear();
  for (UIComponent* const c : found) _reachables.push_back(static_cast<Reachable*>(c));
  const std::u16string dir = direction();
  if (dir == u"lr") {
    std::sort(_reachables.begin(), _reachables.end(), [](Reachable* const a, Reachable* const b) {
      return a->node.global_pos().x < b->node.global_pos().x;
    });
  } else if (dir == u"ud") {
    std::sort(_reachables.begin(), _reachables.end(), [](Reachable* const a, Reachable* const b) {
      return a->node.global_pos().y < b->node.global_pos().y;
    });
  }
}

void ReachableGroup::on_key_down(LFWKeyEvent& e) {
  const std::u16string& key = e.game_key;
  if (!binded_layout().visible()) return;
  if (binded_layout().disabled()) return;
  const std::u16string dir = direction();
  if (dir == u"lr") {
    if (key != u"L" && key != u"R") return;
  } else if (dir == u"ud") {
    if (key != u"U" && key != u"D") return;
  } else {
    return;
  }
  if (key == u"L" || key == u"U") {
    focus_prev();
  } else if (key == u"R" || key == u"D") {
    focus_next();
  }
}

void ReachableGroup::focus_prev() {
  std::vector<UINode*> items;
  for (Reachable* const v : _reachables) {
    if (v->node.visible() && !v->node.disabled()) items.push_back(&v->node);
  }
  if (items.empty()) return;
  UINode* const focused_layout = node.focused_node();
  long idx = -1;
  for (size_t k = 0; k < items.size(); ++k) {
    if (items[k] == focused_layout) {
      idx = static_cast<long>(k);
      break;
    }
  }
  const long count = static_cast<long>(items.size());
  const long next_idx = (std::max<long>(idx, 0) + count - 1) % count;
  items[static_cast<size_t>(next_idx)]->set_focused(true);
}

void ReachableGroup::focus_next() {
  std::vector<UINode*> items;
  for (Reachable* const v : _reachables) {
    if (v->node.visible() && !v->node.disabled()) items.push_back(&v->node);
  }
  if (items.empty()) return;
  UINode* const focused_layout = node.focused_node();
  long idx = -1;
  for (size_t k = 0; k < items.size(); ++k) {
    if (items[k] == focused_layout) {
      idx = static_cast<long>(k);
      break;
    }
  }
  const long count = static_cast<long>(items.size());
  const long next_idx = (idx + 1) % count;
  items[static_cast<size_t>(next_idx)]->set_focused(true);
}

}
}
