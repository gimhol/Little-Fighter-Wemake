#pragma once

#include <optional>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/ui/component/tests/test_case.h"

namespace lfw {

class Entity;

namespace ui {

// TS `Tests/Others/CriminalSaving.ts`（类名 `CriminalSaving1`）：一排 6 个 Criminal 当"人质"，
// 前面一排 6 个战士轮流用各自的救人手段打它（Rudolf 用飞刀、Dennis 甩武器、Firen 的"球"、
// Davis 的拳头、Deep 的投掷、Henry 的箭）。`update` 里每帧把**所有 bot 控制器**换成
// `InvalidController`（让这几个人完全不自己行动，只看玩家的那三拍输入）。
class CriminalSaving1 : public TestCase {
 public:
  explicit CriminalSaving1(Tests& owner);

  ActionDirector& director() override { return _director; }

  std::optional<Value> update(double dt) override;
  void enter() override;

 private:
  ActionDirector _director;
};

}
}
