#include "lfw/ui/component/tests/freeze/freeze_dvj.h"

#include <cstddef>
#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

namespace {

// TS `this.freezes[i]?.`：下标越界读到 `undefined`，`?.` 整条短路。
Entity* freeze_at(const std::vector<Entity*>& list, std::size_t i) {
  return i < list.size() ? list[i] : nullptr;
}

}  // namespace

Freeze_DVJ::Freeze_DVJ(Tests& owner) : TestCase(owner) {
  name = u"Freeze DvJ";
  _director
      .offset(500.0, {[this]() {
                if (Entity* const e = freeze_at(freezes, 0))
                  e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kDown, gk::kJump});
                if (Entity* const e = freeze_at(freezes, 1))
                  e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kDown, gk::kJump});
                if (Entity* const e = freeze_at(freezes, 2))
                  e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kDown, gk::kJump});
              }})
      .times(1000.0)
      .sort_actions();
}

void Freeze_DVJ::enter() {
  director().reset();
  freezes = hori_3(std::u16string(oid::kFreeze));
  for (Entity* const o : freezes) {
    o->set_team(team_enum::kTeam_1);
    o->as_key_role(Value(false));
    o->set_mp(1000000.0);
  }
}

}
}
