# dat_translator/decode_lf2_dat.ts

> 源文件: `src/LFW/dat_translator/decode_lf2_dat.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 15 |
| 大小 | 549 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- function 声明
- 数组高阶方法
- 动态属性访问 obj[key]
- async/await/Promise
- 二进制/字节数组
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/dat_translator/decode_lf2_dat.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 二进制/字节处理需映射到 `std::vector<uint8_t>` 等原生类型。
- 展开运算符需展开为循环或可变参数模板。
