#include "lfw/ui/component/game_prepare_logic.h"

#include <algorithm>
#include <cmath>

#include "lfw/core/js_string.h"
#include "lfw/defines/defines.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/facing_flag.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/ground.h"
#include "lfw/lfw.h"
#include "lfw/player_info.h"
#include "lfw/ui/component/background_switcher.h"
#include "lfw/ui/component/char_menu.h"
#include "lfw/ui/component/char_menu_head.h"
#include "lfw/ui/component/picture.h"
#include "lfw/ui/component/scroll_view.h"
#include "lfw/ui/component/stage_switcher.h"
#include "lfw/ui/instance_ref.h"
#include "lfw/ui/uinode.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/value_spread.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/is_class.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/clamp.h"
#include "lfw/utils/math/mersenne_twister.h"
#include "lfw/world.h"
#include "lfw/world_dataset.h"

namespace lfw {
namespace ui {

namespace {

double screen_width() { return defines::num(u"Defines.MODERN_SCREEN_WIDTH"); }

constexpr const char16_t* kGameModeVs = u"vs_mode";
constexpr const char16_t* kGameModeStage = u"stage_mode";
constexpr const char16_t* kGameModeSurvival = u"survival";
constexpr double kRankLimit = 100;
constexpr double kRankRowH = 36;
constexpr double kRankRowGap = 8;
constexpr const char16_t* kRankRowEvenBg = u"rgba(255,255,255,0.04)";
constexpr const char16_t* kDefaultBgFace = u"sprite/MENU_BACK0.png";
constexpr const char16_t* kBroadcastRankRequest = u"rank_request";

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

const std::vector<std::u16string>& rank_periods() {
  static const std::vector<std::u16string> v{u"all", u"month", u"week", u"day"};
  return v;
}

// `i18n_fmt(template, ...args)`：把 `%N` 依次替换为第 N 个参数（1 基）。
std::u16string i18n_fmt(const std::u16string& tpl, const std::vector<Value>& args) {
  std::u16string out;
  size_t i = 0;
  while (i < tpl.size()) {
    if (tpl[i] == u'%' && i + 1 < tpl.size() && tpl[i + 1] >= u'0' && tpl[i + 1] <= u'9') {
      size_t j = i + 1;
      int idx = 0;
      while (j < tpl.size() && tpl[j] >= u'0' && tpl[j] <= u'9') {
        idx = idx * 10 + static_cast<int>(tpl[j] - u'0');
        ++j;
      }
      const size_t at = idx >= 1 ? static_cast<size_t>(idx - 1) : args.size();
      if (at < args.size() && !is_nullish(args[at])) out += to_string(args[at]);
      i = j;
      continue;
    }
    out += tpl[i];
    ++i;
  }
  return out;
}

// `hp_map` / `mp_map`（1/2/3/4 → 2500/1000/500/500；表外 `?? 500`）。
double difficulty_hp(double d) {
  if (d == 1.0) return 2500;
  if (d == 2.0) return 1000;
  return 500;
}

// `cell?.set_text(text, cell?.text?.style)`：`text?.style` 缺失/nullish/就是节点自身样式时
// 走「节点样式」分支（端口 `set_text` 的 nullish 口径）。
void set_text_keep_style(UINode& node, const std::u16string& text) {
  const Value* const s = field_of(node.text(), u"style");
  const bool node_style =
      s == nullptr || is_nullish(*s) || as_object(*s) == as_object(node.style.data());
  node.set_text(text, node_style ? Value() : *s);
}

std::shared_ptr<Object> num_prop() {
  auto p = std::make_shared<Object>();
  p->set(u"type", Value(u"number"));
  p->set(u"nullable", Value(true));
  return p;
}

void ensure_size(std::vector<std::optional<std::u16string>>& v, size_t n) {
  if (v.size() < n) v.resize(n);
}

void ensure_size(std::vector<std::optional<bool>>& v, size_t n) {
  if (v.size() < n) v.resize(n);
}

}

const ClazzTag* GamePrepareLogic::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& GamePrepareLogic::TAGS() {
  static const std::vector<std::u16string> tags{u"GamePrepareLogic"};
  return tags;
}

const std::u16string& GamePrepareLogic::props_tag() const {
  static const std::u16string tag = u"GamePrepareLogic";
  return tag;
}

const Value& GamePrepareLogic::PROPS() {
  static const Value props = [] {
    auto cls_prop = [](const char16_t* name) {
      auto p = std::make_shared<Object>();
      p->set(u"type", Value(u"$cls:" + std::u16string(name)));
      p->set(u"nullable", Value(true));
      return p;
    };
    auto o = std::make_shared<Object>();
    o->set(u"stage_switcher", Value(cls_prop(u"StageSwitcher")));
    o->set(u"bg_switcher", Value(cls_prop(u"BackgroundSwitcher")));
    auto mode = std::make_shared<Object>();
    mode->set(u"type", Value(u"string"));
    mode->set(u"nullable", Value(true));
    o->set(u"game_mode", Value(mode));
    o->set(u"players", Value(num_prop()));
    return Value(o);
  }();
  return props;
}

StageSwitcher* GamePrepareLogic::stage_switcher() {
  if (!ensure_props()) return nullptr;
  UIComponent* const c = ref_to_comp(props_holder.prop_instance(u"stage_switcher"));
  if (c == nullptr) return nullptr;
  return is_class(c->clazz(), StageSwitcher::class_tag()) ? static_cast<StageSwitcher*>(c)
                                                          : nullptr;
}

BackgroundSwitcher* GamePrepareLogic::bg_switcher() {
  if (!ensure_props()) return nullptr;
  UIComponent* const c = ref_to_comp(props_holder.prop_instance(u"bg_switcher"));
  if (c == nullptr) return nullptr;
  return is_class(c->clazz(), BackgroundSwitcher::class_tag())
             ? static_cast<BackgroundSwitcher*>(c)
             : nullptr;
}

std::optional<std::u16string> GamePrepareLogic::game_mode() {
  if (!ensure_props()) return std::nullopt;
  const Value v = props_holder.prop_value(u"game_mode");
  if (is_nullish(v)) return std::nullopt;
  return to_string(v);
}

double GamePrepareLogic::player_count() {
  if (!ensure_props()) return 1.0;
  const Value v = props_holder.prop_value(u"players");
  const double* const n = std::get_if<double>(&v);
  return n != nullptr && !std::isnan(*n) ? *n : 1.0;
}

bool GamePrepareLogic::auto_start_when_ready() {
  const std::optional<std::u16string> mode = game_mode();
  return mode.has_value() && *mode == kGameModeSurvival;
}

void GamePrepareLogic::subscribe_lfw() {
  if (!_removers.empty()) return;
  _removers.push_back(
      lfw().callbacks.on(u"on_lang_changed", [this](const LfwCallbacks::Payloads&) {
        render_rank_rows_text();
      }));
  _removers.push_back(
      lfw().callbacks.on(u"on_broadcast", [this](const LfwCallbacks::Payloads& p) {
        const std::u16string message = p.empty() ? std::u16string() : p[0].text;
        if (message == u"start_game") {
          start_game();
          return;
        }
        if (message == u"rank_refresh") {
          refresh_survival_rank();
          return;
        }
        const std::u16string prefix = u"rank_period_set_";
        if (message.size() >= prefix.size() && message.compare(0, prefix.size(), prefix) == 0) {
          const std::u16string period = message.substr(prefix.size());
          for (const std::u16string& p2 : rank_periods()) {
            if (p2 == period) {
              set_survival_rank_period(period);
              return;
            }
          }
        }
      }));
  _removers.push_back(
      lfw().callbacks.on(u"on_survival_rank_changed", [this](const LfwCallbacks::Payloads& p) {
        const std::optional<std::u16string> mode = game_mode();
        if (!mode.has_value() || *mode != kGameModeSurvival) return;
        const Value data = p.empty() ? Value() : p[0].value;
        if (!truthy(data)) {
          _rank_entries.clear();
          _rank_mine = Value(NullTag{});
          _rank_loaded = false;
          clear_rank_rows();
          return;
        }
        _rank_entries.clear();
        const Value* const list_v = field_of(data, u"list");
        const Array* const list = list_v != nullptr ? as_array(*list_v) : nullptr;
        if (list != nullptr) {
          const size_t n = std::min(list->size(), static_cast<size_t>(kRankLimit));
          for (size_t i = 0; i < n; ++i) _rank_entries.push_back(list->at(i));
        }
        const Value* const mine = field_of(data, u"mine");
        _rank_mine = mine != nullptr ? *mine : Value(NullTag{});
        _rank_loaded = true;
        render_rank_rows_text();
        UINode* const scroll = node.search_node(u"survival_rank_scroll");
        if (scroll != nullptr) {
          UIComponent* const c = scroll->find_component(ScrollView::class_tag());
          if (c != nullptr && is_class(c->clazz(), ScrollView::class_tag())) {
            static_cast<ScrollView*>(c)->scroll_to_start();
          }
        }
      }));
}

void GamePrepareLogic::unsubscribe_lfw() {
  for (std::function<void()>& r : _removers) {
    if (r) r();
  }
  _removers.clear();
}

void GamePrepareLogic::on_start() {
  UIComponent::on_start();
  subscribe_lfw();
}

void GamePrepareLogic::on_resume() {
  UINode* const background_row = node.search_node(u"background_row");
  UINode* const stage_row = node.search_node(u"stage_row");
  UIComponent* const c = node.search_component(CharMenuLogic::class_tag());
  CharMenuLogic* const char_menu_logic =
      c != nullptr && is_class(c->clazz(), CharMenuLogic::class_tag())
          ? static_cast<CharMenuLogic*>(c)
          : nullptr;
  const std::optional<std::u16string> mode = game_mode();
  if (mode.has_value() && *mode == kGameModeSurvival) {
    if (background_row != nullptr) {
      background_row->set_visible(false);
      background_row->set_disabled(true);
    }
    if (stage_row != nullptr) {
      stage_row->set_visible(false);
      stage_row->set_disabled(true);
    }
    if (char_menu_logic != nullptr) {
      char_menu_logic->set_teams({std::u16string(team_enum::kTeam_1)});
      char_menu_logic->set_min_player(player_count());
      char_menu_logic->set_max_player(player_count());
      char_menu_logic->set_oids(std::vector<std::u16string>(
          oid::survival_rank_oids().begin(), oid::survival_rank_oids().end()));
    }
  } else if (mode.has_value() && *mode == kGameModeStage) {
    if (stage_row != nullptr) {
      stage_row->set_visible(true);
      stage_row->set_disabled(false);
    }
    if (background_row != nullptr) {
      background_row->set_visible(false);
      background_row->set_disabled(true);
    }
    if (char_menu_logic != nullptr) {
      char_menu_logic->set_teams({std::u16string(team_enum::kTeam_1)});
    }
    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(1.0);
  } else {
    if (background_row != nullptr) {
      background_row->set_visible(true);
      background_row->set_disabled(false);
    }
    if (stage_row != nullptr) {
      stage_row->set_visible(false);
      stage_row->set_disabled(true);
    }
    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(2.0);
  }
  // 生存排行准备页：右侧刷新排行榜
  refresh_survival_rank();
  // 背景大头像/随机问号：跟随选角（未选默认 Julian）
  refresh_selection_face();
}

void GamePrepareLogic::update(double dt) {
  (void)dt;
  const std::optional<std::u16string> mode = game_mode();
  if (mode.has_value() && *mode == kGameModeSurvival) refresh_selection_face();
}

void GamePrepareLogic::refresh_selection_face() {
  UIComponent* const c = node.search_component(CharMenuLogic::class_tag());
  if (c == nullptr || !is_class(c->clazz(), CharMenuLogic::class_tag())) return;
  CharMenuLogic* const char_menu_logic = static_cast<CharMenuLogic*>(c);
  const double count = std::max(1.0, player_count());
  std::vector<SlotState*> slots;
  for (std::pair<PlayerInfo*, SlotState>& kv : char_menu_logic->players) {
    slots.push_back(&kv.second);
  }
  UINode* const countdown = node.search_node(u"countdown_text");
  const bool counting = countdown != nullptr && countdown->visible();
  for (size_t i = 0; i < static_cast<size_t>(count); ++i) {
    SlotState* const slot = i < slots.size() ? slots[i] : nullptr;
    const bool random = slot != nullptr && slot->random;
    // 随机状态不泄露抽到的角色 → 背景回退 Julian
    std::u16string bg_face;
    if (!random && slot != nullptr && truthy(slot->fighter)) {
      const Value* const base = field_of(slot->fighter, u"base");
      const Value* const face = base != nullptr ? field_of(*base, u"bg_face") : nullptr;
      if (face != nullptr && !is_nullish(*face)) bg_face = to_string(*face);
    }
    const std::u16string next = !bg_face.empty() ? bg_face : std::u16string(kDefaultBgFace);
    ensure_size(_bg_face_cur, i + 1);
    const bool changed = !_bg_face_cur[i].has_value() || *_bg_face_cur[i] != next;
    if (changed) {
      _bg_face_cur[i] = next;
      UINode* const face_node =
          node.search_node(i == 0 ? u"survival_bg_face" : u"survival_bg_face_r");
      if (face_node != nullptr) {
        UIComponent* const pic = face_node->search_component(Picture::class_tag());
        if (pic != nullptr && is_class(pic->clazz(), Picture::class_tag())) {
          static_cast<Picture*>(pic)->set_src(next);
        }
      }
    }
    UINode* mark = nullptr;
    if (i < char_menu_logic->slots.size() && char_menu_logic->slots[i].head != nullptr) {
      mark = char_menu_logic->slots[i].head->node.find_child(u"random_head");
    }
    if (mark == nullptr) continue;
    const bool show_mark = random && !counting;
    ensure_size(_random_mark_visible, i + 1);
    if (_random_mark_visible[i] != std::optional<bool>(show_mark)) {
      _random_mark_visible[i] = show_mark;
      mark->set_visible(show_mark);
    }
    ensure_size(_random_src_done, i + 1);
    if (show_mark && !_random_src_done[i].value_or(false)) {
      _random_src_done[i] = true;
      UIComponent* const pic = mark->search_component(Picture::class_tag());
      if (pic != nullptr && is_class(pic->clazz(), Picture::class_tag())) {
        static_cast<Picture*>(pic)->set_src(std::u16string(built_in_imgs::kRFACE));
      }
    }
    if (!show_mark) _random_src_done[i] = false;
  }
}

void GamePrepareLogic::layout_rank_rows() {
  UINode* const list = node.search_node(u"survival_rank_list");
  if (list == nullptr) return;
  double y = 0;
  for (UINode* const row : list->children()) {
    row->move_to(0.0, y, 0.0);
    y += kRankRowH + kRankRowGap;
  }
}

void GamePrepareLogic::refresh_survival_rank() {
  const std::optional<std::u16string> mode = game_mode();
  if (!mode.has_value() || *mode != kGameModeSurvival) return;
  layout_rank_rows();
  UINode* const title = node.search_node(u"survival_rank_title");
  UINode* const tabs = node.search_node(u"rank_period_tabs");
  UINode* const refresh = node.search_node(u"survival_rank_refresh");
  UINode* const scroll = node.search_node(u"survival_rank_scroll");
  UINode* const list = node.search_node(u"survival_rank_list");
  UINode* const my_node = node.search_node(u"survival_rank_my");
  if (title == nullptr && scroll == nullptr && list == nullptr) return;
  const bool available = lfw().survival_rank_available();
  if (title != nullptr) title->set_visible(available);
  if (tabs != nullptr) tabs->set_visible(available);
  if (refresh != nullptr) refresh->set_visible(available);
  if (scroll != nullptr) scroll->set_visible(available);
  if (my_node != nullptr) my_node->set_visible(available);
  _rank_board_shown = available;
  if (!available) {
    clear_rank_rows();
    UINode* const under = node.search_node(u"rank_sel_underline");
    if (under != nullptr) under->set_visible(false);
    return;
  }
  update_rank_period_tabs();
  // 用外部最近一次下发的数据渲染（尚未下发时隐藏全部行）
  if (_rank_loaded) render_rank_rows_text();
  else clear_rank_rows();
  // 请求外部(宿主 App)按当前周期拉取最新数据；数据到达后经 on_survival_rank_changed 更新本页
  lfw().survival_rank_period = rank_period;
  lfw().survival_rank_2p = player_count() >= 2;
  lfw().broadcast(Value(kBroadcastRankRequest));
}

void GamePrepareLogic::render_rank_rows_text() {
  UINode* const list = node.search_node(u"survival_rank_list");
  UINode* const my_node = node.search_node(u"survival_rank_my");
  if (list == nullptr || !_rank_loaded || !_rank_board_shown) return;
  const std::vector<UINode*>& rows = list->children();
  const std::vector<Value>& entries = _rank_entries;
  const bool empty = entries.empty();
  const size_t shown = empty ? 1 : entries.size();
  for (size_t i = 0; i < rows.size(); ++i) {
    UINode* const row = rows[i];
    const bool visible = i < shown;
    row->set_visible(visible);
    // 偶数行（i 为 0 基 → 排名 i+1 为偶数）加极淡白底
    row->color = (i & 1) ? std::u16string(kRankRowEvenBg) : std::u16string();
    if (!visible) continue;
    const std::vector<UINode*>& cells = row->children();
    auto cell = [&](size_t idx) -> UINode* { return idx < cells.size() ? cells[idx] : nullptr; };
    if (empty) {
      for (size_t c = 0; c < cells.size(); ++c) {
        UINode* const n = cell(c);
        if (n != nullptr) set_text_keep_style(*n, std::u16string());
      }
      UINode* const n1 = cell(1);
      if (n1 != nullptr) {
        set_text_keep_style(*n1, to_string(lfw().string(Value(u"survival.board_empty"))));
      }
      continue;
    }
    const Value& v = entries[i];
    UINode* const n0 = cell(0);
    if (n0 != nullptr) set_text_keep_style(*n0, to_string(field_or(v, u"rank")) + u".");
    UINode* const n1 = cell(1);
    if (n1 != nullptr) {
      std::u16string names;
      const Value* const nickname = field_of(v, u"nickname");
      const Value* const player2 = field_of(v, u"player2");
      if (nickname != nullptr && truthy(*nickname)) names += to_string(*nickname);
      if (player2 != nullptr && truthy(*player2)) {
        if (!names.empty()) names += u" & ";
        names += to_string(*player2);
      }
      set_text_keep_style(*n1, names);
    }
    UINode* const n2 = cell(2);
    if (n2 != nullptr) {
      std::u16string fighters;
      const Value* const fighter = field_of(v, u"fighter");
      const Value* const fighter2 = field_of(v, u"fighter2");
      std::vector<std::u16string> list_txt;
      if (fighter != nullptr && truthy(*fighter)) {
        list_txt.push_back(to_string(lfw().string(*fighter)));
      }
      if (fighter2 != nullptr && truthy(*fighter2)) {
        list_txt.push_back(to_string(lfw().string(*fighter2)));
      }
      for (size_t k = 0; k < list_txt.size(); ++k) {
        if (list_txt[k].empty()) continue;
        if (!fighters.empty()) fighters += u" & ";
        fighters += list_txt[k];
      }
      set_text_keep_style(*n2, fighters);
    }
    UINode* const n3 = cell(3);
    if (n3 != nullptr) {
      const Value* const score = field_of(v, u"score");
      set_text_keep_style(*n3,
                          i18n_fmt(to_string(lfw().string(Value(u"survival.floor_reached"))),
                                   {score != nullptr ? *score : Value(0.0)}));
    }
  }
  if (my_node != nullptr) {
    my_node->set_visible(true);
    const std::u16string txt =
        truthy(_rank_mine)
            ? i18n_fmt(to_string(lfw().string(Value(u"survival.my_rank_ranked"))),
                       {field_or(_rank_mine, u"rank"),
                        Value(i18n_fmt(
                            to_string(lfw().string(Value(u"survival.floor_reached"))),
                            {field_or(_rank_mine, u"score")}))})
            : to_string(lfw().string(Value(u"survival.my_rank_unranked")));
    set_text_keep_style(*my_node, txt);
  }
}

void GamePrepareLogic::clear_rank_rows() {
  UINode* const list = node.search_node(u"survival_rank_list");
  if (list != nullptr) {
    for (UINode* const row : list->children()) row->set_visible(false);
  }
  UINode* const my_node = node.search_node(u"survival_rank_my");
  if (my_node != nullptr) my_node->set_visible(false);
}

void GamePrepareLogic::update_rank_period_tabs() {
  UINode* const under = node.search_node(u"rank_sel_underline");
  bool any_selected = false;
  for (const std::u16string& p : rank_periods()) {
    UINode* const n = node.search_node(u"survival_rank_period_" + p);
    if (n == nullptr) continue;
    const bool selected = p == rank_period;
    n->style.set_fill_style(Value(std::u16string(selected ? u"#ffffff" : u"#9b9bff")));
    const std::u16string txt =
        to_string(lfw().string(Value(u"survival.rank_period_" + p)));
    n->set_text(txt);
    n->set_opacity(selected ? 1.0 : 0.5);
    if (!selected) continue;
    any_selected = true;
    if (under != nullptr) {
      const UINode::Geo& g = n->geo();
      const double w = std::max((g.right - g.left) > 0.0 ? (g.right - g.left) : 8.0, 8.0);
      under->size.x = w;
      under->size.y = 2;
      under->size.z = 0;
      under->move_to_global((g.left + g.right) / 2.0 - w / 2.0, g.bottom + 2.0, 0.0);
    }
  }
  if (under != nullptr) under->set_visible(any_selected);
}

void GamePrepareLogic::set_survival_rank_period(const std::u16string& p) {
  if (rank_period == p) return;
  rank_period = p;
  refresh_survival_rank();
}

// 生存排行：把 world dataset 重置为默认值（**包括**难度 —— 生存排行恒为苦难，
// 见 TS `GamePrepareLogic.reset_world_dataset`）。
void GamePrepareLogic::reset_world_dataset() {
  WorldDataset& ds = world().dataset;
  const WorldDataset fresh;
  const Value dump = fresh.dump_dataset();
  const Object* const o = as_object(dump);
  if (o != nullptr) {
    for (const std::u16string& k : o->keys()) {
      const Value* const v = o->get(k);
      if (v != nullptr) ds.set(k, *v);
    }
  }
  ds.set(u"playrate", Value(1.0));
}

void GamePrepareLogic::on_stop() {
  lfw().change_stage(std::u16string());
  lfw().change_bg(std::u16string());
  unsubscribe_lfw();
}

void GamePrepareLogic::start_game() {
  UIComponent* const c = node.search_component(CharMenuLogic::class_tag());
  if (c == nullptr || !is_class(c->clazz(), CharMenuLogic::class_tag())) return;
  CharMenuLogic* const char_menu_logic = static_cast<CharMenuLogic*>(c);
  // 战斗数据包可能尚未加载完(随机池为空)：此时不换场景，避免进到空场地
  for (const std::pair<PlayerInfo*, SlotState>& kv : char_menu_logic->players) {
    if (truthy(kv.second.fighter)) continue;
    lfw().host().warn(
        {Value(u"[GamePrepareLogic::start_game] fighter data missing, start canceled")});
    return;
  }

  StageSwitcher* const stage_sw = stage_switcher();
  BackgroundSwitcher* const bg_sw = bg_switcher();
  const std::optional<std::u16string> mode = game_mode();
  const bool is_survival_rank = mode.has_value() && *mode == kGameModeSurvival;
  if (is_survival_rank) reset_world_dataset();
  std::optional<Value> survival_stage;
  if (is_survival_rank) {
    const std::vector<Value>& stages = lfw().datas().stages();
    for (const Value& v : stages) {
      if (equals(field_or(v, u"chapter"), Value(std::u16string(u"survival"))) &&
          truthy(field_or(v, u"is_starting"))) {
        survival_stage = v;
        break;
      }
    }
    if (!survival_stage.has_value()) {
      for (const Value& v : stages) {
        if (equals(field_or(v, u"id"), Value(std::u16string(u"50")))) {
          survival_stage = v;
          break;
        }
      }
    }
  }
  if (survival_stage.has_value()) {
    const Value bg_id = field_or(*survival_stage, u"bg");
    const std::vector<Value>& bgs = lfw().datas().backgrounds();
    std::u16string id;
    for (const Value& b : bgs) {
      if (!equals(field_or(b, u"id"), bg_id)) continue;
      id = to_string(field_or(b, u"id"));
      break;
    }
    lfw().change_bg(id);
  } else if (stage_sw != nullptr && stage_sw->node.visible() && !stage_sw->node.disabled()) {
    const Value stage = stage_sw->stage();
    const Value bg = field_or(stage, u"bg");
    lfw().change_bg(is_nullish(bg) ? std::u16string() : to_string(bg));
  } else if (bg_sw != nullptr && bg_sw->node.visible() && !bg_sw->node.disabled()) {
    const Value bg = bg_sw->background();
    lfw().change_bg(to_string(field_or(bg, u"id")));
  }

  const Background* const bg = world().bg();
  const double far = bg->far_plane();
  const double near_v = bg->near_plane();
  const double left = bg->left();
  const double right = bg->right();
  const bool is_stage_mode =
      is_survival_rank || (mode.has_value() && *mode == kGameModeStage);
  const bool is_vs_mode = mode.has_value() && *mode == kGameModeVs;

  lfw().srank_mode = false;
  MersenneTwister* const mt = lfw().mt();
  mt->mark = u"gpl_start_game_cam_x";
  const double cam_x =
      is_stage_mode ? 0.0
                    : mt->range(left, right - defines::num(u"Defines.MODERN_SCREEN_WIDTH"));

  for (std::pair<PlayerInfo*, SlotState>& kv : char_menu_logic->players) {
    PlayerInfo* const player = kv.first;
    const bool is_com = player->is_com();
    const Value& fighter_data = kv.second.fighter;
    if (!truthy(fighter_data)) {
      lfw().host().warn({Value(u"[GamePrepareLogic::start_game] failed to create fighter. figher data: " +
                               to_string(fighter_data))});
      continue;
    }
    Entity* const fighter =
        is_com ? lfw().create_entity_with_bot(player->id(), world(), fighter_data)
               : lfw().create_entity_with_player(player->id(), world(), fighter_data);
    if (fighter == nullptr) {
      lfw().host().warn({Value(u"[GamePrepareLogic::start_game] failed to create fighter. figher data: " +
                               to_string(fighter_data))});
      continue;
    }
    fighter->set_team(truthy(kv.second.team) ? kv.second.team : lfw().new_team());
    fighter->stat_bar = 0;
    if (is_stage_mode) {
      fighter->facing = static_cast<double>(FacingFlag::Right);
    } else {
      const std::optional<double> pick = mt->pick(std::vector<double>{
          static_cast<double>(FacingFlag::Left), static_cast<double>(FacingFlag::Right)});
      fighter->facing = pick.value_or(0.0);
    }
    fighter->name_visible = 1;
    fighter->as_key_role(Value(true));
    const double xx1 = is_stage_mode ? 40.0 : 1.0 * screen_width() / 3.0;
    const double xx2 = is_stage_mode ? 80.0 : 2.0 * screen_width() / 3.0;
    if (is_survival_rank) {
      fighter->set_hp(2000);
      fighter->set_hp_max(2000);
      fighter->set_mp(1000);
      fighter->set_mp_max(1000);
    } else if (is_stage_mode) {
      const double difficulty = to_number(world().dataset.get(u"difficulty"));
      fighter->set_hp(difficulty_hp(difficulty));
      fighter->set_hp_max(difficulty_hp(difficulty));
      fighter->set_mp(difficulty_hp(difficulty));
      fighter->set_mp_max(difficulty_hp(difficulty));
    }
    mt->mark = u"gpl_fighter_x";
    const double x = mt->range(xx1, xx2) + cam_x;
    mt->mark = u"gpl_fighter_z";
    const double z = mt->range(far, near_v);
    const ITerrainInfo& seg = world().ground.segment(x, z);
    const double y = Ground::y(seg, x, z);
    fighter->set_position(Value(x), Value(y), Value(z));
    fighter->set_blinking(to_number(world().dataset.get(u"begin_blink_time")));
    fighter->set_invulnerable(to_number(world().dataset.get(u"begin_blink_time")));
    if (is_vs_mode) fighter->set_mp(fighter->mp_max() * 2.0 / 5.0);
    fighter->attach();
  }

  UILayer* const layer = node.layer();
  if (is_survival_rank) {
    lfw().change_stage(survival_stage.has_value() ? to_string(field_or(*survival_stage, u"id"))
                                                  : std::u16string(u"50"));
    lfw().srank_mode = true;
    if (layer != nullptr) {
      UIPushPageOpts opts;
      opts.id = u"stage_mode_page";
      opts.has_id = true;
      layer->push(opts);
    }
  } else if (is_stage_mode) {
    if (stage_sw != nullptr) {
      const Value stage = stage_sw->stage();
      const Value id = field_or(stage, u"id");
      lfw().change_stage(is_nullish(id) ? std::u16string() : to_string(id));
    }
    if (layer != nullptr) {
      UIPushPageOpts opts;
      opts.id = u"stage_mode_page";
      opts.has_id = true;
      layer->push(opts);
    }
  } else {
    if (layer != nullptr) {
      UIPushPageOpts opts;
      opts.id = u"vs_mode_page";
      opts.has_id = true;
      layer->push(opts);
    }
  }
  world().camera().jump_x(cam_x);
}

}
}
