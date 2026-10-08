// `ui_base`（UI 叶层：颜色 / 文本解析 / CrossInfo）的 C++ 侧台面。
#include <cstdio>
#include <fstream>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "lfw/ui/color.h"
#include "lfw/ui/cross_info.h"
#include "lfw/ui/ui_parse.h"

#include "trace_util.h"

namespace {

using trace::key_of;
using trace::render_value;
using trace::split_ws;
using trace::strip_comment;
using trace::to_ascii;
using trace::to_double;

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

std::string num(double d) { return to_ascii(render_value(lfw::Value(d))); }

std::string dump_rgba(const lfw::ui::Rgba& c) {
  return num(c.r) + "," + num(c.g) + "," + num(c.b) + "," + num(c.a);
}

std::string kind_to_value(const std::string& raw, lfw::Value& out) {
  if (raw == "-" || raw == "u") return "u";
  if (raw == "z") {
    out = lfw::Value(lfw::NullTag{});
    return "v";
  }
  if (raw.rfind("str:", 0) == 0) {
    out = lfw::Value(trace::to_u16(raw.substr(4)));
    return "v";
  }
  if (raw.rfind("num:", 0) == 0) {
    out = lfw::Value(to_double(raw.substr(4)));
    return "v";
  }
  return "bad";
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_ui_base <case-file>\n");
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

    if (op == "hex") {
      const std::u16string src = key_of(t[i++]);
      const std::optional<lfw::ui::Rgba> c = lfw::ui::hex_to_rgba(src);
      push("hex|" + to_ascii(src) + "|" + (c.has_value() ? dump_rgba(*c) : "null"));
    } else if (op == "inti") {
      const double n = to_double(t[i++]);
      const std::optional<lfw::ui::Rgba> c = lfw::ui::int_to_rgba(n);
      push("inti|" + num(n) + "|" + (c.has_value() ? dump_rgba(*c) : "null"));
    } else if (op == "col" || op == "colget") {
      const std::string kind = to_ascii(key_of(t[i++]));
      lfw::Value v;
      const std::string parsed = kind_to_value(kind, v);
      if (parsed == "bad") {
        push(op + "|" + kind + "|bad");
        continue;
      }
      const lfw::ui::RgbaLookup r =
          op == "col" ? lfw::ui::parse_rgba(v) : lfw::ui::rgba_map_get(v);
      std::string body;
      if (!r.found) body = (op == "colget" && parsed == "u") ? "undef" : "null";
      else if (r.is_null) body = "null";
      else body = dump_rgba(r.value);
      push(op + "|" + kind + "|" + body);
    } else if (op == "callexpr") {
      const std::u16string text = key_of(t[i++]);
      const std::optional<lfw::ui::CallFuncExpression> r =
          lfw::ui::parse_call_func_expression(text);
      if (!r.has_value()) {
        push("callexpr|null");
      } else {
        std::string args;
        for (size_t k = 0; k < r->args.size(); ++k) {
          if (k != 0) args += ",";
          args += to_ascii(r->args[k]);
        }
        push("callexpr|" + to_ascii(r->id) + "|" + to_ascii(r->name) + "|" + args + "|e" +
             (r->enabled ? "1" : "0"));
      }
    } else if (op == "funcargs") {
      const std::u16string text = key_of(t[i++]);
      const std::u16string name = key_of(t[i++]);
      const double min = i < t.size() ? to_double(t[i++]) : -1;
      const std::optional<std::vector<std::u16string>> r =
          lfw::ui::read_func_args(text, name, min);
      if (!r.has_value()) {
        push("funcargs|null");
      } else {
        std::string args;
        for (size_t k = 0; k < r->size(); ++k) {
          if (k != 0) args += ",";
          args += to_ascii((*r)[k]);
        }
        push("funcargs|" + args);
      }
    } else if (op == "cross" || op == "crossmix") {
      lfw::ui::CrossInfo a;
      a.left = to_double(t[i++]);
      a.top = to_double(t[i++]);
      a.right = to_double(t[i++]);
      a.bottom = to_double(t[i++]);
      a.mid_x = to_double(t[i++]);
      a.mid_y = to_double(t[i++]);
      lfw::Object o;
      o.set(u"left", lfw::Value(a.left));
      o.set(u"top", lfw::Value(a.top));
      o.set(u"right", lfw::Value(a.right));
      if (op == "cross") {
        o.set(u"bottom", lfw::Value(a.bottom));
        o.set(u"mid_x", lfw::Value(a.mid_x));
        o.set(u"mid_y", lfw::Value(a.mid_y));
      } else {
        o.set(u"bottom", lfw::Value(std::u16string(u"9")));
        o.set(u"mid_y", lfw::Value(lfw::NullTag{}));
      }
      const lfw::ui::CrossInfo b = lfw::ui::CrossInfo::make(lfw::Value(std::make_shared<lfw::Object>(o)));
      const lfw::ui::CrossInfo c = b.clone();
      push("cross|" + dump_rgba(lfw::ui::Rgba{b.left, b.top, b.right, b.bottom}) + "|" +
           num(b.mid_x) + "," + num(b.mid_y) + "|cmp=" + (a.compare(b) ? "1" : "0") +
           "|clone=" + num(c.left) + "," + num(c.top) + "," + num(c.right) + "," +
           num(c.bottom) + "," + num(c.mid_x) + "," + num(c.mid_y));
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
