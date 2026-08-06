# LFW-Core

LFW（Little Fighter Wemake）逻辑层的 **TS → C++ 移植核心库**。

对应 `src/LFW/` 的移植目标。目录布局逐步镜像 TS 源码结构：

```
src/lfw/defines/    ← 数据模型（IFrameInfo / IEntityData ...）
src/lfw/utils/      ← 纯函数工具（math / Times / string_parser ...）
src/lfw/entity/     ← 核心模拟（Entity ...）
src/lfw/state/      ← 状态机
src/lfw/collision/  ← 碰撞
...
```

## 构建（Windows）

前置：CMake ≥ 3.20 + Visual Studio 2022（MSVC）或 MinGW-w64。

```powershell
# 配置 + 编译 + 测试
cmake -B build -S .
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

或直接用 VS Code / Visual Studio 打开 `CMakeLists.txt`。

如需 JSON 数据加载（后续 `loader/` 需要）：

```powershell
cmake -B build -S . -DLFW_CORE_ENABLE_JSON=ON
```

> **本机提示**：若 `cmake` 不在 PATH，可用 VS 自带版本：
> ```powershell
> $cm = "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
> & $cm -B build -S . -G "Visual Studio 18 2026" -A x64
> & $cm --build build --config Release
> ```
> 控制台打印中文乱码时，先执行 `chcp 65001`（源码为 UTF-8，/utf-8 已开启）。

## 移植顺序建议

1. `utils/`（Times、math、string_parser）——纯函数、无平台依赖
2. `defines/`——数据结构
3. `entity/` + `state/` + `collision/`——核心模拟
4. `controller/` + `bot/` + `stage/` + `World`
5. `loader/`（JSON/数据加载）
6. `ditto/` 接口层（渲染/音频/输入由宿主注入）

## 约定

- C++20；核心逻辑保持**确定性**（浮点运算顺序与 TS 一致，见 `round_float`）
- 实体等热对象走**对象池**，反向指针用裸指针（生命周期：LFW 拥有 World，World 拥有 Entity）
- `Times.ts` 等已移植单元用 CTest 保持行为一致性
