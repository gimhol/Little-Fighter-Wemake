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
}  // namespace ui

namespace stage {
class EntityItem;
}  // namespace stage

class LFW;
class IUiLayers;

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

// `UI.UILayers` 的缝（UI 层未移植）。`push()` 时宿主自己把 `on_set/on_push/on_pop` 接到
// `LFW::ui_changed(curr, prev)`（TS 里这段接线注册在 `LFW.ctor` 里那个 layer callback 上）。
class IUiLayers {
 public:
  virtual ~IUiLayers() = default;
  virtual void push() = 0;
  virtual void set_page(const Value& opts, double index) = 0;
  virtual void push_page(const Value& opts, double index) = 0;
  virtual void dispose() = 0;
  virtual ui::UINode* ui() = 0;
  // `layers.all` 里各层的 `ui`（`World::update_ui` 的倒序遍历）。
  virtual std::vector<IWorldUi*> layer_uis() = 0;
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
  // `I.Ditto.Cache.forget(type, version)` / `I.Ditto.Zip.forget_stored(type, version)`
  virtual void cache_forget(const std::u16string& type, double version) = 0;
  virtual void zip_forget_stored(const std::u16string& type, double version) = 0;
  // `regist_components()`（`ui/component/_`，未移植）
  virtual void regist_components() = 0;
  // `new Ditto.WorldRender(world)`（`World` 的渲染宿主；TS 里由 `World` 自己 new）
  virtual IWorldRenderer* create_world_renderer(LFW& lfw) = 0;
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

  // `set_lang` 的节点遍历那一半（`UINode` 未移植）。约定时序与 TS 一致：先按 `prev` 收集、
  // 再 `lfw.i18n().set_lang(lang)`、再改写节点。
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
// 宿主缝实现（`IWorldLfw` / `IStageLfw` / `IKeysLfw` / `IHelperLfw` / `IUiHelperLfw` /
// `IDatMgrHost` / `IResourcesHost` / `IPlayerInfoHost`）/ `end_testers` 编译。
// **下一刀（4AC）**：`load` / `load_data` / `load_ui` / `load_builtin_ui` / `_load_zip_*` /
// `_pick_zip_info` / `collect_data_infos` / `dispose_guard` 等加载流程。
class LFW : public IWorldLfw,
            public loader::IDatMgrHost,
            public IResourcesHost,
            public IKeysLfw,
            public helper::IHelperLfw,
            public helper::IUiHelperLfw,
            public IPlayerInfoHost {
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

  // ---- 公开字段（TS 同名；与 `IWorldLfw` 方法撞名的三个改后缀，记 README 偏差表）----
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
  IUiLayers* ui_layers() const { return _layers; }

  MersenneTwister& mt_ref() override;
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
  PlayerInfo* player(const std::u16string& player_id);
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
  std::u16string new_id() override;
  std::u16string new_team() override;
  double id_counter() const { return __id; }
  double team_counter() const { return __team; }

  void random_entity_info(Entity& e) override;
  bool is_cheat(const std::u16string& name) override;
  void set_cheat(const std::u16string& name, const std::optional<bool>& enable = std::nullopt);
  void on_key_down(LfwKeyEvent& e);
  void on_key_up(LfwKeyEvent& e);

  void dispose();
  void change_bg(const std::u16string& bg);
  void change_stage(const std::u16string& stage);
  void goto_next_stage();

  Value string(const Value& name) const;
  Value strings(const Value& name) const;

  const std::u16string& lang() const { return _i18n.lang(); }
  void set_lang(const Value& lang);
  Value canonical_lang(const std::optional<std::u16string>& lang = std::nullopt) const;

  void emit_progress(const std::u16string& content, double progress) override;
  void emit_progress_size(const std::u16string& content, double progress, const Value& size);
  void broadcast(const Value& m) override;
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
  void regist_keys(Keys& keys) override;
  void recycle_keys(Keys& keys) override;
  collision::Collision* acquire_collision();
  void recycle_collision(collision::Collision* c);

  // ---- IKeysLfw ----
  double lifetime() override;

  // ---- loader::IDatMgrHost ----
  Resources& resources() override { return *resources_; }
  void load_img(const std::u16string& path) override;
  void warn(const std::vector<Value>& args) override;
  void error(const std::vector<Value>& args) override;

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

  // ---- helper::IHelperLfw ----
  const std::vector<Entity*>& world_entities() override;
  const std::vector<Entity*>& world_ghosts() override;
  void del_entities(const std::vector<Entity*>& list) override;
  Entity* create_entity(const Value& data) override;
  controller::BaseController* create_ctrl(const Value& oid, const std::u16string& player_id,
                                          Entity* entity) override;
  const Value* find_fighter(const Value& id) override;
  const Value* find_weapon(const Value& id) override;
  const std::vector<Value>& fighters() override;
  const std::vector<Value>& weapons() override;

  // ---- helper::IUiHelperLfw ----
  void push_page(const Value& page, double stack_idx) override;
  void set_page(const Value& page, double stack_idx) override;

  // ---- IStageLfw ----
  MersenneTwister* mt() override;
  Value datas_backgrounds_find(const Value& id) override;
  Value datas_stages_find(const Value& id) override;
  bool players_has(const Value& player_id) const override;
  std::function<void()> sounds_play_bgm(const Value& music) override;
  void sounds_stop_bgm() override;
  void sounds_play(const Value& path, const Value& x, const Value& y, const Value& z) override;
  void sounds_play_with_load(const Value& path) override;
  stage::Expressions<stage::Stage>::Items end_testers(const Value& owner) override;
  bool keys_is_start(const std::u16string& key) override;
  const std::vector<std::u16string>& broadcasts_list() override { return broadcasts; }
  Value datas_find(const Value& oid) override;
  std::shared_ptr<Randoming> datas_randoming_by_group(const Value& oid) override;
  stage::IItemEntity* create_entity_with_bot(const Value& data) override;

  // ---- IWorldLfw ----
  PlayerInfo* player(const Value& player_id) override;
  Value get_random_bg(const std::vector<Value>& groups) override;
  Entity* create_entity(World& world, const Value& data) override;
  Entity* create_entity_with_player(const std::u16string& player_id, World& world,
                                    const Value& data) override;
  Entity* create_entity_with_bot(const std::u16string& player_id, World& world,
                                 const Value& data) override;
  void recycle_entity(Entity* e) override;
  void recycle_buff(buff::Buff* b) override;
  controller::BaseController* acquire_invalid_ctrl(World& world) override;
  void release_ctrl(controller::BaseController* ctrl) override;
  controller::BaseController* acquire_local_ctrl(const std::u16string& player_id,
                                                 Entity& entity) override;
  Value datas_fighters_find(const Value& oid) override;
  Value datas_weapons_of_group(const Value& group) override;
  void entities_add(const Value& data, double num) override;
  void cheat_changed(const std::u16string& cmd, bool enabled) override;
  std::vector<IWorldUi*> layer_uis() override;
  double mt_range(double min_v, double max_v) override;
  Value find_bot(const std::u16string& bot_id) const override;
  buff::Buff* create_buff(const std::u16string& kind, const std::u16string& id) override;
  controller::BaseController* create_ctrl(const std::u16string& data_id,
                                          const std::u16string& player_id) override;
  bool has_cmds() const override { return !cmds.empty(); }
  void clear_cmds() override { cmds.clear(); }
  void clear_broadcasts() override { broadcasts.clear(); }
  void ctrl_update_lookup(controller::BaseController& ctrl, double index,
                          std::vector<Entity*>& entities) override;
  bool dev() const override { return dev_mode; }
  void debug(const std::u16string& msg) override;
  bool survival_rank_mode() const override { return srank_mode; }
  bool survival_rank_available() const override { return srank_available; }
  void handle_cmds(World& world) override;
  void ctrl_come(controller::BaseController& ctrl, double x, double y, double z) override;
  void ctrl_move(controller::BaseController& ctrl) override;
  void ctrl_stay(controller::BaseController& ctrl) override;
  void ctrl_follow(controller::BaseController& ctrl, Entity& target) override;
  bool ctrl_goingto(const controller::BaseController& ctrl) const override;

  loader::DatMgr& datas() { return *datas_; }
  Resources& resources_ref() { return *resources_; }

 private:
  PlayerInfo* find_player(const std::u16string& player_id) const;

  ILfwHost* host_ = nullptr;
  IUiLayers* _layers = nullptr;
  // `this.layers = new UI.UILayers(this)`（4AQ：不再经宿主缝；本对象持有）。
  std::unique_ptr<ui::UILayers> _layers_own;
  I18N _i18n;
  MersenneTwister _mt;
  std::unique_ptr<state::States> _states;
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
  std::vector<std::unique_ptr<stage::EntityItem>> entity_items_;
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
