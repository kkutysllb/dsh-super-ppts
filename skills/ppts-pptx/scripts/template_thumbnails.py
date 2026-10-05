#!/usr/bin/env python3
"""用户模板版式网格预览（VI Build 选版式的前置步骤）。

把模板逐页渲染成带页码的小图，供 agent 在「按模板制作」前**看完全部版式**
再决定每页复用哪个版式——用户上传模板只有一个首页缩略图，靠它猜版式会猜错。

用法：
    python3 template_thumbnails.py <template.pptx> [--out <dir>] [--scale-to 360] [--grid]

产物（默认 PPTX 同目录 template_thumbs/）：
    page-01.png, page-02.png, ...   逐页小图（agent 逐页 Read）
    grid.jpg                        可选拼接网格（--grid；需 Pillow，缺席自动跳过）
    index.txt                       页码 → 文件索引（人读/agent 读皆可）

依赖：LibreOffice（soffice）+ poppler（pdftoppm）——渲染链缺失时报错并给安装指引，
不静默降级（选错版式的代价远高于装渲染链）。
退出码：0 成功；1 失败。
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

# 与 compiler/build_pptx.py / render_pptx.py 的 probe_soffice() 保持一致——改一处同步另两处
SOFFICE_FALLBACKS = [
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/local/bin/soffice",
    "/usr/bin/soffice",
    "/opt/libreoffice/program/soffice",
]


def fail(message: str) -> None:
    print(f"[tpl-thumbs] ERROR: {message}")
    raise SystemExit(1)


def probe_soffice() -> str | None:
    found = shutil.which("soffice")
    if found:
        return found
    for candidate in SOFFICE_FALLBACKS:
        if os.path.isfile(candidate):
            return candidate
    if sys.platform == "win32":
        for env_key in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
            base = os.environ.get(env_key)
            if not base:
                continue
            candidate = os.path.join(base, "LibreOffice", "program", "soffice.exe")
            if os.path.isfile(candidate):
                return candidate
    return None


def make_grid(page_pngs: list[str], grid_path: str, columns: int = 4) -> bool:
    """Pillow 拼接网格（可选增强；缺席返回 False，不阻断）。标签用 ASCII 页码。"""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return False
    try:
        images = [Image.open(page) for page in page_pngs]
    except OSError:
        return False
    if not images:
        return False
    first = images[0]
    cell_w, cell_h = first.size
    pad, label_h = 12, 22
    columns = max(1, min(columns, len(images)))
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * (cell_w + pad) + pad, rows * (cell_h + label_h + pad) + pad), "#1b1f27")
    draw = ImageDraw.Draw(sheet)
    for index, image in enumerate(images):
        col, row = index % columns, index // columns
        x = pad + col * (cell_w + pad)
        y = pad + row * (cell_h + label_h + pad)
        resized = image.resize((cell_w, cell_h)) if image.size != (cell_w, cell_h) else image
        sheet.paste(resized, (x, y))
        draw.text((x + 4, y + cell_h + 4), f"p{index + 1:02d}", fill="#e8ecf3")
    sheet.save(grid_path, quality=88)
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="用户模板版式网格预览")
    parser.add_argument("pptx", help="模板 PPTX 路径")
    parser.add_argument("--out", dest="out_dir", help="输出目录（默认 PPTX 同目录 template_thumbs/）")
    parser.add_argument("--scale-to", dest="scale_to", type=int, default=360, help="每页长边像素（默认 360，够 agent 看清版式）")
    parser.add_argument("--grid", action="store_true", help="额外拼接网格图 grid.jpg（需 Pillow，缺席自动跳过）")
    args = parser.parse_args()

    pptx = os.path.abspath(args.pptx)
    if not os.path.isfile(pptx):
        fail(f"模板不存在：{pptx}")

    soffice = probe_soffice()
    if soffice is None:
        fail("未找到 soffice（LibreOffice）。mac: brew install --cask libreoffice；Linux: 包管理器安装 libreoffice。")
    pdftoppm = shutil.which("pdftoppm")
    if pdftoppm is None:
        fail("未找到 pdftoppm（poppler）。mac: brew install poppler；Linux: 包管理器安装 poppler-utils。")

    out_dir = os.path.abspath(args.out_dir) if args.out_dir else os.path.join(os.path.dirname(pptx), "template_thumbs")
    os.makedirs(out_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(pptx))[0]

    page_pngs: list[str] = []
    with tempfile.TemporaryDirectory(prefix="ppts-tpl-") as tmp:
        convert = subprocess.run(  # noqa: S603 - 参数数组
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, pptx],
            check=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=300,
        )
        pdf_tmp = os.path.join(tmp, stem + ".pdf")
        if convert.returncode != 0 or not os.path.isfile(pdf_tmp):
            fail(f"模板转 PDF 失败（exit {convert.returncode}）：\n{(convert.stdout or '').strip()[-600:]}")
        to_png = subprocess.run(  # noqa: S603
            [pdftoppm, "-png", "-scale-to", str(args.scale_to), pdf_tmp, os.path.join(tmp, "page")],
            check=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=300,
        )
        if to_png.returncode != 0:
            fail(f"逐页转 PNG 失败（exit {to_png.returncode}）：\n{(to_png.stdout or '').strip()[-600:]}")
        produced = sorted(name for name in os.listdir(tmp) if name.startswith("page") and name.endswith(".png"))

        index_lines = [f"模板版式索引：{stem}（共 {len(produced)} 页）"]
        for index, name in enumerate(produced, start=1):
            target = os.path.join(out_dir, f"page-{index:02d}.png")
            # pdftoppm 输出在临时目录，统一搬入 out_dir 并按序号命名
            shutil.move(os.path.join(tmp, name), target)
            page_pngs.append(target)
            index_lines.append(f"  第 {index} 页 → {target}")
        index_path = os.path.join(out_dir, "index.txt")
        with open(index_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(index_lines) + "\n")

    grid_note = ""
    if args.grid:
        grid_path = os.path.join(out_dir, "grid.jpg")
        grid_note = " + grid.jpg（网格总览）" if make_grid(page_pngs, grid_path) else "（--grid 跳过：Pillow 不可用）"

    print(f"[tpl-thumbs] 完成：{len(page_pngs)} 页版式小图{grid_note}")
    print(f"[tpl-thumbs] 输出目录：{out_dir}")
    print(f"[tpl-thumbs] 索引：{index_path}")


if __name__ == "__main__":
    main()
