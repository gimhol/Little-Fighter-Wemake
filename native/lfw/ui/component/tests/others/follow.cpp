#include "lfw/ui/component/tests/others/follow.h"

#include <cstddef>
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

// TS 的 `this.figters[i].ctrl.…`：下标越界 / 没挂控制器在 TS 里会抛，端口给 `nullptr`
// 由调用点跳过。
controller::BaseController* ctrl_at(const std::vector<Entity*>& figters, std::size_t i) {
  if (i >= figters.size()) return nullptr;
  Entity* const e = figters[i];
  return e != nullptr ? e->ctrl() : nullptr;
}

}  // namespace

BotFollow::BotFollow(Tests& owner) : TestCase(owner) {
  name = u"Bot Response FOLLOW(DJJJ)";
  // `Defend`/`Jump`/`Jump`/`Jump` = DJJJ（FOLLOW），随后往右走一步、再往左走一步，各歇 6 秒。
  _director
      .offset(50.0,
              {
                  [this]() {
                    if (controller::BaseController* const c = ctrl_at(figters, 0))
                      c->click({gk::kd});
                  },
                  [this]() {
                    if (controller::BaseController* const c = ctrl_at(figters, 0))
                      c->click({gk::kj});
                  },
                  [this]() {
                    if (controller::BaseController* const c = ctrl_at(figters, 0))
                      c->click({gk::kj});
                  },
                  [this]() {
                    if (controller::BaseController* const c = ctrl_at(figters, 0))
                      c->click({gk::kj});
                  },
                  [this]() {
                    if (controller::BaseController* const c = ctrl_at(figters, 0))
                      c->key_down({gk::kR}).key_up({gk::kL});
                  },
              })
      .wait(6000.0)
      .offset(50.0,
              {
                  [this]() {
                    if (controller::BaseController* const c = ctrl_at(figters, 0))
                      c->key_down({gk::kL}).key_up({gk::kR});
                  },
              })
      .wait(6000.0)
      .times(10000.0);
}

void BotFollow::enter() {
  director().reset();
  figters = hori_2(std::u16string(oid::kMark), 350.0);
  for (std::size_t i = 0; i < figters.size(); ++i) {
    Entity* const v = figters[i];
    // TS `new LocalController(\`MoveStayCome_${i}\`, v)` ⇒ 端口的池化版本。
    v->set_ctrl(lfw.acquire_local_ctrl(u"MoveStayCome_" + number_to_string(static_cast<double>(i)),
                                       *v));
    v->set_team(number_to_string(static_cast<double>(i) + 1.0));
    // TS 是链式赋值 `v.hp = v.hp_r = v.hp_max = 999999`：`hp_max` 落得最早。
    v->set_hp_max(999999.0);
    v->set_hp_r(999999.0);
    v->set_hp(999999.0);
  }

  for (Entity* const v : bandits_8()) {
    v->set_team(team_enum::kTeam_1);
    v->set_ctrl(lfw.factory.create_ctrl(Value(std::u16string(oid::kBandit)), u"", v));
  }
}

}
}
