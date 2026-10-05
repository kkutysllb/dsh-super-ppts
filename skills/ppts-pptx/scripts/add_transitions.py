#!/usr/bin/env python3
"""PPTX 页间切换写入（静态动效 Phase 0；元素入场动画见 SKILL.md 混合交付章节）。

写入 PML 1st edition 的 <p:transition>（PowerPoint 2007+ / WPS / LibreOffice 全兼容，
不碰 p14: 扩展）。触发纪律见 SKILL.md：仅当 Brief 显式声明「要切换/要动效」才启用。

用法：
    python3 add_transitions.py <deck.pptx> [--type fade] [--advance-on-click] [--advance-after SECONDS]
        [--slides 1,3-5] [--in-place]

--type:    fade | push | wipe | cut（默认 fade）
--advance-after N: N 秒后自动翻页（旁白/展台场景；与 --advance-on-click 互斥时可叠加）
--slides:  页码选择器（1 起，如 1,3-5）；缺省 = 全部页
--in-place: 原地改写（默认输出 <deck>.trans.pptx，不动原文件）

退出码：0 成功；1 失败。
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import tempfile
import zipfile

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"

# 各切换类型的子元素（PML 1st edition；顺序即枚举名）
TRANSITION_ELEMENTS = {
    "fade": "<p:fade/>",
    "push": '<p:push dir="u"/>',
    "wipe": '<p:wipe dir="l"/>',
    "cut": '<p:cut/>',
}

# CT_Slide 子元素顺序：cSld, clrMapOvr?, transition?, timing?, ...——transition 插在 clrMapOvr 之后
CLR_MAP_OVR_CLOSE = "</p:clrMapOvr>"
CSLD_CLOSE = "</p:cSld>"


def fail(message: str) -> None:
    print(f"[transitions] ERROR: {message}")
    raise SystemExit(1)


def build_transition_xml(kind: str, advance_after: int | None, advance_on_click: bool) -> str:
    attrs = ""
    if advance_on_click:
        # advClick 默认即 true；显式写出以覆盖早前可能写入的 advTm-only 形态
        attrs += ' advClick="1"'
    if advance_after is not None:
        attrs += f' advTm="{int(advance_after * 1000)}"'
    return f'<p:transition{attrs}>{TRANSITION_ELEMENTS[kind]}</p:transition>'


def inject_transition(slide_xml: str, transition_xml: str) -> str:
    """把 <p:transition> 插入 slide XML 的 schema 合法位置（clrMapOvr 后 / cSld 后）。"""
    # 已有切换：整体替换（幂等重跑 = 更新为最新配置）
    slide_xml = re.sub(r"<p:transition\b.*?</p:transition>|<p:transition\b[^>]*/>", "", slide_xml, flags=re.DOTALL)
    if CLR_MAP_OVR_CLOSE in slide_xml:
        return slide_xml.replace(CLR_MAP_OVR_CLOSE, CLR_MAP_OVR_CLOSE + transition_xml, 1)
    if CSLD_CLOSE in slide_xml:
        return slide_xml.replace(CSLD_CLOSE, CSLD_CLOSE + transition_xml, 1)
    fail("slide XML 结构异常：找不到 cSld/clrMapOvr 锚点")
    raise AssertionError("unreachable")


def parse_slide_selection(spec: str | None, total: int) -> list[int]:
    if not spec:
        return list(range(1, total + 1))
    selected: set[int] = set()
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        range_match = re.fullmatch(r"(\d+)-(\d+)", chunk)
        if range_match:
            low, high = int(range_match.group(1)), int(range_match.group(2))
            selected.update(range(low, high + 1))
        elif chunk.isdigit():
            selected.add(int(chunk))
        else:
            fail(f"无法解析页码选择器片段：{chunk}")
    out_of_range = sorted(n for n in selected if not 1 <= n <= total)
    if out_of_range:
        fail(f"页码越界（共 {total} 页）：{out_of_range}")
    return sorted(selected)


def main() -> None:
    parser = argparse.ArgumentParser(description="PPTX 页间切换写入")
    parser.add_argument("pptx", help="待处理的 PPTX 路径")
    parser.add_argument("--type", choices=sorted(TRANSITION_ELEMENTS), default="fade", help="切换类型（默认 fade）")
    parser.add_argument("--advance-on-click", action="store_true", help="保留点击翻页（与自动翻页可叠加）")
    parser.add_argument("--advance-after", type=float, default=None, metavar="SECONDS", help="N 秒后自动翻页（展台/旁白场景）")
    parser.add_argument("--slides", default=None, help="页码选择器（1 起，如 1,3-5）；缺省全部页")
    parser.add_argument("--in-place", action="store_true", help="原地改写（默认输出 <deck>.trans.pptx）")
    args = parser.parse_args()

    pptx = os.path.abspath(args.pptx)
    if not os.path.isfile(pptx):
        fail(f"PPTX 不存在：{pptx}")

    slide_re = re.compile(r"^ppt/slides/slide\d+\.xml$")
    with zipfile.ZipFile(pptx) as zf:
        names = zf.namelist()
        slide_names = sorted(
            (name for name in names if slide_re.match(name)),
            key=lambda name: int(re.search(r"(\d+)", name).group(1)),  # type: ignore[union-attr]
        )
        if not slide_names:
            fail("包内没有任何 slide 部件（不是合法 PPTX）")
        targets = parse_slide_selection(args.slides, len(slide_names))
        transition_xml = build_transition_xml(args.type, args.advance_after, args.advance_on_click)

        out_path = pptx if args.in_place else os.path.splitext(pptx)[0] + ".trans.pptx"
        rewritten: set[str] = set()
        with tempfile.TemporaryDirectory(prefix="ppts-trans-") as tmp:
            tmp_out = os.path.join(tmp, "out.pptx")
            with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as out:
                for name in names:
                    data = zf.read(name)
                    if slide_re.match(name):
                        number = int(re.search(r"(\d+)", name).group(1))  # type: ignore[union-attr]
                        if number in targets:
                            xml = data.decode("utf-8", errors="replace")
                            data = inject_transition(xml, transition_xml).encode("utf-8")
                            rewritten.add(number)
                    out.writestr(name, data)
            shutil.move(tmp_out, out_path)

    print(f"[transitions] 已写入 {args.type} 切换：{len(rewritten)} 页（{', '.join(map(str, sorted(rewritten)))}）")
    print(f"[transitions] 输出：{out_path}")
    if args.in_place:
        print("[transitions] 提示：原地改写完成，请重跑渲染验收确认切换不影响版面")
    else:
        print("[transitions] 提示：产物为新文件，确认无误后替换原 deck（验收循环一切修改落到生成脚本的纪律不变——切换属后处理步骤，请在本脚本调用上留痕）")


if __name__ == "__main__":
    main()
