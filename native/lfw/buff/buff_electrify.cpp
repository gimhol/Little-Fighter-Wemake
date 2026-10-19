#include "lfw/buff/buff_electrify.h"

#include "lfw/world.h"

namespace lfw {
namespace buff {

const char16_t* Buff_Electrify::KIND = u"Electrify";

std::u16string Buff_Electrify::effect_oid() const { return std::u16string(u"fx"); }

std::u16string Buff_Electrify::effect_frame_id() const { return std::u16string(u"32"); }

void Buff_Electrify::place_effect(Entity* effect, Entity* victim) {
  place_effect_center(effect, victim);
}

void Buff_Electrify::mount() {
  Buff::mount();
  const std::vector<std::u16string>& victims = this->victims();
  for (size_t i = 0; i < victims.size(); ++i) {
    Entity* victim = world().find_entity(victims[i]);
    if (victim == nullptr) continue;
    victim->set_mark(std::u16string(KIND), id());
  }
}

void Buff_Electrify::unmount() {
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
