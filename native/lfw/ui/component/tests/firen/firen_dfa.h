#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Firen/Firen_DFA.ts`：三个 Firen 纵向排开，同时「防御+右+攻击」，随后 10 次
// 每 50ms 各补一次攻击（三段连击），脚下站一圈 Bandit。
class Firen_DFA : public TestCase {
 public:
  explicit Firen_DFA(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
