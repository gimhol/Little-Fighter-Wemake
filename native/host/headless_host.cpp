#include "host/headless_host.h"

#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <fstream>
#include <iterator>
#include <system_error>

#include "host/common/zip_file.h"
#include "lfw/core/js_num.h"
#include "lfw/core/json.h"
#include "lfw/core/json5.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/utf8.h"

namespace lfw::host {

namespace {

const std::u16string* as_str(const Value& v) { return std::get_if<std::u16string>(&v); }

std::u16string as_u16(const std::string& s) {
  return decode_utf8(std::vector<uint8_t>(s.begin(), s.end()));
}

std::string as_u8(const std::u16string& s) {
  const std::vector<uint8_t> buf = encode_utf8(s);
  return std::string(buf.begin(), buf.end());
}

std::string to_utf8(const std::u16string& s) { return as_u8(s); }

// `Ditto.warn(...args)` 的打印口径：参数按 `to_string` 拼（TS 里是 `console` 的多参形式）。
std::u16string join_args(const std::vector<Value>& args) {
  std::u16string out;
  for (size_t i = 0; i < args.size(); ++i) {
    if (i != 0) out += u" ";
    out += to_string(args[i]);
  }
  return out;
}

}  // namespace

HeadlessHost::HeadlessHost(std::vector<std::filesystem::path> roots, bool dev)
    : _roots(std::move(roots)), _dev(dev) {}

// `--root` 里的文件按 URL 找：与 `import_as_*` 收到的路径相比，URL 上多挂的 `?query` / `#hash`
// 与磁盘文件名无关（浏览器 `fetch` 也是这么做的）⇒ 查盘前先切掉。
// 触发这一条的实例子：`no_cache_url`（`load_zip_from_url` / `collect_data_infos`）给的是
// `data.zip.json?time=15016.666…`，不切就永远找不到 `dist/data.zip.json`。
std::string path_of_url(const std::string& url) {
  size_t end = url.size();
  const size_t q = url.find('?');
  if (q != std::string::npos) end = std::min(end, q);
  const size_t h = url.find('#');
  if (h != std::string::npos) end = std::min(end, h);
  return url.substr(0, end);
}

std::filesystem::path HeadlessHost::resolve(const std::u16string& path) const {
  std::error_code ec;
  const std::string rel = path_of_url(to_utf8(path));
  for (const std::filesystem::path& root : _roots) {
    const std::filesystem::path candidate = root / std::filesystem::path(rel);
    if (std::filesystem::is_regular_file(candidate, ec)) return candidate;
  }
  // TS `Ditto.Importer.get_possible_url_list` 还有第二档：`roots = ["builtin_data"]`，即路径若不带
  // 该前缀就再试一次 `builtin_data/<路径>`。缺这一档时 `!launch/bg.png` 这类路径在 `--root dist`
  // 下解析不到（TS 找得到），只能靠调用方多加一个 `--root dist\builtin_data` 绕过。
  if (rel.rfind("builtin_data/", 0) == 0) return {};
  for (const std::filesystem::path& root : _roots) {
    const std::filesystem::path candidate =
        root / std::filesystem::path("builtin_data") / std::filesystem::path(rel);
    if (std::filesystem::is_regular_file(candidate, ec)) return candidate;
  }
  return {};
}

bool HeadlessHost::read_file(const std::filesystem::path& path, std::string& out,
                             std::u16string& error) const {
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    error = u"[host] cannot open: " + as_u16(path.generic_string());
    return false;
  }
  out.assign(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
  if (!in.good() && !in.eof()) {
    error = u"[host] read failed: " + as_u16(path.generic_string());
    return false;
  }
  return true;
}

void HeadlessHost::keyboard_callback_add(LFW&, LfwKeyboardCallback* cb) {
  if (cb == nullptr) return;
  if (std::find(_kb_callbacks.begin(), _kb_callbacks.end(), cb) == _kb_callbacks.end()) {
    _kb_callbacks.push_back(cb);
  }
}

void HeadlessHost::keyboard_callback_del(LFW&, LfwKeyboardCallback* cb) {
  _kb_callbacks.erase(std::remove(_kb_callbacks.begin(), _kb_callbacks.end(), cb),
                      _kb_callbacks.end());
}

void HeadlessHost::pointings_callback_add(LFW&, LfwPointingsCallback* cb) {
  if (cb == nullptr) return;
  if (std::find(_pt_callbacks.begin(), _pt_callbacks.end(), cb) == _pt_callbacks.end()) {
    _pt_callbacks.push_back(cb);
  }
}

void HeadlessHost::pointings_callback_del(LFW&, LfwPointingsCallback* cb) {
  _pt_callbacks.erase(std::remove(_pt_callbacks.begin(), _pt_callbacks.end(), cb),
                      _pt_callbacks.end());
}

// `this.pointings.callback.add(new I.Ditto.UIInputHandle(this))`：句柄由宿主持有（TS 里靠回调表
// 引着），注册进同一张回调表 —— 于是「平台事件 → UI 句柄 → `POINTER_*` 命令」这条链在端口接通。
void HeadlessHost::pointings_add_ui_input(LFW& lfw) {
  if (_ui_input == nullptr) _ui_input = std::make_unique<UiInputHandle>(lfw);
  pointings_callback_add(lfw, _ui_input.get());
}

// TS `__Pointings.grab/ungrab/grabbing`：持有者 + 世代。世代在每次指针按下时 +1 ⇒ 上一次抓取
// 自动作废（`grabbing` 只在 `_grab_prev_epoch === _grab_epoch` 时返回持有者）。
bool HeadlessHost::pointings_grab(LFW&, const void* who) {
  if (_grabbing != nullptr && _grabbing != who && _grab_prev_epoch == _grab_epoch) return false;
  _grabbing = who;
  _grab_prev_epoch = _grab_epoch;
  return true;
}

void HeadlessHost::pointings_ungrab(LFW&, const void* who) {
  if (_grabbing == who) _grabbing = nullptr;
}

const void* HeadlessHost::pointings_grabbing(LFW&) {
  return _grabbing != nullptr && _grab_prev_epoch == _grab_epoch ? _grabbing : nullptr;
}

void HeadlessHost::pointings_dispose() {
  _pt_callbacks.clear();
  _grabbing = nullptr;
  _grab_prev_epoch = -1;
}

void HeadlessHost::sounds_callback_add(LFW&, LfwSoundsCallback* cb) {
  if (cb == nullptr) return;
  if (std::find(_sd_callbacks.begin(), _sd_callbacks.end(), cb) == _sd_callbacks.end()) {
    _sd_callbacks.push_back(cb);
  }
}

void HeadlessHost::sounds_callback_del(LFW&, LfwSoundsCallback* cb) {
  _sd_callbacks.erase(std::remove(_sd_callbacks.begin(), _sd_callbacks.end(), cb),
                      _sd_callbacks.end());
}

// 与指针那几条同款：迭代回调表的**副本** —— `PlayerKeyEdit::KeyListener::on_key_down` 会在回调里
// `keyboard_callback_del` 自己（失去焦点），照原样迭代活表会踩到 `erase` 后的迭代器。
void HeadlessHost::emit_key_down(LfwKeyEvent& e) {
  const std::vector<LfwKeyboardCallback*> cbs = _kb_callbacks;
  for (LfwKeyboardCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_key_down(e);
  }
}

void HeadlessHost::emit_key_up(LfwKeyEvent& e) {
  const std::vector<LfwKeyboardCallback*> cbs = _kb_callbacks;
  for (LfwKeyboardCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_key_up(e);
  }
}

// `__Keyboard.key_down`：`const times = _times_map.get(key) ?? -1; _times_map.set(key, times + 1);
// call('on_key_down', new __KeyEvent(key, true, device, times + 1))`
// ⇒ **第一次按下时事件里的 `times` 是 0**（这不是笔误：`LFW::on_key_down` 只在 `times == 0` 时
// 才把这次按下翻成 `KEY_EVENT` 命令，重复按下（`times > 0`）不再翻）。
void HeadlessHost::key_down(const std::u16string& key, const std::u16string& device_type) {
  const auto it = _key_times.find(key);
  const int prev = it == _key_times.end() ? -1 : it->second;
  _key_times[key] = prev + 1;
  if (_dev) std::printf("[host:key] down %s times=%d cbs=%zu\n", to_utf8(key).c_str(), prev + 1,
                        _kb_callbacks.size());
  LfwKeyEvent e;
  e.key = key;
  e.times = static_cast<double>(prev + 1);
  e.device_type = device_type;
  emit_key_down(e);
}

// `__Keyboard.key_up`：先 `_times_map.delete(key)`，事件里的 `times` 固定 0。
void HeadlessHost::key_up(const std::u16string& key, const std::u16string& device_type) {
  _key_times.erase(key);
  LfwKeyEvent e;
  e.key = key;
  e.times = 0.0;
  e.device_type = device_type;
  emit_key_up(e);
}

// ---- 指针注入 ----
// 每条都迭代回调表的**副本**：回调里 `pointings_callback_del` 自己也会改 `_pt_callbacks`
//（TS 的 `Callbacks.call` 同样是迭代副本）。
void HeadlessHost::emit_pointer_down(LfwPointingEvent& e) {
  ++_grab_epoch;  // `__Pointings._on_pointer_down` 的 `grab_begin()`
  const std::vector<LfwPointingsCallback*> cbs = _pt_callbacks;
  for (LfwPointingsCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_pointer_down(e);
  }
}

void HeadlessHost::emit_pointer_move(LfwPointingEvent& e) {
  const std::vector<LfwPointingsCallback*> cbs = _pt_callbacks;
  for (LfwPointingsCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_pointer_move(e);
  }
}

void HeadlessHost::emit_pointer_up(LfwPointingEvent& e) {
  const std::vector<LfwPointingsCallback*> cbs = _pt_callbacks;
  for (LfwPointingsCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_pointer_up(e);
  }
}

void HeadlessHost::emit_pointer_cancel(LfwPointingEvent& e) {
  const std::vector<LfwPointingsCallback*> cbs = _pt_callbacks;
  for (LfwPointingsCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_pointer_cancel(e);
  }
}

void HeadlessHost::emit_click(LfwPointingEvent& e) {
  const std::vector<LfwPointingsCallback*> cbs = _pt_callbacks;
  for (LfwPointingsCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_click(e);
  }
}

void HeadlessHost::emit_wheel(LfwPointingEvent& e) {
  const std::vector<LfwPointingsCallback*> cbs = _pt_callbacks;
  for (LfwPointingsCallback* const cb : cbs) {
    if (cb != nullptr) cb->on_wheel(e);
  }
}

void HeadlessHost::emit_pointer_enter(LfwPointingEvent& e) {
  if (_ui_input != nullptr) _ui_input->on_pointer_enter(e);
}

void HeadlessHost::emit_pointer_leave(LfwPointingEvent& e) {
  if (_ui_input != nullptr) _ui_input->on_pointer_leave(e);
}

void HeadlessHost::click_ui(LFW& lfw, double x, double y, double button) {
  LfwPointingEvent e;
  e.x = x;
  e.y = y;
  e.button = button;
  ui_scene_of_point(lfw.world(), x, y, e.scene_x, e.scene_y);
  // 与 TS 的无头 UI 测试同一个次序（`src/ui_test.ts` 的 `click_ui`）：进入 → 移动 → 按下 → 抬起。
  // 前两条让「悬停/进入」类的控件先就位（`ScrollView._armed`、`HoverBehavior`…），后两条才是点击。
  emit_pointer_enter(e);
  emit_pointer_move(e);
  emit_pointer_down(e);
  emit_pointer_up(e);
}

void HeadlessHost::cache_forget(const std::u16string&, double) {}
void HeadlessHost::zip_forget_stored(const std::u16string&, double) {}

void HeadlessHost::load_img(const std::u16string& path) {
  ++_ignored_images;
  if (_dev) std::printf("[host:img] %s\n", to_utf8(path).c_str());
}

bool HeadlessHost::ui_image_load(const std::u16string& img_key, const Value& path, const Value& ops,
                                 Value& out, std::u16string& error) {
  (void)ops;
  (void)error;
  // 渲染 / 位图在平台侧，headless 只把「这张图存在」这件事记下来：给一个零尺寸的描述，
  // 让 UI 树能照 TS 的形状建起来（组件按 `txt_info` 取宽高，画不画由渲染宿主决定）。
  // `w`/`h`/`scale` 三个数**必须**给（`0 / 1`）：核心侧 `UIImgLoader::load` 会算
  // `node.resize(w / scale, h / scale)`，缺字段就是 `undefined / undefined` ⇒ `NaN` 写进节点尺寸
  //（TS 那边这三个数由浏览器解码给出，永远不会缺）。真正的尺寸由平台宿主覆写（`LfwGodotHost`）。
  ++_ignored_images;
  Object info;
  info.set(u"key", Value(img_key));
  info.set(u"path", path);
  info.set(u"width", Value(0.0));
  info.set(u"height", Value(0.0));
  info.set(u"w", Value(0.0));
  info.set(u"h", Value(0.0));
  info.set(u"scale", Value(1.0));
  out = Value(std::make_shared<Object>(std::move(info)));
  return true;
}

void HeadlessHost::ui_image_pin(const std::u16string&) {}

std::u16string HeadlessHost::md5(const std::u16string& text) {
  // 真 MD5（RFC 1321）—— TS 那边是 `Ditto.MD5(str)`（SparkMD5 按 **UTF-8** 编码字符串）。
  return as_u16(md5_hex(to_utf8(text)));
}

void HeadlessHost::warn(const std::vector<Value>& args) {
  ++_warns;
  std::printf("[host:warn] %s\n", to_utf8(join_args(args)).c_str());
}

void HeadlessHost::error(const std::vector<Value>& args) {
  ++_errors;
  const std::u16string msg = join_args(args);
  if (_last_errors.size() < 20) _last_errors.push_back(msg);
  std::printf("[host:error] %s\n", to_utf8(msg).c_str());
}

void HeadlessHost::log(const std::vector<Value>& args) {
  ++_logs;
  if (_dev) std::printf("[host:log] %s\n", to_utf8(join_args(args)).c_str());
}

void HeadlessHost::debug_msg(const std::vector<Value>& args) {
  if (_dev) std::printf("[host:debug] %s\n", to_utf8(join_args(args)).c_str());
}

std::function<void()> HeadlessHost::sounds_play_bgm(const Value& music) {
  _bgm = to_string(music);
  return []() {};
}

void HeadlessHost::sounds_play(const Value& path, const Value&, const Value&, const Value&) {
  if (_dev) std::printf("[host:sound] %s\n", to_utf8(to_string(path)).c_str());
}

void HeadlessHost::sounds_play_preset(const Value& name, const Value&, const Value&,
                                      const Value&) {
  if (_dev) std::printf("[host:sound:preset] %s\n", to_utf8(to_string(name)).c_str());
}

void HeadlessHost::sounds_play_with_load(const Value& path) {
  if (_dev) std::printf("[host:sound:load] %s\n", to_utf8(to_string(path)).c_str());
}

void HeadlessHost::sounds_load(const Value& name, const Value& src) {
  if (_dev) {
    std::printf("[host:sound:preload] %s <= %s\n", to_utf8(to_string(name)).c_str(),
                to_utf8(to_string(src)).c_str());
  }
}

Value HeadlessHost::measure_text(const Value& text, const Value& style) {
  // 字体度量属平台（TS 里走 canvas / 字体表）。headless 给零尺寸：布局照算，只是都挤在一起。
  Object info;
  info.set(u"text", Value(to_string(text)));
  info.set(u"style", style);
  info.set(u"width", Value(0.0));
  info.set(u"height", Value(0.0));
  return Value(std::make_shared<Object>(std::move(info)));
}

void HeadlessHost::player_cache_get(const std::u16string& name, PlayerInfoCacheEntry& out) {
  const auto it = _player_cache.find(name);
  if (it == _player_cache.end()) {
    out = PlayerInfoCacheEntry{};
    out.missing = true;  // `await Ditto.Cache.get(name)` 回 `undefined`
    return;
  }
  out = PlayerInfoCacheEntry{};
  out.data_kind = PlayerInfoCacheEntry::DataKind::kBytes;
  out.data = it->second.data;
}

bool HeadlessHost::player_cache_del(const std::u16string& name, std::u16string& error) {
  (void)error;
  _player_cache.erase(name);
  return true;
}

void HeadlessHost::player_cache_put(const PlayerInfoCachePut& data) { _player_cache[data.name] = data; }

bool HeadlessHost::import_as_json(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                                  std::u16string& error) {
  for (const std::u16string& url : urls) {
    const std::filesystem::path path = resolve(url);
    if (path.empty()) continue;
    std::string raw;
    if (!read_file(path, raw, error)) return false;
    const std::u16string text = as_u16(raw);
    const Json5Result r = json5_parse(text);
    if (r.ok) {
      data = r.value;
      hit = Value(url);
      return true;
    }
    const std::optional<Value> strict = json_parse(text);
    if (strict.has_value()) {
      data = *strict;
      hit = Value(url);
      return true;
    }
    error = u"[host] import_as_json parse failed: " + url + u" (" + r.error + u")";
    return false;
  }
  error = u"[host] import_as_json not found: " +
          (urls.empty() ? std::u16string(u"(no url)") : urls.front());
  return false;
}

bool HeadlessHost::import_as_text(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                                  std::u16string& error) {
  for (const std::u16string& url : urls) {
    const std::filesystem::path path = resolve(url);
    if (path.empty()) continue;
    std::string raw;
    if (!read_file(path, raw, error)) return false;
    data = Value(as_u16(raw));
    hit = Value(url);
    return true;
  }
  error = u"[host] import_as_text not found: " +
          (urls.empty() ? std::u16string(u"(no url)") : urls.front());
  return false;
}

bool HeadlessHost::import_as_blob_url(const std::vector<std::u16string>& urls, Value& data,
                                      Value& hit, std::u16string& error) {
  for (const std::u16string& url : urls) {
    const std::filesystem::path path = resolve(url);
    if (path.empty()) continue;
    // TS 给的是 blob URL 字符串；宿主没有 blob 层 ⇒ 给相对条目名（消费者只把它当标识）。
    data = Value(url);
    hit = Value(url);
    return true;
  }
  error = u"[host] import_as_blob_url not found: " +
          (urls.empty() ? std::u16string(u"(no url)") : urls.front());
  return false;
}

bool HeadlessHost::import_as_array_buffer(const std::vector<std::u16string>& urls, Value& data,
                                          Value& hit, std::u16string& error) {
  for (const std::u16string& url : urls) {
    const std::filesystem::path path = resolve(url);
    if (path.empty()) continue;
    std::string raw;
    if (!read_file(path, raw, error)) return false;
    auto arr = std::make_shared<Array>();
    for (const unsigned char c : raw) arr->push_back(Value(static_cast<double>(c)));
    data = Value(std::move(arr));
    hit = Value(url);
    return true;
  }
  error = u"[host] import_as_array_buffer not found: " +
          (urls.empty() ? std::u16string(u"(no url)") : urls.front());
  return false;
}

bool HeadlessHost::import_as_image_bitmap(const std::vector<std::u16string>& urls, Value& data,
                                          Value& hit, std::u16string& error) {
  (void)data;
  (void)hit;
  error = u"[host] import_as_image_bitmap: no bitmap decoder in the headless host: " +
          (urls.empty() ? std::u16string(u"(no url)") : urls.front());
  return false;
}

bool HeadlessHost::xml_parse(const Value& text, Value& marker, std::shared_ptr<IXMLElement>& root,
                             std::u16string& error) {
  const std::u16string* const s = as_str(text);
  if (s == nullptr) {
    error = u"[host] xml_parse: text should be string, but got " + to_string(text);
    return false;
  }
  root = _xml.parse(*s);
  if (root == nullptr) {
    // TS：`const root = I.Ditto.XML.parse(text); if (!root) throw ...`。
    error = u"failed to parse xml text (no root element)";
    return false;
  }
  // `marker` 顶 TS 的 `root` 真值：`Resources::import_xml` 判它假值就报「failed to parse」。
  marker = Value(true);
  return true;
}

void HeadlessHost::lang_apply(LFW& lfw, const std::u16string& lang, const std::u16string&) {
  // TS 在这一步还会遍历 UI 节点把 `text` 重新度量。headless 不做渲染 ⇒ 只切 i18n 的语言表，
  // 节点文本停在旧语言（记 README 偏差表）。
  std::u16string ignored;
  lfw.i18n().set_lang(Value(lang), ignored);
}

Value HeadlessHost::zip_get_stored(const std::u16string& zip_url, const std::u16string& md5) {
  // `get_stored_download(url, md5)` 的内存版（TS 走 OPFS/IndexedDB 的 partial store）：
  // 键是 `download_key(url)` = `md5("lfw-partial:" + url)`；meta 的 md5 对不上就丢弃并回 null。
  const std::string key = md5_hex("lfw-partial:" + to_utf8(zip_url));
  const auto it = _stored.find(key);
  if (it == _stored.end()) return Value();
  const Blob* const blob = blob_of(Value(it->second));
  if (blob == nullptr) return Value();
  if (!md5.empty() && blob->md5 != md5) {
    _stored.erase(it);
    return Value();
  }
  return Value(it->second);
}

std::string HeadlessHost::blob_token(const Blob& blob) {
  _blobs[to_utf8(blob.token)] = blob;
  return to_utf8(blob.token);
}

const HeadlessHost::Blob* HeadlessHost::blob_of(const Value& blob) const {
  const std::u16string* const token = as_str(blob);
  if (token == nullptr) return nullptr;
  const auto it = _blobs.find(to_utf8(*token));
  return it == _blobs.end() ? nullptr : &it->second;
}

bool HeadlessHost::zip_read_blob(const std::u16string& name, const Value& blob, const Value& md5,
                                 IZip*& out, std::u16string& error) {
  const Blob* const bytes = blob_of(blob);
  if (bytes == nullptr) {
    error = u"[host] zip_read_blob: unknown blob: " + name;
    return false;
  }
  // TS `read_blob(name, blob, md5?)`：`md5 ?? ""` —— 不是字符串就当空串（⇒ `zip.md5()` 给空）。
  const std::u16string* const given = as_str(md5);
  std::unique_ptr<ZipFile> zip;
  if (!ZipFile::open(name, bytes->bytes, given != nullptr ? *given : std::u16string(), zip, error)) {
    return false;
  }
  _zip_objs.push_back(std::move(zip));
  out = _zip_objs.back().get();
  return true;
}

bool HeadlessHost::zip_read_buf(const std::u16string& name, const Value& data, IZip*& out,
                                std::u16string& error) {
  // TS `read_buf(name, buf)`：md5 按字节算（`md5_buf`）。
  const Array* const arr = as_array(data);
  if (arr == nullptr) {
    error = u"[host] zip_read_buf: data should be a byte array: " + name;
    return false;
  }
  std::vector<uint8_t> bytes;
  bytes.reserve(arr->size());
  for (size_t i = 0; i < arr->size(); ++i) {
    bytes.push_back(static_cast<uint8_t>(static_cast<int>(to_number(arr->at(i))) & 0xff));
  }
  std::unique_ptr<ZipFile> zip;
  if (!ZipFile::open(name, std::move(bytes), std::nullopt, zip, error)) return false;
  _zip_objs.push_back(std::move(zip));
  out = _zip_objs.back().get();
  return true;
}

bool HeadlessHost::zip_download(const std::u16string& zip_url, const Value& md5, LFW& lfw,
                                DownloadedZip& out, std::u16string& error) {
  // `Zip.download(url, on_progress, opts)`：宿主侧没有网络 ⇒ 数据包本来就是本地文件
  // （`--root` 下按 URL 找，`?time=` / `?md5=` 那一尾巴与磁盘名无关）。md5 校验照 TS 的
  // `download_resumable` 做：给了 md5 就必须对上，不然报 `md5 mismatch`。
  const std::filesystem::path path = resolve(zip_url);
  if (path.empty()) {
    error = u"[host] zip_download: file not found: " + zip_url;
    return false;
  }
  std::string raw;
  if (!read_file(path, raw, error)) return false;
  std::vector<uint8_t> bytes(raw.begin(), raw.end());
  const std::string actual = md5_hex(bytes.data(), bytes.size());
  const std::u16string* const want = as_str(md5);
  if (want != nullptr && !want->empty() && *want != as_u16(actual)) {
    error = u"[host] zip_download: md5 mismatch: " + zip_url;
    return false;
  }
  Blob blob;
  _blob_seq += 1;
  blob.token = u"blob:" + as_u16(std::to_string(_blob_seq));
  blob.md5 = as_u16(actual);
  blob.bytes = std::move(bytes);
  const std::string key = md5_hex("lfw-partial:" + to_utf8(zip_url));
  (void)blob_token(blob);
  _stored[key] = blob.token;
  // `on_progress(100, size)`（TS 下载完成那一刻）。
  lfw.on_loading_file(zip_url, 100.0, static_cast<double>(blob.bytes.size()));
  out.stored = false;
  out.blob = Value(blob.token);
  out.md5 = Value(blob.md5);
  return true;
}

Value HeadlessHost::zip_cache_get(const std::u16string& name) {
  const auto it = _zip_cache.find(name);
  return it == _zip_cache.end() ? Value() : it->second;
}

void HeadlessHost::zip_cache_del(const std::u16string& name, const std::u16string&) {
  _zip_cache.erase(name);
}

void HeadlessHost::zip_cache_put(const Value& entry) {
  const std::u16string* const name = as_str(field_or(entry, u"name"));
  if (name == nullptr) return;
  _zip_cache[*name] = entry;
}

}
