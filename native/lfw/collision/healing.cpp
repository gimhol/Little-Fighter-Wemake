#include "lfw/collision/healing.h"

#include "lfw/buff/buff_healing.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace collision {
namespace {

HealingEnv g_env;

}

const HealingEnv& healing_env() { return g_env; }

void set_healing_env(const HealingEnv& env) { g_env = env; }

void handle_healing(Collision& c) {
  const Value injury = field_or(c.itr, u"injury");
  if (!truthy(injury)) return;

  Entity* a = g_env.find_entity(c.aid);
  Entity* v = g_env.find_entity(c.vid);
  if (v == nullptr) return;

  buff::grant_buff(u"Healing", a, v, buff::Buff_Healing::duration_of(*v, to_number(injury)));
}

}
}
