#include <cmath>
#include <cstdio>
#include <map>
#include <optional>
#include <string>
#include <vector>
#include "lfw/utils/ITimesSnapshot.h"
#include "lfw/utils/array.h"
#include "lfw/utils/container_help.h"
#include "lfw/utils/cross_bounding.h"
#include "lfw/utils/easing.h"
#include "lfw/utils/type_cast.h"
#include "lfw/utils/type_check.h"

// 对应 TS: src/LFW/utils/ 下难度 1 的其余纯函数/纯类型（type_check / type_cast /
//          easing / cross_bounding / array / container_help / ITimesSnapshot）
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
    // ---- type_check ----
    using namespace lfw::type_check;
    CHECK(is_num(3.5));
    CHECK(is_num(-0.0));
    CHECK(!is_num(std::nan("")));
    CHECK(!is_num(INFINITY));
    CHECK(is_nan(std::nan("")));
    CHECK(!is_nan(3.0));
    CHECK(is_finite(3.0));
    CHECK(!is_finite(INFINITY));
    CHECK(is_f_num(INFINITY));
    CHECK(!is_f_num(3.0));
    CHECK(is_zero(0.0));
    CHECK(!is_zero(1.0));
    CHECK(is_one(1.0));
    CHECK(is_nagtive(-1.0));
    CHECK(!is_nagtive(1.0));
    CHECK(is_positive(1.0));
    CHECK(!is_positive(0.0));
    CHECK(not_zero_num(2.0));
    CHECK(!not_zero_num(0.0));
    CHECK(num_or(3.5, 7.0) == 3.5);
    CHECK(num_or(std::nan(""), 7.0) == 7.0);
    CHECK(is_int(3));
    CHECK(is_int(3.0));
    CHECK(!is_int(3.5));
    CHECK(is_positive_int(3));
    CHECK(!is_positive_int(0));
    CHECK(is_non_nagative_int(0));
    CHECK(is_nagative_int(-1));
    CHECK(is_not_zero_int(3));
    CHECK(!is_not_zero_int(0));
    CHECK(is_num_arr(std::vector<double>{1, 2, 3}));
    CHECK(is_num_arr(std::vector<double>{}));                     // 空数组 → true
    CHECK(!is_num_arr(std::vector<double>{1, std::nan("")}));
    static_assert(is_bool_v<bool>);
    static_assert(!is_bool_v<int>);
    CHECK(!is_non_empty_str(""));
    CHECK(is_non_empty_str("a"));
    CHECK(!is_non_blank_str("   "));
    CHECK(!is_non_blank_str("\t\n"));
    CHECK(is_non_blank_str(" a "));

    // ---- type_cast ----
    using namespace lfw::type_cast;
    CHECK(to_num("12") == 12.0);
    CHECK(to_num("12.5") == 12.5);
    CHECK(to_num("-3.25") == -3.25);
    CHECK(to_num("") == 0.0);             // JS: Number("") === 0
    CHECK(to_num("  ") == 0.0);
    CHECK(to_num(" 12 ") == 12.0);        // 忽略首尾空白
    CHECK(to_num("1e3") == 1000.0);       // 科学计数法
    CHECK(to_num("0x1A") == 26.0);        // 十六进制
    CHECK(!to_num("abc").has_value());
    CHECK(!to_num("12abc").has_value());  // 部分解析 → 非法
    CHECK(!to_num("Infinity").has_value());
    CHECK(!to_num("NaN").has_value());
    CHECK(to_num("abc", 5.0) == 5.0);
    CHECK(to_num("12", 5.0) == 12.0);
    CHECK(to_num(3.5, 0.0) == 3.5);
    CHECK(to_num(std::nan(""), 0.0) == 0.0);
    CHECK(to_num(INFINITY, 1.0) == 1.0);

    // ---- easing ----
    using namespace lfw::easing;
    CHECK(ease_linearity(0.5) == 0.5);
    CHECK(ease_linearity(0.5, 10.0, 20.0) == 15.0);
    CHECK(ease_linearity_backward(15.0, 10.0, 20.0) == 0.5);
    CHECK(ease_in_out_sine(0.0) == 0.0);
    CHECK_NEAR(ease_in_out_sine(1.0), 1.0, 1e-12);
    CHECK_NEAR(ease_in_out_sine(0.5), 0.5, 1e-9);
    CHECK_NEAR(ease_in_out_sine_backward(0.5, 0.0, 1.0), 0.5, 1e-12);
    CHECK_NEAR(ease_in_out_sine_backward(0.0, 0.0, 1.0), 0.0, 1e-12);
    CHECK_NEAR(ease_in_out_sine_backward(1.0, 0.0, 1.0), 1.0, 1e-12);
    CHECK(ease_in_out_quint(0.0) == 0.0);
    CHECK(ease_in_out_quint(1.0) == 1.0);
    CHECK(ease_in_out_quint(0.5) == 0.5);   // 分段中点
    CHECK(ease_in_out_quint(0.25) < 0.25);  // 前半段更缓
    CHECK_NEAR(ease_in_out_quint_backward(0.5, 0.0, 1.0), 0.5, 1e-12);
    CHECK_NEAR(ease_in_out_quint_backward(ease_in_out_quint(0.3, 0.0, 1.0), 0.0, 1.0), 0.3, 1e-9);
    // 越界输入被钳制到 [from,to]
    CHECK_NEAR(ease_in_out_sine_backward(5.0, 0.0, 1.0), 1.0, 1e-12);

    // ---- cross_bounding ----
    {
        const lfw::Bounding r0(0.f, 10.f, 5.f, -5.f, 0.f, 100.f);
        const lfw::Bounding r1(2.f, 8.f, 3.f, -3.f, 0.f, 50.f);
        const auto r = lfw::cross_bounding(r0, r1);
        CHECK(r.left   == 2.f);
        CHECK(r.right  == 8.f);
        CHECK(r.top    == 3.f);
        CHECK(r.bottom == -3.f);
        CHECK(r.near   == 0.f);
        CHECK(r.far    == 100.f);
    }
    {
        // 不相交 → 得到"反向"包围盒（left > right），语义与 TS 一致
        const lfw::Bounding r0(0.f, 10.f, 5.f, -5.f, 0.f, 100.f);
        const lfw::Bounding r1(20.f, 30.f, 3.f, -3.f, 0.f, 50.f);
        const auto r = lfw::cross_bounding(r0, r1);
        CHECK(r.left == 20.f && r.right == 10.f);
    }

    // ---- array / make_arr ----
    {
        const auto r = lfw::array::make_arr(3, [](int i) { return i * 2; });
        CHECK((r == std::vector<int>{0, 2, 4}));
        const auto e = lfw::array::make_arr(0, [](int i) { return i; });
        CHECK(e.empty());
    }

    // ---- container_help ----
    {
        std::vector<int> v{1};
        const auto r = lfw::container_help::ensure(&v, 2);
        CHECK((r == std::vector<int>{1, 2}));
        CHECK((v == std::vector<int>{1, 2}));          // 原地追加
        const auto n = lfw::container_help::ensure<int>(nullptr, 1);
        CHECK((n == std::vector<int>{1}));
        const auto n2 = lfw::container_help::ensure<int>(nullptr, 1, 2, 3);
        CHECK((n2 == std::vector<int>{1, 2, 3}));
    }
    {
        const std::vector<int> src{1, 2, 3, 4, 5, 6};
        const auto even = lfw::container_help::filter(src, [](int x) { return x % 2 == 0; });
        CHECK((even == std::vector<int>{2, 4, 6}));
        const auto none = lfw::container_help::filter(src, [](int) { return false; });
        CHECK(none.empty());
    }
    {
        int a = 1, b = 2, c = 3;
        const std::vector<const int*> src{&a, nullptr, &b, nullptr, &c};
        const auto r = lfw::container_help::map_no_void(src, [](const int* p) { return p; });
        CHECK(r.size() == 3);
        CHECK(r[0] == &a && r[1] == &b && r[2] == &c);
    }
    {
        const std::map<std::string, int> m{{"a", 1}, {"b", 2}, {"c", 3}};
        const auto keys = lfw::container_help::get_keys(m);
        CHECK((keys == std::vector<std::string>{"a", "b", "c"}));
    }

    // ---- ITimesSnapshot ----
    {
        lfw::TimesSnapshot snap;
        CHECK(snap.nums.empty());
        snap.nums = {1.0, 2.5};
        CHECK(snap.nums.size() == 2);
    }

    if (g_failures == 0) { std::printf("test_utils 通过\n"); return 0; }
    std::printf("%d 个断言失败\n", g_failures);
    return 1;
}
