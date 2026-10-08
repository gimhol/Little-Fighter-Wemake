#include "lfw/ui/component/component_registry.h"

#include <memory>
#include <string>

#include "lfw/ui/component/fade_in_opacity.h"
#include "lfw/ui/component/fade_out_opacity.h"
#include "lfw/ui/component/fit_children.h"
#include "lfw/ui/component/flex_item.h"
#include "lfw/ui/component/focus_behavior.h"
#include "lfw/ui/component/horizontal_layout.h"
#include "lfw/ui/component/hover_behavior.h"
#include "lfw/ui/component/opacity_animation.h"
#include "lfw/ui/component/opacity_flash.h"
#include "lfw/ui/component/opacity_hover.h"
#include "lfw/ui/component/pause_handling.h"
#include "lfw/ui/component/position_animation.h"
#include "lfw/ui/component/scale_animation.h"
#include "lfw/ui/component/scale_clickable.h"
#include "lfw/ui/component/sine_opacity.h"
#include "lfw/ui/component/vertical_layout.h"
#include "lfw/ui/component/wrap_content.h"

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
  regist_one<FadeOutOpacity>(u"FadeOutOpacity");
  regist_one<OpacityAnimation>(u"OpacityAnimation");
  regist_one<OpacityFlash>(u"OpacityFlash");
  regist_one<ScaleAnimation>(u"ScaleAnimation");
  regist_one<PositionAnimation>(u"PositionAnimation");
  regist_one<ScaleClickable>(u"ScaleClickable");
  regist_one<PauseHandling>(u"PauseHandling");
  regist_one<FlexItem>(u"FlexItem");
  regist_one<VerticalLayout>(u"VerticalLayout");
  regist_one<HorizontalLayout>(u"HorizontalLayout");
  regist_one<FitChildren>(u"FitChildren");
  regist_one<WrapContent>(u"WrapContent");
}

}
}
