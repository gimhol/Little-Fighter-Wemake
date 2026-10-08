#pragma once

#include <string>
#include <vector>

#include "lfw/core/value.h"

namespace lfw::ui {

// TS `ui/utils/validate_ui_img_info.ts`：新建一个 `SchemaValidator` 校验 `Schema_IUIImgInfo`
// （生成表见 `lfw/defines/schemas_gen.h`），把消息并进调用方的 `errors` / `warnings`
// —— 传 null 即 TS 的默认空数组（丢弃）。TAG 见常量。
inline constexpr const char16_t* kValidateUIImgInfoTag = u"validate_ui_img_info";

bool validate_ui_img_info(const Value& any, std::vector<std::u16string>* errors = nullptr,
                          std::vector<std::u16string>* warnings = nullptr);

}
