#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Jan/Jan_DUA.ts`：Jan 原地 `D^A`（`GK.d` + `GK.U` + `GK.a`）。
class Jan_DUA_2 : public TestCase {
 public:
  explicit Jan_DUA_2(Tests& owner);

  void enter() override;
};

// TS 的 `Jan_DUA extends Jan_DUA_2`：在场外再围 8 个强盗（`Team_2`）。
class Jan_DUA : public Jan_DUA_2 {
 public:
  explicit Jan_DUA(Tests& owner);

  void enter() override;
};

}
}
