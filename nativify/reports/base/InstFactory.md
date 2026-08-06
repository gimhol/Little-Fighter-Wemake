# base/InstFactory.ts

> 源文件: `src/LFW/base/InstFactory.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 123 |
| 大小 | 4469 bytes |
| import 数 | 2 |
| export 数 | 4 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 4 处
- `unknown` 使用 6 处
- class 定义
- interface 定义
- type 别名
- function 声明
- 箭头函数/回调
- Map/Set 容器
- 可选链 ?.
- 空值合并 ??
- instanceof 类型判断
- 模板字符串
- 展开运算符 ...
- 异常处理
- 可空联合类型

## C++ 移植要点

- `src/LFW/base/InstFactory.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 4 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- instanceof 运行时类型判断需改用 typeid / 虚函数 / 判别联合。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
