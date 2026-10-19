#include "lfw/bot/state/bot_state_misc.h"

#include <string>
#include <variant>

#include "lfw/bot/bot_controller.h"
#include "lfw/bot/state/bot_state_keys.h"
#include "lfw/defines/state_enum.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace bot {

namespace {

bool frame_state_is(const controller::CtrlEnv& e, StateEnum s) {
  return strict_equals(state_of_env(e), Value(static_cast<double>(s)));
}

// `this.following?.position ?? this.goingto`
Value follow_pos(const BotController& c) {
  const Value pos = !c.following.nullish() ? field_or(c.following.ref(), u"position") : Value();
  return nullish(pos) ? c.goingto : pos;
}

}  // namespace

// ==== `BotState_Following` ==================================================

BotState_Following::BotState_Following(BotController& ctrl) : BotState_Base(ctrl) {
  key_ = Value(std::u16string(bse::kFollowing));
}

void BotState_Following::enter() { ctrl_.key_up(all_game_key_names()); }

std::optional<Value> BotState_Following::update(double dt) {
  (void)dt;
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return std::nullopt;
  if (e->hp <= 0) return next_state(bse::kDead);
  if (c.stage_is_chapter_finish()) return next_state(bse::kIdle);
  if (c.stage_is_stage_finish()) return next_state(bse::kStageEnd);
  if (handle_defends(u"hd_f")) return std::nullopt;
  if (handle_block()) return std::nullopt;
  random_jumping(u"rj_f");

  const Value pos = follow_pos(c);
  if (!truthy(pos)) return next_state(bse::kIdle);

  const double my_x = e->px;
  const double my_z = e->pz;
  const double en_x = to_number(field_or(pos, u"x"));
  const double en_z = to_number(field_or(pos, u"z"));

  // `me.frame.state == StateEnum.Walking && should_run(...)`（松散相等）
  const bool walking = equals(state_of_env(*e), Value(static_cast<double>(StateEnum::Walking)));
  const double should_run = walking ? c.should_run(u"sr_f", pos) : 0.0;
  if (truthy(Value(should_run))) {
    c.db_hit({should_run > 0 ? u"R" : u"L"});
  } else if (my_x < en_x - 10) {
    c.key_down({u"R"});
    c.key_up({u"L"});
  } else if (my_x > en_x + 10) {
    c.key_down({u"L"});
    c.key_up({u"R"});
  } else {
    c.key_up({u"R", u"L"});
  }

  if (my_z < en_z - 10) {
    c.key_down({u"D"});
    c.key_up({u"U"});
  } else if (my_z > en_z + 10) {
    c.key_down({u"U"});
    c.key_up({u"D"});
  } else {
    c.key_up({u"U", u"D"});
  }

  if (!c.is_enter_goto_range(c.self_ref())) return std::nullopt;

  if (equals(state_of_env(*e), Value(static_cast<double>(StateEnum::Running)))) {
    // 别跑了
    c.key_down({e->facing < 0 ? u"R" : u"L"});
  }
  return next_state(bse::kIdle);
}

// ==== `BotState_StageEnd` ===================================================

BotState_StageEnd::BotState_StageEnd(BotController& ctrl) : BotState_Base(ctrl) {
  key_ = Value(std::u16string(bse::kStageEnd));
}

void BotState_StageEnd::enter() { ctrl_.key_up(all_game_key_names()); }

void BotState_StageEnd::leave() { ctrl_.key_up(all_game_key_names()); }

std::optional<Value> BotState_StageEnd::update(double dt) {
  (void)dt;
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return std::nullopt;
  if (e->hp <= 0) return next_state(bse::kDead);
  handle_block();

  // 章结束，什么都不用干
  if (c.stage_is_chapter_finish()) return std::nullopt;

  const bool stage_end = c.stage_is_stage_finish();
  const bool running = equals(state_of_env(*e), Value(static_cast<double>(StateEnum::Running)));

  // 节未结束，可能已经进入下一节，故停止奔跑
  if (!stage_end && running) {
    c.key_down({e->facing > 0 ? u"L" : u"R"});
    return next_state(bse::kIdle);
  }

  // 目前全都是往右跑进入下一节
  if (stage_end && !running) {
    c.key_down({u"R"});
    c.key_up(all_game_key_names());
  }
  return std::nullopt;
}

// ==== `BotState_Dead` =======================================================

BotState_Dead::BotState_Dead(BotController& ctrl) : BotState_Base(ctrl) {
  key_ = Value(std::u16string(bse::kDead));
}

void BotState_Dead::enter() { ctrl_.key_up(all_game_key_names()); }

std::optional<Value> BotState_Dead::update(double dt) {
  (void)dt;
  const controller::CtrlEnv* e = ctrl_.env();
  if (e == nullptr) return std::nullopt;
  if (e->hp > 0) return next_state(bse::kIdle);
  return std::nullopt;
}

}  // namespace bot
}  // namespace lfw
