// collision_handlers 变异规格
// 覆盖 native/lfw/collision/handlers.{h,cpp}（handle_stiffness / handle_body_goto /
// handle_super_punch_me / handle_weapon_picked / handle_rest / handle_itr_kind_magic_flute）。
//
// 单元边界：这些处理器要读写 Entity/World 的状态，故用 HandlersEnv 回调注入
// （与 BaseController 的 CtrlEnv 同型）。harness 记录「调用序列 + 落地值」，
// 差分校验的是处理器的判定逻辑与调用顺序，而不是 add_v_rest/pick 的内部实现。
//
// 不可变异类(记录，不计入):
//   1. `missing()` 的 `holds_alternative<NullTag>` 分支已在用例里用 `z` 值覆盖，故纳入变异。
//   2. 回调用 std::function 的判空守卫：移除后会 std::bad_function_call(_HAS_EXCEPTIONS=0)，属崩溃类。
export default {
  subject: "collision_handlers",
  mutations: [
    { note: "missing 的或改与", file: "native/lfw/collision/handlers.cpp", from: `  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);`, to: `  return std::holds_alternative<std::monostate>(v) && std::holds_alternative<NullTag>(v);` },
    { note: "missing 丢掉 null 分支", file: "native/lfw/collision/handlers.cpp", from: `  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);`, to: `  return std::holds_alternative<std::monostate>(v);` },
    { note: "stiffness motionless 回落取反", file: "native/lfw/collision/handlers.cpp", from: `  const Value motionless = missing(m) ? c.env->attacker_itr_motionless(c) : m;`, to: `  const Value motionless = missing(m) ? m : c.env->attacker_itr_motionless(c);` },
    { note: "stiffness motionless 回落源错", file: "native/lfw/collision/handlers.cpp", from: `  const Value motionless = missing(m) ? c.env->attacker_itr_motionless(c) : m;`, to: `  const Value motionless = missing(m) ? field_or(c.dataset, u"motionless") : m;` },
    { note: "stiffness motionless 未取 itr", file: "native/lfw/collision/handlers.cpp", from: `  const Value m = field_or(c.itr, u"motionless");`, to: `  const Value m = field_or(c.dataset, u"motionless");` },
    { note: "stiffness shaking 回落取反", file: "native/lfw/collision/handlers.cpp", from: `  const Value shaking = missing(s) ? field_or(c.dataset, u"itr_shaking") : s;`, to: `  const Value shaking = missing(s) ? s : field_or(c.dataset, u"itr_shaking");` },
    { note: "stiffness shaking 回落字段错", file: "native/lfw/collision/handlers.cpp", from: `  const Value shaking = missing(s) ? field_or(c.dataset, u"itr_shaking") : s;`, to: `  const Value shaking = missing(s) ? field_or(c.dataset, u"itr_arest") : s;` },
    { note: "stiffness 落地错对象", file: "native/lfw/collision/handlers.cpp", from: `  c.env->attacker_set_motionless(c, motionless);`, to: `  c.env->victim_set_shaking(c, motionless);` },
    { note: "stiffness 抖动落地错对象", file: "native/lfw/collision/handlers.cpp", from: `  c.env->victim_set_shaking(c, shaking);`, to: `  c.env->attacker_set_motionless(c, shaking);` },
    { note: "body_goto 走 rest", file: "native/lfw/collision/handlers.cpp", from: `void handle_body_goto(Collision& c) { handle_stiffness(c); }`, to: `void handle_body_goto(Collision& c) { handle_rest(c); }` },
    { note: "super_punch 走 pick", file: "native/lfw/collision/handlers.cpp", from: `void handle_super_punch_me(Collision& c) { c.env->victim_add_v_rest(c); }`, to: `void handle_super_punch_me(Collision& c) { c.env->attacker_pick_victim(c); }` },
    { note: "super_punch 不落地", file: "native/lfw/collision/handlers.cpp", from: `void handle_super_punch_me(Collision& c) { c.env->victim_add_v_rest(c); }`, to: `void handle_super_punch_me(Collision& c) { (void)c; }` },
    { note: "picked 走 add_v_rest", file: "native/lfw/collision/handlers.cpp", from: `void handle_weapon_picked(Collision& c) { c.env->attacker_pick_victim(c); }`, to: `void handle_weapon_picked(Collision& c) { c.env->victim_add_v_rest(c); }` },
    { note: "rest 分支取反", file: "native/lfw/collision/handlers.cpp", from: `  if (c.rest) {\n    c.env->victim_add_v_rest(c);\n    return;\n  }`, to: `  if (!c.rest) {\n    c.env->victim_add_v_rest(c);\n    return;\n  }` },
    { note: "rest 命中后不返回", file: "native/lfw/collision/handlers.cpp", from: `  if (c.rest) {\n    c.env->victim_add_v_rest(c);\n    return;\n  }`, to: `  if (c.rest) {\n    c.env->victim_add_v_rest(c);\n  }` },
    { note: "rest 取值判定取反", file: "native/lfw/collision/handlers.cpp", from: `  const double arest = truthy(arest_v) ? to_number(arest_v) : to_number(field_or(c.dataset, u"itr_arest"));`, to: `  const double arest = truthy(arest_v) ? to_number(field_or(c.dataset, u"itr_arest")) : to_number(arest_v);` },
    { note: "rest 回落字段错", file: "native/lfw/collision/handlers.cpp", from: `to_number(field_or(c.dataset, u"itr_arest"));`, to: `to_number(field_or(c.dataset, u"min_arest"));` },
    { note: "rest 用 min 夹取", file: "native/lfw/collision/handlers.cpp", from: `  const double base = max(to_number(field_or(c.dataset, u"min_arest")),`, to: `  const double base = min(to_number(field_or(c.dataset, u"min_arest")),` },
    { note: "rest 偏移改为减", file: "native/lfw/collision/handlers.cpp", from: `                          arest + to_number(field_or(c.dataset, u"arest_offset")));`, to: `                          arest - to_number(field_or(c.dataset, u"arest_offset")));` },
    { note: "rest 下限字段错", file: "native/lfw/collision/handlers.cpp", from: `  const double base = max(to_number(field_or(c.dataset, u"min_arest")),`, to: `  const double base = max(to_number(field_or(c.dataset, u"arest_offset")),` },
    { note: "rest 落地错通道", file: "native/lfw/collision/handlers.cpp", from: `  c.env->attacker_set_arest(c, base);`, to: `  c.env->attacker_set_motionless(c, Value(base));` },
    { note: "flute 不走 rest", file: "native/lfw/collision/handlers.cpp", from: `void handle_itr_kind_magic_flute(Collision& c) {\n  handle_rest(c);`, to: `void handle_itr_kind_magic_flute(Collision& c) {` },
    { note: "flute buff id 用攻击者", file: "native/lfw/collision/handlers.cpp", from: `  const std::u16string bid = u"magic_flute_to_" + c.vid;`, to: `  const std::u16string bid = u"magic_flute_to_" + c.aid;` },
    { note: "flute buff id 前缀错", file: "native/lfw/collision/handlers.cpp", from: `  const std::u16string bid = u"magic_flute_to_" + c.vid;`, to: `  const std::u16string bid = u"magic_flute_" + c.vid;` },
    { note: "flute 已有 buff 判定取反", file: "native/lfw/collision/handlers.cpp", from: `  if (c.env->buff_get(bid)) {`, to: `  if (!c.env->buff_get(bid)) {` },
    { note: "flute 已有 buff 不清寿命", file: "native/lfw/collision/handlers.cpp", from: `    c.env->buff_lifetime_zero(bid);\n    return;`, to: `    return;` },
    { note: "flute 创建失败仍继续", file: "native/lfw/collision/handlers.cpp", from: `  if (!c.env->buff_create(kind, bid)) return;`, to: `  if (c.env->buff_create(kind, bid)) return;` },
    { note: "flute kind 取错字段", file: "native/lfw/collision/handlers.cpp", from: `  const std::u16string kind = to_string(field_or(c.itr, u"kind"));`, to: `  const std::u16string kind = to_string(field_or(c.itr, u"arest"));` },
    { note: "flute 施放者受害者对调", file: "native/lfw/collision/handlers.cpp", from: `  c.env->buff_set_attacker(bid, c.aid);\n  c.env->buff_set_victim(bid, c.vid);`, to: `  c.env->buff_set_attacker(bid, c.vid);\n  c.env->buff_set_victim(bid, c.aid);` },
    { note: "flute 不挂载", file: "native/lfw/collision/handlers.cpp", from: `  c.env->buff_mount(bid);`, to: `  (void)bid;` },
  ],
};
