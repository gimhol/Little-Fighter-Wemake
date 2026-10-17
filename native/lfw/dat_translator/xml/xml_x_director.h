#pragma once

#include <memory>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/ditto/xml/i_xml.h"
#include "lfw/ditto/xml/i_xml_element.h"

namespace lfw {
namespace dat_translator {
namespace xml {

// Mirrors `src/LFW/dat_translator/xml/xml_x_director.ts`（4CJ：数据驱动的关卡导演）。
//
//   `xml_2_director_index` / `xml_x_director_index` —— 索引那一层
//     （`id`/`file` 带 `?? ""` 缺省，`name`/`skipped` 有则加键、无则无键）；
//   `xml_2_director` / `xml_to_directors` —— `<directors>` → `IDirectorData[]`；
//   `xml_x_director` / `xml_x_directors` —— 反写。
//
// 数据形状用 `Value`（`Object` 保插入序，与 TS 的对象字面量同序）：
//   `IDirectorData` = { name, bg?, stage?, actors?, groups?, setup?, auto?, timeline? }
//   动作是 `{ op: "input" | "set" | … }` 的联合，几何量是数字表达式（`TNumberExpr`：
//   纯数字 → `double`，否则原字符串，求值走 `utils/eval_number`）。
std::shared_ptr<IXMLElement> xml_x_director_index(IXML& xml, const Value& idx,
                                                  const std::u16string& tag = u"directors");
Value xml_2_director_index(const IXMLElement& el);

Value xml_2_director(const IXMLElement& el);
std::vector<Value> xml_to_directors(const IXMLElement& el);
std::shared_ptr<IXMLElement> xml_x_director(IXML& xml, const Value& data,
                                            const std::u16string& tag = u"director");
std::shared_ptr<IXMLElement> xml_x_directors(IXML& xml, const Value& group);

}
}
}
