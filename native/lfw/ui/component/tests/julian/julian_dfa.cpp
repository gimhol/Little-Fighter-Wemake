#include "lfw/ui/component/tests/julian/julian_dfa.h"

#include <string>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Julian_DFA::Julian_DFA(Tests& owner) : TestCase(owner) {
  name = u"Julian D>A";
  _director
      .offset(100.0, {[this]() {
                if (julian != nullptr) julian->ctrl()->click({gk::kd, gk::kR, gk::ka});
              }})
      .repeat(1000.0, 50.0, {[this]() {
                if (julian != nullptr) julian->ctrl()->click({gk::ka});
              }})
      .times(9999.0)
      .sort_actions();
}

void Julian_DFA::enter() {
  _director.reset();
  julian = spawn(std::u16string(oid::kJulian));
  if (julian == nullptr) return;
  julian->set_position(Value(midX()), Value(0.0), Value(midZ()));
  julian->set_team(team_enum::kTeam_1);
  julian->as_key_role(Value(false));
  julian->set_mp(1000000.0);
  julian->attach();

  for (Entity* const bandit : bandits_8()) {
    bandit->set_team(team_enum::kTeam_2);
    // TS `bandit.hp = bandit.hp_r = bandit.hp_max = 75` 的求值顺序（右起）：max → r → hp。
    bandit->set_hp_max(75.0);
    bandit->set_hp_r(75.0);
    bandit->set_hp(75.0);
    bandit->attach();
  }
}

}
}
