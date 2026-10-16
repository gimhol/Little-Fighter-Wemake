#include "lfw/ui/component/tests/weapons/green_book.h"

#include <string>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/math/round_float.h"

namespace lfw {
namespace ui {

GreenBook_Electrify::GreenBook_Electrify(Tests& owner) : TestCase(owner) {
  name = u"Green Book: Electrify";
  _director
      .offset(1000.0, {[this]() {
                if (john_top != nullptr) john_top->ctrl()->click({gk::ka});
              }})
      .wait(1000.0)
      .repeat(2000.0, 1000.0, {[this]() {
                if (john_top != nullptr) john_top->ctrl()->click({gk::ka});
                if (john_bottom != nullptr) john_bottom->ctrl()->click({gk::ka});
              }});
}

void GreenBook_Electrify::enter() {
  TestCase::enter();
  const double z_top = round_float(midZ() + (far_plane() - midZ()) * 0.6);
  const double z_bottom = round_float(midZ() + (near_plane() - midZ()) * 0.6);
  const double john_x = midX() - 30.0;
  const double bandit_x = midX() + 30.0;

  john_top = place_john(john_x, z_top);
  john_bottom = place_john(john_x, z_bottom);
  bandit_top = place_bandit(bandit_x, z_top);
  bandit_bottom = place_bandit(bandit_x, z_bottom);

  book = place_weapon(u"book_green", john_x + 24.0, z_top);
}

Entity* GreenBook_Electrify::place_john(double x, double z) {
  Entity* const john = spawn(std::u16string(oid::kJohn));
  if (john == nullptr) return nullptr;
  john->set_team(team_enum::kTeam_1);
  john->facing = 1.0;
  john->as_key_role(Value(false));
  john->set_position(Value(x), Value(0.0), Value(z));
  john->attach();
  return john;
}

Entity* GreenBook_Electrify::place_bandit(double x, double z) {
  Entity* const bandit = spawn(std::u16string(oid::kBandit));
  if (bandit == nullptr) return nullptr;
  bandit->set_team(team_enum::kTeam_2);
  bandit->facing = -1.0;
  bandit->as_key_role(Value(false));
  bandit->set_position(Value(x), Value(0.0), Value(z));
  bandit->attach();
  return bandit;
}

Entity* GreenBook_Electrify::place_weapon(const std::u16string& oid, double x, double z) {
  Entity* const weapon = spawn(oid);
  if (weapon == nullptr) return nullptr;
  weapon->set_position(Value(x), Value(0.0), Value(z));
  weapon->attach();
  return weapon;
}

}
}
