/**
 * Mutation spec for `native/lfw/collision/n_bdy_defend.cpp`.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `if (a == nullptr || v == nullptr) return;` -> `&&`, or inverted to `!=`.
 *    The harness always registers both ids (`A` and `V`), so a lookup can never
 *    return null and the variants are indistinguishable. The guard is a port
 *    artefact: the TS original destructures `collision.attacker/victim`.
 * 2. The action dispatch is a seam (`g_env.dispatch`), because the TS side calls
 *    `collision_action_handlers[AT.A_NEXT_FRAME](action, collision)` and the port's
 *    `run_action` would drag in `ActionEnv` and the whole `lfw::Entity` surface. The
 *    handler bodies belong to the `action_handlers` subject; what this unit owns is
 *    *which* handler key is dispatched and *which* `action.type` values are
 *    filtered, and both are fully observable through the seam's log.
 * 3. `as_array(actions)` guard: the port skips a non-array `actions` value, while
 *    the TS original throws (`(5)?.forEach` / `"x"?.forEach` is not a function).
 *    That input is therefore outside the contract and the case file only uses
 *    arrays plus `undefined`/`null`; the "array branch disabled" mutation below is
 *    the observable form and is included.
 */
export default {
  subject: "collision_n_bdy_defend",
  mutations: [
    {
      note: "run_actions: array branch disabled",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  const Array* arr = as_array(actions);\n  if (arr == nullptr) return;",
      to: "  const Array* arr = nullptr;\n  if (arr == nullptr) return;",
    },
    {
      note: "run_actions: action type key misspelled",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: '    const Value type = field_or(action, u"type");',
      to: '    const Value type = field_or(action, u"types");',
    },
    {
      note: "run_actions: attacker filter inverted",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    if (strict_equals(type, Value(std::u16string(a_type)))) {\n      g_env.dispatch(c, a_dispatch, action);\n    }",
      to: "    if (!strict_equals(type, Value(std::u16string(a_type)))) {\n      g_env.dispatch(c, a_dispatch, action);\n    }",
    },
    {
      note: "run_actions: attacker filter dispatches the victim handler",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    if (strict_equals(type, Value(std::u16string(a_type)))) {\n      g_env.dispatch(c, a_dispatch, action);\n    }",
      to: "    if (strict_equals(type, Value(std::u16string(a_type)))) {\n      g_env.dispatch(c, v_dispatch, action);\n    }",
    },
    {
      note: "run_actions: victim filter dispatches the attacker handler",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    if (strict_equals(type, Value(std::u16string(v_type)))) {\n      g_env.dispatch(c, v_dispatch, action);\n    }",
      to: "    if (strict_equals(type, Value(std::u16string(v_type)))) {\n      g_env.dispatch(c, a_dispatch, action);\n    }",
    },
    {
      note: "run_actions: victim filter dropped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    if (strict_equals(type, Value(std::u16string(v_type)))) {\n      g_env.dispatch(c, v_dispatch, action);\n    }\n",
      to: "",
    },
    {
      note: "run_actions: always dispatches the first action",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    const Value& action = arr->at(i);",
      to: "    const Value& action = arr->at(0);",
    },
    {
      note: "run_actions: skips the last action",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  for (size_t i = 0; i < arr->size(); ++i) {",
      to: "  for (size_t i = 0; i + 1 < arr->size(); ++i) {",
    },
    {
      note: "run_actions: steps two actions at a time",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  for (size_t i = 0; i < arr->size(); ++i) {",
      to: "  for (size_t i = 0; i < arr->size(); i += 2) {",
    },
    {
      note: "attacker resolved from the victim id",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.vid);",
      to: "  Entity* a = g_env.find_entity(c.vid);\n  Entity* v = g_env.find_entity(c.vid);",
    },
    {
      note: "victim resolved from the attacker id",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.vid);",
      to: "  Entity* a = g_env.find_entity(c.aid);\n  Entity* v = g_env.find_entity(c.aid);",
    },
    {
      note: "effect key misspelled",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: '  const Value effect_v = field_or(c.itr, u"effect");',
      to: '  const Value effect_v = field_or(c.itr, u"effects");',
    },
    {
      note: "bdefend key misspelled",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: '  const Value bdefend_v = field_or(c.itr, u"bdefend");',
      to: '  const Value bdefend_v = field_or(c.itr, u"bdefends");',
    },
    {
      note: "bdefend default is the force break value",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  const double bdefend = missing(bdefend_v) ? kDefaultBreakDefendValue : to_number(bdefend_v);",
      to: "  const double bdefend = missing(bdefend_v) ? kDefaultForceBreakDefendValue : to_number(bdefend_v);",
    },
    {
      note: "bdefend default branches swapped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  const double bdefend = missing(bdefend_v) ? kDefaultBreakDefendValue : to_number(bdefend_v);",
      to: "  const double bdefend = missing(bdefend_v) ? to_number(bdefend_v) : kDefaultBreakDefendValue;",
    },
    {
      note: "bdefend default never applies",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  const double bdefend = missing(bdefend_v) ? kDefaultBreakDefendValue : to_number(bdefend_v);",
      to: "  const double bdefend = to_number(bdefend_v);",
    },
    {
      note: "explosive alternatives combined with and",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "      is_effect(effect_v, ItrEffect::FireExplosion) || is_effect(effect_v, ItrEffect::Explosion);",
      to: "      is_effect(effect_v, ItrEffect::FireExplosion) && is_effect(effect_v, ItrEffect::Explosion);",
    },
    {
      note: "explosive test compares fire explosion twice",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "      is_effect(effect_v, ItrEffect::FireExplosion) || is_effect(effect_v, ItrEffect::Explosion);",
      to: "      is_effect(effect_v, ItrEffect::FireExplosion) || is_effect(effect_v, ItrEffect::FireExplosion);",
    },
    {
      note: "explosive test compares the normal effect",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "      is_effect(effect_v, ItrEffect::FireExplosion) || is_effect(effect_v, ItrEffect::Explosion);",
      to: "      is_effect(effect_v, ItrEffect::Normal) || is_effect(effect_v, ItrEffect::Explosion);",
    },
    {
      note: "explosive never true",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  const bool explosive =\n      is_effect(effect_v, ItrEffect::FireExplosion) || is_effect(effect_v, ItrEffect::Explosion);",
      to: "  const bool explosive = false;",
    },
    {
      note: "guard drops the explosive test",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if ((!explosive && strict_equals(Value(a->facing), Value(v->facing))) ||",
      to: "  if (strict_equals(Value(a->facing), Value(v->facing)) ||",
    },
    {
      note: "guard requires an explosive itr",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if ((!explosive && strict_equals(Value(a->facing), Value(v->facing))) ||",
      to: "  if ((explosive && strict_equals(Value(a->facing), Value(v->facing))) ||",
    },
    {
      note: "guard combines the facing test with or",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if ((!explosive && strict_equals(Value(a->facing), Value(v->facing))) ||",
      to: "  if ((!explosive || strict_equals(Value(a->facing), Value(v->facing))) ||",
    },
    {
      note: "guard facing test inverted",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if ((!explosive && strict_equals(Value(a->facing), Value(v->facing))) ||",
      to: "  if ((!explosive && !strict_equals(Value(a->facing), Value(v->facing))) ||",
    },
    {
      note: "guard facing test compares the victim with itself",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if ((!explosive && strict_equals(Value(a->facing), Value(v->facing))) ||",
      to: "  if ((!explosive && strict_equals(Value(v->facing), Value(v->facing))) ||",
    },
    {
      note: "guard force break threshold shifted by one",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "      bdefend >= kDefaultForceBreakDefendValue) {",
      to: "      bdefend >= kDefaultForceBreakDefendValue + 1.0) {",
    },
    {
      note: "guard force break comparison is strict",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "      bdefend >= kDefaultForceBreakDefendValue) {",
      to: "      bdefend > kDefaultForceBreakDefendValue) {",
    },
    {
      note: "guard force break threshold is the break defend value",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "      bdefend >= kDefaultForceBreakDefendValue) {",
      to: "      bdefend >= kDefaultBreakDefendValue) {",
    },
    {
      note: "guard force break comparison flipped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "      bdefend >= kDefaultForceBreakDefendValue) {",
      to: "      bdefend <= kDefaultForceBreakDefendValue) {",
    },
    {
      note: "handover drops the normal bdy call",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    handle_itr_normal_bdy_normal(c);\n    return;",
      to: "    return;",
    },
    {
      note: "handover falls through into the defend path",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    handle_itr_normal_bdy_normal(c);\n    return;\n  }",
      to: "    handle_itr_normal_bdy_normal(c);\n  }",
    },
    {
      note: "defend value grows instead of decreasing",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  v->set_defend_value(v->defend_value() - bdefend);",
      to: "  v->set_defend_value(v->defend_value() + bdefend);",
    },
    {
      note: "defend value read from the attacker",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  v->set_defend_value(v->defend_value() - bdefend);",
      to: "  v->set_defend_value(a->defend_value() - bdefend);",
    },
    {
      note: "defend value not written",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  v->set_defend_value(v->defend_value() - bdefend);\n",
      to: "",
    },
    {
      note: "injury scale taken from the attacker defend ratio",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  handle_injury(c, v->defend_ratio(), false);",
      to: "  handle_injury(c, a->defend_ratio(), false);",
    },
    {
      note: "injury keeps the toughness",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  handle_injury(c, v->defend_ratio(), false);",
      to: "  handle_injury(c, v->defend_ratio(), true);",
    },
    {
      note: "injury scale is a constant",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  handle_injury(c, v->defend_ratio(), false);",
      to: "  handle_injury(c, 1.0, false);",
    },
    {
      note: "injury handler dropped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  handle_injury(c, v->defend_ratio(), false);\n",
      to: "",
    },
    {
      note: "rest handler dropped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  handle_injury(c, v->defend_ratio(), false);\n  handle_rest(c);\n  handle_stiffness(c);",
      to: "  handle_injury(c, v->defend_ratio(), false);\n  handle_stiffness(c);",
    },
    {
      note: "stiffness handler dropped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  handle_injury(c, v->defend_ratio(), false);\n  handle_rest(c);\n  handle_stiffness(c);",
      to: "  handle_injury(c, v->defend_ratio(), false);\n  handle_rest(c);",
    },
    {
      note: "rest and stiffness swapped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  handle_injury(c, v->defend_ratio(), false);\n  handle_rest(c);\n  handle_stiffness(c);",
      to: "  handle_injury(c, v->defend_ratio(), false);\n  handle_stiffness(c);\n  handle_rest(c);",
    },
    {
      note: "spark point uses the b cube as source",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  v->spark_point(c.a_cube, c.b_cube, x, y, z);",
      to: "  v->spark_point(c.b_cube, c.a_cube, x, y, z);",
    },
    {
      note: "velocity divisor is three",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x / 2.0), Value(), Value());",
      to: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x / 3.0), Value(), Value());",
    },
    {
      note: "velocity is not halved",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x / 2.0), Value(), Value());",
      to: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x), Value(), Value());",
    },
    {
      note: "velocity writes all three components",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x / 2.0), Value(), Value());",
      to: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x / 2.0), Value(iv.y), Value(iv.z));",
    },
    {
      note: "velocity guard dropped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x / 2.0), Value(), Value());",
      to: "  v->set_velocity(Value(iv.x / 2.0), Value(), Value());",
    },
    {
      note: "velocity applied to the attacker",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (truthy(Value(iv.x))) v->set_velocity(Value(iv.x / 2.0), Value(), Value());",
      to: "  if (truthy(Value(iv.x))) a->set_velocity(Value(iv.x / 2.0), Value(), Value());",
    },
    {
      note: "actions read from the wrong sources",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: '  const Value itr_actions = field_or(c.itr, u"actions");\n  const Value bdy_actions = field_or(c.bdy, u"actions");',
      to: '  const Value itr_actions = field_or(c.bdy, u"actions");\n  const Value bdy_actions = field_or(c.itr, u"actions");',
    },
    {
      note: "itr actions key misspelled",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: '  const Value itr_actions = field_or(c.itr, u"actions");',
      to: '  const Value itr_actions = field_or(c.itr, u"action");',
    },
    {
      note: "bdy actions key misspelled",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: '  const Value bdy_actions = field_or(c.bdy, u"actions");',
      to: '  const Value bdy_actions = field_or(c.bdy, u"action");',
    },
    {
      note: "broken defend test is strict",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (v->defend_value() <= 0) {",
      to: "  if (v->defend_value() < 0) {",
    },
    {
      note: "broken defend test flipped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (v->defend_value() <= 0) {",
      to: "  if (v->defend_value() >= 0) {",
    },
    {
      note: "broken defend test reads the attacker",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "  if (v->defend_value() <= 0) {",
      to: "  if (a->defend_value() <= 0) {",
    },
    {
      note: "broken branch does not clamp the defend value",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    v->set_defend_value(0.0);\n    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kBrokenDefend)));",
      to: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kBrokenDefend)));",
    },
    {
      note: "broken branch clamps to one",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    v->set_defend_value(0.0);",
      to: "    v->set_defend_value(1.0);",
    },
    {
      note: "broken spark kind swapped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kBrokenDefend)));",
      to: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kDefendHit)));",
    },
    {
      note: "defend spark kind swapped",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kDefendHit)));",
      to: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kBrokenDefend)));",
    },
    {
      note: "spark coordinates rotated",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kBrokenDefend)));",
      to: "    g_env.spark(Value(y), Value(z), Value(x), Value(std::u16string(spark_enum::kBrokenDefend)));",
    },
    {
      note: "broken branch skips the itr actions",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    run_actions(c, itr_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);\n    run_actions(c, bdy_actions, action_type::kA_BROKEN_DEFEND,",
      to: "    run_actions(c, bdy_actions, action_type::kA_BROKEN_DEFEND,",
    },
    {
      note: "broken branch uses the defend action types for bdy",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    run_actions(c, bdy_actions, action_type::kA_BROKEN_DEFEND, action_type::kV_BROKEN_DEFEND,",
      to: "    run_actions(c, bdy_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,",
    },
    {
      note: "broken branch swaps the bdy broken types",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    run_actions(c, bdy_actions, action_type::kA_BROKEN_DEFEND, action_type::kV_BROKEN_DEFEND,",
      to: "    run_actions(c, bdy_actions, action_type::kV_BROKEN_DEFEND, action_type::kA_BROKEN_DEFEND,",
    },
    {
      note: "defend branch uses the broken action types for bdy",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kDefendHit)));\n    run_actions(c, itr_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);\n    run_actions(c, bdy_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,",
      to: "    g_env.spark(Value(x), Value(y), Value(z), Value(std::u16string(spark_enum::kDefendHit)));\n    run_actions(c, itr_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);\n    run_actions(c, bdy_actions, action_type::kA_BROKEN_DEFEND, action_type::kV_BROKEN_DEFEND,",
    },
    {
      note: "broken branch dispatches the victim handler for attacker actions",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    run_actions(c, itr_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);\n    run_actions(c, bdy_actions, action_type::kA_BROKEN_DEFEND, action_type::kV_BROKEN_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);",
      to: "    run_actions(c, itr_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kV_NEXT_FRAME, action_type::kA_NEXT_FRAME);\n    run_actions(c, bdy_actions, action_type::kA_BROKEN_DEFEND, action_type::kV_BROKEN_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);",
    },
    {
      note: "defend branch dispatches the attacker handler for victim actions",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    run_actions(c, bdy_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);",
      to: "    run_actions(c, bdy_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kV_NEXT_FRAME, action_type::kV_NEXT_FRAME);",
    },
    {
      note: "defend branch never dispatches",
      file: "native/lfw/collision/n_bdy_defend.cpp",
      from: "    run_actions(c, bdy_actions, action_type::kA_DEFEND, action_type::kV_DEFEND,\n                action_type::kA_NEXT_FRAME, action_type::kV_NEXT_FRAME);\n  }\n}",
      to: "  }\n}",
    },
  ],
};
