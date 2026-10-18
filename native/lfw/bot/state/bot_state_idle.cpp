#include "lfw/bot/state/bot_state_idle.h"

#include <string>
#include <variant>
#include <vector>

#include "lfw/bot/bot_controller.h"
#include "lfw/bot/state/bot_state_keys.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/state_enum.h"
#include "lfw/defines/weapon_type.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/mersenne_twister.h"

namespace lfw {
namespace bot {

namespace {

bool frame_state_is(const controller::CtrlEnv& e, StateEnum s) {
  return strict_equals(state_of_env(e), Value(static_cast<double>(s)));
}

}  // namespace

BotState_Idle::BotState_Idle(BotController& ctrl) : BotState_Base(ctrl) {
  key_ = Value(std::u16string(bse::kIdle));
}

void BotState_Idle::enter() {
  BotController& c = ctrl_;
  c.key_up(all_game_key_names());
  const double player_l = c.stage_player_l();
  const double player_r = c.stage_player_r();
  const double near_v = c.stage_near();
  const double far_v = c.stage_far();
  const double midx = (player_l + player_r) * 0.5;
  const double midz = (near_v + far_v) * 0.5;
  if (MersenneTwister* m = c.mt()) {
    m->mark = u"bot_idle";
    c.idle_min_x = round(m->range(player_l, midx));
    c.idle_max_x = round(m->range(midx, player_r));
    c.idle_min_z = round(m->range(far_v, midz));
    c.idle_max_z = round(m->range(midz, near_v));
  }
  if (c.behavior == BotBehavior::Stay && truthy(c.goingto)) {
    const double in_x = defines::num(u"Defines.AI_COME_RANGE_IN_X");
    const double in_z = defines::num(u"Defines.AI_COME_RANGE_IN_Z");
    const double gx = to_number(field_or(c.goingto, u"x"));
    const double gz = to_number(field_or(c.goingto, u"z"));
    c.idle_min_x = round(gx - in_x);
    c.idle_max_x = round(gx + in_x);
    c.idle_min_z = round(gz - in_z);
    c.idle_max_z = round(gz + in_z);
  }
}

void BotState_Idle::leave() {
  const controller::CtrlEnv* e = ctrl_.env();
  if (e == nullptr) return;
  if (frame_state_is(*e, StateEnum::Drink)) ctrl_.click({u"d"});
}

std::optional<Value> BotState_Idle::update(double dt) {
  (void)dt;
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return std::nullopt;
  if (e->hp <= 0) return next_state(bse::kDead);
  if (c.stage_is_stage_finish()) return next_state(bse::kStageEnd);
  if (c.is_leave_goto_range(c.self_ref())) return next_state(bse::kFollowing);
  if (handle_bot_actions(u"hba_i")) return std::nullopt;
  if (handle_defends(u"hd_i")) return std::nullopt;

  const double my_x = e->px;
  const double my_z = e->pz;
  // 空闲时远离边界
  if (my_x < c.idle_min_x) {
    c.key_down({u"R"});
    c.key_up({u"L"});
  } else if (my_x > c.idle_max_x) {
    c.key_down({u"L"});
    c.key_up({u"R"});
  } else {
    c.key_up({u"L", u"R"});
  }

  if (my_z < c.idle_min_z) {
    c.key_down({u"D"});
    c.key_up({u"U"});
  } else if (my_z > c.idle_max_z) {
    c.key_down({u"U"});
    c.key_up({u"D"});
  } else {
    c.key_up({u"U", u"D"});
  }

  const Value watching = c.watching.ref();
  if (truthy(watching) && truthy(field_or(watching, u"mounted")) &&
      frame_state_is(*e, StateEnum::Standing) && my_x >= c.idle_min_x &&
      my_x <= c.idle_max_x && my_z >= c.idle_min_z && my_z <= c.idle_max_z) {
    const double wx = to_number(field_or(field_or(watching, u"position"), u"x"));
    if (wx > my_x && e->facing < 0) c.click({u"R"});
    else if (wx < my_x && e->facing > 0) c.click({u"L"});
  }

  /* 概率停跑 */
  if (frame_state_is(*e, StateEnum::Running) && c.desire(u"idle_stop_run") < 100) {
    c.click({e->facing > 0 ? u"L" : u"R"});
    return std::nullopt;
  }

  const Value en = this->en();
  const Value av = this->av();
  const Value wt = holding_base_type_of_env(*e);
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Drink)))) {
    if (truthy(av)) return next_state(bse::kAvoiding);
    /* 喝 */
    if (frame_state_is(*e, StateEnum::Running) || frame_state_is(*e, StateEnum::Standing) ||
        frame_state_is(*e, StateEnum::Walking)) {
      c.click({u"a"});
    } else if (!frame_state_is(*e, StateEnum::Drink) &&
               !frame_state_is(*e, StateEnum::Defend) &&
               !frame_state_is(*e, StateEnum::Rowing)) {
      c.click({u"d"});
    }
  }

  const Value closest = this->closest({en, av});
  if (truthy(av) && same_entity(av, closest)) return next_state(bse::kAvoiding);
  if (truthy(en) && same_entity(en, closest)) return next_state(bse::kChasing);
  return std::nullopt;
}

}  // namespace bot
}  // namespace lfw
