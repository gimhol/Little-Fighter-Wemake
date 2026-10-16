#include "lfw/ui/component/tests/weapons/throw.h"

#include <string>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"
#include "lfw/stage/stage.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

namespace {

// TS 的 `this.fighters.forEach(f => …)`：端口对空指针 / 没有控制器的实体跳过
// （TS 那几处会抛异常）。
template <typename Fn>
void each_ctrl(const std::vector<Entity*>& fighters, Fn fn) {
  for (Entity* const f : fighters) {
    if (f == nullptr) continue;
    controller::BaseController* const c = f->ctrl();
    if (c != nullptr) fn(*c);
  }
}

// TS 里五个用例共用的那一排人（`[O_ID.Mark, O_ID.Deep, O_ID.Davis, O_ID.Jan]`）。
const std::vector<std::u16string>& throw_fighter_ids() {
  static const std::vector<std::u16string> ids{std::u16string(oid::kMark),
                                               std::u16string(oid::kDeep),
                                               std::u16string(oid::kDavis),
                                               std::u16string(oid::kJan)};
  return ids;
}

// TS `Knife_1_1` / `Baseball_1_1` 的 `director`：同一段脚本，只有相机两站不同
// （小刀 350 / 0，棒球 700 / 600）⇒ 端口收 `dest_a` / `dest_b`。
void setup_camera_director(TestCase* const self, ActionDirector& director, double dest_a,
                           double dest_b) {
  director
      .offset(500.0, {
                        [self]() {
                          each_ctrl(self->fighters,
                                    [](controller::BaseController& f) { f.click({gk::ka}); });
                        },
                        [self]() {
                          each_ctrl(self->fighters, [](controller::BaseController& f) {
                            f.key_down({gk::kR}).click({gk::ka});
                          });
                        },
                        [self, dest_a]() {
                          each_ctrl(self->fighters,
                                    [](controller::BaseController& f) { f.key_up({gk::kR}); });
                          self->world.camera().dest(dest_a, 0.0);
                        },
                      })
      .repeat(9999.0, 3000.0,
              {
                  [self, dest_b]() { self->world.camera().dest(dest_b, 0.0); },
                  [self, dest_a]() { self->world.camera().dest(dest_a, 0.0); },
              })
      .sort_actions();
}

// TS `Stick_1_1` / `Hoe_1_1` 的 `director`：攻击 → 双击右 → 按住右 → 攻击 → 松右，每步隔 100ms。
void setup_walk_director(TestCase* const self, ActionDirector& director) {
  director
      .offset(500.0, {[self]() {
                each_ctrl(self->fighters, [](controller::BaseController& f) { f.click({gk::ka}); });
              }})
      .offset(100.0, {[self]() {
                each_ctrl(self->fighters,
                          [](controller::BaseController& f) { f.dbl_click({gk::kR}); });
              }})
      .offset(100.0, {[self]() {
                each_ctrl(self->fighters, [](controller::BaseController& f) { f.key_down({gk::kR}); });
              }})
      .offset(100.0, {[self]() {
                each_ctrl(self->fighters, [](controller::BaseController& f) { f.click({gk::ka}); });
              }})
      .offset(100.0, {[self]() {
                each_ctrl(self->fighters, [](controller::BaseController& f) { f.key_up({gk::kR}); });
              }})
      .sort_actions();
}

// TS 里五个 `enter` 都先重置 director 并换到刻度背景（`this.owner.lfw.change_bg('pixel_ruler')`）。
void enter_begin(ActionDirector& director, LFW& lfw) {
  director.reset();
  lfw.change_bg(u"pixel_ruler");
}

}  // namespace

Knife_1_1::Knife_1_1(Tests& owner) : TestCase(owner) {
  name = u"Knife_1_1";
  setup_camera_director(this, _director, 350.0, 0.0);
}

void Knife_1_1::enter() {
  enter_begin(_director, lfw);
  const double x = 20.0;
  const double len = 300.0;
  // TS 原文也没接这一行的返回值（武器列表丢弃）。
  verti({std::u16string(oid::kWeapon_Knife)}, x, midZ(), len, 4);
  fighters = verti(throw_fighter_ids(), x, midZ(), len);
}

Stick_1_1::Stick_1_1(Tests& owner) : TestCase(owner) {
  name = u"Stick_1_1";
  setup_walk_director(this, _director);
}

void Stick_1_1::enter() {
  enter_begin(_director, lfw);
  world.stage()->player_r = 10.0;
  const double x = 0.0;
  const double len = 300.0;
  verti({std::u16string(oid::kWeapon_Stick)}, x, midZ(), len, 4);
  fighters = verti(throw_fighter_ids(), x, midZ(), len);
}

Hoe_1_1::Hoe_1_1(Tests& owner) : TestCase(owner) {
  name = u"Hoe_1_1";
  setup_walk_director(this, _director);
}

void Hoe_1_1::enter() {
  enter_begin(_director, lfw);
  world.stage()->player_r = 10.0;
  const double x = 0.0;
  const double len = 300.0;
  verti({std::u16string(oid::kWeapon_Hoe)}, x, midZ(), len, 4);
  fighters = verti(throw_fighter_ids(), x, midZ(), len);
}

Stone_1_1::Stone_1_1(Tests& owner) : TestCase(owner) {
  name = u"Stone_1_1";
  _director
      .offset(500.0, {
                        [this]() {
                          each_ctrl(fighters,
                                    [](controller::BaseController& f) { f.click({gk::ka}); });
                        },
                        [this]() {
                          each_ctrl(fighters,
                                    [](controller::BaseController& f) { f.click({gk::ka}); });
                        },
                        [this]() {
                          each_ctrl(fighters,
                                    [](controller::BaseController& f) { f.key_up({gk::kR}); });
                        },
                      })
      .sort_actions();
}

void Stone_1_1::enter() {
  enter_begin(_director, lfw);
  const double x = 20.0;
  const double len = 300.0;
  verti({std::u16string(oid::kWeapon_Stone)}, x, midZ(), len, 4);
  fighters = verti(throw_fighter_ids(), x, midZ(), len);
}

Baseball_1_1::Baseball_1_1(Tests& owner) : TestCase(owner) {
  name = u"Baseball_1_1";
  setup_camera_director(this, _director, 700.0, 600.0);
}

void Baseball_1_1::enter() {
  enter_begin(_director, lfw);
  const double x = 20.0;
  const double len = 300.0;
  verti({std::u16string(oid::kWeapon_baseball)}, x, midZ(), len, 4);
  fighters = verti(throw_fighter_ids(), x, midZ(), len);
}

}
}
