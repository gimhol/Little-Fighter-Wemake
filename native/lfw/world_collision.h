#pragma once

#include <cstddef>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/base/expression.h"
#include "lfw/buff/buff.h"
#include "lfw/collision/action_handlers.h"
#include "lfw/collision/ball_frozen.h"
#include "lfw/collision/collision.h"
#include "lfw/collision/fall.h"
#include "lfw/collision/handlers2.h"
#include "lfw/collision/handlers3.h"
#include "lfw/collision/handlers4.h"
#include "lfw/collision/healing.h"
#include "lfw/collision/keeper.h"
#include "lfw/collision/n_bdy_defend.h"
#include "lfw/collision/n_bdy_normal.h"
#include "lfw/collision/weapon_is_hit.h"
#include "lfw/core/value.h"

namespace lfw {

class Entity;
class World;

// `src/LFW` 的 `collision/*` 直接引用 `world.*` / `lfw.*` / 实体属性；端口的
// `collision/` 层把这些都留成了 Env 缝（82 条）。本类是**唯一**的接线点：把 82 条缝接到
// 真实的 `World` / `Entity` / 宿主 `lfw` 面上。
//
// 保真要点：
// 1. `Collision.attacker` / `.victim` 是 `ActorHandle`（见 `collision/actor_handle.h`）：
//    真实运行时字段活读实体，差分台面里退回脚本化的 `CollisionActor` 快照。
// 2. 需要「活实体」的缝（`find_entity` / `get_bounding` / `victim_add_v_rest` …）现在都能从
//    传进来的 `Collision`（或 `ActorHandle`）直接拿到实体，不再需要「当前判定的那一对」这种
//    宿主级状态（原来的 `_cur_a` / `_cur_v` 已删除）。
//
// 切片 4CE：碰撞族的 `I*Entity` 窄接口退役 ⇒ 缝里交出去的就是 `Entity*` 本身，本类不再是
// 什么「视图宿主」（原 `ICollisionViewHost` 与 `EntityCollisionView` 一并删除）。
class WorldCollisionHost {
 public:
  explicit WorldCollisionHost(World& world);
  ~WorldCollisionHost();

  WorldCollisionHost(const WorldCollisionHost&) = delete;
  WorldCollisionHost& operator=(const WorldCollisionHost&) = delete;

  World& world() const { return *_world; }
  const collision::CollisionCoreEnv& core() const { return _core; }
  const collision::CollisionKeeper& keeper() const { return collision::collisions_keeper(); }

  // `collision_get(a, b)` / `collision_test(c)`：登记当前那一对后转调 `collision/` 层。
  collision::Collision* collision_get(Entity& a, Entity& v);
  bool collision_test(collision::Collision& c);
  // `collisions_keeper.handle(c)`：装好 `c.env` / `c.core` 再转调。
  void handle(collision::Collision& c);
  // `acquire_collision` 每次给新对象（见 `acquire_collision` 的注释）⇒ `World::step`
  // 开头清碰撞表时整批释放。
  void reset_collisions();

  // `Entity` → 碰撞里的那一方（TS 侧就是那个活实体本身）。
  collision::ActorHandle actor_of(Entity& e) const;

 private:
  // 把 11 个 Env 发布到 `collision/` 的模块级槽上；`ensure_published()` 只在「当前发布者不是
  // 自己」时才真的重发（公开入口每次都会调一次，成本是一次指针比较）。
  void ensure_published();
  void publish_globals();
  void clear_globals();

  void bind();
  void bind_core();
  void bind_keeper();
  void bind_handlers();
  void bind_action();
  void bind_handlers2();
  void bind_handlers3();
  void bind_handlers4();
  void bind_fall();
  void bind_nbdy_normal();
  void bind_nbd_defend();
  void bind_weapon_is_hit();
  void bind_ball_frozen();
  void bind_healing();
  void bind_buff_env();

  // `collision.attacker` / `.victim` → `Entity`（台面里的假实体给 `nullptr`）。
  static Entity* entity_of_collision_a(const collision::Collision& c);
  static Entity* entity_of_collision_v(const collision::Collision& c);
  // `is_fall` / `is_armor_work` / `calc_itr_velocity` / `calc_stiffness` 在端口里收的是
  // **`Value` 形状**的碰撞（那一刀是用用例数据喂的）⇒ 宿主按 TS 的读法投影一次。
  Value entity_helpers_value(Entity& e) const;
  Value collision_helpers_value(const collision::Collision& c) const;
  Value world_helpers_value() const;
  // `action.tester` / `bdy.__tester`：端口存源串（DESIGN §64.2），宿主按需编译。
  bool tester_run(const Value& tester, collision::Collision& c);
  Value tester_debug(const Value& tester);

  // `lfw.mt.mark = mark`（`action.mt_set_mark` / `weapon_is_hit.mt_mark` 两条缝的公共实现）。
  void mt_mark(const std::u16string& mark);

  collision::Collision& acquire_collision();
  buff::Buff* find_buff(const std::u16string& id) const;
  buff::Buff* create_buff(const std::u16string& kind, const std::u16string& id);

  World* _world = nullptr;

  collision::CollisionCoreEnv _core;
  collision::KeeperEnv _keeper;
  collision::HandlersEnv _handlers;
  collision::ActionEnv _action;
  collision::Handlers2Env _handlers2;
  collision::Handlers3Env _handlers3;
  collision::Handlers4Env _handlers4;
  collision::FallEnv _fall;
  collision::NbdyNormalEnv _nbdy_normal;
  collision::NbdDefendEnv _nbd_defend;
  collision::WeaponIsHitEnv _weapon_is_hit;
  collision::BallFrozenEnv _ball_frozen;
  collision::HealingEnv _healing;
  buff::BuffEnv _buff_env;

  // `lfw.acquire_collision()`：TS 的对象池 `Graves`（`LFW.ts:891`）**没有任何**
  // `recycle_collision` 调用者 ⇒ 池永远是空的 ⇒ 每次都是新对象。端口按同样的行为给「每次
  // 新对象」，但用固定大小的环槽承载（引用要活到调用者拷走为止）。
  std::vector<std::unique_ptr<collision::Collision>> _collisions;
  size_t _collision_at = 0;

  std::map<std::u16string, Expression<collision::Collision>> _testers;
};

}
