# headless 宿主 + 可运行入口（`lfw_run`）：把 `ILfwHost` 接到 `LFW` 上，读真实数据包推帧。
add_executable(lfw_run
  common/key_code.cpp
  common/lfw_boot.cpp
  common/ui_input_handle.cpp
  common/zip_file.cpp
  fs_zip.cpp
  headless_host.cpp
  lfw_run.cpp
)

target_include_directories(lfw_run PRIVATE "${LFW_NATIVE_ROOT}")
target_link_libraries(lfw_run PRIVATE lfw_core)

if(MSVC)
  target_compile_options(lfw_run PRIVATE /W4 /permissive- /utf-8)
  # 与 `lfw_core` 同款：RTTI / 异常关掉。混着编会让两边各自实例化同一批头文件模板
  #（`Value` 的 `std::variant` 就在里面），两边对 `std::` 内部布局的理解必须一致。
  target_compile_options(lfw_run PRIVATE /GR-)
  target_compile_definitions(lfw_run PRIVATE _HAS_EXCEPTIONS=0)
else()
  target_compile_options(lfw_run PRIVATE -Wall -Wextra)
endif()

set_target_properties(lfw_run PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)

# 录制型薄宿主（`lfw_thin`）：同一批源文件，只换世界渲染器 —— 见 `host/thin/CMakeLists.txt`。
add_subdirectory(thin)
