#include "lfw/stage/stage.h"

#include "lfw/world.h"
#include "lfw/lfw.h"

#include <algorithm>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/defines/defines_data.h"
#include "lfw/defines/difficulty.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/stage/status.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/round_float.h"
#include "lfw/utils/type_check.h"

namespace lfw {
namespace stage {
namespace {

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// `v === void 0`：只认 `undefined`（解构默认值只在 undefined 时生效，`null` 不算）。
bool is_undefined(const Value& v) { return std::holds_alternative<std::monostate>(v); }

// `obj?.[key]`：键是**值**（数字键按 JS 的 ToPropertyKey 变成字符串）。
Value indexed(const Value& obj, const Value& key) {
  const Object* const o = as_object(obj);
  if (o == nullptr) return Value();
  const Value* const p = o->get(to_string(key));
  return p != nullptr ? *p : Value();
}

// `obj?.[key]`：`obj` 是 nullish 时 `?.` 连下标都不读。
Value optional_indexed(const Value& obj, const Value& key) {
  if (is_nullish(obj)) return Value();
  return indexed(obj, key);
}

// `a === b` 里「对象按引用比」的那一半：`strict_equals` 对对象是**深比较**，而 TS 的
// `phase === this.phase`（`set_phase` 的同一性早退）要的是同一个对象。
bool same_ref(const Value& a, const Value& b) {
  const Object* const oa = as_object(a);
  const Object* const ob = as_object(b);
  if (oa != nullptr || ob != nullptr) return oa == ob;
  const Array* const aa = as_array(a);
  const Array* const ab = as_array(b);
  if (aa != nullptr || ab != nullptr) return aa == ab;
  return strict_equals(a, b);
}

// JS 的 `Set`：插入序 + 按值去重。
bool set_has(const std::vector<Value>& set, const Value& v) {
  for (const Value& x : set) {
    if (strict_equals(x, v)) return true;
  }
  return false;
}

void set_add(std::vector<Value>& set, const Value& v) {
  if (!set_has(set, v)) set.push_back(v);
}

// `a ?? b`。
Value nullish_or(const Value& v, const Value& fallback) { return is_nullish(v) ? fallback : v; }

// `v || 0`（数字）。
double or_zero(const Value& v) { return truthy(v) ? to_number(v) : 0.0; }

std::u16string name_of(const Value& v, const char16_t* key) {
  const Value f = field_or(v, key);
  return truthy(f) ? to_string(f) : std::u16string();
}

// `FSM<Status>` 的三个状态：`update` 用 `is_stage_finish` / `should_goto_next_stage`
// 决定要不要换状态，`enter` 报 `on_stage_finish`（章结束就再报 `on_chapter_finish`）。
class StageRunningState : public IState {
 public:
  explicit StageRunningState(Stage* stage) : _stage(stage) {}

  Value key() const override { return Value(std::u16string(status::kRunning)); }
  std::optional<Value> update(double dt) override {
    (void)dt;
    if (_stage->is_stage_finish()) return Value(std::u16string(status::kCompleted));
    return std::nullopt;
  }

 private:
  Stage* _stage = nullptr;
};

class StageCompletedState : public IState {
 public:
  explicit StageCompletedState(Stage* stage) : _stage(stage) {}

  Value key() const override { return Value(std::u16string(status::kCompleted)); }
  void enter() override {
    _stage->callbacks().call(u"on_stage_finish", {StageCallbackArgs{_stage, Value(), Value()}});
    if (_stage->is_chapter_finish()) {
      _stage->callbacks().call(u"on_chapter_finish", {StageCallbackArgs{_stage, Value(), Value()}});
    }
  }
  std::optional<Value> update(double dt) override {
    (void)dt;
    if (_stage->should_goto_next_stage()) {
      _stage->callbacks().call(u"on_requrie_goto_next_stage",
                               {StageCallbackArgs{_stage, Value(), Value()}});
      return Value(std::u16string(status::kEnd));
    }
    return std::nullopt;
  }

 private:
  Stage* _stage = nullptr;
};

class StageEndState : public IState {
 public:
  Value key() const override { return Value(std::u16string(status::kEnd)); }
};

}

Stage::Warn& stage_warn_sink() {
  static Stage::Warn warn;
  return warn;
}

void Stage::set_warn(Warn warn) { stage_warn_sink() = std::move(warn); }

void Stage::warn(const std::u16string& where, const std::u16string& text) {
  if (stage_warn_sink()) stage_warn_sink()(where, text);
}

// `stage/Item` 的宿主转发（切片 4CS / ck4：`IItemHost` 退役 ⇒ `Item` 直接调本类的这几条；
// 4CO 起 `stage.h` 里只剩 `LFW` 的前置声明，所以这几个体一直留在实现文件）。
// `IStageWorld` 退役后 `stage.h` 只前置声明 `World` ⇒ 这两个 inline 体搬到这里。
Background* Stage::bg() const { return _world->bg(); }
Value Stage::difficulty() const { return _world->difficulty(); }

MersenneTwister* Stage::mt() { return _lfw->mt(); }
Value Stage::datas_find(const Value& oid) { return _lfw->datas_find(oid); }
std::shared_ptr<Randoming> Stage::datas_randoming_by_group(const Value& oid) {
  return _lfw->datas_randoming_by_group(oid);
}
Entity* Stage::create_entity_with_bot(const Value& data) {
  return _lfw->create_entity_with_bot(data);
}

Stage::Stage(World* world, LFW* lfw, Value data)    : _world(world), _lfw(lfw), _data(std::move(data)) {
  _states.push_back(std::make_unique<StageRunningState>(this));
  _states.push_back(std::make_unique<StageCompletedState>(this));
  _states.push_back(std::make_unique<StageEndState>());
  _fsm.add(_states[0].get(), _states[1].get(), _states[2].get());
  _fsm.use(Value(std::u16string(status::kRunning)));

  const Value bid = field_or(_data, u"bg");
  Value bdt = _lfw->datas_backgrounds_find(bid);
  if (!truthy(bdt)) warn(u"Stage::constructor", u"bg not found, id: " + to_string(bid));
  if (is_nullish(bdt)) {
    const Value* const void_bg = defines::find(u"Defines.VOID_BG");
    bdt = void_bg != nullptr ? *void_bg : Value();
  }
  change_bg(bdt);

  Background* const b = _world->bg();
  left = cam_l = player_l = enemy_l = b->left();
  right = cam_r = player_r = enemy_r = b->right();
  _near = b->near_plane();
  _far = b->far_plane();
  width = b->width();
  depth = b->depth();
  middle = b->middle();
  drink_l = -1200.0;
  drink_r = _world->bg()->width() + 1200.0;
  const Value next = field_or(_data, u"next");
  if (truthy(next)) _next_stage = _lfw->datas_stages_find(next);
  _team = _lfw->new_team();
}

Stage::~Stage() = default;

Background* Stage::change_bg(const Value& data) {
  // FIXME: so messed up here...（TS 原文注释，流程也照抄）
  Background* const prev_bg = _world->bg();
  if (prev_bg != nullptr) {
    if (strict_equals(field_or(prev_bg->data(), u"id"), field_or(data, u"id"))) return prev_bg;
  }
  if (prev_bg != nullptr) prev_bg->dispose();
  Stage* const world_stage = _world->stage();
  Background* const curr_bg = world_stage != nullptr ? _world->bg() : nullptr;
  if (curr_bg != nullptr &&
      strict_equals(field_or(curr_bg->data(), u"id"), field_or(data, u"id"))) {
    return curr_bg;
  }

  auto bg = std::make_unique<Background>(_world, data);
  left = cam_l = player_l = enemy_l = bg->left();
  right = cam_r = player_r = enemy_r = bg->right();
  _near = bg->near_plane();
  _far = bg->far_plane();
  width = bg->width();
  depth = bg->depth();
  middle = bg->middle();
  drink_l = -9007199254740991.0;  // `Number.MIN_SAFE_INTEGER`
  drink_r = 9007199254740991.0;   // `Number.MAX_SAFE_INTEGER`
  Background* const created = bg.get();
  _world->set_bg(std::move(bg));
  // TS 是 `return this.world.bg = bg`（赋值表达式的值就是那个新对象，**不读** `world.bg`）
  // ⇒ 端口也直接返回刚建的对象（不然会多一次 `world.bg` 读取）。
  return created;
}

Value Stage::title() const {
  const Value t = field_or(_data, u"title");
  if (!is_nullish(t)) return t;
  return _world->bg()->name();  // `this.bg.name`
}

Value Stage::phases() const { return field_or(_data, u"phases"); }

std::u16string Stage::id() const { return name_of(_data, u"id"); }

std::u16string Stage::name() const { return name_of(_data, u"name"); }

Value Stage::dialog() const {
  if (_dialogs.index < 0.0) return Value();
  const size_t idx = static_cast<size_t>(_dialogs.index);
  if (idx >= _dialogs.list.size()) return Value();
  return _dialogs.list[idx];
}

bool Stage::world_pause() const { return truthy(field_or(_phase, u"world_pause")); }

bool Stage::control_disabled() const { return truthy(field_or(_phase, u"control_disabled")); }

bool Stage::weapon_rain_disabled() const {
  return truthy(field_or(_phase, u"weapon_rain_disabled"));
}

void Stage::stop_bgm() {
  if (_stop_bgm) _stop_bgm();
}

Value Stage::dialog_state_value(const DialogState& s) const {
  auto o = std::make_shared<Object>();
  o->set(u"index", Value(s.index));
  auto list = std::make_shared<Array>();
  for (const Value& v : s.list) list->push_back(v);
  o->set(u"list", Value(list));
  return Value(o);
}

void Stage::play_phase_sounds() {
  if (!truthy(_phase)) return;
  const Value music = field_or(_phase, u"music");
  // `if (music !== void 0)`：`null` 也算「有值」⇒ 走 else 里的 `stop_bgm`。
  if (!is_undefined(music)) {
    if (truthy(music)) {
      _stop_bgm = _lfw->sounds_play_bgm(music);
    } else {
      _stop_bgm = nullptr;
      _lfw->sounds_stop_bgm();
    }
  }
  const Value sounds = field_or(_phase, u"sounds");
  const Array* const arr = as_array(sounds);
  if (arr != nullptr && arr->size() > 0) {
    for (size_t i = 0; i < arr->size(); ++i) {
      const Value& s = arr->at(i);
      _lfw->sounds_play(field_or(s, u"path"), field_or(s, u"x"), field_or(s, u"y"),
                        field_or(s, u"z"));
    }
  }
}

void Stage::set_phase(const Value& phase) {
  if (same_ref(phase, _phase)) return;
  phase_time = 0.0;
  phase_end_tester.reset(_lfw->end_testers(phase));

  const Value prev = _phase;
  _phase = phase;
  _callbacks.call(u"on_phase_changed", {StageCallbackArgs{this, _phase, prev}});
  player_l = 0.0;
  player_r = _world->bg()->right();
  if (!truthy(phase)) return;

  const Value objects = field_or(phase, u"objects");
  const Value respawn = field_or(phase, u"respawn");
  const Value respawn_r = field_or(phase, u"respawn_r");
  const Value health_up = field_or(phase, u"health_up");
  const Value mp_up = field_or(phase, u"mp_up");
  const Value respawn_x = field_or(phase, u"respawn_x");
  const Value dialogs = field_or(phase, u"dialogs");

  // `world.dataset.difficulty` 在 TS 里是**每处用都重新读一次字段**，而且 `?.[…]` 的 `?.`
  // 会短路（`health_up` 是 nullish 时连 `difficulty` 都不读）⇒ 端口把「读 map」写成一个
  // 只在必要时才问宿主的 lambda。
  auto difficulty = [this]() { return _world->difficulty(); };
  auto map_at = [&](const Value& map_obj) -> Value {
    if (is_nullish(map_obj)) return Value();
    return indexed(map_obj, difficulty());
  };
  const Value hp_recovery_v = map_at(health_up);
  const double hp_recovery = truthy(hp_recovery_v) ? to_number(hp_recovery_v) : 0.0;
  const Value hp_recovery_r_v = map_at(health_up);
  const double hp_recovery_r = truthy(hp_recovery_r_v) ? to_number(hp_recovery_r_v) : hp_recovery;
  const Value hp_respawn_v = map_at(respawn);
  const double hp_respawn = truthy(hp_respawn_v) ? to_number(hp_respawn_v) : 0.0;
  const Value hp_respawn_r_v = map_at(respawn_r);
  const double hp_respawn_r = truthy(hp_respawn_r_v) ? to_number(hp_respawn_r_v) : hp_respawn;
  const double mp_recovery = or_zero(map_at(mp_up));
  const Value _respawn_x = map_at(respawn_x);

  const bool loop_players_fighters =
      truthy(Value(hp_recovery)) || truthy(Value(hp_respawn)) || truthy(Value(mp_recovery));
  if (loop_players_fighters) {
    std::vector<Value> teams;
    for (Entity* const f : _world->puppet_list()) set_add(teams, Value(f->team()));
    for (Entity* const f : _world->entity_list()) {
      if (!entity::is_fighter(ref_of(*f)) || !set_has(teams, Value(f->team()))) continue;
      if (f->hp() <= 0.0 && truthy(Value(hp_respawn))) {
        const double hp = hp_respawn < 1.0 ? lfw::min(f->hp_max() * hp_respawn, f->hp_max())
                                           : lfw::min(hp_respawn, f->hp_max());
        f->set_hp(hp);
        const double hp_r = hp_respawn < 1.0 ? lfw::min(f->hp_max() * hp_respawn_r, f->hp_max())
                                             : lfw::min(hp_respawn_r, f->hp_max());
        f->set_hp_r(lfw::max(hp_r, hp));
        if (is_num(_respawn_x)) f->set_position(_respawn_x, Value(NullTag{}), Value(NullTag{}));
      } else if (f->hp() > 0.0 && truthy(Value(hp_recovery))) {
        const double hp = hp_recovery < 1.0
                              ? lfw::min(f->hp_r() + (f->hp_max() - f->hp_r()) * hp_recovery,
                                         f->hp_max())
                              : lfw::min(f->hp_r() + hp_recovery, f->hp_max());
        f->set_hp(hp);
        const double hp_r = hp_recovery_r < 1.0
                                ? lfw::min(f->hp_r() + (f->hp_max() - f->hp_r()) * hp_recovery,
                                           f->hp_max())
                                : lfw::min(f->hp_r() + hp_recovery, f->hp_max());
        f->set_hp_r(lfw::max(hp_r, hp));
      }
      if (truthy(Value(mp_recovery))) {
        f->set_mp(lfw::min(f->mp() + mp_recovery, f->mp_max()));
      }
    }
  }

  play_phase_sounds();
  const double ce_count = ce();
  const Array* const obj_arr = as_array(objects);
  if (obj_arr != nullptr && obj_arr->size() > 0) {
    for (size_t i = 0; i < obj_arr->size(); ++i) spawn(phase, obj_arr->at(i), ce_count);
  }
  const Value cam_jump_to_x = field_or(phase, u"cam_jump_to_x");
  if (is_num(cam_jump_to_x)) _world->camera_jump_x(cam_jump_to_x);

  player_l = to_number(nullish_or(field_or(phase, u"player_l"), Value(0.0)));
  cam_l = to_number(nullish_or(field_or(phase, u"camera_l"), Value(0.0)));
  enemy_l = to_number(nullish_or(field_or(phase, u"enemy_l"), Value(-1200.0)));
  drink_l = to_number(nullish_or(field_or(phase, u"drink_l"), Value(-1200.0)));
  // `phase.bound ?? this.bg.right`：`??` 是**惰性**的，而 `this.bg` 每处用都重新读一次
  // （`this.bg` 是 getter）⇒ 端口也逐条按需调用（不能先把 `bg.right` 缓存成一个局部量）。
  const Value bound = field_or(phase, u"bound");
  auto bound_or_bg_right = [&]() -> Value {
    if (!is_nullish(bound)) return bound;
    return Value(_world->bg()->right());
  };
  auto value_or_bound_or_bg_right = [&](const Value& v) -> Value {
    if (!is_nullish(v)) return v;
    return bound_or_bg_right();
  };
  player_r = to_number(value_or_bound_or_bg_right(field_or(phase, u"player_r")));
  cam_r = to_number(value_or_bound_or_bg_right(field_or(phase, u"camera_r")));
  const Value enemy_r_v = field_or(phase, u"enemy_r");
  enemy_r = is_nullish(enemy_r_v)
                ? to_number(bound_or_bg_right()) + 1200.0
                : to_number(enemy_r_v);
  const Value drink_r_v = field_or(phase, u"drink_r");
  drink_r = is_nullish(drink_r_v) ? _world->bg()->right() + 1200.0 : to_number(drink_r_v);

  const Value player_jump_to_x = field_or(phase, u"player_jump_to_x");
  const Value player_jump_to_z = field_or(phase, u"player_jump_to_z");
  const Value player_facing = field_or(phase, u"player_facing");
  const Value player_x = is_num(player_jump_to_x) ? player_jump_to_x : Value();
  const Value player_z = is_num(player_jump_to_z) ? player_jump_to_z : Value();
  const Value player_f = is_num(player_facing) ? player_facing : Value();

  std::vector<Value> teams;
  for (Entity* const v : _world->puppet_list()) set_add(teams, Value(v->team()));
  for (Entity* const e : _world->entity_list()) {
    if (!entity::is_fighter(ref_of(*e)) || !set_has(teams, Value(e->team()))) continue;
    if (strict_equals(player_f, Value(1.0)) || strict_equals(player_f, Value(-1.0))) {
      e->set_facing(player_f);
    }
    _lfw->mt()->mark = u"criminal_respawn";

    // `let x: number | null = null` ⇒ 初值是 **null**（不是 `undefined`）。
    Value x(NullTag{});
    Value z(NullTag{});
    if (is_num(player_x)) {
      x = Value(_lfw->mt()->range(
          lfw::max(player_l, to_number(player_x) - 50.0),
          lfw::min(player_r, to_number(player_x) + 50.0)));
    }
    if (is_num(player_z)) {
      z = Value(_lfw->mt()->range(lfw::max(_far, to_number(player_z) - 50.0),
                                  lfw::min(_near, to_number(player_z) + 50.0)));
    }
    e->set_position(x, Value(NullTag{}), z);
  }
  const Array* const dialog_arr = as_array(dialogs);
  if (dialog_arr != nullptr && dialog_arr->size() > 0) push_dialogs(dialogs);
}

void Stage::push_dialogs(const Value& more) {
  const DialogState prev = _dialogs;
  std::vector<Value> list = prev.list;
  const Array* const arr = as_array(more);
  if (arr != nullptr) {
    for (size_t i = 0; i < arr->size(); ++i) list.push_back(arr->at(i));
  }
  double index = prev.index;
  if (index < 0.0) {
    index = prev.index + 1.0;
    dialog_time = 0.0;
    const size_t at = static_cast<size_t>(index);
    dialog_end_tester.reset(_lfw->end_testers(at < list.size() ? list[at] : Value()));
  }
  _dialogs = DialogState{index, list};
  _callbacks.call(u"on_dialogs_changed",
                  {StageCallbackArgs{this, dialog_state_value(_dialogs), dialog_state_value(prev)}});
}

void Stage::next_dialog() {
  const DialogState prev = _dialogs;
  // `prev.index == prev.list.length` 代表结束，这是允许的。
  if (prev.index >= static_cast<double>(prev.list.size())) return;
  _dialogs = DialogState{prev.index + 1.0, prev.list};
  const size_t at = static_cast<size_t>(_dialogs.index);
  dialog_end_tester.reset(_lfw->end_testers(at < _dialogs.list.size() ? _dialogs.list[at]
                                                                    : Value()));
  dialog_time = 0.0;
  _callbacks.call(u"on_dialogs_changed",
                  {StageCallbackArgs{this, dialog_state_value(_dialogs), dialog_state_value(prev)}});
}

void Stage::clear_dialogs() {
  const DialogState prev = _dialogs;
  _dialogs = DialogState{-1.0, {}};
  _callbacks.call(u"on_dialogs_changed",
                  {StageCallbackArgs{this, dialog_state_value(_dialogs), dialog_state_value(prev)}});
}

void Stage::enter_phase(double idx) {
  if (_world->stage() != this) return;
  _phase_idx = idx;
  const Value phases_v = phases();
  const Array* const phases_arr = as_array(phases_v);
  const size_t at = static_cast<size_t>(idx);
  const Value phase =
      (phases_arr != nullptr && idx >= 0.0 && at < phases_arr->size()) ? phases_arr->at(at) : Value();
  set_phase(phase);
  _is_stage_finish = phases_arr != nullptr && phases_arr->size() > 0 &&
                     _phase_idx >= static_cast<double>(phases_arr->size());
  _is_chapter_finish =
      _is_stage_finish && !strict_equals(field_or(_next_stage, u"chapter"), field_or(_data, u"chapter"));
}

double Stage::ce() {
  double count = 0.0;
  for (Entity* const c : _world->puppet_list()) {
    const Value base = field_or(c->data(), u"base");
    const Value ce_v = field_or(base, u"ce");
    count += is_nullish(ce_v) ? 1.0 : to_number(ce_v);
  }
  if (!truthy(Value(count))) {
    for (Entity* const e : _world->entity_list()) {
      if (!entity::is_fighter(ref_of(*e)) || !truthy(Value(e->mounted())) || e->hp() <= 0.0) {
        continue;
      }
      if (!strict_equals(Value(e->team()), Value(std::u16string(team_enum::kTeam_1)))) continue;
      const Value base = field_or(e->data(), u"base");
      const Value ce_v = field_or(base, u"ce");
      count += is_nullish(ce_v) ? 1.0 : to_number(ce_v);
    }
  }
  if (!truthy(Value(count))) count = 1.0;
  const Value difficulty = _world->difficulty();
  if (strict_equals(difficulty, Value(static_cast<double>(Difficulty::Crazy)))) count *= 2.0;
  return count;
}

void Stage::spawn(const Value& phase, const Value& obj, double count) {
  if (_world->stage() != this) return;
  const Value ratio = field_or(obj, u"ratio");
  const Value times_v = field_or(obj, u"times");
  const Value times = is_undefined(times_v) ? Value(1.0) : times_v;
  double spawn_count =
      is_undefined(ratio) ? 1.0 : floor(round_float(count * to_number(ratio), 10.0));
  if (spawn_count <= 0.0 || !truthy(times)) return;

  while (spawn_count > 0.0) {
    // TS 是先 `item.spawn()` 再 `items.add(item)` ⇒ 端口也先 spawn 再入列。
    std::unique_ptr<Item> item = std::make_unique<Item>(this, phase, obj);
    item->spawn();
    items.push_back(std::move(item));
    --spawn_count;
  }
}

void Stage::kill_all() {
  for (const std::unique_ptr<Item>& o : items) {
    for (Entity* const e : o->objects()) {
      if (entity::is_fighter(ref_of(*e)) && strict_equals(Value(e->team()), Value(_team))) e->set_hp(0.0);
    }
  }
}

void Stage::kill_soliders() {
  for (const std::unique_ptr<Item>& o : items) {
    if (!truthy(field_or(o->info(), u"is_soldier"))) continue;
    for (Entity* const e : o->objects()) {
      if (entity::is_fighter(ref_of(*e)) && strict_equals(Value(e->team()), Value(_team))) e->set_hp(0.0);
    }
  }
}

void Stage::kill_boss() {
  for (const std::unique_ptr<Item>& o : items) {
    if (!truthy(field_or(o->info(), u"is_boss"))) continue;
    for (Entity* const e : o->objects()) {
      if (entity::is_fighter(ref_of(*e)) && strict_equals(Value(e->team()), Value(_team))) e->set_hp(0.0);
    }
  }
}

void Stage::kill_others() {
  for (const std::unique_ptr<Item>& o : items) {
    if (truthy(field_or(o->info(), u"is_boss")) || truthy(field_or(o->info(), u"is_soldier"))) {
      continue;
    }
    for (Entity* const e : o->objects()) {
      if (entity::is_fighter(ref_of(*e)) && strict_equals(Value(e->team()), Value(_team))) e->set_hp(0.0);
    }
  }
}

void Stage::dispose() {
  for (const std::function<void()>& f : _disposers) f();
  for (const std::unique_ptr<Item>& item : items) item->release();

  std::vector<Entity*> temp;
  std::vector<Value> player_teams;
  for (Entity* const v : _world->puppet_list()) set_add(player_teams, Value(v->team()));
  for (Entity* const e : _world->entity_list()) {
    if (entity::is_fighter(ref_of(*e)) && set_has(player_teams, Value(e->team()))) continue;
    if (entity::is_weapon(ref_of(*e)) && e->bearer != nullptr &&
        set_has(player_teams, Value(e->bearer->team()))) {
      continue;
    }
    temp.push_back(e);
  }
  _world->del_entities(temp);
  _callbacks.clear();
}

bool Stage::all_boss_dead() {
  for (const std::unique_ptr<Item>& item : items) {
    if (!item->is_fighter()) continue;
    if (!truthy(field_or(item->info(), u"is_boss"))) continue;
    if (!item->objects().empty()) return false;
    if (!item->released()) return false;
  }
  return true;
}

bool Stage::all_fighter_dead() {
  for (const std::unique_ptr<Item>& item : items) {
    if (!item->is_fighter()) continue;
    if (!item->objects().empty()) return false;
    if (!item->released()) return false;
  }
  return true;
}

bool Stage::dialog_cleared() const {
  return _dialogs.list.size() <= 0 ||
         _dialogs.index >= static_cast<double>(_dialogs.list.size());
}

bool Stage::is_phase_end() {
  if (!phase_end_tester.list().empty()) return phase_end_tester.flow(*this);
  return all_fighter_dead() && dialog_cleared();
}

bool Stage::is_dialog_end() { return dialog_end_tester.flow(*this); }

bool Stage::check_phase_end() {
  const bool ret = is_phase_end();
  if (!ret) return ret;
  enter_phase(phase_idx() + 1.0);
  return ret;
}

bool Stage::check_dialog_end() {
  const bool ret = is_dialog_end();
  if (!ret) return ret;
  next_dialog();
  return ret;
}

bool Stage::should_goto_next_stage() {
  if (is_chapter_finish() || !is_stage_finish()) return false;

  for (Entity* const e : _world->entity_list()) {
    if (!entity::is_fighter(ref_of(*e))) continue;  // 非角色不判断
    if (e->hp() <= 0.0) continue;                   // 无血，不判断
    if (e->position.x >= cam_r) continue;           // 已达右侧，不判断
    const Value ctrl = e->ctrl_view();
    if (entity::is_bot_ctrl(ctrl)) continue;       // Bot 不判断
    if (_lfw->players_has(field_or(ctrl, u"player_id"))) return false;
  }
  return true;
}

void Stage::update() {
  if (truthy(_phase)) ++phase_time;
  if (truthy(dialog())) ++dialog_time;
  _fsm.update(1.0);

  const Value* const void_stage = defines::find(u"Defines.VOID_STAGE");
  const Value void_id = void_stage != nullptr ? field_or(*void_stage, u"id") : Value();
  if (equals(Value(id()), void_id)) return;

  _released_items.clear();
  for (const std::unique_ptr<Item>& item : items) {
    if (item->released()) _released_items.push_back(item.get());
    else item->update();
  }
  for (Item* const v : _released_items) {
    for (size_t i = 0; i < items.size(); ++i) {
      if (items[i].get() == v) {
        items.erase(items.begin() + static_cast<std::ptrdiff_t>(i));
        break;
      }
    }
  }

  check_phase_end();
  check_dialog_end();
}


// `Object.assign(stage, {near, far})`（导演的 `stage` 动作）：TS 的两个裸字段在端口是
// `_near` / `_far`（`near` / `far` 是 `<windows.h>` 的宏名），这里是唯一写口。
void Stage::assign_number(const std::u16string& key, double v) {
  if (key == u"left") { left = v; return; }
  if (key == u"right") { right = v; return; }
  if (key == u"near") { _near = v; return; }
  if (key == u"far") { _far = v; return; }
  if (key == u"width") { width = v; return; }
  if (key == u"depth") { depth = v; return; }
  if (key == u"player_l") { player_l = v; return; }
  if (key == u"player_r") { player_r = v; return; }
  if (key == u"cam_l") { cam_l = v; return; }
  if (key == u"cam_r") { cam_r = v; return; }
  if (key == u"enemy_l") { enemy_l = v; return; }
  if (key == u"enemy_r") { enemy_r = v; return; }
  if (key == u"drink_l") { drink_l = v; return; }
  if (key == u"drink_r") { drink_r = v; return; }
  if (key == u"phase_time") { phase_time = v; return; }
  if (key == u"dialog_time") { dialog_time = v; return; }
}
}
}
