#include <cstdio>
#include "lfw/types.h"
#include "lfw/utils/Times.h"

int main() {
    std::printf("LFW-Core: C++ 移植核心库脚手架\n");

    lfw::Vec3 pos(10.f, 0.f, 2.f);
    pos.y = 5.f;
    std::printf("pos = (%g, %g, %g)\n", pos.x, pos.y, pos.z);

    lfw::Times t(0.f, 100.f);
    t.add(30.f);
    std::printf("times.value = %g\n", t.value());
    return 0;
}
