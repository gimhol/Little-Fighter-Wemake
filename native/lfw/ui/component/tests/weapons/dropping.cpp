#include "lfw/ui/component/tests/weapons/dropping.h"

#include <string>
#include <variant>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

namespace {

// `Defines.NEXT_FRAME_AUTO`（表里没有就给 `undefined`，与 `Entity::enter_frame` 的其它调用点同口径）。
Value next_frame_auto() {
  const Value* const v = defines::find(u"Defines.NEXT_FRAME_AUTO");
  return v != nullptr ? *v : Value();
}

// TS 的 `x ?? 0`：端口的 `field_or` 取不到的字段是 `undefined`，而 `to_number(undefined)` 是 NaN
// ⇒ 这里补 0（`null` 的 `to_number` 本来就是 0）。
double num_or_0(const Value& v) {
  return std::holds_alternative<std::monostate>(v) ? 0.0 : to_number(v);
}

}  // namespace

DroppingBase::DroppingBase(Tests& owner) : TestCase(owner) {}

void DroppingBase::enter() {
  director().reset();
  setup();
}

void DroppingBase::setup() {
  world.clear();
  lfw.change_bg(u"pixel_ruler");

  const double x = midX();
  const double z = midZ();

  a = spawn(std::u16string(oid::kMark));
  if (a == nullptr) return;
  a->set_name(Value(u"A: 捡起石头(稍后被攻击)"));
  a->set_team(team_enum::kTeam_1);
  a->facing = 1.0;
  a->set_position(Value(x), Value(0.0), Value(z));
  a->attach();

  stone = spawn(std::u16string(oid::kWeapon_Stone));
  if (stone == nullptr) return;
  stone->set_position(Value(x - 8.0), Value(0.0), Value(z));
  stone->attach();

  c = spawn(std::u16string(oid::kDeep));
  if (c == nullptr) return;
  c->set_name(Value(u"C: 被石头砸到(不应受伤)"));
  c->set_team(team_enum::kTeam_2);
  c->facing = 1.0;
  c->set_position(Value(x - 150.0), Value(0.0), Value(z));
  c->attach();

  b = spawn(std::u16string(oid::kDavis));
  if (b == nullptr) return;
  b->set_name(Value(u"B: 攻击A"));
  b->set_team(team_enum::kTeam_2);
  b->facing = -1.0;
  b->set_position(Value(x + 40.0), Value(0.0), Value(z));
  b->attach();

  fighters = {a, b, c};
  for (Entity* const f : fighters) {
    f->set_stat_bar(0.0);
    f->as_key_role(Value(true));
  }
}

void DroppingBase::a_pick_up() {
  if (a == nullptr) return;
  a->ctrl()->click({gk::ka});
}

void DroppingBase::b_attack() {
  if (b == nullptr) return;
  b->ctrl()->click({gk::ka});
}

void DroppingBase::place_c_under_weapon() {
  // TS `if (!c || !stone?.bearer) return;`：石头得已经在谁手上。
  if (c == nullptr || stone == nullptr || stone->bearer == nullptr) return;
  c->set_position(Value(stone->position.x - 8.0), Value(0.0), Value(stone->position.z));
}

void DroppingBase::c_pick_up_weapon() {
  if (c == nullptr || stone == nullptr || c->holding != nullptr) return;
  c->pick(*stone);
  c->enter_frame(next_frame_auto());
}

void DroppingBase::c_throw_at_a() {
  if (c == nullptr) return;
  if (a != nullptr) c->facing = a->position.x < c->position.x ? -1.0 : 1.0;
  c->ctrl()->click({gk::ka});
}

void DroppingBase::place_a_at_throw_spot() {
  if (a == nullptr || c == nullptr) return;
  double dx = 86.0;
  // TS `Object.values(c.data.frames ?? {})`：帧表是字符串键的对象，端口按 `Object::keys()` 取一遍值
  // （数字键在 `_ints` 里升序，与 JS 的整数键顺序一致），取到第一个带投掷速度的 `wpoint` 就停。
  const Object* const frames = as_object(c->data_frames());
  if (frames != nullptr) {
    for (const std::u16string& key : frames->keys()) {
      const Value* const frame_p = frames->get(key);
      if (frame_p == nullptr) continue;
      const Value wp = field_or(*frame_p, u"wpoint");
      if (!truthy(wp) || is_array(wp)) continue;
      if (std::holds_alternative<std::monostate>(field_or(wp, u"dvx")) &&
          std::holds_alternative<std::monostate>(field_or(wp, u"dvy")) &&
          std::holds_alternative<std::monostate>(field_or(wp, u"dvz"))) {
        continue;
      }
      dx = num_or_0(field_or(wp, u"x")) - num_or_0(field_or(*frame_p, u"centerx"));
      break;
    }
  }
  a->facing = -1.0;  // 面向 C：石头从 C 手中飞向 A
  a->set_position(Value(c->position.x + dx), Value(0.0), Value(a->position.z));
}

Dropping_1::Dropping_1(Tests& owner) : DroppingBase(owner) {
  name = u"Dropped Weapon: No Hurt";
  _director.repeat(
      9999.0, 1000.0,
      {
          [this]() { a_pick_up(); },
          [this]() { place_c_under_weapon(); },
          [this]() { b_attack(); },  // B 攻击 A → 石头被击落
          []() {},                   // 观察: 石头砸向 C
          []() {},                   // 观察: C 不受伤
          [this]() { setup(); },     // 重来
      });
}

Dropping_2::Dropping_2(Tests& owner) : DroppingBase(owner) {
  name = u"Dropped Weapon: Pick Up & Throw Still Hurts";
  _director.repeat(
      9999.0, 1000.0,
      {
          [this]() { a_pick_up(); },
          [this]() { place_c_under_weapon(); },
          [this]() { b_attack(); },           // B 攻击 A → 石头被击落
          []() {},                            // 观察: C 不受伤
          [this]() { c_pick_up_weapon(); },   // C 捡起石头
          []() {},                            // 观察: C 举起石头
          [this]() { place_a_at_throw_spot(); },  // A 站到投掷生成点上（保证被砸中）
          [this]() { c_throw_at_a(); },       // C 转身投掷 → 砸中 A
          []() {},                            // 观察: A 被砸倒（投掷依然伤人）
          []() {},
          [this]() { setup(); },  // 重来
      });
}

}
}
