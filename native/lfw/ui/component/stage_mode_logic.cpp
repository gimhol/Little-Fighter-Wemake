#include "lfw/ui/component/stage_mode_logic.h"

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/game_mode.h"
#include "lfw/defines/stage_actions.h"
#include "lfw/lfw.h"
#include "lfw/stage/stage.h"
#include "lfw/ui/component/components_player.h"
#include "lfw/ui/component/fighter_stat_bar.h"
#include "lfw/ui/component/jalousie.h"
#include "lfw/ui/component/mode_state.h"
#include "lfw/ui/ui_event.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/is_class.h"

namespace lfw {
namespace ui {

namespace {

// JS `/p(\d)_stat/` 的首个匹配（捕获一位数字）；无匹配 ⇒ undefined（`Number(undefined)` = NaN，
// 与任何数比较都为 false）。
std::optional<double> stat_index_of(const std::u16string& id) {
  for (size_t i = 0; i + 2 <= id.size(); ++i) {
    if (id[i] != u'p') continue;
    size_t j = i + 1;
    const size_t d0 = j;
    while (j < id.size() && id[j] >= u'0' && id[j] <= u'9') ++j;
    if (j - d0 != 1) continue;
    if (j + 5 > id.size()) continue;
    if (id.compare(j, 5, u"_stat") != 0) continue;
    return to_number(Value(id.substr(d0, 1)));
  }
  return std::nullopt;
}

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// `stage.data.chapter` 读串（缺失/非串 ⇒ 空串；`=== 'survival'` 比较用）。
std::u16string chapter_of(const stage::Stage* stage) {
  if (stage == nullptr) return std::u16string();
  const Value chapter = field_or(stage->data(), u"chapter");
  return std::holds_alternative<std::u16string>(chapter) ? std::get<std::u16string>(chapter)
                                                         : std::u16string();
}

// JS `arr?.length` 的真值（数组且非空）。
bool array_non_empty(const Value& v) {
  if (!std::holds_alternative<std::shared_ptr<Array>>(v)) return false;
  return !std::get<std::shared_ptr<Array>>(v)->empty();
}

void stop_gogogo(ComponentsPlayer* p) {
  if (p == nullptr) return;
  p->stop();
  p->node.set_visible(false);
  p->node.set_opacity(0);
}

}

const ClazzTag* StageModeLogic::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& StageModeLogic::TAGS() {
  static const std::vector<std::u16string> tags{u"StageModeLogic"};
  return tags;
}

StageModeLogic::StageModeLogic(UINode& layout, const std::u16string& f_name, const Value& info)
    : UIComponent(layout, f_name, info) {
  _states.push_back(std::make_unique<GameModeFSMState_Running>(*this));
  _states.push_back(std::make_unique<GameModeFSMState_BeforeEnd>(*this));
  _states.push_back(std::make_unique<GameModeFSMState_End>(*this));
  _fsm.add(_states[0].get(), _states[1].get(), _states[2].get());
}

void StageModeLogic::remove_listeners() {
  if (_stage_remover_pc) {
    _stage_remover_pc();
    _stage_remover_pc = nullptr;
  }
  if (_stage_remover_req) {
    _stage_remover_req();
    _stage_remover_req = nullptr;
  }
  if (_world_remover) {
    _world_remover();
    _world_remover = nullptr;
  }
}

void StageModeLogic::listen_stage(stage::Stage* stage) {
  if (_stage_remover_pc) {
    _stage_remover_pc();
    _stage_remover_pc = nullptr;
  }
  if (_stage_remover_req) {
    _stage_remover_req();
    _stage_remover_req = nullptr;
  }
  if (stage == nullptr) return;
  _stage_remover_pc = stage->callbacks().on(
      u"on_phase_changed", [this](const stage::StageCallbacks::Payloads& p) {
        for (const stage::StageCallbackArgs& a : p) handle_phase_changed(a);
      });
  _stage_remover_req = stage->callbacks().on(
      u"on_requrie_goto_next_stage", [this](const stage::StageCallbacks::Payloads& p) {
        (void)p;
        if (_jalousie != nullptr) _jalousie->set_open(false);
      });
}

void StageModeLogic::handle_phase_changed(const stage::StageCallbackArgs& a) {
  stage::Stage* const stage = a.stage;
  const Value& curr = a.a;
  const Value& prev = a.b;
  if (is_survival_rank_mode(lfw().game_mode()) && !lfw().survival_rank_invalid() &&
      chapter_of(stage) == u"survival" && lfw().on_survival_rank_phase) {
    lfw().on_survival_rank_phase(stage->phase_idx());
  }
  if (stage == nullptr || stage->is_chapter_finish()) return;
  if (is_nullish(prev)) {
    stop_gogogo(_gogogo);
    stop_gogogo(_gogogo_loop);
  }
  const Value on_end = is_nullish(prev) ? Value() : field_or(prev, u"on_end");
  const Value on_start = is_nullish(curr) ? Value() : field_or(curr, u"on_start");
  if (array_non_empty(on_end)) handle_stage_actions(on_end);
  if (array_non_empty(on_start)) handle_stage_actions(on_start);
}

void StageModeLogic::handle_stage_actions(const Value& actions) {
  if (!std::holds_alternative<std::shared_ptr<Array>>(actions)) return;
  const std::vector<Value>& items = std::get<std::shared_ptr<Array>>(actions)->items();
  for (const Value& action : items) {
    if (!std::holds_alternative<std::u16string>(action)) continue;
    const std::u16string& name = std::get<std::u16string>(action);
    if (name == stage_actions::kGoGoGoRight) {
      if (_gogogo != nullptr) {
        _gogogo->start();
        _gogogo->node.set_visible(true);
      }
    } else if (name == stage_actions::kLoopGoGoGoRight) {
      if (_gogogo_loop != nullptr) {
        _gogogo_loop->start();
        _gogogo_loop->node.set_visible(true);
      }
    }
  }
}

void StageModeLogic::on_start() {
  UIComponent::on_start();
  if (world().paused()) world().set_paused(false);

  UIComponent* const jc = node.search_component(Jalousie::class_tag());
  _jalousie = jc != nullptr && is_class(jc->clazz(), Jalousie::class_tag())
                  ? static_cast<Jalousie*>(jc)
                  : nullptr;
  UIComponent* const gg = node.search_component_by_id(ComponentsPlayer::class_tag(), u"play_gogogo");
  _gogogo = gg != nullptr ? static_cast<ComponentsPlayer*>(gg) : nullptr;
  UIComponent* const ggl =
      node.search_component_by_id(ComponentsPlayer::class_tag(), u"play_gogogo_loop");
  _gogogo_loop = ggl != nullptr ? static_cast<ComponentsPlayer*>(ggl) : nullptr;
  _rank_hint_cheat = node.search_node(u"survival_rank_hint_cheat");
  _rank_hint_mods = node.search_node(u"survival_rank_hint_mods");

  std::vector<FighterStatBar*> stat_bars;
  for (UIComponent* const c : node.search_components(FighterStatBar::class_tag())) {
    if (c != nullptr && is_class(c->clazz(), FighterStatBar::class_tag())) {
      stat_bars.push_back(static_cast<FighterStatBar*>(c));
    }
  }

  double player_count = 0;
  for (const std::pair<std::u16string, Entity*>& kv : world().puppets) {
    if (kv.second != nullptr) player_count += 1;
  }
  for (size_t i = 0; i < stat_bars.size();) {
    FighterStatBar* const stat_bar = stat_bars[i];
    // TS 的 `node.id?.match(...)`：id 缺失 ⇒ undefined（`Number(undefined)` = NaN ⇒ 不启用）。
    const Value id_value = stat_bar->node.id();
    const std::u16string id =
        std::holds_alternative<std::u16string>(id_value) ? std::get<std::u16string>(id_value)
                                                         : std::u16string();
    const std::optional<double> n = stat_index_of(id);
    const bool enabled = n.has_value() && player_count >= *n;
    stat_bar->node.set_visible(enabled);
    stat_bar->node.set_disabled(!enabled);
    if (enabled) {
      ++i;
      continue;
    }
    stat_bars.erase(stat_bars.begin() + static_cast<std::ptrdiff_t>(i));
  }

  for (const std::pair<std::u16string, Entity*>& kv : world().puppets) {
    if (kv.second == nullptr) continue;
    if (stat_bars.empty()) break;
    FighterStatBar* const stat_bar = stat_bars.front();
    stat_bars.erase(stat_bars.begin());
    stat_bar->set_entity(kv.second);
  }

  _fsm.use(Value(mode_state_str(ModeState::Running)));
  world().set_paused(false);
  world().dataset.set(u"playrate", Value(1.0));
  world().dataset.set(u"infinity_mp", Value(0.0));

  listen_stage(world().stage());
  // TS `callbacks.add(this.world_callbacks)` 靠对象同一性去重（Set）⇒ 重复 on_start 不能重复订阅。
  if (!_world_remover) {
    _world_remover = world().callbacks.on(
        u"on_stage_change", [this](const WorldCallbacks::Payloads& p) {
          for (const WorldCallbackArgs& a : p) {
            listen_stage(a.stage);
            stop_gogogo(_gogogo);
            stop_gogogo(_gogogo_loop);
            if (_jalousie != nullptr) _jalousie->set_open(true);
          }
        });
  }

  if (is_survival_rank_mode(lfw().game_mode()) && !lfw().survival_rank_invalid() &&
      chapter_of(world().stage()) == u"survival" && lfw().on_survival_rank_phase) {
    lfw().on_survival_rank_phase(world().stage()->phase_idx());
  }
}

void StageModeLogic::on_stop() {
  UIComponent::on_stop();
  lfw().game_mode_value.reset();
  world().clear();
  remove_listeners();
}

void StageModeLogic::update(double dt) {
  if (is_survival_rank_mode(lfw().game_mode())) {
    if (_rank_hint_cheat != nullptr) _rank_hint_cheat->set_visible(lfw().survival_rank_cheated());
    if (_rank_hint_mods != nullptr) _rank_hint_mods->set_visible(lfw().survival_rank_modded());
  }
  if (_jalousie != nullptr && !_jalousie->open() && _jalousie->anim().done()) {
    lfw().goto_next_stage();
    _fsm.use(Value(mode_state_str(ModeState::Running)));
    _jalousie->set_open(true);
  }
  _fsm.update(dt);
}

void StageModeLogic::on_key_down(LFWKeyEvent& e) {
  if (e.game_key == gk::ka || e.game_key == gk::kj) {
    const bool end_state = _fsm.state() != nullptr && strict_equals(_fsm.state()->key(), Value(u"End"));
    if (end_state && _fsm.state_time() > 1000) {
      stage::Stage* const stage = world().stage();
      if (stage != nullptr && stage->is_chapter_finish()) {
        lfw().goto_next_stage();
        _fsm.use(Value(mode_state_str(ModeState::Running)));
      } else {
        UIPopPageOpts opts;
        opts.min_pages = 1;
        node.pop_page(opts);
      }
    }
  }
}

}
}
