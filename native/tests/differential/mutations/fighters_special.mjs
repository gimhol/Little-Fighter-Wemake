export default {
  subject: "fighters_special",
  mutations: [
    {
      note: "fs 读的 id 键写成 oid",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  const Value* id = d->get(u"id");
  const double num_id = to_number(id != nullptr ? *id : Value());`,
      to: `  const Value* id = d->get(u"oid");
  const double num_id = to_number(id != nullptr ? *id : Value());`,
    },
    {
      note: "fs 隐藏组区间上界 39 写小",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  if ((num_id >= 30.0 && num_id <= 39.0) || (num_id >= 50.0 && num_id <= 59.0)) {`,
      to: `  if ((num_id >= 30.0 && num_id <= 38.0) || (num_id >= 50.0 && num_id <= 59.0)) {`,
    },
    {
      note: "fs 隐藏组第二段上界 59 写小",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  if ((num_id >= 30.0 && num_id <= 39.0) || (num_id >= 50.0 && num_id <= 59.0)) {`,
      to: `  if ((num_id >= 30.0 && num_id <= 39.0) || (num_id >= 50.0 && num_id <= 58.0)) {`,
    },
    {
      note: "fs 隐藏组下界 30 写大",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  if ((num_id >= 30.0 && num_id <= 39.0) || (num_id >= 50.0 && num_id <= 59.0)) {`,
      to: `  if ((num_id >= 31.0 && num_id <= 39.0) || (num_id >= 50.0 && num_id <= 59.0)) {`,
    },
    {
      note: "fs 隐藏组第二段下界 50 写大",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  if ((num_id >= 30.0 && num_id <= 39.0) || (num_id >= 50.0 && num_id <= 59.0)) {`,
      to: `  if ((num_id >= 30.0 && num_id <= 39.0) || (num_id >= 51.0 && num_id <= 59.0)) {`,
    },
    {
      note: "fs 常规组下界 1 写大",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  if (num_id >= 1.0 && num_id <= 29.0) {`,
      to: `  if (num_id >= 2.0 && num_id <= 29.0) {`,
    },
    {
      note: "fs 常规组上界 29 写小",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  if (num_id >= 1.0 && num_id <= 29.0) {`,
      to: `  if (num_id >= 1.0 && num_id <= 28.0) {`,
    },
    {
      note: "fs 隐藏组用错常量",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `    ensure_base_group(data, entity_group::kHidden);`,
      to: `    ensure_base_group(data, entity_group::kBoss);`,
    },
    {
      note: "fs 常规组用错常量",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `    ensure_base_group(data, entity_group::kRegular);`,
      to: `    ensure_base_group(data, entity_group::k_3000);`,
    },
    {
      note: "fs Bandit 组用错常量",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `    ensure_base_group(data, entity_group::k_3000);`,
      to: `    ensure_base_group(data, entity_group::kRegular);`,
    },
    {
      note: "fs Bandit 分支认错 oid",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  if (*key == oid::kBandit) {`,
      to: `  if (*key == oid::kBat) {`,
    },
    {
      note: "fs 的 alias 回退判定写成 truthy",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  const Value selected =
      (alias != nullptr && !is_nullish(*alias)) ? *alias : (id != nullptr ? *id : Value());`,
      to: `  const Value selected =
      (alias != nullptr && truthy(*alias)) ? *alias : (id != nullptr ? *id : Value());`,
    },
    {
      note: "fs 完全忽略 alias_id",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  const Value selected =
      (alias != nullptr && !is_nullish(*alias)) ? *alias : (id != nullptr ? *id : Value());`,
      to: `  const Value selected = id != nullptr ? *id : Value();`,
    },
    {
      note: "fs 分派键不要求是字符串",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `  const std::u16string* key = std::get_if<std::u16string>(&selected);
  if (key == nullptr) return data;`,
      to: `  const std::u16string key_value = to_string(selected);
  const std::u16string* key = &key_value;`,
    },
    {
      note: "fs 的 bat 分支接到 davis",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kBat, make_fighter_data_bat},`,
      to: `      {oid::kBat, make_fighter_data_davis},`,
    },
    {
      note: "fs 的 Hunter 分支接到 henry",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kHunter, make_fighter_data_henter},`,
      to: `      {oid::kHunter, make_fighter_data_henry},`,
    },
    {
      note: "fs 的 Template 分支接到 woody",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kTemplate, make_fighter_data_template},`,
      to: `      {oid::kTemplate, make_fighter_data_woody},`,
    },
    {
      note: "fs 的 Jan 分支接到 jack（空实现）",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kJan, make_fighter_data_jan},`,
      to: `      {oid::kJan, make_fighter_data_jack},`,
    },
    {
      note: "fs 的 LouisEX 分支接到 louis",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kLouisEX, make_fighter_data_louisex},`,
      to: `      {oid::kLouisEX, make_fighter_data_louis},`,
    },
    {
      note: "fs 的 Deep 分支接到 john",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kDeep, make_fighter_data_deep},`,
      to: `      {oid::kDeep, make_fighter_data_john},`,
    },
    {
      note: "fs 的 Freeze 分支接到 firen",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kFreeze, make_fighter_data_freeze},`,
      to: `      {oid::kFreeze, make_fighter_data_firen},`,
    },
    {
      note: "fs 的 Firzen 分支接到 julian",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `      {oid::kFirzen, make_fighter_data_firzen},`,
      to: `      {oid::kFirzen, make_fighter_data_julian},`,
    },
    {
      note: "fs 找到分支后不调用直接返回",
      file: "native/lfw/dat_translator/make_fighter_special.cpp",
      from: `    if (*key != cases[i].oid) continue;
    return cases[i].fn(data);`,
      to: `    if (*key != cases[i].oid) continue;
    return data;`,
    },
    {
      note: "set_bg_face 写成 truthy 判定",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  const Value* cur = base->get(u"bg_face");
  if (cur != nullptr && !is_nullish(*cur)) return;
  base->set(u"bg_face", Value(std::u16string(path)));`,
      to: `  const Value* cur = base->get(u"bg_face");
  if (cur != nullptr && !truthy(*cur)) return;
  base->set(u"bg_face", Value(std::u16string(path)));`,
    },
    {
      note: "set_bg_face 写的键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  base->set(u"bg_face", Value(std::u16string(path)));`,
      to: `  base->set(u"bgface", Value(std::u16string(path)));`,
    },
    {
      note: "set_bg_face 读的键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  const Value* cur = base->get(u"bg_face");`,
      to: `  const Value* cur = base->get(u"bgFace");`,
    },
    {
      note: "ensure_base_group 忽略既有 group",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  Value cur = value_or_undefined(*base, u"group");
  base->set(u"group", ensure(cur, Value(std::u16string(group))));`,
      to: `  Value cur;
  base->set(u"group", ensure(cur, Value(std::u16string(group))));`,
    },
    {
      note: "ensure_base_group 写的键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  base->set(u"group", ensure(cur, Value(std::u16string(group))));`,
      to: `  base->set(u"groups", ensure(cur, Value(std::u16string(group))));`,
    },
    {
      note: "ensure_base_group 读的键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  Value cur = value_or_undefined(*base, u"group");`,
      to: `  Value cur = value_or_undefined(*base, u"group1");`,
    },
    {
      note: "hit_flag_or 的按位或写成按位与",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `double hit_flag_or(HitFlag a, HitFlag b) {
  return static_cast<double>(static_cast<int>(a) | static_cast<int>(b));
}`,
      to: `double hit_flag_or(HitFlag a, HitFlag b) {
  return static_cast<double>(static_cast<int>(a) & static_cast<int>(b));
}`,
    },
    {
      note: "opoint 强化漏掉 max_hp",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  op->set(u"max_hp", n(20));
  op->set(u"hp", n(20));
  op->set(u"max_mp", n(150));
  op->set(u"mp", n(150));`,
      to: `  op->set(u"hp", n(20));
  op->set(u"max_mp", n(150));
  op->set(u"mp", n(150));`,
    },
    {
      note: "opoint 强化漏掉 mp",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  op->set(u"max_hp", n(20));
  op->set(u"hp", n(20));
  op->set(u"max_mp", n(150));
  op->set(u"mp", n(150));`,
      to: `  op->set(u"max_hp", n(20));
  op->set(u"hp", n(20));
  op->set(u"max_mp", n(150));`,
    },
    {
      note: "opoint 的 max_mp 值写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  op->set(u"max_mp", n(150));`,
      to: `  op->set(u"max_mp", n(151));`,
    },
    {
      note: "opoint 强化取反了 oid 判定",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (oid == nullptr || !strict_equals(*oid, target)) continue;`,
      to: `    if (oid == nullptr || strict_equals(*oid, target)) continue;`,
    },
    {
      note: "opoint 读的键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    const Value* oid = op->get(u"oid");`,
      to: `    const Value* oid = op->get(u"OID");`,
    },
    {
      note: "opoint 容器键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  Value* opoints = member(frame, u"opoint");`,
      to: `  Value* opoints = member(frame, u"opoints");`,
    },
    {
      note: "running 帧第 4 个键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  static const char16_t* const kKeys[4] = {u"running_0", u"running_1", u"running_2",
                                           u"running_3"};`,
      to: `  static const char16_t* const kKeys[4] = {u"running_0", u"running_1", u"running_2",
                                           u"running_4"};`,
    },
    {
      note: "running 帧第 1 个键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  static const char16_t* const kKeys[4] = {u"running_0", u"running_1", u"running_2",
                                           u"running_3"};`,
      to: `  static const char16_t* const kKeys[4] = {u"running_1", u"running_1", u"running_2",
                                           u"running_3"};`,
    },
    {
      note: "firen 的 itr 写进 bdy",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    frame.set(u"itr", ensure(cur, make_obj({
                                      {u"hit_flag", hf.first},`,
      to: `    frame.set(u"bdy", ensure(cur, make_obj({
                                      {u"hit_flag", hf.first},`,
    },
    {
      note: "firen 的 test 条件左值写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  cm.add(s(collision_val::kBdyCode), u"==", n(123))`,
      to: `  cm.add(s(collision_val::kItrCode), u"==", n(123))`,
    },
    {
      note: "firen 的 test 目标 oid 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `      .and_(s(collision_val::kVictimOID), u"==", s(oid::kFreeze))`,
      to: `      .and_(s(collision_val::kVictimOID), u"==", s(oid::kFiren))`,
    },
    {
      note: "firen 的 test hit_flag 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `      .and_(s(collision_val::kBdyHitFlag), u"==", en(HitFlag::AllyFighter))`,
      to: `      .and_(s(collision_val::kBdyHitFlag), u"==", en(HitFlag::EnemyFighter))`,
    },
    {
      note: "firen 的 itr code 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    frame.set(u"itr", ensure(cur, make_obj({
                                      {u"hit_flag", hf.first},
                                      {u"hit_flag_name", hf.second},
                                      {u"code", n(123)},`,
      to: `    frame.set(u"itr", ensure(cur, make_obj({
                                      {u"hit_flag", hf.first},
                                      {u"hit_flag_name", hf.second},
                                      {u"code", n(124)},`,
    },
    {
      note: "firen 的 itr kind 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                      {u"kind", en(ItrKind::Normal)},
                                      {u"effect", en(ItrEffect::Ignore)},`,
      to: `                                      {u"kind", en(ItrKind::Freeze)},
                                      {u"effect", en(ItrEffect::Ignore)},`,
    },
    {
      note: "firen 的 itr effect 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                      {u"kind", en(ItrKind::Normal)},
                                      {u"effect", en(ItrEffect::Ignore)},`,
      to: `                                      {u"kind", en(ItrKind::Normal)},
                                      {u"effect", en(ItrEffect::Normal)},`,
    },
    {
      note: "firen 的 itr x 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                      {u"x", n(35)},
                                      {u"y", n(19)},
                                      {u"w", n(10)},
                                      {u"h", n(60)},
                                      {u"test", Value(cm.done())},`,
      to: `                                      {u"x", n(36)},
                                      {u"y", n(19)},
                                      {u"w", n(10)},
                                      {u"h", n(60)},
                                      {u"test", Value(cm.done())},`,
    },
    {
      note: "firen 的 itr h 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                      {u"w", n(10)},
                                      {u"h", n(60)},
                                      {u"test", Value(cm.done())},`,
      to: `                                      {u"w", n(10)},
                                      {u"h", n(61)},
                                      {u"test", Value(cm.done())},`,
    },
    {
      note: "firen 漏掉 test 条件",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                      {u"h", n(60)},
                                      {u"test", Value(cm.done())},
                                  })));`,
      to: `                                      {u"h", n(60)},
                                  })));`,
    },
    {
      note: "firen 的 hit_flag 写成敌人标志",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  const std::pair<Value, Value> hf = hit_flag_pair(en(HitFlag::AllyFighter));
  for_each_running_frame(data, [&cm, &hf](Object& frame) {
    Value cur = value_or_undefined(frame, u"itr");`,
      to: `  const std::pair<Value, Value> hf = hit_flag_pair(en(HitFlag::EnemyFighter));
  for_each_running_frame(data, [&cm, &hf](Object& frame) {
    Value cur = value_or_undefined(frame, u"itr");`,
    },
    {
      note: "firen 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK5.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "freeze 的 bdy 写进 itr",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    frame.set(u"bdy", ensure(cur, make_obj({`,
      to: `    frame.set(u"itr", ensure(cur, make_obj({`,
    },
    {
      note: "freeze 的 bdy kind 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                      {u"kind", en(BdyKind::Normal)},`,
      to: `                                      {u"kind", en(BdyKind::Defend)},`,
    },
    {
      note: "freeze 的 itr hit_flag 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `      .and_(s(collision_val::kItrHitFlag), u"==",
            n(hit_flag_or(HitFlag::Fighter, HitFlag::Ally)))`,
      to: `      .and_(s(collision_val::kItrHitFlag), u"==",
            n(hit_flag_or(HitFlag::Fighter, HitFlag::Enemy)))`,
    },
    {
      note: "freeze 的 test 左值写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  cm.add(s(collision_val::kItrCode), u"==", n(123))`,
      to: `  cm.add(s(collision_val::kBdyCode), u"==", n(123))`,
    },
    {
      note: "freeze 的 test 攻击者 oid 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `      .and_(s(collision_val::kAttackerOID), u"==", s(oid::kFiren))`,
      to: `      .and_(s(collision_val::kAttackerOID), u"==", s(oid::kFreeze))`,
    },
    {
      note: "freeze 的融合动作类型写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                                       {u"type", s(action_type::kFUSION)},`,
      to: `                                                       {u"type", s(action_type::kV_BUFF)},`,
    },
    {
      note: "freeze 的融合目标 oid 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                                                      {u"oid", s(oid::kFirzen)},`,
      to: `                                                                      {u"oid", s(oid::kFiren)},`,
    },
    {
      note: "freeze 的融合动作 id 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                                                      {u"act", make_obj({{u"id", s(u"290")}})},`,
      to: `                                                                      {u"act", make_obj({{u"id", s(u"291")}})},`,
    },
    {
      note: "freeze 的融合时间写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                                                                      {u"time", n(9000)},`,
      to: `                                                                      {u"time", n(9001)},`,
    },
    {
      note: "freeze 的嵌套条件左值写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `        c.add(s(collision_val::kV_HP_P), u"<=", n(33))`,
      to: `        c.add(s(collision_val::kA_HP_P), u"<=", n(33))`,
    },
    {
      note: "freeze 的嵌套条件比较符写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `            .and_(s(collision_val::kA_HP_P), u"<", n(33))`,
      to: `            .and_(s(collision_val::kA_HP_P), u"<=", n(33))`,
    },
    {
      note: "freeze 的嵌套条件 or 写成 and",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `            .or_(s(collision_val::kLF2_NET_ON), u"==", n(1));
        return &c;`,
      to: `            .and_(s(collision_val::kLF2_NET_ON), u"==", n(1));
        return &c;`,
    },
    {
      note: "freeze 的 group 用错常量",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK7.png");
  ensure_base_group(data, entity_group::kFreezer);`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK7.png");
  ensure_base_group(data, entity_group::kBoss);`,
    },
    {
      note: "freeze 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK7.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "bat 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK2.png");`,
    },
    {
      note: "bat 的 group 用错常量",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_bat(Value& data) {
  ensure_base_group(data, entity_group::kBoss);`,
      to: `Value make_fighter_data_bat(Value& data) {
  ensure_base_group(data, entity_group::kRegular);`,
    },
    {
      note: "davis 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK2.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "deep 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK3.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "dennis 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK4.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "henry 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK8.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "john 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK9.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "template 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK0.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "woody 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK13.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "firzen 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK6.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "firzen 的 mp_r_ratio 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_firzen(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  Object* base = member_object(data, u"base");
  if (base != nullptr) {
    base->set(u"mp_r_ratio", n(2));`,
      to: `Value make_fighter_data_firzen(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  Object* base = member_object(data, u"base");
  if (base != nullptr) {
    base->set(u"mp_r_ratio", n(3));`,
    },
    {
      note: "firzen 的 ce 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    base->set(u"mp_r_ratio", n(2));
    base->set(u"ce", n(2));`,
      to: `    base->set(u"mp_r_ratio", n(2));
    base->set(u"ce", n(3));`,
    },
    {
      note: "firzen 的 group 用错常量",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_firzen(Value& data) {
  ensure_base_group(data, entity_group::kBoss);`,
      to: `Value make_fighter_data_firzen(Value& data) {
  ensure_base_group(data, entity_group::kRegular);`,
    },
    {
      note: "julian 的 ce 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    base->set(u"mp_r_ratio", n(2));
    base->set(u"ce", n(3));`,
      to: `    base->set(u"mp_r_ratio", n(2));
    base->set(u"ce", n(2));`,
    },
    {
      note: "julian 的 mp_r_ratio 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_julian(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  Object* base = member_object(data, u"base");
  if (base != nullptr) {
    base->set(u"mp_r_ratio", n(2));`,
      to: `Value make_fighter_data_julian(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  Object* base = member_object(data, u"base");
  if (base != nullptr) {
    base->set(u"mp_r_ratio", n(4));`,
    },
    {
      note: "julian 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK10.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "julian 的 group 用错常量",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_julian(Value& data) {
  ensure_base_group(data, entity_group::kBoss);`,
      to: `Value make_fighter_data_julian(Value& data) {
  ensure_base_group(data, entity_group::kRegular);`,
    },
    {
      note: "julian 的 armor fireproof 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"fireproof", n(1)},
                       {u"antifreeze", n(1)},`,
      to: `                       {u"fireproof", n(0)},
                       {u"antifreeze", n(1)},`,
    },
    {
      note: "julian 的 armor antifreeze 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"antifreeze", n(1)},
                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},`,
      to: `                       {u"antifreeze", n(0)},
                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},`,
    },
    {
      note: "julian 的 armor hit_sounds 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},`,
      to: `                       {u"hit_sounds", make_arr({s(u"data/003.wav.mp3")})},`,
    },
    {
      note: "julian 的 armor type 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},
                       {u"toughness", n(60)},`,
      to: `                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},
                       {u"type", en(ArmorEnum::Fall)},
                       {u"toughness", n(60)},`,
    },
    {
      note: "julian 的 armor toughness_resting 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},
                       {u"toughness", n(60)},
                       {u"toughness_resting", n(18)},`,
      to: `                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},
                       {u"toughness", n(60)},
                       {u"toughness_resting", n(19)},`,
    },
    {
      note: "knight 的 armor type 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_knight(Value& data) {
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/085.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},`,
      to: `Value make_fighter_data_knight(Value& data) {
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/085.wav.mp3")})},
                       {u"type", en(ArmorEnum::Fall)},`,
    },
    {
      note: "knight 的 armor toughness 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_knight(Value& data) {
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/085.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},
                       {u"toughness", n(60)},`,
      to: `Value make_fighter_data_knight(Value& data) {
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/085.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},
                       {u"toughness", n(61)},`,
    },
    {
      note: "louis 的 armor hit_sounds 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_louis(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK11.png");
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/085.wav.mp3")})},
                       {u"type", en(ArmorEnum::Times)},
                       {u"fulltime", Value(false)},
                       {u"toughness", n(1)},
                       {u"toughness_resting", n(90)},`,
      to: `Value make_fighter_data_louis(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK11.png");
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/086.wav.mp3")})},
                       {u"type", en(ArmorEnum::Times)},
                       {u"fulltime", Value(false)},
                       {u"toughness", n(1)},
                       {u"toughness_resting", n(90)},`,
    },
    {
      note: "louis 的 armor type 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"type", en(ArmorEnum::Times)},
                       {u"fulltime", Value(false)},`,
      to: `                       {u"type", en(ArmorEnum::Defend)},
                       {u"fulltime", Value(false)},`,
    },
    {
      note: "louis 的 armor fulltime 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"fulltime", Value(false)},
                       {u"toughness", n(1)},
                       {u"toughness_resting", n(90)},`,
      to: `                       {u"fulltime", Value(true)},
                       {u"toughness", n(1)},
                       {u"toughness_resting", n(90)},`,
    },
    {
      note: "louis 的 armor toughness 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"fulltime", Value(false)},
                       {u"toughness", n(1)},
                       {u"toughness_resting", n(90)},`,
      to: `                       {u"fulltime", Value(false)},
                       {u"toughness", n(2)},
                       {u"toughness_resting", n(90)},`,
    },
    {
      note: "louis 的 armor toughness_resting 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                       {u"toughness", n(1)},
                       {u"toughness_resting", n(90)},`,
      to: `                       {u"toughness", n(1)},
                       {u"toughness_resting", n(91)},`,
    },
    {
      note: "louis 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_louis(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK11.png");`,
      to: `Value make_fighter_data_louis(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "louisex 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_louisex(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  set_bg_face(data, u"sprite/MENU_BACK11.png");`,
      to: `Value make_fighter_data_louisex(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "louisex 的 group 用错常量",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_louisex(Value& data) {
  ensure_base_group(data, entity_group::kBoss);`,
      to: `Value make_fighter_data_louisex(Value& data) {
  ensure_base_group(data, entity_group::kRegular);`,
    },
    {
      note: "henter 的 group 用错常量",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_henter(Value& data) {
  ensure_base_group(data, entity_group::k_3000);`,
      to: `Value make_fighter_data_henter(Value& data) {
  ensure_base_group(data, entity_group::kRegular);`,
    },
    {
      note: "henter 取错帧下标",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `Value make_fighter_data_henter(Value& data) {
  ensure_base_group(data, entity_group::k_3000);
  Value* frames = member(data, u"frames");
  if (frames == nullptr) return data;
  Value* frame = element_at(*frames, 3.0);`,
      to: `Value make_fighter_data_henter(Value& data) {
  ensure_base_group(data, entity_group::k_3000);
  Value* frames = member(data, u"frames");
  if (frames == nullptr) return data;
  Value* frame = element_at(*frames, 2.0);`,
    },
    {
      note: "henter 改成删键而不是写 undefined",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  f->set(u"opoint", Value());
  return data;
}

Value make_fighter_data_jack`,
      to: `  f->remove(u"opoint");
  return data;
}

Value make_fighter_data_jack`,
    },
    {
      note: "henter 写的键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  f->set(u"opoint", Value());`,
      to: `  f->set(u"opiont", Value());`,
    },
    {
      note: "jan 写错第 1 个文件的 variants",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  o0->set(u"variants", make_arr({s(u"2")}));`,
      to: `  o0->set(u"variants", make_arr({s(u"3")}));`,
    },
    {
      note: "jan 写错第 2 个文件的 variants",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  o1->set(u"variants", make_arr({s(u"3")}));`,
      to: `  o1->set(u"variants", make_arr({s(u"2")}));`,
    },
    {
      note: "jan 取错文件下标",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  Value* f0 = element_at(holder, 0.0);`,
      to: `  Value* f0 = element_at(holder, 1.0);`,
    },
    {
      note: "rudolf 已有的 seqs 被丢弃",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  if (!truthy(target)) {
    target = Value(std::make_shared<Object>());
    f->set(u"seqs", target);
  }`,
      to: `  {
    target = Value(std::make_shared<Object>());
    f->set(u"seqs", target);
  }`,
    },
    {
      note: "rudolf 的 seqs 状态判定少一个",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  return strict_equals(*st, en(StateEnum::Standing)) ||
         strict_equals(*st, en(StateEnum::Walking)) ||
         strict_equals(*st, en(StateEnum::Defend));`,
      to: `  return strict_equals(*st, en(StateEnum::Standing)) ||
         strict_equals(*st, en(StateEnum::Walking));`,
    },
    {
      note: "rudolf 的 seqs 状态判定用错枚举",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  return strict_equals(*st, en(StateEnum::Standing)) ||
         strict_equals(*st, en(StateEnum::Walking)) ||`,
      to: `  return strict_equals(*st, en(StateEnum::Defend)) ||
         strict_equals(*st, en(StateEnum::Walking)) ||`,
    },
    {
      note: "rudolf 的 LRa/RLa 键名互换",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  so->set(u"LRa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(1)}}));`,
      to: `  so->set(u"RLa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(1)}}));`,
    },
    {
      note: "rudolf 的 LRa facing 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  so->set(u"LRa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(1)}}));`,
      to: `  so->set(u"LRa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(-1)}}));`,
    },
    {
      note: "rudolf 的 RLa facing 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  so->set(u"RLa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(-1)}}));`,
      to: `  so->set(u"RLa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(1)}}));`,
    },
    {
      note: "rudolf 的 RLa 动作 id 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  so->set(u"RLa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(-1)}}));`,
      to: `  so->set(u"RLa", make_obj({{u"id", s(u"71")}, {u"mp", n(60)}, {u"facing", n(-1)}}));`,
    },
    {
      note: "rudolf 的 LRa mp 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  so->set(u"LRa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(1)}}));`,
      to: `  so->set(u"LRa", make_obj({{u"id", s(u"70")}, {u"mp", n(61)}, {u"facing", n(1)}}));`,
    },
    {
      note: "rudolf 的 seqs 键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    f->set(u"seqs", target);`,
      to: `    f->set(u"seq", target);`,
    },
    {
      note: "rudolf 的 bg_face 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  set_bg_face(data, u"sprite/MENU_BACK12.png");`,
      to: `  set_bg_face(data, u"sprite/MENU_BACK1.png");`,
    },
    {
      note: "添加电击时漏掉 85..95 的下界判断",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (frame_no >= 85.0 && frame_no <= 95.0) fn(frame);`,
      to: `    if (frame_no >= 86.0 && frame_no <= 95.0) fn(frame);`,
    },
    {
      note: "添加电击时上界 95 写小",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (frame_no >= 85.0 && frame_no <= 95.0) fn(frame);`,
      to: `    if (frame_no >= 85.0 && frame_no <= 94.0) fn(frame);`,
    },
    {
      note: "添加电击时区间判定写成 or",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (frame_no >= 85.0 && frame_no <= 95.0) fn(frame);`,
      to: `    if (frame_no >= 85.0 || frame_no <= 95.0) fn(frame);`,
    },
    {
      note: "louis 的电击时长写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    add_electroshock(frame, 200);
    apply_vbuff_expression(frame);`,
      to: `    add_electroshock(frame, 201);
    apply_vbuff_expression(frame);`,
    },
    {
      note: "louis 漏掉电击动作",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    add_electroshock(frame, 200);
    apply_vbuff_expression(frame);`,
      to: `    apply_vbuff_expression(frame);`,
    },
    {
      note: "louis 漏掉 seqs 表达式",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    add_electroshock(frame, 200);
    apply_vbuff_expression(frame);`,
      to: `    add_electroshock(frame, 200);`,
    },
    {
      note: "louisex 的电击时长写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  each_run_frame(data, [](Value& frame) { add_electroshock(frame, 400); });`,
      to: `  each_run_frame(data, [](Value& frame) { add_electroshock(frame, 401); });`,
    },
    {
      note: "电击的 hitflag 写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                     {u"hitflag", n(hit_flag_or(HitFlag::EnemyFighter, HitFlag::AllyFighter))},`,
      to: `                     {u"hitflag", n(hit_flag_or(HitFlag::EnemyFighter, HitFlag::Fighter))},`,
    },
    {
      note: "电击的 buff 名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `                     {u"buff", s(u"Electroshock")},`,
      to: `                     {u"buff", s(u"Electroshock2")},`,
    },
    {
      note: "电击动作类型写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `        {u"type", s(action_type::kV_BUFF)},`,
      to: `        {u"type", s(action_type::kA_BUFF)},`,
    },
    {
      note: "电击只认 kind 1",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (kind == nullptr || !strict_equals(*kind, n(0))) continue;`,
      to: `    if (kind == nullptr || !strict_equals(*kind, n(1))) continue;`,
    },
    {
      note: "电击的 effect 判定漏掉 truthy",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (effect != nullptr && truthy(*effect)) continue;`,
      to: `    if (effect != nullptr) continue;`,
    },
    {
      note: "电击总是覆盖 actions",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (!truthy(actions)) {
      actions = Value(std::make_shared<Array>());
      itr->set(u"actions", actions);
    }`,
      to: `    actions = Value(std::make_shared<Array>());
    itr->set(u"actions", actions);`,
    },
    {
      note: "seqs 表达式认错 id",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    if (id == nullptr || !strict_equals(*id, s(u"300"))) continue;`,
      to: `    if (id == nullptr || !strict_equals(*id, s(u"301"))) continue;`,
    },
    {
      note: "seqs 表达式写的键名写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `    jo->set(u"expression", Value(vbuff_expression()));`,
      to: `    jo->set(u"expression1", Value(vbuff_expression()));`,
    },
    {
      note: "seqs 的 ja 是对象时被当成不可迭代",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  if (const Array* a = as_array(*ja)) {
    for (size_t i = 0; i < a->size(); ++i) items.push_back(a->at(i));
  } else {
    items.push_back(*ja);
  }`,
      to: `  if (const Array* a = as_array(*ja)) {
    for (size_t i = 0; i < a->size(); ++i) items.push_back(a->at(i));
  }`,
    },
    {
      note: "vbuff 表达式比较符写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  cm.add(s(entity_val::kIsSurvialRankMode), u"!=", n(1))`,
      to: `  cm.add(s(entity_val::kIsSurvialRankMode), u"==", n(1))`,
    },
    {
      note: "vbuff 表达式左值写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `  cm.add(s(entity_val::kIsSurvialRankMode), u"!=", n(1))`,
      to: `  cm.add(s(entity_val::kHP_P), u"!=", n(1))`,
    },
    {
      note: "vbuff 表达式的血量阈值写错",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `      .and_(s(entity_val::kHP_P), u"<=", n(33))`,
      to: `      .and_(s(entity_val::kHP_P), u"<=", n(34))`,
    },
    {
      note: "vbuff 表达式的 or 写成 and",
      file: "native/lfw/dat_translator/fighters/fighters.cpp",
      from: `      .or_(s(entity_val::kLF2_NET_ON), u"==", n(1));
  return cm.done();`,
      to: `      .and_(s(entity_val::kLF2_NET_ON), u"==", n(1));
  return cm.done();`,
    },
  ],
};
