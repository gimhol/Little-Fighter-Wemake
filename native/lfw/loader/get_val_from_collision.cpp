#include "lfw/loader/get_val_from_collision.h"
#include "lfw/lfw.h"

#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/collision/is_armor_work.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/cheat_type.h"
#include "lfw/defines/collision_val.h"
#include "lfw/defines/entity_group.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/hit_flag.h"
#include "lfw/defines/state_enum.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/world.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"

namespace lfw {

namespace loader {

namespace {

using Ctx = collision::Collision;
using G = ValGetter<Ctx>;

Value num_of(bool b) { return Value(b ? 1.0 : 0.0); }

Value field_of(const Value& v, const char16_t* key) { return field_or(v, key); }

// TS 的 `??`：只在 null / undefined 时兜底。
Value nullish_or(const Value& v, const Value& fallback) {
  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v)) {
    return fallback;
  }
  return v;
}

// `group?.some(v => v === want)`：`group` 不是数组时 TS 会抛异常，端口给 0。
bool group_has(const Value& group, const char16_t* want) {
  const Array* a = as_array(group);
  if (a == nullptr) return false;
  for (size_t i = 0; i < a->size(); ++i) {
    if (strict_equals(a->at(i), Value(std::u16string(want)))) return true;
  }
  return false;
}

// `c.attacker` / `c.victim` 在 TS 里就是那两个活实体（读的时候才取字段），端口的
// `Collision` 也直接带着它们（`ActorHandle`）⇒ 不需要再按 `id` 去世界表里找。
// 台面里的假实体给 `nullptr`，读实体的项给 `undefined`（TS 那时会抛 `TypeError`）。
const Entity* attacker_of(const Ctx& c) { return c.attacker.entity(); }

const Entity* victim_of(const Ctx& c) { return c.victim.entity(); }

template <typename Fn>
Value with_attacker(const Ctx& c, Fn fn) {
  const Entity* e = attacker_of(c);
  return e != nullptr ? fn(*e) : Value();
}

template <typename Fn>
Value with_victim(const Ctx& c, Fn fn) {
  const Entity* e = victim_of(c);
  return e != nullptr ? fn(*e) : Value();
}

template <typename Fn>
Value with_both(const Ctx& c, Fn fn) {
  const Entity* a = attacker_of(c);
  const Entity* v = victim_of(c);
  return (a != nullptr && v != nullptr) ? fn(*a, *v) : Value();
}

// `ctrl.is_hit(k)` / `is_start(k)` / `is_db_hit(k)`：TS 的返回是 **boolean**。
Value key_state(const Entity* e, const char16_t* key, int kind) {
  if (e == nullptr) return Value();
  controller::BaseController* ctrl = e->ctrl();
  if (ctrl == nullptr) return Value();
  const std::u16string k(key);
  if (kind == 0) return Value(ctrl->is_hit(k));
  if (kind == 1) return Value(ctrl->is_start(k));
  return Value(ctrl->is_db_hit(k));
}

Value a_hit(const Ctx& c, const char16_t* key) { return key_state(attacker_of(c), key, 0); }

Value v_hit(const Ctx& c, const char16_t* key) { return key_state(victim_of(c), key, 0); }

Value a_click(const Ctx& c, const char16_t* key) { return key_state(attacker_of(c), key, 1); }

Value v_click(const Ctx& c, const char16_t* key) { return key_state(victim_of(c), key, 1); }

Value a_db_click(const Ctx& c, const char16_t* key) { return key_state(attacker_of(c), key, 2); }

Value v_db_click(const Ctx& c, const char16_t* key) { return key_state(victim_of(c), key, 2); }

// --- 类型 / id / 数据 -----------------------------------------------------------

Value attacker_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}

Value victim_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}

Value attacker_base_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(
      c, [](const Entity& e) { return field_of(field_of(e.data(), u"base"), u"type"); });
}

Value victim_base_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(
      c, [](const Entity& e) { return field_of(field_of(e.data(), u"base"), u"type"); });
}

Value attacker_oid(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return field_of(e.data(), u"id"); });
}

Value victim_oid(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.data(), u"id"); });
}

Value victim_frame_index_ice(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(
      c, [](const Entity& e) { return field_of(field_of(e.data(), u"indexes"), u"ice"); });
}

Value victim_is_freezable_ball(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) {
    return num_of(group_has(e.group(), entity_group::kFreezableBall));
  });
}

Value attacker_is_freezable_ball(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) {
    return num_of(group_has(e.group(), entity_group::kFreezableBall));
  });
}

// --- 帧（`aframe` / `bframe` 属于碰撞对象自己）----------------------------------

Value attacker_state(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.aframe, u"state");
}

Value victim_state(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bframe, u"state");
}

Value victim_frame_id(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bframe, u"id");
}

Value v_frame_behavior(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.frame, u"behavior"); });
}

// --- itr / bdy -----------------------------------------------------------------

Value itr_effect(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"effect");
}

Value itr_kind(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"kind");
}

Value itr_fall(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"fall");
}

Value itr_code(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"code");
}

Value bdy_kind(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"kind");
}

Value bdy_code(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"code");
}

// `c.itr.effect === void 0`：**严格**判 `undefined`（`null` 给 0）。
Value no_itr_effect(const Ctx& c, const std::u16string&, BinOp) {
  const Value effect = field_of(c.itr, u"effect");
  return Value(std::holds_alternative<std::monostate>(effect) ? 1.0 : 0.0);
}

Value bdy_hit_flag(const Ctx& c, const std::u16string&, BinOp) {
  return nullish_or(field_of(c.bdy, u"hit_flag"),
                    Value(static_cast<double>(HitFlag::AllEnemy)));
}

Value itr_hit_flag(const Ctx& c, const std::u16string&, BinOp) {
  return nullish_or(field_of(c.itr, u"hit_flag"),
                    Value(static_cast<double>(HitFlag::AllEnemy)));
}

// --- 队伍 / 朝向 / 持有 ---------------------------------------------------------

Value same_team(const Ctx& c, const std::u16string&, BinOp) {
  return with_both(c, [](const Entity& a, const Entity& v) { return num_of(a.is_ally(v)); });
}

Value same_facing(const Ctx& c, const std::u16string&, BinOp) {
  return with_both(
      c, [](const Entity& a, const Entity& v) { return num_of(a.facing == v.facing); });
}

Value attacker_has_holder(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(e.bearer != nullptr); });
}

Value victim_has_holder(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(e.bearer != nullptr); });
}

Value attacker_has_holding(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(e.holding != nullptr); });
}

Value victim_has_holding(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(e.holding != nullptr); });
}

Value attacker_threw(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(truthy(Value(e.throwinjury))); });
}

Value victim_threw(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(truthy(Value(e.throwinjury))); });
}

// `is_ball_ctrl(c.attacker.ctrl) && c.victim === c.attacker.ctrl.chasing`：`chasing` 是
// 实体指针、`victim` 是碰撞快照 ⇒ 按 `id` 比（实体 id 唯一）。
Value victim_is_chasing(const Ctx& c, const std::u16string&, BinOp) {
  const Entity* a = attacker_of(c);
  if (a == nullptr) return Value(0.0);
  const controller::BaseController* ctrl = a->ctrl();
  if (ctrl == nullptr || !ctrl->is_ball_ctrl()) return Value(0.0);
  if (ctrl->chasing == nullptr) return Value(0.0);
  return num_of(c.victim.id() == ctrl->chasing->id);
}

// --- 属性 ---------------------------------------------------------------------

Value a_toughness(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return Value(e.toughness()); });
}

Value v_toughness(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return Value(e.toughness()); });
}

Value a_hp_p(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return Value(round(100 * e.hp() / e.hp_max())); });
}

Value v_hp_p(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return Value(round(100 * e.hp() / e.hp_max())); });
}

Value lf2_net_on(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(
      c, [](const Entity& e) { return num_of(e.lfw().is_cheat(cheat_enum::kLF2_NET)); });
}

Value a_emitter(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) {
    const std::u16string* s = e.emitter();
    return Value(s != nullptr ? *s : std::u16string());
  });
}

Value v_emitter(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) {
    const std::u16string* s = e.emitter();
    return Value(s != nullptr ? *s : std::u16string());
  });
}

// `if (p1 > p2) return -v; if (p1 < p2) return v; return abs(-v)`
double closing_speed(double v, double p1, double p2) {
  if (p1 > p2) return -v;
  if (p1 < p2) return v;
  return abs(-v);
}

Value a_closing_speed_x(const Ctx& c, const std::u16string&, BinOp) {
  return with_both(c, [](const Entity& a, const Entity& v) {
    return Value(closing_speed(a.velocity.x, a.position.x, v.position.x));
  });
}

Value a_closing_speed_y(const Ctx& c, const std::u16string&, BinOp) {
  return with_both(c, [](const Entity& a, const Entity& v) {
    return Value(closing_speed(a.velocity.y, a.position.y, v.position.y));
  });
}

Value a_closing_speed_z(const Ctx& c, const std::u16string&, BinOp) {
  return with_both(c, [](const Entity& a, const Entity& v) {
    return Value(closing_speed(a.velocity.z, a.position.z, v.position.z));
  });
}

// --- 状态 ---------------------------------------------------------------------

Value a_falling(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) {
    return num_of(entity::is_fighter(e.entity_view()) &&
                  equals(e.state(), Value(static_cast<double>(StateEnum::Falling))));
  });
}

Value v_falling(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) {
    return num_of(entity::is_fighter(e.entity_view()) &&
                  equals(e.state(), Value(static_cast<double>(StateEnum::Falling))));
  });
}

// `is_armor_work(collision)` 读的是「JS 对象视角」的碰撞（`victim.armor` / `bframe` /
// `itr` / `aframe`）⇒ 这里现搭一个只含它读的那四项的 `Value`。
Value armor_work(const Ctx& c, const std::u16string&, BinOp) {
  Object victim;
  const Entity* v = victim_of(c);
  victim.set(u"armor", v != nullptr ? v->armor : Value(NullTag{}));
  Object view;
  view.set(u"victim", Value(std::make_shared<Object>(victim)));
  view.set(u"bframe", c.bframe);
  view.set(u"itr", c.itr);
  view.set(u"aframe", c.aframe);
  return num_of(collision::is_armor_work(Value(std::make_shared<Object>(view))));
}

// --- 按键：`hit` / `click` / `dbclick` × 攻击方 / 受击方 × 7 个键 ------------------

Value a_hit_attack(const Ctx& c, const std::u16string&, BinOp) { return a_hit(c, gk::ka); }

Value a_hit_jump(const Ctx& c, const std::u16string&, BinOp) { return a_hit(c, gk::kj); }

Value a_hit_defend(const Ctx& c, const std::u16string&, BinOp) { return a_hit(c, gk::kd); }

Value a_hit_up(const Ctx& c, const std::u16string&, BinOp) { return a_hit(c, gk::kU); }

Value a_hit_down(const Ctx& c, const std::u16string&, BinOp) { return a_hit(c, gk::kD); }

Value a_hit_left(const Ctx& c, const std::u16string&, BinOp) { return a_hit(c, gk::kL); }

Value a_hit_right(const Ctx& c, const std::u16string&, BinOp) { return a_hit(c, gk::kR); }

Value v_hit_attack(const Ctx& c, const std::u16string&, BinOp) { return v_hit(c, gk::ka); }

Value v_hit_jump(const Ctx& c, const std::u16string&, BinOp) { return v_hit(c, gk::kj); }

Value v_hit_defend(const Ctx& c, const std::u16string&, BinOp) { return v_hit(c, gk::kd); }

Value v_hit_up(const Ctx& c, const std::u16string&, BinOp) { return v_hit(c, gk::kU); }

Value v_hit_down(const Ctx& c, const std::u16string&, BinOp) { return v_hit(c, gk::kD); }

Value v_hit_left(const Ctx& c, const std::u16string&, BinOp) { return v_hit(c, gk::kL); }

Value v_hit_right(const Ctx& c, const std::u16string&, BinOp) { return v_hit(c, gk::kR); }

Value a_click_attack(const Ctx& c, const std::u16string&, BinOp) { return a_click(c, gk::ka); }

Value a_click_jump(const Ctx& c, const std::u16string&, BinOp) { return a_click(c, gk::kj); }

Value a_click_defend(const Ctx& c, const std::u16string&, BinOp) { return a_click(c, gk::kd); }

Value a_click_up(const Ctx& c, const std::u16string&, BinOp) { return a_click(c, gk::kU); }

Value a_click_down(const Ctx& c, const std::u16string&, BinOp) { return a_click(c, gk::kD); }

Value a_click_left(const Ctx& c, const std::u16string&, BinOp) { return a_click(c, gk::kL); }

Value a_click_right(const Ctx& c, const std::u16string&, BinOp) { return a_click(c, gk::kR); }

Value v_click_attack(const Ctx& c, const std::u16string&, BinOp) { return v_click(c, gk::ka); }

Value v_click_jump(const Ctx& c, const std::u16string&, BinOp) { return v_click(c, gk::kj); }

Value v_click_defend(const Ctx& c, const std::u16string&, BinOp) { return v_click(c, gk::kd); }

Value v_click_up(const Ctx& c, const std::u16string&, BinOp) { return v_click(c, gk::kU); }

Value v_click_down(const Ctx& c, const std::u16string&, BinOp) { return v_click(c, gk::kD); }

Value v_click_left(const Ctx& c, const std::u16string&, BinOp) { return v_click(c, gk::kL); }

Value v_click_right(const Ctx& c, const std::u16string&, BinOp) { return v_click(c, gk::kR); }

Value a_db_click_attack(const Ctx& c, const std::u16string&, BinOp) { return a_db_click(c, gk::ka); }

Value a_db_click_jump(const Ctx& c, const std::u16string&, BinOp) { return a_db_click(c, gk::kj); }

Value a_db_click_defend(const Ctx& c, const std::u16string&, BinOp) {
  return a_db_click(c, gk::kd);
}

Value a_db_click_up(const Ctx& c, const std::u16string&, BinOp) { return a_db_click(c, gk::kU); }

Value a_db_click_down(const Ctx& c, const std::u16string&, BinOp) { return a_db_click(c, gk::kD); }

Value a_db_click_left(const Ctx& c, const std::u16string&, BinOp) { return a_db_click(c, gk::kL); }

Value a_db_click_right(const Ctx& c, const std::u16string&, BinOp) { return a_db_click(c, gk::kR); }

Value v_db_click_attack(const Ctx& c, const std::u16string&, BinOp) { return v_db_click(c, gk::ka); }

Value v_db_click_jump(const Ctx& c, const std::u16string&, BinOp) { return v_db_click(c, gk::kj); }

Value v_db_click_defend(const Ctx& c, const std::u16string&, BinOp) {
  return v_db_click(c, gk::kd);
}

Value v_db_click_up(const Ctx& c, const std::u16string&, BinOp) { return v_db_click(c, gk::kU); }

Value v_db_click_down(const Ctx& c, const std::u16string&, BinOp) { return v_db_click(c, gk::kD); }

Value v_db_click_left(const Ctx& c, const std::u16string&, BinOp) { return v_db_click(c, gk::kL); }

Value v_db_click_right(const Ctx& c, const std::u16string&, BinOp) { return v_db_click(c, gk::kR); }

}

const std::vector<std::pair<std::u16string, G>>& collision_val_getters() {
  static const std::vector<std::pair<std::u16string, G>> table = {
      {collision_val::kAttackerType, attacker_type},
      {collision_val::kVictimType, victim_type},
      {collision_val::kVictimIsChasing, victim_is_chasing},
      {collision_val::kItrEffect, itr_effect},
      {collision_val::kItrKind, itr_kind},
      {collision_val::kSameFacing, same_facing},
      {collision_val::kAttackerState, attacker_state},
      {collision_val::kVictimState, victim_state},
      {collision_val::kAttackerHasHolder, attacker_has_holder},
      {collision_val::kVictimHasHolder, victim_has_holder},
      {collision_val::kAttackerHasHolding, attacker_has_holding},
      {collision_val::kVictimHasHolding, victim_has_holding},
      {collision_val::kSameTeam, same_team},
      {collision_val::kAttackerOID, attacker_oid},
      {collision_val::kVictimOID, victim_oid},
      {collision_val::kBdyKind, bdy_kind},
      {collision_val::kVictimFrameId, victim_frame_id},
      {collision_val::kVictimFrameIndex_ICE, victim_frame_index_ice},
      {collision_val::kItrFall, itr_fall},
      {collision_val::kAttackerThrew, attacker_threw},
      {collision_val::kVictimThrew, victim_threw},
      {collision_val::kVictimIsFreezableBall, victim_is_freezable_ball},
      {collision_val::kAttackerIsFreezableBall, attacker_is_freezable_ball},
      {collision_val::kArmorWork, armor_work},
      {collision_val::kV_FrameBehavior, v_frame_behavior},
      {collision_val::kNoItrEffect, no_itr_effect},
      {collision_val::kA_HP_P, a_hp_p},
      {collision_val::kV_HP_P, v_hp_p},
      {collision_val::kLF2_NET_ON, lf2_net_on},
      {collision_val::kBdyHitFlag, bdy_hit_flag},
      {collision_val::kItrHitFlag, itr_hit_flag},
      {collision_val::kBdyCode, bdy_code},
      {collision_val::kItrCode, itr_code},
      {collision_val::kVToughness, v_toughness},
      {collision_val::kAToughness, a_toughness},
      {collision_val::kAttackerBaseType, attacker_base_type},
      {collision_val::kVictimBaseType, victim_base_type},
      {collision_val::kAClosingSpeedX, a_closing_speed_x},
      {collision_val::kAClosingSpeedY, a_closing_speed_y},
      {collision_val::kAClosingSpeedZ, a_closing_speed_z},
      {collision_val::kAEmitter, a_emitter},
      {collision_val::kVEmitter, v_emitter},
      {collision_val::kAHitAttack, a_hit_attack},
      {collision_val::kAHitJump, a_hit_jump},
      {collision_val::kAHitDefend, a_hit_defend},
      {collision_val::kAHitUp, a_hit_up},
      {collision_val::kAHitDown, a_hit_down},
      {collision_val::kAHitLeft, a_hit_left},
      {collision_val::kAHitRight, a_hit_right},
      {collision_val::kVHitAttack, v_hit_attack},
      {collision_val::kVHitJump, v_hit_jump},
      {collision_val::kVHitDefend, v_hit_defend},
      {collision_val::kVHitUp, v_hit_up},
      {collision_val::kVHitDown, v_hit_down},
      {collision_val::kVHitLeft, v_hit_left},
      {collision_val::kVHitRight, v_hit_right},
      {collision_val::kAClickAttack, a_click_attack},
      {collision_val::kAClickJump, a_click_jump},
      {collision_val::kAClickDefend, a_click_defend},
      {collision_val::kAClickUp, a_click_up},
      {collision_val::kAClickDown, a_click_down},
      {collision_val::kAClickLeft, a_click_left},
      {collision_val::kAClickRight, a_click_right},
      {collision_val::kVClickAttack, v_click_attack},
      {collision_val::kVClickJump, v_click_jump},
      {collision_val::kVClickDefend, v_click_defend},
      {collision_val::kVClickUp, v_click_up},
      {collision_val::kVClickDown, v_click_down},
      {collision_val::kVClickLeft, v_click_left},
      {collision_val::kVClickRight, v_click_right},
      {collision_val::kADbcAttack, a_db_click_attack},
      {collision_val::kADbcJump, a_db_click_jump},
      {collision_val::kADbcDefend, a_db_click_defend},
      {collision_val::kADbcUp, a_db_click_up},
      {collision_val::kADbcDown, a_db_click_down},
      {collision_val::kADbcLeft, a_db_click_left},
      {collision_val::kADbcRight, a_db_click_right},
      {collision_val::kVDbcAttack, v_db_click_attack},
      {collision_val::kVDbcJump, v_db_click_jump},
      {collision_val::kVDbcDefend, v_db_click_defend},
      {collision_val::kVDbcUp, v_db_click_up},
      {collision_val::kVDbcDown, v_db_click_down},
      {collision_val::kVDbcLeft, v_db_click_left},
      {collision_val::kVDbcRight, v_db_click_right},
      {collision_val::kAFALLING, a_falling},
      {collision_val::kVFALLING, v_falling},
  };
  return table;
}

ValGetter<Ctx> get_val_getter_from_collision(const std::u16string& word) {
  for (const std::pair<std::u16string, G>& kv : collision_val_getters()) {
    if (kv.first == word) return kv.second;
  }
  return nullptr;
}

}

}
