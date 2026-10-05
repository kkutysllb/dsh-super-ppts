/**
 * 内置模板元数据（插件自带，随版本分发）。
 *
 * 立场：
 * - 本模块是内置模板的唯一真源（零 npm 依赖的纯数据模块）；
 * - 提供元数据：名称 / 描述 / 适用场景 / 标签 / 色板强调色 + **缩略样张**，
 *   供面板与 Agent 共用同一份口径。**不下发 .pptx 基底**——内置模板
 *   的版式由技能线（skills/ppts-pptx）按大纲生成，而不是套一份固定 deck；
 * - 缩略图双层（2026-10-04 起）：面板顶层用**真 deck 首页截图**
 *   （assets/builtin-thumbs/<id>.jpg，由 scripts/build-builtin-decks.py 生成的
 *   单页样例 deck 经 soffice 渲染，经 /super-ppts/templates/builtin-thumb 路由
 *   下发，404 时回落）；thumbSvg 是按各模板 VI 手绘的 16:9 设计示意
 *   （SVG 源码，viewBox 320×180）——真图缺失时的兜底层，再失败回退 accent
 *   色块。Agent 侧忽略缩略图字段（只读元数据语义）。绘制语法统一：真实感
 *   标题文案 + 按模板 VI 的内容区示意（KPI 卡 / 曲线 / 流程 / 图文分栏）；
 *   方向扩到 16 个（对齐同生态最大模板面竞品），方向迭代时同步重跑生成器；
 * - 与用户上传模板的区别用 source 字段显式表达（'builtin' | 'user'），
 *   面板据此分组，禁止把两类混进一个无来源标识的列表。
 */
/** 公共字体栈（SVG text 统一使用；data URI 内引号经 encodeURIComponent 转义）。 */
const FONT = `font-family="system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif"`;
/** 高管经营汇报：深藏蓝底 · 结论大标题 · 三张 KPI 数据卡（克制、数据优先）。 */
const THUMB_EXEC_REVIEW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#1b2f57"/>
<rect width="320" height="4" fill="#3b5fd9"/>
<text x="24" y="36" fill="#8fa8d9" font-size="10" ${FONT}>Q3 经营复盘 · 管理层汇报</text>
<text x="24" y="66" fill="#ffffff" font-size="19" font-weight="700" ${FONT}>收入同比增长 18%</text>
<rect x="24" y="84" width="86" height="52" rx="6" fill="rgba(255,255,255,0.08)"/>
<text x="36" y="110" fill="#ffffff" font-size="16" font-weight="700" ${FONT}>+18%</text>
<text x="36" y="126" fill="#8fa8d9" font-size="9" ${FONT}>营业收入</text>
<rect x="118" y="84" width="86" height="52" rx="6" fill="rgba(255,255,255,0.08)"/>
<text x="130" y="110" fill="#ffb020" font-size="16" font-weight="700" ${FONT}>-2.4pt</text>
<text x="130" y="126" fill="#8fa8d9" font-size="9" ${FONT}>利润率</text>
<rect x="212" y="84" width="84" height="52" rx="6" fill="rgba(255,255,255,0.08)"/>
<text x="224" y="110" fill="#4cc38a" font-size="16" font-weight="700" ${FONT}>+32%</text>
<text x="224" y="126" fill="#8fa8d9" font-size="9" ${FONT}>华东区域</text>
<rect x="24" y="152" width="40" height="3" fill="#3b5fd9"/>
<text x="72" y="157" fill="#5d729c" font-size="9" ${FONT}>结论先行 · 数据优先 · 克制表达</text>
</svg>`;
/** 产品发布演示：近黑底 · 左大字右产品剪影 · 强调色 CTA（强视觉、少文字）。 */
const THUMB_PRODUCT_LAUNCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<defs>
<linearGradient id="pl-screen" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#ff7a45"/><stop offset="100%" stop-color="#c81e3c"/>
</linearGradient>
</defs>
<rect width="320" height="180" fill="#0e0e12"/>
<text x="28" y="64" fill="#ffffff" font-size="21" font-weight="700" ${FONT}>重新定义</text>
<text x="28" y="90" fill="#ffffff" font-size="21" font-weight="700" ${FONT}>工作方式</text>
<rect x="28" y="102" width="36" height="3" fill="#e5484d"/>
<text x="28" y="124" fill="#9a9aa6" font-size="9" ${FONT}>一场发布会 · 一件新品 · 三个卖点</text>
<rect x="28" y="140" width="64" height="18" rx="9" fill="#e5484d"/>
<text x="60" y="152" fill="#ffffff" font-size="8" text-anchor="middle" ${FONT}>立即体验</text>
<rect x="206" y="28" width="76" height="124" rx="12" fill="#17171d" stroke="#2e2e38"/>
<rect x="214" y="40" width="60" height="90" rx="6" fill="url(#pl-screen)"/>
<rect x="234" y="32" width="20" height="4" rx="2" fill="#2e2e38"/>
<rect x="236" y="134" width="16" height="10" rx="3" fill="#2e2e38"/>
<text x="160" y="172" fill="#3c3c46" font-size="7" text-anchor="middle" ${FONT}>KEYNOTE · PRODUCT LAUNCH</text>
</svg>`;
/** 技术架构分享：浅色底 · 左侧品牌竖条与标题 · 右侧三节点调用链路图。 */
const THUMB_TECH_SHARING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#f4f7f5"/>
<rect width="6" height="180" fill="#1f8a70"/>
<text x="24" y="40" fill="#155e4d" font-size="17" font-weight="700" ${FONT}>技术架构分享</text>
<text x="24" y="58" fill="#6b8a80" font-size="9" ${FONT}>架构图与流程为主 · 方案讲解与评审</text>
<rect x="24" y="92" width="70" height="32" rx="5" fill="#ffffff" stroke="#1f8a70"/>
<text x="59" y="111" fill="#155e4d" font-size="10" text-anchor="middle" ${FONT}>客户端</text>
<rect x="126" y="92" width="70" height="32" rx="5" fill="#ffffff" stroke="#1f8a70"/>
<text x="161" y="111" fill="#155e4d" font-size="10" text-anchor="middle" ${FONT}>网关</text>
<rect x="228" y="92" width="70" height="32" rx="5" fill="#e6f4f0" stroke="#1f8a70"/>
<text x="263" y="111" fill="#155e4d" font-size="10" text-anchor="middle" ${FONT}>服务集群</text>
<path d="M94 108 L124 108" stroke="#1f8a70" stroke-width="1.5"/>
<path d="M120 104 L126 108 L120 112 Z" fill="#1f8a70"/>
<path d="M196 108 L226 108" stroke="#1f8a70" stroke-width="1.5"/>
<path d="M222 104 L228 108 L222 112 Z" fill="#1f8a70"/>
<text x="24" y="158" fill="#8aa39b" font-size="9" ${FONT}>分层架构 · 调用链路 · 关键决策点</text>
</svg>`;
/** 教学课件：暖白底 · 顶部章节标题条 · 左编号列表 + 右图示循环（由浅入深）。 */
const THUMB_TEACHING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#fbf6ec"/>
<rect width="320" height="34" fill="#c8871a"/>
<text x="20" y="22" fill="#ffffff" font-size="13" font-weight="700" ${FONT}>第 3 讲 · 循环结构</text>
<text x="24" y="64" fill="#c8871a" font-size="11" font-weight="700" ${FONT}>01</text>
<text x="48" y="64" fill="#4a3a1a" font-size="11" ${FONT}>认识循环</text>
<text x="24" y="88" fill="#c8871a" font-size="11" font-weight="700" ${FONT}>02</text>
<text x="48" y="88" fill="#4a3a1a" font-size="11" ${FONT}>循环三要素</text>
<text x="24" y="112" fill="#c8871a" font-size="11" font-weight="700" ${FONT}>03</text>
<text x="48" y="112" fill="#4a3a1a" font-size="11" ${FONT}>动手练习</text>
<circle cx="236" cy="72" r="15" fill="#c8871a" opacity="0.9"/>
<circle cx="272" cy="96" r="15" fill="#c8871a" opacity="0.7"/>
<circle cx="236" cy="120" r="15" fill="#c8871a" opacity="0.5"/>
<circle cx="200" cy="96" r="15" fill="#c8871a" opacity="0.35"/>
<path d="M248 82 L262 88" stroke="#8a6212" stroke-width="1.5"/>
<path d="M266 110 L252 116" stroke="#8a6212" stroke-width="1.5"/>
<path d="M204 110 L218 84" stroke="#8a6212" stroke-width="1.5"/>
<text x="290" y="166" fill="#b09a6a" font-size="9" ${FONT}>03</text>
</svg>`;
/** 融资路演：深紫底 · 金色增长曲线 · 里程碑轴（增长叙事）。 */
const THUMB_BP_ROADSHOW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#241a3e"/>
<text x="24" y="32" fill="#d4a24e" font-size="9" letter-spacing="2" ${FONT}>BUSINESS PLAN · 2026</text>
<text x="24" y="60" fill="#ffffff" font-size="19" font-weight="700" ${FONT}>市场规模与增长路径</text>
<polyline points="28,138 76,128 124,132 172,108 220,84 268,52" fill="none" stroke="#d4a24e" stroke-width="2"/>
<path d="M28 138 L76 128 L124 132 L172 108 L220 84 L268 52 L268 156 L28 156 Z" fill="rgba(212,162,78,0.12)"/>
<circle cx="172" cy="108" r="3.5" fill="#241a3e" stroke="#d4a24e" stroke-width="2"/>
<circle cx="268" cy="52" r="3.5" fill="#d4a24e"/>
<text x="28" y="170" fill="#8d80b8" font-size="8" ${FONT}>TAM 92亿</text>
<text x="130" y="170" fill="#8d80b8" font-size="8" ${FONT}>种子轮 → A 轮 → 盈利</text>
<text x="292" y="30" fill="#d4a24e" font-size="12" font-weight="700" text-anchor="end" ${FONT}>×6.8</text>
</svg>`;
/** 工作周报：浅灰蓝底 · 本周进展清单 + 完成率数据卡（职场克制）。 */
const THUMB_WEEKLY_REPORT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#f5f7fa"/>
<text x="24" y="36" fill="#1f2937" font-size="16" font-weight="700" ${FONT}>第 40 周工作汇报</text>
<text x="24" y="54" fill="#8892a4" font-size="9" ${FONT}>进展 · 数据 · 下周计划</text>
<circle cx="30" cy="76" r="4" fill="#3b82f6"/>
<text x="42" y="80" fill="#374151" font-size="10" ${FONT}>上线灰度发布流程 v2</text>
<circle cx="30" cy="98" r="4" fill="#3b82f6"/>
<text x="42" y="102" fill="#374151" font-size="10" ${FONT}>完成三份客户访谈纪要</text>
<circle cx="30" cy="120" r="4" fill="#93c5fd"/>
<text x="42" y="124" fill="#6b7280" font-size="10" ${FONT}>排查构建耗时回归（进行中）</text>
<rect x="212" y="64" width="84" height="64" rx="8" fill="#ffffff" stroke="#dbe2ec"/>
<text x="254" y="94" fill="#3b82f6" font-size="18" font-weight="700" text-anchor="middle" ${FONT}>86%</text>
<text x="254" y="112" fill="#8892a4" font-size="8" text-anchor="middle" ${FONT}>本周任务完成率</text>
<rect x="24" y="140" width="120" height="4" rx="2" fill="#dbe2ec"/>
<rect x="24" y="140" width="103" height="4" rx="2" fill="#3b82f6"/>
<text x="24" y="162" fill="#8892a4" font-size="8" ${FONT}>下周：发布复盘 · 季度 OKR 对齐</text>
</svg>`;
/** 市场营销方案：白底 · 品红橙渐变 · 四步活动漏斗（节奏感强）。 */
const THUMB_MARKETING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<defs>
<linearGradient id="mk-band" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#e64560"/><stop offset="100%" stop-color="#f59e0b"/>
</linearGradient>
</defs>
<rect width="320" height="180" fill="#ffffff"/>
<rect width="320" height="6" fill="url(#mk-band)"/>
<text x="24" y="44" fill="#111827" font-size="18" font-weight="700" ${FONT}>618 大促整合营销方案</text>
<text x="24" y="62" fill="#9ca3af" font-size="9" ${FONT}>种草 → 转化 → 复购 · 全域节奏</text>
<rect x="24" y="80" width="60" height="52" rx="8" fill="url(#mk-band)" opacity="0.9"/>
<text x="54" y="103" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle" ${FONT}>曝光</text>
<text x="54" y="118" fill="#ffffff" font-size="8" text-anchor="middle" ${FONT}>2.4 亿</text>
<rect x="96" y="80" width="60" height="52" rx="8" fill="#e64560" opacity="0.75"/>
<text x="126" y="103" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle" ${FONT}>种草</text>
<text x="126" y="118" fill="#ffffff" font-size="8" text-anchor="middle" ${FONT}>CTR 4.2%</text>
<rect x="168" y="80" width="60" height="52" rx="8" fill="#f59e0b" opacity="0.75"/>
<text x="198" y="103" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle" ${FONT}>转化</text>
<text x="198" y="118" fill="#ffffff" font-size="8" text-anchor="middle" ${FONT}>GMV 目标</text>
<rect x="240" y="80" width="56" height="52" rx="8" fill="#fef3c7"/>
<text x="268" y="103" fill="#b45309" font-size="12" font-weight="700" text-anchor="middle" ${FONT}>复购</text>
<text x="268" y="118" fill="#b45309" font-size="8" text-anchor="middle" ${FONT}>+18%</text>
<text x="24" y="158" fill="#9ca3af" font-size="8" ${FONT}>节点排期 · 预算分配 · 达人矩阵 · 风险预案</text>
</svg>`;
/** 深色数据大屏：近黑底网格 · 荧光青大数字与实时曲线（作战室氛围）。 */
const THUMB_DARK_DASHBOARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#0a0f1c"/>
<path d="M0 45 H320 M0 90 H320 M0 135 H320" stroke="#16203a" stroke-width="1"/>
<path d="M80 0 V180 M160 0 V180 M240 0 V180" stroke="#16203a" stroke-width="1"/>
<text x="24" y="30" fill="#22d3ee" font-size="8" letter-spacing="2" ${FONT}>REALTIME OPS</text>
<text x="24" y="56" fill="#ffffff" font-size="16" font-weight="700" ${FONT}>双 11 实时作战室</text>
<text x="24" y="102" fill="#22d3ee" font-size="26" font-weight="700" ${FONT}>128.4万</text>
<text x="24" y="120" fill="#5b6b8c" font-size="9" ${FONT}>实时成交订单</text>
<polyline points="150,120 178,104 206,112 234,88 262,92 296,64" fill="none" stroke="#22d3ee" stroke-width="2"/>
<circle cx="296" cy="64" r="3" fill="#22d3ee"/>
<rect x="150" y="132" width="70" height="26" rx="6" fill="#0f1830" stroke="#1d2a4a"/>
<text x="185" y="149" fill="#8ea3cc" font-size="8" text-anchor="middle" ${FONT}>支付成功率 99.2%</text>
<rect x="228" y="132" width="70" height="26" rx="6" fill="#0f1830" stroke="#1d2a4a"/>
<text x="263" y="149" fill="#8ea3cc" font-size="8" text-anchor="middle" ${FONT}>峰值 QPS 42万</text>
</svg>`;
/** 极简主义：纯白大留白 · 黑字细线 · 单点强调红（减法设计）。 */
const THUMB_MINIMAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#ffffff"/>
<text x="32" y="72" fill="#111111" font-size="24" font-weight="700" ${FONT}>少，即是多。</text>
<text x="32" y="96" fill="#9ca3af" font-size="9" ${FONT}>极简主义设计方向 · 留白即内容</text>
<rect x="32" y="116" width="256" height="1" fill="#e5e7eb"/>
<text x="32" y="140" fill="#6b7280" font-size="9" ${FONT}>Design Review · 2026 Q4</text>
<circle cx="284" cy="140" r="6" fill="#e11d48"/>
</svg>`;
/** 学术答辩：米白底 · 院校蓝顶栏 · 章节框与论文信息（严谨衬线感）。 */
const THUMB_ACADEMIC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#f8f6f1"/>
<rect width="320" height="30" fill="#1e3a5f"/>
<text x="160" y="20" fill="#ffffff" font-size="10" text-anchor="middle" letter-spacing="1" ${FONT}>硕士学位论文答辩</text>
<text x="24" y="62" fill="#1e3a5f" font-size="15" font-weight="700" ${FONT}>基于多智能体协同的关键技术研究</text>
<text x="24" y="82" fill="#8a8577" font-size="9" ${FONT}>答辩人：李某某 · 导师：王某某 教授 · 2026 年 6 月</text>
<rect x="24" y="100" width="86" height="42" rx="6" fill="#ffffff" stroke="#1e3a5f" stroke-width="0.8"/>
<text x="67" y="125" fill="#1e3a5f" font-size="10" text-anchor="middle" ${FONT}>研究背景</text>
<rect x="117" y="100" width="86" height="42" rx="6" fill="#ffffff" stroke="#1e3a5f" stroke-width="0.8"/>
<text x="160" y="125" fill="#1e3a5f" font-size="10" text-anchor="middle" ${FONT}>方法与实验</text>
<rect x="210" y="100" width="86" height="42" rx="6" fill="#eef2f8" stroke="#1e3a5f" stroke-width="0.8"/>
<text x="253" y="125" fill="#1e3a5f" font-size="10" text-anchor="middle" ${FONT}>结论与展望</text>
<text x="24" y="166" fill="#b3ad9d" font-size="8" ${FONT}>章节严谨 · 引用规范 · 图表编号</text>
</svg>`;
/** 杂志编辑风：米白底 · 超大衬线标题 · 图文两栏（内容叙事）。 */
const THUMB_EDITORIAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#faf7f2"/>
<text x="24" y="52" fill="#111111" font-size="26" font-weight="700" ${FONT}>城市观察</text>
<rect x="24" y="64" width="22" height="3" fill="#d9a441"/>
<text x="268" y="40" fill="#d9a441" font-size="9" letter-spacing="2" text-anchor="end" ${FONT}>VOL.12</text>
<rect x="24" y="86" width="110" height="8" rx="4" fill="#e2ddd2"/>
<rect x="24" y="102" width="96" height="8" rx="4" fill="#e2ddd2"/>
<rect x="24" y="118" width="104" height="8" rx="4" fill="#e2ddd2"/>
<rect x="24" y="134" width="72" height="8" rx="4" fill="#e2ddd2"/>
<rect x="168" y="80" width="128" height="70" rx="4" fill="#e8d9b8"/>
<circle cx="232" cy="106" r="18" fill="#d9a441" opacity="0.85"/>
<path d="M168 150 L296 150" stroke="#111111" stroke-width="1"/>
<text x="24" y="166" fill="#a39a88" font-size="8" ${FONT}>深度 · 长文 · 图文分栏</text>
<text x="296" y="166" fill="#a39a88" font-size="8" text-anchor="end" ${FONT}>P.24</text>
</svg>`;
/** 医疗健康：白底青绿 · 圆角指标卡与柔和曲线（专业且温和）。 */
const THUMB_HEALTHCARE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#f0faf9"/>
<text x="24" y="38" fill="#0f766e" font-size="16" font-weight="700" ${FONT}>个人健康月报</text>
<text x="24" y="56" fill="#6b9c97" font-size="9" ${FONT}>9 月 · 体征趋势与建议</text>
<rect x="24" y="72" width="86" height="46" rx="8" fill="#ffffff" stroke="#bfe3df"/>
<text x="38" y="94" fill="#0e9488" font-size="13" font-weight="700" ${FONT}>72 bpm</text>
<text x="38" y="109" fill="#6b9c97" font-size="8" ${FONT}>静息心率</text>
<rect x="118" y="72" width="86" height="46" rx="8" fill="#ffffff" stroke="#bfe3df"/>
<text x="132" y="94" fill="#0e9488" font-size="13" font-weight="700" ${FONT}>7.5 h</text>
<text x="132" y="109" fill="#6b9c97" font-size="8" ${FONT}>平均睡眠</text>
<rect x="212" y="72" width="84" height="46" rx="8" fill="#0e9488"/>
<text x="226" y="94" fill="#ffffff" font-size="13" font-weight="700" ${FONT}>达标 92%</text>
<text x="226" y="109" fill="#c7ece8" font-size="8" ${FONT}>运动目标</text>
<polyline points="24,150 60,144 96,148 132,138 168,142 204,132 240,136 276,126" fill="none" stroke="#0e9488" stroke-width="2" opacity="0.7"/>
</svg>`;
/** 政务汇报：米白底 · 红头金线顶栏 · 金色方块要点（庄严规范）。 */
const THUMB_GOVERNMENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#fbf5ef"/>
<rect width="320" height="44" fill="#c7351f"/>
<rect y="44" width="320" height="3" fill="#d9a24e"/>
<text x="160" y="27" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle" ${FONT}>全市数字化转型工作汇报</text>
<text x="24" y="78" fill="#8c1f10" font-size="16" font-weight="700" ${FONT}>聚焦实干 · 数据说话</text>
<rect x="24" y="94" width="8" height="8" fill="#d9a24e"/>
<text x="42" y="102" fill="#4a3a2a" font-size="10" ${FONT}>一网通办覆盖率达 92%</text>
<rect x="24" y="114" width="8" height="8" fill="#d9a24e"/>
<text x="42" y="122" fill="#4a3a2a" font-size="10" ${FONT}>政务云迁移完成三级等保测评</text>
<rect x="24" y="134" width="8" height="8" fill="#d9a24e"/>
<text x="42" y="142" fill="#4a3a2a" font-size="10" ${FONT}>惠企政策直达 12 万家市场主体</text>
<text x="24" y="166" fill="#b09a72" font-size="8" ${FONT}>红头风格 · 规范格式 · 严谨表述</text>
</svg>`;
/** 电商大促复盘：深紫底 · 橙粉渐变漏斗条（大数字节奏）。 */
const THUMB_ECOMMERCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#2d1b52"/>
<rect x="24" y="24" width="72" height="18" rx="9" fill="#f59e0b"/>
<text x="60" y="36" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle" ${FONT}>双 11 复盘</text>
<text x="24" y="70" fill="#ffffff" font-size="17" font-weight="700" ${FONT}>GMV 3.2 亿 · 同比 +47%</text>
<text x="24" y="88" fill="#b8a6e0" font-size="9" ${FONT}>全渠道成交 · 履约准时率 98.6%</text>
<rect x="24" y="104" width="200" height="10" rx="5" fill="#f59e0b"/>
<text x="232" y="113" fill="#fcd9a8" font-size="8" ${FONT}>支付 3.2 亿</text>
<rect x="24" y="122" width="150" height="10" rx="5" fill="#ec4899"/>
<text x="182" y="131" fill="#f9c0d8" font-size="8" ${FONT}>下单 4.1 亿</text>
<rect x="24" y="140" width="100" height="10" rx="5" fill="#8b5cf6"/>
<text x="132" y="149" fill="#c9b4f2" font-size="8" ${FONT}>加购 6.8 亿</text>
<text x="296" y="60" fill="#f59e0b" font-size="15" font-weight="700" text-anchor="end" ${FONT}>+47%</text>
<text x="296" y="74" fill="#8d80b8" font-size="8" text-anchor="end" ${FONT}>同比增速</text>
</svg>`;
/** 可持续 ESG：白底自然绿 · 三枚达标圆环与底部绿带（温和可信）。 */
const THUMB_ESG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#ffffff"/>
<circle cx="52" cy="52" r="16" fill="none" stroke="#15803d" stroke-width="3"/>
<circle cx="52" cy="52" r="16" fill="none" stroke="#86efac" stroke-width="3" stroke-dasharray="75 30" transform="rotate(-90 52 52)"/>
<text x="52" y="57" fill="#14532d" font-size="11" font-weight="700" text-anchor="middle" ${FONT}>38%</text>
<circle cx="124" cy="52" r="16" fill="none" stroke="#15803d" stroke-width="3"/>
<circle cx="124" cy="52" r="16" fill="none" stroke="#86efac" stroke-width="3" stroke-dasharray="95 10" transform="rotate(-90 124 52)"/>
<text x="124" y="57" fill="#14532d" font-size="11" font-weight="700" text-anchor="middle" ${FONT}>64%</text>
<text x="24" y="96" fill="#14532d" font-size="16" font-weight="700" ${FONT}>2026 可持续发展报告</text>
<text x="24" y="114" fill="#6b7f6e" font-size="9" ${FONT}>减碳 38% · 绿电占比 64% · 5 座无废工厂</text>
<rect y="136" width="320" height="44" fill="#f0fdf4"/>
<text x="24" y="162" fill="#4d7c5f" font-size="9" ${FONT}>环境 · 社会 · 治理 三维披露 · 第三方鉴证</text>
</svg>`;
/** 工程项目：蓝图深灰 · 网格底 · 楼体线框与安全橙进度（工程语汇）。 */
const THUMB_ENGINEERING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<rect width="320" height="180" fill="#263238"/>
<path d="M0 36 H320 M0 72 H320 M0 108 H320 M0 144 H320" stroke="#31404a" stroke-width="1"/>
<path d="M64 0 V180 M128 0 V180 M192 0 V180 M256 0 V180" stroke="#31404a" stroke-width="1"/>
<rect x="24" y="24" width="64" height="18" rx="4" fill="#f59e0b"/>
<text x="56" y="36" fill="#263238" font-size="9" font-weight="700" text-anchor="middle" ${FONT}>进度 62%</text>
<text x="24" y="66" fill="#ffffff" font-size="15" font-weight="700" ${FONT}>东部枢纽项目 · 周报 08</text>
<text x="24" y="84" fill="#90a4ae" font-size="9" ${FONT}>主体结构 18F · 幕墙 60% · 机电预埋</text>
<rect x="212" y="52" width="44" height="96" fill="none" stroke="#f59e0b" stroke-width="1.5"/>
<path d="M212 68 H256 M212 84 H256 M212 100 H256 M212 116 H256 M212 132 H256" stroke="#f59e0b" stroke-width="0.8" opacity="0.7"/>
<rect x="262" y="76" width="34" height="72" fill="none" stroke="#78909c" stroke-width="1.5"/>
<path d="M262 92 H296 M262 108 H296 M262 124 H296 M262 140 H296" stroke="#78909c" stroke-width="0.8" opacity="0.7"/>
<circle cx="32" cy="152" r="3" fill="#f59e0b"/>
<text x="42" y="156" fill="#b0bec5" font-size="8" ${FONT}>基坑</text>
<circle cx="112" cy="152" r="3" fill="#f59e0b"/>
<text x="122" y="156" fill="#b0bec5" font-size="8" ${FONT}>主体</text>
<circle cx="192" cy="152" r="3" fill="none" stroke="#90a4ae" stroke-width="1.5"/>
<text x="202" y="156" fill="#b0bec5" font-size="8" ${FONT}>幕墙 · 机电</text>
</svg>`;
export const BUILTIN_TEMPLATES = [
    {
        id: 'builtin-exec-review',
        source: 'builtin',
        name: '高管经营汇报',
        description: '结论先行、数据优先，适合向管理层汇报经营结果。',
        scenario: '季度汇报 / 经营复盘',
        tags: ['商务', '数据', '克制'],
        ratio: '16:9',
        accent: '#2F6FEB',
        samplePages: 4,
        thumbSvg: THUMB_EXEC_REVIEW,
    },
    {
        id: 'builtin-product-launch',
        source: 'builtin',
        name: '产品发布演示',
        description: '强视觉、少文字，突出卖点、核心特性与行动号召。',
        scenario: '产品发布 / 对外宣讲',
        tags: ['品牌', '发布', '大图'],
        ratio: '16:9',
        accent: '#E5484D',
        samplePages: 4,
        thumbSvg: THUMB_PRODUCT_LAUNCH,
    },
    {
        id: 'builtin-tech-sharing',
        source: 'builtin',
        name: '技术架构分享',
        description: '架构图与流程为主，适合方案讲解与技术分享。',
        scenario: '技术分享 / 方案评审',
        tags: ['科技', '架构', '图示'],
        ratio: '16:9',
        accent: '#0F9D8C',
        samplePages: 4,
        thumbSvg: THUMB_TECH_SHARING,
    },
    {
        id: 'builtin-teaching',
        source: 'builtin',
        name: '教学课件',
        description: '由浅入深、配图示与练习，适合课堂与培训。',
        scenario: '教学课件 / 培训',
        tags: ['教育', '图示', '渐进'],
        ratio: '16:9',
        accent: '#B7791F',
        samplePages: 4,
        thumbSvg: THUMB_TEACHING,
    },
    {
        id: 'builtin-bp-roadshow',
        source: 'builtin',
        name: '融资路演',
        description: '增长叙事、里程碑与财务预测，适合 BP 与投资人演示。',
        scenario: '融资路演 / 商业计划',
        tags: ['商务', '增长', '深色'],
        ratio: '16:9',
        accent: '#D4A24E',
        samplePages: 4,
        thumbSvg: THUMB_BP_ROADSHOW,
    },
    {
        id: 'builtin-weekly-report',
        source: 'builtin',
        name: '工作周报',
        description: '进展、数据与计划三段式，适合团队周报月报与述职。',
        scenario: '周报月报 / 述职',
        tags: ['职场', '克制', '列表'],
        ratio: '16:9',
        accent: '#3B82F6',
        samplePages: 4,
        thumbSvg: THUMB_WEEKLY_REPORT,
    },
    {
        id: 'builtin-marketing',
        source: 'builtin',
        name: '市场营销方案',
        description: '强节奏大字与活动漏斗，适合 campaign 提案与活动复盘。',
        scenario: '营销提案 / 活动策划',
        tags: ['品牌', '活力', '渐变'],
        ratio: '16:9',
        accent: '#E64560',
        samplePages: 4,
        thumbSvg: THUMB_MARKETING,
    },
    {
        id: 'builtin-dark-dashboard',
        source: 'builtin',
        name: '深色数据大屏',
        description: '近黑底大数字与实时图表，适合监控大屏与作战室汇报。',
        scenario: '数据大屏 / 运营监控',
        tags: ['数据', '深色', '实时'],
        ratio: '16:9',
        accent: '#22D3EE',
        samplePages: 4,
        thumbSvg: THUMB_DARK_DASHBOARD,
    },
    {
        id: 'builtin-minimal',
        source: 'builtin',
        name: '极简主义',
        description: '大量留白与单一强调色，适合设计复盘与品牌调性汇报。',
        scenario: '设计 / 品牌调性',
        tags: ['极简', '留白', '现代'],
        ratio: '16:9',
        accent: '#111111',
        samplePages: 4,
        thumbSvg: THUMB_MINIMAL,
    },
    {
        id: 'builtin-academic',
        source: 'builtin',
        name: '学术答辩',
        description: '校徽章位、章节严谨与论文信息规范，适合开题与答辩。',
        scenario: '开题 / 毕业答辩',
        tags: ['学术', '严谨', '规范'],
        ratio: '16:9',
        accent: '#1E3A5F',
        samplePages: 4,
        thumbSvg: THUMB_ACADEMIC,
    },
    {
        id: 'builtin-editorial',
        source: 'builtin',
        name: '杂志编辑风',
        description: '衬线大标题与图文分栏，适合品牌故事与深度内容叙事。',
        scenario: '品牌故事 / 内容叙事',
        tags: ['编辑', '图文', '叙事'],
        ratio: '16:9',
        accent: '#D9A441',
        samplePages: 4,
        thumbSvg: THUMB_EDITORIAL,
    },
    {
        id: 'builtin-healthcare',
        source: 'builtin',
        name: '医疗健康',
        description: '柔和青绿与圆角数据卡，适合健康科普与医疗行业汇报。',
        scenario: '健康科普 / 医疗行业',
        tags: ['医疗', '柔和', '科普'],
        ratio: '16:9',
        accent: '#0E9488',
        samplePages: 4,
        thumbSvg: THUMB_HEALTHCARE,
    },
    {
        id: 'builtin-government',
        source: 'builtin',
        name: '政务汇报',
        description: '红头金线与规范要点，适合政务汇报与党建宣讲。',
        scenario: '政务汇报 / 党建宣讲',
        tags: ['政务', '庄重', '规范'],
        ratio: '16:9',
        accent: '#C7351F',
        samplePages: 4,
        thumbSvg: THUMB_GOVERNMENT,
    },
    {
        id: 'builtin-ecommerce',
        source: 'builtin',
        name: '电商大促复盘',
        description: '深紫底大数字与转化漏斗，适合大促复盘与电商运营汇报。',
        scenario: '电商运营 / 大促复盘',
        tags: ['电商', '数据', '节奏'],
        ratio: '16:9',
        accent: '#F59E0B',
        samplePages: 4,
        thumbSvg: THUMB_ECOMMERCE,
    },
    {
        id: 'builtin-esg',
        source: 'builtin',
        name: '可持续 ESG',
        description: '自然绿达标圆环与三维披露，适合 ESG 报告与可持续发展汇报。',
        scenario: 'ESG 报告 / 可持续发展',
        tags: ['绿色', '披露', '可信'],
        ratio: '16:9',
        accent: '#15803D',
        samplePages: 4,
        thumbSvg: THUMB_ESG,
    },
    {
        id: 'builtin-engineering',
        source: 'builtin',
        name: '工程项目汇报',
        description: '蓝图网格与楼体线框，适合工程项目与制造业进度汇报。',
        scenario: '工程项目 / 制造业汇报',
        tags: ['工程', '进度', '蓝图'],
        ratio: '16:9',
        accent: '#F59E0B',
        samplePages: 4,
        thumbSvg: THUMB_ENGINEERING,
    },
];
