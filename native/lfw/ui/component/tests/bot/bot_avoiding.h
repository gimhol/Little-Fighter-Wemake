#pragma once

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// TS `Tests/Bot/BotAvoiding.ts`：两只 Bandit —— 0 号"躲"（独立一队、不闪不无敌），
// 1 号"追"（同在一队、永久闪烁 + 永久无敌）。两只的控制器都按各自 `data.id` 从工厂现造
// （Bandit ⇒ BotController），`player_id` 每次用 `lfw.new_id` 取一个新的。
//
// TS 那个类没有 `director` 覆写（沿用基类那份空表）⇒ 端口仍留一个空 director 成员，
// 只为了与其它用例形状一致。
class BotAvoiding : public TestCase {
 public:
  explicit BotAvoiding(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
