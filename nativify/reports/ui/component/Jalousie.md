# ui/component/Jalousie.ts

> 源文件: `src/LFW/ui/component/Jalousie.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 76 |
| 大小 | 2379 bytes |
| import 数 | 7 |
| export 数 | 2 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- class 定义
- interface 定义
- getter/setter
- static 成员
- 可选链 ?.
- 空值合并 ??
- 动态属性访问 obj[key]
- 模板字符串

## C++ 移植要点

- `src/LFW/ui/component/Jalousie.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
