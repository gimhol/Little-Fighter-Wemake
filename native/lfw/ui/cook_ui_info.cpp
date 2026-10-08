#include "lfw/ui/cook_ui_info.h"

#include <algorithm>
#include <memory>
#include <vector>

#include "lfw/lfw.h"
#include "lfw/resources.h"
#include "lfw/ui/xml_to_ui_info.h"

namespace lfw::ui {

namespace {

bool ends_with(const std::u16string& s, const std::u16string& suffix) {
  return s.size() >= suffix.size() &&
         s.compare(s.size() - suffix.size(), suffix.size(), suffix) == 0;
}

// `Object.keys(v).length` 的 JS 口径：对象/数组/字符串都算键数，其余 0。
size_t js_key_count(const Value& v) {
  if (const Object* o = as_object(v)) return o->size();
  if (const Array* a = as_array(v)) return a->size();
  if (const std::u16string* s = std::get_if<std::u16string>(&v)) return s->size();
  return 0;
}

// `{ ...src }` 的展开：对象按键、数组/字符串按数字下标（空位按 JS 语义给 `undefined`），
// nullish 与其余原始值不落键。
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

const Value* field_of(const Value& v, const char16_t* name) {
  const Object* o = as_object(v);
  return o == nullptr ? nullptr : o->get(name);
}

}

void find_ui_template(LFW& lfw, const Value* parent, const std::u16string& template_name,
                      Value& out) {
  const Value* ptr = parent;
  while (ptr != nullptr) {
    const Object* po = as_object(*ptr);
    if (po == nullptr) break;
    const Value* templates = po->get(u"templates");
    if (templates != nullptr) {
      if (const Object* to = as_object(*templates)) {
        const Value* hit = to->get(template_name);
        if (hit != nullptr && truthy(*hit)) {
          out = *hit;
          return;
        }
      }
    }
    ptr = po->get(u"parent");
  }

  std::u16string path = template_name;
  if (path.rfind(u"@/", 0) == 0) path = u"builtin_data/launch/" + path.substr(2);

  const char16_t* const ui_exts[] = {u".ui.json5", u".ui.json", u".ui.xml"};
  std::u16string base = path;
  const char16_t* hit_ext = nullptr;
  for (const char16_t* ext : ui_exts) {
    const std::u16string e(ext);
    if (ends_with(path, e)) {
      hit_ext = ext;
      base = path.substr(0, path.size() - e.size());
      break;
    }
  }
  std::vector<std::u16string> candidates;
  if (hit_ext != nullptr) candidates.push_back(path);
  for (const char16_t* ext : ui_exts) {
    std::u16string candidate = base + ext;
    if (std::find(candidates.begin(), candidates.end(), candidate) == candidates.end()) {
      candidates.push_back(std::move(candidate));
    }
  }

  for (const std::u16string& candidate : candidates) {
    ImportResult res;
    std::u16string error;
    if (ends_with(candidate, u".ui.xml")) {
      if (!lfw.resources().import_xml(candidate, true, res, error)) continue;
      if (res.xml_root == nullptr) continue;
      Value info = xml_to_ui_info(*res.xml_root);
      if (js_key_count(info) != 0) {
        out = info;
        return;
      }
    } else {
      if (!lfw.resources().import_json(candidate, true, res, error)) continue;
      if (truthy(res.data) && js_key_count(res.data) != 0) {
        out = res.data;
        return;
      }
    }
  }

  lfw.warn(u"[find_ui_template] ui template not found! template_name: " + template_name);
  out = Value(std::make_shared<Object>());
}

Value merge_ui_template(LFW& lfw, const Value& raw_info, const Value* parent) {
  const Object* raw = as_object(raw_info);
  if (raw == nullptr) return raw_info;
  const Value* tname_v = raw->get(u"template");
  if (tname_v == nullptr || !truthy(*tname_v)) return raw_info;
  const std::u16string* tname = std::get_if<std::u16string>(tname_v);
  if (tname == nullptr) return raw_info;

  Value remain_v = Value(std::make_shared<Object>());
  Object* remain = as_object(remain_v);
  for (const std::u16string& k : raw->keys()) {
    if (k == u"template") continue;
    remain->set(k, *raw->get(k));
  }

  Value template_info;
  find_ui_template(lfw, parent, *tname, template_info);

  auto component = std::make_shared<Array>();
  const auto append_component = [&component](const Value& src, const char16_t* key) {
    const Value* arr_v = field_of(src, key);
    if (arr_v == nullptr) return;
    if (const Array* arr = as_array(*arr_v)) {
      for (const Value& item : arr->items()) component->push_back(item);
    }
  };
  append_component(template_info, u"component");
  append_component(remain_v, u"component");
  if (lfw.dev_mode) {
    append_component(template_info, u"dev_component");
    append_component(remain_v, u"dev_component");
  }

  Value result_v = Value(std::make_shared<Object>());
  Object* result = as_object(result_v);
  spread_into(*result, template_info);
  spread_into(*result, remain_v);
  result->set(u"template", Value(*tname));
  result->set(u"component", Value(component));
  {
    Value values_v = Value(std::make_shared<Object>());
    Object* values = as_object(values_v);
    if (const Value* tv = field_of(template_info, u"values")) spread_into(*values, *tv);
    if (const Value* rv = field_of(remain_v, u"values")) spread_into(*values, *rv);
    result->set(u"values", values_v);
  }
  {
    Value tvalues_v = Value(std::make_shared<Object>());
    Object* tvalues = as_object(tvalues_v);
    if (const Value* tv = field_of(template_info, u"template_values")) spread_into(*tvalues, *tv);
    if (const Value* rv = field_of(remain_v, u"template_values")) spread_into(*tvalues, *rv);
    result->set(u"template_values", tvalues_v);
  }
  return result_v;
}

}
