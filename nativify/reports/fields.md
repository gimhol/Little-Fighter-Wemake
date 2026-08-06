# fields.ts

> 源文件: `src/LFW/fields.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 103 |
| 大小 | 4054 bytes |
| import 数 | 0 |
| export 数 | 13 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 18 处
- interface 定义
- type 别名
- function 声明
- 箭头函数/回调
- Map/Set 容器
- Object.* 反射方法
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.
- 空值合并 ??
- 动态属性访问 obj[key]
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/fields.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 18 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 展开运算符需展开为循环或可变参数模板。
- Object.* 反射方法需替换为显式代码或序列化框架。
