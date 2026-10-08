#pragma once

#include <cstddef>

#include "lfw/core/value.h"

namespace lfw::ui {

// UI 侧几个文件共用的 JS 值小工具（cook_ui_info / ui_load_img 等）。

// `{ ...src }` 的展开：对象按键的插入序、数组/字符串按数字下标（JS 的整数键排前），
// nullish 与其余原始值不落键。
void spread_into(Object& dst, const Value& src);

// `v?.key`：非对象 ⇒ `nullptr`。
const Value* field_of(const Value& v, const char16_t* key);

// `Object.keys(v).length` 的 JS 口径：对象/数组/字符串都算键数，其余 0。
size_t js_key_count(const Value& v);

}
