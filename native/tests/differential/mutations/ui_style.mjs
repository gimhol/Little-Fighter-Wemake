// `ui_style`（Style / isClass）的变异档。
//
// 用例：`cases/ui_style/{style,class}.txt`（任一锁住即可）。
export default {
  subject: "ui_style",
  mutations: [
    {
      note: "setter：同值不再早退（版本号乱涨）",
      file: "native/lfw/ui/style.cpp",
      from: `  if (equals(cur_v, v)) return;`,
      to: `  if (false) return;`,
    },
    {
      note: "setter：宽松比较改成严格（'6' 也会涨版本）",
      file: "native/lfw/ui/style.cpp",
      from: `  if (equals(cur_v, v)) return;`,
      to: `  if (strict_equals(cur_v, v)) return;`,
    },
    {
      note: "assign：同值不再跳过（严格比较失效）",
      file: "native/lfw/ui/style.cpp",
      from: `    if (strict_equals(cur_v, v)) continue;`,
      to: `    if (false) continue;`,
    },
    {
      note: "assign：把现有值当成 undefined（同值也会写回）",
      file: "native/lfw/ui/style.cpp",
      from: `    const Value* const cur = data->get(k);
    const Value cur_v = cur != nullptr ? *cur : Value();`,
      to: `    const Value* const cur = data->get(k);
    const Value cur_v = Value();`,
    },
    {
      note: "touch：不涨版本号",
      file: "native/lfw/ui/style.h",
      from: `  void touch() { ++_version; }`,
      to: `  void touch() {}`,
    },
    {
      note: "set_data(值)：不涨版本号",
      file: "native/lfw/ui/style.cpp",
      from: `void Style::set_data(const Value& v) {
  _data = v;
  ++_version;
}`,
      to: `void Style::set_data(const Value& v) {
  _data = v;
}`,
    },
    {
      note: "set_data(Style)：浅拷贝退化成别名",
      file: "native/lfw/ui/style.cpp",
      from: `  _data = Value(std::make_shared<Object>(copy));`,
      to: `  _data = other.data();`,
    },
    {
      note: "Style.from：包装缓存失效（每次都新建）",
      file: "native/lfw/ui/style.cpp",
      from: `  Style& ret = *it->second;`,
      to: `  static std::vector<std::unique_ptr<Style>> fresh;
  fresh.push_back(std::make_unique<Style>());
  Style& ret = *fresh.back();`,
    },
    {
      note: "is_class：只比一层",
      file: "native/lfw/utils/is_class.h",
      from: `  for (const ClazzTag* c = cls; c != nullptr; c = c->parent) {`,
      to: `  for (const ClazzTag* c = cls; c != nullptr; c = nullptr) {`,
    },
    {
      note: "is_class：同一标签也不再命中",
      file: "native/lfw/utils/is_class.h",
      from: `    if (c == clazz) return true;`,
      to: `    if (false) return true;`,
    },
  ],
};
