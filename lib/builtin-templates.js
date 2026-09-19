/**
 * 内置模板元数据（插件自带，随版本分发）。
 *
 * 立场：
 * - 本模块是内置模板的唯一真源（零 npm 依赖的纯数据模块）；
 * - 提供元数据：名称 / 描述 / 适用场景 / 标签 / 色板强调色 + **缩略样张**，
 *   供面板与 Agent 共用同一份口径。**不下发 .pptx 基底**——内置模板
 *   的版式由技能线（skills/ppts-pptx）按大纲生成，而不是套一份固定 deck；
 * - thumbSvg 是按各模板 VI 手绘的 16:9 版式样张（SVG 源码，非位图）：
 *   面板模板卡片把它编为 data URI 渲染成真实观感的缩略图；加载失败或
 *   字段缺失时回退 accent 色块。Agent 侧忽略该字段（只读元数据语义）；
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
/** 产品发布演示：近黑底 · 中央 hero 视觉 · 大口号 + CTA（强视觉、少文字）。 */
const THUMB_PRODUCT_LAUNCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<defs>
<radialGradient id="pl-hero" cx="50%" cy="42%" r="72%">
<stop offset="0%" stop-color="#ff7a45"/><stop offset="100%" stop-color="#c81e3c"/>
</radialGradient>
</defs>
<rect width="320" height="180" fill="#101014"/>
<rect x="100" y="20" width="120" height="82" rx="12" fill="url(#pl-hero)"/>
<rect x="112" y="32" width="96" height="58" rx="8" fill="rgba(255,255,255,0.14)"/>
<text x="160" y="126" fill="#ffffff" font-size="17" font-weight="700" text-anchor="middle" ${FONT}>重新定义工作方式</text>
<text x="160" y="144" fill="#9a9aa6" font-size="9" text-anchor="middle" ${FONT}>一场发布会 · 一件新产品 · 三个卖点</text>
<rect x="128" y="154" width="64" height="14" rx="7" fill="#e5484d"/>
<text x="160" y="164" fill="#ffffff" font-size="8" text-anchor="middle" ${FONT}>立即体验</text>
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
        thumbSvg: THUMB_TEACHING,
    },
];
