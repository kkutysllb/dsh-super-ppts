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
    /** 16:9 版式样张（SVG 源码，viewBox 320x180）——面板缩略图真身。 */
    thumbSvg: string;
}
export declare const BUILTIN_TEMPLATES: readonly BuiltinTemplate[];
