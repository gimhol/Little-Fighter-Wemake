#include "lfw/ui/component/reachable.h"

#include "lfw/ui/component/reachable_group.h"
#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

const ClazzTag* Reachable::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& Reachable::TAGS() {
  static const std::vector<std::u16string> tags{u"Reachable"};
  return tags;
}

std::u16string Reachable::group_name() {
  const std::optional<std::u16string> s = str(0);
  return s.has_value() ? *s : u"";
}

ReachableGroup* Reachable::group() {
  const std::u16string name = group_name();
  UIComponent* const found = node.root().lookup_component(
      ReachableGroup::class_tag(), [&name](UIComponent& v) { return v.name == name; });
  return found != nullptr ? static_cast<ReachableGroup*>(found) : nullptr;
}

}
}
