#include "lfw/ui/component/ui_props.h"

#include <memory>
#include <string>
#include <vector>

#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/instance_ref.h"
#include "lfw/ui/read_info_value.h"
#include "lfw/ui/register_class.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/read_nums.h"
#include "lfw/utils/schema/make_schema.h"
#include "lfw/utils/type_check.h"

namespace lfw {
namespace ui {

namespace {

const Value& undef() {
  static const Value v;
  return v;
}

bool key_in(const Value& obj, const std::u16string& name) {
  const Object* const o = as_object(obj);
  return o != nullptr && o->has(name);
}

const Value& field(const Value& obj, const std::u16string& name) {
  const Object* const o = as_object(obj);
  if (o == nullptr) return undef();
  const Value* const p = o->get(name);
  return p != nullptr ? *p : undef();
}

void set_field(const Value& obj, const std::u16string& name, Value v) {
  Object* const o = const_cast<Object*>(as_object(obj));
  if (o != nullptr) o->set(name, std::move(v));
}

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

}

UIProps::UIProps(const Value& raw_in, UIComponent& owner) : _owner(&owner) {
  const Value merged(std::make_shared<Object>());
  if (const Object* const src = as_object(raw_in)) {
    for (const std::u16string& key : src->keys()) {
      const Value* const p = src->get(key);
      if (p == nullptr) continue;
      Value v = *p;
      if (const std::u16string* const text = std::get_if<std::u16string>(&v)) {
        if (text->rfind(u"$val:", 0) == 0) {
          // `parse_ui_value(owner.node.data, null, value) ?? value`：解析失败或回 null（TS 抛 / 空值）
          // 时保留原值。
          Value parsed;
          bool out_null = false;
          std::u16string error;
          const UIValueType type{UIValueType::Kind::Null, UIJudger::None};
          if (parse_ui_value(owner.node.data(), type, v, parsed, out_null, error) && !out_null) {
            v = parsed;
          }
        }
      }
      set_field(merged, key, std::move(v));
    }
  }
  _raw = merged;

  _validator.instance_getter([this](const Value& raw, const std::u16string& clazz,
                                    const Value& s) -> Value {
    (void)s;
    const ClazzTag* const tag = find_ui_class(clazz);
    if (tag == nullptr) return Value(NullTag{});
    const std::u16string* const text = std::get_if<std::u16string>(&raw);
    UINode& node = _owner->node;
    if (is_class(tag, UIComponent::class_tag())) {
      if (text == nullptr) return Value(NullTag{});
      const std::u16string& id = *text;
      const std::function<bool(UIComponent&)> cond = [&id](UIComponent& v) { return v.id == id; };
      if (UIComponent* const mine = node.search_component(tag, cond)) return make_comp_ref(mine);
      UINode* const parent = node.parent();
      UIComponent* const up =
          parent != nullptr ? parent->lookup_component(tag, cond) : nullptr;
      return up != nullptr ? make_comp_ref(up) : Value(NullTag{});
    }
    if (is_class(tag, UINode::class_tag())) {
      if (text == nullptr) return Value(NullTag{});
      const std::u16string& id = *text;
      if (UINode* const spec = _owner->find_node(raw)) return make_node_ref(spec);
      if (UINode* const mine = node.search_node(id)) return make_node_ref(mine);
      UINode* const parent = node.parent();
      UINode* const up = parent != nullptr ? parent->lookup_node(id) : nullptr;
      return up != nullptr ? make_node_ref(up) : Value(NullTag{});
    }
    return Value(NullTag{});
  });
  _validator.instance_setter(
      [](const Value&, const Value&, const std::u16string&, const Value&) {});
}

bool UIProps::has(const std::u16string& name) const { return key_in(_raw, name); }

std::optional<double> UIProps::num(const std::u16string& name) const {
  if (!has(name)) return std::nullopt;
  const Value& v = field(_raw, name);
  return is_num(v) ? std::optional<double>(std::get<double>(v)) : std::nullopt;
}

void UIProps::set_num(const std::u16string& name, const Value& v) { set_field(_raw, name, v); }

std::optional<std::u16string> UIProps::str(const std::u16string& name,
                                           const std::vector<std::u16string>& one_of) const {
  if (!has(name)) return std::nullopt;
  const Value& v = field(_raw, name);
  const std::u16string* const ret = std::get_if<std::u16string>(&v);
  if (ret == nullptr) return std::nullopt;
  if (one_of.empty()) return *ret;
  for (const std::u16string& a : one_of) {
    if (a == *ret) return *ret;
  }
  return std::nullopt;
}

void UIProps::set_strs(const std::u16string& name, std::vector<std::u16string> v) {
  Value arr(std::make_shared<Array>());
  Array* const a = as_array(arr);
  for (std::u16string& s : v) a->push_back(Value(std::move(s)));
  set_field(_raw, name, std::move(arr));
}

void UIProps::any_str_arr(const Value& v, std::vector<std::u16string>& out) const {
  if (is_nullish(v)) return;
  if (const Array* const a = as_array(v)) {
    for (size_t i = 0; i < a->size(); ++i) any_str_arr(a->at(i), out);
    return;
  }
  if (const std::u16string* const s = std::get_if<std::u16string>(&v)) {
    // `v.split(',')`：保留空段（`"".split(',')` ⇒ `[""]`）。
    size_t start = 0;
    for (size_t i = 0; i <= s->size(); ++i) {
      if (i == s->size() || (*s)[i] == u',') {
        out.push_back(s->substr(start, i - start));
        start = i + 1;
      }
    }
    return;
  }
  if (const double* const d = std::get_if<double>(&v)) {
    out.push_back(number_to_string(*d));
    return;
  }
  if (const bool* const b = std::get_if<bool>(&v)) {
    out.push_back(*b ? u"true" : u"false");
    return;
  }
}

std::optional<std::vector<std::u16string>> UIProps::strs(const std::u16string& name) const {
  if (!has(name)) return std::nullopt;
  std::vector<std::u16string> out;
  any_str_arr(field(_raw, name), out);
  return out;
}

std::optional<bool> UIProps::bool_(const std::u16string& name) const {
  if (!has(name)) return std::nullopt;
  const std::u16string text = to_string(field(_raw, name));
  return !(text == u"false" || text == u"0");
}

std::optional<std::vector<Value>> UIProps::nums(const std::u16string& name, double len,
                                                const Value& fallbacks) const {
  std::vector<Value> out;
  std::u16string error;
  if (!read_nums(field(_raw, name), len, fallbacks, out, &error)) return std::nullopt;
  return out;
}

bool UIProps::validate(const std::u16string& tag, const Value& props_meta) {
  const Value meta(std::make_shared<Object>());
  set_field(meta, u"key", Value(tag + u"Props"));
  set_field(meta, u"type", Value(u"object"));
  set_field(meta, u"properties", props_meta);
  const Value schema = schema::make_schema(meta);
  _validator.validate(_raw, schema);
  return _validator.errors().empty();
}

}
}
