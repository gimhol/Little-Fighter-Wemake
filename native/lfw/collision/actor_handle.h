#pragma once

#include <string>

#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace collision {

// `collision.attacker` / `.victim` 需要读的实体字段（TS 侧是直接 `c.attacker.xxx`）。
//
// 端口**不**拿它当"碰撞里存的副本"：真实运行时字段一律从 `Entity` 活读（见 `ActorHandle`），
// 这个结构只在差分台面（脚本化出来的假实体）里当真身用，另外也是 `entity/target_handle.h`
// 那套「快照兜底」的载体。
struct CollisionActor {
  std::u16string id;
  double px = 0;
  double py = 0;
  double pz = 0;
  std::u16string data_id;
  double data_type = 0;
  Value frame;
  Value itr_prefabs;
  Value bear_wpoint_attacking;
  bool marks_group_attack = false;
  bool dropping = false;
  Value arest;
  bool has_catcher = false;
  Value catcher_hurtable;
  Value invulnerable;
  Value bot_ignore;
  Value team;
  Value emitter;
  Value spawn_time;
  bool is_bot_ctrl = false;
};

// TS 的 `collision.attacker` / `.victim` 就是那两个**活实体**（`collision/*` 里读的是
// `c.attacker.position.x` / `c.victim.hp` …）。端口的 `collision/` 层看不见 `World`，
// 所以用这个句柄承载两种来源：
//
//  * 真实运行时 `_entity != nullptr` —— 每个取值器都活读实体（与 TS 同一时刻的值）；
//  * 差分台面里 `_entity == nullptr` —— 退回喂进来的 `CollisionActor` 快照。
//
// 实体是**池化复用**的（`Factory::recycle_entity` 之后 `reset` 给下一个），所以 `entity()`
// 先用 `id` 复核；换了主人就当作"当初那个实体已经没了"（TS 那边对象引用还活着，但下游
// 的判定同样会拒掉死实体，见 `entity/target_handle.h` 同一段说明）。
class ActorHandle {
 public:
  ActorHandle() = default;

  static ActorHandle of(const Entity& e);
  static ActorHandle of(const CollisionActor& a);

  // 身份。台面那份快照可以被 `snap_mut()` 改（`run aid "…"`），所以读的是快照里的 `id`。
  const std::u16string& id() const;
  // 当初那个真实体；台面（或已失效）时给 `nullptr`。
  const Entity* entity() const;

  // 台面直接用这两条：`snapshot()` 读，`snap_mut()` 写（实体句柄降级成快照后写）。
  const CollisionActor& snapshot() const;
  CollisionActor& snap_mut();

  // TS 那边 `c.attacker.xxx` / `c.victim.xxx` 的读点。
  double px() const;
  double py() const;
  double pz() const;
  std::u16string data_id() const;
  double data_type() const;
  Value frame() const;
  Value itr_prefabs() const;
  Value bear_wpoint_attacking() const;
  bool marks_group_attack() const;
  bool dropping() const;
  Value arest() const;
  bool has_catcher() const;
  Value catcher_hurtable() const;
  Value invulnerable() const;
  Value bot_ignore() const;
  Value team() const;
  Value emitter() const;
  Value spawn_time() const;
  bool is_bot_ctrl() const;

 private:
  void ensure_snapshot() const;

  const Entity* _entity = nullptr;
  std::u16string _id;
  mutable CollisionActor _snap;
  mutable bool _snap_built = false;
};

}

}
