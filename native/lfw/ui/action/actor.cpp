#include "lfw/ui/action/actor.h"

#include <cmath>
#include <memory>

#include "lfw/helper/entities_helper.h"
#include "lfw/lfw.h"
#include "lfw/ui/ui_action_enum.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/uinode.h"
#include "lfw/ui/value_spread.h"

namespace lfw::ui {

namespace {

Value arg_or(const std::vector<Value>& args, size_t i) {
  return i < args.size() ? args[i] : Value();
}

// `Number(v) || 0`：NaN 与 0 都落 0。
double num_or_0(const Value& v) {
  const double d = to_number(v);
  return std::isnan(d) || d == 0.0 ? 0.0 : d;
}

// `isNaN(Number(v)) ? void 0 : Number(v)`（sound 的 x/y/z）。
Value num_or_undef(const Value& v) {
  const double d = to_number(v);
  return std::isnan(d) ? Value() : Value(d);
}

Value id_opts(const Value& id) {
  Value opts(std::make_shared<Object>());
  as_object(opts)->set(u"id", id);
  return opts;
}

}  // namespace

UIActor::UIActor() {
  _map[u"set_page"] = [](UINode& n, const std::vector<Value>& a) {
    n.lfw().set_page(id_opts(arg_or(a, 0)), a.size() > 1 ? num_or_0(a[1]) : 0.0);
  };
  _map[u"push_page"] = [](UINode& n, const std::vector<Value>& a) {
    n.lfw().push_page(id_opts(arg_or(a, 0)), a.size() > 1 ? num_or_0(a[1]) : 0.0);
  };
  _map[u"pop_page"] = [](UINode& n, const std::vector<Value>&) {
    n.pop_page(UIPopPageOpts());
  };
  _map[u"set_ui"] = _map[u"set_page"];
  _map[u"push_ui"] = _map[u"push_page"];
  _map[u"pop_ui"] = _map[u"pop_page"];
  _map[u"load_data"] = [](UINode& n, const std::vector<Value>& a) {
    LFW& lfw = n.lfw();
    std::vector<LFW::ZipItem> zips;
    if (truthy(arg_or(a, 0))) {
      zips.push_back(LFW::ZipItem{to_string(a[0]), nullptr});
    } else {
      std::vector<LFW::ZipItem>& all = LFW::ZIPS();
      for (size_t i = 1; i < all.size(); ++i) zips.push_back(all[i]);
    }
    std::u16string error;
    if (!lfw.load(zips, error)) {
      lfw.host().warn({Value(u"Failed to load, reason"), Value(std::move(error))});
    }
  };
  _map[u"broadcast"] = [](UINode& n, const std::vector<Value>& a) {
    n.lfw().broadcast(arg_or(a, 0));
  };
  _map[u"sound"] = [](UINode& n, const std::vector<Value>& a) {
    n.lfw().host().sounds_play_preset(arg_or(a, 0), num_or_undef(arg_or(a, 1)),
                                      num_or_undef(arg_or(a, 2)), num_or_undef(arg_or(a, 3)));
  };
  _map[u"switch_difficulty"] = [](UINode& n, const std::vector<Value>& a) {
    if (truthy(arg_or(a, 0))) n.lfw().switch_difficulty(to_number(a[0]));
    else n.lfw().switch_difficulty();
  };
  _map[u"destory_stage"] = [](UINode& n, const std::vector<Value>&) {
    n.lfw().change_stage(std::u16string());
  };
  _map[u"remove_all_entities"] = [](UINode& n, const std::vector<Value>&) {
    n.lfw().entities_helper().del_all();
  };
}

UIActor& UIActor::add(const std::u16string& key, Handler handler) {
  _map[key] = std::move(handler);
  return *this;
}

void UIActor::act(UINode& node, const Value& action) {
  if (!truthy(action)) return;
  if (const Array* const arr = as_array(action)) {
    for (size_t i = 0; i < arr->size(); ++i) act(node, arr->at(i));
    return;
  }
  const Value* const name = field_of(action, u"name");
  std::vector<Value> args;
  if (const Value* const a = field_of(action, u"args")) {
    if (const Array* const arr = as_array(*a)) {
      for (size_t i = 0; i < arr->size(); ++i) args.push_back(arr->at(i));
    }
  }
  Handler handler;
  if (name != nullptr) {
    if (const std::u16string* const s = std::get_if<std::u16string>(name)) {
      const auto it = _map.find(*s);
      if (it != _map.end()) handler = it->second;
    }
  }
  if (!handler) {
    std::u16string args_text;
    for (size_t i = 0; i < args.size(); ++i) {
      if (i != 0) args_text += u",";
      args_text += to_string(args[i]);
    }
    std::u16string msg = u"[Actor::act] failed to act, handler not found by name, expression: ";
    msg += to_string(name != nullptr ? *name : Value());
    msg += u"(";
    msg += args_text;
    msg += u")";
    node.lfw().host().warn({Value(std::move(msg))});
    return;
  }
  handler(node, args);
}

UIActor& actor() {
  static UIActor inst;
  return inst;
}

}  // namespace lfw::ui
