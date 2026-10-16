#pragma once

#include <vector>

#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Freeze/Freeze_DVJ.ts`：Freeze 的「防御+下+跳」，500ms 一轮、1000 轮。
// TS 用的是成员数组 `freezes`（不是基类的 `entities`）⇒ 端口同样单开一个成员。
class Freeze_DVJ : public TestCase {
 public:
  explicit Freeze_DVJ(Tests& owner);

  ActionDirector& director() override { return _director; }

  void enter() override;

 private:
  ActionDirector _director;
  std::vector<Entity*> freezes;
};

}
}
