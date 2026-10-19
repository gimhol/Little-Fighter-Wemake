// 注入用的键名 → 真 `KeyboardEvent.key`（宿主层、**引擎无关**）。
//
// 口径来自 TS：`src/DittoImpl/Keyboard.ts` 的 `_on_key_down` / `_on_key_up` 取
// `e.key?.toLowerCase()`，剩下全按这个**小写键名**判等（`LFW::on_key_down` 再用
// `Defines.default_keys` 把小写键名映到游戏键 L/R/U/D/a/j/d）。所以命令行的 `--key <name>`
// 给的就是这个小写 DOM 名，别名只是为了好敲（`space` / `esc` / `up`…）。
#pragma once

#include <string>

namespace lfw::host {

// 名字统一小写；别名展开（见 .cpp 的表）；表外的原样放行（`a` / `.` / `arrowleft` / `f5` 都对）。
std::u16string dom_key_of_name(const std::string& name);

}  // namespace lfw::host
