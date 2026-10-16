#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Others/BottomsUp.ts`：8 + 8 个 Bandit 站两圈（半径 100 / 200），里外各摆一圈
// 啤酒与牛奶，之后每 1 秒全体点一次 `Attack` —— 看「喝倒」之后的倒地表现。
//
// TS 那个类的字段拼成了 `figters`（不是 `fighters`）⇒ 端口照样保留这个名字，免得和基类的
// `fighters`（TS 这里是空表）混淆。
class BottomsUp : public TestCase {
 public:
  explicit BottomsUp(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  std::vector<Entity*> figters;
};

}
}
