/**
 * 内置模板元数据（插件自带，随版本分发）。
 *
 * 立场：
 * - 本模块是内置模板的唯一真源（零 npm 依赖的纯数据模块）；
 * - 首版只提供元数据：名称 / 描述 / 适用场景 / 标签 / 色板强调色，
 *   供面板与 Agent 共用同一份口径。**不下发 .pptx 基底**——内置模板
 *   的版式由技能线（skills/ppts-pptx）按大纲生成，而不是套一份固定 deck；
 * - 与用户上传模板的区别用 source 字段显式表达（'builtin' | 'user'），
 *   面板据此分组，禁止把两类混进一个无来源标识的列表。
 */

export type TemplateSource = 'builtin' | 'user'

export interface BuiltinTemplate {
  /** 稳定 id（内置模板不可删除/重命名，id 即身份）。 */
  id: string
  /** 来源标识（与用户模板共用同一字段口径）。 */
  source: TemplateSource
  /** 展示名（可与用户模板同名，两者分组展示不冲突）。 */
  name: string
  /** 一句话描述（面板卡片与 Agent 提示共用的用途说明）。 */
  description: string
  /** 适用场景（如「季度汇报 / 经营复盘」）。 */
  scenario: string
  /** 风格标签。 */
  tags: string[]
  /** 画面比例。 */
  ratio: '16:9'
  /** 占位预览用强调色（首版无缩略图，面板据此做来源区分）。 */
  accent: string
}

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  {
    id: 'builtin-exec-review',
    source: 'builtin',
    name: '高管经营汇报',
    description: '结论先行、数据优先，适合向管理层汇报经营结果。',
    scenario: '季度汇报 / 经营复盘',
    tags: ['商务', '数据', '克制'],
    ratio: '16:9',
    accent: '#2F6FEB',
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
  },
]
