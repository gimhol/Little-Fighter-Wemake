#include "lfw/ui/component/tests/weapons/red_book.h"

#include <string>
#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/math/round_float.h"

namespace lfw {
namespace ui {

RedBook_GroupAttack::RedBook_GroupAttack(Tests& owner) : TestCase(owner) {
  name = u"Red Book: GroupAttack";
  _director
      .offset(1000.0, {[this]() {
                if (davis_top != nullptr) davis_top->ctrl()->click({gk::ka});
              }})
      .offset(500.0, {[this]() {
                if (davis_top != nullptr) davis_top->ctrl()->db_hit({gk::kR});
                if (davis_bottom != nullptr) davis_bottom->ctrl()->db_hit({gk::kR});
              }})
      .offset(30.0, {[this]() {
                if (davis_top != nullptr) davis_top->ctrl()->click({gk::kj});
                if (davis_bottom != nullptr) davis_bottom->ctrl()->click({gk::kj});
              }})
      .offset(30.0, {[this]() {
                if (davis_top != nullptr) davis_top->ctrl()->click({gk::kj}).click({gk::ka});
                if (davis_bottom != nullptr) davis_bottom->ctrl()->click({gk::kj}).click({gk::ka});
              }});
}

void RedBook_GroupAttack::enter() {
  TestCase::enter();
  const double z_top = round_float(midZ() + (far_plane() - midZ()) * 0.6);
  const double z_bottom = round_float(midZ() + (near_plane() - midZ()) * 0.6);
  const double davis_x = midX() - 75.0;
  const double bandit_x = midX() + 75.0;

  davis_top = place_davis(davis_x, z_top);
  davis_bottom = place_davis(davis_x, z_bottom);

  bandits_top.clear();
  bandits_bottom.clear();
  for (int i = 0; i < 3; ++i) {
    const double x = bandit_x + static_cast<double>(i) * 30.0;
    Entity* const top = place_bandit(x, z_top);
    if (top != nullptr) bandits_top.push_back(top);
    Entity* const bottom = place_bandit(x, z_bottom);
    if (bottom != nullptr) bandits_bottom.push_back(bottom);
  }

  book = place_weapon(u"book_red", davis_x + 24.0, z_top);
}

Entity* RedBook_GroupAttack::place_davis(double x, double z) {
  Entity* const davis = spawn(std::u16string(oid::kJustin));
  if (davis == nullptr) return nullptr;
  davis->set_team(team_enum::kTeam_1);
  davis->facing = 1.0;
  davis->as_key_role(Value(false));
  davis->set_position(Value(x), Value(0.0), Value(z));
  davis->attach();
  return davis;
}

Entity* RedBook_GroupAttack::place_bandit(double x, double z) {
  Entity* const bandit = spawn(std::u16string(oid::kBandit));
  if (bandit == nullptr) return nullptr;
  bandit->set_team(team_enum::kTeam_2);
  bandit->facing = -1.0;
  bandit->as_key_role(Value(false));
  bandit->set_position(Value(x), Value(0.0), Value(z));
  bandit->attach();
  return bandit;
}

Entity* RedBook_GroupAttack::place_weapon(const std::u16string& oid, double x, double z) {
  Entity* const weapon = spawn(oid);
  if (weapon == nullptr) return nullptr;
  weapon->set_position(Value(x), Value(0.0), Value(z));
  weapon->attach();
  return weapon;
}

}
}
