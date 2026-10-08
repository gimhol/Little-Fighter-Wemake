// `lfw/uinode` 第二段（4AO：文本/图像/i18n 自动尺寸）的变异档。
//
// 用例：`cases/lfw/uinode_txt.txt`（任一锁住即可）。
export default {
  subject: "lfw",
  cases: ["uinode_txt"],
  mutations: [
    {
      note: "构造：i18n 重测分支死掉",
      file: "native/lfw/ui/uinode.cpp",
      from: `    if (truthy(tv) && i18n != nullptr && truthy(*i18n)) tv = make_i18n_text(tv, *i18n);`,
      to: `    if (false) tv = make_i18n_text(tv, *i18n);`,
    },
    {
      note: "构造：文本不落到节点（空值）",
      file: "native/lfw/ui/uinode.cpp",
      from: `    set_text_object(tv);
  }`,
      to: `    set_text_object(Value());
  }`,
    },
    {
      note: "make_i18n_text：命中也不再复用 baked",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (baked_text != nullptr && strict_equals(resolved, *baked_text)) return baked;`,
      to: `  if (false) return baked;`,
    },
    {
      note: "make_i18n_text：不读 baked.style",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const Value style = baked_style != nullptr && !nullish(*baked_style)
                          ? *baked_style`,
      to: `  const Value style = false
                          ? *baked_style`,
    },
    {
      note: "make_i18n_text：不回落 data.style",
      file: "native/lfw/ui/uinode.cpp",
      from: `                          : (data_style != nullptr && !nullish(*data_style) ? *data_style : Value());`,
      to: `                          : Value();`,
    },
    {
      note: "make_i18n_text：measure_text 参数接反",
      file: "native/lfw/ui/uinode.cpp",
      from: `  return _lfw->host().measure_text(resolved, style);`,
      to: `  return _lfw->host().measure_text(style, resolved);`,
    },
    {
      note: "auto_size：raw.size 拦截失效",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (!truthy(v) || (raw_size != nullptr && truthy(*raw_size)) || _parent == nullptr) {`,
      to: `  if (!truthy(v) || false || _parent == nullptr) {`,
    },
    {
      note: "auto_size：无父也开调",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (!truthy(v) || (raw_size != nullptr && truthy(*raw_size)) || _parent == nullptr) {`,
      to: `  if (!truthy(v) || (raw_size != nullptr && truthy(*raw_size)) || false) {`,
    },
    {
      note: "auto_size：同键不再跳过",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_auto_size_key.set && same_text_size_key(_auto_size_key, key)) return;`,
      to: `  if (false) return;`,
    },
    {
      note: "auto_size：w/h 齐备也要重测",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (!(vw != nullptr && truthy(*vw) && vh != nullptr && truthy(*vh))) {`,
      to: `  if (true) {`,
    },
    {
      note: "auto_size：忘了除 scale",
      file: "native/lfw/ui/uinode.cpp",
      from: `  resize(w / s, h / s);`,
      to: `  resize(w, h);`,
    },
    {
      note: "auto_size：scale 恒 1",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const double s = ts != nullptr ? num_or_one(*ts) : 1.0;`,
      to: `  const double s = 1.0;`,
    },
    {
      note: "text_size_key：版本分支死（当普通对象）",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_text_style_versioned) {
    k.versioned = true;
    k.version = style.version();
  } else {`,
      to: `  if (false) {
    k.versioned = true;
    k.version = style.version();
  } else {`,
    },
    {
      note: "text_size_key：版本号不取节点 Style",
      file: "native/lfw/ui/uinode.cpp",
      from: `    k.version = style.version();`,
      to: `    k.version = 0;`,
    },
    {
      note: "text_size_key：样式缺省不回落 {}",
      file: "native/lfw/ui/uinode.cpp",
      from: `    const Value sv = s != nullptr && !nullish(*s) ? *s : Value(std::make_shared<Object>());`,
      to: `    const Value sv = Value(std::make_shared<Object>());`,
    },
    {
      note: "same_text_size_key：json 恒相等",
      file: "native/lfw/ui/uinode.cpp",
      from: `  return a.versioned ? a.version == b.version : a.json == b.json;`,
      to: `  return a.versioned ? a.version == b.version : true;`,
    },
    {
      note: "same_text_size_key：版本恒相等",
      file: "native/lfw/ui/uinode.cpp",
      from: `  return a.versioned ? a.version == b.version : a.json == b.json;`,
      to: `  return a.versioned ? true : a.json == b.json;`,
    },
    {
      note: "set_text：nullish 判定反了（总走节点 Style）",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const bool use_node_style = nullish(style);`,
      to: `  const bool use_node_style = true;`,
    },
    {
      note: "set_text：总走 JSON 分支",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const bool use_node_style = nullish(style);`,
      to: `  const bool use_node_style = false;`,
    },
    {
      note: "set_text：样式值不落节点 Style 的 backing",
      file: "native/lfw/ui/uinode.cpp",
      from: `  o->set(u"style", use_node_style ? this->style.data() : style);`,
      to: `  o->set(u"style", style);`,
    },
    {
      note: "set_text：w 默认不是 0",
      file: "native/lfw/ui/uinode.cpp",
      from: `  o->set(u"w", Value(0.0));`,
      to: `  o->set(u"w", Value(std::nan("")));`,
    },
    {
      note: "set_text_object：不清 versioned 标记",
      file: "native/lfw/ui/uinode.cpp",
      from: `UINode& UINode::set_text_object(const Value& v) {
  _text_style_versioned = false;
  _text = v;`,
      to: `UINode& UINode::set_text_object(const Value& v) {
  _text = v;`,
    },
    {
      note: "set_text_object：不触发 auto_size",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _text = v;
  auto_size_by_text(v);
  return *this;
}`,
      to: `  _text = v;
  return *this;
}`,
    },
    {
      note: "构造：img_info 恒为空",
      file: "native/lfw/ui/uinode.cpp",
      from: `    _image = img != nullptr && !nullish(*img) ? *img : Value(NullTag{});`,
      to: `    _image = Value(NullTag{});`,
    },
  ],
};
