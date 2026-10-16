#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Weapons/GreenBook.ts`：绿书（`book_green`）的 Electrify —— 上下两位 John 站在
// 上下两个 bandit 旁边读绿书，看雷电是否按书的正上方范围打中人。
class GreenBook_Electrify : public TestCase {
 public:
  explicit GreenBook_Electrify(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 protected:
  Entity* place_john(double x, double z);
  Entity* place_bandit(double x, double z);
  Entity* place_weapon(const std::u16string& oid, double x, double z);

 private:
  ActionDirector _director;
  Entity* john_top = nullptr;
  Entity* john_bottom = nullptr;
  Entity* bandit_top = nullptr;
  Entity* bandit_bottom = nullptr;
  Entity* book = nullptr;
};

}
}
