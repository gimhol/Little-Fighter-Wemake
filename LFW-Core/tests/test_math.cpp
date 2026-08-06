#include <cmath>
#include <cstdio>
#include <optional>
#include <stdexcept>
#include <vector>
#include "lfw/utils/math.h"

// 对应 TS: src/LFW/utils/math/ 的单元测试（与 TS 行为逐位/逐值对照）
static int g_failures = 0;

#define CHECK(cond)                                                          \
    do {                                                                     \
        if (!(cond)) {                                                       \
            std::printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);      \
            ++g_failures;                                                    \
        }                                                                    \
    } while (0)

#define CHECK_NEAR(a, b, eps)                                                \
    do {                                                                     \
        const double _a = (a), _b = (b);                                     \
        if (std::fabs(_a - _b) > (eps)) {                                    \
            std::printf("FAIL %s:%d  %s ≈ %s  (%g vs %g)\n", __FILE__,       \
                        __LINE__, #a, #b, _a, _b);                           \
            ++g_failures;                                                    \
        }                                                                    \
    } while (0)

int main() {
    using namespace lfw::math;

    // ---- base.ts ----
    CHECK(between(5.0, 0.0, 10.0));
    CHECK(between(0.0, 0.0, 10.0));
    CHECK(between(10.0, 0.0, 10.0));
    CHECK(!between(11.0, 0.0, 10.0));
    CHECK(!between(-1.0, 0.0, 10.0));
    CHECK(sign(3.5) == 1);
    CHECK(sign(-2.0) == -1);
    CHECK(sign(0.0) == 0);
    CHECK(max(1.0, 2.0) == 2.0);
    CHECK(min(1.0, 2.0) == 1.0);
    CHECK_NEAR(PI, 3.141592653589793, 1e-15);

    // ---- clamp.ts ----
    CHECK(clamp(5.0, 0.0, 10.0) == 5.0);
    CHECK(clamp(-1.0, 0.0, 10.0) == 0.0);
    CHECK(clamp(11.0, 0.0, 10.0) == 10.0);
    CHECK(clamp(5.0, 10.0, 0.0) == 10.0);   // min > max 时退化为 min 分支

    // ---- clamp_add.ts ----
    CHECK(clamp_add(5.0, 3.0, 0.0, 10.0) == 8.0);
    CHECK(clamp_add(9.0, 3.0, 0.0, 10.0) == 10.0);
    CHECK(clamp_add(0.0, -3.0, 0.0, 10.0) == 0.0);
    // 先 round_float 再钳制：1.2345 + 0.0005 → 1.235 → 未越界
    CHECK(clamp_add(1.2345, 0.0005, 0.0, 10.0) == 1.235);

    // ---- round_float.ts ----
    CHECK(round_float(1.23456) == 1.235);
    CHECK(round_float(1.2344) == 1.234);
    CHECK(round_float(123.4567, 10.0) == 123.5);   // multiplier=10
    CHECK(round_float(0.0) == 0.0);
    CHECK(std::signbit(round_float(-0.0)));        // 保留 -0
    CHECK(round_float(-1.23456) == -1.235);

    // ---- floor_float.ts ----
    CHECK(floor_float(1.23456) == 1.234);
    CHECK(floor_float(-1.23456) == -1.235);        // floor 向下取整
    CHECK(floor_float(123.4567, 10.0) == 123.4);

    // ---- float_equal.ts ----
    CHECK(float_equal(1.0, 1.0000005));
    CHECK(float_equal(1.2345678, 1.2345681));
    CHECK(!float_equal(1.0, 1.001));
    CHECK(float_equal(0.0, 0.0));

    // ---- normalize.ts ----
    CHECK(normalize(3.4) == 1);
    CHECK(normalize(-3.4) == -1);
    CHECK(normalize(0.0) == 0);
    CHECK(normalize(0.0004) == 0);       // 归整到 3 位小数后为 0
    CHECK(normalize(0.0006) == 0);       // floor(0.6)/1000 = 0
    CHECK(normalize(0.0011) == 1);       // floor(1.1)/1000 = 0.001 > 0
    CHECK(normalize(-0.0011) == -1);
    CHECK(normalize(1.23456, 100.0) == 1);

    // ---- range.ts ----
    {
        const auto r = range(0.0, 5.0);
        CHECK((r == std::vector<double>{0, 1, 2, 3, 4, 5}));
    }
    {
        const auto r = range(5.0, 0.0, -1.0);
        CHECK((r == std::vector<double>{5, 4, 3, 2, 1, 0}));
    }
    {
        // 浮点步长：逐元素容差比较（避免 0.3*3 != 0.9 这类表示误差）
        const auto r = range(0.0, 1.0, 0.3);
        CHECK(r.size() == 4);
        CHECK_NEAR(r[0], 0.0, 1e-12);
        CHECK_NEAR(r[1], 0.3, 1e-12);
        CHECK_NEAR(r[2], 0.6, 1e-12);
        CHECK_NEAR(r[3], 0.9, 1e-12);
    }
    {
        const auto r = range(0.0, 2.0, 5.0);  // 起点即超终点 → 仅 [from]
        CHECK((r == std::vector<double>{0}));
    }
    bool threw = false;
    try { range(0.0, 5.0, 0.0); } catch (const std::runtime_error&) { threw = true; }
    CHECK(threw);
    threw = false;
    try { range(0.0, 5.0, -1.0); } catch (const std::runtime_error&) { threw = true; }
    CHECK(threw);

    // ---- probability.ts ----
    CHECK(probability(1.0, 1.0) == 1.0);
    CHECK(probability(1.0, 0.0) == 0.0);
    CHECK(probability(1.0, -5.0) == 0.0);   // 越界 → clamp 到 0
    CHECK(probability(1.0, 5.0) == 1.0);    // 越界 → clamp 到 1
    // 1 - (1-0.75)^(1/2) = 1 - 0.5 = 0.5
    CHECK_NEAR(probability(2.0, 0.75), 0.5, 1e-12);
    CHECK_NEAR(probability(3.0, 0.5), 1 - std::pow(0.5, 1.0 / 3.0), 1e-12);

    // ---- project_to_line.ts ----
    {
        const auto [px, py] = project_to_line(3.0, 4.0, 1.0, 0.0);
        CHECK(px == 3.0 && py == 0.0);
    }
    {
        const auto [px, py] = project_to_line(2.0, 2.0, 1.0, 1.0);
        CHECK(px == 2.0 && py == 2.0);
    }
    threw = false;
    try { project_to_line(1.0, 2.0, 0.0, 0.0); } catch (const std::runtime_error&) { threw = true; }
    CHECK(threw);

    // ---- calc_plane.ts ----
    {
        // 三点构成 z=0 平面
        const auto p = calc_plane(0, 0, 0,  1, 0, 0,  0, 1, 0);
        CHECK(p.has_value());
        CHECK_NEAR(p->c, 1.0, 1e-12);
        CHECK_NEAR(p->d, 0.0, 1e-12);
    }
    {
        // 三点共线 → 退化 → nullopt
        const auto p = calc_plane(0, 0, 0,  1, 0, 0,  2, 0, 0);
        CHECK(!p.has_value());
    }
    {
        // 平移平面：z=1
        const auto p = calc_plane(0, 0, 1,  1, 0, 1,  0, 1, 1);
        CHECK(p.has_value());
        CHECK_NEAR(p->c, 1.0, 1e-12);
        CHECK_NEAR(p->d, -1.0, 1e-12);
    }

    // ---- normalize_plane.ts ----
    {
        const auto p = normalize_plane(-1, 2, 3, 4);
        CHECK(p.a == 1.0 && p.b == -2.0 && p.c == -3.0 && p.d == -4.0);
    }
    {
        const auto p = normalize_plane(0, -1, 2, 3);
        CHECK(p.a == 0.0 && p.b == 1.0 && p.c == -2.0 && p.d == -3.0);
    }
    {
        const auto p = normalize_plane(0, 0, -1, 2);
        CHECK(p.a == 0.0 && p.b == 0.0 && p.c == 1.0 && p.d == -2.0);
    }
    {
        const auto p = normalize_plane(1, -2, 3, 4);   // 已规范
        CHECK(p.a == 1.0 && p.b == -2.0 && p.c == 3.0 && p.d == 4.0);
    }

    // ---- line_plane_intersection.ts ----
    {
        // 平面 z=0，直线 (0,0,1) → (0,0,-1)：交点 (0,0,0)
        const auto i = line_plane_intersection(0, 0, 1, 0,  0, 0, 1,  0, 0, -1);
        CHECK(i.has_value());
        CHECK_NEAR(i->x, 0.0, 1e-12);
        CHECK_NEAR(i->y, 0.0, 1e-12);
        CHECK_NEAR(i->z, 0.0, 1e-12);
    }
    {
        // 与平面平行（z 恒为 1）→ 无交点
        const auto i = line_plane_intersection(0, 0, 1, 0,  0, 0, 1,  1, 0, 1);
        CHECK(!i.has_value());
    }
    {
        // is_direction：方向直接取 (x2,y2,z2)
        const auto i = line_plane_intersection(0, 0, 1, 0,
                                               0, 0, 1,        // 起点
                                               0, 0, -1,       // 方向
                                               true, false);
        CHECK(i.has_value());
        CHECK_NEAR(i->z, 0.0, 1e-12);
    }
    {
        // is_segment：交点在线段内 → 有值
        const auto s = line_plane_intersection(0, 0, 1, 0,  0, 0, 10,  0, 0, -10,
                                               false, true);
        CHECK(s.has_value());
        CHECK_NEAR(s->z, 0.0, 1e-12);
        // 交点不在线段内（t=-1）→ 无值
        const auto s2 = line_plane_intersection(0, 0, 1, 0,  0, 0, 10,  0, 0, 20,
                                                false, true);
        CHECK(!s2.has_value());
    }

    if (g_failures == 0) { std::printf("test_math 通过\n"); return 0; }
    std::printf("%d 个断言失败\n", g_failures);
    return 1;
}
