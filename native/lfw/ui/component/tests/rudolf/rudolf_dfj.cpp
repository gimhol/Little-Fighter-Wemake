#include "lfw/ui/component/tests/rudolf/rudolf_dfj.h"

#include <cstddef>
#include <string>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace ui {

Rudolf_DFJ::Rudolf_DFJ(Tests& owner) : TestCase(owner) {
  name = u"Rudolf J + ^|v + D + D>J";
  _director
      .offset(100.0, {[this]() {
                for (Entity* const v : entities) v->ctrl()->click({gk::kj});
              }})
      .offset(200.0, {[this]() {
                for (std::size_t i = 0; i < entities.size(); ++i) {
                  entities[i]->ctrl()->key_down({i == 0 ? gk::kU : gk::kD});
                }
              }})
      .offset(200.0, {[this]() {
                for (std::size_t i = 0; i < entities.size(); ++i) {
                  entities[i]->ctrl()->click({gk::kd}).key_down({i == 0 ? gk::kU : gk::kD});
                }
              }})
      .offset(100.0, {[this]() {
                for (std::size_t i = 0; i < entities.size(); ++i) {
                  entities[i]->ctrl()->click({i == 0 ? gk::kR : gk::kL, gk::kj}).key_up(
                      {i == 0 ? gk::kU : gk::kD});
                }
              }})
      .sort_actions();
}

void Rudolf_DFJ::enter() {
  _director.reset();
  entities = hori_2(std::u16string(oid::kRudolf), 100.0);
  for (std::size_t i = 0; i < entities.size(); ++i) {
    Entity* const o = entities[i];
    o->set_team(team_enum::kTeam_1);
    o->facing = i == 0 ? -1.0 : 1.0;
    o->as_key_role(Value(false));
    o->set_mp(1000000.0);
  }
}

}
}
