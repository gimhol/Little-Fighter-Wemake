# base/Callbacks.ts

> 源文件: `src/LFW/base/Callbacks.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 17 |
| 大小 | 561 bytes |
| import 数 | 1 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- `any` 类型使用 3 处
- class 定义
- 箭头函数/回调
- 动态属性访问 obj[key]
- 展开运算符 ...
- 可空联合类型

## C++ 移植要点

- `src/LFW/base/Callbacks.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 3 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
