#include "lfw/utils/eval_number.h"

#include <charconv>
#include <string>
#include <variant>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/utils/utf8.h"

namespace lfw {
namespace utils {

namespace {

std::string bytes_of(const std::u16string& s) {
  const std::vector<uint8_t> bytes = encode_utf8(s);
  return std::string(bytes.begin(), bytes.end());
}

char16_t at(const std::u16string& s, size_t i) {
  return i < s.size() ? s[i] : u'\0';
}

bool is_digit(char16_t c) { return c >= u'0' && c <= u'9'; }

bool is_alpha(char16_t c) { return (c >= u'A' && c <= u'Z') || (c >= u'a' && c <= u'z'); }

bool is_name_start(char16_t c) { return is_alpha(c) || c == u'_'; }

bool is_name_char(char16_t c) { return is_name_start(c) || is_digit(c); }

// `String.prototype.trim`：首尾按 JS 的空白集（`is_str_white_space`）削掉。
std::u16string trim(const std::u16string& s) {
  size_t b = 0;
  size_t e = s.size();
  while (b < e && is_str_white_space(s[b])) ++b;
  while (e > b && is_str_white_space(s[e - 1])) --e;
  return s.substr(b, e - b);
}

// `src/LFW/utils/eval_number.ts` 的字面量小解析器（TS 那版是闭包 + 嵌套函数，
// 搬过来就是一个类 + 同名方法）。出错只置 `_ok = false`，不抛异常。
class Parser {
 public:
  Parser(const std::u16string& src, const EvalContext& ctx) : _src(src), _ctx(ctx) {}

  std::optional<double> run() {
    const double ret = parse_expr();
    if (!_ok) return std::nullopt;
    skip();
    if (_i != _src.size() || !_ok) return std::nullopt;
    return ret;
  }

 private:
  double fail() {
    _ok = false;
    return 0.0;
  }

  void skip() {
    while (_i < _src.size() && (_src[_i] == u' ' || _src[_i] == u'\t')) ++_i;
  }

  double parse_expr() {
    double v = parse_term();
    while (_ok) {
      skip();
      const char16_t c = at(_src, _i);
      if (c != u'+' && c != u'-') return v;
      ++_i;
      const double r = parse_term();
      if (!_ok) return v;
      v = c == u'+' ? v + r : v - r;
    }
    return v;
  }

  double parse_term() {
    double v = parse_factor();
    while (_ok) {
      skip();
      const char16_t c = at(_src, _i);
      if (c != u'*' && c != u'/') return v;
      ++_i;
      const double r = parse_factor();
      if (!_ok) return v;
      v = c == u'*' ? v * r : v / r;
    }
    return v;
  }

  double parse_factor() {
    skip();
    const char16_t c = at(_src, _i);
    if (c == u'+') {
      ++_i;
      return parse_factor();
    }
    if (c == u'-') {
      ++_i;
      return -parse_factor();
    }
    if (c == u'(') {
      ++_i;
      const double v = parse_expr();
      if (!_ok) return v;
      skip();
      if (at(_src, _i) != u')') return fail();
      ++_i;
      return v;
    }
    if (is_digit(c)) {
      const size_t start = _i;
      while (is_digit(at(_src, _i))) ++_i;
      if (at(_src, _i) == u'.' && is_digit(at(_src, _i + 1))) {
        ++_i;
        while (is_digit(at(_src, _i))) ++_i;
      }
      // `Number(字面量)`：走 `from_chars`（正确舍入、无异常），字面量只含 ASCII。
      const std::string text = bytes_of(_src.substr(start, _i - start));
      double out = 0;
      const auto res = std::from_chars(text.data(), text.data() + text.size(), out);
      if (res.ec != std::errc() || res.ptr != text.data() + text.size()) return fail();
      return out;
    }
    if (is_name_start(c)) {
      const size_t start = _i;
      while (is_name_char(at(_src, _i))) ++_i;
      const auto it = _ctx.find(_src.substr(start, _i - start));
      if (it == _ctx.end()) return fail();
      return it->second;
    }
    return fail();
  }

  const std::u16string& _src;
  const EvalContext& _ctx;
  size_t _i = 0;
  bool _ok = true;
};

}

std::optional<double> eval_number(const Value& value, const EvalContext& ctx) {
  if (const double* const d = std::get_if<double>(&value)) return *d;
  const std::u16string* const s = std::get_if<std::u16string>(&value);
  if (s == nullptr) return 0.0;
  const std::u16string src = trim(*s);
  if (src.empty()) return 0.0;
  Parser parser(src, ctx);
  return parser.run();
}

}
}
