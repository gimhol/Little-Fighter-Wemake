#include "lfw/ui/component/tests/freeze/freeze_dfa.h"

#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Freeze_DFA::Freeze_DFA(Tests& owner) : TestCase(owner) {
  name = u"Freeze D>A+A+A";
  _director
      .insert(50.0, [this]() {
        if (freeze1 != nullptr)
          freeze1->ctrl()
              ->key_up(agk())
              .click({gk::kDefend, gk::kRight, gk::kAttack})
              .key_down({gk::kDown});
        if (freeze2 != nullptr)
          freeze2->ctrl()->key_up(agk()).click({gk::kDefend, gk::kRight, gk::kAttack});
        if (freeze3 != nullptr)
          freeze3->ctrl()
              ->key_up(agk())
              .click({gk::kDefend, gk::kRight, gk::kAttack})
              .key_down({gk::kUp});
      })
      .repeat(10.0, 50.0, {[this]() {
                if (freeze1 != nullptr) freeze1->ctrl()->click({gk::kAttack});
                if (freeze2 != nullptr) freeze2->ctrl()->click({gk::kAttack});
                if (freeze3 != nullptr) freeze3->ctrl()->click({gk::kAttack});
              }})
      .wait(500.0)
      .sort_actions();
}

void Freeze_DFA::enter() {
  director().reset();
  const std::vector<Entity*> freezes = verti_3(std::u16string(oid::kFreeze), 50.0);
  for (Entity* const o : freezes) {
    o->set_team(team_enum::kTeam_1);
    o->as_key_role(Value(false));
    o->set_mp(1000000.0);
  }
  freeze1 = freezes.size() > 0 ? freezes[0] : nullptr;
  freeze2 = freezes.size() > 1 ? freezes[1] : nullptr;
  freeze3 = freezes.size() > 2 ? freezes[2] : nullptr;
  bandits_mid_8();
}

}
}
