// `ZipMgr`（`src/LFW/ZipMgr.ts`）的 C++ 侧台面，op 与 `subjects/zip_mgr.ts` 一一对应。
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/core/value.h"
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

struct FakeZipObject : lfw::IZipObject {
  std::u16string name_text;
  const std::u16string& name() const override { return name_text; }
  // `ZipMgr` 不会读文件内容（那是 `Resources` 的事）⇒ 这里只满足接口。
  bool json(lfw::Value&, std::u16string& error) override {
    error = u"zip_mgr harness does not read file contents";
    return false;
  }
  bool text(lfw::Value&, std::u16string& error) override {
    error = u"zip_mgr harness does not read file contents";
    return false;
  }
  bool blob_url(lfw::Value&, std::u16string& error) override {
    error = u"zip_mgr harness does not read file contents";
    return false;
  }
  bool array_buffer(lfw::Value&, std::u16string& error) override {
    error = u"zip_mgr harness does not read file contents";
    return false;
  }
  bool image_bitmap(lfw::Value&, std::u16string& error) override {
    error = u"zip_mgr harness does not read file contents";
    return false;
  }
};

class FakeZip : public lfw::IZip {
 public:
  explicit FakeZip(const std::string& name) : _name(to_u16(name)) {}

  const std::u16string& name() const override { return _name; }

  lfw::IZipObject* file(const std::u16string& path) override {
    push("call:" + to_ascii(_name) + "|" + to_ascii(path));
    const auto it = _files.find(to_ascii(path));
    if (it == _files.end()) return nullptr;
    return it->second.get();
  }

  std::vector<lfw::IZipObject*> file_regex(const std::u16string& pattern) override {
    push("rgx:" + to_ascii(_name) + "|" + to_ascii(pattern));
    std::vector<lfw::IZipObject*> out;
    for (auto& pair : _files) {
      if (lfw::zip_name_matches(pair.second->name(), pattern)) out.push_back(pair.second.get());
    }
    return out;
  }

  // 台面脚本：`zfile <zid> <path> hit <fname>` / `miss`。
  void set_file(const std::string& path, const std::string* file_name) {
    if (file_name == nullptr) {
      _files.erase(path);
      return;
    }
    auto obj = std::make_unique<FakeZipObject>();
    obj->name_text = to_u16(*file_name);
    _files[path] = std::move(obj);
  }

 private:
  std::u16string _name;
  std::map<std::string, std::unique_ptr<FakeZipObject>> _files;
};

std::map<std::string, std::unique_ptr<FakeZip>> g_zips;
std::map<std::string, std::unique_ptr<lfw::IDataInfo>> g_infos;
lfw::ZipMgr g_mgr;

std::string join_names(const std::vector<lfw::IZip*>& zips) {
  std::string out;
  for (size_t i = 0; i < zips.size(); ++i) {
    if (i != 0) out += ",";
    out += to_ascii(zips[i]->name());
  }
  return out;
}

void dump() {
  std::string all;
  const std::vector<lfw::ILoadedZip>& loaded = g_mgr.all();
  for (size_t i = 0; i < loaded.size(); ++i) {
    if (i != 0) all += ",";
    all += to_ascii(loaded[i].zip->name());
  }

  auto md5_array = std::make_shared<lfw::Array>();
  for (const lfw::Value& v : g_mgr.md5s()) md5_array->push_back(v);

  const std::vector<lfw::IDataInfo*> infos = g_mgr.data_infos();
  std::string ds;
  for (size_t i = 0; i < infos.size(); ++i) {
    if (i != 0) ds += ",";
    ds += to_ascii(render_value(infos[i]->md5));
  }

  push("dump|len=" + std::to_string(g_mgr.length()) + "|all=" + all +
       "|zips=" + join_names(g_mgr.zips()) + "|md5s=" +
       to_ascii(render_value(lfw::Value(md5_array))) + "|infos=" +
       std::to_string(infos.size()) + ":[" + ds + "]");
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_zip_mgr <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

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
        zip.set_file(path, nullptr);
      } else if (kind == "hit") {
        const std::string file_name = to_ascii(key_of(t[i++]));
        zip.set_file(path, &file_name);
      } else {
        std::fprintf(stderr, "bad zfile kind '%s' at line %d\n", kind.c_str(), lineno);
        return 2;
      }
    } else if (op == "info") {
      g_infos[t[i++]] = std::make_unique<lfw::IDataInfo>();
    } else if (op == "imd5") {
      lfw::IDataInfo& info = *g_infos[t[i++]];
      const std::string kind = t[i++];
      if (kind == "u") info.md5 = lfw::Value();
      else if (kind == "z") info.md5 = lfw::Value(lfw::NullTag{});
      else if (kind == "s") info.md5 = lfw::Value(key_of(t[i++]));
      else {
        std::fprintf(stderr, "bad imd5 kind '%s' at line %d\n", kind.c_str(), lineno);
        return 2;
      }
    } else if (op == "add") {
      lfw::ILoadedZip entry;
      entry.zip = g_zips[t[i++]].get();
      entry.info = g_infos[t[i++]].get();
      g_mgr.add(entry);
    } else if (op == "clear") {
      g_mgr.clear();
    } else if (op == "dump") {
      dump();
    } else if (op == "find") {
      const bool exact = t[i++] == "1";
      const std::string marker = t[i++];
      if (marker != "p") {
        std::fprintf(stderr, "find expects the 'p' marker, got '%s' at line %d\n", marker.c_str(),
                     lineno);
        return 2;
      }
      const size_t n = static_cast<size_t>(trace::to_long(t[i++]));
      std::vector<std::u16string> paths;
      for (size_t j = 0; j < n; ++j) paths.push_back(key_of(t[i++]));
      const std::vector<lfw::IZipResult> res = g_mgr.find(paths, exact);
      push("find:n=" + std::to_string(res.size()));
      for (size_t j = 0; j < res.size(); ++j) {
        push("find:" + std::to_string(j) + "|" + to_ascii(res[j].origin) + "|" +
             to_ascii(res[j].file->name()) + "|" + to_ascii(res[j].zip->name()));
      }
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
