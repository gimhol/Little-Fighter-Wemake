#include "lfw/ui/component/tests/freeze/freeze_duj.h"

#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Freeze_DUJ::Freeze_DUJ(Tests& owner) : TestCase(owner) {
  name = u"Freeze D^J";
  _director
      .offset(100.0,
              {[this]() {
                 if (freeze1 != nullptr)
                   freeze1->ctrl()->key_up(agk()).click({gk::kDefend, gk::kUp, gk::kJump});
                 if (freeze2 != nullptr)
                   freeze2->ctrl()->key_up(agk()).click({gk::kDefend, gk::kUp, gk::kJump});
                 if (freeze3 != nullptr)
                   freeze3->ctrl()->key_up(agk()).click({gk::kDefend, gk::kUp, gk::kJump});
               },
               [this]() {
                 if (freeze1 != nullptr)
                   freeze1->ctrl()->key_up(agk()).key_down({gk::kDown});
                 if (freeze3 != nullptr) freeze3->ctrl()->key_up(agk()).key_down({gk::kUp});
               }})
      .wait(500.0)
      .sort_actions();
}

void Freeze_DUJ::enter() {
  director().reset();
  const std::vector<Entity*> freezes = hori_3(std::u16string(oid::kFreeze));
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
