/**
 * Mutation spec for the `handle()` half of `native/lfw/collision/keeper.cpp`.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. Everything about `ball_hit` is unobservable. The TS original accumulates it
 *    (`ball_hit = ball_hit || fn === handle_ball_is_hit_a || ...`) and then never
 *    reads it again -- it is dead in the original too. The port keeps the
 *    accumulation for fidelity and the variable is explicitly discarded.
 * 2. `g_env.ball_frozen(collision.victim, collision.attacker, itr)`'s *third*
 *    argument is not observable: the seam receives it but the harness cannot make
 *    the real TS `handle_ball_frozen` react to it (that would need a full
 *    eleven-property entity fake; the frozen-ball behaviour is gated by the
 *    `collision_ball_frozen` subject instead). The argument *order* of the first
 *    two parameters IS observable -- the harness seam returns
 *    `first.id != u"V"`, so swapping them flips the result and skips the action
 *    dispatch that the TS side still performs.
 * 3. `if (collision.core->find_object_data(collision.vdata_id, data))` is always
 *    true in this harness, so dropping the `if` (or inverting it) changes nothing
 *    observable.
 * 4. `handlers == nullptr` versus `handlers->empty()`: the case always seeds a
 *    vector, so the null arm is unreachable; the port keeps the null guard because
 *    `Collision::handlers` is a `shared_ptr` that is only allocated by
 *    `load_handlers`.
 * 5. `out.push_back(std::nullopt)` for a falsy `pretest` is unobservable: the
 *    cached element is only read on the `truthy(pretest)` path, so a falsy
 *    `pretest` always re-runs the tester at dispatch time.
 * 6. `field_or(collision.itr, u"actions")` reads `collision.itr` twice (once for
 *    the reference `itr`, once for `actions`); swapping those two reads is
 *    behaviour preserving.
 * 7. `enum_name`'s fallback string is only reachable when the dev branch formats an
 *    unknown kind; the case covers that with `kind n 99`. The `<=` / `<` edges of
 *    the entry lookup are covered by the "first/last entry wins" pair below.
 */
export default {
  subject: "collision_keeper_handle",
  mutations: [
    {
      note: "dev gate always taken",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (collision.core->dev() && handlers != nullptr) {",
      to: "  if (collision.core->dev() || handlers != nullptr) {",
    },
    {
      note: "dev gate never taken",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (collision.core->dev() && handlers != nullptr) {",
      to: "  if (false && handlers != nullptr) {",
    },
    {
      note: "handler names are joined without a separator",
      file: "native/lfw/collision/keeper.cpp",
      from: '      if (i) names += u",";',
      to: '      names += u",";',
    },
    {
      note: "handler names are dropped from the debug line",
      file: "native/lfw/collision/keeper.cpp",
      from: "      names += handlers->at(i);",
      to: "      names += u\"x\";",
    },
    {
      note: "debug line formats the bdy kind as the itr kind",
      file: "native/lfw/collision/keeper.cpp",
      from: '        enum_name(itr_kind_entries(), to_number(field_or(collision.itr, u"kind")));',
      to: '        enum_name(bdy_kind_entries(), to_number(field_or(collision.itr, u"kind")));',
    },
    {
      note: "debug line formats the itr kind as the bdy kind",
      file: "native/lfw/collision/keeper.cpp",
      from: '        enum_name(bdy_kind_entries(), to_number(field_or(collision.bdy, u"kind")));',
      to: '        enum_name(itr_kind_entries(), to_number(field_or(collision.bdy, u"kind")));',
    },
    {
      note: "enum lookup returns the first entry regardless of value",
      file: "native/lfw/collision/keeper.cpp",
      from: "    if (entries[i].value == v) return std::u16string(entries[i].name);",
      to: "    if (i == i) return std::u16string(entries[i].name);",
    },
    {
      note: "unknown enum name falls back to a different word",
      file: "native/lfw/collision/keeper.cpp",
      from: '  return std::u16string(u"undefined");',
      to: '  return std::u16string(u"undef");',
    },
    {
      note: "debug line prints the victim type as the attacker type",
      file: "native/lfw/collision/keeper.cpp",
      from: "    const std::u16string desc = u\"[\" + number_to_string(collision.attacker.data_type()) + u\"]#\" +",
      to: "    const std::u16string desc = u\"[\" + number_to_string(collision.victim.data_type()) + u\"]#\" +",
    },
    {
      note: "debug line prints the attacker type as the victim type",
      file: "native/lfw/collision/keeper.cpp",
      from: "                                number_to_string(collision.victim.data_type()) + u\"]#\" + bdy_name;",
      to: "                                number_to_string(collision.attacker.data_type()) + u\"]#\" + bdy_name;",
    },
    {
      note: "debug line loses the arrow",
      file: "native/lfw/collision/keeper.cpp",
      from: '                                itr_name + u" => [" +',
      to: '                                itr_name + u" = [" +',
    },
    {
      note: "debug line prefix changed",
      file: "native/lfw/collision/keeper.cpp",
      from: '    collision.core->log(u" collision: " + desc + u" \\nhandlers: " + names);',
      to: '    collision.core->log(u" collisions: " + desc + u" \\nhandlers: " + names);',
    },
    {
      note: "debug line label changed",
      file: "native/lfw/collision/keeper.cpp",
      from: '    collision.core->log(u" collision: " + desc + u" \\nhandlers: " + names);',
      to: '    collision.core->log(u" collision: " + desc + u" \\nhandler: " + names);',
    },
    {
      note: "handler loop never runs",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (handlers != nullptr) {\n    for (size_t i = 0; i < handlers->size(); ++i) {\n      const std::u16string& fn = handlers->at(i);",
      to: "  if (handlers == nullptr) {\n    for (size_t i = 0; i < handlers->size(); ++i) {\n      const std::u16string& fn = handlers->at(i);",
    },
    {
      note: "handlers are iterated backwards",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (handlers != nullptr) {\n    for (size_t i = 0; i < handlers->size(); ++i) {\n      const std::u16string& fn = handlers->at(i);",
      to: "  if (handlers != nullptr) {\n    for (size_t i = 0; i < handlers->size(); ++i) {\n      const std::u16string& fn = handlers->at(handlers->size() - 1 - i);",
    },
    {
      note: "every handler call is dropped",
      file: "native/lfw/collision/keeper.cpp",
      from: "      ball_hit = ball_hit || fn == std::u16string(u\"handle_ball_is_hit_a\") ||\n                 fn == std::u16string(u\"handle_ball_is_hit_b\");\n      g_env.call_handler(fn, collision);",
      to: "      ball_hit = ball_hit || fn == std::u16string(u\"handle_ball_is_hit_a\") ||\n                 fn == std::u16string(u\"handle_ball_is_hit_b\");",
    },
    {
      note: "the itr test list is built from the bdy actions",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const std::vector<std::optional<bool>> itr_tests = compute_tests(itr_actions, collision);",
      to: "  const std::vector<std::optional<bool>> itr_tests = compute_tests(bdy_actions, collision);",
    },
    {
      note: "the bdy test list is built from the itr actions",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const std::vector<std::optional<bool>> bdy_tests = compute_tests(bdy_actions, collision);",
      to: "  const std::vector<std::optional<bool>> bdy_tests = compute_tests(itr_actions, collision);",
    },
    {
      note: "the test lists are built after the handler loop",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const std::vector<std::optional<bool>> itr_tests = compute_tests(itr_actions, collision);\n  const std::vector<std::optional<bool>> bdy_tests = compute_tests(bdy_actions, collision);\n\n  if (handlers != nullptr) {\n    for (size_t i = 0; i < handlers->size(); ++i) {\n      const std::u16string& fn = handlers->at(i);\n      ball_hit = ball_hit || fn == std::u16string(u\"handle_ball_is_hit_a\") ||\n                 fn == std::u16string(u\"handle_ball_is_hit_b\");\n      g_env.call_handler(fn, collision);\n    }\n  }\n  (void)ball_hit;",
      to: "  if (handlers != nullptr) {\n    for (size_t i = 0; i < handlers->size(); ++i) {\n      const std::u16string& fn = handlers->at(i);\n      ball_hit = ball_hit || fn == std::u16string(u\"handle_ball_is_hit_a\") ||\n                 fn == std::u16string(u\"handle_ball_is_hit_b\");\n      g_env.call_handler(fn, collision);\n    }\n  }\n  (void)ball_hit;\n  const std::vector<std::optional<bool>> itr_tests = compute_tests(itr_actions, collision);\n  const std::vector<std::optional<bool>> bdy_tests = compute_tests(bdy_actions, collision);",
    },
    {
      note: "compute_tests ignores a non array actions value",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const Array* arr = as_array(actions);\n  if (arr == nullptr) return out;",
      to: "  const Array* arr = as_array(actions);\n  if (arr != nullptr) return out;",
    },
    {
      note: "compute_tests precomputes the falsy pretest branch",
      file: "native/lfw/collision/keeper.cpp",
      from: '    if (!truthy(field_or(action, u"pretest"))) {\n      out.push_back(std::nullopt);',
      to: '    if (truthy(field_or(action, u"pretest"))) {\n      out.push_back(std::nullopt);',
    },
    {
      note: "compute_tests treats a missing tester as failing",
      file: "native/lfw/collision/keeper.cpp",
      from: `    const Value tester = field_or(action, u"tester");
    if (!truthy(tester)) {
      out.push_back(true);
      continue;
    }`,
      to: `    const Value tester = field_or(action, u"tester");
    if (!truthy(tester)) {
      out.push_back(false);
      continue;
    }`,
    },
    {
      note: "compute_tests drops the tester result",
      file: "native/lfw/collision/keeper.cpp",
      from: "    out.push_back(c.core->tester_run(tester, c) ? true : false);",
      to: "    out.push_back(true);",
    },
    {
      note: "compute_tests reads the wrong action key",
      file: "native/lfw/collision/keeper.cpp",
      from: '    if (!truthy(field_or(action, u"pretest"))) {\n      out.push_back(std::nullopt);',
      to: '    if (!truthy(field_or(action, u"pretests"))) {\n      out.push_back(std::nullopt);',
    },
    {
      note: "compute_tests reads the wrong tester key",
      file: "native/lfw/collision/keeper.cpp",
      from: '    const Value tester = field_or(action, u"tester");\n    if (!truthy(tester)) {\n      out.push_back(true);',
      to: '    const Value tester = field_or(action, u"testers");\n    if (!truthy(tester)) {\n      out.push_back(true);',
    },
    {
      note: "run_actions ignores a non array actions value",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const Array* arr = as_array(actions);\n  if (arr == nullptr) return;",
      to: "  const Array* arr = as_array(actions);\n  if (arr != nullptr) return;",
    },
    {
      note: "run_actions tests the wrong pretest key",
      file: "native/lfw/collision/keeper.cpp",
      from: '    if (truthy(field_or(action, u"pretest"))) {\n      if (idx < tests.size() && tests[idx].has_value()) test_result = Value(*tests[idx]);',
      to: '    if (!truthy(field_or(action, u"pretest"))) {\n      if (idx < tests.size() && tests[idx].has_value()) test_result = Value(*tests[idx]);',
    },
    {
      note: "run_actions ignores the cached pretest result",
      file: "native/lfw/collision/keeper.cpp",
      from: "      if (idx < tests.size() && tests[idx].has_value()) test_result = Value(*tests[idx]);",
      to: "      test_result = Value();",
    },
    {
      note: "run_actions skips the unpretested tester",
      file: "native/lfw/collision/keeper.cpp",
      from: '    } else {\n      const Value tester = field_or(action, u"tester");\n      if (truthy(tester)) test_result = Value(c.core->tester_run(tester, c));\n    }',
      to: "    }",
    },
    {
      note: "run_actions never skips a failing action",
      file: "native/lfw/collision/keeper.cpp",
      from: "    if (is_exactly_false(test_result)) continue;",
      to: "    (void)test_result;",
    },
    {
      note: "is_exactly_false inverts its answer",
      file: "native/lfw/collision/keeper.cpp",
      from: "  return b != nullptr && !*b;",
      to: "  return b != nullptr && *b;",
    },
    {
      note: "is_exactly_false only accepts non booleans",
      file: "native/lfw/collision/keeper.cpp",
      from: "  const bool* b = std::get_if<bool>(&v);\n  return b != nullptr && !*b;",
      to: "  const bool* b = std::get_if<bool>(&v);\n  return b == nullptr && !*b;",
    },
    {
      note: "run_action is called with a fixed type",
      file: "native/lfw/collision/keeper.cpp",
      from: '    g_env.run_action(to_string(field_or(action, u"type")), action, c);',
      to: '    g_env.run_action(u"x", action, c);',
    },
    {
      note: "run_action reads the wrong type key",
      file: "native/lfw/collision/keeper.cpp",
      from: '    g_env.run_action(to_string(field_or(action, u"type")), action, c);',
      to: '    g_env.run_action(to_string(field_or(action, u"typed")), action, c);',
    },
    {
      note: "ball_frozen result is inverted",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!g_env.ball_frozen(collision.victim, collision.attacker, itr)) {",
      to: "  if (g_env.ball_frozen(collision.victim, collision.attacker, itr)) {",
    },
    {
      note: "ball_frozen is asked in the attacker/victim order",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!g_env.ball_frozen(collision.victim, collision.attacker, itr)) {",
      to: "  if (!g_env.ball_frozen(collision.attacker, collision.victim, itr)) {",
    },
    {
      note: "the itr action list is dispatched twice",
      file: "native/lfw/collision/keeper.cpp",
      from: "    run_actions(itr_actions, itr_tests, collision);\n    run_actions(bdy_actions, bdy_tests, collision);",
      to: "    run_actions(bdy_actions, bdy_tests, collision);\n    run_actions(bdy_actions, bdy_tests, collision);",
    },
    {
      note: "the bdy action list is not dispatched",
      file: "native/lfw/collision/keeper.cpp",
      from: "    run_actions(itr_actions, itr_tests, collision);\n    run_actions(bdy_actions, bdy_tests, collision);\n  }",
      to: "    run_actions(itr_actions, itr_tests, collision);\n  }",
    },
    {
      note: "the victim push is reported as the attacker push",
      file: "native/lfw/collision/keeper.cpp",
      from: "  g_env.victim_push_collided(collision);\n  g_env.attacker_push_collision(collision);",
      to: "  g_env.attacker_push_collision(collision);\n  g_env.victim_push_collided(collision);",
    },
    {
      note: "the victim push is dropped",
      file: "native/lfw/collision/keeper.cpp",
      from: "  g_env.victim_push_collided(collision);\n  g_env.attacker_push_collision(collision);",
      to: "  g_env.attacker_push_collision(collision);",
    },
    {
      note: "the silent kind key is misspelled",
      file: "native/lfw/collision/keeper.cpp",
      from: '  const Value itr_kind = field_or(itr, u"kind");',
      to: '  const Value itr_kind = field_or(itr, u"kinds");',
    },
    {
      note: "block is not a silent kind",
      file: "native/lfw/collision/keeper.cpp",
      from: "      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Block))) ||",
      to: "      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Catch))) ||",
    },
    {
      note: "pick secretly is not a silent kind",
      file: "native/lfw/collision/keeper.cpp",
      from: "      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Pick))) ||\n      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::PickSecretly)));",
      to: "      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Pick)));",
    },
    {
      note: "the silent kind test is loose",
      file: "native/lfw/collision/keeper.cpp",
      from: "      strict_equals(itr_kind, Value(static_cast<double>(ItrKind::Block))) ||",
      to: "      equals(itr_kind, Value(static_cast<double>(ItrKind::Block))) ||",
    },
    {
      note: "the silent guard is inverted",
      file: "native/lfw/collision/keeper.cpp",
      from: "  if (!silent) {",
      to: "  if (silent) {",
    },
    {
      note: "hit sounds are read without the base object",
      file: "native/lfw/collision/keeper.cpp",
      from: '    g_env.victim_play_sound(collision, field_or(field_or(data, u"base"), u"hit_sounds"));',
      to: '    g_env.victim_play_sound(collision, field_or(data, u"hit_sounds"));',
    },
    {
      note: "hit sounds fall back to the base object",
      file: "native/lfw/collision/keeper.cpp",
      from: '    g_env.victim_play_sound(collision, field_or(field_or(data, u"base"), u"hit_sounds"));',
      to: '    g_env.victim_play_sound(collision, field_or(data, u"base"));',
    },
    {
      note: "the victim hit sound is replaced by undefined",
      file: "native/lfw/collision/keeper.cpp",
      from: '    g_env.victim_play_sound(collision, field_or(field_or(data, u"base"), u"hit_sounds"));',
      to: "    g_env.victim_play_sound(collision, Value());",
    },
  ],
};
