/**
 * Mutation spec for `native/lfw/buff/buff_group_attack.cpp` and
 * `native/lfw/buff/buff_electrify.cpp`.
 *
 * 切片 4CQ：`buff.h` 里那两个 `set_mark` / `del_mark` 自由函数已删（它们是 `Entity` 还没移植
 * 时的副本），子类改调 `victim->set_mark(...)` / `victim->del_mark(...)` —— 这两条语义的变异
 * 归 `entity.mjs`（那边直接打在 `Entity::set_mark/del_mark` 上）。
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `GROUPS()` is pure data for the (still missing) buff factory; nothing in this
 *    unit or in the harness reads it, so any change to its contents is
 *    unobservable. It is ported for fidelity and no mutation targets it.
 * 2. `if (victim == nullptr) continue;` cannot be dropped (it would dereference a
 *    null pointer) and, with the harness resolving every victim id, it can never
 *    be *taken* either. The observable form -- inverting it so that resolved
 *    victims are skipped -- is covered below.
 * 3. `Buff_GroupAttack::place_effect`'s `victim` parameter is forwarded straight to
 *    `place_effect_center`; swapping the two arguments there is covered by the
 *    "place effect not centred" mutation, and passing a null victim is out of
 *    contract.
 * 4. `effect_oid()` returning a *different non-empty* string is observable only
 *    because the harness logs `find_data:<oid>`; without that log it would be
 *    invisible (any non-empty oid yields a truthy data object). The empty-string
 *    arm (`update_effects` bails out early) is covered separately.
 * 5. `set_mark`'s `equals(e.marks_get(key), prev)` test is dead: every caller in
 *    this unit passes `Value()` as `prev` (the buff subclasses never pass the
 *    third argument), so the `std::holds_alternative<std::monostate>` disjunct
 *    short-circuits first and the comparison is never evaluated. Inverting it is
 *    therefore unobservable. `del_mark`'s equivalent test IS live (its callers
 *    pass the buff id) and is covered below.
 */
export default {
  subject: "buff_marks",
  mutations: [
    {
      note: "group attack: effect oid changed",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: 'std::u16string Buff_GroupAttack::effect_oid() const { return std::u16string(u"fx"); }',
      to: 'std::u16string Buff_GroupAttack::effect_oid() const { return std::u16string(u"fxx"); }',
    },
    {
      note: "group attack: effect oid dropped",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: 'std::u16string Buff_GroupAttack::effect_oid() const { return std::u16string(u"fx"); }',
      to: "std::u16string Buff_GroupAttack::effect_oid() const { return std::u16string(); }",
    },
    {
      note: "group attack: effect frame id changed",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: 'std::u16string Buff_GroupAttack::effect_frame_id() const { return std::u16string(u"16"); }',
      to: 'std::u16string Buff_GroupAttack::effect_frame_id() const { return std::u16string(u"17"); }',
    },
    {
      note: "group attack: effect is not centred",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "void Buff_GroupAttack::place_effect(Entity* effect, Entity* victim) {\n  place_effect_center(effect, victim);\n}",
      to: "void Buff_GroupAttack::place_effect(Entity* effect, Entity* victim) {\n  Buff::place_effect(effect, victim);\n}",
    },
    {
      note: "group attack: buff kind changed",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: 'const char16_t* Buff_GroupAttack::KIND = u"GroupAttack";',
      to: 'const char16_t* Buff_GroupAttack::KIND = u"GroupAttack2";',
    },
    {
      note: "group attack: base mount is skipped",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "void Buff_GroupAttack::mount() {\n  Buff::mount();",
      to: "void Buff_GroupAttack::mount() {",
    },
    {
      note: "group attack: mount skips every resolved victim",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());",
      to: "    Entity* victim = world().find_entity(victims[i]);\n    if (victim != nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());",
    },
    {
      note: "group attack: mount ignores the first victim",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "  for (size_t i = 0; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());",
      to: "  for (size_t i = 1; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());",
    },
    {
      note: "group attack: mount writes the mark under another key",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: '    victim->set_mark(std::u16string(KIND), id());',
      to: '    victim->set_mark(std::u16string(u"Other"), id(), Value());',
    },
    {
      note: "group attack: mount stores a constant instead of the buff id",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: '    victim->set_mark(std::u16string(KIND), id());',
      to: '    victim->set_mark(std::u16string(KIND), std::u16string(u"zz"), Value());',
    },
    {
      note: "group attack: mount passes a defined previous value",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: '    victim->set_mark(std::u16string(KIND), id());',
      to: '    victim->set_mark(std::u16string(KIND), id(), Value(std::u16string(u"x")));',
    },
    {
      note: "group attack: unmount writes the mark instead of deleting it",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));",
      to: "    victim->set_mark(std::u16string(KIND), id());",
    },
    {
      note: "group attack: unmount deletes unconditionally",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));",
      to: "    victim->del_mark(std::u16string(KIND), Value());",
    },
    {
      note: "group attack: unmount uses another mark key",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));",
      to: '    victim->del_mark(std::u16string(u"Other"), Value(std::u16string(id())));',
    },
    {
      note: "group attack: base unmount is skipped",
      file: "native/lfw/buff/buff_group_attack.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }\n  Buff::unmount();",
      to: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }",
    },
    {
      note: "electrify: buff kind changed",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: 'const char16_t* Buff_Electrify::KIND = u"Electrify";',
      to: 'const char16_t* Buff_Electrify::KIND = u"Electrify2";',
    },
    {
      note: "electrify: effect frame id changed",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: 'std::u16string Buff_Electrify::effect_frame_id() const { return std::u16string(u"32"); }',
      to: 'std::u16string Buff_Electrify::effect_frame_id() const { return std::u16string(u"16"); }',
    },
    {
      note: "electrify: effect oid changed",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: 'std::u16string Buff_Electrify::effect_oid() const { return std::u16string(u"fx"); }',
      to: 'std::u16string Buff_Electrify::effect_oid() const { return std::u16string(u"fxx"); }',
    },
    {
      note: "electrify: effect is not centred",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "void Buff_Electrify::place_effect(Entity* effect, Entity* victim) {\n  place_effect_center(effect, victim);\n}",
      to: "void Buff_Electrify::place_effect(Entity* effect, Entity* victim) {\n  Buff::place_effect(effect, victim);\n}",
    },
    {
      note: "electrify: base mount is skipped",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "void Buff_Electrify::mount() {\n  Buff::mount();",
      to: "void Buff_Electrify::mount() {",
    },
    {
      note: "electrify: mount uses the group attack mark kind",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "    victim->set_mark(std::u16string(KIND), id());",
      to: '    victim->set_mark(std::u16string(u"GroupAttack"), id(), Value());',
    },
    {
      note: "electrify: mount ignores the first victim",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "  for (size_t i = 0; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());",
      to: "  for (size_t i = 1; i < victims.size(); ++i) {\n    Entity* victim = world().find_entity(victims[i]);\n    if (victim == nullptr) continue;\n    victim->set_mark(std::u16string(KIND), id());",
    },
    {
      note: "electrify: mount stores a constant instead of the buff id",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "    victim->set_mark(std::u16string(KIND), id());",
      to: '    victim->set_mark(std::u16string(KIND), std::u16string(u"zz"), Value());',
    },
    {
      note: "electrify: unmount deletes unconditionally",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));",
      to: "    victim->del_mark(std::u16string(KIND), Value());",
    },
    {
      note: "electrify: unmount uses another mark key",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));",
      to: '    victim->del_mark(std::u16string(u"Other"), Value(std::u16string(id())));',
    },
    {
      note: "electrify: base unmount is skipped",
      file: "native/lfw/buff/buff_electrify.cpp",
      from: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }\n  Buff::unmount();",
      to: "    victim->del_mark(std::u16string(KIND), Value(std::u16string(id())));\n  }",
    },
  ],
};
