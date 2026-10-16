#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Ball/Ball.ts`：15 个「弹丸」用例。名字里的 `3000/3005/3006` 是 `defines/StateEnum.ts`
// 里的弹丸状态号：`3000` 一侧用 Davis（触发键 `Defend`+`Right`+`Attack`），`3005`/`3006` 一侧用
// Henry（分别是 `Defend`+`Right`+`Attack` 与 `Defend`+`Right`+`Jump`）；对手是另一种弹丸、
// JohnShield、ManyPunch、BurnRun。
//
// 15 个用例的形状完全一样：两人横排在中场、间距 450、各占一队、蓝量拉满 99999（不然放不出招）、
// 不显示血条、1 号朝左；之后按 TS 的时刻表点键对拼 —— `Ball_3000_vs_Ball_3000/3005/3006`
// 三个用例多一段 `repeat`（每 10ms 补一次 `Attack`）。
class Ball_3000_vs_Ball_3000 : public TestCase {
 public:
  explicit Ball_3000_vs_Ball_3000(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3000_vs_Ball_3005 : public TestCase {
 public:
  explicit Ball_3000_vs_Ball_3005(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3000_vs_Ball_3006 : public TestCase {
 public:
  explicit Ball_3000_vs_Ball_3006(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3005_vs_Ball_3005 : public TestCase {
 public:
  explicit Ball_3005_vs_Ball_3005(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3005_vs_Ball_3006 : public TestCase {
 public:
  explicit Ball_3005_vs_Ball_3006(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3006_vs_Ball_3006 : public TestCase {
 public:
  explicit Ball_3006_vs_Ball_3006(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3000_vs_JohnShield : public TestCase {
 public:
  explicit Ball_3000_vs_JohnShield(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3005_vs_JohnShield : public TestCase {
 public:
  explicit Ball_3005_vs_JohnShield(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3006_vs_JohnShield : public TestCase {
 public:
  explicit Ball_3006_vs_JohnShield(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3000_vs_ManyPunch : public TestCase {
 public:
  explicit Ball_3000_vs_ManyPunch(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3005_vs_ManyPunch : public TestCase {
 public:
  explicit Ball_3005_vs_ManyPunch(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3006_vs_ManyPunch : public TestCase {
 public:
  explicit Ball_3006_vs_ManyPunch(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3000_vs_BurnRun : public TestCase {
 public:
  explicit Ball_3000_vs_BurnRun(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3005_vs_BurnRun : public TestCase {
 public:
  explicit Ball_3005_vs_BurnRun(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Ball_3006_vs_BurnRun : public TestCase {
 public:
  explicit Ball_3006_vs_BurnRun(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
