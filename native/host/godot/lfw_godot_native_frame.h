#pragma once

#include <string>

namespace lfw::host {

bool install_native_frame(void* hwnd);
bool native_frame_installed();

std::string native_frame_evidence(void* hwnd);

void native_frame_decoration(void* hwnd, int* out_dx, int* out_dy);

void native_frame_insets(void* hwnd, int* out_left, int* out_top, int* out_right,
                         int* out_bottom);

}  // namespace lfw::host