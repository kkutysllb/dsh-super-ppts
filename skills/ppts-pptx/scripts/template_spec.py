#!/usr/bin/env python3
"""模板规范提取：把 .pptx 里的「排版规则」变成 Agent 能读、能核对的文本。

动机（实机反馈）：用户常把分层字号/字体要求**直接写在模板的某一页上**
（例：模板第 3 页写着「顶部标题样式 —— 字体雅黑，大小 24px，颜色深红 /
综述内容样式 —— 字体雅黑，大小 16px，行间距 1.5，颜色 黑色」）。
此前链路只跑 template_thumbnails.py 出图，Agent 看到的是**图片**，
既读不到那些文字，也无从把它当成验收项；于是生成时按自己的默认排版走，
成品字号/字体与模板要求不符。

本脚本不依赖 python-pptx（只用 zipfile + 正则），因此在任何安装形态下都能跑。

产出两类信息：
1. `levelRules` —— 从模板文字里解析出的**分层排版规则**（字体/字号/行距/颜色），
   px 一律按 0.75 折算成 pt（PPTX 内部单位是 pt；人工标注常写 px）；
2. `observed`  —— 模板**实际使用**的字体与字号分布，用作规则缺省时的参照。

用法：
    python3 template_spec.py <template.pptx> [--json] [--rules]

退出码：0 = 提取成功（即使没解析出规则）；1 = 文件不可读 / 不是合法 PPTX。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import zipfile

# 1 px = 0.75 pt（96dpi CSS 像素 → 72dpi 磅）
PX_TO_PT = 0.75

TEXT_RE = re.compile(r"<a:t>([^<]*)</a:t>")
SIZE_RE = re.compile(r'\bsz="(\d+)"')
TYPEFACE_RE = re.compile(r'\btypeface="([^"]*)"')
SLIDE_RE = re.compile(r"^ppt/slides/slide(\d+)\.xml$")

# 规则线索词：命中即认为这段文字在陈述排版规范（而非正文内容）
RULE_HINT_RE = re.compile(r"(字体|字号|大小|行间距|行距|颜色|色值|号字|px|pt)", re.IGNORECASE)
# 「XX样式」这类层级标签
LEVEL_LABEL_RE = re.compile(r"([\u4e00-\u9fa5A-Za-z0-9]{2,12})\s*样式")
FONT_RE = re.compile(r"字体\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9 +_\-]{2,20})")
SIZE_RE_TXT = re.compile(r"(?:大小|字号)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(px|pt|磅)?", re.IGNORECASE)
LINE_SPACING_RE = re.compile(r"(?:行间距|行距)\s*[:：]?\s*(\d+(?:\.\d+)?)")
COLOR_RE = re.compile(r"颜色\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9#]{1,12})")
# 主题字体别名（+mj-ea 等）不是真实字体名，报告时单独归类
THEME_FONT_RE = re.compile(r"^\+[a-z]{2}-[a-z]{2}$")


def _read_slides(zf: zipfile.ZipFile) -> dict[int, str]:
    """按页号返回 slide XML 文本（只取 ppt/slides/slideN.xml）。"""
    slides: dict[int, str] = {}
    for name in zf.namelist():
        match = SLIDE_RE.match(name)
        if match:
            slides[int(match.group(1))] = zf.read(name).decode("utf-8", errors="replace")
    return slides


def _split_runs(slide_xml: str) -> list[str]:
    """抽取一页里的全部文本 run（PowerPoint 会把一句话拆成多个 run）。"""
    return [text for text in TEXT_RE.findall(slide_xml) if text]


def _join_runs(runs: list[str]) -> str:
    """展示用拼接：run 之间不加分隔，读起来是连续行文。"""
    return "".join(runs)


def _join_runs_for_parse(runs: list[str]) -> str:
    """解析用拼接：run 之间插空格。

    PowerPoint 按格式边界拆 run，模板作者写的「颜色」「深红」「综述内容样式」常是
    三个独立 run。若无缝拼接会粘成「颜色深红综述内容样式」，颜色正则就会贪吃到
    下一段的标签；插空格后各值自然断开（正则里 `\\s*` 允许空格，故不影响匹配）。
    """
    return " ".join(run.strip() for run in runs if run.strip())


# 层级标签里若含这些词，说明是「颜色深红」之类的黏连，不是真正的层级名
LABEL_STOPWORDS = ("颜色", "字体", "字号", "大小", "行距", "号字", "px", "pt")


def _split_rule_segments(joined: str) -> list[str]:
    """把一页文本切成候选规则句：按「样式」标签与常见分隔符切分。"""
    normalized = joined.replace("\u3000", " ")
    # 在「XX样式」前插入分隔，使每条规则独立成段
    normalized = LEVEL_LABEL_RE.sub(lambda m: "\n" + m.group(0), normalized)
    normalized = re.sub(r"[-—–]{2,}", "\n", normalized)
    normalized = re.sub(r"[；;]", "\n", normalized)
    return [seg.strip(" \n|·—-") for seg in normalized.split("\n") if seg.strip(" \n|·—-")]


def _size_to_pt(value: float, unit: str | None) -> tuple[float, float, str]:
    """把标注值折算成 pt，返回 (pt, 原始值, 原始单位)。"""
    unit_norm = (unit or "").lower()
    if unit_norm == "px":
        return round(value * PX_TO_PT, 2), value, "px"
    # pt / 磅 / 无单位：无单位时按 pt 处理（模板作者多数直接写「16」）
    return round(float(value), 2), value, unit_norm or "pt"


def _parse_level_rules(segments: list[str]) -> list[dict]:
    """从候选句里解析分层排版规则。返回规则数组（保持模板出现顺序）。"""
    rules: list[dict] = []
    current_label: str | None = None
    for segment in segments:
        # 先更新层级标签：标签常自成一段（「顶部标题样式」后面才是规则正文），
        # 若等到命中线索词才记标签，标签段已被 continue 跳过。
        label_match = LEVEL_LABEL_RE.search(segment)
        if label_match:
            candidate = label_match.group(1)
            # 排除「颜色深红综述内容」这类由上一条规则黏连出来的伪标签
            if not any(word in candidate for word in LABEL_STOPWORDS):
                current_label = candidate
        if not RULE_HINT_RE.search(segment):
            continue
        rule: dict = {}
        if current_label:
            rule["level"] = current_label
        font_match = FONT_RE.search(segment)
        if font_match:
            rule["font"] = font_match.group(1).strip()
        size_match = SIZE_RE_TXT.search(segment)
        if size_match:
            pt, raw, unit = _size_to_pt(float(size_match.group(1)), size_match.group(2))
            rule["sizePt"] = pt
            rule["sizeAsWritten"] = f"{raw:g}{unit}"
        line_match = LINE_SPACING_RE.search(segment)
        if line_match:
            rule["lineSpacing"] = float(line_match.group(1))
        color_match = COLOR_RE.search(segment)
        if color_match:
            rule["color"] = color_match.group(1).strip()
        if len(rule) > (1 if current_label else 0):
            rule["source"] = segment[:120]
            rules.append(rule)
    return rules


def extract_spec(path: str) -> dict:
    """提取模板规范。不可读时抛出 OSError / zipfile.BadZipFile。"""
    with zipfile.ZipFile(path) as zf:
        slides = _read_slides(zf)
        if not slides:
            raise ValueError("包内没有 ppt/slides/slideN.xml——不是合法 PPTX")
        per_slide: list[dict] = []
        font_counts: dict[str, int] = {}
        size_counts: dict[int, int] = {}
        all_segments: list[str] = []
        for index in sorted(slides):
            xml = slides[index]
            runs = _split_runs(xml)
            joined = _join_runs(runs)
            segments = _split_rule_segments(_join_runs_for_parse(runs))
            all_segments.extend(segments)
            fonts = [f for f in TYPEFACE_RE.findall(xml)]
            sizes = [int(s) for s in SIZE_RE.findall(xml)]
            for font in fonts:
                font_counts[font] = font_counts.get(font, 0) + 1
            for size in sizes:
                size_counts[size] = size_counts.get(size, 0) + 1
            per_slide.append({
                "index": index,
                "text": joined[:600],
                "fonts": sorted(set(fonts)),
                "sizesPt": sorted({round(s / 100, 1) for s in sizes}),
            })

    level_rules = _parse_level_rules(all_segments)
    rule_sentences = [seg for seg in all_segments if RULE_HINT_RE.search(seg)]

    size_hist = {f"{round(s / 100, 1):g}": n for s, n in sorted(size_counts.items())}

    return {
        "ok": True,
        "file": os.path.abspath(path),
        "slideCount": len(per_slide),
        "levelRules": level_rules,
        "ruleSentencesFound": rule_sentences[:40],
        "observed": {
            "fonts": dict(sorted(font_counts.items(), key=lambda kv: -kv[1])),
            "sizesPt": size_hist,
            "nonThemeFonts": sorted(
                f for f in font_counts if not THEME_FONT_RE.match(f)
            ),
            "minSizePt": min((round(s / 100, 1) for s in size_counts), default=None),
        },
        "slides": per_slide,
        "unitNote": "标注写 px 时已按 1px=0.75pt 折算；sizeAsWritten 保留原始写法以便对账。",
    }


def render_text(spec: dict) -> None:
    print(f"[template-spec] 模板：{spec['file']}")
    print(f"  页数：{spec['slideCount']}")
    rules = spec["levelRules"]
    if rules:
        print("  分层排版规则（来自模板文字，已折算 pt）：")
        for rule in rules:
            bits = []
            if rule.get("level"):
                bits.append(f"[{rule['level']}]")
            if rule.get("font"):
                bits.append(f"字体={rule['font']}")
            if rule.get("sizePt") is not None:
                bits.append(f"字号={rule['sizePt']}pt（原文 {rule['sizeAsWritten']}）")
            if rule.get("lineSpacing") is not None:
                bits.append(f"行距={rule['lineSpacing']}")
            if rule.get("color"):
                bits.append(f"颜色={rule['color']}")
            print("    - " + "  ".join(bits))
    else:
        print("  分层排版规则：未在模板文字中解析到（不代表没有；请看 ruleSentencesFound）")
    observed = spec["observed"]
    print(f"  模板实际字体分布：{json.dumps(observed['fonts'], ensure_ascii=False)}")
    print(f"  模板实际字号分布(pt)：{json.dumps(observed['sizesPt'], ensure_ascii=False)}")
    if observed["minSizePt"] is not None:
        print(f"  模板最小字号：{observed['minSizePt']}pt")
    if spec["ruleSentencesFound"]:
        print("  含排版线索的原文片段：")
        for sentence in spec["ruleSentencesFound"][:8]:
            print(f"    · {sentence[:110]}")
    print(f"  注：{spec['unitNote']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="PPTX 模板规范提取（分层字号/字体/行距/颜色）")
    parser.add_argument("pptx", nargs="?", help="模板 PPTX 路径")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出（供程序消费）")
    args = parser.parse_args()

    if not args.pptx:
        parser.print_help()
        raise SystemExit(1)
    path = os.path.abspath(args.pptx)
    if not os.path.isfile(path):
        print(f"[template-spec] ERROR: 文件不存在：{path}")
        raise SystemExit(1)
    try:
        spec = extract_spec(path)
    except (zipfile.BadZipFile, OSError, ValueError) as error:
        print(f"[template-spec] ERROR: 无法解析：{error}")
        raise SystemExit(1)

    if args.json:
        print(json.dumps(spec, ensure_ascii=False, indent=2))
    else:
        render_text(spec)
    raise SystemExit(0)


if __name__ == "__main__":
    main()
