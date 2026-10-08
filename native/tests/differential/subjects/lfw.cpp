// `LFW`（门面 4AB）的 C++ 侧台面，op 与 `subjects/lfw.ts` 一一对应。
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/core/json.h"
#include "lfw/defines/defines_data.h"
#include "lfw/entity/entity.h"
#include "lfw/factory.h"
#include "lfw/lfw.h"
#include "lfw/loader/stage_val_getters.h"
#include "lfw/player_info.h"
#include "lfw/ui/cook_ui_info.h"
#include "lfw/ui/action/actor.h"
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

// 4AK：`imgset` 的图片脚本（`ui_image_load` 按 img_key 查）。
std::map<std::string, lfw::Value> g_images;

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
    push("img:pin|" + to_ascii(img_key));
  }
  std::u16string md5(const std::u16string& text) override { return u"h:" + text; }

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
  void sounds_play_preset(const lfw::Value& name, const lfw::Value& x, const lfw::Value& y,
                          const lfw::Value& z) override {
    push("snd_preset|" + to_ascii(render_value(name)) + "|" + to_ascii(render_value(x)) + "|" +
         to_ascii(render_value(y)) + "|" + to_ascii(render_value(z)));
  }
  void sounds_dispose() override { push("snd_dispose"); }
  void keyboard_dispose() override { push("kbd_dispose"); }
  void pointings_dispose() override { push("pt_dispose"); }

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
      lfw::ui::UINode& n = *g_nodes.at(nid);
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
      lfw::ui::UINode& n = *g_nodes.at(nid);
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
      lfw::ui::UINode& n = *g_nodes.at(nid);
      if (what == "start") n.on_start();
      else if (what == "stop") n.on_stop();
      else if (what == "resume") n.on_resume();
      else if (what == "pause") n.on_pause();
      else {
        std::fprintf(stderr, "unknown nlife '%s'\n", what.c_str());
        return 2;
      }
    } else if (op == "nclick") {
      const std::string nid = t[i++];
      const double btn = to_double(t[i++]);
      lfw::ui::LFWPointerEvent e(lfw::Vector3(0, 0, 0), btn);
      g_nodes.at(nid)->on_click(e);
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
      lfw::ui::UINode& n = *g_nodes.at(nid);
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
    } else if (op == "nact") {
      const std::string nid = t[i++];
      const lfw::Value action = parse_value(t, i);
      lfw::ui::actor().act(*g_nodes.at(nid), action);
    } else if (op == "rlnew") {
      g_real_layers = std::make_unique<lfw::ui::UILayers>(lfw);
    } else if (op == "flset" || op == "flpush") {
      const std::u16string id = key_of(t[i++]);
      const lfw::Value opts = id_opts_value(id);
      if (op == "flset") lfw.set_page(opts, 0.0);
      else lfw.push_page(opts, 0.0);
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
