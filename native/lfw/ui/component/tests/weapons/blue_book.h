#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Weapons/BlueBook.ts`：蓝书（`book_blue`）的 MpHealing —— 上下两位 Dennis 读蓝书，
// 看 MP 回血范围（`D + R + a` 那条招式读的也是同一本书）。
class BlueBook_MpHealing : public TestCase {
 public:
  explicit BlueBook_MpHealing(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 protected:
  Entity* place_dennis(double x, double z);
  Entity* place_weapon(const std::u16string& oid, double x, double z);

 private:
  ActionDirector _director;
  Entity* dennis_top = nullptr;
  Entity* dennis_bottom = nullptr;
  Entity* book = nullptr;
};

}
}
