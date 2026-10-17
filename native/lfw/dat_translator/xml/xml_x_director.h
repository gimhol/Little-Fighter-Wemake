#pragma once

#include <memory>
#include <string>

#include "lfw/core/value.h"
#include "lfw/ditto/xml/i_xml.h"
#include "lfw/ditto/xml/i_xml_element.h"

namespace lfw {
namespace dat_translator {
namespace xml {

// Mirrors `src/LFW/dat_translator/xml/xml_x_director.ts` 的**索引**部分（4CJ 切片）：
//   `xml_2_director_index` —— `id`/`file` 带 `?? ""` 缺省，`name`/`skipped` 有则加、无则无键；
//   `xml_x_director_index` —— 固定写 id/file/name/skipped 四个属性（tag 缺省 `directors`）。
// 其余函数（`xml_2_director` / `xml_to_directors` / `xml_x_director*` 等）尚未移植。
std::shared_ptr<IXMLElement> xml_x_director_index(IXML& xml, const Value& idx,
                                                  const std::u16string& tag = u"directors");
Value xml_2_director_index(const IXMLElement& el);

}
}
}
