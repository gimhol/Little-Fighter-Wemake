// `find_ui_template` / `merge_ui_template`（4AJ）的变异档。
//
// 用例：`cases/lfw/cook.txt`（任一锁住即可）。
//
// 有意不覆盖：`.ui.xml` 候选的**成功**路（台面没脚本化宿主 xml 解析；两侧只测静默失败）。
export default {
  subject: "lfw",
  cases: ["cook"],
  mutations: [
    {
      note: "find：templates 命中不再要求真值",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `        const Value* hit = to->get(template_name);
        if (hit != nullptr && truthy(*hit)) {`,
      to: `        const Value* hit = to->get(template_name);
        if (hit != nullptr) {`,
    },
    {
      note: "find：不沿 parent 上溯",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `      }
    }
    ptr = po->get(u"parent");
  }`,
      to: `      }
    }
    ptr = nullptr;
  }`,
    },
    {
      note: "find：@/ 前缀不再替换",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  if (path.rfind(u"@/", 0) == 0) path = u"builtin_data/launch/" + path.substr(2);`,
      to: `  if (false && path.rfind(u"@/", 0) == 0) path = u"builtin_data/launch/" + path.substr(2);`,
    },
    {
      note: "find：候选次序换成 json 优先",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  const char16_t* const ui_exts[] = {u".ui.json5", u".ui.json", u".ui.xml"};`,
      to: `  const char16_t* const ui_exts[] = {u".ui.json", u".ui.json5", u".ui.xml"};`,
    },
    {
      note: "find：显式扩展名不再排最前",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  std::vector<std::u16string> candidates;
  if (hit_ext != nullptr) candidates.push_back(path);`,
      to: `  std::vector<std::u16string> candidates;
  if (false && hit_ext != nullptr) candidates.push_back(path);`,
    },
    {
      note: "find：{} 键数守卫失效",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `      if (truthy(res.data) && js_key_count(res.data) != 0) {`,
      to: `      if (truthy(res.data)) {`,
    },
    {
      note: "find：warn 文案改了",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  lfw.warn(u"[find_ui_template] ui template not found! template_name: " + template_name);`,
      to: `  lfw.warn(u"[find_ui_template] ui template not found! template: " + template_name);`,
    },
    {
      note: "find：找不到不再给 {}",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  lfw.warn(u"[find_ui_template] ui template not found! template_name: " + template_name);
  out = Value(std::make_shared<Object>());`,
      to: `  lfw.warn(u"[find_ui_template] ui template not found! template_name: " + template_name);
  out = Value();`,
    },
    {
      note: "merge：dev 分支失效",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  if (lfw.dev_mode) {
    append_component(template_info, u"dev_component");
    append_component(remain_v, u"dev_component");
  }`,
      to: `  if (false && lfw.dev_mode) {
    append_component(template_info, u"dev_component");
    append_component(remain_v, u"dev_component");
  }`,
    },
    {
      note: "merge：component 拼接顺序反了（remain 在 template 前）",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  append_component(template_info, u"component");
  append_component(remain_v, u"component");`,
      to: `  append_component(remain_v, u"component");
  append_component(template_info, u"component");`,
    },
    {
      note: "merge：values 浅并方向反了",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    if (const Value* tv = field_of(template_info, u"values")) spread_into(*values, *tv);
    if (const Value* rv = field_of(remain_v, u"values")) spread_into(*values, *rv);`,
      to: `    if (const Value* rv = field_of(remain_v, u"values")) spread_into(*values, *rv);
    if (const Value* tv = field_of(template_info, u"values")) spread_into(*values, *tv);`,
    },
    {
      note: "merge：dev_component 只接模板一侧",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    append_component(template_info, u"dev_component");
    append_component(remain_v, u"dev_component");`,
      to: `    append_component(template_info, u"dev_component");`,
    },
    {
      note: "merge：结果的 template 键给 undefined",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  result->set(u"template", Value(*tname));`,
      to: `  result->set(u"template", Value());`,
    },
    {
      note: "merge：remain 不再摘掉 template 键（键序变）",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    if (k == u"template") continue;`,
      to: `    if (k == u"template") ;`,
    },
  ],
};
