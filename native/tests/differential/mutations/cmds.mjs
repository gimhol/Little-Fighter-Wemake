// `LFW/cmds` 第一批（CMDS 调度器 + 首批纯世界命令）的变异档。
//
// 用例：`cases/cmds/{parse,fs,kill,puppet,handle}.txt`（任一锁住即可）。
//
// 有意不覆盖（不可观察 / 不建形 / 记在 DESIGN）：
//   * 全空白命令：TS `handle` 里 `words[0].toLowerCase()` 会 TypeError，端口跳过 ⇒ 无
//     共同可观测量（用例不碰这种命令）。
//   * 后来补的命令族（cheat / SPAWN / SET_PUPPET / F8 见 `cmds2.mjs`；KEY_EVENT / POINTER_EVENTS /
//     F4 还没有变异档）：调度层「handler 空指针」的分支没有对侧可比。
//   * `handle` 里 `inst->world_ != &world` 的实例复用：CMDS 无跨世界可观察状态。
//   * `F9` 的数组快照（`Array.from` 语义）：循环里 `set_hp(0)` 不同步摘实体 ⇒ 引用遍历同观。
//   * `F7` 的 `hp_r = hp = hp_max` 写入次序 / `hp_max` 读两次：无中间读数方，同观。
//   * `args` 撞原型键（`constructor` 等）：端口用 `std::map`，机制层面就不同（数据不可达）。
//   * 四个舞台击杀方法（`kill_all` / `kill_boss` / `kill_others` / `kill_soliders`）的互换：
//     它们只遍历 `stage.items`，台面没有重生流程 ⇒ 都是空转（消息/守卫那几层已覆盖）。
//   * `starts_with_dash` 的 `size() >= 2` → `>= 1`：单字符串下 `s[1]` 读到空终止符，
//     两版表现一致 ⇒ 等价变异，不列。
export default {
  subject: "cmds",
  cases: ["parse", "fs", "kill", "puppet", "handle"],
  mutations: [
    // ------------------------------------------------------------ 词法解析
    {
      note: "set_cmd：分隔符改成 Tab（只按空格切）",
      file: "native/lfw/cmds/cmds.cpp",
      from: `    if (i != cmd.size() && cmd[i] != u' ') continue;
    const std::u16string part = js_trim(cmd.substr(start, i - start));`,
      to: `    if (i != cmd.size() && cmd[i] != u'\\t') continue;
    const std::u16string part = js_trim(cmd.substr(start, i - start));`,
    },
    {
      note: "set_cmd：不做 js_trim",
      file: "native/lfw/cmds/cmds.cpp",
      from: `    const std::u16string part = js_trim(cmd.substr(start, i - start));
    start = i + 1;
    if (part.empty()) continue;`,
      to: `    const std::u16string part = cmd.substr(start, i - start);
    start = i + 1;
    if (part.empty()) continue;`,
    },
    {
      note: "set_cmd：空词不跳过（照样入表）",
      file: "native/lfw/cmds/cmds.cpp",
      from: `    if (part.empty()) continue;
    words_.push_back(part);
    if (!starts_with_dash(part)) positionals_.push_back(part);`,
      to: `    words_.push_back(part);
    if (!starts_with_dash(part)) positionals_.push_back(part);`,
    },
    {
      note: "positionals：不滤 `--` 开头的词",
      file: "native/lfw/cmds/cmds.cpp",
      from: `    words_.push_back(part);
    if (!starts_with_dash(part)) positionals_.push_back(part);`,
      to: `    words_.push_back(part);
    positionals_.push_back(part);`,
    },
    // ------------------------------------------------------------ args / nums
    {
      note: "args：`=` 在开头（eq == 0）也算命名参数",
      file: "native/lfw/cmds/cmds.cpp",
      from: `      if (eq != std::u16string::npos && eq > 0) {`,
      to: `      if (eq != std::u16string::npos) {`,
    },
    {
      note: "args：同名参数首胜（不覆盖）",
      file: "native/lfw/cmds/cmds.cpp",
      from: `        map[token.substr(0, eq)] = token.substr(eq + 1);`,
      to: `        if (map.find(token.substr(0, eq)) == map.end()) map[token.substr(0, eq)] = token.substr(eq + 1);`,
    },
    {
      note: "args：非 `=` 词不入表",
      file: "native/lfw/cmds/cmds.cpp",
      from: `      } else {
        map[token] = std::u16string();
      }`,
      to: `      } else {
        continue;
      }`,
    },
    {
      note: "nums：丢空段（`1,2,,3` 少一个 0）",
      file: "native/lfw/cmds/cmds.cpp",
      from: `std::optional<std::vector<double>> CMDS::nums(size_t index) const {
  const std::optional<std::u16string> s = str(index);
  if (!s.has_value()) return std::nullopt;
  std::vector<double> out;
  size_t start = 0;
  for (size_t i = 0; i <= s->size(); ++i) {
    if (i != s->size() && (*s)[i] != u',') continue;
    out.push_back(string_to_number(s->substr(start, i - start)));`,
      to: `std::optional<std::vector<double>> CMDS::nums(size_t index) const {
  const std::optional<std::u16string> s = str(index);
  if (!s.has_value()) return std::nullopt;
  std::vector<double> out;
  size_t start = 0;
  for (size_t i = 0; i <= s->size(); ++i) {
    if (i != s->size() && (*s)[i] != u',') continue;
    if (i > start) out.push_back(string_to_number(s->substr(start, i - start)));`,
    },
    // ------------------------------------------------------------ 注册 / 查表
    {
      note: "handler：查表前不降格键",
      file: "native/lfw/cmds/cmds.cpp",
      from: `  const std::map<std::u16string, CmdHandler>::const_iterator it = table.find(lower(key));`,
      to: `  const std::map<std::u16string, CmdHandler>::const_iterator it = table.find(key);`,
    },
    {
      note: "put：默认命令登记键不降格",
      file: "native/lfw/cmds/cmds.cpp",
      from: `void put(const std::u16string& key, const char16_t* help, CmdHandler fn) {
  Registry& r = registry();
  const std::u16string k = lower(key);`,
      to: `void put(const std::u16string& key, const char16_t* help, CmdHandler fn) {
  Registry& r = registry();
  const std::u16string k = key;`,
    },
    {
      note: "register_cmd：登记键不降格",
      file: "native/lfw/cmds/cmds.cpp",
      from: `void CMDS::register_cmd(const std::u16string& key, const std::u16string& help, CmdHandler fn) {
  ensure_ready();
  Registry& r = registry();
  const std::u16string k = lower(key);`,
      to: `void CMDS::register_cmd(const std::u16string& key, const std::u16string& help, CmdHandler fn) {
  ensure_ready();
  Registry& r = registry();
  const std::u16string k = key;`,
    },
    // ------------------------------------------------------------ F 系
    {
      note: "F1：不再取反（等价于永远暂停/继续同一档）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.set_paused(!world.paused());`,
      to: `  world.set_paused(world.paused());`,
    },
    {
      note: "F2：单步值 2 → 1",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `void cmd_f2(CMDS& ctx) { ctx.world().set_paused_value(2); }`,
      to: `void cmd_f2(CMDS& ctx) { ctx.world().set_paused_value(1); }`,
    },
    {
      note: "F3：锁定值 1 → 0",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `void cmd_f3(CMDS& ctx) { ctx.world().set_fn_locked_value(1); }`,
      to: `void cmd_f3(CMDS& ctx) { ctx.world().set_fn_locked_value(0); }`,
    },
    {
      note: "F5：严格 `=== 1` 改成宽松真值",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.dataset.set(u"playrate",
                    Value(strict_equals(world.dataset.get(u"playrate"), Value(1.0)) ? 1000.0 : 1.0));`,
      to: `  world.dataset.set(u"playrate",
                    Value(truthy(world.dataset.get(u"playrate")) ? 1000.0 : 1.0));`,
    },
    {
      note: "F5：两个档位值互换",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.dataset.set(u"playrate",
                    Value(strict_equals(world.dataset.get(u"playrate"), Value(1.0)) ? 1000.0 : 1.0));`,
      to: `  world.dataset.set(u"playrate",
                    Value(strict_equals(world.dataset.get(u"playrate"), Value(1.0)) ? 1.0 : 1000.0));`,
    },
    {
      note: "F5：读错 dataset 键（playrate → infinity_mp）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `                    Value(strict_equals(world.dataset.get(u"playrate"), Value(1.0)) ? 1000.0 : 1.0));`,
      to: `                    Value(strict_equals(world.dataset.get(u"infinity_mp"), Value(1.0)) ? 1000.0 : 1.0));`,
    },
    {
      note: "F6：无限 MP 键写错（infinity_mp → difficulty）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.dataset.set(u"infinity_mp", Value(truthy(world.dataset.get(u"infinity_mp")) ? 0.0 : 1.0));`,
      to: `  world.dataset.set(u"difficulty", Value(truthy(world.dataset.get(u"infinity_mp")) ? 0.0 : 1.0));`,
    },
    {
      note: "F6：计数键写错（f6 → f7）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.add_count(u"f6", 1.0);`,
      to: `  world.add_count(u"f7", 1.0);`,
    },
    {
      note: "F7：计数键写错（f7 → f6）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.add_count(u"f7", 1.0);`,
      to: `  world.add_count(u"f6", 1.0);`,
    },
    {
      note: "F9：计数键写错（f9 → f10）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.add_count(u"f9", 1.0);`,
      to: `  world.add_count(u"f10", 1.0);`,
    },
    {
      note: "F10：计数键写错（f10 → f9）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.add_count(u"f10", 1.0);`,
      to: `  world.add_count(u"f9", 1.0);`,
    },
    {
      note: "F6：两条守卫次序互换",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  if (world.fn_locked()) {
    world.lfw().debug(u"F6 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F6 failed, Stage Limited.");
    return;
  }`,
      to: `  if (world.stage_limit()) {
    world.lfw().debug(u"F6 failed, Stage Limited.");
    return;
  }
  if (world.fn_locked()) {
    world.lfw().debug(u"F6 failed, Fn Locked.");
    return;
  }`,
    },
    {
      note: "F7：两条守卫次序互换",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  if (world.fn_locked()) {
    world.lfw().debug(u"F7 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F7 failed, Stage Limited.");
    return;
  }`,
      to: `  if (world.stage_limit()) {
    world.lfw().debug(u"F7 failed, Stage Limited.");
    return;
  }
  if (world.fn_locked()) {
    world.lfw().debug(u"F7 failed, Fn Locked.");
    return;
  }`,
    },
    {
      note: "F9：两条守卫次序互换",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  if (world.fn_locked()) {
    world.lfw().debug(u"F9 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F9 failed, Stage Limited.");
    return;
  }`,
      to: `  if (world.stage_limit()) {
    world.lfw().debug(u"F9 failed, Stage Limited.");
    return;
  }
  if (world.fn_locked()) {
    world.lfw().debug(u"F9 failed, Fn Locked.");
    return;
  }`,
    },
    {
      note: "F10：两条守卫次序互换",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  if (world.fn_locked()) {
    world.lfw().debug(u"F10 failed, Fn Locked.");
    return;
  }
  if (world.stage_limit()) {
    world.lfw().debug(u"F10 failed, Stage Limited.");
    return;
  }`,
      to: `  if (world.stage_limit()) {
    world.lfw().debug(u"F10 failed, Stage Limited.");
    return;
  }
  if (world.fn_locked()) {
    world.lfw().debug(u"F10 failed, Fn Locked.");
    return;
  }`,
    },
    {
      note: "F6：关卡限制分支文案变体",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  world.lfw().debug(u"F6 failed, Stage Limited.");`,
      to: `  world.lfw().debug(u"F6 failed, stage limited.");`,
    },
    {
      note: "F7：过滤条件反了（治武器不治 fighter）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `    if (!entity::is_fighter(*e)) continue;`,
      to: `    if (!entity::is_weapon(*e)) continue;`,
    },
    {
      note: "F9：过滤条件反了（杀 fighter 不杀武器）",
      file: "native/lfw/cmds/cmd_f.cpp",
      from: `  const std::vector<Entity*> entities = world.entities;
  for (Entity* const e : entities) {
    if (e != nullptr && entity::is_weapon(*e)) e->set_hp(0.0);`,
      to: `  const std::vector<Entity*> entities = world.entities;
  for (Entity* const e : entities) {
    if (e != nullptr && entity::is_fighter(*e)) e->set_hp(0.0);`,
    },
    // ------------------------------------------------------------ KILL 系
    {
      note: "KILL：`--team=` 空串也走整队分支",
      file: "native/lfw/cmds/cmd_kill.cpp",
      from: `  if (team.has_value() && !team->empty()) {`,
      to: `  if (team.has_value()) {`,
    },
    {
      note: "KILL：整队比较恒真（全 fighter 通杀）",
      file: "native/lfw/cmds/cmd_kill.cpp",
      from: `      if (entity::is_fighter(*e) &&
          strict_equals(Value(e->team()), Value(*team))) {
        e->set_hp(0.0);
      }`,
      to: `      if (entity::is_fighter(*e) &&
          true) {
        e->set_hp(0.0);
      }`,
    },
    {
      note: "KILL：整队击杀写 hp=2（不是 0）",
      file: "native/lfw/cmds/cmd_kill.cpp",
      from: `      if (entity::is_fighter(*e) &&
          strict_equals(Value(e->team()), Value(*team))) {
        e->set_hp(0.0);
      }`,
      to: `      if (entity::is_fighter(*e) &&
          strict_equals(Value(e->team()), Value(*team))) {
        e->set_hp(2.0);
      }`,
    },
    {
      note: "KILL：逐词击杀写 hp=1（不是 0）",
      file: "native/lfw/cmds/cmd_kill.cpp",
      from: `    Entity* const e = world.find_entity(token);
    if (e == nullptr) continue;
    e->set_hp(0.0);`,
      to: `    Entity* const e = world.find_entity(token);
    if (e == nullptr) continue;
    e->set_hp(1.0);`,
    },
    {
      note: "KILL_BOSS：守卫取反（受限时反而动手）",
      file: "native/lfw/cmds/cmd_kill.cpp",
      from: `  if (world.stage_limit()) {
    world.lfw().debug(u"KILL_BOSS failed, Stage Limited.");
    return;
  }
  world.stage()->kill_boss();`,
      to: `  if (!world.stage_limit()) {
    world.lfw().debug(u"KILL_BOSS failed, Stage Limited.");
    return;
  }
  world.stage()->kill_boss();`,
    },
    {
      note: "KILL_BOSS：文案偷换成 KILL_ENEMIES",
      file: "native/lfw/cmds/cmd_kill.cpp",
      from: `    world.lfw().debug(u"KILL_BOSS failed, Stage Limited.");`,
      to: `    world.lfw().debug(u"KILL_ENEMIES failed, Stage Limited.");`,
    },

    {
      note: "KILL_SOLIDERS：文案拼写（SOLIDERS → SOLDERS）",
      file: "native/lfw/cmds/cmd_kill.cpp",
      from: `    world.lfw().debug(u"KILL_SOLIDERS failed, Stage Limited.");`,
      to: `    world.lfw().debug(u"KILL_SOLDERS failed, Stage Limited.");`,
    },
    // ------------------------------------------------------------ 场景命令
    {
      note: "BGM：缺参默认值 `?` 改成空串",
      file: "native/lfw/cmds/cmd_scene.cpp",
      from: `  ctx.world().lfw().sounds_play_bgm(Value(id.has_value() ? *id : std::u16string(u"?")));`,
      to: `  ctx.world().lfw().sounds_play_bgm(Value(id.has_value() ? *id : std::u16string(u"")));`,
    },
    {
      note: "BGM：取词索引 1 → 0（把命令名当 id）",
      file: "native/lfw/cmds/cmd_scene.cpp",
      from: `void cmd_bgm(CMDS& ctx) {
  const std::optional<std::u16string> id = ctx.str(1);`,
      to: `void cmd_bgm(CMDS& ctx) {
  const std::optional<std::u16string> id = ctx.str(0);`,
    },
    {
      note: "SET_DIFFICULTY：去掉难度合法性检查",
      file: "native/lfw/cmds/cmd_scene.cpp",
      from: `  if (!d.has_value() || !defines::is_difficulty(*d)) {`,
      to: `  if (!d.has_value()) {`,
    },
    {
      note: "SET_DIFFICULTY：取词索引 1 → 0（Number 转换全 NaN）",
      file: "native/lfw/cmds/cmd_scene.cpp",
      from: `  const std::optional<double> d = ctx.num(1);`,
      to: `  const std::optional<double> d = ctx.num(0);`,
    },
    {
      note: "SET_DIFFICULTY：提示文案里的 `${1|2|3|4}` 拆掉",
      file: "native/lfw/cmds/cmd_scene.cpp",
      from: `    ctx.world().lfw().warn(u"SET_DIFFICULTY failed, must \\"SET_DIFFICULTY \${1|2|3|4}\\", got: " +`,
      to: `    ctx.world().lfw().warn(u"SET_DIFFICULTY failed, must \\"SET_DIFFICULTY {1|2|3|4}\\", got: " +`,
    },
    {
      note: "SET_DIFFICULTY：写入 undefined 而不是难度值",
      file: "native/lfw/cmds/cmd_scene.cpp",
      from: `  ctx.world().dataset.set(u"difficulty", Value(*d));`,
      to: `  ctx.world().dataset.set(u"difficulty", Value());`,
    },
    // ------------------------------------------------------------ 相机命令
    {
      note: "DIST_CAM：缺参去 unlock（而不是 undest）",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `  if (!nums.has_value()) {
    world.camera().undest();
    return;
  }`,
      to: `  if (!nums.has_value()) {
    world.camera().unlock();
    return;
  }`,
    },
    {
      note: "DIST_CAM：去掉 x 的 NaN 检查",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `  if (std::isnan(x)) {
    world.lfw().warn(u"DIST_CAM failed, x got " + to_string(Value(x)) + u".");
    return;
  }`,
      to: `  if (std::isnan(x)) {
  }`,
    },
    {
      note: "DIST_CAM：去掉 y 的 NaN 检查",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `  if (std::isnan(y)) {
    world.lfw().warn(u"DIST_CAM failed, y got " + to_string(Value(y)) + u".");
    return;
  }`,
      to: `  if (std::isnan(y)) {
  }`,
    },
    {
      note: "DIST_CAM：y 缺省值 0 改成复读 x",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `  y = nums.size() > 1 ? nums[1] : 0.0;`,
      to: `  y = nums.size() > 1 ? nums[1] : nums[0];`,
    },
    {
      note: "DIST_CAM：x 的告警文案换成 y",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `    world.lfw().warn(u"DIST_CAM failed, x got " + to_string(Value(x)) + u".");`,
      to: `    world.lfw().warn(u"DIST_CAM failed, y got " + to_string(Value(x)) + u".");`,
    },
    {
      note: "LOCK_CAM：缺参去 undest（而不是 unlock）",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `  if (!nums.has_value()) {
    world.camera().unlock();
    return;
  }`,
      to: `  if (!nums.has_value()) {
    world.camera().undest();
    return;
  }`,
    },
    {
      note: "LOCK_CAM：去掉 x 的 NaN 检查",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `  if (std::isnan(x)) {
    world.lfw().warn(u"LOCK_CAM failed, x got " + to_string(Value(x)) + u".");
    return;
  }`,
      to: `  if (std::isnan(x)) {
  }`,
    },
    {
      note: "LOCK_CAM：坐标写反（lock(y, x)）",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `  world.camera().lock(x, y);`,
      to: `  world.camera().lock(y, x);`,
    },
    {
      note: "LOCK_CAM：x 的告警文案换成 y",
      file: "native/lfw/cmds/cmd_camera.cpp",
      from: `    world.lfw().warn(u"LOCK_CAM failed, x got " + to_string(Value(x)) + u".");`,
      to: `    world.lfw().warn(u"LOCK_CAM failed, y got " + to_string(Value(x)) + u".");`,
    },
    // ------------------------------------------------------------ 实体命令
    {
      note: "DESPAWN：删实体改成打空血",
      file: "native/lfw/cmds/cmd_entity.cpp",
      from: `    Entity* const e = world.find_entity(id);
    if (e == nullptr) continue;
    world.del_entity(*e);`,
      to: `    Entity* const e = world.find_entity(id);
    if (e == nullptr) continue;
    e->set_hp(0.0);`,
    },
    {
      note: "DEL_PUPPET：缺参文案的占位名（playerId → player_id）",
      file: "native/lfw/cmds/cmd_entity.cpp",
      from: `    world.lfw().warn(u"DEL_PUPPET failed, must \\"DEL_PUPPET \${playerId}\\", got: " + ctx.cmd());`,
      to: `    world.lfw().warn(u"DEL_PUPPET failed, must \\"DEL_PUPPET \${player_id}\\", got: " + ctx.cmd());`,
    },
    {
      note: "DEL_PUPPET：未命中文案变体",
      file: "native/lfw/cmds/cmd_entity.cpp",
      from: `    world.lfw().warn(u"DEL_PUPPET failed, puppet not found.");`,
      to: `    world.lfw().warn(u"DEL_PUPPET failed, not found.");`,
    },
    {
      note: "DEL_PUPPET：命中后改成打空血（不摘除）",
      file: "native/lfw/cmds/cmd_entity.cpp",
      from: `  if (entity != nullptr) {
    world.del_entity(*entity);
  } else {`,
      to: `  if (entity != nullptr) {
    entity->set_hp(0.0);
  } else {`,
    },
    {
      note: "DEL_PUPPET：查找条件取反",
      file: "native/lfw/cmds/cmd_entity.cpp",
      from: `    if (kv.first == *player_id) entity = kv.second;`,
      to: `    if (kv.first != *player_id) entity = kv.second;`,
    },
  ],
};
