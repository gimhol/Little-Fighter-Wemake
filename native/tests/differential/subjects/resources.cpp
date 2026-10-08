// `Resources`（`src/LFW/Resources.ts`）的 C++ 侧台面，op 与 `subjects/resources.ts` 一一对应。
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/resources.h"
#include "lfw/zip_mgr.h"

#include "trace_util.h"

namespace {

using trace::key_of;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_u16;

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

const char* const kMethods[] = {"json", "text", "blob_url", "array_buffer", "image_bitmap"};

int method_index(const std::string& name) {
  for (int i = 0; i < 5; ++i) {
    if (name == kMethods[i]) return i;
  }
  return -1;
}

struct FileScript {
  std::string name;
  lfw::Value values[5];
  bool has_value[5] = {false, false, false, false, false};
  std::string fails[5];
  bool has_fail[5] = {false, false, false, false, false};
};

struct FakeZipObject : lfw::IZipObject {
  FileScript* script = nullptr;

  const std::u16string& name() const override { return name_text; }
  std::u16string name_text;

  bool read(int index, lfw::Value& out, std::u16string& error) {
    if (script->has_fail[index]) {
      error = to_u16(script->fails[index]);
      return false;
    }
    if (!script->has_value[index]) {
      error = to_u16(std::string("unscripted ") + kMethods[index]);
      return false;
    }
    out = script->values[index];
    return true;
  }

  bool json(lfw::Value& out, std::u16string& error) override { return read(0, out, error); }
  bool text(lfw::Value& out, std::u16string& error) override { return read(1, out, error); }
  bool blob_url(lfw::Value& out, std::u16string& error) override { return read(2, out, error); }
  bool array_buffer(lfw::Value& out, std::u16string& error) override {
    return read(3, out, error);
  }
  bool image_bitmap(lfw::Value& out, std::u16string& error) override {
    return read(4, out, error);
  }
};

class FakeZip : public lfw::IZip {
 public:
  explicit FakeZip(const std::string& name) : _name(to_u16(name)) {}

  const std::u16string& name() const override { return _name; }

  lfw::IZipObject* file(const std::u16string& path) override {
    const std::string key = to_ascii(path);
    push("call:" + to_ascii(_name) + "|" + key);
    const auto it = _scripts.find(key);
    if (it == _scripts.end()) return nullptr;
    auto obj = std::make_unique<FakeZipObject>();
    obj->name_text = to_u16(it->second.name);
    obj->script = &it->second;
    _objects.push_back(std::move(obj));
    return _objects.back().get();
  }

  std::vector<lfw::IZipObject*> file_regex(const std::u16string& pattern) override {
    push("rgx:" + to_ascii(_name) + "|" + to_ascii(pattern));
    std::vector<lfw::IZipObject*> out;
    for (auto& pair : _scripts) {
      if (!lfw::zip_name_matches(to_u16(pair.first), pattern)) continue;
      auto obj = std::make_unique<FakeZipObject>();
      obj->name_text = to_u16(pair.second.name);
      obj->script = &pair.second;
      _objects.push_back(std::move(obj));
      out.push_back(_objects.back().get());
    }
    return out;
  }

  FileScript& script_of(const std::string& path) {
    auto it = _scripts.find(path);
    if (it != _scripts.end()) return it->second;
    FileScript fresh;
    fresh.name = path;
    return _scripts.emplace(path, fresh).first->second;
  }

  void erase(const std::string& path) { _scripts.erase(path); }

 private:
  std::u16string _name;
  std::map<std::string, FileScript> _scripts;
  std::vector<std::unique_ptr<FakeZipObject>> _objects;
};

struct NetScript {
  lfw::Value value;
  lfw::Value hit;
};

// `I.Ditto.Importer` + `I.Ditto.XML`。
class FakeHost : public lfw::IResourcesHost {
 public:
  NetScript net[5];
  bool has_net[5] = {false, false, false, false, false};
  std::string net_fails[5];
  bool net_has_fail[5] = {false, false, false, false, false};
  lfw::Value xml_result;
  std::string xml_fails;
  bool xml_has_fail = false;

  bool import_one(int index, const std::vector<std::u16string>& urls, lfw::Value& data,
                  lfw::Value& hit, std::u16string& error) {
    std::string joined;
    for (size_t i = 0; i < urls.size(); ++i) {
      if (i != 0) joined += ",";
      joined += to_ascii(urls[i]);
    }
    push("imp:" + std::string(kMethods[index]) + "|" + joined);
    if (net_has_fail[index]) {
      error = to_u16(net_fails[index]);
      return false;
    }
    if (!has_net[index]) {
      // 台面没脚本化：TS 侧会直接报错退出 ⇒ 端口也照做，避免「两边行为不同却都没报」。
      std::fprintf(stderr, "unscripted import_as_%s\n", kMethods[index]);
      std::exit(2);
    }
    data = net[index].value;
    hit = net[index].hit;
    return true;
  }

  bool import_as_json(const std::vector<std::u16string>& urls, lfw::Value& data, lfw::Value& hit,
                      std::u16string& error) override {
    return import_one(0, urls, data, hit, error);
  }
  bool import_as_blob_url(const std::vector<std::u16string>& urls, lfw::Value& data,
                          lfw::Value& hit, std::u16string& error) override {
    return import_one(2, urls, data, hit, error);
  }
  bool import_as_array_buffer(const std::vector<std::u16string>& urls, lfw::Value& data,
                              lfw::Value& hit, std::u16string& error) override {
    return import_one(3, urls, data, hit, error);
  }
  bool import_as_image_bitmap(const std::vector<std::u16string>& urls, lfw::Value& data,
                              lfw::Value& hit, std::u16string& error) override {
    return import_one(4, urls, data, hit, error);
  }
  bool import_as_text(const std::vector<std::u16string>& urls, lfw::Value& data, lfw::Value& hit,
                      std::u16string& error) override {
    return import_one(1, urls, data, hit, error);
  }
  bool xml_parse(const lfw::Value& text, lfw::Value& marker,
                 std::shared_ptr<lfw::IXMLElement>& root, std::u16string& error) override {
    push("xml:" + to_ascii(lfw::to_string(text)));
    if (xml_has_fail) {
      error = to_u16(xml_fails);
      return false;
    }
    marker = xml_result;
    root = nullptr;
    return true;
  }
};

std::map<std::string, std::unique_ptr<FakeZip>> g_zips;
FakeHost g_host;
lfw::ZipMgr g_zip_mgr;
std::unique_ptr<lfw::Resources> g_resources;

std::string data_render(const lfw::Value& v) { return to_ascii(render_value(v)); }

void call(const std::string& op, const std::u16string& path, bool exact, bool has_exact) {
  lfw::ImportResult result;
  std::u16string error;
  bool ok = false;
  const bool use_exact = has_exact ? exact : true;
  if (op == "rjson") {
    ok = g_resources->import_json(path, use_exact, result, error);
  } else if (op == "rres") {
    ok = g_resources->import_resource(path, exact, result, error);
  } else if (op == "rimg") {
    ok = g_resources->import_image_bitmap(path, exact, result, error);
  } else if (op == "rabuf") {
    ok = g_resources->import_array_buffer(path, exact, result, error);
  } else {
    ok = g_resources->import_xml(path, use_exact, result, error);
  }
  const std::string tag = op + ":" + to_ascii(path);
  if (!ok) {
    push(tag + "|throw:" + to_ascii(error));
    return;
  }
  push(tag + "|data=" + data_render(result.data) + "|file=" + data_render(result.file) +
       "|origin=" + data_render(result.origin));
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_resources <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  g_resources = std::make_unique<lfw::Resources>(&g_zip_mgr, &g_host);

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "zip") {
      const std::string zid = t[i++];
      g_zips[zid] = std::make_unique<FakeZip>(to_ascii(key_of(t[i++])));
    } else if (op == "zfile") {
      FakeZip& zip = *g_zips[t[i++]];
      const std::string path = to_ascii(key_of(t[i++]));
      const std::string kind = t[i++];
      if (kind == "miss") {
        zip.erase(path);
      } else if (kind == "hit") {
        zip.script_of(path).name = to_ascii(key_of(t[i++]));
      } else {
        std::fprintf(stderr, "bad zfile kind '%s' at line %d\n", kind.c_str(), lineno);
        return 2;
      }
    } else if (op == "zval") {
      FakeZip& zip = *g_zips[t[i++]];
      const std::string path = to_ascii(key_of(t[i++]));
      const int index = method_index(t[i++]);
      if (index < 0) {
        std::fprintf(stderr, "bad method at line %d\n", lineno);
        return 2;
      }
      FileScript& s = zip.script_of(path);
      s.values[index] = parse_value(t, i);
      s.has_value[index] = true;
    } else if (op == "zfail") {
      FakeZip& zip = *g_zips[t[i++]];
      const std::string path = to_ascii(key_of(t[i++]));
      const int index = method_index(t[i++]);
      if (index < 0) {
        std::fprintf(stderr, "bad method at line %d\n", lineno);
        return 2;
      }
      FileScript& s = zip.script_of(path);
      s.fails[index] = to_ascii(lfw::to_string(parse_value(t, i)));
      s.has_fail[index] = true;
    } else if (op == "add") {
      lfw::ILoadedZip entry;
      entry.zip = g_zips[t[i++]].get();
      entry.info = nullptr;
      g_zip_mgr.add(entry);
    } else if (op == "netval") {
      const int index = method_index(t[i++]);
      if (index < 0) {
        std::fprintf(stderr, "bad method at line %d\n", lineno);
        return 2;
      }
      g_host.net_has_fail[index] = false;
      g_host.net[index].value = parse_value(t, i);
      g_host.net[index].hit = parse_value(t, i);
      g_host.has_net[index] = true;
    } else if (op == "netfail") {
      const int index = method_index(t[i++]);
      if (index < 0) {
        std::fprintf(stderr, "bad method at line %d\n", lineno);
        return 2;
      }
      g_host.net_fails[index] = to_ascii(lfw::to_string(parse_value(t, i)));
      g_host.net_has_fail[index] = true;
    } else if (op == "xmlparse") {
      const std::string kind = t[i++];
      if (kind == "fail") {
        g_host.xml_fails = to_ascii(lfw::to_string(parse_value(t, i)));
        g_host.xml_has_fail = true;
      } else if (kind == "null") {
        g_host.xml_has_fail = false;
        g_host.xml_result = lfw::Value(lfw::NullTag{});
      } else {
        if (i == 0) return 2;
        --i;   // 这个 token 是值字面量的开头（`s` / `o` / `n` / `u` / …）
        g_host.xml_has_fail = false;
        g_host.xml_result = parse_value(t, i);
      }
    } else if (op == "rjson" || op == "rres" || op == "rimg" || op == "rabuf" || op == "rxml") {
      const std::u16string path = key_of(t[i++]);
      const bool has_exact = i < t.size();
      const bool exact = has_exact && t[i++] == "1";
      call(op, path, exact, has_exact);
    } else {
      std::fprintf(stderr, "unknown op '%s' at line %d\n", op.c_str(), lineno);
      return 2;
    }

    if (i != t.size()) {
      std::fprintf(stderr, "trailing token(s) at line %d: %s\n", lineno, raw.c_str());
      return 2;
    }
    for (const std::string& l : g_log) std::printf("%s\n", l.c_str());
    g_log.clear();
  }
  return 0;
}
