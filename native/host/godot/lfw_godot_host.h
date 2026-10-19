// Godot 侧的宿主：与 WASM 宿主同一种做法 —— **继承** `HeadlessHost`
// （`host/headless_host.{h,cpp}` + `host/fs_zip.{h,cpp}` 直接编进扩展，装载 / `IZip` / 存档 /
// XML / `import_as_*` 一个都不重写），只把「帧从哪来」这件事按 DESIGN §G3 钉死。
//
// §G3 的四条规矩，这一份就是它们的落地：
//   1. **不装** `IRenderScheduler`（槽空 ⇒ `render_add` 回 0）；本类也不碰它。
//   2. 时钟是**注入的虚拟时钟**：`HeadlessHost` 的 `ManualClock` 的 `add` 回 0
//      ⇒ 端口自己的 `Ticker` 永远不自驱（这正是 WASM 那边「一帧走两步」的坑）。
//   3. 世界由宿主用**固定步长**手动推：`clock().advance(step)` + `world.update_once(step)`。
//      Godot `_process(delta)` 的 `delta`（秒）**只当节拍**喂进累加器，绝不进模拟。
//   4. 于是这一支与 `lfw_run` 的手动模式逐位同形 ⇒ 三条摘要可比（§G3 的硬指标）。
//
// ⚠ 这一层**不许**出现 Godot 类型（`godot::String` / `Node` / …）：它只做「虚拟时钟 +
// 固定步长累加器」，引擎那一侧在 `lfw_godot_node.{h,cpp}`。分开放的理由是 §G5 的
// 「只在边界转换」——本文件里一个转换都不需要。
#pragma once

#include <filesystem>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "host/godot/lfw_godot_renderer.h"
#include "host/godot/lfw_godot_ui_renderer.h"
#include "host/headless_host.h"
#include "lfw/helper/randoming.h"

namespace lfw {
class World;
}  // namespace lfw

namespace lfw::host {

// 固定步长 + 注入虚拟时钟的推帧器（挂在 `HeadlessHost` 上）。
class LfwGodotHost : public HeadlessHost {
 public:
  LfwGodotHost(std::vector<std::filesystem::path> roots, bool dev);

  // 一帧的固定步长（毫秒）：`1000 / dataset.UPS`（与 `lfw_run` 同款）。
  void set_step_ms(double step_ms) { _step_ms = step_ms; }
  double step_ms() const { return _step_ms; }

  // 喂节拍：`delta` 是**秒**，只用来决定「这一帧推几步」，不进模拟。
  void accumulate(double delta_seconds) { _accumulator_ms += delta_seconds * 1000.0; }

  // 累加器够不够一个步长（够就 `push_frame`）。
  bool can_step() const { return _accumulator_ms >= _step_ms; }

  // 推一帧：虚拟时钟前进一个步长 + `World::update_once`。这两句必须成对出现
  //（只推时钟不推世界 ⇒ 从 `clock_now()` 派生的量会漂；只推世界不推时钟 ⇒ 反过来）。
  void push_frame(World& world);

  // 诊断：累加器余量（毫秒）与累计推过的帧数。
  double residual_ms() const { return _accumulator_ms; }
  long long steps() const { return _steps; }

  // ---- 世界渲染器（§G2 第二半）----
  // `LFW` 构造里 `new Ditto.WorldRender(world)` 那一处：每次新建一份（一个 `LFW` 一份）。
  IWorldRenderer* create_world_renderer(LFW& lfw) override {
    _renderer = std::make_unique<GodotWorldRenderer>(lfw, *this);
    return _renderer.get();
  }
  GodotWorldRenderer* world_renderer() const { return _renderer.get(); }

  // ---- UI 渲染器（D4 第二半）----
  // `LFW` 构造里每个 `UINode` 的 `new Ditto.UINodeRenderer(node)` 那一处（`uinode.cpp` 的 ctor）。
  // 所有权归节点；绘制项落进世界渲染器"正在写的那一帧"（`GodotWorldRenderer::ui_append`）。
  // ⚠ `_renderer` 一定已经在（`create_world_renderer` 在 `LFW` ctor 里先跑）。
  ui::IUINodeRenderer* create_ui_node_renderer(ui::UINode& node) override {
    static_cast<void>(node);
    if (_renderer == nullptr) return nullptr;
    return new GodotUINodeRenderer(*_renderer);
  }

  // ---- 文字度量（D4 的"允许宿主差异"那一格）----
  // 字体只有引擎那一侧有（§G5）⇒ 度量函数由 `lfw_godot_node.cpp` 装进来；没装就退回
  // `HeadlessHost` 的零尺寸桩（布局照算，只是文字挤在一起）。
  using MeasureTextFn = std::function<Value(const Value& text, const Value& style)>;
  void set_measure_text(MeasureTextFn fn) { _measure_text = std::move(fn); }
  Value measure_text(const Value& text, const Value& style) override;

  // ---- 图片尺寸（DESIGN 允许的"设备侧差异"那一格）----
  // `ui_image_load` 的结果里 `w`/`h`/`scale` 是**图片尺寸**：TS 是浏览器解码出来的（`ImageInfo`），
  // 端口这一侧由资源表（命中条目里的 `@Nx` + PNG 头）算出来。不补这三个数，`UIImgLoader::load`
  // 的 `node.resize(w / scale, h / scale)` 就会算出 `NaN` —— 那会把节点尺寸写成 NaN：盒子 0×0
  // 画不出来，`cook_ui_info` 按 `img_info` 补零轴那一步也一起失效。
  bool ui_image_load(const std::u16string& img_key, const Value& path, const Value& ops, Value& out,
                     std::u16string& error) override;

  // ---- 音频（TS `sounds/Sounds.ts` + `sounds/Modern.ts` 的语义在这一侧，播出在 node）----
  // 端口里 `lfw.sounds` 就是宿主这一层（TS 那边是 `__Sounds` → `__Modern`），所以：
  //   * **音量/静音的算式**（`_volume` / `_bgm_volume` / `_sound_volume` × 静音、左右声道）在这里；
  //   * 真正的解码/播放（`AudioStreamMP3` + `AudioStreamPlayer`）在 `lfw_godot_node.*`；
  //   * 两者之间就是下面这份「音频插座」——纯数字 + 路径，一个 Godot 类型都没有。
  // 没装插座 = 不出声（与 `HeadlessHost` 同形，`--headless` 也照跑）。
  struct AudioSink {
    // 把资源路径提前解好放进缓存（`Sounds.load` / 启动页预载 093）。
    std::function<void(const std::string& path)> preload;
    // 播一个音效：`id` 是宿主给的句柄，播完 node 要回调 `on_audio_finished(id)`；
    // `gain` = 每声道幅度（0..1 量级，已经算上左右与衰减）、`pan` = -1(左)..+1(右)。
    std::function<void(const std::string& id, const std::string& path, double gain, double pan)> play;
    // 已经在播的那个音效改音量/声道（`__Modern.apply_sound_volume`：音量/静音变了才动）。
    std::function<void(const std::string& id, double gain, double pan)> set_gain;
    // 全停（`dispose`）。
    std::function<void()> stop_all;
    // BGM：`loop=false`（随机档）时播完 node 要回一条 `CMD.BGM '?'`。
    std::function<void(const std::string& path, bool loop, double gain)> play_bgm;
    // 只改 BGM 的音量（`__Modern.apply_bgm_volume`：静音时 `ele.muted = true`，**不**停播）。
    std::function<void(double gain)> set_bgm_gain;
    std::function<void()> stop_bgm;
    // 引擎侧的「世界节点缩放」（TS `get_l_r_vol` 里的 `world_node.scale.x` —— 逻辑像素 → 画布）。
    std::function<double()> scale;
  };
  void set_audio_sink(AudioSink sink) { _audio = std::move(sink); }

  // node → 宿主：那个音效播完了（与 TS 的 `src_node.onended → _playings.delete(id)` 同一位）。
  void on_audio_finished(const std::string& id);

  // 诊断（`[godot] sounds:` 那一行 / 给验收看）
  long long audio_played() const { return _audio_played; }
  long long audio_bgm_played() const { return _audio_bgm_played; }
  long long audio_loaded() const { return _audio_loaded; }
  int audio_active() const { return static_cast<int>(_playings.size()); }
  const std::string& audio_last() const { return _audio_last; }
  const std::string& audio_bgm_path() const { return _bgm_path; }
  bool audio_bgm_playing() const { return _bgm_playing; }
  bool audio_bgm_random() const { return _bgm_random; }
  // 当前 BGM 的增益（`apply_bgm_volume` 算出来的那个数；静音 = 0 —— 用来证明"静音不停播"）。
  double audio_bgm_gain() const { return bgm_gain(); }

  // `new I.Ditto.Sounds(lfw)`：把 `lfw` 记住（音量算式要用镜头位置、随机 BGM 要用 `bgms`/`mt`）。
  void sounds_init(LFW& lfw) override;
  // `lfw.sounds.*`（TS `__Modern` 语义：clamp 0..1、同值早退、变更后发事件）
  std::function<void()> sounds_play_bgm(const Value& music) override;
  void sounds_stop_bgm() override;
  // `__Modern.bgm()` / `is_random()`：`BGMSwitcher` 拿它写「BGM: …」那行（**真名**，不是 `'?'`）。
  std::u16string sounds_bgm() override;
  bool sounds_is_random() override;
  void sounds_play(const Value& path, const Value& x, const Value& y, const Value& z) override;
  void sounds_play_preset(const Value& name, const Value& x, const Value& y,
                          const Value& z) override;
  void sounds_play_with_load(const Value& path) override;
  void sounds_load(const Value& name, const Value& src) override;
  void sounds_set_volume(double v) override;
  void sounds_set_bgm_volume(double v) override;
  void sounds_set_sound_volume(double v) override;
  void sounds_set_bgm_muted(bool v) override;
  void sounds_set_sound_muted(bool v) override;
  void sounds_dispose() override;

 private:
  // 正在播的音效（TS `__Modern._playings`）：`x` 留着是为了"音量变了重算左右"。
  struct Playing {
    Value x;  // `undefined` ⇒ 用 viewer_x（`get_l_r_vol` 的缺省）
  };

  // `__Modern.get_l_r_vol`（`sounds/Modern.ts:239-262`）—— 唯一一处算式。
  void sound_lr(const Value& x, double& l_vol, double& r_vol) const;
  double bgm_gain() const;
  void apply_sound_volume();
  void apply_bgm_volume();
  // `ISoundsCallback` 的那一族事件（`_sd_callbacks` 的快照循环，与台面 `fire_snd_*` 同口径）。
  void emit_volume_changed(double v, double prev);
  void emit_bgm_volume_changed(double v, double prev);
  void emit_sound_volume_changed(double v, double prev);
  void emit_bgm_muted_changed(bool muted);
  void emit_sound_muted_changed(bool muted);
  void emit_bgm_changed(const std::u16string& bgm, const std::u16string& prev);

  double _step_ms = 1000.0 / 60.0;
  double _accumulator_ms = 0.0;
  long long _steps = 0;
  std::unique_ptr<GodotWorldRenderer> _renderer;
  MeasureTextFn _measure_text;
  // `lfw` 自己（`sounds_init` 里拿到；音量算式要用镜头 x，随机 BGM 要用 `bgms`/`mt`）。
  LFW* _lfw = nullptr;

  AudioSink _audio;
  std::map<std::string, Playing> _playings;
  long long _audio_id = 0;
  long long _audio_played = 0;
  long long _audio_bgm_played = 0;
  long long _audio_loaded = 0;
  std::string _audio_last;
  // 当前那首 BGM —— `__Modern._bgm_name` / `_prev_bgm_url`（两者在 TS 里同生同灭 ⇒ 合成一个字段）；
  // `_bgm_playing` = 「起播了没」（TS 里静音时 `apply_bgm_volume` 不会 `ele.play()`
  // ⇒ 解除静音时才起播）；`_bgm_req_id` = TS 的 `_req_id`（`play_bgm` 返回的停止闭包要比对它，
  // 免得旧闭包把后来那首停了）。
  std::string _bgm_path;
  bool _bgm_random = false;
  bool _bgm_playing = false;
  long long _bgm_req_id = 0;
  // `__Modern._bgms`：随机 BGM 的抽取器（与 TS 同款 `Randoming('bgm_randoming', lfw.bgms, lfw.mt)`）。
  std::unique_ptr<Randoming> _bgms;
};

}  // namespace lfw::host
