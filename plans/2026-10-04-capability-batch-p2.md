# dsh-super-ppts 能力补齐批次 P2（对标整改收官）

**Goal:** 消除对标清单（[`docs/benchmarks/2026-10-04-competitive-landscape.md`](../docs/benchmarks/2026-10-04-competitive-landscape.md) §五）的 4 项 P2 差距。与 P0/P1（[`plans/2026-10-04-pptx-capability-batch-p0.md`](2026-10-04-pptx-capability-batch-p0.md)、[`plans/2026-10-04-capability-batch-p1.md`](2026-10-04-capability-batch-p1.md)，均已实机验证）同一发布口径 **1.5.0**。

**依据:** P0/P1 实机回归通过；P2 是对标清单收官批，其中 11/12 动 host 或新增技能线，13/14 纯文档面。

**状态:** P2 批次完成；build + smoke 全绿（新增 history 聚合断言）。P2-14 的两处外部提交（awesome-dsh-plugins / dsh.pub PR）文案已备好、等用户账号执行（dsh.pub 已核查：未收录，提交走 GitHub PR + 自动契约检查）。待用户实机验证 11/12 后随 1.5.0 发布。

---

## 一、任务清单

| # | 任务 | 落点 | 对标来源 |
|---|---|---|---|
| 11 | **参考图 → 可编辑 PPT 重建（第三技能线）**：用户给截图/参考图要求「复刻/还原为可编辑 PPT」——元素盘点 → Build Mode 重建（原生文本/形状；位图类裁剪嵌入）→ 渲染并排对比 → 逐元素对账三轮修订 | `skills/ppts-rebuild/`（新技能线：SKILL.md + references）+ `SUPER_PPTS_GUIDANCE` 通告第三形态 + README | visual-to-editable-ppt-skill（yjm110517）；Memslides 局部修订思想 |
| 12 | **偏好记忆（生成画像）**：`ppts_templates` 新增 `action=history`——聚合任务库返回画像（总量/成败、形态与模板分布、风格关键词、大纲返工率、最近主题），Brief 确认时作默认值提案 | `src/tasks.ts`（summarizeHistory）+ `src/tools.ts`（history action）+ 通告一句 + 冒烟 | Memslides 三层记忆；Presenton Mem0 |
| 13 | **回归评测集**：10 条固定 brief + PPTEval 式三维评分细则（内容保真/视觉/一致性 0-2 分），供发版前自评与技能线改动回归 | `docs/benchmarks/regression-briefs.md`（新）+ ppts-pptx SKILL.md 引用 | SlidesBench/PPTEval/PresentEval |
| 14 | **分发面准备**：收录提交文案 + 渠道清单（awesome-dsh-plugins PR、dsh.pub / dsh.deepseek404.com 收录核查、dshmarket） | `docs/distribution.md`（新）；实际提交由用户执行 | 同生态竞品普遍已进目录 |

## 二、设计决定

1. **重建线是 ppts-pptx 的姊妹线而不是新交付形态**：产物仍是可编辑 PPTX，
   复用同一套验收纪律（validate 机检 + 渲染门）；区别在输入（参考图而非
   Brief）与质量标准（逐元素对账 = 结构还原度）。通告里作为第 3 条交付线
   一句话提及，不扩写（提示词体积纪律）。
2. **图片元素的处理红线**：参考图里的照片/复杂插画 = 裁剪原图嵌入（附
   `--in-place` 语义说明）；图标/几何装饰 = 原生形状重绘；**整页贴图是
   底线违例**（重建的意义就是可编辑）。
3. **history 聚合有界**：只读索引 Top 30（按 updatedAt）的任务记录，聚合
   纯内存计算；风格关键词不搞分词——直接收集 `brief.style` 取值 + 去重的
   `styleNotes`（最新在前，截断 5 条），CJK 分词留给以后。
4. **评测集是文档协议而非可执行 runner**：生成主体是 agent 本身，全自动
   评分（VLM 打分）超出插件边界；10 条 brief 固定 + 三维 0-2 分细则 +
   发版前人工/agent 自评流程。冒烟不接（无生成引擎依赖可断言）。
5. **分发面只准备不执行**：目录站收录、PR 提交需要用户账号；插件侧产出
   即拿即用的提交文案与核查清单。

## 三、验收

- [x] `npm run build` + `npm run smoke` 全绿（`ppts_templates history` 画像聚合断言 PASS）
- [ ] 实机：参考图重建一次（给一张截图说「复刻成可编辑 PPT」）；history 画像在第二次制作时被 agent 主动参考（**host 侧改动，需重启桌面端生效**）
- [ ] P2-14 外部提交（用户执行）：awesome-dsh-plugins PR、dsh.pub PR（文案见 [`docs/distribution.md`](../docs/distribution.md)）
- [ ] 与 P0/P1 合并走 1.5.0 发布链（用户节奏）
