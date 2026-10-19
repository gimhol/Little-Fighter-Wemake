#pragma once

#include "lfw/director/action_director.h"

namespace lfw {
namespace ui {

// 4CJ：`ActionDirector` 已搬到 `lfw/director/`（与 TS 的 `src/LFW/director/` 同形）。
// 这一层只是**转发**，让 `ui/component/**`（含 `tests/**` 那一批）不必逐个改 include。
using ActionDirector = ::lfw::director::ActionDirector;

}
}
