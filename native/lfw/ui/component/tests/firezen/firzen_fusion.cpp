#include "lfw/ui/component/tests/firezen/firzen_fusion.h"

#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Firzen_FUSION::Firzen_FUSION(Tests& owner) : TestCase(owner) {
  name = u"Firzen = Freeze + Firen";
  // TS 这条链没有 `.sort()`（两个 offset 本来就是递增的），照搬。
  _director
      .offset(1000.0,
              {[this]() {
                 if (firen != nullptr) firen->ctrl()->db_hit({gk::kR}).key_up({gk::kR});
                 if (freze != nullptr) freze->ctrl()->db_hit({gk::kL}).key_up({gk::kL});
               }})
      .offset(6000.0, {[this]() {
                if (firen != nullptr) firen->ctrl()->click({gk::kd, gk::kj, gk::ka});
                if (freze != nullptr) freze->ctrl()->click({gk::kd, gk::kj, gk::ka});
              }})
      .times(1.0);
}

void Firzen_FUSION::enter() {
  director().reset();
  // TS：`const [firen, freze] = this.spawns(O_ID.Firen, O_ID.Freeze)`。
  const std::vector<Entity*> both =
      spawns({std::u16string(oid::kFiren), std::u16string(oid::kFreeze)});
  Entity* const new_firen = both.size() > 0 ? both[0] : nullptr;
  Entity* const new_freze = both.size() > 1 ? both[1] : nullptr;
  if (new_firen == nullptr || new_freze == nullptr) return;

  new_firen->set_position(Value(midX() - 300.0), Value(0.0), Value(midZ()));
  new_firen->set_team(team_enum::kTeam_1);
  new_firen->facing = 1;
  new_firen->set_hp(100.0);
  new_firen->attach();

  new_freze->set_position(Value(midX() + 300.0), Value(0.0), Value(midZ()));
  new_freze->set_team(team_enum::kTeam_1);
  new_freze->facing = -1;
  new_freze->set_hp(100.0);
  new_freze->attach();

  freze = new_freze;
  firen = new_firen;

  for (Entity* const v : bandits_8()) v->set_team(team_enum::kTeam_2);
}

}
}
