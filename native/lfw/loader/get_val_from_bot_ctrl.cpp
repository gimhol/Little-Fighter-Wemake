#include "lfw/loader/get_val_from_bot_ctrl.h"

#include <limits>
#include <string>
#include <variant>

#include "lfw/bot/bot_env.h"
#include "lfw/controller/base_controller.h"
#include "lfw/defines/bot_val.h"
#include "lfw/defines/state_enum.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace loader {

namespace {

double env_px(const bot::BotController& c) {
  const controller::CtrlEnv* e = c.env();
  return e != nullptr ? e->px : 0.0;
}

double env_py(const bot::BotController& c) {
  const controller::CtrlEnv* e = c.env();
  return e != nullptr ? e->py : 0.0;
}

double env_pz(const bot::BotController& c) {
  const controller::CtrlEnv* e = c.env();
  return e != nullptr ? e->pz : 0.0;
}

Value val_desire(const bot::BotController& c, const std::u16string&, BinOp) {
  return Value(c.desire(u"bot_val"));
}

Value val_bot_state(const bot::BotController& c, const std::u16string&, BinOp) {
  // `e.fsm.state?.key ?? ''` —— 注意这里**不是** `e.bot_state`（那个在无状态时给
  // `BSE.Idle`；这个给空串）。
  const IState* const st = c.fsm.state();
  return st != nullptr ? st->key() : Value(std::u16string());
}

Value val_enemy_y(const bot::BotController& c, const std::u16string&, BinOp) {
  const Value en = c.en();
  return truthy(en) ? field_or(field_or(en, u"position"), u"y") : Value();
}

Value val_enemy_diff_y(const bot::BotController& c, const std::u16string&, BinOp) {
  const Value en = c.en();
  if (!truthy(en)) return Value(std::numeric_limits<double>::quiet_NaN());
  return Value(to_number(field_or(field_or(en, u"position"), u"y")) - env_py(c));
}

Value val_enemy_x(const bot::BotController& c, const std::u16string&, BinOp) {
  const Value en = c.en();
  return truthy(en) ? field_or(field_or(en, u"position"), u"x") : Value();
}

Value val_enemy_diff_x(const bot::BotController& c, const std::u16string&, BinOp) {
  const Value en = c.en();
  if (!truthy(en)) return Value(std::numeric_limits<double>::quiet_NaN());
  return Value(c.facing() *
               (to_number(field_or(field_or(en, u"position"), u"x")) - env_px(c)));
}

Value val_enemy_state(const bot::BotController& c, const std::u16string&, BinOp) {
  const Value en = c.en();
  return truthy(en) ? bot::state_of_ref(en) : Value();
}

bool attacking_state(const Value& state) {
  for (const double s : attcking_states()) {
    if (strict_equals(state, Value(s))) return true;
  }
  return false;
}

Value val_safe(const bot::BotController& c, const std::u16string&, BinOp) {
  if (!c.defends.empty()) return Value(0.0);
  const Value chasing = c.en();
  const Value avoiding = c.av();
  if (truthy(chasing) && abs(to_number(field_or(field_or(chasing, u"position"), u"x")) - env_px(c)) < 200 &&
      abs(to_number(field_or(field_or(chasing, u"position"), u"z")) - env_pz(c)) < 150) {
    return Value(0.0);
  }
  if (truthy(chasing) && attacking_state(bot::state_of_ref(chasing))) return Value(0.0);
  if (truthy(avoiding) && abs(to_number(field_or(field_or(avoiding, u"position"), u"x")) - env_px(c)) < 200 &&
      abs(to_number(field_or(field_or(avoiding, u"position"), u"z")) - env_pz(c)) < 150) {
    return Value(0.0);
  }
  if (truthy(avoiding) && attacking_state(bot::state_of_ref(avoiding))) return Value(0.0);
  return Value(1.0);
}

Value val_enemy_out_of_range(const bot::BotController& c, const std::u16string&, BinOp) {
  return Value(c.en_out_of_range ? 1.0 : 0.0);
}

// 未命中 bot 表的词：回落实体 getter 表（`val_getter(e.entity, word, op)`），
// 再兜不住就给 `word` 本身（TS 的 `: () => word`）。
Value val_entity_fallback(const bot::BotController& c, const std::u16string& word, BinOp op) {
  const controller::CtrlEnv* e = c.env();
  if (e != nullptr && e->entity_val) return e->entity_val(word, op);
  return Value(word);
}

}  // namespace

ValGetter<bot::BotController> get_val_from_bot_ctrl(const std::u16string& word) {
  const std::u16string& w = word;
  if (w == std::u16string(bot_val::kDesire)) return &val_desire;
  if (w == std::u16string(bot_val::kBotState)) return &val_bot_state;
  if (w == std::u16string(bot_val::kEnemyY)) return &val_enemy_y;
  if (w == std::u16string(bot_val::kEnemyDiffY)) return &val_enemy_diff_y;
  if (w == std::u16string(bot_val::kEnemyX)) return &val_enemy_x;
  if (w == std::u16string(bot_val::kEnemyDiffX)) return &val_enemy_diff_x;
  if (w == std::u16string(bot_val::kEnemyState)) return &val_enemy_state;
  if (w == std::u16string(bot_val::kSafe)) return &val_safe;
  if (w == std::u16string(bot_val::kEnemyOutOfRange)) return &val_enemy_out_of_range;
  return &val_entity_fallback;
}

}  // namespace loader
}  // namespace lfw
