# Godot 宿主（DESIGN §G1 骨架）：把 `lfw_core` + `host/` 的 headless 装配链成一个 GDExtension，
# 由 Godot 自己当宿主（§G2(a)：同进程、同 C++ ABI ⇒ 不需要 WASM 那套函数指针表）。
#
# ⚠ 这一支**不许污染既有的 `msvc-x64` 验收**（§G8）：本文件只在根 CMakeLists 的
# `if(LFW_GODOT_HOST)` 守卫里被 add_subdirectory，而那个开关只由 `npm run native godot`
# （`native/tools/native.mjs`）打开 ⇒ `lfw_core` 的 include 路径里永远不会出现 godot-cpp。
#
# 两份来自仓库**外面**的输入（见 `native/README.md`「Godot 宿主」）：
#   * `LFW_GODOT_CPP_DIR`        godot-cpp 的检出目录（仓库外，例如 `C:/Users/<you>/godot-cpp-4.5`）
#   * `GODOTCPP_CUSTOM_API_FILE` 由 Godot 4.7.1 **自己 dump** 出来的 `extension_api.json`
#     （`<godot> --headless --dump-extension-api`；不在仓库里，放 `native/build/godot-api/`）
if(NOT LFW_GODOT_CPP_DIR)
  message(FATAL_ERROR "LFW_GODOT_HOST=ON needs -DLFW_GODOT_CPP_DIR=<path to godot-cpp> (outside this repo). See native/README.md 'Godot 宿主'.")
endif()
if(NOT EXISTS "${LFW_GODOT_CPP_DIR}/SConstruct")
  message(FATAL_ERROR "LFW_GODOT_CPP_DIR='${LFW_GODOT_CPP_DIR}' does not look like a godot-cpp checkout.")
endif()
if(NOT GODOTCPP_CUSTOM_API_FILE)
  message(FATAL_ERROR "godot-cpp must be generated against this machine's Godot: pass -DGODOTCPP_CUSTOM_API_FILE=<native/build/godot-api/extension_api.json> (see native/README.md 'Godot 宿主').")
endif()
if(NOT EXISTS "${GODOTCPP_CUSTOM_API_FILE}")
  message(FATAL_ERROR "GODOTCPP_CUSTOM_API_FILE='${GODOTCPP_CUSTOM_API_FILE}' not found. Run: <godot-console> --headless --dump-extension-api --dump-gdextension-interface  (in native/build/godot-api/)")
endif()

set(GODOTCPP_CUSTOM_API_FILE "${GODOTCPP_CUSTOM_API_FILE}" CACHE PATH "engine-dumped extension_api.json" FORCE)
set(GODOTCPP_TARGET "${GODOTCPP_TARGET}" CACHE STRING "godot-cpp target: editor | template_debug | template_release")

# godot-cpp 自己按它的选项编（它的 `binding_generator.py` 在 configure 期就用上面那份 API 生成绑定）。
add_subdirectory("${LFW_GODOT_CPP_DIR}" godot-cpp)

add_library(lfw_godot SHARED
  lfw_godot_font.cpp
  lfw_godot_host.cpp
  lfw_godot_models.cpp
  lfw_godot_native_frame.cpp
  lfw_godot_node.cpp
  lfw_godot_renderer.cpp
  lfw_godot_textures.cpp
  lfw_godot_ui_renderer.cpp
  register_types.cpp
)

# 与 `lfw_run`（host/CMakeLists.txt）同一批：`host/headless_host.cpp` + `fs_zip.cpp` + 共享装配。
target_sources(lfw_godot PRIVATE
  "${LFW_NATIVE_ROOT}/host/common/key_code.cpp"
  "${LFW_NATIVE_ROOT}/host/common/lfw_boot.cpp"
  "${LFW_NATIVE_ROOT}/host/common/ui_input_handle.cpp"
  "${LFW_NATIVE_ROOT}/host/common/zip_file.cpp"
  "${LFW_NATIVE_ROOT}/host/fs_zip.cpp"
  "${LFW_NATIVE_ROOT}/host/headless_host.cpp"
)

target_include_directories(lfw_godot PRIVATE "${LFW_NATIVE_ROOT}")
target_link_libraries(lfw_godot PRIVATE godot::cpp lfw_core)

# `lfw_godot_native_frame.cpp`（`--titlebar frame` 那一档：`WM_NCCALCSIZE` 让掉 caption）。
# user32 在 MSVC 的默认库里，这里显式写一遍只是让依赖看得见。
if(WIN32)
  target_link_libraries(lfw_godot PRIVATE user32)
endif()

get_target_property(GODOTCPP_SUFFIX godot-cpp GODOTCPP_SUFFIX)

if(MSVC)
  target_compile_options(lfw_godot PRIVATE /W4 /permissive- /utf-8)
  # 崩溃定位用：Godot 的 CrashHandler 只会打 `lfw_godot.dll+<偏移>`（"no debug info"）。
  # 有了 map 就能把偏移翻成符号：`dumpbin /map` 或直接在 `.map` 里搜 `0001:00xxxxxx`。
  target_link_options(lfw_godot PRIVATE "/MAP:${CMAKE_CURRENT_BINARY_DIR}/lfw_godot.map"
                                      "/MAPINFO:EXPORTS")
  # ⚠ **不关 RTTI**（与 `lfw_run` 那边不同）：这一支要过 godot-cpp 的公开面，而
  # `Object::cast_to<T>` 走的是 `dynamic_cast`（`godot-cpp/include/godot_cpp/core/object.hpp:129`）
  # ⇒ `/GR-` 下第一次 `Object::cast_to` 就会把进程带走（实测：加载即崩，退出码 0xE06D7363）。
  # 关 RTTI 只影响 `typeid`/`dynamic_cast`，不改任何 `std::` 类型的布局 ⇒ 与 `lfw_core`（`/GR-`）
  # 混编对 `Value`（`std::variant`）这条边界是安全的。
  target_compile_definitions(lfw_godot PRIVATE _HAS_EXCEPTIONS=0)
else()
  target_compile_options(lfw_godot PRIVATE -Wall -Wextra)
endif()

# 产物直接落进 Godot 工程（`project/lfw_godot.gdextension` 里写的就是这个名字），
# `project/bin/` 已被 .gitignore 忽略。
set_target_properties(lfw_godot PROPERTIES
  PREFIX ""
  OUTPUT_NAME "lfw_godot"
  CXX_VISIBILITY_PRESET default
  LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/project/bin"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/project/bin"
  FOLDER "godot"
)

message(STATUS "lfw_godot: godot-cpp suffix '${GODOTCPP_SUFFIX}', output ${CMAKE_CURRENT_SOURCE_DIR}/project/bin")
