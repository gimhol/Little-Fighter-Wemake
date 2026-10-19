#include "host/thin/recording_world_renderer.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "lfw/bg/background.h"
#include "lfw/camera.h"
#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/transform.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/utf8.h"

namespace lfw::host {
namespace {

std::string u16_to_utf8(const std::u16string& s) {
  const std::vector<uint8_t> buf = lfw::encode_utf8(s);
  return std::string(buf.begin(), buf.end());
}

// `Value` → 显示串（数字/字符串都走 `to_string`，与 `lfw_run` 的诊断行同口径）。
std::string val_str(const Value& v) { return u16_to_utf8(lfw::to_string(v)); }

// 取不到的字符串字段落成 `-`（`undefined` / `null` 都算取不到）。
std::string opt_str(const Value& v) {
  if (std::holds_alternative<std::monostate>(v)) return "-";
  if (std::holds_alternative<NullTag>(v)) return "-";
  return val_str(v);
}

// 对象字段当数字读；缺字段 ⇒ `fallback`（与 TS 的 `?? 0` 同口径）。
double num_or(const Value& holder, const char16_t* key, double fallback = 0.0) {
  const Value v = lfw::field_or(holder, key);
  if (std::holds_alternative<std::monostate>(v)) return fallback;
  const double n = lfw::to_number(v);
  return std::isnan(n) ? fallback : n;
}

std::string fnum(double v) {
  char buf[64];
  std::snprintf(buf, sizeof(buf), "%.4f", v);
  return std::string(buf);
}

std::string inum(long long v) {
  char buf[32];
  std::snprintf(buf, sizeof(buf), "%lld", v);
  return std::string(buf);
}

}  // namespace

void RecordingWorldRenderer::add_entity(Entity& e) {
  for (const Live& l : _live) {
    if (l.e == &e) {  // TS `mount_renderer` 对已挂载的实体提前返回
      ++_duplicate_adds;
      return;
    }
  }
  Live l;
  l.e = &e;
  // TS `EntityRenderer.mount`（`:153-155`）：`p1` 与 `p0` 都设成挂载时的位置。
  l.p0x = l.p1x = e.position.x;
  l.p0y = l.p1y = e.position.y;
  l.p0z = l.p1z = e.position.z;
  _live.push_back(l);
  ++_added;
}

void RecordingWorldRenderer::del_entity(Entity& e) {
  for (std::size_t i = 0; i < _live.size(); ++i) {
    if (_live[i].e != &e) continue;
    _live.erase(_live.begin() + static_cast<std::ptrdiff_t>(i));
    ++_removed;
    return;
  }
  ++_stray_removes;  // 没登记过的删除（不该出现；出现说明记账漏了）
}

void RecordingWorldRenderer::dispose() {
  _disposed = true;
  _live.clear();  // TS `WorldRender.dispose` 把整棵节点树拆掉
}

void RecordingWorldRenderer::render(double dt) {
  if (_disposed) return;
  ++_render_count;

  World& world = _lfw->world();
  FrameDrawRecord frame;
  frame.index = _render_count;
  frame.dt = dt;
  frame.lifetime = world.lifetime();

  // 帧内比例：TS `WorldRenderer.render`（`WorldRenderer.ts:187-204`）逐字照抄 —— `dfactor`
  // 是渲染器**自己**算的，`IWorldRenderer::render(dt)` 不传它。
  frame.tu = world.TU;
  frame.fps = world.fps_value();
  frame.ups = lfw::to_number(world.dataset.get(u"UPS"));
  if (frame.fps <= frame.ups) {
    // 渲染不比 tick 快 ⇒ 不需要插值（缺省的 `sync_render = FPS_60` + `UPS = 60` 走这一支）。
    _utime = frame.lifetime;
    _dtime = frame.tu;
    _dfactor = 1;
    _dirty = true;
  } else if (_utime != frame.lifetime) {
    // tick 边界：这一帧就是"上一 tick 的端点"，`p0/p1` 在这一帧刷。
    _utime = frame.lifetime;
    _dtime = 0;
    _dfactor = 0;
    _dirty = true;
  } else {
    _dtime = std::min(_dtime + dt, frame.tu);
    _dfactor = std::min(_dtime / frame.tu, 1.0);
  }
  frame.dfactor = _dfactor;
  frame.dtime = _dtime;
  frame.dirty = _dirty;

  frame.retained = static_cast<int>(_live.size());
  frame.world_live = static_cast<int>(world.entities.size() + world.ghosts.size());
  frame.retained_matches_world = frame.retained == frame.world_live;
  if (!frame.retained_matches_world) ++_mismatched_frames;

  const Camera& cam = world.camera();
  frame.cam_x = cam.position.x;
  frame.cam_y = cam.position.y;
  // 相机那一对（TS `WorldRenderer.cam_p0/cam_p1`）：同一次 `dirty` 刷新，然后用**同一个**
  // `dfactor` 插（`WorldRenderer.ts:205-211`）。
  if (_dirty) {
    _cam_p0_x = _cam_p1_x;
    _cam_p0_y = _cam_p1_y;
    _cam_p1_x = cam.position.x;
    _cam_p1_y = cam.position.y;
  }
  frame.cam_p0_x = _cam_p0_x;
  frame.cam_p0_y = _cam_p0_y;
  frame.cam_p1_x = _cam_p1_x;
  frame.cam_p1_y = _cam_p1_y;
  frame.cam_lerp_x = _cam_p0_x + (_cam_p1_x - _cam_p0_x) * _dfactor;
  frame.cam_lerp_y = _cam_p0_y + (_cam_p1_y - _cam_p0_y) * _dfactor;
  if (const Background* const bg = world.bg()) {
    frame.bg_id = val_str(bg->id());
    frame.bg_layer_data_index = bg->layer_data_index();
    frame.bg_update_times = bg->update_times();
  }
  frame.tx = world.transform.x();
  frame.ty = world.transform.y();
  frame.tz = world.transform.z();
  frame.tsx = world.transform.scale_x();
  frame.tsy = world.transform.scale_y();
  frame.tsz = world.transform.scale_z();
  frame.screen_w = lfw::to_number(world.dataset.get(u"screen_w"));
  frame.screen_h = lfw::to_number(world.dataset.get(u"screen_h"));

  // 按 id 排序 ⇒ 同一份数据逐位可复现（与 `frame_digest` 同序）。
  std::vector<std::size_t> order(_live.size());
  for (std::size_t i = 0; i < order.size(); ++i) order[i] = i;
  std::sort(order.begin(), order.end(),
            [this](std::size_t a, std::size_t b) { return _live[a].e->id < _live[b].e->id; });

  for (const std::size_t idx : order) {
    Live& live = _live[idx];
    const Entity& e = *live.e;
    // TS `EntityRenderer.update_position`（`:109-110`）：只在 `owner.dirty` 时
    // `p0.copy(p1); p1 = 当前值` —— 一对 `(p0, p1)` 是**两个 tick 端点**，一个 tick 只刷一次。
    if (_dirty) {
      live.p0x = live.p1x;
      live.p0y = live.p1y;
      live.p0z = live.p1z;
      live.p1x = e.position.x;
      live.p1y = e.position.y;
      live.p1z = e.position.z;
    }
    EntityDrawRecord r;
    r.id = u16_to_utf8(e.id);
    r.data_id = val_str(e.data_id());
    r.type = e.type();
    r.x = live.p1x;
    r.y = live.p1y;
    r.z = live.p1z;
    r.px = live.p0x;
    r.py = live.p0y;
    r.pz = live.p0z;
    // TS `EntityRenderer.render`（`:127-128`）：`position.lerpVectors(p0, p1, df)`；
    // `lifetime === 0` 的实体被强制 `df = 1`（出生那一帧不插）。
    const double df = e.lifetime() == 0 ? 1.0 : _dfactor;
    r.lx = live.p0x + (live.p1x - live.p0x) * df;
    r.ly = live.p0y + (live.p1y - live.p0y) * df;
    r.lz = live.p0z + (live.p1z - live.p0z) * df;
    ++_entity_records;
    const bool moving = r.px != r.x || r.py != r.y || r.pz != r.z;
    if (moving) ++_moving;
    if (_dfactor > 0 && _dfactor < 1) {
      ++_df_between;
      if (moving) ++_interpolated;
    }
    r.facing = e.facing;
    r.wait = e.wait;
    r.frame_id = val_str(e.frame_id());
    r.state = val_str(e.state());
    r.prev_frame_id = val_str(lfw::field_or(e.get_prev_frame(), u"id"));
    // 当前帧的精灵：`frame.pic`（`IFramePic`）的 `tex` + 裁剪矩形，外加 `pics` 层数。
    // ⚠ `field_or` 按值返回 `Value`：`as_array(field_or(...))` 拿到的指针在语句结束时就悬空
    // （`lfw_boot.cpp` 顶部记着同一个坑）⇒ 先落进局部 `Value` 再取。
    const Value pic = lfw::field_or(e.frame, u"pic");
    r.pic_tex = opt_str(lfw::field_or(pic, u"tex"));
    r.pic_x = num_or(pic, u"x");
    r.pic_y = num_or(pic, u"y");
    r.pic_w = num_or(pic, u"w");
    r.pic_h = num_or(pic, u"h");
    const Value pics_v = lfw::field_or(e.frame, u"pics");
    const Array* const pics = lfw::as_array(pics_v);
    r.pics_count = pics != nullptr ? static_cast<double>(pics->size()) : 0.0;
    r.frame_cx = num_or(e.frame, u"centerx");
    r.frame_cy = num_or(e.frame, u"centery");
    r.hp = e.hp();
    r.hp_max = e.hp_max();
    r.mp = e.mp();
    r.mp_max = e.mp_max();
    r.toughness = e.toughness();
    r.toughness_max = e.toughness_max();
    r.invisible = e.invisible();
    r.blinking = e.blinking();
    r.invulnerable = e.invulnerable();
    r.name_visible = e.name_visible;
    r.ctrl_visible = e.ctrl_visible;
    r.name = opt_str(e.name());
    r.variant = e.variant;
    r.shaking = e.shaking;
    r.lifetime = e.lifetime();
    r.mix_color = u16_to_utf8(e.mix_color());
    r.mix_strength = e.mix_strength();
    r.greyscale = e.greyscale();
    r.outline_color = u16_to_utf8(e.outline_color());
    r.outline_alpha = e.outline_alpha();
    r.outline_width = e.outline_width();
    r.outline_enabled = opt_str(e.outline_enabled());
    r.render_effect_time = e.render_effect_time();
    r.ghosted = e.ghosted();
    r.mounted = e.mounted();
    frame.entities.push_back(std::move(r));
  }

  // TS `WorldRenderer.render` 的最后一行（`:241`）：这一帧的 `dirty` 用完就清。
  _dirty = false;
  _frames.push_back(std::move(frame));
}

std::string format_frame_header(const FrameDrawRecord& f) {
  return "FRAME " + inum(f.index) + " dt=" + fnum(f.dt) + " life=" + fnum(f.lifetime) +
         " ret=" + inum(f.retained) + " live=" + inum(f.world_live) +
         " match=" + (f.retained_matches_world ? "1" : "0") + " cam=" + fnum(f.cam_x) + "," +
         fnum(f.cam_y) + " bg=" + f.bg_id + " layer=" + fnum(f.bg_layer_data_index) +
         " upd=" + fnum(f.bg_update_times) + " xform=" + fnum(f.tx) + "," + fnum(f.ty) + "," +
         fnum(f.tz) + " scale=" + fnum(f.tsx) + "," + fnum(f.tsy) + "," + fnum(f.tsz) +
         " screen=" + fnum(f.screen_w) + "," + fnum(f.screen_h) +
         " ents=" + inum(static_cast<long long>(f.entities.size())) + " df=" + fnum(f.dfactor) +
         " dtime=" + fnum(f.dtime) + " dirty=" + (f.dirty ? "1" : "0") + " tu=" + fnum(f.tu) +
         " fps=" + fnum(f.fps) + " ups=" + fnum(f.ups) + " camp0=" + fnum(f.cam_p0_x) + "," +
         fnum(f.cam_p0_y) + " camp1=" + fnum(f.cam_p1_x) + "," + fnum(f.cam_p1_y) +
         " caml=" + fnum(f.cam_lerp_x) + "," + fnum(f.cam_lerp_y);
}

std::string format_entity_record(const EntityDrawRecord& r) {
  return "E id=" + r.id + " data=" + r.data_id + " type=" + fnum(r.type) + " pos=" + fnum(r.x) +
         "," + fnum(r.y) + "," + fnum(r.z) + " prev=" + fnum(r.px) + "," + fnum(r.py) + "," +
         fnum(r.pz) + " facing=" + fnum(r.facing) + " wait=" + fnum(r.wait) +
         " frame=" + r.frame_id + " state=" + r.state + " pf=" + r.prev_frame_id +
         " tex=" + r.pic_tex + " crop=" + fnum(r.pic_x) + "," + fnum(r.pic_y) + "," +
         fnum(r.pic_w) + "," + fnum(r.pic_h) + " pics=" + fnum(r.pics_count) +
         " c=" + fnum(r.frame_cx) + "," + fnum(r.frame_cy) +
         " hp=" + fnum(r.hp) + "/" + fnum(r.hp_max) + " mp=" + fnum(r.mp) + "/" +
         fnum(r.mp_max) + " tough=" + fnum(r.toughness) + "/" + fnum(r.toughness_max) +
         " invis=" + fnum(r.invisible) + " blink=" + fnum(r.blinking) +
         " invuln=" + fnum(r.invulnerable) + " name_vis=" + fnum(r.name_visible) +
         " ctrl_vis=" + fnum(r.ctrl_visible) + " name=" + r.name + " variant=" + fnum(r.variant) +
         " shake=" + fnum(r.shaking) + " life=" + fnum(r.lifetime) + " mix=" + r.mix_color +
         "@" + fnum(r.mix_strength) + " grey=" + fnum(r.greyscale) + " outline=" +
         r.outline_color + "@" + fnum(r.outline_alpha) + "," + fnum(r.outline_width) +
         " ol_en=" + r.outline_enabled + " fx=" + fnum(r.render_effect_time) +
         " ghost=" + fnum(r.ghosted) + " mount=" + fnum(r.mounted) + " lerp=" + fnum(r.lx) + "," +
         fnum(r.ly) + "," + fnum(r.lz);
}

std::string format_entity_field_names() {
  return "# E-line field order: id data type pos prev facing wait frame state pf tex crop pics c "
         "hp hp_max mp mp_max tough tough_max invis blink invuln name_vis ctrl_vis name variant "
         "shake life mix mix_strength grey outline outline_alpha outline_width ol_en fx ghost "
         "mount lerp (numbers %.4f; unavailable strings are '-'; pos/prev = the p1/p0 tick-endpoint "
         "pair, lerp = p0 -> p1 at the frame's df)";
}

}  // namespace lfw::host
