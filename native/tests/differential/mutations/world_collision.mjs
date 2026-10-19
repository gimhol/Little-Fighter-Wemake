// `World::step` 的碰撞配对（`native/lfw/world.cpp`）与 `WorldCollisionHost` 的 Env 接线
// （`native/lfw/world_collision.cpp`）的变异档。用例是 `cases/world/collision.txt`
// （一个世界、十组实体：x=0 单向 / 3000 双向 / 6000 `hit_flag` 不匹配 / 9000 同队 /
// 12000 `SuperPunchMe` / 15000 `Catch` / 1000 Pick / 1000 Pick 的 bot 门 /
// 24000 Block（`handle_rest`）/ 27000 Freeze）。
//
// 有意不覆盖（不可观察 / 按构造等价 / 要等「dump 扩展 + 更多 handler 路径用例」那一刀）：
//
// 【配对循环】
//   * `if (frame_is_gone(*b)) continue;`：三组实体都不是幽灵（帧 id 都是 `"0"`）⇒ 够不着。
//   * z 轴的 AABB 剔除（`a_max_z < b->aabb_min_z || b->aabb_max_z < a_min_z`）：这一刀的实体
//     AABB 全是 0 ⇒ `0 < 0` 两侧都假 ⇒ `||` 与 `&&` 等价。
//   * `collision_host().reset_collisions()`：`acquire_collision` 每次给新对象 ⇒ 清不清池子
//     一样（这一句只是防内存涨）。
//   * `c2 = collision_get(*b, *a)` 写成 `collision_get(*a, *b)`：两条碰撞的 `id` 都是攻击方 id
//     （`rest == 0`），`add_collision` 对同 id 同距离的记录会直接返回 ⇒ 观察不到。
//   * `p1` / `p2` 的 `?? Infinity`：三组实体的类型（8）在 `ENTITY_PRIORITY_MAP` 里**同进同出**
//     ⇒ 两侧要么都有值、要么都是 `undefined`；后者经这条规则都变成 `Infinity` ⇒ 与「不补
//     Infinity」在 `<=` 下等价（`undefined <= undefined` 与 `Infinity <= Infinity` 都假，
//     而只有一侧为 `undefined` 时才分岔 —— 那要一组跨类型的实体，留给下一刀）。
//
// 【宿主缝】这一刀的用例观测 `pc=`（配对比次）、`col=`（本帧加入的碰撞数）、受击方 `hp`，以及
// `dump_entity` 里的碰撞观测量（`motionless` / `shaking` / `catching` / `catcher` / `holding` /
// `vrests.size` / `collided_list.length` / `collision_list.length` / `resting` / `fall_value` /
// `is_on_ground` / `arest`）。用例扩到十组实体之后，这些字段都取到了可分辨的非零值
// （`motionless` = 8、`shaking` = 8、`vrests` = 1、`collided_list` = 1/5/7、`collision_list`
// = 1、`resting` = 5、`fall_value` = 0/100/140、`catching` / `catcher` 互指、`holding` = 武器 id、
// `arest` = 20）⇒ 回写类的缝都能锁住了：
//   * `bot_ignore`（只在 Pick 系的 itr kind 上读）、`is_bot_ctrl`、`team` / `emitter` /
//     `spawn_time`（用例里三者的组合本来就放行）、`catcher_hurtable`（`has_catcher` 为假时不读）、
//     `marks_group_attack` / `itr_prefabs` / `bear_wpoint_attacking`（`rest` 仍是 0）、
//     `px/py/pz` 与 `data_id`（只进快照与 `m_distance`，用例里不影响判定）；
//   * `get_bounding` 的每个字段：用例的两颗判定框**完全重合**（左右上下远近各自相等）⇒ 交换
//     左右一类的改动两侧同向，不产生差异 —— 要锁住得加一组「部分重叠」的实体；
//   * `find_entity` / `find_object_data`（`CollisionCoreEnv` 的两条）：**唯一消费者**是
//     `collision_from_snapshot`（`collision/` 层的水合入口），而 `World::step` 从不水合快照
//     （`Entity::vrests` / `colliders` 存的是整份 `Collision`）⇒ 本 spec 的用例
//     （`world/collision.txt`）够不着。要在世界这一侧试出来，得先给世界加一条「水合碰撞」的
//     用例；那两条缝的行为已在 `collision_core` subject 里锁住（见 `cases/collision_core/main.txt`
//     的 `snap` / `setsnap` / `fromsnap`）。
//   * `dataset` / `victim_get_v_rest` / `attacker_is_ally` / `new_id` / `log` / `dev` /
//     `find_entity` / `find_object_data` / `load_handlers`：这一条路径上要么不读（`rest` 为 0、
//     `dev` 为假），要么结果与改动无关；
//   * `KeeperEnv` 的 `attacker_state` / `victim_state`（配置里没有 `a_state` / `v_state` 过滤）、
//     `ball_frozen`（`handle_ball_frozen` 是给气功波的）、`run_action`（用例的 `itr` / `bdy`
//     没有 `actions`）、`victim_play_sound` 与 `victim_data`（台面的 `play_sound` 不记日志，
//     两条缝的效果都不进输出）；
//   * `HandlersEnv` 的其余几条（`attacker_pick_victim` 要 Pick 系 itr kind —— 用例里
//     `holding` 全是 `-`；`attacker_set_arest` 的结果 dump 里没有；`buff_*` 要 `magic_flute`
//     或 `Electrify` 才走）；
//   * **Pick 的 bot 门那两条缝（`bot_ignore` / `is_bot_ctrl`）**：用例第 8 组是「bot 攻击方 +
//     帧里 `bot_ignore: 1` 的武器」，但**实测不可观察** —— 手工把 `a.bot_ignore` 置 `Value()`、
//     把 `a.is_bot_ctrl` 置恒假，两次 `build` + `test` 输出**逐行不变**。原因是那件武器的
//     `bot_ignore` 写在**帧**里、又和 `Weapon_OnGround` 的状态机纠缠：第 7 组的普通武器（同样
//     形状、同样 x）会被捡起（`holding` 变 id），带 `bot_ignore` 的那件不会 ⇒ Pick 的配对要么
//     没成、要么成了但 keeper 那一趟没有配置命中（两边的观测都为零）。要锁它们得先找到一组
//     「bot 攻击方 + 真能走完 `collision_test` → 配置命中 → `pick`」的实体（留给 Pick 专属用例）。
//   * **第 13–16 组那四条支路（Whirlwind / weapon_is_hit / ball_hit_other / healing）**：
//     用例有了这四组（碰撞也都成了：`collided_list` 各 +1），但它们的**效果观测不到** ——
//     `Whirlwind` 对 Fighter 受害方只改速度，`weapon_is_hit` / `ball_*` 也只改速度（`set_velocity`
//     之后在 `step` 里被清成 0，dump 里 6 个速度列全是 `0`），`healing` 只往 buff 表里塞一条
//     （buff 表没进 dump）。所以这一刀**没有新增变异条目**；要锁它们得先把观测面再往前推一层
//     （速度在 `step` 里被清是台面行为，得换成「只跑 handler 不跑完整 `step`」或把 buff 表进 dump）。
//   * `ActionEnv` / `Handlers2-4Env` 里没被这条路径调用的那些（`Handlers2Env` 只走了
//     `find_entity` / `hp_recoverability` / `summary_apply_damage` / `is_fighter` / `calc_velocity`
//     / `buff_env`，其中 `hp_recoverability` 与 `calc_velocity` 的结果进了 `hp_r` / 速度，
//     前者 dump 里没有、后者被 `handle_fall` 的 `set_velocity` 吃掉 ⇒ 也够不着）；
//   * 视图层已在 4CE 退役（`EntityCollisionView` / `ICollisionViewHost` 连同 `I*Entity` 窄接口一并
//     删除），`handle_itr_catch` 现在直接写 `Entity::catching` / `Entity::catcher`
//     （`collision/handlers2.cpp`）⇒ 原先锁视图方法的 `catcher` / `set_catching` / `set_catcher`
//     三条变异改由 `collision_handlers2.mjs` 覆盖，本档不再重复。
//   * `step: 宿主不再置当前那一对（collision_get 的包装器）`：**实测**（手工去掉两行 + `build`
//     + 对比输出：零差异）—— `collision_get` 期间的 `collision_test` 只在这条缝上读
//     `attacker_is_ally`，而用例里没有任何一对能在这一步分岔（场景 4 试过「同队」：
//     `went G team t1` / `went H team t1`，但两者的判定在此之前就没走到那一行）。要锁住它得先
//     找到一对「只在 ally 位上分岔」的实体（`is_ally` 的专属用例，或 `LFW` 那一刀的真玩家）。
export default {
  subject: "world",
  cases: ["collision", "lifecycle"],
  mutations: [
    // ───────────────────────── 配对循环 ─────────────────────────
    {
      note: "step: AABB 的 x 方向用 <= 提前 break（相等的 a_max_x 也断）",
      file: "native/lfw/world.cpp",
      from: "      if (a_max_x < b->aabb_min_x) break;",
      to: "      if (a_max_x <= b->aabb_min_x) break;",
    },
    {
      note: "step: pairs_compared 加二",
      file: "native/lfw/world.cpp",
      from: "      pairs_compared += 1.0;",
      to: "      pairs_compared += 2.0;",
    },
    {
      note: "step: c1 取反方向（(b,a) 而不是 (a,b)）",
      file: "native/lfw/world.cpp",
      from: "      collision::Collision* const c1 = collision_host().collision_get(*a, *b);",
      to: "      collision::Collision* const c1 = collision_host().collision_get(*b, *a);",
    },
    {
      note: "step: 不 add c1",
      file: "native/lfw/world.cpp",
      from: "      if (c1 != nullptr && le(p1, p2)) add_collision(*c1);",
      to: "      if (c1 == nullptr && le(p1, p2)) add_collision(*c1);",
    },
    {
      note: "step: 不 add c2",
      file: "native/lfw/world.cpp",
      from: "      if (c2 != nullptr && le(p2, p1)) add_collision(*c2);",
      to: "      if (c2 == nullptr && le(p2, p1)) add_collision(*c2);",
    },
    {
      note: "step: c2 也用 (a,b)（双向那一组只剩一条）",
      file: "native/lfw/world.cpp",
      from: "      collision::Collision* const c2 = collision_host().collision_get(*b, *a);",
      to: "      collision::Collision* const c2 = collision_host().collision_get(*a, *b);",
    },
    // ─────────────────────── `ActorHandle` 的活读 ───────────────────────
    // 投影本身在 `collision/actor_handle.cpp`（TS 的 `c.attacker.xxx` 直读实体），
    // 所以这几条锚在那边。
    {
      note: "data_type 恒 0（hit_flag 判定全灭）",
      file: "native/lfw/collision/actor_handle.cpp",
      from: "  return e != nullptr ? to_number(field_or(e->data(), u\"type\")) : snapshot().data_type;",
      to: "  return e != nullptr ? 0.0 : snapshot().data_type;",
    },
    {
      note: "frame 恒 undefined（itr / bdy 都取不到）",
      file: "native/lfw/collision/actor_handle.cpp",
      from: "  return e != nullptr ? e->frame : snapshot().frame;",
      to: "  return e != nullptr ? Value() : snapshot().frame;",
    },
    {
      note: "dropping 恒真",
      file: "native/lfw/collision/actor_handle.cpp",
      from: "  return e != nullptr ? e->dropping : snapshot().dropping;",
      to: "  return e != nullptr ? true : snapshot().dropping;",
    },
    {
      note: "arest 恒 1（无 rest 时直接拦掉）",
      file: "native/lfw/collision/actor_handle.cpp",
      from: "  return e != nullptr ? Value(e->arest()) : snapshot().arest;",
      to: "  return e != nullptr ? Value(1.0) : snapshot().arest;",
    },
    {
      note: "invulnerable 恒 1",
      file: "native/lfw/collision/actor_handle.cpp",
      from: "  return e != nullptr ? Value(e->invulnerable()) : snapshot().invulnerable;",
      to: "  return e != nullptr ? Value(1.0) : snapshot().invulnerable;",
    },
    {
      note: "has_catcher 恒真",
      file: "native/lfw/collision/actor_handle.cpp",
      from: "  return e != nullptr ? e->catcher != nullptr : snapshot().has_catcher;",
      to: "  return e != nullptr ? true : snapshot().has_catcher;",
    },
    // ─────────────────────── handler 分发 ───────────────────────
    {
      note: "keeper: 丢掉 normal_bdy_normal 这一支",
      file: "native/lfw/world_collision.cpp",
      from: "    } else if (fn == u\"handle_itr_normal_bdy_normal\") {",
      to: "    } else if (false && fn == u\"handle_itr_normal_bdy_normal\") {",
    },
    {
      note: "keeper: normal_bdy_normal 换成分掉血的 handle_rest",
      file: "native/lfw/world_collision.cpp",
      from: "      collision::handle_itr_normal_bdy_normal(c);",
      to: "      collision::handle_rest(c);",
    },
    {
      note: "keeper: 丢掉 Catch 那一支（`catching` / `catcher` 不再互相指）",
      file: "native/lfw/world_collision.cpp",
      from: "    if (fn == u\"handle_itr_catch\") {",
      to: "    if (false && fn == u\"handle_itr_catch\") {",
    },
    // ───────────── 宿主在 `handle` 里补的三个字段（4C 留的行为缝） ─────────────
    {
      note: "handle: 不补 c.dataset（`handle_stiffness` 的 itr_shaking 回退读到 undefined）",
      file: "native/lfw/world_collision.cpp",
      from: "  c.dataset = _world->world_dataset();",
      to: "  c.dataset = Value();",
    },
    // ───────────── `KeeperEnv` 的回写（`collided_list` / `collision_list` 已进 dump） ─────────────
    {
      note: "keeper: victim_push_collided 空实现（`collided_list` 不长）",
      file: "native/lfw/world_collision.cpp",
      from: "    v->lastest_collided = c;\n    v->collided_list.push_back(c);",
      to: "    (void)v;",
    },
    {
      note: "keeper: attacker_push_collision 空实现（`collision_list` 不长）",
      file: "native/lfw/world_collision.cpp",
      from: "    if (a != nullptr) a->collision_list.push_back(c);",
      to: "    (void)a;",
    },
    // ───────────── `HandlersEnv` 的回写（`motionless` / `shaking` / `vrests` 已进 dump） ─────────────
    {
      note: "handlers: victim_add_v_rest 空实现（受害方的 `vrests` 不长）",
      file: "native/lfw/world_collision.cpp",
      from: "    if (v != nullptr) v->add_v_rest(c);",
      to: "    (void)v;",
    },
    {
      note: "handlers: attacker_itr_motionless 恒 undefined",
      file: "native/lfw/world_collision.cpp",
      from: "    return a == nullptr ? Value() : Value(a->itr_motionless());",
      to: "    (void)a;\n    return Value();",
    },
    {
      note: "handlers: attacker_set_motionless 空实现（攻击方的 `motionless` 不进实体）",
      file: "native/lfw/world_collision.cpp",
      from: "    if (a != nullptr) a->set_motionless(to_number(v));",
      to: "    (void)a;\n    (void)v;",
    },
    {
      note: "handlers: victim_set_shaking 空实现（受害方的 `shaking` 不进实体）",
      file: "native/lfw/world_collision.cpp",
      from: "    if (victim != nullptr) victim->set_shaking(to_number(v));",
      to: "    (void)victim;\n    (void)v;",
    },
    // ───────────── `handle_itr_catch` 那三条视图方法（4CE 已随视图层删除） ─────────────
    // 视图层（`EntityCollisionView` / `ICollisionViewHost`）退役后 `handle_itr_catch` 直接写
    // `Entity::catching` / `Entity::catcher`（见 `collision/handlers2.cpp`）⇒ 原先锁视图方法的那
    // 三条变异改由 `collision_handlers2.mjs` 覆盖，这里不再重复。
    // ───────────── Pick / `handle_rest` / Freeze 这三条支路（用例第 7–10 组） ─────────────
    {
      note: "keeper: 丢掉 Pick 那一支（武器不再被捡起）",
      file: "native/lfw/world_collision.cpp",
      from: "    } else if (fn == u\"handle_weapon_picked\") {",
      to: "    } else if (false && fn == u\"handle_weapon_picked\") {",
    },
    {
      note: "keeper: 丢掉 Freeze 那一支",
      file: "native/lfw/world_collision.cpp",
      from: "    } else if (fn == u\"handle_itr_kind_freeze\") {",
      to: "    } else if (false && fn == u\"handle_itr_kind_freeze\") {",
    },
    {
      note: "handlers: attacker_pick_victim 空实现（`holding` 不写）",
      file: "native/lfw/world_collision.cpp",
      from: "    if (a != nullptr && v != nullptr) a->pick(*v);",
      to: "    (void)a; (void)v;",
    },
    {
      note: "handlers: attacker_set_arest 空实现（`arest` 不写）",
      file: "native/lfw/world_collision.cpp",
      from: "    if (a != nullptr) a->set_arest(v);",
      to: "    (void)a;\n    (void)v;",
    },
    // ───── `rest` 支与 `get_bounding`（用例第 11/12 组：`vrest` 与「部分重叠」的判定框） ─────
    {
      note: "core: get_bounding 的 left / right 互换（两个框的区间反了）",
      file: "native/lfw/world_collision.cpp",
      from:
        "    cube.left = to_number(field_or(b, u\"left\"));\n" +
        "    cube.right = to_number(field_or(b, u\"right\"));",
      to:
        "    cube.left = to_number(field_or(b, u\"right\"));\n" +
        "    cube.right = to_number(field_or(b, u\"left\"));",
    },
    {
      note: "core: get_bounding 的 bottom / top 互换（同上，y 方向）",
      file: "native/lfw/world_collision.cpp",
      from:
        "    cube.bottom = to_number(field_or(b, u\"bottom\"));\n" +
        "    cube.top = to_number(field_or(b, u\"top\"));",
      to:
        "    cube.bottom = to_number(field_or(b, u\"top\"));\n" +
        "    cube.top = to_number(field_or(b, u\"bottom\"));",
    },
    {
      note: "core: victim_get_v_rest 恒真（`rest` 碰撞一律被拦）",
      file: "native/lfw/world_collision.cpp",
      from: "    return truthy(Value(v->get_v_rest(c.aid)));",
      to: "    (void)v;\n    return true;",
    },
    {
      note: "core: new_id 恒 `1`（`rest` 碰撞的 id 撞车 ⇒ add_collision 去重）",
      file: "native/lfw/world_collision.cpp",
      from: "  _core.new_id = [this]() { return _world->lfw().new_id(); };",
      to:
        "  _core.new_id = [this]() {\n" +
        "    return _world->lfw().dev() ? std::u16string(u\"1\") : std::u16string(u\"1\");\n" +
        "  };",
    },
    {
      note: "core: attacker_is_ally 恒真（`ally_flag` 全变）",
      file: "native/lfw/world_collision.cpp",
      from: "    return a->is_ally(*v);",
      to: "    (void)a;\n    (void)v;\n    return true;",
    },
    // ───── 另外四条宿主缝（4P 之后补：它们的可见处是台面日志与下游行为） ─────
    {
      note: "core: acquire_collision 复用同一个对象（违反 DESIGN §78.5 第 2 条）",
      file: "native/lfw/world_collision.cpp",
      from: "  _core.acquire_collision = [this]() -> collision::Collision& { return acquire_collision(); };",
      to:
        "  _core.acquire_collision = [this]() -> collision::Collision& {\n" +
        "    static collision::Collision reused;\n" +
        "    return reused;\n" +
        "  };",
    },
    {
      note: "core: dev 恒真（`Ditto.DEV` 调试分支全开）",
      file: "native/lfw/world_collision.cpp",
      from: "  _core.dev = [this]() { return _world->lfw().dev(); };",
      to: "  _core.dev = [this]() { return _world != nullptr; };",
    },
  ],
};
