#pragma once
#include <utility>
#include <vector>

// 对应 TS: src/LFW/utils/array/（make_arr）
namespace lfw::array {

// ---- make_arr.ts --------------------------------------------------------
// 生成一个数组：ret[i] = fn(i)，i ∈ [0, size)
template <typename Fn>
auto make_arr(int size, Fn fn) -> std::vector<decltype(fn(0))> {
    using T = decltype(fn(0));
    std::vector<T> ret;
    ret.reserve(size);
    for (int i = 0; i < size; ++i) ret.push_back(fn(i));
    return ret;
}

} // namespace lfw::array
