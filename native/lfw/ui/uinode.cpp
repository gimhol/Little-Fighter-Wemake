#include "lfw/ui/uinode.h"

#include <cmath>
#include <memory>
#include <utility>

#include "lfw/core/js_string.h"
#include "lfw/lfw.h"
#include "lfw/ui/value_spread.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/round_float.h"

namespace lfw::ui {

namespace {

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

double num_of(const Value& v) {
  const double* const d = std::get_if<double>(&v);
  return d != nullptr ? *d : std::nan("");
}

// `v.id == id` 的 JS 宽松比较（字符串/数字/布尔才可能相等）。
bool loose_str_equals(const Value& v, const std::u16string& text) {
  if (const std::u16string* const s = std::get_if<std::u16string>(&v)) return *s == text;
  if (std::holds_alternative<double>(v) || std::holds_alternative<bool>(v)) {
    return to_string(v) == text;
  }
  return false;
}

}

UINode::UINode(LFW& lfw, const Value& data, UINode* parent, UILayer* layer)
    : _lfw(&lfw), _data(data), _raw(field_of(data, u"raw") != nullptr ? *field_of(data, u"raw")
                                                                      : Value()),
      _parent(parent), _layer(layer) {
  _root = parent != nullptr ? &parent->root() : this;
  _disabled = equals(field_of(data, u"disabled") != nullptr ? *field_of(data, u"disabled")
                                                            : Value(),
                     Value(true));
  _visible = !equals(field_of(data, u"visible") != nullptr ? *field_of(data, u"visible") : Value(),
                     Value(false));
  _clip_children = equals(field_of(data, u"clips") != nullptr ? *field_of(data, u"clips")
                                                              : Value(),
                          Value(true));
  {
    const Value* const opacity = field_of(data, u"opacity");
    _opacity = (opacity != nullptr && !nullish(*opacity)) ? *opacity : Value(1.0);
  }
  if (const Value* const c = field_of(data, u"center")) set3(center, *c);
  if (const Value* const p = field_of(data, u"pos")) set3(pos, *p);
  if (const Value* const s = field_of(data, u"size")) set3(size, *s);
  if (const Value* const sc = field_of(data, u"scale")) set3(scale, *sc);
  // 4AN：`text` / `image` / `renderer` 不建形（后续刀）。
  if (const Value* const col = field_of(data, u"color");
      col != nullptr && std::holds_alternative<std::u16string>(*col)) {
    color = std::get<std::u16string>(*col);
  }
  _outlineColor = field_of(data, u"outlineColor") != nullptr ? *field_of(data, u"outlineColor")
                                                             : Value();
  _outlineWidth = field_of(data, u"outlineWidth") != nullptr ? *field_of(data, u"outlineWidth")
                                                             : Value();
  _outlineAlpha = field_of(data, u"outlineAlpha") != nullptr ? *field_of(data, u"outlineAlpha")
                                                             : Value();
  const Value* const style_v = field_of(data, u"style");
  if (style_v != nullptr && truthy(*style_v)) style.assign(*style_v);
}

void UINode::set3(Vector3& v, const Value& arr) {
  const Array* const a = as_array(arr);
  if (a == nullptr) return;
  v.set(a->size() > 0 ? num_of(a->at(0)) : std::nan(""), a->size() > 1 ? num_of(a->at(1)) : std::nan(""),
        a->size() > 2 ? num_of(a->at(2)) : std::nan(""));
}

void UINode::clear_caches() {
  _cache_cross.reset();
  _cache_rect.reset();
  _cache_geo.reset();
  _cache_global_pos.reset();
}

UINode& UINode::set_w(double v) { return resize(v, h()); }
UINode& UINode::set_h(double v) { return resize(w(), v); }

UINode& UINode::resize(std::optional<double> x, std::optional<double> y, std::optional<double> z) {
  size.x = round_float(x.value_or(size.x));
  size.y = round_float(y.value_or(size.y));
  size.z = round_float(z.value_or(size.z));
  clear_caches();
  return *this;
}

UINode& UINode::set_x(double v) { return move_to(v); }
UINode& UINode::set_y(double v) { return move_to({}, v); }
UINode& UINode::set_z(double v) { return move_to({}, {}, v); }

UINode& UINode::move_to(std::optional<double> x, std::optional<double> y, std::optional<double> z) {
  pos.x = round_float(x.value_or(pos.x));
  pos.y = round_float(y.value_or(pos.y));
  pos.z = round_float(z.value_or(pos.z));
  clear_caches();
  return *this;
}

UINode& UINode::set_cx(double v) { return set_center(v); }
UINode& UINode::set_cy(double v) { return set_center({}, v); }
UINode& UINode::set_cz(double v) { return set_center({}, {}, v); }

UINode& UINode::set_center(std::optional<double> x, std::optional<double> y,
                           std::optional<double> z) {
  center.x = round_float(x.value_or(center.x));
  center.y = round_float(y.value_or(center.y));
  center.z = round_float(z.value_or(center.z));
  clear_caches();
  return *this;
}

UINode& UINode::set_sx(double v) { return set_scale(v); }
UINode& UINode::set_sy(double v) { return set_scale({}, v); }
UINode& UINode::set_sz(double v) { return set_scale({}, {}, v); }

UINode& UINode::set_scale(std::optional<double> x, std::optional<double> y,
                          std::optional<double> z) {
  // TS 的 `set_scale` **不**清缓存（cross/rect/geo 本来也不看 scale）——照抄。
  scale.x = round_float(x.value_or(scale.x));
  scale.y = round_float(y.value_or(scale.y));
  scale.z = round_float(z.value_or(scale.z));
  return *this;
}

const Vector3& UINode::global_pos() const {
  if (_cache_global_pos.has_value()) return *_cache_global_pos;
  Vector3 out = pos;
  if (_parent != nullptr) {
    const Vector3& g = _parent->global_pos();
    out.x += g.x;
    out.y += g.y;
    out.z += g.z;
  }
  _cache_global_pos = out;
  return *_cache_global_pos;
}

void UINode::set_global_pos(double x, double y, double z) {
  if (_parent == nullptr) {
    move_to(x, y, z);
    return;
  }
  const Vector3& g = _parent->global_pos();
  move_to(x - g.x, y - g.y, z - g.z);
}

UINode& UINode::move_to_global(double x, double y, double z) {
  if (_parent == nullptr) return move_to(x, y, z);
  const Vector3& g = _parent->global_pos();
  return move_to(x - g.x, y - g.y, z - g.z);
}

const UINode::Cross& UINode::cross() const {
  if (_cache_cross.has_value()) return *_cache_cross;
  const double w_ = size.x;
  const double h_ = size.y;
  const double a = center.x;
  const double b = center.y;
  Cross out;
  out.left = -a * w_;
  out.top = -b * h_;
  out.right = (1 - a) * w_;
  out.bottom = (1 - b) * h_;
  out.mid_x = (out.left + out.right) / 2;
  out.mid_y = (out.top + out.bottom) / 2;
  _cache_cross = out;
  return *_cache_cross;
}

const UINode::Rect& UINode::rect() const {
  if (_cache_rect.has_value()) return *_cache_rect;
  const Cross& c = cross();
  Rect out;
  out.left = pos.x + c.left;
  out.top = pos.y + c.top;
  out.right = pos.x + c.right;
  out.bottom = pos.y + c.bottom;
  _cache_rect = out;
  return *_cache_rect;
}

const UINode::Geo& UINode::geo() const {
  if (_cache_geo.has_value()) return *_cache_geo;
  const Cross& c = cross();
  const Vector3& g = global_pos();
  Geo out;
  out.pos_x = g.x;
  out.pos_y = g.y;
  out.left = g.x + c.left;
  out.top = g.y + c.top;
  out.right = g.x + c.right;
  out.bottom = g.y + c.bottom;
  _cache_geo = out;
  return *_cache_geo;
}

bool UINode::hit(double x, double y) const {
  const double l = pos.x - lfw::round(center.x * size.x);
  const double t = pos.y - lfw::round(center.y * size.y);
  // `const [w, h] = this.data.size;`：读的是**原始数据**的 size 数组（照抄）。
  const Value* const data_size = field_of(_data, u"size");
  const Array* const arr = data_size != nullptr ? as_array(*data_size) : nullptr;
  const double dw = arr != nullptr && arr->size() > 0 ? num_of(arr->at(0)) : std::nan("");
  const double dh = arr != nullptr && arr->size() > 1 ? num_of(arr->at(1)) : std::nan("");
  return l <= x && t <= y && l + dw >= x && t + dh >= y;
}

void UINode::set_focused(bool v) {
  if (v == (focused_node() == this)) return;
  if (v) {
    set_focused_node(this);
  } else if (focused_node() == this) {
    set_focused_node(nullptr);
  }
}

void UINode::set_focused_node(UINode* val) {
  UINode& rt = root();
  UINode* const old = rt._focused_node;
  if (old == val) return;
  if (val != nullptr && (val->disabled() || !val->visible())) val = nullptr;
  rt._focused_node = val;
  if (old != nullptr) {
    old->on_blur();
    if (old->callbacks.on_foucs_changed) old->callbacks.on_foucs_changed(*old);
  }
  if (val != nullptr) {
    val->on_foucs();
    if (val->callbacks.on_foucs_changed) val->callbacks.on_foucs_changed(*val);
  }
  if (rt.callbacks.on_foucs_item_changed) rt.callbacks.on_foucs_item_changed(val, old);
}

Value UINode::id() const {
  const Value* const v = field_of(_data, u"id");
  return v != nullptr ? *v : Value();
}

Value UINode::name() const {
  const Value* const v = field_of(_data, u"name");
  return v != nullptr ? *v : Value();
}

bool UINode::visible() const {
  if (_parent == nullptr) return _visible;
  return _parent->visible() && _visible;
}

UINode& UINode::set_visible(bool v) {
  const bool prev = visible();
  _visible = v;
  if (prev != visible()) invoke_all_visible();
  if (!v && focused_node() != nullptr && !focused_node()->visible()) set_focused_node(nullptr);
  return *this;
}

std::u16string UINode::background() const {
  if (_background.has_value()) return *_background;
  const Value* const v = field_of(_data, u"background");
  if (v != nullptr && std::holds_alternative<std::u16string>(*v)) return std::get<std::u16string>(*v);
  return u"#000000";
}

std::u16string UINode::foreground() const {
  if (_foreground.has_value()) return *_foreground;
  const Value* const v = field_of(_data, u"foreground");
  if (v != nullptr && std::holds_alternative<std::u16string>(*v)) return std::get<std::u16string>(*v);
  return u"#000000";
}

double UINode::backgroundAlpha() const {
  if (_backgroundAlpha.has_value()) return *_backgroundAlpha;
  const Value* const v = field_of(_data, u"backgroundAlpha");
  return v != nullptr && !nullish(*v) ? to_number(*v) : 0.0;
}

double UINode::foregroundAlpha() const {
  if (_foregroundAlpha.has_value()) return *_foregroundAlpha;
  const Value* const v = field_of(_data, u"foregroundAlpha");
  return v != nullptr && !nullish(*v) ? to_number(*v) : 0.0;
}

bool UINode::disabled() const {
  if (_parent == nullptr) return _disabled;
  return _parent->disabled() || _disabled;
}

double UINode::global_opacity() const {
  if (_parent == nullptr) return to_number(_opacity);
  return to_number(_opacity) * to_number(_parent->_opacity);
}

double UINode::opacity() const { return to_number(_opacity); }

UINode& UINode::set_opacity(double v) {
  _opacity = Value(v);
  return *this;
}

UINode& UINode::set_disabled(bool v) {
  _disabled = v;
  if (v && focused_node() != nullptr && focused_node()->disabled()) set_focused_node(nullptr);
  return *this;
}

UINode& UINode::add_child(UINode& node) {
  _children.push_back(&node);
  return *this;
}

UINode& UINode::add_children(const std::vector<UINode*>& nodes) {
  for (UINode* const n : nodes) add_child(*n);
  return *this;
}

UINode* UINode::find_child(const std::u16string& id) {
  for (UINode* const c : _children) {
    if (loose_str_equals(c->id(), id)) return c;
  }
  return nullptr;
}

UINode* UINode::find_child_by_name(const std::u16string& name) {
  for (UINode* const c : _children) {
    if (loose_str_equals(c->name(), name)) return c;
  }
  return nullptr;
}

UINode* UINode::search_node(const std::u16string& id) {
  UINode* ret = find_child(id);
  if (ret != nullptr) return ret;
  for (UINode* const c : _children) {
    ret = c->search_node(id);
    if (ret != nullptr) return ret;
  }
  return nullptr;
}

UINode* UINode::lookup_node(const std::u16string& id) {
  UINode* const ret = find_child(id);
  if (ret != nullptr) return ret;
  return _parent != nullptr ? _parent->lookup_node(id) : nullptr;
}

UINode* UINode::find_parent_by_id(const std::u16string& id) {
  UINode* parent = _parent;
  while (parent != nullptr) {
    if (loose_str_equals(parent->id(), id)) return parent;
    parent = parent->_parent;
  }
  return nullptr;
}

UINode* UINode::find_parent(
    const std::function<bool(UINode&)>& match,
    const std::function<void(UINode&, const std::vector<UINode*>&)>& handler) {
  UINode* parent = _parent;
  std::vector<UINode*> path;
  while (parent != nullptr) {
    path.push_back(parent);
    if (match(*parent)) {
      if (handler) handler(*parent, path);
      return parent;
    }
    parent = parent->_parent;
  }
  return nullptr;
}

Value UINode::get_value(const std::u16string& name, bool lookup) const {
  const Value* const values = field_of(_data, u"values");
  if (const Object* const o = values != nullptr ? as_object(*values) : nullptr) {
    if (const Value* const v = o->get(name)) return *v;
  }
  if (lookup && _parent != nullptr) return _parent->get_value(name, lookup);
  return Value();
}

void UINode::on_pointer_down(LFWPointerEvent& e) {
  _pointer_down = 1;
  _click_flag = 1;
  // 4AN：components 恒空（UIComponent 刀再补循环）。
  if (callbacks.on_pointer_down) callbacks.on_pointer_down(e, *this);
}

void UINode::on_pointer_move(LFWPointerEvent& e) {
  if (callbacks.on_pointer_move) callbacks.on_pointer_move(e, *this);
}

void UINode::on_pointer_up(LFWPointerEvent& e) {
  _pointer_down = 0;
  if (callbacks.on_pointer_up) callbacks.on_pointer_up(e, *this);
}

void UINode::on_pointer_cancel(LFWPointerEvent& e) {
  _pointer_down = 0;
  if (callbacks.on_pointer_cancel) callbacks.on_pointer_cancel(e, *this);
}

void UINode::on_pointer_leave() {
  _pointer_over = 0;
  _click_flag = 0;
  if (callbacks.on_pointer_leave) callbacks.on_pointer_leave(*this);
}

void UINode::on_pointer_enter() {
  _pointer_over = 1;
  if (callbacks.on_pointer_enter) callbacks.on_pointer_enter(*this);
}

void UINode::on_show() {
  if (callbacks.on_show) callbacks.on_show(*this);
  const Value* const auto_focus = field_of(_data, u"auto_focus");
  if (auto_focus != nullptr && truthy(*auto_focus) && !disabled() && focused_node() == nullptr) {
    set_focused_node(this);
  }
}

void UINode::on_hide() {
  if (focused_node() == this) set_focused_node(nullptr);
  if (callbacks.on_hide) callbacks.on_hide(*this);
}

void UINode::on_foucs() {
  // components / renderer 面随后续刀补（本刀为空转发）。
}

void UINode::on_blur() {
  // components / renderer 面随后续刀补（本刀为空转发）。
}

void UINode::invoke_all_on_show() {
  on_show();
  for (UINode* const child : _children) {
    if (child->_visible) child->invoke_all_on_show();
  }
}

void UINode::invoke_all_on_hide() {
  on_hide();
  for (UINode* const child : _children) {
    if (child->_visible) child->invoke_all_on_hide();
  }
}

void UINode::invoke_all_visible() {
  if (_visible) {
    invoke_all_on_show();
  } else {
    invoke_all_on_hide();
  }
}

void UINode::update(double dt) {
  if (_prev_size.x != size.x || _prev_size.y != size.y || _prev_center.x != center.x ||
      _prev_center.y != center.y || _prev_pos.x != pos.x || _prev_pos.y != pos.y ||
      _prev_pos.z != pos.z) {
    clear_caches();
    _prev_size.x = size.x;
    _prev_size.y = size.y;
    _prev_center.x = center.x;
    _prev_center.y = center.y;
    _prev_pos.x = pos.x;
    _prev_pos.y = pos.y;
    _prev_pos.z = pos.z;
  }

  _update_times.add();
  // 4AN：components 恒空（UIComponent 刀再补）。
  for (UINode* const child : _children) {
    if (!child->disabled()) child->update(dt);
  }
}

}
