/**
 * Mutation spec for `native/lfw/collision/handlers4.cpp`.
 *
 * Disproven / unobservable mutations (proven by reading both sources, not by a
 * surviving run):
 *
 * 1. `if (a == nullptr || v == nullptr) return;` -> `&&`. The differential harness
 *    always registers both ids (`A` and `V`) in `find_entity`, so neither ever
 *    resolves to null and the two variants are indistinguishable. The guard itself
 *    is a port artefact: the TS source destructures `collision.attacker/victim`
 *    directly and has no equivalent check.
 * 2. `if (a == nullptr) return;` (weapon path) -> dropped line. `a` is always
 *    resolvable, so removing the guard cannot change the observed trace.
 *    For the same reason the `if (a == nullptr || v == nullptr) return;` and
 *    `if (a == nullptr) return;` guards cannot be inverted into `!=`.
 * 2b. `if (state_is(a->state(), StateEnum::Weapon_OnHand)) return;` -> dropped
 *    line. The only state it short-circuits is `Weapon_OnHand`, and the very next
 *    statement (`if (!state_is(state, Weapon_Throwing)) return;`) returns for that
 *    same state, so the observable trace is identical. The TS source has the same
 *    redundancy (a guard followed by a `switch` with a single `Weapon_Throwing`
 *    case), so this is faithful, not a port defect. Mutations that make the guard
 *    *fire on other states* (inverting it, or comparing `Weapon_Throwing`) are
 *    observable and are included below.
 * 3. Reordering the three `const double vx/vy/vz = a->velocity.{x,y,z};` lines ->
 *    unobservable. Each declaration carries its own initialiser, so moving the
 *    lines around still maps every name to the same component. (The port no longer
 *    calls the old out-param form `a->velocity(vx, vy, vz)`; the components are
 *    read directly. Mutating *which component* a name reads is observable and is
 *    anchored below.)
 * 4. The TS `switch (aframe.behavior)` lists `DennisChase`, `Boomerang`,
 *    `AngelBlessing`, `AngelBlessingStart`, `DevilJudgementStart`,
 *    `ChasingSameEnemy`, `BatStart`, `FirzenDisasterStart`, `JohnBiscuitLeaving`,
 *    `FirzenVolcanoStart`, `Bat`, `JulianBallStart` and `JulianBall` as cases whose
 *    bodies are a bare `break`. Such a switch is semantically identical to omitting
 *    those labels entirely, so the port drops them and no mutation can be anchored
 *    on them.
 * 5. `if (truthy(bdefend) && ge(bdefend, Defines.DEFAULT_FORCE_BREAK_DEFEND_VALUE))`
 *    -> dropping the `truthy(bdefend) &&` prefix. No JavaScript value is falsy
 *    while also satisfying `value >= 200`: `>=` forces `ToNumber`, every numeric
 *    result `>= 200` is non-zero and therefore truthy, and each remaining falsy
 *    value (`0`, `-0`, `""`, `null`, `undefined`, `false`, `NaN`) either coerces
 *    below 200 or to `NaN` -- and the port's `ge` returns false when `ToNumber`
 *    yields `NaN` (it propagates `std::nullopt` from `less_than`). The prefix is
 *    therefore dead code in the TS original and in the port alike.
 */
export default {
  subject: "collision_handlers4",
  mutations: [
    {
      note: "zero_hp: hp_r is zeroed with 1 instead of 0",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  e.set_hp_r(0.0);",
      to: "  e.set_hp_r(1.0);",
    },
    {
      note: "zero_hp: hp is zeroed with 1 instead of 0",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  e.set_hp(0.0);",
      to: "  e.set_hp(1.0);",
    },
    {
      note: "zero_hp: assignment order swapped (TS assigns hp_r first)",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  e.set_hp_r(0.0);\n  e.set_hp(0.0);",
      to: "  e.set_hp(0.0);\n  e.set_hp_r(0.0);",
    },
    {
      note: "zero_hp: hp_r written through the hp setter",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  e.set_hp_r(0.0);\n  e.set_hp(0.0);",
      to: "  e.set_hp(0.0);\n  e.set_hp(0.0);",
    },
    {
      note: "state_is: comparison inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  return strict_equals(state, Value(static_cast<double>(want)));",
      to: "  return !strict_equals(state, Value(static_cast<double>(want)));",
    },
    {
      note: "handle_ball_hit_other: enemy rest handling removed",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  handle_rest(c);\n  handle_stiffness(c);",
      to: "  handle_stiffness(c);",
    },
    {
      note: "handle_ball_hit_other: stiffness handling removed",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  handle_rest(c);\n  handle_stiffness(c);",
      to: "  handle_rest(c);",
    },
    {
      note: "handle_ball_hit_other: rest and stiffness swapped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  handle_rest(c);\n  handle_stiffness(c);",
      to: "  handle_stiffness(c);\n  handle_rest(c);",
    },
    {
      note: "handle_ball_hit_other: attacker looked up by the victim id",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.vid);",
      to: "  Entity* a = g_env.find_entity(c.vid);\n  Entity* v = g_env.find_entity(c.vid);",
    },
    {
      note: "handle_ball_hit_other: victim looked up by the attacker id",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.vid);",
      to: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.aid);",
    },
    {
      note: "handle_ball_hit_other: aframe key misspelled",
      file: "native/lfw/collision/handlers4.cpp",
      from: '  if (strict_equals(field_or(c.aframe, u"behavior"),',
      to: '  if (strict_equals(field_or(c.aframe, u"behaviours"),',
    },
    {
      note: "handle_ball_hit_other: behavior compared as the string form",
      file: "native/lfw/collision/handlers4.cpp",
      from: "                    Value(static_cast<double>(FrameBehavior::JohnChase)))) {",
      to: "                    Value(u\"JohnChase\"))) {",
    },
    {
      note: "handle_ball_hit_other: behavior compared against DennisChase",
      file: "native/lfw/collision/handlers4.cpp",
      from: "                    Value(static_cast<double>(FrameBehavior::JohnChase)))) {",
      to: "                    Value(static_cast<double>(FrameBehavior::DennisChase)))) {",
    },
    {
      note: "handle_ball_hit_other: behavior check inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: '  if (strict_equals(field_or(c.aframe, u"behavior"),',
      to: '  if (!strict_equals(field_or(c.aframe, u"behavior"),',
    },
    {
      note: "handle_ball_hit_other: fighter test inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    if (g_env.is_fighter(*v)) {",
      to: "    if (!g_env.is_fighter(*v)) {",
    },
    {
      note: "handle_ball_hit_other: bdy kind read from itr",
      file: "native/lfw/collision/handlers4.cpp",
      from: '      const Value kind = field_or(c.bdy, u"kind");',
      to: '      const Value kind = field_or(c.itr, u"kind");',
    },
    {
      note: "handle_ball_hit_other: bdy kind key misspelled",
      file: "native/lfw/collision/handlers4.cpp",
      from: '      const Value kind = field_or(c.bdy, u"kind");',
      to: '      const Value kind = field_or(c.bdy, u"kinds");',
    },
    {
      note: "handle_ball_hit_other: Normal branch compares Criminal",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      if (strict_equals(kind, Value(static_cast<double>(BdyKind::Normal)))) {",
      to: "      if (strict_equals(kind, Value(static_cast<double>(BdyKind::Criminal)))) {",
    },
    {
      note: "handle_ball_hit_other: Normal branch inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      if (strict_equals(kind, Value(static_cast<double>(BdyKind::Normal)))) {",
      to: "      if (!strict_equals(kind, Value(static_cast<double>(BdyKind::Normal)))) {",
    },
    {
      note: "handle_ball_hit_other: Defend branch compares Ignore",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      } else if (strict_equals(kind, Value(static_cast<double>(BdyKind::Defend)))) {",
      to: "      } else if (strict_equals(kind, Value(static_cast<double>(BdyKind::Ignore)))) {",
    },
    {
      note: "handle_ball_hit_other: Defend branch inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      } else if (strict_equals(kind, Value(static_cast<double>(BdyKind::Defend)))) {",
      to: "      } else if (!strict_equals(kind, Value(static_cast<double>(BdyKind::Defend)))) {",
    },
    {
      note: "handle_ball_hit_other: Defend branch behaves like the Normal branch",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      } else if (strict_equals(kind, Value(static_cast<double>(BdyKind::Defend)))) {",
      to: "      } else if (strict_equals(kind, Value(static_cast<double>(BdyKind::Defend)))) {\n        zero_hp(*a);",
    },
    {
      note: "handle_ball_hit_other: bdefend key misspelled",
      file: "native/lfw/collision/handlers4.cpp",
      from: '        const Value bdefend = field_or(c.itr, u"bdefend");',
      to: '        const Value bdefend = field_or(c.itr, u"bdefends");',
    },
    {
      note: "handle_ball_hit_other: bdefend taken from bdy",
      file: "native/lfw/collision/handlers4.cpp",
      from: '        const Value bdefend = field_or(c.itr, u"bdefend");',
      to: '        const Value bdefend = field_or(c.bdy, u"bdefend");',
    },
    {
      note: "handle_ball_hit_other: force-break guard negates truthiness",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "        if (!truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "handle_ball_hit_other: force-break guard uses or",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "        if (truthy(bdefend) || ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "handle_ball_hit_other: force-break comparison is strict",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "        if (truthy(bdefend) && gt(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "handle_ball_hit_other: force-break comparison flipped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "        if (truthy(bdefend) && le(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "handle_ball_hit_other: force-break comparison operands swapped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "        if (truthy(bdefend) && ge(Value(kDefaultForceBreakDefendValue), bdefend)) {",
    },
    {
      note: "handle_ball_hit_other: force-break threshold uses the break-defend default",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultBreakDefendValue))) {",
    },
    {
      note: "handle_ball_hit_other: force-break threshold shifted by one",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue + 1.0))) {",
    },
    {
      note: "handle_ball_hit_other: facing comparison inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {",
      to: "        } else if (!strict_equals(Value(v->facing), Value(a->facing))) {",
    },
    {
      note: "handle_ball_hit_other: victim facing compared against itself",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {",
      to: "        } else if (strict_equals(Value(v->facing), Value(v->facing))) {",
    },
    {
      note: "handle_ball_hit_other: attacker facing compared against itself",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {",
      to: "        } else if (strict_equals(Value(a->facing), Value(a->facing))) {",
    },
    {
      note: "handle_ball_hit_other: victim facing replaced by base type",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {",
      to: "        } else if (strict_equals(Value(v->base_type()), Value(a->facing))) {",
    },
    {
      note: "handle_ball_hit_other: attacker facing replaced by state",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {",
      to: "        } else if (strict_equals(Value(v->facing), Value(a->state()))) {",
    },
    {
      note: "handle_ball_hit_other: Normal branch zeroes the victim",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      if (strict_equals(kind, Value(static_cast<double>(BdyKind::Normal)))) {\n        zero_hp(*a);",
      to: "      if (strict_equals(kind, Value(static_cast<double>(BdyKind::Normal)))) {\n        zero_hp(*v);",
    },
    {
      note: "handle_ball_hit_other: force-break branch zeroes the victim",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n          zero_hp(*a);",
      to: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n          zero_hp(*v);",
    },
    {
      note: "handle_ball_hit_other: facing branch zeroes the victim",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {\n          zero_hp(*a);",
      to: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {\n          zero_hp(*v);",
    },
    {
      note: "handle_ball_hit_other: force-break branch skipped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n          zero_hp(*a);\n        } else if",
      to: "        if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n        } else if",
    },
    {
      note: "handle_ball_hit_other: facing branch skipped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {\n          zero_hp(*a);\n        }",
      to: "        } else if (strict_equals(Value(v->facing), Value(a->facing))) {\n        }",
    },
    {
      note: "handle_ball_hit_other: sound payload taken from the frame id",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->play_sound(a->data_base_hit_sounds());",
      to: "  a->play_sound(a->frame_id());",
    },
    {
      note: "handle_ball_hit_other: sound payload taken from the whole data object",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->play_sound(a->data_base_hit_sounds());",
      to: "  a->play_sound(a->data());",
    },
    {
      note: "handle_ball_hit_other: sound emitted on the victim",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->play_sound(a->data_base_hit_sounds());",
      to: "  v->play_sound(a->data_base_hit_sounds());",
    },
    {
      note: "handle_ball_hit_other: hit sound never emitted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->play_sound(a->data_base_hit_sounds());\n}",
      to: "}",
    },
    {
      note: "handle_weapon_hit_other: armed weapon guard compares Weapon_Throwing",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  if (state_is(a->state(), StateEnum::Weapon_OnHand)) return;",
      to: "  if (state_is(a->state(), StateEnum::Weapon_Throwing)) return;",
    },
    {
      note: "handle_weapon_hit_other: armed weapon guard inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  if (state_is(a->state(), StateEnum::Weapon_OnHand)) return;",
      to: "  if (!state_is(a->state(), StateEnum::Weapon_OnHand)) return;",
    },
    {
      note: "handle_weapon_hit_other: base_type read from state",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  const Value base_type = Value(a->base_type());",
      to: "  const Value base_type = Value(a->state());",
    },
    {
      note: "handle_weapon_hit_other: baseball compared instead of drink",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
      to: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball)));",
    },
    {
      note: "handle_weapon_hit_other: drink compared instead of baseball",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||",
      to: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink))) ||",
    },
    {
      note: "handle_weapon_hit_other: base-ball alternatives combined with and",
      file: "native/lfw/collision/handlers4.cpp",
      from: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
      to: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) &&\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
    },
    {
      note: "handle_weapon_hit_other: base-ball test negated",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  const bool is_base_ball =\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
      to: "  const bool is_base_ball = !(\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink))));",
    },
    {
      note: "handle_weapon_hit_other: throwing-state guard removed",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  if (!state_is(a->state(), StateEnum::Weapon_Throwing)) return;\n",
      to: "",
    },
    {
      note: "handle_weapon_hit_other: throwing-state guard compares Weapon_OnHand",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  if (!state_is(a->state(), StateEnum::Weapon_Throwing)) return;",
      to: "  if (!state_is(a->state(), StateEnum::Weapon_OnHand)) return;",
    },
    {
      note: "handle_weapon_hit_other: throwing-state guard inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  if (!state_is(a->state(), StateEnum::Weapon_Throwing)) return;",
      to: "  if (state_is(a->state(), StateEnum::Weapon_Throwing)) return;",
    },
    {
      note: "handle_weapon_hit_other: base-ball branch selection inverted",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  if (is_base_ball) {",
      to: "  if (!is_base_ball) {",
    },
    {
      note: "handle_weapon_hit_other: launch velocity x is five",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(0.0), Value(5.0), Value(0.0));",
      to: "    a->set_velocity(Value(5.0), Value(5.0), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: launch velocity y is zero",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(0.0), Value(5.0), Value(0.0));",
      to: "    a->set_velocity(Value(0.0), Value(0.0), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: launch velocity y is six",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(0.0), Value(5.0), Value(0.0));",
      to: "    a->set_velocity(Value(0.0), Value(6.0), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: launch velocity z is non-zero",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(0.0), Value(5.0), Value(0.0));",
      to: "    a->set_velocity(Value(0.0), Value(5.0), Value(1.0));",
    },
    {
      note: "handle_weapon_hit_other: velocity snapshot reads x and y swapped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    const double vx = a->velocity.x;\n    const double vy = a->velocity.y;\n    const double vz = a->velocity.z;",
      to: "    const double vx = a->velocity.y;\n    const double vy = a->velocity.x;\n    const double vz = a->velocity.z;",
    },
    {
      note: "handle_weapon_hit_other: velocity snapshot reads y into z",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    const double vx = a->velocity.x;\n    const double vy = a->velocity.y;\n    const double vz = a->velocity.z;",
      to: "    const double vx = a->velocity.x;\n    const double vy = a->velocity.z;\n    const double vz = a->velocity.y;",
    },
    {
      note: "handle_weapon_hit_other: damped x coefficient magnitude",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(-0.3 * vx), Value(0.3 * vy), Value(0.0));",
      to: "    a->set_velocity(Value(-0.4 * vx), Value(0.3 * vy), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: damped x coefficient sign",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(-0.3 * vx), Value(0.3 * vy), Value(0.0));",
      to: "    a->set_velocity(Value(0.3 * vx), Value(0.3 * vy), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: damped y coefficient magnitude",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(-0.3 * vx), Value(0.3 * vy), Value(0.0));",
      to: "    a->set_velocity(Value(-0.3 * vx), Value(0.4 * vy), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: damped y coefficient sign",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(-0.3 * vx), Value(0.3 * vy), Value(0.0));",
      to: "    a->set_velocity(Value(-0.3 * vx), Value(-0.3 * vy), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: damped axes swapped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(-0.3 * vx), Value(0.3 * vy), Value(0.0));",
      to: "    a->set_velocity(Value(-0.3 * vy), Value(0.3 * vx), Value(0.0));",
    },
    {
      note: "handle_weapon_hit_other: damped z is non-zero",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    a->set_velocity(Value(-0.3 * vx), Value(0.3 * vy), Value(0.0));",
      to: "    a->set_velocity(Value(-0.3 * vx), Value(0.3 * vy), Value(1.0));",
    },
    {
      note: "handle_weapon_hit_other: damped source velocity not read",
      file: "native/lfw/collision/handlers4.cpp",
      from: "    const double vx = a->velocity.x;\n    const double vy = a->velocity.y;\n    const double vz = a->velocity.z;",
      to: "    const double vx = a->velocity.z;\n    const double vy = a->velocity.y;\n    const double vz = a->velocity.z;",
    },
    {
      note: "handle_weapon_hit_other: align frame resolved from arest instead of frame id",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  const Value nf = g_env.find_align_frame(c, a->frame_id(), a->data_indexes_of(u\"throwings\"),",
      to: "  const Value nf = g_env.find_align_frame(c, Value(a->arest()), a->data_indexes_of(u\"throwings\"),",
    },
    {
      note: "handle_weapon_hit_other: throwings indexes replaced by sky indexes",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  const Value nf = g_env.find_align_frame(c, a->frame_id(), a->data_indexes_of(u\"throwings\"),\n                                          a->data_indexes_in_the_skys());",
      to: "  const Value nf = g_env.find_align_frame(c, a->frame_id(), a->data_indexes_in_the_skys(),\n                                          a->data_indexes_in_the_skys());",
    },
    {
      note: "handle_weapon_hit_other: sky indexes replaced by throwings indexes",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  const Value nf = g_env.find_align_frame(c, a->frame_id(), a->data_indexes_of(u\"throwings\"),\n                                          a->data_indexes_in_the_skys());",
      to: "  const Value nf = g_env.find_align_frame(c, a->frame_id(), a->data_indexes_of(u\"throwings\"),\n                                          a->data_indexes_of(u\"throwings\"));",
    },
    {
      note: "handle_weapon_hit_other: frame id argument replaced by base type",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  const Value nf = g_env.find_align_frame(c, a->frame_id(), a->data_indexes_of(u\"throwings\"),",
      to: "  const Value nf = g_env.find_align_frame(c, Value(a->base_type()), a->data_indexes_of(u\"throwings\"),",
    },
    {
      note: "handle_weapon_hit_other: arest snapshot taken from the frame id",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  const Value arest = Value(a->arest());",
      to: "  const Value arest = Value(a->frame_id());",
    },
    {
      note: "handle_weapon_hit_other: arest restored after the frame transition is skipped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->enter_frame(nf);\n  a->set_arest(to_number(arest));\n  a->set_dropping(true);",
      to: "  a->enter_frame(nf);\n  a->set_dropping(true);",
    },
    {
      note: "handle_weapon_hit_other: frame transition not entered",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->enter_frame(nf);\n  a->set_arest(to_number(arest));\n  a->set_dropping(true);",
      to: "  a->set_arest(to_number(arest));\n  a->set_dropping(true);",
    },
    {
      note: "handle_weapon_hit_other: arest restore and frame transition swapped",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->enter_frame(nf);\n  a->set_arest(to_number(arest));\n  a->set_dropping(true);",
      to: "  a->set_arest(to_number(arest));\n  a->enter_frame(nf);\n  a->set_dropping(true);",
    },
    {
      note: "handle_weapon_hit_other: align frame result replaced by the current frame id",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->enter_frame(nf);",
      to: "  a->enter_frame(a->frame_id());",
    },
    {
      note: "handle_weapon_hit_other: dropping flag never set",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->set_arest(to_number(arest));\n  a->set_dropping(true);",
      to: "  a->set_arest(to_number(arest));",
    },
    {
      note: "handle_weapon_hit_other: dropping flag set to false",
      file: "native/lfw/collision/handlers4.cpp",
      from: "  a->set_dropping(true);",
      to: "  a->set_dropping(false);",
    },
  ],
};
