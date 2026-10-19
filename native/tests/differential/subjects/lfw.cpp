// `LFW`（门面 4AB）的 C++ 侧台面，op 与 `subjects/lfw.ts` 一一对应。
//
// 4D2 新增 op（两侧同名同义）：
//   `cmd <字符串字面量>`  经**真命令分发器**执行一条命令：`lfw::cmds::CMDS::handle(lfw.world(), {str})`
//                        （`POINTER_*` / `KEY_EVENT` / `F4` 这些以 `lfw` 为世界的命令都靠它）。
//   `flpage <别名> <层号> <页下标|-1=栈顶> [子下标…]`
//                        把 **`lfw.ui_layers()`**（命令真正作用的那一栈）的节点别名进 `g_alias_nodes`
//                        （`npg` 只认台面私建的 `g_real_layers`），`nrd`/`nset` 等经 `pick_node` 的
//                        op 就能直接读它；日志 `flpage|<别名>|<找到 1/0>|<该层页数>`。
//   `ptcur <from|->`     读 `cmds::get_pointer_cursors(world)`（`--from` 写过的光标才看得见）。
//   `kkey <游戏键>`      已挂载 `Keys` 里该键 `KeyStatus` 的 `命中时刻|抬起时刻|used`。
//   `ctrlq <玩家号>`     `world.puppets` 里该玩家实体的控制器队列（`KEY_EVENT` 的落点）。
#include <algorithm>
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include "lfw/cmds/cmd_pointer_events.h"
#include "lfw/cmds/cmds.h"
#include "lfw/core/js_string.h"
#include "lfw/core/json.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/game_mode.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/factory.h"
#include "lfw/helper/randoming.h"
#include "lfw/lfw.h"
#include "lfw/loader/stage_val_getters.h"
#include "lfw/player_info.h"
#include "lfw/stage/stage.h"
#include "lfw/ui/cook_ui_info.h"
#include "lfw/utils/math/clamp.h"
#include "lfw/utils/math/float_equal.h"
#include "lfw/ui/action/actor.h"
#include "lfw/ui/component/fade_out_opacity.h"
#include "lfw/ui/component/alignment.h"
#include "lfw/ui/component/flex_item.h"
#include "lfw/ui/component/img_loop.h"
#include "lfw/ui/component/launch_page_logic.h"
#include "lfw/ui/component/action_director.h"
#include "lfw/ui/component/danmu_game_logic.h"
#include "lfw/ui/component/little_funny_auto_game.h"
#include "lfw/ui/component/sine_opacity.h"
#include "lfw/ui/component/players.h"
#include "lfw/ui/component/label_button.h"
#include "lfw/ui/component/player_ctrl_type.h"
#include "lfw/ui/component/stage_transitions.h"
#include "lfw/ui/component/weapon_rain.h"
#include "lfw/ui/component/fighter_head.h"
#include "lfw/ui/component/fighter_thumb.h"
#include "lfw/ui/component/components_player.h"
#include "lfw/ui/component/stage_switcher.h"
#include "lfw/ui/component/background_switcher.h"
#include "lfw/ui/component/flex.h"
#include "lfw/ui/component/jalousie.h"
#include "lfw/ui/component/dialogs.h"
#include "lfw/ui/component/component_fsm_state.h"
#include "lfw/ui/component/game_mode_fsm_state.h"
#include "lfw/ui/component/mode_state.h"
#include "lfw/ui/component/sounds.h"
#include "lfw/ui/component/char_menu.h"
#include "lfw/ui/component/opacity_animation.h"
#include "lfw/ui/component/opacity_flash.h"
#include "lfw/ui/component/picture.h"
#include "lfw/ui/component/position_animation.h"
#include "lfw/ui/component/reachable.h"
#include "lfw/ui/component/reachable_group.h"
#include "lfw/ui/component/scale_animation.h"
#include "lfw/ui/component/smooth_number.h"
#include "lfw/ui/component/text_input.h"
#include "lfw/ui/component/player_name.h"
#include "lfw/ui/component/player_team_name.h"
#include "lfw/ui/component/fighter_name.h"
#include "lfw/ui/component/integer_picker.h"
#include "lfw/ui/component/slider_handle.h"
#include "lfw/ui/component/arrow_switcher.h"
#include "lfw/ui/component/scroll_view.h"
#include "lfw/ui/component/summary_logic.h"
#include "lfw/ui/component/fighter_stat_bar.h"
#include "lfw/ui/component/camera_ctrl.h"
#include "lfw/ui/component/player_score.h"
#include "lfw/ui/component/player_score_cell.h"
#include "lfw/ui/component/player_score_player_name.h"
#include "lfw/ui/component/team_situation_text.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/entity/summary.h"
#include "lfw/entity/summary_mgr.h"
#include "lfw/controller/creators.h"
#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/component/ui_props.h"
#include "lfw/ui/instance_ref.h"
#include "lfw/ui/register_class.h"
#include "lfw/ui/ui_event.h"
#include "lfw/ui/ui_img_loader.h"
#include "lfw/ui/ui_load_img.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/uinode.h"
#include "lfw/ui/value_spread.h"
#include "lfw/utils/container_help/field_or.h"

#include "trace_util.h"

namespace {

using trace::key_of;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::strip_comment;
using trace::to_ascii;
using trace::to_double;
using trace::to_u16;

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

std::string num(double d) { return to_ascii(render_value(lfw::Value(d))); }

// `render_value` 的环安全版（cook 的 `items` 会挂 parent 指针形成环；DAG 共用照常展开）。
std::u16string render_cycle_safe(const lfw::Value& v, std::set<const void*>& stack) {
  if (const lfw::Array* const a = lfw::as_array(v)) {
    if (stack.count(a) != 0) return u"~circ";
    stack.insert(a);
    std::u16string out = u"[";
    for (size_t i = 0; i < a->size(); ++i) {
      if (i != 0) out.push_back(u',');
      out += render_cycle_safe(a->at(i), stack);
    }
    out.push_back(u']');
    stack.erase(a);
    return out;
  }
  if (const lfw::Object* const o = lfw::as_object(v)) {
    if (stack.count(o) != 0) return u"~circ";
    stack.insert(o);
    std::u16string out = u"{";
    bool first = true;
    for (const std::u16string& k : o->keys()) {
      const lfw::Value* const p = o->get(k);
      if (p == nullptr) continue;
      if (!first) out.push_back(u',');
      first = false;
      out += to_u16(trace::esc(k));
      out.push_back(u':');
      out += render_cycle_safe(*p, stack);
    }
    out.push_back(u'}');
    stack.erase(o);
    return out;
  }
  return render_value(v);
}

std::string s_of(const lfw::Value& v) {
  const std::u16string* const s = std::get_if<std::u16string>(&v);
  return s != nullptr ? to_ascii(*s) : "u";
}

// 不入世界的假实体（`fhset`/`ftset` 用）：放进堆容器保证生命周期。
std::vector<std::unique_ptr<lfw::Entity>> g_fakes;

// ---- 4AC：加载流程的脚本化假 zip ----
// kind 迷你语言：`-`=undefined / `o`={} / `a`=[] / `k:<name>`={"<name>":"1"} / `str:<v>` / `e`=失败("boom")。
struct LoadScript {
  std::string path;
  std::string kind = "-";
};

// `imp`/`lzadd` 共用的 kind 迷你语言（两侧一致）：`-`/`o`/`a`/`k:<n>`/`str:<v>`/`md5:<v>`/`w:<n>`/`spk`/`e`。
lfw::Value build_kind_value(const std::string& k);

class LoadZipObject : public lfw::IZipObject {
 public:
  std::u16string entry_name;
  LoadScript* script = nullptr;

  const std::u16string& name() const override { return entry_name; }
  bool json(lfw::Value& out, std::u16string& error) override {
    push("lz:json|" + script->path);
    return read(out, error);
  }
  bool text(lfw::Value& out, std::u16string& error) override {
    push("lz:text|" + script->path);
    return read(out, error);
  }
  bool blob_url(lfw::Value&, std::u16string& error) override {
    error = u"unscripted";
    return false;
  }
  bool array_buffer(lfw::Value&, std::u16string& error) override {
    error = u"unscripted";
    return false;
  }
  bool image_bitmap(lfw::Value&, std::u16string& error) override {
    error = u"unscripted";
    return false;
  }

 private:
  bool read(lfw::Value& out, std::u16string& error) {
    const std::string& k = script->kind;
    if (k == "e") {
      error = u"boom";
      return false;
    }
    if (k == "-") {
      out = lfw::Value();
      return true;
    }
    out = build_kind_value(k);
    return true;
  }
};

class LoadZip : public lfw::IZip {
 public:
  std::string zid;
  std::u16string zip_name;
  std::optional<std::u16string> zip_md5;

  const std::u16string& name() const override { return zip_name; }
  std::optional<std::u16string> md5() const override { return zip_md5; }

  lfw::IZipObject* file(const std::u16string& path) override {
    const std::string key = to_ascii(path);
    push("lz:file|" + zid + "|" + key);
    for (LoadScript& s : scripts) {
      if (s.path != key) continue;
      return object_for(s);
    }
    return nullptr;
  }

  std::vector<lfw::IZipObject*> file_regex(const std::u16string& pattern) override {
    push("lz:rgx|" + zid + "|" + to_ascii(pattern));
    std::vector<lfw::IZipObject*> out;
    for (LoadScript& s : scripts) {
      if (lfw::zip_name_matches(to_u16(s.path), pattern)) out.push_back(object_for(s));
    }
    return out;
  }

  lfw::IZipObject* object_for(LoadScript& s) {
    for (const std::unique_ptr<LoadZipObject>& o : objects) {
      if (o->script == &s) return o.get();
    }
    auto obj = std::make_unique<LoadZipObject>();
    obj->entry_name = to_u16(s.path);
    obj->script = &s;
    objects.push_back(std::move(obj));
    return objects.back().get();
  }

  std::vector<LoadScript> scripts;

 private:
  std::vector<std::unique_ptr<LoadZipObject>> objects;
};

std::map<std::string, std::unique_ptr<LoadZip>> g_lzips;

// `imp`/`lzadd` 的 kind 迷你语言（两侧一致）：`-`/`o`/`a`/`k:<name>`/`str:<v>`/`md5:<v>`/`w:<name>`/`spk`。
lfw::Value build_kind_value(const std::string& k) {
  if (k == "o") return lfw::Value(std::make_shared<lfw::Object>());
  if (k == "a") return lfw::Value(std::make_shared<lfw::Array>());
  if (k.rfind("k:", 0) == 0) {
    lfw::Object o;
    o.set(to_u16(k.substr(2)), lfw::Value(std::u16string(u"1")));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k.rfind("str:", 0) == 0) return lfw::Value(to_u16(k.substr(4)));
  if (k.rfind("w:", 0) == 0) {
    lfw::Object words;
    words.set(to_u16(k.substr(2)), lfw::Value(std::u16string(u"1")));
    lfw::Object langs;
    langs.set(u"", lfw::Value(std::make_shared<lfw::Object>(words)));
    return lfw::Value(std::make_shared<lfw::Object>(langs));
  }
  if (k == "spk") {
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(u"Spark")));
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(u"spark")));
    o.set(u"type", lfw::Value(4.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k.rfind("md5:", 0) == 0) {
    lfw::Object o;
    o.set(u"md5", lfw::Value(to_u16(k.substr(4))));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  // 4BG：切换器夹具。索引条目是**文件描述**（`{id,file}` / 路径串），真内容走 `imp` 缝。
  auto bg_fixture = [](const char16_t* id, const char16_t* name, const char16_t* group,
                      double left = 0, double right = 1588, double far = -40) {
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(name)));
    base.set(u"shadow", lfw::Value(std::u16string(u"")));
    base.set(u"height", lfw::Value(550.0));
    base.set(u"left", lfw::Value(left));
    base.set(u"right", lfw::Value(right));
    base.set(u"far", lfw::Value(far));
    base.set(u"near", lfw::Value(0.0));
    auto groups = std::make_shared<lfw::Array>();
    if (group != nullptr) groups->push_back(lfw::Value(std::u16string(group)));
    base.set(u"group", lfw::Value(groups));
    lfw::Object o;
    o.set(u"type", lfw::Value(std::u16string(u"background")));
    o.set(u"id", lfw::Value(std::u16string(id)));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"layers", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  };
  auto stage_fixture = [](const char16_t* id, const char16_t* name, const char16_t* bg_id,
                          const char16_t* group, const char16_t* start_name) {
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(id)));
    o.set(u"name", lfw::Value(std::u16string(name)));
    o.set(u"bg", lfw::Value(std::u16string(bg_id)));
    if (start_name != nullptr) {
      o.set(u"is_starting", lfw::Value(true));
      o.set(u"starting_name", lfw::Value(std::u16string(start_name)));
    }
    auto groups = std::make_shared<lfw::Array>();
    if (group != nullptr) groups->push_back(lfw::Value(std::u16string(group)));
    o.set(u"group", lfw::Value(groups));
    o.set(u"phases", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  };
  // `data.stages` 的条目是 `{file, skipped}` 描述符；文件内容是**列表**。
  auto stage_list_fixture = [&](const char16_t* id, const char16_t* name, const char16_t* bg_id,
                                const char16_t* group, const char16_t* start_name) {
    auto arr = std::make_shared<lfw::Array>();
    arr->push_back(stage_fixture(id, name, bg_id, group, start_name));
    return lfw::Value(arr);
  };
  if (k == "bgr") return bg_fixture(u"bg_reg", u"B1", u"regular");
  if (k == "bgh") return bg_fixture(u"bg_hid", u"B2", u"hidden", 50, 1500, -70);
  if (k == "bgo") return bg_fixture(u"bg_oth", u"B3", nullptr, -100, 1700, -90);
  if (k == "srg") return stage_list_fixture(u"st_reg", u"S1", u"bg_reg", nullptr, u"SR");
  if (k == "srh") return stage_list_fixture(u"st_hid", u"S2", u"bg_hid", u"hidden", u"SH");
  if (k == "srd") return stage_list_fixture(u"st_dev", u"S3", u"bg_oth", u"Dev", u"DD");
  // 4BR：可选入池的“正常起始舞台”（分组非 hidden/非 Dev + is_starting），带阶段动作。
  if (k == "srx") {
    auto phase_of = [](const char16_t* on_start, const char16_t* on_end) {
      auto start_arr = std::make_shared<lfw::Array>();
      start_arr->push_back(lfw::Value(std::u16string(on_start)));
      auto end_arr = std::make_shared<lfw::Array>();
      end_arr->push_back(lfw::Value(std::u16string(on_end)));
      lfw::Object ph;
      ph.set(u"on_start", lfw::Value(start_arr));
      ph.set(u"on_end", lfw::Value(end_arr));
      return lfw::Value(std::make_shared<lfw::Object>(ph));
    };
    auto phases = std::make_shared<lfw::Array>();
    phases->push_back(phase_of(u"gogogo_right", u"loop_gogogo_right"));
    phases->push_back(phase_of(u"loop_gogogo_right", u"gogogo_right"));
    const lfw::Value stage0 = stage_fixture(u"st_demo", u"SD", u"bg_reg", u"reg", u"SD");
    lfw::Value stage = stage0;
    if (lfw::Object* const so = lfw::as_object(stage)) {
      so->set(u"phases", lfw::Value(phases));
      so->set(u"next", lfw::Value(std::u16string(u"st_demo2")));
    }
    auto arr = std::make_shared<lfw::Array>();
    arr->push_back(stage);
    arr->push_back(stage_fixture(u"st_demo2", u"SD2", u"bg_reg", u"reg", nullptr));
    return lfw::Value(arr);
  }
  if (k == "swf") {
    auto bg_file = [](const char16_t* id, const char16_t* path) {
      lfw::Object o;
      o.set(u"id", lfw::Value(std::u16string(id)));
      o.set(u"file", lfw::Value(std::u16string(path)));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto stage_file = [](const char16_t* path) {
      lfw::Object o;
      o.set(u"file", lfw::Value(std::u16string(path)));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto bgs = std::make_shared<lfw::Array>();
    bgs->push_back(bg_file(u"bg_reg", u"bg/reg.json5"));
    bgs->push_back(bg_file(u"bg_hid", u"bg/hid.json5"));
    bgs->push_back(bg_file(u"bg_oth", u"bg/oth.json5"));
    auto stages = std::make_shared<lfw::Array>();
    stages->push_back(stage_file(u"st/reg.json5"));
    stages->push_back(stage_file(u"st/hid.json5"));
    stages->push_back(stage_file(u"st/dev.json5"));
    stages->push_back(stage_file(u"st/srv.json5"));
    lfw::Object o;
    o.set(u"backgrounds", lfw::Value(bgs));
    o.set(u"stages", lfw::Value(stages));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  // 4BI：fighter 夹具（`data.type === 8` 的对象数据，走索引的 `objects` 描述符装载）。
  if (k == "ftr") {
    // ⚠ 不带 head：端口的数据预处理不落图片加载任务（DESIGN §66），带 head 会让
    // TS 侧多一行 img:load ⇒ 差分漂移；头像分支在台面上不可观测（记 DESIGN）。
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(u"FIGHTER ONE")));
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(u"fg1")));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }

  if (k == "idg") {
    auto file_of = [](const char16_t* id, const char16_t* path) {
      lfw::Object o;
      o.set(u"id", lfw::Value(std::u16string(id)));
      o.set(u"file", lfw::Value(std::u16string(path)));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto objs = std::make_shared<lfw::Array>();
    objs->push_back(file_of(u"fg1", u"data/fg1.json5"));
    lfw::Object o;
    o.set(u"objects", lfw::Value(objs));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  // 4BR：带分组的角色夹具（DemoModeLogic 的抽签池）。
  auto grouped_fighter = [](const char16_t* id, const char16_t* name, const char16_t* group,
                            const char16_t* bg_face = nullptr) {
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(name)));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(group)));
    base.set(u"group", lfw::Value(groups));
    // 4BS：刷脸夹具要能真下到图（否则 `Picture.image` 恒 null 探不了换脸类变异）。
    if (bg_face != nullptr) base.set(u"bg_face", lfw::Value(std::u16string(bg_face)));
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(id)));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  };
  if (k == "lfa") return grouped_fighter(u"lfa", u"FA", u"1000", u"sprite/FA.png");
  if (k == "lfb") return grouped_fighter(u"lfb", u"FB", u"Boss");
  // 4BR：oid 情景（DemoMode 的 oids 表用数字 id）需要可解析的实体数据。
  if (k == "f51") return grouped_fighter(u"51", u"FZ", u"Boss");
  if (k == "f50") return grouped_fighter(u"50", u"LE", u"Boss");
  // 4BS：CharMenu 随机池夹具（含 hidden/Dev 分组与 bg_face）。
  if (k == "lfc" || k == "lfd" || k == "lfe") {
    const char16_t* const nm = k == "lfc" ? u"FC" : k == "lfd" ? u"FD" : u"FE";
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(nm)));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(u"1000")));
    if (k == "lfd") groups->push_back(lfw::Value(std::u16string(u"hidden")));
    if (k == "lfe") groups->push_back(lfw::Value(std::u16string(u"Dev")));
    base.set(u"group", lfw::Value(groups));
    base.set(u"bg_face", lfw::Value(std::u16string(u"sprite/") + nm + u".png"));
    lfw::Object o;
    o.set(u"id", lfw::Value(to_u16(k)));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "lfj" || k == "lfz") {
    const bool no_name = k == "lfz";
    lfw::Object base;
    if (!no_name) base.set(u"name", lfw::Value(std::u16string(u"FJ")));
    if (!no_name) base.set(u"head", lfw::Value(lfw::NullTag{}));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(u"1000")));
    base.set(u"group", lfw::Value(groups));
    base.set(u"bg_face", lfw::Value(std::u16string(no_name ? u"sprite/FZ.png" : u"!sprite/RFACE@4x.png")));
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(no_name ? u"lfz" : u"2")));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "lfx") {
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(u"FX")));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(u"1000")));
    base.set(u"group", lfw::Value(groups));
    base.set(u"bg_face", lfw::Value(lfw::NullTag{}));
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(u"lfx")));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "lfy") {
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(u"FY")));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(u"1000")));
    base.set(u"group", lfw::Value(groups));
    base.set(u"bg_face", lfw::Value(lfw::NullTag{}));
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(u"4")));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Array>()));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  // 4BU：LFAG 士兵池（group "3000"，ce 控制双方士兵数量差；lf3d 无 ce 走缺省 1）。
  if (k == "lf3a" || k == "lf3b" || k == "lf3c" || k == "lf3d") {
    const char16_t* const nm = k == "lf3a" ? u"G1" : k == "lf3b" ? u"G2" : k == "lf3c" ? u"G3" : u"G4";
    const double ce = k == "lf3a" ? 1.0 : k == "lf3b" ? 2.0 : k == "lf3c" ? 3.0 : 0.0;
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(nm)));
    if (ce != 0.0) base.set(u"ce", lfw::Value(ce));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(u"3000")));
    base.set(u"group", lfw::Value(groups));
    // `enter_frame_by_id("running_0")` 要能命中（否则 TS 会打找不到帧的 warn）。
    lfw::Object frame;
    frame.set(u"id", lfw::Value(std::u16string(u"running_0")));
    frame.set(u"state", lfw::Value(1.0));
    frame.set(u"wait", lfw::Value(2.0));
    lfw::Object frames;
    frames.set(u"running_0", lfw::Value(std::make_shared<lfw::Object>(frame)));
    lfw::Object o;
    o.set(u"id", lfw::Value(to_u16(k)));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Object>(frames)));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  // 4BS：生存舞台夹具（主路 = chapter=survival + is_starting；回退路 = id "50"）。
  if (k == "srv") {
    auto make_stage = [](const char16_t* id, const char16_t* name, const char16_t* bg_id,
                         const char16_t* chapter) {
      lfw::Object o;
      o.set(u"id", lfw::Value(std::u16string(id)));
      o.set(u"name", lfw::Value(std::u16string(name)));
      o.set(u"bg", lfw::Value(std::u16string(bg_id)));
      o.set(u"is_starting", lfw::Value(true));
      o.set(u"starting_name", lfw::Value(std::u16string(name)));
      if (chapter != nullptr) o.set(u"chapter", lfw::Value(std::u16string(chapter)));
      auto groups = std::make_shared<lfw::Array>();
      groups->push_back(lfw::Value(std::u16string(u"reg")));
      o.set(u"group", lfw::Value(groups));
      o.set(u"phases", lfw::Value(std::make_shared<lfw::Array>()));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto arr = std::make_shared<lfw::Array>();
    arr->push_back(make_stage(u"st_srv", u"SV", u"bg_reg", u"survival"));
    arr->push_back(make_stage(u"50", u"F50", u"bg_oth", nullptr));
    return lfw::Value(arr);
  }
  // 4BV：弹幕互动的模板 / 常规池 / 场景（`_start_coop_stage` 的择优、排除与回退）。
  if (k == "r1" || k == "r2") {
    const char16_t* const nm = k == "r1" ? u"RA" : u"RB";
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(nm)));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(u"1000")));
    base.set(u"group", lfw::Value(groups));
    lfw::Object frames;
    lfw::Object frame;
    frame.set(u"id", lfw::Value(std::u16string(u"waiting")));
    frame.set(u"state", lfw::Value(0.0));
    frame.set(u"wait", lfw::Value(2.0));
    frames.set(u"waiting", lfw::Value(std::make_shared<lfw::Object>(frame)));
    lfw::Object o;
    o.set(u"id", lfw::Value(to_u16(k)));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Object>(frames)));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "tmpl") {
    lfw::Object base;
    base.set(u"name", lfw::Value(std::u16string(u"TP")));
    auto groups = std::make_shared<lfw::Array>();
    groups->push_back(lfw::Value(std::u16string(u"hidden")));
    base.set(u"group", lfw::Value(groups));
    lfw::Object frames;
    lfw::Object frame;
    frame.set(u"id", lfw::Value(std::u16string(u"waiting")));
    frame.set(u"state", lfw::Value(0.0));
    frame.set(u"wait", lfw::Value(2.0));
    frames.set(u"waiting", lfw::Value(std::make_shared<lfw::Object>(frame)));
    lfw::Object o;
    o.set(u"id", lfw::Value(std::u16string(u"0")));
    o.set(u"type", lfw::Value(8.0));
    o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
    o.set(u"frames", lfw::Value(std::make_shared<lfw::Object>(frames)));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "sd11") {
    auto arr = std::make_shared<lfw::Array>();
    lfw::Value st = stage_fixture(u"st_11", u"1-1", u"bg_reg", nullptr, nullptr);
    if (lfw::Object* const so = lfw::as_object(st)) {
      so->set(u"next", lfw::Value(std::u16string(u"st_reg")));
    }
    arr->push_back(st);
    return lfw::Value(arr);
  }
  if (k == "sdreg") return stage_list_fixture(u"st_reg", u"S1", u"bg_reg", nullptr, u"SR");
  if (k == "sddev") return stage_list_fixture(u"st_dev", u"S3", u"bg_reg", u"Dev", u"DD");
  if (k == "sdhid") return stage_list_fixture(u"st_hid", u"S2", u"bg_reg", u"hidden", u"SH");
  if (k == "sdsurv") {
    auto arr = std::make_shared<lfw::Array>();
    lfw::Value st = stage_fixture(u"st_surv", u"SV", u"bg_reg", nullptr, u"SV");
    if (lfw::Object* const so = lfw::as_object(st)) {
      so->set(u"chapter", lfw::Value(std::u16string(u"survival")));
    }
    arr->push_back(st);
    return lfw::Value(arr);
  }
  if (k == "idso") {
    auto file_of = [](const char16_t* id, const char16_t* path) {
      lfw::Object o;
      o.set(u"id", lfw::Value(std::u16string(id)));
      o.set(u"file", lfw::Value(std::u16string(path)));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto objs = std::make_shared<lfw::Array>();
    objs->push_back(file_of(u"0", u"data/tmpl.json5"));
    objs->push_back(file_of(u"lfa", u"data/lfa.json5"));
    objs->push_back(file_of(u"r1", u"data/r1.json5"));
    objs->push_back(file_of(u"r2", u"data/r2.json5"));
    auto bgs = std::make_shared<lfw::Array>();
    bgs->push_back(file_of(u"bg_reg", u"bg/reg.json5"));
    lfw::Object o;
    o.set(u"objects", lfw::Value(objs));
    o.set(u"backgrounds", lfw::Value(bgs));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "idsd" || k == "idsdnov" || k == "idsdc") {
    auto stage_file = [](const char16_t* path) {
      lfw::Object o;
      o.set(u"file", lfw::Value(std::u16string(path)));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto stages = std::make_shared<lfw::Array>();
    if (k == "idsd") stages->push_back(stage_file(u"sd/11.json5"));
    stages->push_back(stage_file(u"sd/dev.json5"));
    stages->push_back(stage_file(u"sd/hid.json5"));
    stages->push_back(stage_file(u"sd/surv.json5"));
    if (k != "idsdc") stages->push_back(stage_file(u"sd/reg.json5"));
    lfw::Object o;
    o.set(u"stages", lfw::Value(stages));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "idg3") {
    auto file_of = [](const char16_t* id, const char16_t* path) {
      lfw::Object o;
      o.set(u"id", lfw::Value(std::u16string(id)));
      o.set(u"file", lfw::Value(std::u16string(path)));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto objs = std::make_shared<lfw::Array>();
    objs->push_back(file_of(u"lf3a", u"data/lf3a.json5"));
    objs->push_back(file_of(u"lf3b", u"data/lf3b.json5"));
    objs->push_back(file_of(u"lf3c", u"data/lf3c.json5"));
    objs->push_back(file_of(u"lf3d", u"data/lf3d.json5"));
    lfw::Object o;
    o.set(u"objects", lfw::Value(objs));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  if (k == "idg2" || k == "idg2c") {
    auto file_of = [](const char16_t* id, const char16_t* path) {
      lfw::Object o;
      o.set(u"id", lfw::Value(std::u16string(id)));
      o.set(u"file", lfw::Value(std::u16string(path)));
      return lfw::Value(std::make_shared<lfw::Object>(o));
    };
    auto objs = std::make_shared<lfw::Array>();
    objs->push_back(file_of(u"lfa", u"data/lfa.json5"));
    objs->push_back(file_of(u"lfb", u"data/lfb.json5"));
    objs->push_back(file_of(u"51", u"data/f51.json5"));
    objs->push_back(file_of(u"50", u"data/f50.json5"));
    // 4BS：CharMenu 专用变体（多带三个分组角色）——不污染其他用例的 idg2。
    if (k == "idg2c") {
      objs->push_back(file_of(u"lfc", u"data/lfc.json5"));
      objs->push_back(file_of(u"lfd", u"data/lfd.json5"));
      objs->push_back(file_of(u"lfe", u"data/lfe.json5"));
      objs->push_back(file_of(u"lfj", u"data/lfj.json5"));
      objs->push_back(file_of(u"lfz", u"data/lfz.json5"));
      objs->push_back(file_of(u"lfx", u"data/lfx.json5"));
      objs->push_back(file_of(u"lfy", u"data/lfy.json5"));
    }
    auto stages = std::make_shared<lfw::Array>();
    {
      lfw::Object s;
      s.set(u"file", lfw::Value(std::u16string(u"st/demo.json5")));
      stages->push_back(lfw::Value(std::make_shared<lfw::Object>(s)));
    }
    lfw::Object o;
    o.set(u"objects", lfw::Value(objs));
    o.set(u"stages", lfw::Value(stages));
    return lfw::Value(std::make_shared<lfw::Object>(o));
  }
  return lfw::Value();
}

std::string dump_info(const lfw::IDataInfo& info) {
  return to_ascii(lfw::to_string(info.type)) + "|" + to_ascii(lfw::to_string(info.url)) + "|" +
         to_ascii(lfw::to_string(info.title)) + "|" + to_ascii(lfw::to_string(info.description)) +
         "|" + to_ascii(lfw::to_string(info.author)) + "|" +
         to_ascii(lfw::to_string(info.version)) + "|" + to_ascii(lfw::to_string(info.time)) +
         "|" + to_ascii(lfw::to_string(info.md5));
}

// `imp` 脚本：URL（不含 `?time=` 的部分）→ 值；`has_import` 标记失败脚本。
std::map<std::string, lfw::Value> g_imports;
std::map<std::string, std::string> g_import_fails;

// 4AJ：`uinew`/`uinest` 的 UI 值脚本（`uifind`/`uimerge` 的 parent 链用）。
std::map<std::string, lfw::Value> g_ui_vals;

// 4AK：`imgset` 的图片脚本（`ui_image_load` 按 img_key 查）。
std::map<std::string, lfw::Value> g_images;
std::vector<std::string> g_pin_lines;
bool g_defer_pins = false;

void drain_pins() {
  for (const std::string& line : g_pin_lines) push(line);
  g_pin_lines.clear();
}

// 4AM：事件层与 UIImgLoader 的脚本。
std::map<std::string, lfw::ui::LFWPointerEvent> g_pevs;
std::map<std::string, lfw::ui::LFWKeyEvent> g_kevs;

class FakeImgNode : public lfw::ui::IUIImgLoaderNode {
 public:
  lfw::LFW* lfw_ = nullptr;
  lfw::Value image;
  lfw::LFW& lfw() override { return *lfw_; }
  void set_image(const lfw::Value& v) override {
    push("imnode:image|" + to_ascii(render_value(v)));
    image = v;
  }
  void resize(double w, double h) override {
    push("imnode:resize|" + to_ascii(render_value(lfw::Value(w))) + "|" +
         to_ascii(render_value(lfw::Value(h))));
  }
};

std::map<std::string, std::unique_ptr<FakeImgNode>> g_img_nodes;
std::map<std::string, std::unique_ptr<lfw::ui::UIImgLoader>> g_loaders;
std::map<std::string, std::unique_ptr<lfw::SmoothNumber>> g_smooths;

// 4AN：UINode 脚本。
std::map<std::string, std::unique_ptr<lfw::ui::UINode>> g_nodes;

// 4AP：真 `UILayers` 脚本（台面直建实例，与 `lfw.layers` 的假缝互不干扰）。
std::unique_ptr<lfw::ui::UILayers> g_real_layers;

std::string node_ref(lfw::ui::UINode* const p) {
  return p != nullptr ? to_ascii(render_value(p->id())) : std::string("u");
}

lfw::Value id_opts_value(const std::u16string& id) {
  lfw::Value ret(std::make_shared<lfw::Object>());
  lfw::as_object(ret)->set(u"id", lfw::Value(id));
  return ret;
}

std::string tree_str(const lfw::ui::UINode& n) {
  const lfw::Value idv = n.id();
  const std::u16string* const id = std::get_if<std::u16string>(&idv);
  std::string s = id != nullptr ? to_ascii(*id) : "u";
  s += "(" + std::to_string(n.children().size()) + ")";
  if (!n.children().empty()) {
    s += "[";
    for (size_t i = 0; i < n.children().size(); ++i) {
      if (i != 0) s += ",";
      s += tree_str(*n.children()[i]);
    }
    s += "]";
  }
  return s;
}

// 4AS：台面假组件（与 TS 侧 FakeComponent 逐字同日志）。
namespace bench {

const lfw::ClazzTag* fake_comp_tag() {
  static const lfw::ClazzTag tag{lfw::ui::UIComponent::class_tag()};
  return &tag;
}

lfw::Value sobj(std::initializer_list<std::pair<const char16_t*, lfw::Value>> kv) {
  lfw::Value o(std::make_shared<lfw::Object>());
  lfw::Object* const p = const_cast<lfw::Object*>(lfw::as_object(o));
  for (const std::pair<const char16_t*, lfw::Value>& item : kv) p->set(item.first, item.second);
  return o;
}

lfw::Value str_schema(const char16_t* type) {
  return sobj({{u"type", lfw::Value(std::u16string(type))}});
}

lfw::Value opt_schema(const char16_t* type) {
  return sobj({{u"type", lfw::Value(std::u16string(type))}, {u"nullable", lfw::Value(true)}});
}

lfw::Value arr_schema(const char16_t* item_type) {
  return sobj({{u"type", lfw::Value(std::u16string(u"array"))},
               {u"nullable", lfw::Value(true)},
               {u"items", str_schema(item_type)}});
}

lfw::Value make_fake_props_meta() {
  return sobj({
      {u"n", str_schema(u"number")},
      {u"s", str_schema(u"string")},
      {u"pick", opt_schema(u"string")},
      {u"ok", opt_schema(u"boolean")},
      {u"arr", arr_schema(u"number")},
      {u"strs", arr_schema(u"string")},
      {u"b0", opt_schema(u"string")},
      {u"sub", str_schema(u"$cls:UINode")},
      {u"other", str_schema(u"$cls:UIComponent")},
      {u"stop_click", opt_schema(u"boolean")},
      {u"stop_key", opt_schema(u"string")},
      {u"del_at", opt_schema(u"number")},
  });
}

std::string iref_value(const lfw::Value& v) {
  if (lfw::ui::UINode* const n = lfw::ui::ref_to_node(v)) {
    return "node:" + to_ascii(lfw::to_string(n->id()));
  }
  if (lfw::ui::UIComponent* const c = lfw::ui::ref_to_comp(v)) {
    return "comp:" + to_ascii(c->f_name) + "#" + to_ascii(c->id);
  }
  return to_ascii(render_value(v));
}

class FakeComp : public lfw::ui::UIComponent {
 public:
  FakeComp(lfw::ui::UINode& layout, const std::u16string& f_name, const lfw::Value& info)
      : UIComponent(layout, f_name, info) {}

  const lfw::ClazzTag* clazz() const override { return fake_comp_tag(); }
  const std::u16string& props_tag() const override {
    static const std::u16string t = u"FakeComp";
    return t;
  }
  const lfw::Value& props_meta() const override {
    static const lfw::Value m = make_fake_props_meta();
    return m;
  }

  std::string tag() const { return "fc|" + to_ascii(f_name); }

    // 4BK：FSM 宿主（`UIComponent::fsm()` 在台面的实现）。
    lfw::FSM fsm_storage;
    std::vector<std::unique_ptr<lfw::IState>> fsm_states;
    lfw::FSM* fsm() override { return &fsm_storage; }
  std::string opt_num(const std::u16string& k) {
    const std::optional<double> v = props_holder.num(k);
    return v.has_value() ? to_ascii(render_value(lfw::Value(*v))) : "z";
  }
  std::string opt_str(const std::u16string& k) {
    const std::optional<std::u16string> v = props_holder.str(k);
    return v.has_value() ? to_ascii(render_value(lfw::Value(*v))) : "z";
  }
  std::string opt_str_one(const std::u16string& k, std::initializer_list<std::u16string> one_of) {
    const std::vector<std::u16string> list(one_of);
    const std::optional<std::u16string> v = props_holder.str(k, list);
    return v.has_value() ? to_ascii(render_value(lfw::Value(*v))) : "z";
  }
  std::string opt_bool(const std::u16string& k) {
    const std::optional<bool> v = props_holder.bool_(k);
    return v.has_value() ? to_ascii(render_value(lfw::Value(*v))) : "z";
  }
  std::string opt_arr(const std::u16string& k, double len) {
    const std::optional<std::vector<lfw::Value>> v = props_holder.nums(k, len);
    if (!v.has_value()) return "err";
    std::string out;
    for (size_t j = 0; j < v->size(); ++j) {
      if (j != 0) out += ",";
      out += to_ascii(lfw::to_string((*v)[j]));
    }
    return out;
  }
  std::string opt_strs(const std::u16string& k) {
    const std::optional<std::vector<std::u16string>> v = props_holder.strs(k);
    if (!v.has_value()) return "z";
    std::string out;
    for (size_t j = 0; j < v->size(); ++j) {
      if (j != 0) out += "+";
      out += to_ascii((*v)[j]);
    }
    return out;
  }
  std::string iref_key(const std::u16string& k) {
    lfw::schema::SchemaValidator& v = props_holder.validator();
    const std::vector<lfw::schema::SchemaValidator::DefinedInstance>& list = v.defined_instances();
    for (size_t j = 0; j < list.size(); ++j) {
      if (list[j].key != k) continue;
      const lfw::schema::SchemaValidator::InstanceAccess a = v.get_instance(j);
      if (a.ok) return iref_value(a.value);
      return "err:" + to_ascii(a.error);
    }
    const lfw::Object* const o = lfw::as_object(props_holder.raw());
    const lfw::Value* const p = o != nullptr ? o->get(k) : nullptr;
    return to_ascii(render_value(p != nullptr ? *p : lfw::Value()));
  }

  void dump() {
    const std::string f = tag() + "|props";
    if (props() == nullptr) {
      std::string errs;
      for (size_t k = 0; k < props_errors().size(); ++k) {
        if (k != 0) errs += "|";
        errs += to_ascii(props_errors()[k]);
      }
      push(f + "|err|" + errs);
      return;
    }
    std::string line = f;
    line += "|n=" + opt_num(u"n");
    line += "|s=" + opt_str(u"s");
    line += "|pick=" + opt_str_one(u"pick", {u"a", u"b"});
    line += "|ok=" + opt_bool(u"ok");
    line += "|arr=" + opt_arr(u"arr", 2.0);
    line += "|strs=" + opt_strs(u"strs");
    line += "|lstrs=" + opt_strs(u"s");
    line += "|b0=" + opt_bool(u"b0");
    line += "|sub=" + iref_key(u"sub");
    line += "|other=" + iref_key(u"other");
    push(line);
  }

  void init() override { push(tag() + "|init|" + to_ascii(id)); }
  void on_add() override {
    push(tag() + "|add|" + to_ascii(id));
    dump();
  }
  void on_del() override { push(tag() + "|del|" + to_ascii(id)); }
  void on_start() override {
    push(tag() + "|start");
    push(tag() + "|lrud|" + to_ascii(lfw::to_string(lfw::Value(LR()))) + "," +
         to_ascii(lfw::to_string(lfw::Value(UD()))));
  }
  void on_stop() override { push(tag() + "|stop"); }
  void on_resume() override {
    push(tag() + "|resume");
    push(tag() + "|lrud|" + to_ascii(lfw::to_string(lfw::Value(LR()))) + "," +
         to_ascii(lfw::to_string(lfw::Value(UD()))));
  }
  void on_pause() override { push(tag() + "|pause"); }
  void on_show() override { push(tag() + "|show"); }
  void on_hide() override { push(tag() + "|hide"); }
  void on_foucs() override { push(tag() + "|foucs"); }
  void on_blur() override { push(tag() + "|blur"); }
  void on_click(lfw::ui::LFWPointerEvent& e) override {
    push(tag() + "|click|" + to_ascii(render_value(lfw::Value(e.button))));
    if (props_holder.bool_(u"stop_click").value_or(false)) e.stop_immediate_propagation();
  }
  void on_key_down(lfw::ui::LFWKeyEvent& e) override {
    push(tag() + "|kdown|" + to_ascii(render_value(lfw::Value(e.game_key))));
    const std::optional<std::u16string> stop = props_holder.str(u"stop_key");
    if (stop.has_value() && *stop == e.game_key) e.stop_immediate_propagation();
  }
  void on_key_up(lfw::ui::LFWKeyEvent& e) override {
    push(tag() + "|kup|" + to_ascii(render_value(lfw::Value(e.game_key))));
  }
  void on_pointer_down(lfw::ui::LFWPointerEvent&) override { push(tag() + "|pdown"); }
  void on_pointer_move(lfw::ui::LFWPointerEvent&) override { push(tag() + "|pmove"); }
  void on_pointer_up(lfw::ui::LFWPointerEvent&) override { push(tag() + "|pup"); }
  void on_pointer_cancel(lfw::ui::LFWPointerEvent&) override { push(tag() + "|pcancel"); }
  void on_pointer_leave() override { push(tag() + "|pleave"); }
  void on_pointer_enter() override { push(tag() + "|penter"); }
  void update(double) override {
    _updates += 1.0;
    push(tag() + "|update|" + to_ascii(render_value(lfw::Value(_updates))));
    const std::optional<double> at = props_holder.num(u"del_at");
    if (at.has_value() && *at == _updates) {
      push(tag() + "|delreq");
      node.del_components(*this);
    }
  }

 private:
  double _updates = 0.0;
};

class FakeCompCreator : public lfw::IComponentCreator {
 public:
  lfw::ui::UIComponent* create(lfw::ui::UINode& layout, const std::u16string& f_name,
                               const lfw::Value& info) const override {
    return new FakeComp(layout, f_name, info);
  }
};

}

std::map<std::string, std::unique_ptr<bench::FakeComp>> g_components;

// 4AD：URL 流程脚本。
std::map<std::string, std::string> g_stored;       // `zip_url|md5` → blob token
std::map<std::string, std::string> g_blob_to_zip;  // blob/data token → zid
struct DlScript {
  std::string mode;
  std::string token;
  std::string md5;
  bool has_md5 = false;
  double size = 0.0;
};
std::map<std::string, DlScript> g_dls;      // zip_url → 下载脚本
std::map<std::string, lfw::Value> g_caches;  // Cache.get 键 → 值
std::map<std::string, lfw::Value> g_cache_late;  // 首次 get 报 miss、之后才给值的条目

class FakeUINodeRenderer : public lfw::ui::IUINodeRenderer {
 public:
  explicit FakeUINodeRenderer(lfw::ui::UINode& node) : node_(&node) {}
  void del_self() override { push("rend|del_self|" + node_ref(node_)); }
  void on_start() override { push("rend|on_start|" + node_ref(node_)); }
  void on_stop() override { push("rend|on_stop|" + node_ref(node_)); }
  void on_resume() override { push("rend|on_resume|" + node_ref(node_)); }
  void on_pause() override { push("rend|on_pause|" + node_ref(node_)); }
  void on_show() override { push("rend|on_show|" + node_ref(node_)); }
  void on_hide() override { push("rend|on_hide|" + node_ref(node_)); }
  void on_foucs() override { push("rend|on_foucs|" + node_ref(node_)); }
  void on_blur() override { push("rend|on_blur|" + node_ref(node_)); }

 private:
  lfw::ui::UINode* node_ = nullptr;
};

class FakeHost : public lfw::ILfwHost {
 public:
  explicit FakeHost(lfw::LFW** slot) : _slot(slot) {}

  lfw::ui::IUINodeRenderer* create_ui_node_renderer(lfw::ui::UINode& node) override {
    return new FakeUINodeRenderer(node);
  }

  double now() override { return 12345.0; }
  void sounds_init(lfw::LFW& lfw) override {
    push("snd_init");
    lfw_ = &lfw;
    _bgm_rand = std::make_unique<lfw::Randoming>(u"bgm_randoming", std::vector<lfw::Value>{},
                                                 &lfw.mt_ref());
  }
  void images_init(lfw::LFW&) override { push("img_init"); }
  void keyboard_init(lfw::LFW&) override { push("kbd_init"); }
  void pointings_init(lfw::LFW&) override { push("pt_init"); }
  void keyboard_add_callback(lfw::LFW& lfw) override {
    push("kbd_cbadd");
    _kbd_cbs.push_back(&lfw);
  }
  void pointings_add_ui_input(lfw::LFW&) override { push("pt_cbadd"); }
  void keyboard_callback_add(lfw::LFW&, lfw::LfwKeyboardCallback* cb) override {
    push("kbd_cbadd");
    bool has = false;
    for (lfw::LfwKeyboardCallback* const v : _kbd_cbs) {
      if (v == cb) has = true;
    }
    if (!has) _kbd_cbs.push_back(cb);
  }
  void keyboard_callback_del(lfw::LFW&, lfw::LfwKeyboardCallback* cb) override {
    push("kbd_cbdel");
    for (std::size_t i = 0; i < _kbd_cbs.size();) {
      if (_kbd_cbs[i] == cb) _kbd_cbs.erase(_kbd_cbs.begin() + static_cast<std::ptrdiff_t>(i));
      else ++i;
    }
  }
  void pointings_callback_add(lfw::LFW&, lfw::LfwPointingsCallback* cb) override {
    push("pt_cbadd");
    bool has = false;
    for (lfw::LfwPointingsCallback* const v : _pt_cbs) {
      if (v == cb) has = true;
    }
    if (!has) _pt_cbs.push_back(cb);
  }
  void pointings_callback_del(lfw::LFW&, lfw::LfwPointingsCallback* cb) override {
    push("pt_cbdel");
    for (std::size_t i = 0; i < _pt_cbs.size();) {
      if (_pt_cbs[i] == cb) _pt_cbs.erase(_pt_cbs.begin() + static_cast<std::ptrdiff_t>(i));
      else ++i;
    }
  }
  // 键盘/指针/音效服务收到事件后分发给注册表（列表第一项是 LFW 自己）。
  void fire_snd_bgm_changed(const std::u16string& bgm, const std::u16string& prev) {
    const std::vector<lfw::LfwSoundsCallback*> snapshot = _snd_cbs;
    for (lfw::LfwSoundsCallback* const cb : snapshot) cb->on_bgm_changed(bgm, prev);
  }
  void fire_snd_volume_changed(double volume, double prev) {
    const std::vector<lfw::LfwSoundsCallback*> snapshot = _snd_cbs;
    for (lfw::LfwSoundsCallback* const cb : snapshot) cb->on_volume_changed(volume, prev);
  }
  void fire_snd_bgm_volume_changed(double volume, double prev) {
    const std::vector<lfw::LfwSoundsCallback*> snapshot = _snd_cbs;
    for (lfw::LfwSoundsCallback* const cb : snapshot) cb->on_bgm_volume_changed(volume, prev);
  }
  void fire_snd_sound_volume_changed(double volume, double prev) {
    const std::vector<lfw::LfwSoundsCallback*> snapshot = _snd_cbs;
    for (lfw::LfwSoundsCallback* const cb : snapshot) cb->on_sound_volume_changed(volume, prev);
  }
  void fire_snd_bgm_muted_changed(bool muted) {
    const std::vector<lfw::LfwSoundsCallback*> snapshot = _snd_cbs;
    for (lfw::LfwSoundsCallback* const cb : snapshot) cb->on_bgm_muted_changed(muted);
  }
  void fire_snd_sound_muted_changed(bool muted) {
    const std::vector<lfw::LfwSoundsCallback*> snapshot = _snd_cbs;
    for (lfw::LfwSoundsCallback* const cb : snapshot) cb->on_sound_muted_changed(muted);
  }
  std::string snd_probe() const {
    return to_ascii(snd_bgm_name) + "|" + (snd_is_random ? "1" : "0");
  }
  void dispatch_key(lfw::LfwKeyEvent& e, bool down) {
    const std::vector<lfw::LfwKeyboardCallback*> snapshot = _kbd_cbs;
    for (lfw::LfwKeyboardCallback* const cb : snapshot) {
      if (down) cb->on_key_down(e);
      else cb->on_key_up(e);
    }
  }
  void grab_begin() { ++_pt_grab_epoch; }
  void dispatch_pointing(const std::string& what, lfw::LfwPointingEvent& e, bool bump = true) {
    // 真实平台在 pointer down 里 `grab_begin()`（世代 +1，之后才分发）。
    if (what == "down" && bump) ++_pt_grab_epoch;
    const std::vector<lfw::LfwPointingsCallback*> snapshot = _pt_cbs;
    for (lfw::LfwPointingsCallback* const cb : snapshot) {
      if (what == "down") cb->on_pointer_down(e);
      else if (what == "move") cb->on_pointer_move(e);
      else if (what == "up") cb->on_pointer_up(e);
      else if (what == "cancel") cb->on_pointer_cancel(e);
      else if (what == "wheel") cb->on_wheel(e);
      else cb->on_click(e);
    }
  }
  // 4BN：`DittoImpl.__Pointings` 的抢焦点语义（`grab` / `ungrab` / 世代）。
  bool pointings_grab(lfw::LFW&, const void* who) override {
    if (_pt_grabbing != nullptr && _pt_grabbing != who &&
        _pt_grab_prev_epoch == _pt_grab_epoch) {
      push("pt_grab|0");
      return false;
    }
    _pt_grabbing = who;
    _pt_grab_prev_epoch = _pt_grab_epoch;
    push("pt_grab|1");
    return true;
  }
  void pointings_ungrab(lfw::LFW&, const void* who) override {
    if (_pt_grabbing == who) {
      _pt_grabbing = nullptr;
      push("pt_ungrab");
    }
  }
  // `this.pointings.grabbing`（世代不符/无人持有时为 nullptr）——`ptg` op 与 ScrollView 共用。
  const void* pointings_grabbing(lfw::LFW&) override {
    return _pt_grabbing != nullptr && _pt_grab_prev_epoch == _pt_grab_epoch ? _pt_grabbing
                                                                           : nullptr;
  }
  void cache_forget(const std::u16string& type, double version) override {
    push("cache:forget|" + to_ascii(type) + "|" + num(version));
  }
  void zip_forget_stored(const std::u16string& type, double version) override {
    push("zip:forget|" + to_ascii(type) + "|" + num(version));
  }
  lfw::IWorldRenderer* create_world_renderer(lfw::LFW&) override {
    push("wr_init");
    return &_renderer;
  }
  void load_img(const std::u16string& path) override { push("img:load|" + to_ascii(path)); }

  // 4AK：UI 图片缝：`ui_load_img` 的 load/pin + `Ditto.MD5`（固定加前缀，两侧一致）。
  bool ui_image_load(const std::u16string& img_key, const lfw::Value& path, const lfw::Value& ops,
                     lfw::Value& out, std::u16string& error) override {
    push("img:load|" + to_ascii(img_key) + "|" + to_ascii(render_value(path)) + "|" +
         to_ascii(render_value(ops)));
    const auto it = g_images.find(to_ascii(img_key));
    if (it == g_images.end()) {
      error = u"unscripted image";
      return false;
    }
    out = it->second;
    return true;
  }
  void ui_image_pin(const std::u16string& img_key) override {
    // 默认内联（同步链：load → pin → set_image，与 TS 同一个微任务里一致）；
    // 但 `nlife` 期间的 pin 在 TS 里要等到节点生命周期回调跑完才落痕 ⇒ 先排队。
    const std::string line = "img:pin|" + to_ascii(img_key);
    if (g_defer_pins) g_pin_lines.push_back(line);
    else push(line);
  }
  std::u16string md5(const std::u16string& text) override { return u"h:" + text; }

  bool dev() const override { return false; }
  void warn(const std::vector<lfw::Value>& args) override { push(join("warn", args)); }
  // 异步告警（`UIImgLoader` 的 `.catch`）：跟 `img:pin` 一起排队，等 flush 点再吐。
  void warn_async(const std::vector<lfw::Value>& args) override {
    g_pin_lines.push_back(join("warn", args));
  }
  void error(const std::vector<lfw::Value>& args) override { push(join("error", args)); }
  void log(const std::vector<lfw::Value>& args) override { push(join("Log", args)); }
  void debug_msg(const std::vector<lfw::Value>& args) override { push(join("debug", args)); }

  std::function<void()> sounds_play_bgm(const lfw::Value& name) override {
    push("snd_bgm");
    const std::u16string name_s = lfw::to_string(name);
    if (!_snd_prev_url.empty() && _snd_prev_url == name_s) return [] {};
    const std::u16string prev = snd_bgm_name;
    std::u16string real;
    if (name_s == u"?") {
      std::vector<lfw::Value> src;
      for (const std::u16string& b : lfw_->bgms) src.push_back(lfw::Value(b));
      const lfw::Value got = _bgm_rand->set_src(std::move(src)).get();
      const std::u16string* const s = std::get_if<std::u16string>(&got);
      if (s != nullptr) real = *s;
    } else {
      real = name_s;
    }
    snd_bgm_name.clear();
    _snd_prev_url.clear();
    if (real.empty()) return [] {};
    snd_bgm_name = real;
    _snd_prev_url = real;
    snd_is_random = (name_s == u"?");
    fire_snd_bgm_changed(real, prev);
    return [] {};
  }
  void sounds_stop_bgm() override {
    if (snd_bgm_name.empty()) return;
    const std::u16string prev = snd_bgm_name;
    snd_bgm_name.clear();
    _snd_prev_url.clear();
    push("snd_stop");
    fire_snd_bgm_changed(std::u16string(), prev);
  }
  std::u16string sounds_bgm() override { return snd_bgm_name; }
  bool sounds_is_random() override { return snd_is_random; }
  // 4BR：音量族（照 `__Modern`：clamp 0..1、同值早退、变更后发事件）。
  double sounds_volume() override { return snd_volume; }
  void sounds_set_volume(double v) override {
    v = lfw::clamp(v, 0.0, 1.0);
    const double prev = snd_volume;
    if (lfw::float_equal(v, prev)) return;
    snd_volume = v;
    fire_snd_volume_changed(v, prev);
  }
  double sounds_bgm_volume() override { return snd_bgm_volume; }
  void sounds_set_bgm_volume(double v) override {
    v = lfw::clamp(v, 0.0, 1.0);
    const double prev = snd_bgm_volume;
    if (lfw::float_equal(v, prev)) return;
    snd_bgm_volume = v;
    fire_snd_bgm_volume_changed(v, prev);
  }
  double sounds_sound_volume() override { return snd_sound_volume; }
  void sounds_set_sound_volume(double v) override {
    v = lfw::clamp(v, 0.0, 1.0);
    const double prev = snd_sound_volume;
    if (lfw::float_equal(v, prev)) return;
    snd_sound_volume = v;
    fire_snd_sound_volume_changed(v, prev);
  }
  bool sounds_bgm_muted() override { return snd_bgm_muted; }
  void sounds_set_bgm_muted(bool v) override {
    if (v == snd_bgm_muted) return;
    snd_bgm_muted = v;
    fire_snd_bgm_muted_changed(v);
  }
  bool sounds_sound_muted() override { return snd_sound_muted; }
  void sounds_set_sound_muted(bool v) override {
    if (v == snd_sound_muted) return;
    snd_sound_muted = v;
    fire_snd_sound_muted_changed(v);
  }
  void sounds_callback_add(lfw::LFW&, lfw::LfwSoundsCallback* cb) override {
    push("snd_cbadd");
    bool has = false;
    for (lfw::LfwSoundsCallback* const v : _snd_cbs) {
      if (v == cb) has = true;
    }
    if (!has) _snd_cbs.push_back(cb);
  }
  void sounds_callback_del(lfw::LFW&, lfw::LfwSoundsCallback* cb) override {
    push("snd_cbdel");
    for (std::size_t k = 0; k < _snd_cbs.size();) {
      if (_snd_cbs[k] == cb) _snd_cbs.erase(_snd_cbs.begin() + static_cast<std::ptrdiff_t>(k));
      else ++k;
    }
  }
  void sounds_play(const lfw::Value&, const lfw::Value&, const lfw::Value&,
                   const lfw::Value&) override {
    push("snd_play");
  }
  void sounds_play_with_load(const lfw::Value&) override { push("snd_load"); }
  void sounds_load(const lfw::Value& name, const lfw::Value& src) override {
    push("snd_file|" + to_ascii(lfw::to_string(name)) + "|" + to_ascii(lfw::to_string(src)));
  }
  bool desktop_flag = false;
  bool is_desktop() const override { return desktop_flag; }
  void sounds_play_preset(const lfw::Value& name, const lfw::Value& x, const lfw::Value& y,
                          const lfw::Value& z) override {
    push("snd_preset|" + to_ascii(render_value(name)) + "|" + to_ascii(render_value(x)) + "|" +
         to_ascii(render_value(y)) + "|" + to_ascii(render_value(z)));
  }
  void sounds_dispose() override {
    _snd_cbs.clear();
    push("snd_dispose");
  }
  void keyboard_dispose() override {
    _kbd_cbs.clear();
    push("kbd_dispose");
  }
  void pointings_dispose() override {
    _pt_cbs.clear();
    push("pt_dispose");
  }

  lfw::Value measure_text(const lfw::Value& text, const lfw::Value& style) override {
    push("measure|" + to_ascii(render_value(text)) + "|" + to_ascii(render_value(style)));
    const bool null_text = std::holds_alternative<std::monostate>(text) ||
                           std::holds_alternative<lfw::NullTag>(text);
    const std::u16string t = null_text ? std::u16string() : lfw::to_string(text);
    lfw::Value out(std::make_shared<lfw::Object>());
    lfw::Object* const o = lfw::as_object(out);
    o->set(u"text", lfw::Value(t));
    o->set(u"w", lfw::Value(static_cast<double>(t.size() * 4)));
    o->set(u"h", lfw::Value(10.0));
    o->set(u"scale", lfw::Value(1.0));
    return out;
  }

  void player_cache_get(const std::u16string&, lfw::PlayerInfoCacheEntry& out) override {
    out.missing = true;
  }
  bool player_cache_del(const std::u16string&, std::u16string&) override { return true; }
  void player_cache_put(const lfw::PlayerInfoCachePut&) override {}

  bool import_as_json(const std::vector<std::u16string>& urls, lfw::Value& data, lfw::Value&,
                      std::u16string& error) override {
    for (const std::u16string& url : urls) {
      std::string key = to_ascii(url);
      const size_t q = key.find('?');
      if (q != std::string::npos) key = key.substr(0, q);
      push("imp:json|" + key);
      const auto fail = g_import_fails.find(key);
      if (fail != g_import_fails.end()) {
        error = to_u16(fail->second);
        return false;
      }
      const auto it = g_imports.find(key);
      if (it == g_imports.end()) continue;
      data = it->second;
      return true;
    }
    error = u"unscripted import";
    return false;
  }
  bool import_as_blob_url(const std::vector<std::u16string>&, lfw::Value&, lfw::Value&,
                          std::u16string& error) override {
    error = u"host";
    return false;
  }
  bool import_as_array_buffer(const std::vector<std::u16string>&, lfw::Value&, lfw::Value&,
                              std::u16string& error) override {
    error = u"host";
    return false;
  }
  bool import_as_image_bitmap(const std::vector<std::u16string>&, lfw::Value&, lfw::Value&,
                              std::u16string& error) override {
    error = u"host";
    return false;
  }
  bool import_as_text(const std::vector<std::u16string>&, lfw::Value&, lfw::Value&,
                      std::u16string& error) override {
    error = u"host";
    return false;
  }
  bool xml_parse(const lfw::Value&, lfw::Value&, std::shared_ptr<lfw::IXMLElement>&,
                 std::u16string& error) override {
    error = u"host";
    return false;
  }

  void lang_apply(lfw::LFW& lfw, const std::u16string& lang, const std::u16string&) override {
    std::u16string err;
    lfw.i18n().set_lang(lfw::Value(lang), err);
  }

  // ---- ILfwHost：4AC/4AD 的 zip/缓存/UI 缝（台面脚本化）----
  lfw::Value zip_get_stored(const std::u16string& zip_url, const std::u16string& md5) override {
    push("zip:get_stored|" + to_ascii(zip_url) + "|" + to_ascii(md5));
    const auto it = g_stored.find(to_ascii(zip_url) + "|" + to_ascii(md5));
    if (it == g_stored.end()) return lfw::Value();
    return lfw::Value(to_u16(it->second));
  }
  bool zip_read_blob(const std::u16string& name, const lfw::Value& blob, const lfw::Value& md5,
                     lfw::IZip*& out, std::u16string& error) override {
    push("zip:read_blob|" + to_ascii(name) + "|" + to_ascii(lfw::to_string(md5)));
    out = nullptr;
    if (!resolve_token(blob, out)) {
      error = u"unscripted blob";
      return false;
    }
    return true;
  }
  bool zip_read_buf(const std::u16string& name, const lfw::Value& data, lfw::IZip*& out,
                    std::u16string& error) override {
    push("zip:read_buf|" + to_ascii(name));
    out = nullptr;
    if (!resolve_token(data, out)) {
      error = u"unscripted buf";
      return false;
    }
    return true;
  }
  bool zip_download(const std::u16string& zip_url, const lfw::Value&, lfw::LFW& lfw,
                    ILfwHost::DownloadedZip& out, std::u16string& error) override {
    push("zip:download|" + to_ascii(zip_url));
    const auto it = g_dls.find(to_ascii(zip_url));
    if (it == g_dls.end()) {
      error = u"unscripted download";
      return false;
    }
    if (it->second.mode == "fail") {
      error = u"dl-fail";
      return false;
    }
    lfw.on_loading_file(zip_url, 50.0, it->second.size);
    out.stored = it->second.mode == "stored";
    out.blob = lfw::Value(to_u16(it->second.token));
    out.md5 = it->second.has_md5 ? lfw::Value(to_u16(it->second.md5)) : lfw::Value();
    return true;
  }
  lfw::Value zip_cache_get(const std::u16string& name) override {
    push("cache:get|" + to_ascii(name));
    const auto late = g_cache_late.find(to_ascii(name));
    if (late != g_cache_late.end()) {
      const lfw::Value value = late->second;
      g_cache_late.erase(late);
      g_caches[to_ascii(name)] = value;
      return lfw::Value();
    }
    const auto it = g_caches.find(to_ascii(name));
    return it == g_caches.end() ? lfw::Value() : it->second;
  }
  void zip_cache_del(const std::u16string& name, const std::u16string& version) override {
    push("cache:del|" + to_ascii(name) + "|" + to_ascii(version));
  }
  void zip_cache_put(const lfw::Value& entry) override {
    push("cache:put|" + to_ascii(lfw::to_string(lfw::field_or(entry, u"name"))));
  }

 private:
  static std::string join(const std::string& prefix, const std::vector<lfw::Value>& args) {
    std::string out = prefix;
    for (std::size_t i = 0; i < args.size(); i++) {
      out += (i == 0 ? "|" : "~") + to_ascii(render_value(args[i]));
    }
    return out;
  }

  // `read_blob`/`read_buf` 的 blob/data 令牌 → 台面上的假 zip（`blob`/`buf` op 登记）。
  static bool resolve_token(const lfw::Value& token_value, lfw::IZip*& out) {
    const std::u16string* const token = std::get_if<std::u16string>(&token_value);
    if (token == nullptr) return false;
    const auto it = g_blob_to_zip.find(to_ascii(*token));
    if (it == g_blob_to_zip.end()) return false;
    const auto z = g_lzips.find(it->second);
    if (z == g_lzips.end()) return false;
    out = z->second.get();
    return true;
  }

  lfw::LFW** _slot = nullptr;
  std::vector<lfw::LfwKeyboardCallback*> _kbd_cbs;
  std::vector<lfw::LfwPointingsCallback*> _pt_cbs;
  // 4BN：假平台的抢焦点状态（`__Pointings`：世代 + 持有者）。
  const void* _pt_grabbing = nullptr;
  long _pt_grab_prev_epoch = -1;
  long _pt_grab_epoch = 0;
  // 4BL：假声音的状态（`bgm()` / `is_random` / `callbacks` / Modern 的 play/stop 语义）。
  std::u16string snd_bgm_name;
  bool snd_is_random = false;
  std::u16string _snd_prev_url;
  std::vector<lfw::LfwSoundsCallback*> _snd_cbs;
  // 4BR：音量/静音状态（`__Modern` 默认值：volume 0.3 / bgm_volume 0.5 / sound_volume 1）。
  double snd_volume = 0.3;
  double snd_bgm_volume = 0.5;
  double snd_sound_volume = 1.0;
  bool snd_bgm_muted = false;
  bool snd_sound_muted = false;
  std::unique_ptr<lfw::Randoming> _bgm_rand;
  lfw::LFW* lfw_ = nullptr;
  class Renderer : public lfw::IWorldRenderer {
   public:
    void add_entity(lfw::Entity&) override {}
    void del_entity(lfw::Entity&) override {}
    void render(double) override {}
    void dispose() override {}
  } _renderer;
};

std::vector<std::u16string> g_words;

// 4BP 的统计/计分驱动 op（单开一函数，避免主 else-if 链块嵌套超限）。
bool run_sum_ops(lfw::LFW& lfw, FakeHost& host, const std::vector<std::string>& t, size_t& i,
                 const std::string& op) {
  (void)host;
  lfw::World& w = lfw.world();
  if (op == "wpp") {
    const std::u16string pid = key_of(t[i++]);
    const double idx = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    bool found = false;
    for (size_t k = 0; k < w.puppets.size(); ++k) {
      if (w.puppets[k].first != pid) continue;
      if (e != nullptr) w.puppets[k].second = e;
      else w.puppets.erase(w.puppets.begin() + static_cast<ptrdiff_t>(k));
      found = true;
      break;
    }
    if (!found && e != nullptr) w.puppets.push_back({pid, e});
    push("wpp|" + to_ascii(pid) + "|" + (e != nullptr ? "1" : "0") + "|n=" +
         to_ascii(lfw::number_to_string(static_cast<double>(w.puppets.size()))));
    return true;
  }
  if (op == "ehp" || op == "emp" || op == "eres") {
    const double idx = to_double(t[i++]);
    const double v = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    if (e != nullptr) {
      if (op == "ehp") e->set_hp(v);
      else if (op == "emp") e->set_mp(v);
      else e->set_reserve(v);
    }
    push(op + "|" + num(idx) + "|" + (e != nullptr ? "1" : "0") + "|hp=" +
         num(e != nullptr ? e->hp() : 0) + "|mp=" + num(e != nullptr ? e->mp() : 0) + "|res=" +
         num(e != nullptr ? e->reserve() : 0));
    return true;
  }
  if (op == "edel") {
    const double idx = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    if (e != nullptr) w.del_entity(*e);
    push("edel|" + num(idx) + "|" + (e != nullptr ? "1" : "0") + "|n=" +
         num(static_cast<double>(w.entities.size())));
    return true;
  }
  if (op == "wrun") {
    const double n = to_double(t[i++]);
    for (double k = 0; k < n; ++k) w.update_once(16.0);
    push("wrun|" + num(n) + "|n=" + num(static_cast<double>(w.entities.size())) + "|paused=" +
         (w.paused() ? "1" : "0"));
    return true;
  }
  if (op == "ntick") {
    const std::string nid = t[i++];
    const double n = to_double(t[i++]);
    lfw::ui::UINode& nd = *g_nodes.at(nid);
    for (double k = 0; k < n; ++k) nd.update(16.0);
    push("ntick|" + nid + "|lt=" + num(nd.lifetime()));
    return true;
  }
  if (op == "sdmg" || op == "skill" || op == "spick") {
    const double idx = to_double(t[i++]);
    const double v = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    if (e != nullptr) {
      if (op == "sdmg") {
        lfw::summary_mgr().add_damage_sum(lfw::ref_of(*e), lfw::Value(v));
      } else if (op == "skill") {
        lfw::summary_mgr().add_kill_sum(lfw::ref_of(*e), lfw::Value(v));
      } else {
        lfw::Summary& s = *lfw::summary_mgr().get(e->id);
        s.set_picking_sum(lfw::Value(lfw::to_number(s.picking_sum()) + v));
      }
    }
    push(op + "|" + num(idx) + "|" + (e != nullptr ? "1" : "0"));
    return true;
  }
  if (op == "smapx" || op == "smlg") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::SummaryLogic* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::SummaryLogic::class_tag())) continue;
      p = static_cast<lfw::ui::SummaryLogic*>(c);
      break;
    }
    if (p == nullptr) {
      push(op + "|" + nid + "|none");
      return true;
    }
    if (op == "smapx") {
      if (!w.entities.empty()) p->on_fighter_add(*w.entities[0]);
      push("smapx|" + nid + "|fighters=" +
           num(static_cast<double>(p->fighters.size())) + "|players=" +
           num(static_cast<double>(p->players.size())) + "|en=" +
           num(static_cast<double>(w.entities.size())) + "|gh=" +
           num(static_cast<double>(w.ghosts.size())) + "|em=" +
           num(static_cast<double>(w.entity_map.size())));
      return true;
    }
    push("smlg|" + nid + "|teams=" + num(static_cast<double>(p->teams.size())) + "|fighters=" +
         num(static_cast<double>(p->fighters.size())) + "|players=" +
         num(static_cast<double>(p->players.size())) + "|losing=" +
         num(static_cast<double>(p->losing_teams.size())) + "|cbm=" +
         num(static_cast<double>(p->cb_map_count())));
    for (const std::pair<std::u16string, lfw::ui::TeamSumInfo>& kv : p->teams) {
      const lfw::ui::TeamSumInfo& s = kv.second;
      push("sm|" + to_ascii(kv.first) + "|t=" + to_ascii(s.team) + "|" + num(s.wins) + "|" +
           num(s.loses) + "|" + num(s.lives) + "|" + num(s.deads) + "|" + num(s.spawns) +
           "|" + num(s.kills) + "|" + num(s.damages) + "|" + num(s.hp_lost) + "|" +
           num(s.mp_usage) + "|" + num(s.pickings) + "|" + num(s.hp) + "|" +
           num(s.reserve) + "|latest=" + num(s.latest_dead_time) + "|losing=" +
           (p->is_losing(kv.first) ? "1" : "0"));
    }
    for (const std::pair<std::u16string, lfw::ui::FighterSumInfo>& kv : p->fighters) {
      const lfw::ui::FighterSumInfo& s = kv.second;
      push("smf|" + to_ascii(kv.first) + "|t=" + to_ascii(s.team) + "|" + num(s.spawns) + "|" +
           num(s.deads) + "|" + num(s.kills) + "|" + num(s.damages) + "|" + num(s.hp_lost) +
           "|" + num(s.mp_usage) + "|" + num(s.pickings));
    }
    for (const std::pair<std::u16string, lfw::ui::PlayerSumInfo>& kv : p->players) {
      const lfw::ui::PlayerSumInfo& s = kv.second;
      push("smp|" + to_ascii(kv.first) + "|t=" + to_ascii(s.team) + "|pid=" + to_ascii(s.player_id) +
           "|" + num(s.spawns) + "|" + num(s.deads) + "|" + num(s.kills) + "|" +
           num(s.damages) + "|" + num(s.hp_lost) + "|" + num(s.mp_usage) + "|" +
           num(s.pickings));
    }
    return true;
  }
  if (op == "sumt") {
    const std::string nid = t[i++];
    const std::u16string team = key_of(t[i++]);
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::SummaryLogic* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::SummaryLogic::class_tag())) continue;
      p = static_cast<lfw::ui::SummaryLogic*>(c);
      break;
    }
    if (p != nullptr) p->team_sum(team);
    push("sumt|" + nid + "|" + to_ascii(team) + "|n=" +
         num(p != nullptr ? static_cast<double>(p->teams.size()) : -1.0));
    return true;
  }
  if (op == "wdt") {
    const double dt = to_double(t[i++]);
    const double n = to_double(t[i++]);
    for (double k = 0; k < n; ++k) w.update_once(dt);
    push("wdt|" + num(dt) + "|" + num(n) + "|lt=" + num(w.lifetime()));
    return true;
  }
  if (op == "edef") {
    const double idx = to_double(t[i++]);
    const std::u16string f = key_of(t[i++]);
    const double v = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    if (e != nullptr) {
      if (f == u"defend_value") e->set_defend_value(v);
      else if (f == u"defend_value_max") e->set_defend_value_max(v);
      else if (f == u"fall_value") e->set_fall_value(v);
      else if (f == u"fall_value_max") e->set_fall_value_max(v);
      else if (f == u"toughness") e->set_toughness(v);
      else if (f == u"toughness_max") e->set_toughness_max(v);
      else if (f == u"hp_r") e->set_hp_r(v);
    }
    push("edef|" + num(idx) + "|" + to_ascii(f) + "|" + (e != nullptr ? "1" : "0") + "|dv=" +
         num(e != nullptr ? e->defend_value() : 0) + "|dvm=" +
         num(e != nullptr ? e->defend_value_max() : 0) + "|fv=" +
         num(e != nullptr ? e->fall_value() : 0) + "|fvm=" +
         num(e != nullptr ? e->fall_value_max() : 0) + "|tv=" +
         num(e != nullptr ? e->toughness() : 0) + "|tvm=" +
         num(e != nullptr ? e->toughness_max() : 0) + "|hpr=" +
         num(e != nullptr ? e->hp_r() : 0));
    return true;
  }
  if (op == "eprobe") {
    const double idx = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    push("eprobe|" + num(idx) + "|e=" +
         (e != nullptr ? to_ascii(e->id) : std::string("-")) + "|life=" +
         num(e != nullptr ? e->lifetime() : 0) + "|marks=" +
         num(e != nullptr ? static_cast<double>(e->marks.size()) : 0) + "|heal=" +
         (e != nullptr && e->marks.count(u"Healing") > 0 ? "1" : "0") + "|mpheal=" +
         (e != nullptr && e->marks.count(u"MpHealing") > 0 ? "1" : "0"));
    return true;
  }
  if (op == "wtime") {
    push("wtime|gt=" + num(w.game_time()) + "|lt=" + num(w.lifetime()));
    return true;
  }
  if (op == "elist") {
    for (size_t k = 0; k < w.entities.size(); ++k) {
      lfw::Entity* const e = w.entities[k];
      push("el|" + num(static_cast<double>(k)) + "|e=" + (e != nullptr ? to_ascii(e->id) : "-") +
           "|t=" + (e != nullptr ? to_ascii(e->team()) : "-") + "|hp=" +
           num(e != nullptr ? e->hp() : 0));
    }
    return true;
  }
  if (op == "fdbg") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::FighterStatBar* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::FighterStatBar::class_tag())) continue;
      p = static_cast<lfw::ui::FighterStatBar*>(c);
      break;
    }
    std::string ent_id = "-";
    std::string ent_probe = "-";
    if (p != nullptr && p->entity != nullptr) {
      ent_id = to_ascii(p->entity->id);
      ent_probe = num(p->entity->lifetime()) + "/" +
                  num(static_cast<double>(p->entity->marks.size())) + "/" +
                  (p->entity->marks.count(u"Healing") > 0 ? "1" : "0") + "/" +
                  (p->entity->marks.count(u"MpHealing") > 0 ? "1" : "0");
    }
    push("fdbg|" + nid + "|n=" + num(static_cast<double>(n.components().size())) + "|fl=" +
         (p != nullptr ? (p->hp_flashing ? "1" : "0") : "-") + "|dead=" +
         (p != nullptr ? (p->dead ? "1" : "0") : "-") + "|mp=" +
         (p != nullptr ? (p->mp_healing ? "1" : "0") : "-") + "|tc=" +
         num(p != nullptr ? p->dbg_tier_colors() : -1.0) +
         "|life=" + ent_probe + "|e=" + ent_id);
    return true;
  }
  if (op == "smk") {
    const std::u16string team = key_of(t[i++]);
    push("smk|" + to_ascii(lfw::ui::make_sum_info(team).team));
    return true;
  }
  if (op == "sbctrl") {
    const double idx = to_double(t[i++]);
    const std::u16string pid = key_of(t[i++]);
    const std::string mode = i < t.size() ? t[i++] : std::string();
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    lfw::PlayerInfo* const p = lfw.player(pid);
    lfw::controller::BaseController* c = nullptr;
    if (e != nullptr) {
      if (mode == "human") {
        c = lfw.factory.acquire_ctrl(lfw::controller::local_controller_creator(), pid, e);
        if (c != nullptr) {
          // 台面替身：TS 的 `LocalController` 在构造里 `this.player = lfw.player(id)`（缺省名 = id）
          lfw::Object pv;
          pv.set(u"id", lfw::Value(pid));
          pv.set(u"name", lfw::Value(pid));
          c->player = lfw::Value(std::make_shared<lfw::Object>(pv));
        }
      } else {
        c = lfw.factory.create_ctrl(lfw::field_or(e->data(), u"id"), pid, e);
      }
      if (c != nullptr) e->set_ctrl(c);
    }
    push("sbctrl|" + num(idx) + "|" + (e != nullptr ? "1" : "0") + "|p=" +
         (p != nullptr ? "1" : "0") + "|bot=" + (c != nullptr && c->is_bot() ? "1" : "0") +
         "|pid=" + (c != nullptr ? to_ascii(c->player_id) : std::string("-")));
    return true;
  }
  if (op == "cprb") {
    const std::string nid = t[i++];
    const std::u16string cid = key_of(t[i++]);
    const std::u16string prop = key_of(t[i++]);
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::UIComponent* c = nullptr;
    for (lfw::ui::UIComponent* const v : n.components()) {
      if (v->id == cid) {
        c = v;
        break;
      }
    }
    bool ok = false;
    std::string hit = "u";
    std::string errs;
    if (c != nullptr) {
      ok = c->ensure_props();
      lfw::ui::UINode* const nh = lfw::ui::ref_to_node(c->props_holder.prop_instance(prop));
      hit = nh != nullptr ? to_ascii(render_value(nh->id())) : "u";
      for (const std::u16string& e : c->props_errors()) {
        if (!errs.empty()) errs += ";";
        errs += to_ascii(e);
      }
    }
    push("cprb|" + nid + "|" + (c != nullptr ? "1" : "0") + "|ok=" + (ok ? "1" : "0") +
         "|n=" + hit + "|errs=" + errs);
    return true;
  }
  if (op == "fsbe") {
    const std::string nid = t[i++];
    const std::u16string cid = key_of(t[i++]);
    const double idx = to_double(t[i++]);
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::FighterStatBar* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (c->id != cid) continue;
      if (!lfw::is_class(c->clazz(), lfw::ui::FighterStatBar::class_tag())) continue;
      p = static_cast<lfw::ui::FighterStatBar*>(c);
      break;
    }
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    if (p != nullptr) p->set_entity(e);
    push("fsbe|" + nid + "|" + (p != nullptr ? "1" : "0") + "|e=" + (e != nullptr ? "1" : "0"));
    return true;
  }
  if (op == "ps") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::PlayerScore* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::PlayerScore::class_tag())) continue;
      p = static_cast<lfw::ui::PlayerScore*>(c);
      break;
    }
    if (p == nullptr) {
      push("ps|" + nid + "|none");
      return true;
    }
    const std::optional<bool> l = p->lose();
    lfw::Entity* const f = p->fighter();
    push("ps|" + nid + "|idx=" + num(p->index()) + "|lose=" +
         (l.has_value() ? (*l ? "1" : "0") : "-") + "|f=" +
         (f != nullptr ? to_ascii(f->id) : std::string("-")) + "|vis=" +
         (n.visible() ? "1" : "0"));
    return true;
  }
  if (op == "eteam" || op == "emark" || op == "edmark") {
    const double idx = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < w.entities.size()
                               ? w.entities[static_cast<size_t>(idx)]
                               : nullptr;
    if (op == "eteam") {
      const std::u16string team = key_of(t[i++]);
      if (e != nullptr) e->set_team(team);
      push("eteam|" + num(idx) + "|" + (e != nullptr ? to_ascii(e->team()) : std::string("-")));
    } else {
      const std::u16string key = key_of(t[i++]);
      const std::u16string val = key_of(t[i++]);
      if (e != nullptr) {
        if (op == "emark") e->set_mark(key, val, std::nullopt);
        else e->del_mark(key, std::optional<lfw::Value>(lfw::Value(val)));
      }
      push(op + "|" + num(idx) + "|" +
           num(e != nullptr ? static_cast<double>(e->marks.size()) : 0.0));
    }
    return true;
  }
  return false;
}

std::map<std::string, std::vector<std::unique_ptr<lfw::ui::UIComponent>>> g_real_comps;

// 4BQ：层页面节点（非 g_nodes 所有权）的台面别名（`npg`）。
std::map<std::string, lfw::ui::UINode*> g_alias_nodes;

lfw::ui::UINode& pick_node(const std::string& nid) {
  const auto it = g_alias_nodes.find(nid);
  if (it != g_alias_nodes.end() && it->second != nullptr) return *it->second;
  return *g_nodes.at(nid);
}

// 4D2：`cmd`（真命令分发）与三个只读探针 —— 单开一函数，免得主 else-if 链块嵌套再超 MSVC 的
// C1061 上限（照 `run_sum_ops` 的先例）。
bool run_cmd_ops(lfw::LFW& lfw, FakeHost& host, const std::vector<std::string>& t, size_t& i,
                 const std::string& op) {
  (void)host;
  if (op == "cmd") {
    // 经真命令分发器跑一条命令（`POINTER_*` / `KEY_EVENT` / `F4` …）：分发器把 `world.lfw()`
    // 当真 `LFW` 用，所以这里的层栈 / 挂载键 / 傀儡表就是命令真正看得见的那些。
    const lfw::Value cmd_value = parse_value(t, i);
    const std::u16string* const cmd_text = std::get_if<std::u16string>(&cmd_value);
    std::vector<std::u16string> cmds;
    cmds.push_back(cmd_text != nullptr ? *cmd_text : std::u16string());
    lfw::cmds::CMDS::handle(lfw.world(), cmds);
    return true;
  }
  if (op == "flpage") {
    // 把 `lfw.ui_layers()`（命令真正作用的那一栈）的页面/子节点别名进 `g_alias_nodes`
    //（`npg` 只认台面私建的 `g_real_layers`）：`<别名> <层号> <页下标|-1=栈顶> [子下标…]`。
    const std::string nid = t[i++];
    const double li = to_double(t[i++]);
    const double pi = to_double(t[i++]);
    lfw::ui::UILayer* const l = lfw.ui_layers() != nullptr ? lfw.ui_layers()->at(li) : nullptr;
    lfw::ui::UINode* node = l != nullptr ? (pi < 0.0 ? l->ui() : l->at(pi)) : nullptr;
    while (node != nullptr && i < t.size()) {
      const size_t idx = static_cast<size_t>(to_double(t[i++]));
      node = idx < node->children().size() ? node->children()[idx] : nullptr;
    }
    g_alias_nodes[nid] = node;
    push("flpage|" + nid + "|" + (node != nullptr ? "1" : "0") + "|" +
         num(l != nullptr ? static_cast<double>(l->pages().size()) : 0.0));
    return true;
  }
  if (op == "ptcur") {
    const std::string tok = t[i++];
    const std::u16string from = tok == "-" ? std::u16string() : key_of(tok);
    std::unordered_map<std::u16string, lfw::cmds::IPointerCursor>* const cursors =
        lfw::cmds::get_pointer_cursors(lfw.world());
    if (cursors == nullptr) {
      push("ptcur|u");
    } else if (cursors->find(from) == cursors->end()) {
      push("ptcur|" + to_ascii(from) + "|none");
    } else {
      const lfw::cmds::IPointerCursor& c = (*cursors)[from];
      push("ptcur|" + to_ascii(from) + "|" + num(c.x) + "|" + num(c.y) + "|" +
           (c.down ? "1" : "0") + "|" + (c.hidden ? "1" : "0"));
    }
    return true;
  }
  if (op == "kkey") {
    // 已挂载 `Keys` 里某个游戏键的 `KeyStatus`（`KEY_EVENT` 的 `hit`/`end` 落点）。
    const std::u16string key = key_of(t[i++]);
    std::string line = "kkey|" + to_ascii(key);
    for (lfw::Keys* const ks : lfw.mounted_keys) {
      lfw::controller::KeyStatus* const st = ks->get(key);
      if (st == nullptr) {
        line += "|u";
        continue;
      }
      line += "|" + num(st->time()) + "|" + num(st->u_time()) + "|" + num(st->used());
    }
    push(line);
    return true;
  }
  if (op == "ctrlq") {
    // `world.puppets` 里该玩家实体的控制器队列（`KEY_EVENT` 落 `start`/`end` 的地方）。
    const std::u16string pid = key_of(t[i++]);
    lfw::Entity* e = nullptr;
    for (const std::pair<std::u16string, lfw::Entity*>& kv : lfw.world().puppets) {
      if (kv.first == pid) {
        e = kv.second;
        break;
      }
    }
    // 只打 `KEY_EVENT` 真正用来放行的那个判定（`is_human_ctrl(ctrl_view)`）：端口侧「没控制器」
    // 是个 InvalidController 对象、TS 侧是 undefined，直接比对象存在性会不同构。
    const bool human = e != nullptr && lfw::entity::is_human_ctrl(e->ctrl_view());
    lfw::controller::BaseController* const c = e != nullptr ? e->ctrl() : nullptr;
    std::string line = "ctrlq|" + to_ascii(pid) + "|" + (human ? "h" : "b");
    if (human && c != nullptr) {
      line += "|" + std::to_string(c->queue.size());
      for (const std::pair<lfw::controller::Status, std::u16string>& q : c->queue) {
        line += "|" + num(static_cast<double>(q.first)) + ":" + to_ascii(q.second);
      }
    }
    push(line);
    return true;
  }
  return false;
}

bool run_comp_ops(lfw::LFW& lfw, FakeHost& host, const std::vector<std::string>& t, size_t& i,
                  const std::string& op) {
  if (op == "ncomp") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    const lfw::Value item = parse_value(t, i);
    auto arr = std::make_shared<lfw::Array>();
    arr->push_back(item);
    std::vector<std::unique_ptr<lfw::ui::UIComponent>> comps =
        lfw.factory.create_components(n, lfw::Value(arr));
    for (std::unique_ptr<lfw::ui::UIComponent>& c : comps) {
      n.add_components(*c);
      g_real_comps[nid].push_back(std::move(c));
    }
    push("ncomp|" + nid + "|" + std::to_string(n.components().size()));
  } else if (op == "cheat") {
    // 4BS：直接置 dataset + 发 `on_cheat_changed`（`setcheat` 走 push_cmd 队，台面不消费）。
    const std::u16string name = key_of(t[i++]);
    const bool on = t[i++] == "1";
    lfw.world().dataset.set(name, lfw::Value(on));
    lfw.cheat_changed(name, on);
    push("cheat|" + to_ascii(name) + "|" + (on ? "1" : "0"));
  } else if (op == "cmdbg") {
    const std::string nid = t[i++];
    lfw::ui::UINode& node = pick_node(nid);
    lfw::ui::CharMenuLogic* cm = nullptr;
    for (lfw::ui::UIComponent* const c : node.components()) {
      if (lfw::is_class(c->clazz(), lfw::ui::CharMenuLogic::class_tag())) {
        cm = static_cast<lfw::ui::CharMenuLogic*>(c);
        break;
      }
    }
    if (cm == nullptr) {
      push("cmdbg|" + nid + "|none");
    } else {
      const std::optional<std::pair<lfw::PlayerInfo*, lfw::ui::SlotState*>> lp = cm->last_player();
      const std::optional<std::pair<lfw::PlayerInfo*, lfw::ui::SlotState*>> lc = cm->last_com();
      std::string line = "cmdbg|" + nid;
      line += "|n=" + std::to_string(cm->players.size());
      line += "|last=" + (lp.has_value() ? to_ascii(lp->first->id()) : std::string("-"));
      line += "|lastic=" + (lp.has_value() ? (lp->first->is_com() ? "1" : "0") : std::string("-"));
      line += "|lc=" + (lc.has_value() ? to_ascii(lc->first->id()) : std::string("-"));
      push(line);
    }
  } else if (op == "dgrp") {
    const std::u16string g = key_of(t[i++]);
    std::string line = "dgrp|" + to_ascii(g);
    for (const lfw::Value& v : lfw.datas().get_fighters_of_group(g)) {
      line += "|" + to_ascii(lfw::to_string(field_or(v, u"id")));
    }
    push(line);
  } else if (op == "ptev") {
    const std::string what = t[i++];
    const double btn = to_double(t[i++]);
    const double x = to_double(t[i++]);
    const double y = to_double(t[i++]);
    const double sx = to_double(t[i++]);
    const double sy = to_double(t[i++]);
    lfw::LfwPointingEvent e;
    e.button = btn;
    e.x = x;
    e.y = y;
    e.scene_x = sx;
    e.scene_y = sy;
    host.dispatch_pointing(what, e);
    push("ptev|" + what + "|" + num(btn) + "|" + num(x) + "|" + num(y) + "|" + num(sx) +
         "|" + num(sy));
  } else if (op == "wtick") {
    // 推进 `world.lifetime`（暂停下 `step` 只做无害段；台面需要非零时间戳喂 `is_start`）。
    const double n = to_double(t[i++]);
    lfw.world().set_paused_value(1.0);
    for (double k = 0; k < n; ++k) lfw.world().update_once(16.0);
    lfw.world().set_paused_value(0.0);
    push("wtick|" + num(n) + "|lt=" + num(lfw.world().lifetime()));
  } else if (op == "stgfin") {
    // 4BV：直发舞台完成事件（`Stage` 的 Completed 态 enter 同款）。
    lfw::stage::Stage* const st = lfw.world().stage();
    if (st != nullptr) {
      st->callbacks().call(u"on_stage_finish",
                           {lfw::stage::StageCallbackArgs{st, lfw::Value(), lfw::Value()}});
    }
    push("stgfin|" + std::string(st != nullptr ? "1" : "0"));
  } else if (op == "mttimes") {
    push("mttimes|" + num(static_cast<double>(lfw.mt()->times())));
  } else if (op == "kstat") {
    // 逐个驱动所有已挂载的按键状态（= TS `CMD_KEY_EVENT` 对 `mounted_keys` 做的事）。
    const std::u16string key = key_of(t[i++]);
    const std::string what = t[i++];
    std::optional<double> tm;
    if (i < t.size() && t[i] != "-") tm = to_double(t[i++]);
    else if (i < t.size()) ++i;
    size_t cnt = 0;
    double ret = 0.0;
    for (lfw::Keys* const ks : lfw.mounted_keys) {
      lfw::controller::KeyStatus* const st = ks->get(key);
      if (st == nullptr) continue;
      ++cnt;
      if (what == "hit") st->hit(tm.has_value() ? lfw::Value(*tm) : lfw::Value(), ks->time());
      else if (what == "end") st->end(ks->time());
      else if (what == "use") ret = st->use();
      else st->reset();
    }
    push("kstat|" + to_ascii(key) + "|" + what + "|cnt=" + std::to_string(cnt) +
         (what == "use" ? "|ret=" + num(ret) : ""));
  } else if (op == "shd" || op == "shv" || op == "shcb" || op == "semit") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::SliderHandle* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::SliderHandle::class_tag())) continue;
      p = static_cast<lfw::ui::SliderHandle*>(c);
      break;
    }
    if (p == nullptr) {
      push(op + "|" + nid + "|none");
    } else if (op == "shd") {
      push("shd|" + nid + "|" + num(p->value()) + "|" + num(p->factor()) + "|" +
           to_ascii(p->mode()));
    } else if (op == "shv") {
      const double v = to_double(t[i++]);
      p->set_value(v);
      push("shv|" + nid + "|" + num(p->value()) + "|" + num(p->factor()));
    } else if (op == "semit") {
      // 4BR：以当前值触发一次 `on_value_changed`（等价用户改值；handler 为主目标）。
      p->callbacks.call(u"on_value_changed", {lfw::ui::SliderHandleCallbackArgs{p->value(), p}});
      push("semit|" + nid + "|" + num(p->value()) + "|" + num(p->factor()));
    } else {
      lfw::ui::SliderHandle* const self = p;
      p->on_value_changed([self](double v, lfw::ui::SliderHandle& s) {
        push("shcb|" + num(v) + "|" + (&s == self ? "1" : "0"));
      });
      push("shcb|" + nid + "|bound");
    }
  } else if (op == "asw" || op == "asv" || op == "ascb" || op == "aemit") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::ArrowSwitcher* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::ArrowSwitcher::class_tag())) continue;
      p = static_cast<lfw::ui::ArrowSwitcher*>(c);
      break;
    }
    if (p == nullptr) {
      push(op + "|" + nid + "|none");
    } else if (op == "asw") {
      push("asw|" + nid + "|" + num(p->value()) + "|" + num(p->count()));
    } else if (op == "asv") {
      const double v = to_double(t[i++]);
      p->set_value(v);
      push("asv|" + nid + "|" + num(p->value()));
    } else if (op == "aemit") {
      p->callbacks.call(u"on_value_changed", {lfw::ui::ArrowSwitcherCallbackArgs{p->value(), p}});
      push("aemit|" + nid + "|" + num(p->value()));
    } else {
      lfw::ui::ArrowSwitcher* const self = p;
      p->on_value_changed([self](double v, lfw::ui::ArrowSwitcher& s) {
        push("ascb|" + num(v) + "|" + (&s == self ? "1" : "0"));
      });
      push("ascb|" + nid + "|bound");
    }
  } else if (op == "ptdn") {
    // 平台口径的 down：先抬世代（grab_begin），再走节点级回调（组件在其中的 grab 于本世代生效），
    // 最后分发 pointings（不再抬世代）——用于观察"子控件已抢占手势"的分支。
    const std::string nid = t[i++];
    const double btn = to_double(t[i++]);
    const double x = to_double(t[i++]);
    const double y = to_double(t[i++]);
    const double sx = to_double(t[i++]);
    const double sy = to_double(t[i++]);
    lfw::LfwPointingEvent e;
    e.button = btn;
    e.x = x;
    e.y = y;
    e.scene_x = sx;
    e.scene_y = sy;
    host.grab_begin();
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::LFWPointerEvent ne(lfw::Vector3(0, 0, 0), 0.0);
    n.on_pointer_down(ne);
    host.dispatch_pointing("down", e, false);
    push("ptdn|" + nid + "|" + num(btn) + "|" + num(x) + "|" + num(y) + "|" + num(sx) +
         "|" + num(sy));
  } else if (op == "ptw") {
    // 滚轮事件（`delta_x/delta_y` 已换算为 UI 像素）——按真实平台口径直接分发给回调表。
    const double x = to_double(t[i++]);
    const double y = to_double(t[i++]);
    const double sx = to_double(t[i++]);
    const double sy = to_double(t[i++]);
    const double dx = to_double(t[i++]);
    const double dy = to_double(t[i++]);
    lfw::LfwPointingEvent e;
    e.x = x;
    e.y = y;
    e.scene_x = sx;
    e.scene_y = sy;
    e.delta_x = dx;
    e.delta_y = dy;
    host.dispatch_pointing("wheel", e);
    push("ptw|" + num(x) + "|" + num(y) + "|" + num(sx) + "|" + num(sy) + "|" + num(dx) +
         "|" + num(dy));
  } else if (op == "ptg") {
    // `this.pointings.grabbing`（世代口径见 FakeHost）。
    push(std::string("ptg|") + (lfw.pointings_grabbing() != nullptr ? "1" : "0"));
  } else if (op == "svgeo") {
    // 节点几何读数（视口命中判定用）。
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    const lfw::ui::UINode::Geo& g = n.geo();
    push("svgeo|" + nid + "|" + num(g.left) + "|" + num(g.top) + "|" + num(g.right) +
         "|" + num(g.bottom));
  } else if (op == "svsb") {
    // 滚动条解析探针：`sb=`（SliderHandle 的组件 id）/`th=`（thumb 节点）。
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::ScrollView* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::ScrollView::class_tag())) continue;
      p = static_cast<lfw::ui::ScrollView*>(c);
      break;
    }
    if (p == nullptr) {
      push("svsb|" + nid + "|none");
    } else {
      lfw::ui::SliderHandle* const sb = p->scrollbar();
      lfw::ui::UINode* const thumb = p->scrollbar_thumb();
      const std::optional<std::u16string> raw = p->props_holder.str(u"scrollbar");
      push("svsb|" + nid + "|sb=" + (sb != nullptr ? to_ascii(sb->id) : "-") + "|th=" +
           (thumb != nullptr ? node_ref(thumb) : "-") + "|raw=" +
           (raw.has_value() ? to_ascii(*raw) : "-"));
    }
  } else if (op == "svd" || op == "svto" || op == "svby" || op == "svst" || op == "sven" ||
             op == "svev" || op == "svcb" || op == "svcont") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::ScrollView* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::ScrollView::class_tag())) continue;
      p = static_cast<lfw::ui::ScrollView*>(c);
      break;
    }
    if (p == nullptr) {
      push(op + "|" + nid + "|none");
    } else if (op == "svd") {
      push("svd|" + nid + "|" + num(p->offset()) + "|" + num(p->factor()) + "|" +
           num(p->max_scroll()) + "|" + (p->dragging() ? "1" : "0") + "|" +
           (n.clip_children() ? "1" : "0") + "|" + num(p->target_offset()));
    } else if (op == "svto") {
      p->scroll_to(to_double(t[i++]));
      push("svto|" + nid + "|" + num(p->offset()));
    } else if (op == "svby") {
      p->scroll_by(to_double(t[i++]));
      push("svby|" + nid + "|" + num(p->offset()));
    } else if (op == "svst") {
      p->scroll_to_start();
      push("svst|" + nid + "|" + num(p->offset()));
    } else if (op == "sven") {
      p->scroll_to_end();
      push("sven|" + nid + "|" + num(p->offset()));
    } else if (op == "svev") {
      const std::string target = t[i++];
      const bool ret = p->ensure_visible(g_nodes.at(target).get());
      push("svev|" + nid + "|" + (ret ? "1" : "0") + "|" + num(p->offset()));
    } else if (op == "svcb") {
      lfw::ui::ScrollView* const self = p;
      p->callbacks.on(u"on_scroll",
                      [self](const lfw::ui::ScrollViewCallbacks::Payloads& ps) {
                        for (const lfw::ui::ScrollViewCallbackArgs& a : ps) {
                          if (a.self != nullptr) {
                            push("svcb|scroll|" + num(a.offset) + "|" + num(a.factor) + "|" +
                                 (a.self == self ? "1" : "0"));
                          }
                        }
                      });
      p->callbacks.on(u"on_scroll_start",
                      [self](const lfw::ui::ScrollViewCallbacks::Payloads& ps) {
                        for (const lfw::ui::ScrollViewCallbackArgs& a : ps) {
                          if (a.self != nullptr) {
                            push("svcb|start|" + num(a.offset) + "|" + num(a.factor) + "|" +
                                 (a.self == self ? "1" : "0"));
                          }
                        }
                      });
      p->callbacks.on(u"on_scroll_end",
                      [self](const lfw::ui::ScrollViewCallbacks::Payloads& ps) {
                        for (const lfw::ui::ScrollViewCallbackArgs& a : ps) {
                          if (a.self != nullptr) {
                            push("svcb|end|" + num(a.offset) + "|" + num(a.factor) + "|" +
                                 (a.self == self ? "1" : "0"));
                          }
                        }
                      });
      push("svcb|" + nid + "|bound");
    } else {
      const std::string target = t[i++];
      p->set_content(g_nodes.at(target).get());
      push("svcont|" + nid + "|" + target + "|" + num(p->offset()));
    }
  } else if (op == "wpause") {
      const double v = to_double(t[i++]);
      lfw.world().set_paused_value(v);
      push("wpause|" + num(v) + "|" + (lfw.world().paused() ? "1" : "0"));
    } else if (op == "setbgms") {
      const lfw::Value list = parse_value(t, i);
      lfw.bgms.clear();
      const lfw::Array* const arr = lfw::as_array(list);
      const size_t n = arr != nullptr ? arr->size() : 0;
      for (size_t j = 0; j < n; ++j) lfw.bgms.push_back(lfw::to_string(arr->at(j)));
      std::string names;
      for (size_t j = 0; j < lfw.bgms.size(); ++j) {
        if (j != 0) names += ",";
        names += to_ascii(lfw.bgms[j]);
      }
      push("setbgms|" + names);
    } else if (op == "sndbgm") {
      push("sndbgm|" + host.snd_probe());
    } else if (op == "gfa" || op == "gfu" || op == "gfuse" || op == "gfr") {
      const std::string nid = t[i++];
      const std::string cid = t[i++];
      bench::FakeComp& c = *g_components.at(cid);
      if (op == "gfa") {
        c.fsm_states.clear();
        c.fsm_states.push_back(std::make_unique<lfw::ui::GameModeFSMState_Running>(c));
        c.fsm_states.push_back(std::make_unique<lfw::ui::GameModeFSMState_BeforeEnd>(c));
        c.fsm_states.push_back(std::make_unique<lfw::ui::GameModeFSMState_End>(c));
        c.fsm_storage.add(c.fsm_states[0].get(), c.fsm_states[1].get(), c.fsm_states[2].get());
        push("gfa|" + nid + "|" + cid);
      } else if (op == "gfu") {
        const double dt = to_double(t[i++]);
        c.fsm_storage.update(dt);
        push("gfu|" + nid + "|" + cid + "|" + num(dt));
      } else if (op == "gfuse") {
        const std::u16string key = key_of(t[i++]);
        c.fsm_storage.use(lfw::Value(key));
        push("gfuse|" + nid + "|" + cid + "|" + to_ascii(key));
      } else {
        lfw::IState* const s = c.fsm_storage.state();
        lfw::IState* const p = c.fsm_storage.prev_state();
        push("gfr|" + nid + "|" + cid + "|state=" +
             to_ascii(render_value(s != nullptr ? s->key() : lfw::Value())) + "|prev=" +
             to_ascii(render_value(p != nullptr ? p->key() : lfw::Value())) + "|st=" +
             num(c.fsm_storage.state_time()) + "|t=" + num(c.fsm_storage.time()));
      }
    } else if (op == "cplay") {
      const std::string nid = t[i++];
      const std::string cls = t[i++];
      const std::string act = t[i++];
      const bool rev = t[i++] == "1";
      lfw::ui::UINode& n = *g_nodes.at(nid);
      const std::u16string cls16 = to_u16(cls);
      lfw::ui::UIComponent* comp = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        const lfw::ClazzTag* const t = c->clazz();
        const bool hit =
            (cls16 == u"OpacityAnimation" && t == lfw::ui::OpacityAnimation::class_tag()) ||
            (cls16 == u"OpacityFlash" && t == lfw::ui::OpacityFlash::class_tag()) ||
            (cls16 == u"FadeOutOpacity" && t == lfw::ui::FadeOutOpacity::class_tag()) ||
            (cls16 == u"ScaleAnimation" && t == lfw::ui::ScaleAnimation::class_tag()) ||
            (cls16 == u"PositionAnimation" && t == lfw::ui::PositionAnimation::class_tag());
        if (hit) {
          comp = c;
          break;
        }
      }
      if (comp != nullptr) {
        if (cls == "OpacityAnimation") {
          lfw::ui::OpacityAnimation* const a = static_cast<lfw::ui::OpacityAnimation*>(comp);
          if (act == "start") a->start(rev);
          else if (act == "stop") a->stop(rev);
        } else if (cls == "OpacityFlash") {
          lfw::ui::OpacityFlash* const a = static_cast<lfw::ui::OpacityFlash*>(comp);
          if (act == "start") a->start();
          else if (act == "stop") a->stop();
          else if (act == "replay") a->replay();
        } else if (cls == "FadeOutOpacity") {
          if (act == "start") static_cast<lfw::ui::FadeOutOpacity*>(comp)->start(rev);
        } else if (cls == "ScaleAnimation") {
          if (act == "start") static_cast<lfw::ui::ScaleAnimation*>(comp)->start(rev);
        } else if (cls == "PositionAnimation") {
          if (act == "start") static_cast<lfw::ui::PositionAnimation*>(comp)->start(rev);
        }
      }
      push("cplay|" + nid + "|" + cls + "|" + act + "|" +
           (comp != nullptr ? "ok" : "none") + "|" +
           (comp != nullptr && comp->enabled() ? "b1" : "b0"));
    } else if (op == "calign") {
      const std::string nid = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::FlexItem* f = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (c->clazz() == lfw::ui::FlexItem::class_tag()) {
          f = static_cast<lfw::ui::FlexItem*>(c);
          break;
        }
      }
      if (f == nullptr) {
        push("calign|" + nid + "|none");
      } else {
        std::string out = "err";
        if (f->ensure_props()) {
          const std::optional<std::u16string> a = f->align();
          out = a.has_value() ? to_ascii(*a) : "null";
        }
        push("calign|" + nid + "|" + out + "|" +
             num(static_cast<double>(f->props_errors().size())));
      }
    } else if (op == "pic") {
      const std::string nid = t[i++];
      const std::string act = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::Picture* pic = nullptr;
      lfw::ui::ImgLoop* loop = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (c->clazz() == lfw::ui::Picture::class_tag()) pic = static_cast<lfw::ui::Picture*>(c);
        else if (c->clazz() == lfw::ui::ImgLoop::class_tag()) loop = static_cast<lfw::ui::ImgLoop*>(c);
      }
      if (act == "src" && pic != nullptr) {
        pic->set_src(to_u16(t[i++]));
        push("pic|" + nid + "|src|" + to_ascii(pic->src()));
      } else if (act == "rd" && pic != nullptr) {
        push("pic|" + nid + "|rd|" + num(pic->width()) + "|" + num(pic->height()) +
             "|" + to_ascii(pic->src()));
      } else if (act == "setw" && pic != nullptr) {
        pic->set_width(to_double(t[i++]));
        push("pic|" + nid + "|setw|" + num(pic->width()));
      } else if (act == "seth" && pic != nullptr) {
        pic->set_height(to_double(t[i++]));
        push("pic|" + nid + "|seth|" + num(pic->height()));
      } else if (act == "setimg" && (pic != nullptr || loop != nullptr)) {
        const lfw::Value raw = parse_value(t, i);
        auto out = std::make_shared<lfw::Object>();
        out->set(u"key", lfw::Value(u""));
        out->set(u"url", lfw::Value(u""));
        out->set(u"src", lfw::Value(u""));
        out->set(u"src_url", lfw::Value(u""));
        out->set(u"scale", lfw::Value(0.0));
        out->set(u"w", lfw::Value(0.0));
        out->set(u"h", lfw::Value(0.0));
        out->set(u"min_filter", lfw::Value());
        out->set(u"mag_filter", lfw::Value());
        out->set(u"wrap_s", lfw::Value());
        out->set(u"wrap_t", lfw::Value());
        out->set(u"pic", lfw::Value());
        out->set(u"flip_x", lfw::Value());
        out->set(u"flip_y", lfw::Value());
        out->set(u"clip_x", lfw::Value());
        out->set(u"clip_y", lfw::Value());
        out->set(u"clip_w", lfw::Value());
        out->set(u"clip_h", lfw::Value());
        out->set(u"bitmap", lfw::Value());
        if (const lfw::Object* const src = lfw::as_object(raw)) {
          for (const std::u16string& k : src->keys()) {
            const lfw::Value* const v = src->get(k);
            if (v != nullptr) out->set(k, *v);
          }
        }
        n.set_image(lfw::Value(out));
        push("pic|" + nid + "|setimg|1");
      } else if (act == "istart" && loop != nullptr) {
        loop->start();
        push("pic|" + nid + "|istart|1");
      } else if (act == "istop" && loop != nullptr) {
        loop->stop();
        push("pic|" + nid + "|istop|1");
      } else {
        push("pic|" + nid + "|" + act + "|none");
      }
    } else if (op == "snew") {
      const std::string sid = t[i++];
      std::unique_ptr<lfw::SmoothNumber> s = std::make_unique<lfw::SmoothNumber>();
      s->handler([sid](lfw::SmoothNumber& self) {
        push("scb|" + sid + "|" + num(self.value()) + "|" + (self.done() ? "1" : "0"));
      });
      g_smooths[sid] = std::move(s);
    } else if (op == "srd") {
      const std::string sid = t[i++];
      lfw::SmoothNumber& s = *g_smooths.at(sid);
      push("srd|" + sid + "|" + num(s.value()) + "|" + num(s.target()) + "|" +
           (s.done() ? "1" : "0"));
    } else if (op == "svalue" || op == "starget" || op == "sspeed" || op == "sfactor" ||
               op == "smdiff") {
      const std::string sid = t[i++];
      const double v = to_double(t[i++]);
      lfw::SmoothNumber& s = *g_smooths.at(sid);
      if (op == "svalue") s.set_value(v);
      else if (op == "starget") s.set_target(v);
      else if (op == "sspeed") s.speed(v);
      else if (op == "sfactor") s.factor(v);
      else s.min_diff(v);
    } else if (op == "smode") {
      const std::string sid = t[i++];
      const std::string mode = t[i++];
      g_smooths.at(sid)->mode(mode);
    } else if (op == "supd") {
      g_smooths.at(t[i++])->update();
    } else if (op == "shandle") {
      g_smooths.at(t[i++])->handle();
    } else if (op == "reach") {
      const std::string nid = t[i++];
      const std::string act = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      if (act == "rd") {
        lfw::ui::Reachable* r = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->clazz() == lfw::ui::Reachable::class_tag()) {
            r = static_cast<lfw::ui::Reachable*>(c);
            break;
          }
        }
        if (r == nullptr) {
          push("reach|" + nid + "|none");
        } else {
          lfw::ui::ReachableGroup* const g = r->group();
          push("reach|" + nid + "|g|" + to_ascii(r->group_name()) + "|" +
               (g != nullptr ? node_ref(&g->node) : std::string("u")));
        }
      } else {
        lfw::ui::ReachableGroup* rg = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->clazz() == lfw::ui::ReachableGroup::class_tag()) {
            rg = static_cast<lfw::ui::ReachableGroup*>(c);
            break;
          }
        }
        if (rg == nullptr) {
          push("reach|" + nid + "|none");
        } else {
          std::string line = "reach|" + nid + "|rg|" + to_ascii(rg->group()) + "|" +
                             to_ascii(rg->direction()) + "|" +
                             node_ref(&rg->binded_layout()) + "|" +
                             std::to_string(rg->reachables().size());
          for (lfw::ui::Reachable* const r : rg->reachables()) line += "|" + node_ref(&r->node);
          push(line);
        }
      }
    } else if (op == "wfn") {
      lfw.world().set_fn_locked_value(to_double(t[i++]));
    } else if (op == "stime") {
      lfw.world().stage()->set_time(to_double(t[i++]));
    } else if (op == "wcb") {
      lfw::WorldCallbackArgs a;
      a.world = &lfw.world();
      lfw.world().callbacks.call(key_of(t[i++]), {a});
    } else if (op == "lcb") {
      lfw::LfwCallbackArgs a;
      a.lfw = &lfw;
      lfw.callbacks.call(key_of(t[i++]), {a});
    } else if (op == "wstage") {
      lfw.world().set_stage(std::make_unique<lfw::stage::Stage>(&lfw.world(), &lfw,
                                                               parse_value(t, i)));
    } else if (op == "sphase") {
      lfw.world().stage()->enter_phase(to_double(t[i++]));
    } else if (op == "sfield") {
      const std::u16string key = key_of(t[i++]);
      lfw::Object* const data = lfw::as_object(const_cast<lfw::Value&>(lfw.world().stage()->data()));
      if (data != nullptr) data->set(key, parse_value(t, i));
    } else if (op == "dialpush") {
      lfw.world().stage()->push_dialogs(parse_value(t, i));
    } else if (op == "dialnext") {
      lfw.world().stage()->next_dialog();
    } else if (op == "dialclear") {
      lfw.world().stage()->clear_dialogs();
    } else if (op == "stevt") {
      lfw::stage::StageCallbackArgs a;
      a.stage = lfw.world().stage();
      lfw.world().stage()->callbacks().call(key_of(t[i++]), {a});
    } else if (op == "pkeye") {
      const std::u16string pid = key_of(t[i++]);
      const std::u16string name = key_of(t[i++]);
      const std::u16string key = key_of(t[i++]);
      lfw::PlayerInfo* const p = lfw.player(pid);
      std::u16string err;
      const bool ok = p->set_key(lfw::Value(name), lfw::Value(key), true, err);
      push("pkeye|" + to_ascii(p->id()) + "|" + (ok ? "1" : "0"));
    } else if (op == "ctext") {
      const std::string nid = t[i++];
      const std::string act = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::TextInput* ti = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (!lfw::is_class(c->clazz(), lfw::ui::TextInput::class_tag())) continue;
        ti = static_cast<lfw::ui::TextInput*>(c);
        break;
      }
      if (ti == nullptr) {
        push("ctext|" + nid + "|none");
      } else {
        if (act == "set") ti->set_text(key_of(t[i++]));
        const std::optional<double> ml = ti->max_length();
        const std::optional<std::u16string> dv = ti->default_value();
        push("ctext|" + nid + "|" + to_ascii(render_value(lfw::Value(ti->text()))) + "|" +
             (ml.has_value() ? to_ascii(render_value(lfw::Value(*ml))) : std::string("z")) + "|" +
             (dv.has_value() ? to_ascii(render_value(lfw::Value(*dv))) : std::string("z")));
      }
    } else if (op == "pname") {
      const std::u16string pid = key_of(t[i++]);
      const std::u16string name = key_of(t[i++]);
      lfw::PlayerInfo* const p = lfw.player(pid);
      p->set_name(lfw::Value(name), true);
    } else if (op == "ccall") {
      const std::string nid = t[i++];
      const std::string cls_name = t[i++];
      const std::string method = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      const std::u16string want = to_u16(cls_name);
      lfw::ui::UIComponent* target = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        const std::u16string* const nm = lfw::ui::ui_class_name(c->clazz());
        if (nm != nullptr && *nm == want) {
          target = c;
          break;
        }
      }
      if (target == nullptr) {
        push("ccall|" + nid + "|" + cls_name + "|none");
      } else if (method == "quit") {
        if (lfw::is_class(target->clazz(), lfw::ui::PlayerName::class_tag())) {
          static_cast<lfw::ui::PlayerName*>(target)->quit();
        } else if (lfw::is_class(target->clazz(), lfw::ui::PlayerTeamName::class_tag())) {
          static_cast<lfw::ui::PlayerTeamName*>(target)->quit();
        } else if (lfw::is_class(target->clazz(), lfw::ui::FighterName::class_tag())) {
          static_cast<lfw::ui::FighterName*>(target)->quit();
        }
      } else {
        const std::u16string text = key_of(t[i++]);
        const bool com = t[i++] == "1";
        const bool decided = t[i++] == "1";
        if (lfw::is_class(target->clazz(), lfw::ui::PlayerName::class_tag())) {
          static_cast<lfw::ui::PlayerName*>(target)->join(text, com, decided);
        } else if (lfw::is_class(target->clazz(), lfw::ui::PlayerTeamName::class_tag())) {
          static_cast<lfw::ui::PlayerTeamName*>(target)->join(text, com, decided);
        } else if (lfw::is_class(target->clazz(), lfw::ui::FighterName::class_tag())) {
          static_cast<lfw::ui::FighterName*>(target)->join(text, com, decided);
        }
      }
  } else if (op == "algn") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::Alignment* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Alignment::class_tag())) continue;
      p = static_cast<lfw::ui::Alignment*>(c);
      break;
    }
    if (p == nullptr) {
      push("algn|" + nid + "|none");
    } else {
      const auto al = [](const std::optional<std::u16string>& v) {
        return to_ascii(render_value(v.has_value() ? lfw::Value(*v) : lfw::Value()));
      };
      bool has = false;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (c == p) has = true;
      }
      push("algn|" + nid + "|f=" + node_ref(p->follower) + "|l=" + node_ref(p->followed.l) +
           "|r=" + node_ref(p->followed.r) + "|t=" + node_ref(p->followed.t) +
           "|b=" + node_ref(p->followed.b) + "|al=" + al(p->align.l) +
           "|ar=" + al(p->align.r) + "|at=" + al(p->align.t) + "|ab=" + al(p->align.b) +
           "|ol=" + num(p->offset.l) + "|or=" + num(p->offset.r) + "|ot=" + num(p->offset.t) +
           "|ob=" + num(p->offset.b) + "|once=" + (p->once ? "1" : "0") +
           "|has=" + (has ? "1" : "0"));
    }
  } else if (op == "apl") {
    const std::string nid = t[i++];
    const std::string what = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::Players* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Players::class_tag())) continue;
      p = static_cast<lfw::ui::Players*>(c);
      break;
    }
    if (p == nullptr) {
      push("apl|" + nid + "|none");
    } else if (what == "read") {
      push("apl|" + nid + "|read|" + num(static_cast<double>(p->players().size())));
    } else {
      const std::u16string pid = key_of(t[i++]);
      lfw::PlayerInfo* const player = lfw.player(pid);
      if (player == nullptr) {
        push("apl|" + nid + "|" + to_ascii(pid) + "|nop");
      } else if (what == "join") {
        const bool ok = p->player_join(*player);
        push("apl|" + nid + "|" + to_ascii(pid) + "|" + (ok ? "1" : "0") + "|" +
             num(static_cast<double>(p->players().size())));
      } else {
        p->player_leave(*player);
        push("apl|" + nid + "|" + to_ascii(pid) + "|left|" +
             num(static_cast<double>(p->players().size())));
      }
    }
  } else if (op == "scall") {
    const std::string nid = t[i++];
    const std::string what = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::Sounds* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Sounds::class_tag())) continue;
      p = static_cast<lfw::ui::Sounds*>(c);
      break;
    }
    if (p == nullptr) {
      push("scall|" + nid + "|none");
    } else {
      if (what == "start") p->start();
      else if (what == "stop") p->stop();
      else if (what == "read") {}
      else p->replay();
      push("scall|" + nid + "|" + what + "|en=" + (p->enabled() ? "1" : "0") +
           "|idx=" + num(p->idx) + "|tm=" + num(p->time) + "|lc=" + num(p->loop.count()) +
           "|lt=" + num(p->loop.times()));
    }
  } else if (op == "tsn") {
    push("tsn|n=" +
         std::to_string(lfw.callbacks.listener_count(u"on_enter_next_stage")));
  } else if (op == "lbk") {
    const std::string nid = t[i++];
    const std::string what = i < t.size() ? t[i++] : std::string("get");
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::LabelButton* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::LabelButton::class_tag())) continue;
      p = static_cast<lfw::ui::LabelButton*>(c);
      break;
    }
    if (p == nullptr) {
      push("lbk|" + nid + "|none");
    } else {
      if (what == "set") {
        p->set_text(key_of(t[i++]));
      } else if (what == "checked") {
        const std::string v = t[i++];
        p->set_checked(v == "null" ? lfw::Value(lfw::NullTag{}) : lfw::Value(v == "1"));
      }
      push("lbk|" + nid + "|checked=" + to_ascii(render_value(p->checked())) +
           "|resp=" + node_ref(&p->responser()) + "|nc=" + trace::esc(p->normal_color()) +
           "|hc=" + trace::esc(p->hover_color()) + "|text=" + trace::esc(p->text()));
    }
  } else if (op == "pct" || op == "pset") {
    const std::u16string pid = key_of(t[i++]);
    lfw::PlayerInfo* const p = lfw.player(pid);
    if (op == "pset") {
      const double v = to_double(t[i++]);
      const bool emit = t[i++] == "1";
      p->set_ctrl(lfw::Value(v), emit);
    }
    push("pct|" + to_ascii(pid) + "|ctrl=" + to_ascii(render_value(p->ctrl())));
  } else if (op == "wr") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::WeaponRain* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::WeaponRain::class_tag())) continue;
      p = static_cast<lfw::ui::WeaponRain*>(c);
      break;
    }
    if (p == nullptr) {
      push("wr|" + nid + "|none");
    } else {
      push("wr|" + nid + "|tv=" + num(p->timer.value()) + "|tmin=" + num(p->timer.min()) +
           "|tmax=" + num(p->timer.max()) + "|ls=" +
           (p->last_section.has_value() ? num(*p->last_section) : std::string("u")) +
           "|n=" + num(static_cast<double>(p->oid_datas().size())));
    }
  } else if (op == "fh") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::FighterHead* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::FighterHead::class_tag())) continue;
      p = static_cast<lfw::ui::FighterHead*>(c);
      break;
    }
    if (p == nullptr) {
      push("fh|" + nid + "|none");
    } else {
      p->handle_changed();
      push("fh|" + nid + "|pid=" + trace::esc(p->player_id()) + "|head=" + trace::esc(p->head()) +
           "|src=" + trace::esc(p->src()) + "|w=" + num(p->width()) + "|h=" + num(p->height()));
    }
  } else if (op == "ft") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::FighterThumb* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::FighterThumb::class_tag())) continue;
      p = static_cast<lfw::ui::FighterThumb*>(c);
      break;
    }
    if (p == nullptr) {
      push("ft|" + nid + "|none");
    } else {
      p->handle_changed();
      push("ft|" + nid + "|url=" + trace::esc(p->thumb_url()) + "|src=" + trace::esc(p->src()) +
           "|w=" + num(p->width()) + "|h=" + num(p->height()));
    }
  } else if (op == "mtstate") {
    const lfw::MersenneTwister& mt = lfw.mt_ref();
    push("mtstate|" + num(static_cast<double>(mt.index())) + "|" +
         num(static_cast<double>(mt.times())));
  } else if (op == "gwcnt") {
    const double section = to_double(t[i++]);
    const double count = to_double(t[i++]);
    std::vector<std::pair<double, double>>& gwc = lfw.world().ground_weapon_counts;
    bool replaced = false;
    for (std::pair<double, double>& kv : gwc) {
      if (kv.first != section) continue;
      kv.second = count;
      replaced = true;
      break;
    }
    if (!replaced) gwc.emplace_back(section, count);
    push("gwcnt|" + num(section) + "|" + num(count));
  } else if (op == "fhset" || op == "ftset") {
    const std::string nid = to_ascii(key_of(t[i++]));
    const std::u16string url = key_of(t[i++]);
    lfw::ui::UINode& n = *g_nodes.at(nid);
    // `-`：绑 null；`z`：实体在但 `base.<key>` 是 null；否则造一个不入世界的假实体。
    lfw::Entity* e = nullptr;
    if (url != u"-") {
      const char16_t* const key = op == "fhset" ? u"head" : u"small";
      lfw::Object base;
      base.set(std::u16string(key), url == u"z" ? lfw::Value() : lfw::Value(url));
      lfw::Object data;
      data.set(u"type", lfw::Value(8.0));
      data.set(u"id", lfw::Value(u"fx"));
      data.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
      g_fakes.push_back(std::make_unique<lfw::Entity>(
          lfw.world(), lfw::Value(std::make_shared<lfw::Object>(data))));
      e = g_fakes.back().get();
    }
    if (op == "fhset") {
      lfw::ui::FighterHead* p = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (!lfw::is_class(c->clazz(), lfw::ui::FighterHead::class_tag())) continue;
        p = static_cast<lfw::ui::FighterHead*>(c);
        break;
      }
      const std::u16string pid = p != nullptr ? p->player_id() : std::u16string();
      lfw.player(pid)->set_fighter(e);
      push("fhset|" + to_ascii(pid) + "|" + (e != nullptr ? "1" : "0"));
    } else {
      lfw::ui::FighterThumb* p = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (!lfw::is_class(c->clazz(), lfw::ui::FighterThumb::class_tag())) continue;
        p = static_cast<lfw::ui::FighterThumb*>(c);
        break;
      }
      if (p != nullptr) p->fighter = e;
      push("ftset|" + nid + "|" + (e != nullptr ? "1" : "0"));
    }
  } else if (op == "dcnt") {
    std::string st;
    for (const lfw::Value& v : lfw.datas().stages()) {
      const lfw::Value* const id = lfw::ui::field_of(v, u"id");
      const std::u16string* const s = id != nullptr ? std::get_if<std::u16string>(id) : nullptr;
      if (!st.empty()) st += ",";
      st += to_ascii(s != nullptr ? *s : std::u16string());
    }
    std::string fg;
    for (const lfw::Value& v : lfw.datas().fighters()) {
      const lfw::Value* const id = lfw::ui::field_of(v, u"id");
      const std::u16string* const s = id != nullptr ? std::get_if<std::u16string>(id) : nullptr;
      if (!fg.empty()) fg += ",";
      fg += to_ascii(s != nullptr ? *s : std::u16string());
    }
    std::string bg;
    for (const lfw::Value& v : lfw.datas().backgrounds()) {
      const lfw::Value* const id = lfw::ui::field_of(v, u"id");
      const std::u16string* const s = id != nullptr ? std::get_if<std::u16string>(id) : nullptr;
      if (!bg.empty()) bg += ",";
      bg += to_ascii(s != nullptr ? *s : std::u16string());
    }
    push("dcnt|stages=" + st + "|bgs=" + bg + "|fighters=" + fg);
  } else if (op == "cplayer") {
    const std::string nid = t[i++];
    const std::string act = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::ComponentsPlayer* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::ComponentsPlayer::class_tag())) continue;
      p = static_cast<lfw::ui::ComponentsPlayer*>(c);
      break;
    }
    if (p == nullptr) {
      push("cplayer|" + nid + "|none");
    } else {
      if (act == "start") p->start();
      else if (act == "stop") p->stop();
      else if (act == "replay") p->replay();
      std::string ids;
      for (lfw::ui::UIComponent* const c : p->components) {
        if (!ids.empty()) ids += ",";
        ids += c != nullptr ? to_ascii(c->id) + "@" + node_ref(&c->node) : std::string("u");
      }
      push("cplayer|" + nid + "|" + act + "|enabled=" + (p->enabled() ? "1" : "0") +
           "|playable=" + (p->is_playable() ? "1" : "0") + "|ids=" + ids);
    }
  } else if (op == "sswi") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::StageSwitcher* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::StageSwitcher::class_tag())) continue;
      p = static_cast<lfw::ui::StageSwitcher*>(c);
      break;
    }
    if (p == nullptr) {
      push("sswi|" + nid + "|none");
    } else {
      const std::vector<lfw::Value> list = p->stages();
      const lfw::Value* const sid = lfw::ui::field_of(p->stage(), u"id");
      const std::u16string* const sid_s = sid != nullptr ? std::get_if<std::u16string>(sid) : nullptr;
      push("sswi|" + nid + "|n=" + num(static_cast<double>(list.size())) +
           "|all=" + (p->show_all() ? "1" : "0") + "|id=" +
           to_ascii(sid_s != nullptr ? *sid_s : std::u16string()) + "|text=" +
           trace::esc(p->stage_text()));
    }
  } else if (op == "bswi") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::BackgroundSwitcher* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::BackgroundSwitcher::class_tag())) continue;
      p = static_cast<lfw::ui::BackgroundSwitcher*>(c);
      break;
    }
    if (p == nullptr) {
      push("bswi|" + nid + "|none");
    } else {
      const std::vector<lfw::Value> list = p->backgrounds();
      const lfw::Value* const bid = lfw::ui::field_of(p->background(), u"id");
      const std::u16string* const bid_s = bid != nullptr ? std::get_if<std::u16string>(bid) : nullptr;
      push("bswi|" + nid + "|n=" + num(static_cast<double>(list.size())) + "|id=" +
           to_ascii(bid_s != nullptr ? *bid_s : std::u16string()));
    }
  } else if (op == "dlg") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::Dialogs* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Dialogs::class_tag())) continue;
      p = static_cast<lfw::ui::Dialogs*>(c);
      break;
    }
    if (p == nullptr) {
      push("dlg|" + nid + "|none");
    } else {
      lfw::Transform& tr = p->transform();
      push("dlg|" + nid + "|hiding=" + (p->hiding() ? "1" : "0") + "|vis=" +
           (n.visible() ? "1" : "0") + "|tx=" + num(tr.scale_x()) + "," + num(tr.scale_y()) +
           "," + num(tr.scale_z()) + "|wt=" + num(lfw.world().transform.x()) + "," +
           num(lfw.world().transform.y()) + "|wtt=" + num(lfw.world().transform.d().x) + "," +
           num(lfw.world().transform.d().y));
    }
  } else if (op == "fx") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::Flex* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Flex::class_tag())) continue;
      p = static_cast<lfw::ui::Flex*>(c);
      break;
    }
    if (p == nullptr) {
      push("fx|" + nid + "|none");
    } else {
      const std::array<double, 4> pad = p->padding();
      push("fx|" + nid + "|" + to_ascii(p->direction()) + "|" + num(p->gap()) + "|" +
           num(p->row_gap()) + "|" + num(p->col_gap()) + "|" + to_ascii(p->align()) + "|" +
           (p->fit() ? "1" : "0") + "|" + (p->fit_w() ? "1" : "0") + "|" +
           (p->fit_h() ? "1" : "0") + "|" + num(pad[0]) + "|" + num(pad[1]) + "|" +
           num(pad[2]) + "|" + num(pad[3]));
    }
  } else if (op == "jl") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::Jalousie* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Jalousie::class_tag())) continue;
      p = static_cast<lfw::ui::Jalousie*>(c);
      break;
    }
    if (p == nullptr) {
      push("jl|" + nid + "|none");
    } else {
      lfw::Sequence& anim = p->anim();
      push("jl|" + nid + "|" + (p->open() ? "1" : "0") + "|" +
           (p->click_test() ? "1" : "0") + "|" + num(p->w()) + "|" + num(p->h()) + "|v=" +
           num(anim.value()) + "|done=" + (anim.done() ? "1" : "0") + "|rev=" +
           (anim.reverse() ? "1" : "0") + "|dur=" + num(anim.duration()) + "|n=" +
           num(static_cast<double>(anim.anims().size())));
    }
  } else if (op == "jlopen") {
    const std::string nid = t[i++];
    const bool v = t[i++] == "1";
    lfw::ui::UINode& n = *g_nodes.at(nid);
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Jalousie::class_tag())) continue;
      static_cast<lfw::ui::Jalousie*>(c)->set_open(v);
      break;
    }
  } else if (op == "jsub") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::Jalousie::class_tag())) continue;
      lfw::ui::Jalousie* const self = static_cast<lfw::ui::Jalousie*>(c);
      self->callbacks.on(u"on_anim_end", [self](const lfw::ui::JalousieCallbacks::Payloads& ps) {
        for (const lfw::ui::JalousieCallbackArgs& a : ps)
          push("jcb|on_anim_end|" + std::string(a.self == self ? "1" : "0"));
      });
      break;
    }
  } else if (op == "lstart") {
    lfw::LfwCallbackArgs a;
    a.lfw = &lfw;
    lfw.callbacks.call(u"on_loading_start", {a});
    push("lstart");
  } else if (op == "lend") {
    lfw::LfwCallbackArgs a;
    a.lfw = &lfw;
    lfw.callbacks.call(u"on_loading_end", {a});
    push("lend");
  } else if (op == "lfail") {
    const lfw::Value reason = parse_value(t, i);
    lfw::LfwCallbackArgs a;
    a.lfw = &lfw;
    a.value = reason;
    lfw.callbacks.call(u"on_loading_failed", {a});
    push("lfail|" + to_ascii(render_value(reason)));
  } else if (op == "lprel") {
    lfw::LfwCallbackArgs a;
    a.lfw = &lfw;
    lfw.callbacks.call(u"on_prel_loaded", {a});
    push("lprel");
  } else if (op == "desktop") {
    host.desktop_flag = t[i++] == "1";
    push("desktop|" + std::string(host.desktop_flag ? "1" : "0"));
  } else if (op == "lpl") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::LaunchPageLogic* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::LaunchPageLogic::class_tag())) continue;
      p = static_cast<lfw::ui::LaunchPageLogic*>(c);
      break;
    }
    if (p == nullptr) {
      push("lpl|" + nid + "|none");
    } else {
      std::string line = "lpl|" + nid;
      line += "|fsm=" + to_ascii(p->fsm() != nullptr && p->fsm()->state() != nullptr
                                     ? lfw::to_string(p->fsm()->state()->key())
                                     : std::u16string());
      line += "|prel=" + std::string(p->prel_loaded() ? "1" : "0");
      lfw::ui::ImgLoop* const la = p->loading_anim();
      line += "|la_t=" + num(la != nullptr ? la->anim().times() : 0.0);
      line += "|la_c=" + num(la != nullptr ? la->anim().count() : 0.0);
      auto flags = [](lfw::ui::UINode* node) {
        if (node == nullptr) return std::string("u");
        int sine = -1;
        int fade = -1;
        if (lfw::ui::UIComponent* const c =
                node->find_component(lfw::ui::SineOpacity::class_tag())) {
          sine = c->enabled() ? 1 : 0;
        }
        if (lfw::ui::UIComponent* const c =
                node->find_component(lfw::ui::FadeOutOpacity::class_tag())) {
          fade = c->enabled() ? 1 : 0;
        }
        return std::to_string(sine) + std::to_string(fade);
      };
      auto opa_done = [](lfw::ui::UINode* node) {
        if (node == nullptr) return std::string("u");
        lfw::ui::UIComponent* const c =
            node->find_component(lfw::ui::OpacityAnimation::class_tag());
        return c != nullptr
                   ? std::string(static_cast<lfw::ui::OpacityAnimation*>(c)->done() ? "1" : "0")
                   : std::string("u");
      };
      auto sc_end = [](lfw::ui::UINode* node, const char16_t* id) {
        if (node == nullptr) return std::string("u");
        lfw::ui::UIComponent* const c =
            node->find_component_by_id(lfw::ui::ScaleAnimation::class_tag(), id);
        return c != nullptr
                   ? std::string(static_cast<lfw::ui::ScaleAnimation*>(c)->is_end() ? "1" : "0")
                   : std::string("u");
      };
      line += "|tap=" + flags(p->tap_to_launch());
      line += "|sw=" + flags(p->sound_warning());
      line += "|note=" + flags(p->translation_note());
      line += "|yf=" + std::string(p->yeonface() != nullptr ? "1" : "0");
      line += "|bf=" + std::string(p->bearface() != nullptr ? "1" : "0");
      line += "|lt=" + std::string(p->long_text() != nullptr ? "1" : "0");
      line += "|yfo=" + opa_done(p->yeonface());
      line += "|bfo=" + opa_done(p->bearface());
      line += "|lto=" + opa_done(p->long_text());
      line += "|ysi=" + sc_end(p->yeonface(), u"scale_in");
      line += "|yso=" + sc_end(p->yeonface(), u"scale_out");
      line += "|bso=" + sc_end(p->bearface(), u"scale_out");
      lfw::ui::UINode* const hint = n.find_child(u"desktop_hint");
      line += "|dt=" + std::string(hint != nullptr ? (hint->visible() ? "1" : "0") : "u");
      push(line);
    }
  } else {
    return false;
  }
  return true;
}

std::map<std::string, lfw::ui::ActionDirector> g_ads;

// `Value == null`（台面局部小助手，与各 cpp 的 `is_nullish` 同义）。
bool is_nullish_field(const lfw::Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<lfw::NullTag>(v);
}

bool run_lfag_ops(lfw::LFW& lfw, FakeHost& host, const std::vector<std::string>& t, size_t& i,
                  const std::string& op) {
  (void)host;
  if (op == "adnew") {
    g_ads[t[i++]];
    return true;
  }
  if (op == "adins" || op == "adoff" || op == "adrep") {
    const std::string id = t[i++];
    const auto it = g_ads.find(id);
    if (it == g_ads.end()) {
      push(op + "|" + id + "|none");
      return true;
    }
    if (op == "adins") {
      const double time = to_double(t[i++]);
      const std::string tag = t[i++];
      it->second.insert(time, [tag]() { push("adw|" + tag); });
    } else if (op == "adoff") {
      const double delay = to_double(t[i++]);
      const std::string tag = t[i++];
      it->second.offset(delay, {[tag]() { push("adw|" + tag); }});
    } else {
      const double times = to_double(t[i++]);
      const double delay = to_double(t[i++]);
      const std::string tag = t[i++];
      it->second.repeat(times, delay, {[tag]() { push("adw|" + tag); }});
    }
    return true;
  }
  if (op == "adwait" || op == "adt" || op == "adsort" || op == "adreset" || op == "adup") {
    const std::string id = t[i++];
    const auto it = g_ads.find(id);
    if (it == g_ads.end()) {
      push(op + "|" + id + "|none");
      return true;
    }
    if (op == "adwait") it->second.wait(to_double(t[i++]));
    else if (op == "adt") it->second.times(to_double(t[i++]));
    else if (op == "adsort") it->second.sort_actions();
    else if (op == "adreset") it->second.reset();
    else it->second.update(to_double(t[i++]));
    return true;
  }
  if (op == "adp") {
    const std::string id = t[i++];
    const auto it = g_ads.find(id);
    if (it == g_ads.end()) {
      push("adp|" + id + "|none");
      return true;
    }
    const lfw::ui::ActionDirector& d = it->second;
    push("adp|" + id + "|life=" + num(d.lifetime()) + "|end=" + num(d.end_time()) + "|idx=" +
         num(static_cast<double>(d.action_index())) + "|curr=" + num(d.curr()) +
         "|times=" + num(d.times_value()) + "|n=" + num(static_cast<double>(d.action_count())));
    return true;
  }
  if (op == "addump") {
    const std::string id = t[i++];
    const auto it = g_ads.find(id);
    if (it == g_ads.end()) {
      push("addump|" + id + "|none");
      return true;
    }
    const std::vector<lfw::ui::ActionDirector::Action>& list = it->second.actions();
    push("addump|" + id + "|n=" + num(static_cast<double>(list.size())));
    for (size_t k = 0; k < list.size(); ++k) {
      push("ad|" + id + "|" + num(static_cast<double>(k)) + "|t=" + num(list[k].time) +
           "|s=" + num(list[k].seq));
    }
    return true;
  }
  if (op == "lfgp") {
    const std::string nid = t[i++];
    lfw::ui::UINode& n = *g_nodes.at(nid);
    lfw::ui::LittleFunnyAutoGame* p = nullptr;
    for (lfw::ui::UIComponent* const c : n.components()) {
      if (!lfw::is_class(c->clazz(), lfw::ui::LittleFunnyAutoGame::class_tag())) continue;
      p = static_cast<lfw::ui::LittleFunnyAutoGame*>(c);
      break;
    }
    if (p == nullptr) {
      push("lfg|" + nid + "|none");
      return true;
    }
    auto ent_part = [](lfw::Entity* e) {
      if (e == nullptr) return std::string("z");
      const lfw::Value fid = lfw::field_or(e->frame, u"id");
      const std::string frame_id =
          is_nullish_field(fid) ? std::string("-") : to_ascii(lfw::to_string(fid));
      return to_ascii(e->id) + "|t=" + to_ascii(e->team()) + "|x=" + num(e->position.x) +
             "|hp=" + num(e->hp()) + "|fm=" + num(e->facing) + "|hr=" + num(e->hp_r()) +
             "|hm=" + num(e->hp_max()) + "|fr=" + frame_id + "|dg=" + num(e->dead_gone) +
             "|nv=" + num(e->name_visible) + "|sb=" + num(e->stat_bar);
    };
    auto ids_of = [](const std::vector<lfw::Entity*>& v) {
      std::string out;
      for (lfw::Entity* const e : v) {
        if (!out.empty()) out += ",";
        out += e != nullptr ? to_ascii(e->id) : "-";
      }
      return out.empty() ? std::string("-") : out;
    };
    std::string line = "lfg|" + nid + "|lr=" + num(static_cast<double>(p->lr())) +
                       "|ox=" + num(static_cast<double>(p->ox())) +
                       "|wp=" + num(lfw.world().paused() ? 1.0 : 0.0) +
                       "|b1=" + ent_part(p->boss(1)) + "|b2=" + ent_part(p->boss(2)) +
                       "|s1=" + num(static_cast<double>(p->soldiers(1).size())) +
                       "|s2=" + num(static_cast<double>(p->soldiers(2).size())) +
                       "|s1i=" + ids_of(p->soldiers(1)) + "|s2i=" + ids_of(p->soldiers(2));
    push(line);
    return true;
  }
  return false;
}

lfw::ui::DanmuGameLogic* danmu_of(const std::string& nid) {
  lfw::ui::UINode& n = *g_nodes.at(nid);
  for (lfw::ui::UIComponent* const c : n.components()) {
    if (!lfw::is_class(c->clazz(), lfw::ui::DanmuGameLogic::class_tag())) continue;
    return static_cast<lfw::ui::DanmuGameLogic*>(c);
  }
  return nullptr;
}

std::string csv_of(const std::vector<std::string>& v) {
  std::string out;
  for (const std::string& s : v) {
    if (!out.empty()) out += ",";
    out += s;
  }
  return out.empty() ? std::string("-") : out;
}

bool run_danmu_ops(lfw::LFW& lfw, FakeHost& host, const std::vector<std::string>& t, size_t& i,
                   const std::string& op) {
  (void)lfw;
  (void)host;
  if (op == "dj" || op == "de" || op == "dsw") {
    const std::string nid = t[i++];
    const std::string uid = t[i++];
    lfw::ui::DanmuGameLogic* const d = danmu_of(nid);
    if (op == "dsw") {
      const std::string oid = i < t.size() ? t[i++] : "-";
      if (d == nullptr) {
        push("dsw|" + uid + "|none");
        return true;
      }
      const bool ret =
          d->switch_to(to_u16(uid), oid == "-" ? lfw::Value() : lfw::Value(to_u16(oid)));
      push("dsw|" + uid + "|" + (ret ? "1" : "0"));
      return true;
    }
    const std::string name = t[i++];
    const std::string oid = i < t.size() ? t[i++] : "-";
    if (d == nullptr) {
      push(op + "|" + uid + "|none");
      return true;
    }
    const lfw::helper::Entrant entrant{
        to_u16(uid), to_u16(name), oid == "-" ? lfw::Value() : lfw::Value(to_u16(oid))};
    const bool ret = op == "dj" ? d->join(entrant) : d->enter(entrant);
    push(op + "|" + uid + "|" + (ret ? "1" : "0"));
    return true;
  }
  if (op == "dleave" || op == "dtouch" || op == "dcheer") {
    const std::string nid = t[i++];
    const std::string uid = t[i++];
    lfw::ui::DanmuGameLogic* const d = danmu_of(nid);
    if (d == nullptr) {
      push(op + "|" + uid + "|none");
      return true;
    }
    if (op == "dleave") push("dleave|" + uid + "|" + (d->leave(to_u16(uid)) ? "1" : "0"));
    else if (op == "dtouch") {
      d->touch(to_u16(uid));
      push("dtouch|" + uid);
    } else {
      push("dcheer|" + uid + "|" + (d->cheer(to_u16(uid)) ? "1" : "0"));
    }
    return true;
  }
  if (op == "dp") {
    const std::string nid = t[i++];
    lfw::ui::DanmuGameLogic* const d = danmu_of(nid);
    if (d == nullptr) {
      push("dp|" + nid + "|none");
      return true;
    }
    std::string line = "dp|" + nid + "|mode=" + to_ascii(d->mode()) + "|time=" + num(d->time);
    lfw::stage::Stage* const stg = lfw.world().stage();
    line += "|stg=" + (stg != nullptr ? to_ascii(stg->name()) : std::string("z"));
    std::vector<std::string> wins;
    for (const auto& kv : d->teams) {
      wins.push_back(to_ascii(kv.first) + ":" + num(kv.second.wins));
    }
    std::sort(wins.begin(), wins.end());
    line += "|w=" + csv_of(wins);
    std::vector<std::string> teams;
    for (const std::u16string& s : d->teams_set()) teams.push_back(to_ascii(s));
    std::sort(teams.begin(), teams.end());
    line += "|teams=" + csv_of(teams);
    std::string caps;
    for (const auto& kv : d->team_caps()) {
      if (!caps.empty()) caps += ",";
      caps += to_ascii(kv.first) + ":" + num(kv.second);
    }
    line += "|caps=" + (caps.empty() ? std::string("-") : caps);
    line += "|q=" + num(static_cast<double>(d->join_queue.size()));
    std::string qu;
    for (const lfw::helper::Entrant& e : d->join_queue.all()) {
      if (!qu.empty()) qu += ",";
      qu += to_ascii(e.uid) + ":" + to_ascii(e.name) + ":" + to_ascii(render_value(e.oid));
    }
    line += "|qu=" + (qu.empty() ? std::string("-") : qu);
    line += "|wts=" + std::string(d->waiting_next_stage() ? "1" : "0");
    line += "|cr=" + std::string(d->coop_stage_ready() ? "1" : "0");
    line += "|wr=" + std::string(d->waiting_respawn() ? "1" : "0");
    line += "|nsk=" + num(d->next_stage_delay());
    line += "|gck=" + num(d->gameover_countdown());
    line += "|sc=" + num(d->staring_countdown());
    line += "|qst=" + num(d->queue_sweep_timer());
    lfw::ui::CameraCtrl* const cam = d->cam_ctrl();
    const lfw::Entity* const staring = cam != nullptr ? cam->staring() : nullptr;
    line += "|st=" + (cam == nullptr ? std::string("u")
                                     : (staring != nullptr ? to_ascii(staring->id)
                                                           : std::string("z")));
    line += "|ca=" + (cam == nullptr ? std::string("u")
                                     : std::string(cam->auto_ ? "1" : "0"));
    line += "|jf=" + (d->join_fallen().has_value() ? to_ascii(*d->join_fallen())
                                                   : std::string("z"));
    std::string sv;
    if (d->survivors().has_value()) {
      for (const lfw::helper::Entrant& e : *d->survivors()) {
        if (!sv.empty()) sv += ",";
        sv += to_ascii(e.uid);
      }
      if (sv.empty()) sv = "e";
    } else {
      sv = "z";
    }
    line += "|sv=" + sv;
    std::vector<std::string> seen;
    for (const auto& kv : d->queue_seen())
      seen.push_back(to_ascii(kv.first) + ":" + num(kv.second));
    std::sort(seen.begin(), seen.end());
    line += "|seen=" + csv_of(seen);
    std::vector<std::string> cd;
    for (const auto& kv : d->cheer_cd()) cd.push_back(to_ascii(kv.first) + ":" + num(kv.second));
    std::sort(cd.begin(), cd.end());
    line += "|cd=" + csv_of(cd);
    std::string feed;
    for (const lfw::ui::DanmuGameLogic::CheerEvent& e : d->cheer_feed()) {
      if (!feed.empty()) feed += ",";
      feed += to_ascii(e.uid) + ":" + to_ascii(e.name) + ":" + num(e.time);
    }
    line += "|feed=" + (feed.empty() ? std::string("-") : feed);
    push(line);
    return true;
  }
  if (op == "dstats") {
    const std::string nid = t[i++];
    lfw::ui::DanmuGameLogic* const d = danmu_of(nid);
    if (d == nullptr) {
      push("dstats|" + nid + "|none");
      return true;
    }
    const std::vector<lfw::ui::DanmuGameLogic::ViewerStat> list = d->viewer_stats();
    push("dstats|" + nid + "|n=" + num(static_cast<double>(list.size())));
    for (const lfw::ui::DanmuGameLogic::ViewerStat& v : list) {
      push("vs|" + to_ascii(v.uid) + "|" + to_ascii(v.name) + "|sp=" + num(v.spawns) +
           "|k=" + num(v.kills) + "|d=" + num(v.deads) + "|dm=" + num(v.damages) +
           "|ch=" + num(v.cheers) + "|al=" + (v.alive ? "1" : "0"));
    }
    return true;
  }
  if (op == "dlst") {
    const std::string nid = t[i++];
    const lfw::Value* const mk = ::lfw::defines::find(u"Defines.DANMU_UID_MARK");
    const std::u16string mark = mk != nullptr ? lfw::to_string(*mk) : std::u16string(u"danmu_uid");
    const std::vector<lfw::Entity*>& ents = lfw.world().entities;
    push("dlst|" + nid + "|" + num(static_cast<double>(ents.size())));
    for (size_t k = 0; k < ents.size(); ++k) {
      const lfw::Entity* const e = ents[k];
      if (e == nullptr) {
        push("dl|" + num(static_cast<double>(k)) + "|z");
        continue;
      }
      const auto it = e->marks.find(mark);
      const std::u16string uid = it != e->marks.end() ? it->second : std::u16string();
      const lfw::Value fid = lfw::field_or(e->frame, u"id");
      push("dl|" + num(static_cast<double>(k)) + "|" + to_ascii(e->id) +
           "|u=" + (uid.empty() ? std::string("-") : to_ascii(uid)) +
           "|n=" + to_ascii(lfw::to_string(e->name())) +
           "|p=" + num(e->position.x) + "," + num(e->position.y) + "," + num(e->position.z) +
           "|sb=" + num(e->stat_bar) + "|nv=" + num(e->name_visible) +
           "|dg=" + num(e->dead_gone) + "|bl=" + num(e->blinking()) +
           "|iv=" + num(e->invulnerable()) + "|hp=" + num(e->hp()) +
           "|fr=" + (is_nullish_field(fid) ? std::string("-") : to_ascii(lfw::to_string(fid))));
    }
    return true;
  }
  return false;
}

void listen(lfw::LFW& lfw) {
  auto call = [&](const std::u16string& name, const lfw::LfwCallbacks::Payloads& p) {
    std::vector<lfw::LfwCallbacks::Payloads> packs = {p};
    (void)packs;
    const lfw::LfwCallbackArgs& a = p.empty() ? lfw::LfwCallbackArgs() : p[0];
    std::string line = "cb|" + to_ascii(name);
    if (name == u"on_ui_changed") {
      line += a.curr == nullptr ? "|u" : "|?";
      line += a.prev == nullptr ? "|u" : "|?";
    } else if (name == u"on_progress") {
      line += "|s:" + to_ascii(a.text) + "|n:" + num(a.num);
      if (a.has_num2) line += "|n:" + num(a.num2);
      else line += "|u";
    } else if (name == u"on_broadcast") {
      line += "|s:" + to_ascii(a.text) + "|self";
    } else if (name == u"on_cheat_changed") {
      line += "|s:" + to_ascii(a.text) + "|b:" + (a.flag ? "1" : "0");
    } else if (name == u"on_lang_changed") {
      line += "|s:" + to_ascii(a.text) + "|s:" + to_ascii(a.prev_text) + "|self";
    } else if (name == u"on_extra_zips_changed") {
      line += "|self";
    } else if (name == u"on_stage_pass" || name == u"on_enter_next_stage") {
      line += "";
    } else if (name == u"on_loading_start" || name == u"on_loading_end") {
      line += "";
    } else if (name == u"on_prel_loaded") {
      line += "|self";
    } else if (name == u"on_loading_failed") {
      line += "|s:" + to_ascii(lfw::to_string(a.value));
    } else if (name == u"on_ui_loaded") {
      line += "|" + to_ascii(lfw::number_to_string(static_cast<double>(a.infos.size())));
    } else if (name == u"on_zips_changed") {
      std::string names;
      for (size_t i = 0; i < a.zips.size(); ++i) {
        if (i != 0) names += ",";
        names += to_ascii(a.zips[i]->name());
      }
      line += "|" + names;
    } else if (name == u"on_dispose") {
      line += "";
    } else if (name == u"controller_detected" || name == u"keyboard_detected") {
      line += "|pl:" + (a.player != nullptr ? to_ascii(a.player->id()) : "u");
    } else if (name == u"on_survival_rank_changed") {
      line += "|" + to_ascii(render_value(a.value)) + "|self";
    } else {
      line += "|?";
    }
    push(line);
  };

  for (const char16_t* const k :
       {u"on_ui_changed", u"on_loading_start", u"on_loading_end", u"on_loading_failed",
        u"on_progress", u"on_bgms_loaded", u"on_bgms_clear", u"on_player_infos_changed",
        u"on_cheat_changed", u"on_stage_pass", u"on_enter_next_stage", u"on_dispose",
        u"on_ui_loaded", u"on_prel_loaded", u"on_lang_changed", u"on_broadcast",
        u"on_survival_rank_changed", u"on_zips_changed", u"on_component_broadcast",
        u"on_extra_zips_changed", u"controller_detected", u"keyboard_detected"}) {
    const std::u16string key(k);
    lfw.callbacks.on(key, [call, key](const lfw::LfwCallbacks::Payloads& p) { call(key, p); });
  }
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_lfw <case-file>\n");
    return 2;
  }
  // 台面：`Randoming` 的默认 MT 固定种子（TS 侧同步 `Randoming.mt = new MersenneTwister(12345)`）。
  lfw::randoming_default_mt() = lfw::MersenneTwister(12345.0);
  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  lfw::Factory::register_entity(
      lfw::Value(8.0),
      [](lfw::World* w, const lfw::Value& data, lfw::state::States* states) -> lfw::Entity* {
        push("entadd:create|" + s_of(lfw::field_or(data, u"id")));
        return new lfw::Entity(*w, data, states);
      });
  // 4BP：非战士实体（`is_fighter` 筛选用）。
  lfw::Factory::register_entity(
      lfw::Value(4.0),
      [](lfw::World* w, const lfw::Value& data, lfw::state::States* states) -> lfw::Entity* {
        push("entadd:create|" + s_of(lfw::field_or(data, u"id")));
        return new lfw::Entity(*w, data, states);
      });
  lfw::ui::regist_ui_class(bench::fake_comp_tag(), u"FakeComp");
  static const bench::FakeCompCreator s_fake_comp_creator;
  lfw::Factory::register_component(u"FakeComp", &s_fake_comp_creator);

  lfw::LFW* slot = nullptr;
  FakeHost host(&slot);
  lfw::LFW lfw(host, false);
  slot = &lfw;
  listen(lfw);

  std::string raw;
  while (std::getline(in, raw)) {
    const std::vector<std::string> t = split_ws(strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "camr" || op == "cams" || op == "sran" || op == "danm" || op == "pfight" ||
        op == "cdbg" || op == "fsuse" || op == "fsr" || op == "eol" || op == "dsrd" ||
        op == "epos" || op == "npg" || op == "sndset" || op == "sndv" || op == "fpge" ||
        op == "stid" || op == "bcasts" || op == "edump" || op == "phid" || op == "ppup" ||
        op == "nkeyp" || op == "cmprobe" || op == "plist" || op == "srankdata" ||
        op == "sprobe" || op == "wbg" || op == "cprops") {
      if (op == "camr") {
        const lfw::Vector2& p = lfw.world().camera().position;
        push("camr|" + num(p.x) + "|" + num(p.y));
      } else if (op == "cams") {
        const double x = to_double(t[i++]);
        const double y = to_double(t[i++]);
        lfw::Vector2& p = lfw.world().camera().position;
        p.x = x;
        p.y = y;
        push("cams|" + num(x) + "|" + num(y));
      } else if (op == "sran") {
        const bool en = t[i++] == "1";
        lfw.srank_available = en;
        push(std::string("sran|") + (en ? "1" : "0"));
      } else if (op == "danm") {
        const bool en = t[i++] == "1";
        lfw.danmu_available = en;
        push(std::string("danm|") + (en ? "1" : "0"));
      } else if (op == "pfight") {
        const std::u16string pid = key_of(t[i++]);
        const double idx = to_double(t[i++]);
        lfw::PlayerInfo* const p = lfw.player(pid);
        lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < lfw.world().entities.size()
                                   ? lfw.world().entities[static_cast<size_t>(idx)]
                                   : nullptr;
        p->set_fighter(e);
        push("pfight|" + to_ascii(pid) + "|" +
             (e != nullptr ? to_ascii(e->id) : std::string("-")));
      } else if (op == "cdbg") {
        const std::string nid = t[i++];
        const std::u16string cid = key_of(t[i++]);
        lfw::ui::UINode& n = *g_nodes.at(nid);
        lfw::ui::CameraCtrl* p = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->id != cid) continue;
          if (!lfw::is_class(c->clazz(), lfw::ui::CameraCtrl::class_tag())) continue;
          p = static_cast<lfw::ui::CameraCtrl*>(c);
          break;
        }
        if (p == nullptr) {
          push("cdbg|" + nid + "|none");
        } else {
          lfw::Entity* const s = p->staring();
          push("cdbg|" + nid + "|a=" + (p->auto_ ? "1" : "0") + "|s=" +
               (s != nullptr ? to_ascii(s->id) : std::string("-")) + "|w=" +
               num(s != nullptr ? s->outline_width() : 0) + "|c=" +
               (s != nullptr ? to_ascii(s->outline_color()) : std::string("-")));
        }
      } else if (op == "fsuse") {
        const std::string nid = t[i++];
        const std::u16string cid = key_of(t[i++]);
        const std::u16string key = key_of(t[i++]);
        lfw::ui::UINode& n = pick_node(nid);
        lfw::ui::UIComponent* p = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->id != cid) continue;
          p = c;
          break;
        }
        lfw::FSM* const f = p != nullptr ? p->fsm() : nullptr;
        if (f != nullptr) f->use(lfw::Value(key));
        push("fsuse|" + nid + "|" + to_ascii(cid) + "|" + to_ascii(key));
      } else if (op == "fsr") {
        const std::string nid = t[i++];
        const std::u16string cid = key_of(t[i++]);
        lfw::ui::UINode& n = pick_node(nid);
        lfw::ui::UIComponent* p = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->id != cid) continue;
          p = c;
          break;
        }
        lfw::FSM* const f = p != nullptr ? p->fsm() : nullptr;
        if (f == nullptr) {
          push("fsr|" + nid + "|none");
        } else {
          push("fsr|" + nid + "|" + to_ascii(cid) + "|s=" +
               (f->state() != nullptr ? to_ascii(render_value(f->state()->key())) : "-") + "|p=" +
               (f->prev_state() != nullptr ? to_ascii(render_value(f->prev_state()->key())) : "-") +
               "|t=" + num(f->time()) + "|st=" + num(f->state_time()));
        }
      } else if (op == "eol") {
        const double idx = to_double(t[i++]);
        lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < lfw.world().entities.size()
                                   ? lfw.world().entities[static_cast<size_t>(idx)]
                                   : nullptr;
        push("eol|" + num(idx) +
             (e != nullptr ? "|w=" + num(e->outline_width()) + "|c=" + to_ascii(e->outline_color())
                           : "|none"));
      } else if (op == "npg") {
        const std::string nid = t[i++];
        const double idx = to_double(t[i++]);
        lfw::ui::UILayer* l = g_real_layers ? g_real_layers->at(idx) : nullptr;
        g_alias_nodes[nid] = l != nullptr ? l->ui() : nullptr;
        push("npg|" + nid + "|" + (l != nullptr && l->ui() != nullptr ? "1" : "0"));
      } else if (op == "epos") {
        const double idx = to_double(t[i++]);
        const double x = to_double(t[i++]);
        const double z = to_double(t[i++]);
        lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < lfw.world().entities.size()
                                   ? lfw.world().entities[static_cast<size_t>(idx)]
                                   : nullptr;
        if (e != nullptr) {
          e->position.x = x;
          e->position.z = z;
        }
        push("epos|" + num(idx) + "|" + num(x) + "|" + num(z));
      } else if (op == "dsrd") {
        const std::u16string key = key_of(t[i++]);
        const lfw::Value ds = lfw.world().world_dataset();
        const lfw::Object* const o = lfw::as_object(ds);
        const lfw::Value* const p = o != nullptr ? o->get(key) : nullptr;
        push("dsrd|" + to_ascii(key) + "|" +
             to_ascii(render_value(p != nullptr ? *p : lfw::Value())));
      } else if (op == "sndset") {
        // 4BR：直调假声音的 setter（`volume`/`bgm_volume`/`sound_volume`/`bgm_muted`/
        // `sound_muted`），走过回调分发。
        const std::string which = t[i++];
        const double v = to_double(t[i++]);
        const bool b = v != 0;
        if (which == "volume") host.sounds_set_volume(v);
        else if (which == "bgm_volume") host.sounds_set_bgm_volume(v);
        else if (which == "sound_volume") host.sounds_set_sound_volume(v);
        else if (which == "bgm_muted") host.sounds_set_bgm_muted(b);
        else if (which == "sound_muted") host.sounds_set_sound_muted(b);
        push("sndset|" + which + "|" + num(v));
      } else if (op == "sndv") {
        push("sndv|" + num(host.sounds_volume()) + "|" + num(host.sounds_bgm_volume()) + "|" +
             num(host.sounds_sound_volume()) + "|" + (host.sounds_bgm_muted() ? "1" : "0") +
             "|" + (host.sounds_sound_muted() ? "1" : "0"));
      } else if (op == "fpge") {
        const std::u16string s = key_of(t[i++]);
        lfw.first_page = s;
        push("fpge|" + to_ascii(s));
      } else if (op == "stid") {
        lfw::stage::Stage* const s = lfw.world().stage();
        push("stid|" + (s != nullptr ? to_ascii(s->id()) : std::string("-")));
      } else if (op == "bcasts") {
        std::string joined;
        for (size_t k = 0; k < lfw.broadcasts.size(); ++k) {
          if (k != 0) joined += ";";
          joined += to_ascii(lfw.broadcasts[k]);
        }
        push("bcasts|" + joined);
      } else if (op == "phid") {
    // 4BR：当前舞台的阶段下标（直接看 `goto_next_stage` 类推进是否发生）。
    lfw::stage::Stage* const st = lfw.world().stage();
    push("phid|" + (st != nullptr ? num(static_cast<double>(st->phase_idx())) : std::string("-")));
  } else if (op == "ppup") {
    // 4BR：按玩家号登记/替换傀儡（StageModeLogic 的 player_count 读 world.puppets）。
    const std::u16string pid = key_of(t[i++]);
    const double idx = to_double(t[i++]);
    lfw::Entity* const e = idx >= 0 && static_cast<size_t>(idx) < lfw.world().entities.size()
                               ? lfw.world().entities[static_cast<size_t>(idx)]
                               : nullptr;
    bool found = false;
    for (std::pair<std::u16string, lfw::Entity*>& kv : lfw.world().puppets) {
      if (kv.first == pid) {
        kv.second = e;
        found = true;
        break;
      }
    }
    if (!found) lfw.world().puppets.push_back({pid, e});
    push("ppup|" + to_ascii(pid) + "|" + (e != nullptr ? to_ascii(e->id) : std::string("none")));
  } else if (op == "edump") {
        // 4BR：实体全字段快照（DemoMode 的摆位/朝向/血量族）；负数下标从尾数起。
        const double idx = to_double(t[i++]);
        const size_t cnt = lfw.world().entities.size();
        const double at = idx < 0 ? static_cast<double>(cnt) + idx : idx;
        lfw::Entity* const e = at >= 0 && static_cast<size_t>(at) < cnt
                                   ? lfw.world().entities[static_cast<size_t>(at)]
                                   : nullptr;
        if (e == nullptr) {
          push("edump|" + num(idx) + "|none");
        } else {
          push("edump|" + num(idx) + "|id=" + to_ascii(e->id) + "|team=" + to_ascii(e->team()) +
               "|x=" + num(e->position.x) + "|y=" + num(e->position.y) + "|z=" + num(e->position.z) +
               "|f=" + num(e->facing) + "|mp=" + num(e->mp()) + "|hp=" + num(e->hp()) +
               "|bl=" + num(e->blinking()) + "|inv=" + num(e->invulnerable()));
        }
      } else if (op == "nkeyp") {
        // 4BS：带玩家号的 UI 键事件（`nkey` 的 player 恒为空串，CharMenuLogic 要按玩家路由）。
        const std::string nid = t[i++];
        const std::u16string pid = key_of(t[i++]);
        const std::string dir = t[i++];
        const std::u16string gk = key_of(t[i++]);
        const std::u16string key = key_of(t[i++]);
        const bool pre = i < t.size() && t[i] == "1";
        if (pre) ++i;
        lfw::ui::LFWKeyEvent e(pid, dir == "down", gk, key);
        if (pre) e.stop_immediate_propagation();
        lfw::ui::UINode& n = pick_node(nid);
        if (dir == "down") n.on_key_down(e);
        else n.on_key_up(e);
        push("nkeyp|" + nid + "|" + to_ascii(pid) + "|" + dir +
             "|stop=" + std::to_string(e.stopped()));
      } else if (op == "cmprobe") {
        // 4BS：CharMenuLogic 内部状态（fsm/com_num/prev/players/slots/随机池）。
        const std::string nid = t[i++];
        lfw::ui::UINode& node = pick_node(nid);
        lfw::ui::CharMenuLogic* cm = nullptr;
        for (lfw::ui::UIComponent* const c : node.components()) {
          if (lfw::is_class(c->clazz(), lfw::ui::CharMenuLogic::class_tag())) {
            cm = static_cast<lfw::ui::CharMenuLogic*>(c);
            break;
          }
        }
        if (cm == nullptr) {
          push("cmprobe|" + nid + "|none");
        } else {
          std::string line = "cmprobe|" + nid;
          line += "|com=" + num(cm->com_num);
          line += "|fsm=" + to_ascii(cm->fsm() != nullptr && cm->fsm()->state() != nullptr
                                         ? lfw::to_string(cm->fsm()->state()->key())
                                         : std::u16string());
          line += "|prev=" + std::to_string(cm->prev_players.size());
          line += "|ps=";
          for (size_t k = 0; k < cm->players.size(); ++k) {
            if (k != 0) line += ",";
            lfw::PlayerInfo* const p = cm->players[k].first;
            const lfw::ui::SlotState& s = cm->players[k].second;
            std::u16string fid;
            const lfw::Value* const idv = lfw::ui::field_of(s.fighter, u"id");
            if (idv != nullptr) fid = lfw::to_string(*idv);
            line += to_ascii(p->id()) + ":" + std::to_string(static_cast<int>(s.step)) + ":" +
                    (s.random ? "1" : "0") + ":" + to_ascii(s.team) + ":" + to_ascii(fid);
          }
          line += "|slots=" + std::to_string(cm->slots.size());
          line += "|max=" + num(cm->max_player());
          line += "|min=" + num(cm->min_player());
          {
            std::string tms;
            const std::vector<std::u16string> tv = cm->teams();
            for (size_t k = 0; k < tv.size(); ++k) {
              if (k != 0) tms += ",";
              tms += to_ascii(tv[k]);
            }
            line += "|tms=" + tms;
            const std::optional<std::vector<std::u16string>> od = cm->oids();
            line += "|oids=" + (od.has_value() ? std::to_string(od->size()) : std::string("z"));
          }
          line += "|rnd=" + std::to_string(cm->randoming() != nullptr
                                               ? cm->randoming()->src().size()
                                               : static_cast<size_t>(0));
          lfw::ui::UINode* const foc = node.root().focused_node();
          line += "|foc=" + (foc != nullptr ? to_ascii(lfw::to_string(foc->id())) : std::string("-"));
          push(line);
        }
      } else if (op == "plist") {
        std::string line = "plist";
        for (const std::pair<std::u16string, std::unique_ptr<lfw::PlayerInfo>>& kv :
             lfw.players()) {
          line += "|" + to_ascii(kv.first) + ":" + (kv.second->is_com() ? "1" : "0");
        }
        push(line);
      } else if (op == "srankdata") {
        lfw.set_survival_rank_data(parse_value(t, i));
      } else if (op == "sprobe") {
        push(std::string("sprobe|") + (lfw::is_survival_rank_mode(lfw.game_mode()) ? "1" : "0") + "|" +
             (lfw.survival_rank_available() ? "1" : "0") + "|" +
             (lfw.game_mode() == lfw::game_mode::kSurvivalRank2P ? "1" : "0"));
      } else if (op == "wbg") {
        lfw::Background* const bg = lfw.world().bg();
        push("wbg|" + (bg != nullptr ? to_ascii(lfw::to_string(bg->id())) : std::string("-")));
      } else if (op == "cprops") {
        // 4BS：给活动组件设 props（`cset` 只能切 enabled）；未命中打 none。
        const std::string nid = t[i++];
        const std::u16string cid = key_of(t[i++]);
        const std::u16string key = key_of(t[i++]);
        const lfw::Value v = parse_value(t, i);
        lfw::ui::UINode& n = pick_node(nid);
        lfw::ui::UIComponent* found = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->id == cid) {
            found = c;
            break;
          }
        }
        if (found == nullptr) {
          push("cprops|" + nid + "|none");
        } else {
          lfw::Value* const props = const_cast<lfw::Value*>(found->props());
          lfw::Object* const o = props != nullptr ? lfw::as_object(*props) : nullptr;
          if (o != nullptr) o->set(key, v);
          push("cprops|" + nid + "|" + to_ascii(key) + "|" + to_ascii(render_value(v)));
        }
      }
      continue;
    }

    if (op == "info") {
      const lfw::Value& info = lfw::LFW::INFO();
      const lfw::Value version = lfw::field_or(info, u"version");
      push("info|" + s_of(lfw::field_or(info, u"title")) + "|" + s_of(lfw::field_or(info, u"type")) +
           "|" + num(lfw::to_number(version)) + "|default=" +
           (lfw::LFW::IS_DEFAULT_INFO() ? "1" : "0") + "|zips=" +
           to_ascii(lfw::number_to_string(static_cast<double>(lfw::LFW::ZIPS().size()))));
    } else if (op == "setinfo") {
      const std::u16string title = key_of(t[i++]);
      lfw::Object paths;
      (void)paths;
      auto arr = std::make_shared<lfw::Array>();
      arr->push_back(lfw::Value(std::u16string(u"prel.zip.json")));
      arr->push_back(lfw::Value(std::u16string(u"data.zip.json")));
      arr->push_back(lfw::Value(std::u16string(u"extra.zip.json")));
      lfw::Object o;
      o.set(u"type", lfw::Value(std::u16string(u"FULL")));
      o.set(u"version", lfw::Value(1.0));
      o.set(u"title", lfw::Value(title));
      o.set(u"description", lfw::Value(std::u16string(u"d")));
      o.set(u"author", lfw::Value(std::u16string(u"a")));
      o.set(u"paths", lfw::Value(std::move(arr)));
      const lfw::Value v(std::make_shared<lfw::Object>(o));
      lfw::LFW::set_INFO(&v);
    } else if (op == "setzips") {
      std::vector<lfw::LFW::ZipItem> zips;
      while (i < t.size()) zips.push_back(lfw::LFW::ZipItem{key_of(t[i++]), nullptr});
      lfw::LFW::set_ZIPS(std::move(zips));
    } else if (op == "newid") {
      const double n = to_double(t[i++]);
      for (double k = 0; k < n; ++k) push("newid|" + to_ascii(lfw.new_id()));
    } else if (op == "newteam") {
      const double n = to_double(t[i++]);
      for (double k = 0; k < n; ++k) push("newteam|" + to_ascii(lfw.new_team()));
    } else if (op == "resetids") {
      lfw.reset_new_id();
    } else if (op == "resetteam") {
      lfw.reset_new_team();
    } else if (op == "player") {
      const std::u16string id = key_of(t[i++]);
      lfw::PlayerInfo* const p1 = lfw.player(id);
      lfw::PlayerInfo* const p2 = lfw.player(id);
      push("player|" + to_ascii(p1->id()) + "|" + (p1 == p2 ? "1" : "0") + "|local=" +
           (lfw::truthy(p1->local()) ? "1" : "0") + "|" + s_of(p1->name()) + "|count=" +
           to_ascii(lfw::number_to_string(static_cast<double>(lfw.players().size()))));
    } else if (op == "pkey") {
      const std::u16string pid = key_of(t[i++]);
      const std::u16string name = key_of(t[i++]);
      const std::u16string key = key_of(t[i++]);
      lfw::PlayerInfo* const p = lfw.player(pid);
      std::u16string err;
      const bool ok = p->set_key(lfw::Value(name), lfw::Value(key), false, err);
      push("pkey|" + to_ascii(p->id()) + "|" + (ok ? "1" : "0"));
    } else if (op == "pkeys") {
      lfw::PlayerInfo* const p = lfw.player(key_of(t[i++]));
      push("pkeys|" + to_ascii(p->id()) + "|" + to_ascii(render_value(p->keys())));
    } else if (op == "kbdown") {
      const std::u16string key = key_of(t[i++]);
      const double times = to_double(t[i++]);
      const std::string dev = t[i++];
      lfw::LfwKeyEvent e;
      e.key = key;
      e.times = times;
      if (dev != "-") e.device_type = key_of(dev);
      host.dispatch_key(e, true);
      push("kbdown|" + to_ascii(key) + "|" + num(times) + "|" + dev + "|int=" +
           (e.interrupted ? "1" : "0"));
    } else if (op == "kbup") {
      const std::u16string key = key_of(t[i++]);
      lfw::LfwKeyEvent e;
      e.key = key;
      host.dispatch_key(e, false);
      push("kbup|" + to_ascii(key));
    } else if (op == "ptclick") {
      const double btn = to_double(t[i++]);
      lfw::LfwPointingEvent e;
      e.button = btn;
      host.dispatch_pointing("click", e);
      push("ptclick|" + num(btn));
    } else if (op == "cmds") {
      std::string joined;
      for (size_t k = 0; k < lfw.cmds.size(); ++k) {
        if (k != 0) joined += ";";
        joined += to_ascii(lfw.cmds[k]);
      }
      push("cmds|" + joined);
    } else if (op == "clearcmds") {
      lfw.cmds.clear();
    } else if (op == "ischeat") {
      const std::u16string n1 = key_of(t[i++]);
      const std::u16string n2 = key_of(t[i++]);
      push("ischeat|" + to_ascii(n1) + "|" + (lfw.is_cheat(n2) ? "1" : "0"));
    } else if (op == "setcheat") {
      const std::u16string name = key_of(t[i++]);
      const std::string en = t[i++];
      if (en == "-") lfw.set_cheat(name, std::nullopt);
      else lfw.set_cheat(name, en == "1");
    } else if (op == "ep") {
      const std::u16string c = key_of(t[i++]);
      const double p = to_double(t[i++]);
      lfw.emit_progress(c, p);
    } else if (op == "eps") {
      const std::u16string c = key_of(t[i++]);
      const double p = to_double(t[i++]);
      const std::string s = t[i++];
      if (s == "-") lfw.emit_progress(c, p);
      else lfw.emit_progress_size(c, p, lfw::Value(to_double(s)));
    } else if (op == "bcast") {
      lfw.broadcast(lfw::Value(key_of(t[i++])));
    } else if (op == "dataset") {
      const std::u16string k = key_of(t[i++]);
      lfw.world().dataset.set(k, parse_value(t, i));
    } else if (op == "switchdiff") {
      lfw.switch_difficulty(to_double(t[i++]));
    } else if (op == "lang") {
      push("lang|" + to_ascii(lfw.lang()));
    } else if (op == "setlang") {
      lfw.set_lang(lfw::Value(key_of(t[i++])));
    } else if (op == "setlangbad") {
      lfw.set_lang(parse_value(t, i));
    } else if (op == "canon") {
      push("canon|" + s_of(lfw.canonical_lang(key_of(t[i++]))));
    } else if (op == "i18nadd") {
      const std::u16string lang = key_of(t[i++]);
      const std::u16string key = key_of(t[i++]);
      const std::u16string val = key_of(t[i++]);
      lfw::Object words;
      words.set(key, lfw::Value(val));
      lfw::Object langs;
      langs.set(lang, lfw::Value(std::make_shared<lfw::Object>(words)));
      lfw.i18n().add(lfw::Value(std::make_shared<lfw::Object>(langs)));
      push("i18nadd|" + to_ascii(lang) + "|" + to_ascii(key));
    } else if (op == "str") {
      const std::u16string n = key_of(t[i++]);
      push("str|" + to_ascii(n) + "|" + to_ascii(render_value(lfw.string(lfw::Value(n)))));
    } else if (op == "srank") {
      lfw.game_mode_value = lfw::game_mode::kSurvivalRank2P;
      lfw.srank_available = true;
      lfw.survival_rank_period = u"week";
      lfw::Object data;
      data.set(u"period", lfw::Value(std::u16string(u"week")));
      data.set(u"list", lfw::Value(std::make_shared<lfw::Array>()));
      data.set(u"mine", lfw::Value(lfw::NullTag{}));
      lfw.set_survival_rank_data(lfw::Value(std::make_shared<lfw::Object>(data)));
      push(std::string("srank|") + (lfw::is_survival_rank_mode(lfw.game_mode()) ? "1" : "0") +
           (lfw.survival_rank_available() ? "1" : "0") +
           (lfw.game_mode() == lfw::game_mode::kSurvivalRank2P ? "1" : "0") + "|" +
           to_ascii(lfw.survival_rank_period) + "|cheated=" + (lfw.survival_rank_cheated() ? "1" : "0") +
           "|modded=" + (lfw.survival_rank_modded() ? "1" : "0") + "|invalid=" +
           (lfw.survival_rank_invalid() ? "1" : "0"));
    } else if (op == "randinfo") {
      lfw::Entity e(lfw.world(), lfw::Value(std::make_shared<lfw::Object>([] {
                      lfw::Object o;
                      o.set(u"type", lfw::Value(8.0));
                      o.set(u"id", lfw::Value(std::u16string(u"rx")));
                      return o;
                    }())));
      lfw.random_entity_info(e);
      push("randinfo|" + to_ascii(e.id) + "|" + num(e.facing) + "|" + num(e.position.x) + "|" +
           num(e.position.y) + "|" + num(e.position.z) + "|L" + num(lfw.world().left()) + "," +
           num(lfw.world().right()) + "," + num(lfw.world().near_plane()) + "," +
           num(lfw.world().far_plane()));
    } else if (op == "mtrange") {
      const double a = to_double(t[i++]);
      const double b = to_double(t[i++]);
      push("mtrange|" + num(lfw.mt_ref().range(a, b)));
    } else if (op == "entadd") {
      const std::u16string id = key_of(t[i++]);
      const double n = to_double(t[i++]);
      // 4BP：可选的 team token（`-` = 缺省自动新队）与 type token（缺省 8）。
      std::optional<std::u16string> team;
      if (i < t.size()) {
        const std::u16string tok = key_of(t[i++]);
        if (tok != u"-") team = tok;
      }
      double type_id = 8.0;
      if (i < t.size()) type_id = to_double(t[i++]);
      // 4BP：带上真数据（`fg1` 等）的 `base` / `frames`，其余字段不搬（TS 侧碰 texml getter 会炸）。
      const lfw::Value real = lfw.datas_find(lfw::Value(id));
      lfw::Object o;
      lfw::Object base;
      if (const lfw::Object* const rb = lfw::as_object(lfw::field_or(real, u"base"))) {
        for (const std::u16string& k : rb->keys()) base.set(k, *rb->get(k));
      }
      o.set(u"type", lfw::Value(type_id));
      o.set(u"id", lfw::Value(id));
      o.set(u"base", lfw::Value(std::make_shared<lfw::Object>(base)));
      const lfw::Value frames = lfw::field_or(real, u"frames");
      if (!std::holds_alternative<lfw::NullTag>(frames) &&
          !std::holds_alternative<std::monostate>(frames)) {
        o.set(u"frames", frames);
      }
      const std::vector<lfw::Entity*> ret = lfw.entities_helper().add(
          lfw::Value(std::make_shared<lfw::Object>(o)), n, team.has_value() ? &*team : nullptr);
      push("entadd|" + to_ascii(lfw::number_to_string(static_cast<double>(ret.size()))));
    } else if (op == "getter") {
      const std::u16string w = key_of(t[i++]);
      push("getter|" + to_ascii(w) + "|" +
           (lfw::loader::get_val_getter_from_stage(w) != nullptr ? "1" : "0"));
    } else if (op == "endtest") {
      std::vector<std::u16string> words;
      while (i < t.size()) words.push_back(key_of(t[i++]));
      auto arr = std::make_shared<lfw::Array>();
      for (const std::u16string& w : words) arr->push_back(lfw::Value(w));
      lfw::Object owner;
      owner.set(u"end_test", lfw::Value(std::move(arr)));
      const lfw::stage::Expressions<lfw::stage::Stage>::Items items =
          lfw.end_testers(lfw::Value(std::make_shared<lfw::Object>(owner)));
      std::string wj;
      for (size_t k = 0; k < words.size(); ++k) {
        if (k != 0) wj += ",";
        wj += to_ascii(words[k]);
      }
      push("endtest|" + wj + "|" +
           to_ascii(lfw::number_to_string(static_cast<double>(items.size()))));
    } else if (op == "keys2") {
      push(std::string("keys2|") + (lfw.keys() == lfw.keys() ? "1" : "0"));
    } else if (op == "keysgo") {
      lfw::Keys* const k = lfw.create_keys();
      const std::string before = to_ascii(lfw::number_to_string(
          static_cast<double>(lfw.mounted_keys.size())));
      lfw.regist_keys(*k);
      lfw.recycle_keys(*k);
      lfw.regist_keys(*k);
      push("keysgo|" + before + "|" +
           to_ascii(lfw::number_to_string(static_cast<double>(lfw.mounted_keys.size()))));
    } else if (op == "instcount") {
      push("instcount|" + to_ascii(lfw::number_to_string(
                              static_cast<double>(lfw::LFW::instances().size()))));
    } else if (op == "dispose") {
      lfw.dispose();
      push("dispose|" + to_ascii(lfw::number_to_string(
                            static_cast<double>(lfw::LFW::instances().size()))));
    } else if (op == "lznew") {
      auto z = std::make_unique<LoadZip>();
      z->zid = t[i++];
      z->zip_name = key_of(t[i++]);
      if (i < t.size()) z->zip_md5 = key_of(t[i++]);
      g_lzips[z->zid] = std::move(z);
    } else if (op == "lzadd") {
      const std::string zid = to_ascii(key_of(t[i++]));
      LoadScript s;
      s.path = to_ascii(key_of(t[i++]));
      s.kind = t[i++];
      g_lzips[zid]->scripts.push_back(s);
    } else if (op == "imp") {
      const std::string key = t[i++];
      g_imports[key] = build_kind_value(t[i++]);
    } else if (op == "impfail") {
      const std::string key = t[i++];
      g_import_fails[key] = i < t.size() ? t[i++] : "boom";
    } else if (op == "zips") {
      std::string names;
      const std::vector<lfw::IZip*> zs = lfw.zips().zips();
      for (size_t j = 0; j < zs.size(); ++j) {
        if (j != 0) names += ",";
        names += to_ascii(zs[j]->name());
      }
      std::string md5s;
      const std::vector<lfw::IDataInfo*> infos = lfw.zips().data_infos();
      for (size_t j = 0; j < infos.size(); ++j) {
        if (j != 0) md5s += ",";
        md5s += to_ascii(lfw::to_string(infos[j]->md5));
      }
      push("zips|" + names + "|" + md5s);
    } else if (op == "collect") {
      const std::vector<lfw::IDataInfo> infos = lfw::LFW::collect_data_infos();
      std::string body;
      for (size_t j = 0; j < infos.size(); ++j) {
        if (j != 0) body += ";";
        body += to_ascii(lfw::to_string(infos[j].type)) + ":" +
                to_ascii(lfw::to_string(infos[j].url)) + ":" +
                to_ascii(lfw::to_string(infos[j].title)) + ":" +
                to_ascii(lfw::to_string(infos[j].md5));
      }
      push("collect|" + to_ascii(lfw::number_to_string(static_cast<double>(infos.size()))) +
           "|" + body);
    } else if (op == "lstate") {
      push(std::string("lstate|loading=") + (lfw.loading() ? "1" : "0") + "|playable=" +
           (lfw.playable() ? "1" : "0") + "|ui=" + (lfw.ui_loaded() ? "1" : "0") +
           "|disposed=" + (lfw.disposed() ? "1" : "0"));
    } else if (op == "bgms") {
      std::string names;
      for (size_t j = 0; j < lfw.bgms.size(); ++j) {
        if (j != 0) names += ",";
        names += to_ascii(lfw.bgms[j]);
      }
      push("bgms|" + names);
    } else if (op == "loadobj") {
      const std::string zid = to_ascii(key_of(t[i++]));
      const auto it = g_lzips.find(zid);
      lfw::LFW::LoadedZip z;
      std::u16string err;
      if (it == g_lzips.end()) push("loadobj|missing|" + zid);
      else if (!lfw.load_zip_from_object(*it->second, z, err)) {
        push("loadobj|fail|" + to_ascii(err));
      } else {
        push("loadobj|ok|" + dump_info(z.info));
      }
    } else if (op == "loaddata") {
      const std::string zid = to_ascii(key_of(t[i++]));
      const auto it = g_lzips.find(zid);
      lfw::LFW::LoadedZip z;
      std::u16string err;
      if (it == g_lzips.end()) push("loaddata|missing|" + zid);
      else if (!lfw.load_zip_from_object(*it->second, z, err)) {
        push("loaddata|fail|" + to_ascii(err));
      } else if (!lfw.load_data(z, err)) {
        push("loaddata|fail|" + to_ascii(err));
      } else {
        push("loaddata|ok");
      }
    } else if (op == "load") {
      std::vector<lfw::LFW::ZipItem> items;
      while (i < t.size()) {
        const std::string tok = t[i++];
        if (tok.rfind("z:", 0) == 0) {
          const auto it = g_lzips.find(tok.substr(2));
          items.push_back(lfw::LFW::ZipItem{u"", it == g_lzips.end() ? nullptr : it->second.get()});
        } else {
          items.push_back(lfw::LFW::ZipItem{key_of(tok.rfind("s:", 0) == 0 ? tok.substr(2) : tok),
                                             nullptr});
        }
      }
      std::u16string err;
      push(lfw.load(items, err) ? "load|ok" : "load|fail|" + to_ascii(err));
    } else if (op == "stored") {
      const std::string url = t[i++];
      const std::string md5 = t[i++];
      g_stored[url + "|" + md5] = t[i++];
    } else if (op == "cachelog") {
      // TS 侧用它打开 `Cache.get/put/del` 的日志（构造期 PlayerInfo 会读缓存，默认静音）。
    } else if (op == "blob" || op == "buf") {
      const std::string token = t[i++];
      g_blob_to_zip[token] = t[i++];
    } else if (op == "dl") {
      DlScript s;
      const std::string url = t[i++];
      s.mode = t[i++];
      s.token = t[i++];
      const std::string md5 = t[i++];
      if (md5 != "-") {
        s.md5 = md5;
        s.has_md5 = true;
      }
      s.size = to_double(t[i++]);
      g_dls[url] = s;
    } else if (op == "cacheblob" || op == "cachedata") {
      const std::string key = t[i++];
      lfw::Object o;
      o.set(u"name", lfw::Value(to_u16(t[i++])));
      o.set(op == "cacheblob" ? u"blob" : u"data", lfw::Value(to_u16(t[i++])));
      g_caches[key] = lfw::Value(std::make_shared<lfw::Object>(o));
    } else if (op == "cachelate") {
      const std::string key = t[i++];
      lfw::Object o;
      o.set(u"name", lfw::Value(to_u16(t[i++])));
      o.set(u"blob", lfw::Value(to_u16(t[i++])));
      g_cache_late[key] = lfw::Value(std::make_shared<lfw::Object>(o));
    } else if (op == "impinfo") {
      const std::string key = t[i++];
      const std::string url = t[i++];
      const std::string md5 = t[i++];
      lfw::Object o;
      o.set(u"type", lfw::Value(std::u16string(u"FULL")));
      if (url != "-") o.set(u"url", lfw::Value(to_u16(url)));
      o.set(u"title", lfw::Value(std::u16string(u"T")));
      if (md5 != "-") o.set(u"md5", lfw::Value(to_u16(md5)));
      g_imports[key] = lfw::Value(std::make_shared<lfw::Object>(o));
    } else if (op == "url") {
      const std::u16string info_url = key_of(t[i++]);
      lfw::LFW::LoadedZip z;
      std::u16string err;
      if (!lfw.load_zip_from_url(info_url, z, err)) push("url|fail|" + to_ascii(err));
      else push("url|ok|" + to_ascii(z.zip->name()) + "|" + dump_info(z.info));
    } else if (op == "uinew") {
      const std::string id = t[i++];
      g_ui_vals[id] = parse_value(t, i);
    } else if (op == "uinest") {
      const std::string cid = t[i++];
      const std::string pid = t[i++];
      lfw::Object* const child = lfw::as_object(g_ui_vals.at(cid));
      child->set(u"parent", g_ui_vals.at(pid));
    } else if (op == "uifind") {
      const std::string id = t[i++];
      const std::u16string name = key_of(t[i++]);
      lfw::Value out;
      lfw::ui::find_ui_template(lfw, &g_ui_vals.at(id), name, out);
      push("uifind|" + to_ascii(render_value(out)));
    } else if (op == "uimerge") {
      const std::string pid = t[i++];
      const lfw::Value* const parent = pid == "-" ? nullptr : &g_ui_vals.at(pid);
      const lfw::Value raw_info = parse_value(t, i);
      push("uimerge|" + to_ascii(render_value(lfw::ui::merge_ui_template(lfw, raw_info, parent))));
    } else if (op == "ucook") {
      const std::string pid = t[i++];
      const lfw::Value* const parent = pid == "-" ? nullptr : &g_ui_vals.at(pid);
      const lfw::Value info = parse_value(t, i);
      lfw::Value out;
      std::u16string err;
      if (lfw::ui::cook_ui_info(lfw, info, parent, out, err)) {
        std::set<const void*> stack;
        push("ucook|" + to_ascii(render_cycle_safe(out, stack)));
      } else {
        push("ucook|err|" + trace::esc(err));
      }
    } else if (op == "devon") {
      lfw.dev_mode = true;
    } else if (op == "devoff") {
      lfw.dev_mode = false;
    } else if (op == "impsoft") {
      const std::string key = t[i++];
      g_import_fails[key] = "soft";
    } else if (op == "uimg") {
      const std::string vid = t[i++];
      const lfw::Value img = parse_value(t, i);
      lfw::Value out;
      std::u16string err;
      if (lfw::ui::ui_load_img(lfw, img, out, err)) {
        push("uimg|" + vid + "|ok|" + to_ascii(render_value(out)));
      } else {
        push("uimg|" + vid + "|err|" + trace::esc(err));
      }
    } else if (op == "imgset") {
      const std::string key = t[i++];
      g_images[key] = parse_value(t, i);
    } else if (op == "newp") {
      const std::string id = t[i++];
      const double x = to_double(t[i++]);
      const double y = to_double(t[i++]);
      const double z = to_double(t[i++]);
      const double btn = to_double(t[i++]);
      g_pevs.emplace(id, lfw::ui::LFWPointerEvent(lfw::Vector3(x, y, z), btn));
    } else if (op == "newk") {
      const std::string id = t[i++];
      const std::u16string player = key_of(t[i++]);
      const bool pressed = t[i++] == "1";
      const std::u16string gk = key_of(t[i++]);
      const std::u16string key = key_of(t[i++]);
      g_kevs.emplace(id, lfw::ui::LFWKeyEvent(player, pressed, gk, key));
    } else if (op == "stp" || op == "sti") {
      const std::string id = t[i++];
      lfw::ui::IUIEvent* e = nullptr;
      if (const auto p = g_pevs.find(id); p != g_pevs.end()) e = &p->second;
      else if (const auto k = g_kevs.find(id); k != g_kevs.end()) e = &k->second;
      if (e == nullptr) {
        std::fprintf(stderr, "unknown event '%s'\n", id.c_str());
        return 2;
      }
      if (op == "stp") e->stop_propagation();
      else e->stop_immediate_propagation();
    } else if (op == "rdp") {
      const std::string id = t[i++];
      lfw::ui::LFWPointerEvent& p = g_pevs.at(id);
      push("rdp|" + id + "|" + num(p.point.x) + "|" + num(p.point.y) + "|" + num(p.point.z) +
           "|" + num(p.button) + "|" + std::to_string(p.stopped()));
    } else if (op == "rdk") {
      const std::string id = t[i++];
      lfw::ui::LFWKeyEvent& k = g_kevs.at(id);
      push("rdk|" + id + "|" + trace::esc(k.player) + "|" + trace::esc(k.game_key) + "|" +
           trace::esc(k.key) + "|" + (k.pressed ? "1" : "0") + "|" +
           std::to_string(k.stopped()));
    } else if (op == "imnode") {
      const std::string lid = t[i++];
      const std::string nid = t[i++];
      if (nid == "-") {
        g_loaders[lid] = std::make_unique<lfw::ui::UIImgLoader>(
            []() -> lfw::ui::IUIImgLoaderNode* { return nullptr; });
      } else {
        if (g_img_nodes.find(nid) == g_img_nodes.end()) {
          auto n = std::make_unique<FakeImgNode>();
          n->lfw_ = &lfw;
          g_img_nodes[nid] = std::move(n);
        }
        FakeImgNode* const node = g_img_nodes[nid].get();
        g_loaders[lid] = std::make_unique<lfw::ui::UIImgLoader>(
            [node]() -> lfw::ui::IUIImgLoaderNode* { return node; });
      }
    } else if (op == "imjid") {
      const lfw::Times& j = g_loaders.at(t[i++])->jid();
      push("imjid|" + num(j.value()) + "|" + num(j.min()) + "|" + num(j.max()));
    } else if (op == "imignore") {
      g_loaders.at(t[i++])->ignore_out_of_date();
    } else if (op == "imload" || op == "imset") {
      const std::string lid = t[i++];
      lfw::ui::UIImgLoader& loader = *g_loaders.at(lid);
      lfw::ui::UIImgLoadResult r;
      if (op == "imload") {
        const lfw::Value img = parse_value(t, i);
        r = loader.load(img);
      } else {
        r = loader.set_img(key_of(t[i++]));
      }
      if (r.ok) {
        push("imload|ok|" + to_ascii(render_value(r.image)));
      } else if (r.out_of_date) {
        push("imload|err|" + trace::esc(r.error) + "|ood|" + to_ascii(render_value(r.texture)));
      } else {
        push("imload|err|" + trace::esc(r.error));
      }
    } else if (op == "nod" || op == "noc") {
      const std::string nid = t[i++];
      lfw::ui::UINode* parent = nullptr;
      if (op == "noc") parent = g_nodes.at(t[i++]).get();
      const lfw::Value data = parse_value(t, i);
      g_nodes[nid] = std::make_unique<lfw::ui::UINode>(lfw, data, parent);
    } else if (op == "nadd") {
      lfw::ui::UINode& parent = *g_nodes.at(t[i++]);
      lfw::ui::UINode& child = *g_nodes.at(t[i++]);
      parent.add_child(child);
    } else if (op == "nfn") {
      lfw::ui::UINode& n = *g_nodes.at(t[i++]);
      const std::string tok = t[i++];
      n.set_focused_node(tok == "-" ? nullptr : g_nodes.at(tok).get());
    } else if (op == "nset") {
      const std::string nid = t[i++];
      const std::string what = t[i++];
      lfw::ui::UINode& n = pick_node(nid);
      if (what == "x") n.set_x(to_double(t[i++]));
      else if (what == "y") n.set_y(to_double(t[i++]));
      else if (what == "z") n.set_z(to_double(t[i++]));
      else if (what == "w") n.set_w(to_double(t[i++]));
      else if (what == "h") n.set_h(to_double(t[i++]));
      else if (what == "cx") n.set_cx(to_double(t[i++]));
      else if (what == "cy") n.set_cy(to_double(t[i++]));
      else if (what == "cz") n.set_cz(to_double(t[i++]));
      else if (what == "sx") n.set_sx(to_double(t[i++]));
      else if (what == "sy") n.set_sy(to_double(t[i++]));
      else if (what == "sz") n.set_sz(to_double(t[i++]));
      else if (what == "visible") n.set_visible(t[i++] == "1");
      else if (what == "disabled") n.set_disabled(t[i++] == "1");
      else if (what == "opacity") n.set_opacity(to_double(t[i++]));
      else if (what == "clip") n.set_clip_children(t[i++] == "1");
      else if (what == "focused") n.set_focused(t[i++] == "1");
      else if (what == "background" || what == "foreground") {
        const std::string tok = t[i++];
        const std::optional<std::u16string> v = tok == "-" ? std::nullopt : std::optional<std::u16string>(key_of(tok));
        if (what == "background") n.set_background(v);
        else n.set_foreground(v);
      } else if (what == "backgroundAlpha" || what == "foregroundAlpha") {
        const std::string tok = t[i++];
        const std::optional<double> v = tok == "-" ? std::nullopt : std::optional<double>(to_double(tok));
        if (what == "backgroundAlpha") n.set_background_alpha(v);
        else n.set_foreground_alpha(v);
      } else if (what == "outlineColor" || what == "outlineWidth" || what == "outlineAlpha") {
        const lfw::Value v = parse_value(t, i);
        if (what == "outlineColor") n.set_outline_color(v);
        else if (what == "outlineWidth") n.set_outline_width(v);
        else n.set_outline_alpha(v);
      } else if (what == "global_pos") {
        const double x = to_double(t[i++]);
        const double y = to_double(t[i++]);
        const double z = to_double(t[i++]);
        n.set_global_pos(x, y, z);
      } else if (what == "resize3" || what == "move3" || what == "center3" || what == "scale3") {
        const double x = to_double(t[i++]);
        const double y = to_double(t[i++]);
        const double z = to_double(t[i++]);
        if (what == "resize3") n.resize(x, y, z);
        else if (what == "move3") n.move_to(x, y, z);
        else if (what == "center3") n.set_center(x, y, z);
        else n.set_scale(x, y, z);
      } else if (what == "update") {
        n.update(to_double(t[i++]));
      } else if (what == "updaten") {
        // 4BV：多帧推进（`Times.add()` 逐帧 +1，需要「跑 N 帧」的台面节）。
        const double count = to_double(t[i++]);
        const double dt = to_double(t[i++]);
        for (double k = 0; k < count; ++k) n.update(dt);
        push("nupd|" + nid + "|" + num(count));
      } else if (what == "text") {
        n.set_text(key_of(t[i++]));
      } else if (what == "text2") {
        const std::u16string s = key_of(t[i++]);
        n.set_text(s, parse_value(t, i));
      } else if (what == "texti") {
        n.set_text_object(parse_value(t, i));
      } else if (what == "image") {
        n.set_image(parse_value(t, i));
      } else if (what == "style_assign") {
        n.style.assign(parse_value(t, i));
      } else if (what == "style_touch") {
        n.style.touch();
      } else {
        std::fprintf(stderr, "unknown nset '%s'\n", what.c_str());
        return 2;
      }
    } else if (op == "nrd") {
      const std::string nid = t[i++];
      const std::string what = t[i++];
      // 4D2：走 `pick_node`（与 TS 侧 `tnodes` 同义：别名表优先）⇒ `flpage`/`npg` 的别名也能读。
      lfw::ui::UINode& n = pick_node(nid);
      if (what == "pos" || what == "scale" || what == "size" || what == "center") {
        const lfw::Vector3& v = what == "pos"     ? n.pos
                                : what == "scale" ? n.scale
                                : what == "size"  ? n.size
                                                   : n.center;
        push("nrd|" + nid + "|" + what + "|" + num(v.x) + "|" + num(v.y) + "|" + num(v.z));
      } else if (what == "clip") {
        push("nrd|" + nid + "|clip|" + (n.clip_children() ? "1" : "0"));
      } else if (what == "cross") {
        const lfw::ui::UINode::Cross& c = n.cross();
        push("nrd|" + nid + "|cross|" + num(c.left) + "|" + num(c.top) + "|" + num(c.right) +
             "|" + num(c.bottom) + "|" + num(c.mid_x) + "|" + num(c.mid_y));
      } else if (what == "rect") {
        const lfw::ui::UINode::Rect& r = n.rect();
        push("nrd|" + nid + "|rect|" + num(r.left) + "|" + num(r.top) + "|" + num(r.right) +
             "|" + num(r.bottom));
      } else if (what == "geo") {
        const lfw::ui::UINode::Geo& g = n.geo();
        push("nrd|" + nid + "|geo|" + num(g.pos_x) + "|" + num(g.pos_y) + "|" + num(g.left) +
             "|" + num(g.top) + "|" + num(g.right) + "|" + num(g.bottom));
      } else if (what == "gp") {
        const lfw::Vector3& g = n.global_pos();
        push("nrd|" + nid + "|gp|" + num(g.x) + "|" + num(g.y) + "|" + num(g.z));
      } else if (what == "flags") {
        push("nrd|" + nid + "|flags|" + (n.visible() ? "1" : "0") +
             (n.self_visible() ? "1" : "0") + (n.disabled() ? "1" : "0") +
             (n.self_disabled() ? "1" : "0"));
      } else if (what == "op") {
        push("nrd|" + nid + "|op|" + num(n.opacity()) + "|" + num(n.global_opacity()));
      } else if (what == "bg") {
        push("nrd|" + nid + "|bg|" + trace::esc(n.background()) + "|" +
             num(n.backgroundAlpha()));
      } else if (what == "fg") {
        push("nrd|" + nid + "|fg|" + trace::esc(n.foreground()) + "|" +
             num(n.foregroundAlpha()));
      } else if (what == "outline") {
        push("nrd|" + nid + "|outline|" + to_ascii(render_value(n.outlineColor())) + "|" +
             to_ascii(render_value(n.outlineWidth())) + "|" +
             to_ascii(render_value(n.outlineAlpha())));
      } else if (what == "id") {
        push("nrd|" + nid + "|id|" + to_ascii(render_value(n.id())) + "|" +
             to_ascii(render_value(n.name())) + "|" + num(n.depth()));
      } else if (what == "depth") {
        push("nrd|" + nid + "|depth|" + num(n.depth()));
      } else if (what == "lifetime") {
        push("nrd|" + nid + "|lifetime|" + num(n.lifetime()));
      } else if (what == "ptr") {
        push("nrd|" + nid + "|ptr|" + std::to_string(n.pointer_over()) + "|" +
             std::to_string(n.pointer_down()) + "|" + std::to_string(n.click_flag()));
      } else if (what == "foc") {
        push("nrd|" + nid + "|foc|" + (n.focused() ? "1" : "0") + "|" +
             node_ref(n.focused_node()));
      } else if (what == "state") {
        push("nrd|" + nid + "|state|" + to_ascii(render_value(n.state())));
      } else if (what == "value") {
        const std::u16string name = key_of(t[i++]);
        push("nrd|" + nid + "|value|" + to_ascii(render_value(n.get_value(name))));
      } else if (what == "fc" || what == "sn" || what == "ln" || what == "fp") {
        const std::u16string id = key_of(t[i++]);
        lfw::ui::UINode* hit = what == "fc"   ? n.find_child(id)
                               : what == "sn" ? n.search_node(id)
                               : what == "ln" ? n.lookup_node(id)
                                               : n.find_parent_by_id(id);
        push("nrd|" + nid + "|" + what + "|" + node_ref(hit));
      } else if (what == "fcn") {
        const std::u16string nm = key_of(t[i++]);
        push("nrd|" + nid + "|fcn|" + node_ref(n.find_child_by_name(nm)));
      } else if (what == "hit") {
        const double x = to_double(t[i++]);
        const double y = to_double(t[i++]);
        push("nrd|" + nid + "|hit|" + (n.hit(x, y) ? "1" : "0"));
      } else if (what == "text") {
        const lfw::Value& tv = n.text();
        const bool tv_null = std::holds_alternative<std::monostate>(tv) ||
                             std::holds_alternative<lfw::NullTag>(tv);
        if (tv_null) {
          push("nrd|" + nid + "|text|null");
        } else {
          const bool ver = n.text_style_is_node_style();
          const std::u16string sv =
              ver ? (u"v" + lfw::number_to_string(n.style.version())) : u"-";
          std::u16string sj = u"-";
          std::string sj_out = "-";
          if (!ver) {
            const lfw::Value* const st = lfw::ui::field_of(tv, u"style");
            const lfw::Value s2 = st != nullptr && !std::holds_alternative<std::monostate>(*st) &&
                                          !std::holds_alternative<lfw::NullTag>(*st)
                                      ? *st
                                      : lfw::Value(std::make_shared<lfw::Object>());
            const std::optional<std::u16string> js = lfw::json_stringify(s2);
            sj = js.has_value() ? *js : u"undefined";
            sj_out = trace::esc(sj);
          }
          push("nrd|" + nid + "|text|" + to_ascii(render_value(lfw::field_or(tv, u"text"))) +
               "|" + to_ascii(render_value(lfw::field_or(tv, u"w"))) + "|" +
               to_ascii(render_value(lfw::field_or(tv, u"h"))) + "|" +
               to_ascii(render_value(lfw::field_or(tv, u"scale"))) + "|" + to_ascii(sv) +
               "|" + sj_out);
        }
      } else if (what == "style") {
        push("nrd|" + nid + "|style|" + to_ascii(render_value(n.style.data())));
      } else if (what == "image") {
        push("nrd|" + nid + "|image|" + to_ascii(render_value(n.image())));
      } else if (what == "color") {
        push("nrd|" + nid + "|color|" + to_ascii(render_value(lfw::Value(n.color))));
      } else if (what == "opacity") {
        push("nrd|" + nid + "|opacity|" + num(n.opacity()));
      } else if (what == "kids") {
        std::string line = "nrd|" + nid + "|kids|" +
                           std::to_string(n.children().size());
        for (lfw::ui::UINode* const c : n.children()) line += "|" + node_ref(c);
        push(line);
      } else {
        std::fprintf(stderr, "unknown nrd '%s'\n", what.c_str());
        return 2;
      }
    } else if (op == "npd" || op == "npm" || op == "npu" || op == "npc") {
      const std::string nid = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::LFWPointerEvent e(lfw::Vector3(0, 0, 0), 0.0);
      if (op == "npd") n.on_pointer_down(e);
      else if (op == "npm") n.on_pointer_move(e);
      else if (op == "npu") n.on_pointer_up(e);
      else n.on_pointer_cancel(e);
      push("np|" + nid + "|" + op + "|stop=" + std::to_string(e.stopped()));
    } else if (op == "npl" || op == "npe") {
      const std::string nid = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      if (op == "npl") n.on_pointer_leave();
      else n.on_pointer_enter();
      push("np|" + nid + "|" + op);
    } else if (op == "nmk") {
      const std::string nid = t[i++];
      const std::string ptok = t[i++];
      lfw::ui::UINode* parent = ptok == "-" ? nullptr : g_nodes.at(ptok).get();
      const lfw::Value data = parse_value(t, i);
      g_nodes[nid] = lfw::ui::UINode::create(lfw, data, parent);
    } else if (op == "nlife") {
      const std::string nid = t[i++];
      const std::string what = t[i++];
      lfw::ui::UINode& n = pick_node(nid);
      g_defer_pins = true;
      if (what == "start") n.on_start();
      else if (what == "stop") n.on_stop();
      else if (what == "resume") n.on_resume();
      else if (what == "pause") n.on_pause();
      else if (what == "show") n.on_show();
      else if (what == "hide") n.on_hide();
      else if (what == "blur") n.on_blur();
      else if (what == "foucs") n.on_foucs();
      else {
        std::fprintf(stderr, "unknown nlife '%s'\n", what.c_str());
        return 2;
      }
      g_defer_pins = false;
      drain_pins();
    } else if (op == "nclick") {
      const std::string nid = t[i++];
      const double btn = to_double(t[i++]);
      lfw::ui::LFWPointerEvent e(lfw::Vector3(0, 0, 0), btn);
      pick_node(nid).on_click(e);
      push("click|" + nid + "|stop=" + std::to_string(e.stopped()));
    } else if (op == "nkey") {
      const std::string nid = t[i++];
      const std::string dir = t[i++];
      const std::u16string gk = key_of(t[i++]);
      const std::u16string key = key_of(t[i++]);
      const bool pre = i < t.size() && t[i] == "1";
      if (pre) ++i;
      lfw::ui::LFWKeyEvent e(std::u16string(), dir == "down", gk, key);
      if (pre) e.stop_immediate_propagation();
      lfw::ui::UINode& n = pick_node(nid);
      if (dir == "down") n.on_key_down(e);
      else n.on_key_up(e);
      push("nkey|" + nid + "|" + dir + "|stop=" + std::to_string(e.stopped()));
    } else if (op == "nml") {
      const std::string nid = t[i++];
      const std::string lt = t[i++];
      lfw::ui::UILayer* layer = nullptr;
      if (lt != "-" && g_real_layers) layer = g_real_layers->at(to_double(lt));
      const lfw::Value data = parse_value(t, i);
      g_nodes[nid] = lfw::ui::UINode::create(lfw, data, nullptr, layer);
    } else if (op == "cadd" || op == "cdel" || op == "lcomp" || op == "cupd" || op == "cfind" ||
               op == "cset") {
      const std::string nid = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      if (op == "cadd") {
        const std::string cid = t[i++];
        const lfw::Value props = parse_value(t, i);
        lfw::Value info(std::make_shared<lfw::Object>());
        lfw::Object* const o = const_cast<lfw::Object*>(lfw::as_object(info));
        o->set(u"id", lfw::Value(key_of(cid)));
        o->set(u"name", lfw::Value(key_of(cid)));
        o->set(u"cls", lfw::Value(std::u16string(u"FakeComp")));
        o->set(u"args", lfw::Value(std::make_shared<lfw::Array>()));
        o->set(u"enabled", lfw::Value(true));
        o->set(u"properties", props);
        o->set(u"props", lfw::Value(std::make_shared<lfw::Object>()));
        o->set(u"weight", lfw::Value(0.0));
        std::unique_ptr<bench::FakeComp> c =
            std::make_unique<bench::FakeComp>(n, key_of(cid), info);
        n.add_components(*c);
        g_components[cid] = std::move(c);
        push("cadd|" + nid + "|" + cid + "|" + std::to_string(n.components().size()));
      } else if (op == "cdel") {
        const std::string cid = t[i++];
        const auto it = g_components.find(cid);
        lfw::ui::UIComponent* const c = it != g_components.end() ? it->second.get() : nullptr;
        if (c != nullptr) {
          n.del_components(*c);
          g_components.erase(it);
        }
        push("cdel|" + nid + "|" + cid + "|" + std::to_string(n.components().size()));
      } else if (op == "lcomp") {
        push("lcomp|" + nid + "|" + std::to_string(n.components().size()));
        size_t k = 0;
        for (lfw::ui::UIComponent* const c : n.components()) {
          push("fc|list|" + std::to_string(k) + "|" + to_ascii(c->props_tag()) + "|" +
               to_ascii(c->f_name) + "|" + to_ascii(c->id) + "|" + to_ascii(c->name) + "|" +
               (c->enabled() ? "b1" : "b0"));
          ++k;
        }
      } else if (op == "cupd") {
        n.update(to_double(t[i++]));
        push("cupd|" + nid);
      } else if (op == "cset") {
        const std::string cid = t[i++];
        const bool on = t[i++] == "1";
        lfw::ui::UIComponent* found = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->id == key_of(cid)) {
            found = c;
            break;
          }
        }
        if (found != nullptr) found->set_enabled(on);
        push("cset|" + nid + "|" + cid + "|" +
             (found != nullptr && found->enabled() ? "b1" : "b0"));
      } else {
        const std::string cid = t[i++];
        const std::u16string which = key_of(t[i++]);
        lfw::ui::UIComponent* found = nullptr;
        for (lfw::ui::UIComponent* const c : n.components()) {
          if (c->id == key_of(cid)) {
            found = c;
            break;
          }
        }
        lfw::ui::UINode* const r = found != nullptr ? found->find_node(lfw::Value(which)) : nullptr;
        push("cfind|" + nid + "|" + cid + "|" + to_ascii(which) + "|" +
             (r != nullptr ? node_ref(r) : std::string("u")));
      }
    } else if (run_cmd_ops(lfw, host, t, i, op) || run_comp_ops(lfw, host, t, i, op) ||
               run_sum_ops(lfw, host, t, i, op) || run_lfag_ops(lfw, host, t, i, op) ||
               run_danmu_ops(lfw, host, t, i, op)) {
    } else if (op == "ird") {
      const std::string nid = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::IntegerPicker* p = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (!lfw::is_class(c->clazz(), lfw::ui::IntegerPicker::class_tag())) continue;
        p = static_cast<lfw::ui::IntegerPicker*>(c);
        break;
      }
      if (p == nullptr) push("ird|" + nid + "|none");
      else push("ird|" + nid + "|" + num(p->min()) + "|" + num(p->max()) + "|" + num(p->val()));
    } else if (op == "ibus") {
      const std::string nid = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::IntegerPicker* p = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (!lfw::is_class(c->clazz(), lfw::ui::IntegerPicker::class_tag())) continue;
        p = static_cast<lfw::ui::IntegerPicker*>(c);
        break;
      }
      if (p == nullptr) {
        push("ibus|" + nid + "|none");
      } else {
        lfw::ui::IntegerPicker* const self = p;
        p->callbacks.on(u"on_min_changed", [self](const lfw::ui::IntegerPickerCallbacks::Payloads& ps) {
          for (const lfw::ui::IntegerPickerCallbackArgs& a : ps)
            push("ibus|min|" + num(a.curr) + "|" + num(a.prev) + "|" +
                 (a.self == self ? "1" : "0"));
        });
        p->callbacks.on(u"on_max_changed", [self](const lfw::ui::IntegerPickerCallbacks::Payloads& ps) {
          for (const lfw::ui::IntegerPickerCallbackArgs& a : ps)
            push("ibus|max|" + num(a.curr) + "|" + num(a.prev) + "|" +
                 (a.self == self ? "1" : "0"));
        });
        p->callbacks.on(u"on_val_changed", [self](const lfw::ui::IntegerPickerCallbacks::Payloads& ps) {
          for (const lfw::ui::IntegerPickerCallbackArgs& a : ps)
            push("ibus|val|" + num(a.curr) + "|" + num(a.prev) + "|" +
                 (a.self == self ? "1" : "0"));
        });
      }
    } else if (op == "iput") {
      const std::string nid = t[i++];
      const std::string what = t[i++];
      const double v = to_double(t[i++]);
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::IntegerPicker* p = nullptr;
      for (lfw::ui::UIComponent* const c : n.components()) {
        if (!lfw::is_class(c->clazz(), lfw::ui::IntegerPicker::class_tag())) continue;
        p = static_cast<lfw::ui::IntegerPicker*>(c);
        break;
      }
      if (p == nullptr) push("iput|" + nid + "|none");
      else if (what == "min") p->set_min(v);
      else if (what == "max") p->set_max(v);
      else p->set_val(v);
    } else if (op == "nact") {
      const std::string nid = t[i++];
      const lfw::Value action = parse_value(t, i);
      lfw::ui::actor().act(*g_nodes.at(nid), action);
    } else if (op == "rlnew") {
      g_real_layers = std::make_unique<lfw::ui::UILayers>(lfw);
    } else if (op == "flset" || op == "flpush") {
      const std::u16string id = key_of(t[i++]);
      // 4D2：可选层号（缺省 0，照旧）；给了就能把页放到 `lfw.ui_layers()` 的第 N 层上。
      const double li = i < t.size() ? to_double(t[i++]) : 0.0;
      const lfw::Value opts = id_opts_value(id);
      if (op == "flset") lfw.set_page(opts, li);
      else lfw.push_page(opts, li);
    } else if (op == "rlpush") {
      g_real_layers->push_layer();
    } else if (op == "rlset" || op == "rlpushp") {
      const double idx = to_double(t[i++]);
      const std::u16string id = key_of(t[i++]);
      const lfw::Value opts = id_opts_value(id);
      if (op == "rlset") g_real_layers->set_page(opts, idx);
      else g_real_layers->push_page(opts, idx);
    } else if (op == "rlpop") {
      const double idx = to_double(t[i++]);
      const double min_pages = to_double(t[i++]);
      const bool inclusive = t[i++] == "1";
      const std::string until = t[i++];
      lfw::ui::UILayer* const l = g_real_layers->at(idx);
      lfw::ui::UIPopPageOpts opts;
      opts.min_pages = min_pages;
      opts.inclusive = inclusive;
      if (until != "-") {
        opts.until = [until](lfw::ui::UINode& n, double, const std::vector<lfw::ui::UINode*>&) {
          const lfw::Value idv = n.id();
          const std::u16string* const id = std::get_if<std::u16string>(&idv);
          return id != nullptr && *id == to_u16(until);
        };
      }
      if (l != nullptr) l->pop(opts);
    } else if (op == "rldisp") {
      g_real_layers->dispose();
    } else if (op == "rlinfo") {
      std::string line = "rlinfo|" + num(g_real_layers->length());
      for (lfw::ui::UILayer* const l : g_real_layers->all()) {
        if (l == nullptr) {
          line += "|-";
          continue;
        }
        std::string top = "u";
        if (lfw::ui::UINode* const u = l->ui()) {
          const lfw::Value idv = u->id();
          if (const std::u16string* const id = std::get_if<std::u16string>(&idv)) {
            top = to_ascii(*id);
          }
        }
        line += "|" + num(l->index()) + ":" + num(static_cast<double>(l->pages().size())) +
                ":" + top;
      }
      push(line);
    } else if (op == "rlui") {
      const double idx = to_double(t[i++]);
      const lfw::ui::UILayer* const l = g_real_layers->at(idx);
      lfw::ui::UINode* const u = l != nullptr ? l->ui() : nullptr;
      push("rlui|" + num(idx) + "|" + node_ref(u) + "|" +
           (u != nullptr ? num(u->z()) : std::string("u")));
    } else if (op == "rlz") {
      const double idx = to_double(t[i++]);
      const lfw::ui::UILayer* const l = g_real_layers->at(idx);
      const lfw::ui::UINode* const u = l != nullptr ? l->ui() : nullptr;
      push("rlz|" + num(idx) + "|" + (u != nullptr ? num(u->z()) : std::string("u")));
    } else if (op == "rlfind") {
      const double idx = to_double(t[i++]);
      const std::u16string nid = key_of(t[i++]);
      const lfw::ui::UILayer* const l = g_real_layers->at(idx);
      lfw::ui::UINode* const u = l != nullptr ? l->ui() : nullptr;
      lfw::ui::UINode* const hit = u != nullptr ? u->search_node(nid) : nullptr;
      push("rlfind|" + num(idx) + "|" + node_ref(hit) + "|" +
           (hit != nullptr ? num(hit->depth()) : std::string("u")));
    } else if (op == "rlfocus") {
      const double idx = to_double(t[i++]);
      const std::u16string nid = key_of(t[i++]);
      const bool v = t[i++] == "1";
      const lfw::ui::UILayer* const l = g_real_layers->at(idx);
      lfw::ui::UINode* const u = l != nullptr ? l->ui() : nullptr;
      lfw::ui::UINode* const hit = u != nullptr ? u->search_node(nid) : nullptr;
      if (hit != nullptr) hit->set_focused(v);
    } else if (op == "rlfn") {
      const double idx = to_double(t[i++]);
      const lfw::ui::UILayer* const l = g_real_layers->at(idx);
      lfw::ui::UINode* const u = l != nullptr ? l->ui() : nullptr;
      lfw::ui::UINode* const f =
          u != nullptr ? u->root().focused_node() : nullptr;
      push("rlfn|" + num(idx) + "|" + node_ref(f));
    } else if (op == "rltree") {
      const double idx = to_double(t[i++]);
      const lfw::ui::UILayer* const l = g_real_layers->at(idx);
      const lfw::ui::UINode* const u = l != nullptr ? l->ui() : nullptr;
      push("rltree|" + num(idx) + "|" + (u != nullptr ? tree_str(*u) : std::string("u")));
    } else if (op == "unpatch") {
      // C++ 无补丁；占位（TS 侧同 op 复原被改写的 uis/layers 方法）。
    } else if (op == "uipg") {
      const std::u16string id = key_of(t[i++]);
      lfw::Value v = parse_value(t, i);
      if (lfw::as_object(v) != nullptr) lfw::as_object(v)->set(u"id", lfw::Value(id));
      lfw.ui_helper().add({v});
    } else if (op == "rlact") {
      const double idx = to_double(t[i++]);
      const std::string ntok = t[i++];
      const lfw::Value action = parse_value(t, i);
      const lfw::ui::UILayer* const l = g_real_layers->at(idx);
      lfw::ui::UINode* u = l != nullptr ? l->ui() : nullptr;
      if (u != nullptr && ntok != "-") u = u->search_node(key_of(ntok));
      if (u != nullptr) lfw::ui::actor().act(*u, action);
    } else if (op == "ncb") {
      const std::string nid = t[i++];
      const std::string ev = t[i++];
      lfw::ui::UINode& n = *g_nodes.at(nid);
      lfw::ui::UINodeCallbacks& cb = n.callbacks;
      if (ev == "show") {
        cb.on_show = [nid](lfw::ui::UINode& node) { push("cb|" + nid + "|show|" + node_ref(&node)); };
      } else if (ev == "hide") {
        cb.on_hide = [nid](lfw::ui::UINode& node) { push("cb|" + nid + "|hide|" + node_ref(&node)); };
      } else if (ev == "foucs_changed") {
        cb.on_foucs_changed = [nid](lfw::ui::UINode& node) { push("cb|" + nid + "|foucs_changed|" + node_ref(&node)); };
      } else if (ev == "foucs_item_changed") {
        cb.on_foucs_item_changed = [nid](lfw::ui::UINode* f, lfw::ui::UINode* b) { push("cb|" + nid + "|foucs_item_changed|" + node_ref(f) + "|" + node_ref(b)); };
      } else if (ev == "pdown" || ev == "pmove" || ev == "pup" || ev == "pcancel") {
        const auto fn = [nid, ev](lfw::ui::LFWPointerEvent& e, lfw::ui::UINode&) {
          push("cb|" + nid + "|" + ev + "|" + to_ascii(render_value(lfw::Value(e.button))));
        };
        if (ev == "pdown") cb.on_pointer_down = fn;
        else if (ev == "pmove") cb.on_pointer_move = fn;
        else if (ev == "pup") cb.on_pointer_up = fn;
        else cb.on_pointer_cancel = fn;
      } else if (ev == "pleave") {
        cb.on_pointer_leave = [nid](lfw::ui::UINode& node) { push("cb|" + nid + "|pleave|" + node_ref(&node)); };
      } else if (ev == "penter") {
        cb.on_pointer_enter = [nid](lfw::ui::UINode& node) { push("cb|" + nid + "|penter|" + node_ref(&node)); };
      } else if (ev == "comp_add") {
        cb.on_component_add = [nid](lfw::ui::UIComponent& c, lfw::ui::UINode& node) {
          push("cb|" + nid + "|comp_add|" + to_ascii(c.f_name) + "#" + to_ascii(c.id) + "|" +
               node_ref(&node));
        };
      } else if (ev == "comp_del") {
        cb.on_component_del = [nid](lfw::ui::UIComponent& c, lfw::ui::UINode& node) {
          push("cb|" + nid + "|comp_del|" + to_ascii(c.f_name) + "#" + to_ascii(c.id) + "|" +
               node_ref(&node));
        };
      } else {
        std::fprintf(stderr, "unknown ncb '%s'\n", ev.c_str());
        return 2;
      }
    } else {
      std::fprintf(stderr, "unknown op '%s'\n", op.c_str());
      return 2;
    }
  }

  std::string joined;
  for (size_t k = 0; k < g_log.size(); ++k) {
    if (k != 0) joined += "\n";
    joined += g_log[k];
  }
  std::printf("%s\n", joined.c_str());
  return 0;
}
