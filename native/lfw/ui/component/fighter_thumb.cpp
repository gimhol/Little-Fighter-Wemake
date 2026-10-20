#include "lfw/ui/component/fighter_thumb.h"

#include "lfw/defines/defines.h"
#include "lfw/entity/entity.h"
#include "lfw/ui/component/player_score.h"
#include "lfw/ui/uinode.h"
#include "lfw/ui/value_spread.h"

namespace lfw {
namespace ui {

namespace {

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

}

const ClazzTag* FighterThumb::class_tag() {
  static const ClazzTag tag{Picture::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& FighterThumb::TAGS() {
  static const std::vector<std::u16string> tags{u"FighterThumb"};
  return tags;
}

std::u16string FighterThumb::thumb_url() {
  if (fighter == nullptr) return std::u16string(built_in_imgs::kCHARACTER_THUMB);
  const Value* const base = field_of(fighter->data(), u"base");
  const Value* const small = base != nullptr ? field_of(*base, u"small") : nullptr;
  if (small == nullptr || is_nullish(*small)) {
    return std::u16string(built_in_imgs::kCHARACTER_THUMB);
  }
  return to_string(*small);
}

void FighterThumb::on_start() {
  UIComponent::on_start();
  set_width(40);
  set_height(45);
}

void FighterThumb::on_show() {
  PlayerScore* const score =
      static_cast<PlayerScore*>(node.lookup_component(PlayerScore::class_tag()));
  fighter = score != nullptr ? score->fighter() : nullptr;
  handle_changed();
}

void FighterThumb::handle_changed() { set_src(thumb_url()); }

}
}
