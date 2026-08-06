# ui/utils/read_nums.ts

> 源文件: `src/LFW/ui/utils/read_nums.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 99 |
| 大小 | 2541 bytes |
| import 数 | 1 |
| export 数 | 5 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- function 声明
- 箭头函数/回调
- 正则/字符串匹配
- 数组高阶方法
- 动态属性访问 obj[key]
- 模板字符串
- 异常处理
- 可空联合类型
- 数字/字符串转换

## C++ 移植要点

- `src/LFW/ui/utils/read_nums.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- 可空联合类型建议用 `std::optional` / 指针表达。
