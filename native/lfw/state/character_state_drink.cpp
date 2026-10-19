#include "lfw/state/character_state_drink.h"

#include <memory>
#include <string>

#include "lfw/defines/frame_id.h"
#include "lfw/entity/drink_info.h"
#include "lfw/utils/math/base.h"
#include "lfw/entity/entity.h"

namespace lfw {
namespace state {
namespace {

Value next_frame(const Value& id) {
  Object o;
  o.set(u"id", id);
  return Value(std::make_shared<Object>(o));
}

}

CharacterState_Drink::CharacterState_Drink(Value state) : CharacterState_Base(std::move(state)) {}

void CharacterState_Drink::update(Entity& e) {
  CharacterState_Base::update(e);
  if (!e.has_holding()) return;
  DrinkInfo* drink = e.holding_drink();
  if (drink == nullptr) return;

  const bool hp_h_empty = drink->hp_h_empty();
  const bool hp_r_empty = drink->hp_r_empty();
  const bool mp_h_empty = drink->mp_h_empty();
  if (!hp_h_empty && drink->hp_h_ticks().add()) {
    e.set_hp(min(e.hp_max(),
                       e.hp() + to_number(drink->hp_h_value())));
    drink->set_hp_h(Value(to_number(drink->hp_h()) + to_number(drink->hp_h_value())));
  }
  if (!hp_r_empty && drink->hp_r_ticks().add()) {
    e.set_hp_r(min(e.hp_max(),
                         e.hp_r() + to_number(drink->hp_r_value())));
    drink->set_hp_r(Value(to_number(drink->hp_r()) + to_number(drink->hp_r_value())));
  }
  if (!mp_h_empty && drink->mp_h_ticks().add()) {
    e.set_mp(min(e.mp_max(),
                       e.mp() + to_number(drink->mp_h_value())));
    drink->set_mp_h(Value(to_number(drink->mp_h()) + to_number(drink->mp_h_value())));
  }
  if (hp_h_empty && hp_r_empty && mp_h_empty) {
    // TS 抓的是 drop **之前**的局部 `holding` 引用（`drop_holding()` 只清
    // `this.holding`，瓶子本身还在）⇒ 后面那几条写的都是这个指针。
    Entity* const held = e.holding;
    e.drop_holding();
    e.enter_frame(next_frame(Value(std::u16string(frame_id::kAuto))));
    e.holding_mt_mark(u"drink_drop");
    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;
    if (held != nullptr) {
      held->set_hp_r(1.0);
      held->set_hp(1.0);
      held->set_velocity(Value(vx), Value(6.0), Value(0.0));
    }
  }
}

}
}
