#pragma once

// 对应 TS: src/LFW/defines/IBounding.ts
// 包围盒（六面）。字段名与 TS 一一对应；数值用 float（与 types.h 的 Vec3 一致）。
namespace lfw {

struct Bounding {
    float left   = 0.f;
    float right  = 0.f;
    float top    = 0.f;
    float bottom = 0.f;
    float near   = 0.f;
    float far    = 0.f;

    constexpr Bounding() = default;
    constexpr Bounding(float left_, float right_, float top_,
                       float bottom_, float near_, float far_)
        : left(left_), right(right_), top(top_),
          bottom(bottom_), near(near_), far(far_) {}
};

} // namespace lfw
