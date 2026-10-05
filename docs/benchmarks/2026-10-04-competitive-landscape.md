# 演示文稿插件横向对标（2026-10-04）

**方法**：四路并行联网调研（Claude 官方技能 / DSH 同生态插件 / 开源与 MCP 生态 / 商用 AI PPT），
GitHub、npm、官网交叉验证。小众竞品细节以各自 README 为准；星数为调研时点数据。
**结论口径**：差距清单的最终版见 [`plans/2026-10-04-pptx-capability-batch-p0.md`](../../plans/2026-10-04-pptx-capability-batch-p0.md)。

## 一、四个阵营

| 阵营 | 代表 | 与本插件的关系 |
|---|---|---|
| 官方技能标杆 | Anthropic `pptx` skill（anthropics/skills，claude.ai 文件能力同源） | 验收方法论天花板；经历 v1(html2pptx+Playwright 实测布局) → v2(直写 pptxgenjs + footgun 清单) 架构换代 |
| DSH 同生态竞品 | dsh-ppt-fusion、dsh-ppt(STARDUSTLC666)、@cola1900/dsh-ppt、open-kimi-ppt-skill、dsh-ppt-studio、dsh-np-ppt | 2026.8–10 密集发布的直接竞品带（npm） |
| 开源/学术 agent | Presenton(11k★)、PPTAgent(5k★, EMNLP→ACL)、Memslides(1k★)、AutoPresent(CVPR 2025) | 机制来源：布局检索、局部补丁修改、PPTEval 评分闭环、SlidesBench 基准 |
| 商用 AI PPT | Gamma、Copilot in PowerPoint、Canva、Kimi PPT 助手、WPS AI、讯飞智文、AiPPT、百度文库 | 终端用户心智基线（大纲确认流、智能配图、模板市场） |

## 二、能力横比矩阵（本插件 vs 各阵营最强）

| 维度 | dsh-super-ppts | 最强同类 | 判定 |
|---|---|---|---|
| 任务工作流 | ✅✅ 侧边栏面板 + 状态机 + 大纲闸门 + 素材通道 | 同生态全部空白；商用 Gamma/Kimi 有大纲确认流 | **独有领先** |
| 交付形态 | ✅✅ PPTX + 单文件 HTML 8 形态 | dsh-ppt 三件套（HTML+PPTX+工程文件）；OpenDesign 加 MP4 | 基本打平 |
| 渲染验收 | ✅ PPTX→PDF→PNG 视觉复核 | fusion：渲染门禁+看图自评+ΔE；Claude：内容/文件/视觉三级 QA + XSD | **落后半代** |
| 图表 | ⚠️ 引擎有 bar_chart/svg_chart，技能线无纪律 | Claude「能原生不落图」纪律 + 防 corrupt 细则；同生态 4+ 竞品出原生图表 | **P0** |
| 图片 | ⚠️ 引擎有 fetch_image 钩子，技能线无策略 | 官方 ppt_search_image(Wikimedia)、fusion 三通道+署名、商用生图+图库 | **P0** |
| 模板 | ✅ 用户库 + 4 内置 + 偏好持久化 | @cola1900 192 版式 + dock 选模板；open-kimi 30 主题 | 数量不拼，缺版式级选择（P1） |
| 动效 | ⚠️ 混合交付 Phase 1（GIF 嵌入） | fusion 入场动画/切换/旁白翻页；open-kimi 内嵌字体+切换 | **P0** |
| 编辑回改 | ⚠️ Build Mode 脚本可重跑；面板可提交修改 | Memslides 局部补丁；WPS 单页重生成 | P1 |
| 中文排版 | ⚠️ design-tokens 有字体栈，无避头尾/标点挤压专项 | WPS/Kimi 公认优势；Claude skill 零 CJK 指导（可攻点） | P1 |
| 隐私/部署 | ✅✅ 零依赖零端口、数据不出本机 | 商用全 SaaS；部分竞品起本地端口（55173 编辑器） | **独有领先** |

## 三、P0 差距（≥2 个直接竞品已有 + 插件可自行补齐）

1. **文件级结构校验 + 内容 QA**：当前验收纯视觉。Claude skill 的三级 QA
   （内容 grep 占位符 / OOXML 结构机检 / 视觉）中我们缺前两级。
2. **原生图表纪律 + 数据管线**：引擎组件已在库中，缺「原生 chart 组件 →
   svg_chart → 自绘形状」决策树、素材 CSV/Excel→图表管线、图表防坑清单。
3. **图片三级策略**：用户素材（任务通道已在）→ fetch_image/生图 → CC 检索
   + 署名清单 → CSS/SVG 自绘。没有图的 deck 视觉完成度天花板低（商用调研
   排名第一的用户价值）。
4. **PPTX 切换/动效写入**：页间 Fade 切换是低垂果实（PML 1st edition
   `<p:transition>` 全版本兼容）；open-kimi/fusion 均有。
5. **PDF 一等交付闭环**：交付包已列 PDF、产物登记已支持 pdf 类型，缺
   技能线强制语义与 ppts_task 登记接线。

## 四、P1 差距（高价值、中成本）

6. 模板版式网格预览（Claude `thumbnail.py` 式带索引网格图，VI Build 按图选版式）
7. 演讲者备注/演讲稿生成（讯飞/WPS/百度文库标配；`addNotes` 低成本）
8. HTML 线导出 PDF/PNG（shot.js 已在，接 Playwright 即得）
9. CJK 排版专项（避头尾、标点挤压、字重层级 → design-tokens.md）
10. 验收循环「只重渲改动页」+ 按 id 局部重跑硬规则（Memslides 证明改 A 坏 B 是最大痛点）

## 五、P2 差距（战略/形态级）

11. 参考图 → 可编辑 PPT 重建（visual-to-editable-ppt-skill 方向，第三技能线）
12. 偏好记忆升级（styleNotes 静态备注 → 跨任务画像；大纲修改历史是天然数据源）
13. 小型回归评测集（SlidesBench/PPTEval 思路，5–10 个固定 brief）
14. 分发面：awesome-dsh-plugins 收录、dsh.pub / dsh.deepseek404.com 上架、dshmarket

## 六、定位护栏（不跟进项）

海量模板市场、在线协作、观看分析、手机遥控是 SaaS 形态护城河，与
「本地生成、数据不出本机、开发者可编程」定位相悖（Tome 2025 关停佐证纯
托管演示形态的生存风险；Plus AI 的 API/MCP 路线佐证宿主插件形态可行）。
README 应显性化四个独有卖点：隐私、零依赖、任务面板人在环、HTML 8 形态。
