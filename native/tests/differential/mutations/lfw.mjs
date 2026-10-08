// `LFW` 门面第一批（4AB）的变异档：类核心（静态/实例表/ID 族/回调/广播/进度/难度）
// + 缝接线（实例注册、点设备输入、随机实体）。
//
// 用例：`cases/lfw/{basic,keys,misc,welds}.txt`（任一锁住即可）。
export default {
  subject: "lfw",
  mutations: [
    {
      note: "实例表：构造后不登记自己",
      file: "native/lfw/lfw.cpp",
      from: `  instances_ref().push_back(this);
  host_->pointings_add_ui_input(*this);`,
      to: `  host_->pointings_add_ui_input(*this);`,
    },
    {
      note: "reset_new_id：重置到 99 而不是 100",
      file: "native/lfw/lfw.cpp",
      from: `void LFW::reset_new_id() { __id = 100.0; }`,
      to: `void LFW::reset_new_id() { __id = 99.0; }`,
    },
    {
      note: "random_entity_info：facing 判定式改成恒 -1",
      file: "native/lfw/lfw.cpp",
      from: `  e.facing = std::fmod(_mt.range(0.0, 100.0), 2.0) != 0.0 ? -1.0 : 1.0;`,
      to: `  e.facing = std::fmod(_mt.range(1.0, 100.0), 2.0) != 0.0 ? -1.0 : 1.0;`,
    },
    {
      note: "random_entity_info：x 轴边界取反",
      file: "native/lfw/lfw.cpp",
      from: `  const double x = _mt.range(l, r);
  const double z = _mt.range(f, n);`,
      to: `  const double x = _mt.range(r, l);
  const double z = _mt.range(f, n);`,
    },
    {
      note: "random_entity_info：z 轴边界取反",
      file: "native/lfw/lfw.cpp",
      from: `  const double x = _mt.range(l, r);
  const double z = _mt.range(f, n);`,
      to: `  const double x = _mt.range(l, r);
  const double z = _mt.range(n, f);`,
    },
    {
      note: "dispose：不发 on_dispose 回调",
      file: "native/lfw/lfw.cpp",
      from: `  callbacks.call(u"on_dispose", {LfwCallbackArgs{this}});`,
      to: `  (void)0;`,
    },
    {
      note: "emit_progress：进度 +1",
      file: "native/lfw/lfw.cpp",
      from: `void LFW::emit_progress(const std::u16string& content, double progress) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = content;
  args.num = progress;
  callbacks.call(u"on_progress", {args});
}`,
      to: `void LFW::emit_progress(const std::u16string& content, double progress) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = content;
  args.num = progress + 1.0;
  callbacks.call(u"on_progress", {args});
}`,
    },
    {
      note: "emit_progress：文本加尾巴",
      file: "native/lfw/lfw.cpp",
      from: `void LFW::emit_progress(const std::u16string& content, double progress) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = content;
  args.num = progress;
  callbacks.call(u"on_progress", {args});
}`,
      to: `void LFW::emit_progress(const std::u16string& content, double progress) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = content + u"!";
  args.num = progress;
  callbacks.call(u"on_progress", {args});
}`,
    },
    {
      note: "emit_progress_size：大小 +1",
      file: "native/lfw/lfw.cpp",
      from: `  args.num2 = to_number(size);
  args.has_num2 = true;`,
      to: `  args.num2 = to_number(size) + 1.0;
  args.has_num2 = true;`,
    },
    {
      note: "broadcast：回调文本加尾巴",
      file: "native/lfw/lfw.cpp",
      from: `void LFW::broadcast(const Value& m) {
  broadcasts.push_back(to_string(m));
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = to_string(m);
  callbacks.call(u"on_broadcast", {args});
}`,
      to: `void LFW::broadcast(const Value& m) {
  broadcasts.push_back(to_string(m));
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = to_string(m) + u"!";
  callbacks.call(u"on_broadcast", {args});
}`,
    },
    {
      note: "loop_offset：偏移先加到列表长度上",
      file: "native/lfw/lfw.cpp",
      from: `  double off = std::fmod(offset, static_cast<double>(len));`,
      to: `  double off = std::fmod(offset + 1.0, static_cast<double>(len));`,
    },

    // ------------------------------------------------------------ 4AC：加载流程
    {
      note: "pick_data_info：url 抄成 type 字段",
      file: "native/lfw/lfw.cpp",
      from: `  info.url = str_field(u"url");`,
      to: `  info.url = str_field(u"type");`,
    },
    {
      note: "load_zip_from_object：guard 名丢了前导下划线",
      file: "native/lfw/lfw.cpp",
      from: `  if (!disposed_guard(u"_load_zip_from_object", error)) return false;
  IDataInfo info;`,
      to: `  if (!disposed_guard(u"load_zip_from_object", error)) return false;
  IDataInfo info;`,
    },
    {
      note: "disposed_guard：错误文案少一段",
      file: "native/lfw/lfw.cpp",
      from: `  error = u"[LFW::" + fn + u"] instance disposed.";`,
      to: `  error = u"[LFW::" + fn + u"] disposed.";`,
    },
    {
      note: "collect_data_infos：md5 去重判断反了（已有的反而不收）",
      file: "native/lfw/lfw.cpp",
      from: `    if (m != nullptr && !m->empty() && loaded_md5s.count(*m) == 0) {`,
      to: `    if (m != nullptr && !m->empty() && loaded_md5s.count(*m) != 0) {`,
    },
    {
      note: "collect_data_infos：读包失败就提前收工（不再 continue）",
      file: "native/lfw/lfw.cpp",
      from: `      inst->host_->warn({Value(u"[LFW::collect_data_infos] 读取数据包信息失败: " + a.path),
                         Value(error)});
      continue;`,
      to: `      inst->host_->warn({Value(u"[LFW::collect_data_infos] 读取数据包信息失败: " + a.path),
                         Value(error)});
      return ret;`,
    },
    {
      note: "load_data：base 索引不再优先（按原序）",
      file: "native/lfw/lfw.cpp",
      from: `    if (is_base_index_name(file->name())) base.push_back(file->name());
    else rest.push_back(file->name());`,
      to: `    if (is_base_index_name(file->name())) rest.push_back(file->name());
    else base.push_back(file->name());`,
    },
    {
      note: "load_data：索引优先级反了（rest 在前）",
      file: "native/lfw/lfw.cpp",
      from: `  std::vector<std::u16string> paths = base;
  paths.insert(paths.end(), rest.begin(), rest.end());`,
      to: `  std::vector<std::u16string> paths = rest;
  paths.insert(paths.end(), base.begin(), base.end());`,
    },
    {
      note: "load_data：i18n 文件不再入词表",
      file: "native/lfw/lfw.cpp",
      from: `    if (ok && truthy(words)) _i18n.add(words);`,
      to: `    if (ok && truthy(words)) (void)words;`,
    },
    {
      note: "load_data：strings.json 文件名写错",
      file: "native/lfw/lfw.cpp",
      from: `  if (IZipObject* const f = zip.file(u"strings.json")) {`,
      to: `  if (IZipObject* const f = zip.file(u"strings.jsonx")) {`,
    },
    {
      note: "load：首屏 set_page 不调了",
      file: "native/lfw/lfw.cpp",
      from: `    Object opts;
    opts.set(u"id", found ? id : Value());
    _layers->set_page(Value(std::make_shared<Object>(opts)), 0.0);`,
      to: `    Object opts;
    opts.set(u"id", found ? id : Value());
    (void)opts;`,
    },
    {
      note: "load_data：bgms 去重失效（重复也 push）",
      file: "native/lfw/lfw.cpp",
      from: `    if (!dup) bgms.push_back(bgm->name());`,
      to: `    if (!dup || true) bgms.push_back(bgm->name());`,
    },
    {
      note: "load：is_first 恒 true（每次都走内置数据）",
      file: "native/lfw/lfw.cpp",
      from: `  const bool is_first = zips_.length() == 0;`,
      to: `  const bool is_first = true;`,
    },
    {
      note: "load：成功后不置 playable",
      file: "native/lfw/lfw.cpp",
      from: `  _playable = true;`,
      to: `  _playable = false;`,
    },
    {
      note: "load_ui：不置 _ui_loaded",
      file: "native/lfw/lfw.cpp",
      from: `  _ui_loaded = true;`,
      to: `  _ui_loaded = false;`,
    },

    // ------------------------------------------------------------ 4AD：URL 流程
    {
      note: "no_cache_url：分隔符串了（?/& 反）",
      file: "native/lfw/lfw.cpp",
      from: `  return url + (has_query ? u"&" : u"?") + u"time=" + number_to_string(now);`,
      to: `  return url + (has_query ? u"?" : u"&") + u"time=" + number_to_string(now);`,
    },
    {
      note: "full_zip_url：相对 info_url 时把 zip_url 换成了 info_url",
      file: "native/lfw/lfw.cpp",
      from: `  if (!starts_http(info_url)) return zip_url;`,
      to: `  if (!starts_http(info_url)) return info_url;`,
    },
    {
      note: "full_zip_url：丢掉 info_url 的 query/hash 尾巴",
      file: "native/lfw/lfw.cpp",
      from: `  return part_a.substr(0, ttt == kNpos ? 0 : ttt) + u"/" + zip_url + part_b;`,
      to: `  return part_a.substr(0, ttt == kNpos ? 0 : ttt) + u"/" + zip_url;`,
    },
    {
      note: "zip_content_url：内容标识参数名写成大写",
      file: "native/lfw/lfw.cpp",
      from: `  return zip_url + (has_query ? u"&" : u"?") + u"md5=" + *m;`,
      to: `  return zip_url + (has_query ? u"&" : u"?") + u"MD5=" + *m;`,
    },
    {
      note: "load_zip_from_url：起始进度报成 100",
      file: "native/lfw/lfw.cpp",
      from: `  emit_progress(info_url, 0.0);`,
      to: `  emit_progress(info_url, 100.0);`,
    },
    {
      note: "load_zip_from_url：收尾进度报成 0",
      file: "native/lfw/lfw.cpp",
      from: `  emit_progress(url, 100.0);`,
      to: `  emit_progress(url, 0.0);`,
    },
    {
      note: "load_zip_from_url：缺 url 的报错文案不同",
      file: "native/lfw/lfw.cpp",
      from: `    error = u"[LFW::load_zip_from_url] info json url got: " + info_url;`,
      to: `    error = u"[LFW::load_zip_from_url] url got: " + info_url;`,
    },
    {
      note: "load_zip_from_url：stored 分支恒用 zip_url 当名字",
      file: "native/lfw/lfw.cpp",
      from: `      if (!read_blob(has_md5 ? *md5s : zip_url, downloaded.blob, downloaded.md5)) return false;`,
      to: `      if (!read_blob(zip_url, downloaded.blob, downloaded.md5)) return false;`,
    },
    {
      note: "load_zip_from_url：Cache.del 两个实参反过来",
      file: "native/lfw/lfw.cpp",
      from: `    host_->zip_cache_del(info_url, u"");`,
      to: `    host_->zip_cache_del(u"", info_url);`,
    },
    {
      note: "load_zip_from_url：Cache.put 的 name 写成 zip_url",
      file: "native/lfw/lfw.cpp",
      from: `      entry.set(u"name", Value(*md5s));`,
      to: `      entry.set(u"name", Value(zip_url));`,
    },
    {
      note: "load_zip_from_url：stored 判断反了",
      file: "native/lfw/lfw.cpp",
      from: `    if (downloaded.stored) {`,
      to: `    if (!downloaded.stored) {`,
    },
    {
      note: "load_zip_from_url：缓存命中时不取 cached.name",
      file: "native/lfw/lfw.cpp",
      from: `        if (!read_blob(to_string(field_or(cached, u"name")), field_or(cached, u"blob"), md5)) {`,
      to: `        if (!read_blob(*md5s, field_or(cached, u"blob"), md5)) {`,
    },
    {
      note: "load_zip_from_url：cache.data 命中时改读 blob 字段",
      file: "native/lfw/lfw.cpp",
      from: `        if (!host_->zip_read_buf(to_string(name), data, zip, error)) return false;`,
      to: `        if (!host_->zip_read_buf(to_string(name), blob, zip, error)) return false;`,
    },
    {
      note: "on_loading_file：文本不再带括号",
      file: "native/lfw/lfw.cpp",
      from: `  const std::u16string txt = url + u"(" + short_size(full_size) + u")";`,
      to: `  const std::u16string txt = url + short_size(full_size);`,
    },
    {
      note: "short_size：KB 单位写成 kB",
      file: "native/lfw/lfw.cpp",
      from: `  if (bytes < 1024) return one_decimal(bytes) + u"KB";`,
      to: `  if (bytes < 1024) return one_decimal(bytes) + u"kB";`,
    },
  ],
};
