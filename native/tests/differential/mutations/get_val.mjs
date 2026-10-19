// Mutation spec for the `loader/get_val_from_entity` slice (case:
// `cases/entity/get_val.txt`, subject `entity`).
//
// Notes recorded up front (unobservable-by-design items, not silently skipped):
//  * `get_val_from_lf2` / `get_val_from_world`（`loader/get_val_from_lf2.h`、
//    `loader/get_val_from_world.h`）恒 `nullptr` —— TS 那两个文件也是死分支
//    （只有 `default` 的 switch），所以「把回落改成空指针」是构造上等价的，不列候选。
//  * `LFW::is_cheat` / `LFW::survival_rank_available` 的**默认实现**（原先挂在 `IEntityHost`
//    缝上）在 `entity` 用例里不被执行：台面假 `lfw` 覆写了这两面，改默认值是
//    不可观察的。
//  * TS 那边 `entity_val_getters[word]` 是**属性查找**，`word` 撞上
//    `Object.prototype`（`constructor` / `toString` / `__proto__` …）时命中原型链、
//    拿到一个函数而不是 `undefined`；端口是查表，查不到就给 `nullptr`。这条差异
//    记在 DESIGN §61.4，差分里不比较（TS 会真把它当 getter 调用）。
//  * `entity_world_val_getters` 那个记忆 Map 是纯缓存（命中与否结果一样），不移植。
//  * `Holding_W_Type` 的 `?? 0` 不可达：`Entity::base_type()` 返回 `double`
//    （TS 也是 `get base_type(): number`），所以只有「没有武器」时才走 0 分支。
//  * `length_of` 的非数组/非字符串分支：`nullopt` 与 `0.0` 在
//    `has_transform_data`（`0 != 0` 假）和 `transform_list_size`（`|| 0`）里同值，
//    构造上等价，不列候选。
export default {
  subject: "entity",
  mutations: [
    {
      note: "is_fighter_actor 拿 Weapon 判（hit_by_character）",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return a.data_type() == static_cast<double>(EntityEnum::Fighter);`,
      to: `  return a.data_type() == static_cast<double>(EntityEnum::Weapon);`,
    },
    {
      note: "is_weapon_actor 拿 Fighter 判（hit_by_weapon）",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return a.data_type() == static_cast<double>(EntityEnum::Weapon);`,
      to: `  return a.data_type() == static_cast<double>(EntityEnum::Fighter);`,
    },
    {
      note: "is_ball_actor 拿 Entity 判（hit_by_ball）",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return a.data_type() == static_cast<double>(EntityEnum::Ball);`,
      to: `  return a.data_type() == static_cast<double>(EntityEnum::Entity);`,
    },
    {
      note: "find_flag 命中后给 0",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    if (pred(c)) return Value(1.0);`,
      to: `    if (pred(c)) return Value(0.0);`,
    },
    {
      note: "flag_of 的布尔取反",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value flag_of(bool v) { return Value(v ? 1.0 : 0.0); }`,
      to: `Value flag_of(bool v) { return Value(v ? 0.0 : 1.0); }`,
    },
    {
      note: "length_of 的数组分支当成没有 length",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  if (const Array* a = as_array(v)) return static_cast<double>(a->size());`,
      to: `  if (const Array* a = as_array(v)) return std::nullopt;`,
    },
    {
      note: "length_of 的字符串分支少算一个码元",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    return static_cast<double>(s->size());`,
      to: `    return static_cast<double>(s->size() + 1);`,
    },
    {
      note: "ctrl_lr 读成 UD（press_L_R / press_F_B）",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return c != nullptr ? static_cast<double>(c->LR()) : 0.0;`,
      to: `  return c != nullptr ? static_cast<double>(c->UD()) : 0.0;`,
    },
    {
      note: "ctrl_ud 读成 LR（press_U_D）",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return c != nullptr ? static_cast<double>(c->UD()) : 0.0;`,
      to: `  return c != nullptr ? static_cast<double>(c->LR()) : 0.0;`,
    },
    {
      note: "trend_x 的第一个分支方向反了",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  if (e.velocity.x < 0) return Value(-e.facing);`,
      to: `  if (e.velocity.x > 0) return Value(-e.facing);`,
    },
    {
      note: "trend_x 的第二个分支丢掉负号",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  if (e.velocity.x > 0) return Value(e.facing);`,
      to: `  if (e.velocity.x > 0) return Value(-e.facing);`,
    },
    {
      note: "press_F_B 用加法",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(ctrl_lr(e) * e.facing);`,
      to: `  return Value(ctrl_lr(e) + e.facing);`,
    },
    {
      note: "holding_w_type 没有武器时给 1",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(e.holding != nullptr ? e.holding->base_type() : 0.0);`,
      to: `  return Value(e.holding != nullptr ? e.holding->base_type() : 1.0);`,
    },
    {
      note: "hp_p 少乘一个 10",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(clamp(round((100.0 * e.hp()) / e.hp_max()), 0.0, 100.0));`,
      to: `  return Value(clamp(round((10.0 * e.hp()) / e.hp_max()), 0.0, 100.0));`,
    },
    {
      note: "hp_p 的上界改成 50",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(clamp(round((100.0 * e.hp()) / e.hp_max()), 0.0, 100.0));`,
      to: `  return Value(clamp(round((100.0 * e.hp()) / e.hp_max()), 0.0, 50.0));`,
    },
    {
      note: "hp_p 漏掉 round",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(clamp(round((100.0 * e.hp()) / e.hp_max()), 0.0, 100.0));`,
      to: `  return Value(clamp((100.0 * e.hp()) / e.hp_max(), 0.0, 100.0));`,
    },
    {
      note: "lf2_net_on 查 HERO_FT",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.lfw().is_cheat(cheat_enum::kLF2_NET));`,
      to: `  return flag_of(e.lfw().is_cheat(cheat_enum::kHERO_FT));`,
    },
    {
      note: "hero_ft_on 查 GIM_INK",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.lfw().is_cheat(cheat_enum::kHERO_FT));`,
      to: `  return flag_of(e.lfw().is_cheat(cheat_enum::kGIM_INK));`,
    },
    {
      note: "gim_ink_on 查 LF2_NET",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.lfw().is_cheat(cheat_enum::kGIM_INK));`,
      to: `  return flag_of(e.lfw().is_cheat(cheat_enum::kLF2_NET));`,
    },
    {
      note: "has_transform_data 的零长度判反了",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(n.has_value() && *n != 0);`,
      to: `  return flag_of(n.has_value() && *n == 0);`,
    },
    {
      note: "Catching 判反",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.catching != nullptr);`,
      to: `  return flag_of(e.catching == nullptr);`,
    },
    {
      note: "CAUGHT 判反",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.catcher != nullptr);`,
      to: `  return flag_of(e.catcher == nullptr);`,
    },
    {
      note: "RequireSuperPunch 数成 buff 条数",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(static_cast<double>(e.superpunchs.size()));`,
      to: `  return Value(static_cast<double>(e.buffs.size()));`,
    },
    {
      note: "hit_by_character 看 weapon",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_fighter_actor(c.attacker); });`,
      to: `  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_weapon_actor(c.attacker); });`,
    },
    {
      note: "hit_by_weapon 看 ball",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_weapon_actor(c.attacker); });`,
      to: `  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_ball_actor(c.attacker); });`,
    },
    {
      note: "hit_by_ball 看 fighter",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_ball_actor(c.attacker); });`,
      to: `  return find_flag(e.collided_list,
                   [](const collision::Collision& c) { return is_fighter_actor(c.attacker); });`,
    },
    {
      note: "hit_by_state 读 aframe.id",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    out.push_back(field_or(c.aframe, u"state"));`,
      to: `    out.push_back(field_or(c.aframe, u"id"));`,
    },
    {
      note: "hit_by_itr_kind 读 itr.effect",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  for (const collision::Collision& c : e.collided_list) out.push_back(field_or(c.itr, u"kind"));`,
      to: `  for (const collision::Collision& c : e.collided_list)
    out.push_back(field_or(c.itr, u"effect"));`,
    },
    {
      note: "hit_by_itr_effect 读 itr.kind",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    out.push_back(field_or(c.itr, u"effect"));`,
      to: `    out.push_back(field_or(c.itr, u"kind"));`,
    },
    {
      note: "hit_on_character 看 weapon",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_fighter_actor(c.victim); });`,
      to: `  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_weapon_actor(c.victim); });`,
    },
    {
      note: "hit_on_weapon 看 ball",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_weapon_actor(c.victim); });`,
      to: `  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_ball_actor(c.victim); });`,
    },
    {
      note: "hit_on_ball 看 fighter",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_ball_actor(c.victim); });`,
      to: `  return find_flag(e.collision_list,
                   [](const collision::Collision& c) { return is_fighter_actor(c.victim); });`,
    },
    {
      note: "hit_on_state 读 aframe.state",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    out.push_back(field_or(c.bframe, u"state"));`,
      to: `    out.push_back(field_or(c.aframe, u"state"));`,
    },
    {
      note: "hit_on_something 数 collided_list",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(static_cast<double>(e.collision_list.size()));`,
      to: `  return Value(static_cast<double>(e.collided_list.size()));`,
    },
    {
      note: "HP 读成 mp",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value hp(const Entity& e, const std::u16string&, BinOp) { return Value(e.hp()); }`,
      to: `Value hp(const Entity& e, const std::u16string&, BinOp) { return Value(e.mp()); }`,
    },
    {
      note: "MP 读成 hp",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value mp(const Entity& e, const std::u16string&, BinOp) { return Value(e.mp()); }`,
      to: `Value mp(const Entity& e, const std::u16string&, BinOp) { return Value(e.hp()); }`,
    },
    {
      note: "VX 读成 velocity.y",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value vx(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.x); }`,
      to: `Value vx(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.y); }`,
    },
    {
      note: "VY 读成 velocity.z",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value vy(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.y); }`,
      to: `Value vy(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.z); }`,
    },
    {
      note: "VZ 读成 velocity.x",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value vz(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.z); }`,
      to: `Value vz(const Entity& e, const std::u16string&, BinOp) { return Value(e.velocity.x); }`,
    },
    {
      note: "FrameState 恒 0",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value frame_state(const Entity& e, const std::u16string&, BinOp) { return e.state(); }`,
      to: `Value frame_state(const Entity& e, const std::u16string&, BinOp) { return Value(0.0); }`,
    },
    {
      note: "Shaking 当成布尔",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value shaking(const Entity& e, const std::u16string&, BinOp) { return Value(e.shaking); }`,
      to: `Value shaking(const Entity& e, const std::u16string&, BinOp) {
  return flag_of(e.shaking != 0.0);
}`,
    },
    {
      note: "Holding 判反",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.holding != nullptr);`,
      to: `  return flag_of(e.holding == nullptr);`,
    },
    {
      note: "HoldingHeavy 拿 Stick 比",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `               e.holding->base_type() == static_cast<double>(WeaponEnum::Heavy));`,
      to: `               e.holding->base_type() == static_cast<double>(WeaponEnum::Stick));`,
    },
    {
      note: "HoldingOID 读 data.type",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return field_or(e.holding->data(), u"id");`,
      to: `  return field_or(e.holding->data(), u"type");`,
    },
    {
      note: "HpRecoverable 减反了",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(e.hp_r() - e.hp());`,
      to: `  return Value(e.hp() - e.hp_r());`,
    },
    {
      note: "HitByMagicFlute 的第一个 kind 判成 MagicFlute2",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    if (equals(buf->kind(), Value(static_cast<double>(ItrKind::MagicFlute)))) return Value(1.0);`,
      to: `    if (equals(buf->kind(), Value(static_cast<double>(ItrKind::MagicFlute2)))) return Value(1.0);`,
    },
    {
      note: "HitByMagicFlute 的第二个分支给 0",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    if (equals(buf->kind(), Value(static_cast<double>(ItrKind::MagicFlute2)))) return Value(1.0);`,
      to: `    if (equals(buf->kind(), Value(static_cast<double>(ItrKind::MagicFlute2)))) return Value(0.0);`,
    },
    {
      note: "TransformListSize 的兜底值改成 1",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return Value(length_of(e.transforms).value_or(0.0));`,
      to: `  return Value(length_of(e.transforms).value_or(1.0));`,
    },
    {
      note: "IsOnGround 判反",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.is_on_ground);`,
      to: `  return flag_of(!e.is_on_ground);`,
    },
    {
      note: "TransformIndex 读成 wait",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `Value transform_index(const Entity& e, const std::u16string&, BinOp) {
  return Value(e.transform_index);
}`,
      to: `Value transform_index(const Entity& e, const std::u16string&, BinOp) {
  return Value(e.wait);
}`,
    },
    {
      note: "IsSurvialRankMode 读 available 而非 mode",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `  return flag_of(e.lfw().survival_rank_mode());`,
      to: `  return flag_of(e.lfw().survival_rank_available());`,
    },
    {
      note: "表里 trend_x 指向 press_lr",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `      {entity_val::kTrendX, trend_x},`,
      to: `      {entity_val::kTrendX, press_lr},`,
    },
    {
      note: "表里 holdingOID 的键写成 holding",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `      {entity_val::kHoldingOID, holding_oid},`,
      to: `      {entity_val::kHolding, holding_oid},`,
    },
    {
      note: "查表的相等判断取反",
      file: "native/lfw/loader/get_val_from_entity.cpp",
      from: `    if (kv.first == word) return kv.second;`,
      to: `    if (kv.first != word) return kv.second;`,
    },
  ],
};
