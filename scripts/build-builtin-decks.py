#!/usr/bin/env python3
"""内置模板样例 deck 生成器（真缩略图的真源）。

为 16 个内置模板方向各生成一份**单页真实 deck**（skills/ppts-pptx/assets/
builtin-decks/<id>.pptx），再用渲染链（soffice → pdf → pdftoppm）出首页
截图（assets/builtin-thumbs/<id>.jpg）——面板内置模板卡片的缩略图真身。
坐标逐元素复刻 src/builtin-templates.ts 的 thumbSvg 设计（320×180 →
13.333×7.5in，1px = 3pt），方向迭代时改 TS 设计后同步改这里并重跑。

用法：
    # 生成 deck（需 python-pptx；默认优先插件 venv 的解释器）
    python3 scripts/build-builtin-decks.py
    # 生成 + 渲染缩略图（需 soffice + pdftoppm）
    python3 scripts/build-builtin-decks.py --render
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

PACKAGE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECKS_DIR = os.path.join(PACKAGE_ROOT, "skills", "ppts-pptx", "assets", "builtin-decks")
THUMBS_DIR = os.path.join(PACKAGE_ROOT, "skills", "ppts-pptx", "assets", "builtin-thumbs")

FONT = "PingFang SC"
S = 13.333 / 320  # SVG px → inch


def IN(px: float):
    from pptx.util import Emu

    return Emu(int(px * S * 914400))


def PT(px: float):
    from pptx.util import Pt

    return Pt(px * 3)  # 960pt / 320px


def rgb(hex_text: str):
    from pptx.dml.color import RGBColor

    return RGBColor.from_string(hex_text.lstrip("#").upper())


def blend(fg: str, bg: str, alpha: float) -> str:
    """把 SVG rgba(fg, alpha) 叠在 bg 上的结果算成实色（python-pptx 不支持填充透明度）。"""
    f = [int(fg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(bg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return "#%02x%02x%02x" % tuple(round(a * alpha + c * (1 - alpha)) for a, c in zip(f, b))


def new_slide():
    from pptx import Presentation
    from pptx.util import Emu

    prs = Presentation()
    prs.slide_width = Emu(int(13.333 * 914400))
    prs.slide_height = Emu(int(7.5 * 914400))
    return prs, prs.slides.add_slide(prs.slide_layouts[6])


def rect(sl, x, y, w, h, fill=None, line=None, lw=1.0, radius=None, dash=False, line_color_fallback=None):
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.enum.dml import MSO_LINE_DASH_STYLE

    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius is not None else MSO_SHAPE.RECTANGLE
    shp = sl.shapes.add_shape(shape_type, IN(x), IN(y), IN(w), IN(h))
    if radius is not None:
        try:
            shp.adjustments[0] = min(0.5, radius / min(w, h))
        except Exception:
            pass
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = rgb(fill)
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = rgb(line)
        shp.line.width = PT(lw)
        if dash:
            shp.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    shp.shadow.inherit = False
    return shp


def text(sl, x, y_base, w, content, size, color, bold=False, align="left"):
    """SVG 基线坐标 → 文本框（top ≈ 基线 - 0.78×字号；word_wrap 关，比例优先）。"""
    from pptx.enum.text import PP_ALIGN
    from pptx.oxml.ns import qn

    tb = sl.shapes.add_textbox(IN(x), IN(y_base - size * 0.78), IN(w), IN(size * 1.6))
    tf = tb.text_frame
    tf.word_wrap = False
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}[align]
    run = p.add_run()
    run.text = content
    f = run.font
    f.size = PT(size)
    f.bold = bold
    f.name = FONT
    f.color.rgb = rgb(color)
    rPr = run._r.get_or_add_rPr()
    ea = rPr.makeelement(qn("a:ea"), {"typeface": FONT})
    rPr.append(ea)
    return tb


def circle(sl, cx, cy, r, fill=None, line=None, lw=1.0, dash=False):
    from pptx.enum.shapes import MSO_SHAPE

    shp = sl.shapes.add_shape(MSO_SHAPE.OVAL, IN(cx - r), IN(cy - r), IN(2 * r), IN(2 * r))
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = rgb(fill)
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = rgb(line)
        shp.line.width = PT(lw)
        if dash:
            from pptx.enum.dml import MSO_LINE_DASH_STYLE

            shp.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    shp.shadow.inherit = False
    return shp


def seg(sl, x1, y1, x2, y2, color, w=1.5, dash=False, opacity=None):
    from pptx.enum.shapes import MSO_CONNECTOR

    conn = sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, IN(x1), IN(y1), IN(x2), IN(y2))
    conn.line.color.rgb = rgb(color if opacity is None else blend(color, _slide_bg, opacity))
    conn.line.width = PT(w)
    if dash:
        from pptx.enum.dml import MSO_LINE_DASH_STYLE

        conn.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    conn.shadow.inherit = False
    return conn


def polyline(sl, points, color, w=1.5):
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        seg(sl, x1, y1, x2, y2, color, w)


def gradient_rect(sl, x, y, w, h, c1, c2, radius=None, angle=45):
    shp = rect(sl, x, y, w, h, fill=c1, radius=radius)
    try:
        shp.fill.gradient()
        stops = shp.fill.gradient_stops
        stops[0].color.rgb = rgb(c1)
        stops[1].color.rgb = rgb(c2)
        try:
            shp.fill.gradient_angle = angle
        except Exception:
            pass
    except Exception:
        shp.fill.solid()
        shp.fill.fore_color.rgb = rgb(c2)
    return shp



# ── 参数化通用页（每个方向 = 封面(定制) + 内容/数据/结尾(参数化)，共 4 页）──

def page_content(sl, cfg):
    """内容页：左侧强调条 + 标题 + 三张横向要点卡。"""
    rect(sl, 0, 0, 320, 180, fill=cfg['bg'])
    rect(sl, 0, 0, 6, 180, fill=cfg['accent'])
    text(sl, 24, 40, 280, cfg['content_title'], 17, cfg['title'], bold=True)
    rect(sl, 24, 50, 26, 3, fill=cfg['accent'])
    cards = cfg['cards']
    cw = (272 - 2 * 12) // 3
    for i, (head, body) in enumerate(cards[:3]):
        bx = 24 + i * (cw + 12)
        rect(sl, bx, 70, cw, 62, fill=cfg['panel'], line=cfg['accent'], lw=0.8, radius=8)
        text(sl, bx + 10, 92, cw - 20, head, 12, cfg['accent'], bold=True)
        text(sl, bx + 10, 112, cw - 20, body, 9, cfg['sub'])
    text(sl, 24, 158, 280, cfg.get('content_note', cfg['closing_sub']), 8, cfg['sub'])


def page_data(sl, cfg):
    """数据页：标题 + 三枚 KPI 卡 + 强调色折线。"""
    rect(sl, 0, 0, 320, 180, fill=cfg['bg'])
    text(sl, 24, 36, 280, cfg['data_title'], 17, cfg['title'], bold=True)
    rect(sl, 24, 46, 26, 3, fill=cfg['accent'])
    for i, (num, label) in enumerate(cfg['kpis'][:3]):
        bx = 24 + i * 92
        rect(sl, bx, 62, 84, 40, fill=cfg['panel'], line=cfg['accent'], lw=0.8, radius=6)
        text(sl, bx + 10, 82, 66, num, 13, cfg['accent'], bold=True)
        text(sl, bx + 10, 96, 66, label, 8, cfg['sub'])
    base_y = 150
    polyline(sl, cfg['series'], cfg['accent'], 2)
    first = cfg['series'][0]
    last = cfg['series'][-1]
    circle(sl, last[0], last[1], 3, fill=cfg['accent'])
    seg(sl, 24, base_y + 8, 296, base_y + 8, blend(cfg['accent'], cfg['bg'], 0.35), 1)
    text(sl, 24, base_y, 120, cfg['data_note'], 8, cfg['sub'])


def page_closing(sl, cfg):
    """结尾页：居中大字 + 副题 + 居中强调条。"""
    rect(sl, 0, 0, 320, 180, fill=cfg['bg'])
    text(sl, 0, 84, 320, cfg['closing_title'], 22, cfg['title'], bold=True, align='center')
    rect(sl, 142, 98, 36, 3, fill=cfg['accent'])
    text(sl, 0, 122, 320, cfg['closing_sub'], 10, cfg['sub'], align='center')


# 每个方向的调色板与样例文案（封面 builder 复用上文 16 个定制函数）
CONFIGS = {
    'builtin-exec-review': dict(bg='#1b2f57', panel='#26355c', title='#ffffff', sub='#8fa8d9', accent='#3b5fd9',
        content_title='三个信号，一个结论', cards=[('增长质量', '收入 +18%，华东领跑'), ('利润承压', '毛利率 -2.4pt 需关注'), ('现金健康', '应收周转环比改善')],
        data_title='关键指标一览', kpis=[('128.4万', '月成交'), ('99.2%', '履约准时'), ('42万', '峰值 QPS')], data_note='近 6 个月走势',
        closing_title='谢谢 · 欢迎讨论', closing_sub='数据口径与明细见附录'),
    'builtin-product-launch': dict(bg='#0e0e12', panel='#17171d', title='#ffffff', sub='#9a9aa6', accent='#e5484d',
        content_title='三个卖点', cards=[('极速', '本地优先，秒级响应'), ('协同', '多人实时同稿'), ('开放', 'API 全打通')],
        data_title='发布首周数据', kpis=[('12万', '预约用户'), ('4.2%', '预约转化'), ('96%', '好评率')], data_note='上线 7 日',
        closing_title='立即体验', closing_sub='一场发布会 · 一件新品 · 三个卖点'),
    'builtin-tech-sharing': dict(bg='#f4f7f5', panel='#ffffff', title='#155e4d', sub='#6b8a80', accent='#1f8a70',
        content_title='分层架构总览', cards=[('接入层', '客户端与开放 API'), ('网关层', '鉴权 · 限流 · 路由'), ('服务层', '集群弹性伸缩')],
        data_title='性能基线', kpis=[('P99 86ms', '网关延迟'), ('99.99%', '可用性'), ('3.2k', '峰值 QPS')], data_note='压测报告摘要',
        closing_title='Q&A · 欢迎交流', closing_sub='架构评审意见请留档'),
    'builtin-teaching': dict(bg='#fbf6ec', panel='#ffffff', title='#4a3a1a', sub='#b09a6a', accent='#c8871a',
        content_title='本讲目标', cards=[('认识循环', '从生活例子入手'), ('三要素', '初始化 · 条件 · 步进'), ('动手练习', '画流程图')],
        data_title='课堂练习正确率', kpis=[('86%', '随堂测验'), ('92%', '出勤'), ('12', '互动提问')], data_note='本届两个班合计',
        closing_title='下讲预告：函数', closing_sub='课后作业已完成 78%'),
    'builtin-bp-roadshow': dict(bg='#241a3e', panel='#2f2450', title='#ffffff', sub='#8d80b8', accent='#d4a24e',
        content_title='商业模式', cards=[('价值主张', '给中小团队的研究底座'), ('收费', '席位 + 用量双轨'), ('壁垒', '数据飞轮')],
        data_title='增长与单位经济', kpis=[('×6.8', '年增速'), ('86%', '续费率'), ('11个月', '回本周期')], data_note='近三年复合',
        closing_title='与我们同行', closing_sub='本轮融资用途：研发 60% · 市场 40%'),
    'builtin-weekly-report': dict(bg='#f5f7fa', panel='#ffffff', title='#1f2937', sub='#8892a4', accent='#3b82f6',
        content_title='本周进展详情', cards=[('发布', '灰度流程 v2 落地'), ('调研', '三份客户访谈纪要'), ('排查', '构建耗时回归定位')],
        data_title='任务完成趋势', kpis=[('86%', '完成率'), ('14', '本周任务'), ('2', '顺延下周')], data_note='近 4 周',
        closing_title='下周计划', closing_sub='发布复盘 · 季度 OKR 对齐'),
    'builtin-marketing': dict(bg='#ffffff', panel='#fdf2f8', title='#111827', sub='#9ca3af', accent='#e64560',
        content_title='全域节奏编排', cards=[('预热期', '种草铺量'), ('爆发期', '直播 + 满减'), ('延续期', '复购召回')],
        data_title='渠道漏斗数据', kpis=[('2.4亿', '曝光'), ('4.2%', 'CTR'), ('18%', '复购')], data_note='去年同档期对比',
        closing_title='一起打胜仗', closing_sub='预算与排期见附录'),
    'builtin-dark-dashboard': dict(bg='#0a0f1c', panel='#0f1830', title='#ffffff', sub='#5b6b8c', accent='#22d3ee',
        content_title='实时链路监控', cards=[('入口', '网关与 WAF'), ('核心', '交易集群'), ('出口', '支付通道')],
        data_title='核心指标', kpis=[('128.4万', '实时成交'), ('99.2%', '支付成功'), ('42万', '峰值 QPS')], data_note='大促当日',
        closing_title='值守交接', closing_sub='异常处置手册 v3'),
    'builtin-minimal': dict(bg='#ffffff', panel='#fafafa', title='#111111', sub='#9ca3af', accent='#111111',
        content_title='设计三原则', cards=[('少', '删到不能再删'), ('静', '动效只为引导'), ('真', '内容即设计')],
        data_title='可用性测试', kpis=[('31分', 'SUS 得分'), ('-42%', '步骤数'), ('0', '严重问题')], data_note='12 名被试',
        closing_title='Less, but better.', closing_sub='Design Review · 2026 Q4'),
    'builtin-academic': dict(bg='#f8f6f1', panel='#ffffff', title='#1e3a5f', sub='#8a8577', accent='#1e3a5f',
        content_title='研究方法', cards=[('建模', '多智能体协同框架'), ('实验', '三组对照基准'), ('验证', '消融与显著性')],
        data_title='实验结果', kpis=[('+9.6%', '主指标'), ('p<0.01', '显著性'), ('3', '基准集')], data_note='两组随机种子',
        closing_title='致谢', closing_sub='导师与实验室同侪'),
    'builtin-editorial': dict(bg='#faf7f2', panel='#f1ece1', title='#111111', sub='#a39a88', accent='#d9a441',
        content_title='本期专题', cards=[ ('街区', '菜市场里的城市史'), ('人物', '守桥人十二年'), ('未来', '15 分钟生活圈')],
        data_title='读者数据', kpis=[('24页', '本期专题'), ('38%', '完读率'), ('12万', '月度读者')], data_note='纸质 + 电子合刊',
        closing_title='下期预告：夜航', closing_sub='VOL.13 · 城市观察'),
    'builtin-healthcare': dict(bg='#f0faf9', panel='#ffffff', title='#0f766e', sub='#6b9c97', accent='#0e9488',
        content_title='本月健康画像', cards=[('运动', '达标 92%'), ('睡眠', '平均 7.5 小时'), ('心率', '静息 72 bpm')],
        data_title='体征趋势', kpis=[('72', '静息心率'), ('7.5h', '睡眠'), ('8千', '日均步数')], data_note='近 30 天',
        closing_title='健康建议', closing_sub='保持节奏 · 定期复查'),
    'builtin-government': dict(bg='#fbf5ef', panel='#ffffff', title='#8c1f10', sub='#b09a72', accent='#c7351f',
        content_title='重点任务推进', cards=[('一网通办', '覆盖率 92%'), ('政务云', '三级等保完成'), ('惠企直达', '12 万家主体')],
        data_title='服务效能数据', kpis=[('92%', '网办率'), ('-38%', '平均时限'), ('98.6%', '好差评')], data_note='本年度累计',
        closing_title='下一步工作', closing_sub='向人大报告并公开'),
    'builtin-ecommerce': dict(bg='#2d1b52', panel='#3a2766', title='#ffffff', sub='#b8a6e0', accent='#f59e0b',
        content_title='大促节奏复盘', cards=[('蓄水', '种草提前 21 天'), ('爆发', '直播开卖 4 小时'), ('返场', '库存精准补货')],
        data_title='成交漏斗', kpis=[('3.2亿', 'GMV'), ('+47%', '同比'), ('98.6%', '履约')], data_note='全渠道口径',
        closing_title='蓄水双 12', closing_sub='会员复购专项先行'),
    'builtin-esg': dict(bg='#ffffff', panel='#f0fdf4', title='#14532d', sub='#6b7f6e', accent='#15803d',
        content_title='环境 E：减碳路径', cards=[('能源', '绿电占比 64%'), ('制造', '5 座无废工厂'), ('物流', '短链直发')],
        data_title='三维披露指标', kpis=[('-38%', '单厂碳强度'), ('64%', '绿电'), ('A', 'MSCI 评级')], data_note='经第三方鉴证',
        closing_title='迈向 2030', closing_sub='范围三盘查启动'),
    'builtin-engineering': dict(bg='#263238', panel='#31404a', title='#ffffff', sub='#90a4ae', accent='#f59e0b',
        content_title='本周施工进展', cards=[('主体', '结构 18F 封顶'), ('幕墙', '南立面 60%'), ('机电', '预埋管线过半')],
        data_title='进度曲线', kpis=[('62%', '总进度'), ('0', '安全事故'), ('+2天', '关键路径')], data_note='开工第 32 周',
        closing_title='下阶段计划', closing_sub='幕墙大面施工 · 机电插层'),
}

for _id, _cfg in CONFIGS.items():
    _cfg['series'] = [(30, 138), (76, 130), (124, 134), (172, 112), (220, 96), (280, 70)]

# ── 16 个方向的单页构建器（坐标与 src/builtin-templates.ts 的 thumbSvg 一致）──

_slide_bg = "#ffffff"


def d_exec_review(sl):
    global _slide_bg
    _slide_bg = "#1b2f57"
    rect(sl, 0, 0, 320, 180, fill="#1b2f57")
    rect(sl, 0, 0, 320, 4, fill="#3b5fd9")
    text(sl, 24, 36, 280, "Q3 经营复盘 · 管理层汇报", 10, "#8fa8d9")
    text(sl, 24, 66, 280, "收入同比增长 18%", 19, "#ffffff", bold=True)
    card = blend("#ffffff", "#1b2f57", 0.08)
    for cx, num, color, label in ((24, "+18%", "#ffffff", "营业收入"), (118, "-2.4pt", "#ffb020", "利润率"), (212, "+32%", "#4cc38a", "华东区域")):
        rect(sl, cx, 84, 86, 52, fill=card, radius=6)
        text(sl, cx + 12, 110, 70, num, 16, color, bold=True)
        text(sl, cx + 12, 126, 70, label, 9, "#8fa8d9")
    rect(sl, 24, 152, 40, 3, fill="#3b5fd9")
    text(sl, 72, 157, 220, "结论先行 · 数据优先 · 克制表达", 9, "#5d729c")


def d_product_launch(sl):
    global _slide_bg
    _slide_bg = "#0e0e12"
    rect(sl, 0, 0, 320, 180, fill="#0e0e12")
    text(sl, 28, 64, 200, "重新定义", 21, "#ffffff", bold=True)
    text(sl, 28, 90, 200, "工作方式", 21, "#ffffff", bold=True)
    rect(sl, 28, 102, 36, 3, fill="#e5484d")
    text(sl, 28, 124, 200, "一场发布会 · 一件新品 · 三个卖点", 9, "#9a9aa6")
    rect(sl, 28, 140, 64, 18, fill="#e5484d", radius=9)
    text(sl, 28, 152, 64, "立即体验", 8, "#ffffff", align="center")
    rect(sl, 206, 28, 76, 124, fill="#17171d", line="#2e2e38", lw=1, radius=12)
    gradient_rect(sl, 214, 40, 60, 90, "#ff7a45", "#c81e3c", radius=6, angle=45)
    rect(sl, 234, 32, 20, 4, fill="#2e2e38", radius=2)
    rect(sl, 236, 134, 16, 10, fill="#2e2e38", radius=3)
    text(sl, 0, 172, 320, "KEYNOTE · PRODUCT LAUNCH", 7, "#3c3c46", align="center")


def d_tech_sharing(sl):
    global _slide_bg
    _slide_bg = "#f4f7f5"
    rect(sl, 0, 0, 320, 180, fill="#f4f7f5")
    rect(sl, 0, 0, 6, 180, fill="#1f8a70")
    text(sl, 24, 40, 280, "技术架构分享", 17, "#155e4d", bold=True)
    text(sl, 24, 58, 280, "架构图与流程为主 · 方案讲解与评审", 9, "#6b8a80")
    for bx, label, fill in ((24, "客户端", "#ffffff"), (126, "网关", "#ffffff"), (228, "服务集群", "#e6f4f0")):
        rect(sl, bx, 92, 70, 32, fill=fill, line="#1f8a70", lw=1, radius=5)
        text(sl, bx, 111, 70, label, 10, "#155e4d", align="center")
    seg(sl, 94, 108, 124, 108, "#1f8a70", 1.5)
    seg(sl, 196, 108, 226, 108, "#1f8a70", 1.5)
    text(sl, 24, 158, 280, "分层架构 · 调用链路 · 关键决策点", 9, "#8aa39b")


def d_teaching(sl):
    global _slide_bg
    _slide_bg = "#fbf6ec"
    rect(sl, 0, 0, 320, 180, fill="#fbf6ec")
    rect(sl, 0, 0, 320, 34, fill="#c8871a")
    text(sl, 20, 22, 280, "第 3 讲 · 循环结构", 13, "#ffffff", bold=True)
    for i, (yy, label) in enumerate(((64, "认识循环"), (88, "循环三要素"), (112, "动手练习"))):
        text(sl, 24, yy, 30, f"0{i + 1}", 11, "#c8871a", bold=True)
        text(sl, 48, yy, 120, label, 11, "#4a3a1a")
    for cx, cy, op in ((236, 72, 0.9), (272, 96, 0.7), (236, 120, 0.5), (200, 96, 0.35)):
        circle(sl, cx, cy, 15, fill=blend("#c8871a", "#fbf6ec", op))
    seg(sl, 248, 82, 262, 88, blend("#8a6212", "#fbf6ec", 1), 1.5)
    seg(sl, 266, 110, 252, 116, "#8a6212", 1.5)
    seg(sl, 204, 110, 218, 84, "#8a6212", 1.5)
    text(sl, 246, 166, 60, "03", 9, "#b09a6a", align="right")


def d_bp_roadshow(sl):
    global _slide_bg
    _slide_bg = "#241a3e"
    rect(sl, 0, 0, 320, 180, fill="#241a3e")
    text(sl, 24, 32, 200, "BUSINESS PLAN · 2026", 9, "#d4a24e")
    text(sl, 24, 60, 280, "市场规模与增长路径", 19, "#ffffff", bold=True)
    area_pts = [(28, 138), (76, 128), (124, 132), (172, 108), (220, 84), (268, 52), (268, 156), (28, 156)]
    builder = sl.shapes.build_freeform(IN(28), IN(138))
    builder.add_line_segments([(IN(px), IN(py)) for px, py in area_pts[1:]], close=True)
    area = builder.convert_to_shape()
    area.fill.solid()
    area.fill.fore_color.rgb = rgb(blend("#d4a24e", "#241a3e", 0.12))
    area.line.fill.background()
    area.shadow.inherit = False
    polyline(sl, [(28, 138), (76, 128), (124, 132), (172, 108), (220, 84), (268, 52)], "#d4a24e", 2)
    circle(sl, 172, 108, 3.5, fill="#241a3e", line="#d4a24e", lw=2)
    circle(sl, 268, 52, 3.5, fill="#d4a24e")
    text(sl, 28, 170, 100, "TAM 92亿", 8, "#8d80b8")
    text(sl, 130, 170, 160, "种子轮 → A 轮 → 盈利", 8, "#8d80b8")
    text(sl, 200, 30, 92, "×6.8", 12, "#d4a24e", bold=True, align="right")


def d_weekly_report(sl):
    global _slide_bg
    _slide_bg = "#f5f7fa"
    rect(sl, 0, 0, 320, 180, fill="#f5f7fa")
    text(sl, 24, 36, 200, "第 40 周工作汇报", 16, "#1f2937", bold=True)
    text(sl, 24, 54, 200, "进展 · 数据 · 下周计划", 9, "#8892a4")
    for cy, dot, label, color in ((76, "#3b82f6", "上线灰度发布流程 v2", "#374151"), (98, "#3b82f6", "完成三份客户访谈纪要", "#374151"), (120, "#93c5fd", "排查构建耗时回归（进行中）", "#6b7280")):
        circle(sl, 30, cy, 4, fill=dot)
        text(sl, 42, cy + 4, 160, label, 10, color)
    rect(sl, 212, 64, 84, 64, fill="#ffffff", line="#dbe2ec", lw=1, radius=8)
    text(sl, 212, 94, 84, "86%", 18, "#3b82f6", bold=True, align="center")
    text(sl, 212, 112, 84, "本周任务完成率", 8, "#8892a4", align="center")
    rect(sl, 24, 140, 120, 4, fill="#dbe2ec", radius=2)
    rect(sl, 24, 140, 103, 4, fill="#3b82f6", radius=2)
    text(sl, 24, 162, 250, "下周：发布复盘 · 季度 OKR 对齐", 8, "#8892a4")


def d_marketing(sl):
    global _slide_bg
    _slide_bg = "#ffffff"
    rect(sl, 0, 0, 320, 180, fill="#ffffff")
    gradient_rect(sl, 0, 0, 320, 6, "#e64560", "#f59e0b", angle=0)
    text(sl, 24, 44, 280, "618 大促整合营销方案", 18, "#111827", bold=True)
    text(sl, 24, 62, 280, "种草 → 转化 → 复购 · 全域节奏", 9, "#9ca3af")
    cards = ((24, "#e64560", "曝光", "2.4 亿", 0.92), (96, "#e64560", "种草", "CTR 4.2%", 0.78), (168, "#f59e0b", "转化", "GMV 目标", 0.78))
    for bx, color, title, sub, op in cards:
        rect(sl, bx, 80, 60, 52, fill=blend(color, "#ffffff", op), radius=8)
        text(sl, bx, 103, 60, title, 12, "#ffffff", bold=True, align="center")
        text(sl, bx, 118, 60, sub, 8, "#ffffff", align="center")
    rect(sl, 240, 80, 56, 52, fill="#fef3c7", radius=8)
    text(sl, 240, 103, 56, "复购", 12, "#b45309", bold=True, align="center")
    text(sl, 240, 118, 56, "+18%", 8, "#b45309", align="center")
    text(sl, 24, 158, 280, "节点排期 · 预算分配 · 达人矩阵 · 风险预案", 8, "#9ca3af")


def d_dark_dashboard(sl):
    global _slide_bg
    _slide_bg = "#0a0f1c"
    rect(sl, 0, 0, 320, 180, fill="#0a0f1c")
    for yy in (45, 90, 135):
        seg(sl, 0, yy, 320, yy, "#16203a", 1)
    for xx in (80, 160, 240):
        seg(sl, xx, 0, xx, 180, "#16203a", 1)
    text(sl, 24, 30, 200, "REALTIME OPS", 8, "#22d3ee")
    text(sl, 24, 56, 220, "双 11 实时作战室", 16, "#ffffff", bold=True)
    text(sl, 24, 102, 160, "128.4万", 26, "#22d3ee", bold=True)
    text(sl, 24, 120, 160, "实时成交订单", 9, "#5b6b8c")
    polyline(sl, [(150, 120), (178, 104), (206, 112), (234, 88), (262, 92), (296, 64)], "#22d3ee", 2)
    circle(sl, 296, 64, 3, fill="#22d3ee")
    for bx, label in ((150, "支付成功率 99.2%"), (228, "峰值 QPS 42万")):
        rect(sl, bx, 132, 70, 26, fill="#0f1830", line="#1d2a4a", lw=1, radius=6)
        text(sl, bx, 149, 70, label, 8, "#8ea3cc", align="center")


def d_minimal(sl):
    global _slide_bg
    _slide_bg = "#ffffff"
    rect(sl, 0, 0, 320, 180, fill="#ffffff")
    text(sl, 32, 72, 260, "少，即是多。", 24, "#111111", bold=True)
    text(sl, 32, 96, 260, "极简主义设计方向 · 留白即内容", 9, "#9ca3af")
    rect(sl, 32, 116, 256, 1, fill="#e5e7eb")
    text(sl, 32, 140, 200, "Design Review · 2026 Q4", 9, "#6b7280")
    circle(sl, 284, 140, 6, fill="#e11d48")


def d_academic(sl):
    global _slide_bg
    _slide_bg = "#f8f6f1"
    rect(sl, 0, 0, 320, 180, fill="#f8f6f1")
    rect(sl, 0, 0, 320, 30, fill="#1e3a5f")
    text(sl, 0, 20, 320, "硕士学位论文答辩", 10, "#ffffff", align="center")
    text(sl, 24, 62, 280, "基于多智能体协同的关键技术研究", 15, "#1e3a5f", bold=True)
    text(sl, 24, 82, 280, "答辩人：李某某 · 导师：王某某 教授 · 2026 年 6 月", 9, "#8a8577")
    for bx, label, fill in ((24, "研究背景", "#ffffff"), (117, "方法与实验", "#ffffff"), (210, "结论与展望", "#eef2f8")):
        rect(sl, bx, 100, 86, 42, fill=fill, line="#1e3a5f", lw=0.8, radius=6)
        text(sl, bx, 125, 86, label, 10, "#1e3a5f", align="center")
    text(sl, 24, 166, 260, "章节严谨 · 引用规范 · 图表编号", 8, "#b3ad9d")


def d_editorial(sl):
    global _slide_bg
    _slide_bg = "#faf7f2"
    rect(sl, 0, 0, 320, 180, fill="#faf7f2")
    text(sl, 24, 52, 200, "城市观察", 26, "#111111", bold=True)
    rect(sl, 24, 64, 22, 3, fill="#d9a441")
    text(sl, 200, 40, 96, "VOL.12", 9, "#d9a441", align="right")
    for yy, w in ((86, 110), (102, 96), (118, 104), (134, 72)):
        rect(sl, 24, yy, w, 8, fill="#e2ddd2", radius=4)
    rect(sl, 168, 80, 128, 70, fill="#e8d9b8", radius=4)
    circle(sl, 232, 106, 18, fill=blend("#d9a441", "#e8d9b8", 0.85))
    seg(sl, 168, 150, 296, 150, "#111111", 1)
    text(sl, 24, 166, 150, "深度 · 长文 · 图文分栏", 8, "#a39a88")
    text(sl, 200, 166, 96, "P.24", 8, "#a39a88", align="right")


def d_healthcare(sl):
    global _slide_bg
    _slide_bg = "#f0faf9"
    rect(sl, 0, 0, 320, 180, fill="#f0faf9")
    text(sl, 24, 38, 220, "个人健康月报", 16, "#0f766e", bold=True)
    text(sl, 24, 56, 220, "9 月 · 体征趋势与建议", 9, "#6b9c97")
    rect(sl, 24, 72, 86, 46, fill="#ffffff", line="#bfe3df", lw=1, radius=8)
    text(sl, 38, 94, 70, "72 bpm", 13, "#0e9488", bold=True)
    text(sl, 38, 109, 70, "静息心率", 8, "#6b9c97")
    rect(sl, 118, 72, 86, 46, fill="#ffffff", line="#bfe3df", lw=1, radius=8)
    text(sl, 132, 94, 70, "7.5 h", 13, "#0e9488", bold=True)
    text(sl, 132, 109, 70, "平均睡眠", 8, "#6b9c97")
    rect(sl, 212, 72, 84, 46, fill="#0e9488", radius=8)
    text(sl, 226, 94, 70, "达标 92%", 13, "#ffffff", bold=True)
    text(sl, 226, 109, 70, "运动目标", 8, "#c7ece8")
    polyline(sl, [(24, 150), (60, 144), (96, 148), (132, 138), (168, 142), (204, 132), (240, 136), (276, 126)], blend("#0e9488", "#f0faf9", 0.7), 2)


def d_government(sl):
    global _slide_bg
    _slide_bg = "#fbf5ef"
    rect(sl, 0, 0, 320, 180, fill="#fbf5ef")
    rect(sl, 0, 0, 320, 44, fill="#c7351f")
    rect(sl, 0, 44, 320, 3, fill="#d9a24e")
    text(sl, 0, 27, 320, "全市数字化转型工作汇报", 12, "#ffffff", bold=True, align="center")
    text(sl, 24, 78, 280, "聚焦实干 · 数据说话", 16, "#8c1f10", bold=True)
    for yy, label in ((94, "一网通办覆盖率达 92%"), (114, "政务云迁移完成三级等保测评"), (134, "惠企政策直达 12 万家市场主体")):
        rect(sl, 24, yy - 8, 8, 8, fill="#d9a24e")
        text(sl, 42, yy, 250, label, 10, "#4a3a2a")
    text(sl, 24, 166, 260, "红头风格 · 规范格式 · 严谨表述", 8, "#b09a72")


def d_ecommerce(sl):
    global _slide_bg
    _slide_bg = "#2d1b52"
    rect(sl, 0, 0, 320, 180, fill="#2d1b52")
    rect(sl, 24, 24, 72, 18, fill="#f59e0b", radius=9)
    text(sl, 24, 36, 72, "双 11 复盘", 9, "#ffffff", bold=True, align="center")
    text(sl, 24, 70, 280, "GMV 3.2 亿 · 同比 +47%", 17, "#ffffff", bold=True)
    text(sl, 24, 88, 280, "全渠道成交 · 履约准时率 98.6%", 9, "#b8a6e0")
    for yy, w, color, label, lcolor in ((104, 200, "#f59e0b", "支付 3.2 亿", "#fcd9a8"), (122, 150, "#ec4899", "下单 4.1 亿", "#f9c0d8"), (140, 100, "#8b5cf6", "加购 6.8 亿", "#c9b4f2")):
        rect(sl, 24, yy, w, 10, fill=color, radius=5)
        text(sl, 24 + w + 8, yy + 9, 90, label, 8, lcolor)
    text(sl, 200, 60, 96, "+47%", 15, "#f59e0b", bold=True, align="right")
    text(sl, 200, 74, 96, "同比增速", 8, "#8d80b8", align="right")


def d_esg(sl):
    global _slide_bg
    _slide_bg = "#ffffff"
    rect(sl, 0, 0, 320, 180, fill="#ffffff")
    from pptx.enum.shapes import MSO_SHAPE

    circle(sl, 52, 52, 16, line="#15803d", lw=3)
    arc = sl.shapes.add_shape(MSO_SHAPE.BLOCK_ARC, IN(36), IN(36), IN(32), IN(32))
    try:
        arc.adjustments[0] = -90.0
        arc.adjustments[1] = 180.0
        arc.adjustments[2] = 0.10
    except Exception:
        pass
    arc.fill.solid()
    arc.fill.fore_color.rgb = rgb("#86efac")
    arc.line.fill.background()
    arc.shadow.inherit = False
    text(sl, 36, 57, 32, "38%", 11, "#14532d", bold=True, align="center")
    circle(sl, 124, 52, 16, line="#15803d", lw=3)
    text(sl, 108, 57, 32, "64%", 11, "#14532d", bold=True, align="center")
    text(sl, 24, 96, 280, "2026 可持续发展报告", 16, "#14532d", bold=True)
    text(sl, 24, 114, 280, "减碳 38% · 绿电占比 64% · 5 座无废工厂", 9, "#6b7f6e")
    rect(sl, 0, 136, 320, 44, fill="#f0fdf4")
    text(sl, 24, 162, 280, "环境 · 社会 · 治理 三维披露 · 第三方鉴证", 9, "#4d7c5f")


def d_engineering(sl):
    global _slide_bg
    _slide_bg = "#263238"
    rect(sl, 0, 0, 320, 180, fill="#263238")
    for yy in (36, 72, 108, 144):
        seg(sl, 0, yy, 320, yy, "#31404a", 1)
    for xx in (64, 128, 192, 256):
        seg(sl, xx, 0, xx, 180, "#31404a", 1)
    rect(sl, 24, 24, 64, 18, fill="#f59e0b", radius=4)
    text(sl, 24, 36, 64, "进度 62%", 9, "#263238", bold=True, align="center")
    text(sl, 24, 66, 220, "东部枢纽项目 · 周报 08", 15, "#ffffff", bold=True)
    text(sl, 24, 84, 220, "主体结构 18F · 幕墙 60% · 机电预埋", 9, "#90a4ae")
    rect(sl, 212, 52, 44, 96, line="#f59e0b", lw=1.5)
    for yy in (68, 84, 100, 116, 132):
        seg(sl, 212, yy, 256, yy, blend("#f59e0b", "#263238", 0.7), 0.8)
    rect(sl, 262, 76, 34, 72, line="#78909c", lw=1.5)
    for yy in (92, 108, 124, 140):
        seg(sl, 262, yy, 296, yy, blend("#78909c", "#263238", 0.7), 0.8)
    circle(sl, 32, 152, 3, fill="#f59e0b")
    text(sl, 42, 156, 60, "基坑", 8, "#b0bec5")
    circle(sl, 112, 152, 3, fill="#f59e0b")
    text(sl, 122, 156, 60, "主体", 8, "#b0bec5")
    circle(sl, 192, 152, 3, line="#90a4ae", lw=1.5)
    text(sl, 202, 156, 80, "幕墙 · 机电", 8, "#b0bec5")


DESIGNS = {
    "builtin-exec-review": d_exec_review,
    "builtin-product-launch": d_product_launch,
    "builtin-tech-sharing": d_tech_sharing,
    "builtin-teaching": d_teaching,
    "builtin-bp-roadshow": d_bp_roadshow,
    "builtin-weekly-report": d_weekly_report,
    "builtin-marketing": d_marketing,
    "builtin-dark-dashboard": d_dark_dashboard,
    "builtin-minimal": d_minimal,
    "builtin-academic": d_academic,
    "builtin-editorial": d_editorial,
    "builtin-healthcare": d_healthcare,
    "builtin-government": d_government,
    "builtin-ecommerce": d_ecommerce,
    "builtin-esg": d_esg,
    "builtin-engineering": d_engineering,
}

SOFFICE_FALLBACKS = [
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/local/bin/soffice",
    "/usr/bin/soffice",
    "/opt/libreoffice/program/soffice",
]


def probe_soffice():
    found = shutil.which("soffice")
    if found:
        return found
    for candidate in SOFFICE_FALLBACKS:
        if os.path.isfile(candidate):
            return candidate
    return None


def render_thumbs():
    soffice = probe_soffice()
    if soffice is None:
        print("[decks] ERROR: 未找到 soffice，无法渲染缩略图（deck 已生成）")
        return False
    pdftoppm = shutil.which("pdftoppm")
    if pdftoppm is None:
        print("[decks] ERROR: 未找到 pdftoppm，无法渲染缩略图（deck 已生成）")
        return False
    os.makedirs(THUMBS_DIR, exist_ok=True)
    ids = sorted(os.listdir(DECKS_DIR))
    with tempfile.TemporaryDirectory(prefix="ppts-builtin-") as tmp:
        for name in ids:
            if not name.endswith(".pptx"):
                continue
            deck = os.path.join(DECKS_DIR, name)
            stem = name[:-5]
            # 清理该方向旧页图（deck 页数缩减时不留陈旧页）
            for old in os.listdir(THUMBS_DIR):
                if old.startswith(stem + ".") or old.startswith(stem + "-"):
                    os.remove(os.path.join(THUMBS_DIR, old))
            convert = subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, deck],
                check=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=300)
            pdf = os.path.join(tmp, stem + ".pdf")
            if convert.returncode != 0 or not os.path.isfile(pdf):
                print(f"[decks] ERROR: {stem} 转 PDF 失败：{(convert.stdout or '').strip()[-200:]}")
                continue
            out_prefix = os.path.join(tmp, stem)
            ppm = subprocess.run(
                [pdftoppm, "-jpeg", "-scale-to", "480", pdf, out_prefix],
                check=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=120)
            produced = sorted(n for n in os.listdir(tmp) if n.startswith(stem) and n.endswith(".jpg"))
            if ppm.returncode != 0 or not produced:
                print(f"[decks] ERROR: {stem} 出图失败")
                continue
            for index, page_img in enumerate(produced, start=1):
                target = os.path.join(THUMBS_DIR, f"{stem}-{index}.jpg")
                os.replace(os.path.join(tmp, page_img), target)
            shutil.copyfile(os.path.join(THUMBS_DIR, f"{stem}-1.jpg"), os.path.join(THUMBS_DIR, stem + ".jpg"))
            print(f"[decks] thumb: {stem} × {len(produced)} 页")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="内置模板样例 deck 生成器")
    parser.add_argument("--render", action="store_true", help="生成后渲染首页缩略图（soffice + pdftoppm）")
    parser.add_argument("--only", metavar="ID", help="只生成指定方向（如 builtin-minimal）")
    args = parser.parse_args()

    try:
        from pptx import Presentation  # noqa: F401
    except ImportError:
        print("[decks] ERROR: 缺 python-pptx。用插件 venv：~/.dsh/venvs/dsh-super-ppts/bin/python 本脚本")
        raise SystemExit(1)

    os.makedirs(DECKS_DIR, exist_ok=True)
    targets = {k: v for k, v in DESIGNS.items() if args.only is None or k == args.only}
    for template_id, builder in sorted(targets.items()):
        global _slide_bg
        cfg = CONFIGS[template_id]
        prs, slide = new_slide()
        _slide_bg = cfg["bg"]
        builder(slide)
        for page_builder in (page_content, page_data, page_closing):
            _slide_bg = cfg["bg"]
            page = prs.slides.add_slide(prs.slide_layouts[6])
            page_builder(page, cfg)
        out = os.path.join(DECKS_DIR, template_id + ".pptx")
        prs.save(out)
        print(f"[decks] deck: {template_id}.pptx (4p)")
    if args.render:
        if not render_thumbs():
            raise SystemExit(1)
    print(f"[decks] 完成：{len(targets)} 个方向 → {DECKS_DIR}")


if __name__ == "__main__":
    main()
