// 录制型 `IWorldRenderer`：**不画**，只把「核心每帧要渲染器画什么」记下来。
//
// 为什么要有它：`native/lfw/**` 里的 `IWorldRenderer`（`lfw/world.h:61-68`）是**保留式**的
// —— `add_entity` / `del_entity` 只在实体进出世界时各调一次，`render(dt)` 每帧调一次，而且
// 拿的是**活实体的引用**（节点/精灵在真实渲染器里长期持有）。所以「一帧要画什么」这件事
// 只有渲染器自己知道 —— 它必须**每帧**从它持有的活实体上取一份当前值（唯一例外是插值那一对
// `p0/p1`：它**一个 tick 只刷一次**，见文件末）。
//
// 这一份就是那份快照：字段全部来自 `Entity` 现有的公开面（`native/lfw/entity/entity.h`），
// **没有一个是编的**；缺什么在报告里点出来（例如没有逐实体 `alpha`，只有 `invisible` /
// `blinking` 两个开关量）。
//
// 输出格式（`--dump` 落盘 / 终端摘要都用它，**一个实体一行、一帧一段**）：
//
//   FRAME <n> dt=<ms> life=<lifetime> ret=<记录器持有的活体数> live=<world.entities+ghosts>
//         match=<ret==live> cam=<x>,<y> bg=<bg.id> layer=<layer_data_index> upd=<update_times>
//         xform=<x>,<y>,<z> scale=<sx>,<sy>,<sz> screen=<w>,<h> ents=<本帧记录条数>
//         df=<帧内比例 dfactor> dtime=<帧内累计 ms> dirty=<本帧刷没刷 p0/p1>
//         tu=<一个 tick 的目标时长 ms> fps=<目标渲染率> ups=<dataset.UPS>
//         camp0=<x>,<y> camp1=<x>,<y> caml=<相机按 df 插出来的位置>
//   E id=<entity.id> data=<data.id> type=<data.type> pos=<p1> prev=<p0>
//     facing=<±1> wait=<帧内计时> frame=<frame.id> state=<frame.state> pf=<prev_frame.id>
//     tex=<frame.pic.tex 素材 id> crop=<x>,<y>,<w>,<h> pics=<frame.pics 层数>
//     c=<frame.centerx>,<centery>
//     hp=<hp>/<hp_max> mp=<mp>/<mp_max> tough=<toughness>/<toughness_max>
//     invis=<invisible> blink=<blinking> invuln=<invulnerable>
//     name_vis=<name_visible> ctrl_vis=<ctrl_visible> name=<显示名> variant=<队伍变体>
//     shake=<受击抖动> life=<实体存活帧数> mix=<mix_color>@<mix_strength> grey=<greyscale>
//     outline=<outline_color>@<outline_alpha>,<outline_width> ol_en=<outline_enabled>
//     fx=<render_effect_time> ghost=<ghosted> mount=<mounted>
//     lerp=<p0 → p1 按 df 插出来的位置>
//
// 数字一律 `%.4f`（位置/速度都落在 1/1000 格点上，四位足够且逐位可复现）；取不到的字符串
// 字段落成 `-`。
//
// ⚠ **`pos` / `prev` 是插值那一对（TS 的 `p1` / `p0`），不是"相邻两次 `render()` 的差"**：
// `src/DittoImpl/renderer/EntityRenderer.ts:95-128` 里 `p0.copy(p1); p1 = 当前值` 只在
// `owner.dirty` 为真时发生，而 `owner.dirty` 就是"tick 边界"（`WorldRenderer.ts:187-204` 用
// `world.lifetime` 变没变判的）⇒ 一对 `(p0, p1)` = **两个 tick 端点的位置**，一个 tick 里
// **只刷一次**；同一 tick 内的后续 `render()` 只把 `dfactor` 往前推。
// ⇒ 记录器照抄这条（`dirty` 门控 + `dfactor` 逐字来自 `WorldRenderer.ts` 的算法），
// 而不是"每次 `render()` 都刷新 prev"（那样一个 tick 里渲染多次时 `prev` 会退化成当前值，
// 插值整条路等于没跑过）。`--sync-render FPS_120 --sub-render N` 能把这条路真跑起来。
//
// ⚠ 记录的是**模型空间**的 `Entity::position`：TS 画之前还要过一遍 `(x, y − z/2, z)` 的纵深
// 投影、`StateEnum.Message` 的横向夹取、以及挂载者（`bearer`/`catcher`）那一路父坐标系
// （`EntityRenderer.ts:99-134`）—— 那几步录制器**不做**（契约的坐标语义见 DESIGN D1(b)），
// 所以 `lerp=` 是模型空间的插值结果，不是最终落点。
#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "lfw/lfw.h"
#include "lfw/world.h"

namespace lfw::host {

// 一个活体在某一次 `render()` 时的绘制记录（字段序与 `format_entity_record` 一一对应）。
struct EntityDrawRecord {
  std::string id;
  std::string data_id;  // 画哪套素材
  double type = 0;      // data.type（0 = 角色，1 = 武器，2 = 球…）
  // 插值那一对：`p1` = 本 tick 端点的位置（打印成 `pos=`），`p0` = 上一 tick 端点的位置
  // （打印成 `prev=`），外加按本帧 `dfactor` 插出来的 `lerp`（打印成 `lerp=`）。
  double x = 0, y = 0, z = 0;
  double px = 0, py = 0, pz = 0;
  double lx = 0, ly = 0, lz = 0;
  double facing = 1;  // +1 朝右 / -1 朝左（精灵翻面）
  double wait = 0;    // 帧内计时（当前动作帧走到哪儿）
  std::string frame_id;
  std::string state;
  std::string prev_frame_id;
  // 当前帧的精灵引用（`frame.pic`，`IFramePic`）：`tex` 是素材 id，`x/y/w/h` 是 atlas 裁剪矩形
  // —— 真渲染器就是拿这一组去取图 + 摆位（`EntityMainRender` 的 `frame.pic` / `frame.pics`）。
  std::string pic_tex;  // 没有 `pic` 时落成 "-"（例如纯 3D 模型帧）
  double pic_x = 0, pic_y = 0, pic_w = 0, pic_h = 0;
  double pics_count = 0;                // `frame.pics` 的层数（多图层）
  double frame_cx = 0, frame_cy = 0;    // `frame.centerx/centery`（精灵锚点）
  // 状态条（`EntityStatRender` 读的就是这一族）。
  double hp = 0, hp_max = 0, mp = 0, mp_max = 0;
  double toughness = 0, toughness_max = 0;
  // 可见度 / 闪烁 —— 端口**没有**逐实体 `alpha`，只有这两个开关量（见文件头）。
  double invisible = 0, blinking = 0, invulnerable = 0;
  double name_visible = 0, ctrl_visible = 0;
  std::string name;          // 显示名（`EntityNameRender` / 血条旁边那行）
  double variant = 0;        // 队伍/皮肤变体（`Entity` 的 `variant`）
  double shaking = 0;        // 受击抖动（渲染偏移）
  double lifetime = 0;       // 实体自身的存活帧数（出生淡入用，不是 world.lifetime）
  // 外观（TS 的 `_render_effect_*` 一族）：换色/描边/灰度 + 一个「外观改动过」的计数。
  std::string mix_color;
  double mix_strength = 0, greyscale = 0;
  std::string outline_color;
  double outline_alpha = 0, outline_width = 0;
  std::string outline_enabled;  // `outline_enabled()`；`null` ⇒ "-"（走缺省）
  double render_effect_time = 0;
  double ghosted = 0, mounted = 0;
};

// 一帧的绘制记录：帧级上下文（相机 / 背景 / 世界变换 / 屏幕尺寸）+ 本帧每条活体。
struct FrameDrawRecord {
  int index = 0;       // 记录器第几次 `render()`（从 1 起）
  double dt = 0;       // 传进来的 dt（毫秒）
  double lifetime = 0;  // `world.lifetime`（= TS 的 `utime`；tick 边界就是它变没变）
  // ---- `dfactor` 一族（逐字照抄 TS `WorldRenderer.ts:187-204`，见文件头）----
  double dfactor = 1;   // 本帧的帧内比例
  double dtime = 0;     // 帧内累计的 dt（ms）
  bool dirty = false;   // 本帧是不是 tick 边界（刷新了 p0/p1；= TS 的 `dirty`）
  double tu = 0;        // `world.TU`：一个 tick 的目标时长（ms）
  double fps = 0;       // `world.fps_value()`（TS 的 `world.FPS`）
  double ups = 0;       // `dataset.UPS`
  // 相机那一对（TS `WorldRenderer.cam_p0/cam_p1`，同一次 `dirty` 刷新）+ 插出来的位置。
  double cam_p0_x = 0, cam_p0_y = 0;
  double cam_p1_x = 0, cam_p1_y = 0;
  double cam_lerp_x = 0, cam_lerp_y = 0;
  int retained = 0;    // `add_entity` / `del_entity` 维护出来的活体数
  int world_live = 0;  // `world.entities + world.ghosts`（对拍：保留式记账有没有漏）
  bool retained_matches_world = true;
  double cam_x = 0, cam_y = 0;
  std::string bg_id;
  double bg_layer_data_index = 0, bg_update_times = 0;
  double tx = 0, ty = 0, tz = 0;     // world.transform（真渲染器拿它摆世界节点）
  double tsx = 1, tsy = 1, tsz = 1;  // world.transform.scale_*
  double screen_w = 0, screen_h = 0;  // dataset（`EntityRenderer` 的 Message 夹取用）
  std::vector<EntityDrawRecord> entities;
};

// 格式化的三条（`--dump` 的头部与正文都用它们，避免两处格式漂移）。
std::string format_frame_header(const FrameDrawRecord& frame);
std::string format_entity_record(const EntityDrawRecord& entity);
// `--dump` 文件里紧跟头部的一行字段名（= `EntityDrawRecord` 的字段序）。
std::string format_entity_field_names();

// 录制型世界渲染器。持 `LFW&` 是为了取帧级上下文（相机 / 背景 / transform / dataset）——
// 这些在 `IWorldRenderer` 的四个成员里拿不到，而真渲染器同样要从世界读它们。
class RecordingWorldRenderer : public IWorldRenderer {
 public:
  explicit RecordingWorldRenderer(LFW& lfw) : _lfw(&lfw) {}

  // ---- IWorldRenderer（保留式）----
  void add_entity(Entity& e) override;
  void del_entity(Entity& e) override;
  void render(double dt) override;
  void dispose() override;

  // ---- 观测面（CLI 用）----
  int render_count() const { return _render_count; }
  const std::vector<FrameDrawRecord>& frames() const { return _frames; }
  std::size_t retained_count() const { return _live.size(); }
  long long added() const { return _added; }
  long long removed() const { return _removed; }
  long long duplicate_adds() const { return _duplicate_adds; }
  long long stray_removes() const { return _stray_removes; }
  long long mismatched_frames() const { return _mismatched_frames; }
  bool disposed() const { return _disposed; }
  // 插值那条路真跑没跑过（CLI 的 `[thin] done` 行）：逐实体记录里
  // `df01` = `0 < dfactor < 1` 的条数、`interp` = 再要求 `p0 != p1`、`moved` = `p0 != p1`。
  long long entity_records() const { return _entity_records; }
  long long df_between_records() const { return _df_between; }
  long long interpolated_records() const { return _interpolated; }
  long long moving_records() const { return _moving; }

 private:
  // 记录器持有的活体 + 插值那一对（TS `EntityRenderer.p0` / `p1` 的替身）。
  struct Live {
    Entity* e = nullptr;
    double p0x = 0, p0y = 0, p0z = 0;
    double p1x = 0, p1y = 0, p1z = 0;
  };

  LFW* _lfw = nullptr;
  std::vector<Live> _live;  // 插入序；`render()` 里按 id 排序后记录
  std::vector<FrameDrawRecord> _frames;
  int _render_count = 0;
  // `dfactor` 的帧内状态（TS `WorldRenderer.utime/dtime/dfactor/dirty` 的初值，`:182-186`）。
  double _utime = 0;
  double _dtime = 0;
  double _dfactor = 1;
  bool _dirty = false;
  double _cam_p0_x = 0, _cam_p0_y = 0;
  double _cam_p1_x = 0, _cam_p1_y = 0;
  long long _added = 0;
  long long _removed = 0;
  long long _duplicate_adds = 0;
  long long _stray_removes = 0;
  long long _mismatched_frames = 0;
  long long _entity_records = 0;
  long long _df_between = 0;
  long long _interpolated = 0;
  long long _moving = 0;
  bool _disposed = false;
};

}  // namespace lfw::host
