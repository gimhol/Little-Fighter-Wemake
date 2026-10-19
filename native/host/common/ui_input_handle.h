// UI 输入那一半：把平台的指针事件翻成 `POINTER_*` 命令（TS `I.Ditto.UIInputHandle` 的端口）。
//
// 移植对象是**引擎无关**的那一份：`src/DittoImpl/ui/HeadlessUIInputHandle.ts`
//（配合 `?headless_ui=1` 给无头模式用），语义对齐真 handle
//（`src/DittoImpl/ui/UIInputHandle.ts`：`--paths/--pages/--points`、近→远、`POINTER_DOWN`
// 无命中不推、`POINTER_MOVE` 无命中只推一次空移动）。差别只有命中判定：
//
//   * 真 handle 用 three.js 的 raycaster 打 `ui_fg_container` 的 mesh；
//   * 这一份直接在 `UINode` 模型上做**矩形命中测试**（`UINode::geo()` = 累加了父链 pos 的
//     绝对矩形），祖先 `clip_children` 用矩形包含判定，排序按 `z` 降序（近→远）、同 z 保
//     深度优先遍历序。
//
// 本文件**不碰任何引擎类型**（DESIGN §G5）：宿主（Godot / WASM / headless）只负责把平台事件
// 变成 `LfwPointingEvent` 喂进来。宿主侧的状态（`_empty_move`）留在本模块里。
#pragma once

#include <optional>
#include <string>
#include <vector>

#include "lfw/lfw.h"
#include "lfw/ui/uinode.h"

namespace lfw {
class World;
}

namespace lfw::host {

// 逻辑视口尺寸（`world.dataset.screen_w/screen_h`；缺省 794×450）。UI 的坐标空间就是它：
// `UINode::geo()` 与渲染器的屏幕矩形**同一套**（左上原点、y 向下、1 单位 = 1 逻辑像素）。
struct UiScreenSize {
  double w = 794;
  double h = 450;
};
UiScreenSize ui_screen_size(const World& world);

// `scene(NDC -1..1) → UI 逻辑像素`（TS `HeadlessUIInputHandle.to_ui`）：所有 pointer 命令与
// `--pos` 都用这套换算，宿主侧的注入也必须用它（或它的逆）—— 控件（如 `ScrollView`）自己
// 也会按同一个公式从 `scene_*` 反算。
struct UiPoint {
  double x = 0;
  double y = 0;
};
UiPoint ui_point_of_scene(const World& world, double scene_x, double scene_y);
// 上面那条的逆：UI 逻辑像素 → `scene_x/scene_y`（宿主把「点在哪」变成 `LfwPointingEvent` 时用）。
void ui_scene_of_point(const World& world, double x, double y, double& scene_x, double& scene_y);

// TS `node_path(node)`（`src/DittoImpl/ui/UIInputHandle.ts`，两份 handle 共用）：
// `"<层号>,<页面栈下标>,<子节点下标>…"`；节点不在任何层/页里 ⇒ 空串（TS 的 `undefined`）。
std::u16string ui_node_path(const ui::UINode& node);

// TS `IPointingsCallback` 的这一面 + `HeadlessUIInputHandle` 的全部行为。
class UiInputHandle : public LfwPointingsCallback {
 public:
  explicit UiInputHandle(LFW& lfw) : _lfw(&lfw) {}

  void on_click(LfwPointingEvent& e) override { (void)e; }  // TS 里就是空实现
  void on_pointer_down(LfwPointingEvent& e) override;
  void on_pointer_move(LfwPointingEvent& e) override;
  void on_pointer_up(LfwPointingEvent& e) override;
  void on_pointer_cancel(LfwPointingEvent& e) override;
  // `on_wheel` 也是空实现：滚轮由控件自己的回调（`ScrollView::PointListener`）消费，不经 handle。
  void on_wheel(LfwPointingEvent& e) override { (void)e; }
  // ⚠ 端口这条缝（`LfwPointingsCallback`）还没有 enter/leave 两个方法 ⇒ 它们是**普通成员**，
  // 由宿主在「指针进/出画面」时直接调（TS 里是回调接口上的两个方法）。
  void on_pointer_enter(LfwPointingEvent& e);
  void on_pointer_leave(LfwPointingEvent& e);

  // `WorldRenderer.ui_offset`（TS 里恒为 `(0,0,0)`，但它是可读的字段 ⇒ 留一个口子）。
  void set_ui_offset(double x, double y, double z);

 private:
  struct Hit {
    ui::UINode* node = nullptr;
    double x = 0;  // 世界坐标下的命中点（`--points` 那一项；`z` 还要加 `ui_offset.z`）
    double y = 0;
    double z = 0;  // 排序键：`global_pos.z`（TS 的 `z`，**不含** `ui_offset`）
    double order = 0;
  };

  // `--pos=<x>,<y>`：UI 逻辑像素，保留一位小数（TS `Math.round(v * 10) / 10`）。
  std::u16string pos_arg(const LfwPointingEvent& e) const;
  // `--points` 里那个世界坐标 z：逐级累加父链的 `pos.z`，**不是有限数时按 0 算**（与渲染器
  // `GodotUINodeRenderer::compute_global` 的 `finite_or(ui->pos.z, 0.0)` 同口径），再叠 `ui_offset.z`。
  // ⚠ 与 TS `HeadlessUIInputHandle` 的**有意偏差**：数据里 `pos` 只写两个数时（烹饪出来的数组是
  // `[x, y, undefined]`），TS 那份会吐 `NaN` —— 于是 `--points` 被命令侧判为非法、整条 `POINTER_*`
  // 丢掉（真 handle 用 raycast 命中点，没这个问题）。端口按渲染器的口径取 0，点击才真的能落地。
  double world_z(const ui::UINode& node) const;
  // `set_local_cursor`（`POINTER_*` 都会顺带刷本地光标）。
  void update_local_cursor(const LfwPointingEvent& e, std::optional<bool> hidden,
                           std::optional<bool> down = std::nullopt);
  // 命中列表：`ui` 子树里所有可见、未禁用、矩形包含该点、且祖先裁剪没挡住的节点。
  // `visits`（可选）收下整棵子树的 `path(geo)vis/dis`，`--dev` 下查"为什么没点中"用。
  std::vector<Hit> intersections(const LfwPointingEvent& e, ui::UINode& page,
                                 std::vector<std::u16string>* visits = nullptr) const;
  // `POINTER_MOVE` 无命中时的"空移动"（只在 `_empty_move` 为假时推一次）。
  void push_empty_move(const LfwPointingEvent& e);
  void push_pointer(const char16_t* command, const LfwPointingEvent& e);

  LFW* _lfw = nullptr;
  double _offset_x = 0;
  double _offset_y = 0;
  double _offset_z = 0;
  bool _empty_move = false;
};

}  // namespace lfw::host
