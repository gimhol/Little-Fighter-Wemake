#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/base/graves.h"
#include "lfw/base/no_emit_callbacks.h"
#include "lfw/collision/collision.h"
#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/ditto/zip/i_zip.h"
#include "lfw/factory.h"
#include "lfw/helper/balls_helper.h"
#include "lfw/helper/characters_helper.h"
#include "lfw/helper/entities_helper.h"
#include "lfw/helper/ui_helper.h"
#include "lfw/helper/weapons_helper.h"
#include "lfw/i18n.h"
#include "lfw/keys.h"
#include "lfw/loader/dat_mgr.h"
#include "lfw/player_info.h"
#include "lfw/resources.h"
#include "lfw/stage/expressions.h"
#include "lfw/stage/item.h"
#include "lfw/stage/stage.h"
#include "lfw/state/states.h"
#include "lfw/utils/math/mersenne_twister.h"
#include "lfw/world.h"
#include "lfw/zip_mgr.h"

namespace lfw {

namespace ui {
class UINode;
class UIComponent;
class UILayers;
class IUINodeRenderer;
}  // namespace ui

namespace stage {
}  // namespace stage

class LFW;

// TS `ILFWCallback` 的端口替身：每个回调的参数塞进这个包（同 `WorldCallbackArgs` 先例）。
struct LfwCallbackArgs {
  LFW* lfw = nullptr;
  ui::UINode* curr = nullptr;
  ui::UINode* prev = nullptr;
  std::u16string text;
  std::u16string prev_text;
  Value value;
  Value prev_value;
  double num = 0.0;
  double num2 = 0.0;
  bool has_num2 = false;
  bool flag = false;
  std::vector<IZip*> zips;
  std::vector<Value> infos;
  PlayerInfo* player = nullptr;
  ui::UIComponent* component = nullptr;
};
using LfwCallbacks = CallbacksT<LfwCallbackArgs>;

// TS `IKeyEvent`（`ditto/keyboard/IKeyEvent.ts`）在 LFW 里用到的那一面。
struct LfwKeyEvent {
  std::u16string key;
  double times = 0.0;
  std::u16string device_type;
  bool interrupted = false;
  void interrupt() { interrupted = true; }
};

// TS `IKeyboardCallback`（`ditto/keyboard/IKeyboardCallback.ts`）：注册进 `keyboard.callback`
// 的对象（LFW 自己也在列表里——ctor 的 `keyboard.callback.add(this)`，接口方法 LFW 已实现）。
struct LfwKeyboardCallback {
  virtual ~LfwKeyboardCallback() = default;
  virtual void on_key_down(LfwKeyEvent& e) { (void)e; }
  virtual void on_key_up(LfwKeyEvent& e) { (void)e; }
};

// TS `IPointingEvent`（`ditto/pointings/IPointingEvent.ts`）在 LFW 里用到的那一面。
struct LfwPointingEvent {
  double x = 0.0;
  double y = 0.0;
  double scene_x = 0.0;
  double scene_y = 0.0;
  double button = -1.0;
  double delta_x = 0.0;
  double delta_y = 0.0;
};

// TS `IPointingsCallback`（`ditto/pointings/IPointingsCallback.ts`）在 LFW 里用到的那一面。
struct LfwPointingsCallback {
  virtual ~LfwPointingsCallback() = default;
  virtual void on_click(LfwPointingEvent& e) { (void)e; }
  virtual void on_pointer_down(LfwPointingEvent& e) { (void)e; }
  virtual void on_pointer_move(LfwPointingEvent& e) { (void)e; }
  virtual void on_pointer_up(LfwPointingEvent& e) { (void)e; }
  virtual void on_pointer_cancel(LfwPointingEvent& e) { (void)e; }
  // `on_wheel`（滚轮；`delta_x/delta_y` 已由平台换算为 UI 像素）。
  virtual void on_wheel(LfwPointingEvent& e) { (void)e; }
};

// TS `ISoundsCallback`（`ditto/sounds/ISoundsCallback.ts`）在 LFW 里用到的那一面。
// `on_bgm_changed(bgm, prev, mgr)` 的第三个参数是平台对象，端口省掉；`null` 用空串。
struct LfwSoundsCallback {
  virtual ~LfwSoundsCallback() = default;
  virtual void on_bgm_changed(const std::u16string& bgm, const std::u16string& prev) {
    (void)bgm;
    (void)prev;
  }
  // 4BR：`ISoundsCallback` 的音量/静音族（`mgr` 参数省掉，同 `on_bgm_changed`）。
  virtual void on_volume_changed(double volume, double prev) {
    (void)volume;
    (void)prev;
  }
  virtual void on_bgm_volume_changed(double volume, double prev) {
    (void)volume;
    (void)prev;
  }
  virtual void on_sound_volume_changed(double volume, double prev) {
    (void)volume;
    (void)prev;
  }
  virtual void on_bgm_muted_changed(bool muted) { (void)muted; }
  virtual void on_sound_muted_changed(bool muted) { (void)muted; }
};

// TS 的 `I.Ditto`（宿主平台包）在 LFW 里用到的那一面。方法注释逐一对应一条 TS 表达式。
class ILfwHost {
 public:
  virtual ~ILfwHost() = default;

  // `new I.Ditto.Sounds(this)` / `ImageMgr(this)` / `Keyboard(this)` / `Pointings()`
  virtual void sounds_init(LFW& lfw) = 0;
  virtual void images_init(LFW& lfw) = 0;
  virtual void keyboard_init(LFW& lfw) = 0;
  virtual void pointings_init(LFW& lfw) = 0;
  // `this.keyboard.callback.add(this)`（宿主在键盘事件里调 `lfw.on_key_down/on_key_up`）
  virtual void keyboard_add_callback(LFW& lfw) = 0;
  // `this.pointings.callback.add(new I.Ditto.UIInputHandle(this))`
  virtual void pointings_add_ui_input(LFW& lfw) = 0;
  // `this.keyboard.callback.add(cb)` / `.del(cb)`（组件注册键盘回调；LFW 自己的那份走
  // `keyboard_add_callback`）
  virtual void keyboard_callback_add(LFW& lfw, LfwKeyboardCallback* cb) = 0;
  virtual void keyboard_callback_del(LFW& lfw, LfwKeyboardCallback* cb) = 0;
  // `this.pointings.callback.add(cb)` / `.del(cb)`
  virtual void pointings_callback_add(LFW& lfw, LfwPointingsCallback* cb) = 0;
  virtual void pointings_callback_del(LFW& lfw, LfwPointingsCallback* cb) = 0;
  // `lfw.pointings.grab(who)` / `.ungrab(who)`（抢焦点语义在平台侧，TS 实现见 `DittoImpl.__Pointings`）。
  // 未接入指针的宿主可忽略（组件只会忽略返回值）。
  virtual bool pointings_grab(LFW& lfw, const void* who) {
    (void)lfw;
    (void)who;
    return false;
  }
  virtual void pointings_ungrab(LFW& lfw, const void* who) {
    (void)lfw;
    (void)who;
  }
  // `this.pointings.grabbing`（当前持有指针者；世代不符/无人持有时为 nullptr）。
  virtual const void* pointings_grabbing(LFW& lfw) {
    (void)lfw;
    return nullptr;
  }
  // `I.Ditto.IsDesktop`（只有启动页用它：桌面端隐藏操作提示）。
  virtual bool is_desktop() const { return false; }
  // `I.Ditto.Cache.forget(type, version)` / `I.Ditto.Zip.forget_stored(type, version)`
  virtual void cache_forget(const std::u16string& type, double version) = 0;
  virtual void zip_forget_stored(const std::u16string& type, double version) = 0;
  // `new Ditto.WorldRender(world)`（`World` 的渲染宿主；TS 里由 `World` 自己 new）
  virtual IWorldRenderer* create_world_renderer(LFW& lfw) = 0;
  // `new Ditto.UINodeRenderer(node)`（每个 UINode 一个；渲染未移植 ⇒ 可给假实现或 nullptr）。
  virtual ui::IUINodeRenderer* create_ui_node_renderer(ui::UINode& node) {
    (void)node;
    return nullptr;
  }
  // `await lfw.images.load_img(path, path)`（D DatMgr 的 `images.load_img`）
  virtual void load_img(const std::u16string& path) = 0;

  // `await lfw.images.load_img(img_key, path, ops)`（UI 图片：`ops` 是 `ImageOperation[]`）；
  // 失败 ⇒ `false` + `error`（TS 的 Promise 拒绝）。
  virtual bool ui_image_load(const std::u16string& img_key, const Value& path, const Value& ops,
                             Value& out, std::u16string& error) = 0;
  // `lfw.images.pin(img_key)`
  virtual void ui_image_pin(const std::u16string& img_key) = 0;
  // `Ditto.MD5(text)`（`ui_load_img` 拼 key 用；MersenneTwister 不碰）
  virtual std::u16string md5(const std::u16string& text) = 0;

  // `Ditto.DEV` / `Ditto.warn/error/Log/debug`
  virtual bool dev() const = 0;
  // `Date.now()`（`new MersenneTwister(Date.now())`）
  virtual double now() = 0;
  virtual void warn(const std::vector<Value>& args) = 0;
  // TS 里从 promise 的 catch 里发出的告警（`UIImgLoader` 的 `.catch`）：到微任务才落地，
  // 差分台面把它跟 `img:pin` 一起排队到 flush 点；缺省仍立即打。
  virtual void warn_async(const std::vector<Value>& args) { warn(args); }
  virtual void error(const std::vector<Value>& args) = 0;
  virtual void log(const std::vector<Value>& args) = 0;
  virtual void debug_msg(const std::vector<Value>& args) = 0;

  // `lfw.sounds.*`
  virtual std::function<void()> sounds_play_bgm(const Value& music) = 0;
  virtual void sounds_stop_bgm() = 0;
  virtual void sounds_play(const Value& path, const Value& x, const Value& y, const Value& z) = 0;
  // `lfw.sounds.play_preset(name, x?, y?, z?)`（预置音效表在宿主，未移植）
  virtual void sounds_play_preset(const Value& name, const Value& x, const Value& y,
                                  const Value& z) = 0;
  virtual void sounds_play_with_load(const Value& path) = 0;
  // `lfw.sounds.load(name, src)`（启动页预载 093；`Sounds._sounds` 缓存/去重属平台侧）。
  virtual void sounds_load(const Value& name, const Value& src) = 0;
  // `lfw.sounds.bgm()`（`null` ⇒ 空串）/ `lfw.sounds.is_random`
  virtual std::u16string sounds_bgm() = 0;
  virtual bool sounds_is_random() = 0;
  // 4BR：`lfw.sounds.volume()` / `.bgm_volume()` / `.sound_volume()` 与各自 setter
  //（宿主照平台 `__Modern` 语义：clamp 0..1、同值早退、变更后发 `on_*_volume_changed`）。
  virtual double sounds_volume() = 0;
  virtual void sounds_set_volume(double v) = 0;
  virtual double sounds_bgm_volume() = 0;
  virtual void sounds_set_bgm_volume(double v) = 0;
  virtual double sounds_sound_volume() = 0;
  virtual void sounds_set_sound_volume(double v) = 0;
  // `lfw.sounds.bgm_muted()` / `.sound_muted()` 与各自 setter（同值早退，变更后发事件）。
  virtual bool sounds_bgm_muted() = 0;
  virtual void sounds_set_bgm_muted(bool v) = 0;
  virtual bool sounds_sound_muted() = 0;
  virtual void sounds_set_sound_muted(bool v) = 0;
  // `lfw.sounds.callbacks.add(cb)` / `.del(cb)`
  virtual void sounds_callback_add(LFW& lfw, LfwSoundsCallback* cb) = 0;
  virtual void sounds_callback_del(LFW& lfw, LfwSoundsCallback* cb) = 0;
  // `lfw.sounds.dispose` / `lfw.keyboard.dispose` / `lfw.pointings.dispose`
  virtual void sounds_dispose() = 0;
  virtual void keyboard_dispose() = 0;
  virtual void pointings_dispose() = 0;

  // `lfw.images.measure_text(text, style)`（`set_lang` 用）
  virtual Value measure_text(const Value& text, const Value& style) = 0;

  // `Ditto.Cache`（`PlayerInfo` 的宿主面）
  virtual void player_cache_get(const std::u16string& name, PlayerInfoCacheEntry& out) = 0;
  virtual bool player_cache_del(const std::u16string& name, std::u16string& error) = 0;
  virtual void player_cache_put(const PlayerInfoCachePut& data) = 0;

  // `Ditto.Importer` / `Ditto.XML`（`Resources` 的宿主面转发用）
  virtual bool import_as_json(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                              std::u16string& error) = 0;
  virtual bool import_as_blob_url(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                                  std::u16string& error) = 0;
  virtual bool import_as_array_buffer(const std::vector<std::u16string>& urls, Value& data,
                                      Value& hit, std::u16string& error) = 0;
  virtual bool import_as_image_bitmap(const std::vector<std::u16string>& urls, Value& data,
                                      Value& hit, std::u16string& error) = 0;
  virtual bool import_as_text(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                              std::u16string& error) = 0;
  virtual bool xml_parse(const Value& text, Value& marker, std::shared_ptr<IXMLElement>& root,
                         std::u16string& error) = 0;

  // `set_lang` 的节点遍历那一半（TS 里遍历 UI 节点改写文本并按 `measure_text` 重度量；headless
  // 只切 i18n 的语言表，节点文本停在旧语言）。时序与 TS 一致：先按 `prev` 收集、再切表、再改写。
  virtual void lang_apply(LFW& lfw, const std::u16string& lang, const std::u16string& prev) = 0;

  // ---- `_load_zip_from_url` 的 IO 面（`I.Ditto.Zip` + `I.Ditto.Cache`）----
  // `await Zip.get_stored(url, md5)`（未命中 ⇒ `undefined`）。
  virtual Value zip_get_stored(const std::u16string& zip_url, const std::u16string& md5) = 0;
  // `await Zip.read_blob(name, blob, md5)` / `read_buf(name, data)`；失败 ⇒ `false` + `error`。
  virtual bool zip_read_blob(const std::u16string& name, const Value& blob, const Value& md5,
                             IZip*& out, std::u16string& error) = 0;
  virtual bool zip_read_buf(const std::u16string& name, const Value& data, IZip*& out,
                            std::u16string& error) = 0;
  // `await Zip.download(url, progress, opts)` 的解（`{stored, blob, md5}`）；下载进度由宿主
  // 回调 `lfw.on_loading_file`（TS 传的就是 `this.on_loading_file` 这个闭包）。
  struct DownloadedZip {
    bool stored = false;
    Value blob;
    Value md5;
  };
  virtual bool zip_download(const std::u16string& zip_url, const Value& md5, LFW& lfw,
                            DownloadedZip& out, std::u16string& error) = 0;
  // `await Cache.get(name)`（未命中 ⇒ `undefined`）/ `Cache.del(name, version)` / `Cache.put(entry)`。
  virtual Value zip_cache_get(const std::u16string& name) = 0;
  virtual void zip_cache_del(const std::u16string& name, const std::u16string& version) = 0;
  virtual void zip_cache_put(const Value& entry) = 0;
};

// TS `src/LFW/LFW.ts`（门面）。
//
// 本刀（4AB）范围：静态面 / 构造 / 玩家 / 按键 / 作弊码 / 命令与广播 / 语言 / 生存排行字段 /
// 宿主缝实现（`IResourcesHost` / `IPlayerInfoHost` /
// `IResourcesHost` / `IPlayerInfoHost`）/ `end_testers` 编译。
// **下一刀（4AC）**：`load` / `load_data` / `load_ui` / `load_builtin_ui` / `_load_zip_*` /
// `_pick_zip_info` / `collect_data_infos` / `dispose_guard` 等加载流程。
class LFW : public IResourcesHost,
                      public IPlayerInfoHost,
            public LfwKeyboardCallback {
 public:
  static constexpr const char* TAG = "LFW";

  // ---- 静态面 ----
  static std::u16string& VERSION_NAME();
  static const std::u16string& DATA_TYPE();
  static double DATA_VERSION();
  static Value& INFO();
  static void set_INFO(const Value* v);
  static bool IS_DEFAULT_INFO();
  struct ZipItem {
    std::u16string path;
    IZip* zip = nullptr;
    bool is_zip() const { return zip != nullptr; }
  };
  static std::vector<ZipItem>& ZIPS();
  static void set_ZIPS(std::vector<ZipItem> v);
  static std::vector<LFW*>& instances();
  static LFW* instance();
  static World* world_s();
  static helper::ObjectsHelper* objects_s();
  static helper::ObjectsHelper* entities_s();
  static helper::CharactersHelper* fighters_s();
  static helper::WeaponsHelper* weapons_s();
  static helper::BallsHelper* balls_s();
  static void IgnoreDisposed(const Value& e);

  // ---- 公开字段（TS 同名；与 `LFW` 方法撞名的三个改后缀，记 README 偏差表）----
  bool dev_mode = false;
  bool __debugging = false;
  bool toy_env = false;
  bool danmu_available = false;
  bool srank_mode = false;
  std::function<void(double)> on_survival_rank_phase;
  bool srank_available = false;
  bool survival_rank_2p = false;
  std::u16string survival_rank_period = u"all";
  Value survival_rank_data = Value(NullTag{});

  LfwCallbacks callbacks;
  Factory factory;
  std::vector<std::u16string> bgms;
  std::u16string first_page = u"init";
  std::vector<std::u16string> cmds;
  std::vector<std::u16string> broadcasts;
  std::vector<Keys*> mounted_keys;
  // TS `push_cmd(...words)`：`words.join(' ')`。
  LFW& push_cmd(const std::vector<std::u16string>& words);

  // ---- 实例面 ----
  LFW(ILfwHost& host, bool dev = false);
  ~LFW() override;

  I18N& i18n() { return _i18n; }
  ILfwHost& host() { return *host_; }
  // `this.layers`（切片 4CT / ck2：`IUiLayers` 退役 ⇒ 直接给真 `ui::UILayers`）。
  ui::UILayers* ui_layers() const { return _layers_own.get(); }

  virtual MersenneTwister& mt_ref();
  bool ui_loaded() const { return _ui_loaded; }
  bool loading() const { return _loading; }
  bool playable() const { return _playable; }
  bool disposed() const { return _disposed; }
  bool need_load() const { return !_playable && !_loading; }

  // ---- 加载流程（4AC）----
  // TS `ILoadedZip` + `IDataInfo` 的按值端口（`ZipMgr` 要指针 ⇒ 见 `_owned_infos`）。
  struct LoadedZip {
    IZip* zip = nullptr;
    IDataInfo info;
  };
  static std::vector<IDataInfo> collect_data_infos();
  // `this.on_loading_file(url, progress, full_size)`（宿主下载进度回调用，TS 里是私有方法）。
  void on_loading_file(const std::u16string& url, double progress, double full_size);
  bool load(const std::vector<ZipItem>& arg1, std::u16string& error);
  bool load_data(const LoadedZip& z, std::u16string& error);
  bool load_ui(IZip& zip, std::vector<Value>& out, std::u16string& error);
  bool load_builtin_ui(std::vector<Value>& out, std::u16string& error);
  bool load_zip_from_url(const std::u16string& info_url, LoadedZip& out, std::u16string& error);
  bool load_zip_from_object(IZip& zip, LoadedZip& out, std::u16string& error);
  bool pick_zip_info(IZip& zip, IDataInfo& out);
  // `dispose_guard(fn)`：未 dispose ⇒ true；已 dispose ⇒ false + `[LFW::fn] instance disposed.`。
  bool disposed_guard(const std::u16string& fn, std::u16string& error);

  Keys* keys();
  World& world() { return *world_; }
  virtual PlayerInfo* player(const std::u16string& player_id);
  // TS `lfw.players.delete(id)`（移除玩家号；队列表是插入序）。
  void players_delete(const std::u16string& player_id);
  const std::vector<std::pair<std::u16string, std::unique_ptr<PlayerInfo>>>& players() const {
    return _players;
  }
  helper::CharactersHelper& characters_helper() { return *fighters_; }
  helper::WeaponsHelper& weapons_helper() { return *weapons_; }
  helper::ObjectsHelper& entities_helper() { return *entities_; }
  helper::ObjectsHelper& objects_helper() { return *objects_; }
  helper::BallsHelper& balls_helper() { return *balls_; }
  helper::UIHelper& ui_helper() { return *uis_; }
  ZipMgr& zips() { return zips_; }

  bool set_player_bot(const std::u16string& player_id, bool bot);
  void reset_new_team();
  void reset_new_id();
  virtual std::u16string new_id();
  virtual std::u16string new_team();
  double id_counter() const { return __id; }
  double team_counter() const { return __team; }

  virtual void random_entity_info(Entity& e);
  virtual bool is_cheat(const std::u16string& name);
  void set_cheat(const std::u16string& name, const std::optional<bool>& enable = std::nullopt);
  void on_key_down(LfwKeyEvent& e) override;
  void on_key_up(LfwKeyEvent& e) override;
  // `this.keyboard.callback.add(cb)` / `.del(cb)`；`this.pointings.callback.*`（转发宿主）
  void keyboard_callback_add(LfwKeyboardCallback* cb);
  void keyboard_callback_del(LfwKeyboardCallback* cb);
  void pointings_callback_add(LfwPointingsCallback* cb);
  void pointings_callback_del(LfwPointingsCallback* cb);
  // `this.pointings.grab(who)` / `.ungrab(who)`（组件侧便捷转发；`who` 用 `this` 指针表达）。
  bool pointings_grab(const void* who);
  void pointings_ungrab(const void* who);
  // `this.pointings.grabbing`（世代不符时为 nullptr）。
  const void* pointings_grabbing();
  // `this.sounds.callbacks.add(cb)` / `.del(cb)`；`this.sounds.bgm()` / `this.sounds.is_random`
  std::u16string sounds_bgm();
  bool sounds_is_random();
  void sounds_callback_add(LfwSoundsCallback* cb);
  void sounds_callback_del(LfwSoundsCallback* cb);
  // 4BR：`this.sounds.volume()` 一族 / `this.sounds.set_volume(v)` 一族（转发宿主）。
  double sounds_volume();
  void sounds_set_volume(double v);
  double sounds_bgm_volume();
  void sounds_set_bgm_volume(double v);
  double sounds_sound_volume();
  void sounds_set_sound_volume(double v);
  bool sounds_bgm_muted();
  void sounds_set_bgm_muted(bool v);
  bool sounds_sound_muted();
  void sounds_set_sound_muted(bool v);

  void dispose();
  void change_bg(const std::u16string& bg);
  void change_stage(const std::u16string& stage);
  void goto_next_stage();

  Value string(const Value& name) const;
  Value strings(const Value& name) const;

  const std::u16string& lang() const { return _i18n.lang(); }
  void set_lang(const Value& lang);
  Value canonical_lang(const std::optional<std::u16string>& lang = std::nullopt) const;

  virtual void emit_progress(const std::u16string& content, double progress);
  void emit_progress_size(const std::u16string& content, double progress, const Value& size);
  virtual void broadcast(const Value& m);
  void on_component_broadcast(ui::UIComponent* component, const std::u16string& message);
  void switch_difficulty(double offset = 1.0);
  void update_zip_names();
  void set_survival_rank_data(const Value& data);
  bool survival_rank_cheated();
  bool survival_rank_modded();
  bool survival_rank_invalid();

  void lfw_debug(const std::u16string& func, const std::vector<Value>& args);
  void lfw_warn(const std::u16string& func, const std::vector<Value>& args);
  void lfw_log(const std::u16string& func, const std::vector<Value>& args);
  void ui_changed(ui::UINode* curr, ui::UINode* prev);

  Keys* create_keys();
  // 切片 4CW（ck9）：`IKeysLfw` 退役（真实现本来就是本类）⇒ 这三条是本类的方法，
  // `virtual` 只为台面脚本化。
  virtual void regist_keys(Keys& keys);
  virtual void recycle_keys(Keys& keys);
  collision::Collision* acquire_collision();
  void recycle_collision(collision::Collision* c);

  virtual double lifetime();

  // ---- `DatMgr` 的宿主面（4CQ：`IDatMgrHost` 退役后并入本类；`virtual` 供台面覆写）----
  virtual Resources& resources() { return *resources_; }
  virtual void load_img(const std::u16string& path);
  virtual void warn(const std::vector<Value>& args);
  virtual void error(const std::vector<Value>& args);

  // ---- IResourcesHost ----
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

  // ---- IPlayerInfoHost ----
  void cache_get(const std::u16string& name, PlayerInfoCacheEntry& out) override;
  bool cache_del(const std::u16string& name, std::u16string& error) override;
  void cache_put(const PlayerInfoCachePut& data) override;
  void warn(const std::u16string& text) override;

  // ---- helper::ObjectsHelper 要的 lfw.*（4CO：IHelperLfw 退役后并入本类）----
  virtual const std::vector<Entity*>& world_entities();
  virtual const std::vector<Entity*>& world_ghosts();
  virtual void del_entities(const std::vector<Entity*>& list);
  virtual Entity* create_entity(const Value& data);
  virtual controller::BaseController* create_ctrl(const Value& oid, const std::u16string& player_id,
                                          Entity* entity);
  virtual const Value* find_fighter(const Value& id);
  virtual const Value* find_weapon(const Value& id);
  virtual const std::vector<Value>& fighters();
  virtual const std::vector<Value>& weapons();

  // ---- helper::UIHelper 要的 lfw.layers.*（4CO：IUiHelperLfw 退役后并入本类）----
  virtual void push_page(const Value& page, double stack_idx);
  virtual void set_page(const Value& page, double stack_idx);

  // ---- `lfw.datas` / `lfw.mt` / `lfw.players` / `lfw.sounds` / `lfw.factory`（4CO：`IStageLfw` 退役后并入本类）----
  virtual MersenneTwister* mt();
  virtual Value datas_backgrounds_find(const Value& id);
  virtual Value datas_stages_find(const Value& id);
  virtual bool players_has(const Value& player_id) const;
  virtual std::function<void()> sounds_play_bgm(const Value& music);
  virtual void sounds_stop_bgm();
  virtual void sounds_play(const Value& path, const Value& x, const Value& y, const Value& z);
  virtual void sounds_play_with_load(const Value& path);
  virtual stage::Expressions<stage::Stage>::Items end_testers(const Value& owner);
  virtual bool keys_is_start(const std::u16string& key);
  virtual const std::vector<std::u16string>& broadcasts_list() { return broadcasts; }
  virtual Value datas_find(const Value& oid);
  virtual std::shared_ptr<Randoming> datas_randoming_by_group(const Value& oid);
  virtual Entity* create_entity_with_bot(const Value& data);

  // ---- `lfw.*` 的实体/世界面（4CO：`IWorldLfw` 退役后并入本类）----
  virtual PlayerInfo* player(const Value& player_id);
  virtual PlayerInfo* players_get(const Value& player_id) const;
  virtual Value get_random_bg(const std::vector<Value>& groups);
  virtual Entity* create_entity(World& world, const Value& data);
  virtual Entity* create_entity_with_player(const std::u16string& player_id, World& world,
                                    const Value& data);
  virtual Entity* create_entity_with_bot(const std::u16string& player_id, World& world,
                                 const Value& data);
  virtual void recycle_entity(Entity* e);
  virtual void recycle_buff(buff::Buff* b);
  virtual Entity* acquire_entity(const Value& type);
  virtual controller::BaseController* acquire_invalid_ctrl(World& world);
  virtual void release_ctrl(controller::BaseController* ctrl);
  virtual controller::BaseController* acquire_local_ctrl(const std::u16string& player_id,
                                                 Entity& entity);
  virtual Value datas_fighters_find(const Value& oid);
  virtual Value datas_weapons_of_group(const Value& group);
  virtual void entities_add(const Value& data, double num);
  virtual void cheat_changed(const std::u16string& cmd, bool enabled);
  // `lfw.layers.at(i)?.ui` 那一列（`World::update_ui` 倒序遍历）。
  virtual std::vector<ui::UINode*> layer_nodes();
  virtual double mt_range(double min_v, double max_v);
  virtual Value find_bot(const std::u16string& bot_id) const;
  virtual buff::Buff* create_buff(const std::u16string& kind, const std::u16string& id);
  virtual controller::BaseController* create_ctrl(const std::u16string& data_id,
                                          const std::u16string& player_id);
  virtual bool has_cmds() const { return !cmds.empty(); }
  virtual void clear_cmds() { cmds.clear(); }
  virtual void clear_broadcasts() { broadcasts.clear(); }
  virtual void ctrl_update_lookup(controller::BaseController& ctrl, double index,
                          std::vector<Entity*>& entities);
  virtual bool dev() const { return dev_mode; }
  virtual void debug(const std::u16string& msg);
  virtual bool survival_rank_mode() const { return srank_mode; }
  virtual bool survival_rank_available() const { return srank_available; }
  virtual void handle_cmds(World& world);
  virtual void ctrl_come(controller::BaseController& ctrl, double x, double y, double z);
  virtual void ctrl_move(controller::BaseController& ctrl);
  virtual void ctrl_stay(controller::BaseController& ctrl);
  virtual void ctrl_follow(controller::BaseController& ctrl, Entity& target);
  virtual bool ctrl_goingto(const controller::BaseController& ctrl) const;

  virtual loader::DatMgr& datas() { return *datas_; }
  virtual Resources& resources_ref() { return *resources_; }

 private:
  PlayerInfo* find_player(const std::u16string& player_id) const;

  ILfwHost* host_ = nullptr;
  // `this.layers = new UI.UILayers(this)`（4AQ：不再经宿主缝；本对象持有）。
  std::unique_ptr<ui::UILayers> _layers_own;
  I18N _i18n;
  MersenneTwister _mt;
  // 状态表：TS 的 `Entity` / `common_creator` 那条缺省值是**全局**的 `ENTITY_STATES`
  // （`src/LFW/state/ENTITY_STATES.ts` ⇒ 端口 `state::entity_states()`）。这里曾经造一个
  // **空表**，于是每次 `set_state` 都 miss、退化成 `States::fallback` 的兜底状态 ⇒
  // 跳/冲刺/落地/受伤这些**写在状态对象里**的逻辑全都不会跑（`CharacterState_Jump::enter`
  // 之类），只有数据帧自己带的 `dvx` 还在生效 —— 用户看到的"角色离不开地面"。
  state::States* _states = nullptr;
  std::unique_ptr<World> world_;
  ZipMgr zips_;
  std::unique_ptr<Resources> resources_;
  std::unique_ptr<loader::DatMgr> datas_;
  std::unique_ptr<helper::CharactersHelper> fighters_;
  std::unique_ptr<helper::WeaponsHelper> weapons_;
  std::unique_ptr<helper::ObjectsHelper> entities_;
  std::unique_ptr<helper::ObjectsHelper> objects_;
  std::unique_ptr<helper::BallsHelper> balls_;
  std::unique_ptr<helper::UIHelper> uis_;

  std::vector<std::pair<std::u16string, std::unique_ptr<PlayerInfo>>> _players;
  // `load_data` 里 `zips.add({zip, info})` 的 info 所有权（`ZipMgr` 存指针 ⇒ 这里给稳定地址）。
  std::vector<std::unique_ptr<IDataInfo>> _owned_infos;

  bool _disposed = false;
  bool _loading = false;
  bool _playable = false;
  bool _ui_loaded = false;
  double __id = 100;
  double __team = 8;

  std::u16string _cheat_keys;
  std::vector<std::pair<std::u16string, std::u16string>> _cheat_gkeys;
  std::vector<std::u16string> _cheat_gkeys_matchs;
  Graves<Keys*> _keys_graves;
  Graves<collision::Collision*> _collision_graves;
  Keys* _keys = nullptr;
};

}  // namespace lfw