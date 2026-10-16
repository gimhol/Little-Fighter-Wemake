#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Bat/Bat_DUJ.ts`（一个文件导出四个用例）：Bat 的「下+上+跳」（`D^J`）在不同场上
// 条件下的表现。四个类的差异只在 `enter` 摆了什么，以及前两个 / 后两个的定时脚本。

// TS `Bat_DUJ_0`：1 血的 Bat + 一圈 Bandit，每 500ms 重按一次。
class Bat_DUJ_0 : public TestCase {
 public:
  explicit Bat_DUJ_0(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  Entity* bat = nullptr;
};

// TS `Bat_DUJ_1`：场上只有 Bat，进场只按一次 `D^J`（没有 director）。
class Bat_DUJ_1 : public TestCase {
 public:
  explicit Bat_DUJ_1(Tests& owner);

  void enter() override;
};

// TS `Bat_DUJ_2`：Bat + 两个 Bandit（`hori_2`），同样只按一次。
class Bat_DUJ_2 : public TestCase {
 public:
  explicit Bat_DUJ_2(Tests& owner);

  void enter() override;
};

// TS `Bat_DUJ_3`：Bat 开了无敌/闪烁，场上围 40 个 Bandit（各自换一个控制器），每 300ms 重按。
class Bat_DUJ_3 : public TestCase {
 public:
  explicit Bat_DUJ_3(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  Entity* bat = nullptr;
};

}
}
