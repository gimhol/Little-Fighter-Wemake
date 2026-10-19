// 录制型薄宿主（`native/host/thin/**`）：headless 的**超集** —— 一样薄，但那一处空实现
// （世界渲染器）换成**录制**。
//
// 它存在的理由：`IWorldRenderer` 是**保留式**的（`add_entity` / `del_entity` 记账，`render`
// 每帧拿活实体），所以「一帧到底要画什么」只有渲染器自己知道；headless 的 `NullWorldRenderer`
// 只计数、不留字段 ⇒ 契约的**字段面**至今没有人跑过。这一份把每帧的快照落下来。
//
// 复用（不重写）：`ILfwHost` 的其余 60+ 个面、`FsZip`、存档 / XML / `import_as_*`、手动时钟
// 与定时器全部照抄 `host/headless_host.{h,cpp}` —— 只是派生一份，覆写 `create_world_renderer`。
#pragma once

#include <filesystem>
#include <memory>
#include <utility>
#include <vector>

#include "host/headless_host.h"
#include "host/thin/recording_world_renderer.h"

namespace lfw::host {

class ThinHost : public HeadlessHost {
 public:
  ThinHost(std::vector<std::filesystem::path> roots, bool dev)
      : HeadlessHost(std::move(roots), dev) {}

  // `new Ditto.WorldRender(world)` 那一处（`lfw/lfw.cpp:245` 在 `LFW` 构造里调）。
  // 每次都新建：一个 `LFW` 一份录制器，活体表不会跨世界残留（调用点唯一，一次进程只建一个）。
  IWorldRenderer* create_world_renderer(LFW& lfw) override {
    _recorder = std::make_unique<RecordingWorldRenderer>(lfw);
    return _recorder.get();
  }
  RecordingWorldRenderer& recorder() const { return *_recorder; }

  // 推一帧，并保证这一帧里有**恰好 `sub_render` 次** `IWorldRenderer::render`（缺省 1）：
  // `World::update_once` 只在 `dataset.sync_render == Sync` 时自己渲染（其余档位走的是
  // `IRenderScheduler` 的 raf 槽，手动宿主里那个槽是空的 ⇒ 不会渲染）。所以这里先
  // `update_once`，看记录器的计数有没有动；差几次就由宿主补几次 `render_once`。
  // `sub_render > 1` = 一个 tick 里渲染多次，每次的 `dt` 是 `dt / sub_render` —— TS 的渲染
  // 循环就是按真实经过时间调 `render(dt)` 的（`World.ts` 的 raf 槽），这也是 `dfactor` 唯一
  // 能落进 (0,1) 的形状（还要 `world.FPS > dataset.UPS`，见 `--sync-render`）。
  // 返回值 = 这次是宿主补的渲染（`true`）还是世界自己渲染的（`false`）。
  bool step_frame(lfw::World& world, double dt, int sub_render = 1);

 private:
  std::unique_ptr<RecordingWorldRenderer> _recorder;
};

}  // namespace lfw::host
