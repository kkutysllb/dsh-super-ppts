#!/usr/bin/env python3
"""dsh-super-ppts Build Mode 示例：生成《双交付线》5 页演示文稿。

演示 skills/ppts-pptx 技能线的 Build Mode 用法：
- ThemeComposer 固化主题原子（时刻 B：方向锁定后不再采样）；
- 空白版式 + 显式坐标 + 库助手（cards/layout/shapes/text）；
- 运行方式（在插件包根）：
    python3 compiler/build_pptx.py --run demos/build-pptx-demo.py --expect "demos/pptx-demo.pptx"
  产物 demos/pptx-demo.pptx 再经 render_pptx.py 渲染 PNG 做视觉验收。
"""

from pptx_designer import Presentation
from pptx_designer.renderer.theme import ThemeComposer
from pptx_designer.tools.cards import cta_slide, hero_slide, highlight_cards, kpi_card
from pptx_designer.tools.layout import page_header, page_number, top_bar
from pptx_designer.tools.shapes import arrow, rrect
from pptx_designer.tools.text import text

# 时刻 B：固化主题（ux-dynamic 商务蓝 + accent-bar 装饰 + wide-cards 版式）
THEME = ThemeComposer().compose(
    palette="ux-dynamic",
    fonts="modern-clean",
    decoration="accent-bar",
    layout="wide-cards",
    seed=7,
)
C = THEME["colors"]

DECK_TOTAL = 5


def add_blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])  # 6 = 空白版式


def main() -> None:
    prs = Presentation()

    # 页 1 · 封面（hero 自带构图）
    hero_slide(add_blank(prs), title="dsh-super-ppts", subtitle="演示文稿超级插件：双交付线的两种打开方式", C=C)

    # 页 2 · 关键数字
    s = add_blank(prs)
    top_bar(s, C["primary"])
    page_header(s, "一个插件，三种克制", subtitle="dsh-super-ppts 的设计预算", C=C)
    card_w, gap, left0 = 3.9, 0.3, 0.65
    for i, (number, label) in enumerate(
        [("2", "条交付线：PPTX 可编辑 / HTML 在线演示"), ("8", "种 HTML 形态：从翻页演示到手机 UI"), ("0", "个本地服务端口：渲染验收走 CLI")]
    ):
        kpi_card(s, left0 + i * (card_w + gap), 2.2, card_w, 3.4, number, label, C=C)
    page_number(s, 2, DECK_TOTAL, C=C)

    # 页 3 · 两条交付线
    s = add_blank(prs)
    top_bar(s, C["accent"])
    page_header(s, "两条交付线", subtitle="先问形态，再动工", C=C)
    highlight_cards(
        s,
        1.0,
        2.2,
        cards=[
            ("PPTX 线", "pptx-designer 引擎，七步设计导演工作流，产物可继续编辑", C["primary"]),
            ("HTML 线", "单文件自包含演示，1920×1080 舞台，浏览器打开即所见", C["accent"]),
        ],
        C=C,
    )
    page_number(s, 3, DECK_TOTAL, C=C)

    # 页 4 · 验收闭环（显式坐标流程图）
    s = add_blank(prs)
    top_bar(s, C["accent"])
    page_header(s, "验收闭环", subtitle="先过视觉门，再谈完成", C=C)
    steps = ["技能编排生成", "PPTX 产物", "PDF 中转", "PNG 逐页", "视觉复核"]
    box_w, box_h, box_y = 1.9, 1.1, 3.0
    span = 12.03 - box_w
    for i, label in enumerate(steps):
        x = 0.65 + i * (span / (len(steps) - 1))
        fill = C["primary"] if i == 0 else (C["accent"] if i == len(steps) - 1 else C["muted"])
        fg = C["on-primary"] if i in (0, len(steps) - 1) else C["foreground"]
        rrect(s, x, box_y, box_w, box_h, fill)
        text(s, x, box_y + 0.28, box_w, 0.6, label, font_size=13, color=fg, bold=True, align="center", C=C)
        if i < len(steps) - 1:
            # 箭头限制在两卡净空内（画序在下一卡之前，避免被盖）
            gap_step = span / (len(steps) - 1)
            clear = gap_step - box_w
            arrow(s, x + box_w + clear * 0.15, box_y + box_h / 2 - 0.1, clear * 0.7, 0.2, C["muted-foreground"])
    page_number(s, 4, DECK_TOTAL, C=C)

    # 页 5 · 行动号召
    cta_slide(add_blank(prs), title="两条安装入口", subtitle="github:kkutysllb/dsh-super-ppts  ·  或 dsh-plugins 镜像子目录", C=C)

    prs.save("demos/pptx-demo.pptx")
    print("[build-pptx-demo] 已生成 demos/pptx-demo.pptx（5 页）")


if __name__ == "__main__":
    main()
