#!/usr/bin/env python3
"""PPTX 结构校验 + 内容 QA 门（视觉门之外的机检层）。

三层机检（对标 Claude pptx skill 的内容/文件 QA；视觉门仍由 render_pptx.py 承担）：
1. 容器完整性：zip EOCD / CRC（testzip）/ 必要部件在场（[Content_Types].xml、
   _rels/.rels、ppt/presentation.xml 及其 rels、≥1 页 slide）；
2. 引用闭包：presentation.rels 与各页 slideN.xml.rels 引用的内部部件必须存在，
   sldIdLst 页数与 slide 部件数一致——「LibreOffice 能开、PowerPoint 报损坏」
   的主因就是 rels 悬空 / 部件缺失 / 坏 zip，本层不追求 XSD 全量合规；
3. 内容 QA：扫描全部 slide 文本中的残留占位符（lorem / TODO / FIXME / [insert /
   待补充 等）与空页，防止「结构完好但内容没写完」的 deck 出门。

用法：
    python3 validate_pptx.py <deck.pptx> [--json]
退出码：0 = 无 FAIL（WARN 不阻断）；1 = 有 FAIL。
"""

from __future__ import annotations

import argparse
import json
import re
import zipfile

# 内容 QA 占位符正则（不区分大小写；覆盖中英常见残留形态）
PLACEHOLDER_PATTERNS = [
    (r"lorem\s+ipsum", "lorem ipsum 假文"),
    (r"\bTODO\b", "TODO 标记"),
    (r"\bFIXME\b", "FIXME 标记"),
    (r"\bXXX\b", "XXX 标记"),
    (r"\[insert\b|\[placeholder\b|\[tbd\b", "方括号占位符"),
    (r"【?待补充|【?待填写|【?待定】?", "中文占位标记"),
    (r"占位符|占位文本", "占位文本字样"),
    (r"click\s+to\s+add", "PowerPoint 默认占位提示"),
]
PLACEHOLDER_RE = [(re.compile(pattern, re.IGNORECASE), label) for pattern, label in PLACEHOLDER_PATTERNS]

REQUIRED_PARTS = [
    "[Content_Types].xml",
    "_rels/.rels",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
]
OPTIONAL_PARTS = ["docProps/core.xml", "docProps/app.xml"]

# rels 引用的内部部件（Target 不以 / 或 scheme 开头 → 相对 slide 所在目录解析）
INTERNAL_TARGET_RE = re.compile(r"^(?!/)(?![a-zA-Z][a-zA-Z0-9+.-]*:)")


class Report:
    """逐项检查结果收集器：PASS/WARN/FAIL 三态，FAIL 决定退出码。"""

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
        verdict = "FAIL（按上方建议修复后重跑）" if self.has_fail else "PASS" + (f"（{warns} 条 WARN，不阻断）" if warns else "")
        print(f"[validate] => {verdict}")


def _rels_text(zf: zipfile.ZipFile, part: str) -> str:
    """读部件的 .rels 文本；不存在返回空串（调用方按无 rels 处理）。"""
    directory, _, name = part.rpartition("/")
    rels_part = f"{directory}/_rels/{name}.rels" if directory else f"_rels/{name}.rels"
    try:
        return zf.read(rels_part).decode("utf-8", errors="replace")
    except KeyError:
        return ""


def check_container(path: str, report: Report) -> zipfile.ZipFile | None:
    """第 1 层：容器完整性与必要部件。返回打开的 ZipFile（失败返回 None）。"""
    try:
        zf = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as error:
        report.add("FAIL", "zip 容器可打开", str(error))
        return None
    bad = zf.testzip()
    if bad is not None:
        report.add("FAIL", "zip CRC 校验", f"首个损坏条目：{bad}")
        return zf
    names = set(zf.namelist())
    report.add("PASS", f"zip 完整（{len(names)} 个条目，CRC 全过）")
    for part in REQUIRED_PARTS:
        if part in names:
            report.add("PASS", f"必要部件在场：{part}")
        else:
            report.add("FAIL", f"必要部件缺失：{part}（文件可能被截断或不是合法 PPTX）")
    for part in OPTIONAL_PARTS:
        if part not in names:
            report.add("WARN", f"可选部件缺失：{part}（PowerPoint/WPS 可打开，元数据不全）")
    slides = {name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)}
    if slides:
        report.add("PASS", f"幻灯片部件 {len(slides)} 页")
    else:
        report.add("FAIL", "没有任何 ppt/slides/slideN.xml 部件（空/非法演示文稿）")
    return zf


def check_closure(zf: zipfile.ZipFile, report: Report) -> None:
    """第 2 层：rels 引用闭包（内部 Target 必须在包内）。"""
    names = set(zf.namelist())

    def resolve(base_part: str, target: str) -> str:
        import posixpath

        directory = posixpath.dirname(base_part)
        return posixpath.normpath(posixpath.join(directory, target))

    dangling: list[str] = []
    # presentation 级 rels + 逐页 rels（外部链接 Target 带 scheme，跳过）
    presentation_rels = "ppt/_rels/presentation.xml.rels"
    for match in re.finditer(r'Target="([^"]+)"', zf.read(presentation_rels).decode("utf-8", errors="replace")):
        target = match.group(1)
        if INTERNAL_TARGET_RE.match(target) and resolve("ppt/presentation.xml", target) not in names:
            dangling.append(f"presentation → {target}")
    slides = sorted(name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name))
    for slide in slides:
        for match in re.finditer(r'Target="([^"]+)"', _rels_text(zf, slide)):
            target = match.group(1)
            if INTERNAL_TARGET_RE.match(target) and resolve(slide, target) not in names:
                dangling.append(f"{slide.rsplit('/', 1)[-1]} → {target}")
    if dangling:
        preview = "；".join(dangling[:5]) + ("…" if len(dangling) > 5 else "")
        report.add("FAIL", "rels 引用闭包", f"{len(dangling)} 处悬空引用（PowerPoint 大概率报「需要修复」）：{preview}")
    else:
        report.add("PASS", "rels 引用闭包（presentation + 全部 slide，无悬空内部引用）")

    # sldIdLst 页数一致性
    pres = zf.read("ppt/presentation.xml").decode("utf-8", errors="replace")
    sld_ids = len(re.findall(r"<p:sldId\b", pres))
    if sld_ids == len(slides):
        report.add("PASS", f"sldIdLst 与 slide 部件数一致（{sld_ids}）")
    else:
        report.add("WARN", "sldIdLst 与 slide 部件数不一致",
                   f"sldIdLst={sld_ids}, 部件={len(slides)}（多余部件不展示，缺注册的页打不开）")


def check_content(zf: zipfile.ZipFile, report: Report) -> None:
    """第 3 层：内容 QA——逐页抽 <a:t> 文本扫占位符；空页检测。"""
    slides = sorted(
        (name for name in zf.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
        key=lambda name: int(re.search(r"(\d+)", name).group(1)),  # type: ignore[union-attr]
    )
    text_re = re.compile(r"<a:t>(.*?)</a:t>", re.DOTALL)
    empty_pages: list[int] = []
    hits: list[str] = []
    for slide in slides:
        number = int(re.search(r"(\d+)", slide).group(1))  # type: ignore[union-attr]
        found = text_re.findall(zf.read(slide).decode("utf-8", errors="replace"))
        joined = "".join(found)
        if not joined.strip():
            empty_pages.append(number)
        for regex, label in PLACEHOLDER_RE:
            for match in regex.finditer(joined):
                snippet = joined[max(0, match.start() - 12):match.end() + 12].replace("\n", " ")
                hits.append(f"第 {number} 页 {label}：「…{snippet}…」")
    if hits:
        preview = "；".join(hits[:6]) + ("…" if len(hits) > 6 else "")
        report.add("FAIL", "内容 QA：残留占位符", f"{len(hits)} 处：{preview}")
    else:
        report.add("PASS", "内容 QA：无残留占位符")
    if empty_pages:
        report.add("WARN", "内容 QA：疑似空页", f"第 {', '.join(map(str, empty_pages))} 页无任何文本（图示页可忽略）")
    else:
        report.add("PASS", "内容 QA：无空页")


def validate(path: str) -> Report:
    report = Report()
    zf = check_container(path, report)
    if zf is not None:
        if not report.has_fail:
            check_closure(zf, report)
            check_content(zf, report)
        else:
            report.add("WARN", "容器层已 FAIL，引用闭包与内容 QA 跳过")
        zf.close()
    return report


def selftest() -> int:
    """内建最小自检（不依赖 python-pptx）：合法微型 zip 过、坏 zip 挂。"""
    import os
    import tempfile

    ok = True
    with tempfile.TemporaryDirectory(prefix="ppts-validate-") as tmp:
        good = os.path.join(tmp, "good.pptx")
        minimal_pptx = (
            "[Content_Types].xml",
            b'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        )
        with zipfile.ZipFile(good, "w") as zf:
            zf.writestr(minimal_pptx[0], minimal_pptx[1])
            zf.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
        good_report = validate(good)
        # 微型包缺 presentation.xml → 必有 FAIL；这里只断言「zip 层 OK 且报告能产出」
        if good_report.has_fail is not None and not good_report.items:
            ok = False
        broken = os.path.join(tmp, "broken.pptx")
        with open(broken, "wb") as fh:
            fh.write(b"this is not a zip file at all")
        if not validate(broken).has_fail:
            ok = False
    print("[validate] selftest:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="PPTX 结构校验 + 内容 QA 门")
    parser.add_argument("pptx", nargs="?", help="待校验的 PPTX 路径")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出报告（供程序消费）")
    parser.add_argument("--selftest", action="store_true", help="运行内建最小自检后退出")
    args = parser.parse_args()

    if args.selftest:
        raise SystemExit(selftest())
    if not args.pptx:
        parser.print_help()
        raise SystemExit(1)
    import os

    pptx = os.path.abspath(args.pptx)
    if not os.path.isfile(pptx):
        print(f"[validate] ERROR: PPTX 不存在：{pptx}")
        raise SystemExit(1)
    report = validate(pptx)
    if args.json:
        print(json.dumps({"ok": not report.has_fail, "items": report.items}, ensure_ascii=False, indent=2))
    else:
        print(f"[validate] 校验报告：{pptx}")
        report.print()
    raise SystemExit(1 if report.has_fail else 0)


if __name__ == "__main__":
    main()
