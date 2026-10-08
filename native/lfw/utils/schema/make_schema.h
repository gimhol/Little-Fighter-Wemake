#pragma once

#include "lfw/core/value.h"

namespace lfw {
namespace schema {

// TS `utils/schema/make_schema.ts`：IPropsMeta → ISchema（端口为 `Value`）。
//
// 类类型在端口里是字符串标记（`$cls:<类名>`，同 `validate_schema.h`）：
// TS 的 `typeof prop === 'function'` 对应「字符串以 `$cls:` 开头」；`typeof items === 'function'`
// 同理。
//
// 端口差异：TS 在 `!parent && !meta.key` 时抛 `[make_schema] root scheme key not set!`；
// 端口返回 `undefined`（无异常）。TS 会**就地**给 `properties` 里的 meta 对象补 `key`；
// 端口不碰入参（写副本，行为等价）。
Value make_schema(const Value& meta, const Value* parent = nullptr);

}
}
