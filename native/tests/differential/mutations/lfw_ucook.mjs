// `cook_ui_info`（4AL）的变异档。
//
// 用例：`cases/lfw/ucook.txt`（任一锁住即可）。
export default {
  subject: "lfw",
  cases: ["ucook"],
  mutations: [
    {
      note: "id 的真值守卫失效（空串也当有）",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    return (v != nullptr && truthy(*v)) ? *v : Value(next_no_id());`,
      to: `    return (v != nullptr) ? *v : Value(next_no_id());`,
    },
    {
      note: "name 的真值守卫失效（空串不再回落 id）",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    return (v != nullptr && truthy(*v)) ? *v : raw_id_v;`,
      to: `    return (v != nullptr) ? *v : raw_id_v;`,
    },
    {
      note: "values 默认值：非空对象也换 {}",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    ret->set(u"values", (values != nullptr && truthy(*values)) ? *values
                                                               : Value(std::make_shared<Object>()));`,
      to: `    ret->set(u"values", Value(std::make_shared<Object>()));`,
    },
    {
      note: "component 字符串项不再走表达式解析",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `          if (parsed.has_value()) {
            cooked->set(u"id", Value(parsed->id));`,
      to: `          if (false) {
            cooked->set(u"id", Value(parsed->id));`,
    },
    {
      note: "component 对象项不再回落 cls = name",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `          if ((cls == nullptr || !truthy(*cls)) && nm != nullptr && truthy(*nm)) {
            mut->set(u"cls", *nm);
          }`,
      to: `          if (false) {
            mut->set(u"cls", *nm);
          }`,
    },
    {
      note: "component 对象项 id 模板换了（cls 变 X）",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `          if (id == nullptr || !truthy(*id)) mut->set(u"id", Value(next_seq_id(cls_text)));`,
      to: `          if (id == nullptr || !truthy(*id)) mut->set(u"id", Value(next_seq_id(u"X")));`,
    },
    {
      note: "component 对象项 name 后缀变了",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `          if (nm2 == nullptr || !truthy(*nm2)) mut->set(u"name", Value(cls_text + u"_no_name"));`,
      to: `          if (nm2 == nullptr || !truthy(*nm2)) mut->set(u"name", Value(cls_text + u"_x"));`,
    },
    {
      note: "component 排序方向反了",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `                     const double d = weight_of(a) - weight_of(b);`,
      to: `                     const double d = weight_of(b) - weight_of(a);`,
    },
    {
      note: "actions 的 null 值不再跳过",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `        if (val == nullptr || nullish(*val)) continue;`,
      to: `        if (val == nullptr) continue;`,
    },
    {
      note: "action 字符串项不解析（name 用整串）",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `            act->set(u"name", parsed.has_value() ? Value(parsed->name) : Value(*s));`,
      to: `            act->set(u"name", Value(*s));`,
    },
    {
      note: "action 的数组不再逐项展开",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `        if (const Array* const list = as_array(*val)) {
          for (const Value& a : list->items()) push_action(a);
        } else {
          push_action(*val);
        }`,
      to: `        push_action(*val);`,
    },
    {
      note: "count 不做类型检查",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `  if (!assign(UIValueType::Kind::Number, UIJudger::None, u"count", raw_obj->get(u"count"))) {`,
      to: `  if (!assign(UIValueType::Kind::Null, UIJudger::None, u"count", raw_obj->get(u"count"))) {`,
    },
    {
      note: "scale 的回落 1 丢了",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    if (!nums_src(u"scale", src) || !read_nums_into(u"scale", src, 1.0, true)) return false;`,
      to: `    if (!nums_src(u"scale", src) || !read_nums_into(u"scale", src, 1.0, false)) return false;`,
    },
    {
      note: "img.dw 的回落丢了（null 也覆盖）",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `      if (!out_null) dw_v = parsed_v;`,
      to: `      if (true) dw_v = parsed_v;`,
    },
    {
      note: "size 的 img 分支不再取 dw/dh",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `      size->push_back(nullish_pick(dw, w));
      size->push_back(nullish_pick(dh, h));`,
      to: `      size->push_back(Value(0.0));
      size->push_back(Value(0.0));`,
    },
    {
      note: "size 的屏幕回落条件反了",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    } else if (parent == nullptr) {
      const WorldDataset& dataset = lfw.world().dataset;`,
      to: `    } else if (parent != nullptr) {
      const WorldDataset& dataset = lfw.world().dataset;`,
    },
    {
      note: "width 省的换算方向反了",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `            size->at(1) = Value(lfw::floor(w0 * sh / sw));`,
      to: `            size->at(1) = Value(lfw::floor(w0 * sw / sh));`,
    },
    {
      note: "items 递归不挂 parent",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `          if (!cook_ui_info(lfw, raw_item, &ret_v, child, error)) return false;`,
      to: `          if (!cook_ui_info(lfw, raw_item, nullptr, child, error)) return false;`,
    },
    {
      note: "空的 items 不再删键",
      file: "native/lfw/ui/cook_ui_info.cpp",
      from: `    if (!keep) ret->remove(u"items");`,
      to: `    if (false) ret->remove(u"items");`,
    },
  ],
};
