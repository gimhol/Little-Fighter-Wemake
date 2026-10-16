#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Others/ArmorTest1.ts`：前排 2 个 Julian（"靶子"，不显示名字）、后排 5 个 Julian，
// 前面一排战士每 3ms 点一次 `Attack` —— 看护甲值（`defend_value`）在第几击被打穿。
// 前后两排的名字分别标着 "2rd atk hit" / "3rd atk hit"。
class ArmorTest1 : public TestCase {
 public:
  explicit ArmorTest1(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
};

}
}
