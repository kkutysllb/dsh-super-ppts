#!/usr/bin/env python3
"""PPTX → PDF → PNG 渲染验收桥（跨平台）。

渲染链：LibreOffice（soffice --headless）转 PDF → poppler（pdftoppm）逐页转 PNG。
PowerPoint COM（Windows）不在本脚本范围——如需 COM 高保真渲染，可后续扩展。

用法：
    python3 render_pptx.py <deck.pptx> [--out <dir>] [--width 1280] [--height 720]

输出：默认在 PPTX 同目录 render_review/ 下，含 <deck>.pdf 与逐页 <deck>-NN.png。
退出码：0 成功；1 失败（缺工具/转换失败）。
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile

SOFFICE_FALLBACKS = [
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/local/bin/soffice",
    "/usr/bin/soffice",
    "/opt/libreoffice/program/soffice",
]


def probe_soffice() -> str | None:
    found = shutil.which("soffice")
    if found:
        return found
    for candidate in SOFFICE_FALLBACKS:
        if os.path.isfile(candidate):
            return candidate
    if platform.system() == "Windows":
        for env_key in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
            base = os.environ.get(env_key)
            if not base:
                continue
            candidate = os.path.join(base, "LibreOffice", "program", "soffice.exe")
            if os.path.isfile(candidate):
                return candidate
    return None


def fail(message: str) -> None:
    print(f"[render] ERROR: {message}")
    raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="PPTX 渲染验收桥")
    parser.add_argument("pptx", help="待渲染的 PPTX 路径")
    parser.add_argument("--out", dest="out_dir", help="输出目录（默认 PPTX 同目录 render_review/）")
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    args = parser.parse_args()

    pptx = os.path.abspath(args.pptx)
    if not os.path.isfile(pptx):
        fail(f"PPTX 不存在：{pptx}")

    soffice = probe_soffice()
    if soffice is None:
        fail("未找到 soffice（LibreOffice）。mac: brew install --cask libreoffice；Linux: 包管理器安装 libreoffice。")
    pdftoppm = shutil.which("pdftoppm")
    if pdftoppm is None:
        fail("未找到 pdftoppm（poppler）。mac: brew install poppler；Linux: 包管理器安装 poppler-utils。")

    out_dir = os.path.abspath(args.out_dir) if args.out_dir else os.path.join(os.path.dirname(pptx), "render_review")
    os.makedirs(out_dir, exist_ok=True)

    # soffice 的 --outdir 不接受同名覆盖语义之外的定制，先转出到临时目录再归位
    with tempfile.TemporaryDirectory(prefix="ppts-render-") as tmp:
        convert = subprocess.run(  # noqa: S603 - 参数数组
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, pptx],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=300,
        )
        pdf_name = os.path.splitext(os.path.basename(pptx))[0] + ".pdf"
        pdf_tmp = os.path.join(tmp, pdf_name)
        if convert.returncode != 0 or not os.path.isfile(pdf_tmp):
            fail(f"PDF 转换失败（exit {convert.returncode}）：\n{(convert.stdout or '').strip()[-600:]}")
        pdf_out = os.path.join(out_dir, pdf_name)
        shutil.move(pdf_tmp, pdf_out)

        # pdftoppm 分辨率：PPTX 画布通常 13.333x7.5in；按目标宽反推 dpi
        dpi = max(72, int(args.width / (13.333 if args.width >= args.height else 7.5)))
        png_prefix = os.path.join(out_dir, os.path.splitext(os.path.basename(pptx))[0])
        to_png = subprocess.run(  # noqa: S603
            [pdftoppm, "-png", "-r", str(dpi), pdf_out, png_prefix],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=300,
        )
        if to_png.returncode != 0:
            fail(f"PNG 转换失败（exit {to_png.returncode}）：\n{(to_png.stdout or '').strip()[-600:]}")

    pages = sorted(f for f in os.listdir(out_dir) if f.endswith(".png") and os.path.basename(f).startswith(os.path.splitext(os.path.basename(pptx))[0]))
    print(f"[render] 完成：{len(pages)} 页 PNG + PDF")
    print(f"[render] 输出目录：{out_dir}")
    for page in pages:
        print(f"  - {page}")


if __name__ == "__main__":
    main()
