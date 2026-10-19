#include "lfw/collision/handlers3.h"

#include <variant>

#include "lfw/collision/handlers.h"
#include "lfw/collision/handlers2.h"
#include "lfw/defines/armor_enum.h"
#include "lfw/defines/collision_defaults.h"
#include "lfw/defines/spark_enum.h"
#include "lfw/defines/state_enum.h"
#include "lfw/defines/weapon_type.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/normalize.h"

namespace lfw {
namespace collision {
namespace {

Handlers3Env g_env;

bool missing(const Value& v) { return std::holds_alternative<std::monostate>(v); }

double fallback_number(const Value& v, double fallback) {
  return missing(v) ? fallback : to_number(v);
}

Value spark_type_of(const Value& fall, bool inclusive) {
  const bool critical = inclusive ? (truthy(fall) && to_number(fall) >= kDefaultFallValueCritical)
                                  : (truthy(fall) && to_number(fall) > kDefaultFallValueCritical);
  return Value(critical ? std::u16string(spark_enum::kSilentCriticalHit)
                        : std::u16string(spark_enum::kSilentHit));
}

}

const Handlers3Env& handlers3_env() { return g_env; }
void set_handlers3_env(const Handlers3Env& env) { g_env = env; }

void handle_itr_kind_whirlwind(Collision& c) {
  Entity* a = g_env.find_entity(c.aid);
  Entity* v = g_env.find_entity(c.vid);
  if (a == nullptr || v == nullptr) return;
  if (g_env.is_ball(*v)) return;
  double vx = v->velocity.x;
  double vy = v->velocity.y;
  double vz = v->velocity.z;
  const double ax = a->position.x;
  const double ay = a->position.y;
  const double az = a->position.z;
  const double px = v->position.x;
  const double py = v->position.y;
  const double pz = v->position.z;
  (void)ay;
  (void)py;
  const double dz = round(az - pz);
  const double dx = round(ax - px);
  const double x_direction = normalize(dx);
  const double z_direction = normalize(dz);
  const double max_vy = to_number(a->dataset(u"whirlwind_vy_max"));
  const double atom_time = to_number(a->dataset(u"atom_time"));
  const double acc_y = to_number(a->dataset(u"whirlwind_acc_y")) * atom_time;
  const double acc_x = to_number(a->dataset(u"whirlwind_acc_x")) * atom_time;
  const double acc_z = to_number(a->dataset(u"whirlwind_acc_z")) * atom_time;
  if (vy < max_vy) vy += acc_y;
  vx += x_direction * acc_x;
  vz += z_direction * acc_z;
  v->set_velocity(Value(vx), Value(vy), Value(vz));
  if (!g_env.is_weapon(*v)) return;
  if (v->bearer == nullptr &&
      !strict_equals(Value(v->base_type()), Value(static_cast<double>(WeaponEnum::Heavy)))) {
    v->set_team(a->team());
  }
  const double st = to_number(v->state());
  if (st == static_cast<double>(StateEnum::Weapon_OnHand) ||
      st == static_cast<double>(StateEnum::HeavyWeapon_OnHand) ||
      st == static_cast<double>(StateEnum::HeavyWeapon_InTheSky) ||
      st == static_cast<double>(StateEnum::Weapon_InTheSky)) {
    return;
  }
  v->enter_frame_by_id(v->data_in_the_skys_first());
}

void handle_ball_is_hit_a(Collision& c) {
  Entity* a = g_env.find_entity(c.aid);
  Entity* v = g_env.find_entity(c.vid);
  if (v == nullptr) return;
  handle_rest(c);
  handle_stiffness(c);
  const Value bdefend = field_or(c.itr, u"bdefend");
  if (truthy(bdefend) && to_number(bdefend) >= kDefaultForceBreakDefendValue) {
    v->set_hp_r(0.0);
    v->set_hp(0.0);
  }
  v->set_velocity(Value(0.0), Value(0.0), Value(0.0));
  const double st = to_number(v->state());
  if (st == static_cast<double>(StateEnum::Ball_Flying) ||
      st == static_cast<double>(StateEnum::Ball_Rebounding)) {
    // `v.team = a?.team`：`a` 缺席时 TS 赋 `undefined`；端口实体面的 `team` 是字符串 ⇒ 保留
    // 原视图那层的 `to_string(undefined)`（`u"undefined"`），行为逐字不变。
    v->set_team(a == nullptr ? to_string(Value()) : a->team());
  }
  double x = 0;
  double y = 0;
  double z = 0;
  g_env.spark_point(c, c.a_cube, c.b_cube, x, y, z);
  g_env.spark(x, y, z, spark_type_of(field_or(c.itr, u"fall"), false));
  v->play_sound(v->data_base_hit_sounds());
}

void handle_ball_is_hit_b(Collision& c) {
  Entity* v = g_env.find_entity(c.vid);
  if (v == nullptr) return;
  handle_rest(c);
  handle_stiffness(c);
  const Value bdefend = field_or(c.itr, u"bdefend");
  if (truthy(bdefend) && to_number(bdefend) >= kDefaultForceBreakDefendValue) {
    v->set_hp_r(0.0);
    v->set_hp(0.0);
  }
  v->set_velocity(Value(0.0), Value(0.0), Value(0.0));
  double x = 0;
  double y = 0;
  double z = 0;
  g_env.spark_point(c, c.a_cube, c.b_cube, x, y, z);
  g_env.spark(x, y, z, spark_type_of(field_or(c.itr, u"fall"), false));
  v->play_sound(v->data_base_hit_sounds());
}

bool handle_armor(Collision& c) {
  Entity* a = g_env.find_entity(c.aid);
  Entity* v = g_env.find_entity(c.vid);
  if (a == nullptr || v == nullptr) return false;
  const Value armor = v->armor;
  if (!truthy(armor) || !g_env.is_armor_work(c)) return false;
  const Value bdefend_v = field_or(c.itr, u"bdefend");
  const Value injury_v = field_or(c.itr, u"injury");
  Value fall_v = field_or(c.itr, u"fall");
  if (missing(fall_v)) fall_v = a->itr_fall(c.itr);
  const double bdefend = fallback_number(bdefend_v, 0);
  const double injury = fallback_number(injury_v, 0);
  const double fall = to_number(fall_v);
  const double armor_type = to_number(field_or(armor, u"type"));
  double decrease_value = 0;
  if (armor_type == static_cast<double>(ArmorEnum::Fall)) {
    decrease_value = fall;
  } else if (armor_type == static_cast<double>(ArmorEnum::Defend)) {
    decrease_value = bdefend;
  } else if (armor_type == static_cast<double>(ArmorEnum::Times)) {
    decrease_value = 1;
  } else if (armor_type == static_cast<double>(ArmorEnum::Injury)) {
    decrease_value = injury;
  }
  const bool is_full = v->toughness() == v->toughness_max();
  const double pre_toughness = v->toughness();
  v->set_toughness(pre_toughness - decrease_value);
  if (!is_full && pre_toughness < decrease_value) return false;
  const Value hit_sounds = field_or(armor, u"hit_sounds");
  const double injury_ratio =
      fallback_number(field_or(armor, u"injury_ratio"), kDefaultArmorInjuryRatio);
  const double motionless_ratio =
      fallback_number(field_or(armor, u"motionless_ratio"), kDefaultArmorMotionlessRatio);
  const double shaking_ratio =
      fallback_number(field_or(armor, u"shaking_ratio"), kDefaultArmorShakingRatio);
  const Value dead_sounds_v = field_or(armor, u"dead_sounds");
  const Value dead_sounds = missing(dead_sounds_v) ? hit_sounds : dead_sounds_v;
  double x = 0;
  double y = 0;
  double z = 0;
  g_env.spark_point(c, c.a_cube, c.b_cube, x, y, z);
  g_env.spark(x, y, z, spark_type_of(Value(fall), true));
  const Value sounds = v->toughness() > 0 ? hit_sounds : dead_sounds;
  if (truthy(sounds)) {
    const Array* arr = as_array(sounds);
    if (arr != nullptr) {
      for (size_t i = 0; i < arr->size(); ++i)
        g_env.play_sound_global(arr->at(i), x, y, z);
    }
  }
  const Value shaking_v = field_or(c.itr, u"shaking");
  const Value motionless_v = field_or(c.itr, u"motionless");
  const double shaking = missing(shaking_v) ? to_number(v->dataset(u"itr_shaking")) : to_number(shaking_v);
  const double motionless =
      missing(motionless_v) ? to_number(v->dataset(u"itr_motionless")) : to_number(motionless_v);
  a->set_motionless(round(motionless_ratio * motionless));
  v->set_shaking(round(shaking_ratio * shaking));
  v->set_velocity(Value(0.0), Value(0.0), Value(0.0));
  handle_rest(c);
  handle_injury(c, injury_ratio, true);
  return true;
}

}
}
