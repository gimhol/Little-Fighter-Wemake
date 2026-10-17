#include "host/godot/lfw_godot_models.h"

#include <cmath>
#include <cstdint>
#include <cstring>
#include <utility>

#include <godot_cpp/classes/animation.hpp>
#include <godot_cpp/classes/animation_mixer.hpp>
#include <godot_cpp/classes/animation_player.hpp>
#include <godot_cpp/classes/camera3d.hpp>
#include <godot_cpp/classes/directional_light3d.hpp>
#include <godot_cpp/classes/environment.hpp>
#include <godot_cpp/classes/gltf_document.hpp>
#include <godot_cpp/classes/gltf_state.hpp>
#include <godot_cpp/classes/mesh.hpp>
#include <godot_cpp/classes/mesh_instance3d.hpp>
#include <godot_cpp/classes/node.hpp>
#include <godot_cpp/classes/node3d.hpp>
#include <godot_cpp/classes/packed_scene.hpp>
#include <godot_cpp/classes/sub_viewport.hpp>
#include <godot_cpp/classes/world_environment.hpp>
#include <godot_cpp/variant/packed_byte_array.hpp>
#include <godot_cpp/variant/quaternion.hpp>
#include <godot_cpp/variant/string.hpp>
#include <godot_cpp/variant/string_name.hpp>
#include <godot_cpp/variant/vector2i.hpp>
#include <godot_cpp/variant/vector3.hpp>

namespace lfw::host {

namespace {

godot::PackedByteArray to_bytes(const std::string& raw) {
  godot::PackedByteArray out;
  if (raw.empty()) return out;
  out.resize(static_cast<int64_t>(raw.size()));
  std::memcpy(out.ptrw(), raw.data(), raw.size());
  return out;
}

// glb 里可能出现相对资源（本项目里没有：全是自包含的单文件），给一个稳的基路径。
godot::String base_dir_of(const std::string& path) {
  const std::size_t slash = path.find_last_of('/');
  if (slash == std::string::npos) return godot::String("res://");
  return godot::String(("res://" + path.substr(0, slash)).c_str());
}

// 整棵树里找第一个 `AnimationPlayer`（glTF 生成的层级不固定）。
godot::AnimationPlayer* find_player(godot::Node* node) {
  if (node == nullptr) return nullptr;
  godot::AnimationPlayer* const self = godot::Object::cast_to<godot::AnimationPlayer>(node);
  if (self != nullptr) return self;
  for (int32_t i = 0; i < node->get_child_count(); ++i) {
    godot::AnimationPlayer* const hit = find_player(node->get_child(i));
    if (hit != nullptr) return hit;
  }
  return nullptr;
}

// 模型自带的包围盒（诊断：查"模型单位 / 缩放 / 原点对不对"用）。
void merge_mesh_aabb(godot::Node* node, godot::AABB& box, bool& first) {
  if (node == nullptr) return;
  godot::MeshInstance3D* const mesh_inst = godot::Object::cast_to<godot::MeshInstance3D>(node);
  if (mesh_inst != nullptr) {
    const godot::Ref<godot::Mesh> mesh = mesh_inst->get_mesh();
    if (!mesh.is_null()) {
      const godot::AABB aabb = mesh->get_aabb();
      if (first) {
        box = aabb;
        first = false;
      } else {
        box = box.merge(aabb);
      }
    }
  }
  for (int32_t i = 0; i < node->get_child_count(); ++i) merge_mesh_aabb(node->get_child(i), box, first);
}

}  // namespace

struct GodotModelBank::Slot {
  godot::SubViewport* viewport = nullptr;
  godot::Node3D* root = nullptr;              // 模型实例挂这儿（位置/缩放/旋转都在它身上）
  godot::Camera3D* camera = nullptr;
  godot::AnimationPlayer* player = nullptr;   // glb 里的（没有动画 ⇒ nullptr）
  godot::Node* instance = nullptr;
  std::string path;
  std::string anim;      // 当前播放的片段
  bool loop = false;
  bool reverse = false;
  bool hold_last = false;
  bool seen = false;     // 本帧有没有被 sync 到
};

GodotModelBank::GodotModelBank(std::function<bool(const std::string&, std::string&)> load)
    : _load(std::move(load)) {}

GodotModelBank::~GodotModelBank() {
  // 槽里的节点都属于场景树（父节点销毁时一起销毁）⇒ 这里只放指针。
  _slots.clear();
}

godot::Ref<godot::PackedScene> GodotModelBank::template_for(const std::string& path) {
  const auto found = _templates.find(path);
  if (found != _templates.end()) return found->second;

  godot::Ref<godot::PackedScene> packed;
  std::string raw;
  if (!_load(path, raw) || raw.empty()) {
    ++_failed;
    _last_error = "read failed: " + path;
    _templates.emplace(path, godot::Ref<godot::PackedScene>());
    return {};
  }
  godot::Ref<godot::GLTFDocument> doc;
  doc.instantiate();
  godot::Ref<godot::GLTFState> state;
  state.instantiate();
  state->set_base_path(base_dir_of(path));
  state->set_create_animations(true);
  const godot::Error parsed = doc->append_from_buffer(to_bytes(raw), state->get_base_path(), state);
  if (parsed != godot::OK) {
    ++_failed;
    _last_error = "glb parse failed (" + std::to_string(static_cast<int>(parsed)) + "): " + path;
    _templates.emplace(path, godot::Ref<godot::PackedScene>());
    return {};
  }
  godot::Node* const scene = doc->generate_scene(state);
  if (scene == nullptr) {
    ++_failed;
    _last_error = "glb scene failed: " + path;
    _templates.emplace(path, godot::Ref<godot::PackedScene>());
    return {};
  }
  // 诊断先量（`pack` 之后场景就交给 `PackedScene` 了，下面会 `memdelete`）。
  godot::AABB box;
  bool first_box = true;
  merge_mesh_aabb(scene, box, first_box);
  packed.instantiate();
  const godot::Error packed_ok = packed->pack(scene);
  memdelete(scene);
  if (packed_ok != godot::OK) {
    ++_failed;
    _last_error = "glb pack failed (" + std::to_string(static_cast<int>(packed_ok)) + "): " + path;
    packed = godot::Ref<godot::PackedScene>();
  } else {
    ++_loaded;
    char info[192];
    std::snprintf(info, sizeof(info), "(anims=%d,box=%.2fx%.2fx%.2f@%.2f,%.2f,%.2f)",
                  static_cast<int>(state->get_animations().size()),
                  static_cast<double>(box.size.x), static_cast<double>(box.size.y),
                  static_cast<double>(box.size.z), static_cast<double>(box.position.x),
                  static_cast<double>(box.position.y), static_cast<double>(box.position.z));
    _report += path + info + " ";
  }
  _templates.emplace(path, packed);
  return packed;
}

GodotModelBank::Slot& GodotModelBank::ensure_slot(const std::string& tag) {
  const auto found = _slots.find(tag);
  if (found != _slots.end()) return *found->second;

  auto slot = std::make_unique<Slot>();
  slot->viewport = memnew(godot::SubViewport);
  slot->viewport->set_size(godot::Vector2i(static_cast<int32_t>(kModelViewport),
                                           static_cast<int32_t>(kModelViewport)));
  slot->viewport->set_transparent_background(true);
  slot->viewport->set_update_mode(godot::SubViewport::UPDATE_ALWAYS);
  if (_parent != nullptr) _parent->add_child(slot->viewport);

  // 相机：正交，竖直方向覆盖 `kModelViewport` 个世界单位（= 逻辑像素）⇒ 画布中心就是原点。
  slot->camera = memnew(godot::Camera3D);
  slot->camera->set_projection(godot::Camera3D::PROJECTION_ORTHOGONAL);
  slot->camera->set_orthogonal(static_cast<float>(kModelViewport),
                               static_cast<float>(kModelViewport),
                               static_cast<float>(kModelViewport * 8.0));
  slot->camera->set_position(godot::Vector3(0.0f, 0.0f, static_cast<float>(kModelViewport)));
  slot->viewport->add_child(slot->camera);
  slot->camera->set_current(true);

  slot->root = memnew(godot::Node3D);
  slot->viewport->add_child(slot->root);

  // 光照照抄 TS `WorldRenderer`：环境光 0.7 + 平行光 1.4（位置 -300,400,600 指向原点）。
  godot::Ref<godot::Environment> env;
  env.instantiate();
  env->set_background(godot::Environment::BG_CLEAR_COLOR);
  env->set_ambient_source(godot::Environment::AMBIENT_SOURCE_COLOR);
  env->set_ambient_light_color(godot::Color(1.0f, 1.0f, 1.0f));
  env->set_ambient_light_energy(0.7f);
  godot::WorldEnvironment* const world_env = memnew(godot::WorldEnvironment);
  world_env->set_environment(env);
  slot->viewport->add_child(world_env);

  godot::DirectionalLight3D* const light = memnew(godot::DirectionalLight3D);
  light->set_param(godot::Light3D::PARAM_ENERGY, 1.4f);
  slot->viewport->add_child(light);
  light->look_at_from_position(godot::Vector3(-300.0f, 400.0f, 600.0f), godot::Vector3(),
                               godot::Vector3(0.0f, 1.0f, 0.0f));

  Slot& out = *slot;
  _slots.emplace(tag, std::move(slot));
  return out;
}

bool GodotModelBank::apply_slot(Slot& slot, const GodotModelSpec& spec) {
  if (slot.path != spec.path) {
    const godot::Ref<godot::PackedScene> packed = template_for(spec.path);
    if (packed.is_null()) return false;
    if (slot.instance != nullptr) {
      slot.root->remove_child(slot.instance);
      slot.instance->queue_free();
      slot.instance = nullptr;
    }
    slot.player = nullptr;
    slot.anim.clear();
    slot.instance = packed->instantiate();
    if (slot.instance == nullptr) {
      _last_error = "glb instantiate failed: " + spec.path;
      return false;
    }
    slot.root->add_child(slot.instance);
    slot.path = spec.path;
    slot.player = find_player(slot.instance);
  }
  // 节点摆放（TS `model_node.position/scale/rotation`）。
  slot.root->set_position(godot::Vector3(static_cast<float>(spec.px), static_cast<float>(spec.py),
                                         static_cast<float>(spec.pz)));
  slot.root->set_scale(godot::Vector3(static_cast<float>(spec.sx), static_cast<float>(spec.sy),
                                      static_cast<float>(spec.sz)));
  // 欧拉角是 three.js 的 XYZ 次序 ⇒ 自己拼四元数再交给引擎（Godot 的默认次序是 YXZ）。
  const double cx = std::cos(spec.rx / 2.0), cy = std::cos(spec.ry / 2.0);
  const double cz = std::cos(spec.rz / 2.0);
  const double sx = std::sin(spec.rx / 2.0), sy = std::sin(spec.ry / 2.0);
  const double sz = std::sin(spec.rz / 2.0);
  slot.root->set_quaternion(godot::Quaternion(
      static_cast<float>(sx * cy * cz + cx * sy * sz),
      static_cast<float>(cx * sy * cz - sx * cy * sz),
      static_cast<float>(cx * cy * sz + sx * sy * cz),
      static_cast<float>(cx * cy * cz - sx * sy * sz)));

  // 动画：片段名 / 循环 / 反向。TS 用 `AnimationMixer` 按模拟时间推进；这里交给引擎按真 delta
  // 推进（画面不需要逐帧确定性，三条摘要只覆盖模拟）。
  if (slot.player != nullptr) {
    const godot::StringName clip(spec.anim.c_str());
    if (!spec.anim.empty() && slot.player->has_animation(clip)) {
      if (slot.anim != spec.anim || slot.loop != spec.loop || slot.reverse != spec.reverse) {
        godot::Ref<godot::Animation> animation = slot.player->get_animation(clip);
        if (!animation.is_null()) {
          // ⚠ 同一路径的多个实例共享这份资源（`PackedScene` 的语义）⇒ 循环模式按最后一次设置
          // 生效；数据里同一路径的 `loop` 是一致的（robot 的 Idle 恒 `loop: true`）。
          animation->set_loop_mode(spec.loop ? godot::Animation::LOOP_LINEAR
                                            : godot::Animation::LOOP_NONE);
        }
        slot.anim = spec.anim;
        slot.loop = spec.loop;
        slot.reverse = spec.reverse;
        slot.hold_last = spec.hold_last;
        slot.player->set_speed_scale(spec.reverse ? -1.0f : 1.0f);
        slot.player->play(clip);
      }
    } else if (!slot.anim.empty()) {
      slot.player->stop();
      slot.anim.clear();
    }
  }
  return true;
}

godot::Ref<godot::ViewportTexture> GodotModelBank::sync(const std::string& tag,
                                                       const GodotModelSpec& spec) {
  Slot& slot = ensure_slot(tag);
  slot.seen = true;
  if (!apply_slot(slot, spec)) {
    slot.viewport->set_update_mode(godot::SubViewport::UPDATE_DISABLED);
    return {};
  }
  slot.viewport->set_update_mode(godot::SubViewport::UPDATE_ALWAYS);
  return slot.viewport->get_texture();
}

void GodotModelBank::end_frame() {
  for (auto& entry : _slots) {
    if (!entry.second->seen) {
      entry.second->viewport->set_update_mode(godot::SubViewport::UPDATE_DISABLED);
    }
    entry.second->seen = false;
  }
}

}  // namespace lfw::host
