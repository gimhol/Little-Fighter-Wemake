#pragma once

#include <string>
#include <vector>

#include "lfw/ui/component/picture.h"

namespace lfw {

class Entity;

namespace ui {

// TS `ui/component/FighterThumb.ts`：`Picture` 子类，显示玩家角色的小头像
// （`fighter.data.base.small ?? CHARACTER_THUMB`）。
// `fighter` 在 `on_show` 里从祖先链上的 `PlayerScore` 取（`node.lookup_component`）——
// 结算画面每一行就是靠它拿到自己那一行的角色。
class FighterThumb : public Picture {
 public:
  static constexpr const char* TAG = "FighterThumb";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using Picture::Picture;

  const ClazzTag* clazz() const override { return class_tag(); }

  Entity* fighter = nullptr;
  std::u16string thumb_url();

  void on_start() override;
  void on_show() override;
  void handle_changed();
};

}
}
