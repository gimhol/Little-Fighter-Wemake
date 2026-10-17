#include "lfw/director/director.h"

#include <cmath>
#include <functional>
#include <numbers>
#include <cstddef>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/bg/background.h"
#include "lfw/camera.h"
#include "lfw/controller/base_controller.h"
#include "lfw/controller/creators.h"
#include "lfw/core/js_string.h"
#include "lfw/defines/cmd.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/state_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"
#include "lfw/stage/stage.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/eval_number.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/round_float.h"
#include "lfw/utils/type_cast.h"
#include "lfw/world.h"

namespace lfw {
namespace director {

namespace {

const std::u16string& as_str_or_empty(const Value& v) {
  static const std::u16string kEmpty;
  const std::u16string* const s = std::get_if<std::u16string>(&v);
  return s != nullptr ? *s : kEmpty;
}

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// `selectors` 的语法：`"@all"` / `"@组名"` / `"<actor>"` / `"<actor>[<下标>]"`。
// 返回 0 = 不是 `id[下标]` 形式。
bool split_index_selector(const std::u16string& s, std::u16string& id, double& index,
                          bool& has_index) {
  if (s.empty() || s.back() != u']') return false;
  const size_t open = s.rfind(u'[');
  if (open == std::u16string::npos || open == 0) return false;
  const std::u16string digits = s.substr(open + 1, s.size() - open - 2);
  if (digits.empty()) return false;
  size_t i = 0;
  double sign = 1;
  if (digits[0] == u'-') {
    sign = -1;
    i = 1;
    if (digits.size() == 1) return false;
  }
  double value = 0;
  for (; i < digits.size(); ++i) {
    if (digits[i] < u'0' || digits[i] > u'9') return false;
    value = value * 10 + static_cast<double>(digits[i] - u'0');
  }
  id = s.substr(0, open);
  index = sign * value;
  has_index = true;
  return true;
}

// `OID_BY_NAME`：`OID` 枚举名（小写）→ id 字符串。
const std::u16string& oid_by_name(const std::u16string& name) {
  static std::map<std::u16string, std::u16string> table;
  if (table.empty()) {
    for (const EnumTextEntry& e : oid_entries()) {
      std::u16string lower = e.name;
      for (char16_t& c : lower) {
        if (c >= u'A' && c <= u'Z') c = static_cast<char16_t>(c - u'A' + u'a');
      }
      table.emplace(std::move(lower), std::u16string(e.text));
    }
  }
  const auto it = table.find(name);
  if (it != table.end()) return it->second;
  return name;
}

std::u16string lower_of(std::u16string s) {
  for (char16_t& c : s) {
    if (c >= u'A' && c <= u'Z') c = static_cast<char16_t>(c - u'A' + u'a');
  }
  return s;
}

// `CMD_BY_NAME`：只认 TS 那 6 个名字。
const char16_t* cmd_by_name(const std::u16string& name) {
  if (name == u"DIST_CAM") return cmd::kDIST_CAM;
  if (name == u"LOCK_CAM") return cmd::kLOCK_CAM;
  if (name == u"CHANGE_BG") return cmd::kCHANGE_BG;
  if (name == u"CHANGE_STAGE") return cmd::kCHANGE_STAGE;
  if (name == u"PAUSE") return cmd::kPAUSE;
  if (name == u"BGM") return cmd::kBGM;
  return nullptr;
}

// `StateEnum[name]`：JS 枚举是「名字 → 数值」的对象。
std::optional<double> state_value_of(const std::u16string& name) {
  const std::u16string lower = lower_of(name);
  for (const EnumNumberEntry& e : state_enum_entries()) {
    if (lower_of(e.name) == lower) return e.value;
  }
  return std::nullopt;
}

const std::u16string* str_of(const Value& v) { return std::get_if<std::u16string>(&v); }

}  // namespace

Director::Director(World& w, Value d) : world(w), data(std::move(d)) {}

void Director::start() {
  action_director.reset();
  world.camera().undest();
  world.camera().unlock();
  compile();
  setup_scene();
}

void Director::restart() {
  _compiled = false;
  start();
}

void Director::stop() {
  action_director.reset();
  _actors.clear();
  _groups.clear();
  _spawned.clear();
}

void Director::update(double dt) {
  if (world.paused()) return;
  action_director.update(dt);
  update_auto();
}

std::vector<Entity*> Director::resolve(const Value& selectors) const {
  std::vector<std::u16string> list;
  if (const Array* const arr = as_array(selectors)) {
    for (const Value& v : arr->items()) {
      if (const std::u16string* const s = str_of(v)) list.push_back(*s);
    }
  } else if (const std::u16string* const s = str_of(selectors)) {
    list.push_back(*s);
  }

  std::vector<Entity*> ret;
  for (const std::u16string& selector : list) {
    if (selector == u"@all") {
      ret.insert(ret.end(), _spawned.begin(), _spawned.end());
      continue;
    }
    if (!selector.empty() && selector[0] == u'@') {
      const auto it = _groups.find(selector.substr(1));
      if (it != _groups.end()) ret.insert(ret.end(), it->second.begin(), it->second.end());
      continue;
    }
    std::u16string id = selector;
    double index = 0;
    bool has_index = false;
    split_index_selector(selector, id, index, has_index);
    const auto it = _actors.find(id);
    if (it == _actors.end()) continue;
    const std::vector<Entity*>& entities = it->second;
    if (!has_index) {
      ret.insert(ret.end(), entities.begin(), entities.end());
      continue;
    }
    const double at = index < 0 ? static_cast<double>(entities.size()) + index : index;
    if (at < 0 || at >= static_cast<double>(entities.size())) continue;
    Entity* const e = entities[static_cast<size_t>(at)];
    if (e != nullptr) ret.push_back(e);
  }

  // `ret.filter((e, i) => ret.indexOf(e) === i)`
  std::vector<Entity*> uniq;
  for (Entity* const e : ret) {
    bool seen = false;
    for (Entity* const k : uniq) {
      if (k == e) {
        seen = true;
        break;
      }
    }
    if (!seen) uniq.push_back(e);
  }
  return uniq;
}

Entity* Director::spawn(const std::u16string& oid) {
  const Value* const d = world.lfw().datas().find_object(Value(oid));
  if (d == nullptr) return nullptr;
  return world.lfw().create_entity(world, *d);
}

void Director::update_auto() {
  const Value rules = field_or(data, u"auto");
  const Array* const arr = as_array(rules);
  if (arr == nullptr || arr->size() == 0) return;

  std::vector<Entity*> handled;
  for (const Value& rule : arr->items()) {
    for (Entity* const e : resolve(field_or(rule, u"target"))) {
      if (e == nullptr) continue;
      bool skip = false;
      for (Entity* const k : handled) {
        if (k == e) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
      if (!match_auto(*e, field_or(rule, u"when"))) continue;
      apply_keys(*e, field_or(rule, u"actions"));
      handled.push_back(e);
    }
  }
}

void Director::compile() {
  if (_compiled) return;
  _compiled = true;

  const Value timeline = field_or(data, u"timeline");
  if (as_object(timeline) == nullptr) return;

  double time = 0;
  auto schedule = [this, &time](const Value& actions) {
    const Array* const arr = as_array(actions);
    if (arr == nullptr || arr->size() == 0) {
      action_director.insert(time, [] {});
      return;
    }
    for (const Value& action : arr->items()) {
      action_director.insert(time, [this, action] { run_action(action); });
    }
  };
  std::function<void(const Array&, double)> walk;
  walk = [&](const Array& entries, double interval) {
    for (const Value& entry : entries.items()) {
      const Object* const o = as_object(entry);
      time += interval;
      if (o == nullptr) continue;
      if (o->has(u"wait")) {
        time += to_number(field_or(entry, u"wait"));
        action_director.insert(time, [] {});
      } else if (o->has(u"repeat")) {
        const double repeat = to_number(field_or(entry, u"repeat"));
        const double inner = to_number(field_or(entry, u"interval"));
        const Array* const children = as_array(field_or(entry, u"entries"));
        for (double i = 0; i < repeat; ++i) {
          if (children != nullptr) walk(*children, inner);
        }
      } else {
        // TS：`time += entry.after ?? 0` —— 内层的 `<entry>` 往往没有 `after`，
        // 少了这个缺省就会 `+= NaN`，之后的每个定时任务的 time 都成 NaN ⇒
        // `action.time > t` 恒为假 ⇒ **每帧把所有动作全放一遍**（导演一路乱按）。
        const Value after = field_or(entry, u"after");
        time += is_nullish(after) ? 0.0 : to_number(after);
        schedule(field_or(entry, u"actions"));
      }
    }
  };
  if (const Array* const entries = as_array(field_or(timeline, u"entries"))) walk(*entries, 0);

  const Value times = field_or(timeline, u"times");
  if (!is_nullish(times)) action_director.times(to_number(times));
  action_director.sort_actions();
}

void Director::setup_scene() {
  _actors.clear();
  _groups.clear();
  _spawned.clear();
  fighters.clear();
  entities.clear();
  weapons.clear();

  world.clear();
  const Value bg_id = field_or(data, u"bg");
  const std::u16string& bg_name =
      str_of(bg_id) != nullptr ? *str_of(bg_id) : std::u16string(u"bg_4");
  world.lfw().change_bg(bg_name);
  if (Stage* const st = world.stage()) {
    if (const Object* const stage = as_object(field_or(data, u"stage"))) {
      for (const std::u16string& key : stage->keys()) {
        const Value* const v = stage->get(key);
        if (v != nullptr) st->assign_number(key, to_number(*v));
      }
    }
  }

  if (const Array* const actors = as_array(field_or(data, u"actors"))) {
    for (const Value& actor : actors->items()) spawn_actor(actor);
  }
  if (const Object* const groups = as_object(field_or(data, u"groups"))) {
    for (const std::u16string& name : groups->keys()) {
      std::vector<Entity*> group;
      const auto it = _groups.find(name);
      if (it != _groups.end()) group = it->second;
      const Value* const selectors = groups->get(name);
      if (selectors != nullptr) {
        for (Entity* const e : resolve(*selectors)) {
          bool has = false;
          for (Entity* const k : group) {
            if (k == e) {
              has = true;
              break;
            }
          }
          if (!has) group.push_back(e);
        }
      }
      _groups[name] = group;
    }
  }

  const auto fighters_it = _groups.find(u"fighters");
  fighters = fighters_it != _groups.end() ? fighters_it->second : std::vector<Entity*>();
  const auto entities_it = _groups.find(u"entities");
  entities = entities_it != _groups.end() ? entities_it->second : std::vector<Entity*>();
  const auto weapons_it = _groups.find(u"weapons");
  weapons = weapons_it != _groups.end() ? weapons_it->second : std::vector<Entity*>();

  if (const Array* const setup = as_array(field_or(data, u"setup"))) {
    for (const Value& action : setup->items()) run_action(action);
  }
}

void Director::spawn_actor(const Value& actor) {
  const std::vector<std::u16string> oids = actor_oids(actor);
  if (oids.empty()) return;

  const Value count_v = field_or(actor, u"count");
  const double count =
      max(0.0, floor(is_nullish(count_v) ? static_cast<double>(oids.size()) : to_number(count_v)));
  if (count == 0) return;

  const utils::EvalContext c = eval_ctx();
  std::vector<Entity*> spawned_list;
  for (double i = 0; i < count; i += 1) {
    const std::u16string& oid = oids[static_cast<size_t>(i) % oids.size()];
    Entity* const e = spawn(oid);
    if (e == nullptr) continue;

    double x = 0;
    double y = 0;
    double z = 0;
    actor_position(actor, i, count, c, x, y, z);
    e->set_position(Value(x), Value(y), Value(z));
    const Value values = field_or(actor, u"values");
    if (as_object(values) != nullptr) apply_values(*e, values, i);
    apply_ctrl(*e, actor, i, oid);
    const Value attach = field_or(actor, u"attach");
    if (!(std::holds_alternative<bool>(attach) && !std::get<bool>(attach))) e->attach(Value(false));

    spawned_list.push_back(e);
    _spawned.push_back(e);
    std::vector<Entity*>& own = _actors[as_str_or_empty(field_or(actor, u"id"))];
    own.push_back(e);
  }

  const Value group_v = field_or(actor, u"group");
  std::vector<std::u16string> groups;
  if (const std::u16string* const s = str_of(group_v)) {
    groups.push_back(*s);
  } else if (const Array* const arr = as_array(group_v)) {
    for (const Value& v : arr->items()) {
      if (const std::u16string* const s = str_of(v)) groups.push_back(*s);
    }
  }
  for (const std::u16string& name : groups) {
    std::vector<Entity*>& group = _groups[name];
    group.insert(group.end(), spawned_list.begin(), spawned_list.end());
  }
}

std::vector<std::u16string> Director::actor_oids(const Value& actor) const {
  std::vector<std::u16string> ret;
  if (as_str_or_empty(field_or(actor, u"source")) == u"fighters") {
    std::vector<std::u16string> ids;
    for (const Value& v : world.lfw().datas().fighters()) {
      ids.push_back(as_str_or_empty(field_or(v, u"id")));
    }
    const std::u16string half = as_str_or_empty(field_or(actor, u"half"));
    if (half == u"first" || half == u"second") {
      const size_t mid = static_cast<size_t>(round(static_cast<double>(ids.size()) / 2.0));
      if (half == u"first") {
        ids.resize(mid);
      } else {
        ids.erase(ids.begin(), ids.begin() + static_cast<std::ptrdiff_t>(mid));
      }
    }
    return ids;
  }
  const Value oid = field_or(actor, u"oid");
  if (is_nullish(oid)) return ret;
  if (const std::u16string* const s = str_of(oid)) {
    ret.push_back(oid_by_name(lower_of(*s)));
    return ret;
  }
  if (const Array* const arr = as_array(oid)) {
    for (const Value& v : arr->items()) {
      if (const std::u16string* const s = str_of(v)) ret.push_back(oid_by_name(lower_of(*s)));
    }
  }
  return ret;
}

void Director::actor_position(const Value& actor, double index, double count,
                              const utils::EvalContext& c,
                              double& x, double& y, double& z) const {
  const Value layout = field_or(actor, u"layout");
  const Object* const layout_o = as_object(layout);

  auto pick = [&](const char16_t* own_key, const char16_t* layout_key, const Value& fallback) {
    const Value own = field_or(actor, own_key);
    if (!is_nullish(own)) return own;
    if (layout_o != nullptr) {
      const Value* const from_layout = layout_o->get(layout_key);
      if (from_layout != nullptr && !is_nullish(*from_layout)) return *from_layout;
    }
    return fallback;
  };

  x = expr(pick(u"x", u"x", Value(std::u16string(u"midX"))));
  y = expr(pick(u"y", u"y", Value(0.0)));
  z = expr(pick(u"z", u"z", Value(std::u16string(u"midZ"))));

  const Value at = field_or(actor, u"at");
  if (!is_nullish(at)) {
    const std::vector<Entity*> refs = resolve(at);
    if (!refs.empty()) {
      const Entity& ref = *refs[0];
      x = ref.position.x + expr(field_or(actor, u"dx"));
      y = ref.position.y + expr(field_or(actor, u"dy"));
      z = ref.position.z + expr(field_or(actor, u"dz"));
    }
  }

  const std::u16string type = layout_o != nullptr ? as_str_or_empty(field_or(layout, u"type")) : std::u16string();
  if (type == u"line") {
    const double length = expr(field_or(layout, u"length"));
    const double step = count > 1 ? length / (count - 1) : 0;
    std::u16string axis = as_str_or_empty(field_or(layout, u"axis"));
    if (axis.empty()) axis = u"x";
    if (axis == u"x") {
      x = x - length / 2 + step * index;
    } else {
      z = z - length / 2 + step * index;
    }
  } else if (type == u"circle" && count > 1) {
    const double a = std::numbers::pi * 2 / count * index;
    const Value radius = field_or(layout, u"radius");
    const Value rx_v = field_or(layout, u"rx");
    const Value rz_v = field_or(layout, u"rz");
    const double rx = expr(is_nullish(rx_v) ? radius : rx_v);
    const double rz = expr(is_nullish(rz_v) ? (is_nullish(radius) ? Value(rx) : radius) : rz_v);
    x += std::cos(a) * rx;
    z += std::sin(a) * rz;
  }

  x = round_float(x);
  y = round_float(y);
  z = round_float(z);
}

void Director::apply_values(Entity& e, const Value& values, double index) const {
  const Object* const o = as_object(values);
  if (o == nullptr) return;
  for (const std::u16string& key : o->keys()) {
    const Value* const raw_p = o->get(key);
    if (raw_p == nullptr) continue;
    Value raw = *raw_p;
    if (const Array* const arr = as_array(raw)) {
      if (arr->size() == 0) continue;
      raw = arr->at(static_cast<size_t>(index) % arr->size());
    }
    if (std::holds_alternative<std::monostate>(raw)) continue;
    // TS 是 `(e as any)[key] = value`（任意字段）；端口按导演数据里实际出现的键映射到
    // 各自的 setter（17 份 `prel_data/directors/*.xml` 里只用到下面这些）。
    if (key == u"as_key_role") {
      e.as_key_role(raw);
    } else if (key == u"team") {
      e.set_team(as_str_or_empty(raw));
    } else if (key == u"facing") {
      e.facing = to_number(raw);
    } else if (key == u"mp") {
      e.set_mp(to_number(raw));
    } else if (key == u"mp_max") {
      e.set_mp_max(to_number(raw));
    } else if (key == u"hp") {
      e.set_hp(to_number(raw));
    } else if (key == u"hp_r") {
      e.set_hp_r(to_number(raw));
    } else if (key == u"hp_max") {
      e.set_hp_max(to_number(raw));
    } else if (key == u"name") {
      e.set_name(raw);
    } else if (key == u"name_visible") {
      e.name_visible = to_number(raw);
    } else if (key == u"ctrl_visible") {
      e.ctrl_visible = to_number(raw);
    } else if (key == u"stat_bar") {
      e.set_stat_bar(to_number(raw));
    } else if (key == u"blinking") {
      e.set_blinking(to_number(raw));
    } else if (key == u"invulnerable") {
      e.set_invulnerable(to_number(raw));
    } else if (key == u"wakeup_invuln") {
      e.set_wakeup_invuln(raw);
    }
  }
}

void Director::apply_ctrl(Entity& e, const Value& actor, double index, const std::u16string& oid) {
  const std::u16string kind = as_str_or_empty(field_or(actor, u"ctrl"));
  if (kind.empty()) return;
  const std::u16string player_id = player_id_of(as_str_or_empty(field_or(actor, u"player_id")), e, index);
  Factory* const factory = &world.lfw().factory;
  if (kind == u"local") {
    e.set_ctrl(factory->acquire_ctrl(controller::local_controller_creator(), player_id, &e));
  } else if (kind == u"invalid") {
    e.set_ctrl(factory->acquire_ctrl(controller::invalid_controller_creator(), player_id, &e));
  } else {
    controller::BaseController* const ctrl =
        world.lfw().create_ctrl(Value(oid), player_id, &e);
    if (ctrl != nullptr) e.set_ctrl(ctrl);
  }
}

std::u16string Director::player_id_of(const std::u16string& templ, const Entity& e,
                                      double index) const {
  if (templ == u"$new_id") return world.lfw().new_id();
  if (templ == u"$keep") {
    const controller::BaseController* const ctrl = e.ctrl();
    return ctrl != nullptr ? ctrl->player_id : std::u16string();
  }
  std::u16string ret;
  const std::u16string token = u"{i}";
  size_t pos = 0;
  for (;;) {
    const size_t at_ = templ.find(token, pos);
    if (at_ == std::u16string::npos) {
      ret += templ.substr(pos);
      break;
    }
    ret += templ.substr(pos, at_ - pos);
    ret += number_to_string(index);
    pos = at_ + token.size();
  }
  return ret;
}

utils::EvalContext Director::eval_ctx() const {
  utils::EvalContext ret;
  const Background* const b = world.bg();
  const double left = b != nullptr ? b->left() : 0.0;
  const double right = b != nullptr ? b->right() : 0.0;
  const double far_plane = b != nullptr ? b->far_plane() : 0.0;
  const double near_plane = b != nullptr ? b->near_plane() : 0.0;
  ret.emplace(u"midX", round_float((left + right) / 2.0));
  ret.emplace(u"midZ", round_float((near_plane + far_plane) / 2.0));
  ret.emplace(u"left", left);
  ret.emplace(u"right", right);
  ret.emplace(u"near", near_plane);
  ret.emplace(u"far", far_plane);
  ret.emplace(u"width", b != nullptr ? b->width() : 0.0);
  ret.emplace(u"depth", b != nullptr ? b->depth() : 0.0);
  ret.emplace(u"modernScreenW", defines::num(u"Defines.MODERN_SCREEN_WIDTH"));
  ret.emplace(u"PI", std::numbers::pi);
  return ret;
}

void Director::run_action(const Value& action) {
  const std::u16string op = as_str_or_empty(field_or(action, u"op"));
  if (op == u"input") {
    for (Entity* const e : resolve(field_or(action, u"target"))) {
      apply_keys(*e, field_or(action, u"actions"));
    }
    return;
  }
  if (op == u"set") {
    const std::vector<Entity*> list = resolve(field_or(action, u"target"));
    for (size_t i = 0; i < list.size(); ++i) {
      apply_values(*list[i], field_or(action, u"values"), static_cast<double>(i));
    }
    return;
  }
  if (op == u"camera") {
    Camera& cam = world.camera();
    if (truthy(field_or(action, u"undest"))) cam.undest();
    if (truthy(field_or(action, u"unlock"))) cam.unlock();
    const Array* const dest = as_array(field_or(action, u"dest"));
    if (dest != nullptr) cam.dest(expr(dest->at(0)), expr(dest->at(1)));
    const Array* const lock = as_array(field_or(action, u"lock"));
    if (lock != nullptr) cam.lock(expr(lock->at(0)), expr(lock->at(1)));
    return;
  }
  if (op == u"cmd") {
    const char16_t* const name = cmd_by_name(as_str_or_empty(field_or(action, u"name")));
    if (name == nullptr) return;
    std::vector<std::u16string> words;
    words.emplace_back(name);
    if (const Array* const args = as_array(field_or(action, u"args"))) {
      for (const Value& arg : args->items()) {
        if (const std::u16string* const s = str_of(arg)) {
          const std::optional<double> n = utils::eval_number(arg, eval_ctx());
          words.push_back(n.has_value() ? number_to_string(*n) : *s);
        } else {
          words.push_back(number_to_string(expr(arg)));
        }
      }
    }
    world.lfw().push_cmd(words);
    return;
  }
  if (op == u"bg") {
    world.lfw().change_bg(as_str_or_empty(field_or(action, u"id")));
    return;
  }
  if (op == u"stage") {
    Stage* const st = world.stage();
    if (st == nullptr) return;
    if (const Object* const values = as_object(field_or(action, u"values"))) {
      for (const std::u16string& key : values->keys()) {
        const Value* const v = values->get(key);
        if (v != nullptr) st->assign_number(key, to_number(*v));
      }
    }
    return;
  }
  if (op == u"place") {
    const std::vector<Entity*> refs = resolve(field_or(action, u"at"));
    if (refs.empty()) return;
    const Entity& ref = *refs[0];
    const std::u16string requires_key = as_str_or_empty(field_or(action, u"requires"));
    if (requires_key == u"bearer" && ref.bearer == nullptr) return;
    if (requires_key == u"catcher" && ref.catcher == nullptr) return;
    if (requires_key == u"holding" && ref.holding == nullptr) return;
    const double x = ref.position.x + expr(field_or(action, u"dx"));
    const Value dy = field_or(action, u"dy");
    const double y = is_nullish(dy) ? 0.0 : expr(dy);
    const double z = ref.position.z + expr(field_or(action, u"dz"));
    for (Entity* const e : resolve(field_or(action, u"target"))) {
      e->set_position(Value(x), Value(y), Value(z));
    }
    return;
  }
  if (op == u"move") {
    const double dx = expr(field_or(action, u"dx"));
    const double dy = expr(field_or(action, u"dy"));
    const double dz = expr(field_or(action, u"dz"));
    for (Entity* const e : resolve(field_or(action, u"target"))) {
      e->set_position(Value(e->position.x + dx), Value(e->position.y + dy),
                      Value(e->position.z + dz));
    }
    return;
  }
  if (op == u"face") {
    const std::vector<Entity*> refs = resolve(field_or(action, u"at"));
    if (refs.empty()) return;
    const Entity& ref = *refs[0];
    for (Entity* const e : resolve(field_or(action, u"target"))) {
      e->facing = ref.position.x < e->position.x ? -1.0 : 1.0;
    }
    return;
  }
  if (op == u"velocity") {
    const Value x_v = field_or(action, u"x");
    const Value y_v = field_or(action, u"y");
    const Value z_v = field_or(action, u"z");
    const Value x = is_nullish(x_v) ? Value(NullTag{}) : Value(expr(x_v));
    const Value y = is_nullish(y_v) ? Value(NullTag{}) : Value(expr(y_v));
    const Value z = is_nullish(z_v) ? Value(NullTag{}) : Value(expr(z_v));
    for (Entity* const e : resolve(field_or(action, u"target"))) e->set_velocity(x, y, z);
    return;
  }
  if (op == u"frame") {
    const std::u16string id = as_str_or_empty(field_or(action, u"id"));
    for (Entity* const e : resolve(field_or(action, u"target"))) enter_frame(*e, id);
    return;
  }
  if (op == u"pickup") {
    const std::vector<Entity*> weapons_ref = resolve(field_or(action, u"weapon"));
    if (weapons_ref.empty()) return;
    Entity& weapon = *weapons_ref[0];
    const bool if_empty = truthy(field_or(action, u"if_empty"));
    for (Entity* const e : resolve(field_or(action, u"target"))) {
      if (if_empty && e->holding != nullptr) continue;
      e->pick(weapon);
      const Value* const nf = defines::find(u"Defines.NEXT_FRAME_AUTO");
      e->enter_frame(nf != nullptr ? *nf : Value());
    }
    return;
  }
  if (op == u"cycle") {
    cycle(field_or(action, u"target"), as_str_or_empty(field_or(action, u"property")),
          field_or(action, u"values"));
    return;
  }
  if (op == u"throw_spot") {
    throw_spot(field_or(action, u"target"), as_str_or_empty(field_or(action, u"from")));
    return;
  }
  if (op == u"reset") {
    setup_scene();
    return;
  }
}

void Director::apply_keys(Entity& e, const Value& steps) const {
  controller::BaseController* const ctrl = e.ctrl();
  if (ctrl == nullptr) return;
  const Array* const arr = as_array(steps);
  if (arr == nullptr) return;
  for (const Value& step : arr->items()) {
    auto keys = [](const Value& v) {
      std::vector<std::u16string> out;
      if (const Array* const ks = as_array(v)) {
        for (const Value& k : ks->items()) {
          if (const std::u16string* const s = str_of(k)) out.push_back(*s);
        }
      }
      return out;
    };
    const Value click = field_or(step, u"click");
    if (!is_nullish(click)) ctrl->click(keys(click));
    const Value dbl_click = field_or(step, u"dbl_click");
    if (!is_nullish(dbl_click)) ctrl->dbl_click(keys(dbl_click));
    const Value db_hit = field_or(step, u"db_hit");
    if (!is_nullish(db_hit)) ctrl->db_hit(keys(db_hit));
    const Value key_down = field_or(step, u"key_down");
    if (!is_nullish(key_down)) ctrl->key_down(keys(key_down));
    const Value key_up = field_or(step, u"key_up");
    if (!is_nullish(key_up)) {
      if (as_str_or_empty(key_up) == u"all") {
        std::vector<std::u16string> all;
        for (const char16_t* const k : all_game_keys()) all.emplace_back(k);
        ctrl->key_up(all);
      } else {
        ctrl->key_up(keys(key_up));
      }
    }
  }
}

void Director::enter_frame(Entity& e, const std::u16string& id) {
  if (id == u"auto") {
    const Value* const nf = defines::find(u"Defines.NEXT_FRAME_AUTO");
    e.enter_frame(nf != nullptr ? *nf : Value());
    return;
  }
  if (id == u"falling_forward_0" || id == u"falling_backward_0") {
    const bool forward = id == u"falling_forward_0";
    const Value falling = e.data_indexes_falling();
    Value row;
    if (const Array* const arr = as_array(falling)) {
      const size_t idx = forward ? 1 : 0;  // `[1]` / `[-1]`：端口的 falling 是两格数组
      if (arr->size() > idx) row = arr->at(idx);
    } else {
      row = field_or(falling, forward ? u"1" : u"-1");
    }
    Value first;
    if (const Array* const arr = as_array(row)) {
      if (!arr->empty()) first = arr->at(0);
    } else {
      first = field_or(row, u"0");
    }
    e.enter_frame_by_id(first);
    return;
  }
  e.enter_frame_by_id(Value(id));
}

void Director::cycle(const Value& target, const std::u16string& property, const Value& values) {
  const Array* const arr = as_array(values);
  if (arr == nullptr || arr->empty()) return;
  for (Entity* const e : resolve(target)) {
    if (property == u"team") {
      const std::u16string current = e->team();
      size_t index = static_cast<size_t>(-1);
      for (size_t i = 0; i < arr->size(); ++i) {
        if (as_str_or_empty(arr->at(i)) == current) {
          index = i;
          break;
        }
      }
      const size_t next = index == static_cast<size_t>(-1) ? 0 : (index + 1) % arr->size();
      e->set_team(as_str_or_empty(arr->at(next)));
    }
  }
}

void Director::throw_spot(const Value& target, const std::u16string& from) {
  const std::vector<Entity*> targets = resolve(target);
  const std::vector<Entity*> froms = resolve(from);
  if (targets.empty() || froms.empty()) return;
  Entity& a = *targets[0];
  const Entity& c = *froms[0];

  double dx = 86;
  const Value frames = c.data_frames();
  const Object* const frames_o = as_object(frames);
  if (frames_o != nullptr) {
    for (const std::u16string& key : frames_o->keys()) {
      const Value* const frame = frames_o->get(key);
      if (frame == nullptr) continue;
      const Value wpoint = field_or(*frame, u"wpoint");
      if (as_object(wpoint) == nullptr) continue;
      const bool has_dv = !is_nullish(field_or(wpoint, u"dvx")) ||
                          !is_nullish(field_or(wpoint, u"dvy")) ||
                          !is_nullish(field_or(wpoint, u"dvz"));
      if (!has_dv) continue;
      dx = to_number(field_or(wpoint, u"x")) - to_number(field_or(*frame, u"centerx"));
      break;
    }
  }
  a.facing = -1;
  a.set_position(Value(c.position.x + dx), Value(0.0), Value(a.position.z));
}

bool Director::match_auto(const Entity& e, const Value& when) const {
  if (is_nullish(when)) return true;
  const Value mp_gt = field_or(when, u"mp_gt");
  if (!is_nullish(mp_gt) && !(e.mp() > to_number(mp_gt))) return false;

  auto matches_any = [this, &e](const Value& names) {
    const Value state = e.state();
    if (const Array* const arr = as_array(names)) {
      for (const Value& v : arr->items()) {
        const std::optional<double> s = state_value_of(as_str_or_empty(v));
        if (s && strict_equals(state, Value(*s))) return true;
      }
      return false;
    }
    const std::optional<double> s = state_value_of(as_str_or_empty(names));
    return s && strict_equals(state, Value(*s));
  };

  const Value state_when = field_or(when, u"state");
  if (!is_nullish(state_when) && !matches_any(state_when)) return false;
  const Value state_not = field_or(when, u"state_not");
  if (!is_nullish(state_not) && matches_any(state_not)) return false;

  const Value frame_hit = field_or(when, u"frame_hit");
  if (!is_nullish(frame_hit)) {
    const Value hit = field_or(e.frame_info(), u"hit");
    if (as_object(hit) == nullptr) return false;
    const std::u16string hit_key = as_str_or_empty(frame_hit);
    if (!truthy(field_or(hit, hit_key.c_str()))) return false;
  }
  return true;
}

double Director::expr(const Value& value) const {
  const std::optional<double> n = utils::eval_number(value, eval_ctx());
  // TS 在表达式写错时 `throw`（整局崩）；端口没有异常 ⇒ 按 0 处理（数据错误由
  // `eval_number` 的 `nullopt` 表达，将来在装载期报警）。
  return n.has_value() ? *n : 0.0;
}

}
}
