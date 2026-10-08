#include "lfw/ui/style.h"

#include <utility>
#include <vector>

namespace lfw::ui {

namespace {

std::map<const Object*, std::unique_ptr<Style>>& wraps() {
  static std::map<const Object*, std::unique_ptr<Style>> m;
  return m;
}

}  // namespace

Style& Style::from(const Value& v) {
  const Object* const o = as_object(v);
  if (o == nullptr) {
    // TS 对非对象键会在 `WeakMap.set` 抛（端口不抛；偏差见 DESIGN）。
    static std::vector<std::unique_ptr<Style>> adhoc;
    adhoc.push_back(std::make_unique<Style>());
    adhoc.back()->assign(v);
    return *adhoc.back();
  }
  auto& m = wraps();
  auto it = m.find(o);
  if (it == m.end()) {
    it = m.emplace(o, std::make_unique<Style>()).first;
  }
  Style& ret = *it->second;
  ret.assign(v);
  return ret;
}

Value Style::get_field(const char16_t* key) const {
  const Object* const data = as_object(_data);
  if (data == nullptr) return Value();
  const Value* const v = data->get(key);
  return v != nullptr ? *v : Value();
}

void Style::set_field(const char16_t* key, const Value& v) {
  Object* const data = as_object(_data);
  if (data == nullptr) return;  // 契约：data 是对象（TS 对非对象会 TypeError，记偏差）
  const Value* const cur = data->get(key);
  const Value cur_v = cur != nullptr ? *cur : Value();
  if (equals(cur_v, v)) return;
  ++_version;
  data->set(key, v);
}

void Style::set_data(const Value& v) {
  _data = v;
  ++_version;
}

void Style::set_data(Style& other) {
  const Object* const o = as_object(other.data());
  Object copy;
  if (o != nullptr) {
    for (const std::u16string& k : o->keys()) copy.set(k, *o->get(k));
  }
  _data = Value(std::make_shared<Object>(copy));
  ++_version;
}

void Style::assign(const Value& props) {
  const Object* const o = as_object(props);
  if (o == nullptr) return;
  Object* const data = as_object(_data);
  if (data == nullptr) return;  // 契约同 `set_field`
  bool changed = false;
  for (const std::u16string& k : o->keys()) {
    const Value& v = *o->get(k);
    const Value* const cur = data->get(k);
    const Value cur_v = cur != nullptr ? *cur : Value();
    if (strict_equals(cur_v, v)) continue;
    data->set(k, v);
    changed = true;
  }
  if (changed) ++_version;
}

}
