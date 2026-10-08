#include "lfw/lfw.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "lfw/bot/bot_controller.h"
#include "lfw/buff/buff.h"
#include "lfw/buff/registry.h"
#include "lfw/cmds/cmds.h"
#include "lfw/controller/ball_controller.h"
#include "lfw/controller/creators.h"
#include "lfw/core/js_string.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/game_key.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/loader/stage_val_getters.h"
#include "lfw/stage/entity_item.h"
#include "lfw/ui/component/component_registry.h"
#include "lfw/ui/cook_ui_info.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/xml_to_ui_info.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/container_help/loop_offset.h"

namespace lfw {

namespace {

// TS 的 `DEFAULT_INFO`（`LFW._INFO` 的缺省值）。
const Value& default_info() {
  static const Value kDefault = [] {
    Object paths;
    (void)paths;
    auto arr = std::make_shared<Array>();
    arr->push_back(Value(std::u16string(u"prel.zip.json")));
    arr->push_back(Value(std::u16string(u"data.zip.json")));
    Object o;
    o.set(u"type", Value(std::u16string(u"FULL")));
    o.set(u"version", Value(0.0));
    o.set(u"title", Value(std::u16string(u"Little Fighter Wemake Origin Full Game")));
    o.set(u"description", Value(std::u16string(u"Little Fighter Wemake Origin Full Game Zip")));
    o.set(u"author", Value(std::u16string(u"Gim")));
    o.set(u"paths", Value(std::move(arr)));
    return Value(std::make_shared<Object>(o));
  }();
  return kDefault;
}

Value& info_ref() {
  static Value info = default_info();
  return info;
}

std::vector<LFW::ZipItem>& zips_ref() {
  static std::vector<LFW::ZipItem> zips = [] {
    std::vector<LFW::ZipItem> out;
    out.push_back(LFW::ZipItem{u"prel.zip.json", nullptr});
    out.push_back(LFW::ZipItem{u"data.zip.json", nullptr});
    return out;
  }();
  return zips;
}

std::vector<LFW*>& instances_ref() {
  static std::vector<LFW*> instances;
  return instances;
}

// `key_code in CMD_NAMES`：`CMD` 枚举值（含小写 `f1`… 与大写 `KILL_*` 等）的集合。
const std::vector<std::u16string>& cmd_names() {
  static const std::vector<std::u16string> kNames = {
      u"f1",    u"f2",    u"f3",    u"f4",    u"f5",    u"f6",    u"f7",    u"f8",
      u"f9",    u"f10",   u"LF2_NET", u"HERO_FT", u"GIM_INK", u"KILL_ENEMIES",
      u"KILL_BOSS", u"KILL_SOLDIERS", u"KILL_OTHERS", u"SET_PUPPET", u"DEL_PUPPET",
      u"SET_DIFFICULTY", u"DIST_CAM", u"LOCK_CAM", u"CHANGE_BG", u"CHANGE_STAGE",
      u"BGM",   u"PAUSE", u"SPAWN", u"DESPAWN", u"KILL", u"POINTER_DOWN", u"POINTER_MOVE",
      u"POINTER_UP", u"POINTER_CANCEL", u"POINTER_LEAVE", u"POINTER_ENTER",
      u"POINTER_CLICK", u"KEY_EVENT"};
  return kNames;
}

bool is_cmd_name(const std::u16string& key_code) {
  for (const std::u16string& n : cmd_names()) {
    if (n == key_code) return true;
  }
  return false;
}

// `String.prototype.startsWith`（空前缀恒真、长度不足恒假）。
bool js_starts_with(const std::u16string& s, const std::u16string& prefix) {
  if (prefix.size() > s.size()) return false;
  for (size_t i = 0; i < prefix.size(); ++i) {
    if (s[i] != prefix[i]) return false;
  }
  return true;
}

const std::u16string* as_str(const Value& v) { return std::get_if<std::u16string>(&v); }

std::u16string js_to_lower(const std::u16string& s) { return to_lower_case(s); }

// `Expressions<Stage>` 的元素：`new Expression(v, get_val_getter_from_stage)` 的包装。
class StageExpression : public stage::IExpression<stage::Stage> {
 public:
  explicit StageExpression(Expression<stage::Stage> e) : _e(std::move(e)) {}
  bool run(const stage::Stage& s) override { return _e.run(s); }

 private:
  Expression<stage::Stage> _e;
};

}  // namespace

std::u16string& LFW::VERSION_NAME() {
  static std::u16string name = u"v0.0.0";
  return name;
}

const std::u16string& LFW::DATA_TYPE() {
  static const std::u16string type = u"DataZip";
  return type;
}

double LFW::DATA_VERSION() {
  const Value* const v = defines::find(u"Defines.DATA_VERSION");
  return v != nullptr ? to_number(*v) : 0.0;
}

Value& LFW::INFO() { return info_ref(); }

void LFW::set_INFO(const Value* v) {
  const Value next = v != nullptr ? *v : default_info();
  if (equals(next, info_ref())) return;
  info_ref() = next;
  zips_ref().clear();
  // `this._ZIPS = this._INFO.paths`：paths 里是字符串。
  const Value* const paths = as_object(next) != nullptr ? as_object(next)->get(u"paths") : nullptr;
  if (paths != nullptr) {
    if (const Array* const arr = as_array(*paths)) {
      for (size_t i = 0; i < arr->size(); ++i) {
        const std::u16string* const s = as_str(arr->at(i));
        if (s != nullptr) zips_ref().push_back(ZipItem{*s, nullptr});
      }
    }
  }
}

bool LFW::IS_DEFAULT_INFO() {
  const Value* const has = &info_ref();
  return as_object(*has) != nullptr && equals(*has, default_info());
}

std::vector<LFW::ZipItem>& LFW::ZIPS() { return zips_ref(); }

void LFW::set_ZIPS(std::vector<ZipItem> v) {
  zips_ref() = std::move(v);
  for (LFW* const inst : instances_ref()) inst->update_zip_names();
}

std::vector<LFW*>& LFW::instances() { return instances_ref(); }

LFW* LFW::instance() { return instances_ref().empty() ? nullptr : instances_ref()[0]; }

World* LFW::world_s() {
  LFW* const inst = instance();
  return inst != nullptr ? &inst->world() : nullptr;
}

helper::ObjectsHelper* LFW::objects_s() {
  LFW* const inst = instance();
  return inst != nullptr ? &inst->objects_helper() : nullptr;
}

helper::ObjectsHelper* LFW::entities_s() {
  LFW* const inst = instance();
  return inst != nullptr ? &inst->entities_helper() : nullptr;
}

helper::CharactersHelper* LFW::fighters_s() {
  LFW* const inst = instance();
  return inst != nullptr ? &inst->characters_helper() : nullptr;
}

helper::WeaponsHelper* LFW::weapons_s() {
  LFW* const inst = instance();
  return inst != nullptr ? &inst->weapons_helper() : nullptr;
}

helper::BallsHelper* LFW::balls_s() {
  LFW* const inst = instance();
  return inst != nullptr ? &inst->balls_helper() : nullptr;
}

void LFW::IgnoreDisposed(const Value& e) {
  LFW* const inst = instance();
  if (inst != nullptr) {
    inst->host().warn({e});
  }
  const Value flag = field_or(e, u"is_disposed_error");
  if (std::holds_alternative<bool>(flag) && std::get<bool>(flag)) return;
  // TS 对非 disposed 错误会重新抛出；端口无异常 ⇒ 走宿主 error 通道（记偏差表）。
  if (inst != nullptr) {
    inst->host().error({e});
  }
}

LFW::LFW(ILfwHost& host, bool dev) : host_(&host), zips_(), _mt(host.now()) {
  dev_mode = dev;
  // `regist_components()` / `regist_buffs()`
  ui::regist_components();
  buff::regist_buffs();
  lfw_debug(u"constructor", {});

  resources_ = std::make_unique<Resources>(&zips_, this);
  datas_ = std::make_unique<loader::DatMgr>(this);
  host_->sounds_init(*this);
  host_->images_init(*this);
  host_->keyboard_init(*this);
  host_->keyboard_add_callback(*this);
  host_->pointings_init(*this);
  host_->cache_forget(DATA_TYPE(), DATA_VERSION());
  host_->cache_forget(u"PlayerInfo", PlayerInfo::kDataVersion);
  host_->zip_forget_stored(DATA_TYPE(), DATA_VERSION());

  fighters_ = std::make_unique<helper::CharactersHelper>(*this);
  weapons_ = std::make_unique<helper::WeaponsHelper>(*this);
  entities_ = std::make_unique<helper::ObjectsHelper>(*this);
  objects_ = std::make_unique<helper::ObjectsHelper>(*this);
  balls_ = std::make_unique<helper::BallsHelper>(*this);
  uis_ = std::make_unique<helper::UIHelper>(*this);

  for (const char16_t* const pid : {u"1", u"2", u"3", u"4", u"5", u"6", u"7", u"8"}) {
    const std::u16string id(pid);
    _players.push_back({id, std::make_unique<PlayerInfo>(this, id, Value(), Value(), Value())});
  }

  _states = std::make_unique<state::States>();
  world_ = std::make_unique<World>(*this, *host_->create_world_renderer(*this), _states.get());
  world_->start_update();
  world_->start_render();
  instances_ref().push_back(this);
  host_->pointings_add_ui_input(*this);
  // `this.layers = new UI.UILayers(this); this.layers.push().callback.add({...})`
  _layers_own = std::make_unique<ui::UILayers>(*this);
  _layers = _layers_own.get();
  {
    ui::UILayer& bottom = _layers_own->push_layer();
    bottom.callbacks.on_set = [this](ui::UINode* curr, ui::UINode* prev, ui::UILayer&) {
      ui_changed(curr, prev);
    };
    bottom.callbacks.on_push = [this](ui::UINode* curr, ui::UINode* prev, ui::UILayer&) {
      ui_changed(curr, prev);
    };
    bottom.callbacks.on_pop = [this](ui::UINode* curr, const std::vector<ui::UINode*>& poppeds,
                                     ui::UILayer&) {
      ui_changed(curr, poppeds.empty() ? nullptr : poppeds[0]);
    };
  }

  {
    // `this._i18n.add({'': {VERSION_NAME, DATA_LIST: ''}})`
    Object base;
    base.set(u"VERSION_NAME", Value(VERSION_NAME()));
    base.set(u"DATA_LIST", Value(std::u16string(u"")));
    Object langs;
    langs.set(u"", Value(std::make_shared<Object>(base)));
    _i18n.add(Value(std::make_shared<Object>(langs)));
  }
  update_zip_names();
}

LFW::~LFW() {
  std::vector<LFW*>& list = instances_ref();
  for (size_t i = 0; i < list.size();) {
    if (list[i] == this) list.erase(list.begin() + static_cast<std::ptrdiff_t>(i));
    else ++i;
  }
}

MersenneTwister& LFW::mt_ref() { return _mt; }

MersenneTwister* LFW::mt() { return &_mt; }

std::u16string LFW::new_id() {
  ++__id;
  return number_to_string(__id);
}

std::u16string LFW::new_team() {
  ++__team;
  return u"team_" + number_to_string(__team);
}

void LFW::reset_new_team() { __team = 8.0; }

void LFW::reset_new_id() { __id = 100.0; }

PlayerInfo* LFW::find_player(const std::u16string& player_id) const {
  for (const auto& kv : _players) {
    if (kv.first == player_id) return kv.second.get();
  }
  return nullptr;
}

PlayerInfo* LFW::player(const std::u16string& player_id) {
  PlayerInfo* ret = find_player(player_id);
  if (ret != nullptr) return ret;
  _players.push_back(
      {player_id, std::make_unique<PlayerInfo>(this, player_id, Value(), Value(), Value())});
  return _players.back().second.get();
}

PlayerInfo* LFW::player(const Value& player_id) { return player(to_string(player_id)); }

bool LFW::players_has(const Value& player_id) const {
  const std::u16string* const s = as_str(player_id);
  if (s == nullptr) return false;
  return find_player(*s) != nullptr;
}

bool LFW::set_player_bot(const std::u16string& player_id, bool bot) {
  PlayerInfo* const p = find_player(player_id);
  Entity* const fighter = p != nullptr ? p->fighter() : nullptr;
  if (fighter == nullptr) return false;
  if (bot) {
    if (fighter->ctrl() != nullptr && fighter->ctrl()->creator() == controller::bot_controller_creator()) {
      return true;
    }
    controller::BaseController* c =
        factory.create_ctrl(field_or(fighter->data(), u"id"), player_id, fighter);
    if (c == nullptr) c = controller::bot_controller_creator()->create(player_id, fighter);
    fighter->set_ctrl(c);
  } else {
    if (fighter->ctrl() != nullptr && fighter->ctrl()->is_human()) return true;
    controller::BaseController* const c =
        factory.acquire_ctrl(controller::local_controller_creator(), player_id, fighter);
    fighter->set_ctrl(c);
  }
  return true;
}

void LFW::random_entity_info(Entity& e) {
  const double l = world_->left();
  const double r = world_->right();
  const double n = world_->near_plane();
  const double f = world_->far_plane();
  e.id = new_id();
  e.facing = std::fmod(_mt.range(0.0, 100.0), 2.0) != 0.0 ? -1.0 : 1.0;
  const double x = _mt.range(l, r);
  const double z = _mt.range(f, n);
  e.position.set(x, 550.0, z);
}

bool LFW::is_cheat(const std::u16string& name) {
  if (!defines::is_cheat_type(name)) return false;
  return truthy(world_->dataset.get(name));
}

void LFW::set_cheat(const std::u16string& name, const std::optional<bool>& enable) {
  const bool cur = is_cheat(name);
  const bool en = enable.has_value() ? *enable : !cur;
  if (en == cur) return;
  push_cmd({name, en ? std::u16string(u"1") : std::u16string()});
  _cheat_keys.clear();
  _cheat_gkeys.clear();
}

void LFW::on_key_down(LfwKeyEvent& e) {
  {
    std::vector<Value> args;
    Object ev;
    ev.set(u"key", Value(e.key));
    ev.set(u"times", Value(e.times));
    ev.set(u"device_type", Value(e.device_type));
    args.push_back(Value(std::make_shared<Object>(ev)));
    lfw_debug(u"on_key_down", args);
  }
  const std::u16string key_code = js_to_lower(e.key);
  if (is_cmd_name(key_code)) {
    push_cmd({key_code});
    e.interrupt();
  }

  if (e.times == 0.0) {
    for (const char16_t* const key_name : all_game_keys()) {
      for (auto& kv : _players) {
        PlayerInfo* const player = kv.second.get();
        if (!truthy(player->local())) continue;
        const Value keys = player->keys();
        const Value cur = field_or(keys, key_name);
        const std::u16string* const cur_s = as_str(cur);
        if (cur_s == nullptr || *cur_s != key_code) continue;
        if (e.device_type == u"controller") {
          LfwCallbackArgs args;
          args.lfw = this;
          args.player = player;
          callbacks.call(u"controller_detected", {args});
        }
        if (e.device_type == u"keyboard") {
          LfwCallbackArgs args;
          args.lfw = this;
          args.player = player;
          callbacks.call(u"keyboard_detected", {args});
        }
        std::u16string* g = nullptr;
        for (auto& gkv : _cheat_gkeys) {
          if (gkv.first == kv.first) {
            g = &gkv.second;
            break;
          }
        }
        if (g == nullptr) {
          _cheat_gkeys.push_back({kv.first, std::u16string()});
          g = &_cheat_gkeys.back().second;
        }
        *g += key_name;
        push_cmd({u"KEY_EVENT", u"--p=" + kv.first, u"--s=1", u"--c=" + key_code,
                  u"--n=" + std::u16string(key_name)});
      }
    }
  }

  bool match = false;
  _cheat_gkeys_matchs.clear();
  _cheat_keys += key_code;
  const Value* const infos = defines::find(u"Defines.CheatInfos");
  if (infos != nullptr) {
    const Object* const info_obj = as_object(*infos);
    if (info_obj != nullptr) {
      for (const std::u16string& cheat_name : info_obj->keys()) {
        const Value* const cheat = info_obj->get(cheat_name);
        if (cheat == nullptr) continue;
        const Value k = field_or(*cheat, u"keys");
        const Value g = field_or(*cheat, u"gkeys");
        const std::u16string* const k_s = as_str(k);
        const std::u16string* const g_s = as_str(g);
        for (const auto& pid_gkeys : _cheat_gkeys) {
          if (g_s != nullptr && js_starts_with(*g_s, pid_gkeys.second)) {
            bool has = false;
            for (const std::u16string& m : _cheat_gkeys_matchs) {
              if (m == pid_gkeys.first) has = true;
            }
            if (!has) _cheat_gkeys_matchs.push_back(pid_gkeys.first);
          }
          if (g_s != nullptr && *g_s == pid_gkeys.second) set_cheat(cheat_name);
        }
        if (k_s != nullptr && js_starts_with(*k_s, _cheat_keys)) match = true;
        if (k_s != nullptr && *k_s == _cheat_keys) set_cheat(cheat_name);
      }
    }
  }
  {
    const std::vector<std::pair<std::u16string, std::u16string>> snapshot = _cheat_gkeys;
    for (const auto& kv : snapshot) {
      bool has = false;
      for (const std::u16string& m : _cheat_gkeys_matchs) {
        if (m == kv.first) has = true;
      }
      if (!has) {
        for (size_t i = 0; i < _cheat_gkeys.size();) {
          if (_cheat_gkeys[i].first == kv.first) {
            _cheat_gkeys.erase(_cheat_gkeys.begin() + static_cast<std::ptrdiff_t>(i));
          } else {
            ++i;
          }
        }
      }
    }
  }
  if (!match) _cheat_keys.clear();
}

void LFW::on_key_up(LfwKeyEvent& e) {
  const std::u16string key_code = e.key.empty() ? std::u16string() : js_to_lower(e.key);
  for (const char16_t* const key_name : all_game_keys()) {
    for (auto& kv : _players) {
      PlayerInfo* const player = kv.second.get();
      if (!truthy(player->local())) continue;
      const Value cur = field_or(player->keys(), key_name);
      const std::u16string* const cur_s = as_str(cur);
      if (cur_s == nullptr || *cur_s != key_code) continue;
      push_cmd({u"KEY_EVENT", u"--p=" + kv.first, u"--s=0", u"--c=" + key_code,
                u"--n=" + std::u16string(key_name)});
    }
  }
}

LFW& LFW::push_cmd(const std::vector<std::u16string>& words) {
  std::u16string joined;
  for (size_t i = 0; i < words.size(); ++i) {
    if (i != 0) joined.push_back(u' ');
    joined += words[i];
  }
  cmds.push_back(std::move(joined));
  return *this;
}

void LFW::dispose() {
  lfw_debug(u"dispose", {});
  _disposed = true;
  callbacks.call(u"on_dispose", {LfwCallbackArgs{this}});
  callbacks.clear();
  world_->dispose();
  datas_->dispose();
  host_->sounds_dispose();
  host_->keyboard_dispose();
  host_->pointings_dispose();
  _layers->dispose();
  std::vector<LFW*>& list = instances_ref();
  for (size_t i = 0; i < list.size();) {
    if (list[i] == this) list.erase(list.begin() + static_cast<std::ptrdiff_t>(i));
    else ++i;
  }
}

void LFW::change_bg(const std::u16string& bg) { world_->change_bg(Value(bg)); }

void LFW::change_stage(const std::u16string& stage) { world_->change_stage(Value(stage)); }

void LFW::goto_next_stage() {
  lfw_debug(u"goto_next_stage", {});
  Stage* stage = world_->stage();
  const Value next = stage != nullptr ? field_or(stage->data(), u"next") : Value();
  if (!truthy(next)) return;
  const std::u16string* const next_s = as_str(next);
  if (next_s != nullptr && *next_s == u"end") {
    _layers->set_page(Value(std::make_shared<Object>([] {
                       Object o;
                       o.set(u"id", Value(std::u16string(u"ending_page")));
                       return o;
                     }())),
                      0.0);
    return;
  }
  const Value* next_stage = nullptr;
  for (const Value& s : datas_->stages()) {
    if (equals(field_or(s, u"id"), next)) next_stage = &s;
  }
  if (next_stage == nullptr) {
    stage->stop_bgm();
    const Value* const pass_sound = defines::find(u"Defines.Sounds.StagePass");
    sounds_play_with_load(pass_sound != nullptr ? *pass_sound : Value());
    callbacks.call(u"on_stage_pass", {LfwCallbackArgs{this}});
  }
  if (next_stage != nullptr && truthy(field_or(*next_stage, u"is_starting"))) {
    for (Entity* const e : world_->entities) {
      if (entity::is_fighter(e->ref()) && e->ctrl() != nullptr &&
          players_has(Value(e->ctrl()->player_id))) {
        continue;
      }
      e->release();
    }
    for (Entity* const e : world_->ghosts) e->release();
  }
  const double time = stage->time();
  change_stage(next_stage != nullptr ? to_string(field_or(*next_stage, u"id")) : std::u16string());
  world_->stage()->set_time(time);
  callbacks.call(u"on_enter_next_stage", {LfwCallbackArgs{this}});
}

Value LFW::string(const Value& name) const {
  return _i18n.string(name, Value(_i18n.lang()));
}

Value LFW::strings(const Value& name) const {
  return _i18n.strings(name, Value(_i18n.lang()));
}

void LFW::set_lang(const Value& lang) {
  const std::u16string* const s = as_str(lang);
  if (s == nullptr) {
    lfw_warn(u"set_lang", {Value(u"lang should be string, but got " + to_string(lang))});
    return;
  }
  const std::u16string prev = _i18n.lang();
  if (prev == *s) return;
  host_->lang_apply(*this, *s, prev);
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = *s;
  args.prev_text = prev;
  callbacks.call(u"on_lang_changed", {args});
}

Value LFW::canonical_lang(const std::optional<std::u16string>& lang) const {
  return _i18n.canonical(Value(lang.has_value() ? *lang : _i18n.lang()));
}

void LFW::emit_progress(const std::u16string& content, double progress) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = content;
  args.num = progress;
  callbacks.call(u"on_progress", {args});
}

void LFW::emit_progress_size(const std::u16string& content, double progress, const Value& size) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = content;
  args.num = progress;
  args.num2 = to_number(size);
  args.has_num2 = true;
  callbacks.call(u"on_progress", {args});
}

void LFW::broadcast(const Value& m) {
  broadcasts.push_back(to_string(m));
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = to_string(m);
  callbacks.call(u"on_broadcast", {args});
}

void LFW::on_component_broadcast(ui::UIComponent* component, const std::u16string& message) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.component = component;
  args.text = message;
  callbacks.call(u"on_component_broadcast", {args});
}

void LFW::switch_difficulty(double offset) {
  std::vector<Value> full = {Value(1.0), Value(2.0), Value(3.0)};
  if (is_cheat(u"LF2_NET")) full.push_back(Value(4.0));
  const Value current = world_->dataset.get(u"difficulty");
  // `loop_offset(list, dataset.difficulty, offset)`：`===` 比较（Value 没有 `operator==`
  // ⇒ 这里手写一份，语义照 `utils/container_help/loop_offset.h`）。
  const size_t len = full.size();
  double idx = -1.0;
  for (size_t i = 0; i < len; ++i) {
    if (strict_equals(full[i], current)) {
      idx = static_cast<double>(i);
      break;
    }
  }
  const std::u16string next_text = [&]() -> std::u16string {
    if (len == 0) return u"undefined";
    double off = std::fmod(offset, static_cast<double>(len));
    if (off > 0.0) {
      idx = std::fmod(idx + off, static_cast<double>(len));
    } else {
      idx = std::fmod(static_cast<double>(len) + idx + off, static_cast<double>(len));
    }
    if (!(idx >= 0.0) || idx != std::floor(idx) || idx >= static_cast<double>(len)) {
      return u"undefined";
    }
    return number_to_string(to_number(full[static_cast<size_t>(idx)]));
  }();
  push_cmd({u"SET_DIFFICULTY", next_text});
}

void LFW::update_zip_names() {
  std::vector<Value> data_list;
  const std::vector<ZipItem>& zips = zips_ref();
  for (size_t i = 2; i < zips.size(); ++i) {
    data_list.push_back(Value(zips[i].is_zip() ? zips[i].zip->name() : zips[i].path));
  }
  if (!IS_DEFAULT_INFO()) {
    data_list.insert(data_list.begin(), field_or(info_ref(), u"title"));
  }
  auto arr = std::make_shared<Array>();
  for (Value& v : data_list) arr->push_back(std::move(v));
  Object base;
  base.set(u"DATA_LIST", Value(std::move(arr)));
  Object langs;
  langs.set(u"", Value(std::make_shared<Object>(base)));
  _i18n.add(Value(std::make_shared<Object>(langs)));
  callbacks.call(u"on_extra_zips_changed", {LfwCallbackArgs{this}});
}

void LFW::set_survival_rank_data(const Value& data) {
  survival_rank_data = data;
  LfwCallbackArgs args;
  args.lfw = this;
  args.value = data;
  callbacks.call(u"on_survival_rank_changed", {args});
}

bool LFW::survival_rank_cheated() {
  return is_cheat(u"LF2_NET") || is_cheat(u"HERO_FT") || is_cheat(u"GIM_INK");
}

bool LFW::survival_rank_modded() { return zips_ref().size() > 2; }

bool LFW::survival_rank_invalid() { return survival_rank_cheated() || survival_rank_modded(); }

void LFW::lfw_debug(const std::u16string& func, const std::vector<Value>& args) {
  if (!__debugging) return;
  std::vector<Value> out;
  out.push_back(Value(u"[D][LFW::" + func + u"]"));
  for (const Value& a : args) out.push_back(a);
  host_->debug_msg(out);
}

void LFW::lfw_warn(const std::u16string& func, const std::vector<Value>& args) {
  std::vector<Value> out;
  out.push_back(Value(u"[W][LFW::" + func + u"]"));
  for (const Value& a : args) out.push_back(a);
  host_->warn(out);
}

void LFW::lfw_log(const std::u16string& func, const std::vector<Value>& args) {
  std::vector<Value> out;
  out.push_back(Value(u"[I][LFW::" + func + u"]"));
  for (const Value& a : args) out.push_back(a);
  host_->log(out);
}

void LFW::ui_changed(ui::UINode* curr, ui::UINode* prev) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.curr = curr;
  args.prev = prev;
  callbacks.call(u"on_ui_changed", {args});
}

Keys* LFW::keys() {
  if (_keys == nullptr) _keys = create_keys();
  return _keys;
}

Keys* LFW::create_keys() {
  Keys* ret = nullptr;
  const std::optional<Keys*> taken = _keys_graves.take();
  ret = taken.has_value() ? *taken : new Keys(*this);
  ret->mount();
  return ret;
}

void LFW::regist_keys(Keys& keys) {
  for (Keys* const k : mounted_keys) {
    if (k == &keys) {
      lfw_warn(u"regist_keys", {Value(u"keys already registered")});
      return;
    }
  }
  mounted_keys.push_back(&keys);
}

void LFW::recycle_keys(Keys& keys) {
  // TS 用 `array_del(mounted_keys, keys)`；它其实**不删命中元素**（`i -= 1` 配合循环自增抵消，
  // 结束后 `length = i + 1` 只是截断/补齐）⇒ 照抄：重挂同一把 keys 时 `regist_keys` 会 warn。
  bool ok = false;
  {
    std::vector<Keys*>& array = mounted_keys;
    const long n = static_cast<long>(array.size());
    long i = 0;
    long j = 0;
    for (; j < n; i++, j++) {
      if (array[static_cast<size_t>(j)] == &keys) {
        i -= 1;
      } else {
        array[static_cast<size_t>(i)] = array[static_cast<size_t>(j)];
      }
    }
    const long new_len = i + 1;
    if (new_len > 0) array.resize(static_cast<size_t>(new_len), nullptr);
    ok = i != j;
  }
  if (!ok) {
    lfw_warn(u"recycle_keys", {Value(u"keys not found!")});
    return;
  }
  _keys_graves.add(&keys);
}

collision::Collision* LFW::acquire_collision() {
  const std::optional<collision::Collision*> taken = _collision_graves.take();
  return taken.has_value() ? *taken : nullptr;
}

void LFW::recycle_collision(collision::Collision* c) { _collision_graves.add(c); }

double LFW::lifetime() { return world_->lifetime(); }

void LFW::load_img(const std::u16string& path) { host_->load_img(path); }

void LFW::warn(const std::vector<Value>& args) { host_->warn(args); }

void LFW::error(const std::vector<Value>& args) { host_->error(args); }

bool LFW::import_as_json(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                         std::u16string& error) {
  return host_->import_as_json(urls, data, hit, error);
}

bool LFW::import_as_blob_url(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                             std::u16string& error) {
  return host_->import_as_blob_url(urls, data, hit, error);
}

bool LFW::import_as_array_buffer(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                                 std::u16string& error) {
  return host_->import_as_array_buffer(urls, data, hit, error);
}

bool LFW::import_as_image_bitmap(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                                 std::u16string& error) {
  return host_->import_as_image_bitmap(urls, data, hit, error);
}

bool LFW::import_as_text(const std::vector<std::u16string>& urls, Value& data, Value& hit,
                         std::u16string& error) {
  return host_->import_as_text(urls, data, hit, error);
}

bool LFW::xml_parse(const Value& text, Value& marker, std::shared_ptr<IXMLElement>& root,
                    std::u16string& error) {
  return host_->xml_parse(text, marker, root, error);
}

void LFW::cache_get(const std::u16string& name, PlayerInfoCacheEntry& out) {
  host_->player_cache_get(name, out);
}

bool LFW::cache_del(const std::u16string& name, std::u16string& error) {
  return host_->player_cache_del(name, error);
}

void LFW::cache_put(const PlayerInfoCachePut& data) { host_->player_cache_put(data); }

void LFW::warn(const std::u16string& text) {
  std::vector<Value> args;
  args.push_back(Value(text));
  host_->warn(args);
}

const std::vector<Entity*>& LFW::world_entities() { return world_->entities; }

const std::vector<Entity*>& LFW::world_ghosts() { return world_->ghosts; }

void LFW::del_entities(const std::vector<Entity*>& list) { world_->del_entities(list); }

Entity* LFW::create_entity(const Value& data) {
  return factory.create_entity(world_.get(), data, _states.get());
}

controller::BaseController* LFW::create_ctrl(const Value& oid, const std::u16string& player_id,
                                             Entity* entity) {
  return factory.create_ctrl(oid, player_id, entity);
}

const Value* LFW::find_fighter(const Value& id) { return datas_->find_fighter(id); }

const Value* LFW::find_weapon(const Value& id) { return datas_->find_weapon(id); }

const std::vector<Value>& LFW::fighters() { return datas_->fighters(); }

const std::vector<Value>& LFW::weapons() { return datas_->weapons(); }

void LFW::push_page(const Value& page, double stack_idx) { _layers->push_page(page, stack_idx); }

void LFW::set_page(const Value& page, double stack_idx) { _layers->set_page(page, stack_idx); }

Value LFW::datas_backgrounds_find(const Value& id) {
  const Value* const found = datas_->find_background(id);
  return found != nullptr ? *found : Value();
}

Value LFW::datas_stages_find(const Value& id) {
  for (const Value& s : datas_->stages()) {
    if (equals(field_or(s, u"id"), id)) return s;
  }
  return Value();
}

std::function<void()> LFW::sounds_play_bgm(const Value& music) {
  return host_->sounds_play_bgm(music);
}
void LFW::sounds_stop_bgm() { host_->sounds_stop_bgm(); }

void LFW::sounds_play(const Value& path, const Value& x, const Value& y, const Value& z) {
  host_->sounds_play(path, x, y, z);
}

void LFW::sounds_play_with_load(const Value& path) { host_->sounds_play_with_load(path); }

stage::Expressions<stage::Stage>::Items LFW::end_testers(const Value& owner) {
  stage::Expressions<stage::Stage>::Items out;
  const Value end_test = field_or(owner, u"end_test");
  const Array* const arr = as_array(end_test);
  if (arr == nullptr) return out;
  for (size_t i = 0; i < arr->size(); ++i) {
    const std::u16string* const s = as_str(arr->at(i));
    if (s == nullptr) continue;
    auto expr = std::make_unique<Expression<stage::Stage>>(*s, &loader::get_val_getter_from_stage);
    out.push_back(std::make_shared<StageExpression>(std::move(*expr)));
  }
  return out;
}

bool LFW::keys_is_start(const std::u16string& key) {
  Keys* const k = keys();
  controller::KeyStatus* const st = k->get(key);
  if (st == nullptr) return false;
  return st->is_start(k->time());
}

Value LFW::datas_find(const Value& oid) {
  const Value* const found = datas_->find(oid);
  return found != nullptr ? *found : Value();
}

std::shared_ptr<Randoming> LFW::datas_randoming_by_group(const Value& oid) {
  return datas_->get_randoming_by_group(to_string(oid));
}

stage::IItemEntity* LFW::create_entity_with_bot(const Value& data) {
  Entity* const e = factory.create_entity_with_bot(std::u16string(), world_.get(), data,
                                                   _states.get());
  if (e == nullptr) return nullptr;
  auto item = std::make_unique<stage::EntityItem>(*e);
  stage::EntityItem* const ret = item.get();
  entity_items_.push_back(std::move(item));
  return ret;
}

Value LFW::get_random_bg(const std::vector<Value>& groups) {
  std::vector<std::u16string> names;
  for (const Value& v : groups) names.push_back(to_string(v));
  return datas_->get_random_bg(names);
}

Entity* LFW::create_entity(World& world, const Value& data) {
  return factory.create_entity(&world, data, world.states());
}

Entity* LFW::create_entity_with_player(const std::u16string& player_id, World& world,
                                       const Value& data) {
  return factory.create_entity_with_player(player_id, &world, data, world.states());
}

Entity* LFW::create_entity_with_bot(const std::u16string& player_id, World& world,
                                    const Value& data) {
  return factory.create_entity_with_bot(player_id, &world, data, world.states());
}

void LFW::recycle_entity(Entity* e) { factory.recycle_entity(e); }

void LFW::recycle_buff(buff::Buff* b) { factory.recycle_buff(b); }

controller::BaseController* LFW::acquire_invalid_ctrl(World& world) {
  (void)world;
  return factory.acquire_ctrl(controller::invalid_controller_creator(), std::u16string(), nullptr);
}

void LFW::release_ctrl(controller::BaseController* ctrl) { factory.release_ctrl(ctrl); }

controller::BaseController* LFW::acquire_local_ctrl(const std::u16string& player_id,
                                                    Entity& entity) {
  return factory.acquire_ctrl(controller::local_controller_creator(), player_id, &entity);
}

Value LFW::datas_fighters_find(const Value& oid) {
  const Value* const found = datas_->find_fighter(oid);
  return found != nullptr ? *found : Value();
}

Value LFW::datas_weapons_of_group(const Value& group) {
  const std::vector<Value> list = datas_->get_weapons_of_group(to_string(group));
  auto arr = std::make_shared<Array>();
  for (const Value& v : list) arr->push_back(v);
  return Value(std::move(arr));
}

void LFW::entities_add(const Value& data, double num) { entities_->add(data, num); }

void LFW::cheat_changed(const std::u16string& cmd, bool enabled) {
  LfwCallbackArgs args;
  args.lfw = this;
  args.text = cmd;
  args.flag = enabled;
  callbacks.call(u"on_cheat_changed", {args});
}

std::vector<IWorldUi*> LFW::layer_uis() { return _layers->layer_uis(); }

double LFW::mt_range(double min_v, double max_v) { return _mt.range(min_v, max_v); }

Value LFW::find_bot(const std::u16string& bot_id) const {
  const Value* const found = datas_->find_bot(bot_id);
  return found != nullptr ? *found : Value();
}

buff::Buff* LFW::create_buff(const std::u16string& kind, const std::u16string& id) {
  return factory.create_buff(Value(kind), this, id);
}

controller::BaseController* LFW::create_ctrl(const std::u16string& data_id,
                                             const std::u16string& player_id) {
  return factory.create_ctrl(Value(data_id), player_id, nullptr);
}

void LFW::ctrl_update_lookup(controller::BaseController& ctrl, double index,
                             std::vector<Entity*>& entities) {
  std::vector<Value> vals;
  for (Entity* const e : entities) vals.push_back(e->ref());
  if (ctrl.creator() == controller::bot_controller_creator()) {
    static_cast<bot::BotController*>(&ctrl)->update_lookup(static_cast<int>(index), vals);
  } else if (ctrl.creator() == controller::ball_controller_creator()) {
    static_cast<controller::BallController*>(&ctrl)->update_lookup(static_cast<int>(index), vals);
  }
}

void LFW::debug(const std::u16string& msg) {
  std::vector<Value> args;
  args.push_back(Value(msg));
  host_->debug_msg(args);
}

void LFW::handle_cmds(World& world) { cmds::CMDS::handle(world, cmds); }

void LFW::ctrl_come(controller::BaseController& ctrl, double x, double y, double z) {
  if (ctrl.creator() == controller::bot_controller_creator()) {
    static_cast<bot::BotController*>(&ctrl)->come(x, y, z);
  }
}

void LFW::ctrl_move(controller::BaseController& ctrl) {
  if (ctrl.creator() == controller::bot_controller_creator()) {
    static_cast<bot::BotController*>(&ctrl)->move();
  }
}

void LFW::ctrl_stay(controller::BaseController& ctrl) {
  if (ctrl.creator() == controller::bot_controller_creator()) {
    static_cast<bot::BotController*>(&ctrl)->stay();
  }
}

void LFW::ctrl_follow(controller::BaseController& ctrl, Entity& target) {
  if (ctrl.creator() == controller::bot_controller_creator()) {
    static_cast<bot::BotController*>(&ctrl)->follow(target.ref());
  }
}

bool LFW::ctrl_goingto(const controller::BaseController& ctrl) const {
  if (ctrl.creator() != controller::bot_controller_creator()) return false;
  const bot::BotController* const b = static_cast<const bot::BotController*>(&ctrl);
  return truthy(b->goingto);
}

namespace {

// ---- 4AC 加载流程的小助手 ----
constexpr size_t kNpos = std::u16string::npos;

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// `a ?? b`。
Value coalesce(const Value& a, const Value& b) { return nullish(a) ? b : a; }

// `String.prototype.endsWith`。
bool js_ends_with(const std::u16string& s, const std::u16string& suffix) {
  if (suffix.size() > s.size()) return false;
  return s.compare(s.size() - suffix.size(), suffix.size(), suffix) == 0;
}

// `pick_data_info(raw)`（模块级函数；只留字符串/数字字段，其余 `undefined`）。
IDataInfo pick_data_info(const Value& raw) {
  static const Value kEmpty = Value(std::make_shared<Object>());
  const Value v = nullish(raw) ? kEmpty : raw;
  const auto str_field = [&v](const char16_t* key) -> Value {
    const Value& x = field_or(v, key);
    return std::holds_alternative<std::u16string>(x) ? x : Value();
  };
  const auto num_field = [&v](const char16_t* key) -> Value {
    const Value& x = field_or(v, key);
    return std::holds_alternative<double>(x) ? x : Value();
  };
  IDataInfo info;
  info.type = str_field(u"type");
  info.url = str_field(u"url");
  info.title = str_field(u"title");
  info.description = str_field(u"description");
  info.author = str_field(u"author");
  info.version = num_field(u"version");
  info.time = str_field(u"time");
  info.md5 = str_field(u"md5");
  return info;
}

// `no_cache_url(url)`：`?`/`&` 接 `time=${Date.now()}`。
std::u16string no_cache_url(const std::u16string& url, double now) {
  const bool has_query = url.find(u'?') != kNpos;
  return url + (has_query ? u"&" : u"?") + u"time=" + number_to_string(now);
}

bool starts_http(const std::u16string& s) {
  return js_starts_with(s, u"http://") || js_starts_with(s, u"https://");
}

// `zip_content_url(zip_url, md5)`：`if (!md5) return zip_url`。
std::u16string zip_content_url(const std::u16string& zip_url, const Value& md5) {
  const std::u16string* const m = as_str(md5);
  if (m == nullptr || m->empty()) return zip_url;
  const bool has_query = zip_url.find(u'?') != kNpos;
  return zip_url + (has_query ? u"&" : u"?") + u"md5=" + *m;
}

// `full_zip_url(info_url, zip_url)`：照抄 JS 的 indexOf/-1/`>0` 语义。
std::u16string full_zip_url(const std::u16string& info_url, const std::u16string& zip_url) {
  if (starts_http(zip_url)) return zip_url;
  if (!starts_http(info_url)) return zip_url;
  const long long si =
      info_url.find(u'?') == kNpos ? -1 : static_cast<long long>(info_url.find(u'?'));
  const long long hi =
      info_url.find(u'#') == kNpos ? -1 : static_cast<long long>(info_url.find(u'#'));
  const long long end = (si > 0 && hi > 0) ? std::min(si, hi) : (si > 0 ? si : hi);
  const std::u16string part_a = end > 0 ? info_url.substr(0, static_cast<size_t>(end)) : info_url;
  if (!js_ends_with(part_a, u".zip.json")) return zip_url;
  const std::u16string part_b = end > 0 ? info_url.substr(static_cast<size_t>(end)) : u"";
  const size_t ttt = part_a.rfind(u'/');
  return part_a.substr(0, ttt == kNpos ? 0 : ttt) + u"/" + zip_url + part_b;
}

// `number.toFixed(1).replace(".0", "")`。
std::u16string one_decimal(double v) {
  const long long scaled = static_cast<long long>(v * 10.0 + 0.5);
  std::u16string s = number_to_string(static_cast<double>(scaled / 10));
  const long long frac = scaled % 10;
  if (frac != 0) s += u"." + number_to_string(static_cast<double>(frac));
  return s;
}

// `get_short_file_size_txt(bytes)`。
std::u16string short_size(double bytes0) {
  double bytes = bytes0;
  if (bytes < 1024) return number_to_string(bytes) + u"B";
  bytes /= 1024;
  if (bytes < 1024) return one_decimal(bytes) + u"KB";
  bytes /= 1024;
  if (bytes < 1024) return one_decimal(bytes) + u"MB";
  bytes /= 1024;
  return one_decimal(bytes) + u"GB";
}

// `/(^|\/)data\/data\.index\./i`。
bool is_base_index_name(const std::u16string& name) {
  static const std::u16string kNeedle = u"data/data.index.";
  const std::u16string lower = to_lower_case(name);
  size_t pos = lower.find(kNeedle);
  while (pos != kNpos) {
    if (pos == 0 || lower[pos - 1] == u'/') return true;
    pos = lower.find(kNeedle, pos + 1);
  }
  return false;
}

}  // namespace

std::vector<IDataInfo> LFW::collect_data_infos() {
  LFW* const inst = instance();
  if (inst == nullptr) return {};
  const std::vector<IDataInfo*> loaded = inst->zips_.data_infos();
  std::set<std::u16string> loaded_md5s;
  std::vector<IDataInfo> ret;
  for (IDataInfo* const info : loaded) {
    if (const std::u16string* const m = as_str(info->md5)) loaded_md5s.insert(*m);
    ret.push_back(*info);
  }
  for (const ZipItem& a : ZIPS()) {
    if (a.is_zip()) continue;
    Value raw;
    Value hit;
    std::u16string error;
    if (!inst->import_as_json({no_cache_url(a.path, inst->host_->now())}, raw, hit, error)) {
      inst->host_->warn({Value(u"[LFW::collect_data_infos] 读取数据包信息失败: " + a.path),
                         Value(error)});
      continue;
    }
    const IDataInfo info = pick_data_info(raw);
    const std::u16string* const m = as_str(info.md5);
    if (m != nullptr && !m->empty() && loaded_md5s.count(*m) == 0) {
      ret.push_back(info);
    }
  }
  return ret;
}

bool LFW::disposed_guard(const std::u16string& fn, std::u16string& error) {
  if (!_disposed) return true;
  error = u"[LFW::" + fn + u"] instance disposed.";
  return false;
}

void LFW::on_loading_file(const std::u16string& url, double progress, double full_size) {
  const std::u16string txt = url + u"(" + short_size(full_size) + u")";
  emit_progress_size(txt, progress, Value(full_size));
}

bool LFW::pick_zip_info(IZip& zip, IDataInfo& out) {
  Value raw;
  bool has_raw = false;
  for (const char16_t* const name : {u"__info.json", u"__info.json5"}) {
    IZipObject* const file = zip.file(name);
    if (file == nullptr) continue;
    Value v;
    std::u16string ignored;
    if (!file->json(v, ignored)) continue;  // TS `.catch(() => undefined)`
    if (truthy(v) && as_object(v) != nullptr && !is_array(v)) {
      raw = v;
      has_raw = true;
      break;
    }
  }
  const IDataInfo picked = has_raw ? pick_data_info(raw) : IDataInfo{};
  out.type = coalesce(picked.type, field_or(INFO(), u"type"));
  out.url = picked.url;
  out.title = coalesce(picked.title,
                       coalesce(field_or(INFO(), u"title"), Value(std::u16string(zip.name()))));
  out.description = coalesce(picked.description, field_or(INFO(), u"description"));
  out.author = coalesce(picked.author, field_or(INFO(), u"author"));
  out.version = coalesce(picked.version, field_or(INFO(), u"version"));
  out.time = picked.time;
  const std::optional<std::u16string> md5 = zip.md5();
  out.md5 = md5.has_value() ? Value(*md5) : Value();
  return true;
}

bool LFW::load_zip_from_object(IZip& zip, LoadedZip& out, std::u16string& error) {
  if (!disposed_guard(u"_load_zip_from_object", error)) return false;
  IDataInfo info;
  pick_zip_info(zip, info);
  if (!disposed_guard(u"_load_zip_from_object", error)) return false;
  out.zip = &zip;
  out.info = info;
  return true;
}

bool LFW::load_zip_from_url(const std::u16string& info_url, LoadedZip& out,
                            std::u16string& error) {
  const auto check = [this, &error]() { return disposed_guard(u"load_zip_from_url", error); };
  if (!check()) return false;
  emit_progress(info_url, 0.0);
  Value raw;
  Value hit;
  if (!import_as_json({no_cache_url(info_url, host_->now())}, raw, hit, error)) return false;
  if (!check()) return false;

  const IDataInfo info = pick_data_info(raw);
  if (!truthy(info.url)) {
    error = u"[LFW::load_zip_from_url] info json url got: " + info_url;
    return false;
  }

  const std::u16string url = to_string(info.url);
  const Value md5 = info.md5;
  const std::u16string* const md5s = as_str(md5);
  const bool has_md5 = md5s != nullptr && !md5s->empty();
  const std::u16string zip_url = zip_content_url(full_zip_url(info_url, url), md5);

  IZip* zip = nullptr;
  if (has_md5) {
    const Value stored = host_->zip_get_stored(zip_url, *md5s);
    if (!check()) return false;
    if (truthy(stored)) {
      if (!host_->zip_read_blob(*md5s, stored, md5, zip, error)) return false;
      if (!check()) return false;
    }
  }

  if (zip == nullptr) {
    const Value exists = has_md5 ? host_->zip_cache_get(*md5s) : Value();
    if (truthy(exists) && !check()) return false;
    if (truthy(exists)) {
      const Value name = field_or(exists, u"name");
      const Value data = field_or(exists, u"data");
      const Value blob = field_or(exists, u"blob");
      if (truthy(data)) {
        if (!host_->zip_read_buf(to_string(name), data, zip, error)) return false;
        if (!check()) return false;
      } else if (truthy(blob)) {
        if (!host_->zip_read_blob(to_string(name), blob, md5, zip, error)) return false;
        if (!check()) return false;
      }
    }
  }

  if (zip == nullptr) {
    ILfwHost::DownloadedZip downloaded;
    if (!host_->zip_download(zip_url, md5, *this, downloaded, error)) return false;
    if (!check()) return false;

    host_->zip_cache_del(info_url, u"");
    if (!check()) return false;

    const auto read_blob = [&](const std::u16string& name, const Value& blob,
                               const Value& m) -> bool {
      return host_->zip_read_blob(name, blob, m, zip, error);
    };
    if (downloaded.stored) {
      if (!read_blob(has_md5 ? *md5s : zip_url, downloaded.blob, downloaded.md5)) return false;
    } else if (has_md5) {
      Object entry;
      entry.set(u"name", Value(*md5s));
      entry.set(u"version", Value(DATA_VERSION()));
      entry.set(u"type", Value(DATA_TYPE()));
      entry.set(u"blob", downloaded.blob);
      entry.set(u"data", Value(NullTag{}));
      host_->zip_cache_put(Value(std::make_shared<Object>(entry)));
      if (!check()) return false;

      const Value cached = host_->zip_cache_get(*md5s);
      if (truthy(field_or(cached, u"blob"))) {
        if (!read_blob(to_string(field_or(cached, u"name")), field_or(cached, u"blob"), md5)) {
          return false;
        }
      } else {
        if (!read_blob(*md5s, downloaded.blob, downloaded.md5)) return false;
      }
    } else {
      if (!read_blob(zip_url, downloaded.blob, downloaded.md5)) return false;
    }
    if (!check()) return false;
  }

  emit_progress(url, 100.0);
  out.zip = zip;
  out.info = info;
  return true;
}

bool LFW::load_ui(IZip& zip, std::vector<Value>& out, std::u16string& error) {
  const auto check = [this, &error]() { return disposed_guard(u"load_ui", error); };
  if (!check()) return false;
  std::vector<Value> ret;
  for (IZipObject* const file : zip.file_regex(u"^ui\\/.*?\\.ui\\.(json5?|xml)$")) {
    if (js_ends_with(file->name(), u".xml")) {
      Value text;
      std::u16string ignored;
      if (!file->text(text, ignored)) continue;  // TS `.catch(() => null)`
      if (!check()) return false;
      if (!truthy(text)) continue;
      Value marker;
      std::shared_ptr<IXMLElement> root;
      host_->xml_parse(text, marker, root, ignored);
      if (root == nullptr) continue;
      const Value ui_info = ui::xml_to_ui_info(*root);
      if (!truthy(ui_info)) continue;
      if (const Object* const o = as_object(ui_info); o != nullptr && o->empty()) continue;
      Value cooked;
      if (!ui::cook_ui_info(*this, ui_info, nullptr, cooked, error)) return false;
      if (!check()) return false;
      ret.push_back(cooked);
    } else {
      Value json;
      std::u16string ignored;
      if (!file->json(json, ignored)) continue;  // TS `.catch(() => null)`
      if (!check()) return false;
      if (!truthy(json) || is_array(json)) continue;
      Value cooked;
      if (!ui::cook_ui_info(*this, json, nullptr, cooked, error)) return false;
      if (!check()) return false;
      ret.push_back(cooked);
    }
  }

  if (_disposed) {
    ui_helper().clear();
    out = ui_helper().all();
    return true;
  }
  _ui_loaded = true;
  ui_helper().add(ret);
  {
    LfwCallbackArgs args;
    args.lfw = this;
    args.infos = ret;
    callbacks.call(u"on_ui_loaded", {args});
  }
  out = ret;
  return true;
}

bool LFW::load_builtin_ui(std::vector<Value>& out, std::u16string& error) {
  const auto check = [this, &error]() { return disposed_guard(u"load_builtin_ui", error); };
  if (!check()) return false;
  ImportResult res;
  if (!resources_->import_json(u"builtin_data/launch/_index.json", true, res, error)) return false;
  std::vector<Value> ret;
  if (const Array* const paths = as_array(res.data)) {
    for (size_t i = 0; i < paths->size(); ++i) {
      const std::u16string* const path = as_str(paths->at(i));
      if (path == nullptr) continue;
      Value cooked;
      if (!ui::cook_ui_info(*this, Value(*path), nullptr, cooked, error)) return false;
      if (!check()) return false;
      ret.insert(ret.begin(), cooked);  // `ret.unshift(cooked_ui_info)`
    }
  }
  ui_helper().add(ret);
  out = ret;
  return true;
}

bool LFW::load_data(const LoadedZip& z, std::u16string& error) {
  const auto check = [this, &error]() { return disposed_guard(u"load_data", error); };
  if (!check()) return false;
  IZip& zip = *z.zip;

  Value r;
  if (IZipObject* const f = zip.file(u"strings.json")) {
    if (!f->json(r, error)) return false;
    if (truthy(r)) _i18n.add(r);
  }
  if (!check()) return false;

  if (IZipObject* const f = zip.file(u"strings.json5")) {
    if (!f->json(r, error)) return false;
    if (truthy(r)) _i18n.add(r);
  }
  if (!check()) return false;

  for (IZipObject* const file : zip.file_regex(u"\\.(i18n|strings)\\.json5?$")) {
    Value words;
    std::u16string ignored;
    const bool ok = file->json(words, ignored);
    if (!check()) return false;
    if (ok && truthy(words)) _i18n.add(words);
  }
  if (!check()) return false;

  _owned_infos.push_back(std::make_unique<IDataInfo>(z.info));
  zips_.add(ILoadedZip{z.zip, _owned_infos.back().get()});
  {
    LfwCallbackArgs args;
    args.lfw = this;
    args.zips = zips_.zips();
    callbacks.call(u"on_zips_changed", {args});
  }

  std::vector<std::u16string> base;
  std::vector<std::u16string> rest;
  for (IZipObject* const file : zip.file_regex(u"\\.index\\.(json5|xml)$")) {
    if (is_base_index_name(file->name())) base.push_back(file->name());
    else rest.push_back(file->name());
  }
  std::vector<std::u16string> paths = base;
  paths.insert(paths.end(), rest.begin(), rest.end());
  if (!datas_->load(paths, error)) return false;
  if (!check()) return false;

  // TS 的 `regist(this.fighters, d)`（`add_<name>` 动态方法）：端口不建模，记 README 偏差表。
  for (IZipObject* const bgm : zip.file_regex(u"bgm\\/.*?\\.mp3$")) {
    bool dup = false;
    for (const std::u16string& v : bgms) {
      if (v == bgm->name()) {
        dup = true;
        break;
      }
    }
    if (!dup) bgms.push_back(bgm->name());
  }

  std::vector<Value> cooked;
  return load_ui(zip, cooked, error);
}

bool LFW::load(const std::vector<ZipItem>& arg1, std::u16string& error) {
  const bool is_first = zips_.length() == 0;
  const auto check = [this, &error]() { return disposed_guard(u"load", error); };
  if (!check()) return false;
  _loading = true;
  {
    LfwCallbackArgs args;
    args.lfw = this;
    callbacks.call(u"on_loading_start", {args});
  }

  // TS 这段在建 `try` 之前：失败直接 reject、`finally` 不跑 ⇒ `_loading` 留在 true。
  if (is_first) {
    ImportResult res;
    if (!resources_->import_json(u"builtin_data/launch/strings.json", true, res, error)) {
      return false;
    }
    if (!check()) return false;
    _i18n.add(res.data);
    std::vector<Value> cooked;
    if (!load_builtin_ui(cooked, error)) return false;
    if (!check()) return false;
    bool found = false;
    Value id;
    for (const Value& v : ui_helper().all()) {
      const Value& vid = field_or(v, u"id");
      const std::u16string* const s = as_str(vid);
      if (s != nullptr && *s == first_page) {
        found = true;
        id = vid;
        break;
      }
    }
    Object opts;
    opts.set(u"id", found ? id : Value());
    _layers->set_page(Value(std::make_shared<Object>(opts)), 0.0);
  }

  bool failed = false;
  std::u16string fail_error;
  for (const ZipItem& a : arg1) {
    LoadedZip z;
    if (a.is_zip()) failed = !load_zip_from_object(*a.zip, z, fail_error);
    else failed = !load_zip_from_url(a.path, z, fail_error);
    if (!failed) failed = !check();
    if (!failed) failed = !load_data(z, fail_error);
    if (!failed) failed = !check();
    if (failed) break;
  }

  if (failed) {
    _loading = false;
    error = fail_error;
    if (_disposed) return false;
    LfwCallbackArgs args;
    args.lfw = this;
    args.value = Value(fail_error);
    callbacks.call(u"on_loading_failed", {args});
    return false;
  }

  if (is_first) {
    LfwCallbackArgs args;
    args.lfw = this;
    callbacks.call(u"on_prel_loaded", {args});
  }
  _playable = true;
  {
    LfwCallbackArgs args;
    args.lfw = this;
    callbacks.call(u"on_loading_end", {args});
  }
  _loading = false;
  return true;
}

}  // namespace lfw
