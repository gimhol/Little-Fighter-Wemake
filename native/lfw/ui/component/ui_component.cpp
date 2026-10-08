#include "lfw/ui/component/ui_component.h"

#include <limits>
#include <memory>
#include <string>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/keys.h"
#include "lfw/lfw.h"
#include "lfw/ui/register_class.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/string_help.h"
#include "lfw/utils/type_check.h"

namespace lfw {
namespace ui {

namespace {

// 静态初始化即注册（构造任何实例之前）。
const bool s_registered = []() {
  regist_ui_class(UIComponent::class_tag(), u"UIComponent");
  return true;
}();

const Value& undef() {
  static const Value v;
  return v;
}

const Value& field(const Value& obj, const char16_t* key) {
  const Object* const o = as_object(obj);
  if (o == nullptr) return undef();
  const Value* const p = o->get(std::u16string(key));
  return p != nullptr ? *p : undef();
}

bool starts_with(const std::u16string& s, const std::u16string& prefix) {
  return s.size() >= prefix.size() && s.compare(0, prefix.size(), prefix) == 0;
}

// JS `Number(text)` 的整数近似：空串 ⇒ 0；非法 ⇒ NaN。用例只走整数距离。
double number_of(const std::u16string& text) {
  size_t i = 0;
  size_t j = text.size();
  while (i < j && is_str_white_space(text[i])) ++i;
  while (j > i && is_str_white_space(text[j - 1])) --j;
  if (i == j) return 0.0;
  bool neg = false;
  if (text[i] == u'+' || text[i] == u'-') {
    neg = text[i] == u'-';
    ++i;
  }
  bool digits = false;
  double v = 0.0;
  for (; i < j; ++i) {
    if (text[i] < u'0' || text[i] > u'9') return std::numeric_limits<double>::quiet_NaN();
    v = v * 10.0 + static_cast<double>(text[i] - u'0');
    digits = true;
  }
  if (!digits) return std::numeric_limits<double>::quiet_NaN();
  return neg ? -v : v;
}

long index_of(const std::vector<UINode*>& list, UINode* node) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (list[i] == node) return static_cast<long>(i);
  }
  return -1;
}

// `new UIProps({ ...info.props, ...info.properties }, this)` 的展开语义（键序同 JS）。
Value merge_props(const Value& info) {
  const Value merged(std::make_shared<Object>());
  Object* const out = const_cast<Object*>(as_object(merged));
  const Object* const src = as_object(info);
  const auto merge = [&](const char16_t* key) {
    const Value* const v = src != nullptr ? src->get(std::u16string(key)) : nullptr;
    const Object* const o = v != nullptr ? as_object(*v) : nullptr;
    if (o == nullptr) return;
    for (const std::u16string& k : o->keys()) {
      const Value* const p = o->get(k);
      if (p != nullptr) out->set(k, *p);
    }
  };
  merge(u"props");
  merge(u"properties");
  return merged;
}

}

const ClazzTag* UIComponent::class_tag() {
  static const ClazzTag tag;
  return &tag;
}

const std::vector<std::u16string>& UIComponent::TAGS() {
  static const std::vector<std::u16string> tags{u"UIComponent"};
  return tags;
}

const Value& UIComponent::PROPS() {
  static const Value props(std::make_shared<Object>());
  return props;
}

const std::u16string& UIComponent::props_tag() const { return TAGS()[0]; }

const Value& UIComponent::props_meta() const { return PROPS(); }

UIComponent::UIComponent(UINode& layout, const std::u16string& f_name_in, const Value& info_in)
    : node(layout), f_name(f_name_in), info(info_in), props_holder(merge_props(info_in), *this) {
  const Value& enabled_v = field(info, u"enabled");
  if (const bool* const b = std::get_if<bool>(&enabled_v)) _enabled = *b;
  const Value& id_v = field(info, u"id");
  if (const std::u16string* const s = std::get_if<std::u16string>(&id_v)) id = *s;
  const Value& name_v = field(info, u"name");
  if (const std::u16string* const s = std::get_if<std::u16string>(&name_v)) name = *s;
}

bool UIComponent::ensure_props() {
  if (!_props_error && std::holds_alternative<std::monostate>(_props)) {
    props_holder.validate(props_tag(), props_meta());
    if (!props_holder.errors().empty()) {
      _props_error = true;
      return false;
    }
    _props = props_holder.raw();
  }
  return !_props_error;
}

const Value* UIComponent::props() {
  if (!ensure_props()) return nullptr;
  return &_props;
}

double UIComponent::LR() const {
  const double r = keys().get(u"R")->is_end() ? 0.0 : 1.0;
  const double l = keys().get(u"L")->is_end() ? 0.0 : 1.0;
  return r - l;
}

double UIComponent::UD() const {
  const double u = keys().get(u"U")->is_end() ? 0.0 : 1.0;
  const double d = keys().get(u"D")->is_end() ? 0.0 : 1.0;
  return u - d;
}

std::u16string UIComponent::node_name() const {
  const Value& n = node.name();
  if (const std::u16string* const s = std::get_if<std::u16string>(&n)) return *s;
  const Value& i = node.id();
  if (const std::u16string* const s = std::get_if<std::u16string>(&i)) return *s;
  return u"no_name";
}

LFW& UIComponent::lfw() { return node.lfw(); }

World& UIComponent::world() { return node.lfw().world(); }

Keys& UIComponent::keys() const {
  if (_keys == nullptr) _keys = node.lfw().create_keys();
  return *_keys;
}

void UIComponent::recycle_keys() {
  // TS `this._keys?.unmount()`：回收但**保留引用**（后续 `keys` getter 拿到的是已卸下的同一把）。
  if (_keys != nullptr) _keys->unmount();
}

std::optional<double> UIComponent::num(size_t idx) {
  const Array* const args = as_array(field(info, u"args"));
  if (args == nullptr || idx >= args->size()) return std::nullopt;
  const double n = to_number(args->at(idx));
  return is_num(n) ? std::optional<double>(n) : std::nullopt;
}

std::optional<std::u16string> UIComponent::str(size_t idx) {
  const Array* const args = as_array(field(info, u"args"));
  if (args == nullptr || idx >= args->size()) return std::nullopt;
  return to_string(args->at(idx));
}

bool UIComponent::bool_(size_t idx) {
  const std::optional<std::u16string> s = str(idx);
  if (!s.has_value() || s->empty()) return false;
  const std::u16string text = to_lower_case(*s);
  return !(text == u"false" || text == u"0");
}

std::optional<std::vector<double>> UIComponent::nums(size_t idx, size_t length) {
  const Array* const args = as_array(field(info, u"args"));
  if (args == nullptr || idx >= args->size()) return std::nullopt;

  const std::u16string key =
      u"nums_" + number_to_string(static_cast<double>(idx)) + u"_" +
      number_to_string(static_cast<double>(length));
  const auto it = _nums_caches.find(key);
  if (it != _nums_caches.end() && it->second.set) {
    if (it->second.failed) return std::nullopt;
    return it->second.nums;
  }

  const Value raw_v = args->at(idx);
  Value raw = raw_v;
  if (const std::u16string* const text = std::get_if<std::u16string>(&raw_v)) {
    Value arr(std::make_shared<Array>());
    Array* const a = as_array(arr);
    size_t start = 0;
    for (size_t i = 0; i <= text->size(); ++i) {
      if (i == text->size() || (*text)[i] == u',') {
        a->push_back(Value(text->substr(start, i - start)));
        start = i + 1;
      }
    }
    raw = arr;
  }
  const Array* const list = as_array(raw);
  NumsCache& cache = _nums_caches[key];
  if (list == nullptr || list->size() < length) {
    cache.set = true;
    cache.failed = true;
    return std::nullopt;
  }
  std::vector<double> ret;
  ret.reserve(length);
  for (size_t i = 0; i < length; ++i) {
    const double n = to_number(list->at(i));
    if (!is_num(n)) {
      cache.set = true;
      cache.failed = true;
      return std::nullopt;
    }
    ret.push_back(n);
  }
  cache.set = true;
  cache.failed = false;
  cache.nums = ret;
  return ret;
}

std::optional<Vector3> UIComponent::vec3(size_t idx) {
  const std::u16string key = u"vec3_" + number_to_string(static_cast<double>(idx));
  const auto it = _vec3_caches.find(key);
  if (it != _vec3_caches.end() && it->second.set) {
    if (it->second.failed) return std::nullopt;
    return it->second.v;
  }
  const std::optional<std::vector<double>> list = nums(idx, 3);
  Vec3Cache& cache = _vec3_caches[key];
  if (!list.has_value()) {
    cache.set = true;
    cache.failed = true;
    return std::nullopt;
  }
  cache.set = true;
  cache.failed = false;
  cache.v = Vector3{(*list)[0], (*list)[1], (*list)[2]};
  return cache.v;
}

UINode* UIComponent::find_node(const Value& which) {
  const std::u16string* const tp = std::get_if<std::u16string>(&which);
  if (tp == nullptr) return &node;
  const std::u16string w = js_trim(*tp);
  if (starts_with(w, u"parent:")) {
    UINode* parent = node.parent();
    double distance = number_of(w.substr(7));
    while (parent != nullptr && distance != 0.0 && !std::isnan(distance)) {
      parent = parent->parent();
      distance -= 1.0;
    }
    return parent;
  }
  if (w == u"parent") return node.parent();
  if (w == u"self") return &node;
  UINode* const parent = node.parent();
  if (parent != nullptr && starts_with(w, u"bro:")) {
    const std::u16string v = js_trim(w.substr(4));
    const std::vector<UINode*>& brothers = parent->children();
    const long len = static_cast<long>(brothers.size());
    if (len < 1) return nullptr;
    UINode* bro = nullptr;
    if (v == u"prev" || v == u"-1") {
      const long at = index_of(brothers, &node) - 1;
      if (at >= 0 && at < len) bro = brothers[static_cast<size_t>(at)];
    } else if (v == u"next" || v == u"+1") {
      const long at = index_of(brothers, &node) + 1;
      if (at >= 0 && at < len) bro = brothers[static_cast<size_t>(at)];
    } else {
      uint32_t at = 0;
      if (is_array_index(v, at) && static_cast<long>(at) < len) {
        bro = brothers[static_cast<size_t>(at)];
      }
    }
    if (bro == &node) return nullptr;
    return bro;
  }
  if (starts_with(w, u"id:")) {
    return node.root().search_node(js_trim(w.substr(3)));
  }
  if (starts_with(w, u"name:")) {
    return node.root().find_child_by_name(js_trim(w.substr(5)));
  }
  return nullptr;
}

}
}
