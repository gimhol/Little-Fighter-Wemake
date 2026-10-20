#include "lfw/bot/state/bot_state.h"

#include <string>
#include <variant>
#include <vector>

#include "lfw/bot/bot_controller.h"
#include "lfw/bot/closest.h"
#include "lfw/bot/state/bot_state_keys.h"
#include "lfw/core/value.h"
#include "lfw/defines/state_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/mersenne_twister.h"

namespace lfw {
namespace bot {

namespace {

bool frame_state_is(const controller::CtrlEnv& e, StateEnum s) {
  return strict_equals(state_of_env(e), Value(static_cast<double>(s)));
}

// `v.length` 的判定口径（`me.frame.bdy?.length` 用）：数组/字符串给长度，其余按
// 「没有 length」处理（JS 里 `{}.length` 是 `undefined` ⇒ `!undefined` 为真）。
bool has_length(const Value& v) {
  if (const Array* a = as_array(v)) return a->size() != 0;
  if (const std::u16string* s = std::get_if<std::u16string>(&v)) return !s->empty();
  return false;
}

}  // namespace

double BotState_Base::difficulty() const { return ctrl_.difficulty(); }

Value BotState_Base::en() const { return ctrl_.en(); }

Value BotState_Base::av() const { return ctrl_.av(); }

Value BotState_Base::closest(const std::vector<Value>& list) const {
  if (const Entity* const self = ctrl_.self_entity()) return bot::closest(*self, list);
  return bot::closest(ctrl_.self_ref(), list);
}

bool BotState_Base::wanted_jumping(const std::u16string& where) {
  BotController& c = ctrl_;
  const double desire = c.desire(where);
  const bool ret = desire < c.dataset.num(u"jump_desire") * 2;
  if (ret) c.click({u"j"});
  return ret;
}

bool BotState_Base::random_jumping(const std::u16string& where) {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return false;
  const double desire = c.desire(where);
  if (frame_state_is(*e, StateEnum::Running)) {
    const bool ret = desire < c.dataset.num(u"dash_desire");
    if (ret) c.click({u"j"});
    return ret;
  }
  if (frame_state_is(*e, StateEnum::Standing) || frame_state_is(*e, StateEnum::Walking)) {
    const bool ret = desire < c.dataset.num(u"jump_desire");
    if (ret) c.click({u"j"});
    return ret;
  }
  return false;
}

bool BotState_Base::handle_defends(const std::u16string& mark) {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return false;
  if (!frame_state_is(*e, StateEnum::Standing) &&
      !frame_state_is(*e, StateEnum::Walking) &&
      !frame_state_is(*e, StateEnum::Running) && !frame_state_is(*e, StateEnum::Jump) &&
      !frame_state_is(*e, StateEnum::Dash) && !frame_state_is(*e, StateEnum::Defend)) {
    return false;
  }
  if (!has_length(field_or(e->frame, u"bdy"))) return c._false(mark, {Value(1.0)});
  if (e->invisible) return c._false(mark, {Value(3.0)});
  if (e->invulnerable) return c._false(mark, {Value(4.0)});

  const Entity* const target = c.defends.get();
  if (target == nullptr) return c._false(mark, {Value(5.0)});

  const double en_facing = target->facing;
  if (c.desire(mark) < c.defend_desire()) {
    if (en_facing < 0 && e->facing < 0) c.click({u"R"});
    if (en_facing > 0 && e->facing > 0) c.click({u"L"});
    c.click({u"d"});
    return c._true(mark, {Value(8.0)});
  }
  return c._true(mark, {Value(9.0)});
}

bool BotState_Base::handle_block() {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return false;
  if (e->blockers_count != 0) {
    c.key_down({u"a"});
    c.key_up({u"a"});
  }
  return e->blockers_count != 0;
}

bool BotState_Base::handle_bot_actions(const std::u16string& where) {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return false;
  const Value bot = field_or(field_or(e->data, u"base"), u"bot");
  if (!truthy(bot)) return false;

  std::vector<Value> results;
  const Value actions = field_or(bot, u"actions");
  const Value frame_ids = field_key(field_or(bot, u"frames"),
                                    to_string(field_or(e->frame, u"id")));
  if (const Array* ids = as_array(frame_ids)) {
    for (const Value& aid : ids->items()) {
      const Value action = field_key(actions, to_string(aid));
      const Value result = c.handle_action(where + u"1", action);
      if (truthy(result)) results.push_back(result);
    }
  }
  const Value state_ids = field_key(field_or(bot, u"states"), to_string(state_of_env(*e)));
  if (const Array* ids = as_array(state_ids)) {
    for (const Value& aid : ids->items()) {
      const Value action = field_key(actions, to_string(aid));
      const Value result = c.handle_action(where + u"2", action);
      if (truthy(result)) results.push_back(result);
    }
  }

  if (results.empty()) return false;

  MersenneTwister* m = c.mt();
  if (m == nullptr) return false;
  m->mark = where;
  const Value result = m->pick_value(Value(std::make_shared<Array>(results)));
  if (!truthy(result)) return false;

  if (const Array* keys = as_array(result)) {
    std::vector<std::u16string> ks;
    for (const Value& k : keys->items()) ks.push_back(to_string(k));
    c.key_up(ks);
    c.start(ks);
    c.end(ks);
    m->log_case({Value(u"keys"), Value(array_join(*keys))});
  } else {
    c.bot_frame = result;
    m->log_case({Value(u"frame"), result});
  }
  return true;
}

void BotState_Base::hold_UD(double rz, double min_z, double max_z) {
  BotController& c = ctrl_;
  if (rz < min_z) {
    c.key_down({u"U"});
    c.key_up({u"D"});
  } else if (rz > max_z) {
    c.key_down({u"D"});
    c.key_up({u"U"});
  } else {
    c.key_up({u"D", u"U"});
  }
}

void BotState_Base::hold_LR(double rx, double min_x, double max_x) {
  BotController& c = ctrl_;
  const controller::CtrlEnv* e = c.env();
  if (e == nullptr) return;
  const bool facing_pos = e->facing > 0;
  const char16_t* gk_f = facing_pos ? u"R" : u"L";
  const char16_t* gk_b = facing_pos ? u"L" : u"R";
  if (rx < min_x) {
    c.key_down({gk_b});
    c.key_up({gk_f});
  } else if (rx > max_x) {
    c.key_down({gk_f});
    c.key_up({gk_b});
  } else {
    c.key_up({gk_f, gk_b});
  }
}

}  // namespace bot
}  // namespace lfw
