#pragma once

#include <optional>
#include <string>
#include <vector>

#include "lfw/ui/component/ui_component.h"

namespace lfw {
namespace ui {

class BackgroundSwitcher;
class CharMenuLogic;
class StageSwitcher;
class UINode;

// TS `ui/component/GamePrepareLogic.ts`（TAGS = ["GamePrepareLogic"]）。
// 准备页逻辑：选角菜单（`CharMenuLogic`）的页面级设置、生存排行榜单，与开局造人。
class GamePrepareLogic : public UIComponent {
 public:
  static constexpr const char* TAG = "GamePrepareLogic";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();
  static const Value& PROPS();

  using UIComponent::UIComponent;

  const ClazzTag* clazz() const override { return class_tag(); }
  const std::u16string& props_tag() const override;
  const Value& props_meta() const override { return PROPS(); }

  StageSwitcher* stage_switcher();
  BackgroundSwitcher* bg_switcher();
  /** TS `this.props.game_mode`（"vs_mode" / "stage_mode" / "survival"） */
  std::optional<std::u16string> props_game_mode();
  /** TS `get game_mode()`：本准备页对应的对局模式（生存排行按玩家数分单人/双人） */
  std::u16string game_mode();
  double player_count();
  bool auto_start_when_ready();

  void on_start() override;
  void on_resume() override;
  void update(double dt) override;
  void on_stop() override;
  void start_game();

 protected:
  void refresh_selection_face();
  void layout_rank_rows();
  void refresh_survival_rank();
  void render_rank_rows_text();
  void clear_rank_rows();
  void update_rank_period_tabs();
  void set_survival_rank_period(const std::u16string& p);
  void reset_world_dataset();

  void subscribe_lfw();
  void unsubscribe_lfw();

  std::u16string rank_period = u"all";
  std::vector<Value> _rank_entries;
  Value _rank_mine = Value(NullTag{});
  bool _rank_loaded = false;
  bool _rank_board_shown = false;
  std::vector<std::optional<std::u16string>> _bg_face_cur;
  std::vector<std::optional<bool>> _random_mark_visible;
  std::vector<std::optional<bool>> _random_src_done;
  std::vector<std::function<void()>> _removers;
};

}
}
