#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Freeze/Freeze_DFJ.ts`：Freeze 的「防御+右+跳」，500ms 一轮、最多 100 轮；
// 场上同时摆两圈 Bandit（中圈 8 个 + 大圈 8 个）。
class Freeze_DFJ : public TestCase {
 public:
  explicit Freeze_DFJ(Tests& owner);

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
