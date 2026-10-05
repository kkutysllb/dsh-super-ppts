# dsh-super-ppts PPTX 线能力补齐批次 P0（对标整改）

**Goal:** 消除横向对标（[`docs/benchmarks/2026-10-04-competitive-landscape.md`](../docs/benchmarks/2026-10-04-competitive-landscape.md)）中的 5 项 P0 差距，全部落在技能层与脚本层——host 侧零改动、client 侧零改动、零新依赖红线不破。版本口径：**1.5.0**（1.4.6 已被 peer 兼容门修复占用，commit 9477128；本批与 host 安全整改 M1–M5 合并为同一个 minor 发布——content-type 契约收紧属行为变化，minor 更诚实）。

**依据:** 四路联网对标（2026-10-04）+ 现状盘点：引擎已有 `bar_chart/comparison_bars/svg_chart`（`pptx_designer.tools.charts`）与 `fetch_image` 钩子、交付包已列 PDF、产物登记已支持 `pdf` 类型——P0 落点是「技能线纪律与闭环」，不是造新引擎能力。

**状态:** P0 批次代码 + 技能文档 + 冒烟（10 项新断言）完成，全绿；待实机回归（一次真实生成任务走完整闭环）后随 1.5.0 发布。

---

## 一、任务清单

| # | 任务 | 落点 | 对标来源 |
|---|---|---|---|
| A | **结构校验 + 内容 QA**：新脚本 `validate_pptx.py`（zip/OOXML 完整性、必要部件、rels 闭合、python-pptx 重开、占位符扫描），接入验收循环 | `skills/ppts-pptx/scripts/validate_pptx.py`（新）+ SKILL.md 第 6 步 + review-and-delivery.md | Claude skill 三级 QA（内容/文件/视觉）；fusion 八源审计门 |
| B | **原生图表纪律**：「原生 chart 组件 → svg_chart → 自绘形状」决策树、素材 CSV/Excel→图表数据管线、图表防坑清单 | `references/content-and-api.md` 新增「数据与图表」章节 + SKILL.md 第 5 步提及 | Claude「能原生不落图」纪律；Canva 数据→图表一等公民；同生态 4+ 竞品原生图表标配 |
| C | **图片三级策略**：用户素材优先 → `fetch_image`/生图 → CC 检索 + 署名清单 → CSS/SVG 自绘兜底；验收表加署名检查 | `references/content-and-api.md` 图片章节 + SKILL.md Brief「图片政策」激活 | 官方 ppt_search_image；fusion 署名合规门；商用智能配图（价值第一） |
| D | **切换/动效写入**：新脚本 `add_transitions.py`（PML 1st edition `<p:transition>`，fade/push/wipe/cut + 可选自动翻页），混合交付章节加 Phase 0 | `skills/ppts-pptx/scripts/add_transitions.py`（新）+ SKILL.md 混合交付章节 | open-kimi 切换+内嵌字体；fusion 入场动画/旁白翻页（入场动画留 Phase 2） |
| E | **交付闭环强化**：交付级任务强制「PPTX + PDF 副本双登记」（ppts_task artifact×2），验收循环改「修完只重渲改动页」 | review-and-delivery.md 交付包 + SKILL.md 第 6/7 步 | dsh-ppt PDF 导出；Claude「只重渲改动页」 |

**刻意不做（本轮）**：P1/P2 全部项（见对标文档 §四/§五）；host 侧 `ppts_check` 报告扩展（validate 脚本经技能线调用，不加工具）；client/面板改动（零）。

## 二、设计决定

1. **validate 不捆绑 ISO-29500 XSD**（体积不可接受）：机检分层 = zip 完整性
   （EOCD + CRC）→ 必要部件在场 → presentation/slide rels 引用闭包 →
   python-pptx 重开（页数/shape 计数/文本可读）→ 内容 QA（lorem/TODO/
   `[insert`/待补充 等占位符正则）。覆盖「LibreOffice 能开、PowerPoint 报
   损坏」的主因（rels 悬空、部件缺失、坏 zip），不追求 XSD 全量合规。
2. **切换写入只用 PML 1st edition 元素**（`<p:transition><p:fade/></p:transition>`）：
   PowerPoint 2007+ / WPS / LibreOffice 全兼容，不碰 `p14:` 扩展（AlternateContent
   复杂度与兼容注册表成本不成比例）。入场动画（`<p:timing>`）留 Phase 2。
3. **触发纪律沿用混合交付既有硬规则**：切换/动效仅当 Brief 显式声明
   （「要动效/要切换/自动翻页」）才启用，默认纯静态——防止 agent 自作主张。
4. **PDF 双登记是技能线语义**：不加偏好项、不动 client——渲染验收本来
   就产 PDF，交付包章节把它从「可选项」升级为「交付级任务必登记」，经
   `ppts_task action=artifact artifactType=pdf` 与 PPTX 并列。
5. **冒烟**：仿 embed_animation 测试形态（python3+python-pptx 在场才跑，
   缺则 SKIP 不计失败）：python-pptx 造最小 deck → validate PASS；删 slide
   部件 → FAIL；add_transitions 写入 → zip 内可见 `<p:transition>` 且 validate 仍 PASS。

## 三、验收

- [x] `npm run build`（tsc）通过（host 源码零改动；lib 差异均为安全批次既有产物）
- [x] `npm run smoke` 全绿（新增「5b. 结构校验 + 切换写入」10 项断言，纯标准库夹具，python3 缺席自动 SKIP）
- [x] `validate_pptx.py --selftest` 内建自检 PASS
- [x] 脚本手工端到端验证：干净包 PASS / 占位符 FAIL / 悬空 rels FAIL / fade 写入 / 页码选择器+自动翻页 / 幂等覆盖 / 写入后 validate 仍 PASS
- [x] 实机：DSH 原生桌面端（DeepSeek Harness，link 安装）回归通过——设置页/面板全流程/大纲闸门/PPTX+PDF 双登记/原生图表/validate 机检/切换写入（2026-10-04 用户实测）
- [ ] 发布链：release/v1.5.0.md（含安全整改 M1–M5 + 本批 P0 + P1 批次）→ tag → npm publish → sync:mirror（**验证虽过，发布仍待 P1 完成后统一定**）

## 四、遗留（后续批次）

- P1：模板版式网格预览、演讲备注、HTML 导出 PDF/PNG、CJK 排版专项、只重渲改动页（E 已带出一半）
- P2：参考图重建技能线、偏好画像、回归评测集、目录上架
- 工具描述/系统提示词瘦身（0.1.7-rc.2 计划遗留，措辞级独立工作）
