#include "lfw/loader/dat_mgr.h"

#include "lfw/lfw.h"

#include <cmath>
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

#include "lfw/controller/creators.h"
#include "lfw/core/js_string.h"
#include "lfw/core/value.h"
#include "lfw/dat_translator/value_builder.h"
#include "lfw/dat_translator/xml/xml_to_data_lists.h"
#include "lfw/dat_translator/xml/xml_x_bg_data.h"
#include "lfw/dat_translator/xml/xml_x_director.h"
#include "lfw/dat_translator/xml/xml_x_entity_data.h"
#include "lfw/dat_translator/xml/xml_x_stage_info.h"
#include "lfw/defines/defines.h"
#include "lfw/defines/defines_data.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/factory.h"
#include "lfw/loader/check_stage_info.h"
#include "lfw/loader/normalize_directors.h"
#include "lfw/loader/preprocess_bg_data.h"
#include "lfw/loader/preprocess_bot_data.h"
#include "lfw/loader/preprocess_entity_data.h"
#include "lfw/loader/preprocess_stage.h"
#include "lfw/resources.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/mersenne_twister.h"
#include "lfw/utils/type_check.h"

namespace lfw {
namespace loader {

namespace {

constexpr size_t kNpos = static_cast<size_t>(-1);

// 各文件里反复出现的小助手（同 `cook_frame_indicator_info.cpp` 等处的写法）。
Object* as_mut(const Value& v) { return const_cast<Object*>(as_object(v)); }

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// JS `String.prototype.endsWith`（大小写敏感；`toLowerCase` 之后调用才是 TS 的行为）。
bool ends_with(const std::u16string& s, const std::u16string& tail) {
  if (s.size() < tail.size()) return false;
  return s.compare(s.size() - tail.size(), tail.size(), tail) == 0;
}

// JS `Map` 的键相等（同 `factory.cpp` 的约定）：`strict_equals`（`NaN` 当键不建模）。
size_t index_of_key(const std::vector<std::pair<Value, Value>>& list, const Value& key) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (strict_equals(list[i].first, key)) return i;
  }
  return kNpos;
}

// `map.set(k, v)`：已有键 ⇒ 改值但**位置不变**。
void map_set(std::vector<std::pair<Value, Value>>& list, const Value& key, const Value& value) {
  const size_t i = index_of_key(list, key);
  if (i == kNpos) {
    list.push_back(std::make_pair(key, value));
    return;
  }
  list[i].second = value;
}

// `map.get(k)`：没命中给 `undefined`。
Value map_get(const std::vector<std::pair<Value, Value>>& list, const Value& key) {
  const size_t i = index_of_key(list, key);
  return i == kNpos ? Value() : list[i].second;
}

const Value* map_get_ptr(const std::vector<std::pair<Value, Value>>& list, const Value& key) {
  const size_t i = index_of_key(list, key);
  return i == kNpos ? nullptr : &list[i].second;
}

// JS `Set` 的键相等（SameValueZero 的对象档 = 引用身份；`NaN` 的角落不建模）。
bool same_set_key(const Value& a, const Value& b) {
  const Object* const oa = as_object(a);
  const Object* const ob = as_object(b);
  if (oa != nullptr || ob != nullptr) return oa == ob;
  return strict_equals(a, b);
}

// `["a","b"].join(sep)`：`Value` 数组的 join 由 `array_join` 只吃 `,` ⇒ 通用的在这儿写。
std::u16string join_strings(const std::vector<std::u16string>& items, const std::u16string& sep) {
  std::u16string out;
  for (size_t i = 0; i < items.size(); ++i) {
    if (i != 0) out += sep;
    out += items[i];
  }
  return out;
}

Value strings_to_array(const std::vector<std::u16string>& items) {
  std::vector<Value> out;
  out.reserve(items.size());
  for (const std::u16string& s : items) out.push_back(Value(s));
  return Value(std::make_shared<Array>(std::move(out)));
}

Value make_arr_of(const std::vector<Value>& items) {
  return Value(std::make_shared<Array>(items));
}

// `findIndex(v => v.id === data.id)`（严格相等）。
size_t find_index_by_id(const std::vector<Value>& list, const Value& id) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (strict_equals(field_or(list[i], u"id"), id)) return i;
  }
  return kNpos;
}

// `array.find(v => v.id === id)`。
const Value* find_by_id(const std::vector<Value>& list, const Value& id) {
  const size_t i = find_index_by_id(list, id);
  return i == kNpos ? nullptr : &list[i];
}

// `array.find(pred)`（谓词拿 `(value, index, obj)`）。
const Value* find_by_predicate(const std::vector<Value>& list, const DatMgr::FindPredicate& pred) {
  for (size_t i = 0; i < list.size(); ++i) {
    if (pred(list[i], static_cast<double>(i), list)) return &list[i];
  }
  return nullptr;
}

// `holder.indexOf(item)`：数组走严格相等；字符串走**子串**（`String.indexOf` 会把参数
// 转成字符串）；其余类型 TS 会抛 TypeError ⇒ 端口给 `-1`（记偏差）。
long js_index_of(const Value& holder, const Value& item) {
  if (const Array* const a = as_array(holder)) {
    for (size_t i = 0; i < a->size(); ++i) {
      if (strict_equals(a->at(i), item)) return static_cast<long>(i);
    }
    return -1;
  }
  if (std::holds_alternative<std::u16string>(holder)) {
    const std::u16string hay = std::get<std::u16string>(holder);
    const std::u16string needle = to_string(item);
    const size_t at = hay.find(needle);
    return at == std::u16string::npos ? -1 : static_cast<long>(at);
  }
  return -1;
}

// TS `this.datas[data.type]`：键是「数字转字符串」或原字符串（JS 属性访问的转换规则）。
// 其他形态 TS 读到 `undefined`（再调方法就抛）⇒ 端口给 `nullptr`。

}  // namespace

// TS 的 `Inner`：一份「数据表 + 取消标记」。TS 里 `dispose` / `clear` 换 `Inner` 实例、
// 靠 `inner_id` 判取消；端口把 `Inner` 放进 `shared_ptr` —— 进行中的 `load()` 拿着旧实例
// 继续跑（下一次 `check_cancelled` 抛「cancelled」），不会 use-after-free。
struct DatMgr::Inner {
  DatMgr* mgr = nullptr;
  int id = 0;
  LFW* host = nullptr;

  // `create_data_list_map()`：键 = `"4"` / `"8"` / `"16"` / `"32"`（`EntityEnum` 的
  // 数字键按 JS 的属性顺序排在字符串键前）+ `background` / `objects` / `bots` / `moves`。
  std::vector<std::pair<std::u16string, std::vector<Value>>> datas;
  std::vector<std::pair<Value, Value>> data_map;
  std::vector<std::pair<Value, Value>> alias_map;
  std::vector<Value> stages;
  std::vector<std::pair<Value, Value>> bot_map;
  std::vector<std::pair<Value, Value>> moves_map;
  std::vector<std::pair<std::u16string, Randoming::Ptr>> randomings;
  std::vector<std::pair<std::u16string, Randoming::Ptr>> bg_randomings;

  Inner(DatMgr* mgr_in, int id_in) : mgr(mgr_in), id(id_in), host(mgr_in->_host) {
    datas.push_back({u"4", {}});
    datas.push_back({u"8", {}});
    datas.push_back({u"16", {}});
    datas.push_back({u"32", {}});
    std::vector<Value> bg;
    if (const Value* const void_bg = defines::find(u"Defines.VOID_BG")) bg.push_back(*void_bg);
    datas.push_back({u"background", std::move(bg)});
    datas.push_back({u"objects", {}});
    datas.push_back({u"bots", {}});
    datas.push_back({u"moves", {}});
    datas.push_back({u"directors", {}});
    if (const Value* const void_stage = defines::find(u"Defines.VOID_STAGE")) {
      stages.push_back(*void_stage);
    }
  }

  bool cancelled() const { return mgr->inner_id() != id; }
  bool check_cancelled(std::u16string& error) {
    if (!cancelled()) return true;
    error = u"cancelled";
    return false;
  }

  std::vector<Value>* find_list(const std::u16string& key) {
    for (std::pair<std::u16string, std::vector<Value>>& kv : datas) {
      if (kv.first == key) return &kv.second;
    }
    return nullptr;
  }

  // TS `this.datas[data.type]`：键是「数字转字符串」或原字符串；其他形态读到 `undefined`。
  std::vector<Value>* find_list_of_type(const Value& type) {
    if (std::holds_alternative<std::u16string>(type)) {
      return find_list(std::get<std::u16string>(type));
    }
    if (std::holds_alternative<double>(type)) {
      return find_list(number_to_string(std::get<double>(type)));
    }
    return nullptr;
  }

  // 固定键（`datas` 的字面键恒存在）。
  std::vector<Value>& list_ref(const char16_t* key) { return *find_list(std::u16string(key)); }

  // `_cook_data(data)`（async ⇒ 同步）：「bg 数据」直接预处理；实体数据先按类型注册控制器、
  // 补 `base.bot`，再走 `preprocess_entity_data`。
  bool cook_data(const Value& raw, Value& out, std::u16string& error) {
    if (entity::is_bg_data(raw)) {
      std::vector<std::u16string> warnings;
      std::vector<std::u16string> errors;
      Value data = raw;
      out = preprocess_bg_data(data, &warnings, &errors);
      // TS 在**每个 terrain 项**后按需 `Ditto.warn(SV.Default.warnings)` /
      // `Ditto.error(...)`（参数就是整个数组）；端口把整趟收集并成一次（≥ 2 个会告警的
      // terrain 项才看得到差别，记偏差表）。
      if (!warnings.empty()) host->warn({strings_to_array(warnings)});
      if (!errors.empty()) host->error({strings_to_array(errors)});
      return true;
    }
    const Value id = field_or(raw, u"id");
    if (entity::is_ball_data(raw)) {
      Factory::register_ctrl(id, controller::ball_controller_creator());
    } else if (entity::is_weapon_data(raw)) {
      Factory::register_ctrl(id, controller::ball_controller_creator());
    } else if (entity::is_fighter_data(raw)) {
      Factory::register_ctrl(id, controller::bot_controller_creator());
    }
    // `data.base.bot = data.base.bot ?? this.bot_map.get(data.id ?? data.base.bot_id)`
    Value base = field_or(raw, u"base");
    Object* const base_o = as_mut(base);
    if (base_o == nullptr) {
      // TS 读 `data.base.bot`：`data` 不是对象时 V8 给 (reading 'base')、`base` 缺失时给
      // (reading 'bot') ⇒ 文案逐字照抄（其余表格路径同理不另造词）。
      error = is_nullish(raw) ? u"Cannot read properties of undefined (reading 'base')"
                              : u"Cannot read properties of undefined (reading 'bot')";
      return false;
    }
    const Value bot_prev = field_or(base, u"bot");
    const Value bot = is_nullish(bot_prev)
                          ? map_get(bot_map, is_nullish(id) ? field_or(base, u"bot_id") : id)
                          : bot_prev;
    base_o->set(u"bot", bot);

    // `ctx.lfw`：TS 把整个 `LFW` 递给 `preprocess_entity_data`；端口只给能过
    // 「`const { images, sounds } = lfw`」这一关的桩（加载任务本来就不落地，见 DESIGN §66）。
    Value ctx = dat_translator::make_obj({
        {u"lfw", dat_translator::make_obj({{u"images", dat_translator::make_obj({})},
                                           {u"sounds", dat_translator::make_obj({})}})},
        {u"data", raw},
        {u"jobs", dat_translator::make_arr({})},
        {u"errors", dat_translator::make_arr({})},
    });
    if (!preprocess_entity_data(ctx, error)) return false;
    out = field_or(ctx, u"data");
    return true;
  }

  void add_alias_object(const Value& alias, const Value& data) {
    const Value prev = map_get(alias_map, alias);
    if (truthy(prev)) {
      host->warn({Value(u"DatMgr::_add_obj"),
                  Value(u"alias duplicated, old data will be overwritten!"), Value(u"old data:"),
                  prev, Value(u"new data:"), data});
    }
    map_set(alias_map, alias, data);
  }

  bool add_object(const Value& key, const Value& data, std::u16string& error) {
    const Value prev = map_get(data_map, key);
    if (truthy(prev)) {
      host->warn({Value(u"DatMgr::_add_obj"),
                  Value(u"id duplicated, old data will be overwritten!"), Value(u"old data:"),
                  prev, Value(u"new data:"), data});
    }
    map_set(data_map, key, data);

    const Value data_id = field_or(data, u"id");
    std::vector<Value>* const list = find_list_of_type(field_or(data, u"type"));
    if (list == nullptr) {
      // TS 的 `undefined.findIndex`：V8 文案逐字照抄（差分台面用得着）。
      error = u"Cannot read properties of undefined (reading 'findIndex')";
      return false;
    }
    {
      const size_t idx = find_index_by_id(*list, data_id);
      if (idx == kNpos) {
        list->push_back(data);
      } else {
        (*list)[idx] = data;
      }
    }
    {
      std::vector<Value>& objects = list_ref(u"objects");
      const size_t idx = find_index_by_id(objects, data_id);
      if (idx == kNpos) {
        objects.push_back(data);
      } else {
        objects[idx] = data;
      }
    }
    // TS 还给数据对象挂 `xml` / `xml_roundtrip` / `xml_roundtrip_ok` 三个访问器 ⇒ 不建形。
    return true;
  }

  bool add_bg(const Value& data, std::u16string& error) {
    std::vector<Value>* const list = find_list_of_type(field_or(data, u"type"));
    if (list == nullptr) {
      error = u"Cannot read properties of undefined (reading 'findIndex')";
      return false;
    }
    const Value data_id = field_or(data, u"id");
    const size_t idx = find_index_by_id(*list, data_id);
    if (idx == kNpos) {
      list->push_back(data);
    } else {
      (*list)[idx] = data;
    }
    // `data.base.group?.forEach(v => this.bg_randomings.delete(v))`
    const Value group = field_or(field_or(data, u"base"), u"group");
    if (const Array* const a = as_array(group)) {
      for (size_t i = 0; i < a->size(); ++i) {
        if (!std::holds_alternative<std::u16string>(a->at(i))) continue;
        const std::u16string g = std::get<std::u16string>(a->at(i));
        for (size_t j = 0; j < bg_randomings.size();) {
          if (bg_randomings[j].first == g) {
            bg_randomings.erase(bg_randomings.begin() + static_cast<std::ptrdiff_t>(j));
          } else {
            ++j;
          }
        }
      }
    }
    // 其余形态（非 nullish 非数组）TS 会抛 TypeError ⇒ 端口当没有（记偏差）。
    return true;
  }

  // `data.push(...list[key])`：缺省 `[]` 只在**nullish** 时生效。
  static bool append_items(const Value& partial, const char16_t* key, std::vector<Value>& out,
                           std::u16string& error) {
    const Value v = field_or(partial, key);
    if (is_nullish(v)) return true;
    const Array* const a = as_array(v);
    if (a == nullptr) {
      error = u"spread of non-iterable";
      return false;
    }
    for (size_t i = 0; i < a->size(); ++i) out.push_back(a->at(i));
    return true;
  }

  bool solve_index_files(const std::vector<std::u16string>& index_files, Value& out,
                         std::u16string& error) {
    if (!check_cancelled(error)) return false;
    std::vector<Value> objects;
    std::vector<Value> backgrounds;
    std::vector<Value> stages_out;
    std::vector<Value> bots_out;
    std::vector<Value> moves_out;
    std::vector<Value> directors_out;
    Resources& resources = host->resources();
    for (const std::u16string& file : index_files) {
      if (!check_cancelled(error)) return false;
      const std::u16string f = to_lower_case(file);
      Value partial;
      if (ends_with(f, u".xml")) {
        ImportResult result;
        if (!resources.import_xml(file, true, result, error)) return false;
        if (!check_cancelled(error)) return false;
        if (result.xml_root == nullptr) {
          error = u"missing xml root";  // 宿主没给元素（真台面都会给）
          return false;
        }
        partial = dat_translator::xml::xml_2_data_lists(*result.xml_root);
      } else if (ends_with(f, u".json") || ends_with(f, u".json5")) {
        ImportResult result;
        if (!resources.import_json(file, true, result, error)) return false;
        partial = result.data;
      } else {
        host->warn({Value(u"UNSUPPORTED DAT INDEX FILE, SKIPPED: " + file)});
        continue;
      }
      if (!check_cancelled(error)) return false;
      if (!append_items(partial, u"objects", objects, error)) return false;
      if (!append_items(partial, u"backgrounds", backgrounds, error)) return false;
      if (!append_items(partial, u"stages", stages_out, error)) return false;
      if (!append_items(partial, u"bots", bots_out, error)) return false;
      if (!append_items(partial, u"moves", moves_out, error)) return false;
      if (!append_items(partial, u"directors", directors_out, error)) return false;
    }
    out = dat_translator::make_obj({
        {u"objects", make_arr_of(objects)},
        {u"backgrounds", make_arr_of(backgrounds)},
        {u"stages", make_arr_of(stages_out)},
        {u"bots", make_arr_of(bots_out)},
        {u"moves", make_arr_of(moves_out)},
        {u"directors", make_arr_of(directors_out)},
    });
    return true;
  }

  bool load(const std::vector<std::u16string>& index_files, std::u16string& error) {
    Resources& resources = host->resources();
    for (const EnumTextEntry& e : built_in_imgs_entries()) {
      if (!is_non_blank_str(Value(std::u16string(e.text)))) continue;
      host->emit_progress(e.text, 0);
      host->load_img(e.text);
      if (!check_cancelled(error)) return false;
    }
    for (const EnumTextEntry& e : built_in_dats_entries()) {
      if (!is_non_blank_str(Value(std::u16string(e.text)))) continue;
      host->emit_progress(e.text, 0);
      ImportResult result;
      if (!resources.import_json(e.text, true, result, error)) return false;
      Value cooked;
      if (!cook_data(result.data, cooked, error)) return false;
      if (!add_object(Value(std::u16string(e.text)), cooked, error)) return false;
      if (!check_cancelled(error)) return false;
    }

    Value data;
    if (!solve_index_files(index_files, data, error)) return false;
    if (!check_cancelled(error)) return false;

    const Array* const bots_list = as_array(field_or(data, u"bots"));
    const Array* const moves_list = as_array(field_or(data, u"moves"));
    const Array* const objects_list = as_array(field_or(data, u"objects"));
    const Array* const bgs_list = as_array(field_or(data, u"backgrounds"));
    const Array* const stages_list = as_array(field_or(data, u"stages"));
    const Array* const directors_list = as_array(field_or(data, u"directors"));
    const double total = static_cast<double>(bots_list->size() + moves_list->size() +
                                             directors_list->size() + objects_list->size() +
                                             bgs_list->size() + stages_list->size());
    double loaded = 0;
    const auto report = [&](const Value& file) {
      host->emit_progress(to_string(file),
                          total != 0 ? std::floor((loaded * 100) / total) : 0);
    };

    for (size_t i = 0; i < bots_list->size(); ++i) {
      const Value item = bots_list->at(i);
      loaded += 1;
      if (truthy(field_or(item, u"skipped"))) continue;
      const std::u16string file = to_string(field_or(item, u"file"));
      report(Value(file));
      ImportResult result;
      Value raw;
      if (resources.import_json(file, true, result, error)) {
        raw = result.data;
      } else {
        host->warn({Value(u"FAILED TO LOAD BOT DATA: " + file)});
        error.clear();
      }
      if (!check_cancelled(error)) return false;
      if (!truthy(raw)) continue;
      Value bot_data = raw;
      if (!preprocess_bot_data(bot_data)) {
        error = u"preprocess_bot_data failed";  // 端口兜底（TS 这边是 TypeError，文本不可比）
        return false;
      }
      const Value id = field_or(item, u"id");
      map_set(bot_map, id, bot_data);
      if (!equals(id, Value(file))) map_set(bot_map, Value(file), bot_data);
      const Value bot_id = field_or(bot_data, u"id");
      if (!equals(id, bot_id)) map_set(bot_map, bot_id, bot_data);
      list_ref(u"bots").push_back(bot_data);
    }

    for (size_t i = 0; i < moves_list->size(); ++i) {
      const Value item = moves_list->at(i);
      loaded += 1;
      if (truthy(field_or(item, u"skipped"))) continue;
      const std::u16string file = to_string(field_or(item, u"file"));
      report(Value(file));
      ImportResult result;
      Value raw;
      if (resources.import_json(file, true, result, error)) {
        raw = result.data;
      } else {
        host->warn({Value(u"FAILED TO LOAD MOVE LIST DATA: " + file)});
        error.clear();
      }
      if (!check_cancelled(error)) return false;
      if (!truthy(raw)) continue;
      const Value id = field_or(item, u"id");
      map_set(moves_map, id, raw);
      if (!equals(id, Value(file))) map_set(moves_map, Value(file), raw);
      const Value oid = field_or(raw, u"oid");
      if (truthy(oid) && !equals(oid, id)) map_set(moves_map, oid, raw);
      list_ref(u"moves").push_back(raw);
    }

    for (size_t i = 0; i < objects_list->size(); ++i) {
      const Value item = objects_list->at(i);
      loaded += 1;
      if (truthy(field_or(item, u"skipped"))) continue;
      if (!check_cancelled(error)) return false;
      const Value id = field_or(item, u"id");
      const std::u16string file = to_string(field_or(item, u"file"));
      const Value alias = field_or(item, u"alias");
      report(Value(file));
      Value raw;
      if (ends_with(file, u".obj.xml") || ends_with(file, u".xml")) {
        ImportResult result;
        if (!resources.import_xml(file, true, result, error)) {
          error = u"fail to load obj: " + file + u", reason: Error: " + error;
          return false;
        }
        if (result.xml_root == nullptr) {
          error = u"fail to load obj: " + file + u", reason: Error: missing xml root";
          return false;
        }
        raw = dat_translator::xml::xml_2_entity_data(result.xml_root.get());
      } else {
        ImportResult result;
        if (!resources.import_json(file, true, result, error)) {
          error = u"fail to load obj: " + file + u", reason: Error: " + error;
          return false;
        }
        raw = result.data;
      }
      Value cooked;
      if (!cook_data(raw, cooked, error)) {
        error = u"fail to load obj: " + file + u", reason: Error: " + error;
        return false;
      }
      if (!add_object(id, cooked, error)) {
        // `_add_object` 的失败面只有「类型表查不到 ⇒ TypeError」这一档（V8 文案）⇒ 包装用 TypeError。
        error = u"fail to load obj: " + file + u", reason: TypeError: " + error;
        return false;
      }
      if (!equals(id, Value(file))) {
        if (!add_object(Value(file), cooked, error)) {
          error = u"fail to load obj: " + file + u", reason: TypeError: " + error;
          return false;
        }
      }
      const Value cooked_id = field_or(cooked, u"id");
      if (!equals(id, cooked_id)) {
        if (!add_object(cooked_id, cooked, error)) {
          error = u"fail to load obj: " + file + u", reason: TypeError: " + error;
          return false;
        }
      }
      if (truthy(alias)) add_alias_object(alias, cooked);
    }

    for (size_t i = 0; i < bgs_list->size(); ++i) {
      const Value item = bgs_list->at(i);
      loaded += 1;
      if (truthy(field_or(item, u"skipped"))) continue;
      if (!check_cancelled(error)) return false;
      const std::u16string file = to_string(field_or(item, u"file"));
      report(Value(file));
      Value raw;
      if (ends_with(file, u".bg.xml")) {
        ImportResult result;
        if (!resources.import_xml(file, true, result, error)) {
          error = u"fail to load bg: " + file + u", reason: Error: " + error;
          return false;
        }
        if (result.xml_root == nullptr) {
          error = u"fail to load bg: " + file + u", reason: Error: missing xml root";
          return false;
        }
        raw = dat_translator::xml::xml_2_bg_data(*result.xml_root);
      } else {
        ImportResult result;
        if (!resources.import_json(file, true, result, error)) {
          error = u"fail to load bg: " + file + u", reason: Error: " + error;
          return false;
        }
        raw = result.data;
      }
      Value cooked;
      if (!cook_data(raw, cooked, error)) {
        error = u"fail to load bg: " + file + u", reason: Error: " + error;
        return false;
      }
      if (!add_bg(cooked, error)) {
        error = u"fail to load bg: " + file + u", reason: TypeError: " + error;
        return false;
      }
    }

    std::vector<Value> new_stages;
    for (size_t i = 0; i < stages_list->size(); ++i) {
      const Value item = stages_list->at(i);
      loaded += 1;
      if (truthy(field_or(item, u"skipped"))) continue;
      const std::u16string file = to_string(field_or(item, u"file"));
      report(Value(file));
      std::vector<Value> stage_datas;
      if (ends_with(file, u".xml") || ends_with(file, u".stage.xml")) {
        ImportResult result;
        if (!resources.import_xml(file, true, result, error)) return false;
        if (result.xml_root == nullptr) {
          error = u"missing xml root";
          return false;
        }
        stage_datas = dat_translator::xml::xml_to_stage_info_list(*result.xml_root);
      } else {
        ImportResult result;
        if (resources.import_json(file, true, result, error)) {
          if (const Array* const a = as_array(result.data)) {
            for (size_t j = 0; j < a->size(); ++j) stage_datas.push_back(a->at(j));
          } else if (!is_nullish(result.data)) {
            error = u"spread of non-iterable";
            return false;
          }
        } else {
          host->warn({Value(u"FAILED TO LOAD STATE: " + file)});
          error.clear();
        }
      }
      if (!check_cancelled(error)) return false;
      for (const Value& stage : stage_datas) {
        Value v = stage;
        new_stages.push_back(preprocess_stage(v));
      }
    }

    // TS：`if (!this.stages.length) this.stages.unshift(Defines.VOID_STAGE)` —— `stages`
    // 初始就带 `VOID_STAGE` ⇒ 恒不进。照抄（变异档会钉住初始值）。
    if (stages.empty()) {
      if (const Value* const void_stage = defines::find(u"Defines.VOID_STAGE")) {
        stages.insert(stages.begin(), *void_stage);
      }
    }
    for (const Value& stage : new_stages) {
      const Value sid = field_or(stage, u"id");
      const size_t idx = find_index_by_id(stages, sid);
      (void)check_stage_info(stage);
      // TS 在 `idx < 0` 时先 `push` 再 `this.stages[idx] = stage` ⇒ 后者是往数组上挂
      // 「-1」属性（数组内容不变）⇒ 端口只 push。
      if (idx == kNpos) {
        stages.push_back(stage);
      } else {
        stages[idx] = stage;
      }
    }

    // `for (const director_index of data.directors ?? [])` —— TS 用 try/catch 兜住单份
    // 导演数据的失败（`Ditto.warn` + 继续），端口同样不把错误往上抛。
    for (size_t i = 0; i < directors_list->size(); ++i) {
      const Value item = directors_list->at(i);
      loaded += 1;
      if (truthy(field_or(item, u"skipped"))) continue;
      const std::u16string file = to_string(field_or(item, u"file"));
      report(Value(file));
      Value raw;
      if (ends_with(file, u".xml")) {
        ImportResult result;
        if (!resources.import_xml(file, true, result, error)) {
          host->warn({Value(u"FAILED TO LOAD DIRECTOR DATA: " + file)});
          error.clear();
          continue;
        }
        if (result.xml_root == nullptr) {
          host->warn({Value(u"FAILED TO LOAD DIRECTOR DATA: " + file)});
          continue;
        }
        const std::vector<Value> list = dat_translator::xml::xml_to_directors(*result.xml_root);
        Value arr(std::make_shared<Array>(list));
        raw = arr;
      } else {
        ImportResult result;
        if (!resources.import_json(file, true, result, error)) {
          host->warn({Value(u"FAILED TO LOAD DIRECTOR DATA: " + file)});
          error.clear();
          continue;
        }
        raw = result.data;
      }
      if (!check_cancelled(error)) return false;
      list_ref(u"directors").push_back(
          loader::make_director_group(item, raw, to_string(field_or(item, u"file"))));
    }
    return true;
  }
};

DatMgr::DatMgr(LFW* host) : _host(host) {
  _inner = std::make_shared<Inner>(this, ++_inner_id);
}

bool DatMgr::load(const std::vector<std::u16string>& index_files, std::u16string& error) {
  const std::shared_ptr<Inner> inner = _inner;
  return inner->load(index_files, error);
}

void DatMgr::dispose() { _inner = std::make_shared<Inner>(this, ++_inner_id); }

void DatMgr::clear() { _inner = std::make_shared<Inner>(this, ++_inner_id); }

const std::vector<Value>& DatMgr::directors() const { return _inner->list_ref(u"directors"); }

const Value* DatMgr::find_director(const Value& id) const {
  for (const Value& v : _inner->list_ref(u"directors")) {
    if (strict_equals(field_or(v, u"id"), id) || strict_equals(field_or(v, u"file"), id)) return &v;
  }
  return nullptr;
}

const std::vector<Value>& DatMgr::bots() const { return _inner->list_ref(u"bots"); }

const std::vector<Value>& DatMgr::moves() const { return _inner->list_ref(u"moves"); }

const std::vector<Value>& DatMgr::objects() const { return _inner->list_ref(u"objects"); }

const std::vector<Value>& DatMgr::fighters() const { return _inner->list_ref(u"8"); }

const std::vector<Value>& DatMgr::weapons() const { return _inner->list_ref(u"16"); }

const std::vector<Value>& DatMgr::balls() const { return _inner->list_ref(u"32"); }

const std::vector<Value>& DatMgr::entities() const { return _inner->list_ref(u"4"); }

const std::vector<Value>& DatMgr::backgrounds() const {
  return _inner->list_ref(u"background");
}

const std::vector<Value>& DatMgr::stages() const { return _inner->stages; }

const Value* DatMgr::find(const Value& id) const {
  if (const Value* const a = map_get_ptr(_inner->alias_map, id)) return a;
  return map_get_ptr(_inner->data_map, id);
}

const Value* DatMgr::find_bot(const Value& id) const { return map_get_ptr(_inner->bot_map, id); }

const Value* DatMgr::find_moves(const Value& id) const {
  return map_get_ptr(_inner->moves_map, id);
}

Randoming::Ptr DatMgr::get_randoming_by_group(const std::u16string& group) {
  Inner& inner = *_inner;
  for (const std::pair<std::u16string, Randoming::Ptr>& kv : inner.randomings) {
    if (kv.first == group) return kv.second;
  }
  const std::vector<Value> objects = get_objects_of_group(group);
  // TS 的模板串写成了单引号 ⇒ 名字是**字面** `dat_${group}_randoming`（照抄）。
  Randoming::Ptr ret = std::make_shared<Randoming>(u"dat_${group}_randoming", objects, &_host->mt_ref());
  inner.randomings.push_back(std::make_pair(group, ret));
  return ret;
}

const Value* DatMgr::find_weapon(const Value& id) const { return find_by_id(weapons(), id); }

const Value* DatMgr::find_weapon(const FindPredicate& predicate) const {
  return find_by_predicate(weapons(), predicate);
}

const Value* DatMgr::find_entity(const Value& id) const { return find_by_id(entities(), id); }

const Value* DatMgr::find_entity(const FindPredicate& predicate) const {
  return find_by_predicate(entities(), predicate);
}

const Value* DatMgr::find_object(const Value& id) const { return find_by_id(objects(), id); }

const Value* DatMgr::find_object(const FindPredicate& predicate) const {
  return find_by_predicate(objects(), predicate);
}

const Value* DatMgr::find_fighter(const Value& id) const { return find_by_id(fighters(), id); }

const Value* DatMgr::find_fighter(const FindPredicate& predicate) const {
  return find_by_predicate(fighters(), predicate);
}

const Value* DatMgr::find_background(const Value& id) const {
  return find_by_id(backgrounds(), id);
}

const Value* DatMgr::find_background(const FindPredicate& predicate) const {
  return find_by_predicate(backgrounds(), predicate);
}

std::vector<Value> DatMgr::get_objects_of_group(const std::u16string& group) const {
  std::vector<Value> out;
  for (const Value& v : objects()) {
    const Value g = field_or(field_or(v, u"base"), u"group");
    if (!truthy(g)) continue;
    if (js_index_of(g, Value(group)) >= 0) out.push_back(v);
  }
  return out;
}

std::vector<Value> DatMgr::get_fighters_of_group(const std::u16string& group) const {
  std::vector<Value> out;
  for (const Value& v : fighters()) {
    const Value g = field_or(field_or(v, u"base"), u"group");
    if (!truthy(g)) continue;
    if (js_index_of(g, Value(group)) >= 0) out.push_back(v);
  }
  return out;
}

std::vector<Value> DatMgr::get_weapons_of_group(const std::u16string& group) const {
  std::vector<Value> out;
  for (const Value& v : weapons()) {
    const Value g = field_or(field_or(v, u"base"), u"group");
    if (!truthy(g)) continue;
    if (js_index_of(g, Value(group)) >= 0) out.push_back(v);
  }
  return out;
}

std::vector<Value> DatMgr::get_fighters_not_in_group(const std::u16string& group) const {
  std::vector<Value> out;
  for (const Value& v : fighters()) {
    const Value g = field_or(field_or(v, u"base"), u"group");
    if (!truthy(g) || js_index_of(g, Value(group)) < 0) out.push_back(v);
  }
  return out;
}

std::vector<Value> DatMgr::get_backgrouds_of_group(const std::u16string& group) const {
  std::vector<Value> out;
  for (const Value& v : backgrounds()) {
    // `a.base.group?.some(b => b === group)`：非数组（真值）TS 会抛 ⇒ 端口跳过（记偏差）。
    const Array* const a = as_array(field_or(field_or(v, u"base"), u"group"));
    if (a == nullptr) continue;
    for (size_t i = 0; i < a->size(); ++i) {
      if (strict_equals(a->at(i), Value(group))) {
        out.push_back(v);
        break;
      }
    }
  }
  return out;
}

Randoming::Ptr DatMgr::get_bg_randoming_of_group(const std::vector<std::u16string>& groups) {
  Inner& inner = *_inner;
  const std::u16string key = join_strings(groups, u",");
  for (const std::pair<std::u16string, Randoming::Ptr>& kv : inner.bg_randomings) {
    if (kv.first == key) return kv.second;
  }
  std::vector<Value> pool;
  for (const std::u16string& group : groups) {
    for (const Value& bg : get_backgrouds_of_group(group)) {
      bool seen = false;
      for (const Value& prev : pool) {
        if (same_set_key(prev, bg)) {
          seen = true;
          break;
        }
      }
      if (!seen) pool.push_back(bg);
    }
  }
  Randoming::Ptr ret = std::make_shared<Randoming>(u"bg_" + join_strings(groups, u"_") + u"_randoming",
                                                   pool, &_host->mt_ref());
  inner.bg_randomings.push_back(std::make_pair(key, ret));
  return ret;
}

Value DatMgr::get_random_bg(const std::vector<std::u16string>& groups) {
  return get_bg_randoming_of_group(groups)->get();
}

}
}
