#pragma once

#include "lfw/factory.h"
#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/register_class.h"

namespace lfw {
namespace ui {

// `class X extends UIComponent` 的构造器化身（TS `Factory.components` 里存的就是这个）。
template <typename T>
class ComponentCreatorT : public IComponentCreator {
 public:
  UIComponent* create(UINode& layout, const std::u16string& f_name,
                      const Value& info) const override {
    return new T(layout, f_name, info);
  }
};

// TS `ui/component/_.ts` 的 `regist_components()`：批一块注册一块（幂等）。
void regist_components();

}
}
