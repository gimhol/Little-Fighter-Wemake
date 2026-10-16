#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Others/Come.ts`（类名 `BotCome`）：两个 Mark（真人 `LocalController`）站中场，
// 0 号先按 `Defend`/`Jump`/`Defend`/`Jump`（COME = DJDJ）演示"叫队友过来"，歇 1.5 秒后
// 1 号重复同一串；循环 10000 次。场上一圈 8 个 Bandit 全是 1 队 bot，负责响应。
class BotCome : public TestCase {
 public:
  explicit BotCome(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  std::vector<Entity*> figters;
};

}
}
