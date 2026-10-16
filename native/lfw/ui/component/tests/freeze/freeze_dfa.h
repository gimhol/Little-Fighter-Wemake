#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Freeze/Freeze_DFA.ts`：与 `Firen_DFA` 同形，招式换成 Freeze 的「防御+右+攻
// 击」三段连击。
class Freeze_DFA : public TestCase {
 public:
  explicit Freeze_DFA(Tests& owner);

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
