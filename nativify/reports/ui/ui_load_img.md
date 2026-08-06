# ui/ui_load_img.ts

> 源文件: `src/LFW/ui/ui_load_img.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 36 |
| 大小 | 1193 bytes |
| import 数 | 8 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- function 声明
- 正则/字符串匹配
- 数组高阶方法
- async/await/Promise
- 模板字符串
- 展开运算符 ...
- 异常处理

## C++ 移植要点

- `src/LFW/ui/ui_load_img.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 展开运算符需展开为循环或可变参数模板。
