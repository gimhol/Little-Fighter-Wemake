#include "lfw/ui/cook_ui_info.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <string>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/lfw.h"
#include "lfw/resources.h"
#include "lfw/ui/read_info_value.h"
#include "lfw/ui/ui_load_img.h"
#include "lfw/ui/ui_parse.h"
#include "lfw/ui/value_spread.h"
#include "lfw/ui/xml_to_ui_info.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/read_nums.h"

namespace lfw::ui {

namespace {

bool ends_with(const std::u16string& s, const std::u16string& suffix) {
  return s.size() >= suffix.size() &&
         s.compare(s.size() - suffix.size(), suffix.size(), suffix) == 0;
}

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// TS `is_num_arr`：是数组、且没有 `NaN` 元素（与 `utils/read_nums` 的口径一致）。
bool is_num_arr(const Value& v) {
  const Array* a = as_array(v);
  if (a == nullptr) return false;
  for (size_t i = 0; i < a->size(); ++i) {
    const double* const d = std::get_if<double>(&a->at(i));
    if (d != nullptr && std::isnan(*d)) return false;
  }
  return true;
}

// TS `let __new_id = 0; const new_id = () => ++__new_id;`（进程级）。
int64_t& new_id_seq() {
  static int64_t seq = 0;
  return seq;
}

std::u16string next_no_id() {
  return u"no_id_" + number_to_string(static_cast<double>(++new_id_seq()));
}

std::u16string next_seq_id(const std::u16string& cls) {
  return cls + u"_" + number_to_string(static_cast<double>(++new_id_seq()));
}

Value zeros3() {
  auto a = std::make_shared<Array>();
  a->push_back(Value(0.0));
  a->push_back(Value(0.0));
  a->push_back(Value(0.0));
  return Value(a);
}

Value to_array(const std::vector<Value>& items) {
  auto a = std::make_shared<Array>();
  for (const Value& v : items) a->push_back(v);
  return Value(a);
}

// `(b.weight || 0) - (a.weight || 0)`：NaN 比较按 +0（V8 的稳定排序口径）。
double weight_of(const Value& component) {
  const Value* const w = field_of(component, u"weight");
  if (w == nullptr || !truthy(*w)) return 0.0;
  return to_number(*w);
}

// JS `!x`（数字口径）：`0` 与 `NaN` 都是假。
bool falsy_num(double x) { return x == 0.0 || std::isnan(x); }

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

bool cook_ui_info(LFW& lfw, const Value& info, const Value* parent, Value& out,
                  std::u16string& error) {
  Value raw;
  if (const std::u16string* const name = std::get_if<std::u16string>(&info)) {
    find_ui_template(lfw, parent, *name, raw);
  } else {
    raw = info;
  }
  if (const Value* const tname = field_of(raw, u"template");
      tname != nullptr && truthy(*tname)) {
    raw = merge_ui_template(lfw, raw, parent);
  }
  const Object* const raw_obj = as_object(raw);
  if (raw_obj == nullptr) {
    error = u"[cook_ui_info] failed, info is not an object, got " + to_string(info);
    return false;
  }

  const Value raw_id_v = [&]() -> Value {
    const Value* const v = raw_obj->get(u"id");
    return (v != nullptr && truthy(*v)) ? *v : Value(next_no_id());
  }();
  const Value name_v = [&]() -> Value {
    const Value* const v = raw_obj->get(u"name");
    return (v != nullptr && truthy(*v)) ? *v : raw_id_v;
  }();

  // components：字符串走表达式解析、对象就地补 cls/id/name，最后按 weight 降序（稳定）。
  std::vector<Value> components;
  if (const Value* const comp = raw_obj->get(u"component"); comp != nullptr) {
    if (const Array* const list = as_array(*comp)) {
      for (const Value& t : list->items()) {
        if (const std::u16string* const s = std::get_if<std::u16string>(&t)) {
          const auto parsed = parse_call_func_expression(*s);
          auto cooked = std::make_shared<Object>();
          if (parsed.has_value()) {
            cooked->set(u"id", Value(parsed->id));
            cooked->set(u"name", Value(parsed->name));
            auto args = std::make_shared<Array>();
            for (const std::u16string& a : parsed->args) args->push_back(Value(a));
            cooked->set(u"args", Value(args));
            cooked->set(u"enabled", Value(parsed->enabled));
            cooked->set(u"cls", Value(parsed->name));
            if (parsed->id.empty()) cooked->set(u"id", Value(next_no_id()));
          } else {
            cooked->set(u"id", Value(next_no_id()));
            cooked->set(u"name", Value(*s));
            cooked->set(u"cls", Value(*s));
          }
          components.push_back(Value(cooked));
        } else if (const Object* const to = as_object(t)) {
          Object* const mut = const_cast<Object*>(to);
          const Value* const cls = mut->get(u"cls");
          const Value* const nm = mut->get(u"name");
          if ((cls == nullptr || !truthy(*cls)) && nm != nullptr && truthy(*nm)) {
            mut->set(u"cls", *nm);
          }
          const std::u16string cls_text = to_string(field_or(t, u"cls"));
          const Value* const id = mut->get(u"id");
          if (id == nullptr || !truthy(*id)) mut->set(u"id", Value(next_seq_id(cls_text)));
          const Value* const nm2 = mut->get(u"name");
          if (nm2 == nullptr || !truthy(*nm2)) mut->set(u"name", Value(cls_text + u"_no_name"));
          components.push_back(t);
        } else {
          components.push_back(t);
        }
      }
    }
  }
  std::stable_sort(components.begin(), components.end(),
                   [](const Value& a, const Value& b) {
                     const double d = weight_of(a) - weight_of(b);
                     return !std::isnan(d) && d > 0.0;
                   });

  // `const { actions: raw_actions, ...rest_raw } = raw;`
  const Value raw_actions = raw_obj->get(u"actions") != nullptr ? *raw_obj->get(u"actions") : Value();
  Value rest_raw_v = Value(std::make_shared<Object>());
  {
    Object* const rest = as_object(rest_raw_v);
    for (const std::u16string& k : raw_obj->keys()) {
      if (k == u"actions") continue;
      rest->set(k, *raw_obj->get(k));
    }
  }

  Value ret_v = Value(std::make_shared<Object>());
  Object* const ret = as_object(ret_v);
  spread_into(*ret, rest_raw_v);
  {
    const Value* const values = raw_obj->get(u"values");
    ret->set(u"values", (values != nullptr && truthy(*values)) ? *values
                                                               : Value(std::make_shared<Object>()));
  }
  ret->set(u"id", raw_id_v);
  ret->set(u"name", name_v);
  ret->set(u"parent", parent != nullptr ? *parent : Value());
  ret->set(u"pos", zeros3());
  ret->set(u"scale", zeros3());
  ret->set(u"center", zeros3());
  ret->set(u"size", zeros3());
  ret->set(u"img_info", Value());
  ret->set(u"txt_info", Value());
  ret->set(u"items", Value());
  ret->set(u"img", Value());
  ret->set(u"component", to_array(components));
  ret->set(u"style", Value());
  ret->set(u"count", Value());
  ret->set(u"visible", Value());
  ret->set(u"disabled", Value());
  ret->set(u"clips", Value());
  ret->set(u"backgroundAlpha", Value());
  ret->set(u"foregroundAlpha", Value());
  ret->set(u"outlineWidth", Value());
  ret->set(u"outlineAlpha", Value());
  ret->set(u"opacity", Value());
  ret->set(u"raw", raw);

  const auto assign = [&](UIValueType::Kind kind, UIJudger judger, const char16_t* key,
                          const Value* src) -> bool {
    Value parsed_v;
    bool out_null = false;
    const Value vv = src != nullptr ? *src : Value();
    if (!parse_ui_value(ret_v, UIValueType{kind, judger}, vv, parsed_v, out_null, error)) {
      return false;
    }
    ret->set(key, out_null ? Value() : parsed_v);
    return true;
  };
  // `parse_nums`：数字数组原样；否则 `parse_ui_value(ret, null, v)`（nullish ⇒ null）。
  const auto read_nums_into = [&](const char16_t* key, const Value& src, double fallbacks,
                                  bool has_fallbacks) -> bool {
    std::vector<Value> nums;
    if (!lfw::read_nums(src, 3.0, has_fallbacks ? Value(fallbacks) : Value(), nums, &error)) {
      return false;
    }
    ret->set(key, to_array(nums));
    return true;
  };
  {
    // `read_nums(parse_nums(raw.X), 3[, fallback])`：nullish 的 src 会先落成 `null`。
    const auto nums_src = [&](const char16_t* field, Value& out_src) -> bool {
      const Value* const v = raw_obj->get(field);
      if (v != nullptr && is_num_arr(*v)) {
        out_src = *v;
        return true;
      }
      Value parsed_v;
      bool out_null = false;
      const Value vv = v != nullptr ? *v : Value();
      if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Null, UIJudger::None}, vv, parsed_v,
                          out_null, error)) {
        return false;
      }
      out_src = out_null ? Value(NullTag{}) : parsed_v;
      return true;
    };
    Value src;
    if (!nums_src(u"pos", src) || !read_nums_into(u"pos", src, 0.0, false)) return false;
    if (!nums_src(u"scale", src) || !read_nums_into(u"scale", src, 1.0, true)) return false;
    if (!nums_src(u"center", src) || !read_nums_into(u"center", src, 0.0, false)) return false;
  }

  if (!assign(UIValueType::Kind::Boolean, UIJudger::None, u"visible", raw_obj->get(u"visible"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Boolean, UIJudger::None, u"disabled", raw_obj->get(u"disabled"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Boolean, UIJudger::None, u"clips", raw_obj->get(u"clips"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Number, UIJudger::None, u"count", raw_obj->get(u"count"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Number, UIJudger::None, u"opacity", raw_obj->get(u"opacity"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::String, UIJudger::None, u"color", raw_obj->get(u"color"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::String, UIJudger::None, u"background",
              raw_obj->get(u"background"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Number, UIJudger::None, u"backgroundAlpha",
              raw_obj->get(u"backgroundAlpha"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::String, UIJudger::None, u"foreground",
              raw_obj->get(u"foreground"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Number, UIJudger::None, u"foregroundAlpha",
              raw_obj->get(u"foregroundAlpha"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::String, UIJudger::None, u"outlineColor",
              raw_obj->get(u"outlineColor"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Number, UIJudger::None, u"outlineWidth",
              raw_obj->get(u"outlineWidth"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Number, UIJudger::None, u"outlineAlpha",
              raw_obj->get(u"outlineAlpha"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::String, UIJudger::None, u"i18n", raw_obj->get(u"i18n"))) {
    return false;
  }
  if (!assign(UIValueType::Kind::Judger, UIJudger::UnsafeIsObject, u"style",
              raw_obj->get(u"style"))) {
    return false;
  }

  // actions：`val` 统一成数组，字符串项解析成 `{name, args}`、对象项原样。
  if (truthy(raw_actions)) {
    Value cooked_v = Value(std::make_shared<Object>());
    Object* const cooked = as_object(cooked_v);
    if (const Object* const ra = as_object(raw_actions)) {
      for (const std::u16string& place : ra->keys()) {
        const Value* const val = ra->get(place);
        if (val == nullptr || nullish(*val)) continue;
        auto list_out = std::make_shared<Array>();
        const auto push_action = [&](const Value& a) {
          if (const std::u16string* const s = std::get_if<std::u16string>(&a)) {
            const auto parsed = parse_call_func_expression(*s);
            auto act = std::make_shared<Object>();
            act->set(u"name", parsed.has_value() ? Value(parsed->name) : Value(*s));
            auto args = std::make_shared<Array>();
            if (parsed.has_value()) {
              for (const std::u16string& x : parsed->args) args->push_back(Value(x));
            }
            act->set(u"args", Value(args));
            list_out->push_back(Value(act));
          } else {
            list_out->push_back(a);
          }
        };
        if (const Array* const list = as_array(*val)) {
          for (const Value& a : list->items()) push_action(a);
        } else {
          push_action(*val);
        }
        cooked->set(place, Value(list_out));
      }
    }
    ret->set(u"actions", cooked_v);
  }

  const Value* const raw_img = raw_obj->get(u"img");
  if (raw_img != nullptr && truthy(*raw_img) && std::holds_alternative<std::u16string>(*raw_img)) {
    if (!assign(UIValueType::Kind::Judger, UIJudger::ValidateUIImgInfo, u"img", raw_img)) {
      return false;
    }
  }
  if (raw_img != nullptr && truthy(*raw_img) &&
      (as_object(*raw_img) != nullptr || is_array(*raw_img))) {
    const Object* const im = as_object(*raw_img);
    const auto get = [&](const char16_t* k) -> const Value* {
      return im != nullptr ? im->get(k) : nullptr;
    };
    const auto pnum = [&](const Value* v, Value& o) -> bool {
      bool out_null = false;
      const Value vv = v != nullptr ? *v : Value();
      if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Number, UIJudger::None}, vv, o,
                          out_null, error)) {
        return false;
      }
      if (out_null) o = Value();
      return true;
    };

    Value path_v;
    {
      bool out_null = false;
      const Value* const src = get(u"path");
      const Value vv = src != nullptr ? *src : Value();
      if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::String, UIJudger::None}, vv, path_v,
                          out_null, error)) {
        return false;
      }
      if (out_null) path_v = Value();
    }
    Value x_v;
    Value y_v;
    Value w_v;
    Value h_v;
    if (!pnum(get(u"x"), x_v) || !pnum(get(u"y"), y_v) || !pnum(get(u"w"), w_v) ||
        !pnum(get(u"h"), h_v)) {
      return false;
    }
    Value dw_v = w_v;
    Value dh_v = h_v;
    {
      Value parsed_v;
      bool out_null = false;
      const Value* const src = get(u"dw");
      const Value vv = src != nullptr ? *src : Value();
      if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Number, UIJudger::None}, vv,
                          parsed_v, out_null, error)) {
        return false;
      }
      if (!out_null) dw_v = parsed_v;
    }
    {
      Value parsed_v;
      bool out_null = false;
      const Value* const src = get(u"dh");
      const Value vv = src != nullptr ? *src : Value();
      if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Number, UIJudger::None}, vv,
                          parsed_v, out_null, error)) {
        return false;
      }
      if (!out_null) dh_v = parsed_v;
    }

    auto img = std::make_shared<Object>();
    img->set(u"path", nullish(path_v) ? Value(u"") : path_v);
    img->set(u"x", x_v);
    img->set(u"y", y_v);
    img->set(u"w", w_v);
    img->set(u"h", h_v);
    img->set(u"dw", dw_v);
    img->set(u"dh", dh_v);
    const char16_t* const num_keys[] = {u"wrapS",     u"wrapT",      u"offsetX",    u"offsetY",
                                        u"offsetAnimX", u"offsetAnimY", u"offsetAnimR",
                                        u"repeatX",   u"repeatY"};
    for (const char16_t* k : num_keys) {
      Value parsed_v;
      if (!pnum(get(k), parsed_v)) return false;
      img->set(k, parsed_v);
    }
    {
      Value flip_x_v;
      Value flip_y_v;
      bool out_null = false;
      const Value* const src = get(u"flip_x");
      const Value vv = src != nullptr ? *src : Value();
      if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Judger, UIJudger::Is0Or1}, vv,
                          flip_x_v, out_null, error)) {
        return false;
      }
      img->set(u"flip_x", out_null ? Value() : flip_x_v);
      out_null = false;
      const Value* const src2 = get(u"flip_y");
      const Value vv2 = src2 != nullptr ? *src2 : Value();
      if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Judger, UIJudger::Is0Or1}, vv2,
                          flip_y_v, out_null, error)) {
        return false;
      }
      img->set(u"flip_y", out_null ? Value() : flip_y_v);
    }

    const Value* const np = get(u"nine_patch");
    if (np != nullptr && truthy(*np)) {
      if (std::holds_alternative<std::u16string>(*np)) {
        Value parsed_v;
        bool out_null = false;
        if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Judger, UIJudger::UnsafeIsObject},
                            *np, parsed_v, out_null, error)) {
          return false;
        }
        img->set(u"nine_patch", out_null ? Value() : parsed_v);
      } else {
        auto np_obj = std::make_shared<Object>();
        const Object* const npo = as_object(*np);
        const char16_t* const np_keys[] = {u"f_l", u"f_t", u"f_r", u"f_b", u"f_w",
                                           u"f_h", u"l_w", u"t_h", u"r_w", u"b_h"};
        for (const char16_t* k : np_keys) {
          Value parsed_v;
          const Value* const src = npo != nullptr ? npo->get(k) : nullptr;
          bool out_null = false;
          const Value vv = src != nullptr ? *src : Value();
          if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Number, UIJudger::None}, vv,
                              parsed_v, out_null, error)) {
            return false;
          }
          np_obj->set(k, out_null ? Value() : parsed_v);
        }
        img->set(u"nine_patch", Value(np_obj));
      }
    }
    ret->set(u"img", Value(img));
  }

  {
    const Value* const img_now = ret->get(u"img");
    if (img_now != nullptr && truthy(*img_now)) {
      Value loaded;
      if (!ui_load_img(lfw, *img_now, loaded, error)) return false;
      ret->set(u"img_info", loaded);
    }
  }
  {
    const Value* const i18n = ret->get(u"i18n");
    if (i18n != nullptr && truthy(*i18n)) {
      const Value* const style = ret->get(u"style");
      ret->set(u"txt_info", lfw.host().measure_text(lfw.string(*i18n),
                                                    style != nullptr ? *style : Value()));
    }
  }

  {
    const Value* const raw_size = raw_obj->get(u"size");
    if (raw_size != nullptr && truthy(*raw_size)) {
      Value src;
      if (!is_num_arr(*raw_size)) {
        Value parsed_v;
        bool out_null = false;
        if (!parse_ui_value(ret_v, UIValueType{UIValueType::Kind::Null, UIJudger::None}, *raw_size,
                            parsed_v, out_null, error)) {
          return false;
        }
        src = out_null ? Value(NullTag{}) : parsed_v;
      } else {
        src = *raw_size;
      }
      if (!read_nums_into(u"size", src, 0.0, false)) return false;
    } else if (const Value* const img_now = ret->get(u"img");
               img_now != nullptr && truthy(*img_now)) {
      const Value* const dw = field_of(*img_now, u"dw");
      const Value* const w = field_of(*img_now, u"w");
      const Value* const dh = field_of(*img_now, u"dh");
      const Value* const h = field_of(*img_now, u"h");
      const auto nullish_pick = [](const Value* a, const Value* b) -> Value {
        if (a != nullptr && !nullish(*a)) return *a;
        if (b != nullptr && !nullish(*b)) return *b;
        return Value(0.0);
      };
      auto size = std::make_shared<Array>();
      size->push_back(nullish_pick(dw, w));
      size->push_back(nullish_pick(dh, h));
      size->push_back(Value(0.0));
      ret->set(u"size", Value(size));
    } else if (parent == nullptr) {
      const WorldDataset& dataset = lfw.world().dataset;
      auto size = std::make_shared<Array>();
      size->push_back(dataset.get(u"screen_w"));
      size->push_back(dataset.get(u"screen_h"));
      size->push_back(Value(0.0));
      ret->set(u"size", Value(size));
    }
  }

  {
    const Value* const img_info = ret->get(u"img_info");
    const Value* const txt_info = ret->get(u"txt_info");
    const Value info_v = img_info != nullptr ? *img_info : Value();
    const Value text_v = txt_info != nullptr ? *txt_info : Value();
    const Value scaled = truthy(info_v) ? info_v : text_v;
    if (truthy(scaled)) {
      const auto read_num = [&](const char16_t* k, double def) -> double {
        const Value* const v = field_of(scaled, k);
        if (v == nullptr || std::holds_alternative<std::monostate>(*v)) return def;
        const double* const d = std::get_if<double>(v);
        return d != nullptr ? *d : 0.0;
      };
      const double img_w = read_num(u"w", 0.0);
      const double img_h = read_num(u"h", 0.0);
      const double scale = read_num(u"scale", 1.0);
      if (!falsy_num(img_w) && !falsy_num(img_h) && !falsy_num(scale)) {
        const double sw = img_w / scale;
        const double sh = img_h / scale;
        Value size_v = *ret->get(u"size");
        Array* const size = as_array(size_v);
        if (size != nullptr) {
          const auto num_at = [&](size_t idx) -> double {
            const double* const d = std::get_if<double>(&size->at(idx));
            return d != nullptr ? *d : 0.0;
          };
          const double w0 = num_at(0);
          const double h0 = num_at(1);
          if (falsy_num(w0) && falsy_num(h0)) {
            size->at(0) = Value(sw);
            size->at(1) = Value(sh);
          } else if (falsy_num(w0) && !falsy_num(h0)) {
            size->at(0) = Value(lfw::floor(h0 * sw / sh));
          } else if (!falsy_num(w0) && falsy_num(h0)) {
            size->at(1) = Value(lfw::floor(w0 * sh / sw));
          }
        }
      }
    }
  }

  {
    const Value* const raw_items = raw_obj->get(u"items");
    if (raw_items != nullptr && truthy(*raw_items) && !is_array(*raw_items)) {
      lfw.warn({Value(u"[cook_ui_info] items must be array, but got"), *raw_items});
    }
    if (raw_items != nullptr) {
      if (const Array* const list = as_array(*raw_items); list != nullptr && !list->empty()) {
        auto items = std::make_shared<Array>();
        ret->set(u"items", Value(items));
        for (const Value& raw_item : list->items()) {
          Value child;
          if (!cook_ui_info(lfw, raw_item, &ret_v, child, error)) return false;
          items->push_back(child);
        }
      }
    }
    const Value* const items_now = ret->get(u"items");
    bool keep = false;
    if (items_now != nullptr) {
      if (const Array* const a = as_array(*items_now)) {
        keep = !a->empty();
      } else if (const std::u16string* const s = std::get_if<std::u16string>(items_now)) {
        keep = !s->empty();
      }
    }
    if (!keep) ret->remove(u"items");
  }

  out = ret_v;
  return true;
}

}
