#include "lfw/ui/component/tests/bat/bat_duj.h"

#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

Bat_DUJ_0::Bat_DUJ_0(Tests& owner) : TestCase(owner) {
  name = u"Bat D^J";
  _director
      .offset(500.0, {[this]() {
                if (bat != nullptr) bat->ctrl()->click({gk::kd, gk::kU, gk::kj});
              }})
      .wait(500.0)
      .times(1000.0)
      .sort_actions();
}

void Bat_DUJ_0::enter() {
  TestCase::enter();
  director().reset();
  bat = spawn(std::u16string(oid::kBat));
  if (bat != nullptr) {
    bat->set_position(Value(midX()), Value(0.0), Value(midZ()));
    bat->set_team(team_enum::kTeam_1);
    bat->attach();
    bat->set_hp(1.0);
    bat->set_hp_r(200.0);
    bat->set_stat_bar(1.0);
    bat->set_mp_max(1000000.0);
    bat->set_mp(1000000.0);
  }

  for (Entity* const bandit : bandits_8()) {
    bandit->set_stat_bar(1.0);
    bandit->set_team(team_enum::kTeam_2);
  }
}

Bat_DUJ_1::Bat_DUJ_1(Tests& owner) : TestCase(owner) { name = u"Bat D^J (No Enemies)"; }

void Bat_DUJ_1::enter() {
  Entity* const fighter = spawn(std::u16string(oid::kBat));
  if (fighter == nullptr) return;
  fighter->set_position(Value(midX()), Value(0.0), Value(midZ()));
  fighter->set_team(team_enum::kTeam_1);
  fighter->attach();
  fighter->ctrl()->click({gk::kd, gk::kU, gk::kj});
}

Bat_DUJ_2::Bat_DUJ_2(Tests& owner) : TestCase(owner) { name = u"Bat D^J (Less Than 3 Enemies)"; }

void Bat_DUJ_2::enter() {
  Entity* const fighter = spawn(std::u16string(oid::kBat));
  if (fighter != nullptr) {
    fighter->set_position(Value(midX()), Value(0.0), Value(midZ()));
    fighter->set_team(team_enum::kTeam_1);
    fighter->as_key_role(Value(false));
    fighter->attach();
    fighter->ctrl()->click({gk::kd, gk::kU, gk::kj});
  }

  for (Entity* const v : hori_2(std::u16string(oid::kBandit), 200.0)) {
    v->set_team(team_enum::kTeam_2);
    v->set_hp(50.0);
  }
}

Bat_DUJ_3::Bat_DUJ_3(Tests& owner) : TestCase(owner) {
  name = u"Bat D^J (Many Enemies)";
  _director
      .offset(0.0, {[this]() {
                if (bat != nullptr) bat->ctrl()->click({gk::kd, gk::kU, gk::kj});
              }})
      .wait(300.0)
      .times(1000.0)
      .sort_actions();
}

void Bat_DUJ_3::enter() {
  TestCase::enter();
  director().reset();
  bat = spawn(std::u16string(oid::kBat));
  if (bat != nullptr) {
    bat->set_position(Value(midX()), Value(0.0), Value(midZ()));
    bat->set_team(team_enum::kTeam_1);
    bat->attach();
    bat->set_blinking(99999.0);
    bat->set_invulnerable(99999.0);
    bat->set_hp(1.0);
    bat->set_hp_r(1.0);
    bat->set_stat_bar(1.0);
    bat->set_mp_max(1000000.0);
    bat->set_mp(1000000.0);
  }

  const std::vector<Entity*> bandits =
      circle({std::u16string(oid::kBandit)}, midX(), midZ(), bg().width() / 2.0,
             bg().depth() / 2.0, 40);
  for (Entity* const v : bandits) {
    // TS：`v.ctrl = this.lfw.factory.create_ctrl(OID.Bandit, v.ctrl.player_id, v)`
    v->set_ctrl(
        lfw.factory.create_ctrl(Value(std::u16string(oid::kBandit)), v->ctrl()->player_id, v));
    v->set_team(team_enum::kTeam_2);
    v->set_hp(50.0);
  }
}

}
}
