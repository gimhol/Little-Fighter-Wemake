// `lfw/dat_translator/xml/*`（xml 方言读写层第二批）的变异档。
//
// 用例：`cases/xml/layer2.txt` + `cases/xml/entity.txt`（任一锁住即可）。
//
// 有意不覆盖（不可观察 / 走不到 / 台面造不出）：
//   * `xml_x_map` 里那两行 `el.get_str("id", key)` / `el.get_str("key", key)` 是 TS 的
//     **死代码**（`get_str(or)` 只读不写），端口照抄 ⇒ 改不改都一样。
//   * `delete_undefined` / `reorder_fields` 的效果：值接 `undefined` 的键在渲染时被
//     JSON 语义丢掉，顺序在字段表里本已符合 ⇒ 单看用例不可观察。
//   * `xml_x_partial_world_dataset` 的 `!truthy(i)` 分支：用例只走对象，假值面与
//     空对象面同观。
//   * `xml_from_json` 里 `attrs` 的数组分支：`attrsOf` 已把数组滤掉（`typeof === "object"`）
//     ⇒ 分支是死代码。
//   * `xml_x_hit_key_map` 对「键在但值为 undefined」的跳过：`xml_x_t_next_frame(undefined)`
//     本来就给空表，两条路殊途同归。
export default {
  subject: "xml",
  cases: ["layer2", "entity"],
  mutations: [
    // ---------------------------------------------------------- difficulty_map
    {
      note: "xml_x_difficulty_map(): 分隔符换成 ';'",
      file: "native/lfw/dat_translator/xml/xml_x_difficulty_map.cpp",
      from: `      parts.push_back(key + u":" + number_to_string(*mv_num));`,
      to: `      parts.push_back(key + u";" + number_to_string(*mv_num));`,
    },
    {
      note: "xml_2_difficulty_map(): 缺 v 时不再 NaN 跳过（按 0 收）",
      file: "native/lfw/dat_translator/xml/xml_x_difficulty_map.cpp",
      from: `    const double val = segs.size() >= 2 ? string_to_number(segs[1]) : std::nan("");`,
      to: `    const double val = segs.size() >= 2 ? string_to_number(segs[1]) : string_to_number(u"");`,
    },
    {
      note: "xml_2_difficulty_map(): NaN 跳过整个失效",
      file: "native/lfw/dat_translator/xml/xml_x_difficulty_map.cpp",
      from: `    if (std::isnan(k) || std::isnan(val)) continue;`,
      to: `    if (false) continue;`,
    },
    {
      note: "xml_x_difficulty_map(): 空串也给写属性",
      file: "native/lfw/dat_translator/xml/xml_x_difficulty_map.cpp",
      from: `  if (value.empty()) return;`,
      to: `  if (false) return;`,
    },
    // ------------------------------------------------------------------ map
    {
      note: "xml_2_map(): 不再回落 'key' 属性",
      file: "native/lfw/dat_translator/xml/xml_x_map.cpp",
      from: `      if (!key) key = child->get_str(u"key");`,
      to: `      (void)0;`,
    },
    {
      note: "xml_2_map(): 空串键也算键",
      file: "native/lfw/dat_translator/xml/xml_x_map.cpp",
      from: `      if (!key || key->empty()) continue;`,
      to: `      if (!key) continue;`,
    },
    {
      note: "xml_2_map(): 空对象不再给 undefined",
      file: "native/lfw/dat_translator/xml/xml_x_map.cpp",
      from: `  if (ret->keys().empty()) return Value();`,
      to: `  if (false) return Value();`,
    },
    {
      note: "xml_x_map(): null 值也去造元素",
      file: "native/lfw/dat_translator/xml/xml_x_map.cpp",
      from: `      if (pv == nullptr || is_nullish(*pv)) continue;`,
      to: `      if (pv == nullptr) continue;`,
    },
    {
      note: "xml_x_map(): 空表不再给 undefined",
      file: "native/lfw/dat_translator/xml/xml_x_map.cpp",
      from: `  if (ret.empty()) return std::nullopt;`,
      to: `  if (false) return std::nullopt;`,
    },
    // ------------------------------------------------------------ hit_key_map
    {
      note: "xml_x_hit_key_map(): 不写 'key' 属性",
      file: "native/lfw/dat_translator/xml/xml_x_hit_key_map.cpp",
      from: `      el->set_attr(u"key", Value(key));`,
      to: `      (void)0;`,
    },
    {
      note: "xml_x_hit_key_map(): 空表不再给 undefined",
      file: "native/lfw/dat_translator/xml/xml_x_hit_key_map.cpp",
      from: `  if (ret.empty()) return std::nullopt;`,
      to: `  if (false) return std::nullopt;`,
    },
    {
      note: "xml_2_hit_key_map(): 空对象不再给 undefined",
      file: "native/lfw/dat_translator/xml/xml_x_hit_key_map.cpp",
      from: `  if (ret->keys().empty()) return Value();`,
      to: `  if (false) return Value();`,
    },
    {
      note: "xml_2_hit_key_map(): 空串键也算键",
      file: "native/lfw/dat_translator/xml/xml_x_hit_key_map.cpp",
      from: `    if (!key || key->empty()) continue;`,
      to: `    if (!key) continue;`,
    },
    // ----------------------------------------------------- partial_world_dataset
    {
      note: "xml_x_partial_world_dataset(): 空对象也去 from_object",
      file: "native/lfw/dat_translator/xml/xml_x_partial_world_dataset.cpp",
      from: `  if (o == nullptr || o->keys().empty()) return nullptr;`,
      to: `  if (o == nullptr) return nullptr;`,
    },
    {
      note: "xml_from_world_dataset(): 空表不再给 undefined",
      file: "native/lfw/dat_translator/xml/xml_from_world_dataset.cpp",
      from: `  if (item.empty()) return nullptr;`,
      to: `  if (false) return nullptr;`,
    },
    // ------------------------------------------------------------- bg_terrain
    {
      note: "xml_to_bg_terrain(): 不读 name",
      file: "native/lfw/dat_translator/xml/xml_to_bg_terrain.cpp",
      from: `  o->set(u"name", from_opt(el.get_str(u"name")));`,
      to: `  (void)0;`,
    },
    // -------------------------------------------------------------- picture
    {
      note: "xml_2_picture_info(): variants 走 get_str（不是数组）",
      file: "native/lfw/dat_translator/xml/xml_x_picture_info.cpp",
      from: `  o->set(u"variants", from_opt(el.get_str_arr(u"variants")));`,
      to: `  o->set(u"variants", from_opt(get_str_or(el, u"variants", field_or(*o, u"variants"))));`,
    },
    // ------------------------------------------------------------- frame_pic
    {
      note: "xml_2_frame_pic(): rect 的 x 取了下标 2",
      file: "native/lfw/dat_translator/xml/xml_x_frame_pic.cpp",
      from: `  o->set(u"x", from_opt(get_num_or(el, u"x", rect_at(rect, 0, field_or(*o, u"x")))));`,
      to: `  o->set(u"x", from_opt(get_num_or(el, u"x", rect_at(rect, 2, field_or(*o, u"x")))));`,
    },
    // ------------------------------------------------------------ model_info
    {
      note: "xml_2_model_info(): scale 读的是 offset 属性",
      file: "native/lfw/dat_translator/xml/xml_x_model_info.cpp",
      from: `  const Value scale = vec3_attr(el, u"scale");`,
      to: `  const Value scale = vec3_attr(el, u"offset");`,
    },
    // ---------------------------------------------------------------- dialog
    {
      note: "xml_2_dialog_info(): 不读 pause",
      file: "native/lfw/dat_translator/xml/xml_x_dialog_info.cpp",
      from: `  o->set(u"pause", from_opt(get_bool_or(el, u"pause", field_or(*o, u"pause"))));`,
      to: `  (void)0;`,
    },
    // ----------------------------------------------------------------- drink
    {
      note: "xml_x_drink_info(): hp_h 的 total/value 换位",
      file: "native/lfw/dat_translator/xml/xml_x_drink_info.cpp",
      from: `  put_soft_attr(ret, u"hp_h", d, u"hp_h_total", u"hp_h_value", u"hp_h_ticks");`,
      to: `  put_soft_attr(ret, u"hp_h", d, u"hp_h_value", u"hp_h_total", u"hp_h_ticks");`,
    },
    // ---------------------------------------------------------------- bg_info
    {
      note: "xml_2_bg_info(): group 缺省换成别的字符串",
      file: "native/lfw/dat_translator/xml/xml_x_bg_info.cpp",
      from: `      arr->push_back(Value(u"regular"));`,
      to: `      arr->push_back(Value(u"REGULAR"));`,
    },
    {
      note: "xml_2_bg_info(): height 缺省不再是 MODERN_SCREEN_HEIGHT",
      file: "native/lfw/dat_translator/xml/xml_x_bg_info.cpp",
      from: `  o->set(u"height", Value(height ? *height : defines::num(u"Defines.MODERN_SCREEN_HEIGHT")));`,
      to: `  o->set(u"height", Value(height ? *height : 0));`,
    },
    {
      note: "xml_x_bg_info(): group 空串不再删除",
      file: "native/lfw/dat_translator/xml/xml_x_bg_info.cpp",
      from: `    info->set_attr(u"group", truthy(joined) ? joined : Value());`,
      to: `    info->set_attr(u"group", joined);`,
    },
    // --------------------------------------------------------------- bg_layer
    {
      note: "xml_2_bg_layer(): z 的下标兜底固定成 0",
      file: "native/lfw/dat_translator/xml/xml_x_bg_layer.cpp",
      from: `  o->set(u"z", from_opt(get_num_or(el, u"z", Value(static_cast<double>(index)))));`,
      to: `  o->set(u"z", from_opt(get_num_or(el, u"z", Value(0.0))));`,
    },
    {
      note: "xml_2_bg_layer(): w 的 rect 兜底取了下标 3",
      file: "native/lfw/dat_translator/xml/xml_x_bg_layer.cpp",
      from: `  o->set(u"w", from_opt(get_num_or(el, u"w", arr_at(size, 0, arr_at(rect, 2, field_or(*o, u"w"))))));`,
      to: `  o->set(u"w", from_opt(get_num_or(el, u"w", arr_at(size, 0, arr_at(rect, 3, field_or(*o, u"w"))))));`,
    },
    // ---------------------------------------------------------- frame_indexes
    {
      note: "xml_x_frame_indexes(): falling_2 取了 [1]",
      file: "native/lfw/dat_translator/xml/xml_x_frame_indexes.cpp",
      from: `  ret->set_attr(u"falling_2", pair_at(field_or(indexes, u"falling"), u"-1"));`,
      to: `  ret->set_attr(u"falling_2", pair_at(field_or(indexes, u"falling"), u"1"));`,
    },
    {
      note: "xml_2_frame_indexes(): 成对子对象的 [1] 装了 b",
      file: "native/lfw/dat_translator/xml/xml_x_frame_indexes.cpp",
      from: `  o->set(u"1", from_opt(a));`,
      to: `  o->set(u"1", from_opt(b));`,
    },
    {
      note: "xml_2_frame_indexes(): injured 当成字符串数组读",
      file: "native/lfw/dat_translator/xml/xml_x_frame_indexes.cpp",
      from: `    const Value v = pair_of_str(el->get_str(u"injured_1"), el->get_str(u"injured_2"));`,
      to: `    const Value v = pair_of(el->get_str_arr(u"injured_1"), el->get_str_arr(u"injured_2"));`,
    },
    // ------------------------------------------------------------ frame_model
    {
      note: "xml_2_frame_model(): 不看 pose 子元素",
      file: "native/lfw/dat_translator/xml/xml_x_frame_model.cpp",
      from: `  if (pose_el != nullptr) {`,
      to: `  if (false) {`,
    },
    {
      note: "xml_x_frame_model(): pose 的 bones 写了 scl",
      file: "native/lfw/dat_translator/xml/xml_x_frame_model.cpp",
      from: `    pe->set_attr(u"bones", field_or(pose, u"bones"));`,
      to: `    pe->set_attr(u"bones", field_or(pose, u"scl"));`,
    },
    // ---------------------------------------------------------------- opoint
    {
      note: "xml_2_opoint(): oid 缺省不再是空串",
      file: "native/lfw/dat_translator/xml/xml_x_opoint.cpp",
      from: `    o->set(u"oid", truthy(oid) ? oid : Value(std::u16string()));`,
      to: `    o->set(u"oid", truthy(oid) ? oid : Value());`,
    },
    {
      note: "xml_2_opoint(): multi 不再回落到属性值",
      file: "native/lfw/dat_translator/xml/xml_x_opoint.cpp",
      from: `      o->set(u"multi", num ? Value(*num) : field_or(*o, u"multi"));`,
      to: `      o->set(u"multi", field_or(*o, u"multi"));`,
    },
    {
      note: "xml_x_opoint(): 数字 multi 不再写属性",
      file: "native/lfw/dat_translator/xml/xml_x_opoint.cpp",
      from: `  if (std::get_if<double>(&multi) != nullptr) el->set_attr(u"multi", multi);`,
      to: `  (void)0;`,
    },
    // ------------------------------------------------------- sound_play（怪癖）
    {
      note: "xml_x_sound_play_info(): blank 判断反转（path 有内容才写）",
      file: "native/lfw/dat_translator/xml/xml_x_stage_phase_info.cpp",
      from: `  if (!truthy(s) || !path_blank) return nullptr;`,
      to: `  if (!truthy(s) || path_blank) return nullptr;`,
    },
    {
      note: "xml_x_stage_phase_info(): title 写成 title2",
      file: "native/lfw/dat_translator/xml/xml_x_stage_phase_info.cpp",
      from: `  el->set_attr(u"title", field_or(p, u"title"));`,
      to: `  el->set_attr(u"title2", field_or(p, u"title"));`,
    },
    {
      note: "xml_x_stage_phase_info(): respawn 映射写到 respawn_r",
      file: "native/lfw/dat_translator/xml/xml_x_stage_phase_info.cpp",
      from: `  xml_x_difficulty_map(el, u"respawn", field_or(p, u"respawn"));`,
      to: `  xml_x_difficulty_map(el, u"respawn_r", field_or(p, u"respawn"));`,
    },
    // ------------------------------------------------------------- stage_info
    {
      note: "xml_2_stage_info(): 不读 group",
      file: "native/lfw/dat_translator/xml/xml_x_stage_info.cpp",
      from: `  o->set(u"group", from_opt(el.get_str_arr(u"group")));`,
      to: `  (void)0;`,
    },
    {
      note: "xml_2_stage_info(): phases 缺省不再是 []",
      file: "native/lfw/dat_translator/xml/xml_x_stage_info.cpp",
      from: `      o->set(u"phases", Value(std::make_shared<Array>()));`,
      to: `      o->set(u"phases", Value());`,
    },
    {
      note: "xml_x_stage_info(): bg 写了 name 的值",
      file: "native/lfw/dat_translator/xml/xml_x_stage_info.cpp",
      from: `  el->set_attr(u"bg", field_or(s, u"bg"));`,
      to: `  el->set_attr(u"bg", field_or(s, u"name"));`,
    },
    {
      note: "xml_to_stage_info_list(): 单个 <stage> 的回退失效",
      file: "native/lfw/dat_translator/xml/xml_x_stage_info.cpp",
      from: `  if (el.tag() == u"stage") {`,
      to: `  if (false) {`,
    },
    // --------------------------------------------------------------- bg_data
    {
      note: "xml_2_bg_data(): terrain 的 tag 写成 terrainX",
      file: "native/lfw/dat_translator/xml/xml_x_bg_data.cpp",
      from: `  o->set(u"terrain", xml_2_non_empty(el, u"terrain", xml_to_bg_terrain));`,
      to: `  o->set(u"terrain", xml_2_non_empty(el, u"terrainX", xml_to_bg_terrain));`,
    },
    {
      note: "xml_2_bg_data(): type 常数改掉",
      file: "native/lfw/dat_translator/xml/xml_x_bg_data.cpp",
      from: `  o->set(u"type", Value(u"background"));`,
      to: `  o->set(u"type", Value(u"bg"));`,
    },
    // ------------------------------------------------------------- from_json
    {
      note: "xml_from_json(): '<' 的转义串改掉",
      file: "native/lfw/dat_translator/xml/xml_from_json.cpp",
      from: `      case u'<': out += u"&lt;"; break;`,
      to: `      case u'<': out += u"&LT;"; break;`,
    },
    {
      note: "xml_from_json(): 空串属性不再跳过",
      file: "native/lfw/dat_translator/xml/xml_from_json.cpp",
      from: `    if (v == nullptr || is_nullish(*v) || is_empty_string(*v)) continue;`,
      to: `    if (v == nullptr || is_nullish(*v)) continue;`,
    },
    {
      note: "xml_from_json(): attrsOf 不滤对象值",
      file: "native/lfw/dat_translator/xml/xml_from_json.cpp",
      from: `    if (is_nullish(*v) || is_object_like(*v)) continue;`,
      to: `    if (is_nullish(*v)) continue;`,
    },
    {
      note: "xml_from_json(): 纯值数组不再跳过（会展开成子元素）",
      file: "native/lfw/dat_translator/xml/xml_from_json.cpp",
      from: `      if (all_primitive) continue;`,
      to: `      if (false) continue;`,
    },
    {
      note: "xml_from_json(): 数组项不看 tagName",
      file: "native/lfw/dat_translator/xml/xml_from_json.cpp",
      from: `          if (tn != nullptr && !is_nullish(*tn)) child_tag = to_string(*tn);`,
      to: `          (void)0;`,
    },
    // ---------------------------------------------------------- world_dataset
    {
      note: "xml_to_world_dataset(): int/float 分支不再走死值（强行给 123）",
      file: "native/lfw/dat_translator/xml/xml_to_world_dataset.cpp",
      from: `        ret->set(*key, from_opt(child->as_number()));`,
      to: `        ret->set(*key, Value(123.0));`,
    },
    // ------------------------------------------------------------ data_lists
    {
      note: "xml_from_data_lists(): stages 组写成 'stage'",
      file: "native/lfw/dat_translator/xml/xml_from_data_lists.cpp",
      from: `  static const char16_t* const kTags[6] = {u"obj", u"background", u"stages", u"bot", u"moves", u"directors"};`,
      to: `  static const char16_t* const kTags[6] = {u"obj", u"background", u"stage", u"bot", u"moves", u"directors"};`,
    },
    {
      note: "xml_2_data_lists(): stages/moves 的键换位",
      file: "native/lfw/dat_translator/xml/xml_to_data_lists.cpp",
      from: `  static const char16_t* const kKeys[5] = {u"objects", u"backgrounds", u"stages", u"bots",\n                                           u"moves"};`,
      to: `  static const char16_t* const kKeys[5] = {u"objects", u"backgrounds", u"moves", u"bots",\n                                           u"stages"};`,
    },
    // ----------------------------------------------------------------- frame
    {
      note: "xml_x_frame(): 单个 sound 不再写子元素",
      file: "native/lfw/dat_translator/xml/xml_x_frame.cpp",
      from: `    } else if (truthy(sound)) {`,
      to: `    } else if (false) {`,
    },
    {
      note: "xml_x_frame(): center 的 y 分量取了 x",
      file: "native/lfw/dat_translator/xml/xml_x_frame.cpp",
      from: `    arr->push_back(field_or(f, u"centery"));`,
      to: `    arr->push_back(field_or(f, u"centerx"));`,
    },
    {
      note: "xml_2_frame(): 单张 pic 也进 pics",
      file: "native/lfw/dat_translator/xml/xml_x_frame.cpp",
      from: `    if (pics->size() > 1) {`,
      to: `    if (pics->size() > 0) {`,
    },
    {
      note: "xml_2_frame(): 不读 model",
      file: "native/lfw/dat_translator/xml/xml_x_frame.cpp",
      from: `  o->set(u"model", xml_2_frame_model(el.child_by_tag(u"model")));`,
      to: `  (void)0;`,
    },
    // ------------------------------------------------------------ entity_info
    {
      note: "xml_2_entity_info(): bounce_min 的 y 读了 [1]",
      file: "native/lfw/dat_translator/xml/xml_x_entity_info.cpp",
      from: `    o->set(u"bounce_min_y", from_opt(get_num_or(el, u"bounce_min_y", soft_at(bounce_min, 0, field_or(*o, u"bounce_min_y")))));`,
      to: `    o->set(u"bounce_min_y", from_opt(get_num_or(el, u"bounce_min_y", soft_at(bounce_min, 1, field_or(*o, u"bounce_min_y")))));`,
    },
    {
      note: "xml_2_entity_info(): fast_v 读的是 fast 属性",
      file: "native/lfw/dat_translator/xml/xml_x_entity_info.cpp",
      from: `    const std::optional<std::vector<std::optional<double>>> fast_v = el.nums_attr_soft(u"fast_v");`,
      to: `    const std::optional<std::vector<std::optional<double>>> fast_v = el.nums_attr_soft(u"fast");`,
    },
    {
      note: "xml_x_entity_info(): fast 写成 fast_v",
      file: "native/lfw/dat_translator/xml/xml_x_entity_info.cpp",
      from: `    ret->set_arr_attr_soft(u"fast", Value(std::move(arr)));`,
      to: `    ret->set_arr_attr_soft(u"fast_v", Value(std::move(arr)));`,
    },
    {
      note: "xml_2_entity_info(): portraits 缺名不再给空串",
      file: "native/lfw/dat_translator/xml/xml_x_entity_info.cpp",
      from: `      const std::u16string name = p->get_str(u"name").value_or(u"");`,
      to: `      const std::u16string name = p->get_str(u"name").value_or(u"X");`,
    },
    {
      note: "xml_2_entity_info(): brokens 拼接次序颠倒",
      file: "native/lfw/dat_translator/xml/xml_x_entity_info.cpp",
      from: `    for (IXMLElement* v : el.children_by_tag(u"broken")) brokens->push_back(xml_2_opoint(*v));\n    for (IXMLElement* v : el.children_by_tag(u"opoint")) brokens->push_back(xml_2_opoint(*v));`,
      to: `    for (IXMLElement* v : el.children_by_tag(u"opoint")) brokens->push_back(xml_2_opoint(*v));\n    for (IXMLElement* v : el.children_by_tag(u"broken")) brokens->push_back(xml_2_opoint(*v));`,
    },
    // ------------------------------------------------------------ entity_data
    {
      note: "xml_2_entity_data(): processed 不再 || void 0",
      file: "native/lfw/dat_translator/xml/xml_x_entity_data.cpp",
      from: `    o->set(u"processed", processed && *processed ? Value(true) : Value());`,
      to: `    o->set(u"processed", Value(processed.value_or(false)));`,
    },
    {
      note: "xml_2_entity_data(): frames 缺省不再是 {}",
      file: "native/lfw/dat_translator/xml/xml_x_entity_data.cpp",
      from: `      o->set(u"frames", Value(std::make_shared<Object>()));`,
      to: `      o->set(u"frames", Value());`,
    },
    {
      note: "xml_x_entity_data(): bdy_prefabs 的 tag 写成 bdy2",
      file: "native/lfw/dat_translator/xml/xml_x_entity_data.cpp",
      from: `  xml_x_map(xml, field_or(data, u"bdy_prefabs"), u"bdy", xml_x_bdy, ret);`,
      to: `  xml_x_map(xml, field_or(data, u"bdy_prefabs"), u"bdy2", xml_x_bdy, ret);`,
    },
    {
      note: "xml_2_entity_data(): 不读 indexes",
      file: "native/lfw/dat_translator/xml/xml_x_entity_data.cpp",
      from: `  o->set(u"indexes", xml_2_frame_indexes(el->child_by_tag(u"indexes")));`,
      to: `  (void)0;`,
    },
    {
      note: "xml_2_entity_data(): on_dead 的 tag 写成 on_dead2",
      file: "native/lfw/dat_translator/xml/xml_x_entity_data.cpp",
      from: `  o->set(u"on_dead", xml_2_t_next_frame(el->children_by_tag(u"on_dead")));`,
      to: `  o->set(u"on_dead", xml_2_t_next_frame(el->children_by_tag(u"on_dead2")));`,
    },
    // ------------------------------------------------------------ director
    {
      note: "director：velocity 的 null 不再保留",
      file: "native/lfw/dat_translator/xml/xml_x_director.cpp",
      from: `      ret->set(key, trim_str(*raw) == u"null" ? Value(NullTag{}) : to_expr(*raw));`,
      to: `      ret->set(key, to_expr(*raw));`,
    },
    {
      note: "director：key_up=all 不经特例",
      file: "native/lfw/dat_translator/xml/xml_x_director.cpp",
      from: `  if (std::u16string(name) == u"key_up" && trim_str(*raw) == u"all") return str_value(u"all");`,
      to: `  if (std::u16string(name) == u"never") return str_value(u"all");`,
    },
    {
      note: "director：表达式不再分辨纯数字",
      file: "native/lfw/dat_translator/xml/xml_x_director.cpp",
      from: `  return is_expr_number(text) ? Value(string_to_number(text)) : Value(raw);`,
      to: `  return Value(raw);`,
    },
  ],
};
