#pragma once

#include <map>
#include <optional>
#include <string>

#include "lfw/core/value.h"

namespace lfw {
namespace utils {

// TS `TEvalContext`（`src/LFW/utils/eval_number.ts`）：表达式里能引用的具名量。
using EvalContext = std::map<std::u16string, double>;

// TS `eval_number(value: TNumberExpr | null | undefined, ctx: TEvalContext)`：
//   nullish ⇒ 0；number ⇒ 原值；string ⇒ 先 `trim()`，空串 ⇒ 0，否则按
//     expr   := term (('+'|'-') term)*
//     term   := factor (('*'|'/') factor)*
//     factor := ('+'|'-') factor | '(' expr ')' | `\d+(\.\d+)?` | `[A-Za-z_]\w*`
//   解析（token 之间只吃空格/制表符）。
//
// 写错（名字不在 `ctx`、括号不配、收尾还剩字符）时 TS 那边 `throw new Error`；
// `native/lfw` 里没有异常（lint: "lfw has no exceptions"）⇒ 这里返 `std::nullopt`，
// 调用方自己决定报警还是忽略（**别**把它当 0 用，那是静默错）。
std::optional<double> eval_number(const Value& value, const EvalContext& ctx);

}
}
