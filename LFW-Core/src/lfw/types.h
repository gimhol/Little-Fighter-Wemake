#pragma once

namespace lfw {

// 对应 TS: Ditto.vec3() / Ditto.vec2() 生成的值类型。
// TS 里是“注入的类 + new”，C++ 侧改为 POD 值类型，免堆分配、利于缓存。
struct Vec3 {
    float x = 0.f, y = 0.f, z = 0.f;

    constexpr Vec3() = default;
    constexpr Vec3(float x_, float y_, float z_) : x(x_), y(y_), z(z_) {}

    constexpr Vec3& set(float x_, float y_, float z_) { x = x_; y = y_; z = z_; return *this; }
    constexpr Vec3& copy(const Vec3& o) { x = o.x; y = o.y; z = o.z; return *this; }
    constexpr Vec3 clone() const { return *this; }
};

struct Vec2 {
    float x = 0.f, y = 0.f;

    constexpr Vec2() = default;
    constexpr Vec2(float x_, float y_) : x(x_), y(y_) {}
};

} // namespace lfw
