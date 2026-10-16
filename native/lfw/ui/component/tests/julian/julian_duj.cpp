#include "lfw/ui/component/tests/julian/julian_duj.h"

#include <string>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Julian_DUJ::Julian_DUJ(Tests& owner) : TestCase(owner) { name = u"Julian D^J"; }

void Julian_DUJ::enter() {
  Entity* const julian = spawn(std::u16string(oid::kJulian));
  if (julian == nullptr) return;
  julian->set_position(Value(midX()), Value(0.0), Value(midZ()));
  julian->set_team(team_enum::kTeam_1);
  julian->as_key_role(Value(false));
  julian->attach();
  julian->ctrl()->click({gk::kd, gk::kU, gk::kj});

  for (Entity* const v : bandits_mid_8()) {
    v->set_team(team_enum::kTeam_2);
  }
}

Henry_DUJ::Henry_DUJ(Tests& owner) : TestCase(owner) { name = u"Henry D^J"; }

void Henry_DUJ::enter() {
  Entity* const henry = spawn(std::u16string(oid::kHenry));
  if (henry == nullptr) return;
  henry->set_position(Value(midX()), Value(0.0), Value(midZ()));
  henry->set_team(team_enum::kTeam_1);
  henry->as_key_role(Value(false));
  henry->attach();
  henry->ctrl()->click({gk::kd, gk::kU, gk::kj});

  const std::vector<std::u16string> bandit = {std::u16string(oid::kBandit)};
  for (Entity* const v : circle(bandit, midX(), midZ(), 100.0, 50.0, 8)) {
    v->set_team(team_enum::kTeam_2);
  }
  for (Entity* const v : circle(bandit, midX(), midZ(), 200.0, 75.0, 16)) {
    v->set_team(team_enum::kTeam_2);
  }
  for (Entity* const v : circle(bandit, midX(), midZ(), 300.0, 100.0, 32)) {
    v->set_team(team_enum::kTeam_2);
  }
}

}
}
