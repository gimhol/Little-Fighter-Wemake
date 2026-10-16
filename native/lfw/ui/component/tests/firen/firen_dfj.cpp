#include "lfw/ui/component/tests/firen/firen_dfj.h"

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

Firen_DFJ::Firen_DFJ(Tests& owner) : TestCase(owner) {
  name = u"Firen D>J";
  _director
      .offset(500.0,
              {[this]() {
                 if (Entity* const e = entity_at(entities, 0))
                   e->ctrl()->key_up(agk()).click({gk::kDefend, gk::kRight, gk::kJump});
               },
               [this]() {
                 if (Entity* const e = entity_at(entities, 0))
                   e->ctrl()->key_up(agk()).key_down({gk::kUp});
               },
               [this]() {
                 if (Entity* const e = entity_at(entities, 0)) e->ctrl()->key_up(agk());
               },
               [this]() {
                 if (Entity* const e = entity_at(entities, 0))
                   e->ctrl()->key_up(agk()).key_down({gk::kDown});
               },
               [this]() {
                 if (Entity* const e = entity_at(entities, 0)) e->ctrl()->key_up(agk());
               },
               [this]() {
                 if (Entity* const e = entity_at(entities, 0))
                   e->ctrl()->key_up(agk()).key_down({gk::kDefend});
               },
               [this]() {
                 if (Entity* const e = entity_at(entities, 0)) e->ctrl()->key_up(agk());
               }})
      .sort_actions();
}

void Firen_DFJ::enter() {
  director().reset();
  // TS：`this.entities[0] = this.spawn(O_ID.Firen)!`（单个实体，位置写死 x = 0）。
  entities.assign(1, nullptr);
  Entity* const firen = spawn(std::u16string(oid::kFiren));
  entities[0] = firen;
  if (firen == nullptr) return;
  firen->set_position(Value(0.0), Value(0.0), Value(midZ()));
  firen->set_team(team_enum::kTeam_1);
  firen->as_key_role(Value(false));
  firen->set_mp(1000000.0);
  firen->attach();

  for (Entity* const bandit : bandits_8()) {
    bandit->set_team(team_enum::kTeam_2);
    bandit->set_hp_max(75.0);
    bandit->set_hp_r(75.0);
    bandit->set_hp(75.0);
    bandit->attach();
  }
}

}
}
