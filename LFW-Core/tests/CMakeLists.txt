add_executable(lfw_core_tests test_times.cpp)
target_link_libraries(lfw_core_tests PRIVATE lfw_core)
set_project_warnings(lfw_core_tests)

add_test(NAME lfw_core_tests COMMAND lfw_core_tests)

# utils/math 纯函数（难度 1 移植）
add_executable(lfw_core_math_tests test_math.cpp)
target_link_libraries(lfw_core_math_tests PRIVATE lfw_core)
set_project_warnings(lfw_core_math_tests)

add_test(NAME lfw_core_math_tests COMMAND lfw_core_math_tests)

# utils 其余纯函数/纯类型（type_check / type_cast / easing / cross_bounding / array / container_help）
add_executable(lfw_core_utils_tests test_utils.cpp)
target_link_libraries(lfw_core_utils_tests PRIVATE lfw_core)
set_project_warnings(lfw_core_utils_tests)

add_test(NAME lfw_core_utils_tests COMMAND lfw_core_utils_tests)
