# defines/CPointKind.ts

> 源文件: `src/LFW/defines/CPointKind.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 16 |
| 大小 | 252 bytes |
| import 数 | 0 |
| export 数 | 2 |
| 分类 | 常量/静态数据 |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- enum 定义

## C++ 移植要点

- `src/LFW/defines/CPointKind.ts` 主要是静态常量/数据表，移植为 constexpr / 静态数组即可。
- 注意检查是否含对象字面量嵌套与联合类型字段，需要对应定义 POD struct。
