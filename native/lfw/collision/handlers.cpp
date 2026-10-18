#include "lfw/collision/handlers.h"

#include <variant>

#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/type_cast.h"

namespace lfw {
namespace collision {
namespace {

bool missing(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

}

void handle_stiffness(Collision& c) {
  const Value m = field_or(c.itr, u"motionless");
  const Value motionless = missing(m) ? c.env->attacker_itr_motionless(c) : m;
  c.env->attacker_set_motionless(c, motionless);
  const Value s = field_or(c.itr, u"shaking");
  const Value shaking = missing(s) ? field_or(c.dataset, u"itr_shaking") : s;
  c.env->victim_set_shaking(c, shaking);
}

void handle_body_goto(Collision& c) { handle_stiffness(c); }

void handle_super_punch_me(Collision& c) { c.env->victim_add_v_rest(c); }

void handle_weapon_picked(Collision& c) { c.env->attacker_pick_victim(c); }

void handle_rest(Collision& c) {
  if (c.rest) {
    c.env->victim_add_v_rest(c);
    return;
  }
  const Value arest_v = field_or(c.itr, u"arest");
  const double arest = truthy(arest_v) ? to_number(arest_v) : to_number(field_or(c.dataset, u"itr_arest"));
  const double base = max(to_number(field_or(c.dataset, u"min_arest")),
                          arest + to_number(field_or(c.dataset, u"arest_offset")));
  c.env->attacker_set_arest(c, base);
}

void handle_itr_kind_magic_flute(Collision& c) {
  handle_rest(c);
  const std::u16string bid = u"magic_flute_to_" + c.vid;
  if (c.env->buff_get(bid)) {
    c.env->buff_lifetime_zero(bid);
    return;
  }
  const std::u16string kind = to_string(field_or(c.itr, u"kind"));
  if (!c.env->buff_create(kind, bid)) return;
  c.env->buff_set_attacker(bid, c.aid);
  c.env->buff_set_victim(bid, c.vid);
  c.env->buff_mount(bid);
}

}
}
