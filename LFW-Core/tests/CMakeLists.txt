add_executable(lfw_core_tests test_times.cpp)
target_link_libraries(lfw_core_tests PRIVATE lfw_core)
set_project_warnings(lfw_core_tests)

add_test(NAME lfw_core_tests COMMAND lfw_core_tests)
