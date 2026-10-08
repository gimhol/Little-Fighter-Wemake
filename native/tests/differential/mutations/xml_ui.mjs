// `xml_to_ui_info`（4AI）的变异档。
//
// 用例：`cases/xml/ui.txt`（任一锁住即可）。
export default {
  subject: "xml",
  cases: ["ui"],
  mutations: [
    {
      note: "component：cls 不再回落到 tag",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `  ret->set(u"cls", non_empty(cls_attr) ? Value(*cls_attr) : Value(el.tag()));`,
      to: `  ret->set(u"cls", Value(el.tag()));`,
    },
    {
      note: "component：args 的空串守卫失效（空串也建键）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `  const std::optional<std::u16string> args = el.attr(u"args");
  if (non_empty(args)) ret->set(u"args", arr_of(split_trim(*args)));
  const std::optional<std::u16string> id = el.attr(u"id");`,
      to: `  const std::optional<std::u16string> args = el.attr(u"args");
  if (args.has_value()) ret->set(u"args", arr_of(split_trim(*args)));
  const std::optional<std::u16string> id = el.attr(u"id");`,
    },
    {
      note: "顶层 id：缺省时不再建键",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `  ret->set(u"id", str_or_undef(el.attr(u"id")));`,
      to: `  if (el.attr(u"id").has_value()) ret->set(u"id", str_or_undef(el.attr(u"id")));`,
    },
    {
      note: "auto_focus：比较串换成 'false'",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `    ret->set(u"auto_focus", (af.has_value() && *af == u"true") ? Value(true) : Value());`,
      to: `    ret->set(u"auto_focus", (af.has_value() && *af == u"false") ? Value(true) : Value());`,
    },
    {
      note: "split_trim：不再逐段 trim",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `  for (const std::u16string& part : split_char(s, u',')) out.push_back(js_trim(part));`,
      to: `  for (const std::u16string& part : split_char(s, u',')) out.push_back(part);`,
    },
    {
      note: "nums_attr 缺省：不再给 undefined 而是空数组",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `  if (!ns.has_value()) return Value();`,
      to: `  if (!ns.has_value()) return Value(std::make_shared<Array>());`,
    },
    {
      note: "set_num_attr：空串属性不再赋值（丢了 Number('')=0）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `  const auto set_num_attr = [&](const char16_t* name) {
    if (const std::optional<std::u16string> v = el.attr(name); v.has_value()) {`,
      to: `  const auto set_num_attr = [&](const char16_t* name) {
    if (const std::optional<std::u16string> v = el.attr(name); v.has_value() && !v->empty()) {`,
    },
    {
      note: "set_bool_attr：比较串换成 '1'",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `  const auto set_bool_attr = [&](const char16_t* name) {
    if (const std::optional<std::u16string> v = el.attr(name); v.has_value()) {
      ret->set(name, Value(*v == u"true"));`,
      to: `  const auto set_bool_attr = [&](const char16_t* name) {
    if (const std::optional<std::u16string> v = el.attr(name); v.has_value()) {
      ret->set(name, Value(*v == u"1"));`,
    },
    {
      note: "actions 单值 attr 不再 trim",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `          actions->set(a.name, Value(js_trim(a.value)));`,
      to: `          actions->set(a.name, Value(a.value));`,
    },
    {
      note: "actions 子元素不再与已有值合并（总是覆盖）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `        const Value* prev = actions->get(c->tag());
        if (prev != nullptr) {`,
      to: `        const Value* prev = actions->get(c->tag());
        if (false) {`,
    },
    {
      note: "img：path 的空串守卫失效（空串不再回落 src）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `      img->set(u"path", non_empty(path_attr) ? Value(*path_attr) : str_or_undef(child->attr(u"src")));`,
      to: `      img->set(u"path", path_attr.has_value() ? Value(*path_attr) : str_or_undef(child->attr(u"src")));`,
    },
    {
      note: "img：dw 的假值回落丢了（0 不再变 w）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `      img->set(u"dw", truthy(dw_v) ? dw_v : w_v);`,
      to: `      img->set(u"dw", dw_v);`,
    },
    {
      note: "template：id 优先级被跳过（只看 name）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `      if (non_empty(id)) {
        tid = *id;
      } else {`,
      to: `      if (false) {
        tid = *id;
      } else {`,
    },
    {
      note: "values：as_object 不再合并进 ret.values",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `      if (so != nullptr) {
        for (const std::u16string& k : so->keys()) values_obj->set(k, *so->get(k));
      }`,
      to: `      if (false && so != nullptr) {
        for (const std::u16string& k : so->keys()) values_obj->set(k, *so->get(k));
      }`,
    },
    {
      note: "style：数值转换丢了（保留字符串）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `          if (const std::optional<std::u16string> v = child->attr(name); v.has_value()) {
            s->set(name, to_number(Value(*v)));
          }`,
      to: `          if (const std::optional<std::u16string> v = child->attr(name); v.has_value()) {
            s->set(name, Value(*v));
          }`,
    },
    {
      note: "默认分支：args 无守卫（缺省也建空串数组）",
      file: "native/lfw/ui/xml_to_ui_info.cpp",
      from: `      const std::optional<std::u16string> args = child->attr(u"args");
      if (non_empty(args)) comp->set(u"args", arr_of(split_trim(*args)));
      components.push_back(Value(comp));`,
      to: `      const std::optional<std::u16string> args = child->attr(u"args");
      comp->set(u"args", arr_of(split_trim(args.value_or(std::u16string()))));
      components.push_back(Value(comp));`,
    },
  ],
};
