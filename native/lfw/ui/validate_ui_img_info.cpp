#include "lfw/ui/validate_ui_img_info.h"

#include "lfw/defines/schemas_gen.h"
#include "lfw/utils/schema/validate_schema.h"

namespace lfw::ui {

bool validate_ui_img_info(const Value& any, std::vector<std::u16string>* errors,
                          std::vector<std::u16string>* warnings) {
  schema::SchemaValidator validator;
  const bool result = validator.validate(any, schema_iui_img_info());
  if (errors != nullptr) {
    errors->insert(errors->end(), validator.errors().begin(), validator.errors().end());
  }
  if (warnings != nullptr) {
    warnings->insert(warnings->end(), validator.warnings().begin(), validator.warnings().end());
  }
  return result;
}

}
