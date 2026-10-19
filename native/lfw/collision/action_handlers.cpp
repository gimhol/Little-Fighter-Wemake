#include "lfw/collision/action_handlers.h"

#include <cstdint>
#include <variant>

#include "lfw/defines/action_type.h"
#include "lfw/defines/hit_flag.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/entity/face_helper.h"
#include "lfw/utils/container_help/ensure.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace collision {
namespace {

bool missing(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

bool is_number(const Value& v) { return std::holds_alternative<double>(v); }

bool bit_and(double x, double y) {
  return (static_cast<int32_t>(x) & static_cast<int32_t>(y)) != 0;
}

Value data_of(const Value& action) { return field_or(action, u"data"); }

Value field_of(const Value& holder, const char16_t* key) { return field_or(holder, key); }

void apply_buff(const ActionEnv& env, const Value& action, Entity& attacker, Entity& victim) {
  const Value data = data_of(action);
  if (!truthy(data)) return;
  Value hitflag = field_or(data, u"hitflag");
  const Value duration_v = field_or(data, u"duration");
  const double duration = missing(duration_v) ? 0 : to_number(duration_v);
  const Value buff_v = field_or(data, u"buff");
  const std::u16string kind = missing(buff_v) ? std::u16string() : to_string(buff_v);
  if (is_number(hitflag)) {
    const double hf = to_number(hitflag);
    if (!bit_and(hf, to_number(victim.data_type()))) return;
    const double ally_flag = env.is_ally(attacker, victim) ? static_cast<double>(HitFlag::Ally)
                                                          : static_cast<double>(HitFlag::Enemy);
    if (!bit_and(hf, ally_flag)) return;
  }
  buff::grant_buff(kind, &attacker, &victim, duration);
}

}

Value run_action(const ActionEnv& env, const std::u16string& type, const Value& action,
                 Entity& attacker, Entity& victim, const Value& injury,
                 const Value& real_injury) {
  if (type == action_type::kA_SOUND) {
    const Value data = data_of(action);
    attacker.play_sound(field_of(data, u"path"), field_of(data, u"pos"));
    return Value();
  }
  if (type == action_type::kA_NEXT_FRAME) {
    attacker.enter_frame(data_of(action));
    return Value();
  }
  if (type == action_type::kA_SET_PROP) {
    const Value data = data_of(action);
    const Value name = field_of(data, u"name");
    if (!truthy(name)) return Value();
    attacker.set_prop(to_string(name), field_of(data, u"value"));
    return Value();
  }
  if (type == action_type::kV_SOUND) {
    const Value data = data_of(action);
    victim.play_sound(field_of(data, u"path"), field_of(data, u"pos"));
    return Value();
  }
  if (type == action_type::kV_NEXT_FRAME) {
    victim.enter_frame(data_of(action));
    return Value();
  }
  if (type == action_type::kV_SET_PROP) {
    const Value data = data_of(action);
    const Value name = field_of(data, u"name");
    if (!truthy(name)) return Value();
    victim.set_prop(to_string(name), field_of(data, u"value"));
    return Value();
  }
  if (type == action_type::kA_BROKEN_DEFEND || type == action_type::kA_DEFEND ||
      type == action_type::kV_BROKEN_DEFEND || type == action_type::kV_DEFEND) {
    return Value(0.0);
  }
  if (type == action_type::kA_REBOUND_VX) {
    attacker.set_velocity_x(Value(-attacker.velocity.x));
    return Value();
  }
  if (type == action_type::kV_REBOUND_VX) {
    victim.set_velocity_x(Value(-victim.velocity.x));
    return Value();
  }
  if (type == action_type::kV_TURN_FACE) {
    victim.set_facing(entity::turn_face(Value(victim.facing)));
    return Value();
  }
  if (type == action_type::kV_TURN_TEAM) {
    Value team = field_of(data_of(action), u"team");
    if (!truthy(team)) team = Value(attacker.team());
    victim.set_team(to_string(team));
    return Value();
  }
  if (type == action_type::kFUSION) {
    const Value data = data_of(action);
    env.mt_set_mark(u"cact_" + std::u16string(action_type::kFUSION));
    Value oid_data;
    if (!env.find_data(to_string(field_of(data, u"oid")), oid_data)) return Value();
    const int a_v = entity::is_bot_ctrl(attacker.ctrl()) ? 0 : 1;
    const int v_v = entity::is_bot_ctrl(victim.ctrl()) ? 0 : 1;
    Entity* f1 = nullptr;
    Entity* f2 = nullptr;
    if (a_v > v_v) {
      f1 = &attacker;
      f2 = &victim;
    } else if (a_v < v_v) {
      f1 = &victim;
      f2 = &attacker;
    } else if (static_cast<int>(env.mt_int()) % 2) {
      f1 = &attacker;
      f2 = &victim;
    } else {
      f1 = &victim;
      f2 = &attacker;
    }
    const double hp = f1->hp() + f2->hp();
    const double hp_r = max({hp, f1->hp_r(), f2->hp_r()});
    f1->set_dismiss_data(f1->data());
    f1->transform(oid_data);
    f1->set_hp(min(hp, f1->hp_max()));
    f1->set_hp_r(min(hp_r, f1->hp_max()));
    Value fuse = f1->fuse_bys_of();
    f1->set_fuse_bys(ensure(fuse, Value(f2->id)));
    const Value time_v = field_of(data, u"time");
    f1->set_dismiss_time(missing(time_v) ? Value(NullTag{}) : time_v);
    f1->set_mp(f1->mp_max());
    f2->set_invulnerable(1000000);
    f2->set_motionless(1000000);
    f2->set_invisible(1000000);
    const Value act = field_of(data, u"act");
    if (truthy(act)) f1->enter_frame(act);
    return Value();
  }
  if (type == action_type::kBROADCAST) {
    env.broadcast(to_string(field_of(data_of(action), u"msg")));
    return Value();
  }
  if (type == action_type::kVALUE_STEAL) {
    const Value d = data_of(action);
    if (!truthy(d)) return Value();
    const Value over_injury = field_of(d, u"over_injury");
    const Value itr_value = truthy(over_injury) ? injury : real_injury;
    if (!truthy(itr_value)) return Value();
    Entity* t = nullptr;
    const double target = to_number(field_of(d, u"target"));
    if (target == 1) {
      const std::u16string* const se = attacker.src_emitter();
      if (se != nullptr && !se->empty()) t = env.find_entity(*se);
    } else if (target == 2) {
      const std::u16string* const em = attacker.emitter();
      if (em != nullptr && !em->empty()) t = env.find_entity(*em);
    } else if (target == 3) {
      t = attacker.bearer;
    } else {
      t = &attacker;
    }
    if (t == nullptr) return Value();
    if (!truthy(field_of(d, u"revive")) && t->hp() <= 0) return Value();
    const Value mp_v = field_of(d, u"mp");
    if (truthy(mp_v)) t->set_mp(min(t->mp() + to_number(mp_v), t->mp_max()));
    const Value itr_mp_ratio = field_of(d, u"itr_mp_ratio");
    if (truthy(itr_mp_ratio))
      t->set_mp(min(t->mp() + round(to_number(itr_value) * to_number(itr_mp_ratio)),
                    t->mp_max()));
    const Value hp_r_v = field_of(d, u"hp_r");
    if (truthy(hp_r_v)) t->set_hp_r(min(t->hp_r() + to_number(hp_r_v), t->hp_max()));
    const Value itr_hp_r_ratio = field_of(d, u"itr_hp_r_ratio");
    if (truthy(itr_hp_r_ratio))
      t->set_hp_r(min(t->hp_r() + round(to_number(itr_value) * to_number(itr_hp_r_ratio)),
                      t->hp_max()));
    if (truthy(field_of(d, u"over_hp_r"))) {
      const Value hp_v = field_of(d, u"hp");
      if (truthy(hp_v)) t->set_hp(min(t->hp() + to_number(hp_v), t->hp_r()));
      if (truthy(itr_hp_r_ratio))
        t->set_hp(
            min(t->hp() + round(to_number(itr_value) * to_number(itr_hp_r_ratio)), t->hp_r()));
    } else {
      const Value hp_v = field_of(d, u"hp");
      if (truthy(hp_v)) t->set_hp(min(t->hp() + to_number(hp_v), t->hp_max()));
      const Value itr_hp_ratio = field_of(d, u"itr_hp_ratio");
      if (truthy(itr_hp_ratio))
        t->set_hp(min(t->hp() + round(to_number(itr_value) * to_number(itr_hp_ratio)),
                      t->hp_max()));
    }
    t->set_hp_r(max(t->hp_r(), t->hp()));
    return Value();
  }
  if (type == action_type::kV_BUFF) {
    apply_buff(env, action, attacker, victim);
    return Value();
  }
  if (type == action_type::kA_BUFF) {
    apply_buff(env, action, victim, attacker);
    return Value();
  }
  if (type == action_type::kERROR) {
    env.alert(to_string(field_of(data_of(action), u"msg")));
    return Value();
  }
  if (type == action_type::kNONE) return Value();
  return Value();
}

}
}
