#pragma once

#include "lfw/core/value.h"

namespace lfw::ui {

// TS `ui/CrossInfo.ts` + `ui/ICrossInfo.ts`。
struct CrossInfo {
  double left = 0;
  double top = 0;
  double right = 0;
  double bottom = 0;
  double mid_x = 0;
  double mid_y = 0;

  // `new CrossInfo(o)`：只认 `typeof === 'number'` 的字段（其余留 0）。
  static CrossInfo make(const Value& o);
  // `set(o)`。
  void set(const Value& o);
  // `compare(o)`：**不同** ⇒ true（TS 就这么叫的）。
  bool compare(const CrossInfo& o) const;
  CrossInfo clone() const { return *this; }
};

}
