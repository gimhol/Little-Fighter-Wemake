#include "lfw/ui/ui_img_loader.h"

#include <cmath>
#include <memory>

#include "lfw/lfw.h"
#include "lfw/ui/ui_load_img.h"
#include "lfw/ui/value_spread.h"

namespace lfw::ui {

UIImgLoader& UIImgLoader::ignore_out_of_date() {
  // TS：`this._jid.max = this._jid.min = this._jid.value = 0;`（右到左赋值，结果同下）
  _jid.set_max(0.0);
  _jid.set_min(0.0);
  _jid.set_value(0.0);
  return *this;
}

UIImgLoadResult UIImgLoader::load(const Value& uiimg) {
  UIImgLoadResult result;
  _jid.add();
  const double jid = _jid.value();
  IUIImgLoaderNode* const node = _node ? _node() : nullptr;
  if (node == nullptr) {
    result.error = u"[UIImgLoader::load] node got null";
    return result;
  }
  if (jid != _jid.value()) {
    result.error = u"out_of_date";
    result.out_of_date = true;
    return result;
  }

  Value imgs;
  std::u16string error;
  if (!ui_load_img(node->lfw(), uiimg, imgs, error)) {
    result.error = error;
    return result;
  }
  if (jid != _jid.value()) {
    result.error = u"out_of_date";
    result.out_of_date = true;
    result.texture = imgs;
    return result;
  }

  // `const { w, h, scale } = imgs;`：缺字段 ⇒ `undefined`，除法给 `NaN`。
  const auto num_of = [&](const char16_t* key) -> double {
    const Value* const v = field_of(imgs, key);
    const double* const d = v != nullptr ? std::get_if<double>(v) : nullptr;
    return d != nullptr ? *d : std::nan("");
  };
  const double w = num_of(u"w");
  const double h = num_of(u"h");
  const double scale = num_of(u"scale");
  node->set_image(imgs);
  node->resize(w / scale, h / scale);
  result.ok = true;
  result.image = imgs;
  return result;
}

UIImgLoadResult UIImgLoader::set_img(const std::u16string& path) {
  // `this.load({ path })`
  auto o = std::make_shared<Object>();
  o->set(u"path", Value(path));
  return load(Value(o));
}

}
