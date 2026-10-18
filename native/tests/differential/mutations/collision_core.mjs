// collision_core 变异规格
//
// 覆盖 native/lfw/collision/collision.cpp 的 collision_new / collision_test /
// collision_get / collision_to_snapshot / collision_from_snapshot / collision_clone。
//
// 两条按证明删除的变异（不可观测，故不列入）：
// 1) `truthy(v.emitter)` -> `truthy(a.emitter)`：该 && 链中紧随其后的
//    `strict_equals(v.emitter, a.emitter)` 在两者真假性不同时必为 false，
//    于是两种写法都「不排除」该次碰撞，结果恒等。
// 2) `strict_equals(v.team, a.team)` 与 `strict_equals(v.spawn_time, a.spawn_time)`
//    的「交换」同理不可观测（同一条 && 链上，spawn 相等已由用例覆盖为可观测差异）。
// 3) `get` 的 `if (!ni || !nj) return nullptr;` -> `&&`：该守卫是纯提前退出，
//    任一侧为空数组时循环体一次也不执行，返回值同样是 nullptr。
// 4) `get` 的双层循环次序反转：成对成立性 = 两侧各自谓词的合取，
//    可通过的组合构成乘积集，其字典序最小元在两种遍历次序下相同。
// 5) `if (!truthy(prefab_id)) itr_index = -1;` 的取反、以及该分支整体短路：
//    prefab_id 为假时，紧接着的 `index_by(a.itr_prefabs, to_string(prefab_id), ...)`
//    也必定失败（对象/数组上取不到 "undefined" 键），两条路径都得到 itr_index = -1。
//    两者都不产生可观测差异，故不列入。
// 6) `c.dataset = dataset;` 的删除：TS 的 Collision 并不携带 dataset（它只在 collision_new
//    内部用于计算 rest）。可移植体里的 Collision::dataset 只是 handlers 单元的行为缝字段，
//    由那个单元的 harness 直接设置，与本单元无关。
export default {
  subject: "collision_core",
  mutations: [
    // ---- collision_new：WeaponSwing 与 itr_prefab ----
    {
      note: "new 招式类型判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "if (itr_kind_is(o.itr, ItrKind::WeaponSwing)) {",
      to: "if (!itr_kind_is(o.itr, ItrKind::WeaponSwing)) {",
    },
    {
      note: "new 不再查 itr_prefabs",
      file: "native/lfw/collision/collision.cpp",
      from: "    else if (!index_by(a.itr_prefabs(), to_string(prefab_id), prefab))",
      to: "    else if (false)",
    },
    {
      note: "new prefab 合并顺序反转",
      file: "native/lfw/collision/collision.cpp",
      from: "      itr = spread_assign(o.itr, prefab);",
      to: "      itr = spread_assign(prefab, o.itr);",
    },
    // ---- collision_new：rest 计算 ----
    {
      note: "new rest 第一分支条件用或",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!truthy(field_or(itr, u\"arest\")) && truthy(field_or(itr, u\"vrest\"))) {",
      to: "  if (!truthy(field_or(itr, u\"arest\")) || truthy(field_or(itr, u\"vrest\"))) {",
    },
    {
      note: "new rest 第一分支取 min",
      file: "native/lfw/collision/collision.cpp",
      from: "    rest = max(min_vrest, to_number(field_or(itr, u\"vrest\")) + vrest_offset);",
      to: "    rest = min(min_vrest, to_number(field_or(itr, u\"vrest\")) + vrest_offset);",
    },
    {
      note: "new rest 第二分支丢掉 marks",
      file: "native/lfw/collision/collision.cpp",
      from: "  } else if (itr_kind_is(itr, ItrKind::Normal) && a.marks_group_attack()) {",
      to: "  } else if (itr_kind_is(itr, ItrKind::Normal)) {",
    },
    {
      note: "new rest 第二分支用 itr_shaking 之外的基础值取反",
      file: "native/lfw/collision/collision.cpp",
      from: "    const double base = truthy(ar) ? to_number(ar) : to_number(field_or(dataset, u\"itr_arest\"));",
      to: "    const double base = truthy(ar) ? to_number(field_or(dataset, u\"itr_arest\")) : to_number(ar);",
    },
    {
      note: "new rest 第二分支偏移符号取反",
      file: "native/lfw/collision/collision.cpp",
      from: "    rest = max(min_vrest, base + vrest_offset);",
      to: "    rest = max(min_vrest, base - vrest_offset);",
    },
    // ---- collision_new：字段装配 ----
    {
      note: "new id 未按 rest 取新 id",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.id = rest ? core.new_id() : a.id();",
      to: "  c.id = a.id();",
    },
    {
      note: "new id 判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.id = rest ? core.new_id() : a.id();",
      to: "  c.id = rest ? a.id() : core.new_id();",
    },
    {
      note: "new 攻击方当受击方",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.attacker = a;\n  c.victim = v;",
      to: "  c.attacker = v;\n  c.victim = a;",
    },
    {
      note: "new 坐标取反赋值",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.ax = ax;\n  c.ay = ay;",
      to: "  c.ax = ay;\n  c.ay = ax;",
    },
    {
      note: "new vy 未赋值",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.vx = vx;\n  c.vy = vy;\n  c.vz = vz;",
      to: "  c.vx = vx;\n  c.vz = vz;",
    },
    {
      note: "new dz 未赋值",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.dx = dx;\n  c.dy = dy;\n  c.dz = dz;",
      to: "  c.dx = dx;\n  c.dy = dy;",
    },
    {
      note: "new m_distance 只取 x",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.m_distance = abs(dx) + abs(dy) + abs(dz);",
      to: "  c.m_distance = abs(dx) + dy + dz;",
    },
    {
      note: "new 两侧立方体互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.a_cube = a_cube;\n  c.b_cube = b_cube;",
      to: "  c.a_cube = b_cube;\n  c.b_cube = a_cube;",
    },
    {
      note: "new aframe_id 取 bframe",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.aframe_id = to_string(field_or(o.aframe, u\"id\"));",
      to: "  c.aframe_id = to_string(field_or(o.bframe, u\"id\"));",
    },
    {
      note: "new itr_index 用入参而非局部量",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.itr_index = itr_index;",
      to: "  c.itr_index = o.itr_index;",
    },
    {
      note: "new itr 未合并存档",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.itr = itr;\n  c.bdy = o.bdy;",
      to: "  c.itr = o.itr;\n  c.bdy = o.bdy;",
    },
    {
      note: "new 复用池对象时不清 handlers",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (c.handlers)\n    c.handlers->clear();\n  else\n    c.handlers = std::make_shared<std::vector<std::u16string>>();",
      to: "  if (!c.handlers) c.handlers = std::make_shared<std::vector<std::u16string>>();",
    },
    {
      note: "new priority 取受击方类型",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.priority = core.priority_of(a.data_type());",
      to: "  c.priority = core.priority_of(v.data_type());",
    },
    {
      note: "new injury 初值不为 null",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.injury = Value(NullTag{});",
      to: "  c.injury = Value(0.0);",
    },
    {
      note: "new real_injury 初值不为 null",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.real_injury = Value(NullTag{});",
      to: "  c.real_injury = Value(0.0);",
    },
    {
      note: "new aid/vid 互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  c.aid = a.id();\n  c.vid = v.id();",
      to: "  c.aid = v.id();\n  c.vid = a.id();",
    },
    // ---- collision_test ----
    {
      note: "test bdy_index 负值不拦",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (c.bdy_index < 0) return false;",
      to: "  if (c.bdy_index < -1) return false;",
    },
    {
      note: "test itr_index 负值不拦",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (c.itr_index < 0) return false;",
      to: "  if (c.itr_index < -1) return false;",
    },
    {
      note: "test dropping 判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (a.dropping()) return false;",
      to: "  if (!a.dropping()) return false;",
    },
    {
      note: "test arest 与 rest 关系取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!c.rest && truthy(a.arest())) return false;",
      to: "  if (c.rest && truthy(a.arest())) return false;",
    },
    {
      note: "test v_rest 判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (c.rest && c.core->victim_get_v_rest(c)) return false;",
      to: "  if (c.rest && !c.core->victim_get_v_rest(c)) return false;",
    },
    {
      note: "test Heal 跳过判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!itr_kind_is(c.itr, ItrKind::Heal)) {",
      to: "  if (itr_kind_is(c.itr, ItrKind::Heal)) {",
    },
    {
      note: "test 无敌判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "    if (truthy(v.invulnerable())) return false;",
      to: "    if (!truthy(v.invulnerable())) return false;",
    },
    {
      note: "test 被抓者 hurtable 比较值错",
      file: "native/lfw/collision/collision.cpp",
      from: "    if (v.has_catcher() && !strict_equals(v.catcher_hurtable(), Value(1.0))) return false;",
      to: "    if (v.has_catcher() && !strict_equals(v.catcher_hurtable(), Value(0.0))) return false;",
    },
    {
      note: "test 被抓者前置条件取反",
      file: "native/lfw/collision/collision.cpp",
      from: "    if (v.has_catcher() && !strict_equals(v.catcher_hurtable(), Value(1.0))) return false;",
      to: "    if (!v.has_catcher() && !strict_equals(v.catcher_hurtable(), Value(1.0))) return false;",
    },
    {
      note: "test 丢掉 PickSecretly",
      file: "native/lfw/collision/collision.cpp",
      from: "  if ((itr_kind_is(c.itr, ItrKind::Pick) || itr_kind_is(c.itr, ItrKind::PickSecretly)) &&",
      to: "  if ((itr_kind_is(c.itr, ItrKind::Pick) || false) &&",
    },
    {
      note: "test bot_ignore 比较值错",
      file: "native/lfw/collision/collision.cpp",
      from: "      strict_equals(v.bot_ignore(), Value(1.0)) && a.is_bot_ctrl())",
      to: "      strict_equals(v.bot_ignore(), Value(2.0)) && a.is_bot_ctrl())",
    },
    {
      note: "test 机器人判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "      strict_equals(v.bot_ignore(), Value(1.0)) && a.is_bot_ctrl())",
      to: "      strict_equals(v.bot_ignore(), Value(1.0)) && !a.is_bot_ctrl())",
    },
    {
      note: "test 左边界比较反向",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (ac.left > bc.right || ac.right < bc.left || ac.bottom > bc.top || ac.top < bc.bottom ||",
      to: "  if (bc.right > ac.left || ac.right < bc.left || ac.bottom > bc.top || ac.top < bc.bottom ||",
    },
    {
      note: "test 右边界比较反向",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (ac.left > bc.right || ac.right < bc.left || ac.bottom > bc.top || ac.top < bc.bottom ||",
      to: "  if (ac.left > bc.right || bc.left < ac.right || ac.bottom > bc.top || ac.top < bc.bottom ||",
    },
    {
      note: "test 下边界比较反向",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (ac.left > bc.right || ac.right < bc.left || ac.bottom > bc.top || ac.top < bc.bottom ||",
      to: "  if (ac.left > bc.right || ac.right < bc.left || bc.top > ac.bottom || ac.top < bc.bottom ||",
    },
    {
      note: "test 上边界比较反向",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (ac.left > bc.right || ac.right < bc.left || ac.bottom > bc.top || ac.top < bc.bottom ||",
      to: "  if (ac.left > bc.right || ac.right < bc.left || ac.bottom > bc.top || bc.bottom < ac.top ||",
    },
    {
      note: "test far/near 比较反向",
      file: "native/lfw/collision/collision.cpp",
      from: "      ac.far > bc.near || ac.near < bc.far)",
      to: "      ac.near > bc.near || ac.near < bc.far)",
    },
    {
      note: "test near/far 比较反向",
      file: "native/lfw/collision/collision.cpp",
      from: "      ac.far > bc.near || ac.near < bc.far)",
      to: "      ac.far > bc.near || bc.far < ac.near)",
    },
    {
      note: "test 队伍标志取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  const double ally_flag = c.core->attacker_is_ally(c) ? static_cast<double>(HitFlag::Ally)\n                                                      : static_cast<double>(HitFlag::Enemy);",
      to: "  const double ally_flag = c.core->attacker_is_ally(c) ? static_cast<double>(HitFlag::Enemy)\n                                                      : static_cast<double>(HitFlag::Ally);",
    },
    {
      note: "test bdy hit_flag 缺省判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "      missing(bdy_flag_v) ? static_cast<double>(HitFlag::AllEnemy) : to_number(bdy_flag_v);",
      to: "      missing(bdy_flag_v) ? static_cast<double>(HitFlag::AllEnemy) : static_cast<double>(HitFlag::AllEnemy);",
    },
    {
      note: "test itr hit_flag 缺省判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "      missing(itr_flag_v) ? static_cast<double>(HitFlag::AllEnemy) : to_number(itr_flag_v);",
      to: "      missing(itr_flag_v) ? static_cast<double>(HitFlag::AllEnemy) : static_cast<double>(HitFlag::AllEnemy);",
    },
    {
      note: "test itr 类型位判定换了操作数",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!bit_and(itr_flag, v.data_type()) || !bit_and(bdy_flag, a.data_type()) ||",
      to: "  if (!bit_and(bdy_flag, v.data_type()) || !bit_and(bdy_flag, a.data_type()) ||",
    },
    {
      note: "test bdy 类型位判定换了操作数",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!bit_and(itr_flag, v.data_type()) || !bit_and(bdy_flag, a.data_type()) ||",
      to: "  if (!bit_and(itr_flag, v.data_type()) || !bit_and(itr_flag, a.data_type()) ||",
    },
    {
      note: "test 队伍位双条件用或",
      file: "native/lfw/collision/collision.cpp",
      from: "      (!bit_and(itr_flag, ally_flag) && !bit_and(bdy_flag, ally_flag)))",
      to: "      (!bit_and(itr_flag, ally_flag) || !bit_and(bdy_flag, ally_flag)))",
    },
    {
      note: "test 同队判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (strict_equals(v.team(), a.team()) && truthy(v.emitter()) &&\n      strict_equals(v.emitter(), a.emitter()) &&",
      to: "  if (!strict_equals(v.team(), a.team()) && truthy(v.emitter()) && strict_equals(v.emitter(), a.emitter()) &&",
    },
    {
      note: "test 同发射者判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (strict_equals(v.team(), a.team()) && truthy(v.emitter()) &&\n      strict_equals(v.emitter(), a.emitter()) &&",
      to: "  if (strict_equals(v.team(), a.team()) && truthy(v.emitter()) && !strict_equals(v.emitter(), a.emitter()) &&",
    },
    {
      note: "test 同生成时刻判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "      strict_equals(v.emitter(), a.emitter()) && strict_equals(v.spawn_time(), a.spawn_time()))",
      to: "      strict_equals(v.emitter(), a.emitter()) && !strict_equals(v.spawn_time(), a.spawn_time()))",
    },
    {
      note: "test bdy 块改读 itr 测试器",
      file: "native/lfw/collision/collision.cpp",
      from: "  const Value bdy_tester = field_or(c.bdy, u\"__tester\");",
      to: "  const Value bdy_tester = field_or(c.itr, u\"__tester\");",
    },
    {
      note: "test bdy 测试器不拦",
      file: "native/lfw/collision/collision.cpp",
      from: "    if (!ret) return false;\n  }\n  const Value itr_tester = field_or(c.itr, u\"__tester\");",
      to: "    if (false) return false;\n  }\n  const Value itr_tester = field_or(c.itr, u\"__tester\");",
    },
    {
      note: "test bdy 调试日志的 dev 判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "    if (c.core->dev()) c.core->log(u\"bdy.__tester: \" + to_string(c.core->tester_debug(bdy_tester)));",
      to: "    if (!c.core->dev()) c.core->log(u\"bdy.__tester: \" + to_string(c.core->tester_debug(bdy_tester)));",
    },
    {
      note: "test itr 调试日志的 dev 判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "    if (c.core->dev()) c.core->log(u\"itr.__tester: \" + to_string(c.core->tester_debug(itr_tester)));",
      to: "    if (!c.core->dev()) c.core->log(u\"itr.__tester: \" + to_string(c.core->tester_debug(itr_tester)));",
    },
    {
      note: "test 忽略 load_handlers 结果",
      file: "native/lfw/collision/collision.cpp",
      from: "  return c.core->load_handlers(c);",
      to: "  c.core->load_handlers(c);\n  return true;",
    },
    // ---- collision_get ----
    {
      note: "get aframe 误当 bframe",
      file: "native/lfw/collision/collision.cpp",
      from: "      inits.aframe = attacker.frame();\n      inits.bframe = victim.frame();",
      to: "      inits.aframe = victim.frame();\n      inits.bframe = attacker.frame();",
    },
    {
      note: "get itr_index 用了 j",
      file: "native/lfw/collision/collision.cpp",
      from: "      inits.itr_index = static_cast<double>(i);\n      inits.bdy_index = static_cast<double>(j);",
      to: "      inits.itr_index = static_cast<double>(j);\n      inits.bdy_index = static_cast<double>(j);",
    },
    {
      note: "get 命中判定取反",
      file: "native/lfw/collision/collision.cpp",
      from: "      if (!collision_test(c)) continue;",
      to: "      if (collision_test(c)) continue;",
    },
    // ---- snapshot ----
    {
      note: "snapshot aid/vid 互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  s.aid = c.aid;\n  s.vid = c.vid;",
      to: "  s.aid = c.vid;\n  s.vid = c.aid;",
    },
    {
      note: "snapshot 两帧 id 互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  s.aframe_id = c.aframe_id;\n  s.bframe_id = c.bframe_id;",
      to: "  s.aframe_id = c.bframe_id;\n  s.bframe_id = c.aframe_id;",
    },
    {
      note: "snapshot 两索引互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  s.itr_index = c.itr_index;\n  s.bdy_index = c.bdy_index;",
      to: "  s.itr_index = c.bdy_index;\n  s.bdy_index = c.itr_index;",
    },
    {
      note: "snapshot ax 取 ay",
      file: "native/lfw/collision/collision.cpp",
      from: "  s.ax = c.ax;\n  s.ay = c.ay;",
      to: "  s.ax = c.ay;\n  s.ay = c.ay;",
    },
    {
      note: "snapshot 距离缺失",
      file: "native/lfw/collision/collision.cpp",
      from: "  s.m_distance = c.m_distance;\n  s.rest = c.rest;",
      to: "  s.rest = c.rest;",
    },
    {
      note: "from_snap 用 vid 找攻击方",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!core.find_entity(s.aid, inits.attacker)) return nullptr;\n  if (!core.find_entity(s.vid, inits.victim)) return nullptr;",
      to: "  if (!core.find_entity(s.vid, inits.attacker)) return nullptr;\n  if (!core.find_entity(s.vid, inits.victim)) return nullptr;",
    },
    {
      note: "from_snap 数据查找互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!core.find_object_data(s.adata_id, adata)) return nullptr;\n  Value vdata;\n  if (!core.find_object_data(s.vdata_id, vdata)) return nullptr;",
      to: "  if (!core.find_object_data(s.vdata_id, adata)) return nullptr;\n  Value vdata;\n  if (!core.find_object_data(s.vdata_id, vdata)) return nullptr;",
    },
    {
      note: "from_snap 帧表查找互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!index_by(field_or(adata, u\"frames\"), s.aframe_id, inits.aframe)) return nullptr;\n  if (!index_by(field_or(vdata, u\"frames\"), s.bframe_id, inits.bframe)) return nullptr;",
      to: "  if (!index_by(field_or(vdata, u\"frames\"), s.aframe_id, inits.aframe)) return nullptr;\n  if (!index_by(field_or(vdata, u\"frames\"), s.bframe_id, inits.bframe)) return nullptr;",
    },
    {
      note: "from_snap itr/bdy 索引互换",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!index_by(field_or(inits.aframe, u\"itr\"), to_string(s.itr_index), inits.itr)) return nullptr;\n  if (!index_by(field_or(inits.aframe, u\"bdy\"), to_string(s.bdy_index), inits.bdy)) return nullptr;",
      to: "  if (!index_by(field_or(inits.aframe, u\"itr\"), to_string(s.bdy_index), inits.itr)) return nullptr;\n  if (!index_by(field_or(inits.aframe, u\"bdy\"), to_string(s.bdy_index), inits.bdy)) return nullptr;",
    },
    {
      note: "from_snap 从 bframe 取 bdy（修掉原样怪癖）",
      file: "native/lfw/collision/collision.cpp",
      from: "  if (!index_by(field_or(inits.aframe, u\"bdy\"), to_string(s.bdy_index), inits.bdy)) return nullptr;",
      to: "  if (!index_by(field_or(inits.bframe, u\"bdy\"), to_string(s.bdy_index), inits.bdy)) return nullptr;",
    },
    {
      note: "from_snap 不写回 snapshot 坐标",
      file: "native/lfw/collision/collision.cpp",
      from: "  ret.ax = s.ax;\n  ret.ay = s.ay;",
      to: "  ret.ay = s.ay;",
    },
    {
      note: "from_snap 距离写错字段",
      file: "native/lfw/collision/collision.cpp",
      from: "  ret.m_distance = s.m_distance;\n  ret.rest = s.rest;",
      to: "  ret.m_distance = s.rest;\n  ret.rest = s.rest;",
    },
    {
      note: "clone 不换新 id",
      file: "native/lfw/collision/collision.cpp",
      from: "  out = src;\n  out.id = core.new_id();",
      to: "  out = src;",
    },
  ],
};
