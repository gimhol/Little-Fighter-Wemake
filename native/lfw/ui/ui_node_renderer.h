#pragma once

namespace lfw {
namespace ui {

class UINode;

// TS `ditto/render/IUINodeRenderer.ts`：UINode 只用到生命周期/焦点转发与 `del_self`
// （`render` / `add` / `del` / `parent` / `x` / `y` / `visible` 属渲染面，未移植）。
//
// TS 侧每个节点由 `new Ditto.UINodeRenderer(node)` 建一个；端口走宿主缝
// `ILfwHost::create_ui_node_renderer(node)`（渲染未移植 ⇒ 宿主可给假实现或 nullptr）。
class IUINodeRenderer {
 public:
  virtual ~IUINodeRenderer() = default;
  virtual void del_self() {}
  virtual void on_start() {}
  virtual void on_stop() {}
  virtual void on_resume() {}
  virtual void on_pause() {}
  virtual void on_show() {}
  virtual void on_hide() {}
  virtual void on_foucs() {}
  virtual void on_blur() {}
};

}
}
