#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Julian/Julian_DFJ.ts` 旁边的 `Julian_DFA.ts`：起手 `D>A`，之后每 50ms 连点攻击 1000 次。
class Julian_DFA : public TestCase {
 public:
  explicit Julian_DFA(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  Entity* julian = nullptr;
};

}
}
