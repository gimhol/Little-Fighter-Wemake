#include "lfw/loader/get_val_from_entity.h"
#include "lfw/lfw.h"

#include <memory>
#include <optional>
#include <string>
#include <variant>
#include <vector>

#include "lfw/buff/buff.h"
#include "lfw/collision/collision.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/cheat_type.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/defines/entity_val.h"
#include "lfw/defines/game_mode.h"
#include "lfw/defines/itr_kind.h"
#include "lfw/defines/weapon_type.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/world.h"
#include "lfw/loader/get_val_from_world.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/clamp.h"

namespace lfw {

namespace loader {

namespace {

using G = ValGetter<Entity>;

// `is_fighter(v)` / `is_weapon(v)` / `is_ball(v)` 读的是 `v.data.type`（`type_check.ts`），
// 而 `collision_list` / `collided_list` 里的 `CollisionActor` 是快照，只留下了
// `data.type`（`data_type`），所以这里按 `data_type` 判定。
bool is_fighter_actor(const collision::ActorHandle& a) {
  return a.data_type() == static_cast<double>(EntityEnum::Fighter);
}
bool is_weapon_actor(const collision::ActorHandle& a) {
  return a.data_type() == static_cast<double>(EntityEnum::Weapon);
}
bool is_ball_actor(const collision::ActorHandle& a) {
  return a.data_type() == static_cast<double>(EntityEnum::Ball);
}

// `find(list, c => pred(c.attacker))` / `find(list, c => pred(c.victim))`：
// 只要有一项满足就给 1，否则 0。
template <typename Pred>
Value find_flag(const std::vector<collision::Collision>& list, Pred pred) {
  for (const collision::Collision& c : list) {
    if (pred(c)) return Value(1.0);
  }
  return Value(0.0);
}

Value flag_of(bool v) { return Value(v ? 1.0 : 0.0); }

// `v.length`：数组给元素个数、字符串给 UTF-16 码元数；其余类型在 JS 里没有 `length`
// （⇒ `undefined`）。`HAS_TRANSFORM_DATA` 与 `TransformListSize` 两项要用。
std::optional<double> length_of(const Value& v) {
  if (const Array* a = as_array(v)) return static_cast<double>(a->size());
  if (const std::u16string* s = std::get_if<std::u16string>(&v)) {
    return static_cast<double>(s->size());
  }
  return std::nullopt;
}

// `e.ctrl.LR` / `e.ctrl.UD`：TS 的 `ctrl` 一定存在（没设备时是 `NoneController`，给 0），
// 端口里 `ctrl_` 可以是空指针，等同处理（同 `entity.cpp` 里既有的写法）。
double ctrl_lr(const Entity& e) {
  const controller::BaseController* c = e.ctrl();
  return c != nullptr ? static_cast<double>(c->LR()) : 0.0;
}

double ctrl_ud(const Entity& e) {
  const controller::BaseController* c = e.ctrl();
  return c != nullptr ? static_cast<double>(c->UD()) : 0.0;
}

Value trend_x(const Entity& e, const std::u16string&, BinOp) {
  if (e.velocity.x < 0) return Value(-e.facing);
  if (e.velocity.x > 0) return Value(e.facing);
  return Value(0.0);
}

Value press_fb(const Entity& e, const std::u16string&, BinOp) {
  return Value(ctrl_lr(e) * e.facing);
}

Value press_ud(const Entity& e, const std::u16string&, BinOp) { return Value(ctrl_ud(e)); }

Value press_lr(const Entity& e, const std::u16string&, BinOp) { return Value(ctrl_lr(e)); }

// `e.holding?.base_type ?? 0`：端口的 `base_type()` 返回 `double`（`Entity.ts` 里也是
// `get base_type(): number`），所以没有武器时才走 `?? 0`。
Value holding_w_type(const Entity& e, const std::u16string&, BinOp) {
  return Value(e.holding != nullptr ? e.holding->base_type() : 0.0);
}

Value hp_p(const Entity& e, const std::u16string&, BinOp) {
  return Value(clamp(round((100.0 * e.hp()) / e.hp_max()), 0.0, 100.0));
}

Value lf2_net_on(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.lfw().is_cheat(cheat_enum::kLF2_NET));
}

Value hero_ft_on(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.lfw().is_cheat(cheat_enum::kHERO_FT));
}

Value gim_ink_on(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.lfw().is_cheat(cheat_enum::kGIM_INK));
}

Value has_transform_data(const Entity& e, const std::u16string&, BinOp) {
  const std::optional<double> n = length_of(e.transforms);
  return flag_of(n.has_value() && *n != 0);
}

Value catching(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.catching != nullptr);
}

Value caught(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.catcher != nullptr);
}

Value require_super_punch(const Entity& e, const std::u16string&, BinOp) {
  return Value(static_cast<double>(e.superpunchs.size()));
}

Value hit_by_character(const Entity& e, const std::u16string&, BinOp) {
  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_fighter_actor(c.attacker); });
}

Value hit_by_weapon(const Entity& e, const std::u16string&, BinOp) {
  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_weapon_actor(c.attacker); });
}

Value hit_by_ball(const Entity& e, const std::u16string&, BinOp) {
  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_ball_actor(c.attacker); });
}

Value hit_by_state(const Entity& e, const std::u16string&, BinOp) {
  std::vector<Value> out;
  out.reserve(e.collided_list.size());
  for (const collision::Collision& c : e.collided_list) {
    out.push_back(field_or(c.aframe, u"state"));
  }
  return Value(std::make_shared<Array>(std::move(out)));
}

Value hit_by_itr_kind(const Entity& e, const std::u16string&, BinOp) {
  std::vector<Value> out;
  out.reserve(e.collided_list.size());
  for (const collision::Collision& c : e.collided_list) out.push_back(field_or(c.itr, u"kind"));
  return Value(std::make_shared<Array>(std::move(out)));
}

Value hit_by_itr_effect(const Entity& e, const std::u16string&, BinOp) {
  std::vector<Value> out;
  out.reserve(e.collided_list.size());
  for (const collision::Collision& c : e.collided_list) {
    out.push_back(field_or(c.itr, u"effect"));
  }
  return Value(std::make_shared<Array>(std::move(out)));
}

Value hit_on_character(const Entity& e, const std::u16string&, BinOp) {
  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_fighter_actor(c.victim); });
}

Value hit_on_weapon(const Entity& e, const std::u16string&, BinOp) {
  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_weapon_actor(c.victim); });
}

Value hit_on_ball(const Entity& e, const std::u16string&, BinOp) {
  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_ball_actor(c.victim); });
}

Value hit_on_state(const Entity& e, const std::u16string&, BinOp) {
  std::vector<Value> out;
  out.reserve(e.collision_list.size());
  for (const collision::Collision& c : e.collision_list) {
    out.push_back(field_or(c.bframe, u"state"));
  }
  return Value(std::make_shared<Array>(std::move(out)));
}

Value hit_on_sth(const Entity& e, const std::u16string&, BinOp) {
  return Value(static_cast<double>(e.collision_list.size()));
}

Value hp(const Entity& e, const std::u16string&, BinOp) { return Value(e.hp()); }

Value mp(const Entity& e, const std::u16string&, BinOp) { return Value(e.mp()); }

Value vx(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.x); }

Value vy(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.y); }

Value vz(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.z); }

Value frame_state(const Entity& e, const std::u16string&, BinOp) { return e.state(); }

Value shaking(const Entity& e, const std::u16string&, BinOp) { return Value(e.shaking); }

Value holding(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.holding != nullptr);
}

Value holding_heavy(const Entity& e, const std::u16string&, BinOp) {
  return Value(e.holding != nullptr &&
               e.holding->base_type() == static_cast<double>(WeaponEnum::Heavy));
}

Value holding_oid(const Entity& e, const std::u16string&, BinOp) {
  if (e.holding == nullptr) return Value();
  return field_or(e.holding->data(), u"id");
}

Value hp_recoverable(const Entity& e, const std::u16string&, BinOp) {
  return Value(e.hp_r() - e.hp());
}

Value hit_by_magic_flute(const Entity& e, const std::u16string&, BinOp) {
  for (const auto& kv : e.buffs) {
    const buff::Buff* buf = kv.second;
    if (buf == nullptr) continue;
    if (equals(buf->kind(), Value(static_cast<double>(ItrKind::MagicFlute)))) return Value(1.0);
    if (equals(buf->kind(), Value(static_cast<double>(ItrKind::MagicFlute2)))) return Value(1.0);
  }
  return Value(0.0);
}

Value transform_list_size(const Entity& e, const std::u16string&, BinOp) {
  return Value(length_of(e.transforms).value_or(0.0));
}

Value is_on_ground(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.is_on_ground);
}

Value transform_index(const Entity& e, const std::u16string&, BinOp) {
  return Value(e.transform_index);
}

Value is_survial_rank_mode(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(is_survival_rank_mode(e.lfw().game_mode()));
}

}

const std::vector<std::pair<std::u16string, G>>& entity_val_getters() {
  static const std::vector<std::pair<std::u16string, G>> table = {
      {entity_val::kTrendX, trend_x},
      {entity_val::kPressFB, press_fb},
      {entity_val::kPressUD, press_ud},
      {entity_val::kPressLR, press_lr},
      {entity_val::kHolding_W_Type, holding_w_type},
      {entity_val::kHP_P, hp_p},
      {entity_val::kLF2_NET_ON, lf2_net_on},
      {entity_val::kHERO_FT_ON, hero_ft_on},
      {entity_val::kGIM_INK_ON, gim_ink_on},
      {entity_val::kHAS_TRANSFORM_DATA, has_transform_data},
      {entity_val::kCatching, catching},
      {entity_val::kCAUGHT, caught},
      {entity_val::kRequireSuperPunch, require_super_punch},
      {entity_val::kHitByCharacter, hit_by_character},
      {entity_val::kHitByWeapon, hit_by_weapon},
      {entity_val::kHitByBall, hit_by_ball},
      {entity_val::kHitByState, hit_by_state},
      {entity_val::kHitByItrKind, hit_by_itr_kind},
      {entity_val::kHitByItrEffect, hit_by_itr_effect},
      {entity_val::kHitOnCharacter, hit_on_character},
      {entity_val::kHitOnWeapon, hit_on_weapon},
      {entity_val::kHitOnBall, hit_on_ball},
      {entity_val::kHitOnState, hit_on_state},
      {entity_val::kHitOnSth, hit_on_sth},
      {entity_val::kHP, hp},
      {entity_val::kMP, mp},
      {entity_val::kVX, vx},
      {entity_val::kVY, vy},
      {entity_val::kVZ, vz},
      {entity_val::kFrameState, frame_state},
      {entity_val::kShaking, shaking},
      {entity_val::kHolding, holding},
      {entity_val::kHoldingHeavy, holding_heavy},
      {entity_val::kHoldingOID, holding_oid},
      {entity_val::kHpRecoverable, hp_recoverable},
      {entity_val::kHitByMagicFlute, hit_by_magic_flute},
      {entity_val::kTransformListSize, transform_list_size},
      {entity_val::kIsOnGround, is_on_ground},
      {entity_val::kTransformIndex, transform_index},
      {entity_val::kIsSurvialRankMode, is_survial_rank_mode},
  };
  return table;
}

ValGetter<Entity> get_val_getter_from_entity(const std::u16string& word) {
  for (const std::pair<std::u16string, G>& kv : entity_val_getters()) {
    if (kv.first == word) return kv.second;
  }
  // TS 在这里还有一层 `entity_world_val_getters` 记忆 Map（纯缓存，见 DESIGN §61.4）
  // 和 `get_val_from_world` 回落（恒 `undefined`）。
  return get_val_from_world<Entity>(word);
}

}

}
