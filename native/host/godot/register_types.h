// 扩展的入口与类注册（GDExtension 的 C ABI 面，只有这一个文件；`.gdextension` 的
// `entry_symbol` 指向下面那个 `lfw_godot_library_init`）。
#pragma once

#include <godot_cpp/core/class_db.hpp>

void initialize_lfw_godot_module(godot::ModuleInitializationLevel p_level);
void uninitialize_lfw_godot_module(godot::ModuleInitializationLevel p_level);
