#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Weapons/Dropping.ts`：被击落的武器（石头）砸到人时该不该受伤。
//   * `Dropping_1`：石头被击落砸到 C —— 不应受伤。
//   * `Dropping_2`：C 把落地的石头捡起来再投掷 —— 仍然要伤人。
// TS 的 `Dropping_Base` 只被这两个用例继承 ⇒ 端口照搬成同文件里的基类。
class DroppingBase : public TestCase {
 public:
  explicit DroppingBase(Tests& owner);

  void enter() override;

 protected:
  void setup();
  void a_pick_up();
  void b_attack();
  void place_c_under_weapon();
  void c_pick_up_weapon();
  void c_throw_at_a();
  void place_a_at_throw_spot();

  Entity* a = nullptr;
  Entity* b = nullptr;
  Entity* c = nullptr;
  Entity* stone = nullptr;
};

class Dropping_1 : public DroppingBase {
 public:
  explicit Dropping_1(Tests& owner);

  ActionDirector& director() override { return _director; }

 private:
  ActionDirector _director;
};

class Dropping_2 : public DroppingBase {
 public:
  explicit Dropping_2(Tests& owner);

  ActionDirector& director() override { return _director; }

 private:
  ActionDirector _director;
};

}
}
