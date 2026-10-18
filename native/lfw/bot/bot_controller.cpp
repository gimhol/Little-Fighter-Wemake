#include "lfw/bot/bot_controller.h"

#include <cmath>
#include <limits>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "lfw/base/expression.h"
#include "lfw/bot/bot_env.h"
#include "lfw/bot/is_ray_hit.h"
#include "lfw/entity/entity.h"
#include "lfw/bot/state/bot_state_keys.h"
#include "lfw/core/js_string.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/difficulty.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/itr_kind.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/state_enum.h"
#include "lfw/defines/weapon_type.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/helper/closer_one.h"
#include "lfw/loader/get_val_from_bot_ctrl.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/clamp.h"
#include "lfw/utils/math/mersenne_twister.h"
#include "lfw/utils/math/round_float.h"

namespace lfw {
namespace bot {

namespace {

constexpr double kMaxSafeInteger = 9007199254740991.0;

bool frame_state_is(const controller::CtrlEnv& e, StateEnum s) {
  return strict_equals(state_of_env(e), Value(static_cast<double>(s)));
}

double ref_x(const Value& ref) {
  return to_number(field_or(field_or(ref, u"position"), u"x"));
}

double ref_y(const Value& ref) {
  return to_number(field_or(field_or(ref, u"position"), u"y"));
}

double ref_z(const Value& ref) {
  return to_number(field_or(field_or(ref, u"position"), u"z"));
}

double ref_vel(const Value& ref, const char16_t* axis) {
  return to_number(field_or(field_or(ref, u"velocity"), axis));
}

double ref_hp(const Value& ref) { return to_number(field_or(ref, u"hp")); }

bool strict_state_is(const Value& state, StateEnum s) {
  return strict_equals(state, Value(static_cast<double>(s)));
}

bool loose_state_is(const Value& state, StateEnum s) {
  return equals(state, Value(static_cast<double>(s)));
}

// `D.VOID_STAGE.id`
const Value& void_stage_id() {
  static const Value v = [] {
    const Value* const stage = defines::find(u"Defines.VOID_STAGE");
    return stage != nullptr ? field_or(*stage, u"id") : Value();
  }();
  return v;
}

// `keys?.join()`：`Array.join` 的缺省分隔符是 `,`。
std::u16string join_commas(const Value& keys) {
  const Array* a = as_array(keys);
  if (a == nullptr) return std::u16string();
  std::u16string out;
  for (size_t i = 0; i < a->items().size(); ++i) {
    if (i != 0) out += u",";
    out += to_string(a->items()[i]);
  }
  return out;
}

// `this.queue.join(';')`（`[Status, key]` 逐项 `String(...)`）。
std::u16string join_queue(const std::vector<std::pair<controller::Status, std::u16string>>& queue) {
  std::u16string out;
  for (size_t i = 0; i < queue.size(); ++i) {
    if (i != 0) out += u";";
    out += to_string(Value(static_cast<double>(queue[i].first)));
    out += u",";
    out += queue[i].second;
  }
  return out;
}

bool has_length(const Value& v) {
  if (const Array* a = as_array(v)) return a->size() != 0;
  if (const std::u16string* s = std::get_if<std::u16string>(&v)) return !s->empty();
  return false;
}

std::u16string join_ids(const std::vector<BotTarget>& targets) {
  std::u16string out;
  for (size_t i = 0; i < targets.size(); ++i) {
    if (i != 0) out += u",";
    out += to_string(field_or(targets[i].entity, u"id"));
  }
  return out;
}

// `String.prototype.trim()`（JS 的空白集：`c <= 0x20` 与 `is_str_white_space`）。
std::u16string trim_js(const std::u16string& s) {
  size_t b = 0;
  size_t e = s.size();
  while (b < e && (s[b] <= 0x20 || is_str_white_space(s[b]))) ++b;
  while (e > b && (s[e - 1] <= 0x20 || is_str_white_space(s[e - 1]))) --e;
  return s.substr(b, e - b);
}

}  // namespace

const char16_t* bot_behavior_name(BotBehavior v) {
  switch (v) {
    case BotBehavior::Stay: return u"Stay";
    case BotBehavior::Move: return u"Move";
    case BotBehavior::Follow: return u"Follow";
  }
  return u"";
}

Value BotController::dummy_default() { return Value(std::u16string(u"")); }

BotController::BotController()
    : chasings(defines::num(u"Defines.AI_MAX_CHASINGS_ENEMIES")),
      avoidings(defines::num(u"Defines.AI_MAX_AVOIDING_ENEMIES")),
      defends(defines::num(u"Defines.AI_MAX_DEFENDS_ENEMIES")),
      idle_(*this),
      chasing_(*this),
      avoiding_(*this),
      following_state_(*this),
      stage_end_(*this),
      dead_(*this) {
  // TS 的字段初值：`goingto` / `following` / `watching` 都是 `null`（不是 `undefined`）。
  goingto = Value(NullTag{});
  following = Value(NullTag{});
  watching = Value(NullTag{});
  idle_init_pending_ = true;
  fsm.add(&idle_, &chasing_, &avoiding_, &following_state_, &stage_end_, &dead_);
  // `this.fsm.reset(BSE.Idle)` 推迟到 env 就绪（见头文件注释）。
  set_kind(false, true);
}

void BotController::set_env(const controller::CtrlEnv* env) {
  BaseController::set_env(env);
  if (env != nullptr && idle_init_pending_) {
    idle_init_pending_ = false;
    fsm.reset(Value(std::u16string(bse::kIdle)));
  }
}

void BotController::reset() {
  BaseController::reset();
  chasings.clear();
  avoidings.clear();
  defends.clear();
  goingto = Value(NullTag{});
  following = Value(NullTag{});
  watching = Value(NullTag{});
  behavior = BotBehavior::Move;
  en_out_of_range = false;
  idle_min_x = -kMaxSafeInteger;
  idle_max_x = kMaxSafeInteger;
  idle_min_z = -kMaxSafeInteger;
  idle_max_z = kMaxSafeInteger;
  bot_frame = Value();
  dummy = dummy_default();
  bot_id = Value();
  bot = Value();
  idle_init_pending_ = true;
}

void BotController::set_dummy(const Value& v) {
  // `key_up(...Object.values(GK))`（14 项，需用 `object_values_game_keys`，不是 AGK）。
  std::vector<std::u16string> all;
  for (const char16_t* k : lfw::object_values_game_keys()) all.emplace_back(k);
  key_up(all);
  dummy = v;
}

Value BotController::self_ref() const {
  const controller::CtrlEnv* e = env();
  return e != nullptr ? self_ref_of_env(*e) : Value();
}

void BotController::look_target(NearestTargets& nt, const Value& other_ref,
                                const Value& defendable) {
  if (const Entity* const self = self_entity()) {
    nt.look(*self, other_ref, defendable);
    return;
  }
  nt.look(self_ref(), other_ref, defendable);
}

void BotController::sort_targets(NearestTargets& nt) {
  if (const Entity* const self = self_entity()) {
    nt.sort(*self);
    return;
  }
  nt.sort(self_ref());
}

double BotController::difficulty() const {
  const controller::CtrlEnv* e = env();
  return e != nullptr && e->bot_difficulty ? e->bot_difficulty() : 0.0;
}

double BotController::facing() const {
  const controller::CtrlEnv* e = env();
  return e != nullptr ? e->facing : 1.0;
}

const std::u16string& BotController::team() const {
  static const std::u16string kEmpty;
  const controller::CtrlEnv* e = env();
  return e != nullptr ? e->team : kEmpty;
}

Value BotController::en() const {
  const BotTarget* t = chasings.get();
  return t != nullptr ? t->entity : Value();
}

Value BotController::av() const {
  const BotTarget* t = avoidings.get();
  return t != nullptr ? t->entity : Value();
}

Value BotController::bot_state() const {
  IState* s = fsm.state();
  if (s != nullptr) return s->key();
  return Value(std::u16string(bse::kIdle));
}

double BotController::atk_f_x() const {
  const controller::CtrlEnv* e = env();
  if (e != nullptr) {
    if (frame_state_is(*e, StateEnum::Running)) return r_atk_x();
    if (frame_state_is(*e, StateEnum::Dash)) return d_atk_max_x();
    if (frame_state_is(*e, StateEnum::Jump)) return j_atk_x();
  }
  return w_atk_f_x();
}

double BotController::atk_b_x() const {
  const controller::CtrlEnv* e = env();
  if (e != nullptr) {
    if (frame_state_is(*e, StateEnum::Running)) return -8;
    if (frame_state_is(*e, StateEnum::Dash)) return d_atk_min_x();
    if (frame_state_is(*e, StateEnum::Jump)) return -8;
  }
  return w_atk_b_x();
}

double BotController::w_atk_f_x() const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return 0;
  const Value en_ref = en();
  if (!truthy(en_ref)) return 0;
  if (entity::is_weapon(en_ref)) return dataset.num(u"pick_weapon_f_x");
  const Value wt = holding_base_type_of_env(*e);
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Baseball))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Drink)))) {
    return 800;
  }
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Stick))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Knife)))) {
    return 90;
  }
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Heavy)))) return 200;
  return dataset.num(u"w_atk_x");
}

double BotController::w_atk_b_x() const {
  const Value en_ref = en();
  if (!truthy(en_ref)) return 0;
  if (entity::is_weapon(en_ref)) return dataset.num(u"pick_weapon_b_x");
  return -8;
}

double BotController::r_atk_x() const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return 0;
  const Value en_ref = en();
  if (!truthy(en_ref)) return 0;
  const Value wt = holding_base_type_of_env(*e);
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Baseball))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Drink)))) {
    return 800;
  }
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Heavy)))) return 200;
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Stick))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Knife)))) {
    return 100;
  }
  return dataset.num(u"r_atk_x");
}

double BotController::d_atk_max_x() const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return 0;
  if (!truthy(en())) return 0;
  const Value wt = holding_base_type_of_env(*e);
  const double sp = e->facing * e->vx * 8;
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Baseball))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Drink)))) {
    return sp + 100;
  }
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Stick))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Knife)))) {
    return 100;
  }
  return sp + dataset.num(u"d_atk_max_x");
}

double BotController::d_atk_min_x() const {
  if (!truthy(en())) return 0;
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return 0;
  const Value wt = holding_base_type_of_env(*e);
  if (truthy(wt)) return 0;
  return dataset.num(u"d_atk_min_x");
}

double BotController::j_atk_x() const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return 0;
  if (!truthy(en())) return 0;
  const Value wt = holding_base_type_of_env(*e);
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Baseball))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Drink)))) {
    return 200;
  }
  if (strict_equals(wt, Value(static_cast<double>(WeaponEnum::Stick))) ||
      strict_equals(wt, Value(static_cast<double>(WeaponEnum::Knife)))) {
    return 110;
  }
  return dataset.num(u"j_atk_x");
}

double BotController::w_atk_m_x() const {
  const controller::CtrlEnv* e = env();
  Value v;
  if (e != nullptr && truthy(e->holding)) {
    v = field_or(field_or(field_or(e->holding, u"data"), u"base"), u"w_atk_m_x");
  }
  return to_number(or_nullish(v, Value(dataset.num(u"w_atk_m_x"))));
}

double BotController::w_atk_r_x() const {
  const controller::CtrlEnv* e = env();
  Value v;
  if (e != nullptr && truthy(e->holding)) {
    v = field_or(field_or(field_or(e->holding, u"data"), u"base"), u"w_atk_r_x");
  }
  return to_number(or_nullish(v, Value(dataset.num(u"w_atk_r_x"))));
}

double BotController::defend_desire() const {
  const double d = difficulty() - 1;
  return round(dataset.num(u"defend_desire_base") + d * dataset.num(u"defend_desire_step"));
}

Value BotController::stage_value(const std::u16string& key) const {
  const controller::CtrlEnv* e = env();
  return e != nullptr && e->stage_value ? e->stage_value(key) : Value();
}

double BotController::stage_player_l() const { return to_number(stage_value(u"player_l")); }

double BotController::stage_player_r() const { return to_number(stage_value(u"player_r")); }

double BotController::stage_near() const { return to_number(stage_value(u"near")); }

double BotController::stage_far() const { return to_number(stage_value(u"far")); }

bool BotController::stage_is_stage_finish() const {
  return truthy(stage_value(u"is_stage_finish"));
}

bool BotController::stage_is_chapter_finish() const {
  return truthy(stage_value(u"is_chapter_finish"));
}

bool BotController::has_players_alive() const {
  const controller::CtrlEnv* e = env();
  return e != nullptr && e->has_players_alive ? e->has_players_alive() : false;
}

std::vector<double> BotController::get_bound() const {
  const controller::CtrlEnv* e = env();
  return e != nullptr && e->get_bound ? e->get_bound() : std::vector<double>();
}

MersenneTwister* BotController::mt() const {
  const controller::CtrlEnv* e = env();
  return e != nullptr ? e->mt : nullptr;
}

bool BotController::w_atk_too_far(const Value& o_ref) const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  const double atk_r_x = w_atk_r_x();
  const double abs_dx = abs(e->px - ref_x(o_ref));
  return atk_r_x > 0 && atk_r_x < abs_dx;
}

bool BotController::w_atk_too_close(const Value& o_ref) const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  const double atk_m_x = w_atk_m_x();
  const double abs_dx = abs(e->px - ref_x(o_ref));
  return atk_m_x > 0 && atk_m_x > abs_dx;
}

bool BotController::can_back_off(const Value& o_ref) const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  const double x = e->px;
  const double en_x = ref_x(o_ref);
  const double abs_dx = abs(x - en_x);
  const std::vector<double> b = get_bound();
  const double l = b.size() > 0 ? b[0] : 0.0;
  const double r = b.size() > 1 ? b[1] : 0.0;
  const double reach = en_x > x ? en_x - l : r - en_x;
  if (reach > w_atk_r_x()) return true;
  if (cornered(o_ref)) return true;
  const double atk_m_x = w_atk_m_x();
  return atk_m_x > 0 && abs_dx < atk_m_x && reach > atk_m_x;
}

bool BotController::cornered(const Value& o_ref) const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  const double x = e->px;
  const double en_x = ref_x(o_ref);
  const double abs_dx = abs(x - en_x);
  const double atk_m_x = w_atk_m_x();
  if (!(atk_m_x > 0) || atk_m_x <= abs_dx) return false;
  const std::vector<double> b = get_bound();
  const double l = b.size() > 0 ? b[0] : 0.0;
  const double r = b.size() > 1 ? b[1] : 0.0;
  const double reach = en_x > x ? en_x - l : r - en_x;
  if (reach > atk_m_x) return false;
  return en_x > x ? x < r : x > l;
}

double BotController::should_run(const std::u16string& where, const Value& target) {
  desire(where);
  if (!truthy(target)) return 0;
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return 0;
  const double r_x_min = dataset.num(u"r_x_min");
  double dx = round(abs(e->px - to_number(field_or(target, u"x"))) - r_x_min);
  bool should_run_flag = false;
  const double r_x_r = dataset.num(u"r_x_max") - r_x_min;
  if (r_x_r == 0) {
    should_run_flag = desire(where + u"1") < r_x_min;
  } else {
    dx = round(clamp(dx, 0, r_x_r) / r_x_r);
    const double min_v = dataset.num(u"r_desire_min") +
                         (dataset.num(u"r_desire_max") - dataset.num(u"r_desire_min")) * dx;
    should_run_flag = desire(where + u"#" + to_string(Value(dx))) < min_v;
  }
  if (dx < 0) should_run_flag = false;
  if (!should_run_flag) return 0;
  return e->px > to_number(field_or(target, u"x")) ? -1 : 1;
}

// `this.following?.position ?? this.goingto`
Value follow_position(const BotController& c) {
  const Value pos = truthy(c.following) ? field_or(c.following, u"position") : Value();
  return nullish(pos) ? c.goingto : pos;
}

bool BotController::is_enter_goto_range(const Value& entity_ref) const {
  const Value pos = follow_position(*this);
  if (!truthy(pos)) return false;
  const double x = ref_x(entity_ref);
  const double z = ref_z(entity_ref);
  const double en_x = to_number(field_or(pos, u"x"));
  const double en_z = to_number(field_or(pos, u"z"));
  double offset_x = 0;
  double offset_z = 0;
  if (strict_equals(bot_state(), Value(std::u16string(bse::kFollowing)))) {
    offset_x = defines::num(u"Defines.AI_FOLLOWING_RANGE_IN_X");
    offset_z = defines::num(u"Defines.AI_FOLLOWING_RANGE_IN_Z");
  } else {
    offset_x = defines::num(u"Defines.AI_COME_RANGE_IN_X");
    offset_z = defines::num(u"Defines.AI_COME_RANGE_IN_Z");
  }
  const double bound_l = round(en_x - offset_x);
  const double bound_r = round(en_x + offset_x);
  const double bound_t = round(en_z - offset_z);
  const double bound_b = round(en_z + offset_z);
  return between(x, bound_l, bound_r) && between(z, bound_t, bound_b);
}

bool BotController::is_leave_goto_range(const Value& entity_ref) const {
  const Value pos = follow_position(*this);
  if (!truthy(pos)) return false;
  const double x = ref_x(entity_ref);
  const double z = ref_z(entity_ref);
  const double en_x = to_number(field_or(pos, u"x"));
  const double en_z = to_number(field_or(pos, u"z"));
  double offset_x = 0;
  double offset_z = 0;
  if (strict_equals(bot_state(), Value(std::u16string(bse::kFollowing)))) {
    offset_x = defines::num(u"Defines.AI_FOLLOWING_RANGE_OUT_X");
    offset_z = defines::num(u"Defines.AI_FOLLOWING_RANGE_OUT_Z");
  } else {
    offset_x = defines::num(u"Defines.AI_COME_RANGE_OUT_X");
    offset_z = defines::num(u"Defines.AI_COME_RANGE_OUT_Z");
  }
  const double bound_l = round(en_x - offset_x);
  const double bound_r = round(en_x + offset_x);
  const double bound_t = round(en_z - offset_z);
  const double bound_b = round(en_z + offset_z);
  return !(between(x, bound_l, bound_r) && between(z, bound_t, bound_b));
}

bool BotController::is_leave_chase_range(const Value& target_ref) const {
  const Value pos = follow_position(*this);
  if (!truthy(pos)) return false;
  const double x = ref_x(target_ref);
  const double z = ref_z(target_ref);
  const double en_x = to_number(field_or(pos, u"x"));
  const double en_z = to_number(field_or(pos, u"z"));
  double offset_x = 0;
  double offset_z = 0;
  if (strict_equals(bot_state(), Value(std::u16string(bse::kFollowing)))) {
    offset_x = defines::num(u"Defines.AI_FOLLOWING_RANGE_OUT_X");
    offset_z = defines::num(u"Defines.AI_FOLLOWING_RANGE_OUT_Z");
  } else {
    offset_x = defines::num(u"Defines.AI_COME_RANGE_OUT_X");
    offset_z = defines::num(u"Defines.AI_COME_RANGE_OUT_Z");
  }
  offset_x += defines::num(u"Defines.AI_STAY_CHASING_RANGE");
  offset_z += defines::num(u"Defines.AI_STAY_CHASING_RANGE");
  const double bound_l = round(en_x - offset_x);
  const double bound_r = round(en_x + offset_x);
  const double bound_t = round(en_z - offset_z);
  const double bound_b = round(en_z + offset_z);
  return !(between(x, bound_l, bound_r) && between(z, bound_t, bound_b));
}

bool BotController::should_chase(const Value& e_ref) {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  if (truthy(e->catching)) return same_entity(e->catching, e_ref);

  // 正在注视的对象已失效（死亡/消失/回到可追击范围）时置空
  if (same_entity(watching, e_ref) && truthy(e_ref)) {
    if (!truthy(field_or(e_ref, u"mounted")) || ref_hp(e_ref) <= 0 ||
        !is_leave_chase_range(e_ref)) {
      watching = Value(NullTag{});
    }
  }

  if (!e->mounted) return false;
  if (!truthy(field_or(e_ref, u"mounted"))) return false;
  if (e->hp <= 0) return false;
  if (ref_hp(e_ref) <= 0) return false;
  if (equals(bot_ignore_of_ref(e_ref), Value(1.0))) return false;
  if (truthy(e->holding) && same_entity(e_ref, e->holding)) return false;
  if (truthy(e->catching) && same_entity(e_ref, e->catching)) return true;
  if (truthy(e->catching) && ref_hp(e->catching) > 0) return false;

  const double en_x = ref_x(e_ref);
  const double player_l = stage_player_l();
  const double player_r = stage_player_r();
  if (en_x < player_l || en_x > player_r) return false;

  if (equals(holding_base_type_of_env(*e), Value(static_cast<double>(WeaponEnum::Drink)))) {
    return false;
  }
  if (entity::is_fighter(e_ref) && equals(Value(e->team), field_or(e_ref, u"team"))) {
    return false;
  }

  const Value e_state = state_of_ref(e_ref);
  const std::vector<double> b = get_bound();
  const double l = b.size() > 0 ? b[0] : 0.0;
  const double r = b.size() > 1 ? b[1] : 0.0;
  /* 对方的位置，我方无法抵达，故不追之 */
  if (!between(en_x, l, r)) return false;

  const double abs_dx = abs(e->px - en_x);
  if (entity::is_weapon(e_ref)) {
    const double diff = difficulty();
    if (diff == static_cast<double>(Difficulty::Easy)) return false;
    if (diff == static_cast<double>(Difficulty::Normal) &&
        strict_equals(base_type_of_ref(e_ref), Value(static_cast<double>(WeaponEnum::Drink)))) {
      return false;
    }
    if (truthy(e->holding)) return false;
    if (is_leave_goto_range(e_ref)) return false;
    do {
      // 队友Bot尽量不喝
      if (strict_equals(stage_value(u"id"), void_stage_id())) break;  // 非闯关
      if (!strict_equals(base_type_of_ref(e_ref),
                         Value(static_cast<double>(WeaponEnum::Drink)))) {
        break;  // 非饮料
      }
      if (equals(Value(e->team), stage_value(u"team"))) break;  // 敌人角色
      if (!truthy(field_or(field_or(field_or(field_or(e_ref, u"data"), u"base"), u"drink"),
                           u"hp_h_total"))) {
        return false;  // 不补血的不喝
      }
      if (e->hp >= round_float(2 * e->hp_max / 3)) return false;  // 血多的不喝
      if (!has_players_alive()) break;  // “大将”已死，挣扎之
      if (behavior != BotBehavior::Stay) return false;  // 仅在Stay喝
      if (abs_dx > 100) return false;  // 不喝太远的
    } while (0);

    if (loose_state_is(e_state, StateEnum::Weapon_OnGround)) return true;
    if (loose_state_is(e_state, StateEnum::HeavyWeapon_OnGround)) return true;
    return false;
  }
  if (loose_state_is(e_state, StateEnum::Lying)) return false;
  if (truthy(field_or(e_ref, u"invisible"))) return false;
  if (truthy(field_or(e_ref, u"invulnerable"))) return false;
  if (!e->is_on_ground) return true;

  if (is_leave_chase_range(e_ref)) {
    watching = e_ref;
    return false;
  }
  if (strict_equals(bot_state(), Value(std::u16string(bse::kAvoiding)))) {
    // 已拉开一定距离，攻击
    return w_atk_too_far(e_ref) || !can_back_off(e_ref);
  }
  return !w_atk_too_close(e_ref) || !can_back_off(e_ref);
}

bool BotController::should_avoid(const Value& av_ref) {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  if (!e->mounted) return false;
  if (!truthy(field_or(av_ref, u"mounted"))) return false;
  if (e->hp <= 0) return false;
  if (ref_hp(av_ref) <= 0) return false;
  if (truthy(e->holding) && same_entity(e->holding, av_ref)) return false;
  if (truthy(e->catching) && same_entity(e->catching, av_ref)) return false;
  const bool avoiding = strict_equals(bot_state(), Value(std::u16string(bse::kAvoiding)));
  const bool ret = avoiding ? !is_leave_avoid_zone(av_ref) : is_enter_avoid_zone(av_ref);

  const bool av_lying = strict_state_is(state_of_ref(av_ref), StateEnum::Lying);
  if (av_lying && truthy(field_or(av_ref, u"wakeup_invuln"))) return ret;
  if (truthy(field_or(av_ref, u"invulnerable"))) return ret;
  if (strict_equals(holding_base_type_of_env(*e),
                    Value(static_cast<double>(WeaponEnum::Drink)))) {
    return ret;
  }

  // 不再地上
  if (e->ground_y != e->py) return false;

  if (avoiding) {
    return w_atk_r_x() > 0 && !w_atk_too_far(av_ref) && can_back_off(av_ref);
  }
  return w_atk_too_close(av_ref) && can_back_off(av_ref);
}

bool BotController::is_leave_avoid_zone(const Value& target_ref) const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  const double avoid_out_x = dataset.num(u"avoid_out_x");
  const double avoid_out_z = dataset.num(u"avoid_out_z");
  const double abs_x = abs(ref_x(target_ref) - e->px);
  const double abs_z = abs(ref_z(target_ref) - e->pz);
  return abs_x > avoid_out_x || abs_z > avoid_out_z;
}

bool BotController::is_enter_avoid_zone(const Value& target_ref) const {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  const double avoid_in_x = dataset.num(u"avoid_in_x");
  const double avoid_in_z = dataset.num(u"avoid_in_z");
  const double abs_x = abs(ref_x(target_ref) - e->px);
  const double abs_z = abs(ref_z(target_ref) - e->pz);
  return abs_x < avoid_in_x && abs_z < avoid_in_z;
}

int BotController::should_defend(const Value& e_ref) {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return 0;
  if (!e->mounted) return 0;
  if (!truthy(field_or(e_ref, u"mounted"))) return 0;
  if (truthy(field_or(e_ref, u"invisible")) || e->toughness != 0 || e->invulnerable) return 0;

  const Value e_state = state_of_ref(e_ref);
  do {
    if (entity::is_ball(e_ref)) break;

    if (entity::is_weapon(e_ref)) {
      if (loose_state_is(e_state, StateEnum::HeavyWeapon_InTheSky)) break;
      if (loose_state_is(e_state, StateEnum::Weapon_Throwing)) break;
      if (loose_state_is(e_state, StateEnum::Weapon_OnHand) &&
          truthy(field_or(field_or(field_or(field_or(e_ref, u"bearer"), u"frame"), u"wpoint"),
                          u"attacking"))) {
        break;
      }
      return 0;
    }

    if (entity::is_fighter(e_ref)) {
      bool attacking = false;
      for (const double s : attcking_states()) {
        if (strict_equals(e_state, Value(s))) {
          attacking = true;
          break;
        }
      }
      if (attacking) break;
      return 0;
    }
    return 0;
  } while (0);

  const Value ray = [&]() {
    const double vx = ref_vel(e_ref, u"x");
    const double vz = ref_vel(e_ref, u"z");
    const double q = defines::num(u"Defines.DAFUALT_QUBE_LENGTH");
    Object o;
    o.set(u"x", Value(max(abs(vx), 1.0)));
    o.set(u"z", Value(vz));
    o.set(u"min_x", Value(-20.0));
    o.set(u"max_x", Value(max(abs(10 * vx), 60.0)));
    o.set(u"min_z", Value(-2 * q));
    o.set(u"max_z", Value(max(abs(10 * vz), 2 * q)));
    return Value(std::make_shared<Object>(o));
  }();
  Entity* const target = env() != nullptr && env()->resolve ? env()->resolve(e_ref) : nullptr;
  Entity* const self = self_entity();
  if (target == nullptr || self == nullptr) return 0;
  const Value hit = is_ray_hit(*target, *self, ray);
  if (!truthy(hit)) return 0;

  const Value itrs = field_or(field_or(e_ref, u"frame"), u"itr");
  if (has_length(itrs)) {
    bool has_atk_itr_kind = false;
    bool just_a_rest = true;
    for (const Value& itr : as_array(itrs)->items()) {
      const Value kind = field_or(itr, u"kind");
      bool is_atk = false;
      for (const double v : attcking_itr_kinds()) {
        if (strict_equals(kind, Value(v))) {
          is_atk = true;
          break;
        }
      }
      if (!is_atk) continue;
      has_atk_itr_kind = true;
      if (strict_equals(field_or(itr, u"bdefend"),
                        Value(defines::num(u"Defines.DEFAULT_FORCE_BREAK_DEFEND_VALUE")))) {
        return 2;
      }
      if (truthy(field_or(itr, u"vrest"))) just_a_rest = false;
    }
    if (!has_atk_itr_kind) return 0;
    if (just_a_rest && truthy(field_or(e_ref, u"arest"))) return 0;
  }
  return 1;
}

void BotController::lookup(const Value& other_ref) {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return;
  if (!e->mounted || !truthy(field_or(other_ref, u"mounted"))) {
    avoidings.clear();
    chasings.clear();
    defends.clear();
    if (same_entity(other_ref, watching)) watching = Value(NullTag{});
    return;
  }
  if (entity::is_fighter(other_ref)) {
    if (equals(Value(e->team), field_or(other_ref, u"team"))) return;
    if (should_avoid(other_ref)) {
      look_target(avoidings, other_ref);
      return;
    }
    const int dd = should_defend(other_ref);
    if (dd != 0) {
      look_target(defends, other_ref, Value(static_cast<double>(dd)));
      return;
    }
    if (should_chase(other_ref)) {
      look_target(chasings, other_ref);
      return;
    }
  } else if (entity::is_weapon(other_ref)) {
    if (should_chase(other_ref)) {
      look_target(chasings, other_ref);
      return;
    }
    if (equals(Value(e->team), field_or(other_ref, u"team"))) return;
    const int dd = should_defend(other_ref);
    if (dd != 0) {
      look_target(defends, other_ref, Value(static_cast<double>(dd)));
      return;
    }
  } else if (entity::is_ball(other_ref)) {
    if (equals(Value(e->team), field_or(other_ref, u"team"))) return;
    const int dd = should_defend(other_ref);
    if (dd != 0) {
      look_target(defends, other_ref, Value(static_cast<double>(dd)));
      return;
    }
  } else if (strict_equals(field_or(field_or(other_ref, u"data"), u"id"),
                           Value(std::u16string(oid::kCriminal))) &&
             !equals(Value(e->team), stage_value(u"team")) && !has_players_alive()) {
    look_target(chasings, other_ref);
  } else {
    avoidings.del([&](const BotTarget& t) { return same_entity(t.entity, other_ref); });
    chasings.del([&](const BotTarget& t) { return same_entity(t.entity, other_ref); });
    defends.del([&](const BotTarget& t) { return same_entity(t.entity, other_ref); });
  }
}

Value BotController::guess_entity_pos(const Value& entity_ref) const {
  const double px = ref_x(entity_ref);
  const double pz = ref_z(entity_ref);
  const double py = ref_y(entity_ref);
  const double vx = ref_vel(entity_ref, u"x");
  const double vz = ref_vel(entity_ref, u"z");
  const double vy = ref_vel(entity_ref, u"y");
  const Value state = state_of_ref(entity_ref);
  double x = 0;
  double z = 0;
  double y = 0;
  if (strict_state_is(state, StateEnum::Jump) || strict_state_is(state, StateEnum::Running)) {
    x = round_float(px + 2 * vx);
    z = round_float(pz + 1 * vz);
    y = round_float(py + 2 * vy);
  } else if (strict_state_is(state, StateEnum::Dash)) {
    x = round_float(px + 3 * vx);
    z = round_float(pz + 1 * vz);
    y = round_float(py + 1 * vy);
  } else {
    x = round_float(px + vx);
    z = round_float(pz + vz);
    y = round_float(py + vy);
  }
  Object o;
  o.set(u"x", Value(px));
  o.set(u"z", Value(pz));
  o.set(u"next_x", Value(x));
  o.set(u"next_z", Value(z));
  o.set(u"next_y", Value(y));
  return Value(std::make_shared<Object>(o));
}

double BotController::desire(const std::u16string& mark) const {
  MersenneTwister* m = mt();
  if (m == nullptr) return 0;
  m->mark = mark;
  return m->range(0, defines::num(u"Defines.MAX_AI_DESIRE"));
}

double BotController::action_desire(const std::u16string& mark) {
  double ret = desire(mark);  // 默认action设置的desire是crazy的好了。
  for (int i = static_cast<int>(Difficulty::MAX) - static_cast<int>(difficulty()); i > 0; --i) {
    MersenneTwister* m = mt();
    if (m == nullptr) break;
    m->mark = mark;
    ret += m->range(0, ret);
  }
  return ret;
}

void BotController::check_bot() {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return;
  const Value base = field_or(e->data, u"base");
  const Value bot_v = field_or(base, u"bot");
  const Value oid = field_or(e->data, u"id");
  const Value raw_bot_id = field_or(base, u"bot_id");
  const Value bot_id_v = std::holds_alternative<std::monostate>(raw_bot_id) ? oid : raw_bot_id;

  if (truthy(bot_v) && same_ref(bot_v, bot)) return;
  if (truthy(bot_v) && !same_ref(bot_v, bot)) {
    dataset.reset();
    dataset.assign(field_or(bot_v, u"dataset"));
    bot = bot_v;
    bot_id = Value();
    return;
  }
  if (strict_equals(bot_id, bot_id_v)) return;
  bot_id = bot_id_v;
  dataset.reset();
  if (!truthy(bot_id_v)) {
    bot = Value();
    return;
  }
  bot = e->find_bot ? e->find_bot(to_string(bot_id_v)) : Value();
  dataset.assign(field_or(bot, u"dataset"));
}

bool BotController::lock_when_stand_and_rest() {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return false;
  if (frame_state_is(*e, StateEnum::Standing) && e->resting <= 0) {
    if (e->set_position) {
      // `(this.world.bg.near + this.world.far) / 2` —— 前半是 **bg** 的 near，
      // 后半是 **stage** 的 far（`World.get far() { return this.stage.far }`）。
      e->set_position(Value(e->bg_width / 2), Value(NullTag{}),
                      Value((e->bg_near + stage_far()) / 2));
    }
    return true;
  }
  return false;
}

Value BotController::handle_action(const std::u16string& where, const Value& action) {
  if (!truthy(action)) return Value(false);
  const Value keys_v = field_or(action, u"keys");
  const Value frame = field_or(action, u"frame");
  if (!has_length(keys_v) && !truthy(frame)) return Value(false);

  // `keys?.join() ?? frame`（`??` 只吃 nullish：空数组的 `""` 会留下）。
  const bool keys_is_array = as_array(keys_v) != nullptr;
  const Value mark_part = keys_is_array ? Value(join_commas(keys_v)) : frame;
  const std::u16string action_mark = u"act#" + where + u"#" + to_string(mark_part);
  const double action_desire_v = action_desire(action_mark);

  const Value raw_desire = field_or(action, u"desire");
  const double desire_v =
      !nullish(raw_desire)
          ? to_number(raw_desire)
          : to_number(or_nullish(field_or(action, u"desire_base"), Value(0.0))) +
                to_number(or_nullish(field_or(action, u"desire_step"), Value(0.0))) *
                    (difficulty() - 1);
  if (!truthy(Value(desire_v)) || action_desire_v > desire_v) return Value(false);

  const Value status = field_or(action, u"status");
  if (const Array* st = as_array(status)) {
    bool has_state = false;
    const Value cur = bot_state();
    for (const Value& v : st->items()) {
      if (strict_equals(v, cur)) {
        has_state = true;
        break;
      }
    }
    if (!has_state) return Value(false);
  }

  const Value e_ray = field_or(action, u"e_ray");
  if (truthy(e_ray)) {
    const Value en_ref = en();
    if (!truthy(en_ref) || !entity::is_fighter(en_ref)) return Value(false);
    Entity* const self_e = self_entity();
    Entity* const en_e = env() != nullptr && env()->resolve ? env()->resolve(en_ref) : nullptr;
    if (self_e == nullptr || en_e == nullptr) return Value(false);
    bool ray_hit = false;
    if (const Array* rays = as_array(e_ray)) {
      for (const Value& r : rays->items()) {
        ray_hit = truthy(is_ray_hit(*self_e, *en_e, r));
        if (ray_hit) break;
      }
    }
    if (!ray_hit) return Value(false);
  }

  const Value judge = field_or(action, u"expression");
  if (truthy(judge)) {
    Expression<BotController> ex(to_string(judge), loader::get_val_from_bot_ctrl);
    if (!ex.run(*this)) return Value(false);
  }

  if (truthy(frame)) return frame;

  if (const Array* ks = as_array(keys_v)) {
    std::vector<Value> out;
    for (const Value& v : ks->items()) {
      const std::u16string s = to_string(v);
      if (s == u"F" || s == u"B") {
        out.push_back(Value(std::u16string(facing() > 0 ? u"R" : u"L")));
      } else {
        out.push_back(v);
      }
    }
    return Value(std::make_shared<Array>(out));
  }
  return Value(false);
}

void BotController::follow(const Value& e_ref) {
  following = e_ref;
  goingto = Value(NullTag{});
  behavior = BotBehavior::Move;
}

void BotController::move() {
  behavior = BotBehavior::Move;
  goingto = Value(NullTag{});
  following = Value(NullTag{});
}

void BotController::stay() {
  behavior = BotBehavior::Stay;
  if (nullish(goingto)) {
    const controller::CtrlEnv* e = env();
    Object o;
    o.set(u"x", Value(e != nullptr ? e->px : 0.0));
    o.set(u"y", Value(e != nullptr ? e->py : 0.0));
    o.set(u"z", Value(e != nullptr ? e->pz : 0.0));
    goingto = Value(std::make_shared<Object>(o));
  }
  following = Value(NullTag{});
}

void BotController::come(double x, double y, double z) {
  Object o;
  o.set(u"x", Value(x));
  o.set(u"y", Value(y));
  o.set(u"z", Value(z));
  goingto = Value(std::make_shared<Object>(o));
  following = Value(NullTag{});
}

void BotController::_case(const std::u16string& mark, const std::vector<Value>& args) {
  MersenneTwister* m = mt();
  if (m == nullptr) return;
  m->mark = mark;
  m->log_case(args);
}

bool BotController::_false(const std::u16string& mark, const std::vector<Value>& args) {
  MersenneTwister* m = mt();
  if (m != nullptr) {
    m->mark = mark;
    std::vector<Value> all;
    all.push_back(Value(u"ret=false"));
    for (const Value& v : args) all.push_back(v);
    m->log_case(all);
  }
  return false;
}

bool BotController::_true(const std::u16string& mark, const std::vector<Value>& args) {
  MersenneTwister* m = mt();
  if (m != nullptr) {
    m->mark = mark;
    std::vector<Value> all;
    all.push_back(Value(u"ret=true"));
    for (const Value& v : args) all.push_back(v);
    m->log_case(all);
  }
  return true;
}

const controller::ControllerResult& BotController::update() {
  const controller::CtrlEnv* e = env();
  MersenneTwister* m = mt();
  if (m != nullptr && m->debugging && e != nullptr) {
    _case(u"bot_update_" + e->id + u"_" + to_string(e->name));
  }
  check_bot();
  if (truthy(watching) && to_number(field_or(watching, u"mounted")) == 0) {
    watching = Value(NullTag{});
  }
  if (truthy(dummy)) {
    dummy_update(dummy, *this);
  } else {
    if (e != nullptr && e->hp > 0) {
      const bool fol_mounted = truthy(following) && truthy(field_or(following, u"mounted"));
      const double fol_hp = to_number(field_or(following, u"hp"));
      if (!fol_mounted || fol_hp <= 0) following = Value(NullTag{});
      chasings.del([this](const BotTarget& t) { return !should_chase(t.entity); });
      sort_targets(chasings);
      avoidings.del([this](const BotTarget& t) { return !should_avoid(t.entity); });
      sort_targets(avoidings);
      defends.del([this](const BotTarget& t) { return 1 != should_defend(t.entity); });
      sort_targets(defends);
    } else {
      following = Value(NullTag{});
      chasings.clear();
      avoidings.clear();
      defends.clear();
    }
    bot_frame = Value();
    fsm.update(1);
  }
  if (m != nullptr && m->debugging && !queue.empty()) {
    _case(u"bot_keys", {Value(join_queue(queue))});
  }
  const controller::ControllerResult& ret = BaseController::update();
  if (m != nullptr && m->debugging) {
    const std::vector<BotTarget>& a = avoidings.targets();
    const std::vector<BotTarget>& c = chasings.targets();
    const std::vector<BotTarget>& d = defends.targets();
    // TS 的 `'' + + `${a…}` + `${c…}` + `${d…}``：一元的 `+` 把**第一段**化了数
    // （空串 → `0`、否则 `NaN`）⇒ 前缀是 `"0"` / `"NaN"`，这里照抄。
    const std::u16string a_str = !a.empty() ? u"a=[" + join_ids(a) + u"] " : std::u16string();
    std::u16string msg = to_string(Value(to_number(Value(a_str))));
    if (!c.empty()) msg += u"c=[" + join_ids(c) + u"] ";
    if (!d.empty()) msg += u"d=[" + join_ids(d) + u"] ";
    if (!msg.empty()) {
      _case(u"bot_target", {Value(trim_js(msg))});
    }
    const Value res_frame = field_or(ret.result(), u"frame");
    if (truthy(res_frame)) _case(u"bot_nf", {field_or(res_frame, u"id")});
    if (e != nullptr) _case(u"bot_update_end_" + e->id + u"_" + to_string(e->name));
  }
  if (truthy(bot_frame)) {
    Object o;
    o.set(u"id", bot_frame);
    const Value nf = (e != nullptr && e->get_next_frame)
                         ? e->get_next_frame(Value(std::make_shared<Object>(o)))
                         : Value();
    if (truthy(nf)) result.fire2(nf, time(), u"", u"bot");
  }
  return ret;
}

double BotController::target_dist_bound() const {
  if (chasings.targets().size() < static_cast<size_t>(chasings.max()) ||
      avoidings.targets().size() < static_cast<size_t>(avoidings.max()) ||
      defends.targets().size() < static_cast<size_t>(defends.max())) {
    return std::numeric_limits<double>::infinity();
  }
  double m = -1;
  for (const BotTarget& t : chasings.targets()) {
    if (t.distance > m) m = t.distance;
  }
  for (const BotTarget& t : avoidings.targets()) {
    if (t.distance > m) m = t.distance;
  }
  for (const BotTarget& t : defends.targets()) {
    if (t.distance > m) m = t.distance;
  }
  return m;
}

void BotController::update_lookup(int me, const std::vector<Value>& entities) {
  const controller::CtrlEnv* e = env();
  if (e == nullptr) return;
  const double x0 = e->px;
  int i1 = me - 1;
  int i2 = me + 1;
  const int len = static_cast<int>(entities.size());
  const double bound = target_dist_bound();
  const bool prune = bound != std::numeric_limits<double>::infinity();

  // TS 的 targets 是活实体；端口的引用是快照 ⇒ 先按名单刷新一遍（见 `reidentify`）。
  chasings.reidentify(entities);
  avoidings.reidentify(entities);
  defends.reidentify(entities);

  const Entity* const self_e = self_entity();
  const Value self = self_e != nullptr ? Value() : self_ref();
  while (i1 >= 0 || i2 < len) {
    Value l = (i1 >= 0 && i1 < len) ? entities[static_cast<size_t>(i1)] : Value();
    Value r = (i2 >= 0 && i2 < len) ? entities[static_cast<size_t>(i2)] : Value();
    if (prune) {
      if (truthy(l) && x0 - ref_x(l) > bound) l = Value();
      if (truthy(r) && ref_x(r) - x0 > bound) r = Value();
    }
    const Value picked = self_e != nullptr ? helper::closer_one(*self_e, l, r)
                                           : helper::closer_one(self, l, r);
    if (!truthy(picked)) break;
    if (!truthy(field_or(picked, u"ghosted"))) lookup(picked);
    if (same_ref(l, picked)) --i1;
    if (same_ref(r, picked)) ++i2;
  }
}

// `dummy_updaters[this.dummy]?.update(this)`（`bot/DummyEnum.ts` 表；`_auto` 系列是
// `undefined` ⇒ 什么都不做；“5” 的闭包体在原 TS 里也被注释掉了）。
void dummy_update(const Value& dummy, BotController& self) {
  const std::u16string d = to_string(dummy);
  if (d.empty() || d == u"5") return;  // None / AvoidEnemyAllTheTime：空实现
  const bool is_lock_mid = d == u"1" || d == u"2" || d == u"3" || d == u"4" || d == u"6" ||
                           d == u"7" || d == u"8" || d == u"9" || d == u"10" || d == u"11" ||
                           d == u"12" || d == u"13" || d == u"14";
  if (!is_lock_mid) return;  // "15".."22"：`undefined`

  const controller::CtrlEnv* e = self.env();
  const bool h = self.lock_when_stand_and_rest();
  const bool falling = e != nullptr && frame_state_is(*e, StateEnum::Falling);
  if (d == u"1") return;
  if (d == u"2") {
    const std::vector<std::u16string> keys = {u"d"};
    if (h) {
      self.key_down(keys);
      self.key_up(keys);
    }
    return;
  }
  if (d == u"3") {
    if (falling) {
      self.key_down({u"j"});
      self.key_up({u"j"});
    }
    return;
  }
  if (d == u"4") {
    if (h || falling) {
      self.key_down({u"j"});
      self.key_up({u"j"});
    } else {
      self.end({u"j"});
    }
    return;
  }
  if (!h) return;
  std::vector<std::u16string> keys;
  if (d == u"6") keys = {u"d", u"U", u"a"};
  else if (d == u"7") keys = {u"d", u"U", u"j"};
  else if (d == u"8") keys = {u"d", u"D", u"a"};
  else if (d == u"9") keys = {u"d", u"D", u"j"};
  else if (d == u"10") keys = {u"d", u"L", u"a"};
  else if (d == u"11") keys = {u"d", u"L", u"j"};
  else if (d == u"12") keys = {u"d", u"R", u"a"};
  else if (d == u"13") keys = {u"d", u"L", u"j"};  // TS 原文：dRj 用的是 L
  else if (d == u"14") keys = {u"d", u"j", u"a"};
  else return;
  self.key_down(keys);
  self.key_up(keys);
}

}  // namespace bot
}  // namespace lfw
