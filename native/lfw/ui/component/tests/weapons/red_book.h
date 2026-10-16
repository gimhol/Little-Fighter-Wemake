#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Weapons/RedBook.ts`：红书（`book_red`）的 GroupAttack —— 上下两排 Davis 各带 3 个
// bandit，先单体攻击、再双击右、再跳两下并出招，看红书会不会带出全屏群攻。
class RedBook_GroupAttack : public TestCase {
 public:
  explicit RedBook_GroupAttack(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 protected:
  Entity* place_davis(double x, double z);
  Entity* place_bandit(double x, double z);
  Entity* place_weapon(const std::u16string& oid, double x, double z);

 private:
  ActionDirector _director;
  Entity* davis_top = nullptr;
  Entity* davis_bottom = nullptr;
  std::vector<Entity*> bandits_top;
  std::vector<Entity*> bandits_bottom;
  Entity* book = nullptr;
};

}
}
