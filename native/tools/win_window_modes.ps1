# 窗口外观的外部证据（Windows 专有；`native/README.md`「窗口外观」引的就是它）。
#
# 为什么要在**进程外面**量：`--titlebar` 的四个档差别（无边框 / 系统标题栏 / 系统边框）不在客户区里
# —— `--screenshot` 抓的是视口，看不见 OS 画的 caption 与那圈边框。这里用 Win32 问 Windows 本人：
#   * `GetWindowLongW(GWL_STYLE)`：`WS_POPUP`（无边框）vs `WS_CAPTION|WS_THICKFRAME`（系统边框 + 标题栏）；
#   * `GetWindowRect` vs `GetClientRect`：非客户区有多宽/多高（有 caption 时上面那一条 = 31 px 左右）；
#   * `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)`：DWM 认的可见外框（顺便看有没有阴影区）。
# 再加一张**屏幕截图**（窗口 + 30 px 桌面边）⇒ 肉眼能看见 OS 标题栏到底在不在。
#
# 用法（在仓库根跑；脚本自己起 Godot、量完杀进程）：
#   powershell -File native\tools\win_window_modes.ps1                       # 三档都跑一遍 + 抓图到 native\build
#   powershell -File native\tools\win_window_modes.ps1 -Modes frame -Grab $false
#   powershell -File native\tools\win_window_modes.ps1 -Godot "C:\path\Godot_v4.7.1-stable_win64_console.exe"
param(
  [string]$Modes = "native,custom,frame",
  [string]$Godot = "C:\Users\$env:USERNAME\Desktop\Godot_v4.7.1-stable_win64_console.exe",
  [int]$Seconds = 10,
  [bool]$Grab = $true,
  [string]$Root = "",
  [string]$TitleArgs = "--window-scale 1.5"
)
$ErrorActionPreference = "Continue"
if ($Root -eq "") { $Root = (Get-Location).Path }
if (-not (Test-Path $Godot)) { Write-Output "godot not found: $Godot"; exit 2 }
Add-Type -AssemblyName System.Drawing
Add-Type -Namespace G -Name W -MemberDefinition @'
[DllImport("user32.dll")] public static extern int GetWindowLongW(IntPtr h, int i);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
public delegate bool EnumProc(IntPtr h, IntPtr p);
public struct RECT { public int L, T, R, B; }
public struct POINT { public int X, Y; }
'@

function Show-Window([string]$mode) {
  $proc = Get-Process -Name "Godot_v4.7.1-stable_win64" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $proc) { Write-Output "  ($mode) no engine process found"; return }
  $target = @([int]$proc.Id)
  $script:found = @()
  $cb = [G.W+EnumProc]{
    param($h, $pp)
    $wpid = 0
    [void][G.W]::GetWindowThreadProcessId($h, [ref]$wpid)
    if ($target -contains [int]$wpid -and [G.W]::IsWindowVisible($h)) { $script:found += $h }
    return $true
  }
  [void][G.W]::EnumWindows($cb, [IntPtr]::Zero)
  foreach ($h in $script:found) {
    $style = [G.W]::GetWindowLongW($h, -16)
    $wr = New-Object G.W+RECT
    [void][G.W]::GetWindowRect($h, [ref]$wr)
    $cr = New-Object G.W+RECT
    [void][G.W]::GetClientRect($h, [ref]$cr)
    $pt = New-Object G.W+POINT
    [void][G.W]::ClientToScreen($h, [ref]$pt)
    $dw = New-Object G.W+RECT
    $hr = [G.W]::DwmGetWindowAttribute($h, 9, [ref]$dw, 16)
    $bits = @()
    if ($style -band 0x80000000) { $bits += "WS_POPUP" }
    if (($style -band 0x00C00000) -eq 0x00C00000) { $bits += "WS_CAPTION" }
    if ($style -band 0x00040000) { $bits += "WS_THICKFRAME" }
    if ($style -band 0x00080000) { $bits += "WS_SYSMENU" }
    if ($style -band 0x00020000) { $bits += "WS_MINIMIZEBOX" }
    if ($style -band 0x00010000) { $bits += "WS_MAXIMIZEBOX" }
    $ww = $wr.R - $wr.L
    $wh = $wr.B - $wr.T
    Write-Output ("  style=0x{0:X8} [{1}]" -f $style, ($bits -join " "))
    Write-Output ("  window rect={0},{1} {2}x{3}   client rect={4},{5} {6}x{7}   non-client={8}x{9}" -f
      $wr.L, $wr.T, $ww, $wh, $pt.X, $pt.Y, ($cr.R - $cr.L), ($cr.B - $cr.T),
      ($ww - ($cr.R - $cr.L)), ($wh - ($cr.B - $cr.T)))
    if ($hr -eq 0) {
      Write-Output ("  DWM extended frame bounds={0},{1} {2}x{3}" -f $dw.L, $dw.T, ($dw.R - $dw.L), ($dw.B - $dw.T))
    }
    if ($Grab) {
      $bmp = New-Object System.Drawing.Bitmap ($ww + 60), ($wh + 60)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($wr.L - 30, $wr.T - 30, 0, 0, $bmp.Size)
      $out = Join-Path $Root "native\build\screen-$mode.png"
      $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
      $g.Dispose()
      $bmp.Dispose()
      Write-Output "  screen grab (window + 30px desktop) -> native\build\screen-$mode.png"
    }
  }
}

foreach ($mode in $Modes.Split(",")) {
  Write-Output "== --titlebar $mode"
  $log = Join-Path $Root "native\build\mode-$mode.log"
  $argList = @("--path", "native\host\godot\project", "--", "--root", "$Root\dist",
    "--zip", "$Root\native\build\host-data\prel", "--titlebar", $mode, "--play")
  $argList += $TitleArgs.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
  $p = Start-Process -FilePath $Godot -ArgumentList $argList -PassThru `
    -RedirectStandardOutput $log -RedirectStandardError (Join-Path $Root "native\build\mode-$mode.err")
  Start-Sleep -Seconds $Seconds
  Get-Content $log -ErrorAction SilentlyContinue |
    Select-String -Pattern "window:|titlebar: icons|frame ->" |
    ForEach-Object { Write-Output "  $_" }
  Show-Window $mode
  $engine = Get-Process -Name "Godot_v4.7.1-stable_win64" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($engine) { Stop-Process -Id $engine.Id }
  if (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) { Stop-Process -Id $p.Id }
  Start-Sleep -Seconds 3
}
