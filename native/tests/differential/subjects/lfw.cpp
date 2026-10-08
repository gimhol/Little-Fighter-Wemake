// `LFW`（门面 4AB）的 C++ 侧台面，op 与 `subjects/lfw.ts` 一一对应。
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/defines/defines_data.h"
#include "lfw/entity/entity.h"
#include "lfw/factory.h"
#include "lfw/lfw.h"
#include "lfw/loader/stage_val_getters.h"
#include "lfw/player_info.h"
#include "lfw/ui/cook_ui_info.h"
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

std::string s_of(const lfw::Value& v) {
  const std::u16string* const s = std::get_if<std::u16string>(&v);
  return s != nullptr ? to_ascii(*s) : "u";
}

int g_ent_seq = 0;

// 实体宿主（静默）：`attach` 等副作用不发日志。
class EntHost : public lfw::IEntityHost {
 public:
  double game_time() const override { return 0.0; }
  std::u16string new_id() override {
    ++g_ent_seq;
    return u"e" + lfw::number_to_string(static_cast<double>(g_ent_seq));
  }
  void add_entities(lfw::Entity&) override {}
};

EntHost g_ent_host;

class FakeLayers : public lfw::IUiLayers {
 public:
  explicit FakeLayers(lfw::LFW& lfw) : _lfw(&lfw) {}
  void push() override {
    // TS 的 `layers.push()` 会触发 `on_push` → `lfw.callbacks.call("on_ui_changed", curr, prev)`
    // （空 uis ⇒ 两个 undefined）⇒ 端口同款回调一次。
    _lfw->ui_changed(nullptr, nullptr);
  }
  void set_page(const lfw::Value& opts, double) override {
    ::push("layers:set_page|" + to_ascii(lfw::to_string(lfw::field_or(opts, u"id"))));
    // TS 的 `UILayers.set_page` 会在 `uis.all` 里找页 ⇒ 台面把这次读也记出来。
    (void)_lfw->host().ui_all(*_lfw);
  }
  void push_page(const lfw::Value&, double) override {}
  void dispose() override {}
  lfw::ui::UINode* ui() override { return nullptr; }
  std::vector<lfw::IWorldUi*> layer_uis() override { return {}; }

 private:
  lfw::LFW* _lfw;
};

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

class FakeHost : public lfw::ILfwHost {
 public:
  explicit FakeHost(lfw::LFW** slot) : _slot(slot) {}

  double now() override { return 12345.0; }
  void sounds_init(lfw::LFW&) override { push("snd_init"); }
  void images_init(lfw::LFW&) override { push("img_init"); }
  void keyboard_init(lfw::LFW&) override { push("kbd_init"); }
  void pointings_init(lfw::LFW&) override { push("pt_init"); }
  void keyboard_add_callback(lfw::LFW&) override { push("kbd_cbadd"); }
  void pointings_add_ui_input(lfw::LFW&) override { push("pt_cbadd"); }
  void cache_forget(const std::u16string& type, double version) override {
    push("cache:forget|" + to_ascii(type) + "|" + num(version));
  }
  void zip_forget_stored(const std::u16string& type, double version) override {
    push("zip:forget|" + to_ascii(type) + "|" + num(version));
  }
  void regist_components() override {}
  lfw::IUiLayers* create_layers(lfw::LFW& lfw) override {
    _layers = std::make_unique<FakeLayers>(lfw);
    return _layers.get();
  }
  lfw::IWorldRenderer* create_world_renderer(lfw::LFW&) override {
    push("wr_init");
    return &_renderer;
  }
  void load_img(const std::u16string& path) override { push("img:load|" + to_ascii(path)); }

  bool dev() const override { return false; }
  void warn(const std::vector<lfw::Value>& args) override { push(join("warn", args)); }
  void error(const std::vector<lfw::Value>& args) override { push(join("error", args)); }
  void log(const std::vector<lfw::Value>& args) override { push(join("Log", args)); }
  void debug_msg(const std::vector<lfw::Value>& args) override { push(join("debug", args)); }

  std::function<void()> sounds_play_bgm(const lfw::Value&) override {
    push("snd_bgm");
    return [] {};
  }
  void sounds_stop_bgm() override { push("snd_stop"); }
  void sounds_play(const lfw::Value&, const lfw::Value&, const lfw::Value&,
                   const lfw::Value&) override {
    push("snd_play");
  }
  void sounds_play_with_load(const lfw::Value&) override { push("snd_load"); }
  void sounds_dispose() override { push("snd_dispose"); }
  void keyboard_dispose() override { push("kbd_dispose"); }
  void pointings_dispose() override { push("pt_dispose"); }

  lfw::Value measure_text(const lfw::Value&, const lfw::Value&) override {
    push("measure");
    return lfw::Value(std::u16string());
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
  bool ui_cook_path(lfw::LFW&, const std::u16string& path, lfw::Value& out,
                    std::u16string& error) override {
    push("ui:cook_path|" + to_ascii(path));
    out = lfw::Value();
    error = u"unscripted ui path";
    return false;
  }
  bool ui_cook_value(lfw::LFW&, const lfw::Value&, lfw::Value& out,
                     std::u16string& error) override {
    push("ui:cook_value");
    out = lfw::Value();
    error = u"unscripted ui value";
    return false;
  }
  bool ui_xml_to_info(lfw::LFW&, const std::shared_ptr<lfw::IXMLElement>&, lfw::Value& out) override {
    push("ui:xml_to_info");
    out = lfw::Value();
    return true;
  }
  void ui_add(lfw::LFW&, const std::vector<lfw::Value>& cooked) override {
    push("ui:add|" + to_ascii(lfw::number_to_string(static_cast<double>(cooked.size()))));
  }
  void ui_clear(lfw::LFW&) override { push("ui:clear"); }
  std::vector<lfw::Value> ui_all(lfw::LFW&) override {
    push("ui:all");
    return _ui_list;
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
  std::unique_ptr<FakeLayers> _layers;
  std::vector<lfw::Value> _ui_list;
  class Renderer : public lfw::IWorldRenderer {
   public:
    void add_entity(lfw::Entity&) override {}
    void del_entity(lfw::Entity&) override {}
    void render(double) override {}
    void dispose() override {}
  } _renderer;
};

std::vector<std::u16string> g_words;

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
  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  lfw::Factory::register_entity(
      lfw::Value(8.0), [](lfw::World*, const lfw::Value& data, lfw::state::States*) -> lfw::Entity* {
        push("entadd:create|" + s_of(lfw::field_or(data, u"id")));
        return new lfw::Entity(g_ent_host, data);
      });

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
      zips.push_back(lfw::LFW::ZipItem{key_of(t[i++]), nullptr});
      zips.push_back(lfw::LFW::ZipItem{key_of(t[i++]), nullptr});
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
      lfw.on_key_down(e);
      push("kbdown|" + to_ascii(key) + "|" + num(times) + "|" + dev + "|int=" +
           (e.interrupted ? "1" : "0"));
    } else if (op == "kbup") {
      const std::u16string key = key_of(t[i++]);
      lfw::LfwKeyEvent e;
      e.key = key;
      lfw.on_key_up(e);
      push("kbup|" + to_ascii(key));
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
      lfw.srank_mode = true;
      lfw.srank_available = true;
      lfw.survival_rank_2p = true;
      lfw.survival_rank_period = u"week";
      lfw::Object data;
      data.set(u"period", lfw::Value(std::u16string(u"week")));
      data.set(u"list", lfw::Value(std::make_shared<lfw::Array>()));
      data.set(u"mine", lfw::Value(lfw::NullTag{}));
      lfw.set_survival_rank_data(lfw::Value(std::make_shared<lfw::Object>(data)));
      push(std::string("srank|") + (lfw.survival_rank_mode() ? "1" : "0") +
           (lfw.survival_rank_available() ? "1" : "0") + (lfw.survival_rank_2p ? "1" : "0") + "|" +
           to_ascii(lfw.survival_rank_period) + "|cheated=" + (lfw.survival_rank_cheated() ? "1" : "0") +
           "|modded=" + (lfw.survival_rank_modded() ? "1" : "0") + "|invalid=" +
           (lfw.survival_rank_invalid() ? "1" : "0"));
    } else if (op == "randinfo") {
      lfw::Entity e(g_ent_host, lfw::Value(std::make_shared<lfw::Object>([] {
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
      lfw::Object o;
      o.set(u"type", lfw::Value(8.0));
      o.set(u"id", lfw::Value(id));
      const std::vector<lfw::Entity*> ret =
          lfw.entities_helper().add(lfw::Value(std::make_shared<lfw::Object>(o)), n);
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
    } else if (op == "devon") {
      lfw.dev_mode = true;
    } else if (op == "devoff") {
      lfw.dev_mode = false;
    } else if (op == "impsoft") {
      const std::string key = t[i++];
      g_import_fails[key] = "soft";
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
