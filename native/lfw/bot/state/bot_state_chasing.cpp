#include "lfw/bot/state/bot_state_chasing.h"

#include <string>
#include <variant>
#include <vector>

#include "lfw/bot/bot_controller.h"
#include "lfw/bot/state/bot_state_keys.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/defines/state_enum.h"
#include "lfw/defines/weapon_type.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/round_float.h"

namespace lfw {
namespace bot {

namespace {

bool frame_state_is(const controller::CtrlEnv& e, StateEnum s) {
  return strict_equals(state_of_env(e), Value(static_cast<double>(s)));
}

double dataset_num(const BotDataSet& d, const char16_t* key) {
  return d.num(std::u16string(key));
}

}  // namespace

BotState_Chasing::BotState_Chasing(BotController& ctrl) : BotState_Base(ctrl) {
  key_ = Value(std::u16string(bse::kChasing));
}

std::optional<Value> BotState_Chasing::update(double dt) {
  (void)dt;
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return std::nullopt;
  if (e->hp <= 0) return next_state(bse::kDead);
  if (c.stage_is_chapter_finish()) return next_state(bse::kIdle);
  if (c.stage_is_stage_finish()) return next_state(bse::kStageEnd);

  const Value en = c.chasings.get() != nullptr ? c.chasings.get()->entity.ref() : Value();
  if (truthy(en) && c.is_leave_chase_range(en)) return next_state(bse::kFollowing);
  if (c.is_leave_goto_range(c.self_ref())) return next_state(bse::kFollowing);

  if (handle_bot_actions(u"hba_c")) return std::nullopt;
  if (handle_defends(u"hd_c1")) return std::nullopt;
  handle_block();

  if (!truthy(en)) return next_state(bse::kIdle);

  const double me_facing = e->facing;
  const double my_x = e->px;
  const double my_z = e->pz;
  const Value guess = c.guess_entity_pos(en);
  const double en_x = to_number(field_or(guess, u"next_x"));
  const double en_z = to_number(field_or(guess, u"next_z"));

  // 敌人与自己的距离Z（敌在上时为负）
  const double rz = round(en_z - my_z);
  // 敌人与自己的距离X（敌人在背后时为负数）
  const double rx = round(me_facing * (en_x - my_x));
  const double absx = round(abs(my_x - en_x));

  if (absx > defines::num(u"Defines.AI_STAY_CHASING_RANGE") &&
      (c.behavior == BotBehavior::Stay || c.behavior == BotBehavior::Follow)) {
    c.en_out_of_range = true;
    return next_state(bse::kFollowing);
  }

  const double abs_dz = round_float(abs(my_z - en_z));
  const double atk_b_x = c.atk_b_x();
  const double atk_f_x = c.atk_f_x();
  const bool x_ok = between(rx, atk_b_x, atk_f_x);
  const bool z_ok = between(rz, dataset_num(c.dataset, u"w_atk_min_z"),
                            dataset_num(c.dataset, u"w_atk_max_z"));

  if ((!x_ok || !z_ok) &&
      equals(field_or(field_or(en, u"data"), u"type"),
             Value(static_cast<double>(EntityEnum::Fighter)))) {
    random_jumping(u"rj_c");
  }

  const Value wt = holding_base_type_of_env(*e);

  const Value stage_team = c.stage_value(u"team");
  const double player_l = c.stage_player_l();
  const double player_r = c.stage_player_r();
  c.en_out_of_range = !equals(Value(e->team), stage_team) &&
                      (en_x < player_l - 80 || en_x > player_r + 80);

  const char16_t* gk_f = me_facing > 0 ? u"R" : u"L";
  const Value state = state_of_env(*e);
  if (strict_equals(state, Value(static_cast<double>(StateEnum::Running)))) {
    return update_running();
  }
  if (strict_equals(state, Value(static_cast<double>(StateEnum::Dash)))) {
    return update_dash();
  }
  if (strict_equals(state, Value(static_cast<double>(StateEnum::Jump)))) {
    return update_jump();
  }
  if (strict_equals(state, Value(static_cast<double>(StateEnum::Catching)))) {
    // louisEx 空中推人的帧状态也是 Catching
    if (truthy(e->catching)) c.click({u"a"});
  } else if (strict_equals(state, Value(static_cast<double>(StateEnum::Standing))) ||
             strict_equals(state, Value(static_cast<double>(StateEnum::Walking)))) {
    if (!c.en_out_of_range) {
      const double r_desire = c.should_run(u"sr_c", field_or(en, u"position"));
      if (r_desire == 0) {
        // `if (!r_desire) break`：落到 switch 外面的尾巴
      } else {
        if (r_desire > 0) {
          c.db_hit({u"R"});
          c.end({u"R"});
          c.key_up({u"L"});
        } else {
          c.db_hit({u"L"});
          c.end({u"L"});
          c.key_up({u"R"});
        }
        return std::nullopt;
      }
    } else if (truthy(wt) && between(abs_dz, 0, 30)) {
      if (equals(wt, Value(static_cast<double>(WeaponEnum::Knife)))) {
        if (c.desire(u"rtwd") < 400) {
          c.key_down({gk_f});
          c.click({u"a"});
          return std::nullopt;
        }
      }
    }
  } else {
    c.key_up(all_game_key_names());
  }

  if (x_ok && z_ok) c.click({u"a"});
  hold_UD(rz, dataset_num(c.dataset, u"w_atk_min_z"), dataset_num(c.dataset, u"w_atk_max_z"));
  hold_LR(rx, atk_b_x, atk_f_x);
  if (equals(stage_team, Value(e->team))) {
    if (my_x < player_l) c.click({u"R"});
    if (my_x > player_r) c.click({u"L"});
  }
  return std::nullopt;
}

std::optional<Value> BotState_Chasing::update_dash() {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return std::nullopt;
  const Value en = this->en();
  if (!truthy(en)) return std::nullopt;

  const double my_x = e->px;
  const double my_z = e->pz;
  const double en_x = to_number(field_or(field_or(en, u"position"), u"x"));
  const double en_z = to_number(field_or(field_or(en, u"position"), u"z"));
  const double me_facing = e->facing;
  const double rx = round(me_facing * (en_x - my_x));
  const double rz = round(en_z - my_z);
  const bool x_ok = rx >= c.d_atk_min_x() && rx <= c.d_atk_max_x();
  // TS 原文第二个比较用的是 `rx`（不是 `rz`）—— 照抄。
  const bool z_ok = rz >= dataset_num(c.dataset, u"d_atk_min_z") &&
                    rx <= dataset_num(c.dataset, u"d_atk_max_z");
  if (x_ok && z_ok) {
    c.click({u"a"});
  }
  return std::nullopt;
}

std::optional<Value> BotState_Chasing::update_running() {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return std::nullopt;
  const Value en = this->en();
  if (!truthy(en)) return std::nullopt;
  const Value wt = holding_base_type_of_env(*e);

  const double me_facing = e->facing;
  const double my_x = e->px;
  const double my_z = e->pz;
  const Value en_pos = field_or(en, u"position");
  const double en_x = to_number(field_or(en_pos, u"x"));
  const double en_z = to_number(field_or(en_pos, u"z"));

  const char16_t* gk_f = me_facing > 0 ? u"R" : u"L";
  const char16_t* gk_b = me_facing > 0 ? u"L" : u"R";

  /* 奔跑中无特殊情况时，不需要按'前'，此处松开'前' */
  c.key_up({gk_f});

  const double rz = round(en_z - my_z);
  const double rx = round(me_facing * (en_x - my_x));

  const bool x_ok = between(rx, c.w_atk_b_x(), c.w_atk_f_x());
  const bool z_ok = between(rz, dataset_num(c.dataset, u"r_atk_min_z"),
                            dataset_num(c.dataset, u"r_atk_max_z"));

  if (x_ok && z_ok) {
    if (entity::is_weapon(en)) {
      c.click({gk_b});
    } else if (entity::is_fighter(en)) {
      if (c.desire(u"chasing_1") < dataset_num(c.dataset, u"r_atk_desire")) {
        c.click({u"a"});
      }
    } else {
      c.click({u"a"});
    }
    return std::nullopt;
  }

  hold_UD(rz, dataset_num(c.dataset, u"r_atk_min_z"), dataset_num(c.dataset, u"r_atk_max_z"));

  /* 避免跑过头停下：概率刹车 */
  if (!x_ok) {
    if ((my_x > en_x && me_facing > 0) || (my_x < en_x && me_facing < 0) ||
        c.desire(u"chasing_stop_running_1") < dataset_num(c.dataset, u"r_stop_desire")) {
      c.click({gk_b});
      return std::nullopt;
    }
  }

  /* 概率丢武器 */
  if (truthy(wt)) {
    const double d = c.desire(u"rtwd_1");
    const bool t_ok = (equals(wt, Value(static_cast<double>(WeaponEnum::Knife))) && d < 400) ||
                      (equals(wt, Value(static_cast<double>(WeaponEnum::Stick))) && d < 100) ||
                      (equals(wt, Value(static_cast<double>(WeaponEnum::Drink))) && d < 50);
    if (t_ok) {
      c.click({gk_f});
      c.click({u"a"});
    }
    return std::nullopt;
  }
  return std::nullopt;
}

std::optional<Value> BotState_Chasing::update_jump() {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return std::nullopt;
  const Value en = this->en();
  if (!truthy(en)) return std::nullopt;
  const Value wt = holding_base_type_of_env(*e);

  const double me_facing = e->facing;
  const double my_x = e->px;
  const double my_z = e->pz;
  const double my_y = e->py;
  const Value en_pos = field_or(en, u"position");
  const double en_x = to_number(field_or(en_pos, u"x"));
  const double en_z = to_number(field_or(en_pos, u"z"));
  const double en_y = to_number(field_or(en_pos, u"y"));

  const double rz = round(en_z - my_z);
  const double rx = round(me_facing * (en_x - my_x));
  const double ry = round(en_y - my_y);

  if (e->is_on_ground) {
    // 地面上，控制跳越方向
    hold_UD(rz, -30, 30);
    hold_LR(rx, -60, 60);
    return std::nullopt;
  }

  const char16_t* gk_f = me_facing > 0 ? u"R" : u"L";
  /* 概率丢武器（这里暂时不考虑 X 距离） */
  if (truthy(wt)) {
    const double d = c.desire(u"jtw");
    const bool t_ok = (equals(wt, Value(static_cast<double>(WeaponEnum::Knife))) && d < 400) ||
                      (equals(wt, Value(static_cast<double>(WeaponEnum::Stick))) && d < 100) ||
                      (equals(wt, Value(static_cast<double>(WeaponEnum::Drink))) && d < 50);
    if (t_ok) {
      c.click({gk_f});
      c.click({u"a"});
    }
  }

  const bool x_ok = between(rx, 0, c.j_atk_x());
  const bool z_ok = between(rz, dataset_num(c.dataset, u"j_atk_min_z"),
                            dataset_num(c.dataset, u"j_atk_max_z"));
  const bool y_ok = between(ry, dataset_num(c.dataset, u"j_atk_min_y"),
                            dataset_num(c.dataset, u"j_atk_max_y"));
  if (x_ok && z_ok && y_ok) {
    c.click({u"a"});
    return std::nullopt;
  }

  c.key_up({u"R", u"L", u"U", u"D"});
  return std::nullopt;
}

}  // namespace bot
}  // namespace lfw
