#pragma once

#include <string>
#include <vector>

#include "lfw/core/value.h"

namespace lfw {
namespace loader {

// Mirrors `src/LFW/loader/normalize_directors.ts`（4CJ）：
//   `to_director_list(raw)` —— 导演数据的三种写法（数组 / `{directors:[…]}` / 单个对象）
//     统一成数组，并只留"有 `name` 字符串"的那些；
//   `make_director_group(index, raw, file?)` —— 索引 + 数据 ⇒ `IDirectorGroupData`
//     （`name` 取索引的 `name`，没有再取数据的 `name`，都没有就不写这个键）。
std::vector<Value> to_director_list(const Value& raw);
Value make_director_group(const Value& index, const Value& raw,
                          const std::u16string& file);

}
}
