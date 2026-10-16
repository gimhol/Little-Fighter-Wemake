#include "lfw/ui/component/tests/weapons/boomerang.h"

#include <functional>
#include <string>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"

namespace lfw {
namespace ui {

namespace {

// TS `this.fighters[0].ctrl`：端口对空表 / 没有控制器的实体判空（TS 那两处会抛异常）。
controller::BaseController* first_ctrl(const std::vector<Entity*>& fighters) {
  if (fighters.empty() || fighters[0] == nullptr) return nullptr;
  return fighters[0]->ctrl();
}

// TS 里 `Boomerang_1_1` / `Boomerang_2_1` / `Boomerang_3_1` 的 `director` 逐字相同
// （`offset(500, 攻击 / 右走+攻击 / 松右)`，都用 `this.fighters[0]`）⇒ 端口把「取谁的控制器」抽成回调。
void setup_director(ActionDirector& director,
                    const std::function<controller::BaseController*()>& first) {
  director
      .offset(500.0, {
                        [first]() {
                          if (controller::BaseController* const c = first()) c->click({gk::ka});
                        },
                        [first]() {
                          if (controller::BaseController* const c = first()) {
                            c->key_down({gk::kR}).click({gk::ka});
                          }
                        },
                        [first]() {
                          if (controller::BaseController* const c = first()) c->key_up({gk::kR});
                        },
                      })
      .sort_actions();
}

// TS 里 15 个 `Boomerang_x_2…x_6` 的 `enter` 都只差「靶子站在哪」⇒ 端口收 (x, z)。
void spawn_bandit_target(TestCase& test_case, double x, double z) {
  Entity* const f1 = test_case.spawn(std::u16string(oid::kBandit));
  if (f1 == nullptr) return;
  f1->set_team(team_enum::kTeam_2);
  f1->set_position(Value(x), Value(0.0), Value(z));
  f1->attach();
}

}  // namespace

Boomerang_1_1::Boomerang_1_1(Tests& owner) : TestCase(owner) {
  name = u"Boomerang_1_1";
  setup_director(_director, [this]() { return first_ctrl(fighters); });
}

void Boomerang_1_1::enter() {
  _director.reset();
  Entity* const b = spawn(std::u16string(oid::kWeapon_Boomerang));
  if (b != nullptr) {
    b->set_ctrl(lfw.factory.create_ctrl(Value(std::u16string(oid::kWeapon_Boomerang)),
                                        std::u16string(), b));
    b->set_position(Value(50.0), Value(0.0), Value(far_plane() + 1.0));
    b->attach();
  }

  Entity* const f1 = spawn(std::u16string(oid::kKnight));
  if (f1 != nullptr) {
    f1->set_team(team_enum::kTeam_1);
    f1->set_position(Value(50.0), Value(0.0), Value(far_plane()));
    f1->attach();
    fighters = {f1};
  }
}

Boomerang_1_2::Boomerang_1_2(Tests& owner) : Boomerang_1_1(owner) { name = u"Boomerang_1_2"; }

void Boomerang_1_2::enter() {
  Boomerang_1_1::enter();
  spawn_bandit_target(*this, 50.0, far_plane());
}

Boomerang_1_3::Boomerang_1_3(Tests& owner) : Boomerang_1_1(owner) { name = u"Boomerang_1_3"; }

void Boomerang_1_3::enter() {
  Boomerang_1_1::enter();
  spawn_bandit_target(*this, right() - 50.0, far_plane());
}

Boomerang_1_4::Boomerang_1_4(Tests& owner) : Boomerang_1_1(owner) { name = u"Boomerang_1_4"; }

void Boomerang_1_4::enter() {
  Boomerang_1_1::enter();
  spawn_bandit_target(*this, 50.0, near_plane());
}

Boomerang_1_5::Boomerang_1_5(Tests& owner) : Boomerang_1_1(owner) { name = u"Boomerang_1_5"; }

void Boomerang_1_5::enter() {
  Boomerang_1_1::enter();
  spawn_bandit_target(*this, right() - 50.0, near_plane());
}

Boomerang_1_6::Boomerang_1_6(Tests& owner) : Boomerang_1_1(owner) { name = u"Boomerang_1_6"; }

void Boomerang_1_6::enter() {
  Boomerang_1_1::enter();
  spawn_bandit_target(*this, midX(), midZ());
}

Boomerang_2_1::Boomerang_2_1(Tests& owner) : TestCase(owner) {
  name = u"Boomerang_2_1";
  setup_director(_director, [this]() { return first_ctrl(fighters); });
}

void Boomerang_2_1::enter() {
  _director.reset();
  Entity* const b = spawn(std::u16string(oid::kWeapon_Boomerang));
  if (b != nullptr) {
    b->set_ctrl(lfw.factory.create_ctrl(Value(std::u16string(oid::kWeapon_Boomerang)),
                                        std::u16string(), b));
    b->set_position(Value(50.0), Value(0.0), Value(far_plane() + 1.0));
    b->attach();
  }

  Entity* const f1 = spawn(std::u16string(oid::kJan));
  if (f1 != nullptr) {
    f1->set_team(team_enum::kTeam_1);
    f1->set_position(Value(50.0), Value(0.0), Value(far_plane()));
    f1->attach();
    fighters = {f1};
  }
}

Boomerang_2_2::Boomerang_2_2(Tests& owner) : Boomerang_2_1(owner) { name = u"Boomerang_2_2"; }

void Boomerang_2_2::enter() {
  Boomerang_2_1::enter();
  spawn_bandit_target(*this, 50.0, far_plane());
}

Boomerang_2_3::Boomerang_2_3(Tests& owner) : Boomerang_2_1(owner) { name = u"Boomerang_2_3"; }

void Boomerang_2_3::enter() {
  Boomerang_2_1::enter();
  spawn_bandit_target(*this, right() - 50.0, far_plane());
}

Boomerang_2_4::Boomerang_2_4(Tests& owner) : Boomerang_2_1(owner) { name = u"Boomerang_2_4"; }

void Boomerang_2_4::enter() {
  Boomerang_2_1::enter();
  spawn_bandit_target(*this, 50.0, near_plane());
}

Boomerang_2_5::Boomerang_2_5(Tests& owner) : Boomerang_2_1(owner) { name = u"Boomerang_2_5"; }

void Boomerang_2_5::enter() {
  Boomerang_2_1::enter();
  spawn_bandit_target(*this, right() - 50.0, near_plane());
}

Boomerang_2_6::Boomerang_2_6(Tests& owner) : Boomerang_2_1(owner) { name = u"Boomerang_2_6"; }

void Boomerang_2_6::enter() {
  Boomerang_2_1::enter();
  spawn_bandit_target(*this, midX(), midZ());
}

Boomerang_3_1::Boomerang_3_1(Tests& owner) : TestCase(owner) {
  name = u"Boomerang_3_1";
  setup_director(_director, [this]() { return first_ctrl(fighters); });
}

void Boomerang_3_1::enter() {
  _director.reset();
  Entity* const b = spawn(std::u16string(oid::kWeapon_Boomerang));
  if (b != nullptr) {
    b->set_ctrl(lfw.factory.create_ctrl(Value(std::u16string(oid::kWeapon_Boomerang)),
                                        std::u16string(), b));
    b->set_position(Value(50.0), Value(0.0), Value(far_plane() + 1.0));
    b->attach();
  }

  Entity* const f1 = spawn(std::u16string(oid::kDavis));
  if (f1 != nullptr) {
    f1->set_team(team_enum::kTeam_1);
    f1->set_position(Value(50.0), Value(0.0), Value(far_plane()));
    f1->attach();
    fighters = {f1};
  }
}

Boomerang_3_2::Boomerang_3_2(Tests& owner) : Boomerang_3_1(owner) { name = u"Boomerang_3_2"; }

void Boomerang_3_2::enter() {
  Boomerang_3_1::enter();
  spawn_bandit_target(*this, 50.0, far_plane());
}

Boomerang_3_3::Boomerang_3_3(Tests& owner) : Boomerang_3_1(owner) { name = u"Boomerang_3_3"; }

void Boomerang_3_3::enter() {
  Boomerang_3_1::enter();
  spawn_bandit_target(*this, right() - 50.0, far_plane());
}

Boomerang_3_4::Boomerang_3_4(Tests& owner) : Boomerang_3_1(owner) { name = u"Boomerang_3_4"; }

void Boomerang_3_4::enter() {
  Boomerang_3_1::enter();
  spawn_bandit_target(*this, 50.0, near_plane());
}

Boomerang_3_5::Boomerang_3_5(Tests& owner) : Boomerang_3_1(owner) { name = u"Boomerang_3_5"; }

void Boomerang_3_5::enter() {
  Boomerang_3_1::enter();
  spawn_bandit_target(*this, right() - 50.0, near_plane());
}

Boomerang_3_6::Boomerang_3_6(Tests& owner) : Boomerang_3_1(owner) { name = u"Boomerang_3_6"; }

void Boomerang_3_6::enter() {
  Boomerang_3_1::enter();
  spawn_bandit_target(*this, midX(), midZ());
}

}
}
