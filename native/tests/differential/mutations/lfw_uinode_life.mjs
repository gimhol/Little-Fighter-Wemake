// `lfw/uinode` 第三段（4AP：生命周期/输入/动作/页面栈）的变异档。
//
// 用例：`cases/lfw/uinode_life.txt` + `cases/lfw/uilayer.txt`（任一锁住即可）。
export default {
  subject: "lfw",
  cases: ["uinode_life", "uilayer"],
  mutations: [
    {
      note: "on_start：lifetime 不复位",
      file: "native/lfw/ui/uinode.cpp",
      from: `void UINode::on_start() {
  _update_times.reset();`,
      to: `void UINode::on_start() {`,
    },
    {
      note: "on_start：actions 抢在子节点前面",
      file: "native/lfw/ui/uinode.cpp",
      from: `  _state_focused_node = nullptr;
  for (UINode* const c : _children) c->on_start();
  const Value* const actions = field_of(_data, u"actions");
  const Value* const start = actions != nullptr ? field_of(*actions, u"start") : nullptr;
  if (start != nullptr && truthy(*start)) actor().act(*this, *start);`,
      to: `  _state_focused_node = nullptr;
  const Value* const actions = field_of(_data, u"actions");
  const Value* const start = actions != nullptr ? field_of(*actions, u"start") : nullptr;
  if (start != nullptr && truthy(*start)) actor().act(*this, *start);
  for (UINode* const c : _children) c->on_start();`,
    },
    {
      note: "on_stop：actions 不派发",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const Value* const stop = actions != nullptr ? field_of(*actions, u"stop") : nullptr;
  if (stop != nullptr && truthy(*stop)) actor().act(*this, *stop);`,
      to: `  const Value* const stop = actions != nullptr ? field_of(*actions, u"stop") : nullptr;
  if (false && stop != nullptr && truthy(*stop)) actor().act(*this, *stop);`,
    },
    {
      note: "on_resume：不还原焦点",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_parent == nullptr) {
    set_focused_node(_state_focused_node);
    if (_visible) invoke_all_visible();
  }
  for (UINode* const c : _children) c->on_resume();`,
      to: `  if (_parent == nullptr) {
    if (_visible) invoke_all_visible();
  }
  for (UINode* const c : _children) c->on_resume();`,
    },
    {
      note: "on_resume：不转发可见（show 回调丢失）",
      file: "native/lfw/ui/uinode.cpp",
      from: `    set_focused_node(_state_focused_node);
    if (_visible) invoke_all_visible();`,
      to: `    set_focused_node(_state_focused_node);`,
    },
    {
      note: "on_resume：根判定反了",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_parent == nullptr) {
    set_focused_node(_state_focused_node);`,
      to: `  if (_parent != nullptr) {
    set_focused_node(_state_focused_node);`,
    },
    {
      note: "on_pause：不保存焦点",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_parent == nullptr) {
    _state_focused_node = focused_node();
    set_focused_node(nullptr);
    invoke_all_on_hide();
  }`,
      to: `  if (_parent == nullptr) {
    _state_focused_node = nullptr;
    set_focused_node(nullptr);
    invoke_all_on_hide();
  }`,
    },
    {
      note: "on_pause：不清焦点",
      file: "native/lfw/ui/uinode.cpp",
      from: `    _state_focused_node = focused_node();
    set_focused_node(nullptr);
    invoke_all_on_hide();`,
      to: `    _state_focused_node = focused_node();
    invoke_all_on_hide();`,
    },
    {
      note: "on_pause：不转发隐藏（hide 回调丢失）",
      file: "native/lfw/ui/uinode.cpp",
      from: `    set_focused_node(nullptr);
    invoke_all_on_hide();
  }`,
      to: `    set_focused_node(nullptr);
  }`,
    },
    {
      note: "on_pause：根判定反了",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (_parent == nullptr) {
    _state_focused_node = focused_node();`,
      to: `  if (_parent != nullptr) {
    _state_focused_node = focused_node();`,
    },
    {
      note: "on_click：左键匹配失效",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (click != nullptr && truthy(*click) && e.button == 0.0) {`,
      to: `  if (click != nullptr && truthy(*click) && false) {`,
    },
    {
      note: "on_click：中/右键动作接反",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (mclick != nullptr && truthy(*mclick) && e.button == 1.0) {
    actor().act(*this, *mclick);
    e.stop_propagation();
  }
  if (rclick != nullptr && truthy(*rclick) && e.button == 2.0) {
    actor().act(*this, *rclick);
    e.stop_propagation();
  }`,
      to: `  if (mclick != nullptr && truthy(*mclick) && e.button == 2.0) {
    actor().act(*this, *mclick);
    e.stop_propagation();
  }
  if (rclick != nullptr && truthy(*rclick) && e.button == 1.0) {
    actor().act(*this, *rclick);
    e.stop_propagation();
  }`,
    },
    {
      note: "on_click：不 stop_propagation",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (click != nullptr && truthy(*click) && e.button == 0.0) {
    actor().act(*this, *click);
    e.stop_propagation();
  }`,
      to: `  if (click != nullptr && truthy(*click) && e.button == 0.0) {
    actor().act(*this, *click);
  }`,
    },
    {
      note: "on_key_down：入参已 stop 还继续",
      file: "native/lfw/ui/uinode.cpp",
      from: `void UINode::on_key_down(LFWKeyEvent& e) {
  if (e.stopped() != 0) return;
  // components 空转。`,
      to: `void UINode::on_key_down(LFWKeyEvent& e) {
  // components 空转。`,
    },
    {
      note: "on_key_down：不看焦点就派发",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (focused() && e.game_key == u"a" && click != nullptr && truthy(*click)) {`,
      to: `  if (e.game_key == u"a" && click != nullptr && truthy(*click)) {`,
    },
    {
      note: "on_key_down：a/j 键位写反",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (focused() && e.game_key == u"a" && click != nullptr && truthy(*click)) {
    actor().act(*this, *click);
    e.stop_immediate_propagation();
  }
  if (focused() && e.game_key == u"j" && rclick != nullptr && truthy(*rclick)) {
    actor().act(*this, *rclick);
    e.stop_immediate_propagation();
  }`,
      to: `  if (focused() && e.game_key == u"j" && click != nullptr && truthy(*click)) {
    actor().act(*this, *click);
    e.stop_immediate_propagation();
  }
  if (focused() && e.game_key == u"a" && rclick != nullptr && truthy(*rclick)) {
    actor().act(*this, *rclick);
    e.stop_immediate_propagation();
  }`,
    },
    {
      note: "pop_page：栈顶判定失效（永弹）",
      file: "native/lfw/ui/uinode.cpp",
      from: `  if (layer == nullptr || layer->ui() != &rt) return false;`,
      to: `  if (layer == nullptr || layer->ui() == nullptr) return false;`,
    },
    {
      note: "create：items 不展开",
      file: "native/lfw/ui/uinode.cpp",
      from: `  const Array* const arr = items != nullptr ? as_array(*items) : nullptr;
  if (arr != nullptr) {`,
      to: `  const Array* const arr = nullptr;
  if (arr != nullptr) {`,
    },
    {
      note: "create：count 不筛正数",
      file: "native/lfw/ui/uinode.cpp",
      from: `        if (!std::isnan(c) && c > 0.0) count = c;`,
      to: `        if (!std::isnan(c)) count = c;`,
    },
    {
      note: "create：子节点不上树",
      file: "native/lfw/ui/uinode.cpp",
      from: `        std::unique_ptr<UINode> child = create(lfw, item_info, ret.get());
        ret->add_child(*child);`,
      to: `        std::unique_ptr<UINode> child = create(lfw, item_info, ret.get());`,
    },
    {
      note: "actor：假值 action 不早退",
      file: "native/lfw/ui/action/actor.cpp",
      from: `void UIActor::act(UINode& node, const Value& action) {
  if (!truthy(action)) return;`,
      to: `void UIActor::act(UINode& node, const Value& action) {`,
    },
    {
      note: "actor：数组 action 不展开",
      file: "native/lfw/ui/action/actor.cpp",
      from: `  if (const Array* const arr = as_array(action)) {
    for (size_t i = 0; i < arr->size(); ++i) act(node, arr->at(i));
    return;
  }`,
      to: `  if (false) return;`,
    },
    {
      note: "actor：未知 handler 不告警",
      file: "native/lfw/ui/action/actor.cpp",
      from: `    node.lfw().host().warn({Value(std::move(msg))});
    return;`,
      to: `    return;`,
    },
    {
      note: "actor：sound 的 NaN 不减 undefined",
      file: "native/lfw/ui/action/actor.cpp",
      from: `Value num_or_undef(const Value& v) {
  const double d = to_number(v);
  return std::isnan(d) ? Value() : Value(d);
}`,
      to: `Value num_or_undef(const Value& v) {
  const double d = to_number(v);
  return Value(d);
}`,
    },
    {
      note: "actor：set_page 的 id 丢了",
      file: "native/lfw/ui/action/actor.cpp",
      from: `  _map[u"set_page"] = [](UINode& n, const std::vector<Value>& a) {
    n.lfw().set_page(id_opts(arg_or(a, 0)), a.size() > 1 ? num_or_0(a[1]) : 0.0);
  };`,
      to: `  _map[u"set_page"] = [](UINode& n, const std::vector<Value>& a) {
    n.lfw().set_page(id_opts(Value()), a.size() > 1 ? num_or_0(a[1]) : 0.0);
  };`,
    },
    {
      note: "actor：pop_page 动作不生效",
      file: "native/lfw/ui/action/actor.cpp",
      from: `  _map[u"pop_page"] = [](UINode& n, const std::vector<Value>&) {
    n.pop_page(UIPopPageOpts());
  };`,
      to: `  _map[u"pop_page"] = [](UINode& n, const std::vector<Value>&) {
    (void)n;
  };`,
    },
    {
      note: "layer.set：同 id 不再早退",
      file: "native/lfw/ui/uilayer.cpp",
      from: `    const std::u16string* const cur = std::get_if<std::u16string>(&idv);
    if (cur != nullptr && *cur == opts.id) return;
  }`,
      to: `  }`,
    },
    {
      note: "layer.set：换页时旧页不 pause",
      file: "native/lfw/ui/uilayer.cpp",
      from: `    if (prev != nullptr) {
      prev->on_pause();
      prev->on_stop();
    }
  }`,
      to: `    if (prev != nullptr) {
      prev->on_stop();
    }
  }`,
    },
    {
      note: "layer.set：换页时旧页不 stop",
      file: "native/lfw/ui/uilayer.cpp",
      from: `    if (prev != nullptr) {
      prev->on_pause();
      prev->on_stop();
    }
  }`,
      to: `    if (prev != nullptr) {
      prev->on_pause();
    }
  }`,
    },
    {
      note: "layer.set：不叠层号到 z",
      file: "native/lfw/ui/uilayer.cpp",
      from: `  if (curr != nullptr) {
    curr->set_z(curr->z() + _index);
    _pages.push_back(std::move(curr));
    curr_raw = _pages.back().get();
    curr_raw->on_start();
    curr_raw->on_resume();
  }
  if (curr_raw != nullptr || prev != nullptr) {`,
      to: `  if (curr != nullptr) {
    curr->set_z(curr->z());
    _pages.push_back(std::move(curr));
    curr_raw = _pages.back().get();
    curr_raw->on_start();
    curr_raw->on_resume();
  }
  if (curr_raw != nullptr || prev != nullptr) {`,
    },
    {
      note: "layer.push：旧页不 pause",
      file: "native/lfw/ui/uilayer.cpp",
      from: `  UINode* const prev = ui();
  if (prev != nullptr) prev->on_pause();
  std::unique_ptr<UINode> curr = create_page(opts);`,
      to: `  UINode* const prev = ui();
  std::unique_ptr<UINode> curr = create_page(opts);`,
    },
    {
      note: "layer.pop：保留下限失效",
      file: "native/lfw/ui/uilayer.cpp",
      from: `  const double max_pop =
      static_cast<double>(len) - min(max(opts.min_pages, 0.0), static_cast<double>(len));`,
      to: `  const double max_pop = static_cast<double>(len);`,
    },
    {
      note: "layer.pop：只有首个 pop 才 pause 的语义错了",
      file: "native/lfw/ui/uilayer.cpp",
      from: `  for (size_t i = 0; i < poppeds.size(); ++i) {
    if (i == 0) poppeds[i]->on_pause();
    poppeds[i]->on_stop();
  }`,
      to: `  for (size_t i = 0; i < poppeds.size(); ++i) {
    poppeds[i]->on_pause();
    poppeds[i]->on_stop();
  }`,
    },
    {
      note: "layer.pop：until 判定失效（只弹一张）",
      file: "native/lfw/ui/uilayer.cpp",
      from: `    if (opts.until(*one, i, pages())) {
      if (opts.inclusive) poppeds.push_back(one);
      break;
    }`,
      to: `    if (false) {
      if (opts.inclusive) poppeds.push_back(one);
      break;
    }`,
    },
    {
      note: "layer.pop：inclusive 恒假",
      file: "native/lfw/ui/uilayer.cpp",
      from: `      if (opts.inclusive) poppeds.push_back(one);
      break;`,
      to: `      break;`,
    },
    {
      note: "layer.pop：不从栈里移除",
      file: "native/lfw/ui/uilayer.cpp",
      from: `  _pages.resize(len - poppeds.size());`,
      to: `  _pages.resize(len);`,
    },
    {
      note: "layer.pop：弹出后不恢复下层",
      file: "native/lfw/ui/uilayer.cpp",
      from: `  _pages.resize(len - poppeds.size());
  if (ui() != nullptr) ui()->on_resume();`,
      to: `  _pages.resize(len - poppeds.size());`,
    },
    {
      note: "layers.ensure：index 不当尺寸",
      file: "native/lfw/ui/uilayer.cpp",
      from: `  const size_t i = static_cast<size_t>(index);
  if (i >= _all.size()) _all.resize(i + 1);
  if (_all[i] == nullptr) _all[i] = std::make_unique<UILayer>(*_lfw, index);
  return *_all[i];`,
      to: `  const size_t i = static_cast<size_t>(index);
  if (i >= _all.size()) _all.resize(i + 2);
  if (_all[i] == nullptr) _all[i] = std::make_unique<UILayer>(*_lfw, index);
  return *_all[i];`,
    },
    {
      note: "LFW：on_set 接线丢了",
      file: "native/lfw/lfw.cpp",
      from: `    bottom.callbacks.on_set = [this](ui::UINode* curr, ui::UINode* prev, ui::UILayer&) {
      ui_changed(curr, prev);
    };`,
      to: `    bottom.callbacks.on_set = nullptr;`,
    },
    {
      note: "LFW：on_push 接线丢了",
      file: "native/lfw/lfw.cpp",
      from: `    bottom.callbacks.on_push = [this](ui::UINode* curr, ui::UINode* prev, ui::UILayer&) {
      ui_changed(curr, prev);
    };`,
      to: `    bottom.callbacks.on_push = nullptr;`,
    },
  ],
};
