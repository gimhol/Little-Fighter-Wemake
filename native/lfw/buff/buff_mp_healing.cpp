#include "lfw/buff/buff_mp_healing.h"

#include "lfw/world.h"

#include "lfw/utils/math/base.h"

namespace lfw {
namespace buff {

const char16_t* Buff_MpHealing::KIND = u"MpHealing";

double Buff_MpHealing::duration_of(const Entity& e, double amount) {
  const double value = max(1.0, to_number(e.dataset(u"mp_healing_value")));
  const double ticks = max(1.0, to_number(e.dataset(u"mp_healing_ticks")));
  return ceil(amount / value) * ticks;
}

void Buff_MpHealing::mount() {
  Buff::mount();
  const std::vector<std::u16string>& victims = this->victims();
  for (size_t i = 0; i < victims.size(); ++i) {
    Entity* victim = world().find_entity(victims[i]);
    if (victim == nullptr) continue;
    victim->set_mark(std::u16string(KIND), id());
    set_ticks(to_number(victim->dataset(u"mp_healing_ticks")));
  }
}

void Buff_MpHealing::on_tick(Entity* attacker, Entity* victim) {
  (void)attacker;
  if (victim == nullptr) return;
  victim->set_mp(min(to_number(victim->mp_max()),
                           to_number(victim->mp()) +
                               to_number(victim->dataset(u"mp_healing_value"))));
}

void Buff_MpHealing::unmount() {
  const std::vector<std::u16string>& victims = this->victims();
  for (size_t i = 0; i < victims.size(); ++i) {
    Entity* victim = world().find_entity(victims[i]);
    if (victim == nullptr) continue;
    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));
  }
  Buff::unmount();
}

}
}
