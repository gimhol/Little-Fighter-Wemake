/**
 * Mutation spec for `native/lfw/buff/buff_electroshock.{h,cpp}`.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `static KIND = "Electroshock"` is unobservable *in this unit*: unlike
 *    `Buff_GroupAttack` / `Buff_Electrify` (which use their KIND as a mark key),
 *    `Buff_Electroshock` never reads it. It exists for the `grant_buff` callers
 *    (e.g. `handlers2` passes `u"Electroshock"`) and belongs to those subjects.
 * 2. `effect_frame_id()` is **not** overridden, so the base `"0"` is used. Adding an
 *    override would be new behaviour, not a mutation of existing port text; the
 *    inherited value is asserted by the case (`enter_frame_by_id:s"0"`).
 * 3. Dropping `round_float(...)` from `set_duration(round_float(duration() / 2))` is
 *    unobservable: `Times::set_max` (i.e. `set_duration`) applies `lfw::floor`, so
 *    `duration()` is always an integer and `duration() / 2` is exact to one decimal
 *    place -- `round_float`'s 1000x multiplier can never change it.
 * 4. `if (victim == nullptr) return;` / `if (victim == nullptr) continue;` cannot be
 *    dropped (null dereference) and can never be taken (the harness resolves every
 *    victim id); only the inverted forms are observable and are covered below.
 * 5. `on_tick`'s two guards and `mount`'s two guards are deliberately separate
 *    statements (the TS original writes them as separate `if`s). Removing one of a
 *    pair is only observable because the case pins *every* victim in the list to a
 *    state the surviving guard accepts -- with a second victim in a neutral state the
 *    duration would be halved anyway and the mutation would hide behind it.
 */
export default {
  subject: "buff_electroshock",
  mutations: [
    {
      note: "init sets another tick interval",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "void Buff_Electroshock::init() { set_ticks(3); }",
      to: "void Buff_Electroshock::init() { set_ticks(4); }",
    },
    {
      note: "init does nothing",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "void Buff_Electroshock::init() { set_ticks(3); }",
      to: "void Buff_Electroshock::init() {}",
    },
    {
      note: "effect oid changed",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: 'std::u16string Buff_Electroshock::effect_oid() const { return std::u16string(u"fx"); }',
      to: 'std::u16string Buff_Electroshock::effect_oid() const { return std::u16string(u"fxx"); }',
    },
    {
      note: "effect is not centred",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "void Buff_Electroshock::place_effect(Entity* effect, Entity* victim) {\n  place_effect_center(effect, victim);\n}",
      to: "void Buff_Electroshock::place_effect(Entity* effect, Entity* victim) {\n  Buff::place_effect(effect, victim);\n}",
    },
    {
      note: "on_tick is never scheduled",
      file: "native/lfw/buff/buff_electroshock.h",
      from: "  bool has_on_tick() const override { return true; }",
      to: "  bool has_on_tick() const override { return false; }",
    },
    {
      note: "on_tick accepts every entity type",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  if (!entity::is_fighter_data(victim->data())) return;",
      to: "  if (entity::is_fighter_data(victim->data())) return;",
    },
    {
      note: "on_tick skips the fighter test",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  if (!entity::is_fighter_data(victim->data())) return;\n",
      to: "",
    },
    {
      note: "on_tick falling test is loose",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  if (strict_equals(state, Value(static_cast<double>(StateEnum::Falling)))) return;",
      to: "  if (equals(state, Value(static_cast<double>(StateEnum::Falling)))) return;",
    },
    {
      note: "on_tick lying test is loose",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  if (strict_equals(state, Value(static_cast<double>(StateEnum::Lying)))) return;",
      to: "  if (equals(state, Value(static_cast<double>(StateEnum::Lying)))) return;",
    },
    {
      note: "on_tick does not skip the lying state",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  if (strict_equals(state, Value(static_cast<double>(StateEnum::Lying)))) return;\n",
      to: "",
    },
    {
      note: "on_tick bumps wait by two",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  victim->set_wait(Value(victim->wait + 1));",
      to: "  victim->set_wait(Value(victim->wait + 2));",
    },
    {
      note: "on_tick does not bump wait",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  victim->set_wait(Value(victim->wait + 1));",
      to: "  (void)victim;",
    },
    {
      note: "mount skips the base call",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "void Buff_Electroshock::mount() {\n  Buff::mount();",
      to: "void Buff_Electroshock::mount() {",
    },
    {
      note: "mount injured test is strict",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    if (equals(state, Value(static_cast<double>(StateEnum::Injured)))) continue;",
      to: "    if (strict_equals(state, Value(static_cast<double>(StateEnum::Injured)))) continue;",
    },
    {
      note: "mount falling test is strict",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    if (equals(state, Value(static_cast<double>(StateEnum::Falling)))) continue;",
      to: "    if (strict_equals(state, Value(static_cast<double>(StateEnum::Falling)))) continue;",
    },
    {
      note: "mount does not skip the injured state",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    if (equals(state, Value(static_cast<double>(StateEnum::Injured)))) continue;\n",
      to: "",
    },
    {
      note: "mount does not skip the falling state",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    if (equals(state, Value(static_cast<double>(StateEnum::Falling)))) continue;\n",
      to: "",
    },
    {
      note: "mount ignores the first victim",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "  for (size_t i = 0; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;",
      to: "  for (size_t i = 1; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;",
    },
    {
      note: "mount does not halve the duration",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    set_duration(round_float(duration() / 2));",
      to: "    set_duration(round_float(duration()));",
    },
    {
      note: "mount doubles the duration",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    set_duration(round_float(duration() / 2));",
      to: "    set_duration(round_float(duration() * 2));",
    },
    {
      note: "mount writes the duration into the tick interval",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    set_duration(round_float(duration() / 2));",
      to: "    set_ticks(round_float(duration() / 2));",
    },
    {
      note: "mount ignores the resolved victim",
      file: "native/lfw/buff/buff_electroshock.cpp",
      from: "    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    const Value state = victim->state();\n    if (equals(state, Value(static_cast<double>(StateEnum::Injured)))) continue;",
      to: "    Entity* victim = world().find_entity(victims[i]);\n    if (victim != nullptr) continue;\n    const Value state = victim->state();\n    if (equals(state, Value(static_cast<double>(StateEnum::Injured)))) continue;",
    },
  ],
};
