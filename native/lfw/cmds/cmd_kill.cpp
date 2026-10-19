#include "lfw/cmds/cmd_kill.h"
#include "lfw/lfw.h"

#include <optional>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/stage/stage.h"
#include "lfw/world.h"

namespace lfw {
namespace cmds {

const char16_t* cmd_kill_help() {
  return uR"(Usage: KILL <entity_id> ... | KILL --team=<team>

Kill entities, sets hp to 0 (triggers death flow) / 击杀实体（hp=0，触发死亡流程）

Options:
  --team=<team>   kill all fighters of a team / 击杀该队全部 fighter)";
}

// TS：`--team` 为**非空**字符串时按队伍整批击杀（`if (team)` 是宽松真值判定）；
// 否则逐词 `world.find_entity(token)`（跳过 `--` 开头的词）。
void cmd_kill(CMDS& ctx) {
  World& world = ctx.world();
  const std::optional<std::u16string> team = ctx.str_arg(u"--team");
  if (team.has_value() && !team->empty()) {
    for (Entity* const e : world.entities) {
      if (e == nullptr) continue;
      if (entity::is_fighter(*e) &&
          strict_equals(Value(e->team()), Value(*team))) {
        e->set_hp(0.0);
      }
    }
    return;
  }
  const std::vector<std::u16string>& words = ctx.words();
  for (size_t i = 1; i < words.size(); ++i) {
    const std::u16string& token = words[i];
    if (token.empty() || starts_with_dash(token)) continue;
    Entity* const e = world.find_entity(token);
    if (e == nullptr) continue;
    e->set_hp(0.0);
  }
}

const char16_t* cmd_kill_boss_help() {
  return uR"(Usage: KILL_BOSS

Kill the boss / 杀死 Boss)";
}

void cmd_kill_boss(CMDS& ctx) {
  World& world = ctx.world();
  if (world.stage_limit()) {
    world.lfw().debug(u"KILL_BOSS failed, Stage Limited.");
    return;
  }
  world.stage()->kill_boss();
}

const char16_t* cmd_kill_enemies_help() {
  return uR"(Usage: KILL_ENEMIES

Kill all enemies / 杀死所有敌人)";
}

void cmd_kill_enemies(CMDS& ctx) {
  World& world = ctx.world();
  if (world.stage_limit()) {
    world.lfw().debug(u"KILL_ENEMIES failed, Stage Limited.");
    return;
  }
  world.stage()->kill_all();
}

const char16_t* cmd_kill_others_help() {
  return uR"(Usage: KILL_OTHERS

Kill other entities / 杀死其他实体)";
}

void cmd_kill_others(CMDS& ctx) {
  World& world = ctx.world();
  if (world.stage_limit()) {
    world.lfw().debug(u"KILL_OTHERS failed, Stage Limited.");
    return;
  }
  world.stage()->kill_others();
}

const char16_t* cmd_kill_soliders_help() {
  return uR"(Usage: KILL_SOLIDERS

Kill all soliders / 杀死所有小兵)";
}

void cmd_kill_soliders(CMDS& ctx) {
  World& world = ctx.world();
  if (world.stage_limit()) {
    world.lfw().debug(u"KILL_SOLIDERS failed, Stage Limited.");
    return;
  }
  world.stage()->kill_soliders();
}

}
}
