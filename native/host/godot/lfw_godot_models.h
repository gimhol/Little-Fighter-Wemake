// `frame.model`（3D 模型帧）的引擎侧实现（TS `EntityMainRender` 的 `model_node` 那一支）。
//
// 核心/渲染器只给一份 `GodotModelSpec`（glb 路径 + 节点摆放 + 动画参数），这里负责：
//   1. 按路径加载 glb（`GLTFDocument::append_from_buffer`，字节走宿主自己的数据包读取）并缓存
//      成 `PackedScene`（同一路径多个实体各自 `instantiate()` 一份 —— Godot 的实例化会给蒙皮
//      重新绑骨架，等价于 TS 的 `SkeletonUtils.clone`）；
//   2. 每个实体一份离屏画布（`SubViewport` + 正交相机 + 环境光/平行光），画布中心 = 实体的
//      模型局部原点 ⇒ **1 世界单位 = 1 逻辑像素**（与 2D 精灵同一口径，舞台缩放由宿主在 blit
//      时乘 `frame.scale_x/scale_y`）；
//   3. 每帧把 `model_node` 的位置/缩放/四元数摆好，并驱动 `AnimationPlayer` 的片段名 / 循环 /
//      速度（`reverse` ⇒ 负速度）。
//
// TS 里还有「姿态骨骼混合（`model.pose`）」与「模型轮廓（`build_model_hulls`）」两支 ——
// 当前数据（robot / book_*）都没用到（`grep pose` 为 0），先不做（见 README 的报告一节）。
#pragma once

#include <functional>
#include <map>
#include <memory>
#include <string>

#include <godot_cpp/classes/viewport_texture.hpp>

#include <godot_cpp/classes/packed_scene.hpp>

#include "host/godot/lfw_godot_renderer.h"

namespace godot {
class Node;
class PackedScene;
}  // namespace godot

namespace lfw::host {

class GodotModelBank {
 public:
  // `load`：条目名（`/` 分隔）→ 字节。宿主注入（真源是数据包 / `--root` 根目录）。
  explicit GodotModelBank(std::function<bool(const std::string&, std::string&)> load);
  ~GodotModelBank();

  GodotModelBank(const GodotModelBank&) = delete;
  GodotModelBank& operator=(const GodotModelBank&) = delete;

  // 离屏画布的父节点（宿主那个 `Node2D`）。
  void set_parent(godot::Node* parent) { _parent = parent; }

  // 一帧：按 `tag`（实体 id）同步那个实体的模型实例，返回这一帧该 blit 的纹理。
  // 没有模型 / 加载失败 ⇒ 空引用。
  godot::Ref<godot::ViewportTexture> sync(const std::string& tag, const GodotModelSpec& spec);

  // 帧末：本帧没 sync 到的实例隐藏（不销毁：切帧复用时不用重新加载）。
  void end_frame();

  // 诊断（不进三条摘要）。
  long long loaded() const { return _loaded; }
  long long failed() const { return _failed; }
  long long live() const { return static_cast<long long>(_slots.size()); }
  const std::string& last_error() const { return _last_error; }
  // 每个 glb 加载成功时记一行 `path(anims=N)`（查「模型有没有动画片段」用）。
  const std::string& report() const { return _report; }

 private:
  struct Slot;

  // 路径 → `PackedScene` 模板（懒加载；失败也缓存成空，避免每帧重试磁盘）。
  godot::Ref<godot::PackedScene> template_for(const std::string& path);
  Slot& ensure_slot(const std::string& tag);
  // 把 `spec` 摆到实例上（换了 glb 就换实例）。
  bool apply_slot(Slot& slot, const GodotModelSpec& spec);

  std::function<bool(const std::string&, std::string&)> _load;
  godot::Node* _parent = nullptr;
  std::map<std::string, godot::Ref<godot::PackedScene>> _templates;
  std::map<std::string, std::unique_ptr<Slot>> _slots;
  long long _loaded = 0;
  long long _failed = 0;
  std::string _last_error;
  std::string _report;
};

}  // namespace lfw::host
