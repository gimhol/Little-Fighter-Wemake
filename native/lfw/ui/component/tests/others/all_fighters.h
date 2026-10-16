#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Others/AllFighters.ts`：把全部战士排成两排，之后每 2 秒轮换一次队伍。
class AllFighters : public TestCase {
 public:
  explicit AllFighters(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
