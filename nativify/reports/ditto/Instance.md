# ditto/Instance.ts

> 源文件: `src/LFW/ditto/Instance.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 74 |
| 大小 | 2670 bytes |
| import 数 | 19 |
| export 数 | 3 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- `any` 类型使用 8 处
- `unknown` 使用 5 处
- interface 定义
- 箭头函数/回调
- Object.* 反射方法
- async/await/Promise
- 二进制/字节数组
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/ditto/Instance.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 8 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 二进制/字节处理需映射到 `std::vector<uint8_t>` 等原生类型。
- 展开运算符需展开为循环或可变参数模板。
- Object.* 反射方法需替换为显式代码或序列化框架。


## 📌 人工深度分析

本文件为核心文件，已人工复核。详见：[deep-dive/ditto-Instance.md](../deep-dive/ditto-Instance.md)
