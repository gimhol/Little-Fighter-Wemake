# loader/preprocess_itr.ts

> 源文件: `src/LFW/loader/preprocess_itr.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 224 |
| 大小 | 8161 bytes |
| import 数 | 11 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- type 别名
- function 声明
- 箭头函数/回调
- 正则/字符串匹配
- 数组高阶方法
- 可选链 ?.
- 空值合并 ??
- 动态属性访问 obj[key]
- async/await/Promise
- 展开运算符 ...
- switch 分支

## C++ 移植要点

- `src/LFW/loader/preprocess_itr.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 展开运算符需展开为循环或可变参数模板。
