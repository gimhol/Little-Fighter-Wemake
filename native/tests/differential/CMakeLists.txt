file(GLOB SUBJECT_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/subjects/*.cpp")

# 台面要能构造**真 `LFW`**（切片 4CL）：ck2/ck5/ck6 那几族缝的真实现（`ui::UILayers` / `DatMgr` /
# 整个 `IWorldLfw`）都以具体 `LFW&` 为入参，台面造不出来就退不掉。这里直接复用 headless 宿主的
# 实现（`host/headless_host.cpp`，本就是 `ILfwHost` 的最小可用实现），编译标志与 `lfw_core` /
# `lfw_run` 保持一致（RTTI / 异常开关不一致会让两边各自实例化 `std::variant` 同名模板）。
add_library(lfw_headless_host STATIC
  "${LFW_NATIVE_ROOT}/host/headless_host.cpp"
  "${LFW_NATIVE_ROOT}/host/common/key_code.cpp"
  "${LFW_NATIVE_ROOT}/host/common/ui_input_handle.cpp"
  "${LFW_NATIVE_ROOT}/host/common/zip_file.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/world_fixture.cpp"
)
target_link_libraries(lfw_headless_host PUBLIC lfw_core)
if(MSVC)
  target_compile_options(lfw_headless_host PRIVATE /W4 /permissive- /utf-8 /GR-)
  target_compile_definitions(lfw_headless_host PRIVATE _HAS_EXCEPTIONS=0)
else()
  target_compile_options(lfw_headless_host PRIVATE -fno-exceptions -fno-rtti)
endif()

foreach(src ${SUBJECT_SOURCES})
  get_filename_component(subject "${src}" NAME_WE)
  set(target "lfw_trace_${subject}")
  add_executable(${target} "${src}")
  target_link_libraries(${target} PRIVATE lfw_core lfw_headless_host)
  # ⚠ 必须与 `lfw_core` 的 RTTI / 异常开关一致：台面的 TU 现在会经 `world_fixture.h` 看到
  # `lfw.h` / `std::variant`（`Value`）的内部结构，开关不一致时 MSVC 会给出「标识符 Value 未知」
  # 这类与真实原因无关的错误（4CL 收尾时踩过）。
  if(MSVC)
    target_compile_options(${target} PRIVATE /GR-)
    target_compile_definitions(${target} PRIVATE _HAS_EXCEPTIONS=0)
  else()
    target_compile_options(${target} PRIVATE -fno-exceptions -fno-rtti)
  endif()
  set_target_properties(${target} PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  )
endforeach()
