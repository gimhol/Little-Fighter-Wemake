#pragma once

namespace lfw {
namespace ui {

class UINode;

// 渲染面的调用统计（引擎无关）：D4 的缺口「核心一个都没画」过去连数都没有 ⇒ 核心每帧
// 发一次渲染尝试就在这里记一笔，宿主的统计行打印它（与 `ignored_images` / `renderer(+-)`
// 同一个口径）。
//   `calls`     —— 核心发出的渲染尝试（`World::render_once` 每帧每层一次）；
//   `unhandled` —— 其中没有人画的（宿主没给渲染器对象，或渲染器没覆写 `render`）。
// 一次进程一份（README「小函数写成 header-only 的 inline」；端口同一时刻只应有一个 `World`，
// DESIGN §78.5）。
struct UINodeRenderCalls {
  long long calls = 0;
  long long unhandled = 0;
};

inline UINodeRenderCalls& ui_node_render_calls() {
  static UINodeRenderCalls calls;
  return calls;
}

// TS `ditto/render/IUINodeRenderer.ts:3-23`：UINode 只用到生命周期/焦点转发与 `del_self`；
// 渲染面的语义在 TS 的两份实现里 —— `DittoImpl/renderer/UINodeRenderer.ts`（真画：矩形/锚点/
// 九宫格/裁剪/文字/UV 动画，并按模型树递归）与 `DittoImpl/renderer/HeadlessUINodeRenderer.ts`
// （不画，只走一遍树记快照）。
//
// TS 侧每个节点由 `new Ditto.UINodeRenderer(node)` 建一个；端口走宿主缝
// `ILfwHost::create_ui_node_renderer(node)`（绘制本身留给宿主 ⇒ 宿主给假实现或 nullptr）。
class IUINodeRenderer {
 public:
  virtual ~IUINodeRenderer() = default;

  // TS `IUINodeRenderer.ui`：每个实现都在构造里存一份。端口由 `UINode` 的 ctor 填
  //（`uinode.cpp`）；渲染面读模型（`pos` / `size` / `center` / `visible` / `children`）要用它。
  UINode* ui = nullptr;

  // ---- 生命周期 / 焦点转发（`UINode::on_*` 调，`uinode.cpp`）----
  virtual void del_self() {}
  virtual void on_start() {}
  virtual void on_stop() {}
  virtual void on_resume() {}
  virtual void on_pause() {}
  virtual void on_show() {}
  virtual void on_hide() {}
  virtual void on_foucs() {}
  virtual void on_blur() {}

  // ---- 渲染面（TS `IUINodeRenderer` 的另外 7 个成员；DESIGN D4）----
  // 默认实现全是空体（既有宿主与差分台面不必改），但 `render` 落进空体会记一次
  // `unhandled` —— 否则「一个都没画」是**静默**的。
  // ⚠ 递归与「画不画不可见的子树」由实现方决定：TS 两份实现的规则并不一样
  //（`HeadlessUINodeRenderer.ts:117-124` 只看有没有渲染器；`UINodeRenderer.ts:412-420` 还看
  // `visible`）⇒ 端口不把其中一份的选择写进基类。
  // ⚠ 端口今天只有 `render` 有调用点（`World::render_once` 每帧每层一次）。`add` / `del` /
  // `parent` / `x` / `y` / `visible` 是 TS 里渲染器之间的记账面，端口里还没人调。
  virtual void render(double dt, double dfactor) {
    static_cast<void>(dt);
    static_cast<void>(dfactor);
    ++ui_node_render_calls().unhandled;
  }
  virtual void add(IUINodeRenderer& child) { static_cast<void>(child); }
  virtual void del(IUINodeRenderer& child) { static_cast<void>(child); }
  virtual IUINodeRenderer* parent() { return nullptr; }
  virtual void set_x(double v) { static_cast<void>(v); }
  virtual void set_y(double v) { static_cast<void>(v); }
  virtual bool visible() const { return true; }
  virtual void set_visible(bool v) { static_cast<void>(v); }
};

}
}
