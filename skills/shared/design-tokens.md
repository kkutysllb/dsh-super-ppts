# 共享设计 Token（PPTX / HTML 双线共用）

跨交付线的一致性底线。各形态技能可以在此之上加自己的主题体系，
不得突破这些红线。

## 字体

| 用途 | HTML 字体栈 | PPTX 字体 |
|---|---|---|
| 中文正文 | "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif | 微软雅黑 / 苹方（明确声明 fallback） |
| 西文正文 | Inter, "Helvetica Neue", Arial, sans-serif | Aptos / Segoe UI |
| 展示标题 | 按主题指定（衬线/无衬线/手写皆可，需声明 fallback） | 同左，锁定具体字体名 |
| 等宽/代码 | "JetBrains Mono", Consolas, "Courier New", monospace | Consolas |

- CJK fallback 必须显式声明；Google Fonts 只作渐进增强，离线可降级到系统字体。
- 手写风格（scholar-notes）用 Kalam 系列 + 中文手写体（Ma Shan Zheng 等）。

## 字级

- 投影/录屏正文下限：HTML 16px / PPTX 14pt；图注下限 12px / 11pt。
- 展示标题与正文字号比 ≥ 1.8:1；全套 deck 字号层级 3–4 级封顶。
- 两侧大字幕（video-shots / phone-ui）字号以背景层可读为准（≥48px）。

## 色彩

- 对比度：正文 ≥ 4.5:1，大字（≥24px）≥ 3:1；深色主题用近黑/近白端值，
  在实际渲染结果上检查。
- 语义色约定：红=警告/强调、蓝=信息/术语、绿=成功/安全、紫=技术/代码、
  橙=传输/进行中。同一实体（组件/协议层/角色）全片锁同一颜色。
- 相邻页/镜头禁止同配色重复；整辑主题不中途跳变。

## 动效

- 入场 stagger：列表项 60–80ms；弹性入场 cubic-bezier(.34,1.56,.64,1)。
- 单页/单镜头元素序列总时长 1.5–2.5s；标题先于正文/图形出现。
- 元素有入有出（或定格收尾）；关键动作配镜头运动或音效（视频形态）。
- 科研/学术/医疗/政务场景默认无动效或简单淡入。

## 图标与图形

- 图标一律内联扁平 SVG；**禁 emoji 作图标、禁真实品牌商标**。
- 图形（图表/流程/示意图）用 CSS/SVG 绘制，不依赖外部图片。
- 数据图表必须有明确结论（takeaway）与可读标签；数据标出处角注。

## 舞台

- 标准 1920×1080（16:9），自适应全屏；HTML 页面禁止出现滚动条穿帮
  （内容舞台化，`overflow` 受控）。
- 重要内容保持一致安全边距（HTML ≥48px / PPTX ≥0.65in）。
