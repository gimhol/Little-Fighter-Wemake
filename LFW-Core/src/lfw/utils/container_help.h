#pragma once
#include <map>
#include <type_traits>
#include <utility>
#include <vector>

// 对应 TS: src/LFW/utils/container_help/（ensure / filter / map_no_void / get_keys）
// 泛型容器工具。TS 的动态数组/对象在 C++ 侧映射为 std::vector / std::map。
namespace lfw::container_help {

// ---- ensure.ts ----------------------------------------------------------
// 确保生成一个数组：已有 output 则原地追加 item(+items)，否则新建。
// TS: if (!output) return [item, ...items]; output.push(item, ...items); return output;
template <typename T, typename... Rest>
std::vector<T> ensure(std::vector<T>* output, T item, Rest... rest) {
    if (output) {
        output->push_back(std::move(item));
        (output->push_back(std::move(rest)), ...);
        return *output;
    }
    std::vector<T> ret;
    ret.push_back(std::move(item));
    (ret.push_back(std::move(rest)), ...);
    return ret;
}

// ---- filter.ts ----------------------------------------------------------
// 保留满足谓词的元素。
template <typename T, typename P>
std::vector<T> filter(const std::vector<T>& set, P p) {
    std::vector<T> ret;
    for (const auto& i : set)
        if (p(i)) ret.push_back(i);
    return ret;
}

// ---- map_no_void.ts -----------------------------------------------------
// 映射并过滤 null/undefined（TS: r !== null && r !== void 0）。
// C++ 侧对指针型结果过滤 nullptr；值类型结果全部保留。
template <typename T, typename P,
          typename R = std::invoke_result_t<P, const T&>>
std::vector<R> map_no_void(const std::vector<T>& iterable, P p) {
    std::vector<R> ret;
    for (const auto& item : iterable) {
        auto r = p(item);
        if constexpr (std::is_pointer_v<R>) {
            if (r) ret.push_back(r);
        } else {
            ret.push_back(r);
        }
    }
    return ret;
}

// ---- get_keys.ts --------------------------------------------------------
// 返回 map 的所有键（对应 Object.keys）。
template <typename K, typename V>
std::vector<K> get_keys(const std::map<K, V>& m) {
    std::vector<K> ret;
    ret.reserve(m.size());
    for (const auto& kv : m) ret.push_back(kv.first);
    return ret;
}

} // namespace lfw::container_help
