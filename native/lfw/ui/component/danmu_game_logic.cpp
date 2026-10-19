#include "lfw/ui/component/danmu_game_logic.h"

#include <algorithm>
#include <string>
#include <utility>

#include "lfw/core/js_num.h"
#include "lfw/core/js_string.h"
#include "lfw/bg/background.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/entity_group.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/entity/summary_mgr.h"
#include "lfw/lfw.h"
#include "lfw/loader/dat_mgr.h"
#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/is_class.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/string_help.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

namespace {

// `v == null`（各文件的既有写法）。
bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

const std::vector<std::u16string>& teams8() {
  static const std::vector<std::u16string> v{u"1", u"2", u"3", u"4", u"5", u"6", u"7", u"8"};
  return v;
}

std::u16string danmu_uid_mark() {
  const Value* const v = defines::find(u"Defines.DANMU_UID_MARK");
  return v != nullptr ? to_string(*v) : std::u16string(u"danmu_uid");
}

// `mt.pick(Entity[])`：`range(0, size)` 一次抽取、越界 ⇒ `undefined`（空数组不消耗 RNG）。
Entity* pick_entity(MersenneTwister& mt, const std::vector<Entity*>& arr) {
  const double index = mt.range(0.0, static_cast<double>(arr.size()));
  const uint32_t i = js_to_uint32(index);
  if (i >= arr.size()) return nullptr;
  return arr[i];
}

// `mt.pick(IEntityData[])`（Value 数组版）。
std::optional<Value> pick_data(MersenneTwister& mt, const std::vector<Value>& arr) {
  auto holder = std::make_shared<Array>();
  for (const Value& v : arr) holder->push_back(v);
  const Value picked = mt.pick_value(Value(holder));
  return truthy(picked) ? std::optional<Value>(picked) : std::nullopt;
}

// `localeCompare`（默认 locale）的 ASCII 近似：主序大小写不敏感、同主序小写在前；
// 非 ASCII 退回 UTF-16 码点序（真实 ICU collation 的已知偏差，记在 DESIGN）。
int js_locale_compare(const std::u16string& a, const std::u16string& b) {
  auto primary = [](char16_t c) -> char16_t {
    if (c >= u'a' && c <= u'z') return c;
    if (c >= u'A' && c <= u'Z') return static_cast<char16_t>(c + 32);
    return c;
  };
  const size_t n = min(a.size(), b.size());
  for (size_t i = 0; i < n; ++i) {
    const char16_t pa = primary(a[i]);
    const char16_t pb = primary(b[i]);
    if (pa != pb) return pa < pb ? -1 : 1;
  }
  if (a.size() != b.size()) return a.size() < b.size() ? -1 : 1;
  for (size_t i = 0; i < a.size(); ++i) {
    if (a[i] == b[i]) continue;
    const bool al = a[i] >= u'a' && a[i] <= u'z';
    const bool bl = b[i] >= u'a' && b[i] <= u'z';
    if (al != bl) return al ? -1 : 1;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

const std::u16string& ffa_mode() {
  static const std::u16string v = u"ffa";
  return v;
}
const std::u16string& teams8_mode() {
  static const std::u16string v = u"teams8";
  return v;
}
const std::u16string& coop_mode() {
  static const std::u16string v = u"coop";
  return v;
}

}

const ClazzTag* DanmuGameLogic::class_tag() {
  static const ClazzTag tag{SummaryLogic::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& DanmuGameLogic::TAGS() {
  static const std::vector<std::u16string> tags{u"DanmuGameLogic"};
  return tags;
}

const std::u16string& DanmuGameLogic::props_tag() const {
  static const std::u16string tag = u"DanmuGameLogic";
  return tag;
}

const Value& DanmuGameLogic::props_meta() const {
  static const Value meta = [] {
    auto p = std::make_shared<Object>();
    p->set(u"type", Value(u"string"));
    p->set(u"nullable", Value(true));
    auto o = std::make_shared<Object>();
    o->set(u"mode", Value(p));
    return Value(o);
  }();
  return meta;
}

DanmuGameLogic::WorldListenerT::WorldListenerT(DanmuGameLogic* o) {
  handlers.push_back({u"on_stage_change", [o](const WorldPayloads& args) {
                        for (const WorldCallbackArgs& a : args) {
                          o->handle_world_stage_change(a.stage, a.prev_stage);
                        }
                      }});
}

DanmuGameLogic::StageListenerT::StageListenerT(DanmuGameLogic* o) {
  handlers.push_back({u"on_stage_finish",
                      [o](const stage::StageCallbacks::Payloads&) { o->handle_stage_finish(); }});
}

DanmuGameLogic::SummaryListenerT::SummaryListenerT(ViewerStat* s) {
  handlers.push_back({u"on_damage_sum_changed", [s](const ValuePayloads& a) {
                        if (a.size() >= 2) s->damages += to_number(a[0]) - to_number(a[1]);
                      }});
  handlers.push_back({u"on_kill_sum_changed", [s](const ValuePayloads& a) {
                        if (a.size() >= 2) s->kills += to_number(a[0]) - to_number(a[1]);
                      }});
}

DanmuGameLogic::EntityListenerT::EntityListenerT(ViewerStat* s) {
  handlers.push_back({u"on_dead", [s](const ValuePayloads&) { ++s->deads; }});
}

DanmuGameLogic::DanmuGameLogic(UINode& layout, const std::u16string& f_name, const Value& info)
    : SummaryLogic(layout, f_name, info) {}

const std::u16string& DanmuGameLogic::mode() {
  if (!ensure_props()) return ffa_mode();
  const std::optional<std::u16string> v = props_holder.str(u"mode");
  if (!v.has_value()) return ffa_mode();
  if (*v == teams8_mode()) return teams8_mode();
  if (*v == coop_mode()) return coop_mode();
  return ffa_mode();
}

std::u16string DanmuGameLogic::stage_name() { return world().stage()->name(); }

void DanmuGameLogic::update_teams() {
  _teams.clear();
  for (Entity* const e : lfw().characters_helper().all()) _teams.insert(e->team());
}

void DanmuGameLogic::on_fighter_add(Entity& e) {
  SummaryLogic::on_fighter_add(e);
  update_teams();
}

void DanmuGameLogic::on_fighter_del(Entity& e) {
  SummaryLogic::on_fighter_del(e);
  untrack_viewer(e);
  _join_fallen = e.team();
  update_teams();
  if (_cam_ctrl == nullptr || _cam_ctrl->staring() != &e) return;
  _staring_countdown.reset();
  lfw().mt()->mark = u"dmg_staring";
  _cam_ctrl->set_staring(pick_entity(*lfw().mt(), staring_candidates()));
}

void DanmuGameLogic::on_start() {
  SummaryLogic::on_start();
  world().callbacks.add(&_world_cb);
  update_bg();
  if (mode() != coop_mode()) lfw().sounds_play_bgm(Value(u"?"));
  lfw().on_component_broadcast(this, BROADCAST_ON_START);
  _cam_ctrl = nullptr;
  UIComponent* const cam = node.find_component(CameraCtrl::class_tag());
  if (cam != nullptr) {
    _cam_ctrl = static_cast<CameraCtrl*>(cam);
    _cam_ctrl->candidates = [this]() { return staring_candidates(); };
  }
}

void DanmuGameLogic::on_stop() {
  SummaryLogic::on_stop();
  world().callbacks.del(&_world_cb);
  join_queue.clear();
  _queue_seen.clear();
  _survivors.reset();
  _viewers.clear();
  // TS 靠 GC 把 `_viewer_tracks.clear()` 之后仍在 callbacks 里的监听器保活；
  // C++ 的 unique_ptr 会析构 ⇒ 释放前必须先从 summary / 实体 callbacks 里摘掉。
  for (auto& kv : _viewer_tracks) {
    for (const auto& item : summary_mgr().items()) {
      if (item.first != kv.first) continue;
      item.second->callbacks.del(kv.second.sum.get());
      break;
    }
    for (Entity* const e : world().entities) {
      if (e == nullptr || e->id != kv.first) continue;
      e->callbacks.del(kv.second.ent.get());
      break;
    }
  }
  _viewer_tracks.clear();
  _cheer_cd.clear();
  _cheer_feed.clear();
  lfw().on_component_broadcast(this, BROADCAST_ON_STOP);
  world().clear();
}

void DanmuGameLogic::update_bg() {
  const Value* const gone = defines::find(u"Defines.NEXT_FRAME_GONE");
  for (Entity* const e : world().entities) e->enter_frame(gone != nullptr ? *gone : Value());
  lfw().mt()->mark = u"dmglogic";
  _team_caps.clear();
  _survivors.reset();
  _waiting_respawn = false;
  _waiting_next_stage = false;
  const std::u16string& m = mode();
  if (m == teams8_mode()) {
    lfw().change_bg(u"?");
    for (const std::u16string& team : teams8()) {
      _team_caps.push_back({team, TEAMS8_TEAM_CAP});
      for (Entity* const f : lfw().characters_helper().add_random(1, &team)) fighter_enter(*f);
    }
  } else if (m == coop_mode()) {
    _coop_stage_ready = start_coop_stage();
  } else {
    lfw().change_bg(u"?");
    auto pool = std::make_shared<Array>();
    for (const Value& v : lfw().datas().fighters()) pool->push_back(v);
    Value pool_v(pool);
    const std::u16string empty_team;
    for (double i = 0; i < FFA_SEEDS && pool->size() > 0; ++i) {
      const Value data = lfw().mt()->take_value(pool_v);
      if (!truthy(data)) break;
      for (Entity* const f : lfw().characters_helper().add(data, 1, &empty_team)) {
        fighter_enter(*f);
      }
    }
  }

  update_staring();
  _staring_countdown.reset();

  CameraCtrl* const cam = _cam_ctrl;
  Entity* const staring = cam != nullptr ? cam->staring() : nullptr;
  if (staring != nullptr && cam->auto_) {
    Stage* const stage = world().stage();
    const double view_w = to_number(world().dataset.get(u"screen_w")) /
                          (world().bg()->zoom_x() != 0 ? world().bg()->zoom_x() : 1);
    double cam_x = staring->position.x - view_w / 2;
    const double max_cam_left = stage->left;
    const double max_cam_right = stage->right;
    if (cam_x < max_cam_left) cam_x = max_cam_left;
    if (cam_x > max_cam_right - view_w) cam_x = max_cam_right - view_w;
    lfw().push_cmd({u"DIST_CAM", number_to_string(cam_x)});
    world().camera().jump_x(cam_x);
  }
}

bool DanmuGameLogic::join(const helper::Entrant& entrant) {
  if (find_viewer_fighter(entrant.uid) != nullptr) return false;
  if (join_queue.has(entrant.uid)) return false;
  if (claim_template(entrant)) {
    if (truthy(entrant.oid)) switch_to(entrant.uid, entrant.oid);
    return true;
  }
  const bool ret = join_queue.enqueue(entrant);
  if (ret) _queue_seen[entrant.uid] = time;
  return ret;
}

bool DanmuGameLogic::leave(const std::u16string& uid) {
  const bool removed = join_queue.remove(uid);
  _queue_seen.erase(uid);
  Entity* const fighter = find_viewer_fighter(uid);
  if (fighter != nullptr) fighter->release();
  return removed || fighter != nullptr;
}

void DanmuGameLogic::touch(const std::u16string& uid) { _queue_seen[uid] = time; }

bool DanmuGameLogic::enter(const helper::Entrant& entrant) {
  if (join_queue.has(entrant.uid)) return false;
  if (find_viewer_fighter(entrant.uid) != nullptr) return false;
  if (mode() != coop_mode() && _teams.size() <= 1) return false;
  if (claim_template(entrant)) return true;
  const std::optional<std::u16string> team = find_join_team();
  if (!team.has_value()) return false;
  const std::optional<Value> tmpl = template_data();
  return spawn_entrant(entrant, *team, tmpl.has_value() ? *tmpl : Value()) != nullptr;
}

bool DanmuGameLogic::switch_to(const std::u16string& uid, const Value& oid) {
  Entity* const fighter = find_viewer_fighter(uid);
  if (fighter == nullptr) return false;
  const std::optional<Value> template_ = template_data();
  if (template_.has_value() &&
      !equals(field_or(fighter->data(), u"id"), field_or(*template_, u"id"))) {
    return false;
  }
  const std::optional<Value> data = regular_data(oid);
  if (!data.has_value()) return false;
  const double x = fighter->position.x;
  const double y = fighter->position.y;
  const double z = fighter->position.z;
  const double facing = fighter->facing;
  const std::u16string team = fighter->team();
  const std::u16string name = to_string(fighter->name());
  const double hp_ratio = fighter->hp_max() > 0 ? fighter->hp() / fighter->hp_max() : 1;
  fighter->release();
  const helper::Entrant entrant{uid, name, field_or(*data, u"id")};
  Entity* const next = spawn_entrant(entrant, team, *data);
  if (next == nullptr) return false;
  next->set_position(Value(x), Value(y), Value(z));
  next->facing = facing;
  next->set_hp(max(1.0, round(next->hp_max() * hp_ratio)));
  return true;
}

void DanmuGameLogic::sweep_queue() {
  const double now = time;
  std::set<std::u16string> queued;
  const std::vector<helper::Entrant> items = join_queue.all();
  for (const helper::Entrant& entrant : items) {
    queued.insert(entrant.uid);
    const auto seen = _queue_seen.find(entrant.uid);
    if (seen == _queue_seen.end()) {
      _queue_seen[entrant.uid] = now;
      continue;
    }
    if (now - seen->second >= QUEUE_IDLE_TIMEOUT) join_queue.remove(entrant.uid);
  }
  std::vector<std::u16string> keys;
  for (const auto& kv : _queue_seen) keys.push_back(kv.first);
  for (const std::u16string& uid : keys) {
    if (queued.count(uid) == 0) _queue_seen.erase(uid);
  }
}

bool DanmuGameLogic::cheer(const std::u16string& uid) {
  const auto stat_it = _viewers.find(uid);
  if (stat_it == _viewers.end()) return false;
  ViewerStat& stat = stat_it->second;
  const auto last = _cheer_cd.find(uid);
  if (last != _cheer_cd.end() && time - last->second < CHEER_CD) return false;
  Entity* const fighter = find_viewer_fighter(uid);
  if (fighter == nullptr) return false;
  const double hp_max = fighter->hp_max();
  fighter->set_hp(min(fighter->hp() + hp_max * CHEER_HP_RATIO, hp_max));
  ++stat.cheers;
  _cheer_cd[uid] = time;
  _cheer_feed.push_back(CheerEvent{uid, stat.name, time});
  if (_cheer_feed.size() > 20) {
    _cheer_feed.erase(_cheer_feed.begin(),
                      _cheer_feed.begin() + static_cast<std::ptrdiff_t>(_cheer_feed.size() - 20));
  }
  return true;
}

std::vector<DanmuGameLogic::ViewerStat> DanmuGameLogic::viewer_stats() {
  const std::u16string mark = danmu_uid_mark();
  std::set<std::u16string> alive;
  for (Entity* const e : world().entities) {
    if (!entity::is_fighter(*e) || e->hp() <= 0) continue;
    const auto it = e->marks.find(mark);
    if (it != e->marks.end() && !it->second.empty()) alive.insert(it->second);
  }
  std::vector<ViewerStat> ret;
  for (const auto& kv : _viewers) {
    ViewerStat v = kv.second;
    v.alive = alive.count(v.uid) != 0;
    ret.push_back(std::move(v));
  }
  std::stable_sort(ret.begin(), ret.end(), [](const ViewerStat& a, const ViewerStat& b) {
    if (a.kills != b.kills) return b.kills < a.kills;
    if (a.spawns != b.spawns) return b.spawns < a.spawns;
    return js_locale_compare(a.name, b.name) < 0;
  });
  return ret;
}

void DanmuGameLogic::fighter_enter(Entity& v) {
  v.stat_bar = 0;
  v.as_key_role(Value(true));
  v.dead_gone = 1;
  v.name_visible = 1;
  v.set_blinking(120);
  v.set_invulnerable(120);
}

std::optional<std::u16string> DanmuGameLogic::find_join_team() {
  const std::vector<Entity*> all = lfw().characters_helper().all();
  const std::u16string& m = mode();
  if (m == ffa_mode()) {
    return all.size() < MAX_FIGHTERS ? std::optional<std::u16string>(std::u16string())
                                     : std::nullopt;
  }
  if (m == teams8_mode()) {
    std::vector<std::pair<std::u16string, double>> counts;
    for (Entity* const f : all) {
      bool found = false;
      for (auto& kv : counts) {
        if (kv.first != f->team()) continue;
        kv.second += 1;
        found = true;
        break;
      }
      if (!found) counts.push_back({f->team(), 1.0});
    }
    const Value picked =
        helper::pick_join_team(counts, _team_caps, _join_fallen ? &*_join_fallen : nullptr,
                               teams8());
    const std::u16string* const s = std::get_if<std::u16string>(&picked);
    if (s == nullptr) return std::nullopt;
    return *s;
  }
  size_t viewers = 0;
  for (Entity* const f : all) {
    if (f->team() == u"1") ++viewers;
  }
  return static_cast<double>(viewers) < MAX_FIGHTERS
             ? std::optional<std::u16string>(std::u16string(u"1"))
             : std::nullopt;
}

void DanmuGameLogic::try_join() {
  while (join_queue.size() != 0) {
    if (claim_queued()) continue;
    const std::optional<std::u16string> team = find_join_team();
    if (!team.has_value()) return;
    const std::optional<helper::Entrant> entrant = join_queue.dequeue();
    if (!entrant.has_value()) return;
    if (find_viewer_fighter(entrant->uid) == nullptr) spawn_entrant(*entrant, *team);
    _join_fallen.reset();
  }
}

bool DanmuGameLogic::claim_queued() {
  if (mode() != coop_mode()) return false;
  const std::vector<helper::Entrant>& items = join_queue.all();
  if (items.empty()) return false;
  const helper::Entrant entrant = items[0];
  if (find_viewer_fighter(entrant.uid) == nullptr && !claim_template(entrant)) return false;
  join_queue.remove(entrant.uid);
  _queue_seen.erase(entrant.uid);
  if (truthy(entrant.oid)) switch_to(entrant.uid, entrant.oid);
  return true;
}

const std::vector<Value>& DanmuGameLogic::regular_fighter_datas() {
  if (!_regular_datas.has_value()) {
    _regular_datas = lfw().datas().get_fighters_of_group(entity_group::kRegular);
  }
  return *_regular_datas;
}

std::optional<Value> DanmuGameLogic::template_data() {
  const Value* const v = lfw().datas().find_fighter(Value(u"0"));
  return v != nullptr ? std::optional<Value>(*v) : std::nullopt;
}

Entity* DanmuGameLogic::find_claimable_template() {
  if (mode() != coop_mode()) return nullptr;
  const std::optional<Value> template_ = template_data();
  if (!template_.has_value()) return nullptr;
  const std::u16string mark = danmu_uid_mark();
  for (Entity* const e : world().entities) {
    if (e->mounted() == 0 || !entity::is_fighter(*e) || e->hp() <= 0) continue;
    if (!equals(field_or(e->data(), u"id"), field_or(*template_, u"id"))) continue;
    if (e->marks.find(mark) != e->marks.end()) continue;
    return e;
  }
  return nullptr;
}

bool DanmuGameLogic::claim_template(const helper::Entrant& entrant) {
  Entity* const fighter = find_claimable_template();
  if (fighter == nullptr) return false;
  fighter->set_name(Value(entrant.name));
  fighter->set_mark(danmu_uid_mark(), entrant.uid, std::nullopt);
  track_viewer(*fighter);
  return true;
}

void DanmuGameLogic::place_coop_spawn(Entity& e) {
  if (mode() != coop_mode()) return;
  const double x = lfw().mt()->range(world().player_l() + 40, world().player_l() + 80);
  const double z = lfw().mt()->range(world().far_plane(), world().near_plane());
  e.set_position(Value(x), Value(550.0), Value(z));
}

void DanmuGameLogic::fill_templates() {
  if (mode() != coop_mode()) return;
  const std::optional<Value> data = template_data();
  if (!data.has_value()) return;
  static const std::u16string team1 = u"1";
  for (double i = 0; i < COOP_TEMPLATES; ++i) {
    if (!find_join_team().has_value()) return;
    const std::vector<Entity*> added = lfw().characters_helper().add(*data, 1, &team1);
    if (added.empty()) return;
    Entity* const fighter = added[0];
    if (fighter == nullptr) return;
    fighter->set_name(Value(std::u16string()));
    fighter_enter(*fighter);
    place_coop_spawn(*fighter);
  }
}

std::optional<Value> DanmuGameLogic::regular_data(const Value& oid) {
  const std::vector<Value>& datas = regular_fighter_datas();
  if (datas.empty()) return std::nullopt;
  if (!truthy(oid)) {
    lfw().mt()->mark = u"danmu_viewer";
    return pick_data(*lfw().mt(), datas);
  }
  const std::u16string key = js_trim(to_string(oid));
  const std::u16string lower = to_lower_case(key);
  for (const Value& v : datas) {
    if (to_string(field_or(v, u"id")) == key) return v;
    const Value name = field_or(field_or(v, u"base"), u"name");
    if (is_nullish(name)) continue;
    if (to_lower_case(to_string(name)) == lower) return v;
  }
  return std::nullopt;
}

Entity* DanmuGameLogic::spawn_entrant(const helper::Entrant& entrant,
                                      const std::u16string& team, const Value& data) {
  std::optional<Value> fighter_data;
  if (!is_nullish(data)) fighter_data = data;
  else fighter_data = regular_data(entrant.oid);
  if (!fighter_data.has_value()) fighter_data = regular_data(Value());
  std::vector<Entity*> fighters;
  if (fighter_data.has_value()) fighters = lfw().characters_helper().add(*fighter_data, 1, &team);
  else fighters = lfw().characters_helper().add_random(1, &team);
  if (fighters.empty()) return nullptr;
  Entity* const fighter = fighters[0];
  if (fighter == nullptr) return nullptr;
  fighter_enter(*fighter);
  place_coop_spawn(*fighter);
  fighter->set_name(Value(entrant.name));
  fighter->set_mark(danmu_uid_mark(), entrant.uid, std::nullopt);
  track_viewer(*fighter);
  return fighter;
}

void DanmuGameLogic::track_viewer(Entity& e) {
  if (_viewer_tracks.count(e.id) != 0) return;
  const std::u16string mark = danmu_uid_mark();
  const auto mark_it = e.marks.find(mark);
  if (mark_it == e.marks.end() || mark_it->second.empty()) return;
  const std::u16string& uid = mark_it->second;
  ViewerStat* stat = nullptr;
  const auto stat_it = _viewers.find(uid);
  if (stat_it == _viewers.end()) {
    ViewerStat fresh;
    fresh.uid = uid;
    fresh.name = to_string(e.name());
    stat = &_viewers.emplace(uid, std::move(fresh)).first->second;
  } else {
    stat = &stat_it->second;
  }
  if (truthy(e.name())) stat->name = to_string(e.name());
  ++stat->spawns;
  ViewerTrack track;
  track.sum = std::make_unique<SummaryListenerT>(stat);
  track.ent = std::make_unique<EntityListenerT>(stat);
  summary_mgr().get(e.id)->callbacks.add(track.sum.get());
  e.callbacks.add(track.ent.get());
  _viewer_tracks.emplace(e.id, std::move(track));
}

void DanmuGameLogic::untrack_viewer(Entity& e) {
  const auto it = _viewer_tracks.find(e.id);
  if (it == _viewer_tracks.end()) return;
  summary_mgr().get(e.id)->callbacks.del(it->second.sum.get());
  e.callbacks.del(it->second.ent.get());
  _viewer_tracks.erase(it);
}

Entity* DanmuGameLogic::find_viewer_fighter(const std::u16string& uid) {
  const std::u16string mark = danmu_uid_mark();
  for (Entity* const e : world().entities) {
    if (!entity::is_fighter(*e) || e->hp() <= 0) continue;
    const auto it = e->marks.find(mark);
    if (it != e->marks.end() && it->second == uid) return e;
  }
  return nullptr;
}

bool DanmuGameLogic::start_coop_stage() {
  const std::vector<Value>& stages = lfw().datas().stages();
  const Value* found = nullptr;
  const Value* fallback = nullptr;
  for (const Value& v : stages) {
    const Value group = field_or(v, u"group");
    bool excluded = false;
    if (const Array* const arr = as_array(group)) {
      for (size_t i = 0; i < arr->size(); ++i) {
        const Value& g = arr->at(i);
        if (equals(g, Value(std::u16string(entity_group::kDev))) ||
            equals(g, Value(std::u16string(entity_group::kHidden)))) {
          excluded = true;
          break;
        }
      }
    }
    if (excluded) continue;
    if (to_string(field_or(v, u"name")) == u"1-1" && found == nullptr) found = &v;
    if (truthy(field_or(v, u"is_starting")) &&
        to_string(field_or(v, u"chapter")) != u"survival" && fallback == nullptr) {
      fallback = &v;
    }
  }
  const Value* const stage = found != nullptr ? found : fallback;
  if (stage == nullptr) return false;
  lfw().change_stage(to_string(field_or(*stage, u"id")));
  return true;
}

std::vector<helper::Entrant> DanmuGameLogic::collect_survivors() {
  std::vector<helper::Entrant> ret;
  std::set<std::u16string> seen;
  const std::u16string mark = danmu_uid_mark();
  for (Entity* const e : world().entities) {
    if (!entity::is_fighter(*e) || e->hp() <= 0) continue;
    const auto it = e->marks.find(mark);
    if (it == e->marks.end() || it->second.empty()) continue;
    const std::u16string& uid = it->second;
    if (seen.insert(uid).second) {
      ret.push_back(helper::Entrant{uid, to_string(e->name()), Value()});
      continue;
    }
    for (helper::Entrant& slot : ret) {
      if (slot.uid == uid) slot.name = to_string(e->name());
    }
  }
  return ret;
}

void DanmuGameLogic::respawn_viewers() {
  const std::optional<std::vector<helper::Entrant>> survivors = std::move(_survivors);
  _survivors.reset();
  if (!survivors.has_value() || survivors->empty()) return;
  static const std::u16string team1 = u"1";
  for (const helper::Entrant& entrant : *survivors) spawn_entrant(entrant, team1);
}

void DanmuGameLogic::handle_world_stage_change(stage::Stage* stage, stage::Stage* prev) {
  if (mode() != coop_mode()) return;
  if (prev != nullptr) prev->callbacks().del(&_stage_cb);
  if (stage != nullptr) stage->callbacks().add(&_stage_cb);
  _waiting_respawn = true;
}

void DanmuGameLogic::handle_stage_finish() {
  if (mode() != coop_mode()) return;
  _waiting_next_stage = true;
  _next_stage_delay.reset();
}

void DanmuGameLogic::update_staring() {
  if (_cam_ctrl == nullptr) return;
  lfw().mt()->mark = u"dmg_staring_2";
  _cam_ctrl->set_staring(pick_entity(*lfw().mt(), staring_candidates()));
}

std::vector<Entity*> DanmuGameLogic::staring_candidates() {
  const std::vector<Entity*> fighters = lfw().characters_helper().all();
  if (mode() != coop_mode()) return fighters;
  const std::u16string mark = danmu_uid_mark();
  std::vector<Entity*> viewers;
  for (Entity* const v : fighters) {
    if (v->team() != u"1") continue;
    const auto it = v->marks.find(mark);
    if (it == v->marks.end() || it->second.empty()) continue;
    viewers.push_back(v);
  }
  if (!viewers.empty()) return viewers;
  std::vector<Entity*> team1;
  for (Entity* const v : fighters) {
    if (v->team() == u"1") team1.push_back(v);
  }
  return team1;
}

void DanmuGameLogic::update(double dt) {
  time += dt;
  SummaryLogic::update(dt);
  if (mode() == coop_mode()) {
    if (!_coop_stage_ready) _coop_stage_ready = start_coop_stage();
    if (_waiting_respawn) {
      _waiting_respawn = false;
      respawn_viewers();
      fill_templates();
    }
    if (_waiting_next_stage) {
      if (_next_stage_delay.add()) {
        _waiting_next_stage = false;
        _survivors = collect_survivors();
        lfw().goto_next_stage();
      }
    }
  }
  if (join_queue.size() != 0 && (mode() == coop_mode() || _teams.size() > 1)) try_join();
  if (_queue_sweep_timer.add()) sweep_queue();
  if (_staring_countdown.add()) update_staring();

  CameraCtrl* const cam = _cam_ctrl;
  Entity* const staring = cam != nullptr ? cam->staring() : nullptr;
  if (staring != nullptr && cam->auto_) {
    const double view_w = to_number(world().dataset.get(u"screen_w")) /
                          (world().bg()->zoom_x() != 0 ? world().bg()->zoom_x() : 1);
    lfw().push_cmd({u"DIST_CAM", number_to_string(staring->position.x - view_w / 2)});
  } else if (staring == nullptr) {
    update_staring();
  }

  const bool finished = mode() != coop_mode() && _teams.size() <= 1;
  if (finished) {
    if (_gameover_countdown.add()) {
      if (!_teams.empty()) {
        for (auto& kv : teams) {
          if (_teams.count(kv.first) != 0) kv.second.wins += 1;
        }
      }
      update_bg();
    }
  } else {
    _gameover_countdown.reset();
  }
}

}
}
