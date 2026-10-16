#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Bg/Moon.ts`：月亮背景（`bg_moon`）里三种跳法 —— 普通跳 / 跳+防御 / 小跳。
class MoonTest : public TestCase {
 public:
  explicit MoonTest(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  Entity* louis1 = nullptr;
  Entity* louis2 = nullptr;
  Entity* louis3 = nullptr;
};

}
}
