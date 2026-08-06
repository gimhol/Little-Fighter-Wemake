#pragma once
#include <vector>

// 对应 TS: src/LFW/utils/ITimesSnapshot.ts
// 纯类型声明 → C++ struct（编译期无运行时开销）。
namespace lfw {

struct TimesSnapshot {
    std::vector<double> nums;
};

} // namespace lfw
