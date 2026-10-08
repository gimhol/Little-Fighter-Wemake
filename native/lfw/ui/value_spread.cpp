#include "lfw/ui/value_spread.h"

#include <string>

#include "lfw/core/js_string.h"

namespace lfw::ui {

void spread_into(Object& dst, const Value& src) {
  if (const Object* o = as_object(src)) {
    for (const std::u16string& k : o->keys()) dst.set(k, *o->get(k));
    return;
  }
  if (const Array* a = as_array(src)) {
    for (size_t idx = 0; idx < a->size(); ++idx) {
      dst.set(number_to_string(static_cast<double>(idx)), a->at(idx));
    }
    return;
  }
  if (const std::u16string* s = std::get_if<std::u16string>(&src)) {
    for (size_t idx = 0; idx < s->size(); ++idx) {
      dst.set(number_to_string(static_cast<double>(idx)), Value(std::u16string(1, (*s)[idx])));
    }
  }
}

const Value* field_of(const Value& v, const char16_t* key) {
  const Object* o = as_object(v);
  return o == nullptr ? nullptr : o->get(key);
}

size_t js_key_count(const Value& v) {
  if (const Object* o = as_object(v)) return o->size();
  if (const Array* a = as_array(v)) return a->size();
  if (const std::u16string* s = std::get_if<std::u16string>(&v)) return s->size();
  return 0;
}

}
