#pragma once

#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/ui_img_loader.h"

namespace lfw {
namespace ui {

// TS `ui/component/Picture.ts`（TAGS = ["Picture", "Image"]）：props = `{ width?, height? }`。
class Picture : public UIComponent, public IUIImgLoaderNode {
 public:
  static constexpr const char* TAG = "Picture";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  Picture(UINode& layout, const std::u16string& f_name, const Value& info);

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override;

  double width();
  double height();
  std::u16string src();
  void set_src(const std::u16string& v);
  void set_width(double w);
  void set_height(double h);

  // `IUIImgLoaderNode`
  LFW& lfw() override;
  void set_image(const Value& image) override;
  void resize(double w, double h) override;

  UIImgLoader& img_loader() { return _img_loader; }

 protected:
  UIImgLoader _img_loader;
};

}
}
