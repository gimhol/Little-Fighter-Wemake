#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Others/MoveStayCome.ts`：四个 `Template`（真人控制器）横排在中场，每 50ms 一步
// 地按四个组合：全体 `Defend`（MOVE/STAY 的起手）→ 0..3 号各按 `Defend`/`Jump`/`Attack`/`Jump`
// → `Defend`/`Defend`/`Defend`/`Jump` → 再回到第一组 —— 即
// MOVE(DADA) / STAY(DDDD) / COME(DJDJ) / FOLLOW(DJJJ) 四种指挥的对照。
class MoveStayCome : public TestCase {
 public:
  explicit MoveStayCome(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  std::vector<Entity*> figters;
};

}
}
