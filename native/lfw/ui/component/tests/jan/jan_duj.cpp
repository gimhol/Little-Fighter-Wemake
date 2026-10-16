#include "lfw/ui/component/tests/jan/jan_duj.h"

#include <string>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Jan_DUJ_2::Jan_DUJ_2(Tests& owner) : TestCase(owner) { name = u"Jan D^J 2"; }

void Jan_DUJ_2::enter() {
  Entity* const jan = spawn(std::u16string(oid::kJan));
  if (jan == nullptr) return;
  jan->set_position(Value(midX()), Value(0.0), Value(midZ()));
  jan->set_team(team_enum::kTeam_1);
  jan->as_key_role(Value(true));
  jan->set_hp(1.0);
  jan->attach();
  jan->ctrl()->click({gk::kd, gk::kU, gk::kj});
}

Jan_DUJ::Jan_DUJ(Tests& owner) : Jan_DUJ_2(owner) { name = u"Jan D^J 1"; }

void Jan_DUJ::enter() {
  TestCase::enter();
  for (Entity* const v : bandits_8()) {
    v->set_team(team_enum::kTeam_1);
    v->as_key_role(Value(true));
    v->set_hp(1.0);
  }
}

}
}
