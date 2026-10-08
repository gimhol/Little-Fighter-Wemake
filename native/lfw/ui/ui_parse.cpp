#include "lfw/ui/ui_parse.h"

namespace lfw::ui {

namespace {

std::u16string js_trim(const std::u16string& s) {
  size_t b = 0;
  size_t e = s.size();
  const auto is_ws = [](char16_t c) {
    return c == u' ' || c == u'\t' || c == u'\n' || c == u'\r' || c == u'\f' || c == u'\v';
  };
  while (b < e && is_ws(s[b])) ++b;
  while (e > b && is_ws(s[e - 1])) --e;
  return s.substr(b, e - b);
}

}  // namespace

namespace {

// `(!?)(.*)\((.*)\)` 在 `p` 起的匹配：名字贪婪（尽量长的 `.*`）⇒ 取最右的 `(`，
// 参数贪婪 ⇒ 取全串最后一个 `)`。
bool match_rest(const std::u16string& text, size_t p, bool& enabled, std::u16string& name,
                std::u16string& args) {
  size_t pos = p;
  enabled = true;
  if (pos < text.size() && text[pos] == u'!') {
    enabled = false;
    ++pos;
  }
  const size_t close = text.rfind(u')');
  if (close == std::u16string::npos || close < pos) return false;
  size_t open = text.rfind(u'(', close == 0 ? 0 : close);
  while (open != std::u16string::npos && open >= pos) {
    if (open < close) {
      name = js_trim(text.substr(pos, open - pos));
      args = js_trim(text.substr(open + 1, close - open - 1));
      return true;
    }
    if (open == 0) break;
    open = text.rfind(u'(', open - 1);
  }
  return false;
}

CallFuncExpression build_expr(const std::u16string& id, bool enabled, const std::u16string& name,
                              const std::u16string& args) {
  CallFuncExpression ret;
  ret.id = js_trim(id);
  ret.name = name;
  ret.enabled = enabled;
  if (!args.empty()) {
    size_t b = 0;
    while (true) {
      const size_t comma = args.find(u',', b);
      const size_t end = comma == std::u16string::npos ? args.size() : comma;
      ret.args.push_back(js_trim(args.substr(b, end - b)));
      if (comma == std::u16string::npos) break;
      b = comma + 1;
    }
  }
  return ret;
}

}  // namespace

std::optional<CallFuncExpression> parse_call_func_expression(const std::u16string& text) {
  // `/(<.*>)?(!?)(.*)\((.*)\)/`：无锚点；每个起点先试「带 id」分支（`<.*>` 贪婪回溯），
  // 再试「不带」。匹配到了但 `name` 为空 ⇒ TS 直接 `return null`（不再往后找）。
  for (size_t start = 0; start <= text.size(); ++start) {
    if (start < text.size() && text[start] == u'<') {
      const size_t first_gt = text.find(u'>', start + 1);
      size_t gt = text.rfind(u'>');
      while (gt != std::u16string::npos && gt >= first_gt) {
        bool enabled = false;
        std::u16string name;
        std::u16string args;
        const bool matched =
            gt + 1 <= text.size() && match_rest(text, gt + 1, enabled, name, args);
        if (matched) {
          if (name.empty()) return std::nullopt;
          return build_expr(text.substr(start + 1, gt - start - 1), enabled, name, args);
        }
        if (gt == 0 || gt - 1 < first_gt) break;
        gt = text.rfind(u'>', gt - 1);
      }
    }
    bool enabled = false;
    std::u16string name;
    std::u16string args;
    if (match_rest(text, start, enabled, name, args)) {
      if (name.empty()) return std::nullopt;
      return build_expr(u"", enabled, name, args);
    }
  }
  return std::nullopt;
}

std::optional<std::vector<std::u16string>> read_func_args(const std::u16string& str,
                                                          const std::u16string& func_name,
                                                          double min_arg_count) {
  const std::u16string needle = func_name + u"(";
  const size_t start = str.find(needle);
  if (start == std::u16string::npos) return std::nullopt;
  const size_t last_close = str.rfind(u')');
  if (last_close == std::u16string::npos || last_close < start + needle.size()) {
    return std::nullopt;
  }
  const std::u16string args_str =
      str.substr(start + needle.size(), last_close - start - needle.size());
  std::vector<std::u16string> args;
  size_t b = 0;
  while (true) {
    const size_t comma = args_str.find(u',', b);
    const size_t end = comma == std::u16string::npos ? args_str.size() : comma;
    args.push_back(args_str.substr(b, end - b));
    if (comma == std::u16string::npos) break;
    b = comma + 1;
  }
  if (min_arg_count >= 0 && min_arg_count > static_cast<double>(args.size())) return std::nullopt;
  return args;
}

}
