# ui/utils/color_map.ts

> 源文件: `src/LFW/ui/utils/color_map.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 160 |
| 大小 | 4623 bytes |
| import 数 | 2 |
| export 数 | 1 |
| 分类 | 常量/静态数据 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- Map/Set 容器
- string 键 Map
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/utils/color_map.ts` 主要是静态常量/数据表，移植为 constexpr / 静态数组即可。
- 注意检查是否含对象字面量嵌套与联合类型字段，需要对应定义 POD struct。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
- 可空联合类型建议用 `std::optional` / 指针表达。
