#pragma once

#include <functional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/base/expression.h"
#include "lfw/collision/collision.h"
#include "lfw/entity/entity.h"

namespace lfw {

namespace loader {

// `src/LFW/loader/get_val_from_collision.ts` 里的 `map` 表（86 个词），声明顺序照抄
// `defines/CollisionVal.ts`。键是 `defines/collision_val.h` 的 `collision_val::k*`。
//
// TS 的 `Collision.attacker` / `.victim` **就是**那两个活实体（读的时候才取字段）——
// 端口的 `Collision` 现在也一样（`collision::ActorHandle`），所以这张表**不再需要**宿主缝。
const std::vector<std::pair<std::u16string, ValGetter<collision::Collision>>>&
collision_val_getters();

// TS 的 `get_val_geter_from_collision`（那边的拼写少了个 `t`，端口按 `getter` 写）。
// 未命中给 `nullptr`（对应 TS 的 `undefined`）。
ValGetter<collision::Collision> get_val_getter_from_collision(const std::u16string& word);

}

}
