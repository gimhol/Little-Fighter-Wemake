#pragma once
#include "lfw/defines/IBounding.h"
#include "lfw/utils/math.h"

// 对应 TS: src/LFW/utils/cross_bounding.ts
// 求两个包围盒的交集（各轴取 [max(min), min(max)]）。
namespace lfw {

inline Bounding cross_bounding(const Bounding& r0, const Bounding& r1) {
    Bounding ret;
    ret.left   = math::max(r0.left,   r1.left);
    ret.right  = math::min(r0.right,  r1.right);
    ret.bottom = math::max(r0.bottom, r1.bottom);
    ret.top    = math::min(r0.top,    r1.top);
    ret.far    = math::max(r0.far,    r1.far);
    ret.near   = math::min(r0.near,   r1.near);
    return ret;
}

} // namespace lfw
