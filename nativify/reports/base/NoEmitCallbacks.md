# base/NoEmitCallbacks.ts

> 源文件: `src/LFW/base/NoEmitCallbacks.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 112 |
| 大小 | 2654 bytes |
| import 数 | 1 |
| export 数 | 2 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 6 处
- `unknown` 使用 2 处
- class 定义
- 箭头函数/回调
- getter/setter
- Map/Set 容器
- 数组高阶方法
- 动态属性访问 obj[key]
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/base/NoEmitCallbacks.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 6 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- 展开运算符需展开为循环或可变参数模板。
