#include "lfw/ui/component/tests/bot/weapon_picking1.h"

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

// TS 的 `this.fighters.forEach(v => v.ctrl.…)`：端口对空指针 / 没挂控制器的实体跳过
// （TS 那几处会抛）。
template <typename Fn>
void each_ctrl(const std::vector<Entity*>& fighters, Fn fn) {
  for (Entity* const f : fighters) {
    if (f == nullptr) continue;
    controller::BaseController* const c = f->ctrl();
    if (c != nullptr) fn(*c);
  }
}

// TS 里的 `[OID.Weapon0 … OID.Weapon11]`（12 把，按编号顺序 ⇒ 圈的排布也一致）。
const std::vector<std::u16string>& weapon_ids() {
  static const std::vector<std::u16string> ids{
      std::u16string(oid::kWeapon0), std::u16string(oid::kWeapon1),
      std::u16string(oid::kWeapon2), std::u16string(oid::kWeapon3),
      std::u16string(oid::kWeapon4), std::u16string(oid::kWeapon5),
      std::u16string(oid::kWeapon6), std::u16string(oid::kWeapon7),
      std::u16string(oid::kWeapon8), std::u16string(oid::kWeapon9),
      std::u16string(oid::kWeapon10), std::u16string(oid::kWeapon11)};
  return ids;
}

}  // namespace

WeaponPicking1::WeaponPicking1(Tests& owner) : TestCase(owner) {
  name = u"Weapon Picking 1 (Weapon Spawn Earlier)";
  // TS 里这一段没有 `.sort()` ⇒ 端口同样按插入序推进。
  _director
      .offset(1000.0, {[this]() {
                each_ctrl(fighters, [](controller::BaseController& c) { c.ck({gk::ka}); });
              }})
      .repeat(9999.0, 1500.0,
              {
                  [this]() {
                    each_ctrl(fighters, [](controller::BaseController& c) {
                      c.kd({gk::kL}).ku({gk::kR});
                    });
                  },
                  [this]() {
                    each_ctrl(fighters, [](controller::BaseController& c) {
                      c.kd({gk::kR}).ku({gk::kL});
                    });
                  },
              });
}

void WeaponPicking1::enter() {
  director().reset();
  lfw.change_bg(u"bg_1");
  const std::vector<std::u16string> woids = weapon_ids();
  // TS 的循环体里还有一行注释掉的 `v.enter_frame_by_id(v.data.indexes?.on_ground)`。
  for (Entity* const w : circle(woids, midX(), midZ(), 100.0, 100.0)) w->attach();

  fighters = circle({std::u16string(oid::kJack)}, midX(), midZ(), 100.0, 100.0,
                    static_cast<int>(woids.size()));
  for (Entity* const v : fighters) {
    v->set_team(team_enum::kTeam_1);
    v->attach();
  }
}

}
}
