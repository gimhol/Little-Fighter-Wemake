# defines/IStagePhaseInfo.ts

> 源文件: `src/LFW/defines/IStagePhaseInfo.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 166 |
| 大小 | 4159 bytes |
| import 数 | 6 |
| export 数 | 3 |
| 分类 | 常量/静态数据 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- `any` 类型使用 11 处
- interface 定义
- type 别名
- 正则/字符串匹配

## C++ 移植要点

- `src/LFW/defines/IStagePhaseInfo.ts` 主要是静态常量/数据表，移植为 constexpr / 静态数组即可。
- 注意检查是否含对象字面量嵌套与联合类型字段，需要对应定义 POD struct。
- 存在 11 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
