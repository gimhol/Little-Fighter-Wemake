#include "lfw/stage/item.h"

#include <algorithm>
#include <memory>
#include <utility>

#include "lfw/defines/defines_data.h"
#include "lfw/defines/difficulty.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/stage/stage.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/js_add.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/type_check.h"

namespace lfw {
namespace stage {
namespace {

// `v == null`（各文件的既有写法）。
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

// 解构默认值：`undefined` 才替换。
Value or_undefined(const Value& v, const Value& fallback) {
  return is_undefined(v) ? fallback : v;
}

}

Item::Item(Stage* stage, Value phase, Value info)
    : _stage(stage), _phase(std::move(phase)), _info(std::move(info)), _end_delay(0.0, 120.0) {
  const Value times_v = field_or(_info, u"times");
  times = truthy(times_v) ? std::optional<double>(round(to_number(times_v))) : std::nullopt;

  std::vector<Value> data_list;
  std::vector<std::shared_ptr<Randoming>> randoming_list;
  std::vector<Value> ids;
  const Value id = field_or(_info, u"id");
  if (is_str(id)) {
    ids.push_back(id);
  } else if (is_array(id)) {
    const Array* const arr = as_array(id);
    for (size_t i = 0; i < arr->size(); ++i) ids.push_back(arr->at(i));
  }

  if (!ids.empty()) {
    for (const Value& oid : ids) {
      const Value data_v = _stage->datas_find(oid);
      _is_fighter = _is_fighter || entity::is_fighter_data(data_v);
      if (truthy(data_v)) {
        data_list.push_back(data_v);
        continue;
      }
      const std::shared_ptr<Randoming> rd = _stage->datas_randoming_by_group(oid);
      if (rd->src().empty()) continue;
      for (const Value& item : rd->src()) {
        if (entity::is_fighter_data(item)) {
          _is_fighter = true;
          break;
        }
      }
      randoming_list.push_back(rd);
    }
    if (data_list.size() == 1 && randoming_list.empty()) {
      data = data_list[0];
    } else if (!data_list.empty()) {
      randoming_list.push_back(
          Randoming::create(u"stage_item_oid_randoming", data_list, _stage->mt()));
    }
  }

  if (!randoming_list.empty()) {
    randoming = RandomingOfItems::create(u"stage_item_oids_randoming", randoming_list,
                                        _stage->mt());
  }
}

Item::~Item() {
  // 摘掉所有监听：实体的 `callbacks` 里存着捕获了 `this` 的闭包（见头文件里的说明）。
  for (const Watch& w : _watches) {
    if (w.off_team) w.off_team();
    if (w.off_dead) w.off_dead();
  }
  _watches.clear();
  _objects.clear();
}

void Item::forget(Entity* e) {
  // `this.objects.delete(e);` + `e.callbacks.del(this.entity_callback);`
  for (size_t i = 0; i < _objects.size(); ++i) {
    if (_objects[i] == e) {
      _objects.erase(_objects.begin() + static_cast<std::ptrdiff_t>(i));
      break;
    }
  }
  for (size_t i = 0; i < _watches.size(); ++i) {
    if (_watches[i].e != e) continue;
    // 先拷一份再摘：回调里可能正踩着这些 `std::function`。
    const Watch w = _watches[i];
    _watches.erase(_watches.begin() + static_cast<std::ptrdiff_t>(i));
    if (w.off_team) w.off_team();
    if (w.off_dead) w.off_dead();
    break;
  }
}

void Item::update() {
  if (_released) return;

  if (!_objects.empty()) {
    _end_delay.reset();
    return;
  }
  if (!_end_delay.add()) return;
  const double times_v = times.has_value() ? *times : -1.0;  // `const { times = -1 } = this`
  if (truthy(field_or(_info, u"is_soldier"))) {
    if (_stage->all_boss_dead() || times_v == 0.0) {
      release();
      return;
    }
    spawn();
  } else if (times_v >= 1.0) {
    spawn();
  } else {
    release();
  }
}

bool Item::spawn() {
  Value data_v;
  if (truthy(data)) {
    data_v = data;
  } else if (randoming) {
    const std::shared_ptr<Randoming> picked = randoming->get();
    // TS 是 `this.randoming?.get().get()`：外层抽到 `undefined` 时再读 `.get` 会抛 ⇒ 端口给 `undefined`。
    data_v = picked ? picked->get() : Value();
  }
  if (!truthy(data_v)) return false;

  Entity* const e = _stage->create_entity_with_bot(data_v);
  if (e == nullptr) return false;

  const Value enemy_l = or_undefined(field_or(_phase, u"enemy_l"), Value(0.0));
  const Value enemy_r = or_undefined(field_or(_phase, u"enemy_r"), Value(0.0));
  const Value difficulty = _stage->difficulty();

  const Value act = field_or(_info, u"act");
  const Value facing = field_or(_info, u"facing");
  const Value x_v = field_or(_info, u"x");
  // `x = this.lfw.mt.float() < 0.5 ? enemy_l : enemy_r`：默认值只在 `undefined` 时求值
  // （要抽一次随机 ⇒ 不能在别的时候白抽）。
  const Value x = is_undefined(x_v)
                      ? Value(_stage->mt()->next_float() < 0.5 ? enemy_l : enemy_r)
                      : x_v;
  const Value y = field_or(_info, u"y");
  const Value z = field_or(_info, u"z");
  const Value reserve = field_or(_info, u"reserve");
  const Value hp = field_or(_info, u"hp");
  const Value hp_map = field_or(_info, u"hp_map");
  const Value mp_map = field_or(_info, u"mp_map");
  // `mp = mp_map?.[difficulty]`：默认值只在 `mp` 是 `undefined` 时求值；`mp_map` 是 nullish 时
  // `?.` 连下标都不读。
  Value mp = field_or(_info, u"mp");
  if (is_undefined(mp)) mp = is_nullish(mp_map) ? Value() : indexed(mp_map, difficulty);
  const Value outline_color = field_or(_info, u"outline_color");

  if (times.has_value() && truthy(Value(*times))) *times = *times - 1.0;

  e->set_outline_color_raw(is_nullish(outline_color) ? Value(std::u16string()) : outline_color);
  if (entity::is_fighter(*e)) {
    e->set_outline_color_raw(is_nullish(outline_color) ? Value(std::u16string(u"#FF0000"))
                                                       : outline_color);
    e->set_stat_bar(0.0);
    e->set_wakeup_invuln(Value(0.0));
  }
  e->set_dead_gone(1.0);
  e->set_reserve(to_number(is_nullish(reserve) ? Value(0.0) : reserve));

  _stage->mt()->mark = u"stage_item_spawn";

  const Value range_x = or_undefined(field_or(_info, u"range_x"), Value(200.0));
  const Value range_y = or_undefined(field_or(_info, u"range_y"), Value(0.0));
  const Value range_z = or_undefined(field_or(_info, u"range_z"), Value(0.0));

  const Value min_x = x;
  const Value max_x = js_add(x, range_x);
  const bool z_is_num = is_num(z);
  const Value min_z = z_is_num ? z : Value(_stage->far_plane());
  const Value max_z = z_is_num ? js_add(z, range_z) : Value(_stage->near_plane());
  const bool y_is_num = is_num(y);
  const double y_default = entity::is_weapon(*e) ? 300.0 : 0.0;
  const Value min_y = y_is_num ? y : Value(y_default);
  const Value max_y = y_is_num ? js_add(y, range_y) : Value(y_default);

  const double px = _stage->mt()->range(to_number(min_x), to_number(max_x));
  const double py = _stage->mt()->range(to_number(min_y), to_number(max_y));
  const double pz = _stage->mt()->range(to_number(min_z), to_number(max_z));

  e->set_position(Value(px), Value(py), Value(pz));

  const Value join = field_or(_info, u"join");
  if (truthy(join)) {
    auto dead_join = std::make_shared<Object>();
    dead_join->set(u"hp", join);
    dead_join->set(u"team", or_undefined(field_or(_info, u"join_team"),
                                         Value(std::u16string(team_enum::kTeam_1))));
    dead_join->set(u"reserve", field_or(_info, u"join_reserve"));
    e->set_dead_join(Value(dead_join));
  }

  // `hp_map?.[this.world.dataset.difficulty]`：`hp_map` 是 nullish 时连 `difficulty` 都不读。
  Value hp_value;
  if (!is_nullish(hp_map)) hp_value = indexed(hp_map, _stage->difficulty());
  if (!is_num(hp_value) && is_num(hp)) {
    if (strict_equals(difficulty, Value(static_cast<double>(Difficulty::Easy)))) {
      hp_value = Value(round(to_number(hp) * 3.0 / 4.0));
    } else if (strict_equals(difficulty, Value(static_cast<double>(Difficulty::Crazy)))) {
      hp_value = Value(round(to_number(hp) * 3.0 / 2.0));
    } else {
      hp_value = hp;
    }
  }
  // `e.hp = e.hp_r = e.hp_max = _hp`：JS 赋值从右往左 ⇒ 先 `hp_max`、再 `hp_r`、最后 `hp`。
  if (is_num(hp_value)) {
    e->set_hp_max(to_number(hp_value));
    e->set_hp_r(to_number(hp_value));
    e->set_hp(to_number(hp_value));
  }
  if (is_num(mp)) {
    e->set_mp_max(to_number(mp));
    e->set_mp(to_number(mp));
  }

  if (entity::is_fighter(*e)) {
    e->set_name(field_or(field_or(e->data(), u"base"), u"name"));
  }

  e->set_team(to_string(_stage->team()));
  e->attach();

  if (equals(facing, Value(1.0)) || equals(facing, Value(-1.0))) e->set_facing(facing);
  if (is_str(act)) {
    e->enter_frame_by_id(act);
  } else if (entity::is_fighter(*e)) {
    e->enter_frame_by_id(Value(std::u16string(u"running_0")));
  } else {
    // `Defines.NEXT_FRAME_AUTO` 是个 `{ id: "auto" }` 对象（不是数字）⇒ 走运行时表取原值。
    const Value* const auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
    e->enter_frame(auto_frame != nullptr ? *auto_frame : Value());
  }

  Watch w;
  w.e = e;
  w.off_team = e->callbacks.on(u"on_team_changed",
                                 [this, e](const Callbacks::Payloads&) { forget(e); });
  w.off_dead =
      e->callbacks.on(u"on_dead", [this, e](const Callbacks::Payloads&) { forget(e); });
  _watches.push_back(std::move(w));

  for (Entity* const cur : _objects) {
    if (cur == e) return true;  // `Set.add` 的判重
  }
  _objects.push_back(e);
  return true;
}

void Item::release() { _released = true; }

}
}
