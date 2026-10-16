#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Bot/WeaponPicking1.ts`：**武器先生成** —— 12 把武器摆一圈，再把 12 个 Jack
// 摆到同一圈上，看谁先捡到。之后每 1.5 秒「点左、松左按右」「点右、松右按左」交替挪一步。
class WeaponPicking1 : public TestCase {
 public:
  explicit WeaponPicking1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
