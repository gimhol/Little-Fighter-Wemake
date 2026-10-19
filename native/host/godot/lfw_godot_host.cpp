#include "host/godot/lfw_godot_host.h"

#include <cmath>
#include <string>
#include <utility>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/utf8.h"
#include "lfw/world.h"

namespace lfw::host {

namespace {

std::string str_or(const Value& v, const std::string& fallback) {
  const std::u16string* const s = std::get_if<std::u16string>(&v);
  if (s == nullptr) return fallback;
  const std::vector<uint8_t> buf = lfw::encode_utf8(*s);
  return std::string(buf.begin(), buf.end());
}

double num_or(const Value& holder, const char16_t* key, double fallback) {
  const Value v = lfw::field_or(holder, key);
  const double* const d = std::get_if<double>(&v);
  return d != nullptr ? *d : fallback;
}

std::u16string from_utf8(const std::string& s) {
  const std::vector<uint8_t> buf(s.begin(), s.end());
  return lfw::decode_utf8(buf);
}

}

// 音量初值取 TS 的 `App.tsx`（`volume 0.3` / `bgm_volume 0.5` / `sound_volume 1`）——基类那份
// 1.0/1.0/1.0 是差分台面钉住的（`sndset` 用例读回来必须是 1.0），不动它。
LfwGodotHost::LfwGodotHost(std::vector<std::filesystem::path> roots, bool dev)
    : HeadlessHost(std::move(roots), dev) {
  _volume = 0.3;
  _bgm_volume = 0.5;
  _sound_volume = 1.0;
}

void LfwGodotHost::push_frame(World& world) {
  _accumulator_ms -= _step_ms;
  clock().advance(_step_ms);
  world.update_once(_step_ms);
  ++_steps;
}

// 文字度量：装了引擎那一半（`lfw_godot_node.cpp` 用真字体）就走它，否则退回 headless 的零尺寸桩。
Value LfwGodotHost::measure_text(const Value& text, const Value& style) {
  if (_measure_text) return _measure_text(text, style);
  return HeadlessHost::measure_text(text, style);
}

// 图片装载：基类那份给的是"零尺寸占位"（只知道图存在），这里把 TS `ImageInfo` 里的
// `w`/`h`/`scale` 补成真值 —— 只有这三个数会被核心侧读走（`UIImgLoader::load` 的
// `resize(w / scale, h / scale)`；`cook_ui_info` 按 `img_info` 给零轴补算）。
//   * `w`/`h` 是**结果位图**的自然像素：`ui_load_img` 在 `dw || dh` 时加一条 `crop` 操作，
//     它的产物是 `dw × dh` 的一倍图逻辑像素 ⇒ 自然像素 = `dw * scale`（`handle_image_operation_crop`）。
//   * `scale` 是命中条目文件名里的 `@Nx`（`probe_path` 与画的那一遍读同一张表）。
bool LfwGodotHost::ui_image_load(const std::u16string& img_key, const Value& path, const Value& ops,
                                 Value& out, std::u16string& error) {
  if (!HeadlessHost::ui_image_load(img_key, path, ops, out, error)) return false;
  Object* const info = as_object(out);
  if (info == nullptr) return true;

  double crop_w = 0, crop_h = 0;
  const Array* const op_list = as_array(ops);
  for (size_t i = 0; op_list != nullptr && i < op_list->size(); ++i) {
    const Value op = op_list->at(i);
    if (str_or(lfw::field_or(op, u"type"), "") != "crop") continue;
    crop_w = num_or(op, u"dw", 0.0);
    crop_h = num_or(op, u"dh", 0.0);
  }

  double scale = 1.0, w = 0.0, h = 0.0;
  if (_renderer != nullptr) {
    const GodotWorldRenderer::Resolved& res = _renderer->probe_path(str_or(path, ""));
    scale = res.scale > 0.0 ? res.scale : 1.0;
    w = res.img_w * scale;
    h = res.img_h * scale;
    if (crop_w > 0.0) w = crop_w * scale;
    if (crop_h > 0.0) h = crop_h * scale;
  }
  info->set(u"w", Value(w));
  info->set(u"h", Value(h));
  info->set(u"scale", Value(scale));
  return true;
}

// ---------------------------------------------------------------- 音频
//
// 这一段是 TS `sounds/Sounds.ts` + `sounds/Modern.ts` 的**语义**：端口里 `lfw.sounds` 就是宿主这一层
// （TS 那边 `__Sounds` 也是把所有调用转给 `__Modern`）。真正的解码/播出在 `lfw_godot_node.*`，
// 两边只交换数字与路径（`AudioSink`）。
//
// 三处与 TS 对齐的地方值得写下来：
//   1. **音量初值**：`__Modern` 是 `volume=0.3 / bgm_volume=0.5 / sound_volume=1`，Web 侧 `App.tsx`
//      启动时再把 `app_state` 里同样的三个数推一遍 ⇒ 端口直接照抄这三个初值。
//      ⚠ 只改**这一份**宿主：`HeadlessHost` 那三个 1.0 被差分台面钉着（`lfw_run` 的 UI 里
//      音量显示 100、Web 是 30/50 —— 那是 headless 宿主的诊断口径，不动它）。
//   2. **左右声道**：`get_l_r_vol` 按"声音的 x 与镜头中心的关系"算**每声道**幅度（远处的还带
//      `1/sqrt(正在播的数量)` 衰减）。Godot 的 `AudioStreamPlayer` 只有整体音量 + 一个 panner
//      （线性衰减一侧），所以送到 node 的是 `gain = (l+r)/2`、`pan = (r-l)/(l+r)` ——
//      在**线性 panner** 下与 `(l, r)` 逐值等价（`node` 那一侧把这条写清楚了）。
//   3. **静音**：TS 是 `ele.muted = true`（**不停播**，解除静音接着放当前进度）⇒ 这里也是
//      只把 gain 压到 0；而"请求 BGM 时就已经静音"那一档 TS 不会 `play()`（等解除静音才起播）
//      ⇒ 这里记 `_bgm_playing` 来复现。
namespace {

// `__Modern` 的初值（`sounds/Modern.ts:46-48`）。
constexpr double kDefaultVolume = 0.3;
constexpr double kDefaultBgmVolume = 0.5;
constexpr double kDefaultSoundVolume = 1.0;

// `Defines.CLASSIC_SCREEN_WIDTH`（794）：`get_l_r_vol` 里那个"一屏多宽"的基数。
constexpr double kClassicScreenWidth = 794.0;

double clamp01(double v) { return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v); }

}  // namespace

void LfwGodotHost::sound_lr(const Value& x, double& l_vol, double& r_vol) const {
  // `const scale = world_node.scale.x`（逻辑像素 → 画布那个比例，引擎侧才有）。
  const double scale = _audio.scale ? _audio.scale() : 1.0;
  const double safe_scale = scale > 0.0 ? scale : 1.0;
  const double full_w = kClassicScreenWidth / safe_scale;
  const double half_w = full_w * 0.5;
  const double viewer_x = _lfw != nullptr ? _lfw->world().camera().position.x + half_w : half_w;
  // `const sound_x = x ?? viewer_x`（只有 null/undefined 才换 viewer_x；NaN 原样留着 ⇒ 下面算成 0）。
  const double* const xd = std::get_if<double>(&x);
  const double sound_x = xd != nullptr ? *xd : viewer_x;
  const double playings = static_cast<double>(_playings.size()) + 1.0;
  const double attenuation = 1.0 / std::sqrt(playings);
  const double base_vol = _volume * _sound_volume;
  // `const muted = this._muted || this._sound_muted`（端口没有"总线静音"这一档 ⇒ 只看音效静音）。
  const double final_base = _sound_muted ? 0.0 : base_vol * attenuation;
  const double dx = sound_x - viewer_x;
  const double l_weight = std::max(0.0, 1.0 - std::abs(dx + half_w) / full_w);
  const double r_weight = std::max(0.0, 1.0 - std::abs(dx - half_w) / full_w);
  l_vol = final_base * l_weight * safe_scale;
  r_vol = final_base * r_weight * safe_scale;
  // `l_gain_node.gain.value = Number.isFinite(l_vol) && !Number.isNaN(l_vol) ? l_vol : 0`（同上）。
  if (!std::isfinite(l_vol) || std::isnan(l_vol)) l_vol = 0.0;
  if (!std::isfinite(r_vol) || std::isnan(r_vol)) r_vol = 0.0;
}

double LfwGodotHost::bgm_gain() const {
  if (_bgm_muted) return 0.0;
  return clamp01(_volume * _bgm_volume);
}

void LfwGodotHost::apply_sound_volume() {
  // `__Modern.apply_sound_volume`：对**正在播的每一个**重算左右（静音 ⇒ 0）。
  if (!_audio.set_gain) return;
  for (const auto& kv : _playings) {
    double l = 0.0, r = 0.0;
    sound_lr(kv.second.x, l, r);
    const double sum = l + r;
    _audio.set_gain(kv.first, sum * 0.5, sum > 0.0 ? (r - l) / sum : 0.0);
  }
}

void LfwGodotHost::apply_bgm_volume() {
  if (_bgm_path.empty()) return;
  const double gain = bgm_gain();
  if (!_bgm_playing) {
    // 请求 BGM 时是静音的（TS 的 `apply_bgm_volume` 那一句只在非静音时才 `play()`）⇒ 解除静音才起播。
    if (gain > 0.0 && _audio.play_bgm) {
      _bgm_playing = true;
      _audio.play_bgm(_bgm_path, !_bgm_random, gain);
    }
    return;
  }
  if (_audio.set_bgm_gain) _audio.set_bgm_gain(gain);
}

void LfwGodotHost::on_audio_finished(const std::string& id) { _playings.erase(id); }

std::function<void()> LfwGodotHost::sounds_play_bgm(const Value& music) {
  // `__Modern.play_bgm`：名字 `'?'` = 随机抽一首（`Randoming('bgm_randoming', lfw.bgms, lfw.mt)`），
  // 抽中之后 `is_random = true` ⇒ 播完由 node 回一条 `CMD.BGM '?'` 接着抽。
  const std::string name = str_or(music, "");
  if (name.empty()) {  // `cmd_scene` 的 `''` ⇒ 停
    sounds_stop_bgm();
    return []() {};
  }
  const bool want_random = name == "?";
  // TS：`if (!restart && this._prev_bgm_url === name) return () => {}` —— **请求名**与
  //「上一首的真名」比：非随机时两者同名才早退；`'?'` 比不过任何真名 ⇒ 每次重抽（哪怕抽回同一首）。
  if (!want_random && name == _bgm_path) return []() {};
  std::string real = name;
  if (want_random && _lfw != nullptr) {
    if (_bgms == nullptr) {
      _bgms = std::make_unique<Randoming>(u"bgm_randoming", std::vector<Value>{}, &_lfw->mt_ref());
    }
    std::vector<Value> list;
    list.reserve(_lfw->bgms.size());
    for (const std::u16string& one : _lfw->bgms) list.push_back(Value(one));
    _bgms->set_src(std::move(list));
    const Value picked = _bgms->get();
    real = str_or(picked, "");
  }
  const std::u16string prev = from_utf8(_bgm_path);
  if (real.empty()) return []() {};  // TS：`if (!real_name) return () => {}`（`_stop_bgm` 已在上面做过）
  ++_audio_bgm_played;
  // `_stop_bgm()`（释放上一首）—— 它在 TS 里会把 `_bgm_name` / `_prev_bgm_url` 清成 null。
  _bgm_path.clear();
  _bgm_playing = false;
  if (_audio.stop_bgm) _audio.stop_bgm();
  const long long req_id = ++_bgm_req_id;
  _bgm_path = real;
  _bgm_random = want_random;
  apply_bgm_volume();  // 非静音才真起播（与 TS 的 `apply_bgm_volume` 同位）
  emit_bgm_changed(from_utf8(real), prev);
  return [this, req_id]() {
    if (req_id != _bgm_req_id) return;  // TS: `req_id === this._req_id`
    sounds_stop_bgm();
  };
}

std::u16string LfwGodotHost::sounds_bgm() { return from_utf8(_bgm_path); }

bool LfwGodotHost::sounds_is_random() { return _bgm_random; }

void LfwGodotHost::sounds_stop_bgm() {
  // TS `stop_bgm`：`if (!this._bgm_ele) return` —— 没东西在放就什么都不做（**也不发事件**）。
  if (_bgm_path.empty()) return;
  const std::u16string prev = from_utf8(_bgm_path);
  _bgm_path.clear();
  _bgm_playing = false;  // `_is_random` 与 TS 一样**不**在这里清（`_stop_bgm` 只清名字/元素）。
  if (_audio.stop_bgm) _audio.stop_bgm();
  emit_bgm_changed(std::u16string(), prev);
}

void LfwGodotHost::sounds_play(const Value& path, const Value& x, const Value& y, const Value& z) {
  (void)y;
  (void)z;
  const std::string key = str_or(path, "");
  if (key.empty()) return;
  ++_audio_played;
  _audio_last = key;
  if (!_audio.play) return;
  double l = 0.0, r = 0.0;
  sound_lr(x, l, r);
  const double sum = l + r;
  const std::string id = std::to_string(++_audio_id);
  _playings.emplace(id, Playing{x});
  _audio.play(id, key, sum * 0.5, sum > 0.0 ? (r - l) / sum : 0.0);
}

void LfwGodotHost::sounds_play_preset(const Value& name, const Value& x, const Value& y,
                                      const Value& z) {
  // `BaseSounds.play_preset`：五个预置名映射到 `data/m_<name>.wav.mp3`，其余当路径直接用。
  const std::string t = str_or(name, "");
  if (t == "cancel" || t == "end" || t == "join" || t == "ok" || t == "pass") {
    sounds_play(Value(from_utf8("data/m_" + t + ".wav.mp3")), x, y, z);
    return;
  }
  sounds_play(name, x, y, z);
}

void LfwGodotHost::sounds_play_with_load(const Value& path) {
  // TS `play_with_load(src)`：先确保装进来（`load` 只在没缓存时才真读）再 `play`。端口这一侧
  // 是**同步解码**（node 见没缓存就现解）⇒ 这两步合成一次 `play` 即可（听感完全相同）。
  sounds_play(path, Value(), Value(), Value());
}

void LfwGodotHost::sounds_load(const Value& name, const Value& src) {
  (void)name;  // TS 用 `name` 当缓存键、播放时也用同一个键；端口统一按**路径**当键。
  const std::string key = str_or(src, "");
  if (key.empty()) return;
  ++_audio_loaded;
  _audio_last = key;
  if (_audio.preload) _audio.preload(key);
}

void LfwGodotHost::sounds_init(LFW& lfw) { _lfw = &lfw; }

void LfwGodotHost::emit_volume_changed(double v, double prev) {
  const std::vector<LfwSoundsCallback*> snapshot = _sd_callbacks;
  for (LfwSoundsCallback* const cb : snapshot) {
    if (cb != nullptr) cb->on_volume_changed(v, prev);
  }
}

void LfwGodotHost::emit_bgm_volume_changed(double v, double prev) {
  const std::vector<LfwSoundsCallback*> snapshot = _sd_callbacks;
  for (LfwSoundsCallback* const cb : snapshot) {
    if (cb != nullptr) cb->on_bgm_volume_changed(v, prev);
  }
}

void LfwGodotHost::emit_sound_volume_changed(double v, double prev) {
  const std::vector<LfwSoundsCallback*> snapshot = _sd_callbacks;
  for (LfwSoundsCallback* const cb : snapshot) {
    if (cb != nullptr) cb->on_sound_volume_changed(v, prev);
  }
}

void LfwGodotHost::emit_bgm_muted_changed(bool muted) {
  const std::vector<LfwSoundsCallback*> snapshot = _sd_callbacks;
  for (LfwSoundsCallback* const cb : snapshot) {
    if (cb != nullptr) cb->on_bgm_muted_changed(muted);
  }
}

void LfwGodotHost::emit_sound_muted_changed(bool muted) {
  const std::vector<LfwSoundsCallback*> snapshot = _sd_callbacks;
  for (LfwSoundsCallback* const cb : snapshot) {
    if (cb != nullptr) cb->on_sound_muted_changed(muted);
  }
}

void LfwGodotHost::emit_bgm_changed(const std::u16string& bgm, const std::u16string& prev) {
  const std::vector<LfwSoundsCallback*> snapshot = _sd_callbacks;
  for (LfwSoundsCallback* const cb : snapshot) {
    if (cb != nullptr) cb->on_bgm_changed(bgm, prev);
  }
}

void LfwGodotHost::sounds_set_volume(double v) {
  v = clamp01(v);
  const double prev = _volume;
  if (v == prev) return;
  _volume = v;
  apply_bgm_volume();
  apply_sound_volume();
  emit_volume_changed(v, prev);
}

void LfwGodotHost::sounds_set_bgm_volume(double v) {
  v = clamp01(v);
  const double prev = _bgm_volume;
  if (v == prev) return;
  _bgm_volume = v;
  apply_bgm_volume();
  emit_bgm_volume_changed(v, prev);
}

void LfwGodotHost::sounds_set_sound_volume(double v) {
  v = clamp01(v);
  const double prev = _sound_volume;
  if (v == prev) return;
  _sound_volume = v;
  apply_sound_volume();
  emit_sound_volume_changed(v, prev);
}

void LfwGodotHost::sounds_set_bgm_muted(bool v) {
  if (v == _bgm_muted) return;
  _bgm_muted = v;
  apply_bgm_volume();
  emit_bgm_muted_changed(v);
}

void LfwGodotHost::sounds_set_sound_muted(bool v) {
  if (v == _sound_muted) return;
  _sound_muted = v;
  apply_sound_volume();
  emit_sound_muted_changed(v);
}

void LfwGodotHost::sounds_dispose() {
  // TS `__Modern.dispose`：先 `stop_bgm()`（会发 `on_bgm_changed(null, prev)`），再停掉所有音效。
  sounds_stop_bgm();
  if (_audio.stop_all) _audio.stop_all();
  _playings.clear();
  HeadlessHost::sounds_dispose();
}

}  // namespace lfw::host
