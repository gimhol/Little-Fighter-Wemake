#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Firezen/Firzen_FUSION.ts`：Firen 与 Freeze 相隔 600 米对撞完成合体。
// 1 秒时两人互按「R / L 双击」（转身 → 变 Firzen 前的冲刺），6 秒时再各按一次三段。
class Firzen_FUSION : public TestCase {
 public:
  explicit Firzen_FUSION(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  Entity* firen = nullptr;
  // TS 里这个字段就叫 `freze`（原文拼写），照搬。
  Entity* freze = nullptr;
};

}
}
