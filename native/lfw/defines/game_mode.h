#pragma once

#include <optional>
#include <string>
#include <vector>

#include "lfw/defines/enum_entries.h"

namespace lfw {

/** TS `defines/GameMode.ts`：对局模式（准备页选定、对局中生效）。 */
namespace game_mode {

inline constexpr const char16_t* kVs = u"vs";
inline constexpr const char16_t* kStage = u"stage";
inline constexpr const char16_t* kSurvivalRank1P = u"survival_rank_1p";
inline constexpr const char16_t* kSurvivalRank2P = u"survival_rank_2p";

}

inline const std::vector<EnumTextEntry>& game_mode_entries() {
  static const std::vector<EnumTextEntry> e = {
    {u"Vs", game_mode::kVs},
    {u"Stage", game_mode::kStage},
    {u"SurvivalRank1P", game_mode::kSurvivalRank1P},
    {u"SurvivalRank2P", game_mode::kSurvivalRank2P},
  };
  return e;
}

/** `is_survival_rank_mode(mode)`：是否为生存排行模式（单人/双人）。 */
inline bool is_survival_rank_mode(const std::optional<std::u16string>& mode) {
  return mode.has_value() &&
         (*mode == game_mode::kSurvivalRank1P || *mode == game_mode::kSurvivalRank2P);
}

}
