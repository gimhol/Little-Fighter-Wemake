#pragma once

#include <string>

#include "lfw/core/value.h"

namespace lfw {

class LFW;

namespace ui {

// TS `ui/cook_ui_info.ts` 的前两件（`cook_ui_info` 本体随 UI 节点族补）。
//
// `find_ui_template(lfw, parent, template_name)`：先沿 `parent` 链找 `templates[name]`
// （真值才算命中，假值继续走）；再按 `['.ui.json5', '.ui.json', '.ui.xml']` 次序试
// `resources.import_*`（显式带扩展名时该路径排最前，后续候选去重），`Object.keys` 非空才
// 算命中。找不到 ⇒ `Ditto.warn` + 输出 `{}`。
//
// 端口差异：TS 的 `ImportError.is(e)` 分「import 失败（吞）」与「其它异常（重抛）」；端口
// 无异常 ⇒ `resources.import_*` 的失败一律当 import 失败跳过。`template_name` 非字符串时
// TS 会抛（`startsWith`），端口按 `找不到` 处理。
void find_ui_template(LFW& lfw, const Value* parent, const std::u16string& template_name,
                      Value& out);

// `merge_ui_template`：`raw_info.template` 为假值 ⇒ **原样返回**；否则与模板信息合并：
// `{...template_info, ...remain, template, component(拼接), values/template_values(浅并)}`；
// `lfw.dev_mode == true` 时两边的 `dev_component` 接在 `component` 尾部。
Value merge_ui_template(LFW& lfw, const Value& raw_info, const Value* parent);

}
}
