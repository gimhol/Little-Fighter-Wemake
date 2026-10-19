#include "lfw/dat_translator/xml/xml_x_director.h"

#include <cstddef>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/core/json.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace dat_translator {
namespace xml {

namespace {

using OptStr = std::optional<std::u16string>;

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

bool is_some(const Value& v) { return !is_nullish(v); }

std::u16string trim_str(const std::u16string& s) {
  size_t b = 0;
  size_t e = s.size();
  while (b < e && is_str_white_space(s[b])) ++b;
  while (e > b && is_str_white_space(s[e - 1])) --e;
  return s.substr(b, e - b);
}

// JS `String.prototype.split(sep)`（`""` ⇒ `[""]`，尾随分隔符给空串）。
std::vector<std::u16string> split_text(const std::u16string& s, char16_t sep) {
  std::vector<std::u16string> out;
  std::u16string cur;
  for (const char16_t c : s) {
    if (c == sep) {
      out.push_back(cur);
      cur.clear();
    } else {
      cur.push_back(c);
    }
  }
  out.push_back(cur);
  return out;
}

Value arr_of(std::vector<Value> items) {
  return Value(std::make_shared<Array>(std::move(items)));
}

Value str_value(const char16_t* s) { return Value(std::u16string(s)); }

// ---- 读向小工具（对齐 `xml_x_director.ts` 顶部那批自由函数）----

OptStr attr(const IXMLElement& el, const char16_t* name) { return el.attr(name); }

std::optional<double> num_attr(const IXMLElement& el, const char16_t* name) {
  const OptStr v = el.attr(name);
  if (!v) return std::nullopt;
  if (trim_str(*v).empty()) return std::nullopt;
  const double num = string_to_number(*v);
  if (num != num) return std::nullopt;
  return num;
}

std::optional<bool> bool_attr(const IXMLElement& el, const char16_t* name) {
  const OptStr v = el.attr(name);
  if (!v) return std::nullopt;
  return *v == u"true" || *v == u"1";
}

// `string | string[] | undefined`
Value str_or_strs(const IXMLElement& el, const char16_t* name) {
  const auto list = el.strs_attr(name);
  if (!list) return Value();
  if (list->size() > 1) {
    std::vector<Value> out;
    for (const std::u16string& s : *list) out.push_back(Value(s));
    return arr_of(std::move(out));
  }
  return Value((*list)[0]);
}

// `/^-?\d+(?:\.\d+)?$/`
bool is_expr_number(const std::u16string& text) {
  size_t i = 0;
  if (i < text.size() && text[i] == u'-') ++i;
  const size_t int_begin = i;
  while (i < text.size() && text[i] >= u'0' && text[i] <= u'9') ++i;
  if (i == int_begin) return false;
  if (i < text.size() && text[i] == u'.') {
    ++i;
    const size_t frac_begin = i;
    while (i < text.size() && text[i] >= u'0' && text[i] <= u'9') ++i;
    if (i == frac_begin) return false;
  }
  return i == text.size();
}

// `TNumberExpr`：纯数字 ⇒ `double`，否则原字符串（表达式）。
Value to_expr(const std::u16string& raw) {
  const std::u16string text = trim_str(raw);
  return is_expr_number(text) ? Value(string_to_number(text)) : Value(raw);
}

Value expr_attr(const IXMLElement& el, const char16_t* name) {
  const OptStr raw = el.attr(name);
  if (!raw) return Value();
  return to_expr(*raw);
}

Value parse_literal(const std::u16string& text) {
  if (const std::optional<Value> v = json_parse(text)) return *v;
  return Value(text);
}

std::optional<std::pair<std::u16string, Value>> parse_value(const IXMLElement& el);

// `Object.assign(ret, v)` 的那一半：对象按插入序、数组按 `"0","1",…`；其余（标量）无操作。
void assign_into(Object& ret, const Value& v) {
  if (const Object* const o = as_object(v)) {
    for (const std::u16string& k : o->keys()) {
      if (const Value* const item = o->get(k)) ret.set(k, *item);
    }
    return;
  }
  if (const Array* const a = as_array(v)) {
    for (size_t i = 0; i < a->size(); ++i) ret.set(number_to_string(static_cast<double>(i)), a->at(i));
  }
}

Value parse_values(const IXMLElement* el) {
  if (el == nullptr) return Value();
  auto ret = std::make_shared<Object>();
  if (const OptStr json = el->attr(u"json")) assign_into(*ret, parse_literal(*json));
  for (const XmlAttr& at : el->attrs()) {
    if (at.name == u"json") continue;
    ret->set(at.name, parse_literal(at.value));
  }
  for (IXMLElement* const child : el->children_by_tag(u"value")) {
    const std::optional<std::pair<std::u16string, Value>> parsed = parse_value(*child);
    if (parsed) ret->set(parsed->first, parsed->second);
  }
  return ret->empty() ? Value() : Value(std::move(ret));
}

// `<value name=… type=… value=…>` ⇒ `[name, 解析值]`；没名字 ⇒ `undefined`。
std::optional<std::pair<std::u16string, Value>> parse_value(const IXMLElement& el) {
  const OptStr name = attr(el, u"name");
  if (!name || name->empty()) return std::nullopt;
  std::u16string type = attr(el, u"type").value_or(u"str");
  for (char16_t& c : type) {
    if (c >= u'A' && c <= u'Z') c = static_cast<char16_t>(c - u'A' + u'a');
  }
  const std::u16string raw = attr(el, u"value").value_or(el.text());
  if (type == u"num") return std::make_pair(*name, Value(string_to_number(raw)));
  if (type == u"bool") return std::make_pair(*name, Value(raw == u"true" || raw == u"1"));
  if (type == u"strs") {
    if (const auto list = el.strs_attr(u"value")) {
      std::vector<Value> out;
      for (const std::u16string& s : *list) out.push_back(Value(s));
      return std::make_pair(*name, arr_of(std::move(out)));
    }
    if (!el.text().empty()) {
      std::vector<Value> out;
      for (const std::u16string& s : split_text(el.text(), u',')) out.push_back(Value(s));
      return std::make_pair(*name, arr_of(std::move(out)));
    }
    return std::make_pair(*name, arr_of({}));
  }
  if (type == u"nums") {
    if (const auto list = el.nums_attr(u"value")) {
      std::vector<Value> out;
      for (const double d : *list) out.push_back(Value(d));
      return std::make_pair(*name, arr_of(std::move(out)));
    }
    if (!el.text().empty()) {
      std::vector<Value> out;
      for (const std::u16string& s : split_text(el.text(), u',')) {
        out.push_back(Value(string_to_number(s)));
      }
      return std::make_pair(*name, arr_of(std::move(out)));
    }
    return std::make_pair(*name, arr_of({}));
  }
  if (type == u"json") {
    const std::u16string text = !el.text().empty() ? el.text() : (!raw.empty() ? raw : u"null");
    return std::make_pair(*name, parse_literal(text));
  }
  return std::make_pair(*name, Value(raw));
}

// `"a,b,c"` ⇒ `["a","b","c"]`（`key_up="all"` ⇒ 字符串 `"all"`）；空 ⇒ `undefined`。
Value parse_keys(const IXMLElement& el, const char16_t* name) {
  const OptStr raw = attr(el, name);
  if (!raw) return Value();
  if (std::u16string(name) == u"key_up" && trim_str(*raw) == u"all") return str_value(u"all");
  std::vector<Value> out;
  for (const std::u16string& part : split_text(*raw, u',')) {
    const std::u16string t = trim_str(part);
    if (!t.empty()) out.push_back(Value(t));
  }
  return out.empty() ? Value() : arr_of(std::move(out));
}

Value parse_key_step_attrs(const IXMLElement& el) {
  auto step = std::make_shared<Object>();
  const Value click = parse_keys(el, u"click");
  const Value dbl_click = parse_keys(el, u"dbl_click");
  const Value db_hit = parse_keys(el, u"db_hit");
  const Value key_down = parse_keys(el, u"key_down");
  const Value key_up = parse_keys(el, u"key_up");
  if (is_some(click)) step->set(u"click", click);
  if (is_some(dbl_click)) step->set(u"dbl_click", dbl_click);
  if (is_some(db_hit)) step->set(u"db_hit", db_hit);
  if (is_some(key_down)) step->set(u"key_down", key_down);
  if (is_some(key_up)) step->set(u"key_up", key_up);
  return step->empty() ? Value() : Value(std::move(step));
}

Value parse_key_steps(const IXMLElement& el) {
  std::vector<Value> ret;
  const Value own = parse_key_step_attrs(el);
  if (is_some(own)) ret.push_back(own);
  for (IXMLElement* const child : el.children_by_tag(u"step")) {
    const Value step = parse_key_step_attrs(*child);
    if (is_some(step)) ret.push_back(step);
  }
  return arr_of(std::move(ret));
}

Value parse_target(const IXMLElement& el) { return str_or_strs(el, u"target"); }

Value parse_pair(const IXMLElement& el, const char16_t* name) {
  const auto list = el.strs_attr(name);
  if (!list || list->size() < 2) return Value();
  return arr_of({to_expr((*list)[0]), to_expr((*list)[1])});
}

Value parse_layout(const IXMLElement* el) {
  if (el == nullptr) return Value();
  const std::u16string type = attr(*el, u"type").value_or(u"point");
  if (type == u"line") {
    auto ret = std::make_shared<Object>();
    ret->set(u"type", str_value(u"line"));
    const OptStr axis = attr(*el, u"axis");
    if (axis && (*axis == u"x" || *axis == u"z")) ret->set(u"axis", Value(*axis));
    const Value x = expr_attr(*el, u"x");
    if (is_some(x)) ret->set(u"x", x);
    const Value y = expr_attr(*el, u"y");
    if (is_some(y)) ret->set(u"y", y);
    const Value z = expr_attr(*el, u"z");
    if (is_some(z)) ret->set(u"z", z);
    const Value length = expr_attr(*el, u"length");
    if (is_some(length)) ret->set(u"length", length);
    return Value(std::move(ret));
  }
  if (type == u"circle") {
    auto ret = std::make_shared<Object>();
    ret->set(u"type", str_value(u"circle"));
    const Value x = expr_attr(*el, u"x");
    if (is_some(x)) ret->set(u"x", x);
    const Value y = expr_attr(*el, u"y");
    if (is_some(y)) ret->set(u"y", y);
    const Value z = expr_attr(*el, u"z");
    if (is_some(z)) ret->set(u"z", z);
    const Value radius = expr_attr(*el, u"radius");
    if (is_some(radius)) ret->set(u"radius", radius);
    const Value rx = expr_attr(*el, u"rx");
    if (is_some(rx)) ret->set(u"rx", rx);
    const Value rz = expr_attr(*el, u"rz");
    if (is_some(rz)) ret->set(u"rz", rz);
    return Value(std::move(ret));
  }
  auto ret = std::make_shared<Object>();
  ret->set(u"type", str_value(u"point"));
  return Value(std::move(ret));
}

Value xml_2_actor(const IXMLElement& el) {
  auto ret = std::make_shared<Object>();
  ret->set(u"id", Value(attr(el, u"id").value_or(u"")));
  const Value oid = str_or_strs(el, u"oid");
  if (is_some(oid)) ret->set(u"oid", oid);
  const OptStr source = attr(el, u"source");
  if (source && *source == u"fighters") ret->set(u"source", Value(*source));
  const OptStr half = attr(el, u"half");
  if (half && (*half == u"first" || *half == u"second")) ret->set(u"half", Value(*half));
  if (const std::optional<double> count = num_attr(el, u"count")) ret->set(u"count", Value(*count));
  if (const OptStr at = attr(el, u"at")) ret->set(u"at", Value(*at));
  const Value x = expr_attr(el, u"x");
  if (is_some(x)) ret->set(u"x", x);
  const Value y = expr_attr(el, u"y");
  if (is_some(y)) ret->set(u"y", y);
  const Value z = expr_attr(el, u"z");
  if (is_some(z)) ret->set(u"z", z);
  const Value dx = expr_attr(el, u"dx");
  if (is_some(dx)) ret->set(u"dx", dx);
  const Value dy = expr_attr(el, u"dy");
  if (is_some(dy)) ret->set(u"dy", dy);
  const Value dz = expr_attr(el, u"dz");
  if (is_some(dz)) ret->set(u"dz", dz);
  const Value group = str_or_strs(el, u"group");
  if (is_some(group)) ret->set(u"group", group);
  const OptStr ctrl = attr(el, u"ctrl");
  if (ctrl && (*ctrl == u"local" || *ctrl == u"bot" || *ctrl == u"invalid")) {
    ret->set(u"ctrl", Value(*ctrl));
  }
  if (const OptStr player_id = attr(el, u"player_id")) ret->set(u"player_id", Value(*player_id));
  if (const std::optional<bool> attach = bool_attr(el, u"attach")) {
    ret->set(u"attach", Value(*attach));
  }
  const Value layout = parse_layout(el.child_by_tag(u"layout"));
  if (is_some(layout)) ret->set(u"layout", layout);
  const Value values = parse_values(el.child_by_tag(u"values"));
  if (is_some(values)) ret->set(u"values", values);
  return Value(std::move(ret));
}

Value parse_groups(const IXMLElement* el) {
  if (el == nullptr) return Value();
  auto ret = std::make_shared<Object>();
  for (IXMLElement* const child : el->children_by_tag(u"group")) {
    const OptStr name = attr(*child, u"name");
    if (!name || name->empty()) continue;
    const Value actors = str_or_strs(*child, u"actors");
    ret->set(*name, is_some(actors) ? actors : arr_of({}));
  }
  return ret->empty() ? Value() : Value(std::move(ret));
}

const char16_t* const kStageNumberKeys[] = {
    u"left",       u"right",      u"near",      u"far",       u"width",      u"depth",
    u"player_l",   u"player_r",   u"cam_l",     u"cam_r",     u"enemy_l",    u"enemy_r",
    u"drink_l",    u"drink_r",    u"phase_time", u"dialog_time"};

Value parse_stage(const IXMLElement* el) {
  if (el == nullptr) return Value();
  auto ret = std::make_shared<Object>();
  for (const char16_t* key : kStageNumberKeys) {
    if (const std::optional<double> num = num_attr(*el, key)) ret->set(key, Value(*num));
  }
  return ret->empty() ? Value() : Value(std::move(ret));
}

Value xml_2_action(const IXMLElement& el);

Value parse_actions(const IXMLElement* parent) {
  if (parent == nullptr) return Value();
  std::vector<Value> ret;
  for (IXMLElement* const child : parent->children()) {
    const Value action = xml_2_action(*child);
    if (is_some(action)) ret.push_back(action);
  }
  return ret.empty() ? Value() : arr_of(std::move(ret));
}

Value xml_2_action(const IXMLElement& el) {
  const std::u16string& tag = el.tag();
  if (tag == u"input") {
    const Value target = parse_target(el);
    if (!is_some(target)) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"input"));
    ret->set(u"target", target);
    ret->set(u"actions", parse_key_steps(el));
    return Value(std::move(ret));
  }
  if (tag == u"set") {
    const Value target = parse_target(el);
    const Value values = parse_values(el.child_by_tag(u"values"));
    if (!is_some(target) || !is_some(values)) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"set"));
    ret->set(u"target", target);
    ret->set(u"values", values);
    return Value(std::move(ret));
  }
  if (tag == u"camera") {
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"camera"));
    const Value dest = parse_pair(el, u"dest");
    if (is_some(dest)) ret->set(u"dest", dest);
    const Value lock = parse_pair(el, u"lock");
    if (is_some(lock)) ret->set(u"lock", lock);
    if (const std::optional<bool> undest = bool_attr(el, u"undest")) {
      ret->set(u"undest", Value(*undest));
    }
    if (const std::optional<bool> unlock = bool_attr(el, u"unlock")) {
      ret->set(u"unlock", Value(*unlock));
    }
    return Value(std::move(ret));
  }
  if (tag == u"cmd") {
    OptStr name = attr(el, u"name");
    if (!name) name = attr(el, u"cmd");
    if (!name || name->empty()) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"cmd"));
    ret->set(u"name", Value(*name));
    if (const auto args = el.strs_attr(u"args")) {
      std::vector<Value> out;
      for (const std::u16string& s : *args) out.push_back(Value(s));
      ret->set(u"args", arr_of(std::move(out)));
    }
    return Value(std::move(ret));
  }
  if (tag == u"bg") {
    OptStr id = attr(el, u"id");
    if (!id) id = attr(el, u"bg");
    if (!id || id->empty()) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"bg"));
    ret->set(u"id", Value(*id));
    return Value(std::move(ret));
  }
  if (tag == u"stage") {
    const Value values = parse_stage(&el);
    if (!is_some(values)) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"stage"));
    ret->set(u"values", values);
    return Value(std::move(ret));
  }
  if (tag == u"place") {
    const Value target = parse_target(el);
    const OptStr at = attr(el, u"at");
    if (!is_some(target) || !at) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"place"));
    ret->set(u"target", target);
    ret->set(u"at", Value(*at));
    const Value dx = expr_attr(el, u"dx");
    if (is_some(dx)) ret->set(u"dx", dx);
    const Value dy = expr_attr(el, u"dy");
    if (is_some(dy)) ret->set(u"dy", dy);
    const Value dz = expr_attr(el, u"dz");
    if (is_some(dz)) ret->set(u"dz", dz);
    if (const OptStr requires_attr = attr(el, u"requires")) ret->set(u"requires", Value(*requires_attr));
    return Value(std::move(ret));
  }
  if (tag == u"move") {
    const Value target = parse_target(el);
    if (!is_some(target)) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"move"));
    ret->set(u"target", target);
    const Value dx = expr_attr(el, u"dx");
    if (is_some(dx)) ret->set(u"dx", dx);
    const Value dy = expr_attr(el, u"dy");
    if (is_some(dy)) ret->set(u"dy", dy);
    const Value dz = expr_attr(el, u"dz");
    if (is_some(dz)) ret->set(u"dz", dz);
    return Value(std::move(ret));
  }
  if (tag == u"face") {
    const Value target = parse_target(el);
    const OptStr at = attr(el, u"at");
    if (!is_some(target) || !at) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"face"));
    ret->set(u"target", target);
    ret->set(u"at", Value(*at));
    return Value(std::move(ret));
  }
  if (tag == u"velocity") {
    const Value target = parse_target(el);
    if (!is_some(target)) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"velocity"));
    ret->set(u"target", target);
    for (const char16_t* key : {u"x", u"y", u"z"}) {
      const OptStr raw = attr(el, key);
      if (!raw) continue;
      ret->set(key, trim_str(*raw) == u"null" ? Value(NullTag{}) : to_expr(*raw));
    }
    return Value(std::move(ret));
  }
  if (tag == u"frame") {
    const Value target = parse_target(el);
    OptStr id = attr(el, u"id");
    if (!id) id = attr(el, u"frame");
    if (!is_some(target) || !id) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"frame"));
    ret->set(u"target", target);
    ret->set(u"id", Value(*id));
    return Value(std::move(ret));
  }
  if (tag == u"pickup") {
    const Value target = parse_target(el);
    const OptStr weapon = attr(el, u"weapon");
    if (!is_some(target) || !weapon) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"pickup"));
    ret->set(u"target", target);
    ret->set(u"weapon", Value(*weapon));
    if (const std::optional<bool> if_empty = bool_attr(el, u"if_empty")) {
      ret->set(u"if_empty", Value(*if_empty));
    }
    return Value(std::move(ret));
  }
  if (tag == u"cycle") {
    const Value target = parse_target(el);
    const OptStr property = attr(el, u"property");
    if (!is_some(target) || !property) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"cycle"));
    ret->set(u"target", target);
    ret->set(u"property", Value(*property));
    if (const OptStr json = attr(el, u"json")) {
      ret->set(u"values", parse_literal(*json));
    } else if (const auto list = el.strs_attr(u"values")) {
      std::vector<Value> out;
      for (const std::u16string& s : *list) out.push_back(Value(s));
      ret->set(u"values", arr_of(std::move(out)));
    } else {
      ret->set(u"values", arr_of({}));
    }
    return Value(std::move(ret));
  }
  if (tag == u"throw_spot") {
    const OptStr target = attr(el, u"target");
    const OptStr from = attr(el, u"from");
    if (!target || !from) return Value();
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"throw_spot"));
    ret->set(u"target", Value(*target));
    ret->set(u"from", Value(*from));
    return Value(std::move(ret));
  }
  if (tag == u"reset") {
    auto ret = std::make_shared<Object>();
    ret->set(u"op", str_value(u"reset"));
    return Value(std::move(ret));
  }
  return Value();
}

Value xml_2_auto(const IXMLElement& el) {
  const Value target = parse_target(el);
  if (!is_some(target)) return Value();
  auto when = std::make_shared<Object>();
  const Value state = str_or_strs(el, u"state");
  if (is_some(state)) when->set(u"state", state);
  const Value state_not = str_or_strs(el, u"state_not");
  if (is_some(state_not)) when->set(u"state_not", state_not);
  if (const std::optional<double> mp_gt = num_attr(el, u"mp_gt")) {
    when->set(u"mp_gt", Value(*mp_gt));
  }
  if (const OptStr frame_hit = attr(el, u"frame_hit")) when->set(u"frame_hit", Value(*frame_hit));
  auto ret = std::make_shared<Object>();
  ret->set(u"target", target);
  ret->set(u"actions", parse_key_steps(el));
  if (!when->empty()) ret->set(u"when", Value(std::move(when)));
  return Value(std::move(ret));
}

std::vector<Value> parse_timeline_entries(const IXMLElement& parent) {
  std::vector<Value> ret;
  for (IXMLElement* const el : parent.children_by_tag(u"entry")) {
    if (const std::optional<double> wait = num_attr(*el, u"wait")) {
      auto entry = std::make_shared<Object>();
      entry->set(u"wait", Value(*wait));
      ret.push_back(Value(std::move(entry)));
      continue;
    }
    const std::optional<double> repeat = num_attr(*el, u"repeat");
    const std::optional<double> interval = num_attr(*el, u"interval");
    if (repeat && interval) {
      auto entry = std::make_shared<Object>();
      entry->set(u"repeat", Value(*repeat));
      entry->set(u"interval", Value(*interval));
      entry->set(u"entries", arr_of(parse_timeline_entries(*el)));
      ret.push_back(Value(std::move(entry)));
      continue;
    }
    auto entry = std::make_shared<Object>();
    if (const std::optional<double> after = num_attr(*el, u"after")) {
      entry->set(u"after", Value(*after));
    }
    const Value actions = parse_actions(el);
    if (is_some(actions)) entry->set(u"actions", actions);
    ret.push_back(Value(std::move(entry)));
  }
  return ret;
}

Value xml_2_director_timeline(const IXMLElement* el) {
  if (el == nullptr) return Value();
  auto ret = std::make_shared<Object>();
  ret->set(u"entries", arr_of(parse_timeline_entries(*el)));
  if (const std::optional<double> times = num_attr(*el, u"times")) {
    ret->set(u"times", Value(*times));
  }
  return Value(std::move(ret));
}

// ---- 反写（`xml_x_*`）----

void set_expr_attrs(const std::shared_ptr<IXMLElement>& el, const Value& data,
                    std::initializer_list<const char16_t*> names) {
  for (const char16_t* const name : names) {
    const Value value = field_or(data, name);
    if (is_some(value)) el->set_attr(name, value);
  }
}

std::shared_ptr<IXMLElement> xml_x_value(IXML& xml, const std::u16string& name,
                                         const Value& value) {
  std::shared_ptr<IXMLElement> el = xml.create(u"value");
  el->set_attr(u"name", Value(name));
  if (const bool* const b = std::get_if<bool>(&value)) {
    el->set_attr(u"type", str_value(u"bool"));
    el->set_attr(u"value", Value(*b));
    return el;
  }
  if (const double* const d = std::get_if<double>(&value)) {
    el->set_attr(u"type", str_value(u"num"));
    el->set_attr(u"value", Value(*d));
    return el;
  }
  if (const std::u16string* const s = std::get_if<std::u16string>(&value)) {
    el->set_attr(u"type", str_value(u"str"));
    el->set_attr(u"value", Value(*s));
    return el;
  }
  const Array* const arr = as_array(value);
  bool all_nums = arr != nullptr && !arr->empty();
  bool all_strs = arr != nullptr && !arr->empty();
  bool has_comma = false;
  if (arr != nullptr) {
    for (const Value& item : arr->items()) {
      if (!std::holds_alternative<double>(item)) all_nums = false;
      const std::u16string* const s = std::get_if<std::u16string>(&item);
      if (s == nullptr) {
        all_strs = false;
      } else if (s->find(u',') != std::u16string::npos) {
        has_comma = true;
      }
    }
  }
  if (all_nums) {
    el->set_attr(u"type", str_value(u"nums"));
    el->set_attr(u"value", value);
    return el;
  }
  if (all_strs && !has_comma) {
    el->set_attr(u"type", str_value(u"strs"));
    el->set_arr_attr_soft(u"value", value);
    return el;
  }
  el->set_attr(u"type", str_value(u"json"));
  const std::optional<std::u16string> text = json_stringify(value);
  el->set_text(text ? *text : std::u16string());
  return el;
}

void xml_x_values(IXML& xml, const Value& values, const std::shared_ptr<IXMLElement>& parent) {
  std::shared_ptr<IXMLElement> el = xml.create(u"values");
  if (const Object* const o = as_object(values)) {
    for (const std::u16string& name : o->keys()) {
      const Value* const value = o->get(name);
      if (value == nullptr || std::holds_alternative<std::monostate>(*value)) continue;
      el->insert(xml_x_value(xml, name, *value));
    }
  }
  parent->insert(el);
}

void xml_x_key_step_attrs(const std::shared_ptr<IXMLElement>& el, const Value& step) {
  for (const char16_t* const name :
       {u"click", u"dbl_click", u"db_hit", u"key_down", u"key_up"}) {
    const Value value = field_or(step, name);
    if (is_some(value)) el->set_attr(name, value);
  }
}

void xml_x_key_steps(IXML& xml, const Value& steps, const std::shared_ptr<IXMLElement>& parent) {
  const Array* const arr = as_array(steps);
  if (arr == nullptr) return;
  for (const Value& step : arr->items()) {
    std::shared_ptr<IXMLElement> el = xml.create(u"step");
    xml_x_key_step_attrs(el, step);
    parent->insert(el);
  }
}

void xml_x_actions(IXML& xml, const Value& actions, const std::shared_ptr<IXMLElement>& parent);

std::shared_ptr<IXMLElement> xml_x_action(IXML& xml, const Value& action) {
  const Value op = field_or(action, u"op");
  const std::u16string* const op_name = std::get_if<std::u16string>(&op);
  if (op_name == nullptr) return nullptr;
  const std::u16string& kind = *op_name;
  if (kind == u"input") {
    std::shared_ptr<IXMLElement> el = xml.create(u"input");
    el->set_attr(u"target", field_or(action, u"target"));
    const Value actions = field_or(action, u"actions");
    const Array* const arr = as_array(actions);
    if (arr != nullptr && arr->size() == 1) {
      xml_x_key_step_attrs(el, arr->at(0));
    } else {
      xml_x_key_steps(xml, actions, el);
    }
    return el;
  }
  if (kind == u"set") {
    std::shared_ptr<IXMLElement> el = xml.create(u"set");
    el->set_attr(u"target", field_or(action, u"target"));
    xml_x_values(xml, field_or(action, u"values"), el);
    return el;
  }
  if (kind == u"camera") {
    std::shared_ptr<IXMLElement> el = xml.create(u"camera");
    const Value dest = field_or(action, u"dest");
    if (is_some(dest)) el->set_attr(u"dest", dest);
    const Value lock = field_or(action, u"lock");
    if (is_some(lock)) el->set_attr(u"lock", lock);
    const Value undest = field_or(action, u"undest");
    if (is_some(undest)) el->set_attr(u"undest", undest);
    const Value unlock = field_or(action, u"unlock");
    if (is_some(unlock)) el->set_attr(u"unlock", unlock);
    return el;
  }
  if (kind == u"cmd") {
    std::shared_ptr<IXMLElement> el = xml.create(u"cmd");
    el->set_attr(u"name", field_or(action, u"name"));
    const Value args = field_or(action, u"args");
    if (is_some(args)) el->set_attr(u"args", args);
    return el;
  }
  if (kind == u"bg") {
    std::shared_ptr<IXMLElement> el = xml.create(u"bg");
    el->set_attr(u"id", field_or(action, u"id"));
    return el;
  }
  if (kind == u"stage") {
    std::shared_ptr<IXMLElement> el = xml.create(u"stage");
    const Value values = field_or(action, u"values");
    if (const Object* const o = as_object(values)) {
      for (const std::u16string& name : o->keys()) {
        const Value* const value = o->get(name);
        if (value != nullptr) el->set_attr(name, *value);
      }
    }
    return el;
  }
  if (kind == u"place") {
    std::shared_ptr<IXMLElement> el = xml.create(u"place");
    el->set_attr(u"target", field_or(action, u"target"));
    el->set_attr(u"at", field_or(action, u"at"));
    set_expr_attrs(el, action, {u"dx", u"dy", u"dz"});
    el->set_attr(u"requires", field_or(action, u"requires"));
    return el;
  }
  if (kind == u"move") {
    std::shared_ptr<IXMLElement> el = xml.create(u"move");
    el->set_attr(u"target", field_or(action, u"target"));
    set_expr_attrs(el, action, {u"dx", u"dy", u"dz"});
    return el;
  }
  if (kind == u"face") {
    std::shared_ptr<IXMLElement> el = xml.create(u"face");
    el->set_attr(u"target", field_or(action, u"target"));
    el->set_attr(u"at", field_or(action, u"at"));
    return el;
  }
  if (kind == u"velocity") {
    std::shared_ptr<IXMLElement> el = xml.create(u"velocity");
    el->set_attr(u"target", field_or(action, u"target"));
    for (const char16_t* const key : {u"x", u"y", u"z"}) {
      const Value value = field_or(action, key);
      if (std::holds_alternative<std::monostate>(value)) continue;
      el->set_attr(key, std::holds_alternative<NullTag>(value) ? str_value(u"null") : value);
    }
    return el;
  }
  if (kind == u"frame") {
    std::shared_ptr<IXMLElement> el = xml.create(u"frame");
    el->set_attr(u"target", field_or(action, u"target"));
    el->set_attr(u"id", field_or(action, u"id"));
    return el;
  }
  if (kind == u"pickup") {
    std::shared_ptr<IXMLElement> el = xml.create(u"pickup");
    el->set_attr(u"target", field_or(action, u"target"));
    el->set_attr(u"weapon", field_or(action, u"weapon"));
    const Value if_empty = field_or(action, u"if_empty");
    if (is_some(if_empty)) el->set_attr(u"if_empty", if_empty);
    return el;
  }
  if (kind == u"cycle") {
    std::shared_ptr<IXMLElement> el = xml.create(u"cycle");
    el->set_attr(u"target", field_or(action, u"target"));
    el->set_attr(u"property", field_or(action, u"property"));
    const Value values = field_or(action, u"values");
    const Array* const arr = as_array(values);
    bool flat = arr != nullptr;
    if (arr != nullptr) {
      for (const Value& v : arr->items()) {
        if (!std::holds_alternative<std::u16string>(v) && !std::holds_alternative<double>(v) &&
            !std::holds_alternative<bool>(v)) {
          flat = false;
        }
      }
    }
    if (flat) {
      std::vector<Value> strs;
      for (const Value& v : arr->items()) strs.push_back(Value(to_string(v)));
      el->set_arr_attr_soft(u"values", arr_of(std::move(strs)));
    } else {
      const std::optional<std::u16string> text = json_stringify(values);
      el->set_attr(u"json", text ? Value(*text) : Value());
    }
    return el;
  }
  if (kind == u"throw_spot") {
    std::shared_ptr<IXMLElement> el = xml.create(u"throw_spot");
    el->set_attr(u"target", field_or(action, u"target"));
    el->set_attr(u"from", field_or(action, u"from"));
    return el;
  }
  if (kind == u"reset") return xml.create(u"reset");
  return nullptr;
}

void xml_x_actions(IXML& xml, const Value& actions, const std::shared_ptr<IXMLElement>& parent) {
  const Array* const arr = as_array(actions);
  if (arr == nullptr || arr->size() == 0) return;
  for (const Value& action : arr->items()) {
    std::shared_ptr<IXMLElement> el = xml_x_action(xml, action);
    if (el != nullptr) parent->insert(el);
  }
}

std::shared_ptr<IXMLElement> xml_x_layout(IXML& xml, const Value& layout) {
  std::shared_ptr<IXMLElement> el = xml.create(u"layout");
  const Value type = field_or(layout, u"type");
  el->set_attr(u"type", is_some(type) ? type : str_value(u"point"));
  if (std::get_if<std::u16string>(&type) != nullptr && *std::get_if<std::u16string>(&type) == u"line") {
    el->set_attr(u"axis", field_or(layout, u"axis"));
  }
  set_expr_attrs(el, layout, {u"x", u"y", u"z", u"length", u"radius", u"rx", u"rz"});
  return el;
}

std::shared_ptr<IXMLElement> xml_x_actor(IXML& xml, const Value& actor,
                                         const std::u16string& tag = u"actor") {
  std::shared_ptr<IXMLElement> el = xml.create(tag);
  for (const char16_t* const name :
       {u"id", u"oid", u"source", u"half", u"count", u"at"}) {
    el->set_attr(name, field_or(actor, name));
  }
  set_expr_attrs(el, actor, {u"x", u"y", u"z", u"dx", u"dy", u"dz"});
  for (const char16_t* const name : {u"group", u"ctrl", u"player_id", u"attach"}) {
    el->set_attr(name, field_or(actor, name));
  }
  const Value layout = field_or(actor, u"layout");
  if (is_some(layout)) el->insert(xml_x_layout(xml, layout));
  const Value values = field_or(actor, u"values");
  if (is_some(values)) xml_x_values(xml, values, el);
  return el;
}

void xml_x_timeline_entries(IXML& xml, const std::vector<Value>& entries,
                            const std::shared_ptr<IXMLElement>& parent) {
  for (const Value& entry : entries) {
    std::shared_ptr<IXMLElement> el = xml.create(u"entry");
    const Object* const o = as_object(entry);
    if (o != nullptr && o->has(u"wait")) {
      el->set_attr(u"wait", field_or(entry, u"wait"));
    } else if (o != nullptr && o->has(u"repeat")) {
      el->set_attr(u"repeat", field_or(entry, u"repeat"));
      el->set_attr(u"interval", field_or(entry, u"interval"));
      std::vector<Value> inner;
      if (const Array* const arr = as_array(field_or(entry, u"entries"))) {
        for (const Value& v : arr->items()) inner.push_back(v);
      }
      xml_x_timeline_entries(xml, inner, el);
    } else {
      el->set_attr(u"after", field_or(entry, u"after"));
      xml_x_actions(xml, field_or(entry, u"actions"), el);
    }
    parent->insert(el);
  }
}

}  // namespace

std::shared_ptr<IXMLElement> xml_x_director_index(IXML& xml, const Value& idx,
                                                  const std::u16string& tag) {
  std::shared_ptr<IXMLElement> el = xml.create(tag);
  el->set_attr(u"id", field_or(idx, u"id"));
  el->set_attr(u"file", field_or(idx, u"file"));
  el->set_attr(u"name", field_or(idx, u"name"));
  el->set_attr(u"skipped", field_or(idx, u"skipped"));
  return el;
}

Value xml_2_director_index(const IXMLElement& el) {
  auto ret = std::make_shared<Object>();
  const OptStr id = el.get_str(u"id");
  const OptStr file = el.get_str(u"file");
  ret->set(u"id", Value(id ? *id : std::u16string()));
  ret->set(u"file", Value(file ? *file : std::u16string()));
  if (const OptStr name = el.get_str(u"name")) ret->set(u"name", Value(*name));
  if (const OptStr skipped = el.get_str(u"skipped")) ret->set(u"skipped", Value(*skipped));
  return Value(std::move(ret));
}

Value xml_2_director(const IXMLElement& el) {
  auto ret = std::make_shared<Object>();
  ret->set(u"name", Value(attr(el, u"name").value_or(u"")));
  if (const OptStr bg = attr(el, u"bg")) ret->set(u"bg", Value(*bg));
  const Value stage = parse_stage(el.child_by_tag(u"stage"));
  if (is_some(stage)) ret->set(u"stage", stage);
  if (IXMLElement* const actors_el = el.child_by_tag(u"actors")) {
    std::vector<Value> actors;
    for (IXMLElement* const child : actors_el->children_by_tag(u"actor")) {
      actors.push_back(xml_2_actor(*child));
    }
    if (!actors.empty()) ret->set(u"actors", arr_of(std::move(actors)));
  }
  const Value groups = parse_groups(el.child_by_tag(u"groups"));
  if (is_some(groups)) ret->set(u"groups", groups);
  const Value setup = parse_actions(el.child_by_tag(u"setup"));
  if (is_some(setup)) ret->set(u"setup", setup);
  std::vector<Value> autos;
  for (IXMLElement* const child : el.children_by_tag(u"auto")) {
    const Value rule = xml_2_auto(*child);
    if (is_some(rule)) autos.push_back(rule);
  }
  if (!autos.empty()) ret->set(u"auto", arr_of(std::move(autos)));
  const Value timeline = xml_2_director_timeline(el.child_by_tag(u"timeline"));
  if (is_some(timeline)) ret->set(u"timeline", timeline);
  return Value(std::move(ret));
}

std::vector<Value> xml_to_directors(const IXMLElement& el) {
  if (el.tag() == u"director") return {xml_2_director(el)};
  std::vector<Value> ret;
  for (IXMLElement* const child : el.children_by_tag(u"director")) {
    ret.push_back(xml_2_director(*child));
  }
  return ret;
}

std::shared_ptr<IXMLElement> xml_x_director(IXML& xml, const Value& data,
                                            const std::u16string& tag) {
  std::shared_ptr<IXMLElement> el = xml.create(tag);
  el->set_attr(u"name", field_or(data, u"name"));
  el->set_attr(u"bg", field_or(data, u"bg"));
  const Value stage_data = field_or(data, u"stage");
  if (const Object* const stage = as_object(stage_data)) {
    std::shared_ptr<IXMLElement> stage_el = xml.create(u"stage");
    for (const std::u16string& name : stage->keys()) {
      const Value* const value = stage->get(name);
      if (value != nullptr) stage_el->set_attr(name, *value);
    }
    el->insert(stage_el);
  }
  const Value actors = field_or(data, u"actors");
  if (const Array* const arr = as_array(actors)) {
    if (arr->size() != 0) {
      std::shared_ptr<IXMLElement> actors_el = xml.create(u"actors");
      for (const Value& actor : arr->items()) actors_el->insert(xml_x_actor(xml, actor));
      el->insert(actors_el);
    }
  }
  const Value groups = field_or(data, u"groups");
  if (const Object* const o = as_object(groups)) {
    std::shared_ptr<IXMLElement> groups_el = xml.create(u"groups");
    for (const std::u16string& name : o->keys()) {
      const Value* const selectors = o->get(name);
      std::shared_ptr<IXMLElement> group = xml.create(u"group");
      group->set_attr(u"name", Value(name));
      group->set_attr(u"actors", selectors != nullptr ? *selectors : Value());
      groups_el->insert(group);
    }
    el->insert(groups_el);
  }
  const Value setup = field_or(data, u"setup");
  if (const Array* const arr = as_array(setup)) {
    if (arr->size() != 0) {
      std::shared_ptr<IXMLElement> setup_el = xml.create(u"setup");
      xml_x_actions(xml, setup, setup_el);
      el->insert(setup_el);
    }
  }
  if (const Array* const autos = as_array(field_or(data, u"auto"))) {
    for (const Value& rule : autos->items()) {
      std::shared_ptr<IXMLElement> auto_el = xml.create(u"auto");
      auto_el->set_attr(u"target", field_or(rule, u"target"));
      const Value when = field_or(rule, u"when");
      if (is_some(when)) {
        auto_el->set_attr(u"state", field_or(when, u"state"));
        auto_el->set_attr(u"state_not", field_or(when, u"state_not"));
        auto_el->set_attr(u"mp_gt", field_or(when, u"mp_gt"));
        auto_el->set_attr(u"frame_hit", field_or(when, u"frame_hit"));
      }
      const Value actions = field_or(rule, u"actions");
      const Array* const action_arr = as_array(actions);
      if (action_arr != nullptr && action_arr->size() == 1) {
        xml_x_key_step_attrs(auto_el, action_arr->at(0));
      } else {
        xml_x_key_steps(xml, actions, auto_el);
      }
      el->insert(auto_el);
    }
  }
  const Value timeline = field_or(data, u"timeline");
  if (const Object* const t = as_object(timeline)) {
    std::shared_ptr<IXMLElement> timeline_el = xml.create(u"timeline");
    timeline_el->set_attr(u"times", field_or(timeline, u"times"));
    std::vector<Value> entries;
    if (const Array* const arr = as_array(t->get(u"entries") != nullptr ? *t->get(u"entries")
                                                                        : Value())) {
      for (const Value& v : arr->items()) entries.push_back(v);
    }
    xml_x_timeline_entries(xml, entries, timeline_el);
    el->insert(timeline_el);
  }
  return el;
}

std::shared_ptr<IXMLElement> xml_x_directors(IXML& xml, const Value& group) {
  std::shared_ptr<IXMLElement> root = xml.create(u"directors");
  root->set_attr(u"id", field_or(group, u"id"));
  root->set_attr(u"name", field_or(group, u"name"));
  if (const Array* const arr = as_array(field_or(group, u"directors"))) {
    for (const Value& data : arr->items()) root->insert(xml_x_director(xml, data));
  }
  return root;
}

}
}
}
