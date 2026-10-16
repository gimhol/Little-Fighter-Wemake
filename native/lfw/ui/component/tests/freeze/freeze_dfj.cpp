#include "lfw/ui/component/tests/freeze/freeze_dfj.h"

#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Freeze_DFJ::Freeze_DFJ(Tests& owner) : TestCase(owner) {
  name = u"Freeze D>J";
  _director
      .offset(500.0, {[this]() {
                if (freeze1 != nullptr)
                  freeze1->ctrl()
                      ->key_up(agk())
                      .click({gk::kDefend, gk::kRight, gk::kJump})
                      .key_down({gk::kDown});
                if (freeze2 != nullptr)
                  freeze2->ctrl()->key_up(agk()).click({gk::kDefend, gk::kRight, gk::kJump});
                if (freeze3 != nullptr)
                  freeze3->ctrl()
                      ->key_up(agk())
                      .click({gk::kDefend, gk::kRight, gk::kJump})
                      .key_down({gk::kUp});
              }})
      .wait(500.0)
      .times(100.0)
      .sort_actions();
}

void Freeze_DFJ::enter() {
  director().reset();
  // TS 里这个局部量叫 `figters`（原文的拼写），照搬以免与基类成员 `fighters` 撞名。
  const std::vector<Entity*> figters = hori_3(std::u16string(oid::kFreeze));
  for (Entity* const o : figters) {
    o->set_team(team_enum::kTeam_1);
    o->as_key_role(Value(false));
    o->set_mp(1000000.0);
  }
  freeze1 = figters.size() > 0 ? figters[0] : nullptr;
  freeze2 = figters.size() > 1 ? figters[1] : nullptr;
  freeze3 = figters.size() > 2 ? figters[2] : nullptr;

  bandits_mid_8();
  bandits_8();
}

}
}
