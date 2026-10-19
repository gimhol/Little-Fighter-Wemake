# WASM 宿主的步行骨架（DESIGN W12/W13 第 1 步）：把 `lfw_core` + `host/` 的 headless 宿主
# 链成一个 `--no-entry` 的 ES6 模块，由 `native/web/host.mjs` 驱动。
#
# 只进 `wasm` 预设：`EMSCRIPTEN` 为假时整段跳过（根 CMakeLists 也有一道守卫），
# 所以 `msvc-x64` 的 configure/build/test/lint 完全不受影响。
if(NOT EMSCRIPTEN)
  return()
endif()

add_executable(lfw_wasm
  # 直接复用 headless 宿主的两份实现（与 `lfw_run` 同一批源文件）：
  # `--zip <目录>` 读包、存档、XML、import_as_* 全都不必重写。
  "${LFW_NATIVE_ROOT}/host/common/key_code.cpp"
  "${LFW_NATIVE_ROOT}/host/common/lfw_boot.cpp"
  "${LFW_NATIVE_ROOT}/host/common/ui_input_handle.cpp"
  "${LFW_NATIVE_ROOT}/host/common/zip_file.cpp"
  "${LFW_NATIVE_ROOT}/host/fs_zip.cpp"
  "${LFW_NATIVE_ROOT}/host/headless_host.cpp"
  lfw_wasm.cpp
)

target_include_directories(lfw_wasm PRIVATE "${LFW_NATIVE_ROOT}")
target_link_libraries(lfw_wasm PRIVATE lfw_core)
target_compile_options(lfw_wasm PRIVATE -Wall -Wextra)

# 链接期开关（每一条都在 `native/web/host.mjs` 里有对应用法）：
#   --no-entry                    没有 `main`：入口是导出的 `lfw_*`
#   -sMODULARIZE/-sEXPORT_ES6     产出工厂函数 + `.mjs`，页面 `import` 拿实例（W12）
#   -sEXPORT_NAME=createLfwWasm   工厂名（`const m = await createLfwWasm(...)`）
#   -sALLOW_MEMORY_GROWTH=1       初始 16 MiB 装不下 MEMFS 灌进来的数据包 + 世界（W7 的代价）
#   -sALLOW_TABLE_GROWTH=1        JS 用 `addFunction` 往函数表里塞平台回调（W4 的函数指针表）
#   -sSTACK_SIZE=5MB              MSVC 侧默认 1 MiB 栈；emscripten 默认 64 KiB，JSON5 递归会踩到
#   -sENVIRONMENT=node,web        node 供 `native/web/smoke.mjs` 冒烟；不开 worker（核心单线程）
#   （**故意不设** `-sFILESYSTEM=0`：这一刀复用了 `host/fs_zip.cpp` 的 `<filesystem>`/`<fstream>`，
#     数据从 JS 灌进 MEMFS 再读；等换成内存 `IZip` 之后才能按 W12 关掉 FS。）
target_link_options(lfw_wasm PRIVATE
  --no-entry
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sEXPORT_NAME=createLfwWasm
  -sALLOW_MEMORY_GROWTH=1
  -sALLOW_TABLE_GROWTH=1
  -sSTACK_SIZE=5MB
  -sENVIRONMENT=node,web
  -sEXPORTED_FUNCTIONS=[_malloc,_free,_lfw_abi_version,_lfw_scratch_ptr,_lfw_scratch_capacity,_lfw_platform_init,_lfw_str_put,_lfw_create,_lfw_add_zip,_lfw_load,_lfw_boot,_lfw_frame,_lfw_clock_now,_lfw_frames,_lfw_entities,_lfw_ghosts,_lfw_lifetime,_lfw_total_hp,_lfw_warn_count,_lfw_error_count,_lfw_log_count,_lfw_data_count,_lfw_digest,_lfw_dump_state,_lfw_last_error_len,_lfw_invoke,_lfw_probe_schedule,_lfw_probe_hits,_lfw_shutdown]
  -sEXPORTED_RUNTIME_METHODS=[FS,addFunction,removeFunction,stringToUTF16,UTF16ToString,HEAPU8]
)

set_target_properties(lfw_wasm PROPERTIES
  OUTPUT_NAME "lfw_wasm"
  SUFFIX ".mjs"  # `EXPORT_ES6` 要求产物是 `.mjs`（`lfw_wasm.wasm` 落在旁边）
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)
