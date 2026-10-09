#!/usr/bin/env python3
"""PPTX 排版合规机检：把「模板规范」变成可判定的门，而不是靠肉眼。

动机（实机反馈）：validate_pptx.py 只查结构（zip/rels/占位符），**不查排版**；
于是成品用了 8pt 小字、混入宋体/Arial，也不会有任何检查报错。用户写在模板描述
或模板页上的「最小10号字 / 字体微软雅黑 / 颜色最多4色」因此形同虚设。

本脚本把那些要求做成 FAIL/WARN 三态门，与 validate_pptx.py 同款契约：
退出码 0 = 无 FAIL，1 = 有 FAIL。

规则来源（两者可叠加，命令行优先级更高）：
  --spec template-spec.json   # template_spec.py 的产出（取 levelRules）
  显式开关：--min-size-pt / --font / --max-colors

不依赖 python-pptx（只用 zipfile + 正则）。

用法：
    python3 check_typography.py <deck.pptx> --min-size-pt 10 --font 微软雅黑 --max-colors 4
    python3 check_typography.py <deck.pptx> --spec template-spec.json --max-colors 4
    python3 check_typography.py <deck.pptx> --selftest
"""

from __future__ import annotations

import argparse
import json
import os
import re
import zipfile

SIZE_RE = re.compile(r'\bsz="(\d+)"')
TYPEFACE_RE = re.compile(r'\btypeface="([^"]*)"')
SRGB_RE = re.compile(r'<a:srgbClr\s+val="([0-9A-Fa-f]{6})"')
SLIDE_RE = re.compile(r"^ppt/slides/slide\d+\.xml$")
# 主题字体别名（+mj-ea 等）随主题解析，不应计入「字体违规」
THEME_FONT_RE = re.compile(r"^\+[a-z]{2}-[a-z]{2}$")


class Report:
    """与 validate_pptx.py 同构的三态收集器。"""

    def __init__(self) -> None:
        self.items: list[dict] = []

    def add(self, status: str, check: str, detail: str = "") -> None:
        self.items.append({"status": status, "check": check, "detail": detail})

    @property
    def has_fail(self) -> bool:
        return any(item["status"] == "FAIL" for item in self.items)

    def print(self) -> None:
        marks = {"PASS": "OK  ", "WARN": "WARN", "FAIL": "FAIL"}
        for item in self.items:
            line = f"  [{marks[item['status']]}] {item['check']}"
            if item["detail"]:
                line += f" — {item['detail']}"
            print(line)
        fails = sum(1 for item in self.items if item["status"] == "FAIL")
        warns = sum(1 for item in self.items if item["status"] == "WARN")
        verdict = "FAIL（按上方建议修复后重跑）" if self.has_fail else "PASS" + (
            f"（{warns} 条 WARN，不阻断）" if warns else ""
        )
        print(f"[typography] => {verdict}")


def _scan(deck_path: str) -> dict:
    """扫描 deck：返回每页字号/字体/色值，以及全局分布。"""
    sizes: list[tuple[int, int]] = []  # (pt, slide 序号)
    fonts: dict[str, int] = {}
    colors: dict[str, int] = {}
    with zipfile.ZipFile(deck_path) as zf:
        slide_names = [n for n in zf.namelist() if SLIDE_RE.match(n)]
        if not slide_names:
            raise ValueError("包内没有幻灯片部件")
        for name in sorted(slide_names):
            index = int(re.search(r"slide(\d+)\.xml", name).group(1))
            xml = zf.read(name).decode("utf-8", errors="replace")
            for raw in SIZE_RE.findall(xml):
                sizes.append((round(int(raw) / 100, 1), index))
            for font in TYPEFACE_RE.findall(xml):
                fonts[font] = fonts.get(font, 0) + 1
            for color in SRGB_RE.findall(xml):
                key = color.upper()
                colors[key] = colors.get(key, 0) + 1
    return {"sizes": sizes, "fonts": fonts, "colors": colors, "slides": len(slide_names)}


def _rules_from_spec(spec: dict) -> dict:
    """从 template_spec.py 产出里提取可用于判定的规则。"""
    level_rules = spec.get("levelRules") or []
    fonts = {r["font"] for r in level_rules if r.get("font")}
    sizes = {r["sizePt"] for r in level_rules if r.get("sizePt") is not None}
    return {"fonts": fonts, "sizes": sizes}


def check(
    deck_path: str,
    min_size_pt: float | None = None,
    fonts: list[str] | None = None,
    max_colors: int | None = None,
    spec: dict | None = None,
) -> Report:
    report = Report()
    scan = _scan(deck_path)
    sizes = scan["sizes"]

    allowed_fonts: set[str] = set(fonts or [])
    expected_sizes: set[float] = set()
    if spec:
        derived = _rules_from_spec(spec)
        allowed_fonts |= derived["fonts"]
        expected_sizes |= derived["sizes"]
        if min_size_pt is None and derived["sizes"]:
            # 规范里最小的那一级即下限（模板作者写「正文 16px」时，正文就是最小字号）
            min_size_pt = min(derived["sizes"])

    if not sizes:
        report.add("WARN", "字号可读性", "未在幻灯片里读到任何 sz 属性（可能全走版式继承）")
    elif min_size_pt is not None:
        offenders = [(pt, idx) for pt, idx in sizes if pt < min_size_pt]
        if offenders:
            worst = min(offenders)[0]
            pages = sorted({idx for _, idx in offenders})
            report.add(
                "FAIL",
                f"最小字号 ≥ {min_size_pt}pt",
                f"{len(offenders)} 处低于下限（最小 {worst}pt），涉及第 {', '.join(map(str, pages[:10]))} 页"
                + ("…" if len(pages) > 10 else ""),
            )
        else:
            report.add("PASS", f"最小字号 ≥ {min_size_pt}pt", f"全体 {len(sizes)} 处字号达标")

    if allowed_fonts:
        actual = {f for f in scan["fonts"] if not THEME_FONT_RE.match(f)}
        violations = sorted(f for f in actual if f not in allowed_fonts)
        if violations:
            detail = "；".join(f"{f}（{scan['fonts'][f]} 处）" for f in violations)
            report.add("FAIL", "字体白名单", f"出现白名单外字体：{detail}")
        else:
            report.add("PASS", "字体白名单", f"实际字体均属 {sorted(allowed_fonts)}")

    if max_colors is not None:
        used = scan["colors"]
        if len(used) > max_colors:
            top = sorted(used.items(), key=lambda kv: -kv[1])[:8]
            report.add(
                "FAIL",
                f"配色数 ≤ {max_colors}",
                f"实际 {len(used)} 色：{', '.join(f'#{c}×{n}' for c, n in top)}"
                + ("…" if len(used) > 8 else ""),
            )
        else:
            report.add("PASS", f"配色数 ≤ {max_colors}", f"实际 {len(used)} 色")

    if expected_sizes:
        stray = sorted({pt for pt, _ in sizes} - expected_sizes)
        if stray:
            report.add(
                "WARN",
                "分层字号与模板规范一致",
                f"规范字号 {sorted(expected_sizes)}，另有 {stray} 未在规范内（图表/注脚等可忽略）",
            )
        else:
            report.add("PASS", "分层字号与模板规范一致", f"仅用 {sorted(expected_sizes)}")

    return report


def selftest() -> int:
    """内建自检：构造一个含 8pt 小字 + 白名单外字体的微型 deck，必须 FAIL。"""
    import tempfile

    ok = True
    with tempfile.TemporaryDirectory(prefix="ppts-typo-") as tmp:
        deck = os.path.join(tmp, "deck.pptx")
        slide = (
            '<?xml version="1.0"?><p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>'
            '<a:rPr sz="2400"><a:latin typeface="微软雅黑"/></a:rPr>'
            '<a:rPr sz="800"><a:latin typeface="宋体"/></a:rPr>'
            "<a:srgbClr val=\"FF0000\"/><a:srgbClr val=\"00FF00\"/>"
            "</p:spTree></p:cSld></p:sld>"
        )
        with zipfile.ZipFile(deck, "w") as zf:
            zf.writestr("ppt/slides/slide1.xml", slide)
        bad = check(deck, min_size_pt=10, fonts=["微软雅黑"], max_colors=1)
        if not bad.has_fail:
            ok = False
        good = check(deck, min_size_pt=8, fonts=["微软雅黑", "宋体"], max_colors=2)
        if good.has_fail:
            ok = False
        # spec 驱动的下限推导：16px→12pt
        derived = check(deck, spec={"levelRules": [{"font": "微软雅黑", "sizePt": 12}]})
        if not derived.has_fail:
            ok = False
    print("[typography] selftest:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="PPTX 排版合规机检（最小字号/字体白名单/配色数）")
    parser.add_argument("pptx", nargs="?", help="待检查的 PPTX 路径")
    parser.add_argument("--min-size-pt", type=float, default=None, help="允许的最小字号（pt）")
    parser.add_argument("--font", action="append", default=None, help="字体白名单（可重复）")
    parser.add_argument("--max-colors", type=int, default=None, help="允许的最大配色数")
    parser.add_argument("--spec", default=None, help="template_spec.py 产出的 JSON（取其 levelRules）")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出报告")
    parser.add_argument("--selftest", action="store_true", help="运行内建自检后退出")
    args = parser.parse_args()

    if args.selftest:
        raise SystemExit(selftest())
    if not args.pptx:
        parser.print_help()
        raise SystemExit(1)
    path = os.path.abspath(args.pptx)
    if not os.path.isfile(path):
        print(f"[typography] ERROR: 文件不存在：{path}")
        raise SystemExit(1)

    spec = None
    if args.spec:
        try:
            with open(os.path.abspath(args.spec), encoding="utf-8") as handle:
                spec = json.load(handle)
        except (OSError, json.JSONDecodeError) as error:
            print(f"[typography] ERROR: 规范文件不可读：{error}")
            raise SystemExit(1)

    try:
        report = check(
            path,
            min_size_pt=args.min_size_pt,
            fonts=args.font,
            max_colors=args.max_colors,
            spec=spec,
        )
    except (zipfile.BadZipFile, OSError, ValueError) as error:
        print(f"[typography] ERROR: 无法解析：{error}")
        raise SystemExit(1)

    if args.json:
        print(json.dumps({"ok": not report.has_fail, "items": report.items}, ensure_ascii=False, indent=2))
    else:
        print(f"[typography] 排版合规报告：{path}")
        report.print()
    raise SystemExit(1 if report.has_fail else 0)


if __name__ == "__main__":
    main()
