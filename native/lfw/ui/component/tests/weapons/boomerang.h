#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Weapons/Boomerang.ts`：回旋镖（`O_ID.Weapon_Boomerang`）的三族用例，`_1_*` / `_2_*` / `_3_*`
// 分别由 Knight / Jan / Davis 扔。族内第 1 个是父类（镖放在人身后一格，人站在 `far` 上），
// 第 2…6 个只补一个 `Team_2` 的 Bandit 当靶子（远 / 远右 / 近 / 近右 / 正中央）。
// 三族的 `director` 在 TS 里逐字相同 ⇒ 端口抽成 `boomerang.cpp` 的 `setup_director`。
class Boomerang_1_1 : public TestCase {
 public:
  explicit Boomerang_1_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

// TS `Boomerang_1_2 extends Boomerang_1_1`：远端正对的靶子。
class Boomerang_1_2 : public Boomerang_1_1 {
 public:
  explicit Boomerang_1_2(Tests& owner);

  void enter() override;
};

// TS `Boomerang_1_3 extends Boomerang_1_1`：远端右侧的靶子。
class Boomerang_1_3 : public Boomerang_1_1 {
 public:
  explicit Boomerang_1_3(Tests& owner);

  void enter() override;
};

// TS `Boomerang_1_4 extends Boomerang_1_1`：近端正对的靶子。
class Boomerang_1_4 : public Boomerang_1_1 {
 public:
  explicit Boomerang_1_4(Tests& owner);

  void enter() override;
};

// TS `Boomerang_1_5 extends Boomerang_1_1`：近端右侧的靶子。
class Boomerang_1_5 : public Boomerang_1_1 {
 public:
  explicit Boomerang_1_5(Tests& owner);

  void enter() override;
};

// TS `Boomerang_1_6 extends Boomerang_1_1`：正中央的靶子。
class Boomerang_1_6 : public Boomerang_1_1 {
 public:
  explicit Boomerang_1_6(Tests& owner);

  void enter() override;
};

// TS `Boomerang_2_1`：与 `Boomerang_1_1` 同形，扔镖的人换成 Jan。
class Boomerang_2_1 : public TestCase {
 public:
  explicit Boomerang_2_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Boomerang_2_2 : public Boomerang_2_1 {
 public:
  explicit Boomerang_2_2(Tests& owner);

  void enter() override;
};

class Boomerang_2_3 : public Boomerang_2_1 {
 public:
  explicit Boomerang_2_3(Tests& owner);

  void enter() override;
};

class Boomerang_2_4 : public Boomerang_2_1 {
 public:
  explicit Boomerang_2_4(Tests& owner);

  void enter() override;
};

class Boomerang_2_5 : public Boomerang_2_1 {
 public:
  explicit Boomerang_2_5(Tests& owner);

  void enter() override;
};

class Boomerang_2_6 : public Boomerang_2_1 {
 public:
  explicit Boomerang_2_6(Tests& owner);

  void enter() override;
};

// TS `Boomerang_3_1`：与 `Boomerang_1_1` 同形，扔镖的人换成 Davis。
class Boomerang_3_1 : public TestCase {
 public:
  explicit Boomerang_3_1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

class Boomerang_3_2 : public Boomerang_3_1 {
 public:
  explicit Boomerang_3_2(Tests& owner);

  void enter() override;
};

class Boomerang_3_3 : public Boomerang_3_1 {
 public:
  explicit Boomerang_3_3(Tests& owner);

  void enter() override;
};

class Boomerang_3_4 : public Boomerang_3_1 {
 public:
  explicit Boomerang_3_4(Tests& owner);

  void enter() override;
};

class Boomerang_3_5 : public Boomerang_3_1 {
 public:
  explicit Boomerang_3_5(Tests& owner);

  void enter() override;
};

class Boomerang_3_6 : public Boomerang_3_1 {
 public:
  explicit Boomerang_3_6(Tests& owner);

  void enter() override;
};

}
}
