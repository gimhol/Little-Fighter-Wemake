#include "lfw/ui/component/tests/louis/louis_jump_attack.h"

#include <cmath>
#include <string>

#include "lfw/base/fsm.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

LOUIS_JUMP_ATTACK::LOUIS_JUMP_ATTACK(Tests& owner) : TestCase(owner) {
  name = u"Normal Jump / Small Jump";
}

std::optional<Value> LOUIS_JUMP_ATTACK::update(double dt) {
  (void)dt;
  // TS `this.owner.fsm.state_time % 5000`。
  const double time = std::fmod(fsm().state_time(), 5000.0);
  if (time > 1200.0) {
    if (louis1 != nullptr) louis1->ctrl()->key_up({gk::kj, gk::ka});
    if (louis2 != nullptr) louis2->ctrl()->key_up({gk::kj, gk::ka});
  } else if (time > 1000.0) {
    // 左边是"按住跳"（普通跳），右边是"点一下跳"（小跳）。
    if (louis1 != nullptr) louis1->ctrl()->key_down({gk::kj}).key_down({gk::ka});
    if (louis2 != nullptr) louis2->ctrl()->click({gk::kj}).key_down({gk::ka});
    if (bandit1 != nullptr) bandit1->ctrl()->click({gk::kd});
    if (bandit2 != nullptr) bandit2->ctrl()->click({gk::kd});
  }
  return std::nullopt;
}

void LOUIS_JUMP_ATTACK::enter() {
  louis1 = spawn(std::u16string(oid::kLouis));
  bandit1 = spawn(std::u16string(oid::kBandit));
  if (louis1 == nullptr || bandit1 == nullptr) return;
  louis1->set_position(Value(midX() - 125.0), Value(0.0), Value(midZ()));
  louis1->set_team(team_enum::kTeam_1);
  louis1->as_key_role(Value(false));
  louis1->attach();

  bandit1->set_position(Value(midX() - 125.0 + 30.0), Value(0.0), Value(midZ()));
  bandit1->set_team(team_enum::kTeam_4);
  bandit1->as_key_role(Value(false));
  bandit1->facing = -1.0;
  bandit1->attach();

  louis2 = spawn(std::u16string(oid::kLouis));
  bandit2 = spawn(std::u16string(oid::kBandit));
  if (louis2 == nullptr || bandit2 == nullptr) return;
  louis2->set_position(Value(midX() + 75.0), Value(0.0), Value(midZ()));
  louis2->set_team(team_enum::kTeam_1);
  louis2->as_key_role(Value(false));
  louis2->attach();

  bandit2->set_position(Value(midX() + 75.0 + 30.0), Value(0.0), Value(midZ()));
  bandit2->set_team(team_enum::kTeam_4);
  bandit2->as_key_role(Value(false));
  bandit2->facing = -1.0;
  bandit2->attach();
}

}
}
