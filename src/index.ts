/**
 * dsh-super-ppts Host 入口（DSH/Cordis 插件）。
 *
 * 职责（刻意保持最小面）：
 * 1. 预设安装：把 presets/ 下的「演示文稿专家」Agent 预设拷贝到
 *    ~/.dsh/.agent-presets/super-ppts/，供 Web GUI 直接切换（离线复用）。
 * 2. 能力通告：向 systemPrompt 注册一段能力说明 section（可经
 *    config.announceToAgent 关闭）。具体生成工作流由技能层（skills/ppts-pptx、
 *    skills/ppts-html）承载，提示词里不重复技能正文，避免上下文膨胀。
 * 3. 原生工具注册：ppts_check（环境自检）、ppts_render（渲染验收）、
 *    ppts_templates（模板库与生成偏好查询）。
 * 4. 设置页通道：注册 /super-ppts HTTP 路由（模板上传 + JSON 操作面），
 *    供 Web 设置页「演示文稿」菜单项管理用户 PPTX 模板库与生成偏好
 *    （存储见 templates.ts，路由见 routes.ts）。
 *
 * Cordis 契约（实装冒烟抓过的坑）：
 * - host 侧访问的每个 ctx 服务必须经命名导出 `inject` 声明——
 *   `cannot get property "systemPrompt" without inject` 即漏声明症状；
 * - apply 返回 disposer（cordis fiber 释放时自动回收注册项），
 *   不需要 effect 包裹；effect 内部注册项由各自的 effect disposer 回收。
 *
 * 工程红线（对照 dsh 插件已知坑）：
 * - 零 npm 依赖：host 侧只用 node 内置模块 + ctx 服务，不 import 任何
 *   未声明的包（github 直装不落空壳坑的前提之一）；
 * - 本地服务面仅限插件自有路由（/super-ppts/*，信任围栏 + 无状态查询/上传），
 *   不监听新端口；PPTX 渲染验收走 CLI（tools.ts → compiler/ 与
 *   skills/ppts-pptx/scripts/），HTML 产物是单文件直接浏览器打开；
 * - 所有外部进程调用一律 execFile 参数数组，禁止 shell 字符串拼接。
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { packageRoot } from './paths.js'
import { registerPptsRoutes, type PptsWebServerFace } from './routes.js'
import { pptsCheckTool, pptsRenderTool, pptsTemplatesTool, type DshToolDefinition } from './tools.js'

export { packageRoot }

/** Stable Cordis plugin name. */
export const name = 'dsh-super-ppts'

/** apply 内访问的 ctx 服务（漏声明即抛 without inject）。 */
export const inject = ['systemPrompt', 'tools', 'webServer']

const SECTION_ORDER = 206

export const SUPER_PPTS_GUIDANCE = `本机已安装 dsh-super-ppts 插件（演示文稿超级插件）。双交付形态：1) PPTX 可编辑交付——设计流程编排（需求确认→页面结构→视觉方向锁定→生成→PPTX→PDF→PNG 渲染验收→返工），引擎为 pptx-designer Python 库（用 ppts_check 工具自检环境）；2) HTML 在线演示交付——8 种形态（翻页演示 slide-deck、流程图 flowchart、协议可视化 protocol-viz、架构图动画 arch-diagram、卡片剧场 card-theater、学霸笔记 scholar-notes、视频分镜 video-shots、手机 UI 演示 phone-ui），单文件 HTML 直接浏览器打开。用户提到「做PPT / 演示文稿 / 幻灯片 / 汇报 / 演示动画 / 翻页 HTML」时：先确认交付形态（可编辑 PPTX 还是 HTML 演示），再按插件包根 skills/ 对应技能线的工作流执行（包根见本通告所属插件的安装位置，不要猜测路径）。模板能力：用户可在 Web 设置页「演示文稿」上传自定义 PPTX 模板并命名，并可配置默认交付形态 / 渲染验收策略 / 输出目录 / 风格偏好备注。凡用户要求「按模板 X 制作 / 用我的模板」，或 Brief 涉及模板：先调 ppts_templates 查询模板库（名称→路径、默认模板与偏好，实时的、以查询结果为准），再按技能线 VI Build 模板化路径生成。`

export interface Config {
  enabled?: boolean
  announceToAgent?: boolean
  registerTools?: boolean
  /** 上传模板体积上限（MB），默认 100。 */
  uploadLimitMb?: number
}

interface SystemPromptService {
  section(spec: { name: string; order: number; text: string }): () => void
}

interface ToolsService {
  register(definition: DshToolDefinition): () => void
}

/** apply 收到的 ctx 服务面（只列出 inject 声明过的；effect/get 为 cordis ctx 自带）。 */
interface PluginContext {
  systemPrompt: SystemPromptService
  tools: ToolsService
  webServer: PptsWebServerFace
  effect(fn: () => () => void, name?: string): () => void
  get(name: string): unknown
}

/** 把 presets/ 下的预设文件拷贝到用户目录（幂等，文件不存在时静默跳过）。 */
function ensurePresetInstalled(): void {
  try {
    const userPresetDir = resolve(homedir(), '.dsh', '.agent-presets', 'super-ppts')
    if (!existsSync(userPresetDir)) mkdirSync(userPresetDir, { recursive: true })
    const pluginPresets = resolve(packageRoot, 'presets')
    for (const name of ['preset.yml', 'agent.cordis.yml'] as const) {
      const source = resolve(pluginPresets, name)
      if (existsSync(source)) copyFileSync(source, resolve(userPresetDir, name))
    }
  } catch {
    // 预设拷贝失败不阻断插件加载（用户可手动从 presets/ 取用）
  }
}

/** 注册预设拷贝 + 能力通告 + 原生工具 + 设置页路由；返回组合 disposer。 */
export function apply(ctx: PluginContext, config: Config = {}): () => void {
  if (config.enabled === false) return () => {}

  ensurePresetInstalled()

  const disposers: Array<() => void> = []
  if (config.announceToAgent !== false) {
    disposers.push(
      ctx.systemPrompt.section({
        name: 'plugin:dsh-super-ppts',
        order: SECTION_ORDER,
        text: SUPER_PPTS_GUIDANCE,
      }),
    )
  }
  if (config.registerTools !== false) {
    disposers.push(ctx.tools.register(pptsCheckTool))
    disposers.push(ctx.tools.register(pptsRenderTool))
    disposers.push(ctx.tools.register(pptsTemplatesTool))
  }
  // 设置页通道：模板上传 + JSON 操作面（存储 ~/.dsh/super-ppts/）。
  // 上限默认 100 MB（PPTX 模板的宽松上限），cordis.yml patch 可调。
  disposers.push(
    ctx.effect(
      () =>
        registerPptsRoutes(ctx, {
          uploadLimitBytes: Math.max(1, config.uploadLimitMb ?? 100) * 1024 * 1024,
        }),
      'dsh-super-ppts: /super-ppts routes',
    ),
  )
  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        // 回收失败不阻断卸载
      }
    }
  }
}
