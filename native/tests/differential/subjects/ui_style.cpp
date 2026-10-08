// `ui_style`（Style / isClass）的 C++ 侧台面。
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/ui/style.h"
#include "lfw/utils/is_class.h"

#include "trace_util.h"

namespace {

using trace::key_of;
using trace::render_value;
using trace::split_ws;
using trace::strip_comment;
using trace::to_ascii;
using trace::to_double;
using trace::to_u16;

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

std::string num(double d) { return to_ascii(render_value(lfw::Value(d))); }

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

std::map<std::string, std::shared_ptr<lfw::Object>> g_objs;
std::map<std::string, lfw::ui::Style*> g_styles;
std::map<std::string, lfw::ui::Style*> g_style_of_obj;
std::vector<std::unique_ptr<lfw::ui::Style>> g_owned_styles;

// 类标签链：A ← B ← C（`none` = `nullptr`）。
lfw::ClazzTag g_cls_a;
lfw::ClazzTag g_cls_b{&g_cls_a};
lfw::ClazzTag g_cls_c{&g_cls_b};

const lfw::ClazzTag* cls_of(const std::string& name) {
  if (name == "a") return &g_cls_a;
  if (name == "b") return &g_cls_b;
  if (name == "c") return &g_cls_c;
  return nullptr;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_ui_style <case-file>\n");
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

    if (op == "obj") {
      g_objs[t[i++]] = std::make_shared<lfw::Object>();
    } else if (op == "oset") {
      const std::string oid = t[i++];
      const std::u16string field = key_of(t[i++]);
      lfw::Value v;
      if (!kind_to_value(t[i++], v)) {
        push("oset|bad");
        continue;
      }
      g_objs[oid]->set(field, v);
    } else if (op == "sf") {
      const std::string sid = t[i++];
      const std::string oid = t[i++];
      lfw::ui::Style& s = lfw::ui::Style::from(lfw::Value(g_objs[oid]));
      const bool eq = g_style_of_obj[oid] == &s;
      g_style_of_obj[oid] = &s;
      g_styles[sid] = &s;
      push("sf|eq=" + std::string(eq ? "1" : "0") + "|ver=" + num(s.version()));
    } else if (op == "sget") {
      lfw::ui::Style& s = *g_styles[t[i++]];
      const std::u16string field = key_of(t[i++]);
      lfw::Value v;
      if (field == u"padding_t") v = s.padding_t();
      else if (field == u"padding_b") v = s.padding_b();
      else if (field == u"shadow_blur") v = s.shadow_blur();
      else if (field == u"font") v = s.font();
      else if (field == u"smoothing") v = s.smoothing();
      else if (field == u"scale") v = s.scale();
      else if (field == u"fill_style") v = s.fill_style();
      else if (field == u"word_spacing") v = s.word_spacing();
      else v = lfw::Value(std::u16string(u"<unknown-field>"));
      push("sget|" + to_ascii(field) + "|" + sv(v));
    } else if (op == "sset") {
      lfw::ui::Style& s = *g_styles[t[i++]];
      const std::u16string field = key_of(t[i++]);
      lfw::Value v;
      if (!kind_to_value(t[i++], v)) {
        push("sset|bad");
        continue;
      }
      if (field == u"padding_t") s.set_padding_t(v);
      else if (field == u"shadow_blur") s.set_shadow_blur(v);
      else if (field == u"font") s.set_font(v);
      else if (field == u"smoothing") s.set_smoothing(v);
      else if (field == u"scale") s.set_scale(v);
      else s.touch();
    } else if (op == "sver") {
      lfw::ui::Style& s = *g_styles[t[i++]];
      push("sver|" + num(s.version()));
    } else if (op == "stouch") {
      g_styles[t[i++]]->touch();
      push("stouch");
    } else if (op == "sassign") {
      lfw::ui::Style& s = *g_styles[t[i++]];
      const std::string oid = t[i++];
      s.assign(lfw::Value(g_objs[oid]));
      push("sassign|ver=" + num(s.version()));
    } else if (op == "sdata") {
      lfw::ui::Style& s = *g_styles[t[i++]];
      const std::string oid = t[i++];
      s.set_data(lfw::Value(g_objs[oid]));
      push("sdata|ver=" + num(s.version()));
    } else if (op == "sdatastyle") {
      lfw::ui::Style& s = *g_styles[t[i++]];
      lfw::ui::Style& other = *g_styles[t[i++]];
      s.set_data(other);
      push("sdatastyle|ver=" + num(s.version()));
    } else if (op == "snew") {
      auto style = std::make_unique<lfw::ui::Style>();
      g_styles[t[i++]] = style.get();
      g_owned_styles.push_back(std::move(style));
    } else if (op == "iscls") {
      const std::string which = t[i++];
      const std::string target = t[i++];
      const bool r = lfw::is_class(cls_of(which), cls_of(target));
      push("iscls|" + which + "|" + target + "|" + (r ? "1" : "0"));
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
