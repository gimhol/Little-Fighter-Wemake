/**
 * Mutation spec for `native/lfw/state/state_base.{h,cpp}`.
 *
 * Disproven / unobservable mutations (proven by reading the TS original, the port
 * and the case file, not by a surviving run):
 *
 * 1. `update(e)` is an **empty** method in `State_Base.ts`; there is nothing in it to
 *    change, so the case only asserts that calling it produces no log and no state
 *    change.
 * 2. The optional hooks (`pre_update` / `enter` / `on_dead` / `on_landing` /
 *    `get_gravity` / `get_sudden_death_frame` / `get_caught_end_frame` /
 *    `get_auto_frame` / `find_frame_by_id` / `on_leave_ground`) are declaration-only in
 *    this unit: `State_Base.ts` declares them with `?` and nothing in the class calls
 *    them. They are modelled as empty `std::function` members, which reproduces the
 *    `?.` truthiness check the real callers use (`this._state?.get_gravity?.(this)` is
 *    exactly `if (s->get_gravity) ...`). Their bodies belong to the state subclasses
 *    and to the `States` unit.
 * 3. `leave`'s `next_frame` parameter is unused by `State_Base.ts` itself.
 * 4. `grant_buff` passing `nullptr` as the attacker is unobservable here: the only
 *    effect of a non-null attacker is `Buff::set_attacker_entity`, which this unit's
 *    harness neither logs nor reads back.
 * 5. `e.set_velocity(vx, null, vz)` writes `null` for `y`; the harness reproduces the
 *    real `Entity.set_velocity` rule (skip `null` / `undefined`), so `y` is only
 *    observable through the log text.
 */
export default {
  subject: "state_base",
  mutations: [
    {
      note: "the minimum velocity is one",
      file: "native/lfw/state/state_base.cpp",
      from: "constexpr double kMinV = 0.5;",
      to: "constexpr double kMinV = 1.0;",
    },
    {
      note: "self heal restores another amount",
      file: "native/lfw/state/state_base.cpp",
      from: "constexpr double kStateHealSelfHp = 104;",
      to: "constexpr double kStateHealSelfHp = 105;",
    },
    {
      note: "the heal self case is loose",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!strict_equals(_state, Value(static_cast<double>(StateEnum::HealSelf)))) return;",
      to: "  if (!equals(_state, Value(static_cast<double>(StateEnum::HealSelf)))) return;",
    },
    {
      note: "the heal self case is another state",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!strict_equals(_state, Value(static_cast<double>(StateEnum::HealSelf)))) return;",
      to: "  if (!strict_equals(_state, Value(static_cast<double>(StateEnum::Frozen)))) return;",
    },
    {
      note: "leave grants a buff in every state",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!strict_equals(_state, Value(static_cast<double>(StateEnum::HealSelf)))) return;\n",
      to: "",
    },
    {
      note: "the granted buff has another kind",
      file: "native/lfw/state/state_base.cpp",
      from: "  buff::grant_buff(buff::Buff_Healing::KIND, nullptr, victim, duration);",
      to: '  buff::grant_buff(u"Other", nullptr, victim, duration);',
    },
    {
      note: "the granted duration ignores the heal amount",
      file: "native/lfw/state/state_base.cpp",
      from: "      victim == nullptr ? 0.0 : buff::Buff_Healing::duration_of(*victim, kStateHealSelfHp);",
      to: "      victim == nullptr ? 0.0 : buff::Buff_Healing::duration_of(*victim, 0);",
    },
    {
      note: "leave never grants",
      file: "native/lfw/state/state_base.cpp",
      from: "  buff::grant_buff(buff::Buff_Healing::KIND, nullptr, victim, duration);\n",
      to: "",
    },
    {
      note: "the x axis is ignored",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(x, px)) vx = nan_to_null(clamp_velocity(e.velocity_x()));\n",
      to: "",
    },
    {
      note: "the z axis is ignored",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(z, pz)) vz = nan_to_null(clamp_velocity(e.velocity_z()));\n",
      to: "",
    },
    {
      note: "a moved x is not detected",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(x, px)) vx = nan_to_null(clamp_velocity(e.velocity_x()));",
      to: "  if (float_equal(x, px)) vx = nan_to_null(clamp_velocity(e.velocity_x()));",
    },
    {
      note: "a moved z is not detected",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(z, pz)) vz = nan_to_null(clamp_velocity(e.velocity_z()));",
      to: "  if (float_equal(z, pz)) vz = nan_to_null(clamp_velocity(e.velocity_z()));",
    },
    {
      note: "the x test uses the z position",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(x, px)) vx = nan_to_null(clamp_velocity(e.velocity_x()));",
      to: "  if (!float_equal(x, pz)) vx = nan_to_null(clamp_velocity(e.velocity_x()));",
    },
    {
      note: "the z test uses the x position",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(z, pz)) vz = nan_to_null(clamp_velocity(e.velocity_z()));",
      to: "  if (!float_equal(z, px)) vz = nan_to_null(clamp_velocity(e.velocity_z()));",
    },
    {
      note: "the x velocity is used for the z axis",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(z, pz)) vz = nan_to_null(clamp_velocity(e.velocity_z()));",
      to: "  if (!float_equal(z, pz)) vz = nan_to_null(clamp_velocity(e.velocity_x()));",
    },
    {
      note: "the y test is never taken",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(y, py)) {",
      to: "  if (float_equal(y, py)) {",
    },
    {
      note: "the y test reuses the z position",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(y, py)) {",
      to: "  if (!float_equal(y, pz)) {",
    },
    {
      note: "a moved y does not clamp the x axis",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(y, py)) {\n    vx = nan_to_null(clamp_velocity(e.velocity_x()));\n    vz = nan_to_null(clamp_velocity(e.velocity_z()));\n  }\n",
      to: "",
    },
    {
      note: "a moved y clamps the x axis from the z velocity",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!float_equal(y, py)) {\n    vx = nan_to_null(clamp_velocity(e.velocity_x()));",
      to: "  if (!float_equal(y, py)) {\n    vx = clamp_velocity(e.velocity_z());",
    },
    {
      note: "a moved y clamps the z axis from the x velocity",
      file: "native/lfw/state/state_base.cpp",
      from: "    vz = nan_to_null(clamp_velocity(e.velocity_z()));\n  }",
      to: "    vz = nan_to_null(clamp_velocity(e.velocity_x()));\n  }",
    },
    {
      note: "the position is read into the wrong locals",
      file: "native/lfw/state/state_base.cpp",
      from: "  px = e.position.x; py = e.position.y; pz = e.position.z;",
      to: "  px = e.position.z; py = e.position.y; pz = e.position.x;",
    },
    {
      note: "the entity position is not read",
      file: "native/lfw/state/state_base.cpp",
      from: "  px = e.position.x; py = e.position.y; pz = e.position.z;\n",
      to: "",
    },
    {
      note: "the velocity is written even when nothing moved",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!is_null(vx) || !is_null(vz) || !is_null(vy)) e.set_velocity(vx, vy, vz);",
      to: "  if (!is_null(vx) && !is_null(vz) && !is_null(vy)) e.set_velocity(vx, vy, vz);",
    },
    {
      note: "the velocity is never written",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!is_null(vx) || !is_null(vz) || !is_null(vy)) e.set_velocity(vx, vy, vz);\n",
      to: "",
    },
    {
      note: "the missing velocity counts as null",
      file: "native/lfw/state/state_base.cpp",
      from: "bool is_null(const Value& v) { return std::holds_alternative<NullTag>(v); }",
      to: "bool is_null(const Value& v) { return !std::holds_alternative<double>(v); }",
    },
    {
      note: "the y velocity is written first",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (!is_null(vx) || !is_null(vz) || !is_null(vy)) e.set_velocity(vx, vy, vz);",
      to: "  if (!is_null(vx) || !is_null(vz) || !is_null(vy)) e.set_velocity(vx, vz, vy);",
    },
    {
      note: "the y velocity starts as missing",
      file: "native/lfw/state/state_base.cpp",
      from: "  const Value vy(NullTag{});",
      to: "  const Value vy;",
    },
    {
      note: "the x velocity starts as null",
      file: "native/lfw/state/state_base.cpp",
      from: "  Value vx(NullTag{});",
      to: "  Value vx;",
    },
    {
      note: "the z velocity starts as null",
      file: "native/lfw/state/state_base.cpp",
      from: "  Value vz(NullTag{});",
      to: "  Value vz;",
    },
    {
      note: "the position is not written back",
      file: "native/lfw/state/state_base.cpp",
      from: "  e.assign_position(x, y, z);\n",
      to: "",
    },
    {
      note: "the position is written with x and y swapped",
      file: "native/lfw/state/state_base.cpp",
      from: "  e.assign_position(x, y, z);",
      to: "  e.assign_position(y, x, z);",
    },
    {
      note: "the negative clamp returns the positive bound",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (d < -kMinV) return Value(-kMinV);",
      to: "  if (d < -kMinV) return Value(kMinV);",
    },
    {
      note: "the positive clamp returns the negative bound",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (d > kMinV) return Value(kMinV);",
      to: "  if (d > kMinV) return Value(-kMinV);",
    },
    {
      note: "the clamp never lowers the velocity",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (d < -kMinV) return Value(-kMinV);\n",
      to: "",
    },
    {
      note: "the clamp never raises the velocity",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (d > kMinV) return Value(kMinV);\n",
      to: "",
    },
    {
      note: "the clamp ignores the original value",
      file: "native/lfw/state/state_base.cpp",
      from: "  if (d > kMinV) return Value(kMinV);\n  return v;\n}",
      to: "  if (d > kMinV) return Value(kMinV);\n  return Value(d);\n}",
    },
    {
      note: "the state is not stored",
      file: "native/lfw/state/state_base.h",
      from: "  explicit State_Base(Value state) : _state(std::move(state)) {}",
      to: "  explicit State_Base(Value state) : _state(Value()) { (void)state; }",
    },
  ],
};
