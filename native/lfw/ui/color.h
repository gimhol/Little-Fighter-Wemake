#pragma once

#include <optional>
#include <string>

#include "lfw/core/value.h"
#include "lfw/ui/rgba.h"

namespace lfw::ui {

// TS `ui/utils/hex_to_rgba.ts`：`hex` 是**去掉 `#`** 的串；长度 3/4 会先摊成 6/8。
// 无效长度 ⇒ `nullopt`（TS `null`）。
std::optional<Rgba> hex_to_rgba(const std::u16string& hex);

// TS `ui/utils/int_to_rgba.ts`：非整数或负数 ⇒ `nullopt`（TS `null`）。
std::optional<Rgba> int_to_rgba(double num);

// TS `RGBA_MAP`（`ui/utils/color_map.ts`）：`Map<string | number, IRGBA | null>`。
// 缓存里存过 `null` 的键（`found=true` + `is_null=true`）与「没存过」（`found=false`）不同。
struct RgbaLookup {
  bool found = false;
  bool is_null = false;
  Rgba value;
};
// `RGBA_MAP.get(key)`：字符串键与数字键分两张表（JS Map 的同值零区分）。
RgbaLookup rgba_map_get(const Value& key);

// TS `ui/utils/parse_rgba.ts`。返回值形状同 `RgbaLookup`（`found=false` ⇒ TS `null`）。
RgbaLookup parse_rgba(const Value& raw);

}
