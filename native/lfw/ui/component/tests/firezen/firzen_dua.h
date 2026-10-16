#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Firezen/Firzen_DUA.ts`（一个文件导出三个用例）：Firzen 站在中场放「下+上+攻击」。
// 这三个类都没有 `director`，节奏全在自己覆写的 `update` 里 —— 站立且蓝量够就重按一次三段，
// 出招途中只要当前帧带 `hit.a` 就补一刀。三个类只差场上摆的假人数量。
class Firzen_DUA_0 : public TestCase {
 public:
  explicit Firzen_DUA_0(Tests& owner);

  std::optional<Value> update(double dt) override;

  void enter() override;

 private:
  Entity* firzen = nullptr;
};

// TS `Firzen_DUA_1`：同上，外加一圈 Bandit（8 个，100 血）。
class Firzen_DUA_1 : public TestCase {
 public:
  explicit Firzen_DUA_1(Tests& owner);

  std::optional<Value> update(double dt) override;

  void enter() override;

 private:
  Entity* firzen = nullptr;
};

// TS `Firzen_DUA_2`：同上，假人换成一整圈（80 个）Bandit。
class Firzen_DUA_2 : public TestCase {
 public:
  explicit Firzen_DUA_2(Tests& owner);

  std::optional<Value> update(double dt) override;

  void enter() override;

 private:
  Entity* firzen = nullptr;
};

}
}
