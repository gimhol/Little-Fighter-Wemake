#include "lfw/ui/uinode.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <utility>

#include "lfw/core/js_string.h"
#include "lfw/core/json.h"
#include "lfw/lfw.h"
#include "lfw/ui/action/actor.h"
#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/register_class.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/value_spread.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/round_float.h"

namespace lfw::ui {

namespace {

// 静态初始化即注册（`$cls:UINode` 标记复原用）。
const bool s_registered = []() {
  regist_ui_class(UINode::class_tag(), u"UINode");
  return true;
}();

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

double num_of(const Value& v) {
  const double* const d = std::get_if<double>(&v);
  return d != nullptr ? *d : std::nan("");
}

// JS 数值真值性：`0` / `NaN` 为假。
double num_or_zero(const Value& v) {
  const double n = to_number(v);
  return truthy(Value(n)) ? n : 0.0;
}

double num_or_one(const Value& v) {
  const double n = to_number(v);
  return truthy(Value(n)) ? n : 1.0;
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

UINode::~UINode() = default;

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
  {
    const Value* const txt = field_of(data, u"txt_info");
    const Value* const i18n = field_of(data, u"i18n");
    Value tv = txt != nullptr && !nullish(*txt) ? *txt : Value(NullTag{});
    if (truthy(tv) && i18n != nullptr && truthy(*i18n)) tv = make_i18n_text(tv, *i18n);
    set_text_object(tv);
  }
  {
    const Value* const img = field_of(data, u"img_info");
    _image = img != nullptr && !nullish(*img) ? *img : Value(NullTag{});
  }
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
  _owned_renderer.reset(lfw.host().create_ui_node_renderer(*this));
  renderer = _owned_renderer.get();
}

void UINode::set3(Vector3& v, const Value& arr) {
  const Array* const a = as_array(arr);
  if (a == nullptr) return;
  v.set(a->size() > 0 ? num_of(a->at(0)) : std::nan(""), a->size() > 1 ? num_of(a->at(1)) : std::nan(""),
        a->size() > 2 ? num_of(a->at(2)) : std::nan(""));
}

Value UINode::make_i18n_text(const Value& baked, const Value& key) {
  const Value resolved = _lfw->string(key);
  const Value* const baked_text = field_of(baked, u"text");
  if (baked_text != nullptr && strict_equals(resolved, *baked_text)) return baked;
  const Value* const baked_style = field_of(baked, u"style");
  const Value* const data_style = field_of(_data, u"style");
  const Value style = baked_style != nullptr && !nullish(*baked_style)
                          ? *baked_style
                          : (data_style != nullptr && !nullish(*data_style) ? *data_style : Value());
  return _lfw->host().measure_text(resolved, style);
}

UINode& UINode::set_text_object(const Value& v) {
  _text_style_versioned = false;
  _text = v;
  auto_size_by_text(v);
  return *this;
}

UINode& UINode::set_text(const std::u16string& text) { return set_text(text, Value()); }

UINode& UINode::set_text(const std::u16string& text, const Value& style) {
  // `new TextInfo({ text, style: style ?? this.style })`；ImageInfo 的默认字段一并落键。
  const bool use_node_style = nullish(style);
  Value obj(std::make_shared<Object>());
  Object* const o = as_object(obj);
  o->set(u"text", Value(text));
  o->set(u"style", use_node_style ? this->style.data() : style);
  o->set(u"w", Value(0.0));
  o->set(u"h", Value(0.0));
  o->set(u"scale", Value(0.0));
  _text_style_versioned = use_node_style;
  _text = obj;
  auto_size_by_text(_text);
  return *this;
}

bool UINode::same_text_size_key(const TextSizeKey& a, const TextSizeKey& b) const {
  if (a.versioned != b.versioned || a.text != b.text) return false;
  return a.versioned ? a.version == b.version : a.json == b.json;
}

UINode::TextSizeKey UINode::text_size_key(const Value& v) const {
  TextSizeKey k;
  k.set = true;
  const Value* const text_v = field_of(v, u"text");
  k.text = to_string(_lfw->string(text_v != nullptr ? *text_v : Value()));
  const Value* const s = field_of(v, u"style");
  if (_text_style_versioned) {
    k.versioned = true;
    k.version = style.version();
  } else {
    const Value sv = s != nullptr && !nullish(*s) ? *s : Value(std::make_shared<Object>());
    const std::optional<std::u16string> js = json_stringify(sv);
    k.json = js.has_value() ? *js : u"undefined";
  }
  return k;
}

void UINode::auto_size_by_text(const Value& v) {
  const Value* const raw_size = field_of(_raw, u"size");
  if (!truthy(v) || (raw_size != nullptr && truthy(*raw_size)) || _parent == nullptr) {
    _auto_size_key = TextSizeKey();
    return;
  }
  const TextSizeKey key = text_size_key(v);
  if (_auto_size_key.set && same_text_size_key(_auto_size_key, key)) return;
  _auto_size_key = key;
  Value ti = v;
  const Value* const vw = field_of(v, u"w");
  const Value* const vh = field_of(v, u"h");
  if (!(vw != nullptr && truthy(*vw) && vh != nullptr && truthy(*vh))) {
    const Value* const text_v = field_of(v, u"text");
    const Value* const style_v = field_of(v, u"style");
    ti = _lfw->host().measure_text(_lfw->string(text_v != nullptr ? *text_v : Value()),
                                   style_v != nullptr ? *style_v : Value());
  }
  const Value* const tw = field_of(ti, u"w");
  const Value* const th = field_of(ti, u"h");
  const Value* const ts = field_of(ti, u"scale");
  const double w = tw != nullptr ? num_or_zero(*tw) : 0.0;
  const double h = th != nullptr ? num_or_zero(*th) : 0.0;
  const double s = ts != nullptr ? num_or_one(*ts) : 1.0;
  resize(w / s, h / s);
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
  for (UIComponent* const c : _components) c->on_pointer_down(e);
  if (callbacks.on_pointer_down) callbacks.on_pointer_down(e, *this);
}

void UINode::on_pointer_move(LFWPointerEvent& e) {
  for (UIComponent* const c : _components) c->on_pointer_move(e);
  if (callbacks.on_pointer_move) callbacks.on_pointer_move(e, *this);
}

void UINode::on_pointer_up(LFWPointerEvent& e) {
  _pointer_down = 0;
  for (UIComponent* const c : _components) c->on_pointer_up(e);
  if (callbacks.on_pointer_up) callbacks.on_pointer_up(e, *this);
}

void UINode::on_pointer_cancel(LFWPointerEvent& e) {
  _pointer_down = 0;
  for (UIComponent* const c : _components) c->on_pointer_cancel(e);
  if (callbacks.on_pointer_cancel) callbacks.on_pointer_cancel(e, *this);
}

void UINode::on_pointer_leave() {
  _pointer_over = 0;
  _click_flag = 0;
  for (UIComponent* const c : _components) c->on_pointer_leave();
  if (callbacks.on_pointer_leave) callbacks.on_pointer_leave(*this);
}

void UINode::on_pointer_enter() {
  _pointer_over = 1;
  for (UIComponent* const c : _components) c->on_pointer_enter();
  if (callbacks.on_pointer_enter) callbacks.on_pointer_enter(*this);
}

void UINode::on_show() {
  for (UIComponent* const c : _components) c->on_show();
  if (callbacks.on_show) callbacks.on_show(*this);
  const Value* const auto_focus = field_of(_data, u"auto_focus");
  if (auto_focus != nullptr && truthy(*auto_focus) && !disabled() && focused_node() == nullptr) {
    set_focused_node(this);
  }
  if (renderer != nullptr) renderer->on_show();
}

void UINode::on_hide() {
  if (focused_node() == this) set_focused_node(nullptr);
  for (UIComponent* const c : _components) c->on_hide();
  if (callbacks.on_hide) callbacks.on_hide(*this);
  if (renderer != nullptr) renderer->on_hide();
}

void UINode::on_foucs() {
  for (UIComponent* const c : _components) c->on_foucs();
  if (renderer != nullptr) renderer->on_foucs();
}

void UINode::on_blur() {
  for (UIComponent* const c : _components) c->on_blur();
  if (renderer != nullptr) renderer->on_blur();
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
  _components_updating = true;
  for (UIComponent* const c : _components) {
    if (c->enabled()) c->update(dt);
  }
  _components_updating = false;
  if (!_del_components.empty()) {
    del_components(_del_components);
    _del_components.clear();
  }

  for (UINode* const child : _children) {
    if (!child->disabled()) child->update(dt);
  }
}

std::unique_ptr<UINode> UINode::create(LFW& lfw, const Value& info, UINode* parent,
                                       UILayer* layer) {
  std::unique_ptr<UINode> ret = std::make_unique<UINode>(lfw, info, parent, layer);
  const Value* const component = field_of(info, u"component");
  if (component != nullptr && truthy(*component)) {
    std::vector<std::unique_ptr<UIComponent>> components = lfw.factory.create_components(*ret, *component);
    for (std::unique_ptr<UIComponent>& c : components) {
      ret->_components.push_back(c.get());
      ret->_owned_components.push_back(std::move(c));
    }
  }
  const Value* const items = field_of(info, u"items");
  const Array* const arr = items != nullptr ? as_array(*items) : nullptr;
  if (arr != nullptr) {
    for (size_t i = 0; i < arr->size(); ++i) {
      const Value& item_info = arr->at(i);
      const Value* const count_p = field_of(item_info, u"count");
      double count = 1.0;
      if (count_p != nullptr && std::holds_alternative<double>(*count_p)) {
        const double c = std::get<double>(*count_p);
        if (!std::isnan(c) && c > 0.0) count = c;
      }
      // TS 是 `while (count) { ...; --count }`：小数 count 步进到负数会继续转（TS 侧死循环，
      // 用例不覆盖）；这里照抄数值真值语义（NaN/0 停）。
      while (count != 0.0 && !std::isnan(count)) {
        std::unique_ptr<UINode> child = create(lfw, item_info, ret.get());
        ret->add_child(*child);
        ret->_owned_children.push_back(std::move(child));
        count -= 1.0;
      }
    }
  }
  for (UIComponent* const c : ret->_components) c->on_add();
  return ret;
}

void UINode::on_start() {
  _update_times.reset();
  _state = Value(std::make_shared<Object>());
  // TS 把焦点存在 `_state` 上（on_start 直接换新对象），端口同步复位。
  _state_focused_node = nullptr;
  for (UIComponent* const c : _components) {
    c->stopped = false;
    c->on_start();
  }
  for (UINode* const c : _children) c->on_start();
  const Value* const actions = field_of(_data, u"actions");
  const Value* const start = actions != nullptr ? field_of(*actions, u"start") : nullptr;
  if (start != nullptr && truthy(*start)) actor().act(*this, *start);
  if (renderer != nullptr) renderer->on_start();
}

void UINode::on_stop() {
  for (UIComponent* const c : _components) {
    c->stopped = true;
    c->on_stop();
  }
  for (UINode* const c : _children) c->on_stop();
  const Value* const actions = field_of(_data, u"actions");
  const Value* const stop = actions != nullptr ? field_of(*actions, u"stop") : nullptr;
  if (stop != nullptr && truthy(*stop)) actor().act(*this, *stop);
  if (renderer != nullptr) renderer->on_stop();
}

void UINode::on_resume() {
  if (_parent == nullptr) {
    set_focused_node(_state_focused_node);
    if (_visible) invoke_all_visible();
  }
  for (UIComponent* const c : _components) {
    c->paused = false;
    c->mounted = true;
    c->on_resume();
  }
  for (UINode* const c : _children) c->on_resume();
  const Value* const actions = field_of(_data, u"actions");
  const Value* const resume = actions != nullptr ? field_of(*actions, u"resume") : nullptr;
  if (resume != nullptr && truthy(*resume)) actor().act(*this, *resume);
  if (renderer != nullptr) renderer->on_resume();
}

void UINode::on_pause() {
  if (_parent == nullptr) {
    _state_focused_node = focused_node();
    set_focused_node(nullptr);
    invoke_all_on_hide();
  }
  if (&root() == this && renderer != nullptr) renderer->del_self();
  const Value* const actions = field_of(_data, u"actions");
  const Value* const pause = actions != nullptr ? field_of(*actions, u"pause") : nullptr;
  if (pause != nullptr && truthy(*pause)) actor().act(*this, *pause);
  for (UIComponent* const c : _components) {
    c->paused = true;
    c->mounted = false;
    c->on_pause();
    c->recycle_keys();
  }
  for (UINode* const c : _children) c->on_pause();
  if (renderer != nullptr) renderer->on_pause();
}

void UINode::on_click(LFWPointerEvent& e) {
  const Value* const actions = field_of(_data, u"actions");
  const Value* const click = actions != nullptr ? field_of(*actions, u"click") : nullptr;
  const Value* const rclick = actions != nullptr ? field_of(*actions, u"rclick") : nullptr;
  const Value* const mclick = actions != nullptr ? field_of(*actions, u"mclick") : nullptr;
  if (click != nullptr && truthy(*click) && e.button == 0.0) {
    actor().act(*this, *click);
    e.stop_propagation();
  }
  if (mclick != nullptr && truthy(*mclick) && e.button == 1.0) {
    actor().act(*this, *mclick);
    e.stop_propagation();
  }
  if (rclick != nullptr && truthy(*rclick) && e.button == 2.0) {
    actor().act(*this, *rclick);
    e.stop_propagation();
  }
  for (UIComponent* const c : _components) {
    c->on_click(e);
    if (e.stopped() == 2) break;
  }
  if (callbacks.on_click) callbacks.on_click(e);
}

void UINode::on_key_down(LFWKeyEvent& e) {
  if (e.stopped() != 0) return;
  for (UIComponent* const c : _components) {
    c->on_key_down(e);
    if (e.stopped() == 2) return;
  }
  for (UINode* const c : _children) {
    c->on_key_down(e);
    if (e.stopped() == 2) return;
  }
  const Value* const actions = field_of(_data, u"actions");
  const Value* const click = actions != nullptr ? field_of(*actions, u"click") : nullptr;
  const Value* const rclick = actions != nullptr ? field_of(*actions, u"rclick") : nullptr;
  const Value* const mclick = actions != nullptr ? field_of(*actions, u"mclick") : nullptr;
  if (focused() && e.game_key == u"a" && click != nullptr && truthy(*click)) {
    actor().act(*this, *click);
    e.stop_immediate_propagation();
  }
  if (focused() && e.game_key == u"j" && rclick != nullptr && truthy(*rclick)) {
    actor().act(*this, *rclick);
    e.stop_immediate_propagation();
  }
  if (focused() && e.game_key == u"d" && mclick != nullptr && truthy(*mclick)) {
    actor().act(*this, *mclick);
    e.stop_immediate_propagation();
  }
}

void UINode::on_key_up(LFWKeyEvent& e) {
  if (e.stopped() != 0) return;
  for (UINode* const c : _children) {
    c->on_key_up(e);
    if (e.stopped() == 2) return;
  }
  for (UIComponent* const c : _components) {
    c->on_key_up(e);
    if (e.stopped() == 2) return;
  }
}

const ClazzTag* UINode::class_tag() {
  static const ClazzTag tag;
  return &tag;
}

UINode& UINode::add_components(const std::vector<UIComponent*>& components) {
  for (UIComponent* const component : components) {
    bool exists = false;
    for (UIComponent* const c : _components) {
      if (c == component) {
        exists = true;
        break;
      }
    }
    if (exists) continue;
    _components.push_back(component);
    component->on_add();
    if (callbacks.on_component_add) callbacks.on_component_add(*component, *this);
  }
  return *this;
}

UINode& UINode::del_components(const std::vector<UIComponent*>& components) {
  if (_components_updating) {
    _del_components.insert(_del_components.end(), components.begin(), components.end());
    return *this;
  }
  for (UIComponent* const component : components) {
    const auto it = std::find(_components.begin(), _components.end(), component);
    if (it == _components.end()) continue;
    _components.erase(it);
    component->on_del();
    if (callbacks.on_component_del) callbacks.on_component_del(*component, *this);
  }
  return *this;
}

UIComponent* UINode::find_component(const ClazzTag* type,
                                    const std::function<bool(UIComponent&)>& condition) {
  for (UIComponent* const v : _components) {
    if (!is_class(v->clazz(), type)) continue;
    if (!condition) return v;
    if (condition(*v)) return v;
  }
  return nullptr;
}

UIComponent* UINode::find_component_by_id(const ClazzTag* type, const std::u16string& id) {
  for (UIComponent* const v : _components) {
    if (!is_class(v->clazz(), type)) continue;
    if (v->id == id) return v;
  }
  return nullptr;
}

std::vector<UIComponent*> UINode::find_components(
    const ClazzTag* type, const std::function<UIFind(UIComponent&)>& condition) {
  std::vector<UIComponent*> ret;
  for (UIComponent* const v : _components) {
    if (!is_class(v->clazz(), type)) continue;
    if (!condition) {
      ret.push_back(v);
      continue;
    }
    const UIFind r = condition(*v);
    if (r == UIFind::Abort) break;
    if (r == UIFind::Yes) ret.push_back(v);
    if (r == UIFind::End) break;
  }
  return ret;
}

std::vector<UIComponent*> UINode::find_components_by_id(const ClazzTag* type,
                                                        const std::u16string& id) {
  std::vector<UIComponent*> ret;
  for (UIComponent* const v : _components) {
    if (!is_class(v->clazz(), type)) continue;
    if (v->id == id) ret.push_back(v);
  }
  return ret;
}

UIComponent* UINode::search_component(const ClazzTag* type,
                                      const std::function<bool(UIComponent&)>& condition) {
  UIComponent* const ret = find_component(type, condition);
  if (ret != nullptr) return ret;
  for (UINode* const child : _children) {
    UIComponent* const found = child->search_component(type, condition);
    if (found != nullptr) return found;
  }
  return nullptr;
}

UIComponent* UINode::search_component_by_id(const ClazzTag* type, const std::u16string& id) {
  const auto cond = [&id](UIComponent& v) { return v.id == id; };
  return search_component(type, cond);
}

std::vector<UIComponent*> UINode::search_components(
    const ClazzTag* type, const std::function<UIFind(UIComponent&)>& condition) {
  std::vector<UIComponent*> ret = find_components(type, condition);
  for (UINode* const child : _children) {
    std::vector<UIComponent*> sub = child->search_components(type, condition);
    ret.insert(ret.end(), sub.begin(), sub.end());
  }
  return ret;
}

UIComponent* UINode::lookup_component(const ClazzTag* type,
                                      const std::function<bool(UIComponent&)>& condition) {
  UIComponent* const ret = find_component(type, condition);
  if (ret != nullptr) return ret;
  return _parent != nullptr ? _parent->lookup_component(type, condition) : nullptr;
}

UIComponent* UINode::lookup_component_by_id(const ClazzTag* type, const std::u16string& id) {
  const auto cond = [&id](UIComponent& v) { return v.id == id; };
  return lookup_component(type, cond);
}

bool UINode::traversal_components(const std::function<bool(UIComponent&, int)>& fn, int depth) {
  for (UIComponent* const c : _components) {
    if (fn(*c, depth)) return true;
  }
  for (UINode* const child : _children) {
    if (child->traversal_components(fn, depth + 1)) return true;
  }
  return false;
}

bool UINode::pop_page(const UIPopPageOpts& opts) {
  UINode& rt = root();
  UILayer* const layer = rt._layer;
  if (layer == nullptr || layer->ui() != &rt) return false;
  layer->pop(opts);
  return true;
}

}
