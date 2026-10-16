#include "lfw/ui/component/tests/others/bottoms_up.h"

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

// TS 的 `this.figters.forEach(v => v.ctrl.click(GK.Attack))`：端口跳过空指针 / 没控制器的。
template <typename Fn>
void each_ctrl(const std::vector<Entity*>& figters, Fn fn) {
  for (Entity* const f : figters) {
    if (f == nullptr) continue;
    controller::BaseController* const c = f->ctrl();
    if (c != nullptr) fn(*c);
  }
}

}  // namespace

BottomsUp::BottomsUp(Tests& owner) : TestCase(owner) {
  name = u"Bottoms Up Drop Test (Alcohol Abuse Results in Harm to Your Health)";
  // TS 两个 work 内容相同（各点一次 `Attack`），差 1000ms。
  _director
      .offset(1000.0,
              {
                  [this]() {
                    each_ctrl(figters, [](controller::BaseController& c) { c.click({gk::ka}); });
                  },
                  [this]() {
                    each_ctrl(figters, [](controller::BaseController& c) { c.click({gk::ka}); });
                  },
              })
      .sort_actions();
}

void BottomsUp::enter() {
  director().reset();
  const std::vector<std::u16string> bandit{std::u16string(oid::kBandit)};
  figters = circle(bandit, midX(), midZ(), 100.0, 100.0, 8);
  const std::vector<Entity*> outer = circle(bandit, midX(), midZ(), 200.0, 200.0, 8);
  figters.insert(figters.end(), outer.begin(), outer.end());

  // 两圈武器：TS 原文也没接这两行的返回值（武器进世界即可）。
  circle({std::u16string(oid::kWeapon_Beer)}, midX(), midZ(), 100.0, 100.0, 8);
  circle({std::u16string(oid::kWeapon_milk)}, midX(), midZ(), 200.0, 200.0, 8);
}

}
}
