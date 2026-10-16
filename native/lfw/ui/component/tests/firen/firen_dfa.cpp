#include "lfw/ui/component/tests/firen/firen_dfa.h"

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

Firen_DFA::Firen_DFA(Tests& owner) : TestCase(owner) {
  name = u"Firen D>A+A+A";
  _director
      .insert(50.0, [this]() {
        if (Entity* const e = entity_at(entities, 0))
          e->ctrl()
              ->key_up(agk())
              .click({gk::kDefend, gk::kRight, gk::kAttack})
              .key_down({gk::kDown});
        if (Entity* const e = entity_at(entities, 1))
          e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kRight, gk::kAttack});
        if (Entity* const e = entity_at(entities, 2))
          e->ctrl()
              ->key_up(agk())
              .click({gk::kDefend, gk::kRight, gk::kAttack})
              .key_down({gk::kUp});
      })
      .repeat(10.0, 50.0, {[this]() {
                if (Entity* const e = entity_at(entities, 0)) e->ctrl()->click({gk::kAttack});
                if (Entity* const e = entity_at(entities, 1)) e->ctrl()->click({gk::kAttack});
                if (Entity* const e = entity_at(entities, 2)) e->ctrl()->click({gk::kAttack});
              }})
      .wait(500.0)
      .sort_actions();
}

void Firen_DFA::enter() {
  director().reset();
  entities = verti_3(std::u16string(oid::kFiren), 50.0);
  for (Entity* const o : entities) {
    o->set_team(team_enum::kTeam_1);
    o->as_key_role(Value(false));
    o->set_mp(1000000.0);
  }
  bandits_mid_8();
}

}
}
