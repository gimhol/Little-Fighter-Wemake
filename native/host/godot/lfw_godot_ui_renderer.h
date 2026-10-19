// Godot 侧的 `IUINodeRenderer`（DESIGN §G2 第二半 / D4）：把「核心的 UI 模型树」翻成
// **引擎无关**的绘制项（`GodotDrawItem`），本文件**一个引擎类型都不碰** —— 真正的 `draw_*`
// 在 `lfw_godot_node.cpp` 的 `_draw()`（§G5「只在边界转换」）。
//
// 语义来源是 TS 的两份实现里**会画**的那一份（`src/DittoImpl/renderer/UINodeRenderer.ts`）：
//   * 矩形与锚点：`update_center_and_size`（`w/h` + `center` ⇒ 本地矩形）；坐标 y 向下，
//     父坐标系 = 模型树（`mesh.add(child.mesh)` 那棵树），画到屏幕时**不再反号**
//     —— `WorldRenderer.ts` 把 `ui_bg/ui_fg_container` 摆到 `cam + (0, screen_h)` 上，
//     于是 UI 本地 (x, y) 逐位等于屏幕 (x, y)（`UINodeRenderer.ts:356-366` 那条"y 反号"
//     是 three.js 的 y 向上坐标系，屏幕这一侧已经抵消掉）。
//   * 位置/缩放：每帧指数平滑 `1 - exp(-dt / (1000/60))`（`render()`）；模型的变化（图/文本/
//     颜色/不透明度/矩形）只在 `world.lifetime` 变化时同步一次（`sync()`）。
//   * 图片：`apply()` 的裁剪窗口（`clip_x/y/w/h`，一倍图逻辑像素）+ `@Nx` 倍数 + 镜像；
//     `repeatX/repeatY` 的平铺与 `offsetAnimX/Y/R` 的 UV 动画（`update_texture_attributes`）。
//   * 文字：`TextMesh` 的画布口径（字号取 `style.font` 的 `NNpx`、颜色取 `fill_style`、
//     对齐取 `text_align`、上下内边距 2）。
//   * 次序：`z` 升序（three.js 的透明排序：相机在 z=100 看向 -z ⇒ z 越大越后画），同 z 保持
//     模型树的递归序；五遍次序上 UI 分两遍（`z < 0` 落 UI 背景、否则落 UI 前景，D4）。
//   * 可见 / 递归：`ui.visible` 为假 ⇒ **整棵子树不画**（`render()` 里 `mesh.visible` +
//     父节点那句 `child.visible || (child.visible != child.renderer.visible)`）。
//   * 裁剪：祖先里每个 `clip_children` 的矩形求交（`effective_clip_rect`）。
//
// **没画的**（数据在、实现没做，见报告）：逐像素描边（`outline*`）、`background/foreground`
// 的着色器内合成（这里是两遍叠加）、`clip_children` 的**部分**越界（CanvasItem 的 `draw_*`
// 没有逐项裁剪 ⇒ 整项取舍）、3D 模型/GLB、文字的下划线/阴影/描边、`flip_y`。
// 九宫格（`nine_patch`）画了 —— 见 `emit_nine_patch`。
#pragma once

#include <string>

#include "host/godot/lfw_godot_renderer.h"
#include "lfw/ui/ui_node_renderer.h"

namespace lfw::ui {
class UINode;
}

namespace lfw::host {

// TS `new Ditto.UINodeRenderer(node)` 那一处的端口：每个 `UINode` 一个（`uinode.cpp` 的 ctor
// 从 `ILfwHost::create_ui_node_renderer` 拿，所有权归节点）。
class GodotUINodeRenderer : public ui::IUINodeRenderer {
 public:
  explicit GodotUINodeRenderer(GodotWorldRenderer& world) : _world(&world) {}
  ~GodotUINodeRenderer() override;

  // ---- 渲染面（D4 的 7 个成员）----
  void render(double dt, double dfactor) override;
  void add(IUINodeRenderer& child) override;
  void del(IUINodeRenderer& child) override;
  IUINodeRenderer* parent() override { return _parent; }
  void set_x(double v) override { _pos_x = v; }
  void set_y(double v) override { _pos_y = v; }
  bool visible() const override { return _visible; }
  void set_visible(bool v) override { _visible = v; }

  // ---- 生命周期/焦点转发：只维护"在不在场上"（TS 里是 `mesh.add` / `removeFromParent`）----
  void on_start() override;
  void on_stop() override;
  void on_resume() override;
  void on_pause() override;
  void del_self() override;

 private:
  void render_subtree(double dt);
  void step_local(double dt);  // 指数平滑（TS `render()` 的两个 `lerp`）
  void sync_model();           // `lifetime` 一变同步一次（TS `sync()`）
  void compute_global();       // 父坐标系 → 屏幕坐标 + 屏幕盒子 + 继承来的裁剪
  bool emit_node();            // 出一个节点的绘制项；返回"画了没有"
  bool emit_image(const GodotDrawItem& proto, double x, double y, double w, double h,
                  bool mirror_x);
  // 九宫格（`img.nine_patch`）：3×3 共 9 块各出一次项（四角 1:1、四边与中间拉伸）。
  bool emit_nine_patch(const GodotDrawItem& proto, double x, double y, double w, double h,
                       bool mirror_x);
  void parse_nine_patch(const Value& img);  // 读 `img.nine_patch`（缺省按 TS `ensure_parameters`）
  std::string node_tag() const;
  GodotUINodeRenderer* parent_renderer() const;
  // 这一项落在哪一遍（D4：`z < 0` 落 UI 背景）。层根与其**直接子节点**按自己的 `z` 判，
  // 更深的节点跟随所在容器（`UINodeRenderer.attach_ui_layer` 的同一口径）。
  int pass_of() const;

  GodotWorldRenderer* _world = nullptr;  // 绘制项的落点（送进 `_pending` 那一帧）
  GodotUINodeRenderer* _parent = nullptr;
  bool _attached = true;  // `on_pause`/`on_stop` 之后不再画（TS 的 `removeFromParent`）
  bool _visible = true;   // 镜像（TS `mesh.visible`，递归条件要用它）

  // ---- 位姿（TS：`mesh.position/scale` 平滑到 `_p1`/`_s1`）----
  bool _pos_init = false;
  double _pos_x = 0, _pos_y = 0;      // 平滑后的**本地**位置（y 向下）
  double _scale_x = 1, _scale_y = 1;  // 平滑后的**本地**缩放
  double _gx = 0, _gy = 0, _gz = 0;   // 本帧的全局位置（屏幕坐标；`_gz` 是累计 z）
  double _gsx = 1, _gsy = 1;          // 本帧的全局缩放（含自己）
  // 本帧的屏幕盒子（负缩放已归一化；`compute_global` 填，裁剪与出项都用它）
  double _box_x0 = 0, _box_y0 = 0, _box_x1 = 0, _box_y1 = 0;
  bool _box_valid = false;
  // 继承来的裁剪（祖先里 `clip_children` 的矩形交集）
  bool _clip_on = false;
  double _clip_x0 = 0, _clip_y0 = 0, _clip_x1 = 0, _clip_y1 = 0;

  // ---- 每个 `lifetime` 同步一次的快照（TS `sync()`；位置与缩放不在此列）----
  double _sync_lifetime = -1;
  bool _alpha_init = false;
  double _alpha = 1;
  double _rect_x = 0, _rect_y = 0, _rect_w = 0, _rect_h = 0;  // 锚点平移后的本地矩形
  // 图片（解析出来的条目名 + 裁剪 + 镜像 + 平铺 + UV 动画）
  std::string _img_path;
  bool _wants_img = false;       // 数据里有图（用来区分"没图"与"有图但取不到"）
  bool _img_unresolved = false;  // 有图但路径一个包都没命中
  double _tex_scale = 1;
  double _img_lw = 0, _img_lh = 0;  // 一倍图逻辑尺寸（PNG 头）
  double _crop_x = 0, _crop_y = 0, _crop_w = 0, _crop_h = 0;
  bool _flip_x = false, _flip_y = false;
  double _repeat_x = 1, _repeat_y = 1;
  // 九宫格（`img.nine_patch`，TS `NinePatchGeometry`）：尺寸都在**纹理像素**上（角尺寸要除以
  // `@Nx` 倍数才是几何尺寸）。`f_*` 是框内边距、`l_w/t_h/r_w/b_h` 是四边角尺寸。
  bool _np_on = false;
  double _np_fw = 1, _np_fh = 1;
  double _np_fl = 0, _np_ft = 0, _np_fr = 0, _np_fb = 0;
  double _np_lw = 0, _np_th = 0, _np_rw = 0, _np_bh = 0;
  double _anim_x = 0, _anim_y = 0, _anim_r = 0;
  double _uv_x = 0, _uv_y = 0, _uv_angle = 0;  // UV 动画的积分（纹理单位 / 弧度）
  // 颜色（TS `update_img`：有图 ⇒ 混色 + 强度；无图 ⇒ 覆盖色 + 强度）
  bool _has_color = false;
  double _cr = 1, _cg = 1, _cb = 1, _ca = 0;
  bool _has_bg = false, _has_fg = false;
  double _bgr = 0, _bgg = 0, _bgb = 0, _bga = 0;
  double _fgr = 0, _fgg = 0, _fgb = 0, _fga = 0;
  // 文字（TS `UITextRenderer` + `TextMesh` 的样式口径）
  std::string _text;
  double _font_size = 9;
  std::string _font_css;  // `style.font` 原文（CSS 简写）—— 交给宿主按字族挑字体
  int _text_align = 0;  // 0 左 / 1 中 / 2 右
  double _tr = 1, _tg = 1, _tb = 1, _ta = 1;
};

}  // namespace lfw::host
