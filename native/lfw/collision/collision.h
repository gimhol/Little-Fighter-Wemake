#pragma once

#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "lfw/collision/actor_handle.h"
#include "lfw/core/value.h"

namespace lfw {
namespace collision {

struct Collision;

struct HandlersEnv {
  std::function<void(Collision& c)> victim_add_v_rest;
  std::function<void(Collision& c)> attacker_pick_victim;
  std::function<Value(const Collision& c)> attacker_itr_motionless;
  std::function<void(const Collision& c, const Value& v)> attacker_set_motionless;
  std::function<void(const Collision& c, const Value& v)> victim_set_shaking;
  std::function<void(const Collision& c, double v)> attacker_set_arest;
  std::function<bool(const std::u16string& id)> buff_get;
  std::function<void(const std::u16string& id)> buff_lifetime_zero;
  std::function<bool(const std::u16string& kind, const std::u16string& id)> buff_create;
  std::function<void(const std::u16string& id, const std::u16string& attacker_id)>
      buff_set_attacker;
  std::function<void(const std::u16string& id, const std::u16string& victim_id)>
      buff_set_victim;
  std::function<void(const std::u16string& id)> buff_mount;
};

struct Cube {
  double left = 0;
  double right = 0;
  double bottom = 0;
  double top = 0;
  double near = 0;
  double far = 0;
};

struct CollisionCoreEnv {
  std::function<Cube(const ActorHandle& a, const Value& frame, const Value& box)> get_bounding;
  std::function<Value()> dataset;
  std::function<bool(const Collision& c)> victim_get_v_rest;
  std::function<bool(const Collision& c)> attacker_is_ally;
  std::function<Collision&()> acquire_collision;
  std::function<std::u16string()> new_id;
  std::function<bool()> dev;
  std::function<void(const std::u16string& msg)> log;
  std::function<Value(const Value& tester)> tester_debug;
  std::function<bool(const Value& tester, Collision& c)> tester_run;
  std::function<bool(const std::u16string& id, ActorHandle& out)> find_entity;
  std::function<bool(const std::u16string& id, Value& out)> find_object_data;
  std::function<Value(double data_type)> priority_of;
  std::function<bool(Collision& c)> load_handlers;
};

struct Collision {
  const HandlersEnv* env = nullptr;
  const CollisionCoreEnv* core = nullptr;
  std::u16string id;
  ActorHandle attacker;
  ActorHandle victim;
  Value itr;
  Value bdy;
  Value aframe;
  Value bframe;
  Cube a_cube;
  Cube b_cube;
  double ax = 0;
  double ay = 0;
  double az = 0;
  double vx = 0;
  double vy = 0;
  double vz = 0;
  double dx = 0;
  double dy = 0;
  double dz = 0;
  double m_distance = 0;
  std::u16string adata_id;
  std::u16string vdata_id;
  std::u16string aframe_id;
  std::u16string bframe_id;
  double itr_index = 0;
  double bdy_index = 0;
  Value priority;
  std::shared_ptr<std::vector<std::u16string>> handlers;
  Value injury;
  Value injury_r;
  Value real_injury;
  Value real_injury_r;
  double rest = 0;
  std::u16string aid;
  std::u16string vid;
  Value dataset;
};

struct CollisionInits {
  ActorHandle attacker;
  ActorHandle victim;
  Value itr;
  Value bdy;
  Value aframe;
  Value bframe;
  double itr_index = 0;
  double bdy_index = 0;
};

struct CollisionSnapshot {
  std::u16string aid;
  std::u16string vid;
  std::u16string adata_id;
  std::u16string vdata_id;
  std::u16string aframe_id;
  std::u16string bframe_id;
  double itr_index = 0;
  double bdy_index = 0;
  double ax = 0;
  double ay = 0;
  double az = 0;
  double vx = 0;
  double vy = 0;
  double vz = 0;
  double dx = 0;
  double dy = 0;
  double dz = 0;
  double m_distance = 0;
  double rest = 0;
};

Collision& collision_new(const CollisionCoreEnv& core, const CollisionInits& o);
Collision* collision_get(const CollisionCoreEnv& core, const ActorHandle& attacker,
                         const ActorHandle& victim);
bool collision_test(Collision& c);
CollisionSnapshot collision_to_snapshot(const Collision& c);
Collision* collision_from_snapshot(const CollisionCoreEnv& core, const CollisionSnapshot& s);
void collision_clone(const CollisionCoreEnv& core, const Collision& src, Collision& out);

void handle_super_punch_me(Collision& c);
void handle_weapon_picked(Collision& c);
void handle_stiffness(Collision& c);
void handle_body_goto(Collision& c);
void handle_rest(Collision& c);
void handle_itr_kind_magic_flute(Collision& c);

}
}
