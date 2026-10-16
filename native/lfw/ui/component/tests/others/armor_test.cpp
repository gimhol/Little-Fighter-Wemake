#include "lfw/ui/component/tests/others/armor_test.h"

#include <cstddef>
#include <string>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"

namespace lfw {
namespace ui {

namespace {

Entity* entity_at(const std::vector<Entity*>& fighters, std::size_t i) {
  return i < fighters.size() ? fighters[i] : nullptr;
}

// TS 的 `for (const f of this.fighters) f.ctrl.click(GK.Attack)`：没挂控制器的跳过。
void click_each(const std::vector<Entity*>& fighters, const char16_t* key) {
  for (Entity* const f : fighters) {
    if (f == nullptr) continue;
    if (controller::BaseController* const c = f->ctrl()) c->click({key});
  }
}

// 后排（靠远平面）那两位：`[OID.Rudolf, OID.Henry]`。
const std::vector<std::u16string>& far_fighter_ids() {
  static const std::vector<std::u16string> ids{std::u16string(oid::kRudolf),
                                               std::u16string(oid::kHenry)};
  return ids;
}

// 前排那五位：`[OID.Deep, OID.Dennis, OID.Julian, OID.Bandit, OID.Davis]`。
const std::vector<std::u16string>& near_fighter_ids() {
  static const std::vector<std::u16string> ids{
      std::u16string(oid::kDeep), std::u16string(oid::kDennis), std::u16string(oid::kJulian),
      std::u16string(oid::kBandit), std::u16string(oid::kDavis)};
  return ids;
}

}  // namespace

ArmorTest1::ArmorTest1(Tests& owner) : TestCase(owner) {
  name = u"Armor Test 1";
  // TS 的 `.offset(300)` 没带 work ⇒ 一个 action 都不落（端口同样如此）；真正的第一拍在 3ms，
  // 之后每 3ms 一次。TS 也没写 `.sort()`。
  _director.offset(300.0, {}).repeat(999.0, 3.0, {[this]() { click_each(fighters, gk::ka); }});
}

void ArmorTest1::enter() {
  director().reset();
  // 5 个 Julian 靶子：远平面 2 个、近平面 5 个，都不显示名字（TS 原文也没接返回值）。
  const std::vector<Entity*> julian_far =
      hori({std::u16string(oid::kJulian)}, midX(), far_plane(), 600.0, 2);
  const std::vector<Entity*> julian_near =
      hori({std::u16string(oid::kJulian)}, midX(), near_plane(), 600.0, 5);
  for (Entity* const f : julian_far) f->name_visible = 0;
  for (Entity* const f : julian_near) f->name_visible = 0;

  fighters = hori(far_fighter_ids(), midX() - 30.0, far_plane(), 600.0);
  const std::vector<Entity*> near_side = hori(near_fighter_ids(), midX() - 30.0, near_plane(), 600.0);
  fighters.insert(fighters.end(), near_side.begin(), near_side.end());

  for (Entity* const f : fighters) {
    f->set_stat_bar(0.0);
    f->as_key_role(Value(true));
  }

  const char16_t* const names[] = {u"3rd atk hit", u"3rd atk hit", u"2rd atk hit", u"2rd atk hit",
                                   u"2rd atk hit", u"3rd atk hit", u"3rd atk hit"};
  for (std::size_t i = 0; i < 7; ++i) {
    if (Entity* const f = entity_at(fighters, i)) f->set_name(Value(std::u16string(names[i])));
  }

  for (Entity* const f : fighters) f->set_team(u"1");
}

}
}
