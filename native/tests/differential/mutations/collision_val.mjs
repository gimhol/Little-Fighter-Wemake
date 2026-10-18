// Mutation spec for the `loader/get_val_from_collision` slice（用例
// `cases/entity/collision_val.txt`，subject 仍是 `entity`）。
//
// 头部先记**有意不覆盖**的东西（不是漏掉）：
//  * 「世界里找不到这个 id」时那几个空值护栏（`with_attacker` / `with_victim` /
//    `with_both` 的 `!= nullptr` 分支、`key_state` 的空指针早退、`victim_is_chasing`
//    与 `armor_work` 的 `a == nullptr` / `v == nullptr` 兜底）：TS 那边的
//    `Collision.attacker` 是**活对象**，真实世界里不存在「读了才知道对象没了」这一刻，
//    TS 侧只能靠 `undefined.x` 抛异常来表达 —— 差分里没法比较（见 DESIGN §63 差异表）。
//  * `scoped_guard` 式的「`find_entity` 没装」分支：harness 一定装宿主接缝，
//    构造上走不到。
//  * `same_team` 的 `a.is_ally(v)` ↔ `v.is_ally(a)` 交换：`is_ally` 对两边对称，
//    本主题同值，构造上不可观察。
//  * `with_both` 返回 `Value()` 还是 `Value(0.0)`：本用例里两个实体都在，走不到。
//  * 86 条 getter 里，"同一个函数体只被一个词引用"的那些（`closer_one` 之类不是本文件）。
export default {
  subject: "entity",
  cases: ["collision_val"],
  mutations: [
    {
      note: "attacker_of 拿 victim 的 id 找实体",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return g_env.find_entity ? g_env.find_entity(c.attacker.id) : nullptr;`,
      to: `return g_env.find_entity ? g_env.find_entity(c.victim.id) : nullptr;`,
    },
    {
      note: "victim_of 拿 attacker 的 id 找实体",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return g_env.find_entity ? g_env.find_entity(c.victim.id) : nullptr;`,
      to: `return g_env.find_entity ? g_env.find_entity(c.attacker.id) : nullptr;`,
    },
    {
      note: "num_of 判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value num_of(bool b) { return Value(b ? 1.0 : 0.0); }`,
      to: `Value num_of(bool b) { return Value(b ? 0.0 : 1.0); }`,
    },
    {
      note: "nullish_or 不兜底",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v)) {
    return fallback;
  }
  return v;`,
      to: `  (void)fallback;
  return v;`,
    },
    {
      note: "nullish_or 一律兜底",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v)) {
    return fallback;
  }
  return v;`,
      to: `  (void)v;
  return fallback;`,
    },
    {
      note: "group_has 不看数组就判假",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  const Array* a = as_array(group);
  if (a == nullptr) return false;`,
      to: `  const Array* a = as_array(group);
  if (a != nullptr) return false;`,
    },
    {
      note: "group_has 的相等判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `    if (strict_equals(a->at(i), Value(std::u16string(want)))) return true;`,
      to: `    if (!strict_equals(a->at(i), Value(std::u16string(want)))) return true;`,
    },
    {
      note: "key_state 的 is_start 档接成 is_db_hit",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  if (kind == 1) return Value(ctrl->is_start(k));`,
      to: `  if (kind == 1) return Value(ctrl->is_db_hit(k));`,
    },
    {
      note: "attacker_state 读 bframe",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value attacker_state(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.aframe, u"state");
}`,
      to: `Value attacker_state(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bframe, u"state");
}`,
    },
    {
      note: "victim_state 读 aframe",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_state(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bframe, u"state");
}`,
      to: `Value victim_state(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.aframe, u"state");
}`,
    },
    {
      note: "victim_frame_id 读 aframe",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_frame_id(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bframe, u"id");
}`,
      to: `Value victim_frame_id(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.aframe, u"id");
}`,
    },
    {
      note: "v_frame_behavior 读碰撞里的 bframe",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value v_frame_behavior(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.frame, u"behavior"); });
}`,
      to: `Value v_frame_behavior(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [&c](const Entity&) { return field_of(c.bframe, u"behavior"); });
}`,
    },
    {
      note: "v_frame_behavior 读 state",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_victim(c, [](const Entity& e) { return field_of(e.frame, u"behavior"); });`,
      to: `  return with_victim(c, [](const Entity& e) { return field_of(e.frame, u"state"); });`,
    },
    {
      note: "itr_effect 读 bdy",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value itr_effect(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"effect");
}`,
      to: `Value itr_effect(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"effect");
}`,
    },
    {
      note: "itr_kind 读 bdy",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value itr_kind(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"kind");
}`,
      to: `Value itr_kind(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"kind");
}`,
    },
    {
      note: "itr_fall 读 bdy",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value itr_fall(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"fall");
}`,
      to: `Value itr_fall(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"fall");
}`,
    },
    {
      note: "itr_code 读 bdy",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value itr_code(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"code");
}`,
      to: `Value itr_code(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"code");
}`,
    },
    {
      note: "bdy_kind 读 itr",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value bdy_kind(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"kind");
}`,
      to: `Value bdy_kind(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"kind");
}`,
    },
    {
      note: "bdy_code 读 itr",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value bdy_code(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.bdy, u"code");
}`,
      to: `Value bdy_code(const Ctx& c, const std::u16string&, BinOp) {
  return field_of(c.itr, u"code");
}`,
    },
    {
      note: "no_itr_effect 把 null 也算成缺",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return Value(std::holds_alternative<std::monostate>(effect) ? 1.0 : 0.0);`,
      to: `  return Value(!truthy(effect) ? 1.0 : 0.0);`,
    },
    {
      note: "no_itr_effect 读 bdy",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value no_itr_effect(const Ctx& c, const std::u16string&, BinOp) {
  const Value effect = field_of(c.itr, u"effect");`,
      to: `Value no_itr_effect(const Ctx& c, const std::u16string&, BinOp) {
  const Value effect = field_of(c.bdy, u"effect");`,
    },
    {
      note: "bdy_hit_flag 读 itr",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return nullish_or(field_of(c.bdy, u"hit_flag"),`,
      to: `  return nullish_or(field_of(c.itr, u"hit_flag"),`,
    },
    {
      note: "itr_hit_flag 读 bdy",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return nullish_or(field_of(c.itr, u"hit_flag"),`,
      to: `  return nullish_or(field_of(c.bdy, u"hit_flag"),`,
    },
    {
      note: "bdy_hit_flag 的兜底从 AllEnemy 变 Enemy",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return nullish_or(field_of(c.bdy, u"hit_flag"),
                    Value(static_cast<double>(HitFlag::AllEnemy)));`,
      to: `  return nullish_or(field_of(c.bdy, u"hit_flag"),
                    Value(static_cast<double>(HitFlag::Enemy)));`,
    },
    {
      note: "itr_hit_flag 的兜底从 AllEnemy 变 Fighter",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value itr_hit_flag(const Ctx& c, const std::u16string&, BinOp) {
  return nullish_or(field_of(c.itr, u"hit_flag"),
                    Value(static_cast<double>(HitFlag::AllEnemy)));`,
      to: `Value itr_hit_flag(const Ctx& c, const std::u16string&, BinOp) {
  return nullish_or(field_of(c.itr, u"hit_flag"),
                    Value(static_cast<double>(HitFlag::Fighter)));`,
    },
    {
      note: "same_team 判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_both(c, [](const Entity& a, const Entity& v) { return num_of(a.is_ally(v)); });`,
      to: `  return with_both(c, [](const Entity& a, const Entity& v) { return num_of(!a.is_ally(v)); });`,
    },
    {
      note: "same_team 读同一个实体的队伍",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_both(c, [](const Entity& a, const Entity& v) { return num_of(a.is_ally(v)); });`,
      to: `  return with_both(c, [](const Entity& a, const Entity& v) { return num_of(a.is_ally(a)); });`,
    },
    {
      note: "same_facing 的相等判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `      c, [](const Entity& a, const Entity& v) { return num_of(a.facing == v.facing); });`,
      to: `      c, [](const Entity& a, const Entity& v) { return num_of(a.facing != v.facing); });`,
    },
    {
      note: "same_facing 只看自己",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `      c, [](const Entity& a, const Entity& v) { return num_of(a.facing == v.facing); });`,
      to: `      c, [](const Entity& a, const Entity&) { return num_of(a.facing == a.facing); });`,
    },
    {
      note: "attacker_has_holder 看 holding",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value attacker_has_holder(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(e.bearer != nullptr); });
}`,
      to: `Value attacker_has_holder(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(e.holding != nullptr); });
}`,
    },
    {
      note: "victim_has_holder 判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_has_holder(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(e.bearer != nullptr); });
}`,
      to: `Value victim_has_holder(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(e.bearer == nullptr); });
}`,
    },
    {
      note: "attacker_has_holding 看 bearer",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value attacker_has_holding(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(e.holding != nullptr); });
}`,
      to: `Value attacker_has_holding(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(e.bearer != nullptr); });
}`,
    },
    {
      note: "victim_has_holding 看 bearer",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_has_holding(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(e.holding != nullptr); });
}`,
      to: `Value victim_has_holding(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(e.bearer != nullptr); });
}`,
    },
    {
      note: "attacker_type 读 victim",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value attacker_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}`,
      to: `Value attacker_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}`,
    },
    {
      note: "victim_type 读 attacker",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}`,
      to: `Value victim_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}`,
    },
    {
      note: "attacker_base_type 读 data.type",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value attacker_base_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(
      c, [](const Entity& e) { return field_of(field_of(e.data(), u"base"), u"type"); });
}`,
      to: `Value attacker_base_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}`,
    },
    {
      note: "victim_base_type 读 data.type",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_base_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(
      c, [](const Entity& e) { return field_of(field_of(e.data(), u"base"), u"type"); });
}`,
      to: `Value victim_base_type(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.data(), u"type"); });
}`,
    },
    {
      note: "attacker_oid 读 victim",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value attacker_oid(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return field_of(e.data(), u"id"); });
}`,
      to: `Value attacker_oid(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.data(), u"id"); });
}`,
    },
    {
      note: "victim_oid 读 attacker",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_oid(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return field_of(e.data(), u"id"); });
}`,
      to: `Value victim_oid(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return field_of(e.data(), u"id"); });
}`,
    },
    {
      note: "victim_frame_index_ice 读 attacker",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_victim(
      c, [](const Entity& e) { return field_of(field_of(e.data(), u"indexes"), u"ice"); });`,
      to: `  return with_attacker(
      c, [](const Entity& e) { return field_of(field_of(e.data(), u"indexes"), u"ice"); });`,
    },
    {
      note: "victim_frame_index_ice 读实体帧上的 ice",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `      c, [](const Entity& e) { return field_of(field_of(e.data(), u"indexes"), u"ice"); });`,
      to: `      c, [](const Entity& e) { return field_of(e.frame, u"ice"); });`,
    },
    {
      note: "victim_freezable_ball 读 attacker",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_victim(c, [](const Entity& e) {
    return num_of(group_has(e.group(), entity_group::kFreezableBall));
  });`,
      to: `  return with_attacker(c, [](const Entity& e) {
    return num_of(group_has(e.group(), entity_group::kFreezableBall));
  });`,
    },
    {
      note: "attacker_freezable_ball 读 victim",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_attacker(c, [](const Entity& e) {
    return num_of(group_has(e.group(), entity_group::kFreezableBall));
  });`,
      to: `  return with_victim(c, [](const Entity& e) {
    return num_of(group_has(e.group(), entity_group::kFreezableBall));
  });`,
    },
    {
      note: "attacker_threw 判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value attacker_threw(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(truthy(Value(e.throwinjury))); });
}`,
      to: `Value attacker_threw(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(!truthy(Value(e.throwinjury))); });
}`,
    },
    {
      note: "victim_threw 读 attacker",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value victim_threw(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return num_of(truthy(Value(e.throwinjury))); });
}`,
      to: `Value victim_threw(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return num_of(truthy(Value(e.throwinjury))); });
}`,
    },
    {
      note: "a_hp_p 不取整",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value a_hp_p(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return Value(round(100 * e.hp() / e.hp_max())); });
}`,
      to: `Value a_hp_p(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return Value(100 * e.hp() / e.hp_max()); });
}`,
    },
    {
      note: "a_hp_p 读 victim",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_attacker(c, [](const Entity& e) { return Value(round(100 * e.hp() / e.hp_max())); });`,
      to: `  return with_victim(c, [](const Entity& e) { return Value(round(100 * e.hp() / e.hp_max())); });`,
    },
    {
      note: "v_hp_p 少乘 100",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return with_victim(c, [](const Entity& e) { return Value(round(100 * e.hp() / e.hp_max())); });`,
      to: `  return with_victim(c, [](const Entity& e) { return Value(round(e.hp() / e.hp_max())); });`,
    },
    {
      note: "a_toughness 读 victim",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value a_toughness(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return Value(e.toughness()); });
}`,
      to: `Value a_toughness(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return Value(e.toughness()); });
}`,
    },
    {
      note: "v_toughness 读 attacker",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value v_toughness(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) { return Value(e.toughness()); });
}`,
      to: `Value v_toughness(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) { return Value(e.toughness()); });
}`,
    },
    {
      note: "lf2_net_on 判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `      c, [](const Entity& e) { return num_of(e.lfw().is_cheat(cheat_enum::kLF2_NET)); });`,
      to: `      c, [](const Entity& e) { return num_of(!e.lfw().is_cheat(cheat_enum::kLF2_NET)); });`,
    },
    {
      note: "lf2_net_on 查 HERO_FT",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `      c, [](const Entity& e) { return num_of(e.lfw().is_cheat(cheat_enum::kLF2_NET)); });`,
      to: `      c, [](const Entity& e) { return num_of(e.lfw().is_cheat(cheat_enum::kHERO_FT)); });`,
    },
    {
      note: "a_emitter 读 victim",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value a_emitter(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) {`,
      to: `Value a_emitter(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) {`,
    },
    {
      note: "a_emitter 的兜底从空串变 x",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `    const std::u16string* s = e.emitter();
    return Value(s != nullptr ? *s : std::u16string());
  });
}

Value v_emitter`,
      to: `    const std::u16string* s = e.emitter();
    return Value(s != nullptr ? *s : std::u16string(u"x"));
  });
}

Value v_emitter`,
    },
    {
      note: "v_emitter 的兜底从空串变 x",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value v_emitter(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) {
    const std::u16string* s = e.emitter();
    return Value(s != nullptr ? *s : std::u16string());
  });
}`,
      to: `Value v_emitter(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) {
    const std::u16string* s = e.emitter();
    return Value(s != nullptr ? *s : std::u16string(u"x"));
  });
}`,
    },
    {
      note: "closing_speed 的第一个分支取反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  if (p1 > p2) return -v;`,
      to: `  if (p1 > p2) return v;`,
    },
    {
      note: "closing_speed 的相等分支不取绝对值",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return abs(-v);`,
      to: `  return v;`,
    },
    {
      note: "a_closing_speed_x 用 victim 的速度",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `    return Value(closing_speed(a.velocity.x, a.position.x, v.position.x));`,
      to: `    return Value(closing_speed(v.velocity.x, a.position.x, v.position.x));`,
    },
    {
      note: "a_closing_speed_y 用 x 轴的位置",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `    return Value(closing_speed(a.velocity.y, a.position.y, v.position.y));`,
      to: `    return Value(closing_speed(a.velocity.y, a.position.x, v.position.x));`,
    },
    {
      note: "a_closing_speed_z 用 y 轴的位置",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `    return Value(closing_speed(a.velocity.z, a.position.z, v.position.z));`,
      to: `    return Value(closing_speed(a.velocity.z, a.position.y, v.position.y));`,
    },
    {
      note: "a_falling 不判 Fighter",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value a_falling(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) {
    return num_of(entity::is_fighter(e.entity_view()) &&`,
      to: `Value a_falling(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) {
    return num_of(true &&`,
    },
    {
      note: "a_falling 不看帧状态",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `    return num_of(entity::is_fighter(e.entity_view()) &&
                  equals(e.state(), Value(static_cast<double>(StateEnum::Falling))));
  });
}

Value v_falling`,
      to: `    return num_of(entity::is_fighter(e.entity_view()));
  });
}

Value v_falling`,
    },
    {
      note: "a_falling 的状态判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `                  equals(e.state(), Value(static_cast<double>(StateEnum::Falling))));
  });
}

Value v_falling`,
      to: `                  !equals(e.state(), Value(static_cast<double>(StateEnum::Falling))));
  });
}

Value v_falling`,
    },
    {
      note: "v_falling 读 attacker 的状态",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `Value v_falling(const Ctx& c, const std::u16string&, BinOp) {
  return with_victim(c, [](const Entity& e) {`,
      to: `Value v_falling(const Ctx& c, const std::u16string&, BinOp) {
  return with_attacker(c, [](const Entity& e) {`,
    },
    {
      note: "victim_is_chasing 的 ball ctrl 判定反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  if (ctrl == nullptr || !ctrl->is_ball_ctrl()) return Value(0.0);`,
      to: `  if (ctrl == nullptr || ctrl->is_ball_ctrl()) return Value(0.0);`,
    },
    {
      note: "victim_is_chasing 拿 attacker 的 id 比",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return num_of(c.victim.id == ctrl->chasing.id());`,
      to: `  return num_of(c.attacker.id == ctrl->chasing.id());`,
    },
    {
      note: "victim_is_chasing 的相等判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return num_of(c.victim.id == ctrl->chasing.id());`,
      to: `  return num_of(!(c.victim.id == ctrl->chasing.id()));`,
    },
    {
      note: "armor_work 的结果判反",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  return num_of(collision::is_armor_work(Value(std::make_shared<Object>(view))));`,
      to: `  return num_of(!collision::is_armor_work(Value(std::make_shared<Object>(view))));`,
    },
    {
      note: "armor_work 的视角里不带 bframe",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  view.set(u"bframe", c.bframe);`,
      to: `  view.set(u"bframe", Value(std::make_shared<Object>(Object{})));`,
    },
    {
      note: "armor_work 的视角里不带 itr",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  view.set(u"itr", c.itr);`,
      to: `  view.set(u"itr", Value(std::make_shared<Object>(Object{})));`,
    },
    {
      note: "armor_work 的视角里不带 aframe",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  view.set(u"aframe", c.aframe);`,
      to: `  view.set(u"aframe", Value(std::make_shared<Object>(Object{})));`,
    },
    {
      note: "armor_work 拿 attacker 的护甲",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  victim.set(u"armor", v != nullptr ? v->armor : Value(NullTag{}));`,
      to: `  victim.set(u"armor", attacker_of(c) != nullptr ? attacker_of(c)->armor : Value(NullTag{}));`,
    },
    {
      note: "armor_work 的护甲恒为空",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `  victim.set(u"armor", v != nullptr ? v->armor : Value(NullTag{}));`,
      to: `  victim.set(u"armor", Value(NullTag{}));`,
    },
    {
      note: "表里 attacker_type 接到 victim_type",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `{collision_val::kAttackerType, attacker_type},`,
      to: `{collision_val::kAttackerType, victim_type},`,
    },
    {
      note: "表里 bdy_kind 接到 itr_kind",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `{collision_val::kBdyKind, bdy_kind},`,
      to: `{collision_val::kBdyKind, itr_kind},`,
    },
    {
      note: "表里 same_team 接到 same_facing",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `{collision_val::kSameTeam, same_team},`,
      to: `{collision_val::kSameTeam, same_facing},`,
    },
    {
      note: "表里 a_hit_attack 接到 a_hit_jump",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `{collision_val::kAHitAttack, a_hit_attack},`,
      to: `{collision_val::kAHitAttack, a_hit_jump},`,
    },
    {
      note: "表里 v_db_click_right 接到 v_db_click_up",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `{collision_val::kVDbcRight, v_db_click_right},`,
      to: `{collision_val::kVDbcRight, v_db_click_up},`,
    },
    {
      note: "表里 v_falling 接到 a_falling",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `{collision_val::kVFALLING, v_falling},`,
      to: `{collision_val::kVFALLING, a_falling},`,
    },
    {
      note: "找不到的词给表尾那一项（而不是 nullptr）",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `    if (kv.first == word) return kv.second;
  }
  return nullptr;`,
      to: `    if (kv.first == word) return kv.second;
  }
  return collision_val_getters().back().second;`,
    },
    {
      note: "a_hit_attack 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_hit(c, gk::ka);`,
      to: `return v_hit(c, gk::ka);`,
    },
    {
      note: "a_hit_jump 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_hit(c, gk::kj);`,
      to: `return a_hit(c, gk::kd);`,
    },
    {
      note: "a_hit_defend 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_hit(c, gk::kd);`,
      to: `return v_hit(c, gk::kd);`,
    },
    {
      note: "a_hit_up 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_hit(c, gk::kU);`,
      to: `return a_hit(c, gk::kD);`,
    },
    {
      note: "a_hit_down 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_hit(c, gk::kD);`,
      to: `return v_hit(c, gk::kD);`,
    },
    {
      note: "a_hit_left 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_hit(c, gk::kL);`,
      to: `return a_hit(c, gk::kR);`,
    },
    {
      note: "a_hit_right 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_hit(c, gk::kR);`,
      to: `return v_hit(c, gk::kR);`,
    },
    {
      note: "a_click_attack 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_click(c, gk::ka);`,
      to: `return v_click(c, gk::ka);`,
    },
    {
      note: "a_click_jump 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_click(c, gk::kj);`,
      to: `return a_click(c, gk::kd);`,
    },
    {
      note: "a_click_defend 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_click(c, gk::kd);`,
      to: `return v_click(c, gk::kd);`,
    },
    {
      note: "a_click_up 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_click(c, gk::kU);`,
      to: `return a_click(c, gk::kD);`,
    },
    {
      note: "a_click_down 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_click(c, gk::kD);`,
      to: `return v_click(c, gk::kD);`,
    },
    {
      note: "a_click_left 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_click(c, gk::kL);`,
      to: `return a_click(c, gk::kR);`,
    },
    {
      note: "a_click_right 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_click(c, gk::kR);`,
      to: `return v_click(c, gk::kR);`,
    },
    {
      note: "a_dbclick_attack 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_db_click(c, gk::ka);`,
      to: `return v_db_click(c, gk::ka);`,
    },
    {
      note: "a_dbclick_jump 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_db_click(c, gk::kj);`,
      to: `return a_db_click(c, gk::kd);`,
    },
    {
      note: "a_dbclick_defend 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_db_click(c, gk::kd);`,
      to: `return v_db_click(c, gk::kd);`,
    },
    {
      note: "a_dbclick_up 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_db_click(c, gk::kU);`,
      to: `return a_db_click(c, gk::kD);`,
    },
    {
      note: "a_dbclick_down 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_db_click(c, gk::kD);`,
      to: `return v_db_click(c, gk::kD);`,
    },
    {
      note: "a_dbclick_left 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_db_click(c, gk::kL);`,
      to: `return a_db_click(c, gk::kR);`,
    },
    {
      note: "a_dbclick_right 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return a_db_click(c, gk::kR);`,
      to: `return v_db_click(c, gk::kR);`,
    },
    {
      note: "v_hit_attack 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_hit(c, gk::ka);`,
      to: `return a_hit(c, gk::ka);`,
    },
    {
      note: "v_hit_jump 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_hit(c, gk::kj);`,
      to: `return v_hit(c, gk::kd);`,
    },
    {
      note: "v_hit_defend 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_hit(c, gk::kd);`,
      to: `return a_hit(c, gk::kd);`,
    },
    {
      note: "v_hit_up 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_hit(c, gk::kU);`,
      to: `return v_hit(c, gk::kD);`,
    },
    {
      note: "v_hit_down 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_hit(c, gk::kD);`,
      to: `return a_hit(c, gk::kD);`,
    },
    {
      note: "v_hit_left 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_hit(c, gk::kL);`,
      to: `return v_hit(c, gk::kR);`,
    },
    {
      note: "v_hit_right 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_hit(c, gk::kR);`,
      to: `return a_hit(c, gk::kR);`,
    },
    {
      note: "v_click_attack 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_click(c, gk::ka);`,
      to: `return a_click(c, gk::ka);`,
    },
    {
      note: "v_click_jump 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_click(c, gk::kj);`,
      to: `return v_click(c, gk::kd);`,
    },
    {
      note: "v_click_defend 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_click(c, gk::kd);`,
      to: `return a_click(c, gk::kd);`,
    },
    {
      note: "v_click_up 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_click(c, gk::kU);`,
      to: `return v_click(c, gk::kD);`,
    },
    {
      note: "v_click_down 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_click(c, gk::kD);`,
      to: `return a_click(c, gk::kD);`,
    },
    {
      note: "v_click_left 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_click(c, gk::kL);`,
      to: `return v_click(c, gk::kR);`,
    },
    {
      note: "v_click_right 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_click(c, gk::kR);`,
      to: `return a_click(c, gk::kR);`,
    },
    {
      note: "v_dbclick_attack 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_db_click(c, gk::ka);`,
      to: `return a_db_click(c, gk::ka);`,
    },
    {
      note: "v_dbclick_jump 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_db_click(c, gk::kj);`,
      to: `return v_db_click(c, gk::kd);`,
    },
    {
      note: "v_dbclick_defend 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_db_click(c, gk::kd);`,
      to: `return a_db_click(c, gk::kd);`,
    },
    {
      note: "v_dbclick_up 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_db_click(c, gk::kU);`,
      to: `return v_db_click(c, gk::kD);`,
    },
    {
      note: "v_dbclick_down 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_db_click(c, gk::kD);`,
      to: `return a_db_click(c, gk::kD);`,
    },
    {
      note: "v_dbclick_left 换键",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_db_click(c, gk::kL);`,
      to: `return v_db_click(c, gk::kR);`,
    },
    {
      note: "v_dbclick_right 换边",
      file: "native/lfw/loader/get_val_from_collision.cpp",
      from: `return v_db_click(c, gk::kR);`,
      to: `return a_db_click(c, gk::kR);`,
    },
  ],
};
