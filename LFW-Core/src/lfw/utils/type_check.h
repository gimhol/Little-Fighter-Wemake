#pragma once
#include <cmath>
#include <string>
#include <type_traits>
#include <vector>

// 对应 TS: src/LFW/utils/type_check/（Unsafe / is_bool / is_str / is_num / is_arr …）
// TS 的 typeof 运行时判断 → C++ 侧映射为「值谓词」（对算术/字符串值的运行时检查），
// 以及少量编译期类型 trait（is_bool_v）。仅移植在游戏逻辑里有运行时意义的成员。
namespace lfw::type_check {

// ---- Unsafe.ts ----------------------------------------------------------
// TS: export type Unsafe<T> = void | undefined | null | T;
// C++ 侧无 null/undefined 概念，通常用 std::optional<T> 或 T* 表达，此处留作注释标记。

// ---- is_num.ts ----------------------------------------------------------
// TS: typeof v === "number" && !is_nan(v) && is_finite(v)
template <typename T>
inline bool is_num(T v) {
    return std::isfinite(static_cast<double>(v));
}
inline bool is_nan(double v)  { return std::isnan(v); }
inline bool is_finite(double v) { return std::isfinite(v); }

// TS: is_f_num —— 非有限数（NaN / ±Infinity）
template <typename T>
inline bool is_f_num(T v) {
    return !std::isfinite(static_cast<double>(v));
}

inline bool is_zero(double v) { return v == 0; }
inline bool is_one(double v)  { return v == 1; }

template <typename T>
inline bool is_nagtive(T v) { return is_num(v) && static_cast<double>(v) < 0; }
template <typename T>
inline bool is_positive(T v) { return is_num(v) && static_cast<double>(v) > 0; }

template <typename T>
inline bool not_zero_num(T v) { return is_num(v) && static_cast<double>(v) != 0; }

// TS: num_or(v, or) —— is_num(v) ? v : or
template <typename T, typename V>
inline auto num_or(T v, V or_) {
    return is_num(v) ? static_cast<double>(v) : or_;
}

// TS: is_int —— Number.isInteger
template <typename T>
inline bool is_int(T v) {
    if constexpr (std::is_integral_v<T>) {
        return true;
    } else {
        const double d = static_cast<double>(v);
        return std::floor(d) == d;
    }
}
template <typename T>
inline bool is_not_zero_int(T v)      { return is_int(v) && static_cast<double>(v) != 0; }
template <typename T>
inline bool is_positive_int(T v)      { return is_int(v) && static_cast<double>(v) > 0; }
template <typename T>
inline bool is_non_nagative_int(T v)  { return is_int(v) && static_cast<double>(v) >= 0; }
template <typename T>
inline bool is_non_positive_int(T v)  { return is_int(v) && static_cast<double>(v) <= 0; }
template <typename T>
inline bool is_nagative_int(T v)      { return is_int(v) && static_cast<double>(v) < 0; }

// TS: is_num_arr —— 数组且不含 NaN（空数组返回 true）
inline bool is_num_arr(const std::vector<double>& v) {
    for (double x : v)
        if (std::isnan(x)) return false;
    return true;
}

// ---- is_bool.ts ---------------------------------------------------------
// TS: is_bool / is_true / is_false —— C++ 类型系统已静态保证，映射为编译期 trait。
template <typename T>
inline constexpr bool is_bool_v = std::is_same_v<std::decay_t<T>, bool>;

// ---- is_str.ts ----------------------------------------------------------
// TS: is_str —— C++ 中 std::string 已是静态类型，仅保留有运行时语义的两个变体。
// TS: v && is_str(v)（非空字符串）
inline bool is_non_empty_str(const std::string& s) { return !s.empty(); }
// TS: is_str(v) && v.trim().length > 0
inline bool is_non_blank_str(const std::string& s) {
    return s.find_first_not_of(" \t\n\r\f\v") != std::string::npos;
}

// ---- is_arr.ts ----------------------------------------------------------
// TS: is_arr —— Array.isArray；C++ 中 vector 已是静态类型，无需运行时判断。

// ---- instance_of.ts -----------------------------------------------------
// TS: value instanceof type；C++ 用 dynamic_cast / std::is_base_of_v 表达，非运行时。

} // namespace lfw::type_check
