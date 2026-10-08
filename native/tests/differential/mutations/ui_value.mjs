// `ui_value`（read_info_value）的变异档。
//
// 用例：`cases/ui_value/value.txt`（任一锁住即可）。
export default {
  subject: "ui_value",
  mutations: [
    {
      note: "find_ui_value：先查 template_values（顺序反了）",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `    const char16_t* const group = pass == 0 ? u"values" : u"template_values";`,
      to: `    const char16_t* const group = pass == 0 ? u"template_values" : u"values";`,
    },
    {
      note: "find_ui_value：nullish 的值不再跳过",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `      if (value != nullptr && !nullish(*value)) return *value;`,
      to: `      if (value != nullptr) return *value;`,
    },
    {
      note: "find_ui_value：不沿 parent 上溯",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `      const Value* const parent = obj->get(u"parent");
      if (parent == nullptr) break;
      current = *parent;`,
      to: `      const Value* const parent = obj->get(u"parent");
      if (parent == nullptr) break;
      current = Value();`,
    },
    {
      note: "is_0_or_1：只认 0",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `      return strict_equals(v, Value(0.0)) || strict_equals(v, Value(1.0));`,
      to: `      return strict_equals(v, Value(0.0));`,
    },
    {
      note: "unsafe_is_object：数组也算对象",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `      return is_obj && !is_array(v);`,
      to: `      return is_obj;`,
    },
    {
      note: "unsafe_is_array：取反",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `    case UIJudger::UnsafeIsArray:
      return is_array(v);`,
      to: `    case UIJudger::UnsafeIsArray:
      return !is_array(v);`,
    },
    {
      note: "parse_ui_value：nullish 短路失效",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `  if (nullish(ret)) {
    out_null = true;
    return true;
  }
  if (!truthy(ui) || is_array(ui) || as_object(ui) == nullptr) {`,
      to: `  if (false && nullish(ret)) {
    out_null = true;
    return true;
  }
  if (!truthy(ui) || is_array(ui) || as_object(ui) == nullptr) {`,
    },
    {
      note: "parse_ui_value：ui 报错文案改了",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `    error = u"[parse_ui_value] failed, ui is not an object, got " + to_string(ui);`,
      to: `    error = u"[parse_ui_value] failed, ui is bad, got " + to_string(ui);`,
    },
    {
      note: "parse_ui_value：$val: 前缀判定失效",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `  if (ret_str != nullptr && js_trim(*ret_str).compare(0, 5, u"$val:") == 0) {`,
      to: `  if (ret_str != nullptr && js_trim(*ret_str).compare(0, 5, u"$val:") == 1) {`,
    },
    {
      note: "parse_ui_value：$val 名字从 trim 后的串切（丢了前导空格的怪癖）",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `    const std::u16string name = js_trim(ret_str->substr(ret_str->size() >= 5 ? 5 : ret_str->size()));`,
      to: `    const std::u16string name = ret_str->substr(ret_str->size() >= 5 ? 5 : ret_str->size());`,
    },
    {
      note: "parse_ui_value：名字不再对 trim 后的串切（怪癖方向反过来）",
      file: "native/lfw/ui/read_info_value.cpp",
      from: `    const std::u16string name = js_trim(ret_str->substr(ret_str->size() >= 5 ? 5 : ret_str->size()));`,
      to: `    const std::u16string name = js_trim(js_trim(*ret_str).substr(5));`,
    },
  ],
};
