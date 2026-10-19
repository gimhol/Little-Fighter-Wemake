// `stage/Expressions` + `stage/Status` + `bg/Background` + `bg/Layer` + `stage/Item`
// （外加 `helper/Randoming` 的模板化）。
//
// 用例：`cases/stage/expr.txt`、`cases/stage/bg.txt`、`cases/stage/item.txt`。
//
// 有意不覆盖（不可观察或按构造等价）：
//   * `Status` 三个常量与 `status_entries()`：只是字符串表，用例里逐个对过值；
//   * `Expressions::index()`：TS 的 `_index` 是 `protected`（台面只能从 `is_first` / `is_last`
//     与 `run` 的日志反推），端口这个只读口只是给台面观测用；
//   * `flow` 里 `is_last` 取在 `run` 之前还是之后：`run` 既不碰 `_index` 也不碰 `_items` ⇒ 等价；
//   * `Background` 的 `world` 字段：TS 只存不读，端口同样只存；
//   * `Item::forget` 里「按实体找 `_watches`」那条：找不到也只是少摘一个监听，日志看不见
//     （出列本身由 `_objects.erase` 决定）；
//   * `Item::spawn` 的 `_objects` 判重：同一实体不会被 `create_entity_with_bot` 给两次；
//   * `Item::spawn` 的 `mt.range(min, max)` 里 `min` / `max` 是**非数字**时 TS 的 JS 语义
//     （`max - min` 强转 + `floor(...) + min` 的字符串拼接）；端口 `range(double,double)`
//     只吃数字 ⇒ 台面不喂这种输入（`x z` 这种 null 档两边一致，已覆盖）；
//   * harness 层的 op 与回显行：那是台面自己的输出。
export default {
  subject: "stage",
  cases: ["expr", "bg", "item"],
  mutations: [
    // ---------------------------------------------------------------- stage/Expressions
    {
      note: "Expressions: is_first 把 0 排在外面",
      file: "native/lfw/stage/expressions.h",
      from: `  bool is_first() const { return _index <= 0.0; }`,
      to: `  bool is_first() const { return _index < 0.0; }`,
    },
    {
      note: "Expressions: is_last 用严格大于（最后一项不算最后）",
      file: "native/lfw/stage/expressions.h",
      from: `  bool is_last() const { return _index >= static_cast<double>(_items.size()) - 1.0; }`,
      to: `  bool is_last() const { return _index > static_cast<double>(_items.size()) - 1.0; }`,
    },
    {
      note: "Expressions: reset 不复位游标",
      file: "native/lfw/stage/expressions.h",
      from: `  void reset(const Items& list) {
    _index = 0.0;`,
      to: `  void reset(const Items& list) {
    _index = -1.0;`,
    },
    {
      note: "Expressions: reset 去掉同一性早退（传回自己的 list 会把列表清空）",
      file: "native/lfw/stage/expressions.h",
      from: `    if (&list == &_items) return;`,
      to: `    if (false) return;`,
    },
    {
      note: "Expressions: reset 清空后不再灌入",
      file: "native/lfw/stage/expressions.h",
      from: `    if (!list.empty()) _items.insert(_items.end(), list.begin(), list.end());`,
      to: `    if (false) _items.insert(_items.end(), list.begin(), list.end());`,
    },
    {
      note: "Expressions: next 用 max（停在原地还往回走）",
      file: "native/lfw/stage/expressions.h",
      from: `  void next() { _index = min(_index + 1.0, static_cast<double>(_items.size()) - 1.0); }`,
      to: `  void next() { _index = max(_index + 1.0, static_cast<double>(_items.size()) - 1.0); }`,
    },
    {
      note: "Expressions: run 的返回值取反",
      file: "native/lfw/stage/expressions.h",
      from: `    return _items[static_cast<size_t>(i)]->run(arg);`,
      to: `    return !_items[static_cast<size_t>(i)]->run(arg);`,
    },
    {
      note: "Expressions: run 不把参数转给表达式",
      file: "native/lfw/stage/expressions.h",
      from: `    return _items[static_cast<size_t>(i)]->run(arg);`,
      to: `    return _items[static_cast<size_t>(i)]->run(T());`,
    },
    {
      note: "Expressions: flow 不因 is_last 收手（只看真假）",
      file: "native/lfw/stage/expressions.h",
      from: `      if (!pass || is_last) break;`,
      to: `      if (is_last) break;`,
    },

    // ---------------------------------------------------------------- bg/Layer
    {
      note: "Layer: is_static 不看 cc 是否 undefined",
      file: "native/lfw/bg/layer.cpp",
      from: `  const bool no_cycle = is_undefined(field_or(_info, u"cc")) ||`,
      to: `  const bool no_cycle = false ||`,
    },
    {
      note: "Layer: is_static 不看 c1 是否 undefined",
      file: "native/lfw/bg/layer.cpp",
      from: `                        is_undefined(field_or(_info, u"c1")) ||`,
      to: `                        false ||`,
    },
    {
      note: "Layer: is_static 不看 c2 是否 undefined",
      file: "native/lfw/bg/layer.cpp",
      from: `                        is_undefined(field_or(_info, u"c2"));`,
      to: `                        false;`,
    },
    {
      note: "Layer: is_static 不看 offsetAnimX",
      file: "native/lfw/bg/layer.cpp",
      from: `  return no_cycle && !truthy(field_or(_info, u"offsetAnimX")) &&`,
      to: `  return no_cycle && true &&`,
    },
    {
      note: "Layer: is_static 不要求 absolute",
      file: "native/lfw/bg/layer.cpp",
      from: `         !truthy(field_or(_info, u"offsetAnimY")) && truthy(field_or(_info, u"absolute"));`,
      to: `         !truthy(field_or(_info, u"offsetAnimY")) && true;`,
    },
    {
      note: "Layer: update 不做取模",
      file: "native/lfw/bg/layer.cpp",
      from: `    const double now = std::fmod(count, to_number(cc));`,
      to: `    const double now = count;`,
    },
    {
      note: "Layer: update 的三件套判定漏掉 c2",
      file: "native/lfw/bg/layer.cpp",
      from: `  if (!is_undefined(cc) && !is_undefined(c1) && !is_undefined(c2)) {`,
      to: `  if (!is_undefined(cc) && !is_undefined(c1)) {`,
    },
    {
      note: "Layer: 可见区间的两端用 || 连",
      file: "native/lfw/bg/layer.cpp",
      from: `    _visible = now >= to_number(c1) && now <= to_number(c2);`,
      to: `    _visible = now >= to_number(c1) || now <= to_number(c2);`,
    },
    {
      note: "Layer: 左端写成严格大于（边界算不可见）",
      file: "native/lfw/bg/layer.cpp",
      from: `    _visible = now >= to_number(c1) && now <= to_number(c2);`,
      to: `    _visible = now > to_number(c1) && now <= to_number(c2);`,
    },
    {
      note: "Layer: 右端写成严格小于（边界算不可见）",
      file: "native/lfw/bg/layer.cpp",
      from: `    _visible = now >= to_number(c1) && now <= to_number(c2);`,
      to: `    _visible = now >= to_number(c1) && now < to_number(c2);`,
    },
    {
      note: "Layer: 没有循环信息时反而不可见",
      file: "native/lfw/bg/layer.cpp",
      from: `  } else {
    _visible = true;
  }`,
      to: `  } else {
    _visible = false;
  }`,
    },

    // ---------------------------------------------------------------- bg/Background
    {
      note: "Background: id 读 alias_id",
      file: "native/lfw/bg/background.cpp",
      from: `  _id = field_or(_data, u"id");`,
      to: `  _id = field_or(_data, u"alias_id");`,
    },
    {
      note: "Background: info 取整个 data（而不是 data.base）",
      file: "native/lfw/bg/background.cpp",
      from: `  const Value info = field_or(_data, u"base");`,
      to: `  const Value info = _data;`,
    },
    {
      note: "Background: name 用真值判断（空串会回退 id）",
      file: "native/lfw/bg/background.cpp",
      from: `  _name = is_nullish(name_v) ? _id : name_v;`,
      to: `  _name = truthy(name_v) ? name_v : _id;`,
    },
    {
      note: "Background: left 读 right",
      file: "native/lfw/bg/background.cpp",
      from: `  _left = num_or(field_or(info, u"left"), 0.0);`,
      to: `  _left = num_or(field_or(info, u"right"), 0.0);`,
    },
    {
      note: "Background: right 读 left",
      file: "native/lfw/bg/background.cpp",
      from: `  _right = num_or(field_or(info, u"right"), 0.0);`,
      to: `  _right = num_or(field_or(info, u"left"), 0.0);`,
    },
    {
      note: "Background: width 的反了",
      file: "native/lfw/bg/background.cpp",
      from: `  _width = _right - _left;`,
      to: `  _width = _left - _right;`,
    },
    {
      note: "Background: depth 的反了",
      file: "native/lfw/bg/background.cpp",
      from: `  _depth = _near - _far;`,
      to: `  _depth = _far - _near;`,
    },
    {
      note: "Background: height 的缺省值写成 1",
      file: "native/lfw/bg/background.cpp",
      from: `  _height = num_or(field_or(info, u"height"), 0.0);`,
      to: `  _height = num_or(field_or(info, u"height"), 1.0);`,
    },
    {
      note: "Background: middle.x 用差而不是和的一半",
      file: "native/lfw/bg/background.cpp",
      from: `  _middle.x = (_right + _left) / 2.0;`,
      to: `  _middle.x = (_right - _left) / 2.0;`,
    },
    {
      note: "Background: middle.z 混进 right",
      file: "native/lfw/bg/background.cpp",
      from: `  _middle.z = (_far + _near) / 2.0;`,
      to: `  _middle.z = (_far + _right) / 2.0;`,
    },
    {
      note: "Background: zoom_x 不做 nullish 回退",
      file: "native/lfw/bg/background.cpp",
      from: `  _zoom_x = num_or(field_or(info, u"zoom_x"), 1.0);`,
      to: `  _zoom_x = to_number(field_or(info, u"zoom_x"));`,
    },
    {
      note: "Background: zoom_y 读成 zoom_z",
      file: "native/lfw/bg/background.cpp",
      from: `  _zoom_y = num_or(field_or(info, u"zoom_y"), 1.0);`,
      to: `  _zoom_y = num_or(field_or(info, u"zoom_z"), 1.0);`,
    },
    {
      note: "Background: layers 为真值也不加层",
      file: "native/lfw/bg/background.cpp",
      from: `  if (truthy(layers)) {`,
      to: `  if (false) {`,
    },
    {
      note: "Background: 每层都拿第 0 个 info",
      file: "native/lfw/bg/background.cpp",
      from: `      for (size_t i = 0; i < arr->size(); ++i) add_layer(arr->at(i));`,
      to: `      add_layer(arr->at(0));`,
    },
    {
      note: "Background: 浅拷贝时丢掉原有字段",
      file: "native/lfw/bg/background.cpp",
      from: `      out->set(key, v != nullptr ? *v : Value());`,
      to: `      (void)key;
      (void)v;`,
    },
    {
      note: "Background: 浅拷贝不写 x",
      file: "native/lfw/bg/background.cpp",
      from: `  out->set(u"x", Value(x));`,
      to: `  (void)x;`,
    },
    {
      note: "Background: data_index 用前置自增",
      file: "native/lfw/bg/background.cpp",
      from: `  const double data_index = _layer_data_index++;`,
      to: `  const double data_index = ++_layer_data_index;`,
    },
    {
      note: "Background: loop 的步长偏 1",
      file: "native/lfw/bg/background.cpp",
      from: `  const double loop = is_undefined(loop_v) ? 0.0 : to_number(loop_v);`,
      to: `  const double loop = is_undefined(loop_v) ? 0.0 : to_number(loop_v) + 1.0;`,
    },
    {
      note: "Background: 循环的右界写成 width - loop",
      file: "native/lfw/bg/background.cpp",
      from: `  const double right = _width + loop;`,
      to: `  const double right = _width - loop;`,
    },
    {
      note: "Background: 循环条件用 <= （多铺一层）",
      file: "native/lfw/bg/background.cpp",
      from: `  for (x -= loop; x < right; x += loop) {`,
      to: `  for (x -= loop; x <= right; x += loop) {`,
    },
    {
      note: "Background: 循环副本不换 x（直接用原 info）",
      file: "native/lfw/bg/background.cpp",
      from: `    _layers.push_back(std::make_shared<Layer>(this, with_x(info, x), data_index, loop_index));`,
      to: `    _layers.push_back(std::make_shared<Layer>(this, info, data_index, loop_index));`,
    },
    {
      note: "Background: loop_index 不递增",
      file: "native/lfw/bg/background.cpp",
      from: `    loop_index++;`,
      to: `    loop_index += 0.0;`,
    },
    {
      note: "Background: update 不推进计数",
      file: "native/lfw/bg/background.cpp",
      from: `void Background::update() {
  _update_times++;`,
      to: `void Background::update() {
  _update_times += 0.0;`,
    },
    {
      note: "Background: update 不往下传（层永远停在初始 visible）",
      file: "native/lfw/bg/background.cpp",
      from: `  for (const std::shared_ptr<Layer>& layer : _layers) layer->update(_update_times);`,
      to: `  for (const std::shared_ptr<Layer>& layer : _layers) (void)layer;`,
    },
    {
      note: "Background: dispose 不清层",
      file: "native/lfw/bg/background.cpp",
      from: `  _layers.clear();`,
      to: `  (void)0;`,
    },
    {
      note: "Background: dispose 不复位 data_index",
      file: "native/lfw/bg/background.cpp",
      from: `  _layer_data_index = 0.0;`,
      to: `  (void)0;`,
    },

    // ---------------------------------------------------------------- stage/Item
    {
      note: "Item: times 一律是 undefined",
      file: "native/lfw/stage/item.cpp",
      from: `  times = truthy(times_v) ? std::optional<double>(round(to_number(times_v))) : std::nullopt;`,
      to: `  times = std::nullopt;`,
    },
    {
      note: "Item: 字符串 id 不认",
      file: "native/lfw/stage/item.cpp",
      from: `  if (is_str(id)) {`,
      to: `  if (false) {`,
    },
    {
      note: "Item: 数组 id 不认",
      file: "native/lfw/stage/item.cpp",
      from: `  } else if (is_array(id)) {`,
      to: `  } else if (false) {`,
    },
    {
      note: "Item: 单条 data 时不判 is_fighter",
      file: "native/lfw/stage/item.cpp",
      from: `      _is_fighter = _is_fighter || entity::is_fighter_data(data_v);`,
      to: `      _is_fighter = _is_fighter || false;`,
    },
    {
      note: "Item: 命中 data 也不收进 data_list",
      file: "native/lfw/stage/item.cpp",
      from: `      if (truthy(data_v)) {
        data_list.push_back(data_v);
        continue;
      }`,
      to: `      if (false) {
        data_list.push_back(data_v);
        continue;
      }`,
    },
    {
      note: "Item: 空分组也算一条来源",
      file: "native/lfw/stage/item.cpp",
      from: `      if (rd->src().empty()) continue;`,
      to: `      if (false) continue;`,
    },
    {
      note: "Item: 分组里的 is_fighter 不再累加",
      file: "native/lfw/stage/item.cpp",
      from: `      for (const Value& item : rd->src()) {
        if (entity::is_fighter_data(item)) {`,
      to: `      for (const Value& item : rd->src()) {
        if (false) {`,
    },
    {
      note: "Item: 只有一条 data 时也走 randoming",
      file: "native/lfw/stage/item.cpp",
      from: `    if (data_list.size() == 1 && randoming_list.empty()) {`,
      to: `    if (data_list.size() >= 1) {`,
    },
    {
      note: "Item: 多条 data 不建内层 randoming",
      file: "native/lfw/stage/item.cpp",
      from: `    } else if (!data_list.empty()) {`,
      to: `    } else if (false) {`,
    },
    {
      note: "Item: 外层 randoming 的来源空掉",
      file: "native/lfw/stage/item.cpp",
      from: `    randoming = RandomingOfItems::create(u"stage_item_oids_randoming", randoming_list,
                                        _stage->mt());`,
      to: `    randoming = RandomingOfItems::create(u"stage_item_oids_randoming", {},
                                        _stage->mt());`,
    },
    {
      note: "Item: 不建外层 randoming",
      file: "native/lfw/stage/item.cpp",
      from: `  if (!randoming_list.empty()) {
    randoming = RandomingOfItems::create(u"stage_item_oids_randoming", randoming_list,`,
      to: `  if (false) {
    randoming = RandomingOfItems::create(u"stage_item_oids_randoming", randoming_list,`,
    },
    {
      note: "Item: release 之后还继续跑",
      file: "native/lfw/stage/item.cpp",
      from: `  if (_released) return;`,
      to: `  if (false) return;`,
    },
    {
      note: "Item: 有存活实体时不复位 end_delay",
      file: "native/lfw/stage/item.cpp",
      from: `  if (!_objects.empty()) {`,
      to: `  if (false) {`,
    },
    {
      note: "Item: end_delay 没过也照样刷",
      file: "native/lfw/stage/item.cpp",
      from: `  if (!_end_delay.add()) return;`,
      to: `  if (true) return;`,
    },
    {
      note: "Item: times 缺省写成 0（soldier 会提前收工）",
      file: "native/lfw/stage/item.cpp",
      from: `  const double times_v = times.has_value() ? *times : -1.0;  // \`const { times = -1 } = this\``,
      to: `  const double times_v = times.has_value() ? *times : 0.0;`,
    },
    {
      note: "Item: 不看 is_soldier",
      file: "native/lfw/stage/item.cpp",
      from: `  if (truthy(field_or(_info, u"is_soldier"))) {`,
      to: `  if (false) {`,
    },
    {
      note: "Item: soldier 的 times == 0 判定改成 == 1",
      file: "native/lfw/stage/item.cpp",
      from: `    if (_stage->all_boss_dead() || times_v == 0.0) {`,
      to: `    if (_stage->all_boss_dead() || times_v == 1.0) {`,
    },
    {
      note: "Item: 非 soldier 的 times >= 1 判定改成 > 1",
      file: "native/lfw/stage/item.cpp",
      from: `  } else if (times_v >= 1.0) {`,
      to: `  } else if (times_v > 1.0) {`,
    },
    {
      note: "Item: spawn 不看 this.data（永远走 randoming）",
      file: "native/lfw/stage/item.cpp",
      from: `  if (truthy(data)) {
    data_v = data;
  } else if (randoming) {`,
      to: `  if (false) {
    data_v = data;
  } else if (randoming) {`,
    },
    {
      note: "Item: spawn 拿到空 data 也往下走",
      file: "native/lfw/stage/item.cpp",
      from: `  if (!truthy(data_v)) return false;`,
      to: `  if (false) return false;`,
    },
    {
      note: "Item: x 的缺省判定用 nullish",
      file: "native/lfw/stage/item.cpp",
      from: `  const Value x = is_undefined(x_v)`,
      to: `  const Value x = is_nullish(x_v)`,
    },
    {
      note: "Item: z 的 is_num 判定读 y",
      file: "native/lfw/stage/item.cpp",
      from: `  const bool z_is_num = is_num(z);`,
      to: `  const bool z_is_num = is_num(y);`,
    },
    {
      note: "Item: weapon 缺省 y 不是 300",
      file: "native/lfw/stage/item.cpp",
      from: `  const double y_default = entity::is_weapon(*e) ? 300.0 : 0.0;`,
      to: `  const double y_default = entity::is_weapon(*e) ? 0.0 : 0.0;`,
    },
    {
      note: "Item: max_y 用 range_x",
      file: "native/lfw/stage/item.cpp",
      from: `  const Value max_y = y_is_num ? js_add(y, range_y) : Value(y_default);`,
      to: `  const Value max_y = y_is_num ? js_add(y, range_x) : Value(y_default);`,
    },
    {
      note: "Item: px 的上下界颠倒",
      file: "native/lfw/stage/item.cpp",
      from: `  const double px = _stage->mt()->range(to_number(min_x), to_number(max_x));`,
      to: `  const double px = _stage->mt()->range(to_number(max_x), to_number(min_x));`,
    },
    {
      note: "Item: 空 outline_color 不是空串",
      file: "native/lfw/stage/item.cpp",
      from: `  e->set_outline_color_raw(is_nullish(outline_color) ? Value(std::u16string()) : outline_color);`,
      to: `  e->set_outline_color_raw(is_nullish(outline_color) ? Value(std::u16string(u"#000000"))
                                                       : outline_color);`,
    },
    {
      note: "Item: 显式 outline_color 被固定色覆盖",
      file: "native/lfw/stage/item.cpp",
      from: `  e->set_outline_color_raw(is_nullish(outline_color) ? Value(std::u16string()) : outline_color);`,
      to: `  e->set_outline_color_raw(is_nullish(outline_color) ? Value(std::u16string()) : Value(std::u16string(u"#123456")));`,
    },
    {
      note: "Item: dead_gone 不是 1",
      file: "native/lfw/stage/item.cpp",
      from: `  e->set_dead_gone(1.0);`,
      to: `  e->set_dead_gone(2.0);`,
    },
    {
      note: "Item: reserve 的缺省不是 0",
      file: "native/lfw/stage/item.cpp",
      from: `  e->set_reserve(to_number(is_nullish(reserve) ? Value(0.0) : reserve));`,
      to: `  e->set_reserve(to_number(is_nullish(reserve) ? Value(1.0) : reserve));`,
    },
    {
      note: "Item: hp 的赋值顺序反了（hp 先写）",
      file: "native/lfw/stage/item.cpp",
      from: `    e->set_hp_max(to_number(hp_value));
    e->set_hp_r(to_number(hp_value));
    e->set_hp(to_number(hp_value));`,
      to: `    e->set_hp(to_number(hp_value));
    e->set_hp_r(to_number(hp_value));
    e->set_hp_max(to_number(hp_value));`,
    },
    {
      note: "Item: mp 的两个 setter 顺序反了",
      file: "native/lfw/stage/item.cpp",
      from: `    e->set_mp_max(to_number(mp));
    e->set_mp(to_number(mp));`,
      to: `    e->set_mp(to_number(mp));
    e->set_mp_max(to_number(mp));`,
    },
    {
      note: "Item: hp_map 命中时也走难度分支",
      file: "native/lfw/stage/item.cpp",
      from: `  if (!is_num(hp_value) && is_num(hp)) {`,
      to: `  if (!is_num(hp_value) || is_num(hp)) {`,
    },
    {
      note: "Item: Easy 分支按 Crazy 算",
      file: "native/lfw/stage/item.cpp",
      from: `    if (strict_equals(difficulty, Value(static_cast<double>(Difficulty::Easy)))) {`,
      to: `    if (strict_equals(difficulty, Value(static_cast<double>(Difficulty::Crazy)))) {`,
    },
    {
      note: "Item: Easy 的系数写成 1/2",
      file: "native/lfw/stage/item.cpp",
      from: `      hp_value = Value(round(to_number(hp) * 3.0 / 4.0));`,
      to: `      hp_value = Value(round(to_number(hp) * 3.0 / 2.0));`,
    },
    {
      note: "Item: hp_map 的键用常量 1（不读 difficulty）",
      file: "native/lfw/stage/item.cpp",
      from: `  if (!is_nullish(hp_map)) hp_value = indexed(hp_map, _stage->difficulty());`,
      to: `  if (!is_nullish(hp_map)) hp_value = indexed(hp_map, Value(1.0));`,
    },
    {
      note: "Item: mp 的缺省不做 mp_map 查表",
      file: "native/lfw/stage/item.cpp",
      from: `  if (is_undefined(mp)) mp = is_nullish(mp_map) ? Value() : indexed(mp_map, difficulty);`,
      to: `  if (is_undefined(mp)) mp = Value();`,
    },
    {
      note: "Item: is_num(mp) 的门去掉",
      file: "native/lfw/stage/item.cpp",
      from: `  if (is_num(mp)) {`,
      to: `  if (true) {`,
    },
    {
      note: "Item: name 读 data.name（不是 data.base.name）",
      file: "native/lfw/stage/item.cpp",
      from: `    e->set_name(field_or(field_or(e->data(), u"base"), u"name"));`,
      to: `    e->set_name(field_or(e->data(), u"name"));`,
    },
    {
      note: "Item: facing 只认 1（丢了 -1）",
      file: "native/lfw/stage/item.cpp",
      from: `  if (equals(facing, Value(1.0)) || equals(facing, Value(-1.0))) e->set_facing(facing);`,
      to: `  if (equals(facing, Value(1.0))) e->set_facing(facing);`,
    },
    {
      note: "Item: act 是字符串也不进帧",
      file: "native/lfw/stage/item.cpp",
      from: `  if (is_str(act)) {`,
      to: `  if (false) {`,
    },
    {
      note: "Item: fighter 的缺省帧不是 running_0",
      file: "native/lfw/stage/item.cpp",
      from: `    e->enter_frame_by_id(Value(std::u16string(u"running_0")));`,
      to: `    e->enter_frame_by_id(Value(std::u16string(u"running_1")));`,
    },
    {
      note: "Item: 非 fighter 走的是 enter_frame_by_id",
      file: "native/lfw/stage/item.cpp",
      from: `    e->enter_frame(auto_frame != nullptr ? *auto_frame : Value());`,
      to: `    e->enter_frame_by_id(auto_frame != nullptr ? *auto_frame : Value());`,
    },
    {
      note: "Item: times 到 0 也继续减（变负数）",
      file: "native/lfw/stage/item.cpp",
      from: `  if (times.has_value() && truthy(Value(*times))) *times = *times - 1.0;`,
      to: `  if (times.has_value()) *times = *times - 1.0;`,
    },
    {
      note: "Item: join 的对象不建了",
      file: "native/lfw/stage/item.cpp",
      from: `  if (truthy(join)) {`,
      to: `  if (false) {`,
    },
    {
      note: "Item: join 的队伍缺省不是 Team_1",
      file: "native/lfw/stage/item.cpp",
      from: `    dead_join->set(u"team", or_undefined(field_or(_info, u"join_team"),
                                         Value(std::u16string(team_enum::kTeam_1))));`,
      to: `    dead_join->set(u"team", or_undefined(field_or(_info, u"join_team"),
                                         Value(std::u16string(team_enum::kTeam_2))));`,
    },
    {
      note: "Item: join 的 reserve 写死 0",
      file: "native/lfw/stage/item.cpp",
      from: `    dead_join->set(u"reserve", field_or(_info, u"join_reserve"));`,
      to: `    dead_join->set(u"reserve", Value(0.0));`,
    },
    {
      note: "Item: release 不置位",
      file: "native/lfw/stage/item.cpp",
      from: `void Item::release() { _released = true; }`,
      to: `void Item::release() { _released = false; }`,
    },
  ],
};
