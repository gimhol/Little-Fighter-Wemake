# ditto/importer/IImporter.ts

> 源文件: `src/LFW/ditto/importer/IImporter.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 24 |
| 大小 | 780 bytes |
| import 数 | 0 |
| export 数 | 3 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `any` 类型使用 1 处
- interface 定义
- type 别名
- async/await/Promise
- 二进制/字节数组
- 泛型默认 any

## C++ 移植要点

- `src/LFW/ditto/importer/IImporter.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- 存在 1 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 二进制/字节处理需映射到 `std::vector<uint8_t>` 等原生类型。
