// Mutation spec for the `burning_drink` differential slice.
//
// Subject: native/lfw/state/character_state_drink.{h,cpp}
//        + native/lfw/state/state_burning.{h,cpp}
//        + the new character-proxy constructor / dispatch in
//          native/lfw/state/state_base_proxy.{h,cpp}
//
// Notes recorded up front (unobservable-by-design items, not silently skipped):
//  * `holding.hp = holding.hp_r = 1` is a right-to-left assignment chain; the
//    two seams stay SILENT, so swapping the two calls (or the order of the
//    two `set_hp` calls) is unobservable and intentionally absent.
//  * `holding.lfw.mt.mark = "drink_drop"` used to be treated as an unobservable debug
//    probe (the C++ MT port had no `mark` / `mt_cases` back then). 9k changed that:
//    the port now writes it through the new `holding_mt_mark` seam and the `run mtmark`
//    op prints it, so this write has real mutations below.
//  * `drink.hp_h_value` and friends are `number` in the original types; a
//    string would make TS `+` concatenate while the port adds numerically.
//    The cases only feed numbers, so the ported arithmetic is exact for every
//    covered input.
//  * The three `*_empty` reads are destructured once in TS and read once in
//    the port; re-reading them per branch is pure and therefore unobservable.
//  * Mutating `if (drink == nullptr) return;` away would dereference a null
//    pointer (UB, not a divergence), so the guard itself is not mutated.
//  * `State_Burning` passes `void 0` for weapon/ball/proxy; those three stay
//    default-constructed from `state`, which is exactly what the port does.
//  * The `next_frame` helper builds `{id:"auto"}`; a single-key object has no
//    key-order freedom.
//  * The `mt.range(-6, 6)` result is injected (`holding_mt_range`); the real
//    MT stream is covered by the `mersenne_twister` subject, so this slice
//    only locks the argument order / bounds / division through the log.

export default {
  subject: "burning_drink",
  mutations: [
    // ---- CharacterState_Drink ----
    {
      note: "the drink state drops its default state",
      file: "native/lfw/state/character_state_drink.h",
      from: "= Value(static_cast<double>(StateEnum::Drink)))",
      to: "= Value(0.0))",
    },
    {
      note: "the drink update drops the base update",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  CharacterState_Base::update(e);\n  if (!e.has_holding()) return;",
      to: "  if (!e.has_holding()) return;",
    },
    {
      note: "the holding guard is inverted",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (!e.has_holding()) return;\n  DrinkInfo* drink = e.holding_drink();",
      to: "  if (e.has_holding()) return;\n  DrinkInfo* drink = e.holding_drink();",
    },
    {
      note: "the hp tick gate is dropped",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (!hp_h_empty && drink->hp_h_ticks().add()) {",
      to: "  if (!hp_h_empty) {",
    },
    {
      note: "the hp emptiness test is inverted",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (!hp_h_empty && drink->hp_h_ticks().add()) {",
      to: "  if (hp_h_empty && drink->hp_h_ticks().add()) {",
    },
    {
      note: "the hp recovery is clamped with max",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    e.set_hp(min(e.hp_max(),",
      to: "    e.set_hp(max(e.hp_max(),",
    },
    {
      note: "the hp recovery clamps against hp instead of hp_max",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    e.set_hp(min(e.hp_max(),\n                       e.hp() + to_number(drink->hp_h_value())));",
      to: "    e.set_hp(min(e.hp(),\n                       e.hp() + to_number(drink->hp_h_value())));",
    },
    {
      note: "the hp value is not added",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    e.set_hp(min(e.hp_max(),\n                       e.hp() + to_number(drink->hp_h_value())));",
      to: "    e.set_hp(min(e.hp_max(),\n                       e.hp())));",
    },
    {
      note: "the hp value is subtracted",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "                       e.hp() + to_number(drink->hp_h_value())));",
      to: "                       e.hp() - to_number(drink->hp_h_value())));",
    },
    {
      note: "the consumed amount is not accumulated",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    drink->set_hp_h(Value(to_number(drink->hp_h()) + to_number(drink->hp_h_value())));",
      to: "    drink->set_hp_h(Value(to_number(drink->hp_h_value())));",
    },
    {
      note: "the hp_r tick gate is dropped",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (!hp_r_empty && drink->hp_r_ticks().add()) {",
      to: "  if (!hp_r_empty) {",
    },
    {
      note: "the hp_r emptiness test is inverted",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (!hp_r_empty && drink->hp_r_ticks().add()) {",
      to: "  if (hp_r_empty && drink->hp_r_ticks().add()) {",
    },
    {
      note: "the hp_r recovery clamps against hp instead of hp_max",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    e.set_hp_r(min(e.hp_max(),\n                         e.hp_r() + to_number(drink->hp_r_value())));",
      to: "    e.set_hp_r(min(e.hp(),\n                         e.hp_r() + to_number(drink->hp_r_value())));",
    },
    {
      note: "the hp_r value is not added",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "                         e.hp_r() + to_number(drink->hp_r_value())));",
      to: "                         e.hp_r())));",
    },
    {
      note: "the consumed hp_r is not accumulated",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    drink->set_hp_r(Value(to_number(drink->hp_r()) + to_number(drink->hp_r_value())));",
      to: "    drink->set_hp_r(Value(to_number(drink->hp_r_value())));",
    },
    {
      note: "the mp tick gate is dropped",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (!mp_h_empty && drink->mp_h_ticks().add()) {",
      to: "  if (!mp_h_empty) {",
    },
    {
      note: "the mp emptiness test is inverted",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (!mp_h_empty && drink->mp_h_ticks().add()) {",
      to: "  if (mp_h_empty && drink->mp_h_ticks().add()) {",
    },
    {
      note: "the mp recovery clamps against hp_max",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    e.set_mp(min(e.mp_max(),",
      to: "    e.set_mp(min(e.hp_max(),",
    },
    {
      note: "the mp value is not added",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "                       e.mp() + to_number(drink->mp_h_value())));",
      to: "                       e.mp())));",
    },
    {
      note: "the consumed mp is not accumulated",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    drink->set_mp_h(Value(to_number(drink->mp_h()) + to_number(drink->mp_h_value())));",
      to: "    drink->set_mp_h(Value(to_number(drink->mp_h_value())));",
    },
    {
      note: "the drop block fires when any part is empty",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "  if (hp_h_empty && hp_r_empty && mp_h_empty) {",
      to: "  if (hp_h_empty || hp_r_empty || mp_h_empty) {",
    },
    {
      note: "the holding is not dropped",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    e.drop_holding();\n    e.enter_frame(next_frame(Value(std::u16string(frame_id::kAuto))));",
      to: "    e.enter_frame(next_frame(Value(std::u16string(frame_id::kAuto))));",
    },
    {
      note: "the auto frame is not entered",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    e.enter_frame(next_frame(Value(std::u16string(frame_id::kAuto))));",
      to: "    e.enter_frame(Value());",
    },
    {
      note: "the held weapon hp_r is not reset",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    held->set_hp_r(1.0);",
      to: "    held->set_hp_r(2.0);",
    },
    {
      note: "the held weapon hp is not reset",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    held->set_hp(1.0);",
      to: "    held->set_hp(0.0);",
    },
    {
      note: "the random range is read from the wrong operator",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;",
      to: "    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) * 2.0;",
    },
    {
      note: "the random range bounds are swapped",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;",
      to: "    const double vx = to_number(e.holding_mt_range(6.0, -6.0)) / 2.0;",
    },
    {
      note: "the random range upper bound is wrong",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;",
      to: "    const double vx = to_number(e.holding_mt_range(-6.0, 7.0)) / 2.0;",
    },
    {
      note: "the thrown velocity drops the random component",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "      held->set_velocity(Value(vx), Value(6.0), Value(0.0));",
      to: "      held->set_velocity(Value(0.0), Value(6.0), Value(0.0));",
    },
    {
      note: "the thrown velocity drops its y component",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "      held->set_velocity(Value(vx), Value(6.0), Value(0.0));",
      to: "      held->set_velocity(Value(vx), Value(0.0), Value(0.0));",
    },
    {
      note: "the thrown velocity z component is wrong",
      file: "native/lfw/state/character_state_drink.cpp",
      from: "      held->set_velocity(Value(vx), Value(6.0), Value(0.0));",
      to: "      held->set_velocity(Value(vx), Value(6.0), Value(1.0));",
    },
    // ---- State_Burning ----
    {
      note: "the burning state drops its default state",
      file: "native/lfw/state/state_burning.h",
      from: "= Value(static_cast<double>(StateEnum::Burning)))",
      to: "= Value(0.0))",
    },
    {
      note: "the burning state drops its state argument",
      file: "native/lfw/state/state_burning.cpp",
      from: ": StateBase_Proxy(state, std::make_unique<CharacterState_Burning>()) {}",
      to: ": StateBase_Proxy(Value(), std::make_unique<CharacterState_Burning>()) {}",
    },
    {
      note: "the burning state does not install the burning character proxy",
      file: "native/lfw/state/state_burning.cpp",
      from: ": StateBase_Proxy(state, std::make_unique<CharacterState_Burning>()) {}",
      to: ": StateBase_Proxy(state) {}",
    },
    // ---- StateBase_Proxy (character-proxy constructor + dispatch) ----
    {
      note: "the injected character proxy is ignored",
      file: "native/lfw/state/state_base_proxy.cpp",
      from: "      _character_proxy(character_proxy != nullptr\n                           ? std::move(character_proxy)\n                           : std::make_unique<CharacterState_Base>(state)),",
      to: "      _character_proxy(std::make_unique<CharacterState_Base>(state)),",
    },
    {
      note: "fighters are routed to the plain base proxy",
      file: "native/lfw/state/state_base_proxy.cpp",
      from: "  if (entity::is_fighter_data(data)) return *_character_proxy;",
      to: "  if (entity::is_fighter_data(data)) return _proxy;",
    },
    {
      note: "the fighter test reads the weapon data",
      file: "native/lfw/state/state_base_proxy.cpp",
      from: "  if (entity::is_fighter_data(data)) return *_character_proxy;",
      to: "  if (entity::is_weapon_data(data)) return *_character_proxy;",
    },
    {
      note: "balls are routed to the weapon proxy",
      file: "native/lfw/state/state_base_proxy.cpp",
      from: "  if (entity::is_ball_data(data)) return _ball_proxy;",
      to: "  if (entity::is_ball_data(data)) return _weapon_proxy;",
    },
    {
      note: "掉落分支：mark 写成 drink_grab",
      file: "native/lfw/state/character_state_drink.cpp",
      from: `    e.holding_mt_mark(u\"drink_drop\");`,
      to: `    e.holding_mt_mark(u\"drink_grab\");`,
    },
    {
      note: "掉落分支：不写 mark",
      file: "native/lfw/state/character_state_drink.cpp",
      from: `    e.holding_mt_mark(u\"drink_drop\");\n    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;`,
      to: `    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;`,
    },
    {
      note: "掉落分支：mark 写在抽取之后",
      file: "native/lfw/state/character_state_drink.cpp",
      from: `    e.holding_mt_mark(u\"drink_drop\");\n    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;`,
      to: `    const double vx = to_number(e.holding_mt_range(-6.0, 6.0)) / 2.0;\n    e.holding_mt_mark(u\"drink_drop\");`,
    },
  ],
};
