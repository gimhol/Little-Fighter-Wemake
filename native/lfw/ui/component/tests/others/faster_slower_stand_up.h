#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Others/FasterSlowerStandUp.ts`：三个 Hunter 横排在中场，先全部松键（清掉输入），
// 再统一给一个下落初速 + 进入"倒地"帧；之后 0 号持续按住 `Attack`（A）、2 号持续按住 `Defend`
// （D）、1 号不动 —— 比谁爬起来快（按得越勤起得越快）。
class FasterSlowerStandUp : public TestCase {
 public:
  explicit FasterSlowerStandUp(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  std::vector<Entity*> figters;
};

}
}
