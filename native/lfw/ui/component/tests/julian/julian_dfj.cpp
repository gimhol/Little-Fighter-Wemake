#include "lfw/ui/component/tests/julian/julian_dfj.h"

#include <string>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Julian_DFJ::Julian_DFJ(Tests& owner) : TestCase(owner) {
  name = u"Julian D>J";
  _director
      .offset(
          700.0,
          {[this]() {
             if (julian == nullptr) return;
             julian->ctrl()->key_up(agk()).click({gk::kd, gk::kR, gk::kj});
           },
           [this]() {
             if (julian == nullptr) return;
             julian->ctrl()->key_up(agk()).click({gk::kd, gk::kR, gk::kj}).key_down({gk::kD});
           },
           [this]() {
             if (julian == nullptr) return;
             julian->ctrl()->key_up(agk()).click({gk::kd, gk::kR, gk::kj}).key_down({gk::kU});
           },
           [this]() {
             if (julian == nullptr) return;
             julian->ctrl()->key_up(agk()).click({gk::kd, gk::kL, gk::kj});
           },
           [this]() {
             if (julian == nullptr) return;
             julian->ctrl()->key_up(agk()).click({gk::kd, gk::kL, gk::kj}).key_down({gk::kD});
           },
           [this]() {
             if (julian == nullptr) return;
             julian->ctrl()->key_up(agk()).click({gk::kd, gk::kL, gk::kj}).key_down({gk::kU});
           },
           [this]() {
             if (julian == nullptr) return;
             julian->ctrl()->key_up(agk());
           }})
      .sort_actions();
}

void Julian_DFJ::enter() {
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
