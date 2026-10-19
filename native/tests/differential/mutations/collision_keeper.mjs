/**
 * Mutation spec for `native/lfw/collision/keeper.cpp`.
 *
 * This unit currently covers the *registry* half of `CollisionKeeper.ts`
 * (`pack_a`/`pack_b`/`is_u8,u12,u16`/`add`/`register`/`load_handlers` plus the
 * `HANDLER_CONFIGS` table and the `collisions_keeper` singleton). `handle()` is
 * deliberately left for the follow-up unit: it needs the entity-side
 * `collided_list` / `collision_list` surfaces, the `collision_action_handlers`
 * dispatch and a `IFrozenEntity` adapter for `handle_ball_frozen`, none of which
 * exist yet. Shipping `handle()` now would make most of this subject's diff test
 * the seams instead of the unit.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `pack_a`'s and `pack_b`'s shift constants are unobservable: both helpers are
 *    used by `add` (insertion) and by `load_handlers` (lookup), so any *consistent*
 *    change of the shift moves both sides together and the mapping stays injective
 *    for every real kind (a shift of 11 would only collide once `itr_kind` reached
 *    2**11, which the `is_u12` guard forbids). The observable forms are the ones
 *    that make `pack_a` / `pack_b` ignore one of their arguments, covered below.
 *    Likewise `|` -> `+` is unobservable because the shifted operands never overlap.
 * 2. The *integer* half of the guards (`*d == floor(*d)`) is unobservable for the
 *    `Value` overload: a fractional kind such as `1.5` truncates to `1` inside
 *    `static_cast<int32_t>` and the packed key still misses the table, so both the
 *    guarded and the unguarded run return `false`. A non numeric kind *is*
 *    observable (the `std::get_if<double>` arm) and is covered below.
 * 3. The *range* halves (`< 256` / `< 4096` / `< 65536`) cannot be reached from
 *    in-contract inputs: every registered `a_type`/`v_type` is one of 4/8/16/32 and
 *    every `itr`/`bdy` kind is far below its ceiling, so raising or lowering the
 *    ceiling without crossing a *real* value changes nothing. The observable form
 *    is a ceiling that rejects a real value (`< 4`) and is covered below.
 * 4. `found->empty()` is never true: `NestedMap::ref` only creates an inner entry
 *    while pushing, so a key that exists always holds at least one entry.
 * 5. `g_env.attacker_state()` is never read: no entry in `HANDLER_CONFIGS` passes an
 *    `a_state`, so `has_a_state` is `false` everywhere and the a_state filter never
 *    runs. Its counterpart (`victim_state`) *is* exercised by the weapon entries.
 *    The observable consequence of that fact (dropping the `has_*_state` flag from
 *    the filter) is covered below.
 * 6. `if (collision.handlers) ... else ...` inverted is unobservable: both arms end
 *    up with an empty handler vector.
 * 7. `handle_body_goto` is registered under the TS alias `handle_criminal_hit`, but
 *    `Function.prototype.name` reports the *declared* name, so the port stores
 *    `"handle_body_goto"`. The case asserts that string.
 */
export default {
  subject: "collision_keeper",
  mutations: [
    {
      note: "pack_a drops the itr kind from the key",
      file: "native/lfw/collision/keeper.cpp",
      from: "  return static_cast<double>((static_cast<int32_t>(a_type) << 12) | static_cast<int32_t>(itr_kind));",
      to: "  return static_cast<double>((static_cast<int32_t>(a_type) << 12));",
    },
    {
      note: "pack_b drops the bdy kind from the key",
      file: "native/lfw/collision/keeper.cpp",
      from: "  return static_cast<double>((static_cast<int32_t>(v_type) << 16) | static_cast<int32_t>(bdy_kind));",
      to: "  return static_cast<double>((static_cast<int32_t>(v_type) << 16));",
    },
    {
      note: "pack_a packs one past the attacker type",
      file: "native/lfw/collision/keeper.cpp",
      from: "      const double k1 = pack_a(static_cast<double>(a_type), static_cast<double>(itr_kind));",
      to: "      const double k1 = pack_a(static_cast<double>(a_type) + 1.0, static_cast<double>(itr_kind));",
    },
    {
      note: "pack_b packs the attacker type",
      file: "native/lfw/collision/keeper.cpp",
      from: "          const double k2 = pack_b(static_cast<double>(v_type), static_cast<double>(bdy_kind));",
      to: "          const double k2 = pack_b(static_cast<double>(a_type), static_cast<double>(bdy_kind));",
    },
    {
      note: "lookup uses the packed keys swapped",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const std::optional<std::vector<KeeperEntry>> found = _pair_map.get(k1, k2);",
      to: "  const std::optional<std::vector<KeeperEntry>> found = _pair_map.get(k2, k1);",
    },
    {
      note: "registration overwrites instead of appending",
      file: "native/lfw/collision/keeper.cpp",
      from: "          _pair_map.ref(k1, k2).push_back(entry);",
      to: "          _pair_map.ref(k1, k2) = {entry};",
    },
    {
      note: "entry keeps a bogus handler name",
      file: "native/lfw/collision/keeper.cpp",
      from: "  entry.fn = fn;",
      to: '  entry.fn = u"bogus";',
    },
    {
      note: "a_state sentinel test inverted",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (a_state_list != nullptr) {\n    entry.has_a_state = true;\n    entry.a_state = *a_state_list;\n  }",
      to: "  if (a_state_list == nullptr) {\n    entry.has_a_state = true;\n    entry.a_state = *a_state_list;\n  }",
    },
    {
      note: "register always passes the a_state list",
      file: "native/lfw/collision/keeper.cpp",
      from: "    add(cfg.a_type, cfg.itr, cfg.v_type, cfg.bdy, cfg.handler,\n        cfg.has_a_state ? &cfg.a_state : nullptr, cfg.has_v_state ? &cfg.v_state : nullptr);",
      to: "    add(cfg.a_type, cfg.itr, cfg.v_type, cfg.bdy, cfg.handler, &cfg.a_state, &cfg.v_state);",
    },
    {
      note: "register passes the victim state list as the attacker state list",
      file: "native/lfw/collision/keeper.cpp",
      from: "    add(cfg.a_type, cfg.itr, cfg.v_type, cfg.bdy, cfg.handler,\n        cfg.has_a_state ? &cfg.a_state : nullptr, cfg.has_v_state ? &cfg.v_state : nullptr);",
      to: "    add(cfg.a_type, cfg.itr, cfg.v_type, cfg.bdy, cfg.handler,\n        cfg.has_v_state ? &cfg.v_state : nullptr, cfg.has_v_state ? &cfg.v_state : nullptr);",
    },
    {
      note: "register passes the attacker state list as the victim state list",
      file: "native/lfw/collision/keeper.cpp",
      from: "    add(cfg.a_type, cfg.itr, cfg.v_type, cfg.bdy, cfg.handler,\n        cfg.has_a_state ? &cfg.a_state : nullptr, cfg.has_v_state ? &cfg.v_state : nullptr);",
      to: "    add(cfg.a_type, cfg.itr, cfg.v_type, cfg.bdy, cfg.handler,\n        cfg.has_a_state ? &cfg.a_state : nullptr, cfg.has_a_state ? &cfg.a_state : nullptr);",
    },
    {
      note: "handlers are not cleared before the lookup",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (collision.handlers) {\n    collision.handlers->clear();\n  } else {\n    collision.handlers = std::make_shared<std::vector<std::u16string>>();\n  }",
      to: "  if (!collision.handlers) {\n    collision.handlers = std::make_shared<std::vector<std::u16string>>();\n  }",
    },
    {
      note: "attacker type read from the victim",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const double a_type = collision.attacker.data_type();",
      to: "  const double a_type = collision.victim.data_type();",
    },
    {
      note: "victim type read from the attacker",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const double v_type = collision.victim.data_type();",
      to: "  const double v_type = collision.attacker.data_type();",
    },
    {
      note: "itr kind key misspelled",
      file: "native/lfw/collision/keeper.cpp",
      from: '  const Value itr_kind = field_or(collision.itr, u"kind");',
      to: '  const Value itr_kind = field_or(collision.itr, u"kinds");',
    },
    {
      note: "bdy kind key misspelled",
      file: "native/lfw/collision/keeper.cpp",
      from: '  const Value bdy_kind = field_or(collision.bdy, u"kind");',
      to: '  const Value bdy_kind = field_or(collision.bdy, u"kinds");',
    },
    {
      note: "non numeric itr kind is accepted",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const double* d = std::get_if<double>(&v);\n  if (d == nullptr) return false;",
      to: "  const double* d = std::get_if<double>(&v);\n  if (d == nullptr) return true;",
    },
    {
      note: "victim state guard is dropped",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!is_integer_in_range(v_type, 256.0)) return false;",
      to: "  if (!is_integer_in_range(v_type, 256.0)) return true;",
    },
    {
      note: "bdy kind guard is dropped",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!is_integer_in_range(bdy_kind, 65536.0)) return false;",
      to: "  if (!is_integer_in_range(bdy_kind, 65536.0)) return true;",
    },
    {
      note: "attacker type guard rejects a real type",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!is_integer_in_range(a_type, 256.0)) return false;",
      to: "  if (!is_integer_in_range(a_type, 4.0)) return false;",
    },
    {
      note: "itr kind guard rejects real kinds",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!is_integer_in_range(itr_kind, 4096.0)) return false;",
      to: "  if (!is_integer_in_range(itr_kind, 4.0)) return false;",
    },
    {
      note: "bdy kind guard rejects real kinds",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!is_integer_in_range(bdy_kind, 65536.0)) return false;",
      to: "  if (!is_integer_in_range(bdy_kind, 4.0)) return false;",
    },
    {
      note: "lower bound of the integer guard excludes zero",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!(*d == std::floor(*d))) return false;\n  return *d >= 0 && *d < hi;",
      to: "  if (!(*d == std::floor(*d))) return false;\n  return *d > 0 && *d < hi;",
    },
    {
      note: "attacker state filter ignores the sentinel flag",
      file: "native/lfw/collision/keeper.cpp",
      from: "    if (e.has_a_state && !list_includes(e.a_state, a_state)) continue;",
      to: "    if (!list_includes(e.a_state, a_state)) continue;",
    },
    {
      note: "victim state filter ignores the sentinel flag",
      file: "native/lfw/collision/keeper.cpp",
      from: "    if (e.has_v_state && !list_includes(e.v_state, b_state)) continue;",
      to: "    if (!list_includes(e.v_state, b_state)) continue;",
    },
    {
      note: "victim state filter inverted",
      file: "native/lfw/collision/keeper.cpp",
      from: "    if (e.has_v_state && !list_includes(e.v_state, b_state)) continue;",
      to: "    if (e.has_v_state && list_includes(e.v_state, b_state)) continue;",
    },
    {
      note: "victim state filter reads the attacker state list",
      file: "native/lfw/collision/keeper.cpp",
      from: "    if (e.has_v_state && !list_includes(e.v_state, b_state)) continue;",
      to: "    if (e.has_v_state && !list_includes(e.a_state, b_state)) continue;",
    },
    {
      note: "victim state filter reads the attacker state",
      file: "native/lfw/collision/keeper.cpp",
      from: "    if (e.has_v_state && !list_includes(e.v_state, b_state)) continue;",
      to: "    if (e.has_v_state && !list_includes(e.v_state, a_state)) continue;",
    },
    {
      note: "handlers are never collected",
      file: "native/lfw/collision/keeper.cpp",
      from: "    collision.handlers->push_back(e.fn);",
      to: "    (void)e;",
    },
    {
      note: "success is reported unconditionally",
      file: "native/lfw/collision/keeper.cpp",
      from: "  return !collision.handlers->empty();",
      to: "  return true;",
    },
    {
      note: "success is never reported",
      file: "native/lfw/collision/keeper.cpp",
      from: "  return !collision.handlers->empty();",
      to: "  return false;",
    },
    {
      note: "all entity enum loses Ball",
      file: "native/lfw/collision/keeper.cpp",
      from: "  static const std::vector<EntityEnum> e = {EntityEnum::Entity, EntityEnum::Fighter,\n                                            EntityEnum::Weapon, EntityEnum::Ball};",
      to: "  static const std::vector<EntityEnum> e = {EntityEnum::Entity, EntityEnum::Fighter,\n                                            EntityEnum::Weapon};",
    },
    {
      note: "all entity enum loses Fighter",
      file: "native/lfw/collision/keeper.cpp",
      from: "  static const std::vector<EntityEnum> e = {EntityEnum::Entity, EntityEnum::Fighter,\n                                            EntityEnum::Weapon, EntityEnum::Ball};",
      to: "  static const std::vector<EntityEnum> e = {EntityEnum::Entity,\n                                            EntityEnum::Weapon, EntityEnum::Ball};",
    },
    {
      note: "catch entry loses ForceCatch",
      file: "native/lfw/collision/keeper.cpp",
      from: "          {ItrKind::Catch, ItrKind::ForceCatch},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal, BdyKind::Defend},\n          u\"handle_itr_catch\",",
      to: "          {ItrKind::Catch},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal, BdyKind::Defend},\n          u\"handle_itr_catch\",",
    },
    {
      note: "catch entry only accepts the normal bdy",
      file: "native/lfw/collision/keeper.cpp",
      from: "          {ItrKind::Catch, ItrKind::ForceCatch},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal, BdyKind::Defend},\n          u\"handle_itr_catch\",",
      to: "          {ItrKind::Catch, ItrKind::ForceCatch},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal},\n          u\"handle_itr_catch\",",
    },
    {
      note: "healing entry registered for the freeze itr",
      file: "native/lfw/collision/keeper.cpp",
      from: '          {ItrKind::Heal},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal},\n          u"handle_healing",',
      to: '          {ItrKind::Freeze},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal},\n          u"handle_healing",',
    },
    {
      note: "pick entry only accepts the light weapon ground state",
      file: "native/lfw/collision/keeper.cpp",
      from: "          {StateEnum::Weapon_OnGround, StateEnum::HeavyWeapon_OnGround},\n          false,\n          true,",
      to: "          {StateEnum::Weapon_OnGround},\n          false,\n          true,",
    },
    {
      note: "short weapon-is-hit entry accepts the wrong ground state",
      file: "native/lfw/collision/keeper.cpp",
      from: "          {StateEnum::Weapon_OnGround},\n          false,\n          true,",
      to: "          {StateEnum::HeavyWeapon_InTheSky},\n          false,\n          true,",
    },
    {
      note: "long weapon-is-hit entry loses the in-the-sky state",
      file: "native/lfw/collision/keeper.cpp",
      from: "          {StateEnum::HeavyWeapon_OnGround, StateEnum::HeavyWeapon_InTheSky,\n           StateEnum::HeavyWeapon_JustOnGround, StateEnum::Weapon_Throwing,\n           StateEnum::Weapon_InTheSky, StateEnum::Weapon_Rebounding},",
      to: "          {StateEnum::HeavyWeapon_OnGround,\n           StateEnum::HeavyWeapon_JustOnGround, StateEnum::Weapon_Throwing,\n           StateEnum::Weapon_Rebounding},",
    },
    {
      note: "block entry registered for the normal itr",
      file: "native/lfw/collision/keeper.cpp",
      from: '          {ItrKind::Block},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal},\n          u"handle_rest",',
      to: '          {ItrKind::Normal},\n          {EntityEnum::Fighter},\n          {BdyKind::Normal},\n          u"handle_rest",',
    },
    {
      note: "ball-hit-other entry handler renamed",
      file: "native/lfw/collision/keeper.cpp",
      from: '          u"handle_ball_hit_other",',
      to: '          u"handle_ball_hit_other_",',
    },
    {
      note: "ball-is-hit-b entry handler renamed",
      file: "native/lfw/collision/keeper.cpp",
      from: '          u"handle_ball_is_hit_b",',
      to: '          u"handle_ball_is_hit_B",',
    },
    {
      note: "john shield ball entry only accepts weapons",
      file: "native/lfw/collision/keeper.cpp",
      from: '          {ItrKind::JohnShield},\n          {EntityEnum::Ball},\n          {BdyKind::Normal},\n          u"handle_john_shield_hit_other_ball",',
      to: '          {ItrKind::JohnShield},\n          {EntityEnum::Weapon},\n          {BdyKind::Normal},\n          u"handle_john_shield_hit_other_ball",',
    },
    {
      note: "criminal entry accepts the normal bdy",
      file: "native/lfw/collision/keeper.cpp",
      from: '          {BdyKind::Criminal},\n          u"handle_body_goto",',
      to: '          {BdyKind::Normal},\n          u"handle_body_goto",',
    },
    {
      note: "criminal entry handler renamed",
      file: "native/lfw/collision/keeper.cpp",
      from: '          u"handle_body_goto",',
      to: '          u"handle_criminal_hit",',
    },
  ],
};
