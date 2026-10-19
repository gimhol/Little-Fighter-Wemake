#include "lfw/loader/normalize_directors.h"

#include <string>
#include <variant>

#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace loader {

namespace {

// `is_director(raw)`：对象且 `name` 是字符串。
bool is_director(const Value& raw) {
  if (as_object(raw) == nullptr) return false;
  const Value name = field_or(raw, u"name");
  return std::holds_alternative<std::u16string>(name);
}

const std::u16string* str_of(const Value& v) { return std::get_if<std::u16string>(&v); }

}

std::vector<Value> to_director_list(const Value& raw) {
  // ⚠ TS 的 `typeof raw === "object"` 对数组也成立，端口的 `as_object` 对数组给 nullptr
  // ⇒ 先判数组，再判对象（否则 XML 那一路（`Array`）会被当成"不是对象"直接吞掉）。
  std::vector<Value> ret;
  auto keep = [&ret](const Array& arr) {
    for (const Value& v : arr.items()) {
      if (is_director(v)) ret.push_back(v);
    }
  };
  if (const Array* const arr = as_array(raw)) {
    keep(*arr);
    return ret;
  }
  if (as_object(raw) == nullptr) return ret;
  if (const Array* const directors = as_array(field_or(raw, u"directors"))) {
    keep(*directors);
    return ret;
  }
  if (is_director(raw)) ret.push_back(raw);
  return ret;
}

Value make_director_group(const Value& index, const Value& raw, const std::u16string& file) {
  auto ret = std::make_shared<Object>();
  ret->set(u"id", field_or(index, u"id"));
  ret->set(u"file", Value(file));
  ret->set(u"directors", Value(std::make_shared<Array>(to_director_list(raw))));
  const Value index_name = field_or(index, u"name");
  const std::u16string* const name = str_of(index_name) != nullptr
                                         ? str_of(index_name)
                                         : str_of(field_or(raw, u"name"));
  if (name != nullptr && !name->empty()) ret->set(u"name", Value(*name));
  return Value(std::move(ret));
}

}
}
