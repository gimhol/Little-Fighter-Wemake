#include "lfw/ui/uilayer.h"

#include <utility>

#include "lfw/helper/ui_helper.h"
#include "lfw/ui/uinode.h"
#include "lfw/ui/value_spread.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/world.h"

namespace lfw::ui {

UILayer::UILayer(LFW& lfw, double index) : _lfw(&lfw), _index(index) {}

std::vector<UINode*> UILayer::pages() const {
  std::vector<UINode*> ret;
  for (const std::unique_ptr<UINode>& p : _pages) {
    if (p != nullptr) ret.push_back(p.get());
  }
  return ret;
}

UINode* UILayer::ui() const { return _pages.empty() ? nullptr : _pages.back().get(); }

UINode* UILayer::at(double idx) const {
  if (!(idx >= 0) || idx != floor(idx)) return nullptr;
  const size_t i = static_cast<size_t>(idx);
  if (i >= _pages.size()) return nullptr;
  return _pages[i].get();
}

std::unique_ptr<UINode> UILayer::create_page(const UIPushPageOpts& opts) {
  // `this.lfw.uis.all?.find((v) => v.id === id)`：缺失的 id 也是 undefined，与无 id 的条目相等。
  const Value want = opts.has_id ? Value(opts.id) : Value();
  for (const Value& v : _lfw->ui_helper().all()) {
    if (strict_equals(field_or(v, u"id"), want)) {
      return UINode::create(*_lfw, v, nullptr, this);
    }
  }
  return nullptr;
}

void UILayer::dispose() {
  for (std::unique_ptr<UINode>& p : _pages) {
    if (p == nullptr) continue;
    p->on_pause();
    p->on_stop();
  }
}

void UILayer::set(const UIPushPageOpts& opts) {
  if (opts.has_id && ui() != nullptr) {
    const Value idv = ui()->id();
    const std::u16string* const cur = std::get_if<std::u16string>(&idv);
    if (cur != nullptr && *cur == opts.id) return;
  }
  std::unique_ptr<UINode> prev;
  if (!_pages.empty()) {
    prev = std::move(_pages.back());
    _pages.pop_back();
    if (prev != nullptr) {
      prev->on_pause();
      prev->on_stop();
    }
  }
  std::unique_ptr<UINode> curr = create_page(opts);
  UINode* curr_raw = nullptr;
  if (curr != nullptr) {
    curr->set_z(curr->z() + _index);
    _pages.push_back(std::move(curr));
    curr_raw = _pages.back().get();
    curr_raw->on_start();
    curr_raw->on_resume();
  }
  if (curr_raw != nullptr || prev != nullptr) {
    if (callbacks.on_set) callbacks.on_set(curr_raw, prev.get(), *this);
  }
}

void UILayer::push(const UIPushPageOpts& opts) {
  UINode* const prev = ui();
  if (prev != nullptr) prev->on_pause();
  std::unique_ptr<UINode> curr = create_page(opts);
  UINode* curr_raw = nullptr;
  if (curr != nullptr) {
    curr->set_z(curr->z() + _index);
    _pages.push_back(std::move(curr));
    curr_raw = _pages.back().get();
    curr_raw->on_start();
    curr_raw->on_resume();
  }
  if (callbacks.on_push) callbacks.on_push(curr_raw, prev, *this);
}

void UILayer::pop(const UIPopPageOpts& opts) {
  std::vector<UINode*> poppeds;
  const size_t len = _pages.size();
  const double max_pop =
      static_cast<double>(len) - min(max(opts.min_pages, 0.0), static_cast<double>(len));
  for (double i = static_cast<double>(len) - 1.0;
       i >= 0 && static_cast<double>(poppeds.size()) < max_pop; --i) {
    UINode* const one = _pages[static_cast<size_t>(i)].get();
    if (!opts.until) {
      poppeds.push_back(one);
      break;
    }
    if (opts.until(*one, i, pages())) {
      if (opts.inclusive) poppeds.push_back(one);
      break;
    }
    poppeds.push_back(one);
  }
  for (size_t i = 0; i < poppeds.size(); ++i) {
    if (i == 0) poppeds[i]->on_pause();
    poppeds[i]->on_stop();
  }
  _pages.resize(len - poppeds.size());
  if (ui() != nullptr) ui()->on_resume();
  if (callbacks.on_pop) callbacks.on_pop(ui(), poppeds, *this);
}

class UILayers::UiAdapter : public IWorldUi {
 public:
  explicit UiAdapter(UINode* node) : _node(node) {}
  bool disabled() const override { return _node->disabled(); }
  void update(double dt) override { _node->update(dt); }

 private:
  UINode* _node;
};

UILayers::UILayers(LFW& lfw) : _lfw(&lfw) {}

UILayer* UILayers::bottom() const { return _all.empty() ? nullptr : _all.front().get(); }

UILayer* UILayers::top() const { return _all.empty() ? nullptr : _all.back().get(); }

std::vector<UILayer*> UILayers::all() const {
  std::vector<UILayer*> ret;
  for (const std::unique_ptr<UILayer>& l : _all) ret.push_back(l.get());
  return ret;
}

UINode* UILayers::ui_top() const {
  for (size_t i = _all.size(); i > 0; --i) {
    UILayer* const layer = _all[i - 1].get();
    if (layer == nullptr) continue;
    if (UINode* const u = layer->ui()) return u;
  }
  return nullptr;
}

double UILayers::length() const { return static_cast<double>(_all.size()); }

UILayer& UILayers::push_layer() {
  _all.push_back(std::make_unique<UILayer>(*_lfw, 0.0));
  return *_all.back();
}

UILayer& UILayers::ensure(double index) {
  if (!(index >= 0) || index != floor(index)) {
    _loose.push_back(std::make_unique<UILayer>(*_lfw, index));
    return *_loose.back();
  }
  const size_t i = static_cast<size_t>(index);
  if (i >= _all.size()) _all.resize(i + 1);
  if (_all[i] == nullptr) _all[i] = std::make_unique<UILayer>(*_lfw, index);
  return *_all[i];
}

UILayer* UILayers::at(double index) {
  if (!(index >= 0) || index != floor(index)) return nullptr;
  const size_t i = static_cast<size_t>(index);
  if (i >= _all.size()) return nullptr;
  return _all[i].get();
}

void UILayers::push() { push_layer(); }

void UILayers::set_page(const Value& opts, double index) { ensure(index).set(to_opts(opts)); }

void UILayers::push_page(const Value& opts, double index) { ensure(index).push(to_opts(opts)); }

void UILayers::dispose() {
  for (std::unique_ptr<UILayer>& l : _all) {
    if (l != nullptr) l->dispose();
  }
  _all.clear();
}

UINode* UILayers::ui() { return ui_top(); }

std::vector<IWorldUi*> UILayers::layer_uis() {
  _adapters.clear();
  std::vector<IWorldUi*> ret;
  for (const std::unique_ptr<UILayer>& l : _all) {
    if (l == nullptr) continue;
    UINode* const u = l->ui();
    if (u == nullptr) continue;
    _adapters.push_back(std::make_unique<UiAdapter>(u));
    ret.push_back(_adapters.back().get());
  }
  return ret;
}

UIPushPageOpts UILayers::to_opts(const Value& opts) {
  UIPushPageOpts ret;
  const Value* const id = field_of(opts, u"id");
  if (id != nullptr) {
    if (const std::u16string* const s = std::get_if<std::u16string>(id)) {
      ret.id = *s;
      ret.has_id = true;
    }
  }
  return ret;
}

}  // namespace lfw::ui
