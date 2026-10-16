#include "lfw/ui/component/tests/firen/firen_dvj.h"

#include <cstddef>
#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

namespace {

// TS `this.entities[i]?.`：下标越界读到 `undefined`，`?.` 整条短路。
Entity* entity_at(const std::vector<Entity*>& list, std::size_t i) {
  return i < list.size() ? list[i] : nullptr;
}

}  // namespace

Firen_DVJ::Firen_DVJ(Tests& owner) : TestCase(owner) {
  name = u"Firen DvJ";
  _director
      .offset(500.0,
              {[this]() {
                 if (Entity* const e = entity_at(entities, 0))
                   e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kDown, gk::kJump});
                 if (Entity* const e = entity_at(entities, 1))
                   e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kDown, gk::kJump});
                 if (Entity* const e = entity_at(entities, 2))
                   e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kDown, gk::kJump});
               },
               [this]() {
                 if (Entity* const e = entity_at(entities, 0)) e->ctrl()->key_down({gk::kDown});
                 if (Entity* const e = entity_at(entities, 2)) e->ctrl()->key_down({gk::kUp});
               }})
      .wait(500.0)
      .sort_actions();
}

void Firen_DVJ::enter() {
  director().reset();
  entities = hori_3(std::u16string(oid::kFiren));
  for (Entity* const o : entities) {
    o->set_team(team_enum::kTeam_1);
    o->as_key_role(Value(false));
    o->set_mp(1000000.0);
  }
}

}
}
