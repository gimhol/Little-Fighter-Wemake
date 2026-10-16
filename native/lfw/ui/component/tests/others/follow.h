#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Others/Follow.ts`（类名 `BotFollow`）：一个 Mark（真人控制器）先按
// `Defend`/`Jump`/`Jump`/`Jump`（FOLLOW = DJJJ）演示"跟着我"，然后按住右松左、按住左松右
// 走两个来回，中间各歇 6 秒；循环 10000 次。场上 8 个 Bandit 是 1 队 bot。
// 那个 Mark 的 `hp / hp_r / hp_max` 都被拉到 999999（免得被队友打死）。
class BotFollow : public TestCase {
 public:
  explicit BotFollow(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  std::vector<Entity*> figters;
};

}
}
