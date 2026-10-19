// collision_handlers2 变异规格
//
// 覆盖 native/lfw/collision/handlers2.cpp：handle_injury / handle_itr_catch /
// handle_itr_kind_freeze / handle_itr_effect_freeze / handle_john_shield_hit_other_ball。
//
// 按证明删除的变异（不可观测）：
// 1) `handle_stiffness` 里 `itr.motionless ?? fallback` 的「非惰性」改写：
//    真代码在 `itr.motionless` 存在时也用不到 fallback，且本 harness 的
//    `attacker_itr_motionless` 回调是静默的，改不出可观测差异。
export default {
  subject: "collision_handlers2",
  mutations: [
    // ---- handle_injury ----
    {
      note: "injury 无值仍继续",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const Value injury_v = field_or(c.itr, u\"injury\");\n  if (!truthy(injury_v)) return;",
      to: "  const Value injury_v = field_or(c.itr, u\"injury\");\n  if (truthy(injury_v)) return;",
    },
    {
      note: "injury 忽略 scale",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const double injury = round(to_number(injury_v) * scale);",
      to: "  const double injury = round(to_number(injury_v));",
    },
    {
      note: "injury 归零仍继续",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (!injury) return;",
      to: "  if (injury) return;",
    },
    {
      note: "扣血变成回血",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_hp(prev_hp - injury);",
      to: "  v->set_hp(prev_hp + injury);",
    },
    {
      note: "hp_r 不按恢复率折算",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const double injury_r = round(injury * (1 - to_number(g_env.hp_recoverability())));",
      to: "  const double injury_r = round(injury * to_number(g_env.hp_recoverability()));",
    },
    {
      note: "injury_r 为 0 也写",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (injury_r) v->set_hp_r(prev_hp_r - injury_r);",
      to: "  v->set_hp_r(prev_hp_r - injury_r);",
    },
    {
      note: "real_injury 算式颠倒",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const Value real_injury = Value(prev_hp - v->hp());",
      to: "  const Value real_injury = Value(v->hp() - prev_hp);",
    },
    {
      note: "real_injury_r 取错字段",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const Value real_injury_r = Value(prev_hp_r - v->hp_r());",
      to: "  const Value real_injury_r = Value(prev_hp - v->hp());",
    },
    {
      note: "keep_toughness 判定取反",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (!keep_toughness) v->set_toughness(0.0);",
      to: "  if (keep_toughness) v->set_toughness(0.0);",
    },
    {
      note: "src_emitter 从受击方取",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const std::u16string* const se = a == nullptr ? nullptr : a->src_emitter();",
      to: "  const std::u16string* const se = v->src_emitter();",
    },
    {
      note: "src_emitter 转嫁被忽略",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (se != nullptr && !se->empty()) att = g_env.find_entity(*se);",
      to: "  if (false) att = g_env.find_entity(*se);",
    },
    {
      note: "injury_r 写成 injury",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  c.injury_r = Value(injury_r);",
      to: "  c.injury_r = Value(injury);",
    },
    {
      note: "real_injury 写成 real_injury_r",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  c.real_injury = real_injury;\n  c.real_injury_r = real_injury_r;",
      to: "  c.real_injury = real_injury_r;\n  c.real_injury_r = real_injury_r;",
    },
    {
      note: "找不到施放者仍记分",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (att == nullptr) return;",
      to: "  if (att == nullptr) att = v;",
    },
    {
      note: "记分用原攻击方",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  g_env.summary_apply_damage(att, Value(injury), v, Value(prev_hp));",
      to: "  g_env.summary_apply_damage(a, Value(injury), v, Value(prev_hp));",
    },
    {
      note: "Electrify 与 Fighter 判定用或",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (att->marks_has(u\"Electrify\") && g_env.is_fighter(*v)) {",
      to: "  if (att->marks_has(u\"Electrify\") || g_env.is_fighter(*v)) {",
    },
    {
      note: "Electrify 判定取反",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (att->marks_has(u\"Electrify\") && g_env.is_fighter(*v)) {",
      to: "  if (!att->marks_has(u\"Electrify\") && g_env.is_fighter(*v)) {",
    },
    {
      note: "Fighter 判定看错实体",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (att->marks_has(u\"Electrify\") && g_env.is_fighter(*v)) {",
      to: "  if (att->marks_has(u\"Electrify\") && g_env.is_fighter(*att)) {",
    },
    {
      note: "感电时长不做缺省",
      file: "native/lfw/collision/handlers2.cpp",
      from: "                     missing(elec) ? 0 : to_number(elec));",
      to: "                     to_number(elec));",
    },
    {
      note: "感电时长缺省值错",
      file: "native/lfw/collision/handlers2.cpp",
      from: "                     missing(elec) ? 0 : to_number(elec));",
      to: "                     missing(elec) ? 1 : to_number(elec));",
    },
    {
      note: "感电 buff 种类写错",
      file: "native/lfw/collision/handlers2.cpp",
      from: "    buff::grant_buff(g_env.buff_env(), u\"Electroshock\", att, v,",
      to: "    buff::grant_buff(g_env.buff_env(), u\"Electrify\", att, v,",
    },
    {
      note: "感电 buff 主客互换",
      file: "native/lfw/collision/handlers2.cpp",
      from: "    buff::grant_buff(g_env.buff_env(), u\"Electroshock\", att, v,",
      to: "    buff::grant_buff(g_env.buff_env(), u\"Electroshock\", v, att,",
    },
    // ---- handle_itr_catch ----
    {
      note: "catch 已在抓仍继续",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (a->catching != nullptr) return;",
      to: "  if (a->catching == nullptr) return;",
    },
    {
      note: "catch 已被抓仍继续",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  if (v->catcher != nullptr) return;",
      to: "  if (v->catcher == nullptr) return;",
    },
    {
      note: "catch 抓取时长写 0",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  a->set_catch_time(a->catch_time_max());",
      to: "  a->set_catch_time(0.0);",
    },
    {
      note: "catch 自抓自己",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  a->set_catching(v);",
      to: "  a->set_catching(a);",
    },
    {
      note: "catch 捕捉动作判定取反",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const Value catchingact = field_or(c.itr, u\"catchingact\");\n  if (truthy(catchingact))",
      to: "  const Value catchingact = field_or(c.itr, u\"catchingact\");\n  if (!truthy(catchingact))",
    },
    {
      note: "catch 被捕动作判定取反",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const Value caughtact = field_or(c.itr, u\"caughtact\");\n  if (truthy(caughtact))",
      to: "  const Value caughtact = field_or(c.itr, u\"caughtact\");\n  if (!truthy(caughtact))",
    },
    {
      note: "catch 捕捉动作进到受击方",
      file: "native/lfw/collision/handlers2.cpp",
      from: "    a->enter_frame(catchingact);",
      to: "    v->enter_frame(catchingact);",
    },
    {
      note: "catch 被捕动作进到攻击方",
      file: "native/lfw/collision/handlers2.cpp",
      from: "    v->enter_frame(caughtact);",
      to: "    a->enter_frame(caughtact);",
    },
    {
      note: "catch 自认被捕者",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_catcher(a);",
      to: "  v->set_catcher(v);",
    },
    {
      note: "catch 清醒值写 1",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_resting(0.0);",
      to: "  v->set_resting(1.0);",
    },
    {
      note: "catch 不补满 fall_value",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_fall_value(v->fall_value_max());",
      to: "  v->set_fall_value(0.0);",
    },
    {
      note: "catch 防御值取错上限",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_defend_value(v->defend_value_max());",
      to: "  v->set_defend_value(v->fall_value_max());",
    },
    {
      note: "catch 警告文案写错",
      file: "native/lfw/collision/handlers2.cpp",
      from: "    g_env.warn(u\"[handle_itr_catch] caughtact got \" + to_string(caughtact));",
      to: "    g_env.warn(u\"[handle_itr] caughtact got \" + to_string(caughtact));",
    },
    // ---- handle_itr_kind_freeze / effect ----
    {
      note: "freeze fall_value 反向",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_fall_value(v->fall_value() - to_number(a->itr_fall(c.itr)));\n  handle_injury(c, 1, false);\n  handle_rest(c);\n  handle_stiffness(c);\n  v->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}\n\nvoid handle_itr_effect_freeze",
      to: "  v->set_fall_value(v->fall_value() + to_number(a->itr_fall(c.itr)));\n  handle_injury(c, 1, false);\n  handle_rest(c);\n  handle_stiffness(c);\n  v->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}\n\nvoid handle_itr_effect_freeze",
    },
    {
      note: "freeze 取受击方的 itr_fall",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_fall_value(v->fall_value() - to_number(a->itr_fall(c.itr)));\n  handle_injury(c, 1, false);\n  handle_rest(c);\n  handle_stiffness(c);\n  v->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}",
      to: "  v->set_fall_value(v->fall_value() - to_number(v->itr_fall(c.itr)));\n  handle_injury(c, 1, false);\n  handle_rest(c);\n  handle_stiffness(c);\n  v->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}",
    },
    {
      note: "efreeze 先 rest 后 injury",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_velocity(Value(vel.x), Value(vel.y), Value(vel.z));\n  handle_injury(c, 1, false);\n  handle_rest(c);\n  handle_stiffness(c);",
      to: "  v->set_velocity(Value(vel.x), Value(vel.y), Value(vel.z));\n  handle_rest(c);\n  handle_injury(c, 1, false);\n  handle_stiffness(c);",
    },
    {
      note: "freeze 不再 stiffness",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  handle_injury(c, 1, false);\n  handle_rest(c);\n  handle_stiffness(c);\n  v->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}\n\nvoid handle_itr_effect_freeze",
      to: "  handle_injury(c, 1, false);\n  handle_rest(c);\n  v->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}\n\nvoid handle_itr_effect_freeze",
    },
    {
      note: "freeze 冰帧进到攻击方",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}\n\nvoid handle_itr_effect_freeze",
      to: "  a->enter_frame_by_id(v->data_indexes_of(u\"ice\"));\n}\n\nvoid handle_itr_effect_freeze",
    },
    {
      note: "efreeze 丢掉速度",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  const ItrVelocity vel = g_env.calc_velocity(c);\n  v->set_velocity(Value(vel.x), Value(vel.y), Value(vel.z));",
      to: "  const ItrVelocity vel = g_env.calc_velocity(c);\n  v->set_velocity(Value(0.0), Value(vel.y), Value(vel.z));",
    },
    {
      note: "efreeze x/z 互换",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_velocity(Value(vel.x), Value(vel.y), Value(vel.z));",
      to: "  v->set_velocity(Value(vel.z), Value(vel.y), Value(vel.x));",
    },
    {
      note: "efreeze 速度给了攻击方",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_velocity(Value(vel.x), Value(vel.y), Value(vel.z));",
      to: "  a->set_velocity(Value(vel.x), Value(vel.y), Value(vel.z));",
    },
    {
      note: "efreeze 不扣 fall_value",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  v->set_fall_value(v->fall_value() - to_number(a->itr_fall(c.itr)));\n  const ItrVelocity vel = g_env.calc_velocity(c);",
      to: "  const ItrVelocity vel = g_env.calc_velocity(c);",
    },
    // ---- handle_john_shield_hit_other_ball ----
    {
      note: "shield 先 injury 后 rest",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  handle_rest(c);\n  handle_injury(c, 1, false);\n  handle_stiffness(c);\n  Entity* a = g_env.find_entity(c.aid);",
      to: "  handle_injury(c, 1, false);\n  handle_rest(c);\n  handle_stiffness(c);\n  Entity* a = g_env.find_entity(c.aid);",
    },
    {
      note: "shield 抖动量写 0",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  a->set_shaking(a->motionless);",
      to: "  a->set_shaking(0.0);",
    },
    {
      note: "shield 抖动写到受击方",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  a->set_shaking(a->motionless);",
      to: "  g_env.find_entity(c.vid)->set_shaking(a->motionless);",
    },
    {
      note: "shield 用受击方的 motionless",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  a->set_shaking(a->motionless);",
      to: "  a->set_shaking(g_env.find_entity(c.vid)->motionless);",
    },
    {
      note: "shield 不播音效",
      file: "native/lfw/collision/handlers2.cpp",
      from: "  a->play_sound(a->data_base_hit_sounds());",
      to: "  a->play_sound(Value());",
    },
  ],
};
