#include "lfw/world_collision.h"
#include "lfw/lfw.h"

#include <algorithm>
#include <variant>

#include "lfw/base/expression.h"
#include "lfw/buff/buff_group_attack.h"
#include "lfw/collision/action_handlers.h"
#include "lfw/collision/ball_frozen.h"
#include "lfw/collision/calc_itr_velocity.h"
#include "lfw/collision/fall.h"
#include "lfw/collision/handlers.h"
#include "lfw/collision/handlers2.h"
#include "lfw/collision/handlers3.h"
#include "lfw/collision/handlers4.h"
#include "lfw/collision/healing.h"
#include "lfw/collision/is_armor_work.h"
#include "lfw/collision/is_fall.h"
#include "lfw/collision/n_bdy_defend.h"
#include "lfw/collision/n_bdy_normal.h"
#include "lfw/collision/stiffness.h"
#include "lfw/collision/weapon_is_hit.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/js_num.h"
#include "lfw/core/js_string.h"
#include "lfw/defines/defines_data.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/entity/summary_mgr.h"
#include "lfw/loader/get_val_from_collision.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/type_cast.h"
#include "lfw/world.h"

namespace lfw {
namespace {

bool is_missing(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

Value from_str(const std::u16string* p) { return p == nullptr ? Value() : Value(*p); }

Value position_value(double x, double y, double z) {
  Object o;
  o.set(u"x", Value(x));
  o.set(u"y", Value(y));
  o.set(u"z", Value(z));
  return Value(std::make_shared<Object>(o));
}

// `map[key]`：`Object` 用字符串键，`Array` 用 JS 的下标键判定。
Value index_of(const Value& holder, const std::u16string& key) {
  if (const Array* a = as_array(holder)) {
    uint32_t idx = 0;
    if (!is_array_index(key, idx)) return Value();
    if (idx >= a->size()) return Value();
    return a->at(idx);
  }
  const Object* o = as_object(holder);
  if (o == nullptr) return Value();
  const Value* p = o->get(key);
  return p == nullptr ? Value() : *p;
}

}

WorldCollisionHost::WorldCollisionHost(World& world) : _world(&world) { bind(); }

// `collision/` 的 11 个 Env 槽是**模块级**的，而宿主是每个 `World` 一份 ⇒ 发布与「当前发布者」
// 绑定：谁发布谁负责（析构时清空），换宿主时按需重发（一个进程里可以有多个 `World` 轮流步进，
// 只要不是同时）。这样旧宿主被销毁后，槽里不会留下指向它的 lambda。
namespace {
const WorldCollisionHost* g_published = nullptr;
}

WorldCollisionHost::~WorldCollisionHost() {
  // 只有「当前发布者」才允许清空：别的宿主可能正活着并拥有这些槽（清了会让它的下一次调用
  // 打到空 `std::function`）。
  if (g_published != this) return;
  clear_globals();
  g_published = nullptr;
}

// ───────────────────────────── 实体 ─────────────────────────────

// `lfw.mt.mark = mark`
void WorldCollisionHost::mt_mark(const std::u16string& mark) {
  MersenneTwister* const mt = _world->lfw().mt();
  if (mt != nullptr) mt->mark = mark;
}

// TS 的 `collision.attacker` 就是活实体；端口包成 `ActorHandle`（台面里退回快照）。
collision::ActorHandle WorldCollisionHost::actor_of(Entity& e) const {
  return collision::ActorHandle::of(e);
}

Entity* WorldCollisionHost::entity_of_collision_a(const collision::Collision& c) {
  return const_cast<Entity*>(c.attacker.entity());
}

Entity* WorldCollisionHost::entity_of_collision_v(const collision::Collision& c) {
  return const_cast<Entity*>(c.victim.entity());
}

// `is_fall` / `is_armor_work` / `calc_itr_velocity` / `calc_stiffness` 收的是 `Value` 形状的
// 实体/碰撞（那一刀是用用例数据喂的）⇒ 这里按 TS 读到的字段投影。
Value WorldCollisionHost::world_helpers_value() const {
  Object o;
  o.set(u"dataset", _world->world_dataset());
  return Value(std::make_shared<Object>(o));
}

Value WorldCollisionHost::entity_helpers_value(Entity& e) const {
  Object o;
  o.set(u"id", Value(e.id));
  o.set(u"data", e.data());
  o.set(u"frame", e.frame);
  o.set(u"position", position_value(e.position.x, e.position.y, e.position.z));
  o.set(u"facing", Value(e.facing));
  o.set(u"hp", Value(e.hp()));
  o.set(u"hp_r", Value(e.hp_r()));
  o.set(u"hp_max", Value(e.hp_max()));
  o.set(u"mp", Value(e.mp()));
  o.set(u"mp_max", Value(e.mp_max()));
  o.set(u"fall_value", Value(e.fall_value()));
  o.set(u"is_on_ground", Value(e.is_on_ground));
  o.set(u"armor", e.armor);
  o.set(u"team", Value(e.team()));
  o.set(u"emitter", from_str(e.emitter()));
  o.set(u"spawn_time", Value(e.spawn_time()));
  o.set(u"state", e.state());
  o.set(u"world", world_helpers_value());
  return Value(std::make_shared<Object>(o));
}

Value WorldCollisionHost::collision_helpers_value(const collision::Collision& c) const {
  Object o;
  Entity* const a = entity_of_collision_a(c);
  Entity* const v = entity_of_collision_v(c);
  if (a != nullptr) o.set(u"attacker", entity_helpers_value(*a));
  if (v != nullptr) o.set(u"victim", entity_helpers_value(*v));
  o.set(u"itr", c.itr);
  o.set(u"bdy", c.bdy);
  o.set(u"aframe", c.aframe);
  o.set(u"bframe", c.bframe);
  return Value(std::make_shared<Object>(o));
}

// `bdy.__tester` / `itr.__tester` / `action.tester` 在端口里存**源串**（DESIGN §64.2），
// 消费侧按需编译；编译结果按源串缓存（`Expression::run` 会写 `result`，与 TS 每次
// `run` 同一个实例的行为一致）。
bool WorldCollisionHost::tester_run(const Value& tester, collision::Collision& c) {
  const std::u16string* const src = std::get_if<std::u16string>(&tester);
  if (src == nullptr) return false;
  auto it = _testers.find(*src);
  if (it == _testers.end()) {
    it = _testers.emplace(*src, Expression<collision::Collision>(
                                    *src, loader::get_val_getter_from_collision))
             .first;
  }
  return it->second.run(c);
}

// TS 的 `bdy.__tester.debug()` 是表达式树的调试渲染（`stringify_expr_debug`），端口的
// `Expression` 还没有这一层 ⇒ 宿主给 `undefined`（只在 `Ditto.DEV` 的日志里可见，
// 见 DESIGN §78.4）。返回源串更接近 TS 的输出，但两者并不相等，故不给假值。
Value WorldCollisionHost::tester_debug(const Value& tester) {
  (void)tester;
  return Value();
}

// `lfw.acquire_collision()`（`LFW.ts:891`）永远给新对象（池没有回收者）；端口每次新建，
// 由 `reset_collisions()`（`World::step` 开头）整批释放。**必须每次新对象**：`handlers` 是
// `shared_ptr<vector>`，复用槽位会把已经拷进 `world.collisions` 的那份也清空。
collision::Collision& WorldCollisionHost::acquire_collision() {
  _collisions.push_back(std::make_unique<collision::Collision>());
  return *_collisions.back();
}

void WorldCollisionHost::reset_collisions() { _collisions.clear(); }

collision::Collision* WorldCollisionHost::collision_get(Entity& a, Entity& v) {
  ensure_published();
  return collision::collision_get(_core, actor_of(a), actor_of(v));
}

bool WorldCollisionHost::collision_test(collision::Collision& c) {
  ensure_published();
  return collision::collision_test(c);
}

void WorldCollisionHost::handle(collision::Collision& c) {
  ensure_published();
  c.env = &_handlers;
  c.core = &_core;
  // `handlers.cpp` 里的 `c.dataset` 是 TS 的 `attacker.world.dataset`（`handle_stiffness` 的
  // `itr_shaking` 回退、`handle_rest` 的 `itr_arest` / `min_arest` / `arest_offset`）——
  // 4C 那一刀在没有宿主时把它留成了「由 harness 直接设」的行为缝字段，这里补上真值。
  c.dataset = _world->world_dataset();
  collision::collisions_keeper().handle(c);
}

buff::Buff* WorldCollisionHost::find_buff(const std::u16string& id) const {
  for (size_t i = 0; i < _world->buffs.size(); ++i) {
    if (_world->buffs[i].first == id) return _world->buffs[i].second;
  }
  return nullptr;
}

buff::Buff* WorldCollisionHost::create_buff(const std::u16string& kind,
                                            const std::u16string& id) {
  buff::Buff* const b = _world->lfw().create_buff(kind, id);
  if (b == nullptr) return nullptr;
  // 出生即带 env（TS 的 `Buff` 构造就有 `lfw`）：`Factory::create_buff` 那一路只能给出
  // env=nullptr 的实例，`grant_buff` 虽也会补一次，但直接走 `create_buff` 的调用方（例如
  // 那些只判空的分支）拿到的对象在此之前是**不能碰**的。
  b->set_env(&_buff_env);
  bool replaced = false;
  for (size_t i = 0; i < _world->buffs.size(); ++i) {
    if (_world->buffs[i].first == id) {
      _world->buffs[i].second = b;
      replaced = true;
      break;
    }
  }
  if (!replaced) _world->buffs.emplace_back(id, b);
  return b;
}

// ───────────────────────────── Env 接线 ─────────────────────────────

void WorldCollisionHost::ensure_published() {
  if (g_published == this) return;
  publish_globals();
  g_published = this;
}

void WorldCollisionHost::clear_globals() {
  collision::set_keeper_env(collision::KeeperEnv());
  collision::set_handlers2_env(collision::Handlers2Env());
  collision::set_handlers3_env(collision::Handlers3Env());
  collision::set_handlers4_env(collision::Handlers4Env());
  collision::set_fall_env(collision::FallEnv());
  collision::set_nbdy_normal_env(collision::NbdyNormalEnv());
  collision::set_nbd_defend_env(collision::NbdDefendEnv());
  collision::set_weapon_is_hit_env(collision::WeaponIsHitEnv());
  collision::set_ball_frozen_env(collision::BallFrozenEnv());
  collision::set_healing_env(collision::HealingEnv());
}

void WorldCollisionHost::bind() {
  bind_core();
  bind_keeper();
  bind_handlers();
  bind_action();
  bind_handlers2();
  bind_handlers3();
  bind_handlers4();
  bind_fall();
  bind_nbdy_normal();
  bind_nbd_defend();
  bind_weapon_is_hit();
  bind_ball_frozen();
  bind_healing();
  bind_buff_env();
  ensure_published();
}

void WorldCollisionHost::publish_globals() {
  collision::set_keeper_env(_keeper);
  collision::set_handlers2_env(_handlers2);
  collision::set_handlers3_env(_handlers3);
  collision::set_handlers4_env(_handlers4);
  collision::set_fall_env(_fall);
  collision::set_nbdy_normal_env(_nbdy_normal);
  collision::set_nbd_defend_env(_nbd_defend);
  collision::set_weapon_is_hit_env(_weapon_is_hit);
  collision::set_ball_frozen_env(_ball_frozen);
  collision::set_healing_env(_healing);

}

void WorldCollisionHost::bind_core() {
  // `world.get_bounding(a, aframe, itr)`
  _core.get_bounding = [this](const collision::ActorHandle& a, const Value& frame,
                              const Value& box) {
    collision::Cube cube;
    Entity* const e = const_cast<Entity*>(a.entity());
    if (e == nullptr) return cube;
    const Value b = _world->get_bounding(*e, frame, box);
    cube.left = to_number(field_or(b, u"left"));
    cube.right = to_number(field_or(b, u"right"));
    cube.bottom = to_number(field_or(b, u"bottom"));
    cube.top = to_number(field_or(b, u"top"));
    cube.near = to_number(field_or(b, u"near"));
    cube.far = to_number(field_or(b, u"far"));
    return cube;
  };
  // `a.world.dataset`
  _core.dataset = [this]() { return _world->world_dataset(); };
  // `victim.get_v_rest(c.aid)`
  _core.victim_get_v_rest = [this](const collision::Collision& c) {
    Entity* const v = entity_of_collision_v(c);
    if (v == nullptr) return false;
    return truthy(Value(v->get_v_rest(c.aid)));
  };
  // `attacker.is_ally(victim)`
  _core.attacker_is_ally = [](const collision::Collision& c) {
    Entity* const a = entity_of_collision_a(c);
    Entity* const v = entity_of_collision_v(c);
    if (a == nullptr || v == nullptr) return false;
    return a->is_ally(*v);
  };
  _core.acquire_collision = [this]() -> collision::Collision& { return acquire_collision(); };
  _core.new_id = [this]() { return _world->lfw().new_id(); };
  _core.dev = [this]() { return _world->lfw().dev(); };
  _core.log = [this](const std::u16string& msg) { _world->lfw().debug(msg); };
  _core.tester_debug = [this](const Value& tester) { return tester_debug(tester); };
  _core.tester_run = [this](const Value& tester, collision::Collision& c) {
    return tester_run(tester, c);
  };
  _core.find_entity = [this](const std::u16string& id, collision::ActorHandle& out) {
    Entity* const e = _world->find_entity(id);
    if (e == nullptr) return false;
    out = actor_of(*e);
    return true;
  };
  _core.find_object_data = [this](const std::u16string& id, Value& out) {
    out = _world->lfw().datas_find(Value(id));
    return truthy(out);
  };
  // `ENTITY_PRIORITY_MAP[a.data.type]`（未列出 ⇒ `undefined`，`collision.cpp` 用 `Value` 承载）。
  _core.priority_of = [](double data_type) {
    const Value* const map = defines::find(u"ENTITY_PRIORITY_MAP");
    if (map == nullptr) return Value();
    return index_of(*map, number_to_string(data_type));
  };
  _core.load_handlers = [](collision::Collision& c) {
    return collision::collisions_keeper().load_handlers(c);
  };
}

void WorldCollisionHost::bind_keeper() {
  // `collision.attacker.state` / `collision.victim.state`
  _keeper.attacker_state = [](const collision::Collision& c) {
    Entity* const a = entity_of_collision_a(c);
    return a == nullptr ? 0.0 : to_number(a->state());
  };
  _keeper.victim_state = [](const collision::Collision& c) {
    Entity* const v = entity_of_collision_v(c);
    return v == nullptr ? 0.0 : to_number(v->state());
  };
  // `victim.data`（`handle` 末尾的 `victim.data.base.hit_sounds`）
  _keeper.victim_data = [](const collision::Collision& c) {
    Entity* const v = entity_of_collision_v(c);
    return v == nullptr ? Value() : v->data();
  };
  _keeper.call_handler = [this](const std::u16string& fn, collision::Collision& c) {
    if (fn == u"handle_itr_catch") {
      collision::handle_itr_catch(c);
    } else if (fn == u"handle_itr_kind_whirlwind") {
      collision::handle_itr_kind_whirlwind(c);
    } else if (fn == u"handle_itr_kind_freeze") {
      collision::handle_itr_kind_freeze(c);
    } else if (fn == u"handle_itr_kind_magic_flute") {
      collision::handle_itr_kind_magic_flute(c);
    } else if (fn == u"handle_healing") {
      collision::handle_healing(c);
    } else if (fn == u"handle_super_punch_me") {
      collision::handle_super_punch_me(c);
    } else if (fn == u"handle_itr_normal_bdy_normal") {
      collision::handle_itr_normal_bdy_normal(c);
    } else if (fn == u"handle_itr_normal_bdy_defend") {
      collision::handle_itr_normal_bdy_defend(c);
    } else if (fn == u"handle_weapon_picked") {
      collision::handle_weapon_picked(c);
    } else if (fn == u"handle_weapon_is_hit") {
      collision::handle_weapon_is_hit(c);
    } else if (fn == u"handle_rest") {
      collision::handle_rest(c);
    } else if (fn == u"handle_ball_hit_other") {
      collision::handle_ball_hit_other(c);
    } else if (fn == u"handle_ball_is_hit_a") {
      collision::handle_ball_is_hit_a(c);
    } else if (fn == u"handle_ball_is_hit_b") {
      collision::handle_ball_is_hit_b(c);
    } else if (fn == u"handle_john_shield_hit_other_ball") {
      collision::handle_john_shield_hit_other_ball(c);
    } else if (fn == u"handle_weapon_hit_other") {
      collision::handle_weapon_hit_other(c);
    } else if (fn == u"handle_body_goto") {
      collision::handle_body_goto(c);
    }
  };
  // `!handle_ball_frozen(victim, attacker, itr)`
  _keeper.ball_frozen = [this](const collision::ActorHandle& first,
                               const collision::ActorHandle& second, const Value& itr) {
    Entity* const v = const_cast<Entity*>(first.entity());
    Entity* const a = const_cast<Entity*>(second.entity());
    if (v == nullptr || a == nullptr) return false;
    return collision::handle_ball_frozen(*v, *a, itr);
  };
  _keeper.run_action = [this](const std::u16string& type, const Value& action,
                              collision::Collision& c) {
    Entity* const a = entity_of_collision_a(c);
    Entity* const v = entity_of_collision_v(c);
    if (a == nullptr || v == nullptr) return;
    collision::run_action(_action, type, action, *a, *v, c.injury, c.real_injury);
  };
  // `victim.collided_list.push(victim.lastest_collided = collision)`
  _keeper.victim_push_collided = [this](collision::Collision& c) {
    Entity* const v = entity_of_collision_v(c);
    if (v == nullptr) return;
    v->lastest_collided = c;
    v->collided_list.push_back(c);
  };
  _keeper.attacker_push_collision = [this](collision::Collision& c) {
    Entity* const a = entity_of_collision_a(c);
    if (a != nullptr) a->collision_list.push_back(c);
  };
  _keeper.victim_play_sound = [this](const collision::Collision& c, const Value& sounds) {
    Entity* const v = entity_of_collision_v(c);
    if (v == nullptr) return;
    v->play_sound(sounds);
  };
}

void WorldCollisionHost::bind_handlers() {
  _handlers.victim_add_v_rest = [this](collision::Collision& c) {
    Entity* const v = entity_of_collision_v(c);
    if (v != nullptr) v->add_v_rest(c);
  };
  _handlers.attacker_pick_victim = [this](collision::Collision& c) {
    Entity* const a = entity_of_collision_a(c);
    Entity* const v = entity_of_collision_v(c);
    if (a != nullptr && v != nullptr) a->pick(*v);
  };
  // `attacker.itr_motionless`
  _handlers.attacker_itr_motionless = [](const collision::Collision& c) {
    Entity* const a = entity_of_collision_a(c);
    return a == nullptr ? Value() : Value(a->itr_motionless());
  };
  _handlers.attacker_set_motionless = [](const collision::Collision& c, const Value& v) {
    Entity* const a = entity_of_collision_a(c);
    if (a != nullptr) a->set_motionless(to_number(v));
  };
  _handlers.victim_set_shaking = [](const collision::Collision& c, const Value& v) {
    Entity* const victim = entity_of_collision_v(c);
    if (victim != nullptr) victim->set_shaking(to_number(v));
  };
  _handlers.attacker_set_arest = [](const collision::Collision& c, double v) {
    Entity* const a = entity_of_collision_a(c);
    if (a != nullptr) a->set_arest(v);
  };
  // `world.buffs.get(id)`
  _handlers.buff_get = [this](const std::u16string& id) { return find_buff(id) != nullptr; };
  _handlers.buff_lifetime_zero = [this](const std::u16string& id) {
    buff::Buff* const b = find_buff(id);
    if (b != nullptr) b->set_lifetime(0);
  };
  _handlers.buff_create = [this](const std::u16string& kind, const std::u16string& id) {
    return create_buff(kind, id) != nullptr;
  };
  _handlers.buff_set_attacker = [this](const std::u16string& id,
                                       const std::u16string& attacker_id) {
    buff::Buff* const b = find_buff(id);
    if (b != nullptr) b->set_attacker_by_id(attacker_id);
  };
  _handlers.buff_set_victim = [this](const std::u16string& id, const std::u16string& victim_id) {
    buff::Buff* const b = find_buff(id);
    if (b != nullptr) b->set_victim(_world->find_entity(victim_id));
  };
  _handlers.buff_mount = [this](const std::u16string& id) {
    buff::Buff* const b = find_buff(id);
    if (b != nullptr) b->mount();
  };
}

void WorldCollisionHost::bind_action() {
  // `lfw.mt.int()`：JS 的 `^` 给 **int32** ⇒ 端口按有符号 32 位取。
  _action.mt_int = [this]() {
    MersenneTwister* const mt = _world->lfw().mt();
    if (mt == nullptr) return 0.0;
    return static_cast<double>(static_cast<int32_t>(mt->next_int()));
  };
  _action.mt_set_mark = [this](const std::u16string& mark) { mt_mark(mark); };
  _action.find_data = [this](const std::u16string& oid, Value& out) {
    out = _world->lfw().datas_find(Value(oid));
    return truthy(out);
  };
  _action.broadcast = [this](const std::u16string& msg) { _world->lfw().broadcast(Value(msg)); };
  _action.alert = [this](const std::u16string& msg) { _world->lfw().warn(msg); };
  _action.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _action.is_ally = [](const Entity& a, const Entity& v) { return a.is_ally(v); };
  _action.buff_env = [this]() -> const buff::BuffEnv* { return &_buff_env; };
}

void WorldCollisionHost::bind_handlers2() {
  _handlers2.warn = [this](const std::u16string& msg) { _world->lfw().warn(msg); };
  // `victim.world.dataset.hp_recoverability`
  _handlers2.hp_recoverability = [this]() {
    return field_or(_world->world_dataset(), u"hp_recoverability");
  };
  _handlers2.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _handlers2.summary_apply_damage = [this](Entity* a, const Value& injury, Entity* v,
                                           const Value& prev_hp) {
    if (a == nullptr || v == nullptr) return;
    summary_mgr().apply_damage(entity_helpers_value(*a), injury, entity_helpers_value(*v),
                               prev_hp);
  };
  _handlers2.buff_env = [this]() -> const buff::BuffEnv* { return &_buff_env; };
  _handlers2.is_fighter = [](const Entity& e) { return entity::is_fighter_data(e.data()); };
  _handlers2.calc_velocity = [this](collision::Collision& c) {
    return collision::calc_itr_velocity(collision_helpers_value(c));
  };
}

void WorldCollisionHost::bind_handlers3() {
  _handlers3.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _handlers3.is_ball = [](const Entity& e) {
    return entity::is_ball_data(field_or(e.data(), u"type"));
  };
  _handlers3.is_weapon = [](const Entity& e) {
    return entity::is_weapon_data(field_or(e.data(), u"type"));
  };
  // `victim.spark_point(a_cube, b_cube)`
  _handlers3.spark_point = [](const collision::Collision& c, const collision::Cube& a,
                              const collision::Cube& b, double& x, double& y, double& z) {
    Entity* const v = entity_of_collision_v(c);
    if (v == nullptr) {
      x = 0;
      y = 0;
      z = 0;
      return;
    }
    v->spark_point(a, b, x, y, z);
  };
  _handlers3.spark = [this](double x, double y, double z, const Value& type) {
    _world->spark(x, y, z, to_string(type));
  };
  _handlers3.play_sound_global = [this](const Value& sounds, double x, double y, double z) {
    _world->lfw().sounds_play(sounds, Value(x), Value(y), Value(z));
  };
  _handlers3.is_armor_work = [this](collision::Collision& c) {
    return collision::is_armor_work(collision_helpers_value(c));
  };
}

void WorldCollisionHost::bind_handlers4() {
  _handlers4.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _handlers4.is_fighter = [](const Entity& e) { return entity::is_fighter_data(e.data()); };
  // `attacker.find_align_frame(frame_id, throwings, in_the_skys)`
  _handlers4.find_align_frame = [](const collision::Collision& c, const Value& frame_id,
                                   const Value& throwings, const Value& in_the_skys) {
    Entity* const a = entity_of_collision_a(c);
    if (a == nullptr) return Value();
    return a->find_align_frame(to_string(frame_id), throwings, in_the_skys);
  };
}

void WorldCollisionHost::bind_fall() {
  _fall.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _fall.is_fighter = [](const Entity& e) { return entity::is_fighter_data(e.data()); };
  _fall.spark = [this](const Value& x, const Value& y, const Value& z, const Value& type) {
    _world->spark(to_number(x), to_number(y), to_number(z), to_string(type));
  };
  _fall.calc_velocity = [this](collision::Collision& c) {
    return collision::calc_itr_velocity(collision_helpers_value(c));
  };
}

void WorldCollisionHost::bind_nbdy_normal() {
  _nbdy_normal.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _nbdy_normal.is_fighter = [](const Entity& e) { return entity::is_fighter_data(e.data()); };
  _nbdy_normal.is_fall = [this](collision::Collision& c) {
    return collision::is_fall(collision_helpers_value(c));
  };
  _nbdy_normal.spark = [this](const Value& x, const Value& y, const Value& z, const Value& type) {
    _world->spark(to_number(x), to_number(y), to_number(z), to_string(type));
  };
  _nbdy_normal.calc_velocity = [this](collision::Collision& c) {
    return collision::calc_itr_velocity(collision_helpers_value(c));
  };
}

void WorldCollisionHost::bind_nbd_defend() {
  _nbd_defend.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _nbd_defend.calc_velocity = [this](collision::Collision& c) {
    return collision::calc_itr_velocity(collision_helpers_value(c));
  };
  _nbd_defend.spark = [this](const Value& x, const Value& y, const Value& z, const Value& type) {
    _world->spark(to_number(x), to_number(y), to_number(z), to_string(type));
  };
  // 「只在防御里触发」的那四个动作：TS 走 `collision_action_handlers[handler_type]`。
  _nbd_defend.dispatch = [this](const collision::Collision& c, const std::u16string& handler_type,
                                const Value& action) {
    Entity* const a = entity_of_collision_a(c);
    Entity* const v = entity_of_collision_v(c);
    if (a == nullptr || v == nullptr) return;
    collision::run_action(_action, handler_type, action, *a, *v, Value(NullTag{}),
                          Value(NullTag{}));
  };
}

void WorldCollisionHost::bind_weapon_is_hit() {
  _weapon_is_hit.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  // `victim.spark_point(a_cube, b_cube)`
  _weapon_is_hit.spark_point = [](const collision::Collision& c, const collision::Cube& a,
                                  const collision::Cube& b) {
    collision::SparkPoint sp;
    double x = 0;
    double y = 0;
    double z = 0;
    Entity* const victim = entity_of_collision_v(c);
    if (victim != nullptr) victim->spark_point(a, b, x, y, z);
    sp.x = Value(x);
    sp.y = Value(y);
    sp.z = Value(z);
    return sp;
  };
  _weapon_is_hit.spark = [this](const Value& x, const Value& y, const Value& z,
                                const std::u16string& kind) {
    _world->spark(to_number(x), to_number(y), to_number(z), kind);
  };
  _weapon_is_hit.mt_mark = [this](const std::u16string& mark) { mt_mark(mark); };
  // `lfw.mt.pick(indexes)`
  _weapon_is_hit.mt_pick = [this](const Value& indexes) {
    MersenneTwister* const mt = _world->lfw().mt();
    if (mt == nullptr) return Value();
    return mt->pick_value(indexes);
  };
  _weapon_is_hit.calc_velocity = [this](collision::Collision& c) {
    return collision::calc_itr_velocity(collision_helpers_value(c));
  };
}

void WorldCollisionHost::bind_ball_frozen() {
  _ball_frozen.is_ball = [](const Entity& e) { return entity::is_ball_data(e.data()); };
  _ball_frozen.is_fighter = [](const Entity& e) { return entity::is_fighter_data(e.data()); };
}

void WorldCollisionHost::bind_healing() {
  _healing.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  _healing.buff_env = [this]() -> const buff::BuffEnv* { return &_buff_env; };
}

void WorldCollisionHost::bind_buff_env() {
  _buff_env.find_entity = [this](const std::u16string& id) -> Entity* {
    return _world->find_entity(id);
  };
  // `lfw.factory.create_entity(world, data)`
  _buff_env.create_entity = [this](const Value& data) -> Entity* {
    return _world->lfw().create_entity(*_world, data);
  };
  _buff_env.find_data = [this](const std::u16string& oid) {
    return _world->lfw().datas_find(Value(oid));
  };
  _buff_env.world_buffs_set = [this](const std::u16string& id, buff::Buff* b) {
    for (size_t i = 0; i < _world->buffs.size(); ++i) {
      if (_world->buffs[i].first == id) {
        _world->buffs[i].second = b;
        return;
      }
    }
    _world->buffs.emplace_back(id, b);
  };
  _buff_env.world_buffs_get = [this](const std::u16string& id) { return find_buff(id); };
  _buff_env.create_buff = [this](const std::u16string& kind, const std::u16string& id) {
    return create_buff(kind, id);
  };
}

}
