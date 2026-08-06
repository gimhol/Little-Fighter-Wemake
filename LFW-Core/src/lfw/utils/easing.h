#pragma once
#include "lfw/utils/math.h"

// 对应 TS: src/LFW/utils/easing/（IEasing / ease_linearity / ease_in_out_sine /
//          ease_in_out_quint）
// TS 中缓动函数是「带 .backward 属性的可调用对象」；C++ 侧拆分为 forward/backward
// 两个自由函数，命名上以 _backward 后缀区分，公式逐字保持与 TS 一致。
namespace lfw::easing {

// ---- ease_linearity.ts --------------------------------------------------
inline double ease_linearity(double factor, double from = 0.0, double to = 1.0) {
    return from + (to - from) * factor;
}
inline double ease_linearity_backward(double v, double from = 0.0, double to = 1.0) {
    return (v - from) / (to - from);
}

// ---- ease_in_out_sine.ts ------------------------------------------------
inline double ease_in_out_sine(double factor, double from = 0.0, double to = 1.0) {
    return from - ((to - from) * (math::cos(math::PI * factor) - 1.0)) / 2.0;
}
inline double ease_in_out_sine_backward(double v, double from = 0.0, double to = 1.0) {
    const double _min = math::min(from, to);
    const double _max = math::max(from, to);
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    return math::acos((2.0 * (from - v)) / (to - from) + 1.0) / math::PI;
}

// ---- ease_in_out_quint.ts -----------------------------------------------
inline double ease_in_out_quint(double factor, double from = 0.0, double to = 1.0) {
    const double ratio =
        factor < 0.5
            ? 16.0 * math::pow(factor, 5.0)
            : 1.0 - math::pow(-2.0 * factor + 2.0, 5.0) / 2.0;
    return from + ratio * (to - from);
}
inline double ease_in_out_quint_backward(double v, double from = 0.0, double to = 1.0) {
    const double _min = math::min(from, to);
    const double _max = math::max(from, to);
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    const double ratio = (v - from) / (to - from);
    if (ratio < 0.5) {
        return math::pow(ratio / 16.0, 0.2);
    }
    return 1.0 - math::pow(2.0 * (1.0 - ratio), 0.2) / 2.0;
}

} // namespace lfw::easing
