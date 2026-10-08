#pragma once

#include <string>
#include <vector>

#include "lfw/animation/easing.h"
#include "lfw/defines/i_rect.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

// TS `ui/component/ImgLoop.ts`：props = `{ w, h, col?, row?, count?, duration? }`。
class ImgLoop : public UIComponent {
 public:
  static constexpr const char* TAG = "ImgLoop";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  ImgLoop(UINode& layout, const std::u16string& f_name, const Value& info);

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override;

  Easing& anim() { return _anim; }
  std::vector<IRect>& rects() { return _rects; }

  void on_start() override;
  void update(double dt) override;

  void stop();
  void start();

 protected:
  Easing _anim{0, 1};
  std::vector<IRect> _rects;
};

}
}
