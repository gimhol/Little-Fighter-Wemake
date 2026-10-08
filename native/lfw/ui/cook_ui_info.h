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

// `cook_ui_info(lfw, info, parent)`：string ⇒ 先 `find_ui_template`；有 `template` ⇒ 先 merge；
// 随后 id/name 补全（`no_id_${++__new_id}` 进程级计数器）、component 归一 + 按 weight 降序、
// 字段逐项 `parse_ui_value`（类型不符 ⇒ false + `error`）、actions 归一、img 归一 +
// `ui_load_img`、i18n 走宿主 `measure_text`、size 三档回落与 img 宽高比换算、items 递归。
//
// 端口差异：TS 对 `cook_ui_info(null)` / 非对象 component 元素会抛（属性访问），端口按
// 「原样跳过」处理；`raw.items` 是非数组真值（字符串）时 TS 会按字符迭代，端口只告警不迭代。
bool cook_ui_info(LFW& lfw, const Value& info, const Value* parent, Value& out,
                  std::u16string& error);

}
}
