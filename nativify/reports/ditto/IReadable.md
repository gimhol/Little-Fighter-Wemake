# ditto/IReadable.ts

> 源文件: `src/LFW/ditto/IReadable.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 6 |
| 大小 | 101 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- interface 定义
- async/await/Promise
- 二进制/字节数组

## C++ 移植要点

- `src/LFW/ditto/IReadable.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 二进制/字节处理需映射到 `std::vector<uint8_t>` 等原生类型。
