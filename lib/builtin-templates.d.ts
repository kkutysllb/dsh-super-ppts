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
export type TemplateSource = 'builtin' | 'user';
export interface BuiltinTemplate {
    /** 稳定 id（内置模板不可删除/重命名，id 即身份）。 */
    id: string;
    /** 来源标识（与用户模板共用同一字段口径）。 */
    source: TemplateSource;
    /** 展示名（可与用户模板同名，两者分组展示不冲突）。 */
    name: string;
    /** 一句话描述（面板卡片与 Agent 提示共用的用途说明）。 */
    description: string;
    /** 适用场景（如「季度汇报 / 经营复盘」）。 */
    scenario: string;
    /** 风格标签。 */
    tags: string[];
    /** 画面比例。 */
    ratio: '16:9';
    /** 强调色（缩略图加载失败时的回退底色；同时表达模板气质）。 */
    accent: string;
    /** 16:9 版式样张（SVG 源码，viewBox 320x180）——真图 404 时的兜底示意。 */
    thumbSvg: string;
    /** 样例 deck 页数（assets/builtin-decks/<id>.pptx；面板「预览样例」的翻页上限）。 */
    samplePages: number;
}
export declare const BUILTIN_TEMPLATES: readonly BuiltinTemplate[];
