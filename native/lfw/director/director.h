#pragma once

#include <map>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/utils/eval_number.h"
#include "lfw/director/action_director.h"

namespace lfw {

class Entity;
class World;

namespace director {

// Mirrors `src/LFW/director/Director.ts`（4CJ：数据驱动的关卡导演运行期）。
//
// 一个 `Director` 吃一份 `IDirectorData`（`dat_translator/xml/xml_x_director` 的产物，
// 形状见 DESIGN §147），负责：
//   * `_compile`：把 `timeline` 摊成一串定时任务塞进 `ActionDirector`（`wait` / `repeat` +
//     `interval` / `after` + `actions`），`times` 设轮数，最后排序；
//   * `_setup_scene`：`world.clear()` → 换 bg → 覆盖 stage 数值 → 按 `actors` 生成实体
//     （布局表达式走 `utils/eval_number`）→ 灌 `values` / `ctrl` / `attach` → 建 `groups`
//     → 跑 `setup` 里的动作；
//   * `update`：推进 `ActionDirector` + 每帧刷 `auto` 规则（`mp_gt` / `state` / `state_not` /
//     `frame_hit`）；
//   * `_run_action`：14 种 action（`input`/`set`/`camera`/`cmd`/`bg`/`stage`/`place`/`move`/
//     `face`/`velocity`/`frame`/`pickup`/`cycle`/`throw_spot`/`reset`）。
//
// `resolve(selectors)` 的语法：`"@all"`（本导演生成过的全部）、`"@<组名>"`、
// `"<actor id>"` / `"<actor id>[<下标>]"`（负数从尾数），多选给数组，结果**去重保序**。
class Director {
 public:
  Director(World& world, Value data);

  World& world;
  Value data;
  ActionDirector action_director;

  std::vector<Entity*> fighters;
  std::vector<Entity*> entities;
  std::vector<Entity*> weapons;

  const std::vector<Entity*>& spawned() const { return _spawned; }

  void start();
  void restart();
  void stop();
  void update(double dt);

  std::vector<Entity*> resolve(const Value& selectors) const;
  Entity* spawn(const std::u16string& oid);

 private:
  void update_auto();
  void compile();
  void setup_scene();
  void spawn_actor(const Value& actor);
  std::vector<std::u16string> actor_oids(const Value& actor) const;
  void actor_position(const Value& actor, double index, double count,
                      const utils::EvalContext& ctx, double& x, double& y, double& z) const;
  void apply_values(Entity& e, const Value& values, double index) const;
  void apply_ctrl(Entity& e, const Value& actor, double index, const std::u16string& oid);
  std::u16string player_id_of(const std::u16string& templ, const Entity& e, double index) const;
  utils::EvalContext eval_ctx() const;
  void run_action(const Value& action);
  void apply_keys(Entity& e, const Value& steps) const;
  void enter_frame(Entity& e, const std::u16string& id);
  void cycle(const Value& target, const std::u16string& property, const Value& values);
  void throw_spot(const Value& target, const std::u16string& from);
  bool match_auto(const Entity& e, const Value& when) const;
  double expr(const Value& value) const;

  std::map<std::u16string, std::vector<Entity*>> _actors;
  std::map<std::u16string, std::vector<Entity*>> _groups;
  std::vector<Entity*> _spawned;
  bool _compiled = false;
};

}
}
