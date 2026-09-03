#!/usr/bin/env python3
"""HTML 动画捕获器：动画 HTML → 快照 PNG / 动图 GIF（混合交付 Phase 1 素材）。

与 embed_animation.py 配套：本脚本负责「捕获」，嵌入交给 embed_animation.py。
触发语义（显式声明）由 skills/ppts-pptx/SKILL.md 的混合交付章节约定——
Brief 没有明确要求动画嵌入时，不应当运行本脚本。

依赖：
- playwright（Python 包）：帧捕获。浏览器优先 bundled chromium，缺失时
  依次回退系统 Chrome / Edge（channel 探测）；都没有则报错并给安装指引。
- ffmpeg（仅 gif/both 模式）：调色板两帧法合成高质量 GIF
  （palettegen → paletteuse，bayer 抖动），比默认 256 色量化观感好得多。

产物（写入 --out-dir，名字取 HTML 主名）：
- <name>.snapshot.png  快照：--delay-ms 等待后的静帧（快照兜底模式用）
- <name>.poster.png    海报：GIF 采样首帧（gif/both 模式；推荐作嵌入快照）
- <name>.anim.gif      动图（gif/both 模式；放映时自动循环播放）

工程约定：只用标准库 + 可选导入 playwright；子进程一律参数数组（禁 shell 拼接）。
"""

from __future__ import annotations

import argparse
import os
import posixpath
import shutil
import subprocess
import tempfile
import urllib.request

MAX_DURATION_S = 15
MAX_FPS = 15
GIF_SIZE_BUDGET = 3 * 1024 * 1024  # 软预算：超过打 WARN（SKILL.md 体积纪律）


def fail(message: str, code: int = 1) -> None:
    print(f"[super-ppts] ERROR: {message}")
    raise SystemExit(code)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HTML 动画捕获器（快照 PNG / 动图 GIF）")
    parser.add_argument("--html", required=True, help="动画 HTML 路径（本地文件）")
    parser.add_argument("--out-dir", help="产物目录（缺省与 HTML 同目录）")
    parser.add_argument("--mode", choices=["snapshot", "gif", "both"], default="snapshot",
                        help="snapshot=仅快照；gif=仅动图；both=快照+动图（默认 snapshot）")
    parser.add_argument("--width", type=int, default=1280, help="视口宽（px，默认 1280）")
    parser.add_argument("--height", type=int, default=720, help="视口高（px，默认 720）")
    parser.add_argument("--delay-ms", type=int, default=800,
                        help="首帧前等待（ms，让入场动画/字体就绪；默认 800）")
    parser.add_argument("--duration", type=float, default=6.0,
                        help=f"GIF 采样时长（秒，默认 6，上限 {MAX_DURATION_S}）")
    parser.add_argument("--fps", type=int, default=10,
                        help=f"GIF 采样帧率（默认 10，上限 {MAX_FPS}）")
    parser.add_argument("--max-width", type=int, default=800,
                        help="GIF 输出宽（px，等比缩放；默认 800，控制体积）")
    parser.add_argument("--colors", type=int, default=128,
                        help="GIF 调色板色数（默认 128）")
    parser.add_argument("--clip", metavar="X,Y,W,H",
                        help="可选截取区域（CSS px，视口内）；缺省整视口")
    parser.add_argument("--keep-frames", action="store_true",
                        help="调试：保留逐帧 PNG 临时目录并打印路径")
    return parser.parse_args()


def launch_browser(playwright):
    """chromium → chrome → msedge 依次探测；全部失败给可执行指引。"""
    attempts: list[str] = []
    try:
        return playwright.chromium.launch(), "chromium"
    except Exception as exc:  # noqa: BLE001 - 逐通道降级探测
        attempts.append(f"chromium: {str(exc).splitlines()[0] if exc else 'unavailable'}")
    for channel in ("chrome", "msedge"):
        try:
            return playwright.chromium.launch(channel=channel), channel
        except Exception as exc:  # noqa: BLE001
            attempts.append(f"{channel}: {str(exc).splitlines()[0] if exc else 'unavailable'}")
    fail(
        "无可用的 Playwright 浏览器。任选其一：\n"
        "  python3 -m playwright install chromium\n"
        "  或安装系统 Chrome/Edge 后重试\n"
        + "\n".join(f"  - {line}" for line in attempts)
    )


def parse_clip(text: str | None) -> dict | None:
    if not text:
        return None
    try:
        x, y, w, h = (float(part.strip()) for part in text.split(","))
    except ValueError:
        fail(f"--clip 需要四个数字 X,Y,W,H（收到：{text}）")
    return {"x": x, "y": y, "width": w, "height": h}


def file_url(path: str) -> str:
    return urljoin_path(os.path.abspath(path))


def urljoin_path(abspath: str) -> str:
    return "file://" + urllib.request.pathname2url(posixpath.normpath(abspath.replace(os.sep, "/")))


def capture_frames(page, out: argparse.Namespace, frames_dir: str) -> int:
    """按 fps × duration 采样视口；返回帧数。截图自身耗时使采样间隔略有漂移，动图可接受。"""
    clip = parse_clip(out.clip)
    total = max(2, min(MAX_FPS, out.fps) * int(min(MAX_DURATION_S, out.duration)))
    interval_ms = max(30, int(1000 / min(MAX_FPS, out.fps)))
    for index in range(total):
        page.screenshot(path=os.path.join(frames_dir, f"{index:04d}.png"), clip=clip)
        page.wait_for_timeout(interval_ms)
    return total


def assemble_gif(ffmpeg: str, frames_dir: str, out: argparse.Namespace,
                 gif_path: str) -> None:
    """调色板两帧法：scale → split[palettegen | paletteuse]，bayer 抖动控制观感与体积。"""
    fps = min(MAX_FPS, out.fps)
    vf = (
        f"scale={out.max_width}:-2:flags=lanczos,"
        "split[s0][s1];"
        f"[s0]palettegen=max_colors={max(16, min(256, out.colors))}[pal];"
        "[s1][pal]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle"
    )
    result = subprocess.run(  # noqa: S603 - 参数数组，无 shell
        [ffmpeg, "-y", "-framerate", str(fps),
         "-i", os.path.join(frames_dir, "%04d.png"),
         "-vf", vf, "-loop", "0", gif_path],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0 or not os.path.isfile(gif_path):
        detail = (result.stderr or "")[-600:]
        fail(f"ffmpeg 合成 GIF 失败（exit {result.returncode}）：{detail}")


def main() -> None:
    out = parse_args()
    if not os.path.isfile(out.html):
        fail(f"HTML 不存在：{out.html}")
    out_dir = out.out_dir or os.path.dirname(os.path.abspath(out.html))
    os.makedirs(out_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(out.html))[0]
    snapshot_path = os.path.join(out_dir, f"{stem}.snapshot.png")
    poster_path = os.path.join(out_dir, f"{stem}.poster.png")
    gif_path = os.path.join(out_dir, f"{stem}.anim.gif")

    ffmpeg = shutil.which("ffmpeg")
    if out.mode in ("gif", "both") and ffmpeg is None:
        fail("gif/both 模式需要 ffmpeg（mac: brew install ffmpeg）；或改用 --mode snapshot")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        fail("playwright 未安装（python3 -m pip install --user playwright），"
             "浏览器另需 python3 -m playwright install chromium 或系统 Chrome")

    frames_dir = tempfile.mkdtemp(prefix="sp-capture-")
    produced: list[str] = []
    try:
        with sync_playwright() as playwright:
            browser, channel = launch_browser(playwright)
            try:
                page = browser.new_page(viewport={"width": out.width, "height": out.height})
                page.goto(file_url(out.html), wait_until="load")
                page.wait_for_timeout(max(0, out.delay_ms))
                if out.mode in ("snapshot", "both"):
                    page.screenshot(path=snapshot_path,
                                    clip=parse_clip(out.clip))
                    produced.append(snapshot_path)
                if out.mode in ("gif", "both"):
                    frame_count = capture_frames(page, out, frames_dir)
                    shutil.copyfile(os.path.join(frames_dir, "0000.png"), poster_path)
                    produced.append(poster_path)
                    assemble_gif(ffmpeg, frames_dir, out, gif_path)
                    produced.append(gif_path)
            finally:
                browser.close()
    finally:
        if out.keep_frames:
            print(f"[super-ppts] 逐帧目录（保留）：{frames_dir}")
        else:
            shutil.rmtree(frames_dir, ignore_errors=True)

    print("[super-ppts] 捕获完成：")
    for path in produced:
        size = os.path.getsize(path)
        note = "  [!] 超出 3MB 软预算，建议降 fps/时长/max-width 重捕" \
            if path.endswith(".gif") and size > GIF_SIZE_BUDGET else ""
        print(f"  - {path} ({size / 1024:.0f} KB){note}")
    print("CAPTURE_OK")


if __name__ == "__main__":
    main()
