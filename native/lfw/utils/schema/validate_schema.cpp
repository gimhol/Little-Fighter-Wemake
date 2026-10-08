#include "lfw/utils/schema/validate_schema.h"

#include <cmath>
#include <memory>

#include "lfw/core/js_string.h"
#include "lfw/core/json.h"
#include "lfw/utils/string_help.h"

namespace lfw {
namespace schema {

namespace {

const Value& undef() {
  static const Value v;
  return v;
}

const Value& field(const Value& obj, const char16_t* key) {
  const Object* o = as_object(obj);
  if (o == nullptr) return undef();
  const Value* p = o->get(std::u16string(key));
  return p != nullptr ? *p : undef();
}

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// JS `v == false`（TS 里写成 `x == !1`）：`false` / `0` / `-0` / `""` 为真，
// `NaN` / `null` / `undefined` / 对象为假。
bool loose_equals_false(const Value& v) {
  if (const bool* b = std::get_if<bool>(&v)) return !*b;
  if (const double* d = std::get_if<double>(&v)) return *d == 0;
  if (const std::u16string* s = std::get_if<std::u16string>(&v)) return s->empty();
  return false;
}

// `Number.isInteger`：有限且小数部分为 0（`-0` 也算）。
bool is_js_integer(double v) { return std::isfinite(v) && std::floor(v) == v; }

// JS `Object.keys`：数组给下标字符串（`"0"`、`"1"`……），对象给自身键（整数键在前）。
std::vector<std::u16string> js_object_keys(const Value& v) {
  if (const Array* a = as_array(v)) {
    std::vector<std::u16string> out;
    out.reserve(a->size());
    for (size_t i = 0; i < a->size(); ++i) {
      out.push_back(number_to_string(static_cast<double>(i)));
    }
    return out;
  }
  return object_keys(v);
}

// `value[k]`：对象查键；数组按 JS 下标键查元素；其余给 `undefined`。
const Value& get_prop(const Value& target, const std::u16string& key) {
  if (const Object* o = as_object(target)) {
    const Value* p = o->get(key);
    return p != nullptr ? *p : undef();
  }
  if (const Array* a = as_array(target)) {
    uint32_t idx = 0;
    if (is_array_index(key, idx) && idx < a->size()) return a->at(idx);
  }
  return undef();
}

// `value[k] = v`：对象写键；数组只接下标键（属性键挂不到数组上，照抄不落地）。
void set_prop(const Value& target, const std::u16string& key, const Value& v) {
  if (Object* o = const_cast<Object*>(as_object(target))) {
    o->set(key, v);
    return;
  }
  if (Array* a = const_cast<Array*>(as_array(target))) {
    uint32_t idx = 0;
    if (is_array_index(key, idx) && idx < a->size()) a->at(idx) = v;
  }
}

// `JSON.stringify(schema.oneof)`：oneof 只有原始值 ⇒ `json_stringify` 与 JS 同形。
std::u16string json_of(const Value& v) {
  const std::optional<std::u16string> s = json_stringify(v);
  return s.has_value() ? *s : u"null";
}

// TS `_wrong(v, s, e)`：按 schema 的要求拼「类型不对」消息；恒返回 `false`。
bool wrong(const Value& v, const Value& s, std::vector<std::u16string>& e) {
  const auto abc = [&](const std::u16string& type) {
    e.push_back(u"type of '" + to_string(field(s, u"path")) + u"' must be " + type +
                u", but got " + to_string(v));
    return false;
  };
  const Value& t = field(s, u"type");
  const std::u16string* tp = std::get_if<std::u16string>(&t);
  const std::u16string type = tp != nullptr ? *tp : std::u16string();
  if (type == u"string") {
    if (truthy(field(field(s, u"string"), u"not_blank"))) return abc(u"non-blank string");
    if (truthy(field(field(s, u"string"), u"not_empty"))) return abc(u"non-empty string");
    return abc(u"string");
  }
  if (type == u"number" || type == u"integer") {
    const Value& n = field(s, u"number");
    const std::u16string sub = truthy(field(n, u"int")) ? u"integer" : u"number";
    if (truthy(field(n, u"nagetive"))) return abc(u"nagetive " + sub);
    if (truthy(field(n, u"positive"))) return abc(u"positive " + sub);
    if (loose_equals_false(field(n, u"positive"))) return abc(u"non-positive " + sub);
    if (loose_equals_false(field(n, u"nagetive"))) return abc(u"non-nagetive " + sub);
    return abc(sub);
  }
  if (type == u"array") {
    if (!truthy(field(s, u"items"))) {
      e.push_back(u"items not set! " + to_string(field(s, u"path")));
      return false;
    }
    return abc(u"array");
  }
  if (type == u"object") return abc(u"object");
  if (type == u"boolean") return abc(u"boolean");
  e.push_back(u"type of '" + to_string(field(s, u"path")) + u"' must be " + to_string(t) +
              u", but got " + to_string(v));
  return false;
}

}

SchemaValidator& SchemaValidator::Default() {
  static SchemaValidator v;
  return v;
}

SchemaValidator& SchemaValidator::instance_getter(InstanceGetter func) {
  _get_instance = std::move(func);
  return *this;
}

SchemaValidator& SchemaValidator::instance_setter(InstanceSetter func) {
  _set_instance = std::move(func);
  return *this;
}

SchemaValidator::InstanceAccess SchemaValidator::get_instance(size_t index) const {
  const DefinedInstance& d = _defined[index];
  const std::u16string path = to_string(field(d.schema, u"path"));
  if (!_get_instance) {
    return {false, Value(), u"[SchemaValidator] instance_getter not set! " + path};
  }
  const Value ret = _get_instance(d.raw_value, class_type_name(field(d.schema, u"type")), d.schema);
  if (truthy(ret)) return {true, ret, std::u16string()};
  // `prop_schema.nullable != false`（宽松 `!=`）
  if (!loose_equals_false(field(d.schema, u"nullable"))) {
    return {true, Value(NullTag{}), std::u16string()};
  }
  return {false, Value(),
          u"[SchemaValidator] " + path + u" not found, value: " + to_string(d.raw_value)};
}

std::u16string SchemaValidator::set_instance(size_t index, const Value& v) const {
  const DefinedInstance& d = _defined[index];
  if (!_set_instance) {
    return u"[SchemaValidator] instance_setter not set! " + to_string(field(d.schema, u"path"));
  }
  _set_instance(v, d.raw_value, class_type_name(field(d.schema, u"type")), d.schema);
  return std::u16string();
}

void SchemaValidator::reset() {
  _errors.clear();
  _warnings.clear();
}

bool SchemaValidator::validate(const Value& value, const Value& schema) {
  const Value& type = field(schema, u"type");

  if (is_nullish(value)) {
    const bool accept =
        truthy(field(schema, u"nullable")) || strict_equals(type, Value(u"null"));
    if (!accept) return wrong(value, schema, _errors);
    return true;
  }

  const std::u16string* tp = std::get_if<std::u16string>(&type);
  const std::u16string t = tp != nullptr ? *tp : std::u16string();
  // TS 的 `case Boolean: case String: case Number: case Array: case Object:` 构造器分支在端口里
  // 没有形态（type 恒为字符串或缺失）；自定义类分支同理，见头注。

  if (t == u"boolean") {
    if (!std::holds_alternative<bool>(value)) return wrong(value, schema, _errors);
  } else if (t == u"string") {
    if (!std::holds_alternative<std::u16string>(value)) return wrong(value, schema, _errors);
    const Value& s = field(schema, u"string");
    const std::u16string& text = std::get<std::u16string>(value);
    if (truthy(field(s, u"not_blank")) && js_trim(text).empty()) {
      return wrong(value, schema, _errors);
    }
    if (truthy(field(s, u"not_empty")) && text.empty()) return wrong(value, schema, _errors);
  } else if (t == u"number" || t == u"integer") {
    const double* d = std::get_if<double>(&value);
    if (d == nullptr) return wrong(value, schema, _errors);
    const Value& n = field(schema, u"number");
    if (!truthy(field(n, u"nan")) && std::isnan(*d)) return wrong(value, schema, _errors);
    if (truthy(field(n, u"int")) && !is_js_integer(*d)) return wrong(value, schema, _errors);
    if (truthy(field(n, u"nagetive")) && *d >= 0) return wrong(value, schema, _errors);
    if (truthy(field(n, u"positive")) && *d <= 0) return wrong(value, schema, _errors);
    if (loose_equals_false(field(n, u"nagetive")) && *d < 0) {
      return wrong(value, schema, _errors);
    }
    if (loose_equals_false(field(n, u"positive")) && *d > 0) {
      return wrong(value, schema, _errors);
    }
  } else if (t == u"array") {
    const Array* arr = as_array(value);
    if (arr == nullptr) return wrong(value, schema, _errors);
    const Value& items = field(schema, u"items");
    if (!truthy(items)) return wrong(value, schema, _errors);
    Array* mut = const_cast<Array*>(arr);
    for (size_t i = 0; i < arr->size(); ++i) {
      Value prop_value = arr->at(i);
      // 类类型：TS `Object.defineProperty(value, i, {get, set})` + `continue`（不删元素、不浅拷贝）。
      if (is_class_type(field(items, u"type"))) {
        DefinedInstance d;
        d.kind = DefinedInstance::Kind::ArrayItem;
        d.target = value;
        d.key = number_to_string(static_cast<double>(i));
        d.raw_value = prop_value;
        d.schema = items;
        _defined.push_back(std::move(d));
        continue;
      }
      if (const Array* inner = as_array(prop_value)) {
        // `value[i] = [...prop_value]`：先给槽位换一个浅拷贝，验证仍跑在**原数组**上。
        mut->at(i) = Value(std::make_shared<Array>(inner->items()));
      }
      // `else if (prop_value && typeof prop_type === 'object')`：`prop_type` 是**类型值**
      // （字符串，如 `"number"`），`typeof` 恒为 `"string"` ⇒ TS 里这就是死代码（作者笔误），
      // 照抄为「不落地」。
      if (!validate(prop_value, items)) return false;
    }
  } else if (t == u"object") {
    const bool is_object = as_object(value) != nullptr || as_array(value) != nullptr;
    if (!is_object) return wrong(value, schema, _errors);
    const Object* properties = as_object(field(schema, u"properties"));
    for (const std::u16string& k : js_object_keys(value)) {
      const bool known = properties != nullptr && properties->has(k);
      if (!known) {
        _warnings.push_back(u"unexpected key '" + k + u"' in '" +
                            to_string(field(schema, u"path")) + u"'");
      }
    }
    if (properties != nullptr) {
      for (const std::u16string& k : properties->keys()) {
        const Value* pp = properties->get(k);
        if (pp == nullptr) continue;
        const Value& prop_schema = *pp;
        Value prop_value = get_prop(value, k);
        // 类类型：TS `delete value[k]` + `Object.defineProperty(value, k, {get, set})` + `continue`。
        if (is_class_type(field(prop_schema, u"type"))) {
          DefinedInstance d;
          d.kind = DefinedInstance::Kind::ObjectProp;
          d.target = value;
          d.key = k;
          d.raw_value = prop_value;
          d.schema = prop_schema;
          _defined.push_back(std::move(d));
          if (Object* obj = const_cast<Object*>(as_object(value))) obj->remove(k);
          continue;
        }
        if (const Array* inner = as_array(prop_value)) {
          // `prop_value = [...prop_value]`：局部换浅拷贝，验证跑在拷贝上；
          // 成功后再整体写回（失败则丢弃）。
          prop_value = Value(std::make_shared<Array>(inner->items()));
        }
        if (!validate(prop_value, prop_schema)) return false;
        if (as_array(prop_value) != nullptr) {
          set_prop(value, k, prop_value);  // `value[k] = prop_value`
        }
        // `else if (prop_value && typeof prop_type === 'object')`：死代码（同上），不落地。
      }
    }
  } else if (is_class_type(type)) {
    // `default:` 的类类型分支：值必须是字符串，否则错误 + 直接 `return false`。
    if (!std::holds_alternative<std::u16string>(value)) {
      _errors.push_back(u"'" + to_string(field(schema, u"path")) +
                        u"' must be a string, but got " + to_string(value));
      return false;
    }
  }

  const Value& oneof = field(schema, u"oneof");
  if (const Array* one = as_array(oneof)) {
    bool found = false;
    for (size_t i = 0; i < one->size(); ++i) {
      if (strict_equals(one->at(i), value)) {
        found = true;
        break;
      }
    }
    if (!found) {
      _errors.push_back(u"'" + to_string(field(schema, u"path")) +
                        u"' should be one of the options: " + json_of(oneof) + u", but got " +
                        to_string(value));
    }
  }
  // TS `schema.oneof?.some(...) === false`：oneof 存在但不是数组时 TS 会 TypeError ——
  // 端口按「没有 oneof」处理（已移植 schema 的 oneof 恒为数组）。
  return _errors.empty();
}

}
}
