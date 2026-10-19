// Godot 侧的 `IWorldRenderer`（DESIGN §G2 第二半）：把「核心每帧交给渲染器的契约数据」翻成
// **屏幕空间**的绘制项（`GodotDrawItem`），本文件**一个引擎类型都不碰** —— 真正的 `draw_*`
// 调用在 `lfw_godot_node.cpp` 的 `_draw()`（§G5「只在边界转换」）。
//
// 数据来源与会话语义逐条对齐 DESIGN「★ 绘制契约（引擎无关）」：
//   * 帧级上下文：相机（含插值那一对）/ `world.transform` / `dataset.screen_*` / `world.bg()`；
//   * 帧内比例 `dfactor`：逐字照抄 `WorldRenderer.ts:187-204`（与 `host/thin` 同一份算法）；
//   * 逐实体：`host/thin/recording_world_renderer.h` 那份字段表（它证明字段面，这里真画）。
//
// 屏幕空间：逻辑视口 = `dataset.screen_w × screen_h`（缺省 794×450），**原点左上、y 向下**；
// 一个世界单位 = 一个逻辑像素。世界 → 屏幕（TS `WorldRenderer.ts:222-227` 的 ortho 相机 +
// 世界节点变换推出来的）：
//     sx = transform.x + scale_x * (wx - cam_x)
//     sy = screen_h - transform.y - scale_y * (wy - cam_y)
// ⚠ `scale_*`（= `bg.zoom_*`）、`cam_*`（插值后的相机位置）、`transform.*` 三者都从世界上读，
// 不写死。
//
// 与 TS 的对应关系（`src/DittoImpl/renderer/**`）：
//   * 位置：`EntityRenderer.update_position/render`（`p1 = (x, y - z/2, z)`、`p0/p1` 按 `dfactor`
//     插值、`lifetime === 0` 时 `df = 1`、被持有者不做自己的插值而是减去持有者的位移）；
//   * 主图：`EntityMainRender.render/update_texture/update_mesh_material`（锚点镜像
//     `facing === 1 ? -centerx : centerx - width`、`mesh.scale = (pic.w, pic.h)`、裁剪
//     `(pic.x, pic.y, pic.w, pic.h)`、`flip_x = facing`）；
//   * 多图层：`frame.pics[i-1]` 各自 `cx/cy` 覆盖 + `0.05 * i` 的纵深偏置；
//   * 次序：`WorldRenderer.render_layers`（背景层 → 实体 → 前景层）+ `collect_entity_groups`
//     的「组按代表实体的 z 远→近」；
//   * 资源：`files[tex]` 的 `variants` 变体表 + `get_import_fallbacks` 的 `@Nx` 回退
//     （`native/lfw/loader/get_import_fallbacks`，与 TS 同一张表）。
//
// **没画的**（数据在、实现没做，见报告）：3D 模型帧（`frame.model`）、名字/血条（要字体度量）、
// 调试指标层（`entity_flags`，缺省 0）、九宫格/UV 动画、`greyscale`（要逐像素着色器）。
// ⚠ 一处**近似**：`mix_color` 用第二遍 `modulate` 叠（对最常见的"受击闪白"等价，别的颜色偏暗）。
// 逐图旋转（`pic.rad`）已画：绘制项带 `rot`（绕矩形中心，屏幕空间弧度），宿主自己转。描边已经按
// TS 的判据落（白剪影 + 纯色 `modulate`，四邻偏移 —— 见 `lfw_godot_node.cpp::draw_item`）。`UI`
// 那一遍（`IUINodeRenderer`）本宿主仍回 `nullptr`。
#pragma once

#include <cstddef>
#include <map>
#include <string>
#include <vector>

#include "lfw/lfw.h"
#include "lfw/ui/component/text_input.h"
#include "lfw/ui/uinode.h"
#include "lfw/world.h"

namespace lfw::host {

class HeadlessHost;

// `frame.model`（3D 模型帧）的一份快照：渲染器只把**参数**填好（原样照 TS 的 `model_node`
// 摆位 + 动画驱动），加载 glb 与真正出像素是引擎那一侧的事（`lfw_godot_models.{h,cpp}`）。
struct GodotModelSpec {
  std::string path;  // `base.models[id].path`（已剥掉 `!` 精确 / `?` 模糊前缀）
  bool exact = true;
  // 动画：`anim` 是片段名（空 ⇒ 不播）；`loop` / `reverse` / `hold_last` 同 TS。
  std::string anim;
  bool loop = false, reverse = false, hold_last = false;
  // 模型节点（TS `model_node`）：局部位置（y 向上、z 朝观众）、缩放（x 已乘 `facing`）、
  // 欧拉角（弧度，XYZ；面朝左时 y/z 取反 —— 与 TS 的 `rotation.set(...)` 一致）。
  double px = 0, py = 0, pz = 0;
  double sx = 1, sy = 1, sz = 1;
  double rx = 0, ry = 0, rz = 0;
  // 模型轮廓（TS `update_model_outline`：反向外壳）。`outline_w > 0 && outline_a > 0` 才画；
  // 宽度是**逻辑像素**（与精灵描边同一个口径），内部会除以模型缩放折回网格局部单位。
  double outline_r = 0, outline_g = 0, outline_b = 0, outline_a = 0, outline_w = 0;
};

// 一条绘制项。字段全部是通用图形名词（矩形 / 裁剪 / 纹理路径 / 颜色 / 次序）。
struct GodotDrawItem {
  // 目标矩形（逻辑屏幕像素，左上原点、y 向下）。
  double x = 0, y = 0, w = 0, h = 0;
  // 纹理：`path` 是解析出来的**资源条目名**（空 ⇒ 宿主画占位色块）。
  std::string path;
  double tex_scale = 1.0;  // `@Nx` 倍数：裁剪矩形乘它才是纹理像素
  // 图集裁剪（一倍图逻辑像素）与镜像。
  double sx = 0, sy = 0, sw = 0, sh = 0;
  bool flip_x = false;
  bool flip_y = false;
  // 逐图旋转（`pic.rad`）：绕**矩形中心**的屏幕空间弧度（y 向下 ⇒ 正角在屏幕上是顺时针）。
  // `x/y/w/h` 记的是旋转**之后**矩形中心的落点（矩形本身不变），宿主自己绕中心转。
  double rot = 0;
  // 纯色块（UI 的覆盖色 / `background` / `foreground`）：直接拿 `r/g/b/a` 填矩形 —— 不去查纹理，
  // 也不画"取不到图"的占位色块（占位色块是实体那一遍的诊断）。
  bool flat = false;
  // 3D 模型项（`frame.model`）：这一项不是 blit，而是「把某个实体的模型实例渲染到 `x/y/w/h`
  // 这个（逻辑像素、屏幕系）矩形里」。`model.path` 非空 ⇒ 这一项是模型项。
  GodotModelSpec model;
  bool has_model = false;
  // 颜色（0..1）：`r/g/b` 是 `modulate`、`a` 是不透明度（影子用它）。
  double r = 1, g = 1, b = 1, a = 1;
  // 换色（`mix_color` + `mix_strength`）：`mix_a > 0` ⇒ 宿主再叠一遍 `modulate`
  //（TS 是着色器里的 `mix(color.rgb, mixColor, strength)`；两遍叠加对最常见的"受击闪白"
  // 逐位等价，其它颜色的结果会偏暗 —— 见报告）。
  double mix_r = 1, mix_g = 1, mix_b = 1, mix_a = 0;
  // 描边（`outline_*`）：宽度是**逻辑像素**的扩张量（TS 里乘图片 `scale` 只是给着色器算 texel，
  // 折回后仍是逻辑像素）；宿主用"白剪影 + 描边色 `modulate`"画上下左右四个偏移。
  double outline_r = 0, outline_g = 0, outline_b = 0, outline_a = 0, outline_w = 0;
  // 诊断：来源（"bg" / "fg" / "shadow" / "entity"）与标记（实体 id / 图层名）。
  std::string kind;
  std::string tag;
  double depth = 0;
  // 背景层的 UV 循环 / 偏移动画（TS `BgLayerRender.update_uv`）：
  //   `uv_tile` 为真 ⇒ 纹理按 `uv_px × uv_py`（**逻辑像素**的周期 = `min(源图, 目标)`）在矩形里平铺；
  //   `uv_ox/uv_oy` 是相位（同样逻辑像素，已按周期取正模）。
  // `uv_loop` 与 `offsetAnimX/Y` 任一存在就要走这条（前者决定"平不平铺"，后者决定"动不动"）。
  bool uv_tile = false;
  double uv_px = 0, uv_py = 0, uv_ox = 0, uv_oy = 0;
  // ---- UI 那一遍（DESIGN D4；`lfw_godot_ui_renderer.{h,cpp}` 填这几条）----
  // 五遍次序里 UI 占两遍（D1(a)：**UI 背景 → 背景/实体/前景 → UI 前景**）⇒ 每一遍记一个
  // pass，`_draw()` 按 pass 三趟扫（同一趟内保持收集次序）。
  //   `-1` = UI 背景（节点 `z < 0`）、`0` = 世界（背景层 / 实体 / 前景层）、`+1` = UI 前景。
  int pass = 0;
  // 文字（非空 ⇒ 这一项是文字，不是 blit）：字符串 / 字号（逻辑像素）/ 0=左 1=中 2=右。
  std::string text;
  double font_size = 0;
  int text_align = 0;
  // 文字描边：`stroke_w` 是描边的**像素厚度**（向外扩多少），宿主按它铺偏移复制。
  //   * UI 文字：节点级 `outlineWidth`（**逻辑像素**，1 ⇒ 1px、4 ⇒ 4px）；
  //   * 世界文字：1 个世界单位（TS plain 模式的 `outlineWidth = TEXT_SUPERSAMPLE` 个 4 倍
  //     texel ⇒ 折回 1 单位）。
  double stroke_r = 0, stroke_g = 0, stroke_b = 0, stroke_a = 0, stroke_w = 0;
  // 世界文字（实体名下 / 剩余数量上，TS `EntityNameRender` / `EntityStatRender`）：
  // 这一项的 `x/y` 是**屏幕锚点**，块尺寸由宿主按字体度量算（TS 那边是 canvas 量出来的
  // `mesh.scale`）；`text_below` ⇒ 文字块的**中心**挂在锚点下方一个文字高度（名字：锚点 = 地面），
  // 否则挂在锚点上方半个文字高度（剩余数量：锚点 = 精灵顶边）。
  bool world_text = false;
  bool text_below = false;
  // 世界文字的横向夹取（TS `clamp(position.x, cam_x + hw, …)`，`hw = (块宽 + 10)/2` 折算到屏幕）：
  // 宿主用 `[clamp_x0 + hw, clamp_x1 - hw]` 夹锚点，`hw = 块宽/2 + clamp_pad`。
  bool has_clamp_x = false;
  double clamp_x0 = 0, clamp_x1 = 0, clamp_pad = 0;
  // `style.font` 的原文（CSS 简写，如 `"bold 18px Arial"`）。字号已经单独抽出来了，
  // 这里留着是为了让 `_draw()` 能按**字族**挑字体 —— 浏览器就是按它渲染的
  //（`TextMesh.ts:66` 直接把整串塞给 `ctx.font`）。
  std::string font_css;
  // UI 的裁剪（祖先 `clip_children` 求交；`has_clip` 为假即不裁）。⚠ `_draw()` 只能整项取舍
  //（CanvasItem 的 `draw_*` 没有逐项裁剪）⇒ 部分越界的项照画（见报告）。
  bool has_clip = false;
  double clip_x0 = 0, clip_y0 = 0, clip_x1 = 0, clip_y1 = 0;
};

// `frame.model`（3D 模型帧）每个模型实例一张**正方形**离屏画布：逻辑像素 = 世界单位，
  // 模型的局部原点落在画布中心（⇒ 1 单位 = 1 逻辑像素，与 2D 精灵同一口径）。
  // 取 512 是因为数据里最大的模型（书 15 倍 / 机器人 16.96 倍）在 ±128 单位以内。
  inline constexpr double kModelViewport = 512.0;

// 一帧的绘制项（按绘制次序排好：先画的在前）。
struct GodotFrame {
  bool valid = false;
  long long index = 0;
  double dt = 0, lifetime = 0;
  // 帧内比例一族（与 `host/thin` 的帧头同一份口径）。
  double dfactor = 1, dtime = 0, tu = 0, fps = 0, ups = 0;
  bool dirty = false;
  // 相机（`camp0`/`camp1` 就是 TS `WorldRenderer.cam_p0/cam_p1`）+ 插出来的位置。
  double cam_p0_x = 0, cam_p0_y = 0, cam_p1_x = 0, cam_p1_y = 0;
  double cam_x = 0, cam_y = 0;
  double tx = 0, ty = 0, scale_x = 1, scale_y = 1;
  double screen_w = 794, screen_h = 450;
  std::string bg_id;
  std::vector<GodotDrawItem> items;
  // 诊断（宿主打印一行；不影响画面）。
  int retained = 0, world_live = 0;
  int drawn_entities = 0, hidden_entities = 0, no_pic_entities = 0, no_file_entities = 0;
  int bg_layers = 0;
  int unnamed_textures = 0;
  int outline_items = 0;              // 带描边的绘制项（诊断）
  std::string outline_probe;          // 第一条描边的 `#rrggbb@alpha,width`（诊断）
  // 背景层的 UV 循环/偏移动画（诊断）：条目数 + 第一条的 `px,py,ox,oy@tag`
  int uv_items = 0;
  std::string uv_probe;
  int rotated_items = 0;              // 带 `pic.rad` 的旋转绘制项（诊断）
  double rotated_probe = 0;           // 第一条旋转项的角度（弧度，诊断）
  int model_items = 0;                // `frame.model` 的 3D 模型项（诊断）
  std::string model_probe;            // 第一个模型项的 `path|anim`（诊断）
};

// UI 那一遍的观测面（D4 第二半的诊断；不进三条摘要）。逐帧清零。
struct GodotUIStats {
  long long layers = 0;       // `ui_begin_layer` 的次数（= 有页的层数）
  long long nodes = 0;        // 走到的节点数
  long long drawn = 0;        // 真的出了绘制项的节点数
  long long hidden = 0;       // 不可见（整棵子树跳过）
  long long empty = 0;        // 可见但没有可画的东西（无图/无色/无字/尺寸为 0）
  long long clipped = 0;      // 被祖先 `clip_children` 裁掉（整项在裁剪矩形外）
  long long missing_img = 0;  // 有图但路径解析不出来
  long long texts = 0;        // 文字项
  long long items = 0;        // 绘制项总数
};

// UI 层里的文本输入框（`TextInput` 组件）。Web 那边 `UINodeRenderer.on_resume()` 给这类节点
// 挂一层真 DOM `<input>`（`.ui_node_style input`：透明底、无边框、`text-align:center`、继承字体）
// —— 本宿主没有 DOM ⇒ 渲染器只把**方框 + 样式**留出来，由 `LfwGodot` 摆一个真的 `LineEdit`
// 上去（`LfwGodot::sync_text_input`）。逐帧清零，跟着那一帧的 UI 树走。
struct GodotTextInputBox {
  ui::UINode* node = nullptr;
  ui::TextInput* input = nullptr;
  double x0 = 0, y0 = 0, x1 = 0, y1 = 0;  // 逻辑屏幕像素（同 `_box_*`）
  double font_size = 9;                   // 逻辑像素
  std::string font_css;                   // `style.font` 原文
  double r = 1, g = 1, b = 1, a = 1;      // 文字色（同这一节点的文字口径）
  int text_align = 0;                     // 0 左 / 1 中 / 2 右
};

// Godot 宿主的 `IWorldRenderer`。
class GodotWorldRenderer : public IWorldRenderer {
 public:
  GodotWorldRenderer(LFW& lfw, HeadlessHost& host) : _lfw(&lfw), _host(&host) {}

  // ---- IWorldRenderer（保留式）----
  void add_entity(Entity& e) override;
  void del_entity(Entity& e) override;
  void render(double dt) override;
  void dispose() override;

  // 宿主 `_draw()` 取最近一次 `render()` 组好的那一帧（与写入中的那一帧双缓冲：
  // 「一个 tick 里渲染多次」时读的那份永远是完整的）。
  const GodotFrame& take_frame();
  bool has_frame() const { return _shown.valid; }

  // 资源字节：条目名（`/` 分隔）→ 字节。先查已加载的数据包、再查 `--root` 的根目录。
  // 宿主侧纹理缓存用它（`lfw_godot_textures.{h,cpp}`）。
  bool read_resource(const std::string& path, std::string& out) const;

  // 一个素材键解析出来的东西（逐帧复用；`files[tex]` 一变就重建）。
  struct Resolved {
    std::string path;  // 命中条目名（空 ⇒ 没找到）
    double scale = 1;  // `@Nx`
    double img_w = 0, img_h = 0;  // 一倍图逻辑尺寸（PNG 头）
  };

  // 路径 → 命中条目名 / 倍数 / 一倍图尺寸（与实体的 `resolve_path` 同一张回退表：`@Nx`、
  // `.webp`）。UI 那一遍用它（`lfw_godot_ui_renderer.cpp` 的图片节点）。
  const Resolved& probe_path(const std::string& path) { return resolve_path(path); }

  // ---- UI 渲染面（D4 第二半）----
  // `GodotUINodeRenderer` 一个层一次 `begin`/`end`：中间把 UI 节点翻成的绘制项 `append` 进来，
  // `end` 按 (pass, z, 收集序) 稳定排序后并进**正在写的那一帧**（`render()` 已经建好的 `_pending`）。
  // 于是 UI 背景那一批排在世界之前、UI 前景那一批排在世界之后 —— 正是 D1(a) 的五遍次序。
  void ui_begin_layer();
  void ui_append(GodotDrawItem item);
  void ui_end_layer();

  // 观测面（诊断行）：UI 那一遍的计数（`GodotUINodeRenderer` 填）。
  GodotUIStats& ui_stats() { return _ui_stats; }
  const GodotUIStats& ui_stats() const { return _ui_stats; }

  // 这一帧 UI 树里的文本输入框（收集序；后收集的在上）。`LfwGodot` 每步之后读它。
  void ui_add_text_input(GodotTextInputBox box) { _ui_text_inputs.push_back(std::move(box)); }
  const std::vector<GodotTextInputBox>& ui_text_inputs() const { return _ui_text_inputs; }

  // `--ui-dump`：把**最后一帧**每个 UI 节点的一行事实留在 `ui_dump_lines()`（宿主打完就退）。
  void set_ui_dump(bool on) { _ui_dump_on = on; }
  bool ui_dump_on() const { return _ui_dump_on; }
  std::vector<std::string>& ui_dump_lines() { return _ui_dump_lines; }

  // ---- 观测面（与 `NullWorldRenderer` 同口径，摘要行要用）----
  long long added() const { return _added; }
  long long removed() const { return _removed; }
  long long renders() const { return _render_count; }
  long long live() const { return static_cast<long long>(_live.size()); }
  long long duplicate_adds() const { return _duplicate_adds; }
  long long stray_removes() const { return _stray_removes; }

 private:
  // 记录器持有的活体 + 插值那一对（TS `EntityRenderer.p0/p1` 的替身；投影后的坐标）。
  struct Live {
    Entity* e = nullptr;
    double p0x = 0, p0y = 0, p0z = 0;  // 上一个 tick 端点（投影后：`(x, y - z/2, z)`）
    double p1x = 0, p1y = 0, p1z = 0;  // 本 tick 端点
    double rx = 0, ry = 0, rz = 0;     // 本帧画到哪儿（`p0 → p1` 按 df 插，或跟随持有者）
    bool has_r = false;
    // 影子自己那一对（TS `EntityShadowRender._p0/_p1`：位置与缩放/不透明度各自一对）。
    double s0x = 0, s0y = 0, s0z = 0, s1x = 0, s1y = 0, s1z = 0;
    double s0s = 1, s1s = 1, s0o = 1, s1o = 1;
  };

  Live* find_live(const Entity* e);
  // 素材键 → 命中的条目名 / 倍数 / 一倍图尺寸（走 `files[key].variants` + `@Nx` 回退）。
  const Resolved& resolve_key(const Entity& e, const std::string& key, double variant);
  // 直接给路径（背景层 / 影子的 `file` / `shadow`）。
  const Resolved& resolve_path(const std::string& path);
  void build_background(const World& world, GodotFrame& frame, bool foreground);
  // 一条精灵：`world_x/world_y` 是实体**画到**的位置（已经是 `y - z/2` 之后的模型空间 y）。
  void emit_sprite(GodotFrame& frame, const Entity& e, const Value& pic, double world_x,
                   double world_y, double anchor_x, double anchor_y, const Resolved& res,
                   const std::string& kind);
  void emit_entity_shadow(const World& world, GodotFrame& frame, const Entity& e, const Live& live);
  // `frame.model` 的一条绘制项（TS `EntityMainRender` 的 `model_node` 摆位 + 动画参数）。
  void emit_model(GodotFrame& frame, const Entity& e, const Value& model, double world_x,
                  double world_y, double shaking_x);
  // 世界空间的一行文字（TS `TextMesh` 的 plain 模式：实体名下 / `xN` 剩余数量上）。
  // `anchor_world_y` 是锚点（名字 = 地面、剩余数量 = 精灵顶边）；`below` 见 `GodotDrawItem`。
  void emit_world_text(GodotFrame& frame, const Entity& e, double world_x, double anchor_world_y,
                       bool below, const std::string& text, bool clamp_x);

  LFW* _lfw = nullptr;
  HeadlessHost* _host = nullptr;
  std::vector<Live> _live;  // 插入序
  std::vector<Live*> _order;  // 本帧的绘制次序（借用 `_live` 的元素）
  GodotFrame _pending;  // `render()` 写
  GodotFrame _shown;    // `_draw()` 读
  std::map<std::string, Resolved> _resolved;   // "data_id|key" → 解析结果
  std::map<std::string, std::vector<std::string>> _variant_keys;  // 素材变体表
  std::vector<GodotDrawItem> _ui_buf;  // 本层收集中的 UI 绘制项（`ui_begin/end_layer` 之间）
  GodotUIStats _ui_stats;
  std::vector<GodotTextInputBox> _ui_text_inputs;  // 这一帧 UI 树里的文本输入框
  bool _ui_dump_on = false;
  std::vector<std::string> _ui_dump_lines;
  int _render_count = 0;
  // `dfactor` 的帧内状态（TS `WorldRenderer.utime/dtime/dfactor/dirty`）。
  double _utime = 0, _dtime = 0, _dfactor = 1;
  // 背景层 UV 偏移动画的时间积分（秒）。TS 是每个 `BgLayerRender` 自己 `offsetX += dt/1000*anim`
  // —— 同一条时间轴 ⇒ 这里只积一个标量，各层按自己的 `offsetAnimX/Y` 系数乘。
  double _uv_time = 0;
  bool _dirty = false;
  double _cam_p0_x = 0, _cam_p0_y = 0, _cam_p1_x = 0, _cam_p1_y = 0;
  long long _added = 0, _removed = 0, _duplicate_adds = 0, _stray_removes = 0;
  bool _disposed = false;
};

}  // namespace lfw::host
