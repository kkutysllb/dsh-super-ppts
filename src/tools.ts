/**
 * dsh-super-ppts 原生 Agent 工具（host 侧）。
 *
 * 工具面刻意收敛为 3 个，生成主体由技能层编排（agent 直跑 python / 写 HTML）：
 * - ppts_check     ：环境自检（Python 3 / pptx-designer / 渲染链），输出结构化报告。
 * - ppts_render    ：PPTX → PDF → PNG 渲染验收（跨平台，soffice 优先 / Win COM 可选）。
 * - ppts_templates ：模板库与生成偏好查询（设置页数据的 agent 侧唯一读取面）。
 *
 * 注册形态：dsh tools registry 的 raw definition（plain object，parameters 与
 * output.schema 均为 JSON Schema；output.render 返回 content-block 数组）。
 * 不 import @deepseek-ai/dsh-tools（defineTool）——保持零 npm 依赖红线
 * （github 直装不跑 npm install，host 侧第三方包不可 resolve）。
 *
 * 工程红线：所有外部进程一律 execFile 参数数组（禁 shell 字符串拼接）、带
 * timeout、固定 cwd 到插件包根。
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TemplateStoreError,
  loadRegistry,
  type PptsPrefs,
  type TemplateRecord,
} from './templates.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const packageRoot = resolve(__dirname, '..')

const COMPILER_SCRIPT = resolve(packageRoot, 'compiler', 'build_pptx.py')
const RENDER_SCRIPT = resolve(packageRoot, 'skills', 'ppts-pptx', 'scripts', 'render_pptx.py')

interface PythonCandidate {
  cmd: string
  args: readonly string[]
}

const PYTHON_CANDIDATES: readonly PythonCandidate[] = [
  { cmd: 'python3', args: [] },
  { cmd: 'python', args: [] },
  { cmd: 'py', args: ['-3'] },
]

function runOne(cmd: string, args: readonly string[], timeoutMs: number): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    execFile(cmd, [...args], { timeout: timeoutMs, cwd: packageRoot }, (error, stdout, stderr) => {
      resolvePromise({ ok: !error, stdout: String(stdout ?? ''), stderr: String(stderr ?? error?.message ?? '') })
    })
  })
}

/** 依次探测候选 Python（py -3 → python3 → python），返回第一个可执行者。 */
export async function findPython(): Promise<PythonCandidate | null> {
  for (const candidate of PYTHON_CANDIDATES) {
    const probe = await runOne(candidate.cmd, [...candidate.args, '--version'], 10_000)
    if (probe.ok && /python/i.test(probe.stdout + probe.stderr)) return candidate
  }
  return null
}

export interface PptsCheckResult {
  ok: boolean
  message: string
  report?: string
}

/** 环境自检：委托 compiler/build_pptx.py --check 输出统一报告。 */
export async function runCheck(): Promise<PptsCheckResult> {
  const python = await findPython()
  if (!python) {
    return { ok: false, message: '未找到可用的 Python 3（已尝试 py -3 / python3 / python）。请安装 Python 3.10+ 后重试。' }
  }
  if (!existsSync(COMPILER_SCRIPT)) {
    return { ok: false, message: `编译桥缺失：${COMPILER_SCRIPT}` }
  }
  const result = await runOne(python.cmd, [...python.args, COMPILER_SCRIPT, '--check'], 120_000)
  const report = (result.stdout + '\n' + result.stderr).trim()
  return {
    ok: result.ok,
    message: result.ok ? '环境自检完成' : '环境自检发现问题（详见 report，可按建议修复后重试）',
    report,
  }
}

export interface PptsRenderParams {
  /** 待验收的 PPTX 绝对路径或相对当前工作目录的路径。 */
  pptxPath: string
  /** PNG 输出目录，缺省为 PPTX 同目录下 ./render_review/。 */
  outDir?: string
}

export interface PptsRenderResult {
  ok: boolean
  message: string
  output?: string
}

/** 渲染验收：PPTX → PDF → PNG，供视觉复核与返工。 */
export async function runRender(params: PptsRenderParams): Promise<PptsRenderResult> {
  const pptxPath = resolve(params.pptxPath)
  if (!existsSync(pptxPath)) {
    return { ok: false, message: `PPTX 文件未找到：${pptxPath}` }
  }
  const python = await findPython()
  if (!python) {
    return { ok: false, message: '未找到可用的 Python 3，无法执行渲染验收。' }
  }
  if (!existsSync(RENDER_SCRIPT)) {
    return { ok: false, message: `渲染脚本缺失：${RENDER_SCRIPT}` }
  }
  const args = [...python.args, RENDER_SCRIPT, pptxPath]
  if (params.outDir) args.push('--out', resolve(params.outDir))
  const result = await runOne(python.cmd, args, 300_000)
  const output = (result.stdout + '\n' + result.stderr).trim()
  return result.ok
    ? { ok: true, message: '渲染完成，请逐页复核 PNG 后决定交付或返工', output }
    : { ok: false, message: `渲染失败：${output.slice(-500)}` }
}

/* ── DSH tools registry 的 raw definition（plain object，零依赖注册形态） ── */

/** dsh tools registry 接受的最小定义形态（见 @deepseek-ai/dsh-tools register()）。 */
export interface DshToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: {
    schema: Record<string, unknown>
    render: (args: unknown, value: unknown) => Array<{ type: string; text: string }>
  }
  timeoutMs?: number
  execute: (args: any) => Promise<unknown>
}

/** 工具输出的标准 JSON 呈现（content-block 数组）。 */
function jsonRender(_args: unknown, value: unknown): Array<{ type: string; text: string }> {
  return [{ type: 'text', text: JSON.stringify(value) }]
}

export const pptsCheckTool: DshToolDefinition = {
  name: 'ppts_check',
  description:
    'dsh-super-ppts 环境自检：探测 Python 3.10+ / pptx-designer 库 / PPTX 渲染验收链（soffice + pdftoppm）。' +
    '生成 PPTX 前先调用；缺 pptx-designer 时按报告提示执行 ' +
    '"python3 <插件包根>/compiler/build_pptx.py --ensure-deps" 自动安装。',
  parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  output: {
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string' },
        report: { type: 'string' },
      },
      required: ['ok', 'message'],
    },
    render: jsonRender,
  },
  timeoutMs: 180_000,
  execute: async () => runCheck(),
}

export const pptsRenderTool: DshToolDefinition = {
  name: 'ppts_render',
  description:
    'PPTX 渲染验收：把生成的 PPTX 经 LibreOffice + poppler 转成逐页 PNG（PPTX → PDF → PNG），' +
    '供视觉复核与返工闭环。交付级 PPTX 在宣告完成前必须调用本工具并通过视觉复核。',
  parameters: {
    type: 'object',
    properties: {
      pptxPath: { type: 'string', description: '待验收的 PPTX 绝对路径（或相对当前工作目录）' },
      outDir: { type: 'string', description: '可选：PNG 输出目录，缺省为 PPTX 同目录下 render_review/' },
    },
    required: ['pptxPath'],
    additionalProperties: false,
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string' },
        output: { type: 'string' },
      },
      required: ['ok', 'message'],
    },
    render: jsonRender,
  },
  timeoutMs: 360_000,
  execute: async (args: PptsRenderParams) => runRender(args),
}

/* ── ppts_templates：模板库与生成偏好（设置页数据的 agent 侧读取面） ── */

export interface PptsTemplatesParams {
  /** list=全部模板+偏好（默认）；detail=单条模板全量。 */
  action?: 'list' | 'detail'
  /** action=detail 时必填：模板 id 或名称（名称精确匹配，不区分大小写）。 */
  id?: string
}

interface TemplateToolEntry {
  id: string
  name: string
  description: string
  /** .pptx 绝对路径（模板化生成直接用作基底）。 */
  path: string
  sizeMb: number
  uploadedAt: string
  isDefault: boolean
}

function sizeMbOf(record: TemplateRecord): number {
  return Math.round((record.size / 1024 / 1024) * 100) / 100
}

function toToolEntry(record: TemplateRecord, defaultId: string | null): TemplateToolEntry {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    path: record.file,
    sizeMb: sizeMbOf(record),
    uploadedAt: record.uploadedAt,
    isDefault: record.id === defaultId,
  }
}

/** 模板库查询：list 返回全部模板 + 生成偏好；detail 按 id/名称取单条。 */
export function runTemplates(params: PptsTemplatesParams = {}):
  | { ok: true; message: string; count?: number; defaultTemplate?: TemplateToolEntry | null; prefs?: PptsPrefs; templates?: TemplateToolEntry[]; template?: TemplateToolEntry; hint?: string }
  | { ok: false; message: string } {
  try {
    const registry = loadRegistry()
    if (params.action === 'detail') {
      const key = String(params.id ?? '').trim()
      if (key === '') return { ok: false, message: 'action=detail 需要 id（模板 id 或名称）' }
      const lowered = key.toLowerCase()
      const record = registry.templates.find(
        item => item.id === key || item.name.toLowerCase() === lowered,
      )
      if (!record) return { ok: false, message: `模板不存在：${key}（用 action=list 查看全部）` }
      return { ok: true, message: `模板「${record.name}」`, template: toToolEntry(record, registry.defaultTemplate) }
    }
    const templates = registry.templates.map(item => toToolEntry(item, registry.defaultTemplate))
    const result: { ok: true; message: string; count: number; defaultTemplate: TemplateToolEntry | null; prefs: PptsPrefs; templates: TemplateToolEntry[]; hint?: string } = {
      ok: true,
      message: templates.length === 0 ? '模板库为空' : `共 ${templates.length} 个模板`,
      count: templates.length,
      defaultTemplate: templates.find(item => item.isDefault) ?? null,
      prefs: registry.prefs,
      templates,
    }
    if (templates.length === 0) {
      result.hint = '模板库为空：请到 Web 设置页「演示文稿」上传 .pptx 模板并命名；之后用户即可说「按模板名制作」'
    }
    return result
  } catch (error) {
    const message = error instanceof TemplateStoreError ? error.message : String(error)
    return { ok: false, message: `模板库读取失败：${message}` }
  }
}

export const pptsTemplatesTool: DshToolDefinition = {
  name: 'ppts_templates',
  description:
    '查询用户模板库与生成偏好（Web 设置页「演示文稿」维护的数据）。' +
    'list：全部模板（名称/id/绝对路径/描述/是否默认）+ 偏好（默认交付形态/渲染验收策略/输出目录/风格备注）；' +
    'detail：按 id 或名称取单条。' +
    '用户要求「按模板 X 制作 / 用我的模板」或 Brief 涉及模板时必须先调用本工具拿路径；' +
    '模板化 PPTX 用技能线 VI Build 路径（以模板为基底 Presentation(path)）。',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'detail'], description: 'list（默认）=全部模板+偏好；detail=单条' },
      id: { type: 'string', description: 'action=detail 时必填：模板 id 或名称（精确，不区分大小写）' },
    },
    required: [],
    additionalProperties: false,
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string' },
        count: { type: 'number' },
        defaultTemplate: { type: ['object', 'null'] },
        prefs: { type: 'object' },
        templates: { type: 'array', items: { type: 'object' } },
        template: { type: 'object' },
        hint: { type: 'string' },
      },
      required: ['ok', 'message'],
    },
    render: jsonRender,
  },
  timeoutMs: 10_000,
  execute: async (args: PptsTemplatesParams) => runTemplates(args),
}
