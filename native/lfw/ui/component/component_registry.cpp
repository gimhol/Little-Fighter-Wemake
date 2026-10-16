#include "lfw/ui/component/component_registry.h"

#include <memory>
#include <string>

#include "lfw/ui/component/background_switcher.h"
#include "lfw/ui/component/bgm_switcher.h"
#include "lfw/ui/component/camera_ctrl.h"
#include "lfw/ui/component/char_menu.h"
#include "lfw/ui/component/char_menu_head.h"
#include "lfw/ui/component/components_player.h"
#include "lfw/ui/component/demo_mode_logic.h"
#include "lfw/ui/component/difficulty_text.h"
#include "lfw/ui/component/game_prepare_logic.h"
#include "lfw/ui/component/launch_page_logic.h"
#include "lfw/ui/component/little_funny_auto_game.h"
#include "lfw/ui/component/alignment.h"
#include "lfw/ui/component/ending_page_logic.h"
#include "lfw/ui/component/extra_zip_text.h"
#include "lfw/ui/component/fade_in_opacity.h"
#include "lfw/ui/component/fade_out_opacity.h"
#include "lfw/ui/component/fit_children.h"
#include "lfw/ui/component/flex_item.h"
#include "lfw/ui/component/fn_keys_counts.h"
#include "lfw/ui/component/focus_behavior.h"
#include "lfw/ui/component/fighter_name.h"
#include "lfw/ui/component/hide_when_dialoging.h"
#include "lfw/ui/component/loading_content_text.h"
#include "lfw/ui/component/horizontal_layout.h"
#include "lfw/ui/component/hover_behavior.h"
#include "lfw/ui/component/img_loop.h"
#include "lfw/ui/component/integer_picker.h"
#include "lfw/ui/component/label_button.h"
#include "lfw/ui/component/main_menu_logic.h"
#include "lfw/ui/component/misc_settings_logic.h"
#include "lfw/ui/component/move_table/move_table_logic.h"
#include "lfw/ui/component/settings_logic.h"
#include "lfw/ui/component/stage_mode_logic.h"
#include "lfw/ui/component/vs_mode_logic.h"
#include "lfw/ui/component/opacity_animation.h"
#include "lfw/ui/component/opacity_flash.h"
#include "lfw/ui/component/opacity_hover.h"
#include "lfw/ui/component/pause_handling.h"
#include "lfw/ui/component/picture.h"
#include "lfw/ui/component/players.h"
#include "lfw/ui/component/player_key_text.h"
#include "lfw/ui/component/player_key_edit.h"
#include "lfw/ui/component/player_ctrl_type.h"
#include "lfw/ui/component/player_name.h"
#include "lfw/ui/component/player_name_input.h"
#include "lfw/ui/component/player_team_name.h"
#include "lfw/ui/component/playing_time_text.h"
#include "lfw/ui/component/position_animation.h"
#include "lfw/ui/component/prefix_and_difficulty_text.h"
#include "lfw/ui/component/random_visible.h"
#include "lfw/ui/component/reachable.h"
#include "lfw/ui/component/reachable_group.h"
#include "lfw/ui/component/scale_animation.h"
#include "lfw/ui/component/scale_clickable.h"
#include "lfw/ui/component/sine_opacity.h"
#include "lfw/ui/component/sounds.h"
#include "lfw/ui/component/stage_title_show.h"
#include "lfw/ui/component/stage_transitions.h"
#include "lfw/ui/component/weapon_rain.h"
#include "lfw/ui/component/fighter_head.h"
#include "lfw/ui/component/fighter_thumb.h"
#include "lfw/ui/component/stage_title_text.h"
#include "lfw/ui/component/stage_switcher.h"
#include "lfw/ui/component/flex.h"
#include "lfw/ui/component/jalousie.h"
#include "lfw/ui/component/dialogs.h"
#include "lfw/ui/component/slider_handle.h"
#include "lfw/ui/component/arrow_switcher.h"
#include "lfw/ui/component/switcher_handle.h"
#include "lfw/ui/component/scroll_view.h"
#include "lfw/ui/component/summary_logic.h"
#include "lfw/ui/component/danmu_game_logic.h"
#include "lfw/ui/component/fighter_stat_bar.h"
#include "lfw/ui/component/player_score.h"
#include "lfw/ui/component/player_score_cell.h"
#include "lfw/ui/component/player_score_player_name.h"
#include "lfw/ui/component/team_situation_text.h"
#include "lfw/ui/component/tests/tests.h"
#include "lfw/ui/component/vertical_layout.h"
#include "lfw/ui/component/wrap_content.h"

namespace lfw {
namespace ui {

namespace {

template <typename T>
void regist_one(const char16_t* name) {
  regist_ui_class(T::class_tag(), name);
  static const ComponentCreatorT<T> creator;
  Factory::register_component(std::u16string(name), &creator);
}

}

void regist_components() {
  static bool registed = false;
  if (registed) return;
  registed = true;

  regist_one<FocusBehavior>(u"FocusBehavior");
  regist_one<HoverBehavior>(u"HoverBehavior");
  regist_one<OpacityHover>(u"OpacityHover");
  regist_one<SineOpacity>(u"SineOpacity");
  regist_one<FadeInOpacity>(u"FadeInOpacity");
  regist_one<FadeOutOpacity>(u"FadeOutOpacity");
  regist_one<OpacityAnimation>(u"OpacityAnimation");
  regist_one<OpacityFlash>(u"OpacityFlash");
  regist_one<ScaleAnimation>(u"ScaleAnimation");
  regist_one<PositionAnimation>(u"PositionAnimation");
  regist_one<ScaleClickable>(u"ScaleClickable");
  regist_one<PauseHandling>(u"PauseHandling");
  regist_one<FlexItem>(u"FlexItem");
  regist_one<VerticalLayout>(u"VerticalLayout");
  regist_one<HorizontalLayout>(u"HorizontalLayout");
  regist_one<FitChildren>(u"FitChildren");
  regist_one<WrapContent>(u"WrapContent");
  regist_one<Picture>(u"Picture");
  regist_one<Picture>(u"Image");
  regist_one<ImgLoop>(u"ImgLoop");
  regist_one<Reachable>(u"Reachable");
  regist_one<ReachableGroup>(u"ReachableGroup");
  regist_one<DifficultyText>(u"DifficultyText");
  regist_one<DifficultyText>(u"difficulty_text");
  regist_one<PlayingTimeText>(u"PlayingTimeText");
  regist_one<FnKeysCounts>(u"FnKeysCounts");
  regist_one<ExtraZipText>(u"ExtraZipText");
  regist_one<PrefixAndDifficultyText>(u"PrefixAndDifficultyText");
  regist_one<StageTitleText>(u"StageTitleText");
  regist_one<StageTitleShow>(u"StageTitleShow");
  regist_one<HideWhenDialoging>(u"HideWhenDialoging");
  regist_one<LoadingContentText>(u"LoadingContentText");
  regist_one<PlayerKeyText>(u"PlayerKeyText");
  regist_one<PlayerKeyEdit>(u"PlayerKeyEdit");
  regist_one<TextInput>(u"TextInput");
  regist_one<PlayerNameInput>(u"PlayerNameInput");
  regist_one<PlayerName>(u"PlayerName");
  regist_one<PlayerTeamName>(u"PlayerTeamName");
  regist_one<FighterName>(u"FighterName");
  regist_one<RandomVisible>(u"RandomVisible");
  regist_one<IntegerPicker>(u"IntegerPicker");
  regist_one<Alignment>(u"Alignment");
  regist_one<Players>(u"Players");
  regist_one<Sounds>(u"Sounds");
  regist_one<StageTransitions>(u"StageTransitions");
  regist_one<LabelButton>(u"LabelButton");
  regist_one<PlayerCtrlType>(u"PlayerCtrlType");
  regist_one<WeaponRain>(u"WeaponRain");
  regist_one<FighterHead>(u"FighterHead");
  regist_one<FighterThumb>(u"FighterThumb");
  regist_one<ComponentsPlayer>(u"ComponentsPlayer");
  regist_one<StageSwitcher>(u"StageSwitcher");
  regist_one<BackgroundSwitcher>(u"BackgroundSwitcher");
  regist_one<BGMSwitcher>(u"BGMSwitcher");
  regist_one<Flex>(u"Flex");
  regist_one<Jalousie>(u"Jalousie");
  regist_one<Dialogs>(u"Dialogs");
  regist_one<SliderHandle>(u"SliderHandle");
  regist_one<ArrowSwitcher>(u"ArrowSwitcher");
  regist_one<SwitcherHandle>(u"SwitcherHandle");
  regist_one<ScrollView>(u"ScrollView");
  regist_one<SummaryLogic>(u"SummaryLogic");
  regist_one<FighterStatBar>(u"FighterStatBar");
  regist_one<PlayerScore>(u"PlayerScore");
  regist_one<PlayerScoreCell>(u"PlayerScoreCell");
  regist_one<PlayerScorePlayerName>(u"PlayerScorePlayerName");
  regist_one<TeamSituationText>(u"TeamSituationText");
  regist_one<CameraCtrl>(u"CameraCtrl");
  regist_one<EndingPageLogic>(u"EndingPageLogic");
  regist_one<MainMenuLogic>(u"MainMenuLogic");
  regist_one<SettingsLogic>(u"SettingsLogic");
  regist_one<VsModeLogic>(u"VsModeLogic");
  regist_one<StageModeLogic>(u"StageModeLogic");
  regist_one<MiscSettingsLogic>(u"MiscSettingsLogic");
  regist_one<DemoModeLogic>(u"DemoModeLogic");
  regist_one<CharMenuHead>(u"CharMenuHead");
  regist_one<CharMenuLogic>(u"CharMenuLogic");
  regist_one<MoveTableLogic>(u"MoveTableLogic");
  regist_one<GamePrepareLogic>(u"GamePrepareLogic");
  regist_one<LaunchPageLogic>(u"LaunchPage");
  regist_one<LittleFunnyAutoGame>(u"LittleFunnyAutoGame");
  regist_one<DanmuGameLogic>(u"DanmuGameLogic");
  // 测试模式那一页（`test_cases_page.ui.json5` 的 `component: ["Tests"]`）。
  regist_one<Tests>(u"Tests");
}

}
}
