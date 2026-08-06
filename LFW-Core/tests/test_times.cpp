#include <cstdio>
#include "lfw/utils/Times.h"

static int g_failures = 0;

#define CHECK(cond)                                                          \
    do {                                                                     \
        if (!(cond)) {                                                       \
            std::printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);      \
            ++g_failures;                                                    \
        }                                                                    \
    } while (0)

int main() {
    lfw::Times t(0.f, 100.f);
    CHECK(t.value() == 0.f);
    t.add(30.f);
    CHECK(t.value() == 30.f);

    // 回绕与生命语义（与 TS add() 完全一致）
    lfw::Times wrap(0.f, 3.f);
    wrap.set_lifes(3);
    CHECK(wrap.add(2.f) == false);
    CHECK(wrap.value() == 2.f);
    CHECK(wrap.add(1.f) == true);    // 恰好达到 max，不回绕
    CHECK(wrap.value() == 3.f);
    CHECK(wrap.remains() == 2.f);
    CHECK(wrap.add(1.f) == true);    // 4 > 3 → 回绕到 min
    CHECK(wrap.value() == 0.f);
    CHECK(wrap.remains() == 1.f);
    CHECK(wrap.add(1.f) == false);
    CHECK(wrap.value() == 1.f);

    if (g_failures == 0) { std::printf("所有测试通过\n"); return 0; }
    std::printf("%d 个断言失败\n", g_failures);
    return 1;
}
