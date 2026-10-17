// `loader/DatMgr`（4Z）+ 4Z 前置缝（`Resources.xml_root`）+ 控制器创建器的变异档。
//
// 用例：`cases/dat_mgr/{basic,cancel,dup,fail,rand,xml}.txt`（任一锁住即可）。
//
// 有意不覆盖 / 等价（在原型上验证过「改了没漂」或不可观察）：
//   * `bot_controller_creator` 的 `create`：TS 侧 `new BotController(pid, entity)` 没有 env
//     （fsm.reset 读 stage）会抛 ⇒ 台面不做 bot 的 `mkctrl`；注册表本身由 `ctrls` 表钉住
//     （`create` 的赋值只在不存在的调用路径上可观察）。
//   * `solve_index_files` 的「循环开头 / xml 导入后 / solve 之后」三个 check_cancelled 与
//     `load` 内置数据那趟的检查点：取消只能从宿主回调（import）里发生，而这些位置与
//     相邻的检查点之间**没有可观测动作**（下一个检查点先吃到取消、轨迹逐字相同）⇒
//     台面测不到（防御性检查；`solve` 的「公共检查」同理，被下一轮的循环开头吃掉）。
//   * `load` 内置数据导入的 `exact` 参数：`get_import_fallbacks` 对它没有变体（回退表就
//     是 `[path]`）⇒ true/false 的 url 列表同形。
//   * `stages.empty()` 的 unshift 死分支与 `check_stage_info`：前者恒不进、后者的 errors
//     被丢弃（TS 同样不消费）⇒ 不可观察。
//   * `total != 0 ? … : 0`：total 为 0 时没有条目可 report ⇒ 恒走除法分支。
//   * `bg_randomings` 的 `groups.join()` 分隔符：键只在缓存内部用，换个字符行为同形。
//   * `add_bg` 里「非数组 group」的跳过：TS 会抛 TypeError（端口当没有）。
//   * `preprocess_bot_data` 的 `frames`/`actions` 两支：用例只喂了 `states`（逗号键），
//     `actions.expression` 的 judger 不落 dump。
export default {
  subject: "dat_mgr",
  mutations: [
    // ------------------------------------------------------------ controller/creators.cpp
    {
      note: "创建器(ball)：不落 player_id",
      file: "native/lfw/controller/creators.cpp",
      from: `    BallController* const c = new BallController();
    c->player_id = player_id;`,
      to: `    BallController* const c = new BallController();
    (void)player_id;`,
    },
    // ------------------------------------------------------------ resources.cpp（4Z 前置缝）
    {
      note: "Resources(import_xml)：不把真·根元素带出去（xml_root 恒空）",
      file: "native/lfw/resources.cpp",
      from: `    out.data = root;
    out.xml_root = xml_root;`,
      to: `    out.data = root;
    out.xml_root = nullptr;`,
    },
    // ------------------------------------------------------------ dat_mgr.cpp：Inner 初始表
    {
      note: "Inner：丢 VOID_BG（背景表空着开局）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    std::vector<Value> bg;
    if (const Value* const void_bg = defines::find(u"Defines.VOID_BG")) bg.push_back(*void_bg);
    datas.push_back({u"background", std::move(bg)});`,
      to: `    std::vector<Value> bg;
    datas.push_back({u"background", std::move(bg)});`,
    },
    {
      note: "Inner：丢 VOID_STAGE（stages 空着开局）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    if (const Value* const void_stage = defines::find(u"Defines.VOID_STAGE")) {
      stages.push_back(*void_stage);
    }`,
      to: `    (void)0;`,
    },
    // ------------------------------------------------------------ cook_data
    {
      note: "cook：bg 数据不再走 preprocess_bg_data（直接当实体）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    if (entity::is_bg_data(raw)) {`,
      to: `    if (false && entity::is_bg_data(raw)) {`,
    },
    {
      note: "cook：ball 不注册控制器",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    if (entity::is_ball_data(raw)) {
      Factory::register_ctrl(id, controller::ball_controller_creator());`,
      to: `    if (false) {
      Factory::register_ctrl(id, controller::ball_controller_creator());`,
    },
    {
      note: "cook：weapon 不注册控制器",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    } else if (entity::is_weapon_data(raw)) {
      Factory::register_ctrl(id, controller::ball_controller_creator());`,
      to: `    } else if (false) {
      Factory::register_ctrl(id, controller::ball_controller_creator());`,
    },
    {
      note: "cook：fighter 不注册控制器",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    } else if (entity::is_fighter_data(raw)) {
      Factory::register_ctrl(id, controller::bot_controller_creator());`,
      to: `    } else if (false) {
      Factory::register_ctrl(id, controller::bot_controller_creator());`,
    },
    {
      note: "cook：注册用的 id 换成常量（表键错位）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value id = field_or(raw, u"id");
    if (entity::is_ball_data(raw)) {`,
      to: `    const Value id = Value(u"zzz");
    if (entity::is_ball_data(raw)) {`,
    },
    {
      note: "cook：bot 回退的取键恒用 id（丢了 bot_id 兜底）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value bot = is_nullish(bot_prev)
                          ? map_get(bot_map, is_nullish(id) ? field_or(base, u"bot_id") : id)
                          : bot_prev;`,
      to: `    const Value bot = is_nullish(bot_prev) ? map_get(bot_map, id) : bot_prev;`,
    },
    {
      note: "cook：bot_id 字段名读错",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value bot = is_nullish(bot_prev)
                          ? map_get(bot_map, is_nullish(id) ? field_or(base, u"bot_id") : id)
                          : bot_prev;`,
      to: `    const Value bot = is_nullish(bot_prev)
                          ? map_get(bot_map, is_nullish(id) ? field_or(base, u"bot") : id)
                          : bot_prev;`,
    },
    {
      note: "cook：不理已有的 base.bot（恒查表覆盖）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value bot = is_nullish(bot_prev)
                          ? map_get(bot_map, is_nullish(id) ? field_or(base, u"bot_id") : id)
                          : bot_prev;`,
      to: `    const Value bot = map_get(bot_map, is_nullish(id) ? field_or(base, u"bot_id") : id);`,
    },
    {
      note: "cook：算出来的 bot 不写回 base",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    base_o->set(u"bot", bot);`,
      to: `    (void)bot;`,
    },
    {
      note: "cook：ctx.lfw 给空",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        {u"lfw", dat_translator::make_obj({{u"images", dat_translator::make_obj({})},
                                           {u"sounds", dat_translator::make_obj({})}})},
        {u"data", raw},
        {u"jobs", dat_translator::make_arr({})},
        {u"errors", dat_translator::make_arr({})},`,
      to: `        {u"lfw", Value()},
        {u"data", raw},
        {u"jobs", dat_translator::make_arr({})},
        {u"errors", dat_translator::make_arr({})},`,
    },
    {
      note: "cook：ctx.data 给空",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        {u"lfw", dat_translator::make_obj({{u"images", dat_translator::make_obj({})},
                                           {u"sounds", dat_translator::make_obj({})}})},
        {u"data", raw},
        {u"jobs", dat_translator::make_arr({})},
        {u"errors", dat_translator::make_arr({})},`,
      to: `        {u"lfw", dat_translator::make_obj({{u"images", dat_translator::make_obj({})},
                                           {u"sounds", dat_translator::make_obj({})}})},
        {u"data", Value()},
        {u"jobs", dat_translator::make_arr({})},
        {u"errors", dat_translator::make_arr({})},`,
    },
    {
      note: "cook：jobs 给对象（files 那趟 push 会炸）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        {u"jobs", dat_translator::make_arr({})},`,
      to: `        {u"jobs", dat_translator::make_obj({})},`,
    },
    // ------------------------------------------------------------ add_object / add_alias / add_bg
    {
      note: "add_object：重复 id 不告警",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value prev = map_get(data_map, key);
    if (truthy(prev)) {`,
      to: `    const Value prev = map_get(data_map, key);
    if (false) {`,
    },
    {
      note: "add_object：重复 id 告警文案改字",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `                  Value(u"id duplicated, old data will be overwritten!"), Value(u"old data:"),`,
      to: `                  Value(u"id duplicated, old data will be overwritten?"), Value(u"old data:"),`,
    },
    {
      note: "add_object：data_map 不用 key（用数据自己的 id）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    map_set(data_map, key, data);

    const Value data_id = field_or(data, u"id");`,
      to: `    map_set(data_map, field_or(data, u"id"), data);

    const Value data_id = field_or(data, u"id");`,
    },
    {
      note: "add_object：类型表恒 push（不按 id 原地替换）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      const size_t idx = find_index_by_id(*list, data_id);
      if (idx == kNpos) {
        list->push_back(data);
      } else {
        (*list)[idx] = data;
      }`,
      to: `      list->push_back(data);`,
    },
    {
      note: "add_object：objects 表恒 push",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      std::vector<Value>& objects = list_ref(u"objects");
      const size_t idx = find_index_by_id(objects, data_id);
      if (idx == kNpos) {
        objects.push_back(data);
      } else {
        objects[idx] = data;
      }`,
      to: `      std::vector<Value>& objects = list_ref(u"objects");
      objects.push_back(data);`,
    },
    {
      note: "add_object：objects 表不写",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    {
      std::vector<Value>& objects = list_ref(u"objects");
      const size_t idx = find_index_by_id(objects, data_id);
      if (idx == kNpos) {
        objects.push_back(data);
      } else {
        objects[idx] = data;
      }
    }`,
      to: `    (void)data_id;`,
    },
    {
      note: "add_object：类型表的 id 比较不按严格相等",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `size_t find_index_by_id(const std::vector<Value>& list, const Value& id) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (strict_equals(field_or(list[i], u"id"), id)) return i;
  }
  return kNpos;
}`,
      to: `size_t find_index_by_id(const std::vector<Value>& list, const Value& id) {
  (void)list;
  (void)id;
  return kNpos;
}`,
    },
    {
      note: "add_alias：重复别名不告警",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value prev = map_get(alias_map, alias);
    if (truthy(prev)) {`,
      to: `    const Value prev = map_get(alias_map, alias);
    if (false) {`,
    },
    {
      note: "add_alias：别名不落表",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    map_set(alias_map, alias, data);
  }`,
      to: `    (void)alias;
  }`,
    },
    {
      note: "add_bg：恒 push（不按 id 替换）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value data_id = field_or(data, u"id");
    const size_t idx = find_index_by_id(*list, data_id);
    if (idx == kNpos) {
      list->push_back(data);
    } else {
      (*list)[idx] = data;
    }`,
      to: `    list->push_back(data);`,
    },
    {
      note: "add_bg：不再让对应组的 bg 随机组失效",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const Value group = field_or(field_or(data, u"base"), u"group");
    if (const Array* const a = as_array(group)) {`,
      to: `    const Value group = field_or(field_or(data, u"base"), u"group");
    if (false && as_array(group) != nullptr) {
      const Array* const a = as_array(group);`,
    },
    // ------------------------------------------------------------ solve_index_files
    {
      note: "solve：文件名不降格（大小写敏感）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      const std::u16string f = to_lower_case(file);`,
      to: `      const std::u16string f = file;`,
    },
    {
      note: "solve：.json5 不再当 json",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      } else if (ends_with(f, u".json") || ends_with(f, u".json5")) {`,
      to: `      } else if (ends_with(f, u".json")) {`,
    },
    {
      note: "solve：.json 不再当 json",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      } else if (ends_with(f, u".json") || ends_with(f, u".json5")) {`,
      to: `      } else if (ends_with(f, u".json5")) {`,
    },
    {
      note: "solve：不认识的扩展名不告警",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        host->warn({Value(u"UNSUPPORTED DAT INDEX FILE, SKIPPED: " + file)});
        continue;`,
      to: `        continue;`,
    },
    {
      note: "solve：xml 索引拿来当 json 读",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (ends_with(f, u".xml")) {`,
      to: `      if (false) {`,
    },
    {
      note: "solve：五路 push 丢掉 objects",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!append_items(partial, u"objects", objects, error)) return false;`,
      to: `      (void)objects;`,
    },
    {
      note: "append_items：缺键不再当空数组（nullish 也要报错）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    if (is_nullish(v)) return true;`,
      to: `    if (false) return true;`,
    },
    {
      note: "append_items：少搬最后一项",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    for (size_t i = 0; i < a->size(); ++i) out.push_back(a->at(i));`,
      to: `    for (size_t i = 0; i + 1 < a->size(); ++i) out.push_back(a->at(i));`,
    },
    // ------------------------------------------------------------ load：内置两趟
    {
      note: "load：内置图片那趟不加载",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      host->emit_progress(e.text, 0);
      host->load_img(e.text);
      if (!check_cancelled(error)) return false;`,
      to: `      host->emit_progress(e.text, 0);
      if (!check_cancelled(error)) return false;`,
    },
    {
      note: "load：内置图片的进度不是 0",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      host->emit_progress(e.text, 0);
      host->load_img(e.text);`,
      to: `      host->emit_progress(e.text, 1);
      host->load_img(e.text);`,
    },
    {
      note: "load：内置图片那趟的取消检查去掉",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      host->load_img(e.text);
      if (!check_cancelled(error)) return false;
    }`,
      to: `      host->load_img(e.text);
    }`,
    },
    {
      note: "load：内置数据用 cooked.id 当键（不按 src）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!add_object(Value(std::u16string(e.text)), cooked, error)) return false;`,
      to: `      if (!add_object(field_or(cooked, u"id"), cooked, error)) return false;`,
    },
    // ------------------------------------------------------------ load：计数与进度
    {
      note: "load：total 少算背景表",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    const double total = static_cast<double>(bots_list->size() + moves_list->size() +
                                             directors_list->size() + objects_list->size() +
                                             bgs_list->size() + stages_list->size());`,
      to: `    const double total = static_cast<double>(bots_list->size() + moves_list->size() +
                                             directors_list->size() + objects_list->size() +
                                             stages_list->size());`,
    },
    {
      note: "load：进度用 ceil 不用 floor",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `                          total != 0 ? std::floor((loaded * 100) / total) : 0);`,
      to: `                          total != 0 ? std::ceil((loaded * 100) / total) : 0);`,
    },
    {
      note: "load：skipped 的条目也计入 loaded",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    for (size_t i = 0; i < bots_list->size(); ++i) {
      const Value item = bots_list->at(i);
      loaded += 1;
      if (truthy(field_or(item, u"skipped"))) continue;`,
      to: `    for (size_t i = 0; i < bots_list->size(); ++i) {
      const Value item = bots_list->at(i);
      if (truthy(field_or(item, u"skipped"))) continue;
      loaded += 1;`,
    },
    // ------------------------------------------------------------ load：bots
    {
      note: "bots：skipped 不跳过",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      report(Value(file));
      ImportResult result;
      Value raw;
      if (resources.import_json(file, true, result, error)) {
        raw = result.data;
      } else {
        host->warn({Value(u"FAILED TO LOAD BOT DATA: " + file)});`,
      to: `      report(Value(file));
      ImportResult result;
      Value raw;
      if (resources.import_json(file, true, result, error)) {
        raw = result.data;
      } else {
        host->warn({Value(u"FAILED TO LOAD BOT DATA!" + file)});`,
    },
    {
      note: "bots：导入失败时的告警文案改字",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        host->warn({Value(u"FAILED TO LOAD BOT DATA: " + file)});`,
      to: `        host->warn({Value(u"FAILED TO LOAD BOT DATA! " + file)});`,
    },
    {
      note: "bots：失败后不 continue（falsy 也照预处理）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!check_cancelled(error)) return false;
      if (!truthy(raw)) continue;
      Value bot_data = raw;`,
      to: `      if (!check_cancelled(error)) return false;
      Value bot_data = raw;`,
    },
    {
      note: "bots：bot 数据不预处理",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      Value bot_data = raw;
      if (!preprocess_bot_data(bot_data)) {`,
      to: `      Value bot_data = raw;
      if (false) {`,
    },
    {
      note: "bots：不注册 file 键",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!equals(id, Value(file))) map_set(bot_map, Value(file), bot_data);`,
      to: `      if (false) map_set(bot_map, Value(file), bot_data);`,
    },
    {
      note: "bots：不注册数据自己的 id 键",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!equals(id, bot_id)) map_set(bot_map, bot_id, bot_data);`,
      to: `      (void)bot_id;`,
    },
    {
      note: "bots：循环里的取消检查去掉",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        error.clear();
      }
      if (!check_cancelled(error)) return false;
      if (!truthy(raw)) continue;
      Value bot_data = raw;`,
      to: `        error.clear();
      }
      if (!truthy(raw)) continue;
      Value bot_data = raw;`,
    },
    // ------------------------------------------------------------ load：moves
    {
      note: "moves：import 后的取消检查去掉",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        host->warn({Value(u"FAILED TO LOAD MOVE LIST DATA: " + file)});
        error.clear();
      }
      if (!check_cancelled(error)) return false;`,
      to: `        host->warn({Value(u"FAILED TO LOAD MOVE LIST DATA: " + file)});
        error.clear();
      }`,
    },
    {
      note: "moves：oid 别名读错字段（读 id）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      const Value oid = field_or(raw, u"oid");`,
      to: `      const Value oid = field_or(raw, u"id");`,
    },
    {
      note: "moves：不注册 file 键",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!equals(id, Value(file))) map_set(moves_map, Value(file), raw);`,
      to: `      if (false) map_set(moves_map, Value(file), raw);`,
    },
    // ------------------------------------------------------------ load：objects
    {
      note: "objects：objects 循环的取消检查去掉",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (truthy(field_or(item, u"skipped"))) continue;
      if (!check_cancelled(error)) return false;
      const Value id = field_or(item, u"id");`,
      to: `      if (truthy(field_or(item, u"skipped"))) continue;
      const Value id = field_or(item, u"id");`,
    },
    {
      note: "objects：xml 分支判定去掉 .obj.xml（撞 json 路）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (ends_with(file, u".obj.xml") || ends_with(file, u".xml")) {`,
      to: `      if (ends_with(file, u".obj.xml")) {`,
    },
    {
      note: "objects：import 失败的包装文案去掉文件路径",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `        if (!resources.import_json(file, true, result, error)) {
          error = u"fail to load obj: " + file + u", reason: Error: " + error;
          return false;
        }`,
      to: `        if (!resources.import_json(file, true, result, error)) {
          error = u"fail to load obj, reason: Error: " + error;
          return false;
        }`,
    },
    {
      note: "objects：add_object 失败的包装不再是 TypeError 前缀",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!add_object(id, cooked, error)) {
        // \`_add_object\` 的失败面只有「类型表查不到 ⇒ TypeError」这一档（V8 文案）⇒ 包装用 TypeError。
        error = u"fail to load obj: " + file + u", reason: TypeError: " + error;
        return false;
      }`,
      to: `      if (!add_object(id, cooked, error)) {
        error = u"fail to load obj: " + file + u", reason: " + error;
        return false;
      }`,
    },
    {
      note: "objects：不按 file 键再注册",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!equals(id, Value(file))) {
        if (!add_object(Value(file), cooked, error)) {
          error = u"fail to load obj: " + file + u", reason: TypeError: " + error;
          return false;
        }
      }`,
      to: `      (void)file;`,
    },
    {
      note: "objects：不按数据自己的 id 再注册",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      const Value cooked_id = field_or(cooked, u"id");
      if (!equals(id, cooked_id)) {
        if (!add_object(cooked_id, cooked, error)) {
          error = u"fail to load obj: " + file + u", reason: TypeError: " + error;
          return false;
        }
      }`,
      to: `      const Value cooked_id = field_or(cooked, u"id");
      (void)cooked_id;`,
    },
    {
      note: "objects：不写别名表",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (truthy(alias)) add_alias_object(alias, cooked);`,
      to: `      (void)alias;`,
    },
    // ------------------------------------------------------------ load：backgrounds
    {
      note: "bg：.bg.xml 判定去掉（改走 json）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (ends_with(file, u".bg.xml")) {`,
      to: `      if (ends_with(file, u".bg.xxml")) {`,
    },
    {
      note: "bg：add_bg 的包装前缀换成 Error",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!add_bg(cooked, error)) {
        error = u"fail to load bg: " + file + u", reason: TypeError: " + error;
        return false;
      }`,
      to: `      if (!add_bg(cooked, error)) {
        error = u"fail to load bg: " + file + u", reason: Error: " + error;
        return false;
      }`,
    },
    // ------------------------------------------------------------ load：stages
    {
      note: "stages：xml 判定丢掉平 .xml 那一半",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (ends_with(file, u".xml") || ends_with(file, u".stage.xml")) {`,
      to: `      if (ends_with(file, u".stage.xml")) {`,
    },
    {
      note: "stages：json 导入失败不告警",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `          host->warn({Value(u"FAILED TO LOAD STATE: " + file)});
          error.clear();`,
      to: `          error.clear();`,
    },
    {
      note: "stages：import 后的取消检查去掉",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!check_cancelled(error)) return false;
      for (const Value& stage : stage_datas) {`,
      to: `      for (const Value& stage : stage_datas) {`,
    },
    {
      note: "stages：preprocess_stage 不跑",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      for (const Value& stage : stage_datas) {
        Value v = stage;
        new_stages.push_back(preprocess_stage(v));
      }`,
      to: `      for (const Value& stage : stage_datas) {
        new_stages.push_back(stage);
      }`,
    },
    {
      note: "stages：合并恒 push（不按 id 原地替换）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (idx == kNpos) {
        stages.push_back(stage);
      } else {
        stages[idx] = stage;
      }`,
      to: `      stages.push_back(stage);`,
    },
    {
      note: "stages：合并替换不生效（只 push 不改）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (idx == kNpos) {
        stages.push_back(stage);
      } else {
        stages[idx] = stage;
      }`,
      to: `      if (idx == kNpos) {
        stages.push_back(stage);
      }`,
    },
    {
      note: "load：死分支的 unshift 恒执行（stages 恒多一个 VOID_STAGE）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    if (stages.empty()) {
      if (const Value* const void_stage = defines::find(u"Defines.VOID_STAGE")) {
        stages.insert(stages.begin(), *void_stage);
      }
    }`,
      to: `    if (const Value* const void_stage = defines::find(u"Defines.VOID_STAGE")) {
      stages.insert(stages.begin(), *void_stage);
    }`,
    },
    // ------------------------------------------------------------ 查询面
    {
      note: "fighters()：查错表（用 4）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `const std::vector<Value>& DatMgr::fighters() const { return _inner->list_ref(u"8"); }`,
      to: `const std::vector<Value>& DatMgr::fighters() const { return _inner->list_ref(u"4"); }`,
    },
    {
      note: "find：别名表优先丢",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `  if (const Value* const a = map_get_ptr(_inner->alias_map, id)) return a;
  return map_get_ptr(_inner->data_map, id);`,
      to: `  return map_get_ptr(_inner->data_map, id);`,
    },
    {
      note: "cancelled：判反（没换 Inner 才算取消）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `  bool cancelled() const { return mgr->inner_id() != id; }`,
      to: `  bool cancelled() const { return mgr->inner_id() == id; }`,
    },
    {
      note: "clear：不换 Inner（id 不变）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `void DatMgr::clear() { _inner = std::make_shared<Inner>(this, ++_inner_id); }`,
      to: `void DatMgr::clear() {}`,
    },
    {
      note: "groups：成员判定用 > 0（第 0 位算漏）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `  for (const Value& v : objects()) {
    const Value g = field_or(field_or(v, u"base"), u"group");
    if (!truthy(g)) continue;
    if (js_index_of(g, Value(group)) >= 0) out.push_back(v);
  }`,
      to: `  for (const Value& v : objects()) {
    const Value g = field_or(field_or(v, u"base"), u"group");
    if (!truthy(g)) continue;
    if (js_index_of(g, Value(group)) > 0) out.push_back(v);
  }`,
    },
    {
      note: "groups：数组成员判定丢掉严格相等",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (strict_equals(a->at(i), item)) return static_cast<long>(i);`,
      to: `      (void)item;
      return -1;`,
    },
    {
      note: "groups：not_in 的判定反了",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `    if (!truthy(g) || js_index_of(g, Value(group)) < 0) out.push_back(v);`,
      to: `    if (!truthy(g) || js_index_of(g, Value(group)) >= 0) out.push_back(v);`,
    },
    {
      note: "bgs：分组相等判定恒真（全会命中）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (strict_equals(a->at(i), Value(group))) {`,
      to: `      if (true) {`,
    },
    // ------------------------------------------------------------ 随机组
    {
      note: "随机组：名字不再逐字照抄（把字面量换掉）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `  Randoming::Ptr ret = std::make_shared<Randoming>(u"dat_\${group}_randoming", objects, &_host->mt_ref());`,
      to: `  Randoming::Ptr ret = std::make_shared<Randoming>(u"dat_randoming", objects, &_host->mt_ref());`,
    },
    {
      note: "随机组：池子用全表（不按组过滤）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `  const std::vector<Value> objects = get_objects_of_group(group);`,
      to: `  const std::vector<Value> objects = DatMgr::objects();`,
    },
    {
      note: "随机组：不缓存（每次新实例）",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `  Inner& inner = *_inner;
  for (const std::pair<std::u16string, Randoming::Ptr>& kv : inner.randomings) {
    if (kv.first == group) return kv.second;
  }
  const std::vector<Value> objects = get_objects_of_group(group);`,
      to: `  Inner& inner = *_inner;
  const std::vector<Value> objects = get_objects_of_group(group);`,
    },
    {
      note: "bg 随机组：名字分隔符改成 -",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `  Randoming::Ptr ret = std::make_shared<Randoming>(u"bg_" + join_strings(groups, u"_") + u"_randoming",
                                                   pool, &_host->mt_ref());`,
      to: `  Randoming::Ptr ret = std::make_shared<Randoming>(u"bg_" + join_strings(groups, u"-") + u"_randoming",
                                                   pool, &_host->mt_ref());`,
    },
    {
      note: "bg 随机组：Set 去重不做",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `      if (!seen) pool.push_back(bg);`,
      to: `      pool.push_back(bg);`,
    },
    {
      note: "get_random_bg：恒给 undefined",
      file: "native/lfw/loader/dat_mgr.cpp",
      from: `Value DatMgr::get_random_bg(const std::vector<std::u16string>& groups) {
  return get_bg_randoming_of_group(groups)->get();
}`,
      to: `Value DatMgr::get_random_bg(const std::vector<std::u16string>& groups) {
  (void)groups;
  return Value();
}`,
    },
  ],
};
