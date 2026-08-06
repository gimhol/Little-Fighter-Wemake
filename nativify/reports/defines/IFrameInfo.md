# defines/IFrameInfo.ts

> 源文件: `src/LFW/defines/IFrameInfo.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 449 |
| 大小 | 12882 bytes |
| import 数 | 19 |
| export 数 | 4 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★★☆☆ 3.5 / 5 —— 中等偏难** |

## 检测到的语言特征

- `any` 类型使用 30 处
- interface 定义
- type 别名
- function 声明
- 箭头函数/回调
- string 键 Map
- 正则/字符串匹配
- 数组高阶方法
- 回调注册/事件
- 动态属性访问 obj[key]
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/defines/IFrameInfo.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 30 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- 展开运算符需展开为循环或可变参数模板。
