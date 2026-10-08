#pragma once

#include <string>

#include "lfw/core/value.h"

namespace lfw {

class LFW;

namespace ui {

// TS `ui/ui_load_img.ts`：校验（错 ⇒ `errors` 按 `\n` 拼接后返回 false）→ 拼 `img_key`
// （`${path}?x=${MD5("x,y,w,h,dw,dh,flip_x,flip_y" 的 join)}`，宿主 MD5）→
// `dw || dh` 时 push crop（`{type:'crop', ...img}`）、`flip_x || flip_y` 时 push flip
// （`x/y` 是**默认 0 之后的**值）→ 宿主 `images.load_img` + `pin`。
bool ui_load_img(LFW& lfw, const Value& img, Value& out, std::u16string& error);

}
}
