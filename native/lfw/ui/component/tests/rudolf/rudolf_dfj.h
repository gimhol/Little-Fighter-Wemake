#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Rudolf/Rudolf_DFJ.ts`：两个 Rudolf（`hori_2`）各自 `J` / `↑|↓` / `D` / `D>J` 的按键序列。
class Rudolf_DFJ : public TestCase {
 public:
  explicit Rudolf_DFJ(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
