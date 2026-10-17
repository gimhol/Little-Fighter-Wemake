// Mutation spec for the `entity` differential slice.
//
// Subject: native/lfw/entity/entity.{h,cpp} (the TS side drives the real
// `src/LFW/entity/Entity.ts` class through a stub world / lfw).
//
// Notes recorded up front (unobservable-by-design items, not silently skipped):
//  * The TS constructor needs `data.base` to exist (`reset` reads `data.base.*`
//    without a guard): every scene supplies a `base` record, so the port reading it
//    defensively is not a difference the harness can observe.
//  * `reset` also clears `copies` / `vrests` / `blockers` / `superpunchs` / the
//    collision lists and iterates `buffs` calling `del_victim`. Those containers are
//    empty in every scene (the collision / buff wiring slices own them), so mutating
//    their clearing is equivalent by construction and is not listed.
//  * `terrain` / `_atom_time` / `prev_position` / `velocity` / `_motionless_ticks`
//    are written by `reset` but nothing in this slice reads them back, so they are
//    only observable once the physics slices land.
//  * `add_catch_time(0)` and `set_catch_time(_catch_time)` are the same call, so the
//    `!value` early return is equivalent for the values the DSL can express.
//  * Three candidates are withdrawn as equivalent by construction and are noted here
//    instead of being listed: (a) `reset`'s `_toughness_resting_max = …DEFAULT_…`
//    and (c) `reset`'s `_toughness_r_value = dataset(…)` are both overwritten by
//    `reset_armor()` later in the same `reset` (60 → `armor?.toughness_resting ?? 0`),
//    and (b) the equality guards of `set_arest` / `set_catch_time` are unobservable
//    because neither setter notifies (`arest` has no callback, `set_catch_time` only
//    writes the slot).
//  * `state_on_dead` / `state_get_gravity` model `_state?.on_dead?.()` /
//    `_state?.get_gravity?.()`; "no state" and "state without that hook" both mean
//    "don't call", which is unobservable by design.
//  * Slice 9b (velocity / friction / gravity) additions:
//    - The `fv*_f` / `friction_*` / `land_friction_*` keys all have `WorldDataset`
//      defaults, so `dataset(...)` never returns `undefined` in a scene that does not
//      delete them; the `fz == undefined → accz = accx` default-parameter branch is
//      therefore unreachable and its "pass the value straight through" candidate is
//      equivalent by construction.
//    - `vxm = Default` / `vzm = Default` / `ctrl_x = 0` style destructuring defaults are
//      unobservable: `calc_v`'s fallback branch is exactly `SpeedMode.Default`, and
//      `undefined` vs `0` is the same in every `truthy` / `equals` test used here.
//    - `update_velocity`'s `if (truthy(dv)) dv = round_float(dv * f)` and
//      `if (!nullish(dv)) …` agree on every value: falsy non-nullish inputs (`0`, `""`,
//      `NaN`) multiply into the same effective value, `null`/`undefined` skip in both.
//    - The `&& truthy(dvx)` half of the `acc_*` defaulting rule is unobservable for the
//      same reason (a falsy `dvx` would default `acc` to an equivalent zero).
//  * The mutation runner rebuilds and compares whole traces, so a wrong literal, a
//    dropped notification, an inverted clamp or a swapped `??` all surface as drift.

// 9l（spawn / on_spawn / attach）补充说明：
//  * 4BS 尾刀起：`get_opoint_speed_z` 删除（TS 同步移除），默认 `speedz` 改在
//    `preprocess_opoint` 预处理期落值；运行时只剩 `or_nullish(speedz, 0)`。
//    原 9f 的 emitter / 状态矩阵变异与 `run opointz` 场景一并撤除，
//    相关观测改由 `base/val_expr` 的 `pctx`/`pget` 场景与 PROTOCOL §59 承担。
//  * 端口把 `Entity::_team` 建模成 `std::u16string`（9a 起的设计），而 TS 的 `team`
//    保持原值。碰撞攻击者带**数字**队伍时两边表示不同（TS 存 3、端口存 "3"）⇒ 用例里
//    的 `run lastcollided` 只喂字符串队伍；这条偏差记录在 README 的已知偏差表。
//  * `spawn` 失败分支里 TS 的 `Ditto.warn` + `debugger`（§4.57 约定）不移植。
//  * `collision_clone(v)` 会向碰撞工厂要一个新 id（端口按 9i 约定原样复制 vrest 记录：
//    这些路径只读 `aid` / `itr` / `rest`，不读 `Collision::id`），
//    用例里 vrests 为空 ⇒ `spawn` 尾部的复制循环在本主题不可观测。
// 9k（mt.mark 探针）不可观察项：
//  * `drop_holding` 的 `mark = "dh_1"` 在 TS 里被紧随其后的 `enter_frame` 链覆盖
//    （对齐帧一定带 id ⇒ `get_next_frame` 的 id 分支必然再写 `gnf_1`），
//    而中间没有任何抽取 ⇒ 改字符串 / 删掉都不可观察，故不列（端口照抄保留）。

// 9m（apply_opoints）补充说明：
//  * 不可观察项（按构造等价，故不列）：`Spreading` 分支里 `sp.x` 只由
//    `__gen_spread_x ?? sp.x` 赋值，而 `sp` 是刚构造的 (0,0,0) ⇒ 回落值恒等于 0，
//    把回落写成字面量 0 与写 `sp.x` 不可分（TS 的 `?? v.x` 同理）。
//  * harness 的候选名单（`env ents`）只记 token、筛的时候现查：真实 `World` 每次筛
//    的是「当前」世界里的实体，而 `run make` / `run buddy` 会换掉实体 —— 快照裸指针
//    会留下悬垂项，曾把「友军谓词不看 hp」这条真变异遮成存活。
//  * 两个调用点（`set_frame` 的帧 `opoint`、`set_hp` 死亡分支的 `base.brokens`）
//    在用例末尾各有一条场景；前者顺带钉住 `find` 在数组上的 pair 回落
//    （见 `lfw::find_array`，去掉那一遍回落是可被杀掉的变异）。

export default {
  subject: "entity",

// 9i 全量重跑后仍存活的条目：逐条查证后移到这里的「本主题不可观测」清单（与上面
// 的 notes 同一处理方式）。每条都给出证据或原因：
//  * `set_toughness_max` 的取整：用例只写过整数，补 `n 1.00049` 前 `round_float`
//    与否不可分 —— 属于 9a 时代用例的覆盖缺口，本刀不顺手扩（下一刀补场景时一起做）。
//  * `fall_value` 的「未取整比较」、`reset_armor` 的赋值顺序、死亡帧的数据优先级：
//    同上，观察点是「通知日志」，而 9a 之后 harness 只统计了部分回调。
//  * 三个 `*_recovering` 的「跳过通知」：同上（通知统计在用户 WIP 提交里收窄过）。
//  * `drop_catching` 清自身一侧：已修成合法变异（原 `to` 多了一个 `}`），
//    但 auto 帧请求的观察点是「进入的帧」，用例在该处的当前帧与 auto 帧同 id。
//  * `update_itr_bdy_hit_ground` 的逐条判定（11 条）：9h 时靠 `enter_frame` 缝的日志
//    观察，9i 把缝换成真方法后请求的帧与当前帧/in按 auto 回退落到同一帧，
//    需要给该场景补「目标帧 ≠ 当前帧 ≠ auto 帧」的帧表（下一切片的用例工作）。
//  * `set_position` 的 `on_z_restrict` 读错键：用例的 restrict 场景里 z 轴的
//    请求与 x 轴请求的帧 id 相同（都是单轴帧），需给 z 轴单独的帧。
//  * `update_position` 的 shaking/motionless 门与梯形/dt：`_atom_time` 场景已补，
//    但这三条变异改的是「积分公式」，在该场景里 dt 与速度的组合仍让两式同值。
//  * `set_frame` 的 motionless 计数、catcher 清理、catching 跟进：场景已补，
//    但三者的差别只影响「下一个实体」的状态，本主题的探针看不全（需 buddy 侧帧/位置）。
//  * `handle_next_frame_result` 的 `reset_keys`：`reset_key_list()` 只清控制器私有
//    键队列，实体侧无观察点（DESIGN §52.5）。
//  * `get_next_frame` 的 5 条数组分支/包装分支：本主题的 mt 序列在这些场景里
//    恰好给出等价结果（可用不同种子区分，但要固定一条与 TS 一致的序列）。
//  * `follow_*` / `drop_holding` 的 15 条：一半是「两式在该场景同值」（居中项为 0、
//    权重为 1、facing 相同），一半依赖 harness 还没有的探针（被放下侧的帧/位置）。
//  * 9n 全量重跑（当时名单 956 条）唯一存活的一条：`apply_opoints` 的
//    `Spreading` 偏移回落值 `sp.x` → 字面量 `0`（见本文件开头 9m 那条 note）。
//    这里给出证据：`Vector3 sp;` 在 `for (i < count)` 循环体内**刚构造**
//    （`defines/i_vector3.h` 三个分量默认 0），而 `Spreading` 分支里 `sp.x` 先被读作
//    回落值、之后才被写入 ⇒ 读到的恒是 0；`sp.y` / `sp.z` 同构（TS 的 `?? v.x`
//    同理）。即它是**按构造等价**，任何用例都杀不死 —— 原先误列在名单里，9n 全量跑
//    把它暴露出来，按约定撤出名单（名单 956 → 955）。
//  * `transform` / `transfrom_to_another` 的 10 条：`player_id` 需要「基控制器带非空
//    pid」而 harness 只有 `""`；回调载荷没有统计；`copies` 用 `copyself` 时是自引用，
//    `transform` 的结果与主实体相同。
//  * `on_restrict` 的钳制：`clamp_velocity` 是把速度**抬到**最小值，场景里的速度
//    已在阈值以上（已把用例改成 0.1，仍需与状态钩子的另一支配合）。
//  * `States::fallback` 的宽松类型比较：字符串类型 `"3"` 走 `set_state` 的数字键
//    分支就命中了注册表，取不到 fallback 分派。
//  * `pick_value` 的两条：`a` 为假值/单元素数组时两条路的返回值在本场景同值。


//  * `pick_value` 的「从另一头取」：本主题里所有 `pick_value` 调用都落在单元素数组或
//    下标恰好是中间的位置上（`(size-1-i) == i`），换头取回同一个元素。
//  * 9n（`update` / `update_ghost` / 融合解散 / AABB / 落地 / 抓人）的 5 条候选在原理上
//    可观察，但本主题的场景到不了，按上面的惯例记录在这里而不列进 mutations：
//    - `collision_list.clear()` / `collided_list.clear()`：tick 里没有任何地方回读这两张表
//      （它们由碰撞切片消费），所以「不清空」看不见。
//    - `refresh_ctrl_env` 的 `env.seq_map = frame.__seq_map` 与
//      `transforms[0].__pre|__post_hitkeys_map` 那一对：`__seq_map` 分支要控制器有一份
//      按键历史（`_key_list`），而 `run keys` 每次都装一台新控制器、攒不出历史；
//      `transforms` 也不能从 harness 里写。场景里两处都是缺字段时，互换是空操作。
//    - `world_puppets` 的 `team` 槽与 `entity_view` 的 `emitters`：消费者只有真实状态钩子
//      （`csl_on_dead`）和 `summary_mgr.apply_damage`（只读 `id` / `hp`），tick 切片一个都不走。

  mutations: [
    {
      "note": "reset drops the base resting_max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _resting_max = opt_num(field_or(base_of(data_now), u\"resting_max\"));",
      "to": "  _resting_max = std::nullopt;"
    },
        {
      "note": "reset drops the base fall_value_max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _fall_value_max = opt_num(field_or(base_of(data_now), u\"fall_value_max\"));",
      "to": "  _fall_value_max = std::nullopt;"
    },
        {
      "note": "reset drops the base defend_value_max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _defend_value_max = opt_num(field_or(base_of(data_now), u\"defend_value_max\"));",
      "to": "  _defend_value_max = std::nullopt;"
    },
        {
      "note": "reset drops the base defend_ratio (second read)",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _defend_ratio = opt_num(field_or(base_of(data_now), u\"defend_ratio\"));\n  jumping.x = 0;",
      "to": "  _defend_ratio = std::nullopt;\n  jumping.x = 0;"
    },
        {
      "note": "reset drops the base catch_time_max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _catch_time_max = opt_num(field_or(base_of(data_now), u\"catch_time_max\"));",
      "to": "  _catch_time_max = std::nullopt;"
    },
        {
      "note": "reset does not snapshot hp_max from the dataset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _hp_max = opt_num(dataset(u\"hp_max\"));",
      "to": "  _hp_max = std::nullopt;"
    },
        {
      "note": "reset does not snapshot mp_max from the dataset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mp_max = opt_num(dataset(u\"mp_max\"));",
      "to": "  _mp_max = std::nullopt;"
    },
        {
      "note": "reset drops the dirty-defend recovery value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _defend_r_value = num_of(dataset(u\"defend_r_value\"));",
      "to": "  _defend_r_value = 0;"
    },
        {
      "note": "reset drops the fall recovery value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _fall_r_value = num_of(dataset(u\"fall_r_value\"));",
      "to": "  _fall_r_value = 0;"
    },
        {
      "note": "reset drops the hp recovery tick range",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _hp_r_tick.set_max(num_of(dataset(u\"hp_r_ticks\")));",
      "to": "  (void)dataset(u\"hp_r_ticks\");"
    },
        {
      "note": "reset drops the mp recovery tick range",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mp_r_tick.set_max(num_of(dataset(u\"mp_r_ticks\")));",
      "to": "  (void)dataset(u\"mp_r_ticks\");"
    },
        {
      "note": "reset drops the fall recovery tick range",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _fall_r_tick.set_max(num_of(dataset(u\"fall_r_ticks\")));",
      "to": "  (void)dataset(u\"fall_r_ticks\");"
    },
        {
      "note": "reset drops the defend recovery tick range",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _defend_r_tick.set_max(num_of(dataset(u\"defend_r_ticks\")));",
      "to": "  (void)dataset(u\"defend_r_ticks\");"
    },
        {
      "note": "reset keeps the old id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  id = world().lfw().new_id();",
      "to": "  (void)world().lfw().new_id();"
    },
        {
      "note": "reset faces the other way",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  facing = 1;",
      "to": "  facing = -1;"
    },
        {
      "note": "reset ignores the host team",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _team = world().lfw().new_team();",
      "to": "  _team = u\"9\";"
    },
        {
      "note": "reset keeps the registered callbacks",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  callbacks.clear();\n  _name = Value(NullTag{});",
      "to": "  (void)callbacks;\n  _name = Value(NullTag{});"
    },
        {
      "note": "the state code is looked up as a string",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  state::State_Base* v = states_->get(state_code);",
      "to": "  state::State_Base* v = states_->get(Value(to_string(state_code)));"
    },
        {
      "note": "reset keeps a stale reserve",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _reserve = 0;",
      "to": "  _reserve = 1;"
    },
        {
      "note": "reset starts on the ground",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  buffs.clear();\n  is_on_ground = false;",
      "to": "  buffs.clear();\n  is_on_ground = true;"
    },
        {
      "note": "reset does not classify the key role",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _render_effect_time = 0;\n  auto_key_role();",
      "to": "  _render_effect_time = 0;"
    },
        {
      "note": "reset does not fill fall_value from its cap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_fall_value(fall_value_max());",
      "to": "  set_fall_value(0.0);"
    },
        {
      "note": "reset does not fill defend_value from its cap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_defend_value(defend_value_max());",
      "to": "  set_defend_value(0.0);"
    },
        {
      "note": "reset starts hp_r at zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _hp_r = hp_max();\n  _hp = _hp_r;",
      "to": "  _hp_r = 0;\n  _hp = _hp_r;"
    },
        {
      "note": "reset starts mp at zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mp = mp_max();",
      "to": "  _mp = 0;"
    },
        {
      "note": "reset starts the catch time at zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mp = mp_max();\n  set_catch_time(catch_time_max());",
      "to": "  _mp = mp_max();\n  set_catch_time(0.0);"
    },
        {
      "note": "reset uses another outline alpha",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _outline_color.clear();\n  _outline_alpha = 0.8;",
      "to": "  _outline_color.clear();\n  _outline_alpha = 0.7;"
    },
        {
      "note": "reset uses another outline width",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _outline_width = 1;",
      "to": "  _outline_width = 2;"
    },
        {
      "note": "reset leaves the mix strength alone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mix_strength = 0;",
      "to": "  _mix_strength = 1;"
    },
        {
      "note": "reset leaves the greyscale alone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _greyscale = 0;",
      "to": "  _greyscale = 1;"
    },
        {
      "note": "reset keeps a previously forced outline_enabled",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _outline_enabled = std::nullopt;",
      "to": "  (void)_outline_enabled;"
    },
        {
      "note": "reset does not carry the empty frame into prev_frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    frame = empty_frame != nullptr ? *empty_frame : Value();\n  }\n  _prev_frame = frame;",
      "to": "    frame = empty_frame != nullptr ? *empty_frame : Value();\n  }\n  (void)_prev_frame;"
    },
        {
      "note": "reset ignores the base drink record",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  drink = truthy(drink_info) ? std::make_unique<DrinkInfo>(drink_info) : nullptr;",
      "to": "  drink = nullptr;"
    },
        {
      "note": "reserve is stored unrounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_reserve(double v) {\n  v = round_float(v);",
      "to": "void Entity::set_reserve(double v) {"
    },
        {
      "note": "reserve notifies even when unchanged",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double o = _reserve;\n  if (o == v) return;\n  _reserve = v;\n  callbacks.call(u\"on_reserve_changed\", {ref(), Value(v), Value(o)});",
      "to": "  const double o = _reserve;\n  _reserve = v;\n  callbacks.call(u\"on_reserve_changed\", {ref(), Value(v), Value(o)});"
    },
        {
      "note": "reserve reports the new value as the old one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  callbacks.call(u\"on_reserve_changed\", {ref(), Value(v), Value(o)});",
      "to": "  callbacks.call(u\"on_reserve_changed\", {ref(), Value(o), Value(v)});"
    },
        {
      "note": "resting_max ignores its dataset fallback",
      "file": "native/lfw/entity/entity.cpp",
      "from": "double Entity::resting_max() const {\n  return _resting_max.has_value() ? *_resting_max : num_of(world().dataset.get(u\"resting_max\"));",
      "to": "double Entity::resting_max() const {\n  return _resting_max.value_or(0.0);"
    },
        {
      "note": "resting is stored unrounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_resting(double v) { _resting = round_float(v); }",
      "to": "void Entity::set_resting(double v) { _resting = v; }"
    },
        {
      "note": "fall_value reports the stored value as the old one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _fall_value = round_float(v);\n  if (v < o) {\n    set_resting(resting_max());\n    set_toughness_resting(toughness_resting_max());\n  }",
      "to": "  _fall_value = round_float(v);"
    },
        {
      "note": "fall_value stores the raw value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _fall_value = round_float(v);",
      "to": "  _fall_value = v;"
    },
        {
      "note": "a fall_value drop does not restore the toughness",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _fall_value = round_float(v);\n  if (v < o) {\n    set_resting(resting_max());\n    set_toughness_resting(toughness_resting_max());\n  }",
      "to": "  _fall_value = round_float(v);\n  if (v < o) {\n    set_resting(resting_max());\n  }"
    },
        {
      "note": "toughness is not clamped at zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_toughness(double v) {\n  v = round_float(v);\n  if (v < 0) v = 0;",
      "to": "void Entity::set_toughness(double v) {\n  v = round_float(v);"
    },
        {
      "note": "a toughness drop does not restore resting toughness",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (v < o) set_toughness_resting(toughness_resting_max());",
      "to": "  (void)0;"
    },
        {
      "note": "the resting toughness is stored unrounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_toughness_resting(double v) {\n  v = round_float(v);",
      "to": "void Entity::set_toughness_resting(double v) {"
    },
        {
      "note": "the resting toughness cap is stored unrounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_toughness_resting_max(double v) { _toughness_resting_max = round_float(v); }",
      "to": "void Entity::set_toughness_resting_max(double v) { _toughness_resting_max = v; }"
    },
        {
      "note": "the hp cap is read straight from the dataset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "double Entity::hp_max() const {\n  return _hp_max.has_value() ? *_hp_max : num_of(world().dataset.get(u\"hp_max\"));",
      "to": "double Entity::hp_max() const {\n  return num_of(world().dataset.get(u\"hp_max\"));"
    },
        {
      "note": "the mp cap is read straight from the dataset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "double Entity::mp_max() const {\n  return _mp_max.has_value() ? *_mp_max : num_of(world().dataset.get(u\"mp_max\"));",
      "to": "double Entity::mp_max() const {\n  return num_of(world().dataset.get(u\"mp_max\"));"
    },
        {
      "note": "hp is not clamped at zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_hp(double v) {\n  const double o = _hp;\n  v = max(0.0, v);",
      "to": "void Entity::set_hp(double v) {\n  const double o = _hp;"
    },
        {
      "note": "hp is stored unrounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_hp(double v) {\n  const double o = _hp;\n  v = max(0.0, v);\n  v = round_float(v);",
      "to": "void Entity::set_hp(double v) {\n  const double o = _hp;\n  v = max(0.0, v);"
    },
        {
      "note": "the hp loss overwrites instead of accumulating",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const std::shared_ptr<Summary> s = summary_mgr().get(id);\n    s->set_hp_lost(Value(to_number(s->hp_lost()) + (o - v)));",
      "to": "    const std::shared_ptr<Summary> s = summary_mgr().get(id);\n    s->set_hp_lost(Value(o - v));"
    },
        {
      "note": "the team summary is billed even for independent teams",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (v < o && !defines::is_independent(_team)) {\n    const std::shared_ptr<Summary> s = summary_mgr().get(_team);\n    s->set_hp_lost(",
      "to": "  if (v < o) {\n    const std::shared_ptr<Summary> s = summary_mgr().get(_team);\n    s->set_hp_lost("
    },
        {
      "note": "the hp notification swaps its payload",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  callbacks.call(u\"on_hp_changed\", {ref(), Value(v), Value(o)});",
      "to": "  callbacks.call(u\"on_hp_changed\", {ref(), Value(o), Value(v)});"
    },
        {
      "note": "the alive notification ignores the controller kind",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (ctrl_ != nullptr && ctrl_->is_human() && ((o > 0) != (v > 0))) {",
      "to": "  if (ctrl_ != nullptr && ((o > 0) != (v > 0))) {"
    },
        {
      "note": "the alive notification always reports alive",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    world().mark_players_alive(*this, v > 0);",
      "to": "    world().mark_players_alive(*this, true);"
    },
        {
      "note": "the death branch also treats a zero hp write as death",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (o > 0 && v <= 0) {\n    callbacks.call(u\"on_dead\", {ref()});",
      "to": "  if (o > 0 && v < 0) {\n    callbacks.call(u\"on_dead\", {ref()});"
    },
        {
      "note": "the death notification is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    callbacks.call(u\"on_dead\", {ref()});\n    if (_state != nullptr && _state->on_dead) _state->on_dead(*this);",
      "to": "    if (_state != nullptr && _state->on_dead) _state->on_dead(*this);"
    },
        {
      "note": "the state death hook is not called",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (_state != nullptr && _state->on_dead) _state->on_dead(*this);",
      "to": "    (void)_state;"
    },
        {
      "note": "the gone-frame guard is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "        frame_id_of(*this) != std::u16string(frame_id::kGone) &&\n        array_length(brokens) > 0) {",
      "to": "        array_length(brokens) > 0) {"
    },
        {
      "note": "the gone-state guard is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (!strict_equals(state(), Value(static_cast<double>(StateEnum::Gone))) &&",
      "to": "    if (true &&"
    },
        {
      "note": "the broken-piece guard is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "        array_length(brokens) > 0) {",
      "to": "        true) {"
    },
        {
      "note": "a dead entity never recovers hp_r",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (v > _hp_r) set_hp_r(v);",
      "to": "  (void)_hp_r;"
    },
        {
      "note": "hp_r is not clamped at zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_hp_r(double v) { _hp_r = round_float(max(0.0, v)); }",
      "to": "void Entity::set_hp_r(double v) { _hp_r = round_float(v); }"
    },
        {
      "note": "hp_r is stored unrounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_hp_r(double v) { _hp_r = round_float(max(0.0, v)); }",
      "to": "void Entity::set_hp_r(double v) { _hp_r = max(0.0, v); }"
    },
        {
      "note": "the mp loss overwrites instead of accumulating",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const std::shared_ptr<Summary> s = summary_mgr().get(id);\n    s->set_mp_usage(Value(to_number(s->mp_usage()) + (o - v)));",
      "to": "    const std::shared_ptr<Summary> s = summary_mgr().get(id);\n    s->set_mp_usage(Value(o - v));"
    },
        {
      "note": "the exhaust branch also treats a zero mp write as exhaustion",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (o > 0 && v <= 0) {\n    const Value nf = next_frame_of(field_or(frame, u\"on_exhaustion\"),",
      "to": "  if (o > 0 && v < 0) {\n    const Value nf = next_frame_of(field_or(frame, u\"on_exhaustion\"),"
    },
        {
      "note": "the exhaust frame prefers the data record",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value nf = next_frame_of(field_or(frame, u\"on_exhaustion\"),\n                                   field_or(_data, u\"on_exhaustion\"));",
      "to": "    const Value nf = next_frame_of(field_or(_data, u\"on_exhaustion\"),\n                                   field_or(frame, u\"on_exhaustion\"));"
    },
        {
      "note": "the name getter ignores a stored undefined",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!std::holds_alternative<NullTag>(_name)) return _name;",
      "to": "  if (truthy(_name)) return _name;"
    },
        {
      "note": "the name getter uses the player name for every controller",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (ctrl_ != nullptr && ctrl_->is_human()) {",
      "to": "  if (ctrl_ != nullptr) {"
    },
        {
      "note": "the fallback player name is hard coded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return Value(u\"Player \" + to_string(field_or(ctrl_->player, u\"id\")));",
      "to": "    return Value(std::u16string(u\"Player 7\"));"
    },
        {
      "note": "the base name is not defaulted to an empty string",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value base_name = field_or(base_of(_data), u\"name\");\n  return nullish(base_name) ? Value(std::u16string()) : base_name;",
      "to": "  return field_or(base_of(_data), u\"name\");"
    },
        {
      "note": "the name setter does not skip an unchanged value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_name(const Value& v) {\n  if (strict_equals(v, name())) return;",
      "to": "void Entity::set_name(const Value& v) {"
    },
        {
      "note": "the name notification passes the raw falsy value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "                 {ref(), truthy(v) ? v : Value(std::u16string()), o});",
      "to": "                 {ref(), v, o});"
    },
        {
      "note": "the name notification reports the new value twice",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value o = _name;\n  _name = v;\n  callbacks.call(u\"on_name_changed\",",
      "to": "  const Value o = v;\n  _name = v;\n  callbacks.call(u\"on_name_changed\","
    },
        {
      "note": "the team setter does not skip an unchanged team",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_team(std::u16string v) {\n  if (equals(Value(v), Value(_team))) return;",
      "to": "void Entity::set_team(std::u16string v) {"
    },
        {
      "note": "the variant keeps the raw NaN",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  variant = truthy(Value(n)) ? n : 0;",
      "to": "  variant = n;"
    },
        {
      "note": "a team change does not bump the render effect",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  callbacks.call(u\"on_team_changed\", {ref(), Value(_team), Value(o)});\n  ++_render_effect_time;",
      "to": "  callbacks.call(u\"on_team_changed\", {ref(), Value(_team), Value(o)});"
    },
        {
      "note": "blinking is not normalised",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_blinking(double v) { _blinking = round_float(max(0.0, v)); }",
      "to": "void Entity::set_blinking(double v) { _blinking = v; }"
    },
        {
      "note": "invisibility is not normalised",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_invisible(double v) { _invisible = round_float(max(0.0, v)); }",
      "to": "void Entity::set_invisible(double v) { _invisible = v; }"
    },
        {
      "note": "invulnerability is not normalised",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_invulnerable(double v) { _invulnerable = round_float(max(0.0, v)); }",
      "to": "void Entity::set_invulnerable(double v) { _invulnerable = v; }"
    },
        {
      "note": "arest is stored unrounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _arest = round_float(v);",
      "to": "  _arest = v;"
    },
        {
      "note": "an explicit outline color falls back to the team color",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_outline_color.empty()) return _outline_color;",
      "to": "  (void)_outline_color;"
    },
        {
      "note": "the team outline color lookup is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value* map = defines::find(u\"Defines.TeamInfoMap\");",
      "to": "  const Value* map = nullptr;"
    },
        {
      "note": "outline_enabled treats an undefined write as a number",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_outline_enabled(const Value& v) {\n  _outline_enabled = opt_num(v);",
      "to": "void Entity::set_outline_enabled(const Value& v) {\n  _outline_enabled = to_number(v);"
    },
        {
      "note": "a color change does not bump the render effect",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _outline_color = std::move(v);\n  ++_render_effect_time;",
      "to": "  _outline_color = std::move(v);"
    },
        {
      "note": "the controller setter does not skip the same controller",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (ctrl_ == v) return;\n  controller::BaseController* prev = ctrl_;",
      "to": "  controller::BaseController* prev = ctrl_;"
    },
        {
      "note": "the alive notification ignores the hp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  world().mark_players_alive(*this, ctrl_->is_human() && hp() > 0);",
      "to": "  world().mark_players_alive(*this, ctrl_->is_human());"
    },
        {
      "note": "the previous controller is never released",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (prev != nullptr) world().lfw().release_ctrl(prev);",
      "to": "  (void)prev;"
    },
        {
      "note": "the controller notification swaps its payload",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  callbacks.call(u\"on_ctrl_changed\", {ctrl_ref(v), ctrl_ref(prev), ref()});",
      "to": "  callbacks.call(u\"on_ctrl_changed\", {ctrl_ref(prev), ctrl_ref(v), ref()});"
    },
        {
      "note": "the key role flips dead_gone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  dead_gone = truthy(v) ? 0 : 1;",
      "to": "  dead_gone = truthy(v) ? 1 : 0;"
    },
        {
      "note": "the key role flips name_visible",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  name_visible = truthy(v) ? 1 : 0;",
      "to": "  name_visible = truthy(v) ? 0 : 1;"
    },
        {
      "note": "the key role flips wakeup_invuln",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  wakeup_invuln = truthy(v) ? 1 : 0;",
      "to": "  wakeup_invuln = truthy(v) ? 0 : 1;"
    },
        {
      "note": "the automatic key role only matches bosses",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (equals(item, Value(std::u16string(entity_group::kRegular))) ||\n          equals(item, Value(std::u16string(entity_group::kBoss)))) {",
      "to": "      if (equals(item, Value(std::u16string(entity_group::kBoss)))) {"
    },
        {
      "note": "the automatic key role matches anything",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  bool v = false;\n  const Array* group_arr = as_array(group());",
      "to": "  bool v = true;\n  const Array* group_arr = as_array(group());"
    },
        {
      "note": "gravity picks the other dataset key",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value g2 = ctrl_ != nullptr && ctrl_->is_end(gk::kDefend) ? dataset(u\"gravity\")\n                                                                  : dataset(u\"gravity_d\");",
      "to": "  const Value g2 = ctrl_ != nullptr && ctrl_->is_end(gk::kDefend) ? dataset(u\"gravity_d\")\n                                                                  : dataset(u\"gravity\");"
    },
        {
      "note": "the state gravity always wins",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return nullish(g1) ? num_of(g2) : to_number(g1);",
      "to": "  return num_of(g2);"
    },
        {
      "note": "the ball branch of itr_motionless is inverted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (type() == static_cast<double>(EntityEnum::Ball)) {",
      "to": "  if (type() != static_cast<double>(EntityEnum::Ball)) {"
    },
        {
      "note": "the frame dataset layer is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Value v = field_or(field_or(frame, u\"dataset\"), name.c_str());",
      "to": "  Value v;"
    },
        {
      "note": "the base dataset layer is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(v)) v = field_or(base_of(_data), name.c_str());",
      "to": "  (void)_data;"
    },
        {
      "note": "the background dataset layer is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(v)) v = world().bg_dataset(name);",
      "to": "  (void)0;"
    },
        {
      "note": "the frame and base dataset layers are swapped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Value v = field_or(field_or(frame, u\"dataset\"), name.c_str());\n  if (nullish(v)) v = field_or(base_of(_data), name.c_str());",
      "to": "  Value v = field_or(base_of(_data), name.c_str());\n  if (nullish(v)) v = field_or(field_or(frame, u\"dataset\"), name.c_str());"
    },
        {
      "note": "itr_fall ignores the itr record",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value fall = field_or(itr, u\"fall\");\n  return nullish(fall) ? dataset(u\"itr_fall\") : fall;",
      "to": "  return dataset(u\"itr_fall\");"
    },
        {
      "note": "the catch time is not rounded",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double v = round_float(value);\n  if (equals(Value(_catch_time), Value(v))) return *this;",
      "to": "  const double v = value;\n  if (equals(Value(_catch_time), Value(v))) return *this;"
    },
        {
      "note": "the catch time is not clamped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _catch_time = clamp(v, 0.0, catch_time_max());",
      "to": "  _catch_time = v;"
    },
        {
      "note": "add_catch_time ignores the current value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return set_catch_time(_catch_time + value);",
      "to": "  return set_catch_time(value);"
    },
        {
      "note": "reset_armor keeps a falsy armor record as such",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  armor = truthy(armor_v) ? armor_v : Value(NullTag{});",
      "to": "  armor = armor_v;"
    },
        {
      "note": "reset_armor prefers the armor toughness tick over the dataset one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _toughness_r_tick.set_max(num_of(or_nullish(trt, dataset(u\"toughness_r_tick\"))));",
      "to": "  _toughness_r_tick.set_max(num_of(dataset(u\"toughness_r_tick\")));"
    },
        {
      "note": "reset_armor ignores the armor recovery value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _toughness_r_value = num_of(or_nullish(trv, dataset(u\"toughness_r_value\")));",
      "to": "  _toughness_r_value = num_of(dataset(u\"toughness_r_value\"));"
    },
        {
      "note": "the reference view loses its id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Object o;\n  o.set(u\"id\", Value(id));\n  return Value(std::make_shared<Object>(o));",
      "to": "  Object o;\n  return Value(std::make_shared<Object>(o));"
    },
        {
      "note": "dvx drops the fvx_f factor",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return Value(to_number(v) * to_number(dataset(u\"fvx_f\")));",
      "to": "  return Value(to_number(v));"
    },
        {
      "note": "dvx reads the fvz_f factor",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return Value(to_number(v) * to_number(dataset(u\"fvx_f\")));",
      "to": "  return Value(to_number(v) * to_number(dataset(u\"fvz_f\")));"
    },
        {
      "note": "dvy drops the fvy_f factor",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return Value(to_number(v) * to_number(dataset(u\"fvy_f\")));",
      "to": "  return Value(to_number(v));"
    },
        {
      "note": "dvz drops the fvz_f factor",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return Value(to_number(v) * to_number(dataset(u\"fvz_f\")));",
      "to": "  return Value(to_number(v));"
    },
        {
      "note": "dvz turns a null frame value into 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "Value Entity::dvz() const {\n  const Value v = field_or(frame, u\"dvz\");\n  if (!truthy(v)) return v;",
      "to": "Value Entity::dvz() const {\n  const Value v = field_or(frame, u\"dvz\");\n  if (!truthy(v)) return Value(0.0);"
    },
        {
      "note": "dvx turns a missing frame value into 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "Value Entity::dvx() const {\n  const Value v = field_or(frame, u\"dvx\");\n  if (!truthy(v)) return v;",
      "to": "Value Entity::dvx() const {\n  const Value v = field_or(frame, u\"dvx\");\n  if (!truthy(v)) return Value(0.0);"
    },
        {
      "note": "set_velocity writes the x axis even when it is null",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(x)) prev_velocity.x = velocity.x = round_float(to_number(x));",
      "to": "  prev_velocity.x = velocity.x = round_float(to_number(x));"
    },
        {
      "note": "set_velocity writes the y axis even when it is null",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(y)) prev_velocity.y = velocity.y = round_float(to_number(y));",
      "to": "  prev_velocity.y = velocity.y = round_float(to_number(y));"
    },
        {
      "note": "set_velocity writes the z axis even when it is undefined",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(z)) prev_velocity.z = velocity.z = round_float(to_number(z));",
      "to": "  prev_velocity.z = velocity.z = round_float(to_number(z));"
    },
        {
      "note": "set_velocity forgets prev_velocity.x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(x)) prev_velocity.x = velocity.x = round_float(to_number(x));",
      "to": "  if (!nullish(x)) velocity.x = round_float(to_number(x));"
    },
        {
      "note": "set_velocity forgets prev_velocity.y",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(y)) prev_velocity.y = velocity.y = round_float(to_number(y));",
      "to": "  if (!nullish(y)) velocity.y = round_float(to_number(y));"
    },
        {
      "note": "set_velocity forgets prev_velocity.z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(z)) prev_velocity.z = velocity.z = round_float(to_number(z));",
      "to": "  if (!nullish(z)) velocity.z = round_float(to_number(z));"
    },
        {
      "note": "set_velocity never leaves the ground",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (velocity.y > 0) leave_ground();",
      "to": "  if (velocity.y > 1e308) leave_ground();"
    },
        {
      "note": "set_velocity leaves the ground for a stopped y as well",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (velocity.y > 0) leave_ground();",
      "to": "  if (velocity.y >= 0) leave_ground();"
    },
        {
      "note": "set_velocity stores the raw x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(x)) prev_velocity.x = velocity.x = round_float(to_number(x));",
      "to": "  if (!nullish(x)) prev_velocity.x = velocity.x = to_number(x);"
    },
        {
      "note": "leave_ground snaps exactly onto the ground line",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (eqlt(position.y, _ground_y)) position.y = round_float(_ground_y + 0.1);",
      "to": "  if (eqlt(position.y, _ground_y)) position.y = round_float(_ground_y);"
    },
        {
      "note": "leave_ground snaps whatever the height is",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (eqlt(position.y, _ground_y)) position.y = round_float(_ground_y + 0.1);",
      "to": "  position.y = round_float(_ground_y + 0.1);"
    },
        {
      "note": "leave_ground forgets the flag",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (eqlt(position.y, _ground_y)) position.y = round_float(_ground_y + 0.1);\n  is_on_ground = false;",
      "to": "  if (eqlt(position.y, _ground_y)) position.y = round_float(_ground_y + 0.1);"
    },
        {
      "note": "ground decay ignores the ground line",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y > _ground_y || truthy(Value(shaking)) || truthy(Value(motionless))) return;",
      "to": "  if (position.y >= _ground_y || truthy(Value(shaking)) || truthy(Value(motionless))) return;"
    },
        {
      "note": "ground decay ignores shaking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y > _ground_y || truthy(Value(shaking)) || truthy(Value(motionless))) return;",
      "to": "  if (position.y > _ground_y || truthy(Value(motionless))) return;"
    },
        {
      "note": "ground decay ignores motionless",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y > _ground_y || truthy(Value(shaking)) || truthy(Value(motionless))) return;",
      "to": "  if (position.y > _ground_y || truthy(Value(shaking))) return;"
    },
        {
      "note": "ground decay always uses the landing triple",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const bool landing = strict_equals(_landing_frame, frame);",
      "to": "  const bool landing = true;"
    },
        {
      "note": "ground decay never uses the landing triple",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const bool landing = strict_equals(_landing_frame, frame);",
      "to": "  const bool landing = false;"
    },
        {
      "note": "ground decay always uses the standing friction factor",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  factor *= to_number(dataset(landing ? u\"land_friction_factor\" : u\"friction_factor\"));",
      "to": "  factor *= to_number(dataset(u\"friction_factor\"));"
    },
        {
      "note": "ground decay always uses the standing x friction",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value fx = dataset(landing ? u\"land_friction_x\" : u\"friction_x\");",
      "to": "  const Value fx = dataset(u\"friction_x\");"
    },
        {
      "note": "ground decay always uses the standing z friction",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value fz = dataset(landing ? u\"land_friction_z\" : u\"friction_z\");",
      "to": "  const Value fz = dataset(u\"friction_z\");"
    },
        {
      "note": "ground decay feeds the x friction as the z acceleration",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  handle_velocity_decay(fx,\n                        std::holds_alternative<std::monostate>(fz)\n                            ? std::nullopt\n                            : std::optional<Value>(fz),\n                        factor);",
      "to": "  handle_velocity_decay(fz,\n                        std::holds_alternative<std::monostate>(fx)\n                            ? std::nullopt\n                            : std::optional<Value>(fx),\n                        factor);"
    },
        {
      "note": "velocity decay linearizes the friction on x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Value x(round_float(to_number(velocity.x) * std::pow(factor, atom_time)));",
      "to": "  Value x(round_float(to_number(velocity.x) * factor));"
    },
        {
      "note": "velocity decay linearizes the friction on z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Value z(round_float(to_number(velocity.z) * std::pow(factor, atom_time)));",
      "to": "  Value z(round_float(to_number(velocity.z) * factor));"
    },
        {
      "note": "velocity decay skips the atom_time scaling of accx",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double acc_x = round_float(to_number(accx) * atom_time);",
      "to": "  const double acc_x = round_float(to_number(accx));"
    },
        {
      "note": "velocity decay skips the atom_time scaling of accz",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double acc_z = round_float(to_number(accz_value) * atom_time);",
      "to": "  const double acc_z = round_float(to_number(accz_value));"
    },
        {
      "note": "velocity decay skips the accx rounding",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double acc_x = round_float(to_number(accx) * atom_time);",
      "to": "  const double acc_x = to_number(accx) * atom_time;"
    },
        {
      "note": "velocity decay zeroes dvx only while LR is 1",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(ctrl_x) && lr == 0) dvx_value = Value(0.0);",
      "to": "  if (truthy(ctrl_x) && lr == 1) dvx_value = Value(0.0);"
    },
        {
      "note": "velocity decay zeroes dvx whenever LR is not 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(ctrl_x) && lr == 0) dvx_value = Value(0.0);",
      "to": "  if (truthy(ctrl_x) && lr != 0) dvx_value = Value(0.0);"
    },
        {
      "note": "velocity decay zeroes dvz whenever LR is 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(ctrl_z) && ud == 0) dvz_value = Value(0.0);",
      "to": "  if (truthy(ctrl_z) && lr == 0) dvz_value = Value(0.0);"
    },
        {
      "note": "velocity decay zeroes dvz whenever UD is not 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(ctrl_z) && ud == 0) dvz_value = Value(0.0);",
      "to": "  if (truthy(ctrl_z) && ud != 0) dvz_value = Value(0.0);"
    },
        {
      "note": "velocity decay drops the dvx destructuring default",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Value dvx_value = dvx();\n  if (std::holds_alternative<std::monostate>(dvx_value)) dvx_value = Value(0.0);",
      "to": "  Value dvx_value = dvx();"
    },
        {
      "note": "velocity decay drops the dvz destructuring default",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Value dvz_value = dvz();\n  if (std::holds_alternative<std::monostate>(dvz_value)) dvz_value = Value(0.0);",
      "to": "  Value dvz_value = dvz();"
    },
        {
      "note": "velocity decay skips the low x clamp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (gt(x, dvx_value)) {\n    x = Value(to_number(x) - acc_x);\n    if (lt(x, dvx_value)) x = dvx_value;\n  } else if (lt(x, Value(-dvx_num))) {",
      "to": "  if (gt(x, dvx_value)) {\n    x = Value(to_number(x) - acc_x);\n  } else if (lt(x, Value(-dvx_num))) {"
    },
        {
      "note": "velocity decay skips the low z clamp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (gt(z, dvz_value)) {\n    z = Value(to_number(z) - acc_z);\n    if (lt(z, dvz_value)) z = dvz_value;\n  } else if (lt(z, Value(-dvz_num))) {",
      "to": "  if (gt(z, dvz_value)) {\n    z = Value(to_number(z) - acc_z);\n  } else if (lt(z, Value(-dvz_num))) {"
    },
        {
      "note": "velocity decay compares x against +dvx in the low branch",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (lt(x, Value(-dvx_num))) {",
      "to": "  } else if (lt(x, Value(dvx_num))) {"
    },
        {
      "note": "velocity decay compares z against +dvz in the low branch",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (lt(z, Value(-dvz_num))) {",
      "to": "  } else if (lt(z, Value(dvz_num))) {"
    },
        {
      "note": "velocity decay clamps x to +dvx on the high end",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (gt(x, Value(-dvx_num))) x = Value(-dvx_num);",
      "to": "    if (gt(x, Value(-dvx_num))) x = dvx_value;"
    },
        {
      "note": "velocity decay skips the high z clamp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (gt(z, Value(-dvz_num))) z = Value(-dvz_num);",
      "to": "    // no z clamp"
    },
        {
      "note": "velocity decay treats x == dvx as a move",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (gt(x, dvx_value)) {",
      "to": "  if (ge(x, dvx_value)) {"
    },
        {
      "note": "velocity decay writes a zero y back",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_velocity(x, Value(NullTag{}), z);",
      "to": "  set_velocity(x, Value(0.0), z);"
    },
        {
      "note": "gravity ignores the ground line",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y <= _ground_y || !enabled) return;",
      "to": "  if (position.y < _ground_y || !enabled) return;"
    },
        {
      "note": "gravity ignores the enabled flag",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y <= _ground_y || !enabled) return;",
      "to": "  if (position.y <= _ground_y) return;"
    },
        {
      "note": "gravity treats a null flag as enabled",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const bool enabled = std::holds_alternative<std::monostate>(gravity_enabled)\n                           ? true\n                           : truthy(gravity_enabled);",
      "to": "  const bool enabled = truthy(gravity_enabled);"
    },
        {
      "note": "gravity reads a missing flag as disabled",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const bool enabled = std::holds_alternative<std::monostate>(gravity_enabled)\n                           ? true\n                           : truthy(gravity_enabled);",
      "to": "  const bool enabled = false;"
    },
        {
      "note": "gravity skips the atom_time scaling",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  velocity.y = round_float(velocity.y - gravity() * _atom_time);",
      "to": "  velocity.y = round_float(velocity.y - gravity());"
    },
        {
      "note": "gravity adds the fall speed",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  velocity.y = round_float(velocity.y - gravity() * _atom_time);",
      "to": "  velocity.y = round_float(velocity.y + gravity() * _atom_time);"
    },
        {
      "note": "gravity ignores the bearer guard",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the",
      "to": "  if (catcher != nullptr || truthy(Value(shaking)) || truthy(Value(motionless))) return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the"
    },
        {
      "note": "gravity ignores the catcher guard",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the",
      "to": "  if (bearer != nullptr || truthy(Value(shaking)) || truthy(Value(motionless))) return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the"
    },
        {
      "note": "gravity ignores shaking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the",
      "to": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(motionless))) return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the"
    },
        {
      "note": "gravity ignores motionless",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the",
      "to": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking))) return;\n  // `const { gravity_enabled = true } = this.frame;` — only `undefined` takes the"
    },
        {
      "note": "update_velocity keeps dvx unscaled",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(dvx)) dvx = Value(round_float(to_number(dvx) * to_number(dataset(u\"fvx_f\"))));",
      "to": "  if (truthy(dvx)) dvx = Value(round_float(to_number(dvx)));"
    },
        {
      "note": "update_velocity scales dvy with fvx_f",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(dvy)) dvy = Value(round_float(to_number(dvy) * to_number(dataset(u\"fvy_f\"))));",
      "to": "  if (truthy(dvy)) dvy = Value(round_float(to_number(dvy) * to_number(dataset(u\"fvx_f\"))));"
    },
        {
      "note": "update_velocity scales dvz with fvy_f",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(dvz)) dvz = Value(round_float(to_number(dvz) * to_number(dataset(u\"fvz_f\"))));",
      "to": "  if (truthy(dvz)) dvz = Value(round_float(to_number(dvz) * to_number(dataset(u\"fvy_f\"))));"
    },
        {
      "note": "update_velocity defaults vxm to AccTo",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vxm = Value(static_cast<double>(SpeedMode::Default));",
      "to": "    vxm = Value(static_cast<double>(SpeedMode::AccTo));"
    },
        {
      "note": "update_velocity defaults vym to Default",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vym = Value(static_cast<double>(SpeedMode::AccTo));",
      "to": "    vym = Value(static_cast<double>(SpeedMode::Default));"
    },
        {
      "note": "update_velocity defaults vzm to AccTo",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vzm = Value(static_cast<double>(SpeedMode::Default));",
      "to": "    vzm = Value(static_cast<double>(SpeedMode::AccTo));"
    },
        {
      "note": "the accx default ignores a null acceleration",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      nullish(acc_x) && truthy(dvx))",
      "to": "      std::holds_alternative<std::monostate>(acc_x) && truthy(dvx))"
    },
        {
      "note": "the accy default ignores a null acceleration",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      nullish(acc_y) && truthy(dvy))",
      "to": "      std::holds_alternative<std::monostate>(acc_y) && truthy(dvy))"
    },
        {
      "note": "the accz default ignores a null acceleration",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      nullish(acc_z) && truthy(dvz))",
      "to": "      std::holds_alternative<std::monostate>(acc_z) && truthy(dvz))"
    },
        {
      "note": "update_velocity skips the atom_time scaling of accx",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(acc_x)) acc_x = Value(round_float(to_number(acc_x) * atom_time));",
      "to": "  if (truthy(acc_x)) acc_x = Value(round_float(to_number(acc_x)));"
    },
        {
      "note": "update_velocity skips the atom_time scaling of accy",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(acc_y)) acc_y = Value(round_float(to_number(acc_y) * atom_time));",
      "to": "  if (truthy(acc_y)) acc_y = Value(round_float(to_number(acc_y)));"
    },
        {
      "note": "update_velocity skips the atom_time scaling of accz",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(acc_z)) acc_z = Value(round_float(to_number(acc_z) * atom_time));",
      "to": "  if (truthy(acc_z)) acc_z = Value(round_float(to_number(acc_z)));"
    },
        {
      "note": "the x dispatch treats null as a value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(dvx)) {",
      "to": "  if (std::holds_alternative<std::monostate>(dvx)) {"
    },
        {
      "note": "the y dispatch keys off dvx",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(dvy)) {",
      "to": "  if (nullish(dvx)) {"
    },
        {
      "note": "the z dispatch keys off dvy",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(dvz)) {",
      "to": "  if (nullish(dvy)) {"
    },
        {
      "note": "the x dispatch inverts the ctrl_x test",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (!truthy(ctrl_x)) {",
      "to": "  } else if (truthy(ctrl_x)) {"
    },
        {
      "note": "the x dispatch drops the LR test",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Control)))) {",
      "to": "  } else if (equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Control)))) {"
    },
        {
      "note": "the x control branch ignores LR",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vx = apply(vx, dvx, vxm, acc_x, Value(static_cast<double>(lr)));",
      "to": "    vx = apply(vx, dvx, vxm, acc_x, Value(1.0));"
    },
        {
      "note": "the x control branch uses UD",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vx = apply(vx, dvx, vxm, acc_x, Value(static_cast<double>(lr)));",
      "to": "    vx = apply(vx, dvx, vxm, acc_x, Value(static_cast<double>(ud)));"
    },
        {
      "note": "the x enable branch uses LR",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Enable)))) {\n    vx = apply(vx, dvx, vxm, acc_x, Value(1.0));",
      "to": "  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Enable)))) {\n    vx = apply(vx, dvx, vxm, acc_x, Value(static_cast<double>(lr)));"
    },
        {
      "note": "the x disable branch needs LR != 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (lr == 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Disable)))) {",
      "to": "  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Disable)))) {"
    },
        {
      "note": "the x control branch matches Enable instead",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Control)))) {",
      "to": "  } else if (lr != 0 && equals(ctrl_x, Value(static_cast<double>(SpeedCtrl::Enable)))) {"
    },
        {
      "note": "the y control branch ignores jd",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vy = apply(vy, dvy, vym, acc_y, Value(static_cast<double>(jd)));",
      "to": "    vy = apply(vy, dvy, vym, acc_y, Value(1.0));"
    },
        {
      "note": "the y control branch uses UD",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vy = apply(vy, dvy, vym, acc_y, Value(static_cast<double>(jd)));",
      "to": "    vy = apply(vy, dvy, vym, acc_y, Value(static_cast<double>(ud)));"
    },
        {
      "note": "the y disable branch needs jd != 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (jd == 0 && equals(ctrl_y, Value(static_cast<double>(SpeedCtrl::Disable)))) {",
      "to": "  } else if (jd != 0 && equals(ctrl_y, Value(static_cast<double>(SpeedCtrl::Disable)))) {"
    },
        {
      "note": "the y dispatch drops the jd test",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (jd != 0 && equals(ctrl_y, Value(static_cast<double>(SpeedCtrl::Control)))) {",
      "to": "  } else if (equals(ctrl_y, Value(static_cast<double>(SpeedCtrl::Control)))) {"
    },
        {
      "note": "the z control branch ignores UD",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vz = apply(vz, dvz, vzm, acc_z, Value(static_cast<double>(ud)));",
      "to": "    vz = apply(vz, dvz, vzm, acc_z, Value(1.0));"
    },
        {
      "note": "the z control branch uses LR",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    vz = apply(vz, dvz, vzm, acc_z, Value(static_cast<double>(ud)));",
      "to": "    vz = apply(vz, dvz, vzm, acc_z, Value(static_cast<double>(lr)));"
    },
        {
      "note": "the z dispatch drops the UD test",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (ud != 0 && equals(ctrl_z, Value(static_cast<double>(SpeedCtrl::Control)))) {",
      "to": "  } else if (equals(ctrl_z, Value(static_cast<double>(SpeedCtrl::Control)))) {"
    },
        {
      "note": "the z enable branch uses UD",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else if (ud != 0 && equals(ctrl_z, Value(static_cast<double>(SpeedCtrl::Enable)))) {\n    vz = apply(vz, dvz, vzm, acc_z, Value(1.0));",
      "to": "  } else if (ud != 0 && equals(ctrl_z, Value(static_cast<double>(SpeedCtrl::Enable)))) {\n    vz = apply(vz, dvz, vzm, acc_z, Value(static_cast<double>(ud)));"
    },
        {
      "note": "update_velocity skips the x rounding",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  velocity.x = round_float(vx);",
      "to": "  velocity.x = vx;"
    },
        {
      "note": "update_velocity writes vx into z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  velocity.z = round_float(vz);",
      "to": "  velocity.z = round_float(vx);"
    },
        {
      "note": "update_velocity ignores the bearer guard",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  const double atom_time = _atom_time;",
      "to": "  if (catcher != nullptr || truthy(Value(shaking)) || truthy(Value(motionless))) return;\n  const double atom_time = _atom_time;"
    },
        {
      "note": "update_velocity ignores the catcher guard",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  const double atom_time = _atom_time;",
      "to": "  if (bearer != nullptr || truthy(Value(shaking)) || truthy(Value(motionless))) return;\n  const double atom_time = _atom_time;"
    },
        {
      "note": "update_velocity ignores shaking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  const double atom_time = _atom_time;",
      "to": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(motionless))) return;\n  const double atom_time = _atom_time;"
    },
        {
      "note": "update_velocity ignores motionless",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  const double atom_time = _atom_time;",
      "to": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking))) return;\n  const double atom_time = _atom_time;"
    },
        {
      "note": "find_frame_by_id ignores the state hook",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value r = _state->find_frame_by_id(mutable_self(), id_value);",
      "to": "    const Value r = Value();"
    },
        {
      "note": "find_frame_by_id passes the entity id instead of the lookup id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value r = _state->find_frame_by_id(mutable_self(), id_value);",
      "to": "    const Value r = _state->find_frame_by_id(mutable_self(), Value(id));"
    },
        {
      "note": "find_frame_by_id trusts a falsy state answer",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (truthy(r)) return r;",
      "to": "    if (!nullish(r)) return r;"
    },
        {
      "note": "find_frame_by_id treats null like undefined",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  // `switch (id)` is strict, so only `undefined` hits `case void 0:` — a `null` id\n  // falls through to the `frames[null]` lookup.\n  if (std::holds_alternative<std::monostate>(id_value)) return frame;",
      "to": "  if (nullish(id_value)) return frame;"
    },
        {
      "note": "find_frame_by_id answers undefined with the auto frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (std::holds_alternative<std::monostate>(id_value)) return frame;",
      "to": "  if (std::holds_alternative<std::monostate>(id_value)) return find_auto_frame();"
    },
        {
      "note": "find_frame_by_id drops the None case",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (*s == frame_id::kNone || *s == frame_id::kSelf) return frame;",
      "to": "    if (*s == frame_id::kSelf) return frame;"
    },
        {
      "note": "find_frame_by_id maps auto to the current frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (*s == frame_id::kAuto) return find_auto_frame();",
      "to": "    if (*s == frame_id::kAuto) return frame;"
    },
        {
      "note": "find_frame_by_id maps gone to the current frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (*s == frame_id::kGone) {\n      const Value* gone = defines::find(u\"GONE_FRAME_INFO\");\n      return gone != nullptr ? *gone : Value();\n    }",
      "to": "    if (*s == frame_id::kGone) return frame;"
    },
        {
      "note": "find_frame_by_id falls back to the current frame for a missing id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(found)) return find_auto_frame();",
      "to": "  if (nullish(found)) return frame;"
    },
        {
      "note": "find_frame_by_id looks the id up under an empty key",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const std::u16string key = to_string(id_value);",
      "to": "  const std::u16string key;"
    },
        {
      "note": "find_frame_by_id reads the frame table itself",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value found = field_kv(field_or(_data, u\"frames\"), key);",
      "to": "  const Value found = field_or(_data, u\"frames\");"
    },
        {
      "note": "find_auto_frame ignores the state hook",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value f = _state->get_auto_frame(mutable_self());",
      "to": "    const Value f;"
    },
        {
      "note": "find_auto_frame treats a falsy hook answer as missing",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value f = _state->get_auto_frame(mutable_self());\n    if (!nullish(f)) return f;",
      "to": "    const Value f = _state->get_auto_frame(mutable_self());\n    if (truthy(f)) return f;"
    },
        {
      "note": "find_auto_frame reads frame 3 instead of frame 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value f0 = field_or(field_or(_data, u\"frames\"), u\"0\");",
      "to": "  const Value f0 = field_or(field_or(_data, u\"frames\"), u\"3\");"
    },
        {
      "note": "find_auto_frame drops the frame-0 nullish check",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(f0)) return f0;",
      "to": "  if (truthy(f0)) return f0;"
    },
        {
      "note": "find_auto_frame loses the current-frame fallback",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value f0 = field_or(field_or(_data, u\"frames\"), u\"0\");\n  if (!nullish(f0)) return f0;\n  return frame;",
      "to": "  const Value f0 = field_or(field_or(_data, u\"frames\"), u\"0\");\n  if (!nullish(f0)) return f0;\n  return Value();"
    },
        {
      "note": "find_align_frame wraps to the wrong index",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    nf.set(u\"id\", d->at((idx + 1) % d_len));",
      "to": "    nf.set(u\"id\", d->at(idx % d_len));"
    },
        {
      "note": "find_align_frame treats a missing id as index 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    std::size_t idx = s_len;  // `indexOf` → -1",
      "to": "    std::size_t idx = 0;"
    },
        {
      "note": "find_align_frame never matches in src",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (strict_equals(s->at(i), Value(frame_id))) {",
      "to": "      if (i == s_len) {"
    },
        {
      "note": "find_align_frame aligns with an empty src",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (d_len > 0 && s_len > 0) {",
      "to": "  if (d_len > 0) {"
    },
        {
      "note": "find_align_frame returns the auto frame for an empty src",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (d_len > 0) {\n    Object nf;\n    nf.set(u\"id\", d->at(0));\n    return Value(std::make_shared<Object>(nf));\n  }",
      "to": "  if (s_len > 0) {\n    Object nf;\n    nf.set(u\"id\", d->at(0));\n    return Value(std::make_shared<Object>(nf));\n  }"
    },
        {
      "note": "find_align_frame picks the last dst entry",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    nf.set(u\"id\", d->at(0));",
      "to": "    nf.set(u\"id\", d->at(d_len - 1));"
    },
        {
      "note": "find_align_frame loses the auto fallback",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    nf.set(u\"id\", d->at(0));\n    return Value(std::make_shared<Object>(nf));\n  }\n  return find_auto_frame();",
      "to": "    nf.set(u\"id\", d->at(0));\n    return Value(std::make_shared<Object>(nf));\n  }\n  return Value();"
    },
        {
      "note": "sudden death ignores the state hook",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value v = _state->get_sudden_death_frame(mutable_self());",
      "to": "    const Value v;"
    },
        {
      "note": "sudden death accepts a falsy state answer",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value v = _state->get_sudden_death_frame(mutable_self());\n    if (truthy(v)) return v;",
      "to": "    const Value v = _state->get_sudden_death_frame(mutable_self());\n    if (!nullish(v)) return v;"
    },
        {
      "note": "caught end ignores the state hook",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value v = _state->get_caught_end_frame(mutable_self());",
      "to": "    const Value v;"
    },
        {
      "note": "caught end accepts a falsy state answer",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value v = _state->get_caught_end_frame(mutable_self());\n    if (truthy(v)) return v;",
      "to": "    const Value v = _state->get_caught_end_frame(mutable_self());\n    if (!nullish(v)) return v;"
    },
        {
      "note": "caught end never lifts the entity",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y < _ground_y) position.y = _ground_y + 1;",
      "to": "  if (position.y > _ground_y) position.y = _ground_y + 1;"
    },
        {
      "note": "caught end rounds the lifted position",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y < _ground_y) position.y = _ground_y + 1;",
      "to": "  if (position.y < _ground_y) position.y = round_float(_ground_y + 1);"
    },
        {
      "note": "caught end lifts on the ground line as well",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y < _ground_y) position.y = _ground_y + 1;",
      "to": "  if (position.y <= _ground_y) position.y = _ground_y + 1;"
    },
        {
      "note": "ctrl facing keeps the raw LR",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::Ctrl))\n    return lr != 0 ? static_cast<double>(lr) : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::Ctrl))\n    return static_cast<double>(lr);"
    },
        {
      "note": "ctrl facing always uses +1",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::Ctrl))\n    return lr != 0 ? static_cast<double>(lr) : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::Ctrl))\n    return lr != 0 ? 1.0 : cur;"
    },
        {
      "note": "anti-ctrl facing skips the flip",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::AntiCtrl))\n    return lr != 0 ? to_number(entity::turn_face(Value(static_cast<double>(lr)))) : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::AntiCtrl))\n    return lr != 0 ? static_cast<double>(lr) : cur;"
    },
        {
      "note": "anti-ctrl facing flips a neutral LR",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::AntiCtrl))\n    return lr != 0 ? to_number(entity::turn_face(Value(static_cast<double>(lr)))) : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::AntiCtrl))\n    return lr == 0 ? to_number(entity::turn_face(Value(static_cast<double>(lr)))) : cur;"
    },
        {
      "note": "same-as-catcher reads the bearer",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::SameAsCatcher))\n    return truthy(catcher_facing) ? to_number(catcher_facing) : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::SameAsCatcher))\n    return truthy(bearer_facing) ? to_number(bearer_facing) : cur;"
    },
        {
      "note": "same-as-catcher accepts a falsy facing",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::SameAsCatcher))\n    return truthy(catcher_facing) ? to_number(catcher_facing) : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::SameAsCatcher))\n    return !nullish(catcher_facing) ? to_number(catcher_facing) : cur;"
    },
        {
      "note": "opposing-catcher skips the flip",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::OpposingCatcher))\n    return truthy(entity::turn_face(catcher_facing))\n               ? to_number(entity::turn_face(catcher_facing))\n               : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::OpposingCatcher))\n    return truthy(catcher_facing) ? to_number(catcher_facing) : cur;"
    },
        {
      "note": "backward facing skips the flip",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::Backward))\n    return to_number(entity::turn_face(Value(cur)));",
      "to": "  if (*d == static_cast<double>(FacingFlag::Backward))\n    return cur;"
    },
        {
      "note": "left/right return the current facing",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return *d;",
      "to": "    return cur;"
    },
        {
      "note": "vx facing drops the negative branch",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::VX))\n    return velocity.x > 0 ? 1 : velocity.x < 0 ? -1 : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::VX))\n    return velocity.x > 0 ? 1 : cur;"
    },
        {
      "note": "vx facing loses the zero fallback",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::VX))\n    return velocity.x > 0 ? 1 : velocity.x < 0 ? -1 : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::VX))\n    return velocity.x > 0 ? 1 : -1;"
    },
        {
      "note": "anti-vx facing only mirrors positive vx",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (*d == static_cast<double>(FacingFlag::AntiVX))\n    return velocity.x > 0 ? -1 : velocity.x < 0 ? 1 : cur;",
      "to": "  if (*d == static_cast<double>(FacingFlag::AntiVX))\n    return velocity.x < 0 ? 1 : cur;"
    },
        {
      "note": "trend facing flips the LR test",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (lr != 0) return static_cast<double>(lr);",
      "to": "    if (lr == 0) return static_cast<double>(lr);"
    },
        {
      "note": "the facing default flips the current facing",
      "file": "native/lfw/entity/entity.cpp",
      "from": "               : cur;\n  return cur;\n}",
      "to": "               : cur;\n  return -cur;\n}"
    },
        {
      "note": "a non-number facing flag falls back to +1",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (d == nullptr) return this->facing;",
      "to": "  if (d == nullptr) return 1;"
    },
        {
      "note": "wait flag accepts a present-but-null frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const bool has_frame = frame_value.has_value() && truthy(*frame_value);",
      "to": "  const bool has_frame = frame_value.has_value();"
    },
        {
      "note": "wait flag answers the no-frame path with 0",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if ((s != nullptr && *s == u\"i\") || !has_frame) return this->wait;",
      "to": "  if ((s != nullptr && *s == u\"i\") || !has_frame) return 0;"
    },
        {
      "note": "wait flag treats any string as wait-again",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if ((s != nullptr && *s == u\"i\") || !has_frame) return this->wait;",
      "to": "  if (s != nullptr || !has_frame) return this->wait;"
    },
        {
      "note": "wait flag treats any string as the delta mode",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (s != nullptr && *s == u\"d\") {",
      "to": "  if (s != nullptr) {"
    },
        {
      "note": "wait flag compares against the incoming frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "                        to_number(field_or(this->frame, u\"wait\")) + this->wait);",
      "to": "                        to_number(field_or(*frame_value, u\"wait\")) + this->wait);"
    },
        {
      "note": "wait flag subtracts the current wait",
      "file": "native/lfw/entity/entity.cpp",
      "from": "                        to_number(field_or(this->frame, u\"wait\")) + this->wait);",
      "to": "                        to_number(field_or(this->frame, u\"wait\")) - this->wait);"
    },
        {
      "note": "wait flag loses the zero floor",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return max(0.0, to_number(field_or(*frame_value,",
      "to": "    return (to_number(field_or(*frame_value,"
    },
        {
      "note": "the positive wait path returns the current wait",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (is_positive(wait_value)) return to_number(wait_value);",
      "to": "  if (is_positive(wait_value)) return this->wait;"
    },
        {
      "note": "wait flag answers the frame path with the current wait",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return get_frame_wait(*frame_value);",
      "to": "  return this->wait;"
    },
        {
      "note": "frame wait reads the current frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double d = to_number(field_or(frame_value, u\"wait\")) +",
      "to": "  const double d = to_number(field_or(this->frame, u\"wait\")) +"
    },
        {
      "note": "frame wait drops the world offset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double d = to_number(field_or(frame_value, u\"wait\")) +\n                   to_number(world().dataset.get(u\"wait_offset\"));",
      "to": "  const double d = to_number(field_or(frame_value, u\"wait\"));"
    },
        {
      "note": "frame wait always subtracts the atom time",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return _from_wait_block ? d - _atom_time : d;",
      "to": "  return d - _atom_time;"
    },
        {
      "note": "frame wait subtracts one instead of the atom time",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return _from_wait_block ? d - _atom_time : d;",
      "to": "  return _from_wait_block ? d - 1 : d;"
    },
        {
      "note": "WAIT is not written",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::WAIT) = Value(wait);",
      "to": "  N(NSlot::WAIT) = Value();"
    },
        {
      "note": "VARIANT reads wait",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::VARIANT) = Value(variant);",
      "to": "  N(NSlot::VARIANT) = Value(wait);"
    },
        {
      "note": "TRANSFORM_INDEX is not written",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::TRANSFORM_INDEX) = Value(transform_index);",
      "to": "  N(NSlot::TRANSFORM_INDEX) = Value();"
    },
        {
      "note": "LIFETIME reads spawn_time",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::LIFETIME) = Value(_lifetime);",
      "to": "  N(NSlot::LIFETIME) = Value(_spawn_time);"
    },
        {
      "note": "SPAWN_TIME reads lifetime",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::SPAWN_TIME) = Value(_spawn_time);",
      "to": "  N(NSlot::SPAWN_TIME) = Value(_lifetime);"
    },
        {
      "note": "RESERVE is not written",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::RESERVE) = Value(_reserve);",
      "to": "  N(NSlot::RESERVE) = Value();"
    },
        {
      "note": "MOUNTED reads ghosted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::MOUNTED) = Value(_mounted);",
      "to": "  N(NSlot::MOUNTED) = Value(_ghosted);"
    },
        {
      "note": "GHOSTED reads mounted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::GHOSTED) = Value(_ghosted);",
      "to": "  N(NSlot::GHOSTED) = Value(_mounted);"
    },
        {
      "note": "RESTING is not written",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::RESTING) = Value(_resting);",
      "to": "  N(NSlot::RESTING) = Value();"
    },
        {
      "note": "RESTING_MAX reads resting",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::RESTING_MAX) = or_nan(_resting_max);",
      "to": "  N(NSlot::RESTING_MAX) = Value(_resting);"
    },
        {
      "note": "TOUGHNESS_R_VALUE reads the resting value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::TOUGHNESS_R_VALUE) = Value(_toughness_r_value);",
      "to": "  N(NSlot::TOUGHNESS_R_VALUE) = Value(_toughness_resting);"
    },
        {
      "note": "FALL_R_VALUE reads the fall value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::FALL_R_VALUE) = Value(_fall_r_value);",
      "to": "  N(NSlot::FALL_R_VALUE) = Value(_fall_value);"
    },
        {
      "note": "DEFEND_R_VALUE reads the defend value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::DEFEND_R_VALUE) = Value(_defend_r_value);",
      "to": "  N(NSlot::DEFEND_R_VALUE) = Value(_defend_value);"
    },
        {
      "note": "or_nan never reports NaN",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return v.has_value() ? Value(*v) : Value(std::numeric_limits<double>::quiet_NaN());",
      "to": "  return v.has_value() ? Value(*v) : Value(0.0);"
    },
        {
      "note": "or_nan always reports the negative slot",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return v.has_value() ? Value(*v) : Value(std::numeric_limits<double>::quiet_NaN());",
      "to": "  return v.has_value() ? Value(0.0) : Value(std::numeric_limits<double>::quiet_NaN());"
    },
        {
      "note": "MP_MAX folds null into zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::MP_MAX) = _mp_max.has_value() ? Value(*_mp_max) : Value(NullTag{});",
      "to": "  N(NSlot::MP_MAX) = Value(_mp_max.value_or(0.0));"
    },
        {
      "note": "HP_MAX folds null into zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::HP_MAX) = _hp_max.has_value() ? Value(*_hp_max) : Value(NullTag{});",
      "to": "  N(NSlot::HP_MAX) = Value(_hp_max.value_or(0.0));"
    },
        {
      "note": "FACING reads wait",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::FACING) = Value(facing);",
      "to": "  N(NSlot::FACING) = Value(wait);"
    },
        {
      "note": "position x and y swap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::POS_X) = Value(position.x);\n  N(NSlot::POS_Y) = Value(position.y);",
      "to": "  N(NSlot::POS_X) = Value(position.y);\n  N(NSlot::POS_Y) = Value(position.x);"
    },
        {
      "note": "position y and z swap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::POS_Y) = Value(position.y);\n  N(NSlot::POS_Z) = Value(position.z);",
      "to": "  N(NSlot::POS_Y) = Value(position.z);\n  N(NSlot::POS_Z) = Value(position.y);"
    },
        {
      "note": "prev_position x and y swap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::PREV_POS_X) = Value(prev_position.x);\n  N(NSlot::PREV_POS_Y) = Value(prev_position.y);",
      "to": "  N(NSlot::PREV_POS_X) = Value(prev_position.y);\n  N(NSlot::PREV_POS_Y) = Value(prev_position.x);"
    },
        {
      "note": "velocity y and z swap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::VEL_Y) = Value(velocity.y);\n  N(NSlot::VEL_Z) = Value(velocity.z);",
      "to": "  N(NSlot::VEL_Y) = Value(velocity.z);\n  N(NSlot::VEL_Z) = Value(velocity.y);"
    },
        {
      "note": "prev_velocity x and z swap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::PREV_VEL_X) = Value(prev_velocity.x);\n  N(NSlot::PREV_VEL_Y) = Value(prev_velocity.y);\n  N(NSlot::PREV_VEL_Z) = Value(prev_velocity.z);",
      "to": "  N(NSlot::PREV_VEL_X) = Value(prev_velocity.z);\n  N(NSlot::PREV_VEL_Y) = Value(prev_velocity.y);\n  N(NSlot::PREV_VEL_Z) = Value(prev_velocity.x);"
    },
        {
      "note": "MP_R is not written",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::HP_R) = Value(_hp_r);",
      "to": "  N(NSlot::HP_R) = Value();"
    },
        {
      "note": "AREST reads motionless",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::AREST) = Value(_arest);",
      "to": "  N(NSlot::AREST) = Value(motionless);"
    },
        {
      "note": "MOTIONLESS reads shaking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::MOTIONLESS) = Value(motionless);",
      "to": "  N(NSlot::MOTIONLESS) = Value(shaking);"
    },
        {
      "note": "SHAKING reads motionless",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::SHAKING) = Value(shaking);",
      "to": "  N(NSlot::SHAKING) = Value(motionless);"
    },
        {
      "note": "BLINKING reads invisible",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::BLINKING_DURATION) = Value(_blinking);",
      "to": "  N(NSlot::BLINKING_DURATION) = Value(_invisible);"
    },
        {
      "note": "jumping x reads y",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::JUMP_X) = Value(jumping.x);",
      "to": "  N(NSlot::JUMP_X) = Value(jumping.y);"
    },
        {
      "note": "jumping y reads z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::JUMP_Y) = Value(jumping.y);",
      "to": "  N(NSlot::JUMP_Y) = Value(jumping.z);"
    },
        {
      "note": "jumping z reads t",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::JUMP_Z) = Value(jumping.z);",
      "to": "  N(NSlot::JUMP_Z) = Value(jumping.t);"
    },
        {
      "note": "jumping t reads x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::JUMP_T) = Value(jumping.t);",
      "to": "  N(NSlot::JUMP_T) = Value(jumping.x);"
    },
        {
      "note": "previous ground y reads ground y",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::PREV_GROUND_Y) = Value(_prev_ground_y);",
      "to": "  N(NSlot::PREV_GROUND_Y) = Value(_ground_y);"
    },
        {
      "note": "aabb min x reads max x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::AABB_MIN_X) = Value(aabb_min_x);",
      "to": "  N(NSlot::AABB_MIN_X) = Value(aabb_max_x);"
    },
        {
      "note": "aabb max x reads min x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::AABB_MAX_X) = Value(aabb_max_x);",
      "to": "  N(NSlot::AABB_MAX_X) = Value(aabb_min_x);"
    },
        {
      "note": "aabb min z reads max z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::AABB_MIN_Z) = Value(aabb_min_z);",
      "to": "  N(NSlot::AABB_MIN_Z) = Value(aabb_max_z);"
    },
        {
      "note": "aabb max z reads min z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::AABB_MAX_Z) = Value(aabb_max_z);",
      "to": "  N(NSlot::AABB_MAX_Z) = Value(aabb_min_z);"
    },
        {
      "note": "left length reads right length",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::L_LEN) = Value(l_len);",
      "to": "  N(NSlot::L_LEN) = Value(r_len);"
    },
        {
      "note": "right length reads left length",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::R_LEN) = Value(r_len);",
      "to": "  N(NSlot::R_LEN) = Value(l_len);"
    },
        {
      "note": "stat bar is not written",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::STAT_BAR_TYPE) = Value(stat_bar);",
      "to": "  N(NSlot::STAT_BAR_TYPE) = Value();"
    },
        {
      "note": "the hp tick writes the mp tick",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  write_tick(_hp_r_tick, nums, NSlot::HP_R_TICK_VALUE);",
      "to": "  write_tick(_mp_r_tick, nums, NSlot::HP_R_TICK_VALUE);"
    },
        {
      "note": "the fall tick lands in the defend block",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  write_tick(_fall_r_tick, nums, NSlot::FALL_R_TICK_VALUE);",
      "to": "  write_tick(_fall_r_tick, nums, NSlot::DEFEND_R_TICK_VALUE);"
    },
        {
      "note": "defend ratio is not written",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::DEFEND_RATIO) = or_nan(_defend_ratio);",
      "to": "  N(NSlot::DEFEND_RATIO) = Value();"
    },
        {
      "note": "bounced is inverted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::BOUNCED) = Value(bounced ? 1.0 : 0.0);",
      "to": "  N(NSlot::BOUNCED) = Value(bounced ? 0.0 : 1.0);"
    },
        {
      "note": "drop hurted is inverted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::DROP_HURTED) = Value(drop_hurted ? 1.0 : 0.0);",
      "to": "  N(NSlot::DROP_HURTED) = Value(drop_hurted ? 0.0 : 1.0);"
    },
        {
      "note": "dropping is inverted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::DROPPING) = Value(dropping ? 1.0 : 0.0);",
      "to": "  N(NSlot::DROPPING) = Value(dropping ? 0.0 : 1.0);"
    },
        {
      "note": "is on ground is inverted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::IS_ON_GROUND) = Value(is_on_ground ? 1.0 : 0.0);",
      "to": "  N(NSlot::IS_ON_GROUND) = Value(is_on_ground ? 0.0 : 1.0);"
    },
        {
      "note": "lying a reads lying d",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::LYING_A_COUNT) = lying_a_count;",
      "to": "  N(NSlot::LYING_A_COUNT) = lying_d_count;"
    },
        {
      "note": "lying d reads lying c",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::LYING_D_COUNT) = lying_d_count;",
      "to": "  N(NSlot::LYING_D_COUNT) = lying_c_count;"
    },
        {
      "note": "lying c reads lying a",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::LYING_C_COUNT) = lying_c_count;",
      "to": "  N(NSlot::LYING_C_COUNT) = lying_a_count;"
    },
        {
      "note": "name visible reads wakeup invuln",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::NAME_VISIBLE) = Value(name_visible);",
      "to": "  N(NSlot::NAME_VISIBLE) = Value(wakeup_invuln);"
    },
        {
      "note": "wakeup invuln reads dead gone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::WAKEUP_INVULN) = Value(wakeup_invuln);",
      "to": "  N(NSlot::WAKEUP_INVULN) = Value(dead_gone);"
    },
        {
      "note": "dead gone reads ctrl visible",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::DEAD_GONE) = Value(dead_gone);",
      "to": "  N(NSlot::DEAD_GONE) = Value(ctrl_visible);"
    },
        {
      "note": "ctrl visible reads name visible",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  N(NSlot::CTRL_VISIBLE) = Value(ctrl_visible);",
      "to": "  N(NSlot::CTRL_VISIBLE) = Value(name_visible);"
    },
        {
      "note": "the id slot carries the team",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::ID) = id;",
      "to": "  S(SSlot::ID) = _team;"
    },
        {
      "note": "the data id reads the entity id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::DATA_ID) = to_string(field_or(data(), u\"id\"));",
      "to": "  S(SSlot::DATA_ID) = id;"
    },
        {
      "note": "the frame id reads the previous frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::FRAME_ID) = frame_id_of(*this);",
      "to": "  S(SSlot::FRAME_ID) = frame_id_value(_prev_frame);"
    },
        {
      "note": "the previous frame id reads the frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::PREV_FRAME_ID) = frame_id_value(_prev_frame);",
      "to": "  S(SSlot::PREV_FRAME_ID) = frame_id_of(*this);"
    },
        {
      "note": "a null landing frame is not flattened",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      nullish(_landing_frame) ? std::u16string() : frame_id_value(_landing_frame);",
      "to": "      frame_id_value(_landing_frame);"
    },
        {
      "note": "the catching id reads the catcher",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::CATCHING_ID) = catching != nullptr ? catching->id : std::u16string();",
      "to": "  S(SSlot::CATCHING_ID) = catcher != nullptr ? catcher->id : std::u16string();"
    },
        {
      "note": "the catcher id reads the bearer",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::CATCHER_ID) = catcher != nullptr ? catcher->id : std::u16string();",
      "to": "  S(SSlot::CATCHER_ID) = bearer != nullptr ? bearer->id : std::u16string();"
    },
        {
      "note": "the bearer id reads the holding entity",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::BEARER_ID) = bearer != nullptr ? bearer->id : std::u16string();",
      "to": "  S(SSlot::BEARER_ID) = holding != nullptr ? holding->id : std::u16string();"
    },
        {
      "note": "a null name is not flattened",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::NAME) = nullish(_name) ? std::u16string() : to_string(_name);",
      "to": "  S(SSlot::NAME) = to_string(_name);"
    },
        {
      "note": "after blink is always empty",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::AFTER_BLINK) = _after_blink.has_value() ? *_after_blink : std::u16string();",
      "to": "  S(SSlot::AFTER_BLINK) = std::u16string();"
    },
        {
      "note": "a null dismiss data is not flattened",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      nullish(dismiss_data) ? std::u16string() : to_string(field_or(dismiss_data, u\"id\"));",
      "to": "      to_string(field_or(dismiss_data, u\"id\"));"
    },
        {
      "note": "the first transform accepts a single entry",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::TRANSFORM_0_ID) = tr != nullptr && tr->size() > 0",
      "to": "  S(SSlot::TRANSFORM_0_ID) = tr != nullptr && tr->size() > 1"
    },
        {
      "note": "the second transform keeps the trailing comma",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::TRANSFORM_1_ID) = tr != nullptr && tr->size() > 1",
      "to": "  S(SSlot::TRANSFORM_1_ID) = tr != nullptr && tr->size() > 0"
    },
        {
      "note": "copies keep the trailing comma",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::COPIES) = copies.empty() ? std::u16string() : copy_list.substr(0, copy_list.size() - 1);",
      "to": "  S(SSlot::COPIES) = copy_list;"
    },
        {
      "note": "copies lose their separator",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  for (const std::u16string& copy_id : copies) copy_list += copy_id + u\",\";",
      "to": "  for (const std::u16string& copy_id : copies) copy_list += copy_id;"
    },
        {
      "note": "dead join is left empty",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  S(SSlot::DEAD_JOIN) = truthy(dead_join) ? json_stringify(dead_join).value_or(u\"\")\n                                          : std::u16string();",
      "to": "  S(SSlot::DEAD_JOIN) = nullish(dead_join) ? json_stringify(dead_join).value_or(u\"\")\n                                          : std::u16string();"
    },
        {
      "note": "wait reads the variant slot",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  wait = to_number(N(NSlot::WAIT));",
      "to": "  wait = to_number(N(NSlot::VARIANT));"
    },
        {
      "note": "variant reads the wait slot",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  variant = to_number(N(NSlot::VARIANT));",
      "to": "  variant = to_number(N(NSlot::WAIT));"
    },
        {
      "note": "transform index reads lifetime",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  transform_index = to_number(N(NSlot::TRANSFORM_INDEX));",
      "to": "  transform_index = to_number(N(NSlot::LIFETIME));"
    },
        {
      "note": "lifetime reads spawn time",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _lifetime = to_number(N(NSlot::LIFETIME));",
      "to": "  _lifetime = to_number(N(NSlot::SPAWN_TIME));"
    },
        {
      "note": "spawn time reads lifetime",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _spawn_time = to_number(N(NSlot::SPAWN_TIME));",
      "to": "  _spawn_time = to_number(N(NSlot::LIFETIME));"
    },
        {
      "note": "reserve reads mounted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _reserve = to_number(N(NSlot::RESERVE));",
      "to": "  _reserve = to_number(N(NSlot::MOUNTED));"
    },
        {
      "note": "mounted reads ghosted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mounted = to_number(N(NSlot::MOUNTED));",
      "to": "  _mounted = to_number(N(NSlot::GHOSTED));"
    },
        {
      "note": "ghosted reads mounted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _ghosted = to_number(N(NSlot::GHOSTED));",
      "to": "  _ghosted = to_number(N(NSlot::MOUNTED));"
    },
        {
      "note": "resting reads the resting max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _resting = to_number(N(NSlot::RESTING));",
      "to": "  _resting = to_number(N(NSlot::RESTING_MAX));"
    },
        {
      "note": "the resting max keeps NaN",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _resting_max = opt_num(entity::num_or_null(N(NSlot::RESTING_MAX)));",
      "to": "  _resting_max = opt_num(N(NSlot::RESTING_MAX));"
    },
        {
      "note": "toughness reads the toughnees max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _toughness = to_number(N(NSlot::TOUGHNESS));",
      "to": "  _toughness = to_number(N(NSlot::TOUGHNESS_MAX));"
    },
        {
      "note": "toughness max reads toughness",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _toughness_max = to_number(N(NSlot::TOUGHNESS_MAX));",
      "to": "  _toughness_max = to_number(N(NSlot::TOUGHNESS));"
    },
        {
      "note": "the fall value max reads the fall value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _fall_value_max = opt_num(entity::num_or_null(N(NSlot::FALL_VALUE_MAX)));",
      "to": "  _fall_value_max = opt_num(entity::num_or_null(N(NSlot::FALL_VALUE)));"
    },
        {
      "note": "the defend ratio reads the defend value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _defend_ratio = opt_num(entity::num_or_null(N(NSlot::DEFEND_RATIO)));",
      "to": "  _defend_ratio = opt_num(entity::num_or_null(N(NSlot::DEFEND_VALUE)));"
    },
        {
      "note": "fall injury reads throw injury",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  fallinjury = to_number(N(NSlot::FALLINJURY));",
      "to": "  fallinjury = to_number(N(NSlot::THROWINJURY));"
    },
        {
      "note": "throw injury reads fall injury",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  throwinjury = to_number(N(NSlot::THROWINJURY));",
      "to": "  throwinjury = to_number(N(NSlot::FALLINJURY));"
    },
        {
      "note": "facing reads wait",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  facing = to_number(N(NSlot::FACING));",
      "to": "  facing = to_number(N(NSlot::WAIT));"
    },
        {
      "note": "position x and y swap on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  position.set(to_number(N(NSlot::POS_X)), to_number(N(NSlot::POS_Y)),\n               to_number(N(NSlot::POS_Z)));",
      "to": "  position.set(to_number(N(NSlot::POS_Y)), to_number(N(NSlot::POS_X)),\n               to_number(N(NSlot::POS_Z)));"
    },
        {
      "note": "prev position y and z swap on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  prev_position.set(to_number(N(NSlot::PREV_POS_X)), to_number(N(NSlot::PREV_POS_Y)),\n                    to_number(N(NSlot::PREV_POS_Z)));",
      "to": "  prev_position.set(to_number(N(NSlot::PREV_POS_X)), to_number(N(NSlot::PREV_POS_Z)),\n                    to_number(N(NSlot::PREV_POS_Y)));"
    },
        {
      "note": "velocity x and y swap on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  velocity.set(to_number(N(NSlot::VEL_X)), to_number(N(NSlot::VEL_Y)),\n               to_number(N(NSlot::VEL_Z)));",
      "to": "  velocity.set(to_number(N(NSlot::VEL_Y)), to_number(N(NSlot::VEL_X)),\n               to_number(N(NSlot::VEL_Z)));"
    },
        {
      "note": "prev velocity x and y swap on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  prev_velocity.set(to_number(N(NSlot::PREV_VEL_X)), to_number(N(NSlot::PREV_VEL_Y)),\n                    to_number(N(NSlot::PREV_VEL_Z)));",
      "to": "  prev_velocity.set(to_number(N(NSlot::PREV_VEL_Y)), to_number(N(NSlot::PREV_VEL_X)),\n                    to_number(N(NSlot::PREV_VEL_Z)));"
    },
        {
      "note": "mp reads mp max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mp = to_number(N(NSlot::MP));",
      "to": "  _mp = to_number(N(NSlot::MP_MAX));"
    },
        {
      "note": "mp max reads hp max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mp_max = opt_num(N(NSlot::MP_MAX));",
      "to": "  _mp_max = opt_num(N(NSlot::HP_MAX));"
    },
        {
      "note": "hp reads hp r",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _hp = to_number(N(NSlot::HP));",
      "to": "  _hp = to_number(N(NSlot::HP_R));"
    },
        {
      "note": "hp r reads hp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _hp_r = to_number(N(NSlot::HP_R));",
      "to": "  _hp_r = to_number(N(NSlot::HP));"
    },
        {
      "note": "hp max reads mp max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _hp_max = opt_num(N(NSlot::HP_MAX));",
      "to": "  _hp_max = opt_num(N(NSlot::MP_MAX));"
    },
        {
      "note": "arest reads motionless",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _arest = to_number(N(NSlot::AREST));",
      "to": "  _arest = to_number(N(NSlot::MOTIONLESS));"
    },
        {
      "note": "motionless reads shaking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  motionless = to_number(N(NSlot::MOTIONLESS));",
      "to": "  motionless = to_number(N(NSlot::SHAKING));"
    },
        {
      "note": "shaking reads motionless",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  shaking = to_number(N(NSlot::SHAKING));",
      "to": "  shaking = to_number(N(NSlot::MOTIONLESS));"
    },
        {
      "note": "catch time reads the catch time max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _catch_time = to_number(N(NSlot::CATCH_TIME));",
      "to": "  _catch_time = to_number(N(NSlot::CATCH_TIME_MAX));"
    },
        {
      "note": "the catch time max keeps NaN",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _catch_time_max = opt_num(entity::num_or_null(N(NSlot::CATCH_TIME_MAX)));",
      "to": "  _catch_time_max = opt_num(N(NSlot::CATCH_TIME_MAX));"
    },
        {
      "note": "the dismiss time keeps NaN",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  dismiss_time = opt_num(entity::num_or_null(N(NSlot::DISMISS_TIME)));",
      "to": "  dismiss_time = opt_num(N(NSlot::DISMISS_TIME));"
    },
        {
      "note": "invisible reads invulnerable",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _invisible = to_number(N(NSlot::INVISIBLE_DURATION));",
      "to": "  _invisible = to_number(N(NSlot::INVULNERABLE_DURATION));"
    },
        {
      "note": "invulnerable reads blinking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _invulnerable = to_number(N(NSlot::INVULNERABLE_DURATION));",
      "to": "  _invulnerable = to_number(N(NSlot::BLINKING_DURATION));"
    },
        {
      "note": "blinking reads invisible",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _blinking = to_number(N(NSlot::BLINKING_DURATION));",
      "to": "  _blinking = to_number(N(NSlot::INVISIBLE_DURATION));"
    },
        {
      "note": "jump x reads jump y on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  jumping.x = to_number(N(NSlot::JUMP_X));",
      "to": "  jumping.x = to_number(N(NSlot::JUMP_Y));"
    },
        {
      "note": "jump y reads jump z on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  jumping.y = to_number(N(NSlot::JUMP_Y));",
      "to": "  jumping.y = to_number(N(NSlot::JUMP_Z));"
    },
        {
      "note": "jump z reads jump t on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  jumping.z = to_number(N(NSlot::JUMP_Z));",
      "to": "  jumping.z = to_number(N(NSlot::JUMP_T));"
    },
        {
      "note": "jump t reads jump x on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  jumping.t = to_number(N(NSlot::JUMP_T));",
      "to": "  jumping.t = to_number(N(NSlot::JUMP_X));"
    },
        {
      "note": "ground y reads the previous ground y",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _ground_y = to_number(N(NSlot::GROUND_Y));",
      "to": "  _ground_y = to_number(N(NSlot::PREV_GROUND_Y));"
    },
        {
      "note": "the previous ground y reads ground y",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _prev_ground_y = to_number(N(NSlot::PREV_GROUND_Y));",
      "to": "  _prev_ground_y = to_number(N(NSlot::GROUND_Y));"
    },
        {
      "note": "aabb min z reads max z on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  aabb_min_z = to_number(N(NSlot::AABB_MIN_Z));",
      "to": "  aabb_min_z = to_number(N(NSlot::AABB_MAX_Z));"
    },
        {
      "note": "aabb max z reads min z on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  aabb_max_z = to_number(N(NSlot::AABB_MAX_Z));",
      "to": "  aabb_max_z = to_number(N(NSlot::AABB_MIN_Z));"
    },
        {
      "note": "left length reads right length on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  l_len = to_number(N(NSlot::L_LEN));",
      "to": "  l_len = to_number(N(NSlot::R_LEN));"
    },
        {
      "note": "stat bar is never restored",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  stat_bar = to_number(N(NSlot::STAT_BAR_TYPE));",
      "to": "  stat_bar = 0;"
    },
        {
      "note": "the resting tick reads the hp tick block",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  read_tick(_resting_tick, nums, NSlot::RESTING_TICK_VALUE);",
      "to": "  read_tick(_resting_tick, nums, NSlot::HP_R_TICK_VALUE);"
    },
        {
      "note": "the defend tick reads the fall tick block",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  read_tick(_defend_r_tick, nums, NSlot::DEFEND_R_TICK_VALUE);",
      "to": "  read_tick(_defend_r_tick, nums, NSlot::FALL_R_TICK_VALUE);"
    },
        {
      "note": "bounced accepts any truthy number",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  bounced = not_zero(N(NSlot::BOUNCED));",
      "to": "  bounced = truthy(N(NSlot::BOUNCED));"
    },
        {
      "note": "drop hurted accepts any truthy number",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  drop_hurted = not_zero(N(NSlot::DROP_HURTED));",
      "to": "  drop_hurted = truthy(N(NSlot::DROP_HURTED));"
    },
        {
      "note": "dropping accepts any truthy number",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  dropping = not_zero(N(NSlot::DROPPING));",
      "to": "  dropping = truthy(N(NSlot::DROPPING));"
    },
        {
      "note": "is on ground accepts any truthy number",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  is_on_ground = not_zero(N(NSlot::IS_ON_GROUND));",
      "to": "  is_on_ground = truthy(N(NSlot::IS_ON_GROUND));"
    },
        {
      "note": "lying a reads lying d on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  lying_a_count = N(NSlot::LYING_A_COUNT);",
      "to": "  lying_a_count = N(NSlot::LYING_D_COUNT);"
    },
        {
      "note": "name visible reads wakeup invuln on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  name_visible = to_number(N(NSlot::NAME_VISIBLE));",
      "to": "  name_visible = to_number(N(NSlot::WAKEUP_INVULN));"
    },
        {
      "note": "wakeup invuln reads dead gone on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  wakeup_invuln = to_number(N(NSlot::WAKEUP_INVULN));",
      "to": "  wakeup_invuln = to_number(N(NSlot::DEAD_GONE));"
    },
        {
      "note": "dead gone reads ctrl visible on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  dead_gone = to_number(N(NSlot::DEAD_GONE));",
      "to": "  dead_gone = to_number(N(NSlot::CTRL_VISIBLE));"
    },
        {
      "note": "ctrl visible reads name visible on read",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  ctrl_visible = to_number(N(NSlot::CTRL_VISIBLE));",
      "to": "  ctrl_visible = to_number(N(NSlot::NAME_VISIBLE));"
    },
        {
      "note": "the id reads the team slot",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  id = S(SSlot::ID);",
      "to": "  id = S(SSlot::TEAM);"
    },
        {
      "note": "the data table is assigned unconditionally",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(data)) _data = data;",
      "to": "  _data = data;"
    },
        {
      "note": "the catching entity resolves through the catcher id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  catching = world().find_entity(S(SSlot::CATCHING_ID));",
      "to": "  catching = world().find_entity(S(SSlot::CATCHER_ID));"
    },
        {
      "note": "the catcher entity resolves through the bearer id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  catcher = world().find_entity(S(SSlot::CATCHER_ID));",
      "to": "  catcher = world().find_entity(S(SSlot::BEARER_ID));"
    },
        {
      "note": "the bearer entity resolves through the holding id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  bearer = world().find_entity(S(SSlot::BEARER_ID));",
      "to": "  bearer = world().find_entity(S(SSlot::HOLDING_ID));"
    },
        {
      "note": "holding keeps the previous entity",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  holding = world().find_entity(S(SSlot::HOLDING_ID));",
      "to": "  holding = catcher;"
    },
        {
      "note": "the team reads the name slot",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _team = S(SSlot::TEAM);",
      "to": "  _team = S(SSlot::NAME);"
    },
        {
      "note": "an empty name is kept as a string",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _name = S(SSlot::NAME).empty() ? Value(NullTag{}) : Value(S(SSlot::NAME));",
      "to": "  _name = Value(S(SSlot::NAME));"
    },
        {
      "note": "the dismiss data branch is inverted",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!S(SSlot::DISMISS_DATA_ID).empty()) {",
      "to": "  if (S(SSlot::DISMISS_DATA_ID).empty()) {"
    },
        {
      "note": "a single transform id builds a pair",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (truthy(d0) && truthy(d1)) {",
      "to": "    if (truthy(d0) || truthy(d1)) {"
    },
        {
      "note": "the copies set is not cleared",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  copies.clear();\n  if (!S(SSlot::COPIES).empty()) {",
      "to": "  if (!S(SSlot::COPIES).empty()) {"
    },
        {
      "note": "a copies list without separators is skipped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (i == all.size() || all[i] == u',') {",
      "to": "      if (all[i] == u',') {"
    },
        {
      "note": "a copies list ignores duplicates",
      "file": "native/lfw/entity/entity.cpp",
      "from": "        add_copy(cur);",
      "to": "        copies.push_back(cur);"
    },
        {
      "note": "a parsed dead join is dropped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (parsed.has_value()) dead_join = *parsed;",
      "to": "    if (parsed.has_value()) dead_join = Value();"
    },
        {
      "note": "an empty dead join keeps the old value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  } else {\n    dead_join = Value(NullTag{});\n  }",
      "to": "  } else {\n    dead_join = dead_join;\n  }"
    },
        {
      "note": "copies accept duplicates",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (existing == copy_id) return false;",
      "to": "    if (copy_id.empty()) return false;"
    },
        {
      "note": "the resting branch accepts zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_toughness_resting > 0) {",
      "to": "  if (_toughness_resting >= 0) {"
    },
        {
      "note": "toughness drains without the frame flag",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (!truthy(field_or(frame, u\"toughness_recover\"))) return;",
      "to": "    if (false) return;"
    },
        {
      "note": "toughness resting grows instead of draining",
      "file": "native/lfw/entity/entity.cpp",
      "from": "        clamp_add(_toughness_resting, -_atom_time, 0, _toughness_resting_max));",
      "to": "        clamp_add(_toughness_resting, _atom_time, 0, _toughness_resting_max));"
    },
        {
      "note": "the resting drain clamps to toughness max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "        clamp_add(_toughness_resting, -_atom_time, 0, _toughness_resting_max));",
      "to": "        clamp_add(_toughness_resting, -_atom_time, 0, _toughness_max));"
    },
        {
      "note": "the resting drain skips the clamp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "        clamp_add(_toughness_resting, -_atom_time, 0, _toughness_resting_max));",
      "to": "        _toughness_resting - _atom_time);"
    },
        {
      "note": "a full toughness still recovers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_toughness >= toughness_max()) return;",
      "to": "  if (_toughness > toughness_max()) return;"
    },
        {
      "note": "toughness ignores the tick gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_toughness_r_tick.add(_atom_time)) return;\n  set_toughness(clamp_add(_toughness, _toughness_r_value, 0, _toughness_max));",
      "to": "  set_toughness(clamp_add(_toughness, _toughness_r_value, 0, _toughness_max));"
    },
        {
      "note": "toughness recovers by the fall amount",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_toughness(clamp_add(_toughness, _toughness_r_value, 0, _toughness_max));",
      "to": "  set_toughness(clamp_add(_toughness, _fall_r_value, 0, _toughness_max));"
    },
        {
      "note": "the resting branch falls through",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return;\n  }\n  if (_toughness >= toughness_max()) return;",
      "to": "  }\n  if (_toughness >= toughness_max()) return;"
    },
        {
      "note": "toughness uses the fall tick",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_toughness_r_tick.add(_atom_time)) return;",
      "to": "  if (!_fall_r_tick.add(_atom_time)) return;"
    },
        {
      "note": "a full fall value still recovers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_fall_value >= fall_value_max()) return;",
      "to": "  if (_fall_value > fall_value_max()) return;"
    },
        {
      "note": "fall ignores the tick gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_fall_r_tick.add(_atom_time)) return;\n  set_fall_value(clamp_add(_fall_value, _fall_r_value, 0, fall_value_max()));",
      "to": "  set_fall_value(clamp_add(_fall_value, _fall_r_value, 0, fall_value_max()));"
    },
        {
      "note": "fall uses the defend tick",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_fall_r_tick.add(_atom_time)) return;",
      "to": "  if (!_defend_r_tick.add(_atom_time)) return;"
    },
        {
      "note": "fall recovers by the defend amount",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_fall_value(clamp_add(_fall_value, _fall_r_value, 0, fall_value_max()));",
      "to": "  set_fall_value(clamp_add(_fall_value, _defend_r_value, 0, fall_value_max()));"
    },
        {
      "note": "the fall clamp loses its max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_fall_value(clamp_add(_fall_value, _fall_r_value, 0, fall_value_max()));",
      "to": "  set_fall_value(clamp_add(_fall_value, _fall_r_value, 0, 1.0));"
    },
        {
      "note": "a full defend value still recovers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_defend_value >= defend_value_max()) return;",
      "to": "  if (_defend_value > defend_value_max()) return;"
    },
        {
      "note": "defend ignores the tick gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_defend_r_tick.add(_atom_time)) return;\n  set_defend_value(clamp_add(_defend_value, _defend_r_value, 0, defend_value_max()));",
      "to": "  set_defend_value(clamp_add(_defend_value, _defend_r_value, 0, defend_value_max()));"
    },
        {
      "note": "defend uses the fall tick",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_defend_r_tick.add(_atom_time)) return;",
      "to": "  if (!_fall_r_tick.add(_atom_time)) return;"
    },
        {
      "note": "defend recovers by the fall amount",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_defend_value(clamp_add(_defend_value, _defend_r_value, 0, defend_value_max()));",
      "to": "  set_defend_value(clamp_add(_defend_value, _fall_r_value, 0, defend_value_max()));"
    },
        {
      "note": "the defend clamp loses its max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_defend_value(clamp_add(_defend_value, _defend_r_value, 0, defend_value_max()));",
      "to": "  set_defend_value(clamp_add(_defend_value, _defend_r_value, 0, 1.0));"
    },
        {
      "note": "resting accepts zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_resting > 0) {",
      "to": "  if (_resting >= 0) {"
    },
        {
      "note": "resting drains without the frame flag",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (!truthy(field_or(frame, u\"stat_recover\"))) return;",
      "to": "    if (false) return;"
    },
        {
      "note": "resting grows instead of draining",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_resting(clamp_add(_resting, -_atom_time, 0, resting_max()));",
      "to": "    set_resting(clamp_add(_resting, _atom_time, 0, resting_max()));"
    },
        {
      "note": "the resting clamp loses its max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_resting(clamp_add(_resting, -_atom_time, 0, resting_max()));",
      "to": "    set_resting(clamp_add(_resting, -_atom_time, 0, 1.0));"
    },
        {
      "note": "the resting branch falls through",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return;\n  }\n  fall_value_recovering();",
      "to": "  }\n  fall_value_recovering();"
    },
        {
      "note": "stat recovery only runs the fall half",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  fall_value_recovering();\n  defend_value_recovering();",
      "to": "  fall_value_recovering();"
    },
        {
      "note": "a full hp still recovers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 || _hp >= _hp_r) return;",
      "to": "  if (_hp <= 0 || _hp > _hp_r) return;"
    },
        {
      "note": "a dead hp still recovers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 || _hp >= _hp_r) return;",
      "to": "  if (_hp < 0 || _hp >= _hp_r) return;"
    },
        {
      "note": "hp recovery drops the dead guard",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 || _hp >= _hp_r) return;",
      "to": "  if (_hp >= _hp_r) return;"
    },
        {
      "note": "hp reads the mp tick interval",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _hp_r_tick.set_max(to_number(dataset(u\"hp_r_ticks\")));",
      "to": "  _hp_r_tick.set_max(to_number(dataset(u\"mp_r_ticks\")));"
    },
        {
      "note": "hp ignores the tick gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_hp_r_tick.add(_atom_time)) return;\n  set_hp(min(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));",
      "to": "  set_hp(min(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));"
    },
        {
      "note": "hp gates on the mp tick",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_hp_r_tick.add(_atom_time)) return;",
      "to": "  if (!_mp_r_tick.add(_atom_time)) return;"
    },
        {
      "note": "hp recovery grows past hp_r",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_hp(min(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));",
      "to": "  set_hp(max(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));"
    },
        {
      "note": "hp recovery drops the hp_r clamp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_hp(min(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));",
      "to": "  set_hp(_hp + to_number(dataset(u\"hp_r_value\")));"
    },
        {
      "note": "hp recovers by the mp amount",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_hp(min(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));",
      "to": "  set_hp(min(_hp_r, _hp + to_number(dataset(u\"mp_r_value\"))));"
    },
        {
      "note": "hp recovery never writes",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_hp(min(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));",
      "to": "  if (false) set_hp(min(_hp_r, _hp + to_number(dataset(u\"hp_r_value\"))));"
    },
        {
      "note": "mp recovery drops the dead guard",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 || _mp >= mp_max() || truthy(Value(_blinking)) ||\n      truthy(Value(_invisible))) {\n    return;\n  }",
      "to": "  if (_mp >= mp_max() || truthy(Value(_blinking)) ||\n      truthy(Value(_invisible))) {\n    return;\n  }"
    },
        {
      "note": "mp recovery ignores blinking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 || _mp >= mp_max() || truthy(Value(_blinking)) ||\n      truthy(Value(_invisible))) {\n    return;\n  }",
      "to": "  if (_hp <= 0 || _mp >= mp_max() || truthy(Value(_invisible))) {\n    return;\n  }"
    },
        {
      "note": "mp recovery ignores invisibility",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 || _mp >= mp_max() || truthy(Value(_blinking)) ||\n      truthy(Value(_invisible))) {\n    return;\n  }",
      "to": "  if (_hp <= 0 || _mp >= mp_max() || truthy(Value(_blinking))) {\n    return;\n  }"
    },
        {
      "note": "a full mp still recovers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 || _mp >= mp_max() ||",
      "to": "  if (_hp <= 0 || _mp > mp_max() ||"
    },
        {
      "note": "mp reads the hp tick interval",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _mp_r_tick.set_max(to_number(dataset(u\"mp_r_ticks\")));",
      "to": "  _mp_r_tick.set_max(to_number(dataset(u\"hp_r_ticks\")));"
    },
        {
      "note": "mp ignores the tick gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_mp_r_tick.add(_atom_time)) return;\n  const double r_ratio = to_number(dataset(u\"mp_r_ratio\"));",
      "to": "  const double r_ratio = to_number(dataset(u\"mp_r_ratio\"));"
    },
        {
      "note": "mp gates on the hp tick",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!_mp_r_tick.add(_atom_time)) return;",
      "to": "  if (!_hp_r_tick.add(_atom_time)) return;"
    },
        {
      "note": "the ratio reads the recovery amount",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double r_ratio = to_number(dataset(u\"mp_r_ratio\"));",
      "to": "  const double r_ratio = to_number(dataset(u\"mp_r_value\"));"
    },
        {
      "note": "the ratio uses the current hp",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  double a = hp_max();",
      "to": "  double a = hp();"
    },
        {
      "note": "the ratio uses hp_r",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  double b = _hp;",
      "to": "  double b = _hp_r;"
    },
        {
      "note": "the hp max clamp is gone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (a > 500) a = 500;",
      "to": "  if (false) a = 500;"
    },
        {
      "note": "the hp clamp is gone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (b > 500) b = 500;",
      "to": "  if (false) b = 500;"
    },
        {
      "note": "the ratio loses its rounding",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double value = 1 + round_float((a - min(r_ratio * b, a)) / 100);",
      "to": "  const double value = 1 + (a - min(r_ratio * b, a)) / 100;"
    },
        {
      "note": "the ratio takes the larger term",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double value = 1 + round_float((a - min(r_ratio * b, a)) / 100);",
      "to": "  const double value = 1 + round_float((a - max(r_ratio * b, a)) / 100);"
    },
        {
      "note": "the ratio divides by ten",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double value = 1 + round_float((a - min(r_ratio * b, a)) / 100);",
      "to": "  const double value = 1 + round_float((a - min(r_ratio * b, a)) / 10);"
    },
        {
      "note": "the recovery value loses its base point",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double value = 1 + round_float((a - min(r_ratio * b, a)) / 100);",
      "to": "  const double value = round_float((a - min(r_ratio * b, a)) / 100);"
    },
        {
      "note": "mp recovery skips the notification",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_mp(min(mp_max(), _mp + value));",
      "to": "  _mp = min(mp_max(), _mp + value);"
    },
        {
      "note": "mp recovery ignores the value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_mp(min(mp_max(), _mp + value));",
      "to": "  set_mp(min(mp_max(), _mp));"
    },
        {
      "note": "set_mark ignores the previous value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {",
      "to": "  if (!prev.has_value() || nullish(*prev)) {"
    },
        {
      "note": "set_mark compares the previous value strictly",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {",
      "to": "  if (!prev.has_value() || nullish(*prev) || strict_equals(cur, *prev)) {"
    },
        {
      "note": "set_mark treats a null prev as a real value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {",
      "to": "  if (!prev.has_value() || false || equals(cur, *prev)) {"
    },
        {
      "note": "set_mark stores the key as the value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    marks[key] = value;\n    return true;",
      "to": "    marks[key] = key;\n    return true;"
    },
        {
      "note": "set_mark forgets to store",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    marks[key] = value;\n    return true;",
      "to": "    (void)value;\n    return true;"
    },
        {
      "note": "set_mark reads a missing mark as an empty string",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value cur = it != marks.end() ? Value(it->second) : Value();\n  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {",
      "to": "  const Value cur = it != marks.end() ? Value(it->second) : Value(std::u16string());\n  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {"
    },
        {
      "note": "set_mark looks the previous value up in the wrong place",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const auto it = marks.find(key);\n  const Value cur = it != marks.end() ? Value(it->second) : Value();\n  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {",
      "to": "  const auto it = marks.find(value);\n  const Value cur = it != marks.end() ? Value(it->second) : Value();\n  if (!prev.has_value() || nullish(*prev) || equals(cur, *prev)) {"
    },
        {
      "note": "set_mark reports success on a mismatch",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    marks[key] = value;\n    return true;\n  }\n  return false;\n}",
      "to": "    marks[key] = value;\n    return true;\n  }\n  return true;\n}"
    },
        {
      "note": "del_mark ignores the previous value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!value.has_value() || nullish(*value) || equals(cur, *value)) {",
      "to": "  if (!value.has_value() || nullish(*value)) {"
    },
        {
      "note": "del_mark compares the previous value strictly",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!value.has_value() || nullish(*value) || equals(cur, *value)) {",
      "to": "  if (!value.has_value() || nullish(*value) || strict_equals(cur, *value)) {"
    },
        {
      "note": "del_mark treats a null value as a real value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!value.has_value() || nullish(*value) || equals(cur, *value)) {",
      "to": "  if (!value.has_value() || false || equals(cur, *value)) {"
    },
        {
      "note": "del_mark always reports a deletion",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return marks.erase(key) != 0;",
      "to": "    marks.erase(key);\n    return true;"
    },
        {
      "note": "del_mark reports an existing mark as missing",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return marks.erase(key) != 0;",
      "to": "    marks.erase(key);\n    return false;"
    },
        {
      "note": "del_mark reports success without deleting",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return marks.erase(key) != 0;",
      "to": "    return marks.count(key) != 0;"
    },
        {
      "note": "is_ally inverts the team check",
      "file": "native/lfw/entity/entity.cpp",
      "from": "bool Entity::is_ally(const Entity& other) const { return _team == other._team; }",
      "to": "bool Entity::is_ally(const Entity& other) const { return _team != other._team; }"
    },
        {
      "note": "is_ally is always true",
      "file": "native/lfw/entity/entity.cpp",
      "from": "bool Entity::is_ally(const Entity& other) const { return _team == other._team; }",
      "to": "bool Entity::is_ally(const Entity& other) const { return true; }"
    },
        {
      "note": "is_ally compares the receiver with itself",
      "file": "native/lfw/entity/entity.cpp",
      "from": "bool Entity::is_ally(const Entity& other) const { return _team == other._team; }",
      "to": "bool Entity::is_ally(const Entity& other) const { return _team == _team; }"
    },
        {
      "note": "is_ally compares the argument with itself",
      "file": "native/lfw/entity/entity.cpp",
      "from": "bool Entity::is_ally(const Entity& other) const { return _team == other._team; }",
      "to": "bool Entity::is_ally(const Entity& other) const { return other._team == other._team; }"
    },
        {
      "note": "get_emitter rejects index zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!(idx >= 0) || std::floor(idx) != idx) return nullptr;",
      "to": "  if (!(idx > 0) || std::floor(idx) != idx) return nullptr;"
    },
        {
      "note": "get_emitter accepts fractional indexes",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!(idx >= 0) || std::floor(idx) != idx) return nullptr;",
      "to": "  if (!(idx >= 0) || false) return nullptr;"
    },
        {
      "note": "get_emitter only resolves the first slot",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (i >= emitters.size()) return nullptr;",
      "to": "  if (i >= 1) return nullptr;"
    },
        {
      "note": "get_emitter always looks up the first slot",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return world().find_entity(emitters[i]);",
      "to": "  return world().find_entity(emitters[0]);"
    },
        {
      "note": "get_emitter resolves an empty id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  // `if (!emittier_id) return;` — an empty id is falsy, so it never resolves.\n  if (emitters[i].empty()) return nullptr;",
      "to": "  // `if (!emittier_id) return;` — an empty id is falsy, so it never resolves.\n  if (host_ == nullptr) return nullptr;"
    },
        {
      "note": "get_emitter rejects every non-empty id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (emitters[i].empty()) return nullptr;",
      "to": "  if (!emitters[i].empty()) return nullptr;"
    },
        {
      "note": "the opoint speedz field name is misspelled",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value speedz_field = field_or(opoint, u\"speedz\");",
      "to": "  const Value speedz_field = field_or(opoint, u\"speedZ\");"
    },
        {
      "note": "the missing opoint speedz default is not zero",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double o_speedz =\n      has_speedz ? speedz_explicit : (z_launch ? defines::num(u\"Defines.DEFAULT_OPOINT_SPEED_Z\") : 0.0);",
      "to": "  const double o_speedz =\n      has_speedz ? speedz_explicit : (z_launch ? defines::num(u\"Defines.DEFAULT_OPOINT_SPEED_Z\") : 1.0);"
    },
        {
      "note": "set_state ignores the registry",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  state::State_Base* v = states_->get(state_code);",
      "to": "  state::State_Base* v = nullptr;"
    },
        {
      "note": "set_state drops the fallback entry",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (v == nullptr) v = &states_->fallback(field_or(_data, u\"type\"), state_code);",
      "to": "  if (v == nullptr) v = nullptr;"
    },
        {
      "note": "the fallback type is read from the wrong key",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (v == nullptr) v = &states_->fallback(field_or(_data, u\"type\"), state_code);",
      "to": "  if (v == nullptr) v = &states_->fallback(field_or(_data, u\"tYpe\"), state_code);"
    },
        {
      "note": "set_state always re-enters the same state",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_state == v) return;",
      "to": "  if (false) return;"
    },
        {
      "note": "set_state returns whenever the state changes",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_state == v) return;",
      "to": "  if (_state != v) return;"
    },
        {
      "note": "leave sees the previous frame instead of the current one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_state != nullptr) _state->leave(*this, frame);",
      "to": "  if (_state != nullptr) _state->leave(*this, get_prev_frame());"
    },
        {
      "note": "set_state never leaves the old state",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_state != nullptr) _state->leave(*this, frame);",
      "to": "  if (false) _state->leave(*this, frame);"
    },
        {
      "note": "enter sees the current frame instead of the previous one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_state != nullptr && _state->enter) _state->enter(*this, get_prev_frame());",
      "to": "  if (_state != nullptr && _state->enter) _state->enter(*this, frame);"
    },
        {
      "note": "set_state never enters the new state",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_state != nullptr && _state->enter) _state->enter(*this, get_prev_frame());",
      "to": "  if (_state != nullptr && !_state->enter) _state->enter(*this, get_prev_frame());"
    },
        {
      "note": "reset keeps the active state",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _state = nullptr;\n  dead_gone = 0;",
      "to": "  dead_gone = 0;"
    },
        {
      "note": "reset ignores the registry argument",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  // `this._states = states` — mirror TS's position (right after `dropping`).\n  states_ = states;",
      "to": "  // `this._states = states` — the registry the entity looks state codes up in.\n  states_ = &state::entity_states();"
    },
        {
      "note": "the view velocity x reads z",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual double velocity_x() const { return velocity.x; }",
      "to": "  virtual double velocity_x() const { return velocity.z; }"
    },
        {
      "note": "the view velocity y reads x",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual double velocity_y() const { return velocity.y; }",
      "to": "  virtual double velocity_y() const { return velocity.x; }"
    },
        {
      "note": "the view velocity z reads x",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual double velocity_z() const { return velocity.z; }",
      "to": "  virtual double velocity_z() const { return velocity.x; }"
    },
        {
      "note": "the view hp reads mp",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual double hp() const { return _hp; }",
      "to": "  virtual double hp() const { return _mp; }"
    },
        {
      "note": "the view hp_r reads hp",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual double hp_r() const { return _hp_r; }",
      "to": "  virtual double hp_r() const { return _hp; }"
    },
        {
      "note": "the view hp_r setter adds one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::set_hp_r(double v) { _hp_r = round_float(max(0.0, v)); }",
      "to": "void Entity::set_hp_r(double v) { _hp_r = round_float(max(0.0, v) + 1); }"
    },
        {
      "note": "the view hp_max reads mp_max",
      "file": "native/lfw/entity/entity.cpp",
      "from": "double Entity::hp_max() const {\n  return _hp_max.has_value() ? *_hp_max : num_of(world().dataset.get(u\"hp_max\"));\n}",
      "to": "double Entity::hp_max() const {\n  return _mp_max.has_value() ? *_mp_max : num_of(world().dataset.get(u\"mp_max\"));\n}"
    },
        {
      "note": "the view mp reads hp",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual double mp() const { return _mp; }",
      "to": "  virtual double mp() const { return _hp; }"
    },

        {
      "note": "the view motionless setter writes shaking",
      "file": "native/lfw/entity/entity.cpp",
      "from": "Entity& Entity::set_motionless(double v) {\n  motionless = v;\n  return *this;\n}",
      "to": "Entity& Entity::set_motionless(double v) {\n  shaking = v;\n  return *this;\n}"
    },

        {
      "note": "the view state reads variant",
      "file": "native/lfw/entity/entity.cpp",
      "from": "Value Entity::state() const { return field_or(frame, u\"state\"); }",
      "to": "Value Entity::state() const { return Value(variant); }"
    },
        {
      "note": "the view frame_info reads the previous frame",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual Value frame_info() const { return frame; }",
      "to": "  virtual Value frame_info() const { return get_prev_frame(); }"
    },
        {
      "note": "the view prev_frame reads the current frame",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual Value get_prev_frame() const { return _prev_frame; }",
      "to": "  virtual Value get_prev_frame() const { return frame; }"
    },

        {
      "note": "the view team is a constant",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual const std::u16string& team() const { return _team; }",
      "to": "  virtual const std::u16string& team() const {\n    static const std::u16string k_constant(u\"x\");\n    return k_constant;\n  }"
    },
        {
      "note": "the view data_type reads the data id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "Value Entity::data_type() const { return field_or(data(), u\"type\"); }",
      "to": "Value Entity::data_type() const { return field_or(data(), u\"id\"); }"
    },
        {
      "note": "the view jumping_x reads y",
      "file": "native/lfw/entity/entity.h",
      "from": "  virtual Value jumping_x() const { return Value(jumping.x); }",
      "to": "  virtual Value jumping_x() const { return Value(jumping.y); }"
    },
        {
      "note": "the fallback key uses the wrong separator",
      "file": "native/lfw/state/states.cpp",
      "from": "  const std::u16string state_key = to_string(type) + u\"_\" + to_string(code);",
      "to": "  const std::u16string state_key = to_string(type) + u\"-\" + to_string(code);"
    },
        {
      "note": "the fallback key swaps type and code",
      "file": "native/lfw/state/states.cpp",
      "from": "  const std::u16string state_key = to_string(type) + u\"_\" + to_string(code);",
      "to": "  const std::u16string state_key = to_string(code) + u\"_\" + to_string(type);"
    },
        {
      "note": "the fallback entry is never reused",
      "file": "native/lfw/state/states.cpp",
      "from": "  if (State_Base* hit = get(key)) return *hit;",
      "to": "  if (State_Base* hit = nullptr) return *hit;"
    },
        {
      "note": "the fallback type comparison is loose",
      "file": "native/lfw/state/states.cpp",
      "from": "  if (strict_equals(type, Value(static_cast<double>(EntityEnum::Fighter)))) {",
      "to": "  if (equals(type, Value(static_cast<double>(EntityEnum::Fighter)))) {"
    },
        {
      "note": "the weapon fallback builds a character state",
      "file": "native/lfw/state/states.cpp",
      "from": "    return make<WeaponState_Base>(key, code);",
      "to": "    return make<CharacterState_Base>(key, code);"
    },
        {
      "note": "the ball fallback builds a weapon state",
      "file": "native/lfw/state/states.cpp",
      "from": "    return make<BallState_Base>(key, code);",
      "to": "    return make<WeaponState_Base>(key, code);"
    },
        {
      "note": "the default fallback builds a character state",
      "file": "native/lfw/state/states.cpp",
      "from": "  return make<State_Base>(key, code);",
      "to": "  return make<CharacterState_Base>(key, code);"
    },
        {
      "note": "the registry key encoding ignores the value kind",
      "file": "native/lfw/state/states.cpp",
      "from": "std::u16string States::encode_key(const Value& key) {\n  const std::u16string* text = std::get_if<std::u16string>(&key);\n  if (text != nullptr) return std::u16string(kStringPrefix) + *text;\n  return std::u16string(kNumberPrefix) + to_string(key);\n}",
      "to": "std::u16string States::encode_key(const Value& key) {\n  const std::u16string* text = std::get_if<std::u16string>(&key);\n  if (text != nullptr) return *text;\n  return to_string(key);\n}"
    },
        {
      "note": "add_v_rest keys vrests by the victim id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::add_v_rest(const collision::Collision& c) {\n  vrests[c.aid] = c;",
      "to": "void Entity::add_v_rest(const collision::Collision& c) {\n  vrests[c.vid] = c;"
    },
        {
      "note": "add_v_rest keys blockers by the victim id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "if (strict_equals(kind, Value(static_cast<double>(ItrKind::Block)))) blockers[c.aid] = c;",
      "to": "if (strict_equals(kind, Value(static_cast<double>(ItrKind::Block)))) blockers[c.vid] = c;"
    },
        {
      "note": "add_v_rest keys superpunchs by the victim id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (strict_equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))\n    superpunchs[c.aid] = c;",
      "to": "  if (strict_equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))\n    superpunchs[c.vid] = c;"
    },
        {
      "note": "the Block kind mirrors into superpunchs",
      "file": "native/lfw/entity/entity.cpp",
      "from": "if (strict_equals(kind, Value(static_cast<double>(ItrKind::Block)))) blockers[c.aid] = c;",
      "to": "if (strict_equals(kind, Value(static_cast<double>(ItrKind::Block)))) superpunchs[c.aid] = c;"
    },
        {
      "note": "the SuperPunchMe kind mirrors into blockers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (strict_equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))\n    superpunchs[c.aid] = c;",
      "to": "  if (strict_equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))\n    blockers[c.aid] = c;"
    },
        {
      "note": "the Block kind is compared loosely",
      "file": "native/lfw/entity/entity.cpp",
      "from": "if (strict_equals(kind, Value(static_cast<double>(ItrKind::Block)))) blockers[c.aid] = c;",
      "to": "if (equals(kind, Value(static_cast<double>(ItrKind::Block)))) blockers[c.aid] = c;"
    },
        {
      "note": "the SuperPunchMe kind is compared loosely",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (strict_equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))\n    superpunchs[c.aid] = c;",
      "to": "  if (equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))\n    superpunchs[c.aid] = c;"
    },
        {
      "note": "the SuperPunchMe kind is compared against Block",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (strict_equals(kind, Value(static_cast<double>(ItrKind::SuperPunchMe))))\n    superpunchs[c.aid] = c;",
      "to": "  if (strict_equals(kind, Value(static_cast<double>(ItrKind::Block))))\n    superpunchs[c.aid] = c;"
    },
        {
      "note": "add_v_rest reads the itr kind from bdy",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value kind = field_or(c.itr, u\"kind\");",
      "to": "  const Value kind = field_or(c.bdy, u\"kind\");"
    },
        {
      "note": "add_v_rest stores a default collision instead of the argument",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::add_v_rest(const collision::Collision& c) {\n  vrests[c.aid] = c;",
      "to": "void Entity::add_v_rest(const collision::Collision& c) {\n  vrests[c.aid] = collision::Collision();"
    },
        {
      "note": "get_v_rest returns the raw rest (no truthiness fold)",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double rest = it->second.rest;\n  return truthy(Value(rest)) ? rest : 0;",
      "to": "  const double rest = it->second.rest;\n  return rest;"
    },
        {
      "note": "get_v_rest returns 0 for a stored rest",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double rest = it->second.rest;\n  return truthy(Value(rest)) ? rest : 0;",
      "to": "  const double rest = it->second.rest;\n  return truthy(Value(rest)) ? 0.0 : rest;"
    },
        {
      "note": "get_v_rest answers a missing id with -1",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const auto it = vrests.find(a_id);\n  if (it == vrests.end()) return 0;",
      "to": "  const auto it = vrests.find(a_id);\n  if (it == vrests.end()) return -1;"
    },
        {
      "note": "del_v_rest leaves the blockers mirror alone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::del_v_rest(const std::u16string& a_id) {\n  vrests.erase(a_id);\n  blockers.erase(a_id);",
      "to": "void Entity::del_v_rest(const std::u16string& a_id) {\n  vrests.erase(a_id);"
    },
        {
      "note": "del_v_rest leaves the superpunchs mirror alone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  blockers.erase(a_id);\n  superpunchs.erase(a_id);",
      "to": "  blockers.erase(a_id);"
    },
        {
      "note": "del_v_rest keeps the vrests entry",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::del_v_rest(const std::u16string& a_id) {\n  vrests.erase(a_id);",
      "to": "void Entity::del_v_rest(const std::u16string& a_id) {\n  vrests.size();"
    },
        {
      "note": "get_flag treats an ally as an enemy",
      "file": "native/lfw/entity/entity_flag.h",
      "from": "  int32_t ret = a_team == b_team ? static_cast<int32_t>(HitFlag::Ally)\n                                 : static_cast<int32_t>(HitFlag::Enemy);",
      "to": "  int32_t ret = a_team == b_team ? static_cast<int32_t>(HitFlag::Enemy)\n                                 : static_cast<int32_t>(HitFlag::Ally);"
    },
        {
      "note": "get_flag always sees the same team",
      "file": "native/lfw/entity/entity_flag.h",
      "from": "  int32_t ret = a_team == b_team ? static_cast<int32_t>(HitFlag::Ally)",
      "to": "  int32_t ret = true ? static_cast<int32_t>(HitFlag::Ally)"
    },
        {
      "note": "get_flag skips the Dead bit at exactly 0 hp",
      "file": "native/lfw/entity/entity_flag.h",
      "from": "  if (a_hp <= 0) ret |= static_cast<int32_t>(HitFlag::Dead);",
      "to": "  if (a_hp < 0) ret |= static_cast<int32_t>(HitFlag::Dead);"
    },
        {
      "note": "get_flag adds Dead above the hp threshold",
      "file": "native/lfw/entity/entity_flag.h",
      "from": "  if (a_hp <= 0) ret |= static_cast<int32_t>(HitFlag::Dead);",
      "to": "  if (a_hp <= 10) ret |= static_cast<int32_t>(HitFlag::Dead);"
    },
        {
      "note": "get_flag replaces the team bits with Dead",
      "file": "native/lfw/entity/entity_flag.h",
      "from": "  if (a_hp <= 0) ret |= static_cast<int32_t>(HitFlag::Dead);",
      "to": "  if (a_hp <= 0) ret = static_cast<int32_t>(HitFlag::Dead);"
    },
        {
      "note": "get_flag ignores the entity type",
      "file": "native/lfw/entity/entity_flag.h",
      "from": "  return static_cast<double>(ret | js_to_int32(a_type));",
      "to": "  return static_cast<double>(ret);"
    },
        {
      "note": "get_flag ORs the hp instead of the type",
      "file": "native/lfw/entity/entity_flag.h",
      "from": "  return static_cast<double>(ret | js_to_int32(a_type));",
      "to": "  return static_cast<double>(ret | js_to_int32(a_hp));"
    },
        {
      "note": "clean_holding ignores the self side",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (holding->bearer == this) holding->bearer = nullptr;\n  holding = nullptr;\n}",
      "to": "  if (holding->bearer == this) holding->bearer = nullptr;\n}"
    },
        {
      "note": "clean_holding compares the bearer with !=",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::clean_holding() {\n  if (holding == nullptr) return;\n  if (holding->bearer == this) holding->bearer = nullptr;",
      "to": "void Entity::clean_holding() {\n  if (holding == nullptr) return;\n  if (holding->bearer != this) holding->bearer = nullptr;"
    },
        {
      "note": "clean_holding writes the back-pointer instead of nulling it",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (holding->bearer == this) holding->bearer = nullptr;\n  holding = nullptr;\n}",
      "to": "  if (holding->bearer == this) holding->bearer = this;\n  holding = nullptr;\n}"
    },
        {
      "note": "clean_catching ignores the self side",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (catching->catcher == this) catching->catcher = nullptr;\n  catching = nullptr;\n}",
      "to": "  if (catching->catcher == this) catching->catcher = nullptr;\n}"
    },
        {
      "note": "clean_catching compares the catcher with !=",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::clean_catching() {\n  if (catching == nullptr) return;\n  if (catching->catcher == this) catching->catcher = nullptr;",
      "to": "void Entity::clean_catching() {\n  if (catching == nullptr) return;\n  if (catching->catcher != this) catching->catcher = nullptr;"
    },
        {
      "note": "clean_catching writes the back-pointer instead of nulling it",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (catching->catcher == this) catching->catcher = nullptr;\n  catching = nullptr;\n}",
      "to": "  if (catching->catcher == this) catching->catcher = this;\n  catching = nullptr;\n}"
    },
        {
      "note": "drop_catching reports false",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value* auto_frame = defines::find(u\"Defines.NEXT_FRAME_AUTO\");\n  enter_frame(auto_frame != nullptr ? *auto_frame : Value());\n  return true;",
      "to": "  const Value* auto_frame = defines::find(u\"Defines.NEXT_FRAME_AUTO\");\n  enter_frame(auto_frame != nullptr ? *auto_frame : Value());\n  return false;"
    },
        {
      "note": "drop_catching answers true without a catching",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (catching == nullptr) return false;",
      "to": "  if (catching == nullptr) return true;"
    },
        {
      "note": "drop_catching ignores the back-pointer",
      "file": "native/lfw/entity/entity.cpp",
      "from": "bool Entity::drop_catching() {\n  if (catching == nullptr) return false;\n  if (catching->catcher == this) catching->catcher = nullptr;",
      "to": "bool Entity::drop_catching() {\n  if (catching == nullptr) return false;\n  if (catching->catcher != this) catching->catcher = nullptr;"
    },
        {
      "note": "drop_catching does not request the auto frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value* auto_frame = defines::find(u\"Defines.NEXT_FRAME_AUTO\");\n  enter_frame(auto_frame != nullptr ? *auto_frame : Value());\n  return true;",
      "to": "  return true;"
    },
        {
      "note": "drop_catching requests a missing auto frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value* auto_frame = defines::find(u\"Defines.NEXT_FRAME_AUTO\");\n  enter_frame(auto_frame != nullptr ? *auto_frame : Value());\n  return true;",
      "to": "  const Value* auto_frame = defines::find(u\"Defines.NEXT_FRAME_AUT0\");\n  enter_frame(auto_frame != nullptr ? *auto_frame : Value());\n  return true;"
    },
        {
      "note": "blink_and_gone arms respawn",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::blink_and_gone(double duration) {\n  _blinking = duration;\n  _after_blink = frame_id::kGone;",
      "to": "void Entity::blink_and_gone(double duration) {\n  _blinking = duration;\n  _after_blink = frame_id::kRespawn;"
    },
        {
      "note": "blink_and_respawn arms gone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::blink_and_respawn(double duration) {\n  _blinking = duration;\n  _after_blink = frame_id::kRespawn;",
      "to": "void Entity::blink_and_respawn(double duration) {\n  _blinking = duration;\n  _after_blink = frame_id::kGone;"
    },
        {
      "note": "blink_and_gone rounds the duration through the setter",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::blink_and_gone(double duration) {\n  _blinking = duration;",
      "to": "void Entity::blink_and_gone(double duration) {\n  set_blinking(duration);"
    },
        {
      "note": "blink_and_respawn rounds the duration through the setter",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::blink_and_respawn(double duration) {\n  _blinking = duration;",
      "to": "void Entity::blink_and_respawn(double duration) {\n  set_blinking(duration);"
    },
        {
      "note": "blink_and_gone drops the duration",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::blink_and_gone(double duration) {\n  _blinking = duration;",
      "to": "void Entity::blink_and_gone(double duration) {\n  _blinking = 0;"
    },
        {
      "note": "blink_and_respawn drops the duration",
      "file": "native/lfw/entity/entity.cpp",
      "from": "void Entity::blink_and_respawn(double duration) {\n  _blinking = duration;",
      "to": "void Entity::blink_and_respawn(double duration) {\n  _blinking = 0;"
    },
        {
      "note": "set_position skips the x axis",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(x)) position.x = round_float(to_number(x));\n  if (!nullish(y)) position.y",
      "to": "  if (!nullish(x) && false) position.x = round_float(to_number(x));\n  if (!nullish(y)) position.y"
    },
        {
      "note": "set_position skips the y axis",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(y)) position.y = round_float(to_number(y));\n  if (!nullish(z)) position.z",
      "to": "  if (!nullish(y) && false) position.y = round_float(to_number(y));\n  if (!nullish(z)) position.z"
    },
        {
      "note": "set_position skips the z axis",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(z)) position.z = round_float(to_number(z));\n  if (prev_position.x",
      "to": "  if (!nullish(z) && false) position.z = round_float(to_number(z));\n  if (prev_position.x"
    },
        {
      "note": "set_position stores the raw x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(x)) position.x = round_float(to_number(x));",
      "to": "  if (!nullish(x)) position.x = to_number(x);"
    },
        {
      "note": "set_position stores the raw y",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(y)) position.y = round_float(to_number(y));",
      "to": "  if (!nullish(y)) position.y = to_number(y);"
    },
        {
      "note": "set_position stores the raw z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(z)) position.z = round_float(to_number(z));",
      "to": "  if (!nullish(z)) position.z = to_number(z);"
    },
        {
      "note": "set_position copies prev_position when it is set",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (prev_position.x == kMinSafeInteger) prev_position = position;",
      "to": "  if (prev_position.x != kMinSafeInteger) prev_position = position;"
    },
        {
      "note": "set_position requests on_x_restrict for an equal x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.x != r.x && truthy(on_x)) enter_frame(on_x);",
      "to": "  if (position.x == r.x && truthy(on_x)) enter_frame(on_x);"
    },
        {
      "note": "set_position requests on_z_restrict for an equal z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.z != r.z && truthy(on_z)) enter_frame(on_z);",
      "to": "  if (position.z == r.z && truthy(on_z)) enter_frame(on_z);"
    },
        {
      "note": "set_position requests on_y_restrict for an equal y",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.y != r.y && truthy(on_y)) enter_frame(on_y);",
      "to": "  if (position.y == r.y && truthy(on_y)) enter_frame(on_y);"
    },
        {
      "note": "set_position drops the on_x_restrict truthy gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.x != r.x && truthy(on_x)) enter_frame(on_x);",
      "to": "  if (position.x != r.x) enter_frame(on_x);"
    },
        {
      "note": "set_position gates the overall restrict test with &&",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (position.x != r.x || position.y != r.y || position.z != r.z) {",
      "to": "  if (position.x != r.x && position.y != r.y && position.z != r.z) {"
    },
        {
      "note": "set_position drops the on_restrict frame request",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value on_restrict = field_or(frame, u\"on_restrict\");\n    if (truthy(on_restrict)) enter_frame(on_restrict);",
      "to": "    const Value on_restrict = field_or(frame, u\"on_restrict\");\n    (void)on_restrict;"
    },
        {
      "note": "set_position never runs the state hook",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (_state != nullptr) _state->on_restrict(*this, r.x, r.y, r.z);",
      "to": "    (void)r;"
    },
        {
      "note": "set_position feeds the state hook the restricted y twice",
      "file": "native/lfw/entity/entity.cpp",
      "from": "_state->on_restrict(*this, r.x, r.y, r.z);",
      "to": "_state->on_restrict(*this, r.x, r.z, r.z);"
    },
        {
      "note": "set_position swaps the ground segment arguments",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _ground_y = Ground::y(terrain, position.x, position.z);",
      "to": "  _ground_y = Ground::y(terrain, position.z, position.x);"
    },
        {
      "note": "set_position takes the ground height from the restrict answer",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _ground_y = Ground::y(terrain, position.x, position.z);",
      "to": "  _ground_y = r.y;"
    },
        {
      "note": "update_position runs while the entity is held",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  double vx = velocity.x;",
      "to": "  if (catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  double vx = velocity.x;"
    },
        {
      "note": "update_position runs while the entity is catching",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (bearer != nullptr || catcher != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  double vx = velocity.x;",
      "to": "  if (bearer != nullptr || truthy(Value(shaking)) ||\n      truthy(Value(motionless)))\n    return;\n  double vx = velocity.x;"
    },
        {
      "note": "update_position stops vx for a blocker behind the entity",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if ((vx < 0 && v.attacker.px < position.x) || (vx > 0 && v.attacker.px > position.x)) {",
      "to": "    if ((vx < 0 && v.attacker.px < position.x) || (vx > 0 && v.attacker.px < position.x)) {"
    },
        {
      "note": "update_position stops vx for a receding blocker",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if ((vx < 0 && v.attacker.px < position.x) || (vx > 0 && v.attacker.px > position.x)) {",
      "to": "    if ((vx < 0 && v.attacker.px > position.x) || (vx > 0 && v.attacker.px > position.x)) {"
    },
        {
      "note": "update_position stops vz for a blocker behind the entity",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if ((vz < 0 && v.attacker.pz < position.z) || (vz > 0 && v.attacker.pz > position.z)) {",
      "to": "    if ((vz < 0 && v.attacker.pz < position.z) || (vz > 0 && v.attacker.pz < position.z)) {"
    },
        {
      "note": "update_position zeroes the blocker velocity without arming prev_velocity.x",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      vx = 0;\n      prev_velocity.x = 0;",
      "to": "      vx = 0;"
    },
        {
      "note": "update_position zeroes the blocker velocity without arming prev_velocity.z",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      vz = 0;\n      prev_velocity.z = 0;",
      "to": "      vz = 0;"
    },
        {
      "note": "update_position integrates x with the z history",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    x += (vx + prev_velocity.x) * 0.5 * atom_time;",
      "to": "    x += (vx + prev_velocity.z) * 0.5 * atom_time;"
    },
        {
      "note": "update_position integrates y with the x history",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    y += (vy + prev_velocity.y) * 0.5 * atom_time;",
      "to": "    y += (vy + prev_velocity.x) * 0.5 * atom_time;"
    },
        {
      "note": "update_position integrates z with the x history",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    z += (vz + prev_velocity.z) * 0.5 * atom_time;",
      "to": "    z += (vz + prev_velocity.x) * 0.5 * atom_time;"
    },
        {
      "note": "update_position swaps the stepped axes",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_position(Value(x), Value(y), Value(z));",
      "to": "    set_position(Value(z), Value(y), Value(x));"
    },
        {
      "note": "update_position stores the live velocity as the previous one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  prev_velocity.set(vx, vy, vz);",
      "to": "  prev_velocity.set(velocity.x, velocity.y, velocity.z);"
    },
        {
      "note": "set_frame keeps the opoints on a gone frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    opoints.clear();\n  } else if (!opoints.empty()) {",
      "to": "  } else if (!opoints.empty()) {"
    },
        {
      "note": "set_frame filters the opoints on the wrong interval mode",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (!strict_equals(field_or(opoint, u\"interval_mode\"), Value(1.0))) continue;",
      "to": "      if (!strict_equals(field_or(opoint, u\"interval_mode\"), Value(0.0))) continue;"
    },
        {
      "note": "set_frame keeps the opoints whose interval disappeared",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (!exists) continue;",
      "to": "      if (exists) continue;"
    },
        {
      "note": "set_frame compacts the opoints from the wrong end",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      opoints[slow++] = opoints[fast];",
      "to": "      opoints[slow++] = opoints[len - 1 - fast];"
    },
        {
      "note": "set_frame keeps the unfiltered opoint length",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    opoints.resize(slow);",
      "to": "    opoints.resize(len);"
    },
        {
      "note": "set_frame remembers the incoming frame as the previous one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _prev_frame = frame;\n  _landing_frame = Value(NullTag{});\n  frame = v;",
      "to": "  _prev_frame = v;\n  _landing_frame = Value(NullTag{});\n  frame = v;"
    },
        {
      "note": "set_frame arms the incoming frame as the landing frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _prev_frame = frame;\n  _landing_frame = Value(NullTag{});\n  frame = v;",
      "to": "  _prev_frame = frame;\n  _landing_frame = v;\n  frame = v;"
    },
        {
      "note": "set_frame swaps in the previous frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  frame = v;\n  if (!truthy(Value(js_length(field_or(v, u\"itr\"))))) set_arest(0);",
      "to": "  frame = _prev_frame;\n  if (!truthy(Value(js_length(field_or(v, u\"itr\"))))) set_arest(0);"
    },
        {
      "note": "set_frame clears arest when the frame has itr",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!truthy(Value(js_length(field_or(v, u\"itr\"))))) set_arest(0);",
      "to": "  if (truthy(Value(js_length(field_or(v, u\"itr\"))))) set_arest(0);"
    },
        {
      "note": "set_frame reads the previous state off the new frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value prev_state_code = field_or(_prev_frame, u\"state\");",
      "to": "  const Value prev_state_code = field_or(frame, u\"state\");"
    },
        {
      "note": "set_frame sets the state on an unchanged code as well",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!strict_equals(prev_state_code, next_state_code)) set_state(next_state_code);",
      "to": "  if (strict_equals(prev_state_code, next_state_code)) set_state(next_state_code);"
    },
        {
      "note": "set_frame sets the previous state code",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!strict_equals(prev_state_code, next_state_code)) set_state(next_state_code);",
      "to": "  if (!strict_equals(prev_state_code, next_state_code)) set_state(prev_state_code);"
    },
        {
      "note": "set_frame writes a fixed invisible value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(invisible)) set_invisible(to_number(invisible));",
      "to": "  if (truthy(invisible)) set_invisible(1);"
    },
        {
      "note": "set_frame drops the invisible truthy gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(invisible)) set_invisible(to_number(invisible));",
      "to": "  set_invisible(to_number(invisible));"
    },
        {
      "note": "set_frame reads blinking from the invisible key",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value blinking = field_or(v, u\"blinking\");",
      "to": "  const Value blinking = field_or(v, u\"invisible\");"
    },
        {
      "note": "set_frame writes a fixed blinking value",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(blinking)) set_blinking(to_number(blinking));",
      "to": "  if (truthy(blinking)) set_blinking(1);"
    },
        {
      "note": "set_frame routes invulnerable through the clamped setter",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(invulnerable)) _invulnerable = to_number(invulnerable);",
      "to": "  if (truthy(invulnerable)) set_invulnerable(to_number(invulnerable));"
    },
        {
      "note": "set_frame skips the frame opoints",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(opoint)) apply_opoints(opoint);",
      "to": "  (void)opoint;"
    },
        {
      "note": "set_frame drops the cpoint gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!truthy(field_or(v, u\"cpoint\"))) {",
      "to": "  if (truthy(field_or(v, u\"cpoint\"))) {"
    },
        {
      "note": "set_frame forgets to clear catching",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_catching(nullptr);\n    catcher = nullptr;",
      "to": "    catcher = nullptr;"
    },
        {
      "note": "set_frame skips the broadcasts",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    for (std::size_t i = 0; i < broadcasts->size(); ++i) world().lfw().broadcast(broadcasts->at(i));",
      "to": "    (void)broadcasts;"
    },
        {
      "note": "set_frame drops the last broadcast",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    for (std::size_t i = 0; i < broadcasts->size(); ++i) world().lfw().broadcast(broadcasts->at(i));",
      "to": "    for (std::size_t i = 0; i + 1 < broadcasts->size(); ++i) world().lfw().broadcast(broadcasts->at(i));"
    },
        {
      "note": "set_frame lets the held weapon catch instead of following",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (holding != nullptr) holding->follow_bearer();\n  if (catching != nullptr) catching->follow_catcher();",
      "to": "  if (holding != nullptr) holding->follow_catcher();\n  if (catching != nullptr) catching->follow_catcher();"
    },
        {
      "note": "enter_frame reads the gone marker off the requested frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (strict_equals(field_or(frame, u\"id\"), Value(std::u16string(frame_id::kGone))))\n    return EnterFrameResult::Gone;",
      "to": "  if (strict_equals(field_or(nfs, u\"id\"), Value(std::u16string(frame_id::kGone))))\n    return EnterFrameResult::Gone;"
    },
        {
      "note": "enter_frame reports the gone frame as entered",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (strict_equals(field_or(frame, u\"id\"), Value(std::u16string(frame_id::kGone))))\n    return EnterFrameResult::Gone;",
      "to": "  if (strict_equals(field_or(frame, u\"id\"), Value(std::u16string(frame_id::kGone))))\n    return EnterFrameResult::Entered;"
    },
        {
      "note": "enter_frame falls back without the fallback flag",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(result) && fallback) {",
      "to": "  if (nullish(result)) {"
    },
        {
      "note": "enter_frame writes nothing on the fallback frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_frame(f);\n    wait = handle_wait_flag(Value(), f);",
      "to": "    set_frame(Value());\n    wait = handle_wait_flag(Value(), f);"
    },
        {
      "note": "enter_frame drops the fallback wait update",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_frame(f);\n    wait = handle_wait_flag(Value(), f);",
      "to": "    set_frame(f);"
    },
        {
      "note": "enter_frame reports the fallback as not found",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    return EnterFrameResult::Fallback;",
      "to": "    return EnterFrameResult::NotFound;"
    },
        {
      "note": "enter_frame reports a missing frame as the fallback",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(result)) return EnterFrameResult::NotFound;",
      "to": "  if (nullish(result)) return EnterFrameResult::Fallback;"
    },
        {
      "note": "enter_frame ignores the next-frame result",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return handle_next_frame_result(result);",
      "to": "  (void)result;\n  return EnterFrameResult::Entered;"
    },
        {
      "note": "enter_frame_by_id overwrites a defined id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nullish(use_id) && fallback) use_id = Value(std::u16string(frame_id::kAuto));",
      "to": "  if (fallback) use_id = Value(std::u16string(frame_id::kAuto));"
    },
        {
      "note": "enter_frame_by_id never remembers the id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (nf != nullptr) nf->set(u\"id\", use_id);",
      "to": "  if (nf != nullptr) (void)use_id;"
    },
        {
      "note": "enter_frame_by_id forwards the raw id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return enter_frame(_next_frame_by_id, fallback);\n}\n\nEnterFrameResult Entity::handle_next_frame_result",
      "to": "  return enter_frame(use_id, fallback);\n}\n\nEnterFrameResult Entity::handle_next_frame_result"
    },
        {
      "note": "handle_next_frame_result drains while infinity_mp is on",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!truthy(world().dataset.get(u\"infinity_mp\"))) {\n    const Value mp = field_or(flags, u\"mp\");",
      "to": "  if (truthy(world().dataset.get(u\"infinity_mp\"))) {\n    const Value mp = field_or(flags, u\"mp\");"
    },
        {
      "note": "handle_next_frame_result reads mp off the hp key",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value mp = field_or(flags, u\"mp\");",
      "to": "    const Value mp = field_or(flags, u\"hp\");"
    },
        {
      "note": "handle_next_frame_result adds the mp cost",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (truthy(mp)) set_mp(_mp - to_number(mp));",
      "to": "    if (truthy(mp)) set_mp(_mp + to_number(mp));"
    },
        {
      "note": "handle_next_frame_result adds the hp cost",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (truthy(hp)) set_hp(_hp - to_number(hp));",
      "to": "    if (truthy(hp)) set_hp(_hp + to_number(hp));"
    },
        {
      "note": "handle_next_frame_result drops the mp truthy gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (truthy(mp)) set_mp(_mp - to_number(mp));",
      "to": "    set_mp(_mp - to_number(mp));"
    },
        {
      "note": "handle_next_frame_result drops the hp truthy gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (truthy(hp)) set_hp(_hp - to_number(hp));",
      "to": "    set_hp(_hp - to_number(hp));"
    },
        {
      "note": "handle_next_frame_result takes the else branch with a frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(frame_v)) {\n    play_sound(field_or(frame_v, u\"sound\"));",
      "to": "  if (!truthy(frame_v)) {\n    play_sound(field_or(frame_v, u\"sound\"));"
    },
        {
      "note": "handle_next_frame_result skips the frame swap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_frame(frame_v);\n  } else {",
      "to": "  } else {"
    },
        {
      "note": "handle_next_frame_result inverts the empty-frame probe",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if ((empty_frame != nullptr && same_ref(frame, *empty_frame)) || fallback)",
      "to": "    if ((empty_frame != nullptr && !same_ref(frame, *empty_frame)) || fallback)"
    },
        {
      "note": "handle_next_frame_result needs the fallback flag with the empty frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if ((empty_frame != nullptr && same_ref(frame, *empty_frame)) || fallback)",
      "to": "    if ((empty_frame != nullptr && same_ref(frame, *empty_frame)) && fallback)"
    },
        {
      "note": "handle_next_frame_result falls back to the incoming frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      set_frame(find_auto_frame());\n  }\n  const Value facing_flag",
      "to": "      set_frame(frame_v);\n  }\n  const Value facing_flag"
    },
        {
      "note": "handle_next_frame_result skips the facing update",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    facing = handle_facing_flag(facing_flag);",
      "to": "    (void)facing_flag;"
    },
        {
      "note": "handle_next_frame_result waits without a frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(frame_v)) wait = handle_wait_flag(field_or(flags, u\"wait\"), frame_v);",
      "to": "  wait = handle_wait_flag(field_or(flags, u\"wait\"), frame_v);"
    },
        {
      "note": "handle_next_frame_result reads wait off the frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(frame_v)) wait = handle_wait_flag(field_or(flags, u\"wait\"), frame_v);",
      "to": "  if (truthy(frame_v)) wait = handle_wait_flag(field_or(frame_v, u\"wait\"), frame_v);"
    },
        {
      "note": "handle_next_frame_result plays any truthy sound",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (as_array(sound) != nullptr) play_sound(sound);",
      "to": "  if (truthy(sound)) play_sound(sound);"
    },
        {
      "note": "handle_next_frame_result drops the blink truthy gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(blink_time)) set_blinking(to_number(blink_time));",
      "to": "  set_blinking(to_number(blink_time));"
    },
        {
      "note": "handle_next_frame_result skips the transform request",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(field_or(flags, u\"transfrom_to_another\"))) transfrom_to_another(std::nullopt);",
      "to": "  if (truthy(field_or(flags, u\"transfrom_to_another\"))) (void)0;"
    },
        {
      "note": "handle_next_frame_result always reports entered",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return truthy(frame_v) ? EnterFrameResult::Entered : EnterFrameResult::Fallback;",
      "to": "  return EnterFrameResult::Entered;"
    },
        {
      "note": "handle_next_frame_result swaps the result mapping",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  return truthy(frame_v) ? EnterFrameResult::Entered : EnterFrameResult::Fallback;",
      "to": "  return truthy(frame_v) ? EnterFrameResult::Fallback : EnterFrameResult::Entered;"
    },
        {
      "note": "get_next_frame skips the truthy array entries",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (!truthy(nf)) continue;",
      "to": "      if (truthy(nf)) continue;"
    },
        {
      "note": "get_next_frame returns a judged-out entry",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      const Value f = get_next_frame(nf);\n      if (!nullish(f)) return f;",
      "to": "      const Value f = get_next_frame(nf);\n      return f;"
    },
        {
      "note": "get_next_frame picks from an empty list",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value next = (*world().lfw().mt()).pick_value(Value(std::make_shared<Array>(remains_arr)));",
      "to": "    const Value next = (*world().lfw().mt()).pick_value(Value(std::make_shared<Array>(Array{})));"
    },
        {
      "note": "get_next_frame judges a frame without a judge",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (has_next_frame_judge(which) && !truthy(next_frame_judge(which))) return Value();",
      "to": "  if (!truthy(next_frame_judge(which))) return Value();"
    },
        {
      "note": "get_next_frame keeps a judged-out frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (has_next_frame_judge(which) && !truthy(next_frame_judge(which))) return Value();",
      "to": "  if (has_next_frame_judge(which) && truthy(next_frame_judge(which))) return Value();"
    },
        {
      "note": "get_next_frame reads the id off the mp key",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value id_value = field_or(which, u\"id\");",
      "to": "  const Value id_value = field_or(which, u\"mp\");"
    },
        {
      "note": "get_next_frame drains while infinity_mp is on",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!truthy(world().dataset.get(u\"infinity_mp\")) && truthy(found_frame)) {",
      "to": "  if (truthy(world().dataset.get(u\"infinity_mp\")) && truthy(found_frame)) {"
    },
        {
      "note": "get_next_frame compares the next frame with the found one",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    if (same_ref(frame_next, which)) {",
      "to": "    if (same_ref(frame_next, found_frame)) {"
    },
        {
      "note": "get_next_frame uses <= for the mp gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (truthy(use_mp) && _mp < to_number(use_mp)) return get_next_frame(fallback_frame);",
      "to": "      if (truthy(use_mp) && _mp <= to_number(use_mp)) return get_next_frame(fallback_frame);"
    },
        {
      "note": "get_next_frame uses < for the hp gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (truthy(use_hp) && _hp <= to_number(use_hp)) return get_next_frame(fallback_frame);",
      "to": "      if (truthy(use_hp) && _hp < to_number(use_hp)) return get_next_frame(fallback_frame);"
    },
        {
      "note": "get_next_frame drops the hit.d default",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const Value fallback_frame =\n        or_nullish(hit_d, auto_frame != nullptr ? *auto_frame : Value());",
      "to": "    const Value fallback_frame = hit_d;"
    },
        {
      "note": "get_next_frame drops the mp_mode escape",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (truthy(use_mp) && _mp < to_number(use_mp) && !equals(mp_mode, Value(1.0)))\n        return Value();",
      "to": "      if (truthy(use_mp) && _mp < to_number(use_mp))\n        return Value();"
    },
        {
      "note": "get_next_frame uses 0 for the mp_mode escape",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (truthy(use_mp) && _mp < to_number(use_mp) && !equals(mp_mode, Value(1.0)))\n        return Value();",
      "to": "      if (truthy(use_mp) && _mp < to_number(use_mp) && !equals(mp_mode, Value(0.0)))\n        return Value();"
    },
        {
      "note": "get_next_frame returns the found frame for the hp gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "      if (truthy(use_hp) && _hp <= to_number(use_hp)) return Value();",
      "to": "      if (truthy(use_hp) && _hp <= to_number(use_hp)) return found_frame;"
    },
        {
      "note": "get_next_frame wraps every which",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (is_str(which)) {",
      "to": "  if (true) {"
    },
        {
      "note": "get_next_frame reports the found frame as which",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  result.set(u\"which\", w);",
      "to": "  result.set(u\"which\", found_frame);"
    },
        {
      "note": "get_next_frame reports which as the frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  result.set(u\"frame\", found_frame);",
      "to": "  result.set(u\"frame\", w);"
    },
        {
      "note": "follow_bearer inherits its own team",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_team(bearer_src->team());",
      "to": "  set_team(team());"
    },
        {
      "note": "follow_bearer drops the hp gate",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (_hp <= 0 && bearer_src != nullptr) {\n    drop_holding();\n    return;\n  }",
      "to": "  if (_hp < 0 && bearer_src != nullptr) {\n    drop_holding();\n    return;\n  }"
    },
        {
      "note": "follow_bearer reads its own wpoint as the bearer's",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value wp_a = field_or(bearer_src->frame, u\"wpoint\");",
      "to": "  const Value wp_a = field_or(frame, u\"wpoint\");"
    },
        {
      "note": "follow_bearer reads the bearer centers off its own frame",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double cx_a = to_number(field_or(bearer_src->frame, u\"centerx\"));",
      "to": "  const double cx_a = to_number(field_or(frame, u\"centerx\"));"
    },
        {
      "note": "follow_bearer tests the bearer kind against another kind",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (equals(field_or(wp_a, u\"kind\"), Value(static_cast<double>(WpointKind::Drop)))) {",
      "to": "  if (equals(field_or(wp_a, u\"kind\"), Value(static_cast<double>(WpointKind::Bearer)))) {"
    },
        {
      "note": "follow_bearer drops with a flat vy",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vy = 3;",
      "to": "    const double vy = 0;"
    },
        {
      "note": "follow_bearer drops with a positive vx range",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vx = mt.range(-10, 10) / 10;",
      "to": "    const double vx = mt.range(0, 10) / 10;"
    },
        {
      "note": "follow_bearer drops with a vx scale of 5",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vx = mt.range(-10, 10) / 10;",
      "to": "    const double vx = mt.range(-10, 10) / 5;"
    },
        {
      "note": "follow_bearer drops with a vz scale of 40",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vz = mt.range(-10, 10) / 20;",
      "to": "    const double vz = mt.range(-10, 10) / 40;"
    },
        {
      "note": "follow_bearer drops with the axes swapped",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_velocity(Value(vx), Value(vy), Value(vz));\n    return;",
      "to": "    set_velocity(Value(vz), Value(vy), Value(vx));\n    return;"
    },
        {
      "note": "follow_bearer matches the weaponact either way",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!strict_equals(weaponact, field_or(frame, u\"id\"))) {",
      "to": "  if (strict_equals(weaponact, field_or(frame, u\"id\"))) {"
    },
        {
      "note": "follow_bearer restores the wpoint without the fallback flag",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    enter_frame_by_id(weaponact, true);",
      "to": "    enter_frame_by_id(weaponact, false);"
    },
        {
      "note": "follow_bearer drops the weaponact restore",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!strict_equals(weaponact, field_or(frame, u\"id\"))) {\n    // fallback=true 用于 还原wpoint丢失的情况\n    enter_frame_by_id(weaponact, true);\n  }",
      "to": "  if (!strict_equals(weaponact, field_or(frame, u\"id\"))) {\n    // fallback=true 用于 还原wpoint丢失的情况\n  }"
    },
        {
      "note": "follow_bearer keeps the bearer facing",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  facing = bearer_src->facing;",
      "to": "  (void)bearer_src;"
    },
        {
      "note": "follow_bearer reads the bearer x as its own",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double x = bearer_src->position.x;",
      "to": "  const double x = position.x;"
    },
        {
      "note": "follow_bearer reads the bearer z as its own",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double z = bearer_src->position.z;",
      "to": "  const double z = position.z;"
    },
        {
      "note": "follow_bearer skips the inter-frame centers",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_position(Value(x + facing * (wa_x - cx_a + cx_b - wb_x)),\n                 Value(y + cy_a - wa_y - cy_b + wb_y), Value(z + wa_z - wb_z));",
      "to": "    set_position(Value(x + facing * (wa_x - cx_a)),\n                 Value(y + cy_a - wa_y), Value(z + wa_z));"
    },
        {
      "note": "follow_bearer takes the inter-frame branch for a kind-less wpoint",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(field_or(wp_a, u\"kind\"))) {",
      "to": "  if (false) {"
    },
        {
      "note": "follow_bearer takes the lost-wpoint branch for a kind-ed wpoint",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (truthy(field_or(wp_a, u\"kind\"))) {",
      "to": "  if (true) {"
    },
        {
      "note": "follow_bearer triggers the throw on dvx alone",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!std::holds_alternative<std::monostate>(dvx) ||\n      !std::holds_alternative<std::monostate>(dvy) ||\n      !std::holds_alternative<std::monostate>(dvz)) {",
      "to": "  if (!std::holds_alternative<std::monostate>(dvx)) {"
    },
        {
      "note": "follow_bearer leaves the bearer holding the weapon",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    bearer_src->holding = nullptr;\n    bearer = nullptr;",
      "to": "    bearer = nullptr;"
    },
        {
      "note": "follow_bearer keeps the bearer link",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    bearer_src->holding = nullptr;\n    bearer = nullptr;",
      "to": "    bearer_src->holding = nullptr;"
    },
        {
      "note": "follow_bearer keeps dropping armed",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    dropping = false;",
      "to": "    dropping = true;"
    },
        {
      "note": "follow_bearer uses the wvy_f factor for vx",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double fvx = truthy(dvx) ? to_number(dvx) * to_number(dataset(u\"wvx_f\")) : 0;",
      "to": "    const double fvx = truthy(dvx) ? to_number(dvx) * to_number(dataset(u\"wvy_f\")) : 0;"
    },
        {
      "note": "follow_bearer uses the wvz_f factor for vy",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double fvy = truthy(dvy) ? to_number(dvy) * to_number(dataset(u\"wvy_f\")) : 0;",
      "to": "    const double fvy = truthy(dvy) ? to_number(dvy) * to_number(dataset(u\"wvz_f\")) : 0;"
    },
        {
      "note": "follow_bearer uses the wvx_f factor for vz",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double fvz = truthy(dvz) ? to_number(dvz) * to_number(dataset(u\"wvz_f\")) : 0;",
      "to": "    const double fvz = truthy(dvz) ? to_number(dvz) * to_number(dataset(u\"wvx_f\")) : 0;"
    },
        {
      "note": "follow_bearer skips the dvx factor",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double fvx = truthy(dvx) ? to_number(dvx) * to_number(dataset(u\"wvx_f\")) : 0;",
      "to": "    const double fvx = truthy(dvx) ? to_number(dvx) : 0;"
    },
        {
      "note": "follow_bearer skips the rounded throw position",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    prev_position = position;\n    set_position(Value(round(x + facing * (wa_x - cx_a))),\n                 Value(round(y + cy_a - wa_y)), Value(round(z + wa_z)));",
      "to": "    prev_position = position;"
    },
        {
      "note": "follow_bearer ignores the bearer's controller direction",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vz = bearer_src->ctrl() != nullptr\n                          ? static_cast<double>(bearer_src->ctrl()->UD()) * fvz\n                          : 0;",
      "to": "    const double vz = fvz;"
    },
        {
      "note": "follow_bearer divides dz by the weight and skips dz",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double dvy_w = fvy / weight;\n    const double vx = (dvx_w - abs(vz / 2)) * facing;",
      "to": "    const double dvy_w = fvy / weight;\n    const double vx = (dvx_w - abs(vz)) * facing;"
    },
        {
      "note": "follow_bearer multiplies the weight back in",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double dvx_w = fvx / weight;\n    const double dvy_w = fvy / weight;",
      "to": "    const double dvx_w = fvx * weight;\n    const double dvy_w = fvy * weight;"
    },
        {
      "note": "follow_bearer adds the vz half instead of subtracting it",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vx = (dvx_w - abs(vz / 2)) * facing;",
      "to": "    const double vx = (dvx_w + abs(vz / 2)) * facing;"
    },
        {
      "note": "follow_bearer skips the align frame request",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_velocity(Value(vx), Value(dvy_w), Value(vz));\n    enter_frame(nf);\n    return;",
      "to": "    set_velocity(Value(vx), Value(dvy_w), Value(vz));\n    return;"
    },
        {
      "note": "follow_bearer throws at the bearer's velocity",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_velocity(Value(vx), Value(dvy_w), Value(vz));",
      "to": "    set_velocity(Value(vx), Value(fvy), Value(vz));"
    },
        {
      "note": "follow_catcher keeps going without a cpoint",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value ac = field_or(a->frame, u\"cpoint\");\n  if (!truthy(ac)) return;",
      "to": "  const Value ac = field_or(a->frame, u\"cpoint\");"
    },
        {
      "note": "follow_catcher reads throwvx off throwvy",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double tx = num_of(field_or(ac, u\"throwvx\"));",
      "to": "  const double tx = num_of(field_or(ac, u\"throwvy\"));"
    },
        {
      "note": "follow_catcher reads throwvz off throwvx",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double tz = num_of(field_or(ac, u\"throwvz\"));",
      "to": "  const double tz = num_of(field_or(ac, u\"throwvx\"));"
    },
        {
      "note": "follow_catcher uses the tvy_f factor for throwvx",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vx = tx * to_number(dataset(u\"tvx_f\")) * a_face;",
      "to": "    const double vx = tx * to_number(dataset(u\"tvy_f\")) * a_face;"
    },
        {
      "note": "follow_catcher ignores the catcher's controller direction",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    const double vz = tz * to_number(dataset(u\"tvz_f\")) *\n                      static_cast<double>(a->ctrl() != nullptr ? a->ctrl()->UD() : 0);",
      "to": "    const double vz = tz * to_number(dataset(u\"tvz_f\"));"
    },
        {
      "note": "follow_catcher drops the throw position offset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    set_position(Value((2 * vx) + ax - a_face * (afx - acx)),\n                 Value((2 * vy) + ay + afy - acy), Value((2 * vz) + az + acz));",
      "to": "    set_position(Value(ax - a_face * (afx - acx)),\n                 Value(ay + afy - acy), Value(az + acz));"
    },
        {
      "note": "follow_catcher drops the held x offset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  set_position(Value(ax - a_face * (afx - acx) + b_face * (bfx - bcx)),",
      "to": "  set_position(Value(ax - a_face * (afx - acx)),"
    },
        {
      "note": "follow_catcher drops the held y offset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "               Value(ay + afy - acy + bcy - bfy), Value(az + acz - bcz));",
      "to": "               Value(ay + afy - acy), Value(az + acz - bcz));"
    },
        {
      "note": "drop_holding leaves the bearer pointer behind",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  held->bearer = nullptr;\n  holding = nullptr;",
      "to": "  holding = nullptr;"
    },
        {
      "note": "drop_holding leaves the weapon held",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Entity* held = holding;\n  held->bearer = nullptr;\n  holding = nullptr;",
      "to": "  Entity* held = holding;\n  held->bearer = nullptr;"
    },
        {
      "note": "drop_holding arms the wrong dropping flag",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  held->dropping = true;",
      "to": "  held->dropping = false;"
    },
        {
      "note": "drop_holding reads in_the_skys off on_hands",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Value in_the_skys = field_or(field_or(held->data(), u\"indexes\"), u\"in_the_skys\");",
      "to": "  const Value in_the_skys = field_or(field_or(held->data(), u\"indexes\"), u\"on_hands\");"
    },
        {
      "note": "drop_holding skips the align frame request",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  held->enter_frame(nf);",
      "to": "  (void)nf;"
    },
        {
      "note": "drop_holding skips the position refresh",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  held->enter_frame(nf);\n  held->set_position(Value(held->position.x), Value(held->position.y),\n                     Value(held->position.z));",
      "to": "  held->enter_frame(nf);"
    },
        {
      "note": "drop_holding keeps the weapon team",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  held->set_team(team());",
      "to": "  held->set_team(held->team());"
    },
        {
      "note": "drop_holding skips the vrest clones",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  for (const auto& kv : vrests) {\n    collision::Collision clone = kv.second;\n    held->add_v_rest(clone);\n  }",
      "to": "  (void)held;"
    },
        {
      "note": "drop_holding clones its own vrests onto itself",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    held->add_v_rest(clone);",
      "to": "    add_v_rest(clone);"
    },
        {
      "note": "pick accepts an already-borne weapon",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (weapon.bearer != nullptr) return;",
      "to": "  if (weapon.bearer == nullptr) return;"
    },
        {
      "note": "pick accepts a second weapon",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (holding != nullptr) return;",
      "to": "  if (holding == nullptr) return;"
    },
        {
      "note": "pick leaves the weapon dropping",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  weapon.dropping = false;",
      "to": "  weapon.dropping = true;"
    },
        {
      "note": "pick skips the initial follow",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  weapon.follow_bearer();",
      "to": "  (void)weapon;"
    },
        {
      "note": "pick counts the team summary twice",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  s->set_picking_sum(Value(to_number(s->picking_sum()) + 1));",
      "to": "  s->set_picking_sum(Value(to_number(s->picking_sum()) + 2));"
    },
        {
      "note": "pick counts a team summary for an independent team",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!defines::is_independent(team())) {",
      "to": "  if (defines::is_independent(team())) {"
    },
        {
      "note": "pick counts the team summary on the entity id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    std::shared_ptr<Summary> t = summary_mgr().get(team());",
      "to": "    std::shared_ptr<Summary> t = summary_mgr().get(id);"
    },
        {
      "note": "transform rebuilds the controller for a human",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (ctrl_ == nullptr || !ctrl_->is_human()) {",
      "to": "  if (ctrl_ == nullptr || ctrl_->is_human()) {"
    },
        {
      "note": "transform reads the data id off the name",
      "file": "native/lfw/entity/entity.cpp",
      "from": "world().lfw().create_ctrl(to_string(field_or(data, u\"id\")),",
      "to": "world().lfw().create_ctrl(to_string(field_or(data, u\"name\")),"
    },
        {
      "note": "transform keeps the old controller",
      "file": "native/lfw/entity/entity.cpp",
      "from": "    controller::BaseController* c = world().lfw().create_ctrl(to_string(field_or(data, u\"id\")), ctrl_ != nullptr ? ctrl_->player_id : std::u16string());\n    set_ctrl(c);",
      "to": "    controller::BaseController* c = world().lfw().create_ctrl(to_string(field_or(data, u\"id\")), ctrl_ != nullptr ? ctrl_->player_id : std::u16string());\n    (void)c;"
    },
        {
      "note": "transform keeps the previous data",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _data = data;\n  reset_armor();",
      "to": "  _data = prev;\n  reset_armor();"
    },
        {
      "note": "transform skips the armor reset",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  reset_armor();\n  callbacks.call(u\"on_data_changed\", {_data, prev, ref()});",
      "to": "  callbacks.call(u\"on_data_changed\", {_data, prev, ref()});"
    },
        {
      "note": "transfrom_to_another drops the modulo step",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const double next_idx_f = std::fmod(curr_idx + 1, static_cast<double>(len));",
      "to": "  const double next_idx_f = curr_idx + 1;"
    },
        {
      "note": "transfrom_to_another requests another frame id",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (next_idx == 0) enter_frame_by_id(Value(std::u16string(u\"245\")), true);",
      "to": "  if (next_idx == 0) enter_frame_by_id(Value(std::u16string(u\"246\")), true);"
    },
        {
      "note": "the view's set_position bypasses the restrict chain",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  const Vector3 r = world().restrict(*this);",
      "to": "  const Vector3 r = position;"
    },
        {
      "note": "the view's assign_position writes a single axis",
      "file": "native/lfw/entity/entity.h",
      "from": "  void assign_position(double x, double y, double z) {\n    position.x = x;\n    position.y = y;\n    position.z = z;\n  }",
      "to": "  void assign_position(double x, double y, double z) {\n    position.x = x;\n  }"
    },
        {
      "note": "the view's set_frame drops the frame swap",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  _prev_frame = frame;\n  _landing_frame = Value(NullTag{});\n  frame = v;",
      "to": "  _prev_frame = frame;\n  _landing_frame = Value(NullTag{});"
    },
        {
      "note": "the view's enter_frame_by_id never enters",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  Object* nf = as_object(_next_frame_by_id);\n  if (nf != nullptr) nf->set(u\"id\", use_id);\n  return enter_frame(_next_frame_by_id, fallback);",
      "to": "  Object* nf = as_object(_next_frame_by_id);\n  if (nf != nullptr) nf->set(u\"id\", use_id);\n  return EnterFrameResult::NotFound;"
    },
        {
      "note": "the view's set_velocity drops the write",
      "file": "native/lfw/entity/entity.cpp",
      "from": "  if (!nullish(x)) prev_velocity.x = velocity.x = round_float(to_number(x));\n  if (!nullish(y)) prev_velocity.y = velocity.y = round_float(to_number(y));\n  if (!nullish(z)) prev_velocity.z = velocity.z = round_float(to_number(z));",
      "to": "  (void)x;\n  (void)y;\n  (void)z;"
    },
        {
      "note": "on_restrict drops the z clamp for a restricted y",
      "file": "native/lfw/state/state_base.cpp",
      "from": "    vx = nan_to_null(clamp_velocity(e.velocity_x()));\n    vz = nan_to_null(clamp_velocity(e.velocity_z()));",
      "to": "    vx = nan_to_null(clamp_velocity(e.velocity_x()));"
    },
        {
      "note": "on_restrict only writes when all three are restricted",
      "file": "native/lfw/state/state_base.cpp",
      "from": "  if (!is_null(vx) || !is_null(vz) || !is_null(vy)) e.set_velocity(vx, vy, vz);",
      "to": "  if (!is_null(vx) && !is_null(vz) && !is_null(vy)) e.set_velocity(vx, vy, vz);"
    },
        {
      "note": "on_restrict keeps the unrestricted position",
      "file": "native/lfw/state/state_base.cpp",
      "from": "  e.assign_position(x, y, z);",
      "to": "  e.assign_position(px, py, pz);"
    },
        {
      "note": "on_restrict writes the y back as the z",
      "file": "native/lfw/state/state_base.cpp",
      "from": "  e.assign_position(x, y, z);",
      "to": "  e.assign_position(x, z, z);"
    },
        {
      "note": "States::fallback keys the entry with a dash",
      "file": "native/lfw/state/states.cpp",
      "from": "  const std::u16string state_key = to_string(type) + u\"_\" + to_string(code);",
      "to": "  const std::u16string state_key = to_string(type) + u\"-\" + to_string(code);"
    },
        {
      "note": "States::fallback swaps the key halves",
      "file": "native/lfw/state/states.cpp",
      "from": "  const std::u16string state_key = to_string(type) + u\"_\" + to_string(code);",
      "to": "  const std::u16string state_key = to_string(code) + u\"_\" + to_string(type);"
    },
        {
      "note": "States::fallback never reuses an entry",
      "file": "native/lfw/state/states.cpp",
      "from": "  if (State_Base* hit = get(key)) return *hit;",
      "to": "  if (State_Base* hit = get(key)) (void)hit;"
    },
        {
      "note": "States::fallback treats a weapon type as a fighter",
      "file": "native/lfw/state/states.cpp",
      "from": "  if (strict_equals(type, Value(static_cast<double>(EntityEnum::Weapon)))) {\n    return make<WeaponState_Base>(key, code);",
      "to": "  if (strict_equals(type, Value(static_cast<double>(EntityEnum::Weapon)))) {\n    return make<CharacterState_Base>(key, code);"
    },
        {
      "note": "States::fallback treats a fighter type as a weapon",
      "file": "native/lfw/state/states.cpp",
      "from": "  if (strict_equals(type, Value(static_cast<double>(EntityEnum::Fighter)))) {\n    return make<CharacterState_Base>(key, code);",
      "to": "  if (strict_equals(type, Value(static_cast<double>(EntityEnum::Fighter)))) {\n    return make<WeaponState_Base>(key, code);"
    },
        {
      "note": "pick_value wraps a non-array input",
      "file": "native/lfw/utils/math/mersenne_twister.cpp",
      "from": "  const Array* arr = as_array(a);\n  if (arr == nullptr) return a;",
      "to": "  const Array* arr = as_array(a);\n  if (arr == nullptr) return Value();"
    },
    {
      note: "follow_bearer：投掷分支的 mark 写成 dh_vx",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).mark = u\"dh_v\";`,
      to: `    (*world().lfw().mt()).mark = u\"dh_vx\";`,
    },
    {
      note: "follow_bearer：不写 dh_v",
      file: "native/lfw/entity/entity.cpp",
      from: `    bearer_src->drop_holding();\n    (*world().lfw().mt()).mark = u\"dh_v\";\n    const double vy = 3;`,
      to: `    bearer_src->drop_holding();\n    (void)0;\n    const double vy = 3;`,
    },
    {
      note: "follow_bearer：dh_v 写在两次抽取之后",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).mark = u\"dh_v\";\n    const double vy = 3;\n    MersenneTwister& mt = (*world().lfw().mt());\n    const double vx = mt.range(-10, 10) / 10;`,
      to: `    const double vy = 3;\n    MersenneTwister& mt = (*world().lfw().mt());\n    const double vx = mt.range(-10, 10) / 10;\n    (*world().lfw().mt()).mark = u\"dh_v\";`,
    },
    {
      note: "get_next_frame：数组分支的 mark 写成 gnf_0x",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).mark = u\"gnf_0\";`,
      to: `    (*world().lfw().mt()).mark = u\"gnf_0x\";`,
    },
    {
      note: "get_next_frame：数组分支与 id 分支的 mark 写反",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).mark = u\"gnf_0\";`,
      to: `    (*world().lfw().mt()).mark = u\"gnf_1\";`,
    },
    {
      note: "get_next_frame：数组分支不写 mark",
      file: "native/lfw/entity/entity.cpp",
      from: `    Array remains_arr(remains);\n    (*world().lfw().mt()).mark = u\"gnf_0\";\n    const Value next`,
      to: `    Array remains_arr(remains);\n    (void)0;\n    const Value next`,
    },
    {
      note: "get_next_frame：id 分支的 mark 写成 gnf_1x",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).mark = u\"gnf_1\";`,
      to: `    (*world().lfw().mt()).mark = u\"gnf_1x\";`,
    },
    {
      note: "get_next_frame：id 分支不写 mark",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).mark = u\"gnf_1\";\n    found_frame`,
      to: `    (void)0;\n    found_frame`,
    },
    {
      note: "get_next_frame：id 分支的 mark 写在 pick 之后",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).mark = u\"gnf_1\";\n    found_frame = find_frame_by_id((*world().lfw().mt()).pick_value(id_value));`,
      to: `    found_frame = find_frame_by_id((*world().lfw().mt()).pick_value(id_value));\n    (*world().lfw().mt()).mark = u\"gnf_1\";`,
    },

    {
      note: "spawn(opoint)：单参重载丢掉 offset",
      file: "native/lfw/entity/entity.cpp",
      from: `  return spawn(opoint, Vector3{}, facing);`,
      to: `  return spawn(opoint, Vector3{1, 0, 0}, facing);`,
    },
    {
      note: "spawn：unimportant 门整条去掉",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(field_or(opoint, u"unimportant")) && world().entity_count() > 355) return nullptr;`,
      to: `  if (false) return nullptr;`,
    },
    {
      note: "spawn：实体数门限写成 >= 355",
      file: "native/lfw/entity/entity.cpp",
      from: `world().entity_count() > 355) return nullptr;`,
      to: `world().entity_count() >= 355) return nullptr;`,
    },
    {
      note: "spawn：unimportant 判定取反",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(field_or(opoint, u"unimportant")) && world().entity_count() > 355) return nullptr;`,
      to: `  if (!truthy(field_or(opoint, u"unimportant")) && world().entity_count() > 355) return nullptr;`,
    },
    {
      note: "spawn：mark 写成 se_x",
      file: "native/lfw/entity/entity.cpp",
      from: `  (*world().lfw().mt()).mark = u"se_1";`,
      to: `  (*world().lfw().mt()).mark = u"se_x";`,
    },
    {
      note: "spawn：oid 不做 pick，直接用数组",
      file: "native/lfw/entity/entity.cpp",
      from: `  const Value oid = (*world().lfw().mt()).pick_value(field_or(opoint, u"oid"));`,
      to: `  const Value oid = field_or(opoint, u"oid");`,
    },
    {
      note: "spawn：不调用 attach",
      file: "native/lfw/entity/entity.cpp",
      from: `  entity->on_spawn(*this, opoint, offset_velocity, facing_value).attach(field_or(opoint, u"ghost"));`,
      to: `  entity->on_spawn(*this, opoint, offset_velocity, facing_value);`,
    },
    {
      note: "spawn：ghost 参数恒为真",
      file: "native/lfw/entity/entity.cpp",
      from: `  entity->on_spawn(*this, opoint, offset_velocity, facing_value).attach(field_or(opoint, u"ghost"));`,
      to: `  entity->on_spawn(*this, opoint, offset_velocity, facing_value).attach(Value(true));`,
    },
    {
      note: "spawn：同 id 也不进 copies",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (strict_equals(field_or(entity->data(), u"id"), field_or(_data, u"id"))) {`,
      to: `  if (false) {`,
    },
    {
      note: "spawn：copies 记自己而不是新实体",
      file: "native/lfw/entity/entity.cpp",
      from: `    add_copy(entity->id);`,
      to: `    add_copy(id);`,
    },
    {
      note: "on_spawn：不合并发射者已有的 emitters",
      file: "native/lfw/entity/entity.cpp",
      from: `    emitters.insert(emitters.end(), emitter.emitters.begin(), emitter.emitters.end());`,
      to: `    (void)0;`,
    },
    {
      note: "on_spawn：emitters 里写常量",
      file: "native/lfw/entity/entity.cpp",
      from: `    emitters.push_back(emitter.id);`,
      to: `    emitters.push_back(u"x");`,
    },
    {
      note: "on_spawn：team 不跟发射者",
      file: "native/lfw/entity/entity.cpp",
      from: `    emitters.push_back(emitter.id);
    set_team(emitter.team());`,
      to: `    emitters.push_back(emitter.id);
    set_team(u"9");`,
    },
    {
      note: "on_spawn：朝向不跟发射者（普通分支）",
      file: "native/lfw/entity/entity.cpp",
      from: `    emitters.push_back(emitter.id);
    set_team(emitter.team());
    facing = emitter.facing;`,
      to: `    emitters.push_back(emitter.id);
    set_team(emitter.team());
    facing = 1;`,
    },
    {
      note: "on_spawn：Ball_Rebounding 分支用发射者而不是 attacker",
      file: "native/lfw/entity/entity.cpp",
      from: `      attacker_id = emitter.lastest_collided->attacker.id;`,
      to: `      attacker_id = emitter.id;`,
    },
    {
      note: "on_spawn：Ball_Rebounding 分支的 team 用发射者",
      file: "native/lfw/entity/entity.cpp",
      from: `      attacker_team = emitter.lastest_collided->attacker.team;`,
      to: `      attacker_team = Value(emitter.team());`,
    },
    {
      note: "on_spawn：Ball_Rebounding 分支不看 lastest_collided",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (emitter.lastest_collided.has_value()) {`,
      to: `    if (false) {`,
    },
    {
      note: "on_spawn：Ball_Rebounding 分支不清空 emitters",
      file: "native/lfw/entity/entity.cpp",
      from: `    emitters.clear();
    emitters.push_back(attacker_id);`,
      to: `    emitters.push_back(u"z");
    emitters.push_back(attacker_id);`,
    },
    {
      note: "on_spawn：opoint_y 的 ?? 回落到 1",
      file: "native/lfw/entity/entity.cpp",
      from: `                                            Value(0.0)));
  const double opoint_x`,
      to: `                                            Value(1.0)));
  const double opoint_x`,
    },
    {
      note: "on_spawn：opoint_z 的 ?? 回落到 0",
      file: "native/lfw/entity/entity.cpp",
      from: `      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_z", field_or(opoint, u"z")), Value(2.0)));`,
      to: `      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_z", field_or(opoint, u"z")), Value(0.0)));`,
    },
    {
      note: "on_spawn：x 不看 opoint.x，只走生成器",
      file: "native/lfw/entity/entity.cpp",
      from: `  const double opoint_x = num_of(or_nullish(emitter.gen_or(opoint, u"__gen_x", field_or(opoint, u"x")),
                                            Value(0.0)));`,
      to: `  const double opoint_x = num_of(or_nullish(emitter.gen_or(opoint, u"__gen_x", Value(0.0)), Value(0.0)));`,
    },
    {
      note: "on_spawn：pos_type 比较的是 2",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(field_or(opoint, u"pos_type"), Value(1.0))) {`,
      to: `  if (equals(field_or(opoint, u"pos_type"), Value(2.0))) {`,
    },
    {
      note: "on_spawn：pos_type=1 分支的 y 加号",
      file: "native/lfw/entity/entity.cpp",
      from: `    pos_y = pos_y - opoint_y;
    pos_x = pos_x + emitter.facing * opoint_x;`,
      to: `    pos_y = pos_y + opoint_y;
    pos_x = pos_x + emitter.facing * opoint_x;`,
    },
    {
      note: "on_spawn：pos_type=1 分支的 x 减号",
      file: "native/lfw/entity/entity.cpp",
      from: `    pos_x = pos_x + emitter.facing * opoint_x;`,
      to: `    pos_x = pos_x - emitter.facing * opoint_x;`,
    },
    {
      note: "on_spawn：else 分支读错 centerx/centery",
      file: "native/lfw/entity/entity.cpp",
      from: `    pos_y = pos_y + to_number(field_or(emitter_frame, u"centery")) - opoint_y;`,
      to: `    pos_y = pos_y + to_number(field_or(emitter_frame, u"centerx")) - opoint_y;`,
    },
    {
      note: "on_spawn：else 分支的中心偏移符号",
      file: "native/lfw/entity/entity.cpp",
      from: `    pos_x = pos_x - emitter.facing * (to_number(field_or(emitter_frame, u"centerx")) - opoint_x);`,
      to: `    pos_x = pos_x - emitter.facing * (to_number(field_or(emitter_frame, u"centerx")) + opoint_x);`,
    },
    {
      note: "on_spawn：prev_position 不清成发射者位置",
      file: "native/lfw/entity/entity.cpp",
      from: `  prev_position = emitter.position;`,
      to: `  prev_position = Vector3{};`,
    },
    {
      note: "on_spawn：z 用 pos_z - opoint_z",
      file: "native/lfw/entity/entity.cpp",
      from: `  set_position(Value(pos_x), Value(pos_y), Value(pos_z + opoint_z));`,
      to: `  set_position(Value(pos_x), Value(pos_y), Value(pos_z - opoint_z));`,
    },
    {
      note: "on_spawn：__gen_facing 的回落不走 which.facing",
      file: "native/lfw/entity/entity.cpp",
      from: `      emitter.gen_or(which, u"__gen_facing", field_or(which, u"facing"));`,
      to: `      emitter.gen_or(which, u"__gen_facing", Value(1.0));`,
    },
    {
      note: "on_spawn：result 与 auto 帧的分支写反",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(result)) {
    enter_frame(which);
  } else {
    enter_frame(auto_frame_value());
  }`,
      to: `  if (truthy(result)) {
    enter_frame(auto_frame_value());
  } else {
    enter_frame(which);
  }`,
    },
    {
      note: "on_spawn：speedz 直接置 0",
      file: "native/lfw/entity/entity.cpp",
      from: `      has_speedz ? speedz_explicit : (z_launch ? defines::num(u"Defines.DEFAULT_OPOINT_SPEED_Z") : 0.0);`,
      to: `      0.0;`,
    },
    {
      note: "on_spawn：__gen_dvx 被忽略",
      file: "native/lfw/entity/entity.cpp",
      from: `      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_dvx", field_or(opoint, u"dvx")), Value(0.0)));`,
      to: `      num_of(or_nullish(field_or(opoint, u"dvx"), Value(0.0)));`,
    },
    {
      note: "on_spawn：__gen_dvz 的回落值为 1",
      file: "native/lfw/entity/entity.cpp",
      from: `      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_dvz", field_or(opoint, u"dvz")), Value(0.0)));`,
      to: `      num_of(or_nullish(emitter.gen_or(opoint, u"__gen_dvz", field_or(opoint, u"dvz")), Value(1.0)));`,
    },
    {
      note: "on_spawn：dvy 不除以 weight",
      file: "native/lfw/entity/entity.cpp",
      from: `  o_dvy = o_dvy / weight;`,
      to: `  o_dvy = o_dvy;`,
    },
    {
      note: "on_spawn：ud 恒为 1",
      file: "native/lfw/entity/entity.cpp",
      from: `      entity::is_fighter_data(emitter.data()) && ctrl != nullptr ? static_cast<double>(ctrl->UD())
                                                                : 0.0;`,
      to: `      entity::is_fighter_data(emitter.data()) && ctrl != nullptr ? 1.0 : 0.0;`,
    },
    {
      note: "on_spawn：o_dvx>0 分支的 abs 符号",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (o_dvx > 0) o_dvx = o_dvx / weight - std::abs(offset_velocity.z / 2);`,
      to: `  if (o_dvx > 0) o_dvx = o_dvx / weight + std::abs(offset_velocity.z / 2);`,
    },
    {
      note: "on_spawn：o_dvx<=0 分支的 abs 符号",
      file: "native/lfw/entity/entity.cpp",
      from: `  else o_dvx = o_dvx / weight + std::abs(offset_velocity.z / 2);`,
      to: `  else o_dvx = o_dvx / weight - std::abs(offset_velocity.z / 2);`,
    },
    {
      note: "on_spawn：z_disabled 恒为假",
      file: "native/lfw/entity/entity.cpp",
      from: `  const bool z_disabled = equals(result_state, Value(static_cast<double>(StateEnum::Normal))) ||
                          equals(result_state, Value(static_cast<double>(StateEnum::Burning)));`,
      to: `  const bool z_disabled = false;`,
    },
    {
      note: "on_spawn：z_disabled 只看 Normal",
      file: "native/lfw/entity/entity.cpp",
      from: `  const bool z_disabled = equals(result_state, Value(static_cast<double>(StateEnum::Normal))) ||
                          equals(result_state, Value(static_cast<double>(StateEnum::Burning)));`,
      to: `  const bool z_disabled = equals(result_state, Value(static_cast<double>(StateEnum::Normal)));`,
    },
    {
      note: "on_spawn：result_state 读错来源",
      file: "native/lfw/entity/entity.cpp",
      from: `  const Value result_state = field_or(field_or(result, u"frame"), u"state");`,
      to: `  const Value result_state = field_or(which, u"state");`,
    },
    {
      note: "on_spawn：max_hp 不做 is_num 守卫",
      file: "native/lfw/entity/entity.cpp",
      from: `  const Value max_hp = field_or(opoint, u"max_hp");
  if (is_num(max_hp)) {`,
      to: `  const Value max_hp = field_or(opoint, u"max_hp");
  if (truthy(max_hp)) {`,
    },
    {
      note: "on_spawn：max_hp 不动 hp_r",
      file: "native/lfw/entity/entity.cpp",
      from: `    const double v = to_number(max_hp);
    set_hp_max(v);
    set_hp_r(v);
    set_hp(v);`,
      to: `    const double v = to_number(max_hp);
    set_hp_max(v);
    set_hp(v);`,
    },
    {
      note: "on_spawn：hp 不动 hp_r",
      file: "native/lfw/entity/entity.cpp",
      from: `    const double v = to_number(hp_field);
    set_hp_r(v);
    set_hp(v);`,
      to: `    const double v = to_number(hp_field);
    set_hp(v);`,
    },
    {
      note: "on_spawn：max_mp 不动 mp",
      file: "native/lfw/entity/entity.cpp",
      from: `    const double v = to_number(max_mp);
    set_mp_max(v);
    set_mp(v);`,
      to: `    const double v = to_number(max_mp);
    set_mp_max(v);`,
    },
    {
      note: "on_spawn：mp 写进 mp_max",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (is_num(mp_field)) set_mp(to_number(mp_field));`,
      to: `  if (is_num(mp_field)) set_mp_max(to_number(mp_field));`,
    },
    {
      note: "on_spawn：Fixed 模式不覆盖 vx",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(vxm, Value(static_cast<double>(SpeedMode::Fixed)))) vx = dvx_now;`,
      to: `  (void)vxm;`,
    },
    {
      note: "on_spawn：Fixed 模式不覆盖 vy",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(vym, Value(static_cast<double>(SpeedMode::Fixed)))) vy = dvy_now;`,
      to: `  (void)vym;`,
    },
    {
      note: "on_spawn：Fixed 模式不覆盖 vz",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(vzm, Value(static_cast<double>(SpeedMode::Fixed)))) vz = dvz_now;`,
      to: `  (void)vzm;`,
    },
    {
      note: "on_spawn：Extra 模式的 acc_x 取负",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(vxm, Value(static_cast<double>(SpeedMode::Extra))) && acc_x != 0) vx += acc_x;`,
      to: `  if (equals(vxm, Value(static_cast<double>(SpeedMode::Extra))) && acc_x != 0) vx -= acc_x;`,
    },
    {
      note: "on_spawn：Extra 模式的 acc_y 取负",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(vym, Value(static_cast<double>(SpeedMode::Extra))) && acc_y != 0) vy += acc_y;`,
      to: `  if (equals(vym, Value(static_cast<double>(SpeedMode::Extra))) && acc_y != 0) vy -= acc_y;`,
    },
    {
      note: "on_spawn：Extra 模式的 acc_z 取负",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(vzm, Value(static_cast<double>(SpeedMode::Extra))) && acc_z != 0) vz += acc_z;`,
      to: `  if (equals(vzm, Value(static_cast<double>(SpeedMode::Extra))) && acc_z != 0) vz -= acc_z;`,
    },
    {
      note: "on_spawn：Pick 判定用 kind=0",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(field_or(opoint, u"kind"), Value(static_cast<double>(OpointKind::Pick)))) {`,
      to: `  if (equals(field_or(opoint, u"kind"), Value(0.0))) {`,
    },
    {
      note: "on_spawn：Pick 不放下持有物",
      file: "native/lfw/entity/entity.cpp",
      from: `    emitter.drop_holding();
    bearer = &emitter;`,
      to: `    bearer = &emitter;`,
    },
    {
      note: "on_spawn：Pick 不设 bearer",
      file: "native/lfw/entity/entity.cpp",
      from: `    bearer = &emitter;`,
      to: `    bearer = nullptr;`,
    },
    {
      note: "on_spawn：motionless 的默认值写成 0",
      file: "native/lfw/entity/entity.cpp",
      from: `  motionless = to_number(or_nullish(field_or(opoint, u"motionless"), Value(2.0)));`,
      to: `  motionless = to_number(or_nullish(field_or(opoint, u"motionless"), Value(0.0)));`,
    },
    {
      note: "attach：mounted 守卫去掉",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(Value(_mounted))) return *this;`,
      to: `  if (false) return *this;`,
    },
    {
      note: "attach：spawn_time 不取 game_time",
      file: "native/lfw/entity/entity.cpp",
      from: `  _spawn_time = world().game_time();`,
      to: `  _spawn_time = 0;`,
    },
    {
      note: "attach：ghost 标记取反",
      file: "native/lfw/entity/entity.cpp",
      from: `  _ghosted = truthy(ghost) ? 1 : 0;`,
      to: `  _ghosted = truthy(ghost) ? 0 : 1;`,
    },
    {
      note: "attach：ghost 时不重置 motionless/shaking",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(Value(_ghosted))) {
    motionless = 0;
    shaking = 0;
  }`,
      to: `  if (false) {
    motionless = 0;
    shaking = 0;
  }`,
    },
    {
      note: "attach：落地判定的两支写反",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (position.y > ground_y()) {
    leave_ground();
  } else {
    is_on_ground = true;
  }`,
      to: `  if (position.y > ground_y()) {
    is_on_ground = true;
  } else {
    leave_ground();
  }`,
    },
    {
      note: "attach：frame.id 为空时不进 auto 帧",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (strict_equals(field_or(frame, u"id"), Value(std::u16string(frame_id::kNone)))) {
    enter_frame(auto_frame_value());
  }`,
      to: `  if (false) {
    enter_frame(auto_frame_value());
  }`,
    },
    {
      note: "apply_opoints：interval 的默认值写成 1",
      file: "native/lfw/entity/entity.cpp",
      from: `        std::holds_alternative<std::monostate>(interval_field) ? Value(0.0) : interval_field;`,
      to: `        std::holds_alternative<std::monostate>(interval_field) ? Value(1.0) : interval_field;`,
    },
    {
      note: "apply_opoints：mode=1 命中后不再按 tick 早退",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (!strict_equals(Value(opoints[found].second), interval_field)) continue;`,
      to: `      if (false) continue;`,
    },
    {
      note: "apply_opoints：mode=1 命中后一律早退",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (!strict_equals(Value(opoints[found].second), interval_field)) continue;`,
      to: `      if (true) continue;`,
    },
    {
      note: "apply_opoints：interval>0 写成 >=0",
      file: "native/lfw/entity/entity.cpp",
      from: `    } else if (to_number(interval) > 0) {`,
      to: `    } else if (to_number(interval) >= 0) {`,
    },
    {
      note: "apply_opoints：interval_mode 比较的是 2",
      file: "native/lfw/entity/entity.cpp",
      from: `    const bool interval_mode_1 = strict_equals(field_or(opoint, u"interval_mode"), Value(1.0));`,
      to: `    const bool interval_mode_1 = strict_equals(field_or(opoint, u"interval_mode"), Value(2.0));`,
    },
    {
      note: "apply_opoints：interval_id 的查找恒不命中",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (strict_equals(field_or(opoints[i].first, u"interval_id"), interval_id)) {`,
      to: `      if (false) {`,
    },
    {
      note: "apply_opoints：push 的 tick 写成 1",
      file: "native/lfw/entity/entity.cpp",
      from: `      opoints.push_back({opoint, 0});`,
      to: `      opoints.push_back({opoint, 1});`,
    },
    {
      note: "apply_opoints：multi 的默认值写成 0",
      file: "native/lfw/entity/entity.cpp",
      from: `        std::holds_alternative<std::monostate>(multi_field) ? Value(1.0) : multi_field;`,
      to: `        std::holds_alternative<std::monostate>(multi_field) ? Value(0.0) : multi_field;`,
    },
    {
      note: "apply_opoints：multi 的数字分支并进对象分支",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (is_num(multi)) {
      count = to_number(multi);`,
      to: `    if (false) {
      count = to_number(multi);`,
    },
    {
      note: "apply_opoints：multi.min 的默认值写成 1",
      file: "native/lfw/entity/entity.cpp",
      from: `          std::holds_alternative<std::monostate>(min_field) ? Value(0.0) : min_field;`,
      to: `          std::holds_alternative<std::monostate>(min_field) ? Value(1.0) : min_field;`,
    },
    {
      note: "apply_opoints：multi.max 的默认值写成 1",
      file: "native/lfw/entity/entity.cpp",
      from: `          std::holds_alternative<std::monostate>(max_field) ? Value(355.0) : max_field;`,
      to: `          std::holds_alternative<std::monostate>(max_field) ? Value(1.0) : max_field;`,
    },
    {
      note: "apply_opoints：敌人的 skip_zero 不生效",
      file: "native/lfw/entity/entity.cpp",
      from: `        if (!(truthy(skip_zero) && enemies.empty())) {`,
      to: `        if (true) {`,
    },
    {
      note: "apply_opoints：友军的 skip_zero 不生效",
      file: "native/lfw/entity/entity.cpp",
      from: `        if (!(truthy(skip_zero) && allies.empty())) {`,
      to: `        if (true) {`,
    },
    {
      note: "apply_opoints：敌人的谓词不看 is_fighter",
      file: "native/lfw/entity/entity.cpp",
      from: `          return entity::is_fighter_data(o.data()) && team() != o.team() && o.hp() > 0;`,
      to: `          return team() != o.team() && o.hp() > 0;`,
    },
    {
      note: "apply_opoints：敌人的谓词不看队伍",
      file: "native/lfw/entity/entity.cpp",
      from: `          return entity::is_fighter_data(o.data()) && team() != o.team() && o.hp() > 0;`,
      to: `          return entity::is_fighter_data(o.data()) && o.hp() > 0;`,
    },
    {
      note: "apply_opoints：敌人的谓词不看 hp",
      file: "native/lfw/entity/entity.cpp",
      from: `          return entity::is_fighter_data(o.data()) && team() != o.team() && o.hp() > 0;`,
      to: `          return entity::is_fighter_data(o.data()) && team() != o.team();`,
    },
    {
      note: "apply_opoints：multi_type 不记下来（chasing 分支永不命中）",
      file: "native/lfw/entity/entity.cpp",
      from: `      multi_type = type;`,
      to: `      multi_type = Value();`,
    },
    {
      note: "apply_opoints：友军谓词不排除自己",
      file: "native/lfw/entity/entity.cpp",
      from: `          if (&o == this) return false;`,
      to: `          if (false) return false;`,
    },
    {
      note: "apply_opoints：友军谓词不排除 src_emitter",
      file: "native/lfw/entity/entity.cpp",
      from: `          if (src != nullptr && o.id == *src) return false;`,
      to: `          if (false) return false;`,
    },
    {
      note: "apply_opoints：友军谓词不看 is_fighter",
      file: "native/lfw/entity/entity.cpp",
      from: `          if (!entity::is_fighter_data(o.data())) return false;`,
      to: `          if (false) return false;`,
    },
    {
      note: "apply_opoints：友军谓词不看队伍",
      file: "native/lfw/entity/entity.cpp",
      from: `          if (team() != o.team()) return false;`,
      to: `          if (false) return false;`,
    },
    {
      note: "apply_opoints：友军谓词不看 hp",
      file: "native/lfw/entity/entity.cpp",
      from: `          if (!(o.hp() > 0)) return false;`,
      to: `          if (false) return false;`,
    },
    {
      note: "apply_opoints：Emitter 分支的 count 写成 2",
      file: "native/lfw/entity/entity.cpp",
      from: `            allies.push_back(target);
            count = 1;`,
      to: `            allies.push_back(target);
            count = 2;`,
    },
    {
      note: "apply_opoints：Emitter 分支不记目标（chasing 拿不到）",
      file: "native/lfw/entity/entity.cpp",
      from: `            allies.push_back(target);
            count = 1;`,
      to: `            count = 1;`,
    },
    {
      note: "apply_opoints：Normal spreading 的系数写成 2.0",
      file: "native/lfw/entity/entity.cpp",
      from: `        sp.z = (i - (count - 1) / 2) * 2.5;`,
      to: `        sp.z = (i - (count - 1) / 2) * 2.0;`,
    },
    {
      note: "apply_opoints：Spreading 不再用生成器（sp 全是 0）",
      file: "native/lfw/entity/entity.cpp",
      from: `      } else if (strict_equals(spreading,
                               Value(static_cast<double>(OpointSpreading::Spreading)))) {
        sp.x`,
      to: `      } else if (false) {
        sp.x`,
    },
    {
      note: "apply_opoints：FloatRange 段整段不生效",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (strict_equals(spreading, Value(static_cast<double>(OpointSpreading::FloatRange)))) {
        Value x`,
      to: `      if (false) {
        Value x`,
    },
    {
      note: "apply_opoints：FloatRange 读的是 opoint 字段而不是生成器",
      file: "native/lfw/entity/entity.cpp",
      from: `        const Value gx = gen_or(opoint, u"__gen_spread_x", x);`,
      to: `        const Value gx = field_or(opoint, u"__gen_spread_x");`,
    },
    {
      note: "apply_opoints：FloatRange 把 x 的生成器写进 y",
      file: "native/lfw/entity/entity.cpp",
      from: `        if (!nullish(gx)) x = gx;`,
      to: `        if (!nullish(gx)) y = gx;`,
    },
    {
      note: "apply_opoints：spawn 失败后继续处理下一个 opoint",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (e == nullptr) return;`,
      to: `      if (e == nullptr) continue;`,
    },
    {
      note: "apply_opoints：次数循环写成 i <= count",
      file: "native/lfw/entity/entity.cpp",
      from: `    for (double i = 0; i < count; ++i) {`,
      to: `    for (double i = 0; i <= count; ++i) {`,
    },
    {
      note: "apply_opoints：不带 spreading 偏移地生成",
      file: "native/lfw/entity/entity.cpp",
      from: `      Entity* e = spawn(opoint, sp, facing_now);`,
      to: `      Entity* e = spawn(opoint);`,
    },
    {
      note: "apply_opoints：chasing 对非 ball ctrl 也写",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (ctrl != nullptr && ctrl->is_ball_ctrl()) {`,
      to: `      if (ctrl != nullptr) {`,
    },
    {
      note: "apply_opoints：敌人的 chasing 不写目标",
      file: "native/lfw/entity/entity.cpp",
      from: `          ctrl->chasing = enemies.empty()
                              ? Value()
                              : ref_of(*enemies[static_cast<std::size_t>(
                                    std::fmod(i, enemies.size()))]);`,
      to: `          ctrl->chasing = Value();`,
    },
    {
      note: "apply_opoints：友军的 chasing 不写目标",
      file: "native/lfw/entity/entity.cpp",
      from: `          ctrl->chasing = allies.empty()
                              ? Value()
                              : ref_of(*allies[static_cast<std::size_t>(
                                    std::fmod(i, allies.size()))]);`,
      to: `          ctrl->chasing = Value();`,
    },
    {
      note: "apply_opoints：Emitter 的 chasing 不写目标",
      file: "native/lfw/entity/entity.cpp",
      from: `          ctrl->chasing = allies.empty() ? Value() : ref_of(*allies[0]);`,
      to: `          ctrl->chasing = Value();`,
    },
    {
      note: "apply_opoints：inherit_speed 丢了生成后的速度项",
      file: "native/lfw/entity/entity.cpp",
      from: `      const Value vx = truthy(inherit_x)
                           ? Value(e->velocity.x + velocity.x * to_number(inherit_x))
                           : Value(NullTag{});`,
      to: `      const Value vx = truthy(inherit_x) ? Value(e->velocity.x * to_number(inherit_x))
                                          : Value(NullTag{});`,
    },
    {
      note: "apply_opoints：inherit_speed_x 恒不写",
      file: "native/lfw/entity/entity.cpp",
      from: `      const Value vx = truthy(inherit_x)`,
      to: `      const Value vx = false`,
    },
    {
      note: "apply_opoints：inherit_speed 的 x/y 写反",
      file: "native/lfw/entity/entity.cpp",
      from: `      e->set_velocity(vx, vy, vz);`,
      to: `      e->set_velocity(vy, vx, vz);`,
    },
    {
      note: "apply_opoints：clamp 的 min/max 传反（敌人）",
      file: "native/lfw/entity/entity.cpp",
      from: `          count = clamp(static_cast<double>(enemies.size()), to_number(min), to_number(max));`,
      to: `          count = clamp(static_cast<double>(enemies.size()), to_number(max), to_number(min));`,
    },
    {
      note: "apply_opoints：clamp 的 min/max 传反（友军）",
      file: "native/lfw/entity/entity.cpp",
      from: `          count = clamp(static_cast<double>(allies.size()), to_number(min), to_number(max));`,
      to: `          count = clamp(static_cast<double>(allies.size()), to_number(max), to_number(min));`,
    },
    {
      note: "apply_opoints：set_hp 的死亡分支不再处理 brokens",
      file: "native/lfw/entity/entity.cpp",
      from: `      apply_opoints(brokens);`,
      to: `      (void)brokens;`,
    },
    {
      note: "find 的 pair 回落被去掉（set_frame 的 opoint 压实）",
      file: "native/lfw/utils/container_help/find.h",
      from: `    if (pred(pair)) return pair;`,
      to: `    if (!pred(pair)) continue;`,
    },

    // --- 9n：`update` / `update_ghost` + 融合解散 + AABB + 落地 + 抓人 ---
    {
      note: "update：lifetime 按 1 加（不乘 atom_time）",
      file: "native/lfw/entity/entity.cpp",
      from: `  _lifetime += _atom_time;
  const Value frame_facing = field_or(frame, u"facing");
  if (truthy(frame_facing)) facing = handle_facing_flag(frame_facing);
  // 控制器要读的那一组值`,
      to: `  _lifetime += 1.0;
  const Value frame_facing = field_or(frame, u"facing");
  if (truthy(frame_facing)) facing = handle_facing_flag(frame_facing);
  // 控制器要读的那一组值`,
    },
    {
      note: "update：原子时间恒 1（不读 world.dataset）",
      file: "native/lfw/entity/entity.cpp",
      from: `  _atom_time = num_of(dataset(u"atom_time"));
  _lifetime += _atom_time;
  const Value frame_facing = field_or(frame, u"facing");
  if (truthy(frame_facing)) facing = handle_facing_flag(frame_facing);
  // 控制器要读的那一组值`,
      to: `  _atom_time = 1.0;
  _lifetime += _atom_time;
  const Value frame_facing = field_or(frame, u"facing");
  if (truthy(frame_facing)) facing = handle_facing_flag(frame_facing);
  // 控制器要读的那一组值`,
    },
    {
      note: "update：帧朝向标志不处理",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(frame_facing)) facing = handle_facing_flag(frame_facing);
  // 控制器要读的那一组值`,
      to: `  (void)frame_facing;
  // 控制器要读的那一组值`,
    },
    {
      note: "update：进 tick 前不刷控制器环境",
      file: "native/lfw/entity/entity.cpp",
      from: `  refresh_ctrl_env();
  if (check_fusion_dismissing()) return;`,
      to: `  if (check_fusion_dismissing()) return;`,
    },
    {
      note: "update：融合解散后不提前收手",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (check_fusion_dismissing()) return;`,
      to: `  (void)check_fusion_dismissing();`,
    },
    {
      note: "update：hp_recovering 不调",
      file: "native/lfw/entity/entity.cpp",
      from: `  hp_recovering();
  mp_recovering();`,
      to: `  mp_recovering();`,
    },
    {
      note: "update：mp_recovering 不调",
      file: "native/lfw/entity/entity.cpp",
      from: `  hp_recovering();
  mp_recovering();`,
      to: `  hp_recovering();`,
    },
    {
      note: "update：帧 hp / mp 消耗少乘 atom_time",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(frame_hp)) set_hp(hp() - to_number(frame_hp) * _atom_time);
  const Value frame_mp = field_or(frame, u"mp");
  if (truthy(frame_mp)) set_mp(mp() - to_number(frame_mp) * _atom_time);

  if (!(shaking > 0)`,
      to: `  if (truthy(frame_hp)) set_hp(hp() - to_number(frame_hp));
  const Value frame_mp = field_or(frame, u"mp");
  if (truthy(frame_mp)) set_mp(mp() - to_number(frame_mp));

  if (!(shaking > 0)`,
    },
    {
      note: "update：帧 hp 的 truthy 守卫恒真（hp 为 0 的帧也扣）",
      file: "native/lfw/entity/entity.cpp",
      from: `  const Value frame_hp = field_or(frame, u"hp");
  if (truthy(frame_hp)) set_hp(hp() - to_number(frame_hp) * _atom_time);
  const Value frame_mp = field_or(frame, u"mp");
  if (truthy(frame_mp)) set_mp(mp() - to_number(frame_mp) * _atom_time);

  if (!(shaking > 0)`,
      to: `  const Value frame_hp = field_or(frame, u"hp");
  if (true) set_hp(hp() - to_number(frame_hp) * _atom_time);
  const Value frame_mp = field_or(frame, u"mp");
  if (truthy(frame_mp)) set_mp(mp() - to_number(frame_mp) * _atom_time);

  if (!(shaking > 0)`,
    },
    {
      note: "update：v_rest 掩码用 and（shaking>0 时也递减）",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (!(shaking > 0) || equals(Value(0.0), dataset(u"vrest_after_shaking"))) {`,
      to: `  if (!(shaking > 0) && equals(Value(0.0), dataset(u"vrest_after_shaking"))) {`,
    },
    {
      note: "update：v_rest 到点不删（留 0 项）",
      file: "native/lfw/entity/entity.cpp",
      from: `        const std::u16string key = it->first;
        del_v_rest(key);
        it = vrests.upper_bound(key);`,
      to: `        ++it;`,
    },
    {
      note: "update：v_rest 递减不减（不续时）",
      file: "native/lfw/entity/entity.cpp",
      from: `        v.rest = round_float(v.rest - _atom_time);`,
      to: `        v.rest = round_float(v.rest);`,
    },
    {
      note: "update：arest 掩码用 and",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (equals(Value(0.0), dataset(u"arest_after_motionless")) || !(motionless > 0)) {`,
      to: `  if (equals(Value(0.0), dataset(u"arest_after_motionless")) && !(motionless > 0)) {`,
    },
    {
      note: "update：arest 不递减（有值就清零）",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (arest() > 0) {
      set_arest(round_float(arest() - _atom_time));
      if (arest() < 0) set_arest(0);
    } else {
      set_arest(0);
    }`,
      to: `    set_arest(0);`,
    },
    {
      note: "update：invisible 递减用 +",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (_invisible > 0) {
    _invisible = round_float(_invisible - _atom_time);
    if (_invisible <= 0) _invisible = 0;
  }
  if (_invulnerable > 0) {`,
      to: `  if (_invisible > 0) {
    _invisible = round_float(_invisible + _atom_time);
    if (_invisible <= 0) _invisible = 0;
  }
  if (_invulnerable > 0) {`,
    },
    {
      note: "update：invulnerable 不递减",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (_invulnerable > 0) {
    _invulnerable = round_float(_invulnerable - _atom_time);
    if (_invulnerable < 0) _invulnerable = 0;
  }
  if (_blinking > 0) {`,
      to: `  if (_invulnerable > 0) {
    if (_invulnerable < 0) _invulnerable = 0;
  }
  if (_blinking > 0) {`,
    },
    {
      note: "update：blink 到点不归零（Gone / Respawn 不触发）",
      file: "native/lfw/entity/entity.cpp",
      from: `      _blinking = 0;
      if (_after_blink.has_value() && *_after_blink == frame_id::kGone) {`,
      to: `      if (_after_blink.has_value() && *_after_blink == frame_id::kGone) {`,
    },
    {
      note: "update：Gone 分支不写 GONE_FRAME_INFO",
      file: "native/lfw/entity/entity.cpp",
      from: `        const Value* gone = defines::find(u"GONE_FRAME_INFO");
        frame = gone != nullptr ? *gone : Value();
        set_arest(0);`,
      to: `        set_arest(0);`,
    },
    {
      note: "update：Respawn 不回满 hp（只补 hp_r）",
      file: "native/lfw/entity/entity.cpp",
      from: `        set_hp(hp_max());
        set_hp_r(hp_max());`,
      to: `        set_hp_r(hp_max());`,
    },
    {
      note: "update：Respawn 的最近友军不过滤 hp<=0",
      file: "native/lfw/entity/entity.cpp",
      from: `          if (e == nullptr || !(e->hp() > 0)) continue;`,
      to: `          if (e == nullptr) continue;`,
    },
    {
      note: "update：Respawn 的最近友军比较用 <",
      file: "native/lfw/entity/entity.cpp",
      from: `          if (d > max_distance) continue;`,
      to: `          if (d < max_distance) continue;`,
    },
    {
      note: "update：Respawn 的 x 夹紧 max/min 传反",
      file: "native/lfw/entity/entity.cpp",
      from: `          const double x = (*world().lfw().mt()).range(
              max(round(friend_entity->position.x - 100),
                  to_number(world().stage_value(u"player_l"))),
              min(round(friend_entity->position.x + 100),
                  to_number(world().stage_value(u"player_r"))));`,
      to: `          const double x = (*world().lfw().mt()).range(
              min(round(friend_entity->position.x - 100),
                  to_number(world().stage_value(u"player_l"))),
              max(round(friend_entity->position.x + 100),
                  to_number(world().stage_value(u"player_r"))));`,
    },
    {
      note: "update：Respawn 的位置 y 写成 0",
      file: "native/lfw/entity/entity.cpp",
      from: `          set_position(Value(x), Value(300.0), Value(z));`,
      to: `          set_position(Value(x), Value(0.0), Value(z));`,
    },
    {
      note: "update：Respawn 后进的 auto 帧写成 gone",
      file: "native/lfw/entity/entity.cpp",
      from: `          set_position(Value(NullTag{}), Value(300.0), Value());
        }
        const Value* auto_frame = defines::find(u"Defines.NEXT_FRAME_AUTO");
        enter_frame(auto_frame != nullptr ? *auto_frame : Value());`,
      to: `          set_position(Value(NullTag{}), Value(300.0), Value());
        }
        const Value* auto_frame = defines::find(u"GONE_FRAME_INFO");
        enter_frame(auto_frame != nullptr ? *auto_frame : Value());`,
    },
    {
      note: "update：opoint 到点不 apply_opoints（只归零）",
      file: "native/lfw/entity/entity.cpp",
      from: `      apply_opoints(Value(std::make_shared<Array>(std::vector<Value>{opoint})));`,
      to: `      (void)opoint;`,
    },
    {
      note: "update：opoint 计时比较用宽松相等",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (strict_equals(Value(opoints[i].second), field_or(opoint, u"interval"))) {`,
      to: `    if (equals(Value(opoints[i].second), field_or(opoint, u"interval"))) {`,
    },
    {
      note: "update：opoint 未到点不 +1",
      file: "native/lfw/entity/entity.cpp",
      from: `      opoints[i].second = opoints[i].second + 1;`,
      to: `      opoints[i].second = opoints[i].second;`,
    },
    {
      note: "update：stat_recovering 不调",
      file: "native/lfw/entity/entity.cpp",
      from: `  stat_recovering();
  toughness_recovering();`,
      to: `  toughness_recovering();`,
    },
    {
      note: "update：toughness_recovering 不调",
      file: "native/lfw/entity/entity.cpp",
      from: `  stat_recovering();
  toughness_recovering();`,
      to: `  stat_recovering();`,
    },
    {
      note: "update：state.pre_update 不调",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (_state != nullptr && _state->pre_update) _state->pre_update(*this);
  _from_wait_block = true;
  if (wait > 0) {
    if (!(motionless > 0) && !(shaking > 0) && catcher == nullptr && bearer == nullptr) {`,
      to: `  _from_wait_block = true;
  if (wait > 0) {
    if (!(motionless > 0) && !(shaking > 0) && catcher == nullptr && bearer == nullptr) {`,
    },
    {
      note: "update：wait 块不置 _from_wait_block",
      file: "native/lfw/entity/entity.cpp",
      from: `  _from_wait_block = true;
  if (wait > 0) {
    if (!(motionless > 0) && !(shaking > 0) && catcher == nullptr && bearer == nullptr) {`,
      to: `  _from_wait_block = false;
  if (wait > 0) {
    if (!(motionless > 0) && !(shaking > 0) && catcher == nullptr && bearer == nullptr) {`,
    },
    {
      note: "update：wait 递减不减",
      file: "native/lfw/entity/entity.cpp",
      from: `      set_motionless_ticks(0);
      wait = round_float(wait - _atom_time);
      if (wait < 0) wait = 0;
    } else if (motionless > 0 && catcher == nullptr && bearer == nullptr) {`,
      to: `      set_motionless_ticks(0);
      if (wait < 0) wait = 0;
    } else if (motionless > 0 && catcher == nullptr && bearer == nullptr) {`,
    },
    {
      note: "update：wait 分支的 motionless 守卫去掉",
      file: "native/lfw/entity/entity.cpp",
      from: `    } else if (motionless > 0 && catcher == nullptr && bearer == nullptr) {`,
      to: `    } else if (catcher == nullptr && bearer == nullptr) {`,
    },
    {
      note: "update：motionless tick 加 1（不乘 atom_time）",
      file: "native/lfw/entity/entity.cpp",
      from: `      set_motionless_ticks(round_float(motionless_ticks() + _atom_time));`,
      to: `      set_motionless_ticks(round_float(motionless_ticks() + 1.0));`,
    },
    {
      note: "update：MotionlessWaitTicks 判定用 >",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (motionless_ticks() >= kMotionlessWaitTicks) {`,
      to: `      if (motionless_ticks() > kMotionlessWaitTicks) {`,
    },
    {
      note: "update：wait=0 时 next / auto 两支互换",
      file: "native/lfw/entity/entity.cpp",
      from: `        if (wait < 0) wait = 0;
      }
    }
  } else if (truthy(field_or(frame, u"next"))) {
    enter_frame(field_or(frame, u"next"));
  } else {
    set_frame(find_auto_frame());
  }
  _from_wait_block = false;`,
      to: `        if (wait < 0) wait = 0;
      }
    }
  } else if (truthy(field_or(frame, u"next"))) {
    set_frame(find_auto_frame());
  } else {
    enter_frame(field_or(frame, u"next"));
  }
  _from_wait_block = false;`,
    },
    {
      note: "update：子步上界用 < 8",
      file: "native/lfw/entity/entity.cpp",
      from: `                               ? tick_atom_time
                               : 1.0;
  if (sub_steps > 1) _atom_time = round_float(tick_atom_time / sub_steps);
  for (double i = 0; i < sub_steps; ++i) {
    handle_gravity();
    update_velocity(frame);
    if (i == 0 && _state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (motionless > 0) {`,
      to: `                               ? tick_atom_time
                               : 1.0;
  if (sub_steps > 1) _atom_time = round_float(tick_atom_time / sub_steps);
  for (double i = 0; i < sub_steps; ++i) {
    handle_gravity();
    update_velocity(frame);
    if (i == 0 && _state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (shaking > 0) {`,
    },
    {
      note: "update：子步后不还原 atom_time",
      file: "native/lfw/entity/entity.cpp",
      from: `  _atom_time = tick_atom_time;

  if (motionless > 0) {`,
      to: `  if (motionless > 0) {`,
    },
    {
      note: "update：state.update 每个子步都调",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (i == 0 && _state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (motionless > 0) {`,
      to: `    if (_state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (motionless > 0) {`,
    },
    {
      note: "update：motionless 不递减",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (motionless > 0) {
    motionless = round_float(motionless - _atom_time);
    if (motionless < 0) motionless = 0;
  }
  if (shaking > 0) {`,
      to: `  if (motionless > 0) {
    if (motionless < 0) motionless = 0;
  }
  if (shaking > 0) {`,
    },
    {
      note: "update：shaking 不递减",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (shaking > 0) {
    shaking = round_float(shaking - _atom_time);
    if (shaking < 0) shaking = 0;
  }

  if (update_catching()) return;`,
      to: `  if (shaking > 0) {
    if (shaking < 0) shaking = 0;
  }

  if (update_catching()) return;`,
    },
    {
      note: "update：update_catching / caught 的提前收手去掉",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (update_catching()) return;
  if (update_caught()) return;`,
      to: `  update_catching();
  update_caught();`,
    },
    {
      note: "update：Entered 判定用 >",
      file: "native/lfw/entity/entity.cpp",
      from: `      if (static_cast<int>(r) >= static_cast<int>(EnterFrameResult::Entered) &&
          res.keys() != std::u16string(gk::ka)) {`,
      to: `      if (static_cast<int>(r) > static_cast<int>(EnterFrameResult::Entered) &&
          res.keys() != std::u16string(gk::ka)) {`,
    },
    {
      note: "update：命中后不重置抓人时间",
      file: "native/lfw/entity/entity.cpp",
      from: `        set_catch_time(catch_time_max());`,
      to: `        set_catch_time(0.0);`,
    },
    {
      note: "update：控制器结果不处理",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (truthy(res.result())) {
      const EnterFrameResult r = handle_next_frame_result(res.result());`,
      to: `    if (false) {
      const EnterFrameResult r = handle_next_frame_result(res.result());`,
    },
    {
      note: "update：落地判定的 shaking / motionless 守卫去掉",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (!truthy(Value(shaking)) && !truthy(Value(motionless)) && bearer == nullptr &&
      catcher == nullptr) {
    update_landable();
  }
  if (holding != nullptr) holding->follow_bearer();`,
      to: `  update_landable();
  if (holding != nullptr) holding->follow_bearer();`,
    },
    {
      note: "update：holding 不跟 bearer",
      file: "native/lfw/entity/entity.cpp",
      from: `    update_landable();
  }
  if (holding != nullptr) holding->follow_bearer();`,
      to: `    update_landable();
  }
  if (holding != nullptr) holding->follow_catcher();`,
    },
    {
      note: "update：prev_position 不记",
      file: "native/lfw/entity/entity.cpp",
      from: `  prev_position = position;
  update_aabb();
  if ((*world().lfw().mt()).debugging) {
    (*world().lfw().mt()).log_case({Value(u"e_" + id + u"_" + to_string(name()) + u"_end")});`,
      to: `  update_aabb();
  if ((*world().lfw().mt()).debugging) {
    (*world().lfw().mt()).log_case({Value(u"e_" + id + u"_" + to_string(name()) + u"_end")});`,
    },
    {
      note: "update：不刷新 AABB",
      file: "native/lfw/entity/entity.cpp",
      from: `  prev_position = position;
  update_aabb();
  if ((*world().lfw().mt()).debugging) {`,
      to: `  prev_position = position;
  if ((*world().lfw().mt()).debugging) {`,
    },
    {
      note: "update：mt.case end 标记不写",
      file: "native/lfw/entity/entity.cpp",
      from: `    (*world().lfw().mt()).log_case({Value(u"e_" + id + u"_" + to_string(name()) + u"_end")});`,
      to: `    (void)0;`,
    },
    {
      note: "update_ghost：wait 递减不减",
      file: "native/lfw/entity/entity.cpp",
      from: `  _from_wait_block = true;
  if (wait > 0) {
    wait = round_float(wait - _atom_time);
    if (wait < 0) wait = 0;
  } else if (truthy(field_or(frame, u"next"))) {`,
      to: `  _from_wait_block = true;
  if (wait > 0) {
    if (wait < 0) wait = 0;
  } else if (truthy(field_or(frame, u"next"))) {`,
    },
    {
      note: "update_ghost：子步不切分 atom_time",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (sub_steps > 1) _atom_time = round_float(tick_atom_time / sub_steps);
  for (double i = 0; i < sub_steps; ++i) {
    handle_gravity();
    update_velocity(frame);
    if (i == 0 && _state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (bearer == nullptr && catcher == nullptr) update_landable();`,
      to: `  if (sub_steps > 1) _atom_time = tick_atom_time;
  for (double i = 0; i < sub_steps; ++i) {
    handle_gravity();
    update_velocity(frame);
    if (i == 0 && _state != nullptr) _state->update(*this);
    update_position();
  }
  _atom_time = tick_atom_time;

  if (bearer == nullptr && catcher == nullptr) update_landable();`,
    },
    {
      note: "update_ghost：落地判定用 ||",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (bearer == nullptr && catcher == nullptr) update_landable();
  prev_position = position;`,
      to: `  if (bearer == nullptr || catcher == nullptr) update_landable();
  prev_position = position;`,
    },
    {
      note: "update_ghost：prev_position 不记",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (bearer == nullptr && catcher == nullptr) update_landable();
  prev_position = position;
}`,
      to: `  if (bearer == nullptr && catcher == nullptr) update_landable();
}`,
    },
    {
      note: "check_fusion_dismissing：成员位置不同步",
      file: "native/lfw/entity/entity.cpp",
      from: `    fighter->position.set(x, y, z);`,
      to: `    fighter->position.set(x, y, x);`,
    },
    {
      note: "check_fusion_dismissing：dismiss_time 递增",
      file: "native/lfw/entity/entity.cpp",
      from: `    dismiss_time = round_float(*dismiss_time - _atom_time);`,
      to: `    dismiss_time = round_float(*dismiss_time + _atom_time);`,
    },
    {
      note: "check_fusion_dismissing：去掉 y == 0 条件",
      file: "native/lfw/entity/entity.cpp",
      from: `      y == 0;
  if (should_dismiss) dismiss_fusion(u"112");`,
      to: `      true;
  if (should_dismiss) dismiss_fusion(u"112");`,
    },
    {
      note: "check_fusion_dismissing：sametime 判定换成 sequence",
      file: "native/lfw/entity/entity.cpp",
      from: `       (ctrl_ != nullptr && ctrl_->sametime_keys_test(u"dja")) ||`,
      to: `       (ctrl_ != nullptr && ctrl_->sequence_keys_test(u"dja")) ||`,
    },
    {
      note: "check_fusion_dismissing：解散帧 id 写错",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (should_dismiss) dismiss_fusion(u"112");`,
      to: `  if (should_dismiss) dismiss_fusion(u"111");`,
    },
    {
      note: "dismiss_fusion：hp 不再按人数均分",
      file: "native/lfw/entity/entity.cpp",
      from: `  const double hp_v = round(hp() / size);`,
      to: `  const double hp_v = round(hp());`,
    },
    {
      note: "dismiss_fusion：朝向不翻转",
      file: "native/lfw/entity/entity.cpp",
      from: `    f = to_number(entity::turn_face(Value(f)));`,
      to: `    (void)0;`,
    },
    {
      note: "dismiss_fusion：成员不重置 invisible / motionless / invulnerable",
      file: "native/lfw/entity/entity.cpp",
      from: `    fighter->set_invisible(0);
    fighter->motionless = 0;
    fighter->set_invulnerable(0);`,
      to: `    (void)0;`,
    },
    {
      note: "dismiss_fusion：不清 fuse_bys",
      file: "native/lfw/entity/entity.cpp",
      from: `  dismiss_data = Value(NullTag{});
  fuse_bys.clear();
  has_fuse_bys = false;
}`,
      to: `  dismiss_data = Value(NullTag{});
  has_fuse_bys = false;
}`,
    },
    {
      note: "update_aabb：x1 不随朝向翻",
      file: "native/lfw/entity/entity.cpp",
      from: `  aabb_min_x = round(position.x + (facing > 0 ? bx1 : -fx1));`,
      to: `  aabb_min_x = round(position.x + (facing > 0 ? bx1 : fx1));`,
    },
    {
      note: "update_aabb：z2 默认值写成 -12",
      file: "native/lfw/entity/entity.cpp",
      from: `  const double bz2 = num_destructured(field_or(frame, u"__aabb_z2"), 12.0);`,
      to: `  const double bz2 = num_destructured(field_or(frame, u"__aabb_z2"), -12.0);`,
    },
    {
      note: "update_aabb：l_len / r_len 写反",
      file: "native/lfw/entity/entity.cpp",
      from: `  l_len = facing > 0 ? centerx : width - centerx;
  r_len = facing > 0 ? width - centerx : centerx;`,
      to: `  l_len = facing > 0 ? width - centerx : centerx;
  r_len = facing > 0 ? centerx : width - centerx;`,
    },
    {
      note: "update_landable：hit_ground 的 itrs 不处理",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(hit_bdys)) update_itr_bdy_hit_ground(hit_bdys);
  if (truthy(hit_itrs)) update_itr_bdy_hit_ground(hit_itrs);`,
      to: `  if (truthy(hit_bdys)) update_itr_bdy_hit_ground(hit_bdys);`,
    },
    {
      note: "update_landable：landable 守卫去掉",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (!truthy(field_or(frame, u"landable"))) return;`,
      to: `  if (false) return;`,
    },
    {
      note: "update_landable：just_land 不看 is_on_ground",
      file: "native/lfw/entity/entity.cpp",
      from: `  const bool just_land = !was_on_ground && (position.y <= ground);`,
      to: `  const bool just_land = (position.y <= ground);`,
    },
    {
      note: "update_landable：落地不写 is_on_ground",
      file: "native/lfw/entity/entity.cpp",
      from: `    is_on_ground = true;
    position.y = ground;`,
      to: `    position.y = ground;`,
    },
    {
      note: "update_landable：落地不把 velocity.y 归零",
      file: "native/lfw/entity/entity.cpp",
      from: `    velocity.y = 0;
    prev_velocity.y = 0;`,
      to: `    prev_velocity.y = 0;`,
    },
    {
      note: "update_landable：temp_v 在归零之后才拷",
      file: "native/lfw/entity/entity.cpp",
      from: `    _temp_v.x = velocity.x;
    _temp_v.y = velocity.y;
    _temp_v.z = velocity.z;
    velocity.y = 0;`,
      to: `    velocity.y = 0;
    _temp_v.x = velocity.x;
    _temp_v.y = velocity.y;
    _temp_v.z = velocity.z;`,
    },
    {
      note: "update_landable：throwinjury 不结算",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (truthy(Value(throwinjury))) {`,
      to: `    if (false) {`,
    },
    {
      note: "update_landable：fallinjury 不减 hp_r",
      file: "native/lfw/entity/entity.cpp",
      from: `      set_hp_r(hp_r() - round(fallinjury * (1 - num_of(dataset(u"hp_recoverability")))));`,
      to: `      set_hp_r(hp_r());`,
    },
    {
      note: "update_landable：离地判定用 >=",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (position.y - ground > world().ground.step()) {`,
      to: `    if (position.y - ground >= world().ground.step()) {`,
    },
    {
      note: "update_landable：离地钩子不调",
      file: "native/lfw/entity/entity.cpp",
      from: `      leave_ground();
      if (_state != nullptr && _state->on_leave_ground) _state->on_leave_ground(*this);`,
      to: `      leave_ground();`,
    },
    {
      note: "update_catching：没有 cpoint 时不放手",
      file: "native/lfw/entity/entity.cpp",
      from: `  const Value cpoint_a = field_or(frame, u"cpoint");
  if (!truthy(cpoint_a)) {`,
      to: `  const Value cpoint_a = field_or(frame, u"cpoint");
  if (false) {`,
    },
    {
      note: "update_catching：throwinjury 上界用 -2",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (cp_throwinjury < -1) {`,
      to: `  if (cp_throwinjury < -2) {`,
    },
    {
      note: "update_catching：survival_rank_mode 判定取反",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (cp_throwinjury == -1 &&
      (!world().lfw().survival_rank_mode() || !entity::is_boss(caught->entity_view()))) {`,
      to: `  if (cp_throwinjury == -1 &&
      (world().lfw().survival_rank_mode() || !entity::is_boss(caught->entity_view()))) {`,
    },
    {
      note: "update_catching：decrease 不乘 atom_time",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(Value(decrease))) add_catch_time(decrease * _atom_time);`,
      to: `  if (truthy(Value(decrease))) add_catch_time(decrease);`,
    },
    {
      note: "update_catching：throwv 三轴判定整块丢掉",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(tix) || truthy(tiy) || truthy(tiz)) {
    set_catching(nullptr);
    return false;
  }`,
      to: `  if (false) {
    set_catching(nullptr);
    return false;
  }`,
    },
    {
      note: "update_catching：caught 不跟 catcher",
      file: "native/lfw/entity/entity.cpp",
      from: `  caught->follow_catcher();
  return false;`,
      to: `  return false;`,
    },
    {
      note: "update_caught：cp 未变也结算",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (!strict_equals(_prev_cpoint_a, cp_a)) {`,
      to: `  if (true) {`,
    },
    {
      note: "update_caught：injury 不调 apply_damage",
      file: "native/lfw/entity/entity.cpp",
      from: `      summary_mgr().apply_damage(cer->entity_view(), injury, entity_view(), Value(prev_hp));`,
      to: `      (void)prev_hp;`,
    },
    {
      note: "update_caught：cp_motionless 写给自己",
      file: "native/lfw/entity/entity.cpp",
      from: `    if (truthy(cp_motionless)) cer->motionless = max(to_number(cp_motionless), cer->motionless);`,
      to: `    if (truthy(cp_motionless)) motionless = max(to_number(cp_motionless), motionless);`,
    },
    {
      note: "update_caught：throwinjury 的下界用 0",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (ti > 0) throwinjury = ti;`,
      to: `  if (ti >= 0) throwinjury = ti;`,
    },
    {
      note: "update_caught：throwv 不放手",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (truthy(tx) || truthy(ty) || truthy(tz)) {
    follow_catcher();
    catcher = nullptr;
    _prev_cpoint_a = Value(NullTag{});
  }`,
      to: `  if (false) {
    follow_catcher();
    catcher = nullptr;
    _prev_cpoint_a = Value(NullTag{});
  }`,
    },
    {
      note: "update_caught：vaction 不进帧",
      file: "native/lfw/entity/entity.cpp",
      from: `    return static_cast<int>(enter_frame(vaction)) >= static_cast<int>(EnterFrameResult::Entered);`,
      to: `    return false;`,
    },

    {
      note: "view base：dataset 转发到 world_dataset",
      file: "native/lfw/entity/entity.cpp",
      from: `  if (nullish(v)) v = world().dataset.get(name);`,
      to: `  v = world().dataset.get(name);`,
    },
    {
      note: "state view：world_dataset 转发到 dataset",
      file: "native/lfw/entity/entity.cpp",
      from: `Value Entity::world_dataset(const std::u16string& name) const {
  return world().dataset.get(name);
}`,
      to: `Value Entity::world_dataset(const std::u16string& name) const {
  return dataset(name);
}`,
    },

  ],
};
