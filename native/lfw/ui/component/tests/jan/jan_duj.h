#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Jan/Jan_DUJ.ts`：Jan 原地 `D^J`（`GK.d` + `GK.U` + `GK.j`），`hp = 1` 看直接打死。
class Jan_DUJ_2 : public TestCase {
 public:
  explicit Jan_DUJ_2(Tests& owner);

  void enter() override;
};

// TS 的 `Jan_DUJ extends Jan_DUJ_2`：再围 8 个同样是 `hp = 1` 的强盗（`Team_1`）。
class Jan_DUJ : public Jan_DUJ_2 {
 public:
  explicit Jan_DUJ(Tests& owner);

  void enter() override;
};

}
}
