#include "host/godot/lfw_godot_native_frame.h"

#include <cstdio>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <windowsx.h>
#endif

namespace lfw::host {
namespace {

#ifdef _WIN32

HWND g_hwnd = nullptr;
WNDPROC g_old_proc = nullptr;

int frame_dx(HWND h) {
  const UINT dpi = GetDpiForWindow(h);
  return GetSystemMetricsForDpi(SM_CXSIZEFRAME, dpi) +
         GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
}

int frame_dy(HWND h) {
  const UINT dpi = GetDpiForWindow(h);
  return GetSystemMetricsForDpi(SM_CYSIZEFRAME, dpi) +
         GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
}

LRESULT resize_band_hit(HWND h, LPARAM lp) {
  if (IsZoomed(h)) return HTNOWHERE;
  RECT r{};
  if (GetWindowRect(h, &r) == FALSE) return HTNOWHERE;
  const int x = GET_X_LPARAM(lp);
  const int y = GET_Y_LPARAM(lp);
  const int dx = frame_dx(h);
  const int dy = frame_dy(h);
  const bool left = x < r.left + dx;
  const bool right = x >= r.right - dx;
  const bool top = y < r.top + dy;
  const bool bottom = y >= r.bottom - dy;
  if (top && left) return HTTOPLEFT;
  if (top && right) return HTTOPRIGHT;
  if (bottom && left) return HTBOTTOMLEFT;
  if (bottom && right) return HTBOTTOMRIGHT;
  if (left) return HTLEFT;
  if (right) return HTRIGHT;
  if (top) return HTTOP;
  if (bottom) return HTBOTTOM;
  return HTNOWHERE;
}

LRESULT CALLBACK frame_proc(HWND h, UINT msg, WPARAM wp, LPARAM lp) {
  switch (msg) {
    case WM_NCCALCSIZE:
      if (wp != FALSE) {
        if ((GetWindowLongPtrW(h, GWL_STYLE) & WS_THICKFRAME) == 0) break;
        auto* const p = reinterpret_cast<NCCALCSIZE_PARAMS*>(lp);
        RECT& r = p->rgrc[0];
        int il = 0;
        int it = 0;
        int ir = 0;
        int ib = 0;
        native_frame_insets(h, &il, &it, &ir, &ib);
        r.left += il;
        r.top += it;
        r.right -= ir;
        r.bottom -= ib;
        return 0;
      }
      break;
    case WM_NCHITTEST: {
      const LRESULT band = resize_band_hit(h, lp);
      if (band != HTNOWHERE) return band;
      break;
    }
    default:
      break;
  }
  return CallWindowProcW(g_old_proc, h, msg, wp, lp);
}

#endif  // _WIN32

}  // namespace

bool install_native_frame(void* hwnd) {
#ifdef _WIN32
  if (hwnd == nullptr) return false;
  HWND const h = static_cast<HWND>(hwnd);
  if (g_hwnd == h && g_old_proc != nullptr) return true;
  if ((GetWindowLongPtrW(h, GWL_STYLE) & WS_THICKFRAME) == 0) return false; 
  const LONG_PTR old = SetWindowLongPtrW(h, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(&frame_proc));
  if (old == 0) return false;
  g_old_proc = reinterpret_cast<WNDPROC>(old);
  g_hwnd = h;
  SetWindowPos(h, nullptr, 0, 0, 0, 0,
               SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
  return true;
#else
  (void)hwnd;
  return false;
#endif
}

bool native_frame_installed() {
#ifdef _WIN32
  return g_hwnd != nullptr;
#else
  return false;
#endif
}

std::string native_frame_evidence(void* hwnd) {
#ifdef _WIN32
  if (hwnd == nullptr) return std::string();
  HWND const h = static_cast<HWND>(hwnd);
  RECT wr{};
  RECT cr{};
  GetWindowRect(h, &wr);
  GetClientRect(h, &cr);
  char buf[192];
  std::snprintf(buf, sizeof(buf),
                "hwnd=%p style=0x%08llX nc=%ldx%ld installed=%d", static_cast<void*>(h),
                static_cast<unsigned long long>(GetWindowLongPtrW(h, GWL_STYLE)),
                static_cast<long>((wr.right - wr.left) - (cr.right - cr.left)),
                static_cast<long>((wr.bottom - wr.top) - (cr.bottom - cr.top)),
                g_hwnd == h ? 1 : 0);
  return std::string(buf);
#else
  (void)hwnd;
  return std::string();
#endif
}

void native_frame_insets(void* hwnd, int* out_left, int* out_top, int* out_right,
                         int* out_bottom) {
  int dx = 0;
  int dy = 0;
  int top = 0;
#ifdef _WIN32
  if (hwnd != nullptr) {
    HWND const h = static_cast<HWND>(hwnd);
    dx = frame_dx(h);
    dy = frame_dy(h);
    top = IsZoomed(h) ? dy : 1;
  }
#else
  (void)hwnd;
#endif
  if (out_left != nullptr) *out_left = dx;
  if (out_top != nullptr) *out_top = top;
  if (out_right != nullptr) *out_right = dx;
  if (out_bottom != nullptr) *out_bottom = dy;
}

void native_frame_decoration(void* hwnd, int* out_dx, int* out_dy) {
  int dx = 0;
  int dy = 0;
#ifdef _WIN32
  if (hwnd != nullptr) {
    HWND const h = static_cast<HWND>(hwnd);
    RECT r{0, 0, 0, 0};
    if (AdjustWindowRectExForDpi(&r, static_cast<DWORD>(GetWindowLongPtrW(h, GWL_STYLE)), FALSE,
                                 static_cast<DWORD>(GetWindowLongPtrW(h, GWL_EXSTYLE)),
                                 GetDpiForWindow(h)) != FALSE) {
      dx = static_cast<int>(r.right - r.left);
      dy = static_cast<int>(r.bottom - r.top);
    }
  }
#else
  (void)hwnd;
#endif
  if (out_dx != nullptr) *out_dx = dx;
  if (out_dy != nullptr) *out_dy = dy;
}

}  // namespace lfw::host