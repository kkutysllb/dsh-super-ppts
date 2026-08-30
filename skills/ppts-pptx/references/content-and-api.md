# 内容输入与 pptx-designer API 契约

引擎是 PyPI 公共库 `pptx-designer`（Python 3.10+）。只用公开、有文档的导入；
**不要**使用私有模块或凭记忆捏造签名——以安装包的文档与示例为准。
本文件与技能工作流（SKILL.md 七步）配套：输入怎么组织、库在哪个时刻调用。

## 结构化输入（content 模式）

页面结构已知但不需要逐元素控制时，用 `generate_ppt(content={...})`：

```python
content = {
    "title": "Q4 Revenue Report",
    "pages": [
        {"goal": "hook", "title": "Q4 2026", "subtitle": "Record quarter"},
        {"goal": "content", "title": "What changed",
         "bullets": ["Revenue grew 23%", "Enterprise mix increased"]},
        {"goal": "data", "title": "Key metrics",
         "bullets": ["Revenue: $12.8M", "Retention: 89%"]},
    ],
}
```

- 要点精炼；`goal` 描述**沟通角色**而非视觉装饰。常用 goal：
  `hook / problem / solution / features / data / code / exercise / overview / content / cta`。
- 页面需要自定义图示、精确坐标、高级构图或领域专用图形布局时，
  **切换到 Build Mode**，不要硬把 content schema 扳弯去表达它。

## 顶层管线（公共导入）

```python
from pptx_designer import Presentation, extract_design_dna, fetch_image, generate_ppt
```

- `generate_ppt(query, style=..., output=...)` —— 快路径（一句话）。
- `generate_ppt(content={...}, style=..., output=...)` —— 结构化路径。
- `Presentation(template_path=None)` —— 新建 16:9 演示文稿。
- `extract_design_dna(path)` —— 分析既有演示文稿（VI Build 入口）。
- `fetch_image(...)` —— 可选，可能需要图片服务凭据。

## 设计智能与主题原子（方向的两个调用时刻）

```python
from pptx_designer import PALETTES, STYLES, TYPOGRAPHY, recommend_styles
from pptx_designer.renderer.theme import ThemeComposer
from pptx_designer.search.adapters import search_color, search_style, search_typography
```

**时刻 A——方向锁定前（发现与推荐）**：用库拓宽并落地设计对话：

```python
candidates = recommend_styles("couture fashion editorial", top_k=3)
theme_hint = ThemeComposer().compose(query="couture fashion editorial", seed=7)
font_options = search_typography("serif", top_k=3)
```

把结果当作 2-3 个方向提案的**候选原子与词汇**，经受众、领域、视觉论点、
禁用模式规则过滤后呈现。库可能为模糊 query 返回通用奢华/商务预设——
**不得**把该结果不加诠释地当作最终艺术方向。

**时刻 B——方向锁定后（实现与可复现）**：用户选定方向后固化显式取值，
不再反复采样：

```python
theme = ThemeComposer().compose(
    palette="golden-luxury", fonts="serif-editorial",
    decoration="gold-trim", layout="asymmetric", seed=7,
)
```

Build Mode 把选定主题翻译为显式 `C` 字典、字体角色、图片规则与页面原型；
FreeStyle 在公共函数支持时传固化的 `palette/fonts/decoration/layout/mood/style_seed`。
**用户确认的视觉锁定是权威**；库原子是实现输入，不是设计判断的替代品。
不要在每次 PNG 复核后用库随机换方向——PNG 复核用于对照锁定诊断可见结果，
然后对生成脚本或固化主题做**针对性**修改。

## Build Mode 模块

```python
from pptx_designer.tools.cards import cta_slide, hero_slide, kpi_card, highlight_cards, section_divider
from pptx_designer.tools.charts import bar_chart, comparison_bars
from pptx_designer.tools.images import circle_image, cover_image
from pptx_designer.tools.layout import page_header, page_number, top_bar
from pptx_designer.tools.shapes import arrow, diamond, hexagon, oval, rect, rrect
from pptx_designer.tools.text import dramatic_text, gradient_text, multiline, text, vertical_text
```

- 所有位置与尺寸单位为**英寸**，命名参数（`left/top/width/height`）。
- `rrect` 是当前包文档化的圆角矩形助手。

## 图示与 SVG

```python
from pptx_designer import svg_chart
from pptx_designer.compiler import SVGCompileError
from pptx_designer.diagrams import ...   # 图示类，实例化后 .render(slide)
```

`svg_chart()` 产出受支持的可编辑 SVG 图表——**务必检查其 `warnings`**；
非法/不安全 SVG 输入用 `SVGCompileError` 捕获。

## 可靠写作规则（Build Mode）

- 用空白版式 + 显式坐标。
- 颜色收敛进 `C` 字典或显式主题 token。
- 优先原生形状、文本、图表与图示；图片放置用 `cover_image()`。
- 禁用私有模块与捏造签名。
- **报告成功前必须重开 PPTX 并渲染验收**（`render_pptx.py` / ppts_render 工具）。

## 与编译桥的衔接

- 快路径：`python3 <包根>/compiler/build_pptx.py --quick --query "..." --style <风格> --output deck.pptx`
- Build Mode：写生成脚本（直接 `import pptx_designer`）后
  `build_pptx.py --run build_deck.py --expect "output/deck.pptx"`
- 结构化路径建议在生成脚本内直接调 `generate_ppt(content={...})`，
  content 字典由 SKILL.md 第 3 步的页面规划翻译而来。
