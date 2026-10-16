#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Bot/WeaponPicking2.ts`：**战士先生成** —— 12 个 Jack（2 队）先摆一圈，武器后摆
// 同一圈，与 1 号的唯一差别就是生成顺序（以及队伍号）。时刻表与 1 号完全一样。
class WeaponPicking2 : public TestCase {
 public:
  explicit WeaponPicking2(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
