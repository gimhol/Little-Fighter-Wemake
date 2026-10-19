// Mutation spec for the `controller/BallController` slice（用例 `cases/entity/ball_ctrl.txt`，
// subject 仍是 `entity`）。
//
// 头部先记**有意不覆盖**的东西（不是漏掉）：
//  * `update_lookup` 里两处「离自己更远的候选先过滤掉」的分支
//    （`x0 - l.position.x >= found_d` / `r.position.x - x0 >= found_d`）要**三个以上**候选才走得到。
//    harness 只有 `self` / `buddy` 两个实体槽（第三、四个要 `run spawn` 那套 opoint 台面），
//    而把「球自己」当候选时距离是 0（`found_d` 被钉在 0），这两个分支也改不了结果 ⇒ 不列。
//    同一原因（候选唯一时距离不参与决策）`self_ref` 的三个分量也没有可观察变异。
//  * `flag_between` 里 `js_to_int32(a_type)` 那一项（自己 `type` 的位）在用例喂的
//    `flag`（61 = AllType|Enemy）下与「不加 type」同真同假 ⇒ 构造上不可观察，不列。
//  * `set_chase_point` 里 TS 那句 `is_f_num` 断言只有一个 `debugger`（不改变行为）⇒ 端口不搬，
//    没有可变异的东西。
//  * `reset` 里 `frame = EMPTY_FRAME_INFO`：`same_ref` 对「空值 vs 空值」与
//    「EMPTY_FRAME_INFO vs 空值」都给 false ⇒ 本主题同值，不列。
export default {
  subject: "entity",
  mutations: [
    {
      note: "BallController::reset 不清 gave_up",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  gave_up = false;
  dir_x = 0;`,
      to: `  gave_up = true;
  dir_x = 0;`,
    },
    {
      note: "BallController::reset 不清 leave_dir",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  leave_dir = 0;
  frame = empty_frame_info();`,
      to: `  leave_dir = 1;
  frame = empty_frame_info();`,
    },
    {
      note: "chase_point 的惰性初始化判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (!has_chase_point_) copy_self_position();`,
      to: `  if (has_chase_point_) copy_self_position();`,
    },
    {
      note: "set_chase_point 不取整",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  chase_point_.set(round_float(x), round_float(y), round_float(z));`,
      to: `  chase_point_.set(x, y, z);`,
    },
    {
      note: "aim_at 的 y 用减法",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  set_chase_point(ref_x(e), ref_y(e) + height * oy, ref_z(e));`,
      to: `  set_chase_point(ref_x(e), ref_y(e) - height * oy, ref_z(e));`,
    },
    {
      note: "aim_at 的 x/y 取反了",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `double ref_x(const Value& ref) { return ref_pos(ref, u"x"); }`,
      to: `double ref_x(const Value& ref) { return ref_pos(ref, u"y"); }`,
    },
    {
      note: "ref_z 读 x",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `double ref_z(const Value& ref) { return ref_pos(ref, u"z"); }`,
      to: `double ref_z(const Value& ref) { return ref_pos(ref, u"x"); }`,
    },
    {
      note: "should_chase 把 Gone 判成 None",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (strict_equals(oid, Value(std::u16string(frame_id::kGone))) ||`,
      to: `  if (strict_equals(oid, Value(std::u16string(frame_id::kNone))) ||`,
    },
    {
      note: "should_chase 的位与判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  return (js_to_int32(target) & js_to_int32(flag)) == js_to_int32(target);`,
      to: `  return (js_to_int32(target) & js_to_int32(flag)) != js_to_int32(target);`,
    },
    {
      note: "should_chase 用对方的 hp 判 Dead 时给 0",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  const double target = flag_between(ref_team(other), ref_hp(other), ref_type(other), e->team);`,
      to: `  const double target = flag_between(ref_team(other), 0.0, ref_type(other), e->team);`,
    },
    {
      note: "should_chase 把对方的队伍换成自己的",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  const double target = flag_between(ref_team(other), ref_hp(other), ref_type(other), e->team);`,
      to: `  const double target = flag_between(e->team, ref_hp(other), ref_type(other), e->team);`,
    },
    {
      note: "ref_hp 读成 type",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `double ref_hp(const Value& ref) { return to_number(field_or(ref, u"hp")); }`,
      to: `double ref_hp(const Value& ref) { return to_number(field_or(ref, u"type")); }`,
    },
    {
      note: "ref_type 恒 0",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `double ref_type(const Value& ref) { return to_number(field_or(ref, u"type")); }`,
      to: `double ref_type(const Value& ref) { return 0.0; }`,
    },
    {
      note: "reidentify 不认领名单里的新引用",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  const TargetHandle current = chasing;`,
      to: `  const TargetHandle current;`,
    },
    {
      note: "update_lookup 的 StopOnLost 早退门写反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (stratedy == static_cast<double>(ChaseStrategy::StopOnLost) && gave_up) return;`,
      to: `  if (stratedy == static_cast<double>(ChaseStrategy::StopOnLost) || gave_up) return;`,
    },
    {
      note: "update_lookup 的 StopOnLost 判成 UntilLost",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (stratedy == static_cast<double>(ChaseStrategy::StopOnLost) && gave_up) return;`,
      to: `  if (stratedy == static_cast<double>(ChaseStrategy::UntilLost) && gave_up) return;`,
    },
    {
      note: "update_lookup 的失效清理判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (!still_valid) chasing = TargetHandle();`,
      to: `  if (still_valid) chasing = TargetHandle();`,
    },
    {
      note: "update_lookup 的 UntilLost 判成 Default",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `      (stratedy == static_cast<double>(ChaseStrategy::UntilLost) ||`,
      to: `      (stratedy == static_cast<double>(ChaseStrategy::Default) ||`,
    },
    {
      note: "update_lookup 的停追分支判成 UntilLost",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (!current.nullish() && stratedy == static_cast<double>(ChaseStrategy::StopOnLost)) {`,
      to: `  if (!current.nullish() && stratedy == static_cast<double>(ChaseStrategy::UntilLost)) {`,
    },
    {
      note: "update_lookup 的 Default 清空判成 UntilLost",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (stratedy == static_cast<double>(ChaseStrategy::Default)) chasing = TargetHandle();`,
      to: `  if (stratedy == static_cast<double>(ChaseStrategy::UntilLost)) chasing = TargetHandle();`,
    },
    {
      note: "update_lookup 忘了跳过 ghosted 的候选",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `    if (!truthy(field_or(e2.ref(), u"ghosted")) && should_chase(e2.ref())) {`,
      to: `    if (should_chase(e2.ref())) {`,
    },
    {
      note: "update_lookup 的最近距离比较写反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `      if (d < found_d) {`,
      to: `      if (d > found_d) {`,
    },
    {
      note: "update_lookup 找到目标后不记 chasing",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  chasing = found;
  aim_at(found.ref());`,
      to: `  aim_at(found.ref());`,
    },
    {
      note: "update 的「帧变了」判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (hp > 0 && !same_ref(frame, frame_now)) {`,
      to: `  if (hp > 0 && same_ref(frame, frame_now)) {`,
    },
    {
      note: "update 的死亡分支判成 hp < 0",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  } else if (hp <= 0 && truthy(chase)) {`,
      to: `  } else if (hp < 0 && truthy(chase)) {`,
    },
    {
      note: "update 清 chase 时不重置追踪点",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `      stop_chasing();
      copy_self_position();`,
      to: `      stop_chasing();`,
    },
    {
      note: "update 的帧行为判成别的值",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (strict_equals(behavior, Value(static_cast<double>(FrameBehavior::JohnBiscuitLeaving)))) {`,
      to: `  if (strict_equals(behavior, Value(static_cast<double>(FrameBehavior::JohnChase)))) {`,
    },
    {
      note: "JohnBiscuitLeaving 的朝向判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `    if (facing < 0) {
      key_down({gk::kL});`,
      to: `    if (facing > 0) {
      key_down({gk::kL});`,
    },
    {
      note: "JohnBiscuitLeaving 的 40 高度判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `    if (e->py > 40) {`,
      to: `    if (e->py < 40) {`,
    },
    {
      note: "JohnBiscuitLeaving 的上升键写反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `    } else if (e->py < 40) {
      key_down({gk::kj});
      key_up({gk::kd});`,
      to: `    } else if (e->py < 40) {
      key_down({gk::kd});
      key_up({gk::kj});`,
    },
    {
      note: "update_chasing 的 oy 默认值改成 0",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `                          ? 0.5`,
      to: `                          ? 0.0`,
    },
    {
      note: "update_chasing 的 hover 门写反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `                 (js_to_int32(lost) & static_cast<int32_t>(ChaseLost::Hover)) != 0)) {`,
      to: `                 (js_to_int32(lost) & static_cast<int32_t>(ChaseLost::Hover)) == 0)) {`,
    },
    {
      note: "update_chasing 的 x 方向键写反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `    dir_x = calc_dir(x - e->px, over_x, dir_x);
    if (dir_x > 0) {
      key_down({gk::kR});
      key_up({gk::kL});`,
      to: `    dir_x = calc_dir(x - e->px, over_x, dir_x);
    if (dir_x > 0) {
      key_down({gk::kL});
      key_up({gk::kR});`,
    },
    {
      note: "update_chasing 的 y 用 -e->py 之外还漏了 z",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `    dir_z = calc_dir(z - e->pz, over_z, dir_z);`,
      to: `    dir_z = calc_dir(y - e->pz, over_z, dir_z);`,
    },
    {
      note: "update_chasing 的 leave_dir 初始化判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `    if (leave_dir == 0) leave_dir = facing < 0 ? -1 : 1;`,
      to: `    if (leave_dir == 0) leave_dir = facing < 0 ? 1 : -1;`,
    },
    {
      note: "calc_dir 的起点判断写反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (dir == 0 && truthy(Value(delta))) dir = delta > 0 ? 1 : -1;`,
      to: `  if (dir == 0 && truthy(Value(delta))) dir = delta > 0 ? -1 : 1;`,
    },
    {
      note: "calc_dir 的 overshoot 反向判成 <= / >=",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  if (dir > 0 && delta < -over) {`,
      to: `  if (dir > 0 && delta <= -over) {`,
    },
    {
      note: "calc_dir 的第二个反向判反",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  } else if (dir < 0 && delta > over) {`,
      to: `  } else if (dir < 0 && delta < over) {`,
    },
    {
      note: "stop_chasing 不清 chasing",
      file: "native/lfw/controller/ball_controller.cpp",
      from: `  dir_z = 0;
  chasing = TargetHandle();`,
      to: `  dir_z = 0;`,
    },
    {
      note: "closer_one 的远近比较写反",
      file: "native/lfw/helper/closer_one.cpp",
      from: `  if (truthy(t1) && truthy(t2)) return distance_of(t1) > distance_of(t2) ? t2 : t1;`,
      to: `  if (truthy(t1) && truthy(t2)) return distance_of(t1) < distance_of(t2) ? t2 : t1;`,
    },
    {
      note: "closer_one 的两者都缺判成或",
      file: "native/lfw/helper/closer_one.cpp",
      from: `  if (truthy(t1) && truthy(t2)) return distance_of(t1) > distance_of(t2) ? t2 : t1;`,
      to: `  if (truthy(t1) || truthy(t2)) return distance_of(t1) > distance_of(t2) ? t2 : t1;`,
    },
    {
      note: "closer_one 忽略 s 的缺失",
      file: "native/lfw/helper/closer_one.cpp",
      from: `  if (!truthy(s)) return Value();`,
      to: `  if (!truthy(s)) return t1;`,
    },
    {
      note: "ref_of 的 position.x 用 y",
      file: "native/lfw/entity/entity_ref.cpp",
      from: `  pos.set(u"x", Value(e.position.x));`,
      to: `  pos.set(u"x", Value(e.position.y));`,
    },
    {
      note: "ref_of 的 team 不给",
      file: "native/lfw/entity/entity_ref.cpp",
      from: `  o.set(u"team", Value(e.team()));`,
      to: `  o.set(u"team", Value(std::u16string()));`,
    },
    {
      note: "ref_of 的 frame 不给",
      file: "native/lfw/entity/entity_ref.cpp",
      from: `  o.set(u"frame", e.frame);`,
      to: `  o.set(u"frame", Value());`,
    },
    {
      note: "ref_of 的 hp 恒 0",
      file: "native/lfw/entity/entity_ref.cpp",
      from: `  o.set(u"hp", Value(e.hp()));`,
      to: `  o.set(u"hp", Value(0.0));`,
    },
    {
      note: "ref_of 的 ghosted 恒真",
      file: "native/lfw/entity/entity_ref.cpp",
      from: `  o.set(u"ghosted", Value(e.ghosted()));`,
      to: `  o.set(u"ghosted", Value(true));`,
    },
    {
      note: "flag_between 的队伍判反",
      file: "native/lfw/entity/entity_flag.h",
      from: `  int32_t ret = a_team == b_team ? static_cast<int32_t>(HitFlag::Ally)`,
      to: `  int32_t ret = a_team != b_team ? static_cast<int32_t>(HitFlag::Ally)`,
    },
    {
      note: "flag_between 的 Dead 位不判",
      file: "native/lfw/entity/entity_flag.h",
      from: `  if (a_hp <= 0) ret |= static_cast<int32_t>(HitFlag::Dead);`,
      to: `  if (a_hp < 0) ret |= static_cast<int32_t>(HitFlag::Dead);`,
    },
  ],
};
