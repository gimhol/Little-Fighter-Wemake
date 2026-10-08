#pragma once

#include <string>

namespace lfw::ui {

// TS `ui/UIActionEnum.ts`。
namespace ui_action {
inline const std::u16string kAlert = u"alert";
inline const std::u16string kLinkTo = u"link_to";
inline const std::u16string kSetPage = u"set_page";
inline const std::u16string kPushPage = u"push_page";
inline const std::u16string kPopPage = u"pop_page";
inline const std::u16string kLoopImg = u"loop_img";
inline const std::u16string kLoadData = u"load_data";
inline const std::u16string kBroadcast = u"broadcast";
inline const std::u16string kSound = u"sound";
inline const std::u16string kSwitchDifficulty = u"switch_difficulty";
inline const std::u16string kDestoryStage = u"destory_stage";
inline const std::u16string kRemoveAllEntities = u"remove_all_entities";
inline const std::u16string kExit = u"exit";
// @deprecated（TS 注释）：旧写法，仍兼容。
inline const std::u16string kSetUI = u"set_ui";
inline const std::u16string kPushUI = u"push_ui";
inline const std::u16string kPopUI = u"pop_ui";
}  // namespace ui_action

}
