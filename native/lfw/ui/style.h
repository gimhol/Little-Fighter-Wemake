#pragma once

#include <map>
#include <memory>

#include "lfw/core/value.h"

namespace lfw::ui {

// TS `ui/Style.ts`。`_data` 是普通对象（IStyle 用 `Value` 对象表示，字段名与 TS 一致）。
// 版本号语义：任何**实际变化**（含 `touch`/`data` 赋值）都 +1；setter 用 JS 的**宽松**
// `==` 比较（`6 == '6'` 不计数），`assign` 用**严格** `===`。
class Style {
 public:
  Style() = default;

  // `Style.from(v)`：同一个对象恒返回同一个包装（端口按对象指针缓存）。
  // 非对象入参 TS 会在 `WeakMap.set` 抛；端口改为返回一份临时包装（偏差，见 DESIGN）。
  static Style& from(const Value& v);
  static Style& from(Style& s) { return s; }

  double version() const { return _version; }
  const Value& data() const { return _data; }
  // `this.data = v`（v 是 Style 时做**浅拷贝**，否则直接引用）。
  void set_data(const Value& v);
  void set_data(Style& other);
  // `assign(props)`：逐键严格比较，变了才 +版本。
  void assign(const Value& props);
  /** 手动递增版本号 */
  void touch() { ++_version; }

  Value padding_t() const { return get_field(u"padding_t"); }
  void set_padding_t(const Value& v) { set_field(u"padding_t", v); }
  Value padding_b() const { return get_field(u"padding_b"); }
  void set_padding_b(const Value& v) { set_field(u"padding_b", v); }
  Value padding_l() const { return get_field(u"padding_l"); }
  void set_padding_l(const Value& v) { set_field(u"padding_l", v); }
  Value padding_r() const { return get_field(u"padding_r"); }
  void set_padding_r(const Value& v) { set_field(u"padding_r", v); }
  Value line_width() const { return get_field(u"line_width"); }
  void set_line_width(const Value& v) { set_field(u"line_width", v); }
  Value fill_style() const { return get_field(u"fill_style"); }
  void set_fill_style(const Value& v) { set_field(u"fill_style", v); }
  Value stroke_style() const { return get_field(u"stroke_style"); }
  void set_stroke_style(const Value& v) { set_field(u"stroke_style", v); }
  Value font() const { return get_field(u"font"); }
  void set_font(const Value& v) { set_field(u"font", v); }
  Value text_align() const { return get_field(u"text_align"); }
  void set_text_align(const Value& v) { set_field(u"text_align", v); }
  Value scale() const { return get_field(u"scale"); }
  void set_scale(const Value& v) { set_field(u"scale", v); }
  Value shadow_color() const { return get_field(u"shadow_color"); }
  void set_shadow_color(const Value& v) { set_field(u"shadow_color", v); }
  Value shadow_blur() const { return get_field(u"shadow_blur"); }
  void set_shadow_blur(const Value& v) { set_field(u"shadow_blur", v); }
  Value shadow_offset_x() const { return get_field(u"shadow_offset_x"); }
  void set_shadow_offset_x(const Value& v) { set_field(u"shadow_offset_x", v); }
  Value shadow_offset_y() const { return get_field(u"shadow_offset_y"); }
  void set_shadow_offset_y(const Value& v) { set_field(u"shadow_offset_y", v); }
  Value smoothing() const { return get_field(u"smoothing"); }
  void set_smoothing(const Value& v) { set_field(u"smoothing", v); }
  Value underline_color() const { return get_field(u"underline_color"); }
  void set_underline_color(const Value& v) { set_field(u"underline_color", v); }
  Value underline_width() const { return get_field(u"underline_width"); }
  void set_underline_width(const Value& v) { set_field(u"underline_width", v); }
  Value line_cap() const { return get_field(u"line_cap"); }
  void set_line_cap(const Value& v) { set_field(u"line_cap", v); }
  Value line_dash_offset() const { return get_field(u"line_dash_offset"); }
  void set_line_dash_offset(const Value& v) { set_field(u"line_dash_offset", v); }
  Value line_join() const { return get_field(u"line_join"); }
  void set_line_join(const Value& v) { set_field(u"line_join", v); }
  Value miter_limit() const { return get_field(u"miter_limit"); }
  void set_miter_limit(const Value& v) { set_field(u"miter_limit", v); }
  Value direction() const { return get_field(u"direction"); }
  void set_direction(const Value& v) { set_field(u"direction", v); }
  Value font_kerning() const { return get_field(u"font_kerning"); }
  void set_font_kerning(const Value& v) { set_field(u"font_kerning", v); }
  Value font_stretch() const { return get_field(u"font_stretch"); }
  void set_font_stretch(const Value& v) { set_field(u"font_stretch", v); }
  Value font_variant_caps() const { return get_field(u"font_variant_caps"); }
  void set_font_variant_caps(const Value& v) { set_field(u"font_variant_caps", v); }
  Value letter_spacing() const { return get_field(u"letter_spacing"); }
  void set_letter_spacing(const Value& v) { set_field(u"letter_spacing", v); }
  Value text_baseline() const { return get_field(u"text_baseline"); }
  void set_text_baseline(const Value& v) { set_field(u"text_baseline", v); }
  Value text_rendering() const { return get_field(u"text_rendering"); }
  void set_text_rendering(const Value& v) { set_field(u"text_rendering", v); }
  Value word_spacing() const { return get_field(u"word_spacing"); }
  void set_word_spacing(const Value& v) { set_field(u"word_spacing", v); }

 private:
  Value get_field(const char16_t* key) const;
  void set_field(const char16_t* key, const Value& v);

  double _version = 0;
  Value _data = Value(std::make_shared<Object>());
};

}
