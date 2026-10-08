#include "lfw/ui/ui_load_img.h"

#include <memory>
#include <vector>

#include "lfw/lfw.h"
#include "lfw/ui/validate_ui_img_info.h"
#include "lfw/ui/value_spread.h"

namespace lfw::ui {

namespace {

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// `[x, y, w, h, dw, dh, flip_x, flip_y].join()`：nullish 项给空串，其余 `String(v)`。
std::u16string join_fields(const Value* const* fields, size_t n) {
  std::u16string out;
  for (size_t i = 0; i < n; ++i) {
    if (i != 0) out.push_back(u',');
    const Value* const v = fields[i];
    if (v == nullptr || nullish(*v)) continue;
    out += to_string(*v);
  }
  return out;
}

bool truthy_field(const Value* const v) { return v != nullptr && truthy(*v); }

}

bool ui_load_img(LFW& lfw, const Value& img, Value& out, std::u16string& error) {
  std::vector<std::u16string> errors;
  validate_ui_img_info(img, &errors);
  if (!errors.empty()) {
    error.clear();
    for (size_t i = 0; i < errors.size(); ++i) {
      if (i != 0) error.push_back(u'\n');
      error += errors[i];
    }
    return false;
  }

  const Value* const path = field_of(img, u"path");
  const Value* const x = field_of(img, u"x");
  const Value* const y = field_of(img, u"y");
  const Value* const w = field_of(img, u"w");
  const Value* const h = field_of(img, u"h");
  const Value* const dw = field_of(img, u"dw");
  const Value* const dh = field_of(img, u"dh");
  const Value* const flip_x = field_of(img, u"flip_x");
  const Value* const flip_y = field_of(img, u"flip_y");
  // `flip_x = 0` / `flip_y = 0` 的默认只吃 `undefined`（`null` 留给假值判定）。
  const Value flip_x_eff = flip_x != nullptr ? *flip_x : Value(0.0);
  const Value flip_y_eff = flip_y != nullptr ? *flip_y : Value(0.0);

  const Value* const fields[] = {x, y, w, h, dw, dh, &flip_x_eff, &flip_y_eff};
  const std::u16string md5 = lfw.host().md5(join_fields(fields, 8));
  const std::u16string path_text = to_string(path != nullptr ? *path : Value());
  const std::u16string img_key = path_text + u"?x=" + md5;

  auto ops = std::make_shared<Array>();
  if (truthy_field(dw) || truthy_field(dh)) {
    auto op = std::make_shared<Object>();
    op->set(u"type", Value(u"crop"));
    spread_into(*op, img);
    ops->push_back(Value(op));
  }
  if (truthy_field(flip_x) || truthy_field(flip_y)) {
    auto op = std::make_shared<Object>();
    op->set(u"type", Value(u"flip"));
    op->set(u"x", flip_x_eff);
    op->set(u"y", flip_y_eff);
    ops->push_back(Value(op));
  }

  if (!lfw.host().ui_image_load(img_key, path != nullptr ? *path : Value(), Value(ops), out,
                                error)) {
    return false;
  }
  lfw.host().ui_image_pin(img_key);
  return true;
}

}
