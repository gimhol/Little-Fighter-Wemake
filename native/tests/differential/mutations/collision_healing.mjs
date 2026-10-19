/**
 * Mutation spec for `native/lfw/collision/healing.cpp`.
 *
 * The duration formula used to be inlined here; since `Buff_Healing` was ported
 * (slice 4) it lives in `native/lfw/buff/buff_healing.cpp` and is covered by the
 * `buff_healing` subject. What this unit owns now is only:
 * the `itr.injury` guard, the two id lookups, the `Healing` kind, and *what* entity
 * and duration are handed to `grant_buff`.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `if (v == nullptr) return;` removed, or rewritten as `if (a == nullptr)`, is
 *    unobservable: the harness resolves both `collision.aid` (`"A"`) and
 *    `collision.vid` (`"V"`), so neither lookup can fail. The guard is a port
 *    artefact of turning the TS destructuring (`const { attacker, victim }`) into
 *    two id lookups; it is not reachable from any in-contract input.
 * 2. Handing the attacker straight through degenerates to `a` because `a` is never
 *    null here; the old `a == nullptr ? nullptr : a->buff_entity()` indirection
 *    disappeared with the collision entity interfaces (4CE), so `a` is passed as-is.
 *    The TS original also passes `attacker` straight through (`grant_buff` itself only
 *    calls `set_attacker` when the attacker is truthy).
 * 3. Swapping the two `set_healing_env` / `healing_env` accessors or reordering the
 *    three `grant_buff` arguments that follow the kind is behaviour preserving for
 *    this harness; the observable orderings are covered by the "handed to
 *    grant_buff" pair below.
 * 4. `world.buffs_get` / `lfw.create_buff` 是从 victim 实体上取到的（TS `grant_buff` 同样从
 *    `victim` 上解构 `lfw`/`world`），没有可替换的 env 参数。
 */
export default {
  subject: "collision_healing",
  mutations: [
    {
      note: "injury key misspelled",
      file: "native/lfw/collision/healing.cpp",
      from: '  const Value injury = field_or(c.itr, u"injury");',
      to: '  const Value injury = field_or(c.itr, u"injuries");',
    },
    {
      note: "injury read from bdy instead of itr",
      file: "native/lfw/collision/healing.cpp",
      from: '  const Value injury = field_or(c.itr, u"injury");',
      to: '  const Value injury = field_or(c.bdy, u"injury");',
    },
    {
      note: "falsy injury guard inverted",
      file: "native/lfw/collision/healing.cpp",
      from: "  if (!truthy(injury)) return;",
      to: "  if (truthy(injury)) return;",
    },
    {
      note: "falsy injury guard removed",
      file: "native/lfw/collision/healing.cpp",
      from: "  const Value injury = field_or(c.itr, u\"injury\");\n  if (!truthy(injury)) return;",
      to: '  const Value injury = field_or(c.itr, u"injury");',
    },
    {
      note: "attacker resolved from the victim id",
      file: "native/lfw/collision/healing.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);",
      to: "  Entity* a = g_env.find_entity(c.vid);",
    },
    {
      note: "attacker resolved from an empty id",
      file: "native/lfw/collision/healing.cpp",
      from: "  Entity* a = g_env.find_entity(c.aid);",
      to: "  Entity* a = g_env.find_entity(std::u16string());",
    },
    {
      note: "victim resolved from the attacker id",
      file: "native/lfw/collision/healing.cpp",
      from: "  Entity* v = g_env.find_entity(c.vid);",
      to: "  Entity* v = g_env.find_entity(c.aid);",
    },
    {
      note: "buff kind misspelled",
      file: "native/lfw/collision/healing.cpp",
      from: '  buff::grant_buff(u"Healing", a, v,',
      to: '  buff::grant_buff(u"Healing", a, v,'.replace('u"Healing"', 'u"healing"'),
    },
    {
      note: "attacker handed to grant_buff is the victim",
      file: "native/lfw/collision/healing.cpp",
      from: "  buff::grant_buff(u\"Healing\", a, v, buff::Buff_Healing::duration_of(*v, to_number(injury)));",
      to: '  buff::grant_buff(u"Healing", v, v, buff::Buff_Healing::duration_of(*v, to_number(injury)));',
    },
    {
      note: "victim handed to grant_buff is the attacker",
      file: "native/lfw/collision/healing.cpp",
      from: "  buff::grant_buff(u\"Healing\", a, v, buff::Buff_Healing::duration_of(*v, to_number(injury)));",
      to: '  buff::grant_buff(u"Healing", a, a, buff::Buff_Healing::duration_of(*v, to_number(injury)));',
    },
    {
      note: "duration is not derived from the injury",
      file: "native/lfw/collision/healing.cpp",
      from: "buff::Buff_Healing::duration_of(*v, to_number(injury)));",
      to: "0.0);",
    },
    {
      note: "duration reads the attacker dataset",
      file: "native/lfw/collision/healing.cpp",
      from: "buff::Buff_Healing::duration_of(*v, to_number(injury)));",
      to: "buff::Buff_Healing::duration_of(*a, to_number(injury)));",
    },
  ],
};
