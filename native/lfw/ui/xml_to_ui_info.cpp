#include "lfw/ui/xml_to_ui_info.h"

#include <optional>
#include <string>
#include <vector>

#include "lfw/utils/string_help.h"

namespace lfw::ui {

namespace {

std::vector<std::u16string> split_char(const std::u16string& s, char16_t sep) {
  std::vector<std::u16string> out;
  size_t start = 0;
  for (size_t i = 0; i <= s.size(); ++i) {
    if (i == s.size() || s[i] == sep) {
      out.push_back(s.substr(start, i - start));
      start = i + 1;
    }
  }
  return out;
}

// `s.split(',').map(s => s.trim())`
std::vector<std::u16string> split_trim(const std::u16string& s) {
  std::vector<std::u16string> out;
  for (const std::u16string& part : split_char(s, u',')) out.push_back(js_trim(part));
  return out;
}

Value arr_of(const std::vector<std::u16string>& xs) {
  auto a = std::make_shared<Array>();
  for (const std::u16string& x : xs) a->push_back(Value(x));
  return Value(a);
}

// JS 真值（`''` 是假）
bool non_empty(const std::optional<std::u16string>& v) {
  return v.has_value() && !v->empty();
}

// JS `String(v)` / `Number(v)`：缺省分别是 `undefined` / `NaN`。
Value str_or_undef(const std::optional<std::u16string>& v) {
  return v.has_value() ? Value(*v) : Value();
}
Value num_or_nan(const std::optional<std::u16string>& v) {
  return to_number(v.has_value() ? Value(*v) : Value());
}

Value nums_or_undef(const std::optional<std::vector<double>>& ns) {
  if (!ns.has_value()) return Value();
  auto a = std::make_shared<Array>();
  for (double d : *ns) a->push_back(Value(d));
  return Value(a);
}

bool is_action_place(const std::u16string& tag) {
  return tag == u"click" || tag == u"resume" || tag == u"pause" || tag == u"start" ||
         tag == u"stop";
}

// `parse_action_children`：`string | string[]`。
Value parse_action_children(const IXMLElement& place) {
  auto arr = std::make_shared<Array>();
  for (const IXMLElement* c : place.children()) {
    if (c->tag() == u"action") arr->push_back(Value(c->action_str()));
  }
  if (arr->size() != 0) return Value(arr);
  if (non_empty(place.attr(u"action")) || non_empty(place.attr(u"name"))) {
    return Value(place.action_str());
  }
  const std::u16string v = place.text();
  if (v.find(u',') != std::u16string::npos) return arr_of(split_trim(v));
  return Value(js_trim(v));
}

Value parse_component(const IXMLElement& el) {
  auto ret = std::make_shared<Object>();
  const std::optional<std::u16string> cls_attr = el.attr(u"cls");
  ret->set(u"cls", non_empty(cls_attr) ? Value(*cls_attr) : Value(el.tag()));
  const std::optional<std::u16string> args = el.attr(u"args");
  if (non_empty(args)) ret->set(u"args", arr_of(split_trim(*args)));
  const std::optional<std::u16string> id = el.attr(u"id");
  if (non_empty(id)) ret->set(u"id", Value(*id));
  const std::optional<std::u16string> weight = el.attr(u"weight");
  if (non_empty(weight)) ret->set(u"weight", to_number(Value(*weight)));
  for (const IXMLElement* c : el.children()) {
    if (c->tag() == u"properties") {
      ret->set(u"properties", c->as_object());
      break;
    }
  }
  return Value(ret);
}

}

Value xml_to_ui_info(const IXMLElement& el) {
  auto ret = std::make_shared<Object>();

  ret->set(u"id", str_or_undef(el.attr(u"id")));
  ret->set(u"name", str_or_undef(el.attr(u"name")));
  ret->set(u"i18n", str_or_undef(el.attr(u"i18n")));
  ret->set(u"color", str_or_undef(el.attr(u"color")));
  ret->set(u"background", str_or_undef(el.attr(u"background")));
  ret->set(u"foreground", str_or_undef(el.attr(u"foreground")));
  ret->set(u"outlineColor", str_or_undef(el.attr(u"outlineColor")));
  ret->set(u"template", str_or_undef(el.attr(u"template")));
  {
    const std::optional<std::u16string> af = el.attr(u"auto_focus");
    ret->set(u"auto_focus", (af.has_value() && *af == u"true") ? Value(true) : Value());
  }

  ret->set(u"pos", nums_or_undef(el.nums_attr(u"pos")));
  ret->set(u"size", nums_or_undef(el.nums_attr(u"size")));
  ret->set(u"center", nums_or_undef(el.nums_attr(u"center")));
  ret->set(u"scale", nums_or_undef(el.nums_attr(u"scale")));

  const auto set_num_attr = [&](const char16_t* name) {
    if (const std::optional<std::u16string> v = el.attr(name); v.has_value()) {
      ret->set(name, to_number(Value(*v)));
    }
  };
  const auto set_bool_attr = [&](const char16_t* name) {
    if (const std::optional<std::u16string> v = el.attr(name); v.has_value()) {
      ret->set(name, Value(*v == u"true"));
    }
  };
  set_num_attr(u"opacity");
  set_num_attr(u"count");
  set_bool_attr(u"visible");
  set_bool_attr(u"disabled");
  set_bool_attr(u"clips");
  set_num_attr(u"backgroundAlpha");
  set_num_attr(u"foregroundAlpha");
  set_num_attr(u"outlineWidth");
  set_num_attr(u"outlineAlpha");

  std::vector<Value> items;
  std::vector<Value> components;
  auto templates = std::make_shared<Object>();
  std::shared_ptr<Object> values_obj;

  for (const IXMLElement* child : el.children()) {
    const std::u16string& tag = child->tag();
    if (tag == u"node" || tag == u"item") {
      const std::optional<std::u16string> ref = child->attr(u"ref");
      items.push_back(non_empty(ref) ? Value(*ref) : xml_to_ui_info(*child));
    } else if (tag == u"values") {
      if (values_obj == nullptr) {
        values_obj = std::make_shared<Object>();
        ret->set(u"values", Value(values_obj));
      }
      const Value src = child->as_object();
      const Object* so = as_object(src);
      if (so != nullptr) {
        for (const std::u16string& k : so->keys()) values_obj->set(k, *so->get(k));
      }
    } else if (tag == u"actions") {
      auto actions = std::make_shared<Object>();
      for (const XmlAttr& a : child->attrs()) {
        if (a.value.find(u',') != std::u16string::npos) {
          actions->set(a.name, arr_of(split_trim(a.value)));
        } else {
          actions->set(a.name, Value(js_trim(a.value)));
        }
      }
      for (const IXMLElement* c : child->children()) {
        if (!is_action_place(c->tag())) continue;
        const Value val = parse_action_children(*c);
        const Value* prev = actions->get(c->tag());
        if (prev != nullptr) {
          auto merged = std::make_shared<Array>();
          if (const Array* pa = as_array(*prev)) {
            for (const Value& x : pa->items()) merged->push_back(x);
          } else {
            merged->push_back(*prev);
          }
          if (const Array* va = as_array(val)) {
            for (const Value& x : va->items()) merged->push_back(x);
          } else {
            merged->push_back(val);
          }
          actions->set(c->tag(), Value(merged));
        } else {
          actions->set(c->tag(), val);
        }
      }
      ret->set(u"actions", Value(actions));
    } else if (tag == u"components") {
      for (const IXMLElement* c : child->children()) components.push_back(parse_component(*c));
    } else if (tag == u"component") {
      components.push_back(parse_component(*child));
    } else if (tag == u"style") {
      Value style_v = child->as_object();
      ret->set(u"style", style_v);
      Object* s = as_object(style_v);
      if (s != nullptr) {
        const auto set_style_num = [&](const char16_t* name) {
          if (const std::optional<std::u16string> v = child->attr(name); v.has_value()) {
            s->set(name, to_number(Value(*v)));
          }
        };
        set_style_num(u"line_width");
        set_style_num(u"scale");
        set_style_num(u"padding_l");
        set_style_num(u"padding_r");
        set_style_num(u"padding_t");
        set_style_num(u"padding_b");
        set_style_num(u"shadow_blur");
        set_style_num(u"shadow_offset_x");
        set_style_num(u"shadow_offset_y");
        set_style_num(u"underline_width");
        if (const std::optional<std::u16string> v = child->attr(u"smoothing"); v.has_value()) {
          s->set(u"smoothing", Value(*v == u"true"));
        }
        if (const std::optional<std::u16string> v = child->attr(u"disposable"); v.has_value()) {
          s->set(u"disposable", Value(*v == u"true"));
        }
      }
    } else if (tag == u"img") {
      auto img = std::make_shared<Object>();
      const std::optional<std::u16string> path_attr = child->attr(u"path");
      img->set(u"path", non_empty(path_attr) ? Value(*path_attr) : str_or_undef(child->attr(u"src")));
      img->set(u"x", num_or_nan(child->attr(u"x")));
      img->set(u"y", num_or_nan(child->attr(u"y")));
      const Value w_v = num_or_nan(child->attr(u"w"));
      img->set(u"w", w_v);
      const Value h_v = num_or_nan(child->attr(u"h"));
      img->set(u"h", h_v);
      const Value dw_v = num_or_nan(child->attr(u"dw"));
      img->set(u"dw", truthy(dw_v) ? dw_v : w_v);
      const Value dh_v = num_or_nan(child->attr(u"dh"));
      img->set(u"dh", truthy(dh_v) ? dh_v : h_v);
      const char16_t* const num_keys[] = {
          u"flip_x",      u"flip_y",      u"wrapS",        u"wrapT",
          u"offsetX",     u"offsetY",     u"offsetAnimX",  u"offsetAnimY",
          u"offsetAnimR", u"repeatX",     u"repeatY",
      };
      for (const char16_t* name : num_keys) {
        if (const std::optional<std::u16string> v = child->attr(name); v.has_value()) {
          img->set(name, to_number(Value(*v)));
        }
      }
      ret->set(u"img", Value(img));
    } else if (tag == u"template") {
      const std::optional<std::u16string> id = child->attr(u"id");
      std::u16string tid;
      if (non_empty(id)) {
        tid = *id;
      } else {
        const std::optional<std::u16string> nm = child->attr(u"name");
        if (non_empty(nm)) tid = *nm;
      }
      templates->set(tid, xml_to_ui_info(*child));
    } else {
      auto comp = std::make_shared<Object>();
      comp->set(u"cls", Value(tag));
      const std::optional<std::u16string> args = child->attr(u"args");
      if (non_empty(args)) comp->set(u"args", arr_of(split_trim(*args)));
      components.push_back(Value(comp));
    }
  }

  if (!items.empty()) {
    auto a = std::make_shared<Array>();
    for (const Value& v : items) a->push_back(v);
    ret->set(u"items", Value(a));
  }
  if (!components.empty()) {
    auto a = std::make_shared<Array>();
    for (const Value& v : components) a->push_back(v);
    ret->set(u"component", Value(a));
  }
  if (templates->size() != 0) ret->set(u"templates", Value(templates));

  return Value(ret);
}

}
