#include "lfw/collision/collision.h"

#include <cstdint>
#include <variant>

#include "lfw/defines/hit_flag.h"
#include "lfw/defines/itr_kind.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/container_help/spread_assign.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace collision {
namespace {

bool missing(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

bool itr_kind_is(const Value& itr, ItrKind k) {
  return strict_equals(field_or(itr, u"kind"), Value(static_cast<double>(k)));
}

bool bit_and(double x, double y) {
  return (static_cast<int32_t>(x) & static_cast<int32_t>(y)) != 0;
}

const Array* array_of(const Value& v) { return as_array(v); }

size_t array_len(const Value& v) {
  const Array* a = array_of(v);
  return a == nullptr ? 0 : a->size();
}

bool array_at(const Value& v, size_t index, Value& out) {
  const Array* a = array_of(v);
  if (a == nullptr || index >= a->size()) return false;
  out = a->at(index);
  return true;
}

bool index_by(const Value& holder, const std::u16string& k, Value& out) {
  const Object* o = as_object(holder);
  if (o != nullptr) {
    const Value* p = o->get(k);
    if (p == nullptr) return false;
    out = *p;
    return true;
  }
  const Array* a = as_array(holder);
  if (a == nullptr) return false;
  const double index = to_number(Value(k));
  if (!(index >= 0) || index >= static_cast<double>(a->size())) return false;
  out = a->at(static_cast<size_t>(index));
  return true;
}

}

Collision& collision_new(const CollisionCoreEnv& core, const CollisionInits& o) {
  const ActorHandle& a = o.attacker;
  const ActorHandle& v = o.victim;
  const double ax = a.px();
  const double ay = a.py();
  const double az = a.pz();
  const double vx = v.px();
  const double vy = v.py();
  const double vz = v.pz();
  const double dx = vx - ax;
  const double dy = vy - ay;
  const double dz = vz - az;
  const Cube a_cube = core.get_bounding(a, o.aframe, o.itr);
  const Cube b_cube = core.get_bounding(v, o.bframe, o.bdy);

  Value itr = o.itr;
  double itr_index = o.itr_index;
  if (itr_kind_is(o.itr, ItrKind::WeaponSwing)) {
    const Value prefab_id = a.bear_wpoint_attacking();
    Value prefab;
    if (!truthy(prefab_id))
      itr_index = -1;
    else if (!index_by(a.itr_prefabs(), to_string(prefab_id), prefab))
      itr_index = -1;
    else
      itr = spread_assign(o.itr, prefab);
  }

  const Value dataset = core.dataset();
  const double min_vrest = to_number(field_or(dataset, u"min_vrest"));
  const double vrest_offset = to_number(field_or(dataset, u"vrest_offset"));
  double rest = 0;
  if (!truthy(field_or(itr, u"arest")) && truthy(field_or(itr, u"vrest"))) {
    rest = max(min_vrest, to_number(field_or(itr, u"vrest")) + vrest_offset);
  } else if (itr_kind_is(itr, ItrKind::Normal) && a.marks_group_attack()) {
    const Value ar = field_or(itr, u"arest");
    const double base = truthy(ar) ? to_number(ar) : to_number(field_or(dataset, u"itr_arest"));
    rest = max(min_vrest, base + vrest_offset);
  }

  Collision& c = core.acquire_collision();
  c.id = rest ? core.new_id() : a.id();
  c.core = &core;
  c.attacker = a;
  c.victim = v;
  c.itr = itr;
  c.bdy = o.bdy;
  c.aframe = o.aframe;
  c.bframe = o.bframe;
  c.ax = ax;
  c.ay = ay;
  c.az = az;
  c.vx = vx;
  c.vy = vy;
  c.vz = vz;
  c.dx = dx;
  c.dy = dy;
  c.dz = dz;
  c.adata_id = a.data_id();
  c.vdata_id = v.data_id();
  c.aframe_id = to_string(field_or(o.aframe, u"id"));
  c.bframe_id = to_string(field_or(o.bframe, u"id"));
  c.itr_index = itr_index;
  c.bdy_index = o.bdy_index;
  c.m_distance = abs(dx) + abs(dy) + abs(dz);
  c.a_cube = a_cube;
  c.b_cube = b_cube;
  c.rest = rest;
  if (c.handlers)
    c.handlers->clear();
  else
    c.handlers = std::make_shared<std::vector<std::u16string>>();
  c.priority = core.priority_of(a.data_type());
  c.injury = Value(NullTag{});
  c.injury_r = Value(NullTag{});
  c.real_injury = Value(NullTag{});
  c.real_injury_r = Value(NullTag{});
  c.aid = a.id();
  c.vid = v.id();
  return c;
}

bool collision_test(Collision& c) {
  if (c.bdy_index < 0) return false;
  if (c.itr_index < 0) return false;
  const ActorHandle& a = c.attacker;
  const ActorHandle& v = c.victim;
  if (a.dropping()) return false;
  if (!c.rest && truthy(a.arest())) return false;
  if (c.rest && c.core->victim_get_v_rest(c)) return false;

  if (!itr_kind_is(c.itr, ItrKind::Heal)) {
    if (truthy(v.invulnerable())) return false;
    if (v.has_catcher() && !strict_equals(v.catcher_hurtable(), Value(1.0))) return false;
  }

  if ((itr_kind_is(c.itr, ItrKind::Pick) || itr_kind_is(c.itr, ItrKind::PickSecretly)) &&
      strict_equals(v.bot_ignore(), Value(1.0)) && a.is_bot_ctrl())
    return false;

  const Cube& ac = c.a_cube;
  const Cube& bc = c.b_cube;
  if (ac.left > bc.right || ac.right < bc.left || ac.bottom > bc.top || ac.top < bc.bottom ||
      ac.far > bc.near || ac.near < bc.far)
    return false;

  const double ally_flag = c.core->attacker_is_ally(c) ? static_cast<double>(HitFlag::Ally)
                                                      : static_cast<double>(HitFlag::Enemy);
  const Value bdy_flag_v = field_or(c.bdy, u"hit_flag");
  const Value itr_flag_v = field_or(c.itr, u"hit_flag");
  const double bdy_flag =
      missing(bdy_flag_v) ? static_cast<double>(HitFlag::AllEnemy) : to_number(bdy_flag_v);
  const double itr_flag =
      missing(itr_flag_v) ? static_cast<double>(HitFlag::AllEnemy) : to_number(itr_flag_v);
  if (!bit_and(itr_flag, v.data_type()) || !bit_and(bdy_flag, a.data_type()) ||
      (!bit_and(itr_flag, ally_flag) && !bit_and(bdy_flag, ally_flag)))
    return false;

  if (strict_equals(v.team(), a.team()) && truthy(v.emitter()) &&
      strict_equals(v.emitter(), a.emitter()) && strict_equals(v.spawn_time(), a.spawn_time()))
    return false;

  const Value bdy_tester = field_or(c.bdy, u"__tester");
  if (truthy(bdy_tester)) {
    const bool ret = c.core->tester_run(bdy_tester, c);
    if (c.core->dev()) c.core->log(u"bdy.__tester: " + to_string(c.core->tester_debug(bdy_tester)));
    if (!ret) return false;
  }
  const Value itr_tester = field_or(c.itr, u"__tester");
  if (truthy(itr_tester)) {
    const bool ret = c.core->tester_run(itr_tester, c);
    if (c.core->dev()) c.core->log(u"itr.__tester: " + to_string(c.core->tester_debug(itr_tester)));
    if (!ret) return false;
  }
  return c.core->load_handlers(c);
}

Collision* collision_get(const CollisionCoreEnv& core, const ActorHandle& attacker,
                         const ActorHandle& victim) {
  const Value itr_arr = field_or(attacker.frame(), u"itr");
  const Value bdy_arr = field_or(victim.frame(), u"bdy");
  const size_t ni = array_len(itr_arr);
  const size_t nj = array_len(bdy_arr);
  if (!ni || !nj) return nullptr;
  for (size_t i = 0; i < ni; ++i) {
    for (size_t j = 0; j < nj; ++j) {
      CollisionInits inits;
      inits.attacker = attacker;
      inits.victim = victim;
      if (!array_at(itr_arr, i, inits.itr)) continue;
      if (!array_at(bdy_arr, j, inits.bdy)) continue;
      inits.aframe = attacker.frame();
      inits.bframe = victim.frame();
      inits.itr_index = static_cast<double>(i);
      inits.bdy_index = static_cast<double>(j);
      Collision& c = collision_new(core, inits);
      if (!collision_test(c)) continue;
      return &c;
    }
  }
  return nullptr;
}

CollisionSnapshot collision_to_snapshot(const Collision& c) {
  CollisionSnapshot s;
  s.aid = c.aid;
  s.vid = c.vid;
  s.adata_id = c.adata_id;
  s.vdata_id = c.vdata_id;
  s.aframe_id = c.aframe_id;
  s.bframe_id = c.bframe_id;
  s.itr_index = c.itr_index;
  s.bdy_index = c.bdy_index;
  s.ax = c.ax;
  s.ay = c.ay;
  s.az = c.az;
  s.vx = c.vx;
  s.vy = c.vy;
  s.vz = c.vz;
  s.dx = c.dx;
  s.dy = c.dy;
  s.dz = c.dz;
  s.m_distance = c.m_distance;
  s.rest = c.rest;
  return s;
}

Collision* collision_from_snapshot(const CollisionCoreEnv& core, const CollisionSnapshot& s) {
  CollisionInits inits;
  if (!core.find_entity(s.aid, inits.attacker)) return nullptr;
  if (!core.find_entity(s.vid, inits.victim)) return nullptr;
  Value adata;
  if (!core.find_object_data(s.adata_id, adata)) return nullptr;
  Value vdata;
  if (!core.find_object_data(s.vdata_id, vdata)) return nullptr;
  if (!index_by(field_or(adata, u"frames"), s.aframe_id, inits.aframe)) return nullptr;
  if (!index_by(field_or(vdata, u"frames"), s.bframe_id, inits.bframe)) return nullptr;
  if (!index_by(field_or(inits.aframe, u"itr"), to_string(s.itr_index), inits.itr)) return nullptr;
  if (!index_by(field_or(inits.aframe, u"bdy"), to_string(s.bdy_index), inits.bdy)) return nullptr;
  inits.itr_index = s.itr_index;
  inits.bdy_index = s.bdy_index;
  Collision& ret = collision_new(core, inits);
  ret.ax = s.ax;
  ret.ay = s.ay;
  ret.az = s.az;
  ret.vx = s.vx;
  ret.vy = s.vy;
  ret.vz = s.vz;
  ret.dx = s.dx;
  ret.dy = s.dy;
  ret.dz = s.dz;
  ret.m_distance = s.m_distance;
  ret.rest = s.rest;
  return &ret;
}

void collision_clone(const CollisionCoreEnv& core, const Collision& src, Collision& out) {
  out = src;
  out.id = core.new_id();
}

}
}
