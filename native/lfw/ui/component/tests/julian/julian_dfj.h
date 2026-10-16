#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Julian/Julian_DFJ.ts`：Julian `D>J` 的六种变体（右/左 × 空/下/上），
// 每拍先 `key_up(...AGK)` 清键再点，末尾一拍只清键。
class Julian_DFJ : public TestCase {
 public:
  explicit Julian_DFJ(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  Entity* julian = nullptr;
};

}
}
