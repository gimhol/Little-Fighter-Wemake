#include "lfw/ui/component/component_registry.h"

#include <memory>
#include <string>

#include "lfw/ui/component/fade_in_opacity.h"
#include "lfw/ui/component/focus_behavior.h"
#include "lfw/ui/component/hover_behavior.h"
#include "lfw/ui/component/opacity_hover.h"
#include "lfw/ui/component/sine_opacity.h"

namespace lfw {
namespace ui {

namespace {

template <typename T>
void regist_one(const char16_t* name) {
  regist_ui_class(T::class_tag(), name);
  static const ComponentCreatorT<T> creator;
  Factory::register_component(std::u16string(name), &creator);
}

}

void regist_components() {
  static bool registed = false;
  if (registed) return;
  registed = true;

  regist_one<FocusBehavior>(u"FocusBehavior");
  regist_one<HoverBehavior>(u"HoverBehavior");
  regist_one<OpacityHover>(u"OpacityHover");
  regist_one<SineOpacity>(u"SineOpacity");
  regist_one<FadeInOpacity>(u"FadeInOpacity");
}

}
}
