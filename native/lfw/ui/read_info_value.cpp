#include "lfw/ui/read_info_value.h"

#include "lfw/ui/validate_ui_img_info.h"

namespace lfw::ui {

namespace {

std::u16string js_trim(const std::u16string& s) {
  size_t b = 0;
  size_t e = s.size();
  const auto is_ws = [](char16_t c) {
    return c == u' ' || c == u'\t' || c == u'\n' || c == u'\r' || c == u'\f' || c == u'\v';
  };
  while (b < e && is_ws(s[b])) ++b;
  while (e > b && is_ws(s[e - 1])) --e;
  return s.substr(b, e - b);
}

// `current.values?.[name]`：`values` 不是对象（或没有该键）⇒ `undefined`。
const Value* sub_value(const Value& current, const char16_t* const group,
                       const std::u16string& name) {
  const Object* const obj = as_object(current);
  if (obj == nullptr) return nullptr;
  const Value* const values = obj->get(group);
  if (values == nullptr) return nullptr;
  const Object* const map = as_object(*values);
  if (map == nullptr) return nullptr;
  return map->get(name);
}

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

}  // namespace

bool judger_run(UIJudger judger, const Value& v) {
  switch (judger) {
    case UIJudger::Is0Or1:
      return strict_equals(v, Value(0.0)) || strict_equals(v, Value(1.0));
    case UIJudger::UnsafeIsObject: {
      // `typeof v === 'object'`：对象 / 数组 / `null` 都算（`null` 在调用点已被 nullish 短路，
      // 但 judger 单独调用时照 JS 语义）。
      const bool is_obj =
          as_object(v) != nullptr || is_array(v) || std::holds_alternative<NullTag>(v);
      return is_obj && !is_array(v);
    }
    case UIJudger::UnsafeIsArray:
      return is_array(v);
    case UIJudger::ValidateUIImgInfo:
      return validate_ui_img_info(v);
    default:
      return false;
  }
}

Value find_ui_value(const Value& ui, const std::u16string& name) {
  for (int pass = 0; pass < 2; ++pass) {
    const char16_t* const group = pass == 0 ? u"values" : u"template_values";
    Value current = ui;
    while (truthy(current)) {
      const Value* const value = sub_value(current, group, name);
      if (value != nullptr && !nullish(*value)) return *value;
      const Object* const obj = as_object(current);
      if (obj == nullptr) break;
      const Value* const parent = obj->get(u"parent");
      if (parent == nullptr) break;
      current = *parent;
    }
  }
  return Value(NullTag{});
}

bool parse_ui_value(const Value& ui, const UIValueType& type, const Value& value, Value& out,
                    bool& out_null, std::u16string& error) {
  Value ret = value;
  if (nullish(ret)) {
    out_null = true;
    return true;
  }
  if (!truthy(ui) || is_array(ui) || as_object(ui) == nullptr) {
    error = u"[parse_ui_value] failed, ui is not an object, got " + to_string(ui);
    return false;
  }

  const std::u16string* const ret_str = std::get_if<std::u16string>(&ret);
  if (ret_str != nullptr && js_trim(*ret_str).compare(0, 5, u"$val:") == 0) {
    const std::u16string name = js_trim(ret_str->substr(ret_str->size() >= 5 ? 5 : ret_str->size()));
    ret = find_ui_value(ui, name);
    if (nullish(ret)) {
      out_null = true;
      return true;
    }
  }

  const auto describe = [](const Value& v) { return to_string(v); };
  switch (type.kind) {
    case UIValueType::Kind::Boolean:
      if (!std::holds_alternative<bool>(ret)) {
        error = u"[parse_ui_value] failed, value must be boolean, got " + describe(ret) +
                u", src: " + describe(value);
        return false;
      }
      out = ret;
      return true;
    case UIValueType::Kind::Number:
      if (!std::holds_alternative<double>(ret)) {
        error = u"[parse_ui_value] failed, value must be number, got " + describe(ret) +
                u", src: " + describe(value);
        return false;
      }
      out = ret;
      return true;
    case UIValueType::Kind::String:
      if (!std::holds_alternative<std::u16string>(ret)) {
        error = u"[parse_ui_value] failed, value must be string, got " + describe(ret) +
                u", src: " + describe(value);
        return false;
      }
      out = ret;
      return true;
    case UIValueType::Kind::Judger:
      if (judger_run(type.judger, ret)) {
        out = ret;
        return true;
      }
      out_null = true;
      return true;
    case UIValueType::Kind::Clazz:
      // TS `ret instanceof type`：需要对象→类的映射，端口暂不支持（偏差）。按 null 处理。
      out_null = true;
      return true;
    default:
      out = ret;
      return true;
  }
}

}
