cmake_minimum_required(VERSION 3.20)

project(LFWCore
  VERSION 0.1.0
  DESCRIPTION "LFW (Little Fighter Wemake) 的 C++ 移植核心库"
  LANGUAGES CXX
)

# ---------------------------------------------------------------------------
# 选项
# ---------------------------------------------------------------------------
option(LFW_CORE_BUILD_TESTS "构建单元测试 (CTest)" ON)
option(LFW_CORE_ENABLE_JSON "FetchContent 引入 nlohmann/json（首次构建需联网）" OFF)

# ---------------------------------------------------------------------------
# 全局设置
# ---------------------------------------------------------------------------
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
  set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS Debug Release RelWithDebInfo MinSizeRel)
endif()

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include(cmake/CompilerWarnings.cmake)

# ---------------------------------------------------------------------------
# 核心静态库：LFW 逻辑的移植目标
# ---------------------------------------------------------------------------
add_library(lfw_core STATIC
  src/lfw/utils/Times.cpp
)

target_include_directories(lfw_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
)
target_compile_features(lfw_core PUBLIC cxx_std_20)
set_project_warnings(lfw_core)

if(LFW_CORE_ENABLE_JSON)
  include(FetchContent)
  FetchContent_Declare(nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.11.3
  )
  FetchContent_MakeAvailable(nlohmann_json)
  target_link_libraries(lfw_core PUBLIC nlohmann_json::nlohmann_json)
endif()

# ---------------------------------------------------------------------------
# 可执行入口（demo / 后续放 CLI）
# ---------------------------------------------------------------------------
add_executable(lfw_core_app src/main.cpp)
target_link_libraries(lfw_core_app PRIVATE lfw_core)
set_project_warnings(lfw_core_app)

# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------
if(LFW_CORE_BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()
