#pragma once
#include <cmath>
#include <cstdlib>
#include <optional>
#include <string>
#include <type_traits>
#include "lfw/utils/type_check.h"

// 对应 TS: src/LFW/utils/type_cast/to_num.ts
// TS: to_num(v, or) —— Number(v)，合法有限数字则返回，否则返回 or（未提供时 undefined）。
// C++ 侧对字符串做「全串解析」并尽量贴合 JS Number() 语义：
//   - 空串/纯空白 → 0（JS: Number("") === 0）
//   - 支持 0x 十六进制整数、小数、科学计数法
//   - 部分解析（如 "12abc"）视为非法 → 返回 or / nullopt
//   - Infinity / NaN 视为非法（is_num 要求有限）
namespace lfw::type_cast {

namespace detail {
inline std::string trim(const std::string& s) {
    const auto is_space = [](char c) {
        return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v';
    };
    size_t b = 0, e = s.size();
    while (b < e && is_space(s[b])) ++b;
    while (e > b && is_space(s[e - 1])) --e;
    return s.substr(b, e - b);
}
} // namespace detail

inline std::optional<double> to_num(const std::string& v) {
    const std::string t = detail::trim(v);
    if (t.empty()) return 0.0;   // JS: Number("") === 0

    // JS: 支持 0x 前缀十六进制整数
    if (t.size() > 2 && t[0] == '0' && (t[1] == 'x' || t[1] == 'X')) {
        char* end = nullptr;
        const double h = static_cast<double>(std::strtoll(t.c_str() + 2, &end, 16));
        if (end == t.c_str() + t.size() && std::isfinite(h)) return h;
        return std::nullopt;
    }

    char* end = nullptr;
    const double n = std::strtod(t.c_str(), &end);
    if (end == t.c_str() + t.size() && std::isfinite(n)) return n;
    return std::nullopt;
}

inline double to_num(const std::string& v, double or_) {
    const auto n = to_num(v);
    return n ? *n : or_;
}

// 数字类型：合法有限则返回自身，否则返回 or
template <typename T, std::enable_if_t<std::is_arithmetic_v<T>, int> = 0>
inline double to_num(T v, double or_) {
    return lfw::type_check::is_num(v) ? static_cast<double>(v) : or_;
}

} // namespace lfw::type_cast
