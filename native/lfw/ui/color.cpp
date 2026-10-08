#include "lfw/ui/color.h"

#include <cmath>
#include <limits>
#include <map>
#include <utility>
#include <vector>

namespace lfw::ui {

namespace {

// JS `parseInt(str[, radix])`（`radix=0` = 自动：认 `0x`/`0X` 前缀为 16 进制）。
double js_parse_int(const std::u16string& src, int radix = 0) {
  size_t i = 0;
  while (i < src.size() && (src[i] == u' ' || src[i] == u'\t' || src[i] == u'\n' ||
                            src[i] == u'\r' || src[i] == u'\f' || src[i] == u'\v')) {
    ++i;
  }
  bool negative = false;
  if (i < src.size() && (src[i] == u'+' || src[i] == u'-')) {
    negative = src[i] == u'-';
    ++i;
  }
  int base = radix;
  if (base == 0) base = 10;
  if (i + 1 < src.size() && src[i] == u'0' && (src[i + 1] == u'x' || src[i + 1] == u'X') &&
      (radix == 0 || radix == 16)) {
    base = 16;
    i += 2;
  }
  double value = 0;
  bool any = false;
  for (; i < src.size(); ++i) {
    const char16_t c = src[i];
    int digit = -1;
    if (c >= u'0' && c <= u'9') digit = c - u'0';
    else if (base == 16 && c >= u'a' && c <= u'f') digit = c - u'a' + 10;
    else if (base == 16 && c >= u'A' && c <= u'F') digit = c - u'A' + 10;
    if (digit < 0 || digit >= base) break;
    value = value * base + digit;
    any = true;
  }
  if (!any) return std::nan("");
  return negative ? -value : value;
}

// JS `parseFloat(str)`。
double js_parse_float(const std::u16string& src) {
  size_t i = 0;
  while (i < src.size() && (src[i] == u' ' || src[i] == u'\t' || src[i] == u'\n' ||
                            src[i] == u'\r' || src[i] == u'\f' || src[i] == u'\v')) {
    ++i;
  }
  const size_t start = i;
  bool negative = false;
  if (i < src.size() && (src[i] == u'+' || src[i] == u'-')) {
    negative = src[i] == u'-';
    ++i;
  }
  if (src.compare(i, 8, u"Infinity") == 0) {
    const double inf = std::numeric_limits<double>::infinity();
    return negative ? -inf : inf;
  }
  double value = 0;
  bool any = false;
  for (; i < src.size(); ++i) {
    const char16_t c = src[i];
    if (c < u'0' || c > u'9') break;
    value = value * 10 + (c - u'0');
    any = true;
  }
  if (i < src.size() && src[i] == u'.') {
    ++i;
    double scale = 0.1;
    for (; i < src.size(); ++i) {
      const char16_t c = src[i];
      if (c < u'0' || c > u'9') break;
      value += (c - u'0') * scale;
      scale /= 10;
      any = true;
    }
  }
  if (!any) return std::nan("");
  if (i < src.size() && (src[i] == u'e' || src[i] == u'E')) {
    const size_t exp_start = i;
    ++i;
    bool exp_negative = false;
    if (i < src.size() && (src[i] == u'+' || src[i] == u'-')) {
      exp_negative = src[i] == u'-';
      ++i;
    }
    double exponent = 0;
    bool exp_any = false;
    for (; i < src.size(); ++i) {
      const char16_t c = src[i];
      if (c < u'0' || c > u'9') break;
      exponent = exponent * 10 + (c - u'0');
      exp_any = true;
    }
    if (!exp_any) {
      i = exp_start;
    } else {
      value *= std::pow(10.0, exp_negative ? -exponent : exponent);
    }
  }
  (void)start;
  return negative ? -value : value;
}

std::u16string js_trim_lower(const std::u16string& s) {
  size_t b = 0;
  size_t e = s.size();
  const auto is_ws = [](char16_t c) {
    return c == u' ' || c == u'\t' || c == u'\n' || c == u'\r' || c == u'\f' || c == u'\v';
  };
  while (b < e && is_ws(s[b])) ++b;
  while (e > b && is_ws(s[e - 1])) --e;
  std::u16string out = s.substr(b, e - b);
  for (char16_t& c : out) {
    if (c >= u'A' && c <= u'Z') c = static_cast<char16_t>(c - u'A' + u'a');
  }
  return out;
}

using StringMap = std::map<std::u16string, std::optional<Rgba>>;
using NumberMap = std::map<double, std::optional<Rgba>>;

StringMap& string_map() {
  static StringMap m = [] {
    // TS 的 `COLOR_HEX_MAP`（含拼写里的尾随空格，如 `Indigo `）。
    static const std::vector<std::pair<const char16_t*, const char16_t*>> kColors = {
        {u"Black", u"#000000"},         {u"Navy", u"#000080"},
        {u"DarkBlue", u"#00008B"},      {u"MediumBlue", u"#0000CD"},
        {u"Blue", u"#0000FF"},          {u"DarkGreen", u"#006400"},
        {u"Green", u"#008000"},         {u"Teal", u"#008080"},
        {u"DarkCyan", u"#008B8B"},      {u"DeepSkyBlue", u"#00BFFF"},
        {u"DarkTurquoise", u"#00CED1"}, {u"MediumSpringGreen", u"#00FA9A"},
        {u"Lime", u"#00FF00"},          {u"SpringGreen", u"#00FF7F"},
        {u"Aqua", u"#00FFFF"},          {u"Cyan", u"#00FFFF"},
        {u"MidnightBlue", u"#191970"},  {u"DodgerBlue", u"#1E90FF"},
        {u"LightSeaGreen", u"#20B2AA"},{u"ForestGreen", u"#228B22"},
        {u"SeaGreen", u"#2E8B57"},      {u"DarkSlateGray", u"#2F4F4F"},
        {u"LimeGreen", u"#32CD32"},     {u"MediumSeaGreen", u"#3CB371"},
        {u"Turquoise", u"#40E0D0"},     {u"RoyalBlue", u"#4169E1"},
        {u"SteelBlue", u"#4682B4"},     {u"DarkSlateBlue", u"#483D8B"},
        {u"MediumTurquoise", u"#48D1CC"},{u"Indigo ", u"#4B0082"},
        {u"DarkOliveGreen", u"#556B2F"},{u"CadetBlue", u"#5F9EA0"},
        {u"CornflowerBlue", u"#6495ED"},{u"MediumAquaMarine", u"#66CDAA"},
        {u"DimGray", u"#696969"},       {u"SlateBlue", u"#6A5ACD"},
        {u"OliveDrab", u"#6B8E23"},     {u"SlateGray", u"#708090"},
        {u"LightSlateGray", u"#778899"},{u"MediumSlateBlue", u"#7B68EE"},
        {u"LawnGreen", u"#7CFC00"},     {u"Chartreuse", u"#7FFF00"},
        {u"Aquamarine", u"#7FFFD4"},    {u"Maroon", u"#800000"},
        {u"Purple", u"#800080"},        {u"Olive", u"#808000"},
        {u"Gray", u"#808080"},          {u"SkyBlue", u"#87CEEB"},
        {u"LightSkyBlue", u"#87CEFA"},  {u"BlueViolet", u"#8A2BE2"},
        {u"DarkRed", u"#8B0000"},       {u"DarkMagenta", u"#8B008B"},
        {u"SaddleBrown", u"#8B4513"},   {u"DarkSeaGreen", u"#8FBC8F"},
        {u"LightGreen", u"#90EE90"},    {u"MediumPurple", u"#9370DB"},
        {u"DarkViolet", u"#9400D3"},    {u"PaleGreen", u"#98FB98"},
        {u"DarkOrchid", u"#9932CC"},    {u"YellowGreen", u"#9ACD32"},
        {u"Sienna", u"#A0522D"},        {u"Brown", u"#A52A2A"},
        {u"DarkGray", u"#A9A9A9"},      {u"LightBlue", u"#ADD8E6"},
        {u"GreenYellow", u"#ADFF2F"},   {u"PaleTurquoise", u"#AFEEEE"},
        {u"LightSteelBlue", u"#B0C4DE"},{u"PowderBlue", u"#B0E0E6"},
        {u"FireBrick", u"#B22222"},     {u"DarkGoldenRod", u"#B8860B"},
        {u"MediumOrchid", u"#BA55D3"},  {u"RosyBrown", u"#BC8F8F"},
        {u"DarkKhaki", u"#BDB76B"},     {u"Silver", u"#C0C0C0"},
        {u"MediumVioletRed", u"#C71585"},{u"IndianRed ", u"#CD5C5C"},
        {u"Peru", u"#CD853F"},          {u"Chocolate", u"#D2691E"},
        {u"Tan", u"#D2B48C"},           {u"LightGray", u"#D3D3D3"},
        {u"Thistle", u"#D8BFD8"},       {u"Orchid", u"#DA70D6"},
        {u"GoldenRod", u"#DAA520"},     {u"PaleVioletRed", u"#DB7093"},
        {u"Crimson", u"#DC143C"},       {u"Gainsboro", u"#DCDCDC"},
        {u"Plum", u"#DDA0DD"},          {u"BurlyWood", u"#DEB887"},
        {u"LightCyan", u"#E0FFFF"},     {u"Lavender", u"#E6E6FA"},
        {u"DarkSalmon", u"#E9967A"},    {u"Violet", u"#EE82EE"},
        {u"PaleGoldenRod", u"#EEE8AA"},{u"LightCoral", u"#F08080"},
        {u"Khaki", u"#F0E68C"},         {u"AliceBlue", u"#F0F8FF"},
        {u"HoneyDew", u"#F0FFF0"},      {u"Azure", u"#F0FFFF"},
        {u"SandyBrown", u"#F4A460"},    {u"Wheat", u"#F5DEB3"},
        {u"Beige", u"#F5F5DC"},         {u"WhiteSmoke", u"#F5F5F5"},
        {u"MintCream", u"#F5FFFA"},     {u"GhostWhite", u"#F8F8FF"},
        {u"Salmon", u"#FA8072"},        {u"AntiqueWhite", u"#FAEBD7"},
        {u"Linen", u"#FAF0E6"},         {u"LightGoldenRodYellow", u"#FAFAD2"},
        {u"OldLace", u"#FDF5E6"},       {u"Red", u"#FF0000"},
        {u"Fuchsia", u"#FF00FF"},       {u"Magenta", u"#FF00FF"},
        {u"DeepPink", u"#FF1493"},      {u"OrangeRed", u"#FF4500"},
        {u"Tomato", u"#FF6347"},        {u"HotPink", u"#FF69B4"},
        {u"Coral", u"#FF7F50"},         {u"DarkOrange", u"#FF8C00"},
        {u"LightSalmon", u"#FFA07A"},   {u"Orange", u"#FFA500"},
        {u"LightPink", u"#FFB6C1"},     {u"Pink", u"#FFC0CB"},
        {u"Gold", u"#FFD700"},          {u"PeachPuff", u"#FFDAB9"},
        {u"NavajoWhite", u"#FFDEAD"},   {u"Moccasin", u"#FFE4B5"},
        {u"Bisque", u"#FFE4C4"},        {u"MistyRose", u"#FFE4E1"},
        {u"BlanchedAlmond", u"#FFEBCD"},{u"PapayaWhip", u"#FFEFD5"},
        {u"LavenderBlush", u"#FFF0F5"},{u"SeaShell", u"#FFF5EE"},
        {u"Cornsilk", u"#FFF8DC"},      {u"LemonChiffon", u"#FFFACD"},
        {u"FloralWhite", u"#FFFAF0"},   {u"Snow", u"#FFFAFA"},
        {u"Yellow", u"#FFFF00"},        {u"LightYellow", u"#FFFFE0"},
        {u"Ivory", u"#FFFFF0"},         {u"White", u"#FFFFFF"},
        {u"Transparent", u"#00000000"},
    };
    StringMap m;
    for (const auto& [name, hex] : kColors) {
      const std::u16string hex_str(hex);
      const std::optional<Rgba> value = hex_to_rgba(hex_str.substr(1));
      m[std::u16string(name)] = value;
      std::u16string upper = name;
      std::u16string lower = name;
      for (char16_t& c : upper) {
        if (c >= u'a' && c <= u'z') c = static_cast<char16_t>(c - u'a' + u'A');
      }
      for (char16_t& c : lower) {
        if (c >= u'A' && c <= u'Z') c = static_cast<char16_t>(c - u'A' + u'a');
      }
      m[upper] = value;
      m[lower] = value;
    }
    return m;
  }();
  return m;
}

NumberMap& number_map() {
  static NumberMap m;
  return m;
}

// `^rgba\((.*),(.*),(.*),(.*)\)$`：用「从右往左取 3 个逗号」复刻贪婪分组。
bool split_last(const std::u16string& s, int count, std::vector<std::u16string>& out) {
  out.assign(static_cast<size_t>(count) + 1, std::u16string());
  size_t end = s.size();
  for (int k = count; k > 0; --k) {
    const size_t idx = s.rfind(u',', end == 0 ? 0 : end - 1);
    if (idx == std::u16string::npos) return false;
    out[static_cast<size_t>(k)] = s.substr(idx + 1, end - idx - 1);
    end = idx;
  }
  out[0] = s.substr(0, end);
  return true;
}

Rgba make_rgba(double r, double g, double b, double a) { return Rgba{r, g, b, a}; }

}  // namespace

std::optional<Rgba> hex_to_rgba(const std::u16string& hex_in) {
  std::u16string hex = hex_in;
  size_t b = 0;
  size_t e = hex.size();
  const auto is_ws = [](char16_t c) {
    return c == u' ' || c == u'\t' || c == u'\n' || c == u'\r' || c == u'\f' || c == u'\v';
  };
  while (b < e && is_ws(hex[b])) ++b;
  while (e > b && is_ws(hex[e - 1])) --e;
  hex = hex.substr(b, e - b);
  if (hex.size() == 3) {
    hex = std::u16string{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]};
  } else if (hex.size() == 4) {
    hex = std::u16string{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2], hex[3], hex[3]};
  }
  if (hex.size() == 6) {
    return make_rgba(js_parse_int(hex.substr(0, 2), 16), js_parse_int(hex.substr(2, 2), 16),
                     js_parse_int(hex.substr(4, 2), 16), 1);
  }
  if (hex.size() == 8) {
    return make_rgba(js_parse_int(hex.substr(0, 2), 16), js_parse_int(hex.substr(2, 2), 16),
                     js_parse_int(hex.substr(4, 2), 16),
                     js_parse_int(hex.substr(6, 2), 16) / 255);
  }
  return std::nullopt;
}

std::optional<Rgba> int_to_rgba(double num) {
  if (std::isnan(num) || std::isinf(num) || num != std::floor(num) || num < 0) {
    return std::nullopt;
  }
  const long long n = static_cast<long long>(num);
  const double a = ((n >> 24) & 0xff) / 255.0;
  const double r = static_cast<double>((n >> 16) & 0xff);
  const double g = static_cast<double>((n >> 8) & 0xff);
  const double b = static_cast<double>(n & 0xff);
  return make_rgba(r, g, b, a);
}

RgbaLookup rgba_map_get(const Value& key) {
  RgbaLookup out;
  if (const std::u16string* const s = std::get_if<std::u16string>(&key)) {
    const auto it = string_map().find(*s);
    if (it == string_map().end()) return out;
    out.found = true;
    if (!it->second.has_value()) {
      out.is_null = true;
      return out;
    }
    out.value = *it->second;
    return out;
  }
  if (const double* const d = std::get_if<double>(&key)) {
    const auto it = number_map().find(*d);
    if (it == number_map().end()) return out;
    out.found = true;
    if (!it->second.has_value()) {
      out.is_null = true;
      return out;
    }
    out.value = *it->second;
    return out;
  }
  return out;
}

RgbaLookup parse_rgba(const Value& raw) {
  RgbaLookup out;
  if (std::holds_alternative<std::monostate>(raw) || std::holds_alternative<NullTag>(raw)) {
    return out;
  }
  if (const double* const num = std::get_if<double>(&raw)) {
    const auto known = number_map().find(*num);
    if (known != number_map().end() && known->second.has_value()) {
      out.found = true;
      out.value = *known->second;
      return out;
    }
    const std::optional<Rgba> ret = int_to_rgba(*num);
    number_map()[*num] = ret;
    if (!ret.has_value()) return out;  // TS `return ret`（null）
    out.found = true;
    out.value = *ret;
    return out;
  }
  const std::u16string* const str = std::get_if<std::u16string>(&raw);
  if (str == nullptr) return out;
  const std::u16string lowered = js_trim_lower(*str);
  {
    const auto known = string_map().find(lowered);
    if (known != string_map().end() && known->second.has_value()) {
      out.found = true;
      out.value = *known->second;
      return out;
    }
  }
  if (!lowered.empty() && lowered[0] == u'#') {
    const std::optional<Rgba> ret = hex_to_rgba(lowered.substr(1));
    string_map()[lowered] = ret;
    if (!ret.has_value()) return out;
    out.found = true;
    out.value = *ret;
    return out;
  }
  const auto try_call = [&](const char16_t* const head, int comma_count, bool argb) -> bool {
    const std::u16string prefix(head);
    if (lowered.size() < prefix.size() + 1) return false;
    if (lowered.compare(0, prefix.size(), prefix) != 0) return false;
    if (lowered.back() != u')') return false;
    const std::u16string inner = lowered.substr(prefix.size(), lowered.size() - prefix.size() - 1);
    std::vector<std::u16string> parts;
    if (!split_last(inner, comma_count, parts)) return false;
    Rgba ret;
    if (argb) {
      ret = make_rgba(js_parse_int(parts[1]), js_parse_int(parts[2]), js_parse_int(parts[3]),
                      js_parse_float(parts[0]));
    } else {
      ret = make_rgba(js_parse_int(parts[0]), js_parse_int(parts[1]), js_parse_int(parts[2]),
                      comma_count == 3 ? js_parse_float(parts[3]) : 1);
    }
    string_map()[lowered] = ret;
    out.found = true;
    out.value = ret;
    return true;
  };
  if (try_call(u"rgba(", 3, false)) return out;
  if (try_call(u"argb(", 3, true)) return out;
  if (try_call(u"rgb(", 2, false)) return out;
  return out;
}

}
