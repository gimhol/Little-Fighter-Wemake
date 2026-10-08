// `lfw/ditto/xml`（IXMLElement / IXML 缝的 tool 实现）+ `lfw/dat_translator/xml`
// （xml 方言读写层）的 C++ 侧台面，op 与 `subjects/xml.ts` 一一对应。
// 用例：`cases/xml/*.txt`。
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/dat_translator/xml/merge_by_tag.h"
#include "lfw/dat_translator/xml/one_or_arr.h"
#include "lfw/dat_translator/xml/parse_rect_qube.h"
#include "lfw/dat_translator/xml/xml_from_data_lists.h"
#include "lfw/dat_translator/xml/xml_from_json.h"
#include "lfw/dat_translator/xml/xml_from_stage_info.h"
#include "lfw/dat_translator/xml/xml_from_world_dataset.h"
#include "lfw/dat_translator/xml/xml_to_bg_terrain.h"
#include "lfw/dat_translator/xml/xml_to_data_lists.h"
#include "lfw/dat_translator/xml/xml_to_velocity_info.h"
#include "lfw/dat_translator/xml/xml_to_world_dataset.h"
#include "lfw/dat_translator/xml/xml_x_armor_info.h"
#include "lfw/dat_translator/xml/xml_x_bdy.h"
#include "lfw/dat_translator/xml/xml_x_bg_data.h"
#include "lfw/dat_translator/xml/xml_x_bg_info.h"
#include "lfw/dat_translator/xml/xml_x_bg_layer.h"
#include "lfw/dat_translator/xml/xml_x_bpoint.h"
#include "lfw/dat_translator/xml/xml_x_chase.h"
#include "lfw/dat_translator/xml/xml_x_colli_action.h"
#include "lfw/dat_translator/xml/xml_x_cpoint.h"
#include "lfw/dat_translator/xml/xml_x_dat_index.h"
#include "lfw/dat_translator/xml/xml_x_dialog_info.h"
#include "lfw/dat_translator/xml/xml_x_difficulty_map.h"
#include "lfw/dat_translator/xml/xml_x_drink_info.h"
#include "lfw/dat_translator/xml/xml_x_entity_data.h"
#include "lfw/dat_translator/xml/xml_x_entity_info.h"
#include "lfw/dat_translator/xml/xml_x_frame.h"
#include "lfw/dat_translator/xml/xml_x_frame_indexes.h"
#include "lfw/dat_translator/xml/xml_x_frame_model.h"
#include "lfw/dat_translator/xml/xml_x_frame_pic.h"
#include "lfw/dat_translator/xml/xml_x_hit_key_map.h"
#include "lfw/dat_translator/xml/xml_x_itr.h"
#include "lfw/dat_translator/xml/xml_x_map.h"
#include "lfw/dat_translator/xml/xml_x_model_info.h"
#include "lfw/dat_translator/xml/xml_x_next_frame.h"
#include "lfw/dat_translator/xml/xml_x_opoint.h"
#include "lfw/dat_translator/xml/xml_x_partial_world_dataset.h"
#include "lfw/dat_translator/xml/xml_x_picture_info.h"
#include "lfw/dat_translator/xml/xml_x_qube.h"
#include "lfw/dat_translator/xml/xml_x_stage_info.h"
#include "lfw/dat_translator/xml/xml_x_stage_object_info.h"
#include "lfw/dat_translator/xml/xml_x_stage_phase_info.h"
#include "lfw/dat_translator/xml/xml_x_wpoint.h"
#include "lfw/ditto/xml/tool_xml.h"
#include "lfw/ditto/xml/tool_xml_element.h"
#include "lfw/ui/xml_to_ui_info.h"

#include "trace_util.h"

namespace {

using trace::esc;
using trace::key_of;
using trace::parse_value;
using trace::render_value;
using trace::split_ws;
using trace::strip_comment;
using trace::to_ascii;
using trace::to_double;
using trace::to_u16;
using trace::vtag;

std::vector<std::string> g_log;

void push(const std::string& line) { g_log.push_back(line); }

lfw::ToolXML g_xml;
// 根（工厂造出来、台面自己持有）用 `owner` 掌所有权；`bytag` / `bytagi` 出来的别名
// 是父元素持有的裸指针（读用；`ins` 只受理根）。
struct Entry {
  std::shared_ptr<lfw::IXMLElement> owner;
  lfw::IXMLElement* ptr = nullptr;
};

std::map<std::string, Entry> g_els;
// xml 层读写用的数据对象（TS 侧是普通 JS 值）。
std::map<std::string, lfw::Value> g_data;

lfw::IXMLElement& el(const std::string& id) { return *g_els.at(id).ptr; }

lfw::ToolXMLElement& tel(const std::string& id) {
  return *static_cast<lfw::ToolXMLElement*>(g_els.at(id).ptr);
}

lfw::IXMLElement* el_ptr(const std::string& id) {
  if (id == "-") return nullptr;
  const auto it = g_els.find(id);
  return it == g_els.end() ? nullptr : it->second.ptr;
}

lfw::Value data_of(const std::string& name) {
  const auto it = g_data.find(name);
  return it == g_data.end() ? lfw::Value() : it->second;
}

std::function<lfw::Value(const lfw::IXMLElement&)> parser_by_name(const std::string& fn);

std::shared_ptr<lfw::IXMLElement> call_writer(const std::string& fn, lfw::IXML& xml,
                                              const lfw::Value& d, const std::u16string& tag) {
  using namespace lfw::dat_translator::xml;
  const bool use_default_tag = tag == u"-";
  if (fn == "xml_x_bdy") return xml_x_bdy(xml, d, tag);
  if (fn == "xml_x_itr") return xml_x_itr(xml, d, tag);
  if (fn == "xml_x_armor_info") return xml_x_armor_info(xml, d, tag);
  if (fn == "xml_x_chase") return xml_x_chase(xml, d, tag);
  if (fn == "xml_x_bpoint") return xml_x_bpoint(xml, d, tag);
  if (fn == "xml_x_wpoint") return xml_x_wpoint(xml, d, tag);
  if (fn == "xml_x_cpoint") return xml_x_cpoint(xml, d, tag);
  if (fn == "xml_x_next_frame") return xml_x_next_frame(xml, d, tag);
  if (fn == "xml_x_colli_action") return xml_x_colli_action(xml, d, tag);
  if (fn == "xml_x_dat_index") {
    return use_default_tag ? xml_x_dat_index(xml, d) : xml_x_dat_index(xml, d, tag);
  }
  if (fn == "xml_x_picture_info") return xml_x_picture_info(xml, d, tag);
  if (fn == "xml_x_frame_pic") return xml_x_frame_pic(xml, d, tag);
  if (fn == "xml_x_model_info") return xml_x_model_info(xml, d, tag);
  if (fn == "xml_x_dialog_info") return xml_x_dialog_info(xml, d, tag);
  if (fn == "xml_x_drink_info") return xml_x_drink_info(xml, d, tag);
  if (fn == "xml_x_stage_object_info") return xml_x_stage_object_info(xml, d, tag);
  if (fn == "xml_x_bg_info") return xml_x_bg_info(xml, d, tag);
  if (fn == "xml_x_bg_layer") return xml_x_bg_layer(xml, d, tag);
  if (fn == "xml_x_frame_indexes") return xml_x_frame_indexes(xml, d, tag);
  if (fn == "xml_x_frame_model") return xml_x_frame_model(xml, d, tag);
  if (fn == "xml_x_opoint") return xml_x_opoint(xml, d, tag);
  if (fn == "xml_x_opoint_multi") return xml_x_opoint_multi(xml, d, tag);
  if (fn == "xml_x_sound_play_info") return xml_x_sound_play_info(xml, d, tag);
  if (fn == "xml_x_stage_phase_info") return xml_x_stage_phase_info(xml, d, tag);
  if (fn == "xml_x_stage_info") return xml_x_stage_info(xml, d, tag);
  if (fn == "xml_x_entity_info") return xml_x_entity_info(xml, d, tag);
  if (fn == "xml_x_entity_data") {
    return use_default_tag ? xml_x_entity_data(xml, d) : xml_x_entity_data(xml, d, tag);
  }
  if (fn == "xml_x_bg_data") {
    return use_default_tag ? xml_x_bg_data(xml, d) : xml_x_bg_data(xml, d, tag);
  }
  if (fn == "xml_x_frame") return xml_x_frame(xml, d, tag);
  if (fn == "xml_x_partial_world_dataset") return xml_x_partial_world_dataset(xml, d, tag);
  if (fn == "xml_from_world_dataset") {
    return use_default_tag ? xml_from_world_dataset(xml, d) : xml_from_world_dataset(xml, d, tag);
  }
  if (fn == "xml_from_data_lists") return xml_from_data_lists(xml, d);
  std::fprintf(stderr, "unknown writer fn '%s'\n", fn.c_str());
  std::exit(2);
}

using CreatorFn = std::function<std::shared_ptr<lfw::IXMLElement>(
    lfw::IXML&, const lfw::Value&, const std::u16string&)>;

CreatorFn creator_by_name(const std::string& fn) {
  using namespace lfw::dat_translator::xml;
  if (fn == "xml_x_picture_info") return xml_x_picture_info;
  if (fn == "xml_x_frame_pic") return xml_x_frame_pic;
  if (fn == "xml_x_model_info") return xml_x_model_info;
  if (fn == "xml_x_bdy") return xml_x_bdy;
  if (fn == "xml_x_itr") return xml_x_itr;
  if (fn == "xml_x_opoint") return xml_x_opoint;
  if (fn == "xml_x_bg_layer") return xml_x_bg_layer;
  if (fn == "xml_x_stage_phase_info") return xml_x_stage_phase_info;
  if (fn == "xml_x_frame") return xml_x_frame;
  if (fn == "xml_x_frame_model") return xml_x_frame_model;
  std::fprintf(stderr, "unknown creator fn '%s'\n", fn.c_str());
  std::exit(2);
}

lfw::Value call_reader(const std::string& fn, lfw::IXMLElement* e,
                       const std::vector<std::string>& args) {
  using namespace lfw::dat_translator::xml;
  const auto key = [&](size_t i) { return key_of(args.at(i)); };
  if (fn == "xml_2_bdy") return xml_2_bdy(*e);
  if (fn == "xml_2_itr") return xml_2_itr(*e);
  if (fn == "xml_2_armor_info") return xml_2_armor_info(e);
  if (fn == "xml_2_chase") return xml_2_chase(*e);
  if (fn == "xml_2_bpoint") return xml_2_bpoint(*e);
  if (fn == "xml_2_wpoint") return xml_2_wpoint(*e);
  if (fn == "xml_2_cpoint") return xml_2_cpoint(*e);
  if (fn == "xml_2_next_frame") return xml_2_next_frame(*e);
  if (fn == "xml_2_colli_action") return xml_2_colli_action(*e);
  if (fn == "xml_2_t_next_frame") {
    return xml_2_t_next_frame(e->children_by_tag(key(0)));
  }
  if (fn == "xml_2_qube") {
    return xml_2_qube(*e, args.empty() || args.at(0) == "-" ? lfw::Value() : data_of(args.at(0)));
  }
  if (fn == "xml_to_velocity_info") {
    return xml_to_velocity_info(*e,
                                args.empty() || args.at(0) == "-" ? lfw::Value()
                                                                  : data_of(args.at(0)));
  }
  if (fn == "parse_rect_qube") return parse_rect_qube(*e);
  if (fn == "xml_2_dat_index") return xml_2_dat_index(*e);
  if (fn == "xml_2_difficulty_map") return xml_2_difficulty_map(*e, key(0));
  if (fn == "xml_2_map") return xml_2_map(*e, {key(0)}, parser_by_name(args.at(1)));
  if (fn == "xml_2_map2") {
    return xml_2_map(*e, {key(0), key(1)}, parser_by_name(args.at(2)));
  }
  if (fn == "xml_2_hit_key_map") return xml_2_hit_key_map(*e, key(0));
  if (fn == "xml_2_partial_world_dataset") return xml_2_partial_world_dataset(e);
  if (fn == "xml_to_bg_terrain") return xml_to_bg_terrain(*e);
  if (fn == "xml_2_picture_info") return xml_2_picture_info(*e);
  if (fn == "xml_2_picture_info_map") return xml_2_picture_info_map(*e, key(0));
  if (fn == "xml_2_frame_pic") return xml_2_frame_pic(*e);
  if (fn == "xml_2_frame_pic_map") return xml_2_frame_pic_map(*e, key(0));
  if (fn == "xml_2_model_info") return xml_2_model_info(*e);
  if (fn == "xml_2_model_info_map") return xml_2_model_info_map(*e, key(0));
  if (fn == "xml_2_dialog_info") return xml_2_dialog_info(*e);
  if (fn == "xml_2_drink_info") return xml_2_drink_info(*e);
  if (fn == "xml_2_stage_object_info") return xml_2_stage_object_info(*e);
  if (fn == "xml_2_bg_info") return xml_2_bg_info(*e);
  if (fn == "xml_2_bg_layer") {
    return xml_2_bg_layer(*e, static_cast<size_t>(args.empty() ? 0 : trace::to_long(args.at(0))));
  }
  if (fn == "xml_2_frame_indexes") return xml_2_frame_indexes(e);
  if (fn == "xml_2_frame_model") return xml_2_frame_model(e);
  if (fn == "xml_2_opoint") return xml_2_opoint(*e);
  if (fn == "xml_2_opoint_multi") return xml_2_opoint_multi(e);
  if (fn == "xml_2_sound_play_info") return xml_2_sound_play_info(*e);
  if (fn == "xml_2_entity_info") return xml_2_entity_info(*e);
  if (fn == "xml_2_entity_data") return xml_2_entity_data(e);
  if (fn == "xml_2_stage_phase_info") return xml_2_stage_phase_info(*e);
  if (fn == "xml_2_stage_info") return xml_2_stage_info(*e);
  if (fn == "xml_to_stage_info_list") {
    auto arr = std::make_shared<lfw::Array>();
    for (lfw::Value& v : xml_to_stage_info_list(*e)) arr->push_back(std::move(v));
    return lfw::Value(std::move(arr));
  }
  if (fn == "xml_2_bg_data") return xml_2_bg_data(*e);
  if (fn == "xml_to_world_dataset") return xml_to_world_dataset(e);
  if (fn == "xml_2_data_lists") return xml_2_data_lists(*e);
  if (fn == "xml_2_frame") return xml_2_frame(*e);
  std::fprintf(stderr, "unknown reader fn '%s'\n", fn.c_str());
  std::exit(2);
}

std::function<lfw::Value(const lfw::IXMLElement&)> parser_by_name(const std::string& fn) {
  using namespace lfw::dat_translator::xml;
  if (fn == "xml_2_bdy") return [](const lfw::IXMLElement& e) { return xml_2_bdy(e); };
  if (fn == "xml_2_itr") return [](const lfw::IXMLElement& e) { return xml_2_itr(e); };
  if (fn == "xml_2_chase") return [](const lfw::IXMLElement& e) { return xml_2_chase(e); };
  if (fn == "xml_2_bpoint") return [](const lfw::IXMLElement& e) { return xml_2_bpoint(e); };
  if (fn == "xml_2_wpoint") return [](const lfw::IXMLElement& e) { return xml_2_wpoint(e); };
  if (fn == "xml_2_cpoint") return [](const lfw::IXMLElement& e) { return xml_2_cpoint(e); };
  if (fn == "xml_2_next_frame") {
    return [](const lfw::IXMLElement& e) { return xml_2_next_frame(e); };
  }
  if (fn == "xml_2_colli_action") {
    return [](const lfw::IXMLElement& e) { return xml_2_colli_action(e); };
  }
  if (fn == "xml_2_dat_index") {
    return [](const lfw::IXMLElement& e) { return xml_2_dat_index(e); };
  }
  if (fn == "xml_2_picture_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_picture_info(e); };
  }
  if (fn == "xml_2_frame_pic") {
    return [](const lfw::IXMLElement& e) { return xml_2_frame_pic(e); };
  }
  if (fn == "xml_2_model_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_model_info(e); };
  }
  if (fn == "xml_2_dialog_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_dialog_info(e); };
  }
  if (fn == "xml_2_drink_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_drink_info(e); };
  }
  if (fn == "xml_2_stage_object_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_stage_object_info(e); };
  }
  if (fn == "xml_2_bg_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_bg_info(e); };
  }
  if (fn == "xml_2_frame_indexes") {
    return [](const lfw::IXMLElement& e) { return xml_2_frame_indexes(&e); };
  }
  if (fn == "xml_2_frame_model") {
    return [](const lfw::IXMLElement& e) { return xml_2_frame_model(&e); };
  }
  if (fn == "xml_2_opoint") {
    return [](const lfw::IXMLElement& e) { return xml_2_opoint(e); };
  }
  if (fn == "xml_2_stage_phase_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_stage_phase_info(e); };
  }
  if (fn == "xml_2_stage_info") {
    return [](const lfw::IXMLElement& e) { return xml_2_stage_info(e); };
  }
  if (fn == "xml_2_bg_data") {
    return [](const lfw::IXMLElement& e) { return xml_2_bg_data(e); };
  }
  if (fn == "xml_to_bg_terrain") {
    return [](const lfw::IXMLElement& e) { return xml_to_bg_terrain(e); };
  }
  if (fn == "xml_2_partial_world_dataset") {
    return [](const lfw::IXMLElement& e) { return xml_2_partial_world_dataset(&e); };
  }
  if (fn == "xml_2_frame") return [](const lfw::IXMLElement& e) { return xml_2_frame(e); };
  std::fprintf(stderr, "unknown parser fn '%s'\n", fn.c_str());
  std::exit(2);
}

void put_element(const std::string& id, const std::shared_ptr<lfw::IXMLElement>& e) {
  g_els[id] = Entry{e, e.get()};
}

void put_root(const std::string& id, const std::shared_ptr<lfw::IXMLElement>& e) {
  put_element(id, e);
}

std::string render_opt_str(const std::optional<std::u16string>& v) {
  return v ? esc(*v) : "u";
}

std::string render_opt_num(const std::optional<double>& v) {
  return v ? to_ascii(render_value(lfw::Value(*v))) : "u";
}

std::string render_opt_bool(const std::optional<bool>& v) {
  return v ? to_ascii(render_value(lfw::Value(*v))) : "u";
}

lfw::Value strs_to_value(const std::vector<std::u16string>& v) {
  auto arr = std::make_shared<lfw::Array>();
  for (const std::u16string& s : v) arr->push_back(lfw::Value(s));
  return lfw::Value(arr);
}

lfw::Value strs_soft_to_value(const std::vector<std::optional<std::u16string>>& v) {
  auto arr = std::make_shared<lfw::Array>();
  for (const std::optional<std::u16string>& s : v) {
    if (s) arr->push_back(lfw::Value(*s));
    else arr->push_back(lfw::Value());
  }
  return lfw::Value(arr);
}

lfw::Value nums_to_value(const std::vector<double>& v) {
  auto arr = std::make_shared<lfw::Array>();
  for (double d : v) arr->push_back(lfw::Value(d));
  return lfw::Value(arr);
}

lfw::Value nums_soft_to_value(const std::vector<std::optional<double>>& v) {
  auto arr = std::make_shared<lfw::Array>();
  for (const std::optional<double>& d : v) {
    if (d) arr->push_back(lfw::Value(*d));
    else arr->push_back(lfw::Value());
  }
  return lfw::Value(arr);
}

std::string render_child_tags(const std::vector<lfw::IXMLElement*>& kids) {
  std::string out;
  for (size_t i = 0; i < kids.size(); ++i) {
    if (i != 0) out += ",";
    out += esc(kids[i]->tag());
  }
  return out;
}

void dump_node(lfw::IXMLElement& node, size_t depth) {
  std::string attrs;
  for (size_t i = 0; i < node.attrs().size(); ++i) {
    if (i != 0) attrs += ",";
    attrs += esc(node.attrs()[i].name);
    attrs += "=";
    attrs += esc(node.attrs()[i].value);
  }
  push("d|" + std::to_string(depth) + "|" + esc(node.tag()) + "|" +
       std::to_string(node.attrs().size()) + "|" + attrs + "|" + esc(node.text()));
  for (lfw::IXMLElement* child : node.children()) dump_node(*child, depth + 1);
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_xml <case-file>\n");
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
    const std::vector<std::string> t = split_ws(strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "new") {
      put_root(t[i], g_xml.create(key_of(t[i + 1])));
      i += 2;
    } else if (op == "fromstr") {
      const std::string eid = t[i++];
      const std::u16string tag = key_of(t[i++]);
      put_root(eid, g_xml.from_string(key_of(t[i++]), tag));
    } else if (op == "fromnum") {
      const std::string eid = t[i++];
      const std::u16string tag = key_of(t[i++]);
      put_root(eid, g_xml.from_number(to_double(t[i++]), tag));
    } else if (op == "frombool") {
      const std::string eid = t[i++];
      const std::u16string tag = key_of(t[i++]);
      put_root(eid, g_xml.from_boolean(t[i++] == "1", tag));
    } else if (op == "fromarr") {
      const std::string eid = t[i++];
      const std::u16string tag = key_of(t[i++]);
      const lfw::Value v = parse_value(t, i);
      if (vtag(v).rfind("a", 0) != 0) {
        std::fprintf(stderr, "fromarr expects an array literal at line %d\n", lineno);
        return 2;
      }
      put_root(eid, g_xml.from_array(v, tag));
    } else if (op == "fromobj") {
      const std::string eid = t[i++];
      const std::u16string tag = key_of(t[i++]);
      const lfw::Value v = parse_value(t, i);
      if (vtag(v).rfind("o", 0) != 0) {
        std::fprintf(stderr, "fromobj expects an object literal at line %d\n", lineno);
        return 2;
      }
      put_root(eid, g_xml.from_object(v, tag));
    } else if (op == "bytag") {
      lfw::IXMLElement& parent = el(t[i++]);
      const std::u16string name = key_of(t[i++]);
      const std::string alias = t[i++];
      lfw::IXMLElement* child = parent.child_by_tag(name);
      if (child == nullptr) {
        std::fprintf(stderr, "bytag: no child '%s' at line %d\n", to_ascii(name).c_str(), lineno);
        return 2;
      }
      g_els[alias] = Entry{nullptr, child};
    } else if (op == "bytagi") {
      lfw::IXMLElement& parent = el(t[i++]);
      const std::u16string name = key_of(t[i++]);
      const size_t idx = static_cast<size_t>(trace::to_long(t[i++]));
      const std::string alias = t[i++];
      const std::vector<lfw::IXMLElement*> kids = parent.children_by_tag(name);
      if (idx >= kids.size()) {
        std::fprintf(stderr, "bytagi: index %zu out of range at line %d\n", idx, lineno);
        return 2;
      }
      g_els[alias] = Entry{nullptr, kids[idx]};
    } else if (op == "text") {
      tel(t[i++]).set_text(key_of(t[i++]));
    } else if (op == "attr") {
      lfw::ToolXMLElement& e = tel(t[i++]);
      const std::u16string name = key_of(t[i++]);
      e.set_attr(name, parse_value(t, i));
    } else if (op == "dattr") {
      tel(t[i++]).del_attr(key_of(t[i++]));
    } else if (op == "sattr") {
      lfw::ToolXMLElement& e = tel(t[i++]);
      const std::u16string name = key_of(t[i++]);
      e.set_arr_attr_soft(name, parse_value(t, i));
    } else if (op == "ins") {
      lfw::ToolXMLElement& parent = tel(t[i++]);
      const std::string cid = t[i++];
      const std::string idx = t[i++];
      if (idx == "-") {
        parent.insert(g_els.at(cid).owner, std::nullopt);
      } else {
        parent.insert(g_els.at(cid).owner, static_cast<size_t>(trace::to_long(idx)));
      }
    } else if (op == "rm") {
      lfw::ToolXMLElement& parent = tel(t[i++]);
      const bool ok = parent.remove(g_els.at(t[i++]).ptr);
      push(std::string("rm:") + (ok ? "true" : "false"));
    } else if (op == "rmself") {
      const bool ok = el(t[i++]).remove_self();
      push(std::string("rmself:") + (ok ? "true" : "false"));
    } else if (op == "rmall") {
      tel(t[i++]).remove_all();
    } else if (op == "dv") {
      const std::string name = t[i++];
      g_data[name] = i < t.size() ? parse_value(t, i) : lfw::Value();
    } else if (op == "dset") {
      lfw::Object* o = lfw::as_object(g_data[t[i++]]);
      const std::u16string key = key_of(t[i++]);
      o->set(key, parse_value(t, i));
    } else if (op == "ddel") {
      lfw::Object* o = lfw::as_object(g_data[t[i++]]);
      o->remove(key_of(t[i++]));
    } else if (op == "ddump") {
      const std::string name = t[i++];
      push("ddump|" + name + "|" + to_ascii(render_value(data_of(name))));
    } else if (op == "dvp") {
      const std::string name = t[i++];
      const std::string fn = t[i++];
      lfw::IXMLElement* e = el_ptr(t[i++]);
      const std::vector<std::string> args(t.begin() + static_cast<std::ptrdiff_t>(i), t.end());
      i = t.size();
      g_data[name] = call_reader(fn, e, args);
      push("dvp|" + fn + "|" + to_ascii(render_value(g_data[name])));
    } else if (op == "dvo") {
      const std::string name = t[i++];
      const std::string fn = t[i++];
      const lfw::Value src = data_of(t[i++]);
      if (fn == "one_or_arr") g_data[name] = lfw::dat_translator::xml::one_or_arr(src);
      else if (fn == "non_empty") g_data[name] = lfw::dat_translator::xml::non_empty(src);
      else {
        std::fprintf(stderr, "unknown helper fn '%s' at line %d\n", fn.c_str(), lineno);
        return 2;
      }
      push("dvo|" + fn + "|" + to_ascii(render_value(g_data[name])));
    } else if (op == "dvm") {
      const std::string name = t[i++];
      lfw::IXMLElement& parent = el(t[i++]);
      const std::u16string tag = key_of(t[i++]);
      const std::string fn = t[i++];
      const bool has_target = i < t.size();
      const lfw::Value target = has_target ? data_of(t[i++]) : lfw::Value();
      g_data[name] =
          lfw::dat_translator::xml::merge_by_tag(parent, tag, parser_by_name(fn), target);
      push("dvm|" + fn + "|" + to_ascii(render_value(g_data[name])));
    } else if (op == "wrv") {
      const std::string name = t[i++];
      const std::string fn = t[i++];
      const lfw::Value d = data_of(t[i++]);
      const std::u16string tag = key_of(t[i++]);
      const std::shared_ptr<lfw::IXMLElement> e = call_writer(fn, g_xml, d, tag);
      if (e) {
        put_element(name, e);
        push("wrv|" + name + "|" + esc(e->stringify()));
      } else {
        push("wrv|" + name + "|u");
      }
    } else if (op == "wrl") {
      const std::string name = t[i++];
      const std::string fn = t[i++];
      const lfw::Value d = data_of(t[i++]);
      const std::u16string tag = i < t.size() ? key_of(t[i++]) : std::u16string();
      std::optional<std::vector<std::shared_ptr<lfw::IXMLElement>>> made;
      if (fn == "xml_x_hit_key_map") {
        made = lfw::dat_translator::xml::xml_x_hit_key_map(g_xml, d, tag);
      } else if (fn == "xml_x_picture_info_map") {
        made = lfw::dat_translator::xml::xml_x_picture_info_map(g_xml, d, tag);
      } else if (fn == "xml_x_model_info_map") {
        made = lfw::dat_translator::xml::xml_x_model_info_map(g_xml, d, tag);
      } else if (fn == "xml_x_frame_pic_map") {
        made = lfw::dat_translator::xml::xml_x_frame_pic_map(g_xml, d, tag);
      } else if (fn == "xml_x_map") {
        const std::string wfn = t[i++];
        made = lfw::dat_translator::xml::xml_x_map(g_xml, d, tag, creator_by_name(wfn));
      } else {
        std::fprintf(stderr, "unknown list writer fn '%s' at line %d\n", fn.c_str(), lineno);
        return 2;
      }
      if (!made) {
        push("wrl|" + name + "|u");
      } else {
        for (size_t j = 0; j < made->size(); ++j) {
          put_element(name + ":" + std::to_string(j), made->at(j));
        }
        push("wrl|" + name + "|n=" + std::to_string(made->size()));
        for (size_t j = 0; j < made->size(); ++j) {
          push("wrl|" + name + "|" + std::to_string(j) + "|" +
               esc(made->at(j)->stringify()));
        }
      }
    } else if (op == "wjson") {
      const lfw::Value d = data_of(t[i++]);
      const std::u16string tag_name = key_of(t[i++]);
      std::optional<std::vector<std::u16string>> key_order;
      if (i < t.size()) {
        const lfw::Value ko = parse_value(t, i);
        const lfw::Array* const a = lfw::as_array(ko);
        if (a == nullptr) {
          std::fprintf(stderr, "wjson keyOrder must be an array at line %d\n", lineno);
          return 2;
        }
        key_order.emplace();
        for (size_t j = 0; j < a->size(); ++j) {
          const std::u16string* const s = std::get_if<std::u16string>(&a->at(j));
          if (s == nullptr) {
            std::fprintf(stderr, "wjson keyOrder items must be strings at line %d\n", lineno);
            return 2;
          }
          key_order->push_back(*s);
        }
      }
      push("wjson|" +
           esc(lfw::dat_translator::xml::xml_from_json(d, tag_name, key_order)));
    } else if (op == "wstages") {
      push("wstages|" +
           esc(lfw::dat_translator::xml::xml_from_stage_info(g_xml, data_of(t[i++]))));
    } else if (op == "wrins") {
      const std::string parent_id = t[i++];
      const std::string fn = t[i++];
      const lfw::Value d = data_of(t[i++]);
      const std::u16string tag = key_of(t[i++]);
      if (fn != "xml_x_t_next_frame") {
        std::fprintf(stderr, "wrins only supports xml_x_t_next_frame at line %d\n", lineno);
        return 2;
      }
      lfw::ToolXMLElement& parent = tel(parent_id);
      const std::vector<std::shared_ptr<lfw::IXMLElement>> made =
          lfw::dat_translator::xml::xml_x_t_next_frame(g_xml, d, tag, g_els.at(parent_id).owner);
      for (size_t j = 0; j < made.size(); ++j) {
        put_element(parent_id + ":" + std::to_string(j), made[j]);
      }
      push("wrins|" + parent_id + "|n=" + std::to_string(made.size()) + "|" +
           esc(parent.stringify()));
    } else if (op == "x2ui") {
      const lfw::Value info = lfw::ui::xml_to_ui_info(el(t[i++]));
      push("x2ui|" + to_ascii(render_value(info)));
    } else if (op == "dump") {
      dump_node(el(t[i++]), 0);
    } else if (op == "rd") {
      lfw::ToolXMLElement& e = tel(t[i++]);
      const std::string what = t[i++];
      std::string out = "rd|" + what + "|";
      if (what == "tag") {
        out += esc(e.tag());
      } else if (what == "text") {
        out += esc(e.text());
      } else if (what == "parent") {
        out += e.parent() == nullptr ? "u" : esc(e.parent()->tag());
      } else if (what == "children") {
        out += "n=" + std::to_string(e.children().size()) + "|" + render_child_tags(e.children());
      } else if (what == "attrs") {
        std::string attrs;
        for (size_t j = 0; j < e.attrs().size(); ++j) {
          if (j != 0) attrs += ",";
          attrs += esc(e.attrs()[j].name) + "=" + esc(e.attrs()[j].value);
        }
        out += "n=" + std::to_string(e.attrs().size()) + "|" + attrs;
      } else if (what == "type") {
        out += render_opt_str(e.type());
      } else if (what == "action") {
        out += esc(e.action_str());
      } else if (what == "strop") {
        out += esc(e.stringify());
      } else if (what == "hasattr") {
        out += e.has_attr(key_of(t[i++])) ? "true" : "false";
      } else if (what == "attr" || what == "str_attr") {
        out += render_opt_str(e.attr(key_of(t[i++])));
      } else if (what == "num_attr") {
        out += render_opt_num(e.num_attr(key_of(t[i++])));
      } else if (what == "bool_attr") {
        out += render_opt_bool(e.bool_attr(key_of(t[i++])));
      } else if (what == "strs") {
        const std::optional<std::vector<std::u16string>> v = e.strs_attr(key_of(t[i++]));
        out += v ? to_ascii(render_value(strs_to_value(*v))) : "u";
      } else if (what == "nums") {
        const std::optional<std::vector<double>> v = e.nums_attr(key_of(t[i++]));
        out += v ? to_ascii(render_value(nums_to_value(*v))) : "u";
      } else if (what == "strssoft") {
        const std::optional<std::vector<std::optional<std::u16string>>> v =
            e.strs_attr_soft(key_of(t[i++]));
        out += v ? to_ascii(render_value(strs_soft_to_value(*v))) : "u";
      } else if (what == "numssoft") {
        const std::optional<std::vector<std::optional<double>>> v =
            e.nums_attr_soft(key_of(t[i++]));
        out += v ? to_ascii(render_value(nums_soft_to_value(*v))) : "u";
      } else if (what == "asstr") {
        out += render_opt_str(e.as_string());
      } else if (what == "asnum") {
        out += render_opt_num(e.as_number());
      } else if (what == "asbool") {
        out += render_opt_bool(e.as_boolean());
      } else if (what == "asval") {
        out += to_ascii(render_value(e.as_value()));
      } else if (what == "asarr") {
        out += to_ascii(render_value(e.as_array()));
      } else if (what == "asobj") {
        out += to_ascii(render_value(e.as_object()));
      } else if (what == "asobj_or") {
        out += to_ascii(render_value(e.as_object(parse_value(t, i))));
      } else if (what == "asarr_or") {
        out += to_ascii(render_value(e.as_array(parse_value(t, i))));
      } else if (what == "asstr_or") {
        out += esc(e.as_string(key_of(t[i++])));
      } else if (what == "asnum_or") {
        out += to_ascii(render_value(lfw::Value(e.as_number(to_double(t[i++])))));
      } else if (what == "asbool_or") {
        out += to_ascii(render_value(lfw::Value(e.as_boolean(t[i++] == "1"))));
      } else if (what == "getstr") {
        out += render_opt_str(e.get_str(key_of(t[i++])));
      } else if (what == "getnum") {
        out += render_opt_num(e.get_num(key_of(t[i++])));
      } else if (what == "getbool") {
        out += render_opt_bool(e.get_bool(key_of(t[i++])));
      } else if (what == "getstr_or") {
        const std::u16string name = key_of(t[i++]);
        out += esc(e.get_str(name, key_of(t[i++])));
      } else if (what == "getnum_or") {
        const std::u16string name = key_of(t[i++]);
        out += to_ascii(render_value(lfw::Value(e.get_num(name, to_double(t[i++])))));
      } else if (what == "getbool_or") {
        const std::u16string name = key_of(t[i++]);
        out += to_ascii(render_value(lfw::Value(e.get_bool(name, t[i++] == "1"))));
      } else if (what == "gstrarr") {
        const std::optional<std::vector<std::u16string>> v = e.get_str_arr(key_of(t[i++]));
        out += v ? to_ascii(render_value(strs_to_value(*v))) : "u";
      } else if (what == "gnumarr") {
        const std::optional<std::vector<double>> v = e.get_num_arr(key_of(t[i++]));
        out += v ? to_ascii(render_value(nums_to_value(*v))) : "u";
      } else if (what == "getobj") {
        out += to_ascii(render_value(e.get_obj(key_of(t[i++]))));
      } else if (what == "cbt") {
        lfw::IXMLElement* c = e.child_by_tag(key_of(t[i++]));
        out += c == nullptr ? "u" : esc(c->tag());
      } else if (what == "cbtall") {
        const std::vector<lfw::IXMLElement*> kids = e.children_by_tag(key_of(t[i++]));
        out += "n=" + std::to_string(kids.size()) + "|" + render_child_tags(kids);
      } else {
        std::fprintf(stderr, "unknown rd kind '%s' at line %d\n", what.c_str(), lineno);
        return 2;
      }
      push(out);
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
