/**
 * Mutation spec for `native/lfw/buff/buff_healing.cpp` and
 * `native/lfw/buff/buff_mp_healing.cpp`.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `Buff_MpHealing.on_tick`'s missing `hp >= hp_r` short circuit is *intentional*:
 *    the TS original has it commented out. A mutation that re-adds it would change
 *    behaviour, but it is not a mutation of existing port text, so it is out of
 *    scope here. The case still covers the cap through `min(mp_max, ...)`.
 * 2. `IBuffEntity::hp` / `hp_r` / `set_hp` / `mp` / `mp_max` / `set_mp` default
 *    implementations in `buff.h` are pure accessors that every fake overrides;
 *    mutating a default body changes nothing observable for this subject.
 * 3. `if (victim == nullptr) continue;` cannot be dropped (null dereference) and can
 *    never be taken (the harness resolves every victim id); only the inverted form
 *    is observable and is covered below.
 * 4. `Buff_Healing` / `Buff_MpHealing` share the `mount`/`unmount`/`on_tick` shapes,
 *    so several notes are deliberately duplicated per file: each `file` is mutated
 *    independently, and killing the variant in one file says nothing about the other.
 */
export default {
  subject: "buff_healing",
  mutations: [
    {
      note: "healing: value clamp uses min",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '  const double value = max(1.0, to_number(e.dataset(u"hp_healing_value")));',
      to: '  const double value = min(1.0, to_number(e.dataset(u"hp_healing_value")));',
    },
    {
      note: "healing: value clamp floor lowered",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '  const double value = max(1.0, to_number(e.dataset(u"hp_healing_value")));',
      to: '  const double value = max(0.0, to_number(e.dataset(u"hp_healing_value")));',
    },
    {
      note: "healing: value key swapped for ticks",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '  const double value = max(1.0, to_number(e.dataset(u"hp_healing_value")));',
      to: '  const double value = max(1.0, to_number(e.dataset(u"hp_healing_ticks")));',
    },
    {
      note: "healing: ticks clamp uses min",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '  const double ticks = max(1.0, to_number(e.dataset(u"hp_healing_ticks")));',
      to: '  const double ticks = min(1.0, to_number(e.dataset(u"hp_healing_ticks")));',
    },
    {
      note: "healing: ticks key swapped for value",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '  const double ticks = max(1.0, to_number(e.dataset(u"hp_healing_ticks")));',
      to: '  const double ticks = max(1.0, to_number(e.dataset(u"hp_healing_value")));',
    },
    {
      note: "healing: duration ceiling replaced by floor",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  return ceil(amount / value) * ticks;",
      to: "  return floor(amount / value) * ticks;",
    },
    {
      note: "healing: duration ceiling dropped",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  return ceil(amount / value) * ticks;",
      to: "  return (amount / value) * ticks;",
    },
    {
      note: "healing: amount and value operands swapped",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  return ceil(amount / value) * ticks;",
      to: "  return ceil(value / amount) * ticks;",
    },
    {
      note: "healing: ticks applied as a divisor",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  return ceil(amount / value) * ticks;",
      to: "  return ceil(amount / value) / ticks;",
    },
    {
      note: "healing: base mount is skipped",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "void Buff_Healing::mount() {\n  Buff::mount();",
      to: "void Buff_Healing::mount() {",
    },
    {
      note: "healing: mount writes the mark under another key",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '    victim->set_mark(std::u16string(KIND), id());\n    set_ticks(to_number(victim->dataset(u"hp_healing_ticks")));',
      to: '    victim->set_mark(std::u16string(u"Other"), id(), Value());\n    set_ticks(to_number(victim->dataset(u"hp_healing_ticks")));',
    },
    {
      note: "healing: mount passes a defined previous value",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '    victim->set_mark(std::u16string(KIND), id());\n    set_ticks(to_number(victim->dataset(u"hp_healing_ticks")));',
      to: '    victim->set_mark(std::u16string(KIND), id(), Value(std::u16string(u"x")));\n    set_ticks(to_number(victim->dataset(u"hp_healing_ticks")));',
    },
    {
      note: "healing: mount does not copy the tick interval",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '    set_ticks(to_number(victim->dataset(u"hp_healing_ticks")));',
      to: "    set_ticks(0);",
    },
    {
      note: "healing: mount copies the wrong tick key",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '    set_ticks(to_number(victim->dataset(u"hp_healing_ticks")));',
      to: '    set_ticks(to_number(victim->dataset(u"hp_healing_value")));',
    },
    {
      note: "healing: mount ignores the first victim",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '  for (size_t i = 0; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());',
      to: '  for (size_t i = 1; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());',
    },
    {
      note: "healing: on_tick is never scheduled",
      file: "native/lfw/buff/buff_healing.h",
      from: "  bool has_on_tick() const override { return true; }",
      to: "  bool has_on_tick() const override { return false; }",
    },
    {
      note: "healing: cap test uses a strict comparison",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  if (to_number(victim->hp()) >= to_number(victim->hp_r())) {",
      to: "  if (to_number(victim->hp()) > to_number(victim->hp_r())) {",
    },
    {
      note: "healing: cap branch refreshes the lifetime to zero",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "    set_lifetime(duration());",
      to: "    set_lifetime(0);",
    },
    {
      note: "healing: cap branch is dropped",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  if (to_number(victim->hp()) >= to_number(victim->hp_r())) {\n    set_lifetime(duration());\n    return;\n  }\n",
      to: "",
    },
    {
      note: "healing: heal is not clamped to hp_r",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  victim->set_hp(min(to_number(victim->hp_r()),\n                            to_number(victim->hp()) +\n                                to_number(victim->dataset(u\"hp_healing_value\"))));",
      to: "  victim->set_hp(to_number(victim->hp()) +\n                         to_number(victim->dataset(u\"hp_healing_value\")));",
    },
    {
      note: "healing: heal uses max instead of min",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  victim->set_hp(min(to_number(victim->hp_r()),\n                            to_number(victim->hp()) +\n                                to_number(victim->dataset(u\"hp_healing_value\"))));",
      to: "  victim->set_hp(max(to_number(victim->hp_r()),\n                            to_number(victim->hp()) +\n                                to_number(victim->dataset(u\"hp_healing_value\"))));",
    },
    {
      note: "healing: heal subtracts the heal value",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "                            to_number(victim->hp()) +\n                                to_number(victim->dataset(u\"hp_healing_value\"))));",
      to: "                            to_number(victim->hp()) -\n                                to_number(victim->dataset(u\"hp_healing_value\"))));",
    },
    {
      note: "healing: heal reads the tick key",
      file: "native/lfw/buff/buff_healing.cpp",
      from: '                                to_number(victim->dataset(u"hp_healing_value"))));',
      to: '                                to_number(victim->dataset(u"hp_healing_ticks"))));',
    },
    {
      note: "healing: heal is not applied",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "  victim->set_hp(min(to_number(victim->hp_r()),",
      to: "  if (true) return;\n  victim->set_hp(min(to_number(victim->hp_r()),",
    },
    {
      note: "healing: unmount writes the mark instead of deleting it",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }\n  Buff::unmount();",
      to: "    victim->set_mark(std::u16string(KIND), id());\n  }\n  Buff::unmount();",
    },
    {
      note: "healing: unmount deletes unconditionally",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));",
      to: "    victim->del_mark(std::u16string(KIND), Value());",
    },
    {
      note: "healing: base unmount is skipped",
      file: "native/lfw/buff/buff_healing.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }\n  Buff::unmount();",
      to: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }",
    },
    {
      note: "healing: buff kind changed",
      file: "native/lfw/buff/buff_healing.cpp",
      from: 'const char16_t* Buff_Healing::KIND = u"Healing";',
      to: 'const char16_t* Buff_Healing::KIND = u"Healing2";',
    },
    {
      note: "mp healing: value key swapped for ticks",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: '  const double value = max(1.0, to_number(e.dataset(u"mp_healing_value")));',
      to: '  const double value = max(1.0, to_number(e.dataset(u"mp_healing_ticks")));',
    },
    {
      note: "mp healing: ticks key swapped for value",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: '  const double ticks = max(1.0, to_number(e.dataset(u"mp_healing_ticks")));',
      to: '  const double ticks = max(1.0, to_number(e.dataset(u"mp_healing_value")));',
    },
    {
      note: "mp healing: duration ceiling replaced by floor",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: "  return ceil(amount / value) * ticks;",
      to: "  return floor(amount / value) * ticks;",
    },
    {
      note: "mp healing: base mount is skipped",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: "void Buff_MpHealing::mount() {\n  Buff::mount();",
      to: "void Buff_MpHealing::mount() {",
    },
    {
      note: "mp healing: mount copies the wrong tick key",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: '    set_ticks(to_number(victim->dataset(u"mp_healing_ticks")));',
      to: '    set_ticks(to_number(victim->dataset(u"mp_healing_value")));',
    },
    {
      note: "mp healing: mount does not copy the tick interval",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: '    set_ticks(to_number(victim->dataset(u"mp_healing_ticks")));',
      to: "    set_ticks(0);",
    },
    {
      note: "mp healing: on_tick is never scheduled",
      file: "native/lfw/buff/buff_mp_healing.h",
      from: "  bool has_on_tick() const override { return true; }",
      to: "  bool has_on_tick() const override { return false; }",
    },
    {
      note: "mp healing: restore is not clamped to mp_max",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: "  victim->set_mp(min(to_number(victim->mp_max()),\n                           to_number(victim->mp()) +\n                               to_number(victim->dataset(u\"mp_healing_value\"))));",
      to: "  victim->set_mp(to_number(victim->mp()) +\n                           to_number(victim->dataset(u\"mp_healing_value\")));",
    },
    {
      note: "mp healing: restore clamp reads mp instead of mp_max",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: "  victim->set_mp(min(to_number(victim->mp_max()),",
      to: "  victim->set_mp(min(to_number(victim->mp()),",
    },
    {
      note: "mp healing: restore writes hp instead of mp",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: "  victim->set_mp(min(to_number(victim->mp_max()),",
      to: "  victim->set_hp(min(to_number(victim->mp_max()),",
    },
    {
      note: "mp healing: restore reads the hp heal key",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: '                               to_number(victim->dataset(u"mp_healing_value"))));',
      to: '                               to_number(victim->dataset(u"hp_healing_value"))));',
    },
    {
      note: "mp healing: unmount deletes unconditionally",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));",
      to: "    victim->del_mark(std::u16string(KIND), Value());",
    },
    {
      note: "mp healing: base unmount is skipped",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }\n  Buff::unmount();",
      to: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }",
    },
    {
      note: "mp healing: buff kind changed",
      file: "native/lfw/buff/buff_mp_healing.cpp",
      from: 'const char16_t* Buff_MpHealing::KIND = u"MpHealing";',
      to: 'const char16_t* Buff_MpHealing::KIND = u"MpHealing2";',
    },
  ],
};
