#include "lfw/ui/component/player_score.h"

#include <cmath>
#include <string>
#include <utility>
#include <vector>

#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/ui/uinode.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

const ClazzTag* PlayerScore::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& PlayerScore::TAGS() {
  static const std::vector<std::u16string> tags{u"PlayerScore"};
  return tags;
}

double PlayerScore::index() { return num(0).value_or(-1.0); }

Entity* PlayerScore::fighter() {
  const double idx = index();
  if (idx < 0) return nullptr;
  const std::vector<std::pair<std::u16string, Entity*>>& arr = world().puppets;
  const size_t i = static_cast<size_t>(idx);
  if (idx >= static_cast<double>(arr.size())) return nullptr;
  return arr[i].second;
}

std::optional<bool> PlayerScore::lose() {
  Entity* const fighter = this->fighter();
  if (fighter == nullptr) return std::optional<bool>();
  if (fighter->hp() > 0) return false;
  for (Entity* const o : world().entities) {
    if (o != fighter && entity::is_fighter(*o) && o->hp() > 0 &&
        o->team() == fighter->team()) {
      return false;
    }
  }
  return true;
}

void PlayerScore::update(double dt) {
  (void)dt;
  node.set_visible(fighter() != nullptr);
}

}
}
