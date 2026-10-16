#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Firen/Firen_DUJ.ts`：三个 Firen 横排，同时按「防御+上+跳」，之后左右两侧各
// 补一个方向键（左按下、右按上），对照三种出招落点。
class Firen_DUJ : public TestCase {
 public:
  explicit Firen_DUJ(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
