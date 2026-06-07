// ── DemoRecorder — ffmpeg screen capture and GIF conversion ─────────────────
// Used by demo test scenarios to record individual feature GIFs.
// Captures a region of the desktop matching the Antigravity IDE window.
// Uses desktop-mode gdigrab (not hwnd) because Electron's GPU-composited
// windows render as black with hwnd-based capture.

import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const FFMPEG = 'ffmpeg';

interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DemoRecorder {
  private _ffmpegProcess: ChildProcess | null = null;
  private _outputDir: string;
  private _windowRect: WindowRect | null = null;

  constructor(outputDir: string) {
    this._outputDir = outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  // ── Window discovery ──────────────────────────────────────────────────────

  /**
   * Find the Antigravity IDE demo window position and size by title.
   * Uses Win32 GetWindowRect via PowerShell for precise coordinates.
   */
  findWindow(workspaceName = '.demo-workspace'): WindowRect {
    if (this._windowRect) { return this._windowRect; }

    const scriptPath = path.join(this._outputDir, '_find_window.ps1');
    const scriptContent = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinRect {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

# Extension Development Host windows use title: [Extension Development Host] <workspace>
$proc = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and
    $_.MainWindowTitle -like '*Extension Development Host*' -and
    $_.MainWindowTitle -like '*${workspaceName}*'
} | Sort-Object StartTime -Descending | Select-Object -First 1

if (-not $proc) {
    # Fallback: any Extension Development Host window
    $proc = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        $_.MainWindowTitle -like '*Extension Development Host*'
    } | Sort-Object StartTime -Descending | Select-Object -First 1
}

if (-not $proc) {
    Write-Output "0,0,0,0"
    exit 1
}

$hwnd = $proc.MainWindowHandle

# Bring window to foreground
[WinRect]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 200

# Get window rectangle
$rect = New-Object WinRect+RECT
[WinRect]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

$x = $rect.Left
$y = $rect.Top
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top

Write-Output "$x,$y,$w,$h"
`;

    fs.writeFileSync(scriptPath, scriptContent, 'utf8');

    try {
      const result = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { encoding: 'utf8', timeout: 15000 }
      );

      const parts = result.trim().split(',').map(Number);
      if (parts.length !== 4 || parts[2] === 0 || parts[3] === 0) {
        throw new Error(`Could not find Antigravity IDE window. Got: ${result.trim()}`);
      }

      this._windowRect = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      return this._windowRect;
    } finally {
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
    }
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  /**
   * Start recording the desktop region where the Antigravity IDE window is.
   * Uses desktop-mode gdigrab with offset + video_size for reliable capture.
   *
   * @param name  Base name for the output file (without extension).
   * @param fps   Frames per second (default: 15).
   */
  startRecording(name: string, fps = 15): void {
    if (this._ffmpegProcess) {
      throw new Error('Recording already in progress');
    }

    const rect = this.findWindow();
    const mp4Path = path.join(this._outputDir, `${name}.mp4`);

    if (fs.existsSync(mp4Path)) { fs.unlinkSync(mp4Path); }

    this._ffmpegProcess = spawn(FFMPEG, [
      '-y',
      '-f', 'gdigrab',
      '-framerate', String(fps),
      '-offset_x', String(rect.x),
      '-offset_y', String(rect.y),
      '-video_size', `${rect.width}x${rect.height}`,
      '-i', 'desktop',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      mp4Path,
    ], {
      stdio: ['pipe', 'ignore', 'ignore'],
    });

    this._ffmpegProcess.on('error', (err) => {
      console.error(`ffmpeg error: ${err.message}`);
      this._ffmpegProcess = null;
    });
  }

  /**
   * Stop the current recording gracefully by sending 'q' to ffmpeg stdin.
   * Returns a promise that resolves when ffmpeg exits.
   */
  async stopRecording(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._ffmpegProcess) {
        resolve();
        return;
      }

      const proc = this._ffmpegProcess;
      this._ffmpegProcess = null;

      proc.on('close', () => resolve());
      proc.on('error', (err) => reject(err));

      // Send 'q' to stdin to gracefully stop ffmpeg
      if (proc.stdin) {
        proc.stdin.write('q');
        proc.stdin.end();
      }

      // Fallback: kill after 5 seconds if it doesn't exit
      setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* already exited */ }
        resolve();
      }, 5000);
    });
  }

  // ── GIF conversion ────────────────────────────────────────────────────────

  /**
   * Convert an MP4 recording to an optimized GIF using a two-pass palette approach.
   * Pass 1: generate optimal palette from the video.
   * Pass 2: encode GIF using the palette for superior color quality.
   *
   * @param name   Base name (same as used in startRecording).
   * @param width  Output GIF width in pixels (height scales proportionally).
   * @param fps    Output GIF frame rate (default: 12).
   */
  convertToGif(name: string, width: number, fps = 12): void {
    const mp4Path = path.join(this._outputDir, `${name}.mp4`);
    const palettePath = path.join(this._outputDir, `${name}_palette.png`);
    const gifPath = path.join(this._outputDir, `${name}.gif`);

    if (!fs.existsSync(mp4Path)) {
      throw new Error(`MP4 not found: ${mp4Path}`);
    }

    const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`;

    // Pass 1: generate palette
    execSync([
      FFMPEG, '-y',
      '-i', `"${mp4Path}"`,
      '-vf', `"${filters},palettegen=stats_mode=diff"`,
      `"${palettePath}"`,
    ].join(' '), { stdio: 'ignore', timeout: 60000 });

    // Pass 2: encode GIF with palette
    execSync([
      FFMPEG, '-y',
      '-i', `"${mp4Path}"`,
      '-i', `"${palettePath}"`,
      '-lavfi', `"${filters} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3"`,
      `"${gifPath}"`,
    ].join(' '), { stdio: 'ignore', timeout: 60000 });

    // Cleanup intermediate files
    if (fs.existsSync(palettePath)) { fs.unlinkSync(palettePath); }

    const stats = fs.statSync(gifPath);
    console.log(`  ✓ ${name}.gif — ${(stats.size / 1024).toFixed(0)} KB`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Remove all intermediate MP4 files, keeping only the final GIFs.
   */
  cleanupMp4Files(): void {
    for (const file of fs.readdirSync(this._outputDir)) {
      if (file.endsWith('.mp4')) {
        try { fs.unlinkSync(path.join(this._outputDir, file)); } catch { /* ignore locked */ }
      }
    }
  }
}

// ── Timing helpers ──────────────────────────────────────────────────────────

/** Wait for a specified number of milliseconds. */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
