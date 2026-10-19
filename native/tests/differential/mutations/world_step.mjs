// `World::step` / `update_once` / `catch_up` / `start_update` 与 `Entity::release`
// （`native/lfw/world.cpp`、`native/lfw/entity/entity.cpp`）的变异档。用例是
// `cases/world/step.txt` + `cases/world/render.txt`。
//
// 有意不覆盖（不可观察、按构造等价、或要等下一刀）：
//   * `step` 里 `get_bound` 的边界与碰撞配对（`collision_get` / `collisions_keeper.handle`）：
//     本刀故意不搬（4L）⇒ `pairs_compared` 只在「两实体 x 的 AABB 相等」时才会计数，用例里
//     刻意让所有实体的 x 互不相同，所以整段都够不着；
//   * `collisions.clear()` / `pair_collisions_.clear()`：4K 里没有东西往里写（配对是 4L），
//     清空前后一样 ⇒ 等 4L 的用例；
//   * buff 那四句（`_dead_buffs` 清空 / `collect_dead_buff` / `unmount` / `recycle_buff`）：
//     台面还没有真 `Buff`（Buff 那一刀的宿主面在别的 subject 里）；
//   * `if (extra_steps > 0) catch_up();` 写成 `>= 0`：`extra_steps === 0` 时 `catch_up` 只有
//     一次 `clock_now()` 的差别，而台面的时钟槽被端口拿来映射 TS 的 `Date.now()`（`on_step_error`
//     等）⇒ 这一读没法逐字比较，按构造等价撤出；
//   * `on_step_error` 的文本：端口的 `on_step_error` 收的是已经拼好前缀的消息（TS 收的是
//     `Error` 对象、`Ditto.warn(e)` 打的是 `String(e)`）⇒ 错误路径在台面上会漂，等 `LFW`
//     那一刀把 `Ditto.warn` 的格式化落了再补；
//   * 两个 `gones_has(...)` 跳过（实体表与幽灵表各一个）：进 `_gones` 的实体在同一帧就先从
//     `entities` / `ghosts` 里被 `offset` 摘掉了，下一帧开头 `gones_.clear()` 又清空 ⇒ 这两支
//     按构造都到不了；
//   * 相机 y 的 z 那一项（`-0.5 * round(z_sum / count)` 的 `-0.5`）：`Entity.update` 每帧都从
//     state 快照里重写 `position`，台面改不到 `position.z`（改了就崩：TS 要求 `data.frames`），
//     所以 z 求和恒 0 ⇒ 三个分支的 `-0.5` 不可分辨；`half_h` 那一半用 zoom = 0 的后台能杀；
//   * `Entity::release` 里除了挂载门之外的那五句：台面里所有实体的 `_mounted` 都是 0（挂载要
//     真 `Factory` / holding 那一刀的用例）⇒ `release()` 整体早退，里面 drop/clean
//     holding&catching、`on_disposed`、`reset`、`del_entity` 全在门外；反过来把**挂载门**去掉
//     会让整段跑起来 ⇒ 那一刀留在档里、是杀得掉的；
//   * 「`_gones` 清运时不再 `mark_players_alive(entity, false)`」：`step` 里那句
//     `set_hp(0)` 已经通过 `Entity::set_hp` → 宿主把存活标成 false，清运时的这次是**冗余**的
//     （hp 本来就 0 的实体根本不在存活表里）⇒ 台面分辨不出来；
//   * 台面自己的 `w*` op 与 dump 行。
//   * `update_once` 里 `worker != nullptr` 那一段（`TU` / `on_ups_update` / 「`sync_render` 变了
//     就重启渲染线程」）与 `start_update` 里 worker 的交接：这几句只有 **Ticker 真的步进**时才
//     走得到，而台面的假时钟推 `Ticker` 时它只会重新排期（`wtick` 的粒度与 `sleep_threshold` /
//     `redeadline` 那一套还没对齐）⇒ 逐条验证过「改了没漂」，等 `LFW` 那一刀接真时钟再补；
//   * `Entity::release` 里除了挂载门之外的那五句：台面里所有实体的 `_mounted` 都是 0（挂载要
//     真 `Factory` / holding 那一刀的用例）⇒ `release()` 整体早退，里面 drop/clean
//     holding&catching、`on_disposed`、`reset`、`del_entity` 全在门外；反过来把**挂载门**去掉
//     会让整段跑起来 ⇒ 那一刀留在档里、是杀得掉的；
//   * 「`_gones` 清运时不再 `mark_players_alive(entity, false)`」：`step` 里那句 `set_hp(0)`
//     已经通过 `Entity::set_hp` → 宿主把存活标成 false，清运时这次是**冗余**的（hp 本来就 0 的
//     实体根本不在存活表里）⇒ 台面分辨不出来；
//   * 台面自己的 `w*` op 与 dump 行。
//   * `Entity::release` 的 `if (!truthy(Value(_mounted))) return;`：台面里没挂载过的实体走
//     不到 `del_entity`（要真 `lfw` 的挂载记录）。
export default {
  subject: "world",
  cases: ["step", "render"],
  mutations: [
    // ---------------------------------------------------------------- step：缓存与前置更新
    {
      note: "step: 不再清实体表缓存",
      file: "native/lfw/world.cpp",
      from: `void World::step() {
  entities_map_.clear();`,
      to: `void World::step() {`,
    },
    {
      note: "step: 不再 update transform",
      file: "native/lfw/world.cpp",
      from: `  entities_map_.clear();
  transform.update();
  update_ui();`,
      to: `  entities_map_.clear();
  update_ui();`,
    },
    {
      note: "step: 不再 update_ui",
      file: "native/lfw/world.cpp",
      from: `  transform.update();
  update_ui();
  handle_cmds();`,
      to: `  transform.update();
  handle_cmds();`,
    },
    {
      note: "step: 不再 handle_cmds",
      file: "native/lfw/world.cpp",
      from: `  update_ui();
  handle_cmds();
  update_camera();`,
      to: `  update_ui();
  update_camera();`,
    },
    {
      note: "step: 不再 update_camera",
      file: "native/lfw/world.cpp",
      from: `  handle_cmds();
  update_camera();
  if (bg_ != nullptr) bg_->update();`,
      to: `  handle_cmds();
  if (bg_ != nullptr) bg_->update();`,
    },
    {
      note: "step: 不再 update bg",
      file: "native/lfw/world.cpp",
      from: `  update_camera();
  if (bg_ != nullptr) bg_->update();`,
      to: `  update_camera();`,
    },
    // ---------------------------------------------------------------- step：暂停门
    {
      note: "step: paused == 1 早退失效",
      file: "native/lfw/world.cpp",
      from: `  if (paused_ == 1.0) return;
  if (paused_ == 2.0) paused_ = 1.0;`,
      to: `  if (paused_ == 1.0) {
  }
  if (paused_ == 2.0) paused_ = 1.0;`,
    },
    {
      note: "step: paused == 1 的比较写成 != 1",
      file: "native/lfw/world.cpp",
      from: `  if (paused_ == 1.0) return;`,
      to: `  if (paused_ != 1.0) return;`,
    },
    {
      note: "step: paused == 2 不再落到 1",
      file: "native/lfw/world.cpp",
      from: `  if (paused_ == 2.0) paused_ = 1.0;`,
      to: `  if (paused_ == 2.0) {
  }`,
    },
    {
      note: "step: 不再推进 game_time",
      file: "native/lfw/world.cpp",
      from: `  game_time_.add();
  team_alive_counts_.clear();`,
      to: `  team_alive_counts_.clear();`,
    },
    {
      note: "step: 不再清队伍存活表",
      file: "native/lfw/world.cpp",
      from: `  team_alive_counts_.clear();
  puppet_teams.clear();`,
      to: `  puppet_teams.clear();`,
    },
    {
      note: "step: 不再清傀儡队伍表",
      file: "native/lfw/world.cpp",
      from: `  puppet_teams.clear();

  if (stage_->world_pause()) return;`,
      to: `  if (stage_->world_pause()) return;`,
    },
    {
      note: "step: 舞台 world_pause 不再早退",
      file: "native/lfw/world.cpp",
      from: `  if (stage_->world_pause()) return;`,
      to: `  if (stage_->world_pause()) {
  }`,
    },
    {
      note: "step: DEV 调试打印的条件写成 <= 355",
      file: "native/lfw/world.cpp",
      from: `  if (lfw_->dev() && static_cast<double>(entities.size()) > kMaxDebugEntities) {`,
      to: `  if (lfw_->dev() && static_cast<double>(entities.size()) <= kMaxDebugEntities) {`,
    },
    {
      note: "step: DEV 门失效",
      file: "native/lfw/world.cpp",
      from: `  if (lfw_->dev() && static_cast<double>(entities.size()) > kMaxDebugEntities) {`,
      to: `  if (static_cast<double>(entities.size()) > kMaxDebugEntities) {`,
    },
                            // ---------------------------------------------------------------- step：可见宽度与实体推进
    {
      note: "step: view_w 的分母不再兜底 1",
      file: "native/lfw/world.cpp",
      from: `  const double view_w = to_number(dataset.get(u"screen_w")) / (truthy(Value(zoom_x)) ? zoom_x : 1);`,
      to: `  const double view_w = to_number(dataset.get(u"screen_w")) / zoom_x;`,
    },
    {
      note: "step: 前瞻量用 screen_w/3",
      file: "native/lfw/world.cpp",
      from: `  const double lead = to_number(dataset.get(u"screen_w")) / 6;`,
      to: `  const double lead = to_number(dataset.get(u"screen_w")) / 3;`,
    },
    {
      note: "step: 压实实体表时不搬元素",
      file: "native/lfw/world.cpp",
      from: `    if (offset != 0) {
      entities[i - static_cast<size_t>(offset)] = a;
    }`,
      to: `    if (offset != 0) {
    }`,
    },
    {
      note: "step: gone 判定只看 frame",
      file: "native/lfw/world.cpp",
      from: `    if (entity_is_gone(*a)) {
      a->set_hp(0.0);
      a->set_hp_r(0.0);
      gones_add(gones_, a);
      offset += 1;`,
      to: `    if (frame_is_gone(*a)) {
      a->set_hp(0.0);
      a->set_hp_r(0.0);
      gones_add(gones_, a);
      offset += 1;`,
    },
    {
      note: "step: gone 实体不清血",
      file: "native/lfw/world.cpp",
      from: `      a->set_hp(0.0);
      a->set_hp_r(0.0);
      gones_add(gones_, a);
      offset += 1;`,
      to: `      gones_add(gones_, a);
      offset += 1;`,
    },
    {
      note: "step: gone 实体不进 _gones",
      file: "native/lfw/world.cpp",
      from: `      gones_add(gones_, a);
      offset += 1;
      continue;`,
      to: `      offset += 1;
      continue;`,
    },
    {
      note: "step: gone 实体不占 offset",
      file: "native/lfw/world.cpp",
      from: `      gones_add(gones_, a);
      offset += 1;
      continue;
    }`,
      to: `      gones_add(gones_, a);
      continue;
    }`,
    },
        {
      note: "step: 实体不再 update",
      file: "native/lfw/world.cpp",
      from: `    a->update();

    if (entity::is_fighter(*a)) {`,
      to: `    if (entity::is_fighter(*a)) {`,
    },
    {
      note: "step: 存活队伍计数不再累加",
      file: "native/lfw/world.cpp",
      from: `        for (std::pair<std::u16string, double>& kv : team_alive_counts_) {
          if (kv.first == a->team()) {
            kv.second = count + 1;
            replaced = true;`,
      to: `        for (std::pair<std::u16string, double>& kv : team_alive_counts_) {
          if (kv.first == a->team()) {
            kv.second = count;
            replaced = true;`,
    },
    {
      note: "step: 新队伍不进存活表",
      file: "native/lfw/world.cpp",
      from: `        if (!replaced) team_alive_counts_.emplace_back(a->team(), count + 1);`,
      to: `        if (!replaced) team_alive_counts_.emplace_back(a->team(), count);`,
    },
    {
      note: "step: 血空的战士照样计入存活队伍",
      file: "native/lfw/world.cpp",
      from: `    if (entity::is_fighter(*a)) {
      if (a->hp() > 0) {`,
      to: `    if (entity::is_fighter(*a)) {
      if (true) {`,
    },
    {
      note: "step: 战士不再参与镜头求和",
      file: "native/lfw/world.cpp",
      from: `      fighter_x_sum += x;
      fighter_z_sum += z;
      fighter_count += 1;`,
      to: `      fighter_x_sum += x;
      fighter_z_sum += z;`,
    },
    {
      note: "step: 镜头的 x 不再减半宽",
      file: "native/lfw/world.cpp",
      from: `      const double x = a->position.x - view_w / 2 + a->facing * lead;`,
      to: `      const double x = a->position.x - view_w + a->facing * lead;`,
    },
    {
      note: "step: 镜头的 x 不要前瞻",
      file: "native/lfw/world.cpp",
      from: `      const double x = a->position.x - view_w / 2 + a->facing * lead;`,
      to: `      const double x = a->position.x - view_w / 2;`,
    },
    {
      note: "step: 镜头 x 用 z 采样",
      file: "native/lfw/world.cpp",
      from: `      const double x = a->position.x - view_w / 2 + a->facing * lead;
      const double z = a->position.z;`,
      to: `      const double x = a->position.x - view_w / 2 + a->facing * lead;
      const double z = a->position.x;`,
    },
    {
      note: "step: 血空的人类玩家照样计入镜头",
      file: "native/lfw/world.cpp",
      from: `      if (is_human_ctrl_ptr(ctrl) && a->hp() > 0) {`,
      to: `      if (is_human_ctrl_ptr(ctrl)) {`,
    },
    {
      note: "step: 非人类控制器也计入镜头",
      file: "native/lfw/world.cpp",
      from: `      if (is_human_ctrl_ptr(ctrl) && a->hp() > 0) {`,
      to: `      if (a->hp() > 0) {`,
    },
    {
      note: "step: mine 判定翻转",
      file: "native/lfw/world.cpp",
      from: `        if (truthy(field_or(ctrl->player, u"mine"))) {
          local_x_sum += x;
          local_z_sum += z;
          local_count += 1;
        } else {`,
      to: `        if (!truthy(field_or(ctrl->player, u"mine"))) {
          local_x_sum += x;
          local_z_sum += z;
          local_count += 1;
        } else {`,
    },
    {
      note: "step: local / human 的求和互换",
      file: "native/lfw/world.cpp",
      from: `          local_x_sum += x;
          local_z_sum += z;
          local_count += 1;
        } else {
          human_x_sum += x;
          human_z_sum += z;
          human_count += 1;`,
      to: `          human_x_sum += x;
          human_z_sum += z;
          human_count += 1;
        } else {
          local_x_sum += x;
          local_z_sum += z;
          local_count += 1;`,
    },
    {
      note: "step: 傀儡计数不再累加",
      file: "native/lfw/world.cpp",
      from: `        puppet_x_sum += x;
        puppet_z_sum += z;
        puppet_count += 1;`,
      to: `        puppet_x_sum += x;
        puppet_z_sum += z;`,
    },
    {
      note: "step: 傀儡队伍表不再去重",
      file: "native/lfw/world.cpp",
      from: `        if (!vec_has(puppet_teams, a->team())) puppet_teams.push_back(a->team());`,
      to: `        puppet_teams.push_back(a->team());`,
    },
    {
      note: "step: 非傀儡也进傀儡镜头求和",
      file: "native/lfw/world.cpp",
      from: `      if (a->puppet) {
        if (!vec_has(puppet_teams, a->team())) puppet_teams.push_back(a->team());`,
      to: `      if (true) {
        if (!vec_has(puppet_teams, a->team())) puppet_teams.push_back(a->team());`,
    },
    {
      note: "step: 实体表不再压实",
      file: "native/lfw/world.cpp",
      from: `  entities.resize(entities.size() - static_cast<size_t>(offset));`,
      to: `  entities.resize(entities.size());`,
    },
    // ---------------------------------------------------------------- step：幽灵
    {
      note: "step: 幽灵 gone 时不清血",
      file: "native/lfw/world.cpp",
      from: `      a->set_hp(0.0);
      a->set_hp_r(0.0);
      gones_add(gones_, a);
      goffset += 1;
      continue;`,
      to: `      a->set_hp(0.0);
      a->set_hp_r(0.0);
      gones_add(gones_, a);
      continue;`,
    },
    {
      note: "step: 幽灵不再 update_ghost",
      file: "native/lfw/world.cpp",
      from: `    a->update_ghost();
  }
  ghosts.resize(ghosts.size() - static_cast<size_t>(goffset));`,
      to: `  }
  ghosts.resize(ghosts.size() - static_cast<size_t>(goffset));`,
    },
    {
      note: "step: 幽灵表不压实",
      file: "native/lfw/world.cpp",
      from: `  ghosts.resize(ghosts.size() - static_cast<size_t>(goffset));`,
      to: `  ghosts.resize(ghosts.size());`,
    },
    // ---------------------------------------------------------------- step：排序、武器分带、lookup
    {
      note: "step: 实体按 x 排序倒过来",
      file: "native/lfw/world.cpp",
      from: `  std::stable_sort(entities.begin(), entities.end(), x_sorter);`,
      to: `  std::stable_sort(entities.begin(), entities.end(),
                   [](Entity* const a, Entity* const b) { return x_sorter(b, a); });`,
    },
    {
      note: "step: 不再清武器分带表",
      file: "native/lfw/world.cpp",
      from: `  ground_weapon_counts.clear();

  for (size_t i = 0; i < len; ++i) {`,
      to: `  for (size_t i = 0; i < len; ++i) {`,
    },
    {
      note: "step: 分带不取整",
      file: "native/lfw/world.cpp",
      from: `      const double section = round(a->position.x / kWeaponXSection);`,
      to: `      const double section = a->position.x / kWeaponXSection;`,
    },
    {
      note: "step: 分带的除数换成 500",
      file: "native/lfw/world.cpp",
      from: `      const double section = round(a->position.x / kWeaponXSection);`,
      to: `      const double section = round(a->position.x / 500);`,
    },
    {
      note: "step: 没落地的武器也进分带表",
      file: "native/lfw/world.cpp",
      from: `    if (entity::is_weapon(*a) && a->is_on_ground) {`,
      to: `    if (entity::is_weapon(*a)) {`,
    },
    {
      note: "step: 武器分带计数不累加",
      file: "native/lfw/world.cpp",
      from: `          kv.second = count + 1;
          replaced = true;
          break;
        }
      }
      if (!replaced) ground_weapon_counts.emplace_back(section, count + 1);`,
      to: `          kv.second = count;
          replaced = true;
          break;
        }
      }
      if (!replaced) ground_weapon_counts.emplace_back(section, count);`,
    },
    {
      note: "step: lookup 的间隔判定取反",
      file: "native/lfw/world.cpp",
      from: `    const bool lookingup = 0 == std::fmod(lifetime, kLookupUpdateInterval);`,
      to: `    const bool lookingup = 0 != std::fmod(lifetime, kLookupUpdateInterval);`,
    },
    {
      note: "step: lookup 的控制器门放宽（人类也算）",
      file: "native/lfw/world.cpp",
      from: `    if (lookingup && (is_ball_ctrl_ptr(ctrl) || is_bot_ctrl_ptr(ctrl))) {`,
      to: `    if (lookingup && (is_ball_ctrl_ptr(ctrl) || is_bot_ctrl_ptr(ctrl) ||
                      is_human_ctrl_ptr(ctrl))) {`,
    },
    {
      note: "step: lookup 传的下标变成 0",
      file: "native/lfw/world.cpp",
      from: `      lfw_->ctrl_update_lookup(*ctrl, static_cast<double>(i), entities);`,
      to: `      lfw_->ctrl_update_lookup(*ctrl, 0.0, entities);`,
    },
    {
      note: "step: 不再给控制器发 lookup",
      file: "native/lfw/world.cpp",
      from: `      lfw_->ctrl_update_lookup(*ctrl, static_cast<double>(i), entities);`,
      to: `      (void)i;`,
    },
    // ---------------------------------------------------------------- step：镜头目标四支
    {
      note: "step: 半屏高少除一个 2",
      file: "native/lfw/world.cpp",
      from: `      to_number(dataset.get(u"screen_h")) / (2 * (truthy(Value(zoom_y)) ? zoom_y : 1));`,
      to: `      to_number(dataset.get(u"screen_h")) / (truthy(Value(zoom_y)) ? zoom_y : 1);`,
    },
    {
      note: "step: 半屏高的缩放兜底失效",
      file: "native/lfw/world.cpp",
      from: `      to_number(dataset.get(u"screen_h")) / (2 * (truthy(Value(zoom_y)) ? zoom_y : 1));`,
      to: `      to_number(dataset.get(u"screen_h")) / (2 * zoom_y);`,
    },
    {
      note: "step: local 优先支的分母不除（直接用 1 个）",
      file: "native/lfw/world.cpp",
      from: `  if (truthy(Value(local_count))) {
    camera_->destination.x = round(local_x_sum / local_count);
    camera_->destination.y = -0.5 * round(local_z_sum / local_count) - half_h;
  } else if (truthy(Value(human_count))) {`,
      to: `  if (truthy(Value(local_count))) {
    camera_->destination.x = round(local_x_sum);
    camera_->destination.y = -0.5 * round(local_z_sum) - half_h;
  } else if (truthy(Value(human_count))) {`,
    },
        {
      note: "step: 镜头的 y 不再减半屏高",
      file: "native/lfw/world.cpp",
      from: `    camera_->destination.x = round(puppet_x_sum / puppet_count);
    camera_->destination.y = -0.5 * round(puppet_z_sum / puppet_count) - half_h;
  } else if (truthy(Value(fighter_count))) {`,
      to: `    camera_->destination.x = round(puppet_x_sum / puppet_count);
    camera_->destination.y = -0.5 * round(puppet_z_sum / puppet_count);
  } else if (truthy(Value(fighter_count))) {`,
    },
    {
      note: "step: human 与 puppet 两支互换优先级",
      file: "native/lfw/world.cpp",
      from: `  } else if (truthy(Value(human_count))) {
    camera_->destination.x = round(human_x_sum / human_count);
    camera_->destination.y = -0.5 * round(human_z_sum / human_count) - half_h;
  } else if (truthy(Value(puppet_count))) {`,
      to: `  } else if (truthy(Value(puppet_count))) {
    camera_->destination.x = round(human_x_sum / human_count);
    camera_->destination.y = -0.5 * round(human_z_sum / human_count) - half_h;
  } else if (truthy(Value(human_count))) {`,
    },
    {
      note: "step: fighter 那一支用傀儡的和",
      file: "native/lfw/world.cpp",
      from: `    camera_->destination.x = round(fighter_x_sum / fighter_count);
    camera_->destination.y = -0.5 * round(fighter_z_sum / fighter_count) - half_h;`,
      to: `    camera_->destination.x = round(puppet_x_sum / fighter_count);
    camera_->destination.y = -0.5 * round(puppet_z_sum / fighter_count) - half_h;`,
    },
    {
      note: "step: fighter 那一支直接早退（只留前三支）",
      file: "native/lfw/world.cpp",
      from: `  } else if (truthy(Value(fighter_count))) {
    camera_->destination.x = round(fighter_x_sum / fighter_count);
    camera_->destination.y = -0.5 * round(fighter_z_sum / fighter_count) - half_h;
  }`,
      to: `  }`,
    },
    // ---------------------------------------------------------------- step：_gones 清运
    {
      note: "step: gone 实体不从 entity_map 摘掉",
      file: "native/lfw/world.cpp",
      from: `    for (size_t i = 0; i < entity_map.size(); ++i) {
      if (entity_map[i].first == entity->id) {
        entity_map.erase(entity_map.begin() + static_cast<ptrdiff_t>(i));
        break;
      }
    }
    mark_players_alive(*entity, false);`,
      to: `    mark_players_alive(*entity, false);`,
    },
        {
      note: "step: gone 战士不发 on_fighter_del",
      file: "native/lfw/world.cpp",
      from: `    if (entity::is_fighter(*entity)) {
      callbacks.call(u"on_fighter_del",`,
      to: `    if (false) {
      callbacks.call(u"on_fighter_del",`,
    },
    {
      note: "step: on_fighter_del 不传实体",
      file: "native/lfw/world.cpp",
      from: `      callbacks.call(u"on_fighter_del",
                     {WorldCallbackArgs{this, entity, nullptr, nullptr, Value(), Value(),`,
      to: `      callbacks.call(u"on_fighter_del",
                     {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),`,
    },
    {
      note: "step: gone 实体不清玩家的 fighter",
      file: "native/lfw/world.cpp",
      from: `    if (player != nullptr) player->set_fighter(nullptr);`,
      to: `    (void)player;`,
    },
    {
      note: "step: gone 实体不清傀儡表",
      file: "native/lfw/world.cpp",
      from: `    if (puppet == entity) {
      for (size_t i = 0; i < puppets.size(); ++i) {
        if (puppets[i].first == player_id) {
          puppets.erase(puppets.begin() + static_cast<ptrdiff_t>(i));
          break;
        }
      }
    }`,
      to: `    (void)puppet;`,
    },
    {
      note: "step: gone 实体不摘 puppet 标记",
      file: "native/lfw/world.cpp",
      from: `    entity->puppet = false;
    callbacks.call(u"on_puppet_del",`,
      to: `    callbacks.call(u"on_puppet_del",`,
    },
    {
      note: "step: on_puppet_del 不传玩家 id",
      file: "native/lfw/world.cpp",
      from: `    callbacks.call(u"on_puppet_del",
                   {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),
                                      std::u16string(player_id)}});`,
      to: `    callbacks.call(u"on_puppet_del",
                   {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),
                                      std::u16string()}});`,
    },
    {
      note: "step: 渲染器不再删实体",
      file: "native/lfw/world.cpp",
      from: `    renderer_->del_entity(*entity);
    entity->release();`,
      to: `    entity->release();`,
    },
        {
      note: "step: gone 实体不回收",
      file: "native/lfw/world.cpp",
      from: `    lfw_->recycle_entity(entity);
  }
  gones_.clear();`,
      to: `  }
  gones_.clear();`,
    },
    {
      note: "step: 清运完不清 _gones",
      file: "native/lfw/world.cpp",
      from: `  gones_.clear();
  stage_->update();`,
      to: `  stage_->update();`,
    },
    {
      note: "step: 末尾不再推进舞台",
      file: "native/lfw/world.cpp",
      from: `  gones_.clear();
  stage_->update();
}`,
      to: `  gones_.clear();
}`,
    },
    // ---------------------------------------------------------------- update_once
    {
      note: "update_once: 休眠门失效",
      file: "native/lfw/world.cpp",
      from: `void World::update_once(double dt) {
  if (sleeping_) return;`,
      to: `void World::update_once(double dt) {`,
    },
    {
      note: "update_once: before_update 钩子失效",
      file: "native/lfw/world.cpp",
      from: `  if (before_update) before_update();
  if (sleeping_) return;
  step();`,
      to: `  if (sleeping_) return;
  step();`,
    },
    {
      note: "update_once: before_update 之后不再检查休眠",
      file: "native/lfw/world.cpp",
      from: `  if (before_update) before_update();
  if (sleeping_) return;
  step();
  lifetime_ += 1.0;
  lfw_->clear_cmds();`,
      to: `  if (before_update) before_update();
  step();
  lifetime_ += 1.0;
  lfw_->clear_cmds();`,
    },
    {
      note: "update_once: 不推进 lifetime",
      file: "native/lfw/world.cpp",
      from: `  step();
  lifetime_ += 1.0;
  lfw_->clear_cmds();`,
      to: `  step();
  lfw_->clear_cmds();`,
    },
    {
      note: "update_once: 不清 cmds",
      file: "native/lfw/world.cpp",
      from: `  lfw_->clear_cmds();
  lfw_->clear_broadcasts();
  if (extra_steps > 0) catch_up();`,
      to: `  lfw_->clear_broadcasts();
  if (extra_steps > 0) catch_up();`,
    },
    {
      note: "update_once: 不清 broadcasts",
      file: "native/lfw/world.cpp",
      from: `  lfw_->clear_broadcasts();
  if (extra_steps > 0) catch_up();`,
      to: `  if (extra_steps > 0) catch_up();`,
    },
        {
      note: "update_once: Sync 不再渲染",
      file: "native/lfw/world.cpp",
      from: `  if (sync_render == static_cast<double>(SyncRenderEnum::Sync)) {
    render_once(dt);
    fps_.update(dt);`,
      to: `  if (sync_render == static_cast<double>(SyncRenderEnum::Sync)) {`,
    },
    {
      note: "update_once: Sync 的 FPS 用 0 当 dt",
      file: "native/lfw/world.cpp",
      from: `  if (sync_render == static_cast<double>(SyncRenderEnum::Sync)) {
    render_once(dt);
    fps_.update(dt);`,
      to: `  if (sync_render == static_cast<double>(SyncRenderEnum::Sync)) {
    render_once(dt);
    fps_.update(0.0);`,
    },
    {
      note: "update_once: Sync 的门不再看枚举",
      file: "native/lfw/world.cpp",
      from: `  if (sync_render == static_cast<double>(SyncRenderEnum::Sync)) {
    render_once(dt);`,
      to: `  if (sync_render != static_cast<double>(SyncRenderEnum::Sync)) {
    render_once(dt);`,
    },
    {
      note: "update_once: Half 的隔帧判定取反",
      file: "native/lfw/world.cpp",
      from: `             std::fmod(floor(lifetime_ / to_number(dataset.get(u"playrate"))), 2) != 0) {`,
      to: `             std::fmod(floor(lifetime_ / to_number(dataset.get(u"playrate"))), 2) == 0) {`,
    },
    {
      note: "update_once: Half 的隔帧判定不除 playrate",
      file: "native/lfw/world.cpp",
      from: `             std::fmod(floor(lifetime_ / to_number(dataset.get(u"playrate"))), 2) != 0) {`,
      to: `             std::fmod(floor(lifetime_), 2) != 0) {`,
    },
    {
      note: "update_once: Half 的 dt 不再翻倍",
      file: "native/lfw/world.cpp",
      from: `    render_once(dt * 2);
    fps_.update(dt * 2);`,
      to: `    render_once(dt);
    fps_.update(dt * 2);`,
    },
    {
      note: "update_once: need_FPS 门失效（Sync 支）",
      file: "native/lfw/world.cpp",
      from: `  if (sync_render == static_cast<double>(SyncRenderEnum::Sync)) {
    render_once(dt);
    fps_.update(dt);
    if (need_FPS_) {`,
      to: `  if (sync_render == static_cast<double>(SyncRenderEnum::Sync)) {
    render_once(dt);
    fps_.update(dt);
    if (true) {`,
    },
    {
      note: "update_once: on_fps_update 传的 FPS 变成 0",
      file: "native/lfw/world.cpp",
      from: `    if (need_FPS_) {
      callbacks.call(u"on_fps_update", {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(),
                                                         Value(), std::u16string(), fps_.value()}});
    }
  } else if (sync_render == static_cast<double>(SyncRenderEnum::Half) &&`,
      to: `    if (need_FPS_) {
      callbacks.call(u"on_fps_update", {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(),
                                                         Value(), std::u16string(), 0.0}});
    }
  } else if (sync_render == static_cast<double>(SyncRenderEnum::Half) &&`,
    },
            {
      note: "update_once: 没有 worker 也照样算 TU",
      file: "native/lfw/world.cpp",
      from: `  Ticker* const worker = update_worker_.get();
  if (worker != nullptr) {`,
      to: `  Ticker* const worker = update_worker_.get();
  if (true) {`,
    },
    {
      note: "update_once: after_update 钩子失效",
      file: "native/lfw/world.cpp",
      from: `  if (after_update) after_update();

  if (to_number(dataset.get(u"sync_render")) != sync_render) start_render();`,
      to: `  if (to_number(dataset.get(u"sync_render")) != sync_render) start_render();`,
    },
        // ---------------------------------------------------------------- catch_up
    {
      note: "catch_up: 追帧循环上界换成 extra_steps + 1",
      file: "native/lfw/world.cpp",
      from: `  for (double i = 0; i < extra_steps; ++i) {
    if (sleeping_) break;
    if (before_update) before_update();`,
      to: `  for (double i = 0; i < extra_steps + 1; ++i) {
    if (sleeping_) break;
    if (before_update) before_update();`,
    },
    {
      note: "catch_up: 循环里的休眠门失效",
      file: "native/lfw/world.cpp",
      from: `  for (double i = 0; i < extra_steps; ++i) {
    if (sleeping_) break;
    if (before_update) before_update();
    if (sleeping_) break;
    step();`,
      to: `  for (double i = 0; i < extra_steps; ++i) {
    if (before_update) before_update();
    step();`,
    },
    {
      note: "catch_up: 每步不推 lifetime",
      file: "native/lfw/world.cpp",
      from: `    step();
    lifetime_ += 1.0;
    lfw_->clear_cmds();
    lfw_->clear_broadcasts();
    if (after_update) after_update();`,
      to: `    step();
    lfw_->clear_cmds();
    lfw_->clear_broadcasts();
    if (after_update) after_update();`,
    },
    {
      note: "catch_up: 预算判定用 > 而不是 >=",
      file: "native/lfw/world.cpp",
      from: `    if (clock_now() - t0 >= extra_step_budget_ms) break;`,
      to: `    if (clock_now() - t0 > 0 && clock_now() - t0 < extra_step_budget_ms) break;`,
    },
    {
      note: "catch_up: 预算判定直接把 elapsed 当 0",
      file: "native/lfw/world.cpp",
      from: `    if (clock_now() - t0 >= extra_step_budget_ms) break;`,
      to: `    if (t0 >= extra_step_budget_ms) break;`,
    },
    // ---------------------------------------------------------------- start_update
        {
      note: "start_update: 不重置 base_step_ms",
      file: "native/lfw/world.cpp",
      from: `  stop_update();
  base_step_ms();
  TU = 1000 / to_number(dataset.get(u"UPS"));`,
      to: `  stop_update();
  TU = 1000 / to_number(dataset.get(u"UPS"));`,
    },
    {
      note: "start_update: TU 用 base_step_ms",
      file: "native/lfw/world.cpp",
      from: `  TU = 1000 / to_number(dataset.get(u"UPS"));
  update_options_ = std::make_unique<WorldUpdateOptions>(*this);`,
      to: `  TU = base_step_ms();
  update_options_ = std::make_unique<WorldUpdateOptions>(*this);`,
    },
    {
      note: "start_update: 不再启动 worker",
      file: "native/lfw/world.cpp",
      from: `  update_worker_ = std::make_unique<Ticker>(update_options_.get());
  update_worker_->start();`,
      to: `  update_worker_ = std::make_unique<Ticker>(update_options_.get());`,
    },
    // ---------------------------------------------------------------- Ticker options
    {
      note: "WorldUpdateOptions: step_ms 用 TU 而不是 base_step_ms",
      file: "native/lfw/world.cpp",
      from: `  double step_ms() override { return _world->base_step_ms(); }`,
      to: `  double step_ms() override { return _world->TU; }`,
    },
            // ---------------------------------------------------------------- Entity::release
    {
      note: "Entity::release: 挂载门失效",
      file: "native/lfw/entity/entity.cpp",
      from: `void Entity::release() {
  if (!truthy(Value(_mounted))) return;`,
      to: `void Entity::release() {`,
    },
                          ],
};
