#pragma once

#include <string>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/i_vector3.h"

namespace lfw {
namespace controller {

// `controller/BallController.ts`：球的追人控制器（帧上带 `chase` 的那种实体）。
//
// 端口的两条约定：
//   * 控制器看不见 `Entity`（同 `CtrlEnv`、`bot/*`）：自己的数据全从 `env()` 读；
//   * `chasing` 与 `update_lookup(me, entities)` 的候选都是**实体指针**（TS 同形）。
//     `entities[me]` 就是自己（TS 那边也是这么传的），所以「自己」的引用不用单独给。
class BallController : public BaseController {
 public:
  static constexpr const char* TAG = "BallController";

  bool is_ball_ctrl() const override { return true; }

  // `chasing` 继承自基类（见 `base_controller.h` 的说明）。
  // `frame: IFrameInfo = EMPTY_FRAME_INFO`：上一次 `update()` 看到的帧，
  // 用来判「帧变了没」（同一性比较，见 `core/same_ref.h`）。
  Value frame;
  bool gave_up = false;
  double dir_x = 0;
  double dir_y = 0;
  double dir_z = 0;
  double leave_dir = 0;

  void reset() override;

  // `get chase_point()`：惰性初始化成自己当前位置（不能在构造/reset 时取 —— 那时实体
  // 还没被摆到出生点，无目标时球会一路朝原点飞）。
  Vector3& chase_point();
  void set_chase_point(double x, double y, double z);
  void aim_at(const Value& e, double oy = 0);

  // 世界侧给实体表（`LFW::ctrl_update_lookup`）；台面（`subjects/entity.cpp`）同样给实体。
  void update_lookup(int me, const std::vector<Entity*>& entities);
  bool should_chase(const Value& other) const;

  const ControllerResult& update() override;
  void update_chasing(const Value& chase);
  // TS 的返回值是 `0 | 1 | -1`；端口用 `double` 装（NaN 也要能进来，同 TS）。
  double calc_dir(double delta, double over, double prev);
  void stop_chasing();

 private:
  // `this.chase_point.copy(this.entity.position)` —— 不走 `set_chase_point`（那会取整）。
  void copy_self_position();

  bool has_chase_point_ = false;
  Vector3 chase_point_;
};

}
}
