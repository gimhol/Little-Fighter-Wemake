#pragma once
#include <cmath>
#include <limits>
#include <optional>
#include <stdexcept>
#include <utility>
#include <vector>

// 对应 TS: src/LFW/utils/math/（base / clamp / clamp_add / float_equal / floor_float /
//          round_float / calc_plane / line_plane_intersection / normalize /
//          normalize_plane / probability / project_to_line / range）
// JS 数字为 float64，故本命名空间统一使用 double，与 TS 保持逐位一致的确定性；
// min/max 用模板以便同时服务 float 的游戏数据结构（如 Bounding）。
namespace lfw::math {

// ---- base.ts ------------------------------------------------------------
inline constexpr double PI = 3.14159265358979323846264338327950288;

inline double floor(double v) { return std::floor(v); }
inline double ceil(double v)  { return std::ceil(v); }
inline double abs(double v)   { return std::fabs(v); }
inline double round(double v) { return std::round(v); }
inline double sqrt(double v)  { return std::sqrt(v); }
inline double cos(double v)   { return std::cos(v); }
inline double sin(double v)   { return std::sin(v); }
inline double acos(double v)  { return std::acos(v); }
inline double pow(double b, double e) { return std::pow(b, e); }
inline double tan(double v)   { return std::tan(v); }
inline int    sign(double v)  { return (v > 0) - (v < 0); }   // 对应 Math.sign

template <typename T> inline T max(T a, T b) { return a > b ? a : b; }
template <typename T> inline T min(T a, T b) { return a < b ? a : b; }

inline bool between(double v, double lo, double hi) {
    return v >= lo && v <= hi;
}

// ---- round_float.ts -----------------------------------------------------
// 保留 multiplier 位小数（LF2 精度约定，默认 3 位）。0 / -0 原样返回。
inline double round_float(double n, double multiplier = 1000.0) {
    if (!n) return n;
    return round(n * multiplier) / multiplier;
}

// ---- floor_float.ts -----------------------------------------------------
inline double floor_float(double n, double multiplier = 1000.0) {
    return floor(n * multiplier) / multiplier;
}

// ---- clamp.ts -----------------------------------------------------------
inline double clamp(double value, double lo, double hi) {
    return value < lo ? lo : value > hi ? hi : value;
}

// ---- clamp_add.ts -------------------------------------------------------
inline double clamp_add(double value, double offset, double lo, double hi) {
    value = round_float(value + offset);
    return value < lo ? lo : value > hi ? hi : value;
}

// ---- float_equal.ts -----------------------------------------------------
inline bool float_equal(double x, double y) {
    return round_float(abs(x - y)) < 0.0001;
}

// ---- normalize.ts -------------------------------------------------------
// 返回 1 | -1 | 0（先按精度归整再判定符号）
inline int normalize(double n, double p = 1000.0) {
    n = floor_float(n, p);
    if (n > 0) return 1;
    if (n < 0) return -1;
    return 0;
}

// ---- range.ts -----------------------------------------------------------
// 等差数列。gap 为 0 或方向错误时抛异常（对应 TS 的 Error("[range] dead loop!")）。
inline std::vector<double> range(double from, double to, double gap = 1.0) {
    if (gap == 0 || (to - from) / gap < 0)
        throw std::runtime_error("[range] dead loop!");
    std::vector<double> ret;
    ret.push_back(from);
    for (int i = 1;; ++i) {
        const double v = from + i * gap;
        if (gap > 0 ? v > to : v < to) break;
        ret.push_back(v);
    }
    return ret;
}

// ---- probability.ts -----------------------------------------------------
// 单次触发概率：times 次内至少发生一次的概率为 probability。
inline double probability(double times, double p) {
    const double x = clamp(p, 0.0, 1.0);
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return 1 - pow(1 - x, 1.0 / times);
}

// ---- project_to_line.ts -------------------------------------------------
// 点 (x,y) 到过原点、方向向量 (m,n) 的直线的投影；方向向量为零向量时抛异常。
inline std::pair<double, double> project_to_line(double x, double y,
                                                 double m, double n) {
    const double d = round_float(m * m + n * n);
    if (d == 0) throw std::runtime_error("无效直线：方向向量不能为零向量");
    const double t = (x * m + y * n) / d;
    return { round_float(t * m), round_float(t * n) };
}

// ---- calc_plane.ts / normalize_plane.ts ---------------------------------
// 平面方程 ax + by + cz + d = 0
struct Plane {
    double a = 0, b = 0, c = 0, d = 0;
};

// 由三点求平面；三点共线/退化时返回 nullopt。
inline std::optional<Plane> calc_plane(
    double x1, double y1, double z1,
    double x2, double y2, double z2,
    double x3, double y3, double z3,
    double eps = std::numeric_limits<double>::epsilon()) {
    const double v1_x = x2 - x1, v1_y = y2 - y1, v1_z = z2 - z1;
    const double v2_x = x3 - x1, v2_y = y3 - y1, v2_z = z3 - z1;
    const double a = v1_y * v2_z - v1_z * v2_y;
    const double b = v1_z * v2_x - v1_x * v2_z;
    const double c = v1_x * v2_y - v1_y * v2_x;
    if (abs(a) < eps && abs(b) < eps && abs(c) < eps) return std::nullopt;
    Plane p;
    p.a = a; p.b = b; p.c = c;
    p.d = -a * x1 - b * y1 - c * z1;
    return p;
}

// 规范化平面：令首个非零分量（a 或 b 或 c）为正。
inline Plane normalize_plane(double a, double b, double c, double d) {
    if (a < 0 || (a == 0 && b < 0) || (a == 0 && b == 0 && c < 0)) {
        a = -a; b = -b; c = -c; d = -d;
    }
    return Plane{ a, b, c, d };
}

// ---- line_plane_intersection.ts -----------------------------------------
struct Vec3d {
    double x = 0, y = 0, z = 0;
};

// 直线（过点 P1，方向 v）与平面 ax+by+cz+d=0 的交点；无交点返回 nullopt。
// is_direction=true 时 v 直接取 (x2,y2,z2)；否则 v = (x2-x1, y2-y1, z2-z1)。
// is_segment=true 时交点须位于线段 [P1, P2] 内（t ∈ [0,1]）。
inline std::optional<Vec3d> line_plane_intersection(
    double a, double b, double c, double d,
    double x1, double y1, double z1,
    double x2, double y2, double z2,
    bool is_direction = false,
    bool is_segment = false,
    double eps = std::numeric_limits<double>::epsilon()) {
    double vx, vy, vz;
    if (is_direction) { vx = x2; vy = y2; vz = z2; }
    else { vx = x2 - x1; vy = y2 - y1; vz = z2 - z1; }

    const double denom = a * vx + b * vy + c * vz;
    if (abs(denom) < eps) return std::nullopt;   // 直线与平面平行/共面
    const double t = -(a * x1 + b * y1 + c * z1 + d) / denom;
    if (is_segment && (t < -eps || t > 1 + eps)) return std::nullopt;
    return Vec3d{ x1 + t * vx, y1 + t * vy, z1 + t * vz };
}

} // namespace lfw::math
