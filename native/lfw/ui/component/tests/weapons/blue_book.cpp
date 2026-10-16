#include "lfw/ui/component/tests/weapons/blue_book.h"

#include <string>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/math/round_float.h"

namespace lfw {
namespace ui {

BlueBook_MpHealing::BlueBook_MpHealing(Tests& owner) : TestCase(owner) {
  name = u"Blue Book: MpHealing";
  _director
      .offset(1000.0, {[this]() {
                if (dennis_top != nullptr) dennis_top->ctrl()->click({gk::ka});
              }})
      .offset(1000.0, {[this]() {
                if (dennis_top != nullptr) dennis_top->ctrl()->click({gk::kd, gk::kR, gk::ka});
                if (dennis_bottom != nullptr) {
                  dennis_bottom->ctrl()->click({gk::kd, gk::kR, gk::ka});
                }
              }})
      .repeat(2000.0, 100.0, {[this]() {
                if (dennis_top != nullptr) dennis_top->ctrl()->click({gk::ka});
                if (dennis_bottom != nullptr) dennis_bottom->ctrl()->click({gk::ka});
              }});
}

void BlueBook_MpHealing::enter() {
  TestCase::enter();
  const double z_top = round_float(far_plane());
  const double z_bottom = round_float(near_plane());
  const double dennis_x = midX() - 30.0;

  dennis_top = place_dennis(dennis_x, z_top);
  dennis_bottom = place_dennis(dennis_x, z_bottom);

  book = place_weapon(u"book_blue", dennis_x + 20.0, z_top);
}

Entity* BlueBook_MpHealing::place_dennis(double x, double z) {
  Entity* const dennis = spawn(std::u16string(oid::kDennis));
  if (dennis == nullptr) return nullptr;
  dennis->set_team(team_enum::kTeam_1);
  dennis->facing = 1.0;
  dennis->as_key_role(Value(true));
  dennis->set_position(Value(x), Value(0.0), Value(z));
  dennis->attach();
  return dennis;
}

Entity* BlueBook_MpHealing::place_weapon(const std::u16string& oid, double x, double z) {
  Entity* const weapon = spawn(oid);
  if (weapon == nullptr) return nullptr;
  weapon->set_position(Value(x), Value(0.0), Value(z));
  weapon->attach();
  return weapon;
}

}
}
