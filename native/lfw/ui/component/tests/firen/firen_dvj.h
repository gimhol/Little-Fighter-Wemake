#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Firen/Firen_DVJ.ts`：与 `Firen_DUJ` 同形，只是连招换成「防御+下+跳」。
class Firen_DVJ : public TestCase {
 public:
  explicit Firen_DVJ(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
