# Factory.ts

> 源文件: `src/LFW/Factory.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 114 |
| 大小 | 4436 bytes |
| import 数 | 12 |
| export 数 | 5 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 2 处
- class 定义
- interface 定义
- type 别名
- static 成员
- Map/Set 容器
- string 键 Map
- 数组高阶方法
- 可选链 ?.
- 空值合并 ??
- 动态属性访问 obj[key]
- 模板字符串
- 展开运算符 ...
- 可空联合类型

## C++ 移植要点

- `src/LFW/Factory.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 2 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
