#include "lfw/collision/weapon_is_hit.h"

#include "lfw/collision/handlers.h"
#include "lfw/defines/collision_defaults.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/spark_enum.h"
#include "lfw/defines/weapon_type.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace collision {
namespace {

WeaponIsHitEnv g_env;

Value index_0(const Value& holder) {
  const Array* arr = as_array(holder);
  if (arr != nullptr) {
    if (arr->size() == 0) return Value();
    return arr->at(0);
  }
  const Object* o = as_object(holder);
  if (o != nullptr) {
    const Value* p = o->get(u"0");
    if (p != nullptr) return *p;
  }
  return Value();
}

void zero_hp(Entity& e) {
  e.set_hp_r(0.0);
  e.set_hp(0.0);
}

}

const WeaponIsHitEnv& weapon_is_hit_env() { return g_env; }
void set_weapon_is_hit_env(const WeaponIsHitEnv& env) { g_env = env; }

void handle_weapon_is_hit(Collision& c) {
  handle_rest(c);
  handle_stiffness(c);
  handle_injury(c, 1.0, false);

  Entity* a = g_env.find_entity(c.aid);
  Entity* v = g_env.find_entity(c.vid);
  if (a == nullptr || v == nullptr) return;

  v->set_dropping(false);
  const Value bdefend = field_or(c.itr, u"bdefend");
  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {
    zero_hp(*v);
  }

  const Value fall = field_or(c.itr, u"fall");
  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));

  const SparkPoint sp = g_env.spark_point(c, c.a_cube, c.b_cube);
  g_env.spark(sp.x, sp.y, sp.z,
              is_fly ? spark_enum::kSilentCriticalHit : spark_enum::kSilentHit);

  const ItrVelocity iv = g_env.calc_velocity(c);
  double vx = iv.x;
  const double vy = iv.y;
  const double vz = iv.z;
  const Value base_type = Value(v->base_type());
  const bool is_base_ball =
      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||
      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));

  if (!strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Heavy))) || is_fly) {
    v->set_velocity(Value(vx), Value(vy), Value(vz));
    v->leave_ground();
    g_env.mt_mark(u"hwih_1");
    Value nid;
    if (is_base_ball && (vx >= 6 || vx <= -6)) {
      nid = g_env.mt_pick(v->data_indexes_of(u"throwings"));
    } else {
      nid = g_env.mt_pick(v->data_indexes_in_the_skys());
    }
    v->enter_frame_by_id(nid);
  }

  if (strict_equals(a->data_id(), Value(oid::kWeapon_Stick)) && is_base_ball) {
    vx = a->facing * 2;
    g_env.mt_mark(u"hwih_2");
    v->enter_frame_by_id(index_0(v->data_indexes_of(u"throwings")));
    v->set_velocity(Value(vx), Value(), Value());
  }

  if (is_fly && v->bearer == nullptr) {
    v->set_team(a->team());
  }
}

}
}
