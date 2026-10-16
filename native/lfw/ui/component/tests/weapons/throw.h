#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Weapons/Throw.ts`：五种投掷类武器（小刀 / 棍 / 锄头 / 石头 / 棒球）的飞行与命中用例。
// 都是「一排战士（Mark / Deep / Davis / Jan）站在 `pixel_ruler` 背景上」——那个背景自带刻度，
// 当尺子看武器的落点；小刀 / 石头 / 棒球再配上「右移」或「连续攻击」的动作。
class Knife_1_1 : public TestCase {
 public:
  explicit Knife_1_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

// TS `Stick_1_1`：先攻击，再双击右（跑动），然后按住右 + 攻击。
class Stick_1_1 : public TestCase {
 public:
  explicit Stick_1_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

// TS `Hoe_1_1`：与 `Stick_1_1` 同形，武器换成锄头。
class Hoe_1_1 : public TestCase {
 public:
  explicit Hoe_1_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

// TS `Stone_1_1`：连按两次攻击（第二下是原地再扔）。
class Stone_1_1 : public TestCase {
 public:
  explicit Stone_1_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

// TS `Baseball_1_1`：与 `Knife_1_1` 同形，相机两站更远（棒球飞得更远）。
class Baseball_1_1 : public TestCase {
 public:
  explicit Baseball_1_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
