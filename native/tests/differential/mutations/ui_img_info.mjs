// `ui_img_info`（validate_ui_img_info）的变异档。
//
// 用例：`cases/ui_img_info/value.txt`（任一锁住即可）。
export default {
  subject: "ui_img_info",
  mutations: [
    {
      note: "tag 常量改了",
      file: "native/lfw/ui/validate_ui_img_info.h",
      from: `inline constexpr const char16_t* kValidateUIImgInfoTag = u"validate_ui_img_info";`,
      to: `inline constexpr const char16_t* kValidateUIImgInfoTag = u"validate_ui_img_info!";`,
    },
    {
      note: "把 warnings 并进 errors",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `    errors->insert(errors->end(), validator.errors().begin(), validator.errors().end());`,
      to: `    errors->insert(errors->end(), validator.warnings().begin(), validator.warnings().end());`,
    },
    {
      note: "把 errors 并进 warnings",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `    warnings->insert(warnings->end(), validator.warnings().begin(), validator.warnings().end());`,
      to: `    warnings->insert(warnings->end(), validator.errors().begin(), validator.errors().end());`,
    },
    {
      note: "errors 不再并出",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `  if (errors != nullptr) {
    errors->insert(errors->end(), validator.errors().begin(), validator.errors().end());
  }`,
      to: `  if (false && errors != nullptr) {
    errors->insert(errors->end(), validator.errors().begin(), validator.errors().end());
  }`,
    },
    {
      note: "warnings 不再并出",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `  if (warnings != nullptr) {
    warnings->insert(warnings->end(), validator.warnings().begin(), validator.warnings().end());
  }`,
      to: `  if (false && warnings != nullptr) {
    warnings->insert(warnings->end(), validator.warnings().begin(), validator.warnings().end());
  }`,
    },
    {
      note: "恒返回 true",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `  return result;`,
      to: `  return true;`,
    },
    {
      note: "返回值取反",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `  return result;`,
      to: `  return !result;`,
    },
    {
      note: "换错 schema 表（IStageInfo）",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `  const bool result = validator.validate(any, schema_iui_img_info());`,
      to: `  const bool result = validator.validate(any, schema_i_stage_info());`,
    },
    {
      note: "validate 实参换位（value/schema 反了）",
      file: "native/lfw/ui/validate_ui_img_info.cpp",
      from: `  const bool result = validator.validate(any, schema_iui_img_info());`,
      to: `  const bool result = validator.validate(schema_iui_img_info(), any);`,
    },
  ],
};
