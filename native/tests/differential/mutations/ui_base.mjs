// `ui_base`（UI 叶层）的变异档：颜色 / 文本解析 / CrossInfo。
//
// 用例：`cases/ui_base/{color,parse,cross}.txt`（任一锁住即可）。
export default {
  subject: "ui_base",
  mutations: [
    {
      note: "hex_to_rgba：4 位缩写不再摊成 8 位",
      file: "native/lfw/ui/color.cpp",
      from: `  } else if (hex.size() == 4) {`,
      to: `  } else if (hex.size() == 5) {`,
    },
    {
      note: "hex_to_rgba：6 位不再认",
      file: "native/lfw/ui/color.cpp",
      from: `  if (hex.size() == 6) {`,
      to: `  if (hex.size() == 7) {`,
    },
    {
      note: "parseInt 的 radix 丢了（hex 里按 10 进制读）",
      file: "native/lfw/ui/color.cpp",
      from: `    return make_rgba(js_parse_int(hex.substr(0, 2), 16), js_parse_int(hex.substr(2, 2), 16),
                     js_parse_int(hex.substr(4, 2), 16), 1);`,
      to: `    return make_rgba(js_parse_int(hex.substr(0, 2)), js_parse_int(hex.substr(2, 2)),
                     js_parse_int(hex.substr(4, 2)), 1);`,
    },
    {
      note: "int_to_rgba：alpha 除以 256",
      file: "native/lfw/ui/color.cpp",
      from: `  const double a = ((n >> 24) & 0xff) / 255.0;`,
      to: `  const double a = ((n >> 24) & 0xff) / 256.0;`,
    },
    {
      note: "int_to_rgba：r 取错字节",
      file: "native/lfw/ui/color.cpp",
      from: `  const double r = static_cast<double>((n >> 16) & 0xff);`,
      to: `  const double r = static_cast<double>((n >> 8) & 0xff);`,
    },
    {
      note: "parse_rgba：不转小写",
      file: "native/lfw/ui/color.cpp",
      from: `  std::u16string out = s.substr(b, e - b);
  for (char16_t& c : out) {
    if (c >= u'A' && c <= u'Z') c = static_cast<char16_t>(c - u'A' + u'a');
  }
  return out;`,
      to: `  std::u16string out = s.substr(b, e - b);
  return out;`,
    },
    {
      note: "parse_rgba：rgba 的 alpha 改用 parseInt",
      file: "native/lfw/ui/color.cpp",
      from: `                      comma_count == 3 ? js_parse_float(parts[3]) : 1);`,
      to: `                      comma_count == 3 ? js_parse_int(parts[3]) : 1);`,
    },
    {
      note: "parse_rgba：argb 的 alpha 取错下标",
      file: "native/lfw/ui/color.cpp",
      from: `      ret = make_rgba(js_parse_int(parts[1]), js_parse_int(parts[2]), js_parse_int(parts[3]),
                      js_parse_float(parts[0]));`,
      to: `      ret = make_rgba(js_parse_int(parts[1]), js_parse_int(parts[2]), js_parse_int(parts[3]),
                      js_parse_float(parts[1]));`,
    },
    {
      note: "parse_call_func_expression：参数取第一个 ')'（不再贪婪）",
      file: "native/lfw/ui/ui_parse.cpp",
      from: `  const size_t close = text.rfind(u')');`,
      to: `  const size_t close = text.find(u')');`,
    },
    {
      note: "parse_call_func_expression：名字取第一个 '('（不再贪婪）",
      file: "native/lfw/ui/ui_parse.cpp",
      from: `  size_t open = text.rfind(u'(', close == 0 ? 0 : close);`,
      to: `  size_t open = text.find(u'(', pos);`,
    },
    {
      note: "parse_call_func_expression：id 的 '>' 不再贪婪",
      file: "native/lfw/ui/ui_parse.cpp",
      from: `      const size_t first_gt = text.find(u'>', start + 1);
      size_t gt = text.rfind(u'>');`,
      to: `      const size_t first_gt = text.find(u'>', start + 1);
      size_t gt = text.find(u'>', start + 1);`,
    },
    {
      note: "parse_call_func_expression：空 name 不再直接 null",
      file: "native/lfw/ui/ui_parse.cpp",
      from: `        if (matched) {
          if (name.empty()) return std::nullopt;`,
      to: `        if (matched) {
          if (false && name.empty()) return std::nullopt;`,
    },
    {
      note: "read_func_args：最小参数个数判断放宽",
      file: "native/lfw/ui/ui_parse.cpp",
      from: `  if (min_arg_count >= 0 && min_arg_count > static_cast<double>(args.size())) return std::nullopt;`,
      to: `  if (min_arg_count >= 0 && min_arg_count >= static_cast<double>(args.size())) return std::nullopt;`,
    },
    {
      note: "read_func_args：函数名后的 '[' 写错",
      file: "native/lfw/ui/ui_parse.cpp",
      from: `  const std::u16string needle = func_name + u"(";`,
      to: `  const std::u16string needle = func_name + u"[";`,
    },
    {
      note: "CrossInfo::compare：mid_y 比法反了",
      file: "native/lfw/ui/cross_info.cpp",
      from: `  return left != o.left || top != o.top || right != o.right || bottom != o.bottom ||
         mid_x != o.mid_x || mid_y != o.mid_y;`,
      to: `  return left != o.left || top != o.top || right != o.right || bottom != o.bottom ||
         mid_x != o.mid_x || mid_y == o.mid_y;`,
    },
  ],
};
