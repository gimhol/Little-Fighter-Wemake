#include "lfw/ui/component/pause_handling.h"

#include "lfw/ui/uinode.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

const ClazzTag* PauseHandling::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& PauseHandling::TAGS() {
  static const std::vector<std::u16string> tags{u"PauseHandling"};
  return tags;
}

const std::u16string& PauseHandling::props_tag() const {
  static const std::u16string tag = u"PauseHandling";
  return tag;
}

const Value& PauseHandling::props_meta() const {
  static const Value meta = [] {
    auto prop = std::make_shared<Object>();
    prop->set(u"type", Value(u"boolean"));
    prop->set(u"nullable", Value(true));
    auto o = std::make_shared<Object>();
    o->set(u"reverse", Value(prop));
    return Value(o);
  }();
  return meta;
}

void PauseHandling::update(double dt) {
  (void)dt;
  bool reverse = false;
  if (props() != nullptr) {
    const std::optional<bool> r = props_holder.bool_(u"reverse");
    reverse = r.has_value() && *r;
  }
  const bool paused = world().paused();
  node.set_visible(reverse ? !paused : paused);
}

}
}
