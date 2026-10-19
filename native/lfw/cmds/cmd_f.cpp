#include "lfw/cmds/cmd_f.h"
#include "lfw/lfw.h"

#include <vector>

#include "lfw/core/value.h"
#include "lfw/defines/entity_group.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/stage/stage.h"
#include "lfw/world.h"
#include "lfw/world_dataset.h"

namespace lfw {
namespace cmds {

const char16_t* cmd_f1_help() {
  return uR"(Usage: F1

Pause / Resume the game / 暂停或继续游戏)";
}

// TS `c.world.paused = !c.world.paused`（`set paused(v)` 就是 `set_paused(v ? 1 : 0)`）。
void cmd_f1(CMDS& ctx) {
  World& world = ctx.world();
  world.set_paused(!world.paused());
}

const char16_t* cmd_f2_help() {
  return uR"(Usage: F2

Step one frame (pauses first if running) / 单步执行（未暂停时先暂停）)";
}

void cmd_f2(CMDS& ctx) { ctx.world().set_paused_value(2); }

const char16_t* cmd_f3_help() {
  return uR"(Usage: F3

Lock / Unlock function keys / 锁定或解锁功能键)";
}

void cmd_f3(CMDS& ctx) { ctx.world().set_fn_locked_value(1); }

const char16_t* cmd_f5_help() {
  return uR"(Usage: F5

Toggle turbo speed / 切换加速模式)";
}

// `dataset.playrate = dataset.playrate === 1 ? 1000 : 1`（严格等于数字 1 才切到 1000）。
void cmd_f5(CMDS& ctx) {
  World& world = ctx.world();
  world.dataset.set(u"playrate",
                    Value(strict_equals(world.dataset.get(u"playrate"), Value(1.0)) ? 1000.0 : 1.0));
}

const char16_t* cmd_f6_help() {
  return uR"(Usage: F6

Toggle infinite MP / 无限 MP 开关)";
}

void cmd_f6(CMDS& ctx) {
  World& world = ctx.world();
  if (world.fn_locked()) {
    world.lfw().debug(u"F6 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F6 failed, Stage Limited.");
    return;
  }
  world.add_count(u"f6", 1.0);
  world.dataset.set(u"infinity_mp", Value(truthy(world.dataset.get(u"infinity_mp")) ? 0.0 : 1.0));
}

const char16_t* cmd_f7_help() {
  return uR"(Usage: F7

Restore all fighters' HP and MP / 全员 HP/MP 回满)";
}

void cmd_f7(CMDS& ctx) {
  World& world = ctx.world();
  if (world.fn_locked()) {
    world.lfw().debug(u"F7 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F7 failed, Stage Limited.");
    return;
  }
  world.add_count(u"f7", 1.0);
  for (Entity* const e : world.entities) {
    if (e == nullptr) continue;
    if (!entity::is_fighter(*e)) continue;
    // TS `e.hp = e.hp_r = e.hp_max`：`hp_max` 只读一次，先写 `hp_r` 再写 `hp`。
    const double hp_max = e->hp_max();
    e->set_hp_r(hp_max);
    e->set_hp(hp_max);
    e->set_mp(e->mp_max());
  }
}

const char16_t* cmd_f8_help() {
  return uR"(Usage: F8

Spawn stage weapons / 生成场景武器)";
}

// TS：`is_stage` 看 `stage.id` 是不是 `Defines.VOID_STAGE.id`（= "VOID_STAGE"）；
// 武器数据来自 `lfw.datas.get_weapons_of_group`，逐个 `lfw.entities.add(wd, 1)`。
void cmd_f8(CMDS& ctx) {
  World& world = ctx.world();
  if (world.fn_locked()) {
    world.lfw().debug(u"F8 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F8 failed, Stage Limited.");
    return;
  }
  world.add_count(u"f8", 1.0);
  const bool is_stage = world.stage()->id() != std::u16string(u"VOID_STAGE");
  const Value weapon_datas = world.lfw().datas_weapons_of_group(Value(std::u16string(
      is_stage ? entity_group::kStageWeapon : entity_group::kVsWeapon)));
  // TS `for (const wd of weapon_datas)`：拿到非数组时 TS 会抛，端口跳过（记在偏差表）。
  const Array* const list = as_array(weapon_datas);
  if (list == nullptr) return;
  for (size_t i = 0; i < list->size(); ++i) world.lfw().entities_add(list->at(i), 1.0);
}

const char16_t* cmd_f9_help() {
  return uR"(Usage: F9

Remove all weapons / 清除所有武器)";
}

void cmd_f9(CMDS& ctx) {
  World& world = ctx.world();
  if (world.fn_locked()) {
    world.lfw().debug(u"F9 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F9 failed, Stage Limited.");
    return;
  }
  world.add_count(u"f9", 1.0);
  // TS `Array.from(c.world.entities)`：快照后再遍历。
  const std::vector<Entity*> entities = world.entities;
  for (Entity* const e : entities) {
    if (e != nullptr && entity::is_weapon(*e)) e->set_hp(0.0);
  }
  const std::vector<Entity*> ghosts = world.ghosts;
  for (Entity* const e : ghosts) {
    if (e != nullptr && entity::is_weapon(*e)) e->set_hp(0.0);
  }
}

const char16_t* cmd_f10_help() {
  return uR"(Usage: F10

Kill all enemies / 清除所有敌人)";
}

void cmd_f10(CMDS& ctx) {
  World& world = ctx.world();
  if (world.fn_locked()) {
    world.lfw().debug(u"F10 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F10 failed, Stage Limited.");
    return;
  }
  world.add_count(u"f10", 1.0);
  world.stage()->kill_all();
}

}
}
