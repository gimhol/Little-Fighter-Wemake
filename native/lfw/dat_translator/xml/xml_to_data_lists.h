#pragma once

#include <string>

#include "lfw/core/value.h"
#include "lfw/ditto/xml/i_xml_element.h"

namespace lfw {
namespace dat_translator {
namespace xml {

// Mirrors `src/LFW/dat_translator/xml/xml_to_data_lists.ts`（函数名就是 `xml_2_data_lists`）：
// 六个键 objects/backgrounds/stages/bots/moves/directors，各是 `children_by_tag` 后逐个
// `xml_2_dat_index`（`directors` 用 `xml_2_director_index`）的数组（**恒有**，可能空）。
Value xml_2_data_lists(const IXMLElement& el);

}
}
}
