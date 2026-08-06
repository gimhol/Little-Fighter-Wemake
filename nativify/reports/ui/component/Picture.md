# ui/component/Picture.ts

> 源文件: `src/LFW/ui/component/Picture.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 30 |
| 大小 | 1212 bytes |
| import 数 | 5 |
| export 数 | 2 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- class 定义
- interface 定义
- type 别名
- 箭头函数/回调
- getter/setter
- static 成员
- 可选链 ?.
- 空值合并 ??
- DOM/浏览器 API
- 模板字符串
- 异常处理

## C++ 移植要点

- `src/LFW/ui/component/Picture.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 涉及 DOM/浏览器 API，C++ 侧需要对应的渲染/事件抽象层（如通过 FFI 或平台层注入）。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
