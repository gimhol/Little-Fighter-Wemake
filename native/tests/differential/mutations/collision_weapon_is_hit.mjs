/**
 * Mutation spec for `native/lfw/collision/weapon_is_hit.cpp`.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `if (a == nullptr || v == nullptr) return;` -> `&&`, or inverted to `!=`.
 *    The harness always registers both ids (`A` and `V`), so neither lookup can
 *    return null and the variants are indistinguishable. The guard is a port
 *    artefact: the TS original destructures `collision.attacker/victim`.
 * 2. `truthy(bdefend) && ge(bdefend, Defines.DEFAULT_FORCE_BREAK_DEFEND_VALUE)` ->
 *    dropping the `truthy(bdefend) &&` prefix. No JS value is falsy while also
 *    satisfying `value >= 200`: `>=` forces `ToNumber`, every numeric result
 *    `>= 200` is non-zero, and every other falsy value coerces below 200 or to
 *    `NaN` (and the port's `ge` returns false when `ToNumber` yields `NaN`). The
 *    prefix is dead in the TS original and in the port alike.
 * 3. `truthy(fall) && ge(fall, Defines.DEFAULT_FALL_VALUE_CRITICAL)` -> dropping
 *    the `truthy(fall) &&` prefix, for exactly the same reason as (2) with a
 *    threshold of 140. Note this is *not* the same as the `&&` -> `||` mutation,
 *    which is observable and is included below.
 * 4. `if (arr->size() == 0) return Value();` inside `index_0` -> changing the
 *    comparison bound. Any such change makes the empty-`throwings` cases read
 *    `Array::at(0)` out of bounds, i.e. undefined behaviour rather than a defined
 *    divergence, so it is excluded on purpose. The neighbouring `arr->at(0)` index
 *    is mutable and is covered.
 * 5. `const Array* arr = as_array(holder);` -> forcing `nullptr`. That would skip
 *    the array branch entirely; the only remaining sources would be the object
 *    branch and the final `Value()`, and the case file's array inputs would all
 *    fall through to `undefined`. It is therefore observable, and it is included
 *    below as the `as_array` -> `as_object` variant instead.
 */
export default {
  subject: "collision_weapon_is_hit",
  mutations: [
    {
      note: "index_0: reads the second array element",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    return arr->at(0);",
      to: "    return arr->at(1);",
    },
    {
      note: "index_0: reads the keyed object from key 1",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: '    const Value* p = o->get(u"0");',
      to: '    const Value* p = o->get(u"1");',
    },
    {
      note: "index_0: looks the holder up as an object first",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const Array* arr = as_array(holder);",
      to: "  const Array* arr = nullptr;\n  (void)as_array(holder);",
    },
    {
      note: "zero_hp: hp_r is zeroed with 1",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  e.set_hp_r(0.0);",
      to: "  e.set_hp_r(1.0);",
    },
    {
      note: "zero_hp: hp is zeroed with 1",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  e.set_hp(0.0);",
      to: "  e.set_hp(1.0);",
    },
    {
      note: "zero_hp: assignment order swapped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  e.set_hp_r(0.0);\n  e.set_hp(0.0);",
      to: "  e.set_hp(0.0);\n  e.set_hp_r(0.0);",
    },
    {
      note: "enemy rest handling removed",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  handle_rest(c);\n  handle_stiffness(c);\n  handle_injury(c, 1.0, false);",
      to: "  handle_stiffness(c);\n  handle_injury(c, 1.0, false);",
    },
    {
      note: "stiffness handling removed",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  handle_rest(c);\n  handle_stiffness(c);\n  handle_injury(c, 1.0, false);",
      to: "  handle_rest(c);\n  handle_injury(c, 1.0, false);",
    },
    {
      note: "injury handling removed",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  handle_rest(c);\n  handle_stiffness(c);\n  handle_injury(c, 1.0, false);",
      to: "  handle_rest(c);\n  handle_stiffness(c);",
    },
    {
      note: "rest and stiffness swapped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  handle_rest(c);\n  handle_stiffness(c);\n  handle_injury(c, 1.0, false);",
      to: "  handle_stiffness(c);\n  handle_rest(c);\n  handle_injury(c, 1.0, false);",
    },
    {
      note: "injury scale doubled",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  handle_injury(c, 1.0, false);",
      to: "  handle_injury(c, 2.0, false);",
    },
    {
      note: "injury keeps the toughness",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  handle_injury(c, 1.0, false);",
      to: "  handle_injury(c, 1.0, true);",
    },
    {
      note: "attacker resolved from the victim id",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.vid);",
      to: "  Entity* a = g_env.find_entity(c.vid);\n  Entity* v = g_env.find_entity(c.vid);",
    },
    {
      note: "victim resolved from the attacker id",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.vid);",
      to: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.aid);",
    },
    {
      note: "dropping flag never cleared",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  v->set_dropping(false);",
      to: "",
    },
    {
      note: "dropping flag set instead of cleared",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  v->set_dropping(false);",
      to: "  v->set_dropping(true);",
    },
    {
      note: "bdefend key misspelled",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: '  const Value bdefend = field_or(c.itr, u"bdefend");',
      to: '  const Value bdefend = field_or(c.itr, u"bdefends");',
    },
    {
      note: "bdefend read from bdy",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: '  const Value bdefend = field_or(c.itr, u"bdefend");',
      to: '  const Value bdefend = field_or(c.bdy, u"bdefend");',
    },
    {
      note: "force-break guard uses or",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "  if (truthy(bdefend) || ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "force-break guard negates truthiness",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "  if (!truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "force-break comparison is strict",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "  if (truthy(bdefend) && gt(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "force-break comparison flipped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "  if (truthy(bdefend) && le(bdefend, Value(kDefaultForceBreakDefendValue))) {",
    },
    {
      note: "force-break comparison operands swapped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "  if (truthy(bdefend) && ge(Value(kDefaultForceBreakDefendValue), bdefend)) {",
    },
    {
      note: "force-break threshold uses the break-defend default",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultBreakDefendValue))) {",
    },
    {
      note: "force-break threshold shifted by one",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {",
      to: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue + 1.0))) {",
    },
    {
      note: "force-break zeroes the attacker",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n    zero_hp(*v);\n  }",
      to: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n    zero_hp(*a);\n  }",
    },
    {
      note: "force-break branch skipped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n    zero_hp(*v);\n  }",
      to: "  if (truthy(bdefend) && ge(bdefend, Value(kDefaultForceBreakDefendValue))) {\n  }",
    },
    {
      note: "fall key misspelled",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: '  const Value fall = field_or(c.itr, u"fall");',
      to: '  const Value fall = field_or(c.itr, u"falls");',
    },
    {
      note: "fly test uses or",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
      to: "  const bool is_fly = truthy(fall) || ge(fall, Value(kDefaultFallValueCritical));",
    },
    {
      note: "fly test negates truthiness",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
      to: "  const bool is_fly = !truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
    },
    {
      note: "fly comparison is strict",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
      to: "  const bool is_fly = truthy(fall) && gt(fall, Value(kDefaultFallValueCritical));",
    },
    {
      note: "fly comparison flipped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
      to: "  const bool is_fly = truthy(fall) && le(fall, Value(kDefaultFallValueCritical));",
    },
    {
      note: "fly comparison operands swapped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
      to: "  const bool is_fly = truthy(fall) && ge(Value(kDefaultFallValueCritical), fall);",
    },
    {
      note: "fly threshold uses the dizzy default",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
      to: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueDizzy));",
    },
    {
      note: "fly test always true",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_fly = truthy(fall) && ge(fall, Value(kDefaultFallValueCritical));",
      to: "  const bool is_fly = true;",
    },
    {
      note: "spark point uses the b cube as source",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const SparkPoint sp = g_env.spark_point(c, c.a_cube, c.b_cube);",
      to: "  const SparkPoint sp = g_env.spark_point(c, c.b_cube, c.a_cube);",
    },
    {
      note: "spark kind ignores the fly test",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "              is_fly ? spark_enum::kSilentCriticalHit : spark_enum::kSilentHit);",
      to: "              spark_enum::kSilentHit);",
    },
    {
      note: "spark kind branches swapped",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "              is_fly ? spark_enum::kSilentCriticalHit : spark_enum::kSilentHit);",
      to: "              is_fly ? spark_enum::kSilentHit : spark_enum::kSilentCriticalHit);",
    },
    {
      note: "spark x taken from the y component",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  g_env.spark(sp.x, sp.y, sp.z,",
      to: "  g_env.spark(sp.y, sp.y, sp.z,",
    },
    {
      note: "spark y taken from the z component",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  g_env.spark(sp.x, sp.y, sp.z,",
      to: "  g_env.spark(sp.x, sp.z, sp.z,",
    },
    {
      note: "spark z taken from the x component",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  g_env.spark(sp.x, sp.y, sp.z,",
      to: "  g_env.spark(sp.x, sp.y, sp.x,",
    },
    {
      note: "launch x taken from the z component",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  double vx = iv.x;",
      to: "  double vx = iv.z;",
    },
    {
      note: "launch y taken from the x component",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const double vy = iv.y;",
      to: "  const double vy = iv.x;",
    },
    {
      note: "launch z taken from the y component",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const double vz = iv.z;",
      to: "  const double vz = iv.y;",
    },
    {
      note: "base type read from the attacker",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const Value base_type = Value(v->base_type());",
      to: "  const Value base_type = Value(a->base_type());",
    },
    {
      note: "base-ball test compares drink twice",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||",
      to: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink))) ||",
    },
    {
      note: "base-ball test compares baseball twice",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
      to: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball)));",
    },
    {
      note: "base-ball alternatives combined with and",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
      to: "      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) &&\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
    },
    {
      note: "base-ball test negated",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  const bool is_base_ball =\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink)));",
      to: "  const bool is_base_ball = !(\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) ||\n      strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Drink))));",
    },
    {
      note: "heavy guard negated",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (!strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Heavy))) || is_fly) {",
      to: "  if (strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Heavy))) || is_fly) {",
    },
    {
      note: "heavy guard uses and",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (!strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Heavy))) || is_fly) {",
      to: "  if (!strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Heavy))) && is_fly) {",
    },
    {
      note: "heavy guard compares baseball",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (!strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Heavy))) || is_fly) {",
      to: "  if (!strict_equals(base_type, Value(static_cast<double>(WeaponEnum::Baseball))) || is_fly) {",
    },
    {
      note: "velocity assignment swaps y and z",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_velocity(Value(vx), Value(vy), Value(vz));",
      to: "    v->set_velocity(Value(vx), Value(vz), Value(vy));",
    },
    {
      note: "velocity assignment drops the y component",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_velocity(Value(vx), Value(vy), Value(vz));",
      to: "    v->set_velocity(Value(vx), Value(), Value(vz));",
    },
    {
      note: "velocity assignment negates x",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_velocity(Value(vx), Value(vy), Value(vz));",
      to: "    v->set_velocity(Value(-vx), Value(vy), Value(vz));",
    },
    {
      note: "explicit leave ground removed",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_velocity(Value(vx), Value(vy), Value(vz));\n    v->leave_ground();",
      to: "    v->set_velocity(Value(vx), Value(vy), Value(vz));",
    },
    {
      note: "attacker leaves the ground instead",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->leave_ground();",
      to: "    a->leave_ground();",
    },
    {
      note: "first mark uses the second tag",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: '    g_env.mt_mark(u"hwih_1");',
      to: '    g_env.mt_mark(u"hwih_2");',
    },
    {
      note: "second mark uses the first tag",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: '    g_env.mt_mark(u"hwih_2");',
      to: '    g_env.mt_mark(u"hwih_1");',
    },
    {
      note: "pick guard uses or instead of and",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    if (is_base_ball && (vx >= 6 || vx <= -6)) {",
      to: "    if (is_base_ball || (vx >= 6 || vx <= -6)) {",
    },
    {
      note: "pick guard drops the base-ball test",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    if (is_base_ball && (vx >= 6 || vx <= -6)) {",
      to: "    if (vx >= 6 || vx <= -6) {",
    },
    {
      note: "pick guard range combined with and",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    if (is_base_ball && (vx >= 6 || vx <= -6)) {",
      to: "    if (is_base_ball && (vx >= 6 && vx <= -6)) {",
    },
    {
      note: "positive pick threshold is strict",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    if (is_base_ball && (vx >= 6 || vx <= -6)) {",
      to: "    if (is_base_ball && (vx > 6 || vx <= -6)) {",
    },
    {
      note: "negative pick threshold is strict",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    if (is_base_ball && (vx >= 6 || vx <= -6)) {",
      to: "    if (is_base_ball && (vx >= 6 || vx < -6)) {",
    },
    {
      note: "positive pick threshold lowered",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    if (is_base_ball && (vx >= 6 || vx <= -6)) {",
      to: "    if (is_base_ball && (vx >= 5 || vx <= -6)) {",
    },
    {
      note: "negative pick threshold raised",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    if (is_base_ball && (vx >= 6 || vx <= -6)) {",
      to: "    if (is_base_ball && (vx >= 6 || vx <= -5)) {",
    },
    {
      note: "fast pick reads the sky indexes",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "      nid = g_env.mt_pick(v->data_indexes_of(u\"throwings\"));",
      to: "      nid = g_env.mt_pick(v->data_indexes_in_the_skys());",
    },
    {
      note: "slow pick reads the throwings indexes",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "      nid = g_env.mt_pick(v->data_indexes_in_the_skys());",
      to: "      nid = g_env.mt_pick(v->data_indexes_of(u\"throwings\"));",
    },
    {
      note: "frame transition skipped in the velocity block",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->enter_frame_by_id(nid);\n  }",
      to: "  }",
    },
    {
      note: "stick comparison uses another oid",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (strict_equals(a->data_id(), Value(oid::kWeapon_Stick)) && is_base_ball) {",
      to: '  if (strict_equals(a->data_id(), Value(u"999")) && is_base_ball) {',
    },
    {
      note: "stick guard uses or",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (strict_equals(a->data_id(), Value(oid::kWeapon_Stick)) && is_base_ball) {",
      to: "  if (strict_equals(a->data_id(), Value(oid::kWeapon_Stick)) || is_base_ball) {",
    },
    {
      note: "stick guard drops the base-ball test",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (strict_equals(a->data_id(), Value(oid::kWeapon_Stick)) && is_base_ball) {",
      to: "  if (strict_equals(a->data_id(), Value(oid::kWeapon_Stick))) {",
    },
    {
      note: "stick launch factor is three",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    vx = a->facing * 2;",
      to: "    vx = a->facing * 3;",
    },
    {
      note: "stick launch uses the victim facing",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    vx = a->facing * 2;",
      to: "    vx = v->facing * 2;",
    },
    {
      note: "stick launch factor is added",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    vx = a->facing * 2;",
      to: "    vx = a->facing + 2;",
    },
    {
      note: "stick frame reads the sky indexes",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->enter_frame_by_id(index_0(v->data_indexes_of(u\"throwings\")));",
      to: "    v->enter_frame_by_id(index_0(v->data_indexes_in_the_skys()));",
    },
    {
      note: "stick frame uses a constant instead of the throwings entry",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->enter_frame_by_id(index_0(v->data_indexes_of(u\"throwings\")));",
      to: '    v->enter_frame_by_id(Value(u"nid"));',
    },
    {
      note: "stick velocity writes all three components",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_velocity(Value(vx), Value(), Value());",
      to: "    v->set_velocity(Value(vx), Value(vy), Value(vz));",
    },
    {
      note: "stick velocity writes the y source",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_velocity(Value(vx), Value(), Value());",
      to: "    v->set_velocity(Value(vy), Value(), Value());",
    },
    {
      note: "team switch guard drops the fly test",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (is_fly && v->bearer == nullptr) {",
      to: "  if (v->bearer == nullptr) {",
    },
    {
      note: "team switch guard uses or",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (is_fly && v->bearer == nullptr) {",
      to: "  if (is_fly || v->bearer == nullptr) {",
    },
    {
      note: "team switch guard requires a bearer",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (is_fly && v->bearer == nullptr) {",
      to: "  if (is_fly && v->bearer != nullptr) {",
    },
    {
      note: "team switch always fires",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "  if (is_fly && v->bearer == nullptr) {",
      to: "  if (true) {",
    },
    {
      note: "team copied from the victim instead of the attacker",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_team(a->team());",
      to: "    v->set_team(v->team());",
    },
    {
      note: "team copied onto the attacker",
      file: "native/lfw/collision/weapon_is_hit.cpp",
      from: "    v->set_team(a->team());",
      to: "    a->set_team(a->team());",
    },
  ],
};
