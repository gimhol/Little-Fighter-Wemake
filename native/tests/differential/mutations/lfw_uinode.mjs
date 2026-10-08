// `lfw/uinode`（UINode 第一刀：几何/状态/树/焦点/指针）的变异档。
//
// 用例：`cases/lfw/uinode.txt`（任一锁住即可）。
export default {
  subject: "lfw",
  cases: ["uinode"],
  mutations: [
    {
      note: "构造：visible 默认取反（恒 true）",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _visible = !equals(field_of(data, u"visible") != nullptr ? *field_of(data, u"visible") : Value(),
                     Value(false));`,
      to: `  _visible = true;`,
    },
    {
      note: "构造：disabled 恒 false",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _disabled = equals(field_of(data, u"disabled") != nullptr ? *field_of(data, u"disabled")
                                                            : Value(),
                     Value(true));`,
      to: `  _disabled = false;`,
    },
    {
      note: "构造：clips 恒 false",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _clip_children = equals(field_of(data, u"clips") != nullptr ? *field_of(data, u"clips")
                                                              : Value(),
                          Value(true));`,
      to: `  _clip_children = false;`,
    },
    {
      note: "构造：opacity 不读数据（恒 1）",
      file: "native/lfw/ui/uinode.cpp",
      from: `    _opacity = (opacity != nullptr && !nullish(*opacity)) ? *opacity : Value(1.0);`,
      to: `    _opacity = Value(1.0);`,
    },
    {
      note: "构造：pos 拿的是 center 数组",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (const Value* const p = field_of(data, u"pos")) set3(pos, *p);`,
      to: `  if (const Value* const p = field_of(data, u"center")) set3(pos, *p);`,
    },
    {
      note: "resize：不 round_float",
      file: "native/lfw/ui/uinode.cpp",
      from: `  size.x = round_float(x.value_or(size.x));`,
      to: `  size.x = x.value_or(size.x);`,
    },
    {
      note: "move_to：不 round_float",
      file: "native/lfw/ui/uinode.cpp",
      from: `  pos.x = round_float(x.value_or(pos.x));`,
      to: `  pos.x = x.value_or(pos.x);`,
    },
    {
      note: "move_to：不清缓存",
      file: "native/lfw/ui/uinode.cpp",
      from: `  pos.z = round_float(z.value_or(pos.z));
  clear_caches();`,
      to: `  pos.z = round_float(z.value_or(pos.z));`,
    },
    {
      note: "resize：不清缓存",
      file: "native/lfw/ui/uinode.cpp",
      from: `  size.z = round_float(z.value_or(size.z));
  clear_caches();`,
      to: `  size.z = round_float(z.value_or(size.z));`,
    },
    {
      note: "set_center：不清缓存",
      file: "native/lfw/ui/uinode.cpp",
      from: `  center.z = round_float(z.value_or(center.z));
  clear_caches();`,
      to: `  center.z = round_float(z.value_or(center.z));`,
    },
    {
      note: "set_scale：却做了 round_float 值错位（不 round）",
      file: "native/lfw/ui/uinode.cpp",
      from: `  scale.x = round_float(x.value_or(scale.x));`,
      to: `  scale.x = x.value_or(scale.x);`,
    },
    {
      note: "global_pos：不见父链",
      file: "native/lfw/ui/uinode.cpp",
      from: `  Vector3 out = pos;
  if (_parent != nullptr) {`,
      to: `  Vector3 out = pos;
  if (false) {`,
    },
    {
      note: "global_pos：不缓存（陈旧性消失）",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_cache_global_pos.has_value()) return *_cache_global_pos;
  Vector3 out = pos;`,
      to: `  Vector3 out = pos;`,
    },
    {
      note: "cross：right 符号错（写成 a*w）",
      file: "native/lfw/ui/uinode.cpp",
      from: `  out.right = (1 - a) * w_;`,
      to: `  out.right = a * w_;`,
    },
    {
      note: "rect：不含自身 pos",
      file: "native/lfw/ui/uinode.cpp",
      from: `  out.left = pos.x + c.left;`,
      to: `  out.left = c.left;`,
    },
    {
      note: "geo：pos_x 拿成 cross.left",
      file: "native/lfw/ui/uinode.cpp",
      from: `  out.pos_x = g.x;`,
      to: `  out.pos_x = c.left;`,
    },
    {
      note: "hit：用当前 size 而非原始 data.size",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const Value* const data_size = field_of(_data, u"size");
  const Array* const arr = data_size != nullptr ? as_array(*data_size) : nullptr;
  const double dw = arr != nullptr && arr->size() > 0 ? num_of(arr->at(0)) : std::nan("");
  const double dh = arr != nullptr && arr->size() > 1 ? num_of(arr->at(1)) : std::nan("");`,
      to: `  const double dw = size.x;
  const double dh = size.y;`,
    },
    {
      note: "set_focused_node：禁用/不可见节点不再拦",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (old == val) return;
  if (val != nullptr && (val->disabled() || !val->visible())) val = nullptr;
  rt._focused_node = val;`,
      to: `  if (old == val) return;
  rt._focused_node = val;`,
    },
    {
      note: "set_focused_node：item_changed 参数序反",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (rt.callbacks.on_foucs_item_changed) rt.callbacks.on_foucs_item_changed(val, old);`,
      to: `  if (rt.callbacks.on_foucs_item_changed) rt.callbacks.on_foucs_item_changed(old, val);`,
    },
    {
      note: "set_disabled：不禁用时不焦点清理",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _disabled = v;
  if (v && focused_node() != nullptr && focused_node()->disabled()) set_focused_node(nullptr);
  return *this;`,
      to: `  _disabled = v;
  return *this;`,
    },
    {
      note: "set_visible：不触发 invoke_all_visible",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const bool prev = visible();
  _visible = v;
  if (prev != visible()) invoke_all_visible();`,
      to: `  const bool prev = visible();
  _visible = v;`,
    },
    {
      note: "visible()：不看父链",
      file: "native/lfw/ui/uinode.cpp",
      from: `bool UINode::visible() const {
  if (_parent == nullptr) return _visible;
  return _parent->visible() && _visible;
}`,
      to: `bool UINode::visible() const {
  return _visible;
}`,
    },
    {
      note: "background：兜底色错",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const Value* const v = field_of(_data, u"background");
  if (v != nullptr && std::holds_alternative<std::u16string>(*v)) return std::get<std::u16string>(*v);
  return u"#000000";`,
      to: `  const Value* const v = field_of(_data, u"background");
  if (v != nullptr && std::holds_alternative<std::u16string>(*v)) return std::get<std::u16string>(*v);
  return u"#111111";`,
    },
    {
      note: "backgroundAlpha：缺省 1 而不是 0",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const Value* const v = field_of(_data, u"backgroundAlpha");
  return v != nullptr && !nullish(*v) ? to_number(*v) : 0.0;`,
      to: `  const Value* const v = field_of(_data, u"backgroundAlpha");
  return v != nullptr && !nullish(*v) ? to_number(*v) : 1.0;`,
    },
    {
      note: "disabled()：不看父链",
      file: "native/lfw/ui/uinode.cpp",
      from: `bool UINode::disabled() const {
  if (_parent == nullptr) return _disabled;
  return _parent->disabled() || _disabled;
}`,
      to: `bool UINode::disabled() const {
  return _disabled;
}`,
    },
    {
      note: "global_opacity：不乘父透明度",
      file: "native/lfw/ui/uinode.cpp",
      from: `  return to_number(_opacity) * to_number(_parent->_opacity);`,
      to: `  return to_number(_opacity);`,
    },
    {
      note: "depth：不累加父深度",
      file: "native/lfw/ui/uinode.h",
      from: `  double depth() const { return _parent != nullptr ? _parent->depth() + 1 : 0; }`,
      to: `  double depth() const { return 0; }`,
    },
    {
      note: "loose_str_equals：数字/布尔不再宽松比较",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (std::holds_alternative<double>(v) || std::holds_alternative<bool>(v)) {
    return to_string(v) == text;
  }`,
      to: `  if (std::holds_alternative<double>(v) || std::holds_alternative<bool>(v)) {
    return false;
  }`,
    },
    {
      note: "search_node：不再递归子节点",
      file: "native/lfw/ui/uinode.cpp",
      from: `  for (UINode* const c : _children) {
    ret = c->search_node(id);
    if (ret != nullptr) return ret;
  }`,
      to: `  for (UINode* const c : _children) {
    ret = nullptr;
    if (ret != nullptr) return ret;
  }`,
    },
    {
      note: "lookup_node：不再向父上溯",
      file: "native/lfw/ui/uinode.cpp",
      from: `  return _parent != nullptr ? _parent->lookup_node(id) : nullptr;`,
      to: `  return nullptr;`,
    },
    {
      note: "get_value：不再沿父查找",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (lookup && _parent != nullptr) return _parent->get_value(name, lookup);`,
      to: `  if (false) return _parent->get_value(name, lookup);`,
    },
    {
      note: "find_parent_by_id：只查一层",
      file: "native/lfw/ui/uinode.cpp",
      from: `  while (parent != nullptr) {
    if (loose_str_equals(parent->id(), id)) return parent;
    parent = parent->_parent;
  }`,
      to: `  while (parent != nullptr) {
    if (loose_str_equals(parent->id(), id)) return parent;
    parent = nullptr;
  }`,
    },
    {
      note: "id()：恒 undefined",
      file: "native/lfw/ui/uinode.cpp",
      from: `Value UINode::id() const {
  const Value* const v = field_of(_data, u"id");
  return v != nullptr ? *v : Value();
}`,
      to: `Value UINode::id() const {
  return Value();
}`,
    },
    {
      note: "on_pointer_down：不置 click 标记",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _pointer_down = 1;
  _click_flag = 1;`,
      to: `  _pointer_down = 1;
  _click_flag = 0;`,
    },
    {
      note: "on_pointer_cancel：不抬 down",
      file: "native/lfw/ui/uinode.cpp",
      from: `void UINode::on_pointer_cancel(LFWPointerEvent& e) {
  _pointer_down = 0;`,
      to: `void UINode::on_pointer_cancel(LFWPointerEvent& e) {
  _pointer_down = 1;`,
    },
    {
      note: "on_pointer_leave：不清 click 标记",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _pointer_over = 0;
  _click_flag = 0;`,
      to: `  _pointer_over = 0;
  _click_flag = 1;`,
    },
    {
      note: "on_pointer_enter：不置 over",
      file: "native/lfw/ui/uinode.cpp",
      from: `void UINode::on_pointer_enter() {
  _pointer_over = 1;`,
      to: `void UINode::on_pointer_enter() {
  _pointer_over = 0;`,
    },
    {
      note: "on_show：auto_focus 失效",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (auto_focus != nullptr && truthy(*auto_focus) && !disabled() && focused_node() == nullptr) {`,
      to: `  if (false) {`,
    },
    {
      note: "invoke_all_on_hide：递归不再看自身可见",
      file: "native/lfw/ui/uinode.cpp",
      from: `void UINode::invoke_all_on_hide() {
  on_hide();
  for (UINode* const child : _children) {
    if (child->_visible) child->invoke_all_on_hide();`,
      to: `void UINode::invoke_all_on_hide() {
  on_hide();
  for (UINode* const child : _children) {
    if (true) child->invoke_all_on_hide();`,
    },
    {
      note: "invoke_all_on_show：递归不再看自身可见",
      file: "native/lfw/ui/uinode.cpp",
      from: `void UINode::invoke_all_on_show() {
  on_show();
  for (UINode* const child : _children) {
    if (child->_visible) child->invoke_all_on_show();`,
      to: `void UINode::invoke_all_on_show() {
  on_show();
  for (UINode* const child : _children) {
    if (true) child->invoke_all_on_show();`,
    },
    {
      note: "update：几何无变化也清缓存",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_prev_size.x != size.x || _prev_size.y != size.y || _prev_center.x != center.x ||
      _prev_center.y != center.y || _prev_pos.x != pos.x || _prev_pos.y != pos.y ||
      _prev_pos.z != pos.z) {
    clear_caches();`,
      to: `  if (true) {
    clear_caches();`,
    },
    {
      note: "update：几何有变化却不清缓存",
      file: "native/lfw/ui/uinode.cpp",
      from: `    clear_caches();
    _prev_size.x = size.x;`,
      to: `    _prev_size.x = size.x;`,
    },
    {
      note: "update：prev_size.x 不记录",
      file: "native/lfw/ui/uinode.cpp",
      from: `    _prev_size.x = size.x;
    _prev_size.y = size.y;`,
      to: `    _prev_size.y = size.y;`,
    },
    {
      note: "update：不跳过禁用的子节点",
      file: "native/lfw/ui/uinode.cpp",
      from: `  for (UINode* const child : _children) {
    if (!child->disabled()) child->update(dt);
  }`,
      to: `  for (UINode* const child : _children) {
    child->update(dt);
  }`,
    },
  ],
};
