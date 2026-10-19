#include "register_types.h"

#include <gdextension_interface.h>

#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/core/defs.hpp>
#include <godot_cpp/godot.hpp>

#include "host/godot/lfw_godot_node.h"

void initialize_lfw_godot_module(godot::ModuleInitializationLevel p_level) {
  if (p_level != godot::MODULE_INITIALIZATION_LEVEL_SCENE) return;
  GDREGISTER_CLASS(lfw::host::LfwGodot);
}

void uninitialize_lfw_godot_module(godot::ModuleInitializationLevel p_level) {
  if (p_level != godot::MODULE_INITIALIZATION_LEVEL_SCENE) return;
}

extern "C" {
// `.gdextension` 的 `entry_symbol`。
GDExtensionBool GDE_EXPORT lfw_godot_library_init(
    GDExtensionInterfaceGetProcAddress p_get_proc_address,
    const GDExtensionClassLibraryPtr p_library, GDExtensionInitialization* r_initialization) {
  godot::GDExtensionBinding::InitObject init_obj(p_get_proc_address, p_library, r_initialization);
  init_obj.register_initializer(initialize_lfw_godot_module);
  init_obj.register_terminator(uninitialize_lfw_godot_module);
  init_obj.set_minimum_library_initialization_level(godot::MODULE_INITIALIZATION_LEVEL_SCENE);
  return init_obj.init();
}
}
