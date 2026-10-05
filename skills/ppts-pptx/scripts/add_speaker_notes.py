#!/usr/bin/env python3
"""演讲备注写入（把逐页备注落进 PPTX notes 页）。

工作流位置：技能线在页面规划阶段为每页起草一句话备注（讲什么/强调什么/
过渡），本脚本把 JSON 载荷写入 notes 页——备注随 deck 走，放映者视图可见。

用法：
    python3 add_speaker_notes.py <deck.pptx> --notes notes.json [--in-place]
    python3 add_speaker_notes.py <deck.pptx> --note 3 "这里放慢语速，强调同比口径" [--in-place]

notes.json 形态（键为 1 起页码，值为该页备注文本；未提及的页保持原备注）：
    { "1": "开场 30 秒：只讲结论……", "2": "三张卡从左到右，重点在第二张……" }

--in-place 原地改写（默认输出 <deck>.notes.pptx）。写入后建议照常跑
validate_pptx.py 与渲染验收。依赖 python-pptx（pptx-designer 环境自带）。
退出码：0 成功；1 失败。
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile

SCRIPT_ROOT = os.path.dirname(os.path.abspath(__file__))
VALIDATE_SCRIPT = os.path.join(SCRIPT_ROOT, "validate_pptx.py")


def fail(message: str) -> None:
    print(f"[notes] ERROR: {message}")
    raise SystemExit(1)


def load_notes(path: str | None, inline: list[str] | None) -> dict[int, str]:
    """合并 --notes JSON 与 --note 页码 文本 两种来源（后者覆盖前者同页）。"""
    notes: dict[int, str] = {}
    if path:
        try:
            with open(path, encoding="utf-8") as fh:
                raw = json.load(fh)
        except (OSError, json.JSONDecodeError) as error:
            fail(f"notes 文件读取失败：{error}")
        if not isinstance(raw, dict):
            fail("notes JSON 必须是对象（键=1 起页码字符串，值=备注文本）")
        for key, text in raw.items():
            try:
                number = int(str(key))
            except ValueError:
                fail(f"notes 键不是页码：{key!r}")
            if number < 1:
                fail(f"notes 页码从 1 起：{key!r}")
            if not isinstance(text, str) or not text.strip():
                fail(f"第 {number} 页备注为空")
            notes[number] = text.strip()
    if inline:
        it = iter(inline)
        for number_text, text in zip(it, it):
            try:
                number = int(number_text)
            except ValueError:
                fail(f"--note 页码不是数字：{number_text!r}")
            if number < 1 or not text.strip():
                fail(f"--note 第 {number} 页备注无效（页码 ≥1，文本非空）")
            notes[number] = text.strip()
    if not notes:
        fail("没有可写入的备注（--notes JSON 或 --note 页码 文本 至少一种）")
    return notes


def main() -> None:
    parser = argparse.ArgumentParser(description="演讲备注写入 PPTX notes 页")
    parser.add_argument("pptx", help="目标 PPTX 路径")
    parser.add_argument("--notes", dest="notes_file", help="备注 JSON 文件（键=1 起页码字符串）")
    parser.add_argument("--note", nargs=2, action="append", metavar=("页码", "文本"), help="单页备注（可重复）")
    parser.add_argument("--in-place", action="store_true", help="原地改写（默认输出 <deck>.notes.pptx）")
    parser.add_argument("--no-validate", action="store_true", help="跳过写入后的 validate_pptx.py 复核")
    args = parser.parse_args()

    try:
        from pptx import Presentation
    except ImportError:
        fail("缺 python-pptx（pptx-designer 环境自带；或 python3 -m pip install --user python-pptx）")

    pptx = os.path.abspath(args.pptx)
    if not os.path.isfile(pptx):
        fail(f"PPTX 不存在：{pptx}")
    notes = load_notes(args.notes_file, args.note)

    prs = Presentation(pptx)
    total = len(prs.slides)
    out_of_range = sorted(number for number in notes if number > total)
    if out_of_range:
        fail(f"页码越界（deck 共 {total} 页）：{out_of_range}")

    written = 0
    for number, text in sorted(notes.items()):
        slide = prs.slides[number - 1]
        # notes_slide 访问即自动创建 notes 幻灯片（python-pptx 语义）
        slide.notes_slide.notes_text_frame.text = text
        written += 1

    out_path = pptx if args.in_place else os.path.splitext(pptx)[0] + ".notes.pptx"
    with tempfile.TemporaryDirectory(prefix="ppts-notes-") as tmp:
        tmp_out = os.path.join(tmp, "out.pptx")
        prs.save(tmp_out)
        shutil.move(tmp_out, out_path)

    print(f"[notes] 已写入 {written} 页备注（共 {total} 页）：{out_path}")
    if not args.no_validate and os.path.isfile(VALIDATE_SCRIPT):
        import subprocess

        check = subprocess.run(  # noqa: S603 - 参数数组
            [sys.executable, VALIDATE_SCRIPT, out_path],
            check=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=120,
        )
        verdict = "PASS" if check.returncode == 0 else "FAIL"
        print(f"[notes] 写入后结构校验：{verdict}")
        if check.returncode != 0:
            print((check.stdout or "").strip()[-600:])
            fail("写入备注后结构校验未通过——产物不要交付，检查 python-pptx 版本或改用 --no-validate 排查")


if __name__ == "__main__":
    main()
