#include "lfw/collision/keeper.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <optional>
#include <variant>

#include "lfw/core/js_string.h"
#include "lfw/defines/bdy_kind.h"
#include "lfw/defines/itr_kind.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace collision {
namespace {

KeeperEnv g_env;

double pack_a(double a_type, double itr_kind) {
  return static_cast<double>((static_cast<int32_t>(a_type) << 12) | static_cast<int32_t>(itr_kind));
}

double pack_b(double v_type, double bdy_kind) {
  return static_cast<double>((static_cast<int32_t>(v_type) << 16) | static_cast<int32_t>(bdy_kind));
}

bool is_integer_in_range(const Value& v, double hi) {
  const double* d = std::get_if<double>(&v);
  if (d == nullptr) return false;
  if (!(*d == std::floor(*d))) return false;
  return *d >= 0 && *d < hi;
}

bool is_integer_in_range(double d, double hi) {
  if (!(d == std::floor(d))) return false;
  return d >= 0 && d < hi;
}

bool list_includes(const std::vector<StateEnum>& list, double state) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (static_cast<double>(list[i]) == state) return true;
  }
  return false;
}

const std::vector<EntityEnum>& all_entity_enum() {
  static const std::vector<EntityEnum> e = {EntityEnum::Entity, EntityEnum::Fighter,
                                            EntityEnum::Weapon, EntityEnum::Ball};
  return e;
}

const std::vector<HandlerConfig>& handler_configs() {
  static const std::vector<HandlerConfig> c = {
      {
          all_entity_enum(),
          {ItrKind::Catch, ItrKind::ForceCatch},
          {EntityEnum::Fighter},
          {BdyKind::Normal, BdyKind::Defend},
          u"handle_itr_catch",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::Whirlwind},
          {EntityEnum::Fighter, EntityEnum::Weapon},
          {BdyKind::Normal, BdyKind::Defend},
          u"handle_itr_kind_whirlwind",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::Freeze},
          {EntityEnum::Fighter},
          {BdyKind::Normal, BdyKind::Defend},
          u"handle_itr_kind_freeze",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::MagicFlute, ItrKind::MagicFlute2},
          {EntityEnum::Fighter, EntityEnum::Weapon},
          {BdyKind::Normal, BdyKind::Defend},
          u"handle_itr_kind_magic_flute",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::Heal},
          {EntityEnum::Fighter},
          {BdyKind::Normal},
          u"handle_healing",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::SuperPunchMe},
          {EntityEnum::Fighter},
          {BdyKind::Normal},
          u"handle_super_punch_me",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::JohnShield, ItrKind::Normal, ItrKind::WeaponSwing, ItrKind::CharacterThrew},
          {EntityEnum::Fighter},
          {BdyKind::Normal},
          u"handle_itr_normal_bdy_normal",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::JohnShield, ItrKind::Normal, ItrKind::WeaponSwing, ItrKind::CharacterThrew},
          {EntityEnum::Fighter},
          {BdyKind::Defend},
          u"handle_itr_normal_bdy_defend",
          {},
          {},
          false,
          false,
      },
      {
          {EntityEnum::Fighter},
          {ItrKind::Pick, ItrKind::PickSecretly},
          {EntityEnum::Weapon},
          {BdyKind::Normal},
          u"handle_weapon_picked",
          {},
          {StateEnum::Weapon_OnGround, StateEnum::HeavyWeapon_OnGround},
          false,
          true,
      },
      {
          all_entity_enum(),
          {ItrKind::JohnShield, ItrKind::Normal, ItrKind::WeaponSwing, ItrKind::CharacterThrew},
          {EntityEnum::Weapon},
          {BdyKind::Normal},
          u"handle_weapon_is_hit",
          {},
          {StateEnum::HeavyWeapon_OnGround, StateEnum::HeavyWeapon_InTheSky,
           StateEnum::HeavyWeapon_JustOnGround, StateEnum::Weapon_Throwing,
           StateEnum::Weapon_InTheSky, StateEnum::Weapon_Rebounding},
          false,
          true,
      },
      {
          {EntityEnum::Weapon, EntityEnum::Ball},
          {ItrKind::Normal},
          {EntityEnum::Weapon},
          {BdyKind::Normal},
          u"handle_weapon_is_hit",
          {},
          {StateEnum::Weapon_OnGround},
          false,
          true,
      },
      {
          all_entity_enum(),
          {ItrKind::Block},
          {EntityEnum::Fighter},
          {BdyKind::Normal},
          u"handle_rest",
          {},
          {},
          false,
          false,
      },
      {
          {EntityEnum::Ball},
          {ItrKind::Normal},
          all_entity_enum(),
          {BdyKind::Normal, BdyKind::Defend},
          u"handle_ball_hit_other",
          {},
          {},
          false,
          false,
      },
      {
          {EntityEnum::Fighter},
          {ItrKind::Normal, ItrKind::WeaponSwing, ItrKind::CharacterThrew},
          {EntityEnum::Ball},
          {BdyKind::Normal},
          u"handle_ball_is_hit_a",
          {},
          {},
          false,
          false,
      },
      {
          {EntityEnum::Weapon},
          {ItrKind::WeaponSwing},
          {EntityEnum::Ball},
          {BdyKind::Normal},
          u"handle_ball_is_hit_a",
          {},
          {},
          false,
          false,
      },
      {
          {EntityEnum::Weapon, EntityEnum::Ball},
          {ItrKind::Normal},
          {EntityEnum::Ball},
          {BdyKind::Normal},
          u"handle_ball_is_hit_b",
          {},
          {},
          false,
          false,
      },
      {
          all_entity_enum(),
          {ItrKind::JohnShield},
          {EntityEnum::Ball},
          {BdyKind::Normal},
          u"handle_john_shield_hit_other_ball",
          {},
          {},
          false,
          false,
      },
      {
          {EntityEnum::Weapon},
          {ItrKind::Normal},
          all_entity_enum(),
          {BdyKind::Normal, BdyKind::Defend},
          u"handle_weapon_hit_other",
          {},
          {},
          false,
          false,
      },
      {
          {EntityEnum::Weapon, EntityEnum::Fighter},
          {ItrKind::WeaponSwing, ItrKind::Normal},
          all_entity_enum(),
          {BdyKind::Criminal},
          u"handle_body_goto",
          {},
          {},
          false,
          false,
      },
  };
  return c;
}

std::u16string enum_name(const std::vector<EnumNumberEntry>& entries, double v) {
  for (size_t i = 0; i < entries.size(); ++i) {
    if (entries[i].value == v) return std::u16string(entries[i].name);
  }
  return std::u16string(u"undefined");
}

bool is_exactly_false(const Value& v) {
  const bool* b = std::get_if<bool>(&v);
  return b != nullptr && !*b;
}

std::vector<std::optional<bool>> compute_tests(const Value& actions, Collision& c) {
  std::vector<std::optional<bool>> out;
  const Array* arr = as_array(actions);
  if (arr == nullptr) return out;
  for (size_t i = 0; i < arr->size(); ++i) {
    const Value& action = arr->at(i);
    if (!truthy(field_or(action, u"pretest"))) {
      out.push_back(std::nullopt);
      continue;
    }
    const Value tester = field_or(action, u"tester");
    if (!truthy(tester)) {
      out.push_back(true);
      continue;
    }
    out.push_back(c.core->tester_run(tester, c) ? true : false);
  }
  return out;
}

void run_actions(const Value& actions, const std::vector<std::optional<bool>>& tests,
                 Collision& c) {
  const Array* arr = as_array(actions);
  if (arr == nullptr) return;
  for (size_t idx = 0; idx < arr->size(); ++idx) {
    const Value& action = arr->at(idx);
    Value test_result;
    if (truthy(field_or(action, u"pretest"))) {
      if (idx < tests.size() && tests[idx].has_value()) test_result = Value(*tests[idx]);
    } else {
      const Value tester = field_or(action, u"tester");
      if (truthy(tester)) test_result = Value(c.core->tester_run(tester, c));
    }
    if (is_exactly_false(test_result)) continue;
    g_env.run_action(to_string(field_or(action, u"type")), action, c);
  }
}

}

const KeeperEnv& keeper_env() { return g_env; }
void set_keeper_env(const KeeperEnv& env) { g_env = env; }

void CollisionKeeper::add(const std::vector<EntityEnum>& a_type_list,
                          const std::vector<ItrKind>& itr_kind_list,
                          const std::vector<EntityEnum>& v_type_list,
                          const std::vector<BdyKind>& bdy_kind_list, const std::u16string& fn,
                          const std::vector<StateEnum>* a_state_list,
                          const std::vector<StateEnum>* v_state_list) {
  KeeperEntry entry;
  entry.fn = fn;
  if (a_state_list != nullptr) {
    entry.has_a_state = true;
    entry.a_state = *a_state_list;
  }
  if (v_state_list != nullptr) {
    entry.has_v_state = true;
    entry.v_state = *v_state_list;
  }
  for (size_t ai = 0; ai < a_type_list.size(); ++ai) {
    const EntityEnum a_type = a_type_list[ai];
    for (size_t ii = 0; ii < itr_kind_list.size(); ++ii) {
      const ItrKind itr_kind = itr_kind_list[ii];
      const double k1 = pack_a(static_cast<double>(a_type), static_cast<double>(itr_kind));
      for (size_t vi = 0; vi < v_type_list.size(); ++vi) {
        const EntityEnum v_type = v_type_list[vi];
        for (size_t bi = 0; bi < bdy_kind_list.size(); ++bi) {
          const BdyKind bdy_kind = bdy_kind_list[bi];
          const double k2 = pack_b(static_cast<double>(v_type), static_cast<double>(bdy_kind));
          _pair_map.ref(k1, k2).push_back(entry);
        }
      }
    }
  }
}

void CollisionKeeper::register_configs(const std::vector<HandlerConfig>& configs) {
  for (size_t i = 0; i < configs.size(); ++i) {
    const HandlerConfig& cfg = configs[i];
    add(cfg.a_type, cfg.itr, cfg.v_type, cfg.bdy, cfg.handler,
        cfg.has_a_state ? &cfg.a_state : nullptr, cfg.has_v_state ? &cfg.v_state : nullptr);
  }
}

bool CollisionKeeper::load_handlers(Collision& collision) const {
  if (collision.handlers) {
    collision.handlers->clear();
  } else {
    collision.handlers = std::make_shared<std::vector<std::u16string>>();
  }

  const double a_type = collision.attacker.data_type();
  const Value itr_kind = field_or(collision.itr, u"kind");
  const double v_type = collision.victim.data_type();
  const Value bdy_kind = field_or(collision.bdy, u"kind");
  const double a_state = g_env.attacker_state(collision);
  const double b_state = g_env.victim_state(collision);

  if (!is_integer_in_range(a_type, 256.0)) return false;
  if (!is_integer_in_range(itr_kind, 4096.0)) return false;
  if (!is_integer_in_range(v_type, 256.0)) return false;
  if (!is_integer_in_range(bdy_kind, 65536.0)) return false;

  const double k1 = pack_a(a_type, to_number(itr_kind));
  const double k2 = pack_b(v_type, to_number(bdy_kind));
  const std::optional<std::vector<KeeperEntry>> found = _pair_map.get(k1, k2);
  if (!found.has_value() || found->empty()) return false;

  const std::vector<KeeperEntry>& list = *found;
  for (size_t i = 0; i < list.size(); ++i) {
    const KeeperEntry& e = list[i];
    if (e.has_a_state && !list_includes(e.a_state, a_state)) continue;
    if (e.has_v_state && !list_includes(e.v_state, b_state)) continue;
    collision.handlers->push_back(e.fn);
  }
  return !collision.handlers->empty();
}

void CollisionKeeper::handle(Collision& collision) const {
  const std::shared_ptr<std::vector<std::u16string>> handlers = collision.handlers;
  if (collision.core->dev() && handlers != nullptr) {
    std::u16string names;
    for (size_t i = 0; i < handlers->size(); ++i) {
      if (i) names += u",";
      names += handlers->at(i);
    }
    const std::u16string itr_name =
        enum_name(itr_kind_entries(), to_number(field_or(collision.itr, u"kind")));
    const std::u16string bdy_name =
        enum_name(bdy_kind_entries(), to_number(field_or(collision.bdy, u"kind")));
    const std::u16string desc = u"[" + number_to_string(collision.attacker.data_type()) + u"]#" +
                                itr_name + u" => [" +
                                number_to_string(collision.victim.data_type()) + u"]#" + bdy_name;
    collision.core->log(u" collision: " + desc + u" \nhandlers: " + names);
  }

  bool ball_hit = false;
  const Value& itr = collision.itr;
  const Value itr_actions = field_or(collision.itr, u"actions");
  const Value bdy_actions = field_or(collision.bdy, u"actions");
  const std::vector<std::optional<bool>> itr_tests = compute_tests(itr_actions, collision);
  const std::vector<std::optional<bool>> bdy_tests = compute_tests(bdy_actions, collision);

  if (handlers != nullptr) {
    for (size_t i = 0; i < handlers->size(); ++i) {
      const std::u16string& fn = handlers->at(i);
      ball_hit = ball_hit || fn == std::u16string(u"handle_ball_is_hit_a") ||
                 fn == std::u16string(u"handle_ball_is_hit_b");
      g_env.call_handler(fn, collision);
    }
  }
  (void)ball_hit;

  if (!g_env.ball_frozen(collision.victim, collision.attacker, itr)) {
    run_actions(itr_actions, itr_tests, collision);
    run_actions(bdy_actions, bdy_tests, collision);
  }

  g_env.victim_push_collided(collision);
  g_env.attacker_push_collision(collision);

  const Value itr_kind = field_or(itr, u"kind");
  const bool silent =
      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Block))) ||
      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Whirlwind))) ||
      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::MagicFlute))) ||
      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::MagicFlute2))) ||
      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Pick))) ||
      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::PickSecretly)));
  if (!silent) {
    // TS: `const sounds = victim.data.base.hit_sounds; victim.play_sound(sounds)` —— 直接读
    // 受击方的数据（**不是** `lfw.datas.find_object(vdata_id)`：那是 4E 那一刀在没有宿主时
    // 的替代写法，本刀接上宿主后改回直读，见 DESIGN §78.6）。
    const Value data = g_env.victim_data(collision);
    g_env.victim_play_sound(collision, field_or(field_or(data, u"base"), u"hit_sounds"));
  }
}

const CollisionKeeper& collisions_keeper() {
  static const CollisionKeeper keeper = [] {
    CollisionKeeper k;
    k.register_configs(handler_configs());
    return k;
  }();
  return keeper;
}

}
}
