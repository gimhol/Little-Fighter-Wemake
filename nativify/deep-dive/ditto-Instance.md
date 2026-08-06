# 深度分析：ditto/Instance.ts

> **整库移植的架构钥匙**。宿主(JS)能力注入点。自动评分：约 **2 / 5 容易**（71 行，接口为主），但**架构权重最高**。

## 职责

`Ditto` 是一个运行时依赖注入单例。JS 宿主（浏览器/electron）调用 `Ditto.setup(pack)` 注入全部平台能力：

- `Timeout` / `Interval`：定时器
- `Render`：渲染调度
- `Zip`：读 ZIP / 下载（Promise）
- `Sounds` / `Keyboard` / `Pointings` / `FullScreen`：音频、键盘、指针、全屏
- `Vector3` / `Vector2`：数学类型（**所有游戏逻辑都 new 它们**）
- `WorldRender` / `UINodeRenderer` / `ImageMgr` / `UIInputHandle`：渲染相关
- `XML` / `MD5` / `Cache` / `Importer` / `Log` / `alert`

## 为什么它对 C++ 移植至关重要

- **LFW 逻辑层几乎不直接触碰平台**，全部经由 `Ditto`。这天然对应 C++ 的抽象接口层：
  `IDitto` 的每个字段 → 一个纯虚接口类。
- `Ditto.setup(pack)` → C++ 侧一个 `Ditto::setup(IDittoPack&)` 注册函数。
- `Vector3`/`Vector2` 是**运行时构造**（`Ditto.vec3()` 用注入的类 new），C++ 中应换成值类型 `struct Vec3 { float x,y,z; }`，消除所有间接层——这反而是大优化点。

## 移植方案

```cpp
// 示意
struct IDittoPack {
  ITimeout&        timeout;
  IRender&         render;
  IZipReader&      zip;
  ISounds&         sounds;
  IKeyboard&       keyboard;
  ...
  struct Vector3 { float x=0, y=0, z=0; }; // 值类型
};
// 全局单例（或显式注入）
Ditto& Ditto::get();  // 初始化时绑定平台实现
```

## 具体文件对照

| ditto 子模块 | 行数 | C++ 形态 |
| --- | --- | --- |
| `Instance.ts` | 71 | `IDittoPack` 接口聚合 + 全局注册 |
| `sounds/ISounds.ts` | 156 | `ISounds` 纯虚接口（平台实现） |
| `sounds/BaseSounds.ts` | 107 | 接口默认实现骨架（可复刻） |
| `keyboard/*` | 38 | 输入接口 + 回调 |
| `image/*` | 143 | 图片加载/操作接口（纹理） |
| `xml/IXMLElement.ts` | 259 | XML 树接口（若 C++ 侧用 pugixml，可映射） |
| `zip/*` | 57 | ZIP 读取接口（minizip/libzip） |
| `cache/*` | 92 | 缓存接口 |
| `render/*` | 32 | 渲染器接口（最可能留在宿主侧） |

## 建议

- **第一批就定 Ditto 接口**：它决定整个移植的边界。逻辑层对平台的依赖收敛在这里。
- 渲染/音频/输入在 C++ 侧可用 SDL2/GLFW + 平台实现，或继续由 JS 宿主提供（FFI 桥），二选一即定生死。
- 预估：接口定义 3–5 天；平台实现按需另计。
