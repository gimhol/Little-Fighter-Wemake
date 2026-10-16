#include "lfw/ui/component/tests/others/move_stay_come.h"

#include <cstddef>
#include <string>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"

namespace lfw {
namespace ui {

namespace {

// TS 的 `this.figters[i].ctrl.click(k)`（0..3 号）与 `this.figters.forEach(...)`：端口统一
// 走这两条 —— 越界 / 没挂控制器的给 `nullptr`，调用点跳过。
controller::BaseController* ctrl_at(const std::vector<Entity*>& figters, std::size_t i) {
  if (i >= figters.size()) return nullptr;
  Entity* const e = figters[i];
  return e != nullptr ? e->ctrl() : nullptr;
}

void click_each(const std::vector<Entity*>& figters, const char16_t* key) {
  for (Entity* const e : figters) {
    if (e == nullptr) continue;
    controller::BaseController* const c = e->ctrl();
    if (c != nullptr) c->click({key});
  }
}

}  // namespace

MoveStayCome::MoveStayCome(Tests& owner) : TestCase(owner) {
  name = u"MOVE(DADA) / STAY(DDDD) / COME(DJDJ) / FOLLOW(DJJJ)";
  _director
      .offset(50.0, {[this]() { click_each(figters, gk::kd); }})
      .offset(50.0, {[this]() {
                const char16_t* const keys[] = {gk::kd, gk::kj, gk::ka, gk::kj};
                for (std::size_t i = 0; i < 4; ++i) {
                  if (controller::BaseController* const c = ctrl_at(figters, i))
                    c->click({keys[i]});
                }
              }})
      .offset(50.0, {[this]() {
                const char16_t* const keys[] = {gk::kd, gk::kd, gk::kd, gk::kj};
                for (std::size_t i = 0; i < 4; ++i) {
                  if (controller::BaseController* const c = ctrl_at(figters, i))
                    c->click({keys[i]});
                }
              }})
      .offset(50.0, {[this]() {
                const char16_t* const keys[] = {gk::kd, gk::kj, gk::ka, gk::kj};
                for (std::size_t i = 0; i < 4; ++i) {
                  if (controller::BaseController* const c = ctrl_at(figters, i))
                    c->click({keys[i]});
                }
              }});
}

void MoveStayCome::enter() {
  director().reset();
  figters = hori({std::u16string(oid::kTemplate)}, midX(), midZ(), 320.0, 4);
  for (std::size_t i = 0; i < figters.size(); ++i) {
    Entity* const v = figters[i];
    // TS `new LocalController(\`MoveStayCome_${i}\`, v)` ⇒ 端口的池化版本。
    v->set_ctrl(lfw.acquire_local_ctrl(u"MoveStayCome_" + number_to_string(static_cast<double>(i)),
                                       *v));
  }
}

}
}
