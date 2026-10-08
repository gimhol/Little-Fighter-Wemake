#pragma once

#include "lfw/core/value.h"

namespace lfw {
namespace ui {

class UINode;
class UIComponent;

// TS 的 `instance_getter` 会直接交出 `UINode` / `UIComponent` 对象引用；端口的值模型里没有对象
// 句柄 ⇒ 用「引用值」表达：一个普通对象 `{ "__uinode": <id> }` / `{ "__uicomp": <id> }`，
// id 指向进程级登记表（只为可观测性/取回用，表只增不减）。
//
// 观察口径：TS 侧把解析结果归一成 `node:<id>` / `comp:<f_name#id>` 再打日志，两侧同为字符串。
Value make_node_ref(UINode* node);
Value make_comp_ref(UIComponent* comp);
UINode* ref_to_node(const Value& v);
UIComponent* ref_to_comp(const Value& v);

}
}
