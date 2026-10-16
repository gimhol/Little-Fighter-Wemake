#include "lfw/ui/component/tests/others/criminal_saving.h"

#include <cstddef>
#include <string>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/controller/creators.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/lfw.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

namespace {

// TS 的 `this.fighters[i].ctrl.…`：下标越界 / 没挂控制器在 TS 里会抛，端口给 `nullptr`。
controller::BaseController* ctrl_at(const std::vector<Entity*>& fighters, std::size_t i) {
  if (i >= fighters.size()) return nullptr;
  Entity* const e = fighters[i];
  return e != nullptr ? e->ctrl() : nullptr;
}

Entity* entity_at(const std::vector<Entity*>& fighters, std::size_t i) {
  return i < fighters.size() ? fighters[i] : nullptr;
}

// TS 的 `this.fighters.forEach(f => f.ctrl.key_up(...AGK))`。
void key_up_each(const std::vector<Entity*>& fighters) {
  for (Entity* const f : fighters) {
    if (f == nullptr) continue;
    if (controller::BaseController* const c = f->ctrl()) c->key_up(agk());
  }
}

// TS 里的 `[OID.Rudolf, OID.Dennis, OID.Firen, OID.Davis, OID.Deep, OID.Henry]`。
const std::vector<std::u16string>& fighter_ids() {
  static const std::vector<std::u16string> ids{
      std::u16string(oid::kRudolf), std::u16string(oid::kDennis), std::u16string(oid::kFiren),
      std::u16string(oid::kDavis),  std::u16string(oid::kDeep),   std::u16string(oid::kHenry)};
  return ids;
}

}  // namespace

CriminalSaving1::CriminalSaving1(Tests& owner) : TestCase(owner) {
  name = u"CriminalSaving 1";
  // 三拍：先两人各自点 `Attack`，再六人各按一组键，最后全部松键。TS 没写 `.times()` ⇒ 只跑一轮。
  _director
      .offset(300.0, {[this]() {
                if (controller::BaseController* const c = ctrl_at(fighters, 1))
                  c->click({gk::ka});
                if (controller::BaseController* const c = ctrl_at(fighters, 4))
                  c->click({gk::ka});
              }})
      .offset(300.0, {[this]() {
                if (controller::BaseController* const c = ctrl_at(fighters, 0))
                  c->key_down({gk::kD, gk::ka});
                if (controller::BaseController* const c = ctrl_at(fighters, 1))
                  c->key_down({gk::ka});
                if (controller::BaseController* const c = ctrl_at(fighters, 2))
                  c->click({gk::kd, gk::kU, gk::kj});
                if (controller::BaseController* const c = ctrl_at(fighters, 3))
                  c->key_down({gk::ka});
                if (controller::BaseController* const c = ctrl_at(fighters, 4))
                  c->key_down({gk::kR, gk::ka});
                if (controller::BaseController* const c = ctrl_at(fighters, 5))
                  c->key_down({gk::kD, gk::ka});
              }})
      .offset(300.0, {[this]() { key_up_each(fighters); }});
}

std::optional<Value> CriminalSaving1::update(double dt) {
  TestCase::update(dt);
  // TS 每帧把 bot 控制器换成 `InvalidController("", c)` —— 这些人只吃脚本按键。
  for (Entity* const c : world.entities) {
    if (c == nullptr) continue;
    if (!entity::is_bot_ctrl(c->ctrl())) continue;
    c->set_ctrl(lfw.factory.acquire_ctrl(controller::invalid_controller_creator(),
                                         std::u16string(), c));
  }
  return std::nullopt;
}

void CriminalSaving1::enter() {
  director().reset();
  // 六个 Criminal 只作"人质"站在场中央（TS 原文也没接返回值，不进 `fighters`）。
  hori({std::u16string(oid::kCriminal)}, midX(), midZ(), 700.0, 6);

  fighters = hori(fighter_ids(), midX() - 30.0, midZ(), 700.0);
  const char16_t* const names[] = {u"Rudolf √",     u"Weapon Swing √", u"\"Ball\" ×",
                                   u"Punch √",      u"Weapon Threw ×", u"Arrow √"};
  for (std::size_t i = 0; i < 6; ++i) {
    if (Entity* const f = entity_at(fighters, i)) f->set_name(Value(std::u16string(names[i])));
  }

  // 2 号手里塞一根棍（位置对齐他到的那一格），5 号先左移 50 再塞棒球棍。
  Entity* const f1 = entity_at(fighters, 1);
  Entity* const w1 = spawn(std::u16string(oid::kWeapon_Stick));
  if (w1 != nullptr && f1 != nullptr) {
    w1->set_position(Value(f1->position.x), Value(f1->position.y), Value(f1->position.z));
    w1->attach();
  }

  Entity* const f4 = entity_at(fighters, 4);
  if (f4 != nullptr) f4->set_position(Value(f4->position.x - 50.0), Value(), Value());
  Entity* const w2 = spawn(std::u16string(oid::kWeapon_baseball));
  if (w2 != nullptr && f4 != nullptr) {
    w2->set_position(Value(f4->position.x), Value(f4->position.y), Value(f4->position.z));
    w2->attach();
  }

  for (Entity* const f : fighters) f->set_team(u"1");
}

}
}
