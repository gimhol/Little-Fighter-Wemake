#pragma once

// 差分台面用：把「脚本化出来的一份引用快照」当真实体用。
//
// `bot/*` 读对家的方式全是 `ref_of(entity)`（`position` / `facing` / `hp` / `team` /
// `frame` / `data` 这一组），所以台面只要让这些字段从快照现取，行为与「直接读那份
// `Value`」逐字一致 —— 目标表 / `chasing` / 持握物这些槽位于是都能收实体指针
// （`TargetHandle` 那层壳已删）。
//
// 实体是不可变的：`fx put` 会重建一个（旧的那个留在 `g_fx_grave` 里不发释放，见
// `subjects/bot.cpp`），与 TS 每次 `put` 换一个新对象同义。

#include <string>
#include <variant>
#include <utility>

#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/type_cast.h"

#include "entity_fixture.h"

namespace fx {

class ScriptedEntity : public StubEntity {
 public:
  explicit ScriptedEntity(std::u16string id, lfw::Value snap)
      : StubEntity(std::move(id), lfw::field_or(snap, u"data")),
        snap_(std::move(snap)),
        team_(lfw::to_string(lfw::field_or(snap_, u"team"))) {
    sync();
  }

  const lfw::Value& snapshot() const { return snap_; }

  // 快照是同一个 `Value` 对象、被用例原地改（`me …`）⇒ 重新灌一遍成员即可
  // （`data` 那份也是原地改的，`_data` 不用换）。
  void resync() {
    team_ = lfw::to_string(lfw::field_or(snap_, u"team"));
    sync();
  }

  double hp() const override { return num(u"hp"); }
  const std::u16string& team() const override { return team_; }
  double mounted() const override { return num(u"mounted"); }
  double toughness() const override { return num(u"toughness"); }
  double arest() const override { return num(u"arest"); }
  double resting() const override { return num(u"resting"); }
  double ground_y() const override { return num(u"ground_y"); }

 private:
  double num(const char16_t* key) const { return lfw::to_number(lfw::field_or(snap_, key)); }

  void sync() {
    const lfw::Value id_v = lfw::field_or(snap_, u"id");
    if (const std::u16string* const id_p = std::get_if<std::u16string>(&id_v)) id = *id_p;
    const lfw::Value pos = lfw::field_or(snap_, u"position");
    const lfw::Value vel = lfw::field_or(snap_, u"velocity");
    position.x = lfw::to_number(lfw::field_or(pos, u"x"));
    position.y = lfw::to_number(lfw::field_or(pos, u"y"));
    position.z = lfw::to_number(lfw::field_or(pos, u"z"));
    velocity.x = lfw::to_number(lfw::field_or(vel, u"x"));
    velocity.y = lfw::to_number(lfw::field_or(vel, u"y"));
    velocity.z = lfw::to_number(lfw::field_or(vel, u"z"));
    facing = num(u"facing");
    frame = lfw::field_or(snap_, u"frame");
    is_on_ground = lfw::truthy(lfw::field_or(snap_, u"is_on_ground"));
    wakeup_invuln = num(u"wakeup_invuln");
    set_ghosted(num(u"ghosted"));
    set_invisible(num(u"invisible"));
    set_invulnerable(num(u"invulnerable"));
  }

  lfw::Value snap_;
  std::u16string team_;
};

}  // namespace fx