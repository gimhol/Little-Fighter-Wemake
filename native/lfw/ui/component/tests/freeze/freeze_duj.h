#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Freeze/Freeze_DUJ.ts`：与 `Firen_DUJ` 同形，招式换成 Freeze 的「防御+上+跳」。
// TS 里把三个实体另存成 `freeze1/2/3`，端口照搬成成员。
class Freeze_DUJ : public TestCase {
 public:
  explicit Freeze_DUJ(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  Entity* freeze1 = nullptr;
  Entity* freeze2 = nullptr;
  Entity* freeze3 = nullptr;
};

}
}
