#pragma once

#include "lfw/core/value.h"
#include "lfw/ditto/xml/i_xml_element.h"

namespace lfw::ui {

// TS `ui/xml_to_ui_info.ts`：XML 元素 → IUIInfo（`Value` 对象）。
//
// 键的**存在性**照抄 TS：直接赋值（如 `id`）即使值是 `undefined` 也建键；`!= null` 守卫的
// （如 `opacity`）缺省不建键；`if (x)` 真值守卫的（如 `args`）空串也不建键。
Value xml_to_ui_info(const IXMLElement& el);

}
