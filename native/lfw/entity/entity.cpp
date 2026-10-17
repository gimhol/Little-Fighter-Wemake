#include "lfw/entity/entity.h"
#include "lfw/lfw.h"

#include <memory>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "lfw/core/json.h"
#include "lfw/core/js_num.h"
#include "lfw/core/same_ref.h"
#include "lfw/core/value.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/difficulty.h"
#include "lfw/defines/entity_enum.h"
#include "lfw/defines/entity_group.h"
#include "lfw/defines/facing_flag.h"
#include "lfw/defines/frame_id.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/hit_flag.h"
#include "lfw/entity/entity_flag.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/defines/itr_kind.h"
#include "lfw/defines/opoint_kind.h"
#include "lfw/defines/opoint_multi_enum.h"
#include "lfw/defines/opoint_spreading.h"
#include "lfw/defines/speed_ctrl.h"
#include "lfw/defines/speed_mode.h"
#include "lfw/defines/state_enum.h"
#include "lfw/defines/wpoint_kind.h"
#include "lfw/entity/calc_v.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/entity/entity_snapshot.h"
#include "lfw/entity/face_helper.h"
#include "lfw/entity/summary_mgr.h"
#include "lfw/factory.h"
#include "lfw/ground.h"
#include "lfw/loader/get_val_from_entity.h"
#include "lfw/loader/preprocess_next_frame.h"
#include "lfw/state/entity_states.h"
#include "lfw/state/state_base.h"
#include "lfw/world.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/container_help/find.h"
#include "lfw/utils/cross_bounding.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/clamp.h"
#include "lfw/utils/math/clamp_add.h"
#include "lfw/utils/math/float_equal.h"
#include "lfw/utils/math/round_float.h"
#include "lfw/utils/type_check.h"

#include <cmath>
#include <limits>

namespace lfw {
namespace {

// `Number.MIN_SAFE_INTEGER`, written out because the port has no such constant yet.
constexpr double kMinSafeInteger = -9007199254740991.0;
// `Number.MAX_SAFE_INTEGER` — `update`'s respawn branch seeds its "nearest friend" scan.
constexpr double kMaxSafeInteger = 9007199254740991.0;

// `Number.isInteger`
bool is_integer(double x) { return std::isfinite(x) && std::floor(x) == x; }

// `const { a = 0 } = o` —— 解构默认值只对 `undefined`（缺字段）生效，`null` 不算。
double num_destructured(const Value& v, double fallback) {
  return std::holds_alternative<std::monostate>(v) ? fallback : to_number(v);
}

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// JS `a ?? b`.
Value or_nullish(const Value& v, const Value& fallback) {
  return nullish(v) ? fallback : v;
}

// A stat slot reads as a number; the TS side would hold whatever the dataset holds,
// and the dataset only ever holds numbers.
double num_of(const Value& v) { return nullish(v) ? 0.0 : to_number(v); }

std::optional<double> opt_num(const Value& v) {
  return nullish(v) ? std::nullopt : std::optional<double>(to_number(v));
}

Value base_of(const Value& data) { return field_or(data, u"base"); }

// `obj[key]` with a dynamic key (the `field_or` overloads only take literals).
Value field_kv(const Value& v, const std::u16string& key) {
  const Object* o = as_object(v);
  if (o == nullptr) return Value();
  const Value* p = o->get(key);
  return p != nullptr ? *p : Value();
}

std::u16string frame_id_of(const Entity& e) { return to_string(field_or(e.frame, u"id")); }

// `this.frame.id` / `this._prev_frame.id` for a frame held as a `Value`.
std::u16string frame_id_value(const Value& f) { return to_string(field_or(f, u"id")); }

// `optional ?? NaN`, the spelling `to_snapshot` uses for its nullable stat slots.
Value or_nan(const std::optional<double>& v) {
  return v.has_value() ? Value(*v) : Value(std::numeric_limits<double>::quiet_NaN());
}

// `Times` writes plain numbers, so its five-slot block goes through a scratch buffer.
Value& tick_slot(std::vector<Value>& nums, entity::NSlot slot, std::size_t k) {
  return nums[static_cast<std::size_t>(slot) + k];
}

void write_tick(const Times& t, std::vector<Value>& nums, entity::NSlot slot) {
  std::vector<double> buf(5, 0.0);
  t.write_nums(buf, 0);
  for (std::size_t k = 0; k < 5; ++k) tick_slot(nums, slot, k) = Value(buf[k]);
}

void read_tick(Times& t, const std::vector<Value>& nums, entity::NSlot slot) {
  std::vector<double> buf(5, 0.0);
  for (std::size_t k = 0; k < 5; ++k) {
    buf[k] = to_number(nums[static_cast<std::size_t>(slot) + k]);
  }
  t.read_nums(buf, 0);
}

// `a !== b` for the `bounced` / `dropping` family: a `null` / `undefined` / string
// entry in the array is not `0`, so the boolean becomes true.
bool not_zero(const Value& v) { return !strict_equals(v, Value(0.0)); }

Value next_frame_of(const Value& a, const Value& b) { return or_nullish(a, b); }

std::size_t array_length(const Value& v) {
  const Array* a = as_array(v);
  return a != nullptr ? a->size() : 0;
}

// `this.position` as a `Value` (defined next to the enter-frame chain; declared here
// because `reset` already hands a position to `play_sound`).
Value position_value(const Vector3& p);

}

Entity::Entity(World& world, Value data)
    : Entity(world, std::move(data), &state::entity_states()) {}

Entity::Entity(World& world, Value data, state::States* states) {
  world_ = &world;
  _data = std::move(data);
  states_ = states;
  _atom_time = num_of(world.dataset.get(u"atom_time"));
  terrain = Ground::horizon();
  {
    Object nf;
    nf.set(u"id", Value(std::u16string()));
    _next_frame_by_id = Value(std::make_shared<Object>(nf));
  }
  reset(_data, states);
}

// `this.lfw`（TS 的字段读；`World` 的完整定义在 world.h，这里才 include 得进来）。
LFW& Entity::lfw() const { return world_->lfw(); }

Value Entity::ctrl_view() const { return entity::ctrl_view_of(ctrl()); }

Entity::~Entity() = default;

void Entity::reset(Value data) { reset(std::move(data), &state::entity_states()); }

void Entity::reset(Value data, state::States* states) {
  marks.clear();
  // `for (const buf of this.buffs.values()) buf.del_victim(this)` needs the entity to
  // be a `Entity`, which lands with the buff wiring slice; the map is still
  // cleared here so a reset never keeps stale entries.
  buffs.clear();
  is_on_ground = false;
  terrain = Ground::horizon();
  _data = std::move(data);
  const Value data_now = _data;
  _origin_data_id = to_string(field_or(data_now, u"id"));
  id = world().lfw().new_id();
  wait = 0;
  _motionless_ticks = 0;
  _lifetime = 0;
  fallinjury = 0;
  _ground_y = 0;
  variant = 0;
  transforms = Value(NullTag{});
  transform_index = 0;
  _reserve = 0;
  _mounted = 0;
  _ghosted = 0;
  prev_position.set(kMinSafeInteger, kMinSafeInteger, kMinSafeInteger);
  position.set(0, 0, 0);
  fuse_bys.clear();
  has_fuse_bys = false;
  dismiss_time = std::nullopt;
  dismiss_data = Value(NullTag{});
  copies.clear();
  stat_bar = 0;
  _toughness_resting_max = defines::num(u"Defines.DEFAULT_TOUGHNESS_RESTING_MAX");
  _resting_max = opt_num(field_or(base_of(data_now), u"resting_max"));
  _resting = 0;
  _toughness = 0;
  _toughness_max = 0;
  _toughness_resting = 0;
  _fall_value_max = opt_num(field_or(base_of(data_now), u"fall_value_max"));
  _defend_value_max = opt_num(field_or(base_of(data_now), u"defend_value_max"));
  _defend_ratio = opt_num(field_or(base_of(data_now), u"defend_ratio"));
  _catch_time_max = opt_num(field_or(base_of(data_now), u"catch_time_max"));
  throwinjury = 0;
  facing = 1;
  {
    const Value* empty_frame = defines::find(u"EMPTY_FRAME_INFO");
    frame = empty_frame != nullptr ? *empty_frame : Value();
  }
  _prev_frame = frame;
  set_catching(nullptr);
  catcher = nullptr;
  wakeup_invuln = 0;
  name_visible = 0;
  _outline_alpha = 0.8;
  velocity.set(0, 0, 0);
  prev_velocity.set(0, 0, 0);
  callbacks.clear();
  _name = Value(NullTag{});
  _team = world().lfw().new_team();
  _landing_frame = Value(NullTag{});
  bearer = nullptr;
  holding = nullptr;
  emitters.clear();
  _arest = 0;
  vrests.clear();
  blockers.clear();
  superpunchs.clear();
  motionless = 0;
  shaking = 0;
  bounced = false;
  lying_a_count = Value(0.0);
  lying_d_count = Value(0.0);
  lying_c_count = Value(0.0);
  drop_hurted = false;
  dropping = false;
  // `this._states = states` — mirror TS's position (right after `dropping`).
  states_ = states;
  _hp_r_tick.set_max(num_of(dataset(u"hp_r_ticks")));
  _hp_r_tick.set_value(0);
  _mp_r_tick.set_max(num_of(dataset(u"mp_r_ticks")));
  _mp_r_tick.set_value(0);
  _fall_r_tick.set_max(num_of(dataset(u"fall_r_ticks")));
  _fall_r_tick.set_value(0);
  _defend_r_tick.set_max(num_of(dataset(u"defend_r_ticks")));
  _defend_r_tick.set_value(0);
  _toughness_r_value = num_of(dataset(u"toughness_r_value"));
  _defend_r_value = num_of(dataset(u"defend_r_value"));
  _fall_r_value = num_of(dataset(u"fall_r_value"));
  _hp_max = opt_num(dataset(u"hp_max"));
  _mp_max = opt_num(dataset(u"mp_max"));
  _defend_ratio = opt_num(field_or(base_of(data_now), u"defend_ratio"));
  jumping.x = 0;
  jumping.y = 0;
  jumping.z = 0;
  jumping.t = 0;
  if (ctrl_ != nullptr) world().lfw().release_ctrl(ctrl_);
  ctrl_ = world().lfw().acquire_invalid_ctrl(world());
  reset_armor();
  set_fall_value(fall_value_max());
  set_defend_value(defend_value_max());
  _hp_r = hp_max();
  _hp = _hp_r;
  _mp = mp_max();
  set_catch_time(catch_time_max());
  _invisible = 0;
  _invulnerable = 0;
  _blinking = 0;
  _after_blink = std::nullopt;
  _state = nullptr;
  dead_gone = 0;
  dead_join = Value(NullTag{});
  ctrl_visible = 0;
  const Value drink_info = field_or(base_of(data_now), u"drink");
  drink = truthy(drink_info) ? std::make_unique<DrinkInfo>(drink_info) : nullptr;
  opoints.clear();
  _prev_cpoint_a = Value(NullTag{});
  collision_list.clear();
  collided_list.clear();
  lastest_collided = std::nullopt;
  _outline_color.clear();
  _outline_alpha = 0.8;
  _outline_width = 1;
  _outline_enabled = std::nullopt;
  _mix_color.clear();
  _mix_strength = 0;
  _greyscale = 0;
  _render_effect_time = 0;
  auto_key_role();
}

// `set_state(state_code)`:
//   const v = this._states.get(state_code) || this._states.fallback(this._data.type, state_code);
//   if (this._state === v) return;
//   this._state?.leave?.(this, this.frame);
//   this._state = v || null;
//   this._state?.enter?.(this, this.get_prev_frame());
// The fallback key is built from `_data.type` verbatim (a string `"8"` does not match
// `EntityEnum.Fighter`), and `leave` sees the *current* frame while `enter` sees the
// previous one.
void Entity::set_state(const Value& state_code) {
  state::State_Base* v = states_->get(state_code);
  if (v == nullptr) v = &states_->fallback(field_or(_data, u"type"), state_code);
  if (_state == v) return;
  if (_state != nullptr) _state->leave(*this, frame);
  _state = v;
  if (_state != nullptr && _state->enter) _state->enter(*this, get_prev_frame());
}

std::u16string Entity::outline_color() const {
  if (!_outline_color.empty()) return _outline_color;
  const Value* map = defines::find(u"Defines.TeamInfoMap");
  const Value info = map != nullptr ? field_or(*map, _team.c_str()) : Value();
  const Value c = field_or(info, u"outline_color");
  return truthy(c) ? to_string(c) : std::u16string();
}

void Entity::set_outline_color(std::u16string v) {
  _outline_color = std::move(v);
  ++_render_effect_time;
}

void Entity::set_outline_alpha(double v) {
  _outline_alpha = v;
  ++_render_effect_time;
}

void Entity::set_outline_width(double v) {
  _outline_width = v;
  ++_render_effect_time;
}

Value Entity::outline_enabled() const {
  return _outline_enabled.has_value() ? Value(*_outline_enabled) : dataset(u"outline_enabled");
}

void Entity::set_outline_enabled(const Value& v) {
  _outline_enabled = opt_num(v);
  ++_render_effect_time;
}

void Entity::set_mix_color(std::u16string v) {
  _mix_color = std::move(v);
  ++_render_effect_time;
}

void Entity::set_mix_strength(double v) {
  _mix_strength = v;
  ++_render_effect_time;
}

void Entity::set_greyscale(double v) {
  _greyscale = v;
  ++_render_effect_time;
}

std::u16string Entity::origin_data_id() const {
  if (!_origin_data_id.empty()) return _origin_data_id;
  return to_string(field_or(_data, u"id"));
}

Value Entity::group() const { return field_or(base_of(_data), u"group"); }

void Entity::set_reserve(double v) {
  v = round_float(v);
  const double o = _reserve;
  if (o == v) return;
  _reserve = v;
  callbacks.call(u"on_reserve_changed", {ref(), Value(v), Value(o)});
}

double Entity::type() const { return num_of(field_or(_data, u"type")); }

Value Entity::itr() const { return field_or(frame, u"itr"); }

Value Entity::bdy() const { return field_or(frame, u"bdy"); }

void Entity::set_toughness_resting_max(double v) { _toughness_resting_max = round_float(v); }

double Entity::resting_max() const {
  return _resting_max.has_value() ? *_resting_max : num_of(world().dataset.get(u"resting_max"));
}

void Entity::set_resting_max(double v) { _resting_max = round_float(v); }

void Entity::set_resting(double v) { _resting = round_float(v); }

void Entity::set_fall_value(double v) {
  const double o = _fall_value;
  if (o == v) return;
  _fall_value = round_float(v);
  if (v < o) {
    set_resting(resting_max());
    set_toughness_resting(toughness_resting_max());
  }
}

void Entity::set_toughness(double v) {
  v = round_float(v);
  if (v < 0) v = 0;
  const double o = _toughness;
  if (o == v) return;
  _toughness = v;
  if (v < o) set_toughness_resting(toughness_resting_max());
}

void Entity::set_toughness_max(double v) { _toughness_max = round_float(v); }

void Entity::set_toughness_resting(double v) {
  v = round_float(v);
  const double o = _toughness_resting;
  if (o == v) return;
  _toughness_resting = v;
}

double Entity::catch_time_max() const {
  return _catch_time_max.has_value() ? *_catch_time_max
                                     : num_of(world().dataset.get(u"catch_time_max"));
}

void Entity::set_catch_time_max(double v) { _catch_time_max = round_float(v); }

double Entity::fall_value_max() const {
  return _fall_value_max.has_value() ? *_fall_value_max
                                     : num_of(world().dataset.get(u"fall_value_max"));
}

void Entity::set_fall_value_max(double v) { _fall_value_max = round_float(v); }

void Entity::set_defend_value(double v) {
  const double o = _defend_value;
  if (o == v) return;
  _defend_value = round_float(v);
  if (v < o) {
    set_resting(resting_max());
    set_toughness_resting(toughness_resting_max());
  }
}

double Entity::defend_value_max() const {
  return _defend_value_max.has_value() ? *_defend_value_max
                                       : num_of(world().dataset.get(u"defend_value_max"));
}

void Entity::set_defend_value_max(double v) { _defend_value_max = round_float(v); }

double Entity::defend_ratio() const {
  return _defend_ratio.has_value() ? *_defend_ratio
                                   : num_of(world().dataset.get(u"defend_ratio"));
}

void Entity::set_defend_ratio(double v) { _defend_ratio = round_float(v); }

Value Entity::name() const {
  if (!std::holds_alternative<NullTag>(_name)) return _name;
  if (ctrl_ != nullptr && ctrl_->is_human()) {
    const Value pname = field_or(ctrl_->player, u"name");
    if (truthy(pname)) return pname;
    return Value(u"Player " + to_string(field_or(ctrl_->player, u"id")));
  }
  const Value base_name = field_or(base_of(_data), u"name");
  return nullish(base_name) ? Value(std::u16string()) : base_name;
}

void Entity::set_name(const Value& v) {
  if (strict_equals(v, name())) return;
  const Value o = _name;
  _name = v;
  callbacks.call(u"on_name_changed",
                 {ref(), truthy(v) ? v : Value(std::u16string()), o});
}

void Entity::set_mp(double v) {
  const double o = _mp;
  v = max(0.0, v);
  v = round_float(v);
  if (o == v) return;
  _mp = v;
  if (v < o) {
    const std::shared_ptr<Summary> s = summary_mgr().get(id);
    s->set_mp_usage(Value(to_number(s->mp_usage()) + (o - v)));
  }
  if (v < o && !defines::is_independent(_team)) {
    const std::shared_ptr<Summary> s = summary_mgr().get(_team);
    s->set_mp_usage(Value(to_number(s->mp_usage()) + (o - v)));
  }
  callbacks.call(u"on_mp_changed", {ref(), Value(v), Value(o)});
  if (o > 0 && v <= 0) {
    const Value nf = next_frame_of(field_or(frame, u"on_exhaustion"),
                                   field_or(_data, u"on_exhaustion"));
    if (truthy(nf)) enter_frame(nf);
  }
}

void Entity::set_hp_r(double v) { _hp_r = round_float(max(0.0, v)); }

void Entity::set_hp(double v) {
  const double o = _hp;
  v = max(0.0, v);
  v = round_float(v);
  if (o == v) return;
  _hp = v;
  if (v < o) {
    const std::shared_ptr<Summary> s = summary_mgr().get(id);
    s->set_hp_lost(Value(to_number(s->hp_lost()) + (o - v)));
  }
  if (v < o && !defines::is_independent(_team)) {
    const std::shared_ptr<Summary> s = summary_mgr().get(_team);
    s->set_hp_lost(Value(to_number(s->hp_lost()) + (o - v)));
  }
  callbacks.call(u"on_hp_changed", {ref(), Value(v), Value(o)});
  if (ctrl_ != nullptr && ctrl_->is_human() && ((o > 0) != (v > 0))) {
    world().mark_players_alive(*this, v > 0);
  }
  if (o > 0 && v <= 0) {
    callbacks.call(u"on_dead", {ref()});
    if (_state != nullptr && _state->on_dead) _state->on_dead(*this);
    const Value brokens = field_or(base_of(_data), u"brokens");
    if (!strict_equals(state(), Value(static_cast<double>(StateEnum::Gone))) &&
        frame_id_of(*this) != std::u16string(frame_id::kGone) &&
        array_length(brokens) > 0) {
      apply_opoints(brokens);
      play_sound(field_or(base_of(_data), u"dead_sounds"));
    }
    const Value nf = next_frame_of(field_or(frame, u"on_dead"), field_or(_data, u"on_dead"));
    if (truthy(nf)) enter_frame(nf);
  }
  if (v > _hp_r) set_hp_r(v);
}

double Entity::mp_max() const {
  return _mp_max.has_value() ? *_mp_max : num_of(world().dataset.get(u"mp_max"));
}

void Entity::set_mp_max(double v) { _mp_max = round_float(max(0.0, v)); }

double Entity::hp_max() const {
  return _hp_max.has_value() ? *_hp_max : num_of(world().dataset.get(u"hp_max"));
}

void Entity::set_hp_max(double v) { _hp_max = round_float(max(0.0, v)); }

void Entity::set_team(std::u16string v) {
  if (equals(Value(v), Value(_team))) return;
  const std::u16string o = _team;
  _team = std::move(v);
  const double n = to_number(Value(_team));
  variant = truthy(Value(n)) ? n : 0;
  callbacks.call(u"on_team_changed", {ref(), Value(_team), Value(o)});
  ++_render_effect_time;
}

const std::u16string* Entity::src_emitter() const {
  return emitters.empty() ? nullptr : &emitters.front();
}

const std::u16string* Entity::emitter() const {
  return emitters.empty() ? nullptr : &emitters.back();
}

void Entity::set_blinking(double v) { _blinking = round_float(max(0.0, v)); }

void Entity::set_invisible(double v) { _invisible = round_float(max(0.0, v)); }

void Entity::set_invulnerable(double v) { _invulnerable = round_float(max(0.0, v)); }

Value Entity::bot_ignore() const {
  return or_nullish(field_or(frame, u"bot_ignore"), field_or(base_of(_data), u"bot_ignore"));
}

void Entity::set_ctrl(controller::BaseController* v) {
  if (v == nullptr) return;
  if (ctrl_ == v) return;
  controller::BaseController* prev = ctrl_;
  ctrl_ = v;
  callbacks.call(u"on_ctrl_changed", {ctrl_ref(v), ctrl_ref(prev), ref()});
  world().mark_players_alive(*this, ctrl_->is_human() && hp() > 0);
  if (prev != nullptr) world().lfw().release_ctrl(prev);
  // TS 的控制器在构造/reset 里就持有 `entity`（`BotController` 的 `fsm.reset(Idle)` 会
  // 当场读 `stage.*` 并向 `mt` 抽签）⇒ 挂上控制器的那一刻把 env 先刷出来，让端口里
  // 「等 env 就绪」的初始化落在与 TS 相同的时刻（见 `BotController::set_env`）。
  refresh_ctrl_env();
}

void Entity::as_key_role(const Value& v) {
  name_visible = truthy(v) ? 1 : 0;
  wakeup_invuln = truthy(v) ? 1 : 0;
  dead_gone = truthy(v) ? 0 : 1;
}

void Entity::auto_key_role() {
  bool v = false;
  const Array* group_arr = as_array(group());
  if (group_arr != nullptr) {
    for (std::size_t i = 0; i < group_arr->size(); ++i) {
      const Value& item = group_arr->at(i);
      if (equals(item, Value(std::u16string(entity_group::kRegular))) ||
          equals(item, Value(std::u16string(entity_group::kBoss)))) {
        v = true;
        break;
      }
    }
  }
  as_key_role(Value(v));
}

double Entity::gravity() const {
  const Value g1 = _state != nullptr && _state->get_gravity ? _state->get_gravity(mutable_self())
                                                            : Value();
  const Value g2 = ctrl_ != nullptr && ctrl_->is_end(gk::kDefend) ? dataset(u"gravity")
                                                                  : dataset(u"gravity_d");
  return nullish(g1) ? num_of(g2) : to_number(g1);
}

double Entity::itr_motionless() const {
  if (type() == static_cast<double>(EntityEnum::Ball)) {
    return num_of(dataset(u"ball_itr_motionless"));
  }
  return num_of(dataset(u"itr_motionless"));
}

// --- frame lookup / flags -----------------------------------------------------

// `this._state?.find_frame_by_id?.(this, id)`, then the `FrameId` switch, then the
// `_data.frames` lookup with the `find_auto_frame()` fallback.  The missing-frame
// branch also calls `Ditto.warn(...)`, a console warning with no trace effect.
Value Entity::find_frame_by_id(const Value& id_value) const {
  if (_state != nullptr && _state->find_frame_by_id) {
    const Value r = _state->find_frame_by_id(mutable_self(), id_value);
    if (truthy(r)) return r;
  }
  // `switch (id)` is strict, so only `undefined` hits `case void 0:` — a `null` id
  // falls through to the `frames[null]` lookup.
  if (std::holds_alternative<std::monostate>(id_value)) return frame;
  const std::u16string* s = std::get_if<std::u16string>(&id_value);
  if (s != nullptr) {
    if (*s == frame_id::kNone || *s == frame_id::kSelf) return frame;
    if (*s == frame_id::kAuto) return find_auto_frame();
    if (*s == frame_id::kGone) {
      const Value* gone = defines::find(u"GONE_FRAME_INFO");
      return gone != nullptr ? *gone : Value();
    }
  }
  const std::u16string key = to_string(id_value);
  const Value found = field_kv(field_or(_data, u"frames"), key);
  if (nullish(found)) return find_auto_frame();
  return found;
}

// `this._state?.get_auto_frame?.(this) ?? this._data.frames["0"] ?? this.frame`
Value Entity::find_auto_frame() const {
  if (_state != nullptr && _state->get_auto_frame) {
    const Value f = _state->get_auto_frame(mutable_self());
    if (!nullish(f)) return f;
  }
  const Value f0 = field_or(field_or(_data, u"frames"), u"0");
  if (!nullish(f0)) return f0;
  return frame;
}

// `find_align_frame(frame_id, src, dst)`: the frame after `frame_id` in the `dst`
// list aligned with its position in `src` (`(idx + 1) % len`, so an unknown id lands
// on the first entry), `dst[0]` when only `dst` has entries, else the auto frame.
Value Entity::find_align_frame(const std::u16string& frame_id, const Value& src,
                               const Value& dst) const {
  const Array* d = as_array(dst);
  const Array* s = as_array(src);
  const std::size_t d_len = d != nullptr ? d->size() : 0;
  const std::size_t s_len = s != nullptr ? s->size() : 0;
  if (d_len > 0 && s_len > 0) {
    std::size_t idx = s_len;  // `indexOf` → -1
    for (std::size_t i = 0; i < s_len; ++i) {
      if (strict_equals(s->at(i), Value(frame_id))) {
        idx = i;
        break;
      }
    }
    Object nf;
    nf.set(u"id", d->at((idx + 1) % d_len));
    return Value(std::make_shared<Object>(nf));
  }
  if (d_len > 0) {
    Object nf;
    nf.set(u"id", d->at(0));
    return Value(std::make_shared<Object>(nf));
  }
  return find_auto_frame();
}

// `this._state?.get_sudden_death_frame?.(this) || Defines.NEXT_FRAME_AUTO` — the
// fallback is truthiness-based, so a falsy state answer also falls through.
Value Entity::get_sudden_death_frame() const {
  if (_state != nullptr && _state->get_sudden_death_frame) {
    const Value v = _state->get_sudden_death_frame(mutable_self());
    if (truthy(v)) return v;
  }
  const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
  return auto_frame != nullptr ? *auto_frame : Value();
}

Value Entity::get_caught_end_frame() {
  if (position.y < _ground_y) position.y = _ground_y + 1;
  if (_state != nullptr && _state->get_caught_end_frame) {
    const Value v = _state->get_caught_end_frame(mutable_self());
    if (truthy(v)) return v;
  }
  const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
  return auto_frame != nullptr ? *auto_frame : Value();
}

double Entity::handle_facing_flag(const Value& facing_value) const {
  // `switch (facing)` is a strict comparison, so only exact numbers match a case.
  const double* d = std::get_if<double>(&facing_value);
  if (d == nullptr) return this->facing;
  const double cur = this->facing;
  const int lr = ctrl_ != nullptr ? ctrl_->LR() : 0;
  const Value catcher_facing =
      catcher != nullptr ? Value(catcher->facing) : Value();
  const Value bearer_facing = bearer != nullptr ? Value(bearer->facing) : Value();
  if (*d == static_cast<double>(FacingFlag::Ctrl))
    return lr != 0 ? static_cast<double>(lr) : cur;
  if (*d == static_cast<double>(FacingFlag::AntiCtrl))
    return lr != 0 ? to_number(entity::turn_face(Value(static_cast<double>(lr)))) : cur;
  if (*d == static_cast<double>(FacingFlag::SameAsCatcher))
    return truthy(catcher_facing) ? to_number(catcher_facing) : cur;
  if (*d == static_cast<double>(FacingFlag::OpposingCatcher))
    return truthy(entity::turn_face(catcher_facing))
               ? to_number(entity::turn_face(catcher_facing))
               : cur;
  if (*d == static_cast<double>(FacingFlag::Backward))
    return to_number(entity::turn_face(Value(cur)));
  if (*d == static_cast<double>(FacingFlag::Left) ||
      *d == static_cast<double>(FacingFlag::Right))
    return *d;
  if (*d == static_cast<double>(FacingFlag::VX))
    return velocity.x > 0 ? 1 : velocity.x < 0 ? -1 : cur;
  if (*d == static_cast<double>(FacingFlag::AntiVX))
    return velocity.x > 0 ? -1 : velocity.x < 0 ? 1 : cur;
  if (*d == static_cast<double>(FacingFlag::Trend)) {
    if (lr != 0) return static_cast<double>(lr);
    return velocity.x > 0 ? 1 : velocity.x < 0 ? -1 : cur;
  }
  if (*d == static_cast<double>(FacingFlag::SameAsBearer))
    return truthy(bearer_facing) ? to_number(bearer_facing) : cur;
  if (*d == static_cast<double>(FacingFlag::OpposingBearer))
    return truthy(entity::turn_face(bearer_facing))
               ? to_number(entity::turn_face(bearer_facing))
               : cur;
  return cur;
}

double Entity::handle_wait_flag(const Value& wait_value,
                               const std::optional<Value>& frame_value) const {
  // `frame` is an optional object in TS, so a present-but-falsy frame counts as "no
  // frame" everywhere below.
  const bool has_frame = frame_value.has_value() && truthy(*frame_value);
  if (nullish(wait_value) && has_frame) return get_frame_wait(*frame_value);
  if (is_positive(wait_value)) return to_number(wait_value);
  const std::u16string* s = std::get_if<std::u16string>(&wait_value);
  if ((s != nullptr && *s == u"i") || !has_frame) return this->wait;
  if (s != nullptr && *s == u"d") {
    return max(0.0, to_number(field_or(*frame_value, u"wait")) -
                        to_number(field_or(this->frame, u"wait")) + this->wait);
  }
  return get_frame_wait(*frame_value);
}

double Entity::get_frame_wait(const Value& frame_value) const {
  const double d = to_number(field_or(frame_value, u"wait")) +
                   to_number(world().dataset.get(u"wait_offset"));
  return _from_wait_block ? d - _atom_time : d;
}

// `get dvx()` / `get dvy()` / `get dvz()`: a falsy frame value is returned untouched
// (`0` / `null` / `undefined`), a truthy one is multiplied by the dataset factor
// (`undefined` dataset → NaN, exactly like the TS `v * undefined`).
Value Entity::dvx() const {
  const Value v = field_or(frame, u"dvx");
  if (!truthy(v)) return v;
  return Value(to_number(v) * to_number(dataset(u"fvx_f")));
}

Value Entity::dvy() const {
  const Value v = field_or(frame, u"dvy");
  if (!truthy(v)) return v;
  return Value(to_number(v) * to_number(dataset(u"fvy_f")));
}

Value Entity::dvz() const {
  const Value v = field_or(frame, u"dvz");
  if (!truthy(v)) return v;
  return Value(to_number(v) * to_number(dataset(u"fvz_f")));
}

void Entity::set_velocity(const Value& x, const Value& y, const Value& z) {
  // TS starts with `if (is_f_num(_x) || is_f_num(_y) || is_f_num(_z)) debugger;` — a
  // dev-only guard with no observable effect.
  if (!nullish(x)) prev_velocity.x = velocity.x = round_float(to_number(x));
  if (!nullish(y)) prev_velocity.y = velocity.y = round_float(to_number(y));
  if (!nullish(z)) prev_velocity.z = velocity.z = round_float(to_number(z));
  if (velocity.y > 0) leave_ground();
}

void Entity::leave_ground() {
  if (eqlt(position.y, _ground_y)) position.y = round_float(_ground_y + 0.1);
  is_on_ground = false;
}

void Entity::handle_ground_velocity_decay(double factor) {
  if (position.y > _ground_y || truthy(Value(shaking)) || truthy(Value(motionless))) return;
  const bool landing = strict_equals(_landing_frame, frame);
  factor *= to_number(dataset(landing ? u"land_friction_factor" : u"friction_factor"));
  const Value fx = dataset(landing ? u"land_friction_x" : u"friction_x");
  const Value fz = dataset(landing ? u"land_friction_z" : u"friction_z");
  // An `undefined` `accz` argument falls back to `accx` (TS default parameter).
  handle_velocity_decay(fx,
                        std::holds_alternative<std::monostate>(fz)
                            ? std::nullopt
                            : std::optional<Value>(fz),
                        factor);
}

void Entity::handle_velocity_decay(const Value& accx, std::optional<Value> accz,
                                   double factor) {
  const double atom_time = to_number(world().dataset.get(u"atom_time"));
  Value x(round_float(to_number(velocity.x) * std::pow(factor, atom_time)));
  Value z(round_float(to_number(velocity.z) * std::pow(factor, atom_time)));
  const Value accz_value = accz.has_value() ? *accz : accx;
  const double acc_x = round_float(to_number(accx) * atom_time);
  const double acc_z = round_float(to_number(accz_value) * atom_time);

  const Value ctrl_x = field_or(frame, u"ctrl_x");
  const Value ctrl_z = field_or(frame, u"ctrl_z");
  // `let { dvx = 0, dvz = 0 } = this;` — the destructuring default only covers
  // `undefined`, a `null` frame value survives into the comparisons below.
  Value dvx_value = dvx();
  if (std::holds_alternative<std::monostate>(dvx_value)) dvx_value = Value(0.0);
  Value dvz_value = dvz();
  if (std::holds_alternative<std::monostate>(dvz_value)) dvz_value = Value(0.0);
  // `const { UD, LR } = this.ctrl` — TS would throw on a missing controller, so the
  // cases always keep one installed.
  const int lr = ctrl_ != nullptr ? ctrl_->LR() : 0;
  const int ud = ctrl_ != nullptr ? ctrl_->UD() : 0;
  if (truthy(ctrl_x) && lr == 0) dvx_value = Value(0.0);
  if (truthy(ctrl_z) && ud == 0) dvz_value = Value(0.0);

  const double dvx_num = to_number(dvx_value);
  const double dvz_num = to_number(dvz_value);
  if (gt(x, dvx_value)) {
    x = Value(to_number(x) - acc_x);
    if (lt(x, dvx_value)) x = dvx_value;
  } else if (lt(x, Value(-dvx_num))) {
    x = Value(to_number(x) + acc_x);
    if (gt(x, Value(-dvx_num))) x = Value(-dvx_num);
  }
  if (gt(z, dvz_value)) {
    z = Value(to_number(z) - acc_z);
    if (lt(z, dvz_value)) z = dvz_value;
  } else if (lt(z, Value(-dvz_num))) {
    z = Value(to_number(z) + acc_z);
    if (gt(z, Value(-dvz_num))) z = Value(-dvz_num);
  }
  set_velocity(x, Value(NullTag{}), z);
}

void Entity::handle_gravity() {
  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||
      truthy(Value(motionless)))
    return;
  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the
  // default, `null` reads as falsy.
  const Value gravity_enabled = field_or(frame, u"gravity_enabled");
  const bool enabled = std::holds_alternative<std::monostate>(gravity_enabled)
                           ? true
                           : truthy(gravity_enabled);
  if (position.y <= _ground_y || !enabled) return;
  velocity.y = round_float(velocity.y - gravity() * _atom_time);
}

void Entity::update_velocity(const Value& vinfo) {
  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||
      truthy(Value(motionless)))
    return;
  const double atom_time = _atom_time;

  Value dvx = field_or(vinfo, u"dvx");
  Value dvy = field_or(vinfo, u"dvy");
  Value dvz = field_or(vinfo, u"dvz");
  if (truthy(dvx)) dvx = Value(round_float(to_number(dvx) * to_number(dataset(u"fvx_f"))));
  if (truthy(dvy)) dvy = Value(round_float(to_number(dvy) * to_number(dataset(u"fvy_f"))));
  if (truthy(dvz)) dvz = Value(round_float(to_number(dvz) * to_number(dataset(u"fvz_f"))));

  Value vxm = field_or(vinfo, u"vxm");
  if (std::holds_alternative<std::monostate>(vxm))
    vxm = Value(static_cast<double>(SpeedMode::Default));
  Value vym = field_or(vinfo, u"vym");
  if (std::holds_alternative<std::monostate>(vym))
    vym = Value(static_cast<double>(SpeedMode::AccTo));
  Value vzm = field_or(vinfo, u"vzm");
  if (std::holds_alternative<std::monostate>(vzm))
    vzm = Value(static_cast<double>(SpeedMode::Default));
  Value ctrl_x = field_or(vinfo, u"ctrl_x");
  if (std::holds_alternative<std::monostate>(ctrl_x)) ctrl_x = Value(0.0);
  Value ctrl_y = field_or(vinfo, u"ctrl_y");
  if (std::holds_alternative<std::monostate>(ctrl_y)) ctrl_y = Value(0.0);
  Value ctrl_z = field_or(vinfo, u"ctrl_z");
  if (std::holds_alternative<std::monostate>(ctrl_z)) ctrl_z = Value(0.0);

  Value acc_x = field_or(vinfo, u"acc_x");
  Value acc_y = field_or(vinfo, u"acc_y");
  Value acc_z = field_or(vinfo, u"acc_z");
  // `acc_x == void 0` is loose equality: `null` and `undefined` both take the branch.
  if ((equals(vxm, Value(static_cast<double>(SpeedMode::AccTo))) ||
       equals(vxm, Value(static_cast<double>(SpeedMode::FixedAccTo)))) &&
      nullish(acc_x) && truthy(dvx))
    acc_x = dvx;
  if ((equals(vym, Value(static_cast<double>(SpeedMode::AccTo))) ||
       equals(vym, Value(static_cast<double>(SpeedMode::FixedAccTo)))) &&
      nullish(acc_y) && truthy(dvy))
    acc_y = dvy;
  if ((equals(vzm, Value(static_cast<double>(SpeedMode::AccTo))) ||
       equals(vzm, Value(static_cast<double>(SpeedMode::FixedAccTo)))) &&
      nullish(acc_z) && truthy(dvz))
    acc_z = dvz;
  if (truthy(acc_x)) acc_x = Value(round_float(to_number(acc_x) * atom_time));
  if (truthy(acc_y)) acc_y = Value(round_float(to_number(acc_y) * atom_time));
  if (truthy(acc_z)) acc_z = Value(round_float(to_number(acc_z) * atom_time));

  double vx = velocity.x;
  double vy = velocity.y;
  double vz = velocity.z;
  // `const { UD, LR, jd } = this._ctrl` — the cases always keep a controller.
  const int lr = ctrl_ != nullptr ? ctrl_->LR() : 0;
  const int ud = ctrl_ != nullptr ? ctrl_->UD() : 0;
  const int jd = ctrl_ != nullptr ? ctrl_->jd() : 0;
  const Value facing_v = Value(facing);
  const auto apply = [](double current, const Value& value, const Value& mode,
                        const Value& acc, const Value& direction) {
    return entity::calc_v(current, to_number(value), mode, acc, direction);
  };

  if (nullish(dvx)) {
    /* noop */
  } else if (!truthy(ctrl_x)) {
    vx = apply(vx, dvx, vxm, acc_x, facing_v);
  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Control)))) {
    vx = apply(vx, dvx, vxm, acc_x, Value(static_cast<double>(lr)));
  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Enable)))) {
    vx = apply(vx, dvx, vxm, acc_x, Value(1.0));
  } else if (lr == 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Disable)))) {
    vx = apply(vx, dvx, vxm, acc_x, Value(1.0));
  }

  if (nullish(dvy)) {
    /* noop */
  } else if (!truthy(ctrl_y)) {
    vy = apply(vy, dvy, vym, acc_y, Value(1.0));
  } else if (jd != 0 && equals(ctrl_y, Value(static_cast<double>(SpeedCtrl::Control)))) {
    vy = apply(vy, dvy, vym, acc_y, Value(static_cast<double>(jd)));
  } else if (jd != 0 && equals(ctrl_y, Value(static_cast<double>(SpeedCtrl::Enable)))) {
    vy = apply(vy, dvy, vym, acc_y, Value(1.0));
  } else if (jd == 0 && equals(ctrl_y, Value(static_cast<double>(SpeedCtrl::Disable)))) {
    vy = apply(vy, dvy, vym, acc_y, Value(1.0));
  }

  if (nullish(dvz)) {
    /* noop */
  } else if (!truthy(ctrl_z)) {
    vz = apply(vz, dvz, vzm, acc_z, Value(1.0));
  } else if (ud != 0 && equals(ctrl_z, Value(static_cast<double>(SpeedCtrl::Control)))) {
    vz = apply(vz, dvz, vzm, acc_z, Value(static_cast<double>(ud)));
  } else if (ud != 0 && equals(ctrl_z, Value(static_cast<double>(SpeedCtrl::Enable)))) {
    vz = apply(vz, dvz, vzm, acc_z, Value(1.0));
  } else if (ud == 0 && equals(ctrl_z, Value(static_cast<double>(SpeedCtrl::Disable)))) {
    vz = apply(vz, dvz, vzm, acc_z, Value(1.0));
  }

  velocity.x = round_float(vx);
  velocity.y = round_float(vy);
  velocity.z = round_float(vz);
}

void Entity::set_arest(double v) {
  if (equals(Value(v), Value(_arest))) return;
  _arest = round_float(v);
}

double Entity::weight() const { return num_of(or_nullish(field_or(base_of(_data), u"weight"), Value(1.0))); }

double Entity::base_type() const {
  return num_of(or_nullish(field_or(base_of(_data), u"type"), Value(0.0)));
}

Value Entity::state() const { return field_or(frame, u"state"); }

void Entity::reset_armor() {
  const Value armor_v = field_or(base_of(_data), u"armor");
  armor = truthy(armor_v) ? armor_v : Value(NullTag{});
  const Value toughness = field_or(armor_v, u"toughness");
  set_toughness_max(num_of(toughness));
  set_toughness(num_of(toughness));
  set_toughness_resting(0);
  set_toughness_resting_max(num_of(field_or(armor_v, u"toughness_resting")));
  const Value trv = field_or(armor_v, u"toughness_r_value");
  _toughness_r_value = num_of(or_nullish(trv, dataset(u"toughness_r_value")));
  const Value trt = field_or(armor_v, u"toughness_r_tick");
  _toughness_r_tick.set_max(num_of(or_nullish(trt, dataset(u"toughness_r_tick"))));
  _toughness_r_tick.set_value(0);
}

Entity& Entity::set_catching(Entity* v) {
  if (catching == v) return *this;
  catching = v;
  return *this;
}

Entity& Entity::add_catch_time(double value) {
  if (!truthy(Value(value))) return *this;
  return set_catch_time(_catch_time + value);
}

Entity& Entity::set_catch_time(double value) {
  const double v = round_float(value);
  if (equals(Value(_catch_time), Value(v))) return *this;
  _catch_time = clamp(v, 0.0, catch_time_max());
  return *this;
}

Value Entity::dataset(const std::u16string& name) const {
  Value v = field_or(field_or(frame, u"dataset"), name.c_str());
  if (nullish(v)) v = field_or(base_of(_data), name.c_str());
  if (nullish(v)) v = world().bg_dataset(name);
  if (nullish(v)) v = world().dataset.get(name);
  return v;
}

// ─────────────── 切片 4CE：碰撞族窄接口上收后的读面（原 `EntityCollisionView`）───────────────

Value Entity::data_base_hit_sounds() const {
  return field_or(field_or(_data, u"base"), u"hit_sounds");
}

// `this.data.id`：必须走虚的 `data()`（台面会替换 `data`），而不是私有的 `_data`。
Value Entity::data_id() const { return field_or(data(), u"id"); }

// `const { on_landing } = e.frame`（`state/CharacterState_Base.ts:13`）。
Value Entity::frame_on_landing() const { return field_or(frame, u"on_landing"); }

// `c.victim.frame.behavior`（`defines/CollisionVal.ts:54`）。
Value Entity::frame_behavior() const { return field_or(frame, u"behavior"); }

// `const { base, indexes } = e.data`（`state/WeaponState_Base.ts:32`）。
Value Entity::data_base() const { return field_or(data(), u"base"); }

// `e.data.frames[fid]`（`state/CharacterState_Base.ts:25`）。
Value Entity::data_frames() const { return field_or(data(), u"frames"); }

// `if (!indexes) return void 0`（`state/WeaponState_Base.ts:9`）。
bool Entity::has_data_indexes() const { return truthy(field_or(data(), u"indexes")); }

// --- 切片 4CG：状态面的「输入面 / 持有物面」落实（原 `IStateEntity` 的占位体）------------
// 每条对着一个 TS 表达式。`ctrl_ == nullptr` 是 TS 里「这个实体没有控制器」的情形（TS 那边
// 会抛，端口按台面已有的中性口径给 `0` / `true`）。
double Entity::ctrl_ud() const {
  return ctrl_ != nullptr ? static_cast<double>(ctrl_->UD()) : 0.0;
}

double Entity::ctrl_lr() const {
  return ctrl_ != nullptr ? static_cast<double>(ctrl_->LR()) : 0.0;
}

bool Entity::ctrl_is_bot() const { return entity::is_bot_ctrl(ctrl_); }

bool Entity::ctrl_is_end(const std::u16string& key) const {
  return ctrl_ != nullptr ? ctrl_->is_end(key) : true;
}

void Entity::ctrl_reset_key_list() {
  if (ctrl_ != nullptr) ctrl_->reset_key_list();
}

DrinkInfo* Entity::holding_drink() const {
  return holding != nullptr ? holding->drink.get() : nullptr;
}

void Entity::holding_set_hp(const Value& v) {
  if (holding != nullptr) holding->set_hp(to_number(v));
}

void Entity::holding_set_hp_r(const Value& v) {
  if (holding != nullptr) holding->set_hp_r(to_number(v));
}

void Entity::holding_set_velocity(const Value& x, const Value& y, const Value& z) {
  if (holding != nullptr) holding->set_velocity(x, y, z);
}

void Entity::holding_set_team(const Value& v) {
  if (holding != nullptr) holding->set_team(to_string(v));
}

bool Entity::holding_is_weapon() const {
  return holding != nullptr && entity::is_weapon(ref_of(*holding));
}

void Entity::catcher_drop_catching() {
  if (catcher != nullptr) catcher->drop_catching();
}

Value Entity::bearer_motionless() const {
  return bearer != nullptr ? Value(bearer->motionless) : Value();
}

void Entity::set_bearer_motionless(const Value& v) {
  if (bearer != nullptr) bearer->motionless = to_number(v);
}

Value Entity::lfw_new_team() const { return Value(world().lfw().new_team()); }

Value Entity::datas_find(const std::u16string& oid) {
  return world().lfw().datas_find(Value(std::u16string(oid)));
}

Value Entity::frame_id() const { return field_or(frame, u"id"); }

Value Entity::cpoint_backhurtact() const {
  return field_or(field_or(frame, u"cpoint"), u"backhurtact");
}

Value Entity::cpoint_fronthurtact() const {
  return field_or(field_or(frame, u"cpoint"), u"fronthurtact");
}

Value Entity::data_in_the_skys_first() const {
  const Value list = data_indexes_of(u"in_the_skys");
  if (const Array* a = as_array(list)) return a->empty() ? Value() : a->at(0);
  return field_or(list, u"0");
}

Value Entity::holding_base_type() const {
  return holding == nullptr ? Value() : Value(holding->base_type());
}

Value Entity::fuse_bys_of() const {
  if (fuse_bys.empty()) return Value();
  std::vector<Value> ids;
  ids.reserve(fuse_bys.size());
  for (Entity* e : fuse_bys) ids.push_back(Value(e->id));
  return Value(std::make_shared<Array>(std::move(ids)));
}

void Entity::set_fuse_bys(const Value& v) {
  fuse_bys.clear();
  const Array* arr = as_array(v);
  if (arr == nullptr) {
    has_fuse_bys = false;
    return;
  }
  for (size_t i = 0; i < arr->size(); ++i) {
    Entity* e = world().find_entity(to_string(arr->at(i)));
    if (e != nullptr) fuse_bys.push_back(e);
  }
  has_fuse_bys = !fuse_bys.empty();
}

void Entity::set_dismiss_time(const Value& v) {
  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v)) {
    dismiss_time = std::nullopt;
    return;
  }
  dismiss_time = to_number(v);
}

// TS `Entity.play_sound(sounds, pos = this.position)`：Message 帧（`StateEnum.Message` 那类
// 飘字实体）的音效要把 x 夹进「镜头可视范围」，其余帧原样透传；数组/单值的展开与 `lfw.sounds.play`
// 在 `World::play_sound`（宿主的记录缝）那一侧做。**非** Message 帧必须把 `pos` 原样转发
// （不重建 Value）—— 台面靠 `world().play_sound(sounds, pos)` 记录 `play_sound:<sounds>@<pos>`。
void Entity::play_sound(const Value& sounds, const Value& pos) {
  if (to_number(field_or(frame, u"state")) != static_cast<double>(StateEnum::Message)) {
    world().play_sound(sounds, pos);
    return;
  }
  const double centerx = to_number(field_or(frame, u"centerx"));
  const double width = to_number(field_or(frame, u"width"));
  double cam_x = world().camera().position.x;
  const Background* const bg = world().bg();
  const double zoom_x = bg != nullptr ? bg->zoom_x() : 1.0;
  double cam_r = cam_x + to_number(world().dataset.get(u"screen_w")) / zoom_x;
  const double offset_x = facing == 1 ? centerx : width - centerx;
  cam_r -= width - offset_x;
  cam_x += offset_x;
  Object o;
  o.set(u"x", Value(clamp(to_number(field_or(pos, u"x")), cam_x, cam_r)));
  o.set(u"y", field_or(pos, u"y"));
  o.set(u"z", field_or(pos, u"z"));
  world().play_sound(sounds, Value(std::make_shared<Object>(o)));
}

void Entity::play_sound(const Value& sounds) {
  play_sound(sounds, position_value(position));
}

void Entity::spark_point(const collision::Cube& a, const collision::Cube& b, double& x, double& y,
                         double& z) const {
  Bounding rb{};
  rb.left = a.left;
  rb.right = a.right;
  rb.top = a.top;
  rb.bottom = a.bottom;
  rb.near = a.near;
  rb.far = a.far;
  Bounding rc{};
  rc.left = b.left;
  rc.right = b.right;
  rc.top = b.top;
  rc.bottom = b.bottom;
  rc.near = b.near;
  rc.far = b.far;
  const Bounding cross = cross_bounding(rb, rc);
  (*world().lfw().mt()).mark = u"sp_1";
  x = (*world().lfw().mt()).range(cross.left, cross.right);
  y = 2 + round_float((cross.bottom + cross.top) / 2);
  z = max(cross.far, cross.near) + 3;
}

void Entity::set_prop(const std::u16string& name, const Value& v) {
  if (name == u"hp") {
    set_hp(to_number(v));
  } else if (name == u"hp_r") {
    set_hp_r(to_number(v));
  } else if (name == u"hp_max") {
    set_hp_max(to_number(v));
  } else if (name == u"mp") {
    set_mp(to_number(v));
  } else if (name == u"mp_max") {
    set_mp_max(to_number(v));
  } else if (name == u"invisible") {
    set_invisible(to_number(v));
  } else if (name == u"invulnerable") {
    set_invulnerable(to_number(v));
  } else if (name == u"toughness") {
    set_toughness(to_number(v));
  } else if (name == u"fallinjury") {
    fallinjury = to_number(v);
  } else if (name == u"throwinjury") {
    throwinjury = to_number(v);
  } else if (name == u"motionless") {
    set_motionless(to_number(v));
  } else if (name == u"shaking") {
    set_shaking(to_number(v));
  } else if (name == u"facing") {
    set_facing(v);
  } else if (name == u"arest") {
    set_arest(to_number(v));
  } else if (name == u"dropping") {
    set_dropping(truthy(v));
  } else if (name == u"team") {
    // 切片 4CE 补：白名单漏了 `team`，而 `V_SET_PROP name=team` 在 TS 侧是实打实的字段写入
    // （`(victim as any)[name] = value`）。
    set_team(to_string(v));
  } else if (name == u"reserve") {
    set_reserve(to_number(v));
  }
}

Entity& Entity::set_shaking(double v) {
  shaking = v;
  return *this;
}

Entity& Entity::set_motionless(double v) {
  motionless = v;
  return *this;
}

Entity& Entity::set_catcher(Entity* v) {
  catcher = v;
  return *this;
}

Value Entity::world_dataset(const std::u16string& name) const {
  return world().dataset.get(name);
}

Value Entity::itr_fall(const Value& itr) const {
  const Value fall = field_or(itr, u"fall");
  return nullish(fall) ? dataset(u"itr_fall") : fall;
}

// ⚠ 这是**薄引用**（TS 的 `ref` 就是 `{id}`，台面 `run get ref` 一字不差地对它）。
// 「控制器/碰撞/机器人看到的实体视图」是另一个东西 = `entity_ref.h` 的 `ref_of()`（含 data/
// position/team/… 25 个字段，`entity_ref.h` 明写那是唯一生成处）。两者别混：把薄引用喂给
// `BotController::lookup` 会让 `is_fighter/is_weapon/is_ball` 全恒假 ⇒ 目标名单永远空 ⇒ bot 不攻击
// （`LFW::ctrl_update_lookup` 曾经就是这么错的，见 DESIGN §145）。
Value Entity::ref() const {
  Object o;
  o.set(u"id", Value(id));
  return Value(std::make_shared<Object>(o));
}

Value Entity::ctrl_ref(controller::BaseController* ctrl) const {
  if (ctrl == nullptr) return Value();
  Object o;
  o.set(u"__is_base_ctrl__", Value(true));
  if (ctrl->is_human()) o.set(u"__is_human_ctrl__", Value(true));
  if (ctrl->is_bot()) o.set(u"__is_bot_ctrl__", Value(true));
  o.set(u"player", ctrl->player);
  o.set(u"player_id", Value(ctrl->player_id));
  return Value(std::make_shared<Object>(o));
}

// --- per-tick recovery --------------------------------------------------------

// `toughness_recovering()`: the resting branch drains `_atom_time` from
// `_toughness_resting` and needs `frame.toughness_recover`; the other branch gates on
// the tick and adds the private `_toughness_r_value`.
void Entity::toughness_recovering() {
  if (_toughness_resting > 0) {
    if (!truthy(field_or(frame, u"toughness_recover"))) return;
    set_toughness_resting(
        clamp_add(_toughness_resting, -_atom_time, 0, _toughness_resting_max));
    return;
  }
  if (_toughness >= toughness_max()) return;
  if (!_toughness_r_tick.add(_atom_time)) return;
  set_toughness(clamp_add(_toughness, _toughness_r_value, 0, _toughness_max));
}

// Both the guard and the clamp max read the `fall_value_max` getter (`_fall_value_max
// ?? world.dataset.fall_value_max`), so a missing dataset key makes them NaN.
void Entity::fall_value_recovering() {
  if (_fall_value >= fall_value_max()) return;
  if (!_fall_r_tick.add(_atom_time)) return;
  set_fall_value(clamp_add(_fall_value, _fall_r_value, 0, fall_value_max()));
}

void Entity::defend_value_recovering() {
  if (_defend_value >= defend_value_max()) return;
  if (!_defend_r_tick.add(_atom_time)) return;
  set_defend_value(clamp_add(_defend_value, _defend_r_value, 0, defend_value_max()));
}

// `stat_recovering()`: a resting entity drains `resting` (needs `frame.stat_recover`),
// otherwise the fall / defend values recover instead.
void Entity::stat_recovering() {
  if (_resting > 0) {
    if (!truthy(field_or(frame, u"stat_recover"))) return;
    set_resting(clamp_add(_resting, -_atom_time, 0, resting_max()));
    return;
  }
  fall_value_recovering();
  defend_value_recovering();
}

void Entity::hp_recovering() {
  if (_hp <= 0 || _hp >= _hp_r) return;
  _hp_r_tick.set_max(to_number(dataset(u"hp_r_ticks")));
  if (!_hp_r_tick.add(_atom_time)) return;
  set_hp(min(_hp_r, _hp + to_number(dataset(u"hp_r_value"))));
}

void Entity::mp_recovering() {
  if (_hp <= 0 || _mp >= mp_max() || truthy(Value(_blinking)) ||
      truthy(Value(_invisible))) {
    return;
  }
  _mp_r_tick.set_max(to_number(dataset(u"mp_r_ticks")));
  if (!_mp_r_tick.add(_atom_time)) return;
  const double r_ratio = to_number(dataset(u"mp_r_ratio"));
  double a = hp_max();
  double b = _hp;
  // The two `hp_max` / `_hp` readings are clamped to 500 before the ratio maths.
  if (a > 500) a = 500;
  if (b > 500) b = 500;
  const double value = 1 + round_float((a - min(r_ratio * b, a)) / 100);
  set_mp(min(mp_max(), _mp + value));
}

// --- marks / emitter helpers ---------------------------------------------------

bool Entity::set_mark(const std::u16string& key, const std::u16string& value,
                      const std::optional<Value>& prev) {
  const auto it = marks.find(key);
  const Value cur = it != marks.end() ? Value(it->second) : Value();
  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {
    marks[key] = value;
    return true;
  }
  return false;
}

bool Entity::del_mark(const std::u16string& key, const std::optional<Value>& value) {
  const auto it = marks.find(key);
  const Value cur = it != marks.end() ? Value(it->second) : Value();
  if (!value.has_value() || nullish(*value) || equals(cur, *value)) {
    return marks.erase(key) != 0;
  }
  return false;
}

bool Entity::is_ally(const Entity& other) const { return _team == other._team; }

Entity* Entity::get_emitter(double idx) const {
  if (!(idx >= 0) || std::floor(idx) != idx) return nullptr;
  const std::size_t i = static_cast<std::size_t>(idx);
  if (i >= emitters.size()) return nullptr;
  // `if (!emittier_id) return;` — an empty id is falsy, so it never resolves.
  if (emitters[i].empty()) return nullptr;
  return world().find_entity(emitters[i]);
}

// --- v_rest / relation cleanup / blink arming ---------------------------------

// `this.vrests.set(c.aid, c)` plus the two `itr.kind` mirrors.  The kind is compared
// strictly (`===`), so a string kind never files into `blockers` / `superpunchs`; a
// missing `itr` reads as `undefined` here where TS would throw (`c.itr.kind`).
void Entity::add_v_rest(const collision::Collision& c) {
  vrests[c.aid] = c;
  const Value kind = field_or(c.itr, u"kind");
  if (strict_equals(kind, Value(static_cast<double>(ItrKind::Block)))) blockers[c.aid] = c;
  if (strict_equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))
    superpunchs[c.aid] = c;
}

// `this.vrests.get(a_id)?.rest || 0` — a missing id, a `0` and a `NaN` all read back
// as `0` (JS truthiness), everything else is returned as stored.
double Entity::get_v_rest(const std::u16string& a_id) const {
  const auto it = vrests.find(a_id);
  if (it == vrests.end()) return 0;
  const double rest = it->second.rest;
  return truthy(Value(rest)) ? rest : 0;
}

void Entity::del_v_rest(const std::u16string& a_id) {
  vrests.erase(a_id);
  blockers.erase(a_id);
  superpunchs.erase(a_id);
}

double Entity::get_flag(const Entity& other) const {
  return flag_between(team(), hp(), type(), other.team());
}

void Entity::clean_holding() {
  if (holding == nullptr) return;
  if (holding->bearer == this) holding->bearer = nullptr;
  holding = nullptr;
}

void Entity::clean_catching() {
  if (catching == nullptr) return;
  if (catching->catcher == this) catching->catcher = nullptr;
  catching = nullptr;
}

bool Entity::drop_catching() {
  if (catching == nullptr) return false;
  if (catching->catcher == this) catching->catcher = nullptr;
  set_catching(nullptr);
  const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
  enter_frame(auto_frame != nullptr ? *auto_frame : Value());
  return true;
}

void Entity::release() {
  if (!truthy(Value(_mounted))) return;
  if (bearer != nullptr) bearer->drop_holding();
  if (catcher != nullptr) catcher->drop_catching();
  clean_holding();
  clean_catching();
  _mounted = 0;
  callbacks.call(u"on_disposed", {ref()});
  callbacks.clear();
  reset(_data, states_);
  world().del_entity(*this);
}

void Entity::blink_and_gone(double duration) {
  _blinking = duration;
  _after_blink = frame_id::kGone;
}

void Entity::blink_and_respawn(double duration) {
  _blinking = duration;
  _after_blink = frame_id::kRespawn;
}

// `const { y = 0, h = 0 } = itr` defaults only an `undefined`, but a `null` behaves
// the same in the subtraction, so both read as `0` here.  Unlike TS (`itrs?.length`)
// a non-array argument never gets that far — `as_array` answers `nullptr`.
void Entity::update_itr_bdy_hit_ground(const Value& itrs) {
  const Array* a = as_array(itrs);
  if (a == nullptr || a->empty()) return;
  const std::size_t n = a->size();
  for (std::size_t i = 0; i < n; ++i) {
    const Value& itr = a->at(i);
    const Value target = field_or(itr, u"on_hit_ground");
    if (!truthy(target)) continue;
    const Value y_value = field_or(itr, u"y");
    const Value h_value = field_or(itr, u"h");
    const double y = nullish(y_value) ? 0.0 : to_number(y_value);
    const double h = nullish(h_value) ? 0.0 : to_number(h_value);
    if (position.y + to_number(field_or(frame, u"centery")) - y - h > _ground_y) continue;
    enter_frame(target);
  }
}

// --- enter-frame chain --------------------------------------------------------

namespace {

// `a?.length` — `undefined` for a nullish value, the count for an array (and for a
// string, which TS would iterate as characters).
double js_length(const Value& v) {
  if (nullish(v)) return std::numeric_limits<double>::quiet_NaN();
  const Array* a = as_array(v);
  if (a != nullptr) return static_cast<double>(a->size());
  const std::u16string* s = std::get_if<std::u16string>(&v);
  if (s != nullptr) return static_cast<double>(s->size());
  return std::numeric_limits<double>::quiet_NaN();
}

// `this.position` handed to the host as a `Value` (TS passes the live object; only
// its fields are ever read).
Value position_value(const Vector3& p) {
  Object o;
  o.set(u"x", Value(p.x));
  o.set(u"y", Value(p.y));
  o.set(u"z", Value(p.z));
  return Value(std::make_shared<Object>(o));
}

}

// `world.ground.y(this.terrain, x, z)` — the ported static `Ground::y` (TS reaches the
// same function through the `World.ground` instance).
void Entity::set_position(const Value& x, const Value& y, const Value& z) {
  if (!nullish(x)) position.x = round_float(to_number(x));
  if (!nullish(y)) position.y = round_float(to_number(y));
  if (!nullish(z)) position.z = round_float(to_number(z));
  if (prev_position.x == kMinSafeInteger) prev_position = position;
  const Vector3 r = world().restrict(*this);
  const Value on_x = field_or(frame, u"on_x_restrict");
  if (position.x != r.x && truthy(on_x)) enter_frame(on_x);
  const Value on_z = field_or(frame, u"on_z_restrict");
  if (position.z != r.z && truthy(on_z)) enter_frame(on_z);
  const Value on_y = field_or(frame, u"on_y_restrict");
  if (position.y != r.y && truthy(on_y)) enter_frame(on_y);
  if (position.x != r.x || position.y != r.y || position.z != r.z) {
    const Value on_restrict = field_or(frame, u"on_restrict");
    if (truthy(on_restrict)) enter_frame(on_restrict);
    if (_state != nullptr) _state->on_restrict(*this, r.x, r.y, r.z);
  }
  _ground_y = Ground::y(terrain, position.x, position.z);
}

void Entity::update_position() {
  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||
      truthy(Value(motionless)))
    return;
  double vx = velocity.x;
  double vz = velocity.z;
  const double vy = velocity.y;
  const double atom_time = _atom_time;
  for (const auto& kv : blockers) {
    const collision::Collision& v = kv.second;
    if ((vx < 0 && v.attacker.px < position.x) || (vx > 0 && v.attacker.px > position.x)) {
      vx = 0;
      prev_velocity.x = 0;
    }
    if ((vz < 0 && v.attacker.pz < position.z) || (vz > 0 && v.attacker.pz > position.z)) {
      vz = 0;
      prev_velocity.z = 0;
    }
  }
  if (!truthy(Value(shaking)) && !truthy(Value(motionless))) {
    double x = position.x;
    double y = position.y;
    double z = position.z;
    x += (vx + prev_velocity.x) * 0.5 * atom_time;
    y += (vy + prev_velocity.y) * 0.5 * atom_time;
    z += (vz + prev_velocity.z) * 0.5 * atom_time;
    set_position(Value(x), Value(y), Value(z));
  }
  prev_velocity.set(vx, vy, vz);
}

// `set_frame(v)`: the opoint interval filter, the frame swap, the state hook, the four
// one-shot flags and the two follow-up requests.
void Entity::set_frame(const Value& v) {
  _motionless_ticks = 0;
  const Value* gone = defines::find(u"GONE_FRAME_INFO");
  const bool is_gone = gone != nullptr && strict_equals(field_or(v, u"id"), field_or(*gone, u"id"));
  if (is_gone) {
    opoints.clear();
  } else if (!opoints.empty()) {
    const std::size_t len = opoints.size();
    std::size_t slow = 0;
    for (std::size_t fast = 0; fast < len; ++fast) {
      const Value& opoint = opoints[fast].first;
      if (!strict_equals(field_or(opoint, u"interval_mode"), Value(1.0))) continue;
      const Value interval_id = field_or(opoint, u"interval_id");
      const Array* next_opoints = as_array(field_or(v, u"opoint"));
      // `find(v.opoint, o => o.interval_id === interval_id)` —— 见 `find_array`：TS 的
      // `find` 在元素全不匹配时还有一遍 pair 回落（谓词读到 `undefined` 的字段）。
      bool exists = false;
      if (next_opoints != nullptr) {
        exists = find_array(*next_opoints, [&](const Value& o) {
                   return strict_equals(field_or(o, u"interval_id"), interval_id);
                 }).has_value();
      }
      if (!exists) continue;
      opoints[slow++] = opoints[fast];
    }
    opoints.resize(slow);
  }
  _prev_frame = frame;
  _landing_frame = Value(NullTag{});
  frame = v;
  if (!truthy(Value(js_length(field_or(v, u"itr"))))) set_arest(0);
  const Value prev_state_code = field_or(_prev_frame, u"state");
  const Value next_state_code = state();
  if (!strict_equals(prev_state_code, next_state_code)) set_state(next_state_code);
  const Value invisible = field_or(v, u"invisible");
  if (truthy(invisible)) set_invisible(to_number(invisible));
  const Value blinking = field_or(v, u"blinking");
  if (truthy(blinking)) set_blinking(to_number(blinking));
  // `this._invulnerable = v.invulnerable` — the private field, *not* the clamped setter.
  const Value invulnerable = field_or(v, u"invulnerable");
  if (truthy(invulnerable)) _invulnerable = to_number(invulnerable);
  const Value opoint = field_or(v, u"opoint");
  if (truthy(opoint)) apply_opoints(opoint);
  if (!truthy(field_or(v, u"cpoint"))) {
    set_catching(nullptr);
    catcher = nullptr;
  }
  const Array* broadcasts = as_array(field_or(v, u"broadcasts"));
  if (broadcasts != nullptr && !broadcasts->empty()) {
    for (std::size_t i = 0; i < broadcasts->size(); ++i) world().lfw().broadcast(broadcasts->at(i));
  }
  if (holding != nullptr) holding->follow_bearer();
  if (catching != nullptr) catching->follow_catcher();
}

EnterFrameResult Entity::enter_frame(const Value& nfs, bool fallback) {
  if (strict_equals(field_or(frame, u"id"), Value(std::u16string(frame_id::kGone))))
    return EnterFrameResult::Gone;
  const Value result = get_next_frame(nfs);
  if (nullish(result) && fallback) {
    const Value f = find_auto_frame();
    set_frame(f);
    wait = handle_wait_flag(Value(), f);
    return EnterFrameResult::Fallback;
  }
  if (nullish(result)) return EnterFrameResult::NotFound;
  return handle_next_frame_result(result);
}

EnterFrameResult Entity::enter_frame_by_id(const Value& id_value, bool fallback) {
  // `if (id == void 0 && fallback)` is a *loose* check, so `null` counts as missing.
  Value use_id = id_value;
  if (nullish(use_id) && fallback) use_id = Value(std::u16string(frame_id::kAuto));
  Object* nf = as_object(_next_frame_by_id);
  if (nf != nullptr) nf->set(u"id", use_id);
  return enter_frame(_next_frame_by_id, fallback);
}

EnterFrameResult Entity::handle_next_frame_result(const Value& result, bool fallback) {
  const Value frame_v = field_or(result, u"frame");
  const Value flags = field_or(result, u"which");
  if (!truthy(world().dataset.get(u"infinity_mp"))) {
    const Value mp = field_or(flags, u"mp");
    const Value hp = field_or(flags, u"hp");
    if (truthy(mp)) set_mp(_mp - to_number(mp));
    if (truthy(hp)) set_hp(_hp - to_number(hp));
  }
  if (truthy(frame_v)) {
    play_sound(field_or(frame_v, u"sound"));
    set_frame(frame_v);
  } else {
    const Value* empty_frame = defines::find(u"EMPTY_FRAME_INFO");
    if ((empty_frame != nullptr && same_ref(frame, *empty_frame)) || fallback)
      set_frame(find_auto_frame());
  }
  const Value facing_flag = field_or(flags, u"facing");
  if (!std::holds_alternative<std::monostate>(facing_flag))
    facing = handle_facing_flag(facing_flag);
  if (truthy(frame_v)) wait = handle_wait_flag(field_or(flags, u"wait"), frame_v);
  const Value sound = field_or(flags, u"sound");
  if (as_array(sound) != nullptr) play_sound(sound);
  const Value blink_time = field_or(flags, u"blink_time");
  if (truthy(blink_time)) set_blinking(to_number(blink_time));
  // `this.ctrl.reset_key_list()` has no optional chain in TS (a missing controller
  // would throw); the port skips instead of dereferencing `nullptr`.
  if (truthy(field_or(flags, u"reset_keys")) && ctrl_ != nullptr) ctrl_->reset_key_list();
  if (truthy(field_or(flags, u"transfrom_to_another"))) transfrom_to_another(std::nullopt);
  return truthy(frame_v) ? EnterFrameResult::Entered : EnterFrameResult::Fallback;
}

// TS: `if (!nf.__judger) { remains.push(nf); continue; }` —— 判定器由加载期的
// `preprocess_next_frame` 登记（照 TS 的挂载点），这里只是问「有没有」。
bool Entity::has_next_frame_judge(const Value& nf) const {
  return loader::judger_of(nf) != nullptr;
}

// TS: `const judger = which.__judger; if (judger && !judger.run(this)) return void 0;`
Value Entity::next_frame_judge(const Value& nf) {
  Expression<Entity>* const judger = loader::judger_of(nf);
  if (judger == nullptr) return Value();
  return Value(judger->run(*this));
}

Value Entity::get_next_frame(const Value& which) {
  const Array* arr = as_array(which);
  if (arr != nullptr) {
    const std::size_t l = arr->size();
    std::vector<Value> remains;
    for (std::size_t i = 0; i < l; ++i) {
      const Value nf = arr->at(i);
      if (!truthy(nf)) continue;
      if (!has_next_frame_judge(nf)) {
        remains.push_back(nf);
        continue;
      }
      const Value f = get_next_frame(nf);
      if (!nullish(f)) return f;
    }
    Array remains_arr(remains);
    (*world().lfw().mt()).mark = u"gnf_0";
    const Value next = (*world().lfw().mt()).pick_value(Value(std::make_shared<Array>(remains_arr)));
    if (nullish(next)) return Value();
    return get_next_frame(next);
  }
  const Value id_value = field_or(which, u"id");
  const Value use_hp = field_or(which, u"hp");
  const Value use_mp = field_or(which, u"mp");
  const Value mp_mode = field_or(which, u"mp_mode");
  if (has_next_frame_judge(which) && !truthy(next_frame_judge(which))) return Value();
  Value found_frame;
  if (truthy(id_value)) {
    (*world().lfw().mt()).mark = u"gnf_1";
    found_frame = find_frame_by_id((*world().lfw().mt()).pick_value(id_value));
    if (nullish(found_frame)) return Value();
  }
  if (!truthy(world().dataset.get(u"infinity_mp")) && truthy(found_frame)) {
    // `this.frame.next === which` compares against the entity's **current** frame, not
    // the frame the lookup just found.
    const Value frame_next = field_or(frame, u"next");
    const Value hit_d = field_or(field_or(found_frame, u"hit"), u"d");
    const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
    const Value fallback_frame =
        or_nullish(hit_d, auto_frame != nullptr ? *auto_frame : Value());
    if (same_ref(frame_next, which)) {
      // 用 next 进入此动作：负数表示消耗，无视正数。消耗完毕跳至按下防御键的指定跳转动作
      if (truthy(use_mp) && _mp < to_number(use_mp)) return get_next_frame(fallback_frame);
      if (truthy(use_hp) && _hp <= to_number(use_hp)) return get_next_frame(fallback_frame);
    } else {
      if (truthy(use_mp) && _mp < to_number(use_mp) && !equals(mp_mode, Value(1.0)))
        return Value();
      if (truthy(use_hp) && _hp <= to_number(use_hp)) return Value();
    }
  }
  Value w;
  if (is_str(which)) {
    Object o;
    o.set(u"id", which);
    w = Value(std::make_shared<Object>(o));
  } else {
    w = which;
  }
  Object result;
  result.set(u"frame", found_frame);
  result.set(u"which", w);
  return Value(std::make_shared<Object>(result));
}

// --- holding / catching relations ---------------------------------------------

void Entity::follow_bearer() {
  // TS destructures `const { bearer } = this`, so the nulling further down only clears
  // the *member*: the rest of the body keeps reading the snapshot.
  Entity* const bearer_src = bearer;
  if (bearer_src == nullptr) return;
  set_team(bearer_src->team());
  if (_hp <= 0 && bearer_src != nullptr) {
    drop_holding();
    return;
  }
  const Value wp_a = field_or(bearer_src->frame, u"wpoint");
  const double cx_a = to_number(field_or(bearer_src->frame, u"centerx"));
  const double cy_a = to_number(field_or(bearer_src->frame, u"centery"));
  if (equals(field_or(wp_a, u"kind"), Value(static_cast<double>(WpointKind::Drop)))) {
    bearer_src->drop_holding();
    (*world().lfw().mt()).mark = u"dh_v";
    const double vy = 3;
    MersenneTwister& mt = (*world().lfw().mt());
    const double vx = mt.range(-10, 10) / 10;
    const double vz = mt.range(-10, 10) / 20;
    set_velocity(Value(vx), Value(vy), Value(vz));
    return;
  }
  const Value weaponact = field_or(wp_a, u"weaponact");
  if (!strict_equals(weaponact, field_or(frame, u"id"))) {
    // fallback=true 用于 还原wpoint丢失的情况
    enter_frame_by_id(weaponact, true);
  }
  const Value wp_b = field_or(frame, u"wpoint");
  const double cx_b = to_number(field_or(frame, u"centerx"));
  const double cy_b = to_number(field_or(frame, u"centery"));
  const double weight = truthy(field_or(base_of(_data), u"weight"))
                            ? to_number(field_or(base_of(_data), u"weight"))
                            : 1;
  const Value dvx = field_or(wp_a, u"dvx");
  const Value dvy = field_or(wp_a, u"dvy");
  const Value dvz = field_or(wp_a, u"dvz");
  const double x = bearer_src->position.x;
  const double y = bearer_src->position.y;
  const double z = bearer_src->position.z;
  facing = bearer_src->facing;
  const double wa_x = num_of(field_or(wp_a, u"x"));
  const double wa_y = num_of(field_or(wp_a, u"y"));
  const double wa_z = num_of(field_or(wp_a, u"z"));
  const double wb_x = num_of(field_or(wp_b, u"x"));
  const double wb_y = num_of(field_or(wp_b, u"y"));
  const double wb_z = num_of(field_or(wp_b, u"z"));
  if (truthy(field_or(wp_a, u"kind"))) {
    prev_position = bearer_src->position;
    set_position(Value(x + facing * (wa_x - cx_a + cx_b - wb_x)),
                 Value(y + cy_a - wa_y - cy_b + wb_y), Value(z + wa_z - wb_z));
  } else {
    set_position(Value(x + facing * (wa_x - cx_a)), Value(y + cy_a - wa_y),
                 Value(z + wa_z));
  }
  if (!std::holds_alternative<std::monostate>(dvx) ||
      !std::holds_alternative<std::monostate>(dvy) ||
      !std::holds_alternative<std::monostate>(dvz)) {
    bearer_src->holding = nullptr;
    bearer = nullptr;
    dropping = false;
    const double fvx = truthy(dvx) ? to_number(dvx) * to_number(dataset(u"wvx_f")) : 0;
    const double fvy = truthy(dvy) ? to_number(dvy) * to_number(dataset(u"wvy_f")) : 0;
    const double fvz = truthy(dvz) ? to_number(dvz) * to_number(dataset(u"wvz_f")) : 0;
    const Value nf = find_align_frame(
        frame_id_value(frame), field_or(field_or(_data, u"indexes"), u"on_hands"),
        field_or(field_or(_data, u"indexes"), u"throwings"));
    prev_position = position;
    set_position(Value(round(x + facing * (wa_x - cx_a))),
                 Value(round(y + cy_a - wa_y)), Value(round(z + wa_z)));
    const double vz = bearer_src->ctrl() != nullptr
                          ? static_cast<double>(bearer_src->ctrl()->UD()) * fvz
                          : 0;
    const double dvx_w = fvx / weight;
    const double dvy_w = fvy / weight;
    const double vx = (dvx_w - abs(vz / 2)) * facing;
    set_velocity(Value(vx), Value(dvy_w), Value(vz));
    enter_frame(nf);
    return;
  }
}

void Entity::follow_catcher() {
  Entity* a = catcher;
  Entity* b = this;
  if (a == nullptr) return;
  const Value ac = field_or(a->frame, u"cpoint");
  if (!truthy(ac)) return;
  const double afx = to_number(field_or(a->frame, u"centerx"));
  const double afy = to_number(field_or(a->frame, u"centery"));
  const double tx = num_of(field_or(ac, u"throwvx"));
  const double ty = num_of(field_or(ac, u"throwvy"));
  const double tz = num_of(field_or(ac, u"throwvz"));
  const double bfx = to_number(field_or(b->frame, u"centerx"));
  const double bfy = to_number(field_or(b->frame, u"centery"));
  const Value bc = field_or(b->frame, u"cpoint");
  const double ax = a->position.x;
  const double ay = a->position.y;
  const double az = a->position.z;
  const double a_face = a->facing;
  const double acx = num_of(field_or(ac, u"x"));
  const double acy = num_of(field_or(ac, u"y"));
  const double acz = num_of(field_or(ac, u"z"));
  if (truthy(Value(tx)) || truthy(Value(ty)) || truthy(Value(tz))) {
    const double vx = tx * to_number(dataset(u"tvx_f")) * a_face;
    const double vy = ty * to_number(dataset(u"tvy_f"));
    const double vz = tz * to_number(dataset(u"tvz_f")) *
                      static_cast<double>(a->ctrl() != nullptr ? a->ctrl()->UD() : 0);
    set_velocity(Value(vx), Value(vy), Value(vz));
    set_position(Value((2 * vx) + ax - a_face * (afx - acx)),
                 Value((2 * vy) + ay + afy - acy), Value((2 * vz) + az + acz));
    return;
  }
  const double b_face = b->facing;
  const double bcx = num_of(field_or(bc, u"x"));
  const double bcy = num_of(field_or(bc, u"y"));
  const double bcz = num_of(field_or(bc, u"z"));
  set_position(Value(ax - a_face * (afx - acx) + b_face * (bfx - bcx)),
               Value(ay + afy - acy + bcy - bfy), Value(az + acz - bcz));
}

void Entity::drop_holding() {
  if (holding == nullptr) return;
  (*world().lfw().mt()).mark = u"dh_1";
  Entity* held = holding;
  held->bearer = nullptr;
  holding = nullptr;
  held->dropping = true;
  const Value on_hands = field_or(field_or(held->data(), u"indexes"), u"on_hands");
  const Value in_the_skys = field_or(field_or(held->data(), u"indexes"), u"in_the_skys");
  Value nf = held->find_align_frame(frame_id_value(held->frame), on_hands, in_the_skys);
  if (!truthy(nf)) {
    Object o;
    o.set(u"id", Value(std::u16string(frame_id::kAuto)));
    nf = Value(std::make_shared<Object>(o));
  }
  held->enter_frame(nf);
  held->set_position(Value(held->position.x), Value(held->position.y),
                     Value(held->position.z));
  held->set_team(team());
  // 避免掉落的武器能被相同攻击对象立刻打中
  // TS `collision_clone(v)` also mints a fresh collision id from the collision
  // factory; nothing on the v_rest paths reads `Collision::id` (they key on `aid`
  // and read `itr` / `rest`), so the port copies the record as-is (DESIGN §52.4).
  for (const auto& kv : vrests) {
    collision::Collision clone = kv.second;
    held->add_v_rest(clone);
  }
}

void Entity::pick(Entity& weapon) {
  if (weapon.bearer != nullptr) return;
  if (holding != nullptr) return;
  holding = &weapon;
  weapon.bearer = this;
  weapon.dropping = false;
  weapon.follow_bearer();
  std::shared_ptr<Summary> s = summary_mgr().get(id);
  s->set_picking_sum(Value(to_number(s->picking_sum()) + 1));
  if (!defines::is_independent(team())) {
    std::shared_ptr<Summary> t = summary_mgr().get(team());
    t->set_picking_sum(Value(to_number(t->picking_sum()) + 1));
  }
}

void Entity::transform(const Value& data) {
  if (ctrl_ == nullptr || !ctrl_->is_human()) {
    controller::BaseController* c = world().lfw().create_ctrl(to_string(field_or(data, u"id")), ctrl_ != nullptr ? ctrl_->player_id : std::u16string());
    set_ctrl(c);
  }
  const Value prev = _data;
  _data = data;
  reset_armor();
  callbacks.call(u"on_data_changed", {_data, prev, ref()});
}

bool Entity::transfrom_to_another(const std::optional<Value>& data) {
  if (data.has_value()) {
    Array a;
    a.push_back(_data);
    a.push_back(*data);
    transforms = Value(std::make_shared<Array>(a));
  }
  const Array* datas = as_array(transforms);
  if (datas == nullptr || datas->empty()) return false;
  const double curr_idx = transform_index;
  const size_t len = datas->size();
  const double next_idx_f = std::fmod(curr_idx + 1, static_cast<double>(len));
  const size_t next_idx = static_cast<size_t>(next_idx_f);
  const Value next_data = datas->at(next_idx);
  if (!truthy(next_data)) return false;
  transform_index = next_idx_f;
  transform(next_data);
  if (next_idx == 0) enter_frame_by_id(Value(std::u16string(u"245")), true);
  if (!copies.empty()) {
    std::vector<std::u16string> gones;
    for (const std::u16string& cid : copies) {
      Entity* copy = world().find_entity(cid);
      if (copy == nullptr || !truthy(Value(copy->mounted()))) {
        gones.push_back(cid);
      } else {
        copy->transform(next_data);
      }
    }
    for (const std::u16string& gone_id : gones) {
      for (std::size_t i = 0; i < copies.size(); ++i) {
        if (copies[i] == gone_id) {
          copies.erase(copies.begin() + static_cast<std::ptrdiff_t>(i));
          break;
        }
      }
    }
  }
  return true;
}

// --- snapshot ----------------------------------------------------------------

// `to_snapshot(nums, strs)`: every slot is written, so an array allocated with
// `NUM_SLOTS` / `STR_SLOTS` ends up hole-free on both sides.  The nullable stat
// slots keep the TS spelling (`?? NaN`), while `MP_MAX` / `HP_MAX` are written as
// stored — `null` / `undefined` stay nullish instead of folding into `NaN`.
void Entity::to_snapshot(std::vector<Value>& nums, std::vector<std::u16string>& strs) const {
  using entity::NSlot;
  using entity::SSlot;
  const auto N = [&nums](NSlot slot) -> Value& {
    return nums[static_cast<std::size_t>(slot)];
  };
  const auto S = [&strs](SSlot slot) -> std::u16string& {
    return strs[static_cast<std::size_t>(slot)];
  };

  N(NSlot::WAIT) = Value(wait);
  N(NSlot::VARIANT) = Value(variant);
  N(NSlot::TRANSFORM_INDEX) = Value(transform_index);
  N(NSlot::LIFETIME) = Value(_lifetime);
  N(NSlot::SPAWN_TIME) = Value(_spawn_time);

  N(NSlot::RESERVE) = Value(_reserve);
  N(NSlot::MOUNTED) = Value(_mounted);
  N(NSlot::GHOSTED) = Value(_ghosted);

  N(NSlot::RESTING) = Value(_resting);
  N(NSlot::RESTING_MAX) = or_nan(_resting_max);
  N(NSlot::TOUGHNESS) = Value(_toughness);
  N(NSlot::TOUGHNESS_MAX) = Value(_toughness_max);
  N(NSlot::TOUGHNESS_R_VALUE) = Value(_toughness_r_value);
  N(NSlot::TOUGHNESS_RESTING) = Value(_toughness_resting);
  N(NSlot::TOUGHNESS_RESTING_MAX) = Value(_toughness_resting_max);

  N(NSlot::FALL_VALUE) = Value(_fall_value);
  N(NSlot::FALL_VALUE_MAX) = or_nan(_fall_value_max);
  N(NSlot::FALL_R_VALUE) = Value(_fall_r_value);
  N(NSlot::DEFEND_VALUE) = Value(_defend_value);
  N(NSlot::DEFEND_VALUE_MAX) = or_nan(_defend_value_max);
  N(NSlot::DEFEND_R_VALUE) = Value(_defend_r_value);
  N(NSlot::DEFEND_RATIO) = or_nan(_defend_ratio);

  N(NSlot::FALLINJURY) = Value(fallinjury);
  N(NSlot::THROWINJURY) = Value(throwinjury);
  N(NSlot::FACING) = Value(facing);

  N(NSlot::POS_X) = Value(position.x);
  N(NSlot::POS_Y) = Value(position.y);
  N(NSlot::POS_Z) = Value(position.z);
  N(NSlot::PREV_POS_X) = Value(prev_position.x);
  N(NSlot::PREV_POS_Y) = Value(prev_position.y);
  N(NSlot::PREV_POS_Z) = Value(prev_position.z);
  N(NSlot::VEL_X) = Value(velocity.x);
  N(NSlot::VEL_Y) = Value(velocity.y);
  N(NSlot::VEL_Z) = Value(velocity.z);
  N(NSlot::PREV_VEL_X) = Value(prev_velocity.x);
  N(NSlot::PREV_VEL_Y) = Value(prev_velocity.y);
  N(NSlot::PREV_VEL_Z) = Value(prev_velocity.z);

  N(NSlot::MP) = Value(_mp);
  N(NSlot::MP_MAX) = _mp_max.has_value() ? Value(*_mp_max) : Value(NullTag{});
  N(NSlot::HP) = Value(_hp);
  N(NSlot::HP_R) = Value(_hp_r);
  N(NSlot::HP_MAX) = _hp_max.has_value() ? Value(*_hp_max) : Value(NullTag{});

  N(NSlot::AREST) = Value(_arest);
  N(NSlot::MOTIONLESS) = Value(motionless);
  N(NSlot::SHAKING) = Value(shaking);

  N(NSlot::CATCH_TIME) = Value(_catch_time);
  N(NSlot::CATCH_TIME_MAX) = or_nan(_catch_time_max);
  N(NSlot::DISMISS_TIME) = or_nan(dismiss_time);

  N(NSlot::INVISIBLE_DURATION) = Value(_invisible);
  N(NSlot::INVULNERABLE_DURATION) = Value(_invulnerable);
  N(NSlot::BLINKING_DURATION) = Value(_blinking);

  N(NSlot::JUMP_X) = Value(jumping.x);
  N(NSlot::JUMP_Y) = Value(jumping.y);
  N(NSlot::JUMP_Z) = Value(jumping.z);
  N(NSlot::JUMP_T) = Value(jumping.t);

  N(NSlot::GROUND_Y) = Value(_ground_y);
  N(NSlot::PREV_GROUND_Y) = Value(_prev_ground_y);

  N(NSlot::AABB_MIN_X) = Value(aabb_min_x);
  N(NSlot::AABB_MAX_X) = Value(aabb_max_x);
  N(NSlot::AABB_MIN_Z) = Value(aabb_min_z);
  N(NSlot::AABB_MAX_Z) = Value(aabb_max_z);
  N(NSlot::L_LEN) = Value(l_len);
  N(NSlot::R_LEN) = Value(r_len);

  // `this.stat_bar ?? NaN` — `stat_bar` is a plain number in the port.
  N(NSlot::STAT_BAR_TYPE) = Value(stat_bar);

  write_tick(_hp_r_tick, nums, NSlot::HP_R_TICK_VALUE);
  write_tick(_mp_r_tick, nums, NSlot::MP_R_TICK_VALUE);
  write_tick(_resting_tick, nums, NSlot::RESTING_TICK_VALUE);
  write_tick(_toughness_r_tick, nums, NSlot::TOUGHNESS_R_TICK_VALUE);
  write_tick(_fall_r_tick, nums, NSlot::FALL_R_TICK_VALUE);
  write_tick(_defend_r_tick, nums, NSlot::DEFEND_R_TICK_VALUE);

  N(NSlot::BOUNCED) = Value(bounced ? 1.0 : 0.0);
  // TS 直接赋值（`nums[...] = this.lying_a_count`），不走 `to_number`——它可能是字符串。
  N(NSlot::LYING_A_COUNT) = lying_a_count;
  N(NSlot::LYING_D_COUNT) = lying_d_count;
  N(NSlot::LYING_C_COUNT) = lying_c_count;
  N(NSlot::DROP_HURTED) = Value(drop_hurted ? 1.0 : 0.0);
  N(NSlot::DROPPING) = Value(dropping ? 1.0 : 0.0);
  N(NSlot::IS_ON_GROUND) = Value(is_on_ground ? 1.0 : 0.0);
  N(NSlot::NAME_VISIBLE) = Value(name_visible);
  N(NSlot::WAKEUP_INVULN) = Value(wakeup_invuln);
  N(NSlot::DEAD_GONE) = Value(dead_gone);
  N(NSlot::CTRL_VISIBLE) = Value(ctrl_visible);

  S(SSlot::ID) = id;
  S(SSlot::DATA_ID) = to_string(field_or(data(), u"id"));
  S(SSlot::FRAME_ID) = frame_id_of(*this);
  S(SSlot::PREV_FRAME_ID) = frame_id_value(_prev_frame);
  S(SSlot::LANDING_FRAME_ID) =
      nullish(_landing_frame) ? std::u16string() : frame_id_value(_landing_frame);
  S(SSlot::CATCHING_ID) = catching != nullptr ? catching->id : std::u16string();
  S(SSlot::CATCHER_ID) = catcher != nullptr ? catcher->id : std::u16string();
  S(SSlot::BEARER_ID) = bearer != nullptr ? bearer->id : std::u16string();
  S(SSlot::HOLDING_ID) = holding != nullptr ? holding->id : std::u16string();
  S(SSlot::TEAM) = _team;
  S(SSlot::NAME) = nullish(_name) ? std::u16string() : to_string(_name);
  S(SSlot::AFTER_BLINK) = _after_blink.has_value() ? *_after_blink : std::u16string();
  S(SSlot::DISMISS_DATA_ID) =
      nullish(dismiss_data) ? std::u16string() : to_string(field_or(dismiss_data, u"id"));
  const Array* tr = as_array(transforms);
  S(SSlot::TRANSFORM_0_ID) = tr != nullptr && tr->size() > 0
                                 ? frame_id_value(tr->at(0))
                                 : std::u16string();
  S(SSlot::TRANSFORM_1_ID) = tr != nullptr && tr->size() > 1
                                 ? frame_id_value(tr->at(1))
                                 : std::u16string();
  std::u16string copy_list;
  for (const std::u16string& copy_id : copies) copy_list += copy_id + u",";
  // `s.slice(0, -1)` drops the trailing comma; an empty set keeps the empty string.
  S(SSlot::COPIES) = copies.empty() ? std::u16string() : copy_list.substr(0, copy_list.size() - 1);
  S(SSlot::DEAD_JOIN) = truthy(dead_join) ? json_stringify(dead_join).value_or(u"")
                                          : std::u16string();
}

// `read_snapshot(nums, strs)`: no coercion on the way in — a slot backed by a plain
// `double` converts through `to_number` (a non-number poke is outside the port's
// model), while the nullable slots keep `null`.
void Entity::read_snapshot(const std::vector<Value>& nums,
                           const std::vector<std::u16string>& strs) {
  using entity::NSlot;
  using entity::SSlot;
  const auto N = [&nums](NSlot slot) -> const Value& {
    return nums[static_cast<std::size_t>(slot)];
  };
  const auto S = [&strs](SSlot slot) -> const std::u16string& {
    return strs[static_cast<std::size_t>(slot)];
  };

  wait = to_number(N(NSlot::WAIT));
  variant = to_number(N(NSlot::VARIANT));
  transform_index = to_number(N(NSlot::TRANSFORM_INDEX));
  _lifetime = to_number(N(NSlot::LIFETIME));
  _spawn_time = to_number(N(NSlot::SPAWN_TIME));

  _reserve = to_number(N(NSlot::RESERVE));
  _mounted = to_number(N(NSlot::MOUNTED));
  _ghosted = to_number(N(NSlot::GHOSTED));

  _resting = to_number(N(NSlot::RESTING));
  _resting_max = opt_num(entity::num_or_null(N(NSlot::RESTING_MAX)));
  _toughness = to_number(N(NSlot::TOUGHNESS));
  _toughness_max = to_number(N(NSlot::TOUGHNESS_MAX));
  _toughness_r_value = to_number(N(NSlot::TOUGHNESS_R_VALUE));
  _toughness_resting = to_number(N(NSlot::TOUGHNESS_RESTING));
  _toughness_resting_max = to_number(N(NSlot::TOUGHNESS_RESTING_MAX));

  _fall_value = to_number(N(NSlot::FALL_VALUE));
  _fall_value_max = opt_num(entity::num_or_null(N(NSlot::FALL_VALUE_MAX)));
  _fall_r_value = to_number(N(NSlot::FALL_R_VALUE));
  _defend_value = to_number(N(NSlot::DEFEND_VALUE));
  _defend_value_max = opt_num(entity::num_or_null(N(NSlot::DEFEND_VALUE_MAX)));
  _defend_r_value = to_number(N(NSlot::DEFEND_R_VALUE));
  _defend_ratio = opt_num(entity::num_or_null(N(NSlot::DEFEND_RATIO)));

  fallinjury = to_number(N(NSlot::FALLINJURY));
  throwinjury = to_number(N(NSlot::THROWINJURY));
  facing = to_number(N(NSlot::FACING));

  position.set(to_number(N(NSlot::POS_X)), to_number(N(NSlot::POS_Y)),
               to_number(N(NSlot::POS_Z)));
  prev_position.set(to_number(N(NSlot::PREV_POS_X)), to_number(N(NSlot::PREV_POS_Y)),
                    to_number(N(NSlot::PREV_POS_Z)));
  velocity.set(to_number(N(NSlot::VEL_X)), to_number(N(NSlot::VEL_Y)),
               to_number(N(NSlot::VEL_Z)));
  prev_velocity.set(to_number(N(NSlot::PREV_VEL_X)), to_number(N(NSlot::PREV_VEL_Y)),
                    to_number(N(NSlot::PREV_VEL_Z)));

  _mp = to_number(N(NSlot::MP));
  _mp_max = opt_num(N(NSlot::MP_MAX));
  _hp = to_number(N(NSlot::HP));
  _hp_r = to_number(N(NSlot::HP_R));
  _hp_max = opt_num(N(NSlot::HP_MAX));

  _arest = to_number(N(NSlot::AREST));
  motionless = to_number(N(NSlot::MOTIONLESS));
  shaking = to_number(N(NSlot::SHAKING));

  _catch_time = to_number(N(NSlot::CATCH_TIME));
  _catch_time_max = opt_num(entity::num_or_null(N(NSlot::CATCH_TIME_MAX)));
  dismiss_time = opt_num(entity::num_or_null(N(NSlot::DISMISS_TIME)));

  _invisible = to_number(N(NSlot::INVISIBLE_DURATION));
  _invulnerable = to_number(N(NSlot::INVULNERABLE_DURATION));
  _blinking = to_number(N(NSlot::BLINKING_DURATION));

  jumping.x = to_number(N(NSlot::JUMP_X));
  jumping.y = to_number(N(NSlot::JUMP_Y));
  jumping.z = to_number(N(NSlot::JUMP_Z));
  jumping.t = to_number(N(NSlot::JUMP_T));

  _ground_y = to_number(N(NSlot::GROUND_Y));
  _prev_ground_y = to_number(N(NSlot::PREV_GROUND_Y));

  aabb_min_x = to_number(N(NSlot::AABB_MIN_X));
  aabb_max_x = to_number(N(NSlot::AABB_MAX_X));
  aabb_min_z = to_number(N(NSlot::AABB_MIN_Z));
  aabb_max_z = to_number(N(NSlot::AABB_MAX_Z));
  l_len = to_number(N(NSlot::L_LEN));
  r_len = to_number(N(NSlot::R_LEN));
  stat_bar = to_number(N(NSlot::STAT_BAR_TYPE));

  read_tick(_hp_r_tick, nums, NSlot::HP_R_TICK_VALUE);
  read_tick(_mp_r_tick, nums, NSlot::MP_R_TICK_VALUE);
  read_tick(_resting_tick, nums, NSlot::RESTING_TICK_VALUE);
  read_tick(_toughness_r_tick, nums, NSlot::TOUGHNESS_R_TICK_VALUE);
  read_tick(_fall_r_tick, nums, NSlot::FALL_R_TICK_VALUE);
  read_tick(_defend_r_tick, nums, NSlot::DEFEND_R_TICK_VALUE);

  bounced = not_zero(N(NSlot::BOUNCED));
  lying_a_count = N(NSlot::LYING_A_COUNT);
  lying_d_count = N(NSlot::LYING_D_COUNT);
  lying_c_count = N(NSlot::LYING_C_COUNT);
  drop_hurted = not_zero(N(NSlot::DROP_HURTED));
  dropping = not_zero(N(NSlot::DROPPING));
  is_on_ground = not_zero(N(NSlot::IS_ON_GROUND));
  name_visible = to_number(N(NSlot::NAME_VISIBLE));
  wakeup_invuln = to_number(N(NSlot::WAKEUP_INVULN));
  dead_gone = to_number(N(NSlot::DEAD_GONE));
  ctrl_visible = to_number(N(NSlot::CTRL_VISIBLE));

  id = S(SSlot::ID);
  const Value data = world().lfw().datas_find(Value(std::u16string(S(SSlot::DATA_ID))));
  if (truthy(data)) _data = data;
  const Value next_frame = find_frame_by_id(Value(S(SSlot::FRAME_ID)));
  if (!nullish(next_frame)) frame = next_frame;
  const Value next_prev = find_frame_by_id(Value(S(SSlot::PREV_FRAME_ID)));
  if (!nullish(next_prev)) _prev_frame = next_prev;
  if (S(SSlot::LANDING_FRAME_ID).empty()) {
    _landing_frame = Value(NullTag{});
  } else {
    const Value landing = find_frame_by_id(Value(S(SSlot::LANDING_FRAME_ID)));
    _landing_frame = nullish(landing) ? Value(NullTag{}) : landing;
  }
  catching = world().find_entity(S(SSlot::CATCHING_ID));
  catcher = world().find_entity(S(SSlot::CATCHER_ID));
  bearer = world().find_entity(S(SSlot::BEARER_ID));
  holding = world().find_entity(S(SSlot::HOLDING_ID));
  _team = S(SSlot::TEAM);
  _name = S(SSlot::NAME).empty() ? Value(NullTag{}) : Value(S(SSlot::NAME));
  _after_blink = S(SSlot::AFTER_BLINK).empty()
                     ? std::nullopt
                     : std::optional<std::u16string>(S(SSlot::AFTER_BLINK));
  if (!S(SSlot::DISMISS_DATA_ID).empty()) {
    const Value found = world().lfw().datas_find(Value(std::u16string(S(SSlot::DISMISS_DATA_ID))));
    dismiss_data = nullish(found) ? Value(NullTag{}) : found;
  } else {
    dismiss_data = Value(NullTag{});
  }

  const std::u16string& t0 = S(SSlot::TRANSFORM_0_ID);
  const std::u16string& t1 = S(SSlot::TRANSFORM_1_ID);
  if (!t0.empty() && !t1.empty()) {
    const Value d0 = world().lfw().datas_find(Value(std::u16string(t0)));
    const Value d1 = world().lfw().datas_find(Value(std::u16string(t1)));
    if (truthy(d0) && truthy(d1)) {
      auto arr = std::make_shared<Array>();
      arr->push_back(d0);
      arr->push_back(d1);
      transforms = Value(arr);
    } else {
      transforms = Value(NullTag{});
    }
  } else {
    transforms = Value(NullTag{});
  }

  copies.clear();
  if (!S(SSlot::COPIES).empty()) {
    std::u16string cur;
    const std::u16string& all = S(SSlot::COPIES);
    for (std::size_t i = 0; i <= all.size(); ++i) {
      if (i == all.size() || all[i] == u',') {
        add_copy(cur);
        cur.clear();
      } else {
        cur.push_back(all[i]);
      }
    }
  }
  // `JSON.parse` throws in TS on malformed text; the port keeps the current value.
  if (!S(SSlot::DEAD_JOIN).empty()) {
    const std::optional<Value> parsed = json_parse(S(SSlot::DEAD_JOIN));
    if (parsed.has_value()) dead_join = *parsed;
  } else {
    dead_join = Value(NullTag{});
  }
}

bool Entity::add_copy(const std::u16string& copy_id) {
  for (const std::u16string& existing : copies) {
    if (existing == copy_id) return false;
  }
  copies.push_back(copy_id);
  return true;
}

// --- opoint spawning -----------------------------------------------------------

// `(holder.__gen_x ? holder.__gen_x.get(emitter) : holder.x)`
Value Entity::gen_or(const Value& holder, const std::u16string& kind,
                     const Value& fallback) const {
  const std::optional<Value> gen = world().gen_field(holder, kind, const_cast<Entity&>(*this));
  return gen.has_value() ? *gen : fallback;
}

namespace {
// `Defines.NEXT_FRAME_AUTO`
Value auto_frame_value() {
  const Value* v = defines::find(u"Defines.NEXT_FRAME_AUTO");
  return v != nullptr ? *v : Value();
}
}

Entity* Entity::spawn(const Value& opoint) {
  return spawn(opoint, Vector3{}, facing);
}

Entity* Entity::spawn(const Value& opoint, const Vector3& offset_velocity, double facing_value) {
  if (truthy(field_or(opoint, u"unimportant")) && world().entity_count() > 355) return nullptr;
  (*world().lfw().mt()).mark = u"se_1";
  const Value oid = (*world().lfw().mt()).pick_value(field_or(opoint, u"oid"));
  if (!truthy(oid)) return nullptr;
  const Value data = world().lfw().datas_find(Value(std::u16string(to_string(oid))));
  if (std::holds_alternative<std::monostate>(data)) return nullptr;
  // TS：`this.lfw.factory.create_entity_with_bot("", this.world, data)` —— **不是**
  // `create_entity`：`with_bot` 会按 data.id 建控制器（球 → `BallController`、斗士 → bot）。
  // 少了这一步，opoint 生成出来的球 `ctrl == nullptr` ⇒ `World::update` 里
  // `is_ball_ctrl(ctrl)` 恒假 ⇒ `update_lookup` 从不跑 ⇒ `chasing` 永远空
  // ⇒ `BallController::update_chasing` 只走「Hover 自己出生点」那条分支（D>A 的球不追人）。
  Entity* entity = world().lfw().create_entity_with_bot(u"", world(), data);
  if (entity == nullptr) return nullptr;
  entity->on_spawn(*this, opoint, offset_velocity, facing_value).attach(field_or(opoint, u"ghost"));
  if (strict_equals(field_or(entity->data(), u"id"), field_or(_data, u"id"))) {
    add_copy(entity->id);
  }
  entity->as_key_role(Value(false));
  // TS `collision_clone(v)` 会向碰撞工厂要一个新 id；端口按 9i 的约定原样复制记录。
  for (const auto& kv : vrests) entity->add_v_rest(kv.second);
  return entity;
}

Entity& Entity::on_spawn(Entity& emitter, const Value& opoint, const Vector3& offset_velocity,
                         double facing_value) {
  const Value emitter_frame = emitter.frame;
  if (equals(emitter.state(), Value(static_cast<double>(StateEnum::Ball_Rebounding)))) {
    std::u16string attacker_id = emitter.id;
    Value attacker_team = Value(emitter.team());
    if (emitter.lastest_collided.has_value()) {
      attacker_id = emitter.lastest_collided->attacker.id;
      attacker_team = emitter.lastest_collided->attacker.team;
    }
    emitters.clear();
    emitters.push_back(attacker_id);
    set_team(to_string(attacker_team));
    facing = emitter.facing;
  } else {
    emitters.insert(emitters.end(), emitter.emitters.begin(), emitter.emitters.end());
    emitters.push_back(emitter.id);
    set_team(emitter.team());
    facing = emitter.facing;
  }

  double pos_x = emitter.position.x;
  double pos_y = emitter.position.y;
  const double pos_z = emitter.position.z;
  const double opoint_y = num_of(or_nullish(emitter.gen_or(opoint, u"__gen_y", field_or(opoint, u"y")),
                                            Value(0.0)));
  const double opoint_x = num_of(or_nullish(emitter.gen_or(opoint, u"__gen_x", field_or(opoint, u"x")),
                                            Value(0.0)));
  const double opoint_z =
      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_z", field_or(opoint, u"z")), Value(2.0)));

  if (equals(field_or(opoint, u"pos_type"), Value(1.0))) {
    pos_y = pos_y - opoint_y;
    pos_x = pos_x + emitter.facing * opoint_x;
  } else {
    pos_y = pos_y + to_number(field_or(emitter_frame, u"centery")) - opoint_y;
    pos_x = pos_x - emitter.facing * (to_number(field_or(emitter_frame, u"centerx")) - opoint_x);
  }
  prev_position = emitter.position;
  set_position(Value(pos_x), Value(pos_y), Value(pos_z + opoint_z));

  const Value result = get_next_frame(field_or(opoint, u"action"));
  const Value which = field_or(result, u"which");
  const Value nf_facing =
      emitter.gen_or(which, u"__gen_facing", field_or(which, u"facing"));
  facing_value = truthy(nf_facing) ? handle_facing_flag(nf_facing) : emitter.facing;

  if (truthy(result)) {
    enter_frame(which);
  } else {
    enter_frame(auto_frame_value());
  }

  const Value speedz_field = field_or(opoint, u"speedz");
  // `opoint.speedz ?? (z_launch ? DEFAULT_OPOINT_SPEED_Z : 0)` —— `z_launch` 在下面按生成物
  // 首帧状态算出来，这里先用占位值，真正的兜底在 `vz` 那一行。
  const bool has_speedz = !std::holds_alternative<std::monostate>(speedz_field) &&
                          !std::holds_alternative<NullTag>(speedz_field);
  const double speedz_explicit = to_number(has_speedz ? speedz_field : Value(0.0));
  double o_dvx =
      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_dvx", field_or(opoint, u"dvx")), Value(0.0)));
  double o_dvy =
      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_dvy", field_or(opoint, u"dvy")), Value(0.0)));
  const double o_dvz =
      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_dvz", field_or(opoint, u"dvz")), Value(0.0)));

  const double weight = this->weight();
  o_dvy = o_dvy / weight;
  const controller::BaseController* ctrl = emitter.ctrl();
  const double ud =
      entity::is_fighter_data(emitter.data()) && ctrl != nullptr ? static_cast<double>(ctrl->UD())
                                                                : 0.0;

  const Value max_hp = field_or(opoint, u"max_hp");
  if (is_num(max_hp)) {
    const double v = to_number(max_hp);
    set_hp_max(v);
    set_hp_r(v);
    set_hp(v);
  }
  const Value hp_field = field_or(opoint, u"hp");
  if (is_num(hp_field)) {
    const double v = to_number(hp_field);
    set_hp_r(v);
    set_hp(v);
  }
  const Value max_mp = field_or(opoint, u"max_mp");
  if (is_num(max_mp)) {
    const double v = to_number(max_mp);
    set_mp_max(v);
    set_mp(v);
  }
  const Value mp_field = field_or(opoint, u"mp");
  if (is_num(mp_field)) set_mp(to_number(mp_field));

  const double dvy_now = num_of(dvy());
  const double dvz_now = num_of(dvz());
  const double dvx_now = num_of(dvx());
  const Value vxm = field_or(frame, u"vxm");
  const Value vym = field_or(frame, u"vym");
  const Value vzm = field_or(frame, u"vzm");
  const double acc_x = num_of(field_or(frame, u"acc_x"));
  const double acc_y = num_of(field_or(frame, u"acc_y"));
  const double acc_z = num_of(field_or(frame, u"acc_z"));

  const Value result_state = field_or(field_or(result, u"frame"), u"state");
  const bool z_disabled = equals(result_state, Value(static_cast<double>(StateEnum::Normal))) ||
                          equals(result_state, Value(static_cast<double>(StateEnum::Burning)));
  // TS `on_spawn`：`opoint.speedz` 没写时按**生成物首帧**的状态补默认 Z 初速
  // （弹道类才给）。`Entity::on_spawn` 里 `vz += o_speedz * ud` ⇒ 发射时按上下键球会斜飞；
  // 显式写了 `speedz`（含 `0`，如冰片/烟雾/JanChase 尾迹）的不动。
  const bool z_launch =
      equals(result_state, Value(static_cast<double>(StateEnum::Ball_Flying))) ||
      equals(result_state, Value(static_cast<double>(StateEnum::Ball_3006))) ||
      equals(result_state, Value(static_cast<double>(StateEnum::Weapon_Throwing))) ||
      equals(result_state, Value(static_cast<double>(StateEnum::HeavyWeapon_InTheSky)));

  const Value ovx = Value(offset_velocity.x);
  const Value ovy = Value(offset_velocity.y);
  const Value ovz = Value(offset_velocity.z);
  if (o_dvx > 0) o_dvx = o_dvx / weight - std::abs(offset_velocity.z / 2);
  else o_dvx = o_dvx / weight + std::abs(offset_velocity.z / 2);
  double vx = to_number(ovx) + o_dvx * facing_value;
  double vy = to_number(ovy) + o_dvy + dvy_now;
  const double o_speedz =
      has_speedz ? speedz_explicit : (z_launch ? defines::num(u"Defines.DEFAULT_OPOINT_SPEED_Z") : 0.0);
  double vz = z_disabled ? 0 : to_number(ovz) + o_dvz + o_speedz * ud;
  if (equals(vxm, Value(static_cast<double>(SpeedMode::Fixed)))) vx = dvx_now;
  if (equals(vym, Value(static_cast<double>(SpeedMode::Fixed)))) vy = dvy_now;
  if (equals(vzm, Value(static_cast<double>(SpeedMode::Fixed)))) vz = dvz_now;
  if (equals(vxm, Value(static_cast<double>(SpeedMode::Extra))) && acc_x != 0) vx += acc_x;
  if (equals(vym, Value(static_cast<double>(SpeedMode::Extra))) && acc_y != 0) vy += acc_y;
  if (equals(vzm, Value(static_cast<double>(SpeedMode::Extra))) && acc_z != 0) vz += acc_z;

  prev_velocity.x = velocity.x = round_float(vx);
  prev_velocity.y = velocity.y = round_float(vy);
  prev_velocity.z = velocity.z = round_float(vz);

  if (equals(field_or(opoint, u"kind"), Value(static_cast<double>(OpointKind::Pick)))) {
    emitter.drop_holding();
    bearer = &emitter;
    bearer->holding = this;
  }
  motionless = to_number(or_nullish(field_or(opoint, u"motionless"), Value(2.0)));
  return *this;
}

Entity& Entity::attach(const Value& ghost) {
  if (truthy(Value(_mounted))) return *this;
  _spawn_time = world().game_time();
  _mounted = 1;
  _ghosted = truthy(ghost) ? 1 : 0;
  if (truthy(Value(_ghosted))) {
    motionless = 0;
    shaking = 0;
  }
  world().add_entities(*this);

  set_state(field_or(frame, u"state"));

  set_position(Value(position.x), Value(position.y), Value(position.z));
  if (position.y > ground_y()) {
    leave_ground();
  } else {
    is_on_ground = true;
  }
  if (strict_equals(field_or(frame, u"id"), Value(std::u16string(frame_id::kNone)))) {
    enter_frame(auto_frame_value());
  }
  return *this;
}

// ---------------------------------------------------------------------------
// `apply_opoints(opoints)`: per-opoint interval bookkeeping, the `multi` count, the
// `spreading` offset, one `spawn` per count, then the ball-controller `chasing` target
// and the `inherit_speed_*` velocity write.
// ---------------------------------------------------------------------------
// 状态面（切片 4CF）：`apply_opoints(opoints: Value[])` —— `state_base_proxy.cpp` 的
// `ice_piece_opoints()` 给的是一组 opoint，包成 `Value` 数组后走下面那条。
void Entity::apply_opoints(const std::vector<Value>& opoints) {
  std::vector<Value> copy = opoints;
  apply_opoints(Value(std::make_shared<Array>(std::move(copy))));
}

void Entity::apply_opoints(const Value& opoints_value) {
  const Array* list = as_array(opoints_value);
  if (list == nullptr) return;

  for (std::size_t k = 0; k < list->size(); ++k) {
    const Value opoint = list->at(k);
    // `const { interval = 0, interval_id, interval_mode } = opoint` — the default only
    // applies to `undefined`, so the raw field is kept for the tick comparison below.
    const Value interval_field = field_or(opoint, u"interval");
    const Value interval =
        std::holds_alternative<std::monostate>(interval_field) ? Value(0.0) : interval_field;
    const Value interval_id = field_or(opoint, u"interval_id");
    const bool interval_mode_1 = strict_equals(field_or(opoint, u"interval_mode"), Value(1.0));

    std::size_t found = opoints.size();
    for (std::size_t i = 0; i < opoints.size(); ++i) {
      if (strict_equals(field_or(opoints[i].first, u"interval_id"), interval_id)) {
        found = i;
        break;
      }
    }
    if (found != opoints.size() && interval_mode_1) {
      // 已有同 `interval_id` 的记账项：只有「记下的帧号 == 本次的 interval」才继续。
      if (!strict_equals(Value(opoints[found].second), interval_field)) continue;
    } else if (to_number(interval) > 0) {
      opoints.push_back({opoint, 0});
    }

    std::vector<Entity*> enemies;
    std::vector<Entity*> allies;
    Value multi_type = Value();
    double count = 0;
    const Value multi_field = field_or(opoint, u"multi");
    const Value multi =
        std::holds_alternative<std::monostate>(multi_field) ? Value(1.0) : multi_field;
    if (is_num(multi)) {
      count = to_number(multi);
    } else if (truthy(multi)) {
      const Value type = field_or(multi, u"type");
      const Value min_field = field_or(multi, u"min");
      const Value min =
          std::holds_alternative<std::monostate>(min_field) ? Value(0.0) : min_field;
      const Value max_field = field_or(multi, u"max");
      const Value max =
          std::holds_alternative<std::monostate>(max_field) ? Value(355.0) : max_field;
      const Value skip_zero = field_or(multi, u"skip_zero");
      multi_type = type;
      if (strict_equals(type, Value(static_cast<double>(OpointMultiEnum::AccordingEnemies)))) {
        enemies = world().list_entities(u"ef_" + team(), [this](Entity& o) {
          return entity::is_fighter_data(o.data()) && team() != o.team() && o.hp() > 0;
        });
        // TS 的 `if (skip_zero && !enemies.length) break;` 只跳出 switch ⇒ `count` 保持
        // 0、后面的循环一次都不跑。
        if (!(truthy(skip_zero) && enemies.empty())) {
          count = clamp(static_cast<double>(enemies.size()), to_number(min), to_number(max));
        }
      } else if (strict_equals(type,
                               Value(static_cast<double>(OpointMultiEnum::AccordingAllies)))) {
        allies = world().list_entities(u"af_" + team(), [this](Entity& o) {
          if (!entity::is_fighter_data(o.data())) return false;
          if (team() != o.team()) return false;
          if (!(o.hp() > 0)) return false;
          if (&o == this) return false;
          const std::u16string* src = src_emitter();
          if (src != nullptr && o.id == *src) return false;
          return true;
        });
        if (!(truthy(skip_zero) && allies.empty())) {
          count = clamp(static_cast<double>(allies.size()), to_number(min), to_number(max));
        }
      } else if (strict_equals(type, Value(static_cast<double>(OpointMultiEnum::Emitter)))) {
        const std::u16string* emitter_id = emitter();
        // `if (!emitter) break;` —— 空串也算「没有」（JS 真值）。
        if (emitter_id != nullptr && !emitter_id->empty()) {
          Entity* target = world().find_entity(*emitter_id);
          if (target != nullptr) {
            allies.push_back(target);
            count = 1;
          }
        }
      }
    }

    double facing_now = facing;
    for (double i = 0; i < count; ++i) {
      Vector3 sp;
      const Value spreading = field_or(opoint, u"spreading");
      if (std::holds_alternative<std::monostate>(spreading) ||
          strict_equals(spreading, Value(static_cast<double>(OpointSpreading::Normal)))) {
        sp.z = (i - (count - 1) / 2) * 2.5;
      } else if (strict_equals(spreading,
                               Value(static_cast<double>(OpointSpreading::Spreading)))) {
        sp.x = num_of(gen_or(opoint, u"__gen_spread_x", Value(sp.x)));
        sp.y = num_of(gen_or(opoint, u"__gen_spread_y", Value(sp.y)));
        sp.z = num_of(gen_or(opoint, u"__gen_spread_z", Value(sp.z)));
        facing_now = sp.x < 0 ? -1 : sp.x > 0 ? 1 : facing_now;
      }
      Entity* e = spawn(opoint, sp, facing_now);
      // TS 的 `if (!e) return;`：失败就整段收手，剩下的 opoint 与次数都不再处理。
      if (e == nullptr) return;

      if (strict_equals(spreading, Value(static_cast<double>(OpointSpreading::FloatRange)))) {
        Value x = Value(e->velocity.x);
        Value y = Value(e->velocity.y);
        Value z = Value(e->velocity.z);
        const Value gx = gen_or(opoint, u"__gen_spread_x", x);
        const Value gy = gen_or(opoint, u"__gen_spread_y", y);
        const Value gz = gen_or(opoint, u"__gen_spread_z", z);
        if (!nullish(gx)) x = gx;
        if (!nullish(gy)) y = gy;
        if (!nullish(gz)) z = gz;
        e->set_velocity(x, y, z);
      }

      controller::BaseController* ctrl = e->ctrl();
      if (ctrl != nullptr && ctrl->is_ball_ctrl()) {
        if (strict_equals(multi_type,
                          Value(static_cast<double>(OpointMultiEnum::AccordingEnemies)))) {
          ctrl->chasing = enemies.empty()
                              ? Value()
                              : ref_of(*enemies[static_cast<std::size_t>(
                                    std::fmod(i, enemies.size()))]);
        } else if (strict_equals(
                       multi_type,
                       Value(static_cast<double>(OpointMultiEnum::AccordingAllies)))) {
          ctrl->chasing = allies.empty()
                              ? Value()
                              : ref_of(*allies[static_cast<std::size_t>(
                                    std::fmod(i, allies.size()))]);
        } else if (strict_equals(multi_type,
                                 Value(static_cast<double>(OpointMultiEnum::Emitter)))) {
          ctrl->chasing = allies.empty() ? Value() : ref_of(*allies[0]);
        }
      }

      const Value inherit_x = field_or(opoint, u"inherit_speed_x");
      const Value inherit_y = field_or(opoint, u"inherit_speed_y");
      const Value inherit_z = field_or(opoint, u"inherit_speed_z");
      const Value vx = truthy(inherit_x)
                           ? Value(e->velocity.x + velocity.x * to_number(inherit_x))
                           : Value(NullTag{});
      const Value vy = truthy(inherit_y)
                           ? Value(e->velocity.y + velocity.y * to_number(inherit_y))
                           : Value(NullTag{});
      const Value vz = truthy(inherit_z)
                           ? Value(e->velocity.z + velocity.z * to_number(inherit_z))
                           : Value(NullTag{});
      e->set_velocity(vx, vy, vz);
    }
  }
}

// ---------------------------------------------------------------------------
// `update()` / `update_ghost()`: the per-tick body.  Everything they call is already
// ported (`handle_gravity` / `update_velocity` / `update_position`, the recovery
// layers, the enter-frame chain, `apply_opoints`); the host supplies the tick length
// (`world.dataset.atom_time`), the puppet list, the stage bounds, `ground.step` and
// `lfw.survival_rank_mode`.
// ---------------------------------------------------------------------------
void Entity::update() {
  if ((*world().lfw().mt()).debugging) {
    (*world().lfw().mt()).log_case({Value(u"e_" + id + u"_" + to_string(name()) + u"_start")});
  }
  _atom_time = num_of(dataset(u"atom_time"));
  _lifetime += _atom_time;
  const Value frame_facing = field_or(frame, u"facing");
  if (truthy(frame_facing)) facing = handle_facing_flag(frame_facing);
  // 控制器要读的那一组值在任何控制器调用之前就得是新的：`check_fusion_dismissing`
  // 会问 `ctrl.sametime_keys_test` / `sequence_keys_test`（TS 直接读 `me.facing` 等）。
  refresh_ctrl_env();
  if (check_fusion_dismissing()) return;
  hp_recovering();
  mp_recovering();

  const Value frame_hp = field_or(frame, u"hp");
  if (truthy(frame_hp)) set_hp(hp() - to_number(frame_hp) * _atom_time);
  const Value frame_mp = field_or(frame, u"mp");
  if (truthy(frame_mp)) set_mp(mp() - to_number(frame_mp) * _atom_time);

  if (!(shaking > 0) || equals(Value(0.0), dataset(u"vrest_after_shaking"))) {
    // TS 迭代的是 `Map`（插入序）、端口是 `std::map`（键序）：每次迭代只动自己那一项
    // （要么续时、要么整项删掉），所以顺序不可观察。`del_v_rest` 会 erase 当前项，
    // 删完用 `upper_bound` 接上。
    for (auto it = vrests.begin(); it != vrests.end();) {
      collision::Collision& v = it->second;
      if (v.rest > 0) {
        v.rest = round_float(v.rest - _atom_time);
        if (v.rest < 0) v.rest = 0;
        ++it;
      } else {
        const std::u16string key = it->first;
        del_v_rest(key);
        it = vrests.upper_bound(key);
      }
    }
  }

  if (equals(Value(0.0), dataset(u"arest_after_motionless")) || !(motionless > 0)) {
    if (arest() > 0) {
      set_arest(round_float(arest() - _atom_time));
      if (arest() < 0) set_arest(0);
    } else {
      set_arest(0);
    }
  }

  if (_invisible > 0) {
    _invisible = round_float(_invisible - _atom_time);
    if (_invisible <= 0) _invisible = 0;
  }
  if (_invulnerable > 0) {
    _invulnerable = round_float(_invulnerable - _atom_time);
    if (_invulnerable < 0) _invulnerable = 0;
  }
  if (_blinking > 0) {
    _blinking = round_float(_blinking - _atom_time);
    if (_blinking <= 0) {
      _blinking = 0;
      if (_after_blink.has_value() && *_after_blink == frame_id::kGone) {
        // `this.frame = GONE_FRAME_INFO` 直写字段（不走 `set_frame`）。
        const Value* gone = defines::find(u"GONE_FRAME_INFO");
        frame = gone != nullptr ? *gone : Value();
        set_arest(0);
      } else if (_after_blink.has_value() && *_after_blink == frame_id::kRespawn) {
        set_hp(hp_max());
        set_hp_r(hp_max());
        double max_distance = kMaxSafeInteger;
        Entity* friend_entity = nullptr;
        for (Entity* e : world().puppets_values()) {
          if (e == nullptr || !(e->hp() > 0)) continue;
          const double d = abs(round(e->position.x - position.x)) +
                           abs(round(e->position.z - position.z));
          if (d > max_distance) continue;
          max_distance = d;
          friend_entity = e;
        }
        if (friend_entity != nullptr) {
          (*world().lfw().mt()).mark = u"u_1";
          // 舞台值缺键时 TS 读到 `undefined` ⇒ 参与 `Math.max/min` 得 `NaN`（`to_number`
          // 就是这么映射的）；显式的 `null` 则是 0。
          const double x = (*world().lfw().mt()).range(
              max(round(friend_entity->position.x - 100),
                  to_number(world().stage_value(u"player_l"))),
              min(round(friend_entity->position.x + 100),
                  to_number(world().stage_value(u"player_r"))));
          (*world().lfw().mt()).mark = u"u_2";
          const double z = (*world().lfw().mt()).range(
              min(round(friend_entity->position.z - 100),
                  to_number(world().stage_value(u"far"))),
              max(round(friend_entity->position.z + 100),
                  to_number(world().stage_value(u"near"))));
          set_position(Value(x), Value(300.0), Value(z));
        } else {
          set_position(Value(NullTag{}), Value(300.0), Value());
        }
        const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
        enter_frame(auto_frame != nullptr ? *auto_frame : Value());
      }
    }
  }

  // 索引循环（不是 range-for）：`apply_opoints` 可能往 `opoints` 里 push，TS 的
  // `for...of` 会继续看到新项，`std::vector` 的迭代器则会失效。
  for (std::size_t i = 0; i < opoints.size(); ++i) {
    const Value& opoint = opoints[i].first;
    if (strict_equals(Value(opoints[i].second), field_or(opoint, u"interval"))) {
      apply_opoints(Value(std::make_shared<Array>(std::vector<Value>{opoint})));
      opoints[i].second = 0;
    } else {
      opoints[i].second = opoints[i].second + 1;
    }
  }

  stat_recovering();
  toughness_recovering();

  if (_state != nullptr && _state->pre_update) _state->pre_update(*this);
  _from_wait_block = true;
  if (wait > 0) {
    if (!(motionless > 0) && !(shaking > 0) && catcher == nullptr && bearer == nullptr) {
      set_motionless_ticks(0);
      wait = round_float(wait - _atom_time);
      if (wait < 0) wait = 0;
    } else if (motionless > 0 && catcher == nullptr && bearer == nullptr) {
      set_motionless_ticks(round_float(motionless_ticks() + _atom_time));
      if (motionless_ticks() >= kMotionlessWaitTicks) {
        set_motionless_ticks(0);
        wait = round_float(wait - _atom_time);
        if (wait < 0) wait = 0;
      }
    }
  } else if (truthy(field_or(frame, u"next"))) {
    enter_frame(field_or(frame, u"next"));
  } else {
    set_frame(find_auto_frame());
  }
  _from_wait_block = false;

  const double tick_atom_time = _atom_time;
  const double sub_steps = is_integer(tick_atom_time) && tick_atom_time > 1 && tick_atom_time <= 8
                               ? tick_atom_time
                               : 1.0;
  if (sub_steps > 1) _atom_time = round_float(tick_atom_time / sub_steps);
  for (double i = 0; i < sub_steps; ++i) {
    handle_gravity();
    update_velocity(frame);
    if (i == 0 && _state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (motionless > 0) {
    motionless = round_float(motionless - _atom_time);
    if (motionless < 0) motionless = 0;
  }
  if (shaking > 0) {
    shaking = round_float(shaking - _atom_time);
    if (shaking < 0) shaking = 0;
  }

  if (update_catching()) return;
  if (update_caught()) return;

  if (ctrl_ != nullptr) {
    refresh_ctrl_env();
    const controller::ControllerResult& res = ctrl_->update();
    if (truthy(res.result())) {
      const EnterFrameResult r = handle_next_frame_result(res.result());
      if (static_cast<int>(r) >= static_cast<int>(EnterFrameResult::Entered) &&
          res.keys() != std::u16string(gk::ka)) {
        set_catch_time(catch_time_max());
      }
    }
  }
  refresh_ctrl_env();

  if (!truthy(Value(shaking)) && !truthy(Value(motionless)) && bearer == nullptr &&
      catcher == nullptr) {
    update_landable();
  }
  if (holding != nullptr) holding->follow_bearer();
  collision_list.clear();
  collided_list.clear();
  prev_position = position;
  update_aabb();
  if ((*world().lfw().mt()).debugging) {
    (*world().lfw().mt()).log_case({Value(u"e_" + id + u"_" + to_string(name()) + u"_end")});
  }
}

void Entity::update_ghost() {
  _atom_time = num_of(dataset(u"atom_time"));
  _lifetime += _atom_time;
  const Value frame_facing = field_or(frame, u"facing");
  if (truthy(frame_facing)) facing = handle_facing_flag(frame_facing);
  const Value frame_hp = field_or(frame, u"hp");
  if (truthy(frame_hp)) set_hp(hp() - to_number(frame_hp) * _atom_time);
  const Value frame_mp = field_or(frame, u"mp");
  if (truthy(frame_mp)) set_mp(mp() - to_number(frame_mp) * _atom_time);
  if (_invisible > 0) {
    _invisible = round_float(_invisible - _atom_time);
    if (_invisible <= 0) _invisible = 0;
  }
  if (_blinking > 0) {
    _blinking = round_float(_blinking - _atom_time);
    if (_blinking <= 0) _blinking = 0;
  }

  if (_state != nullptr && _state->pre_update) _state->pre_update(*this);
  _from_wait_block = true;
  if (wait > 0) {
    wait = round_float(wait - _atom_time);
    if (wait < 0) wait = 0;
  } else if (truthy(field_or(frame, u"next"))) {
    enter_frame(field_or(frame, u"next"));
  } else {
    set_frame(find_auto_frame());
  }
  _from_wait_block = false;

  const double tick_atom_time = _atom_time;
  const double sub_steps = is_integer(tick_atom_time) && tick_atom_time > 1 && tick_atom_time <= 8
                               ? tick_atom_time
                               : 1.0;
  if (sub_steps > 1) _atom_time = round_float(tick_atom_time / sub_steps);
  for (double i = 0; i < sub_steps; ++i) {
    handle_gravity();
    update_velocity(frame);
    if (i == 0 && _state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (bearer == nullptr && catcher == nullptr) update_landable();
  prev_position = position;
}

bool Entity::check_fusion_dismissing() {
  if (fuse_bys.empty()) return false;

  const double x = position.x;
  const double y = position.y;
  const double z = position.z;
  for (Entity* fighter : fuse_bys) {
    if (fighter == nullptr) continue;
    fighter->position.set(x, y, z);
  }
  if (dismiss_time.has_value()) {
    dismiss_time = round_float(*dismiss_time - _atom_time);
  }

  const bool should_dismiss =
      ((dismiss_time.has_value() && *dismiss_time <= 0) ||
       (ctrl_ != nullptr && ctrl_->sametime_keys_test(u"dja")) ||
       (ctrl_ != nullptr && ctrl_->sequence_keys_test(u"ja"))) &&
      y == 0;
  if (should_dismiss) dismiss_fusion(u"112");
  return should_dismiss;
}

void Entity::dismiss_fusion(const std::u16string& frame_id) {
  if (fuse_bys.empty()) return;
  const double size = static_cast<double>(fuse_bys.size() + 1);
  const double hp_v = round(hp() / size);
  const double hp_r_v = round(hp_r() / size);
  const double mp_v = round(mp() / size);
  double f = facing;
  set_hp(hp_v);
  set_mp(mp_v);
  set_hp_r(hp_r_v);
  // TS 的 `for (const fighter of this.fuse_bys)` 跑完才把 `fuse_bys` 置空，所以先拷一份
  // （成员自己也可能在 `enter_frame_by_id` 里动到这条链）。
  const std::vector<Entity*> members = fuse_bys;
  for (Entity* fighter : members) {
    if (fighter == nullptr) continue;
    fighter->set_hp(hp_v);
    fighter->set_mp(mp_v);
    fighter->set_hp_r(hp_r_v);
    f = to_number(entity::turn_face(Value(f)));
    fighter->facing = f;
    fighter->enter_frame_by_id(Value(frame_id), true);
    fighter->set_invisible(0);
    fighter->motionless = 0;
    fighter->set_invulnerable(0);
  }
  if (truthy(dismiss_data)) transform(dismiss_data);
  enter_frame_by_id(Value(frame_id), true);
  dismiss_time = std::nullopt;
  dismiss_data = Value(NullTag{});
  fuse_bys.clear();
  has_fuse_bys = false;
}

void Entity::update_aabb() {
  // 解构默认值只对 `undefined` 生效（`width` / `centerx` 没有默认值 ⇒ 缺字段是 `NaN`）。
  const double bx1 = num_destructured(field_or(frame, u"__aabb_x1"), 0.0);
  const double fx1 = num_destructured(field_or(frame, u"__aabb_x2"), 0.0);
  const double bz1 = num_destructured(field_or(frame, u"__aabb_z1"), -12.0);
  const double bz2 = num_destructured(field_or(frame, u"__aabb_z2"), 12.0);
  const double width = to_number(field_or(frame, u"width"));
  const double centerx = to_number(field_or(frame, u"centerx"));
  aabb_min_x = round(position.x + (facing > 0 ? bx1 : -fx1));
  aabb_max_x = round(position.x + (facing > 0 ? fx1 : -bx1));
  aabb_min_z = round(position.z + bz1);
  aabb_max_z = round(position.z + bz2);
  l_len = facing > 0 ? centerx : width - centerx;
  r_len = facing > 0 ? width - centerx : centerx;
}

void Entity::update_landable() {
  const double ground = _ground_y;
  const bool was_on_ground = is_on_ground;

  // TS 是 `const { __hit_ground_bdys, __hit_ground_itrs } = this.frame` —— 两个都先取出来：
  // 第一次 `enter_frame` 会换掉当前帧，第二遍不能再从 `frame` 上现读。
  const Value hit_bdys = field_or(frame, u"__hit_ground_bdys");
  const Value hit_itrs = field_or(frame, u"__hit_ground_itrs");
  if (truthy(hit_bdys)) update_itr_bdy_hit_ground(hit_bdys);
  if (truthy(hit_itrs)) update_itr_bdy_hit_ground(hit_itrs);

  // `if (!this.frame.landable) return;` —— 缺字段 / `false` 都提前退出。
  if (!truthy(field_or(frame, u"landable"))) return;

  // `!is_on_ground && position.y <= _ground_y`：不能只看 `velocity.y <= 0`（斜面上
  // y 速度向上也可能已经落到地面线以下）。
  const bool just_land = !was_on_ground && (position.y <= ground);
  if (just_land) {
    is_on_ground = true;
    position.y = ground;
    _temp_v.x = velocity.x;
    _temp_v.y = velocity.y;
    _temp_v.z = velocity.z;
    velocity.y = 0;
    prev_velocity.y = 0;
    if (_state != nullptr && _state->on_landing) {
      _state->on_landing(*this, position_value(_temp_v));
    }
    play_sound(field_or(base_of(_data), u"drop_sounds"));
    if (truthy(Value(throwinjury))) {
      set_hp(hp() - throwinjury);
      set_hp_r(hp_r() - round(throwinjury * (1 - num_of(dataset(u"hp_recoverability")))));
      throwinjury = 0;
    }
    if (truthy(Value(fallinjury))) {
      set_hp(hp() - fallinjury);
      set_hp_r(hp_r() - round(fallinjury * (1 - num_of(dataset(u"hp_recoverability")))));
      fallinjury = 0;
    }
    _landing_frame = frame;
  } else if (was_on_ground) {
    if (position.y - ground > world().ground.step()) {
      leave_ground();
      if (_state != nullptr && _state->on_leave_ground) _state->on_leave_ground(*this);
    } else {
      // 视为斜坡 / 楼梯
      position.y = ground;
    }
  }
}

bool Entity::update_catching() {
  Entity* caught = catching;
  if (caught == nullptr) return false;
  if (!truthy(Value(_catch_time))) {
    set_catching(nullptr);
    const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
    enter_frame(auto_frame != nullptr ? *auto_frame : Value());
    return true;
  }
  const Value cpoint_a = field_or(frame, u"cpoint");
  if (!truthy(cpoint_a)) {
    set_catching(nullptr);
    const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
    enter_frame(auto_frame != nullptr ? *auto_frame : Value());
    return true;
  }

  const Value tix = field_or(cpoint_a, u"throwvx");
  const Value tiy = field_or(cpoint_a, u"throwvy");
  const Value tiz = field_or(cpoint_a, u"throwvz");
  // 名字带 `cp_` 前缀是为了不遮蔽同名成员 `throwinjury`（TS 里那个同名局部 const
  // 本就是另一份绑定，`update_caught` 的 `ti` 是同一处理）。
  const double cp_throwinjury = num_destructured(field_or(cpoint_a, u"throwinjury"), 0.0);
  const double decrease = num_destructured(field_or(cpoint_a, u"decrease"), 0.0);

  if (truthy(Value(decrease))) add_catch_time(decrease * _atom_time);

  if (cp_throwinjury < -1) {
    const Value* gone = defines::find(u"Defines.NEXT_FRAME_GONE");
    enter_frame(gone != nullptr ? *gone : Value());
    return true;
  }
  if (cp_throwinjury == -1 &&
      (!world().lfw().survival_rank_mode() || !entity::is_boss(caught->entity_view()))) {
    transfrom_to_another(caught->_data);
    drop_catching();
    caught->catcher = nullptr;
    caught->_prev_cpoint_a = Value(NullTag{});
    caught->enter_frame(caught->get_caught_end_frame());
    return true;
  }
  if (truthy(tix) || truthy(tiy) || truthy(tiz)) {
    set_catching(nullptr);
    return false;
  }

  caught->follow_catcher();
  return false;
}

bool Entity::update_caught() {
  Entity* cer = catcher;
  if (cer == nullptr) return false;
  follow_catcher();
  if (!truthy(Value(cer->_catch_time))) {
    catcher = nullptr;
    _prev_cpoint_a = Value(NullTag{});
    enter_frame(get_caught_end_frame());
    return true;
  }

  const Value cp_a = field_or(cer->frame, u"cpoint");
  if (!truthy(cp_a)) {
    catcher = nullptr;
    _prev_cpoint_a = Value(NullTag{});
    set_velocity(Value(NullTag{}), Value(3.0), Value());
    if (position.y <= ground_y()) position.y = ground_y() + 1;
    const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
    enter_frame(auto_frame != nullptr ? *auto_frame : Value());
    return true;
  }

  if (!strict_equals(_prev_cpoint_a, cp_a)) {
    const Value injury = field_or(cp_a, u"injury");
    if (truthy(injury)) {
      const double prev_hp = hp();
      set_hp(hp() - to_number(injury));
      set_hp_r(hp_r() - to_number(injury) * (1 - num_of(dataset(u"hp_recoverability"))));
      summary_mgr().apply_damage(cer->entity_view(), injury, entity_view(), Value(prev_hp));
    }
    const Value cp_shaking = field_or(cp_a, u"shaking");
    const Value cp_motionless = field_or(cp_a, u"motionless");
    if (truthy(cp_shaking)) shaking = max(to_number(cp_shaking), shaking);
    if (truthy(cp_motionless)) cer->motionless = max(to_number(cp_motionless), cer->motionless);
  }
  _prev_cpoint_a = cp_a;

  const double ti = num_destructured(field_or(cp_a, u"throwinjury"), 0.0);
  if (ti > 0) throwinjury = ti;
  const Value tx = field_or(cp_a, u"throwvx");
  const Value ty = field_or(cp_a, u"throwvy");
  const Value tz = field_or(cp_a, u"throwvz");
  if (truthy(tx) || truthy(ty) || truthy(tz)) {
    follow_catcher();
    catcher = nullptr;
    _prev_cpoint_a = Value(NullTag{});
  }
  const Value vaction = field_or(cp_a, u"vaction");
  if (truthy(vaction)) {
    return static_cast<int>(enter_frame(vaction)) >= static_cast<int>(EnterFrameResult::Entered);
  }
  return false;
}

Value Entity::entity_view() const {
  // TS 把 `Entity` 当普通对象读的那些调用点（`summary_mgr.apply_damage(cer, …)` 读
  // `id` / `team` / `data` / `hp` / `emitters`，`is_boss(this.catching)` 读 `data.base.group`）
  // 需要一份“完整视图”；`ref()` 只带 `id`，是回调自证身份用的最小视图。
  Object o;
  o.set(u"id", Value(id));
  o.set(u"team", Value(team()));
  o.set(u"data", _data);
  o.set(u"hp", Value(hp()));
  std::vector<Value> em;
  for (const std::u16string& e : emitters) em.push_back(Value(e));
  o.set(u"emitters", Value(std::make_shared<Array>(std::move(em))));
  return Value(std::make_shared<Object>(std::move(o)));
}

Value Entity::world_puppets() const {
  // `world.puppets.values()`：状态层只需要 `team`（`csl_on_dead`），`id` / `hp` /
  // `position` 一起给出去，省得后面每个消费者再补一次缝。
  std::vector<Value> out;
  for (Entity* e : world().puppets_values()) {
    if (e == nullptr) continue;
    Object rec;
    rec.set(u"id", Value(std::u16string(e->id)));
    rec.set(u"team", Value(std::u16string(e->team())));
    rec.set(u"hp", Value(e->hp()));
    rec.set(u"position", position_value(e->position));
    out.push_back(Value(std::make_shared<Object>(std::move(rec))));
  }
  return Value(std::make_shared<Array>(std::move(out)));
}

void Entity::refresh_ctrl_env() {
  controller::CtrlEnv& env = _ctrl_env;
  env.key_hit_duration = num_of(dataset(u"key_hit_duration"));
  env.double_click_interval = num_of(dataset(u"double_click_interval"));
  env.facing = facing;
  env.alive = truthy(Value(hp()));
  env.team = team();
  env.px = position.x;
  env.py = position.y;
  env.pz = position.z;
  env.frame_state = to_number(field_or(frame, u"state"));
  env.hp = hp();
  env.type = type();
  env.frame = frame;
  env.hld = field_or(frame, u"hold");
  env.hit = field_or(frame, u"hit");
  env.kd = field_or(frame, u"key_down");
  env.ku = field_or(frame, u"key_up");
  env.pre_hitkeys = field_or(_data, u"pre_hitkeys");
  env.post_hitkeys = field_or(_data, u"post_hitkeys");
  // `me.transforms?.[0].__pre_hitkeys_map ?? me.data.__pre_hitkeys_map`
  const Array* tr = as_array(transforms);
  const Value* first = (tr != nullptr && !tr->empty()) ? &tr->at(0) : nullptr;
  env.transform_pre_seq_map = first != nullptr ? field_or(*first, u"__pre_hitkeys_map") : Value();
  env.transform_post_seq_map = first != nullptr ? field_or(*first, u"__post_hitkeys_map") : Value();
  env.data_pre_seq_map = field_or(_data, u"__pre_hitkeys_map");
  env.data_post_seq_map = field_or(_data, u"__post_hitkeys_map");
  env.seq_map = field_or(frame, u"__seq_map");
  // ⚠ 这五条缝**上游其实已经搬好**（`World::etc` / `World::team_come|stay|move|follow`，
  // 见 `world.h`），但这里一直没有接线、所以恒 `nullptr`（`BaseController` 的调用点都做空
  // 检查 ⇒ 走「宿主没回答」那条路；TS 里这些是 `world.*` 的活调用）。
  // 要接上属于独立小刀。
  env.world_etc = nullptr;
  env.team_come = nullptr;
  env.team_stay = nullptr;
  env.team_move = nullptr;
  env.team_follow = nullptr;
  if (ctrl_ != nullptr) {
    // ---- `bot/*`（`BotController` / `BotState_*`）读 `this.entity` 的额外自身字段 ----
    env.id = id;
    env.hp_max = hp_max();
    env.mounted = truthy(Value(mounted()));
    env.invisible = truthy(Value(invisible()));
    env.invulnerable = truthy(Value(invulnerable()));
    env.toughness = toughness();
    env.resting = resting();
    env.ground_y = ground_y();
    env.is_on_ground = is_on_ground;
    env.vx = velocity.x;
    env.vy = velocity.y;
    env.vz = velocity.z;
    env.name = name();
    env.data = _data;
    env.holding = holding != nullptr ? ref_of(*holding) : Value(NullTag{});
    env.catching = catching != nullptr ? ref_of(*catching) : Value(NullTag{});
    env.blockers_count = static_cast<double>(blockers.size());
    env.mt = &(*world().lfw().mt());
    // `BotController.difficulty` 是 getter：这里做成闭包，读的时刻才求值（同 TS）。
    env.bot_difficulty = [this]() -> double {
      const Value* const void_stage = defines::find(u"Defines.VOID_STAGE");
      const Value void_id = void_stage != nullptr ? field_or(*void_stage, u"id") : Value();
      if (!strict_equals(world().stage_value(u"id"), void_id)) {
        const std::u16string& my_team = team();
        for (Entity* const f : world().puppets_values()) {
          if (f == this) continue;
          if (f->team() != my_team) continue;
          controller::BaseController* const c = f->ctrl();
          if (c != nullptr && c->is_human()) return static_cast<double>(Difficulty::Difficult);
        }
      }
      return to_number(world().dataset.get(u"difficulty"));
    };
    env.get_bound = [this]() { return world().get_bound(*this); };
    env.has_players_alive = [this]() { return world().has_players_alive; };
    env.stage_value = [this](const std::u16string& key) { return world().stage_value(key); };
    env.find_bot = [this](const std::u16string& bot_id) { return world().lfw().find_bot(bot_id); };
    env.entity_val = [this](const std::u16string& word, BinOp op) -> Value {
      const ValGetter<Entity> g = loader::get_val_getter_from_entity(word);
      return g != nullptr ? g(*this, word, op) : Value(word);
    };
    env.set_position = [this](const Value& x, const Value& y, const Value& z) {
      set_position(x, y, z);
    };
    // `ref_of(e)` 的引用 → 真实体：只读字段的 bot 函数（`is_ray_hit` 那一族）要真 `Entity`。
    // 引用里只有 `id`（`entity_ref.h`），照它查世界表。
    env.resolve = [this](const Value& ref) -> Entity* {
      const Value id_v = field_or(ref, u"id");
      const std::u16string* const id_p = std::get_if<std::u16string>(&id_v);
      return id_p != nullptr ? world().find_entity(*id_p) : nullptr;
    };
    env.bg_width = to_number(world().bg_value(u"width"));
    env.bg_near = to_number(world().bg_value(u"near"));
    env.bg_far = to_number(world().bg_value(u"far"));
    ctrl_->set_env(&_ctrl_env);
    // TS 的 `ControllerResult.fire` 会调 `this.owner.entity.get_next_frame(nf)`；端口把
    // 它做成一个回调，控制器自己看不到实体 ⇒ 由实体在刷环境时绑上。不绑的话 `fire`
    // 恒返回 false，控制器永远给不出结果（帧切换 / 抓人时间都写不出来）。
    ctrl_->result.set_resolver([this](const Value& nf) { return get_next_frame(nf); });
  }
}

// --- 实体面（接口退役收进实体：`EntityViewBase` 的帧几何三缝与索引口径） ----------------

namespace {

bool entity_frame_missing(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

}  // namespace

double Entity::frame_centery() const {
  const Value v = field_or(frame, u"centery");
  return entity_frame_missing(v) ? 0.0 : to_number(v);
}

double Entity::frame_height() const {
  const Value v = field_or(frame, u"height");
  return entity_frame_missing(v) ? 0.0 : to_number(v);
}

double Entity::frame_pic_h() const {
  const Value v = field_or(field_or(frame, u"pic"), u"h");
  return entity_frame_missing(v) ? 0.0 : to_number(v);
}

Value Entity::data_indexes_of(const char16_t* key) const {
  return field_or(field_or(data(), u"indexes"), key);
}

Value Entity::data_type() const { return field_or(data(), u"type"); }

namespace {

// TS `Entity.ts` 底部的 `common_creator`：先问对象池（`Factory.acquire_entity(data.type)`），
// 拿不到才新建。端口里 `Entity` 由**这里**造出来、交给池子回收（`Factory::recycle_entity`），
// 与 TS 的 GC 语义对齐 —— 因此不 `delete`（池子会复用；进程退出时随进程回收）。
Entity* common_creator(World* world, const Value& data, state::States* states) {
  Entity* ret = world->lfw().acquire_entity(field_or(data, u"type"));
  if (ret == nullptr) return new Entity(*world, data, states);
  ret->reset(data, states);
  return ret;
}

}  // namespace

void regist_entities() {
  Factory::register_entity(Value(static_cast<double>(EntityEnum::Ball)), common_creator);
  Factory::register_entity(Value(static_cast<double>(EntityEnum::Weapon)), common_creator);
  Factory::register_entity(Value(static_cast<double>(EntityEnum::Entity)), common_creator);
  Factory::register_entity(Value(static_cast<double>(EntityEnum::Fighter)), common_creator);
}

namespace {

// TS 的注册是**模块级**副作用（`Entity.ts` 底部）：C++ 用一次静态初始化顶它 —— 时间点必须
// 比任何「用户代码」早，差分台面（`subjects/lfw.cpp` 的 `main`）会在这之后再注册自己的
// 带日志版本覆盖掉（TS 侧的顺序也是如此：先模块副作用、后台面代码）。
const bool s_regist_entities = (regist_entities(), true);

}  // namespace

}
