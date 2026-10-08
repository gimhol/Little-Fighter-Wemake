// `ui_load_img`（4AK）的变异档。
//
// 用例：`cases/lfw/uimg.txt`（任一锁住即可）。
export default {
  subject: "lfw",
  cases: ["uimg"],
  mutations: [
    {
      note: "join 丢了分隔逗号",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `    if (i != 0) out.push_back(u',');
    const Value* const v = fields[i];
    if (v == nullptr || nullish(*v)) continue;`,
      to: `    const Value* const v = fields[i];
    if (v == nullptr || nullish(*v)) continue;`,
    },
    {
      note: "img_key 少了 ?x=",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `  const std::u16string img_key = path_text + u"?x=" + md5;`,
      to: `  const std::u16string img_key = path_text + u"!_x=" + md5;`,
    },
    {
      note: "校验直接跳过",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `  if (!errors.empty()) {
    error.clear();`,
      to: `  if (false && !errors.empty()) {
    error.clear();`,
    },
    {
      note: "crop 条件从「或」变「与」",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `  if (truthy_field(dw) || truthy_field(dh)) {`,
      to: `  if (truthy_field(dw) && truthy_field(dh)) {`,
    },
    {
      note: "flip 条件不再看真值（只看到场）",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `  if (truthy_field(flip_x) || truthy_field(flip_y)) {`,
      to: `  if (flip_x != nullptr || flip_y != nullptr) {`,
    },
    {
      note: "flip 的默认 0 丢了（缺省给 undefined）",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `  const Value flip_x_eff = flip_x != nullptr ? *flip_x : Value(0.0);`,
      to: `  const Value flip_x_eff = flip_x != nullptr ? *flip_x : Value();`,
    },
    {
      note: "pin 不再调用",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `  lfw.host().ui_image_pin(img_key);
  return true;`,
      to: `  return true;`,
    },
    {
      note: "宿主 load 失败被无视",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `  if (!lfw.host().ui_image_load(img_key, path != nullptr ? *path : Value(), Value(ops), out,
                                error)) {
    return false;
  }`,
      to: `  lfw.host().ui_image_load(img_key, path != nullptr ? *path : Value(), Value(ops), out, error);`,
    },
    {
      note: "crop op 的 type 键排到了展开之后",
      file: "native/lfw/ui/ui_load_img.cpp",
      from: `    op->set(u"type", Value(u"crop"));
    spread_into(*op, img);`,
      to: `    spread_into(*op, img);
    op->set(u"type", Value(u"crop"));`,
    },
  ],
};
