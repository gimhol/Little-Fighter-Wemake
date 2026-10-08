#pragma once

#include <string>

#include "lfw/core/value.h"

namespace lfw::ui {

// TS `ui/read_info_value.ts`。`ICookedUIInfo` 也用 `Value` 对象表示（字段名同 TS：
// `values` / `template_values` / `parent`）。
//
// TS 的 judger 是 `{_$_judger:true, run}` 对象（函数塞不进 `Value`）⇒ 端口用枚举；
// `Cls`/构造函数这一类 `type` 需要对象→类的映射，端口暂不支持（返回 null，记偏差）。

// `unsafe_is_object` / `unsafe_is_array` / `is_0_or_1` 的端口。
enum class UIJudger {
  None,
  Is0Or1,
  UnsafeIsObject,
  UnsafeIsArray,
};

struct UIValueType {
  enum class Kind {
    Null,     // `type` 是 null（或其它非字符串/非 judger/非类）⇒ 原样返回
    Boolean,
    Number,
    String,
    Judger,
    Clazz,  // 端口不支持
  };
  Kind kind = Kind::Null;
  UIJudger judger = UIJudger::None;
};

bool judger_run(UIJudger judger, const Value& v);

// `find_ui_value(ui, name)`：先沿 `values` 链、再沿 `template_values` 链找**非 nullish** 的值；
// 找不到返回 `null`（`NullTag`）。
Value find_ui_value(const Value& ui, const std::u16string& name);

// `parse_ui_value(ui, type, value)`。`out_null=true` ⇒ TS 返回 `null`；
// 返回 false + `error` ⇒ TS 抛 `{ui, error}`（`error` 是 `err.message` 的文本）。
bool parse_ui_value(const Value& ui, const UIValueType& type, const Value& value, Value& out,
                    bool& out_null, std::u16string& error);

}
