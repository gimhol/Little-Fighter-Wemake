#pragma once

#include <optional>
#include <string>
#include <vector>

namespace lfw::ui {

// TS `ui/utils/parse_call_func_expression.ts`。
struct CallFuncExpression {
  std::u16string id;
  std::u16string name;
  std::vector<std::u16string> args;
  bool enabled = false;
};
std::optional<CallFuncExpression> parse_call_func_expression(const std::u16string& text);

// TS `ui/utils/read_func_args.ts`：`min_arg_count < 0` ⇒ 不限。
// 返回 `nullopt` ⇒ TS `null`。
std::optional<std::vector<std::u16string>> read_func_args(const std::u16string& str,
                                                          const std::u16string& func_name,
                                                          double min_arg_count = -1);

}
