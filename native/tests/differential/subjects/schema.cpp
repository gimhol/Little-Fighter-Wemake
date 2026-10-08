// `utils/schema` 家族（4W）的差分台面：`SchemaValidator` 对生成表（`defines/schemas_gen.h`）
// 与台面自搭 schema 的校验，外加 `check_stage_info` / `check_phase_info` 两个薄包装。
//
// 文法（两侧逐字一致）：
//   nv <vid>                          新建校验器（TS `new SchemaValidator()`）
//   sch <sid> <TableName>             绑定生成表里的 schema（名字 = TS 原名，如 Schema_ITerrainInfo）
//   schv <sid> <value-literal>        绑定手搭 schema（值字面量见 trace_util：u/z/b/n/s/a/o）
//   val <vid> <sid> <value-literal>   校验：`v|<vid>|<sid>|b0/1|e=N|w=N`，
//                                     逐条 `ve|<vid>|<i>|<esc>` / `vw|…`，最后 `vv|<vid>|<校验后的值>`
//   rz <vid>                          reset：`rz|<vid>|e=N|w=N`（reset 之后的计数）
//   cst <value-literal>               `check_stage_info`：`cst|b0/1|e=N` + `ce|<i>|<esc>`
//   cph <stage-lit> <info-lit>        `check_phase_info`（stage / idx 形参在 TS 里没用到）
// 4AR 追加：
//   nvg <vid> / nvgo <vid> / nvso <vid>  带钩子的校验器（get+set / 只 get / 只 set）；
//                                      getter 查 `gres` 表（未命中 ⇒ undefined），log 同 TS
//   gres <raw-token> <value-literal>  给 getter 的查表补条目
//   vset <vvid> <value-literal>        存一份值（供 valv/gn/sn 复用）
//   valv <vid> <vvid> <sid>            校验存档值（打印同 `val`，最后一行用存档）
//   gn <vid> <vvid> <key>             读惰性属性（TS 访问器；C++ `get_instance`）：`gn|<…>|ok/err|…`
//   sn <vid> <vvid> <key> <literal>   写惰性属性（同上）
//   mks <sid> <meta-literal>          `make_schema`（字面里 `$cls:X` 在 TS 侧转成假类）
//   psch <sid>                        打印 schema 树：`k=…;t=…;p=…[;n=…][;props=[…]][;items=…]`
#include <cstdio>
#include <fstream>
#include <map>
#include <string>
#include <vector>

#include "lfw/defines/schemas_gen.h"
#include "lfw/loader/check_stage_info.h"
#include "lfw/ui/value_spread.h"
#include "lfw/utils/schema/make_schema.h"
#include "lfw/utils/schema/validate_schema.h"
#include "lfw/utils/string_help.h"

#include "trace_util.h"

namespace {

using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::to_ascii;
using trace::to_u16;
using trace::key_of;

void fail(const char* what, const std::string& detail) {
  std::fprintf(stderr, "%s: %s\n", what, detail.c_str());
  std::exit(2);
}

const lfw::Value* find_schema_table(const std::string& name) {
  for (const lfw::SchemaTableRef& t : lfw::all_schema_table_refs()) {
    if (to_ascii(t.name) == name) return &t.get();
  }
  return nullptr;
}

void print_messages(const char* tag, const std::string& vid,
                    const std::vector<std::u16string>& ms) {
  for (size_t j = 0; j < ms.size(); ++j) {
    std::printf("%s|%s|%zu|%s\n", tag, vid.c_str(), j, trace::esc(ms[j]).c_str());
  }
}

std::map<std::string, lfw::Value> g_get_table;

// `value[k] = v`（对象写键 / 数组接下标键），供 `sn` 在无惰性属性时使用。
void set_raw_prop(const lfw::Value& target, const std::u16string& key, const lfw::Value& v) {
  if (lfw::Object* const o = const_cast<lfw::Object*>(lfw::as_object(target))) {
    o->set(key, v);
    return;
  }
  if (lfw::Array* const a = const_cast<lfw::Array*>(lfw::as_array(target))) {
    uint32_t idx = 0;
    if (lfw::is_array_index(key, idx) && idx < a->size()) a->at(idx) = v;
  }
}

std::string psch_tree(const lfw::Value& s) {
  std::string out;
  const auto field = [](const lfw::Value& v, const char16_t* k) -> lfw::Value {
    const lfw::Object* const o = lfw::as_object(v);
    if (o == nullptr) return lfw::Value();
    const lfw::Value* const p = o->get(std::u16string(k));
    return p != nullptr ? *p : lfw::Value();
  };
  const auto render = [](const lfw::Value& v) { return to_ascii(render_value(v)); };
  out += "k=" + render(field(s, u"key"));
  out += ";t=" + render(field(s, u"type"));
  out += ";p=" + render(field(s, u"path"));
  if (lfw::as_object(s) != nullptr && lfw::as_object(s)->get(u"nullable") != nullptr) {
    out += ";n=" + render(field(s, u"nullable"));
  }
  if (const lfw::Object* const props = lfw::as_object(field(s, u"properties"))) {
    out += ";props=[";
    bool first = true;
    for (const std::u16string& k : props->keys()) {
      const lfw::Value* const p = props->get(k);
      if (p == nullptr) continue;
      if (!first) out += ";";
      first = false;
      out += to_ascii(k) + "={" + psch_tree(*p) + "}";
    }
    out += "]";
  }
  const lfw::Value items = field(s, u"items");
  if (lfw::as_object(items) != nullptr) out += ";items={" + psch_tree(items) + "}";
  return out;
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_schema <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  std::map<std::string, lfw::Value> schemas;
  std::map<std::string, lfw::schema::SchemaValidator> validators;
  std::map<std::string, lfw::Value> values;

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "nv") {
      validators[t[i++]] = lfw::schema::SchemaValidator();
    } else if (op == "sch") {
      const std::string sid = t[i++];
      const std::string name = t[i++];
      const lfw::Value* s = find_schema_table(name);
      if (s == nullptr) fail("unknown schema table", name);
      schemas[sid] = *s;
    } else if (op == "schv") {
      const std::string sid = t[i++];
      schemas[sid] = parse_value(t, i);
    } else if (op == "val") {
      const std::string vid = t[i++];
      const std::string sid = t[i++];
      const auto sv = schemas.find(sid);
      if (sv == schemas.end()) fail("unbound schema", sid);
      const auto vv = validators.find(vid);
      if (vv == validators.end()) fail("unbound validator", vid);
      lfw::Value value = parse_value(t, i);
      const bool b = vv->second.validate(value, sv->second);
      std::printf("v|%s|%s|%s|e=%zu|w=%zu\n", vid.c_str(), sid.c_str(), b ? "b1" : "b0",
                  vv->second.errors().size(), vv->second.warnings().size());
      print_messages("ve", vid, vv->second.errors());
      print_messages("vw", vid, vv->second.warnings());
      std::printf("vv|%s|%s\n", vid.c_str(), to_ascii(render_value(value)).c_str());
    } else if (op == "rz") {
      const std::string vid = t[i++];
      const auto vv = validators.find(vid);
      if (vv == validators.end()) fail("unbound validator", vid);
      vv->second.reset();
      std::printf("rz|%s|e=%zu|w=%zu\n", vid.c_str(), vv->second.errors().size(),
                  vv->second.warnings().size());
    } else if (op == "cst") {
      const lfw::Value value = parse_value(t, i);
      std::vector<std::u16string> errs;
      const bool b = lfw::loader::check_stage_info(value, &errs);
      std::printf("cst|%s|e=%zu\n", b ? "b1" : "b0", errs.size());
      print_messages("ce", "-", errs);
    } else if (op == "cph") {
      const lfw::Value stage = parse_value(t, i);
      const lfw::Value info = parse_value(t, i);
      std::vector<std::u16string> errs;
      const bool b = lfw::loader::check_phase_info(stage, info, 0, &errs);
      std::printf("cph|%s|e=%zu\n", b ? "b1" : "b0", errs.size());
      print_messages("ce", "-", errs);
    } else if (op == "nvg" || op == "nvgo" || op == "nvso") {
      const std::string vid = t[i++];
      lfw::schema::SchemaValidator& v = validators[vid];
      const bool with_get = op != "nvso";
      const bool with_set = op != "nvgo";
      if (with_get) {
        v.instance_getter([vid](const lfw::Value& raw, const std::u16string& clazz,
                                const lfw::Value& schema) -> lfw::Value {
          const lfw::Object* const o = lfw::as_object(schema);
          const lfw::Value* const path =
              o != nullptr ? o->get(u"path") : nullptr;
          ::printf("ig|%s|%s|%s|%s\n", vid.c_str(),
                   to_ascii(render_value(raw)).c_str(), to_ascii(clazz).c_str(),
                   trace::esc(path != nullptr ? lfw::to_string(*path)
                                              : lfw::to_string(lfw::Value()))
                       .c_str());
          const auto it = g_get_table.find(to_ascii(lfw::to_string(raw)));
          return it == g_get_table.end() ? lfw::Value() : it->second;
        });
      }
      if (with_set) {
        v.instance_setter([vid](const lfw::Value& value, const lfw::Value& raw,
                                const std::u16string& clazz, const lfw::Value& schema) {
          const lfw::Object* const o = lfw::as_object(schema);
          const lfw::Value* const path =
              o != nullptr ? o->get(u"path") : nullptr;
          ::printf("is|%s|%s|%s|%s|%s\n", vid.c_str(),
                   to_ascii(render_value(value)).c_str(), to_ascii(render_value(raw)).c_str(),
                   to_ascii(clazz).c_str(),
                   trace::esc(path != nullptr ? lfw::to_string(*path)
                                              : lfw::to_string(lfw::Value()))
                       .c_str());
        });
      }
    } else if (op == "gres") {
      const std::string key = t[i++];
      g_get_table[to_ascii(key_of(key))] = parse_value(t, i);
    } else if (op == "vset") {
      const std::string vvid = t[i++];
      values[vvid] = parse_value(t, i);
    } else if (op == "valv") {
      const std::string vid = t[i++];
      const std::string vvid = t[i++];
      const std::string sid = t[i++];
      const auto sv = schemas.find(sid);
      if (sv == schemas.end()) fail("unbound schema", sid);
      const auto vv = validators.find(vid);
      if (vv == validators.end()) fail("unbound validator", vid);
      const auto vav = values.find(vvid);
      if (vav == values.end()) fail("unbound value", vvid);
      const bool b = vv->second.validate(vav->second, sv->second);
      std::printf("v|%s|%s|%s|e=%zu|w=%zu\n", vid.c_str(), sid.c_str(), b ? "b1" : "b0",
                  vv->second.errors().size(), vv->second.warnings().size());
      print_messages("ve", vid, vv->second.errors());
      print_messages("vw", vid, vv->second.warnings());
    } else if (op == "gn" || op == "sn") {
      const std::string vid = t[i++];
      const std::string vvid = t[i++];
      const std::u16string key = to_u16(t[i++]);
      const auto vv = validators.find(vid);
      if (vv == validators.end()) fail("unbound validator", vid);
      const auto vav = values.find(vvid);
      if (vav == values.end()) fail("unbound value", vvid);
      const lfw::Value& target = vav->second;
      size_t idx = vv->second.defined_instances().size();
      const auto& list = vv->second.defined_instances();
      for (size_t j = 0; j < list.size(); ++j) {
        const lfw::schema::SchemaValidator::DefinedInstance& d = list[j];
        const bool same = (lfw::as_object(d.target) != nullptr &&
                           lfw::as_object(d.target) == lfw::as_object(target)) ||
                          (lfw::as_array(d.target) != nullptr &&
                           lfw::as_array(d.target) == lfw::as_array(target));
        if (same && d.key == key) {
          idx = j;
          break;
        }
      }
      if (op == "gn") {
        if (idx >= vv->second.defined_instances().size()) {
          const lfw::Value v = lfw::ui::field_of(target, key.c_str()) != nullptr
                                   ? *lfw::ui::field_of(target, key.c_str())
                                   : lfw::Value();
          std::printf("gn|%s|%s|%s|ok|%s\n", vid.c_str(), vvid.c_str(), to_ascii(key).c_str(),
                      to_ascii(render_value(v)).c_str());
        } else {
          const lfw::schema::SchemaValidator::InstanceAccess a =
              vv->second.get_instance(idx);
          if (a.ok) {
            std::printf("gn|%s|%s|%s|ok|%s\n", vid.c_str(), vvid.c_str(),
                        to_ascii(key).c_str(), to_ascii(render_value(a.value)).c_str());
          } else {
            std::printf("gn|%s|%s|%s|err|%s\n", vid.c_str(), vvid.c_str(),
                        to_ascii(key).c_str(), trace::esc(a.error).c_str());
          }
        }
      } else {
        const lfw::Value v = parse_value(t, i);
        if (idx >= vv->second.defined_instances().size()) {
          set_raw_prop(target, key, v);
          std::printf("sn|%s|%s|%s\n", vid.c_str(), vvid.c_str(), to_ascii(key).c_str());
        } else {
          const std::u16string err = vv->second.set_instance(idx, v);
          if (err.empty()) {
            std::printf("sn|%s|%s|%s\n", vid.c_str(), vvid.c_str(), to_ascii(key).c_str());
          } else {
            std::printf("sn|%s|%s|%s|err|%s\n", vid.c_str(), vvid.c_str(),
                        to_ascii(key).c_str(), trace::esc(err).c_str());
          }
        }
      }
    } else if (op == "mks") {
      const std::string sid = t[i++];
      schemas[sid] = lfw::schema::make_schema(parse_value(t, i));
    } else if (op == "psch") {
      const std::string sid = t[i++];
      const auto sv = schemas.find(sid);
      if (sv == schemas.end()) fail("unbound schema", sid);
      std::printf("psch|%s|%s\n", sid.c_str(), psch_tree(sv->second).c_str());
    } else {
      std::fprintf(stderr, "line %d: unknown op '%s'\n", lineno, op.c_str());
      return 2;
    }
  }

  return 0;
}
