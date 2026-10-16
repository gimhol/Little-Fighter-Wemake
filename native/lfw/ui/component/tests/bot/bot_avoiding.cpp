#include "lfw/ui/component/tests/bot/bot_avoiding.h"

#include <cstddef>
#include <string>

#include "lfw/core/js_string.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"

namespace lfw {
namespace ui {

BotAvoiding::BotAvoiding(Tests& owner) : TestCase(owner) { name = u"Bot Chasing/Avoiding"; }

void BotAvoiding::enter() {
  entities = hori_2(std::u16string(oid::kBandit));
  for (std::size_t i = 0; i < entities.size(); ++i) {
    Entity* const e = entities[i];
    const bool chasing = i != 0;
    e->set_team(number_to_string(static_cast<double>(i) + 1.0));
    // `i ? Number.MAX_SAFE_INTEGER : 0`：只有"追"的那只带闪烁 / 无敌。
    e->set_blinking(chasing ? 9007199254740991.0 : 0.0);
    e->set_invulnerable(chasing ? 9007199254740991.0 : 0.0);
    e->as_key_role(Value(true));
    e->set_name(Value(std::u16string(chasing ? u"Chasing" : u"Avoiding")));
    e->set_ctrl(lfw.factory.create_ctrl(e->data_id(), lfw.new_id(), e));
  }
}

}
}
