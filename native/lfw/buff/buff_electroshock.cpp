#include "lfw/buff/buff_electroshock.h"

#include "lfw/world.h"

#include "lfw/defines/state_enum.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/utils/math/round_float.h"

namespace lfw {
namespace buff {

const char16_t* Buff_Electroshock::KIND = u"Electroshock";

void Buff_Electroshock::init() { set_ticks(3); }

std::u16string Buff_Electroshock::effect_oid() const { return std::u16string(u"fx"); }

void Buff_Electroshock::place_effect(Entity* effect, Entity* victim) {
  place_effect_center(effect, victim);
}

void Buff_Electroshock::on_tick(Entity* attacker, Entity* victim) {
  (void)attacker;
  if (victim == nullptr) return;
  if (!entity::is_fighter_data(victim->data())) return;
  const Value state = victim->state();
  if (strict_equals(state, Value(static_cast<double>(StateEnum::Falling)))) return;
  if (strict_equals(state, Value(static_cast<double>(StateEnum::Lying)))) return;
  victim->set_wait(Value(victim->wait + 1));
}

void Buff_Electroshock::mount() {
  Buff::mount();
  const std::vector<std::u16string>& victims = this->victims();
  for (size_t i = 0; i < victims.size(); ++i) {
    Entity* victim = world().find_entity(victims[i]);
    if (victim == nullptr) continue;
    const Value state = victim->state();
    if (equals(state, Value(static_cast<double>(StateEnum::Injured)))) continue;
    if (equals(state, Value(static_cast<double>(StateEnum::Falling)))) continue;
    set_duration(round_float(duration() / 2));
  }
}

}
}
