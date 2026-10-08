#include "lfw/ui/component/img_loop.h"

#include "lfw/ui/uinode.h"
#include "lfw/utils/easing/ease_linearity.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace ui {

namespace {

const Value& field(const Value& obj, const char16_t* key) {
  static const Value kUndef;
  const Object* const o = as_object(obj);
  if (o == nullptr) return kUndef;
  const Value* const p = o->get(std::u16string(key));
  return p != nullptr ? *p : kUndef;
}

double num_field(const Value& obj, const char16_t* key, double dflt) {
  const Value& v = field(obj, key);
  if (const double* const d = std::get_if<double>(&v)) return *d;
  return dflt;
}

// `image.clone()`（ImageInfo 浅拷贝：`new ImageInfo(this)` —— 先落全部声明字段初值
// （可选项是 undefined），再按源键序覆盖/追加）。
void image_defaults(Object& out) {
  out.set(u"key", Value(u""));
  out.set(u"url", Value(u""));
  out.set(u"src", Value(u""));
  out.set(u"src_url", Value(u""));
  out.set(u"scale", Value(0.0));
  out.set(u"w", Value(0.0));
  out.set(u"h", Value(0.0));
  out.set(u"min_filter", Value());
  out.set(u"mag_filter", Value());
  out.set(u"wrap_s", Value());
  out.set(u"wrap_t", Value());
  out.set(u"pic", Value());
  out.set(u"flip_x", Value());
  out.set(u"flip_y", Value());
  out.set(u"clip_x", Value());
  out.set(u"clip_y", Value());
  out.set(u"clip_w", Value());
  out.set(u"clip_h", Value());
  out.set(u"bitmap", Value());
}

Value clone_image(const Value& image) {
  auto out = std::make_shared<Object>();
  image_defaults(*out);
  if (const Object* const src = as_object(image)) {
    for (const std::u16string& k : src->keys()) {
      const Value* const v = src->get(k);
      if (v != nullptr) out->set(k, *v);
    }
  }
  return Value(out);
}

void set_field(Object& o, const char16_t* key, const Value& v) {
  o.set(std::u16string(key), v);
}

}

const ClazzTag* ImgLoop::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& ImgLoop::TAGS() {
  static const std::vector<std::u16string> tags{u"ImgLoop"};
  return tags;
}

const std::u16string& ImgLoop::props_tag() const {
  static const std::u16string tag = u"ImgLoop";
  return tag;
}

const Value& ImgLoop::props_meta() const {
  static const Value meta = [] {
    auto req = [](const char16_t* key) {
      auto p = std::make_shared<Object>();
      p->set(u"type", Value(u"number"));
      p->set(u"nullable", Value(false));
      (void)key;
      return p;
    };
    auto opt = []() {
      auto p = std::make_shared<Object>();
      p->set(u"type", Value(u"number"));
      return p;
    };
    auto o = std::make_shared<Object>();
    o->set(u"w", Value(req(u"w")));
    o->set(u"h", Value(req(u"h")));
    o->set(u"col", Value(opt()));
    o->set(u"row", Value(opt()));
    o->set(u"count", Value(opt()));
    o->set(u"duration", Value(opt()));
    return Value(o);
  }();
  return meta;
}

ImgLoop::ImgLoop(UINode& layout, const std::u16string& f_name, const Value& info)
    : UIComponent(layout, f_name, info) {
  _anim.set_duration(1000);
  _anim.set_easing(ease_linearity);
  _anim.set_times(0);
  _anim.set_fill_mode(1);
}

void ImgLoop::on_start() {
  const Value* const p = props();
  double duration = 1000;
  double w = 0;
  double h = 0;
  double count = 1;
  double col = 1;
  double row = 1;
  if (p != nullptr) {
    duration = num_field(*p, u"duration", 1000);
    w = num_field(*p, u"w", 0);
    h = num_field(*p, u"h", 0);
    count = num_field(*p, u"count", 1);
    col = num_field(*p, u"col", 1);
    row = num_field(*p, u"row", 1);
  }
  _anim.set(0, count).set_duration(duration);
  for (double i = 0; i < row && static_cast<double>(_rects.size()) < count; ++i) {
    for (double j = 0; j < col && static_cast<double>(_rects.size()) < count; ++j) {
      const double x = w * j;
      const double y = h * i;
      _rects.push_back(IRect{x, y, w, h});
    }
  }
}

void ImgLoop::stop() {
  _anim.set_times(1).set_count(0);
}

void ImgLoop::start() {
  if (!enabled()) set_enabled(true);
  _anim.set_times(0).set_count(0);
}

void ImgLoop::update(double dt) {
  if (_rects.empty()) return;
  const Value image = node.image();
  if (as_object(image) == nullptr) {
    set_enabled(false);
    return;
  }
  _anim.update(dt);
  const double idx = floor(_anim.value());
  const size_t i = idx >= 0 ? static_cast<size_t>(idx) : 0;
  if (i >= _rects.size()) {
    node.set_visible(false);
  } else {
    const IRect& rect = _rects[i];
    node.set_visible(true);
    Value cloned = clone_image(image);
    Object* const o = as_object(cloned);
    if (o != nullptr) {
      set_field(*o, u"clip_x", Value(rect.x));
      set_field(*o, u"clip_y", Value(rect.y));
      set_field(*o, u"clip_w", Value(rect.w));
      set_field(*o, u"clip_h", Value(rect.h));
    }
    node.set_image(std::move(cloned));
  }

  if (_anim.done()) set_enabled(false);
}

}
}
