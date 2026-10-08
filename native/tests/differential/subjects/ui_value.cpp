// `ui_value`（read_info_value：find_ui_value / parse_ui_value / judger）的 C++ 侧台面。
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/ui/read_info_value.h"

#include "trace_util.h"

namespace {

using trace::key_of;
using trace::render_value;
using trace::split_ws;
using trace::strip_comment;
using trace::to_ascii;
using trace::to_double;
using trace::to_u16;

// 用例里带空格的值要加引号 ⇒ kind 类 token 先 `key_of` 去引号。
std::string kind_token(const std::vector<std::string>& t, size_t& i) {
  return to_ascii(key_of(t[i++]));
}

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

std::string sv(const lfw::Value& v) {
  if (std::holds_alternative<std::monostate>(v)) return "u";
  if (std::holds_alternative<lfw::NullTag>(v)) return "z";
  return to_ascii(render_value(v));
}

bool kind_to_value(const std::string& raw, lfw::Value& out) {
  if (raw == "-" || raw == "u") {
    out = lfw::Value();
    return true;
  }
  if (raw == "z") {
    out = lfw::Value(lfw::NullTag{});
    return true;
  }
  if (raw == "arr") {
    out = lfw::Value(std::make_shared<lfw::Array>());
    return true;
  }
  if (raw == "arr12") {
    auto a = std::make_shared<lfw::Array>();
    a->push_back(lfw::Value(1.0));
    a->push_back(lfw::Value(2.0));
    out = lfw::Value(std::move(a));
    return true;
  }
  if (raw == "obj") {
    out = lfw::Value(std::make_shared<lfw::Object>());
    return true;
  }
  if (raw.rfind("str:", 0) == 0) {
    out = lfw::Value(to_u16(raw.substr(4)));
    return true;
  }
  if (raw.rfind("num:", 0) == 0) {
    out = lfw::Value(to_double(raw.substr(4)));
    return true;
  }
  if (raw.rfind("bool:", 0) == 0) {
    out = lfw::Value(to_double(raw.substr(5)) != 0);
    return true;
  }
  return false;
}

bool type_of_token(const std::string& raw, lfw::ui::UIValueType& out) {
  using K = lfw::ui::UIValueType::Kind;
  if (raw == "null") {
    out.kind = K::Null;
    return true;
  }
  if (raw == "bool") {
    out.kind = K::Boolean;
    return true;
  }
  if (raw == "num") {
    out.kind = K::Number;
    return true;
  }
  if (raw == "str") {
    out.kind = K::String;
    return true;
  }
  if (raw == "j01") {
    out.kind = K::Judger;
    out.judger = lfw::ui::UIJudger::Is0Or1;
    return true;
  }
  if (raw == "jobj") {
    out.kind = K::Judger;
    out.judger = lfw::ui::UIJudger::UnsafeIsObject;
    return true;
  }
  if (raw == "jarr") {
    out.kind = K::Judger;
    out.judger = lfw::ui::UIJudger::UnsafeIsArray;
    return true;
  }
  return false;
}

std::map<std::string, std::shared_ptr<lfw::Object>> g_uis;

lfw::Object* values_group(const std::string& id, const char16_t* group) {
  lfw::Object& o = *g_uis[id];
  const lfw::Value* cur = o.get(group);
  lfw::Object* sub = cur != nullptr ? const_cast<lfw::Object*>(lfw::as_object(*cur)) : nullptr;
  if (sub == nullptr) {
    o.set(group, lfw::Value(std::make_shared<lfw::Object>()));
    sub = const_cast<lfw::Object*>(lfw::as_object(*o.get(group)));
  }
  return sub;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_ui_value <case-file>\n");
    return 2;
  }
  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  std::string raw;
  while (std::getline(in, raw)) {
    const std::vector<std::string> t = split_ws(strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "uinew") {
      g_uis[t[i++]] = std::make_shared<lfw::Object>();
    } else if (op == "uparent") {
      const std::string id = t[i++];
      const std::string pid = t[i++];
      g_uis[id]->set(u"parent", lfw::Value(g_uis[pid]));
    } else if (op == "val" || op == "tval") {
      const std::string id = t[i++];
      const std::u16string name = key_of(t[i++]);
      lfw::Value v;
      if (!kind_to_value(kind_token(t, i), v)) {
        push(op + "|bad");
        continue;
      }
      values_group(id, op == "val" ? u"values" : u"template_values")->set(name, v);
    } else if (op == "find") {
      const std::string id = t[i++];
      const std::u16string name = key_of(t[i++]);
      push("find|" + to_ascii(name) + "|" + sv(lfw::ui::find_ui_value(lfw::Value(g_uis[id]), name)));
    } else if (op == "puv") {
      const std::string id = t[i++];
      lfw::ui::UIValueType type;
      if (!type_of_token(t[i++], type)) {
        push("puv|badtype");
        continue;
      }
      lfw::Value v;
      if (!kind_to_value(kind_token(t, i), v)) {
        push("puv|badkind");
        continue;
      }
      lfw::Value out;
      bool out_null = false;
      std::u16string error;
      if (!lfw::ui::parse_ui_value(lfw::Value(g_uis[id]), type, v, out, out_null, error)) {
        push("puv|err|" + to_ascii(error));
      } else if (out_null) {
        push("puv|null");
      } else {
        push("puv|v|" + sv(out));
      }
    } else if (op == "puierr") {
      lfw::ui::UIValueType type;
      if (!type_of_token(t[i++], type)) {
        push("puierr|badtype");
        continue;
      }
      lfw::Value ui;
      if (!kind_to_value(kind_token(t, i), ui)) {
        push("puierr|badui");
        continue;
      }
      lfw::Value v;
      if (!kind_to_value(kind_token(t, i), v)) {
        push("puierr|badkind");
        continue;
      }
      lfw::Value out;
      bool out_null = false;
      std::u16string error;
      if (!lfw::ui::parse_ui_value(ui, type, v, out, out_null, error)) {
        push("puierr|err|" + to_ascii(error));
      } else if (out_null) {
        push("puierr|null");
      } else {
        push("puierr|v|" + sv(out));
      }
    } else {
      std::fprintf(stderr, "unknown op '%s'\n", op.c_str());
      return 2;
    }
  }

  std::string joined;
  for (size_t k = 0; k < g_log.size(); ++k) {
    if (k != 0) joined += "\n";
    joined += g_log[k];
  }
  std::printf("%s\n", joined.c_str());
  return 0;
}
