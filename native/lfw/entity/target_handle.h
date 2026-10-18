#pragma once

#include <string>

#include "lfw/core/value.h"

namespace lfw {

class Entity;

// TS 里 `BallController.chasing` / `BotController.following|watching` / `NearestTargets` 的目标都是
// **活实体**；端口有两种来源：真实运行时有 `Entity`，差分台面（`subjects/bot.cpp` 等）只有脚本化
// 出来的 `Value`。`TargetHandle` 是这两者的统一句柄：
//
//  * 真实运行时 `_entity != nullptr` —— 位置/血/队伍**活读**；
//  * 台面里 `_entity == nullptr`，退回建句柄那一刻的引用快照（与旧实现同语义）；
//  * `_id` 两条路都带着 —— 实体是**池化复用**的（`Factory::recycle_entity` 之后 `reset` 给下一个
//    实体），裸指针过一会儿可能指向别人，所以任何读取前都用 `id` 复核（`entity()` 会返回
//    `nullptr` 表示「这个句柄已经不代表当初那个实体」）。
//
// `ref()` 是给仍只认 `Value` 的读法（`bot/state/**`、`aim_at` …）用的投影：真实体按需生成并
// 缓存，`refresh()` 在每趟 `update_lookup` 里刷一次（与旧的 `reidentify` 同频）。
class TargetHandle {
 public:
  // 默认即 TS 的 `null`（`following` / `watching` / `chasing` 的初值都是 `null`）；
  // `ref()` 因此给出 `NullTag`，差分台面里打印成 `z`（与旧的 `Value(NullTag{})` 同形）。
  TargetHandle() : _ref(Value(NullTag{})), _ref_built(true) {}

  static TargetHandle of(const Entity& e);
  static TargetHandle of(const Value& ref);

  // TS 的 `!this.chasing`：台面里就是引用的真假；真实体失效（被回收复用）时也当空处理
  // （TS 那边死实体的对象还在，但 `should_chase` 之类的判定同样会拒掉它）。
  bool nullish() const;

  // 当初那个真实体；没有（台面）或已失效时给 `nullptr`。
  const Entity* entity() const;
  // 身份：`id` 在实体生命周期内唯一（`LFW::new_id` 单调递增）。
  const std::u16string& id() const { return _id; }
  // 只认 `Value` 的读法用的投影（真实体按需生成 + 缓存）。
  const Value& ref() const;
  // 只对**真实体**句柄有意义（台面那份引用是唯一的真身，不能丢）。
  // 顺便复核 `id`：实体池会复用指针，变了就说明这个目标已经没了 ⇒ 缓存成 `null`
  // （TS 那边死实体的对象还在，但下游的 `should_chase` 之类同样会拒掉它）。
  void refresh() const;
  double x() const;
  double z() const;

  // TS 的 `a === b`（实体身份）：按 `id`；两边都没 `id` 时退回引用同一性。
  bool same(const TargetHandle& o) const;

 private:
  const Entity* live() const;

  const Entity* _entity = nullptr;
  std::u16string _id;
  mutable Value _ref;
  mutable bool _ref_built = false;
};

}
