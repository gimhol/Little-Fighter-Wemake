#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Julian/Julian_DUJ.ts`：Julian `D^J`（`GK.d` + `GK.U` + `GK.j`）+ 中圈 8 个强盗。
class Julian_DUJ : public TestCase {
 public:
  explicit Julian_DUJ(Tests& owner);

  void enter() override;
};

// TS 同文件的 `Henry_DUJ`：换 Henry 放箭，场上是 8 / 16 / 32 的三圈强盗。
class Henry_DUJ : public TestCase {
 public:
  explicit Henry_DUJ(Tests& owner);

  void enter() override;
};

}
}
