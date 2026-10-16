#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Firen/Firen_DFJ.ts`：只有一个 Firen（站在 x=0），「防御+右+跳」之后依次补
// 上 / 下 / 防御，观察同一招在不同后续输入下的表现；8 个 Bandit 均压到 75 血。
class Firen_DFJ : public TestCase {
 public:
  explicit Firen_DFJ(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
