# ui/ICookedUIInfo.ts

> 源文件: `src/LFW/ui/ICookedUIInfo.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 35 |
| 大小 | 1131 bytes |
| import 数 | 7 |
| export 数 | 1 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- `any` 类型使用 1 处
- interface 定义
- 正则/字符串匹配
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/ICookedUIInfo.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- 存在 1 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- 可空联合类型建议用 `std::optional` / 指针表达。
