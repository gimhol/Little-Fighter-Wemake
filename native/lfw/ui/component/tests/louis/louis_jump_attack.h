#pragma once

#include <optional>

#include "lfw/core/value.h"
#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Louis/LOUIS_JUMP_ATTACK.ts`：两个路易（差 200px）各带一个面朝左的强盗，
// 按 FSM 的 `state_time` 每 5s 循环 —— 1.0s 处起跳（左普通跳 / 右小跳）+ 强盗防御，
// 1.2s 之后抬键。该用例**不**用 `ActionDirector`，整个脚本写在 `update` 里。
class LOUIS_JUMP_ATTACK : public TestCase {
 public:
  explicit LOUIS_JUMP_ATTACK(Tests& owner);

  std::optional<Value> update(double dt) override;
  void enter() override;

 private:
  Entity* louis1 = nullptr;
  Entity* louis2 = nullptr;
  Entity* bandit1 = nullptr;
  Entity* bandit2 = nullptr;
};

}
}
