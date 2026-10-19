cmake_minimum_required(VERSION 3.20)

project(lfw_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(LFW_NATIVE_ROOT "${CMAKE_CURRENT_SOURCE_DIR}")

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

if(MSVC)
  add_compile_options(/W4 /permissive- /utf-8 /fp:precise)
  add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
else()
  add_compile_options(-Wall -Wextra -ffp-contract=off -fno-fast-math)
endif()

add_subdirectory(lfw)
add_subdirectory(host)
if(LFW_GODOT_HOST)
  # Godot 宿主（GDExtension，DESIGN §G1）。**只有 `npm run native godot`**
  # （`native/tools/native.mjs` 传 `-DLFW_GODOT_HOST=ON -DLFW_GODOT_CPP_DIR=…`）会打开
  # ⇒ `msvc-x64` / `wasm` 完全不受影响，也绝不让 godot-cpp 的头文件路径进 `lfw_core`（§G8）。
  add_subdirectory(host/godot)
endif()
if(EMSCRIPTEN)
  # WASM 宿主的步行骨架（DESIGN W12/W13）。守卫在这里 + 子目录里各一道：
  # `msvc-x64` 预设下 `EMSCRIPTEN` 为假 ⇒ 不配置这个 target，`all` 里也不会多出东西。
  add_subdirectory(host/wasm)
endif()
add_subdirectory(tests)
