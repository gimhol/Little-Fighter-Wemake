#pragma once

#include <cstdint>
#include <filesystem>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "host/common/ui_input_handle.h"
#include "host/common/zip_file.h"
#include "lfw/base/clock.h"
#include "lfw/ditto/xml/tool_xml.h"
#include "lfw/lfw.h"
#include "lfw/world.h"

namespace lfw::host {

// 手动时钟：时间由 app 推进（`advance`）。`add` 注册的回调**不实现**（返回 0 = 没有句柄）
// ⇒ `Ticker` 自己不会走，帧由 app 显式 `World::update_once(dt)` 推 —— 可复现，也不依赖
// 平台的 requestAnimationFrame / setInterval。
class ManualClock : public IClock {
 public:
  double now() const override { return _t; }
  int add(std::function<void()>) override { return 0; }
  void del(int) override {}
  bool hidden() const override { return false; }
  void advance(double dt) { _t += dt; }
  void set(double t) { _t = t; }

 private:
  double _t = 0;
};

class NoopTimeout : public ITimeout {
 public:
  int add(std::function<void()>, double) override { return 0; }
  void del(int) override {}
};

// `Ditto.WorldRender` 那一面：headless 不做任何绘制，但实体进出世界时要记账（便于统计）。
class NullWorldRenderer : public IWorldRenderer {
 public:
  void add_entity(Entity&) override { ++added; }
  void del_entity(Entity&) override { ++removed; }
  void render(double) override { ++renders; }
  void dispose() override {}

  long long added = 0;
  long long removed = 0;
  long long renders = 0;
};

// headless 宿主：`ILfwHost` 的最小可用实现。
//   * 资源读盘：`--root` 下的目录树（`builtin_data/...`）与数据包 —— `--zip` 给的「已解包包」目录
//     与**真 `.zip` 本体**（`host/common/zip_file.{h,cpp}`：中央目录 + stored/deflate）都在；
//   * 渲染 / 音频 / 指针 / UI 图片：空实现（会计数，结束后打印一行统计）；
//   * 存档（`Ditto.Cache` / `Zip.get_stored`）：内存态，进程退出即丢；
//   * `md5`：真 MD5（RFC 1321，与 `DittoImpl/md5.ts` 的 SparkMD5 逐位一致）。
class HeadlessHost : public ILfwHost {
 public:
  HeadlessHost(std::vector<std::filesystem::path> roots, bool dev);

  ManualClock& clock() { return _clock; }
  NoopTimeout& timeout() { return _timeout; }
  NullWorldRenderer& renderer() { return _renderer; }

  // 未实现/被忽略的宿主面计数（结束时的统计行）。
  long long ignored_images() const { return _ignored_images; }
  int warn_count() const { return _warns; }
  int error_count() const { return _errors; }
  const std::vector<std::u16string>& last_errors() const { return _last_errors; }

  // `--root` 里第一个真的存在的文件（给 import_as_* 与宿主自己的诊断用）。
  // 按 TS `Importer.get_possible_url_list` 的口径找两档：先按原样，再补 `builtin_data/` 前缀。
  std::filesystem::path resolve(const std::u16string& path) const;

  // ---- ILfwHost ----
  void sounds_init(LFW&) override {}
  void images_init(LFW&) override {}
  void keyboard_init(LFW&) override {}
  void pointings_init(LFW&) override {}
  // `this.keyboard.callback.add(this)`（`lfw.cpp:226`）：**LFW 自己也在这张表里** —— 键盘事件
  // 经 `LFW::on_key_down` 才能变成 `KEY_EVENT` 命令。原先这里是空实现（键盘没接线 ⇒ 没人注册）。
  void keyboard_add_callback(LFW& lfw) override { keyboard_callback_add(lfw, &lfw); }
  // `this.pointings.callback.add(new I.Ditto.UIInputHandle(this))`（`lfw.cpp:249`）：注册本宿主的
  // `UiInputHandle`（引擎无关的命中测试 + `POINTER_*` 命令），从此指针事件才真的进 UI。
  void pointings_add_ui_input(LFW&) override;
  void keyboard_callback_add(LFW&, LfwKeyboardCallback* cb) override;
  void keyboard_callback_del(LFW&, LfwKeyboardCallback* cb) override;
  void pointings_callback_add(LFW&, LfwPointingsCallback* cb) override;
  void pointings_callback_del(LFW&, LfwPointingsCallback* cb) override;
  // `this.pointings.grab(who)` / `.ungrab(who)` / `.grabbing`（TS `DittoImpl.__Pointings`：
  // 世代 + 持有者语义，「指针按下」抬一代）。
  bool pointings_grab(LFW& lfw, const void* who) override;
  void pointings_ungrab(LFW& lfw, const void* who) override;
  const void* pointings_grabbing(LFW& lfw) override;
  void cache_forget(const std::u16string& type, double version) override;
  void zip_forget_stored(const std::u16string& type, double version) override;
  IWorldRenderer* create_world_renderer(LFW&) override { return &_renderer; }
  void load_img(const std::u16string& path) override;
  bool ui_image_load(const std::u16string& img_key, const Value& path, const Value& ops, Value& out,
                     std::u16string& error) override;
  void ui_image_pin(const std::u16string& img_key) override;
  std::u16string md5(const std::u16string& text) override;
  bool dev() const override { return _dev; }
  double now() override { return _clock.now(); }
  void warn(const std::vector<Value>& args) override;
  void error(const std::vector<Value>& args) override;
  void log(const std::vector<Value>& args) override;
  void debug_msg(const std::vector<Value>& args) override;
  std::function<void()> sounds_play_bgm(const Value& music) override;
  void sounds_stop_bgm() override {}
  void sounds_play(const Value& path, const Value& x, const Value& y, const Value& z) override;
  void sounds_play_preset(const Value& name, const Value& x, const Value& y,
                          const Value& z) override;
  void sounds_play_with_load(const Value& path) override;
  void sounds_load(const Value& name, const Value& src) override;
  std::u16string sounds_bgm() override { return _bgm; }
  bool sounds_is_random() override { return _bgm_random; }
  double sounds_volume() override { return _volume; }
  void sounds_set_volume(double v) override { _volume = v; }
  double sounds_bgm_volume() override { return _bgm_volume; }
  void sounds_set_bgm_volume(double v) override { _bgm_volume = v; }
  double sounds_sound_volume() override { return _sound_volume; }
  void sounds_set_sound_volume(double v) override { _sound_volume = v; }
  bool sounds_bgm_muted() override { return _bgm_muted; }
  void sounds_set_bgm_muted(bool v) override { _bgm_muted = v; }
  bool sounds_sound_muted() override { return _sound_muted; }
  void sounds_set_sound_muted(bool v) override { _sound_muted = v; }
  void sounds_callback_add(LFW&, LfwSoundsCallback* cb) override;
  void sounds_callback_del(LFW&, LfwSoundsCallback* cb) override;
  void sounds_dispose() override {}
  void keyboard_dispose() override {}
  // `__Pointings.dispose()`：清回调表 + 复位抓取（句柄本身留在宿主手里，只是被摘出回调表）。
  void pointings_dispose() override;
  Value measure_text(const Value& text, const Value& style) override;
  void player_cache_get(const std::u16string& name, PlayerInfoCacheEntry& out) override;
  bool player_cache_del(const std::u16string& name, std::u16string& error) override;
  void player_cache_put(const PlayerInfoCachePut& data) override;
  bool import_as_json(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                      std::u16string& error) override;
  bool import_as_blob_url(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                          std::u16string& error) override;
  bool import_as_array_buffer(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                              std::u16string& error) override;
  bool import_as_image_bitmap(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                              std::u16string& error) override;
  bool import_as_text(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                      std::u16string& error) override;
  bool xml_parse(const Value& text, Value& marker, std::shared_ptr<IXMLElement>& root,
                 std::u16string& error) override;
  void lang_apply(LFW& lfw, const std::u16string& lang, const std::u16string& prev) override;
  Value zip_get_stored(const std::u16string& zip_url, const std::u16string& md5) override;
  bool zip_read_blob(const std::u16string& name, const Value& blob, const Value& md5, IZip*& out,
                     std::u16string& error) override;
  bool zip_read_buf(const std::u16string& name, const Value& data, IZip*& out,
                    std::u16string& error) override;
  bool zip_download(const std::u16string& zip_url, const Value& md5, LFW& lfw, DownloadedZip& out,
                    std::u16string& error) override;
  Value zip_cache_get(const std::u16string& name) override;
  void zip_cache_del(const std::u16string& name, const std::u16string& version) override;
  void zip_cache_put(const Value& entry) override;

  // 按键 / 指针的回调列表（app 可以喂事件；M1 只用来保证注册/注销不成漏）。
  void emit_key_down(LfwKeyEvent& e);
  void emit_key_up(LfwKeyEvent& e);

  // ---- 键盘注入（平台侧那一半：Godot 的 `_input` / `lfw_run --key*`）----
  // 镜像 `src/DittoImpl/Keyboard.ts` 的 `__Keyboard.key_down/key_up`：
  //   * `key` 是**小写**的 `KeyboardEvent.key`（TS 入口就 `.toLowerCase()`，LFW 再判一次）；
  //   * `times` 是「同一个键这次按下是第几次」——**第一次是 0**（第一次之后的重复按下递增），抬起固定 0。
  //     这个 0 是有意义的：`LFW::on_key_down` 只在 `times == 0` 时把这次按下翻成 `KEY_EVENT`。
  // `device_type` 是 `"keyboard" | "controller" | "touch"`（走 `LFW::on_key_down` 的
  // `keyboard_detected` / `controller_detected` 分支）。
  void key_down(const std::u16string& key, const std::u16string& device_type = u"keyboard");
  void key_up(const std::u16string& key, const std::u16string& device_type = u"keyboard");
  // 当前按下的键 → 已按次数（TS 的 `__Keyboard._times_map`；诊断用）。
  const std::map<std::u16string, int>& pressed_keys() const { return _key_times; }

  // ---- 指针注入（app 侧：Godot 的 `_input` / `lfw_run --click`）----
  // 每条都分发给已注册的 `LfwPointingsCallback`（快照迭代：回调里注销自己也不会踩迭代器）。
  // `emit_pointer_down` 会像平台那样先抬一代抓取世代（`__Pointings._on_pointer_down`）。
  void emit_pointer_down(LfwPointingEvent& e);
  void emit_pointer_move(LfwPointingEvent& e);
  void emit_pointer_up(LfwPointingEvent& e);
  void emit_pointer_cancel(LfwPointingEvent& e);
  void emit_click(LfwPointingEvent& e);
  void emit_wheel(LfwPointingEvent& e);
  // ⚠ 「指针进/出画面」这条缝（`LfwPointingsCallback` 上没有）只到 UI 句柄；别的回调收不到。
  void emit_pointer_enter(LfwPointingEvent& e);
  void emit_pointer_leave(LfwPointingEvent& e);

  // 本宿主的 UI 输入句柄（`pointings_add_ui_input` 之前为空）。
  UiInputHandle* ui_input() const { return _ui_input.get(); }

  // 一次完整的点击：`x,y` 是 **UI 逻辑像素**（左上原点，与 `--pos` 同一套），内部反算
  // `scene_x/scene_y`（与 `UiInputHandle` 的换算互逆）⇒ 按下 + 抬起各推一条命令。
  void click_ui(LFW& lfw, double x, double y, double button = 0.0);

 private:
  bool read_file(const std::filesystem::path& path, std::string& out, std::u16string& error) const;

  // 宿主侧的「blob」（TS 是 `Blob` / `Uint8Array`）：端口没有二进制 `Value` ⇒ 用**令牌**
  // （`blob:<n>`）指向宿主持着的字节，`zip_read_blob` 再把令牌换回字节。令牌只在本宿主内流通
  // （`load_zip_from_url` 只对它做真值判断与回传），不泄漏给核心的其它部分。
  struct Blob {
    std::u16string token;
    std::u16string md5;
    std::vector<uint8_t> bytes;
  };
  std::string blob_token(const Blob& blob);  // 登记一个 blob，回它的令牌（UTF-8 便于放进 Value）
  const Blob* blob_of(const Value& blob) const;

  std::vector<std::filesystem::path> _roots;
  bool _dev = false;
  ManualClock _clock;
  NoopTimeout _timeout;
  NullWorldRenderer _renderer;
  ToolXML _xml;
  std::vector<LfwKeyboardCallback*> _kb_callbacks;
  std::vector<LfwPointingsCallback*> _pt_callbacks;
  std::unique_ptr<UiInputHandle> _ui_input;
  // `__Keyboard._times_map`（按下的键 → 次数）。
  std::map<std::u16string, int> _key_times;
  // 令牌 → blob；`md5("lfw-partial:" + url)` → 已完成的下载（`get_stored_download` 的内存版）。
  std::map<std::string, Blob> _blobs;
  std::map<std::string, std::u16string> _stored;
  long long _blob_seq = 0;
  // `zip_read_blob` / `zip_read_buf` 造出来的包（指针交给 `LFW`，所有权留在这里）。
  std::vector<std::unique_ptr<ZipFile>> _zip_objs;
  // TS `__Pointings` 的抓取世代（`_grab_prev_epoch` / `_grab_epoch` / `_grabbing`）。
  long long _grab_prev_epoch = -1;
  long long _grab_epoch = 0;
  const void* _grabbing = nullptr;
 protected:
  // 声音状态与回调留给子类（Godot 宿主自己接一套真实的播放后端，见 `lfw_godot_host.cpp`）。
  std::vector<LfwSoundsCallback*> _sd_callbacks;
  std::u16string _bgm;
  bool _bgm_random = false;
  bool _bgm_muted = false;
  bool _sound_muted = false;
  double _volume = 1.0;
  double _bgm_volume = 1.0;
  double _sound_volume = 1.0;

 private:
  std::map<std::u16string, PlayerInfoCachePut> _player_cache;
  std::map<std::u16string, Value> _zip_cache;
  long long _ignored_images = 0;
  int _warns = 0;
  int _errors = 0;
  int _logs = 0;
  std::vector<std::u16string> _last_errors;
};

}
