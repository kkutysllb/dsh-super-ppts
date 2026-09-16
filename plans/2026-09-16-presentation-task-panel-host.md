# 演示任务面板 · Plan 1（host 侧任务基础设施）实现计划

**Goal:** 为 dsh-super-ppts 建立演示任务的 host 侧基础设施——任务存储层、任务 HTTP 数据面、素材上传通道、`ppts_task` 状态桥工具与内置模板元数据——使面板（Plan 2）有稳定 API 契约可依赖。

**Architecture:** 沿用插件既有三层结构：`templates.ts` 风格的零依赖存储层（原子写 + 损坏留底）→ `routes.ts` 的 `/super-ppts` 信任围栏数据面 → `tools.ts` 的 raw tool definition。新增 `src/tasks.ts`（任务存储）与 `src/builtin-templates.ts`（内置模板元数据），扩展 `routes.ts` / `tools.ts` / `index.ts`，全部验证走既有 `scripts/smoke-plugin.mjs`。

**Tech Stack:** TypeScript（tsc → lib/）、Node 内置模块（无 npm 依赖）、Cordis 插件契约、`pptx` 无关（本计划不碰生成链）。

**依据规格：** `docs/specs/2026-09-16-presentation-task-panel-design.md`

**范围说明：** 本计划只做 host 侧。client 侧面板重构（五视图 / 模板选择器 / 会话桥 v3 / 轮询）是 Plan 2；本计划**不改** `lib/client.js`、**不 bump 版本号**（版本号与 release note 属于 Plan 2）。

---

## 文件结构

| 文件 | 责任 | 状态 |
|---|---|---|
| `src/builtin-templates.ts` | 内置模板元数据（纯数据 + 类型），唯一真源 | 新建 |
| `src/tasks.ts` | 任务存储层：索引 + 任务目录 + 大纲版本 + 素材落盘 | 新建 |
| `src/routes.ts` | 扩展 `tasks.*` API 方法 + `/super-ppts/tasks/upload` 路由 | 修改 |
| `src/tools.ts` | 新增 `ppts_task` 工具；`ppts_templates` 附带内置模板 | 修改 |
| `src/index.ts` | 注册 `ppts_task`；更新能力通告（任务状态桥说明） | 修改 |
| `scripts/smoke-plugin.mjs` | 新增任务存储 / 路由 / 上传 / 工具 / 内置模板断言 | 修改 |

---

### Task 1: 内置模板元数据模块

**Files:**
- Create: `src/builtin-templates.ts`
- Modify: `tsconfig.json`（登记新源文件——本仓库 `include` 是**显式文件白名单**，漏登记则不产出 `lib` 产物，冒烟会 `ERR_MODULE_NOT_FOUND`）
- Test: `scripts/smoke-plugin.mjs`（新增断言块）

- [ ] **Step 1: 写失败测试**

在 `scripts/smoke-plugin.mjs` 中，找到这一行（约 201 行）：

```js
disposeRoutes()
```

在它**之前**插入：

```js
/* ═══ 1.4 内置模板元数据 ═══ */
{
  const builtin = await import('../lib/builtin-templates.js')
  const list = builtin.BUILTIN_TEMPLATES
  check('内置模板 ≥ 4 个', Array.isArray(list) && list.length >= 4, String(list?.length))
  check('内置模板字段齐备（id/name/source/scenario/tags）',
    list.every(item => typeof item.id === 'string' && item.id !== ''
      && item.source === 'builtin' && typeof item.name === 'string'
      && typeof item.scenario === 'string' && Array.isArray(item.tags)))
  check('内置模板 id 唯一', new Set(list.map(item => item.id)).size === list.length)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL — `Cannot find module '.../lib/builtin-templates.js'`（构建产物缺失，断言抛错整段失败）

- [ ] **Step 3: 实现模块并登记构建**

创建 `src/builtin-templates.ts`：

```ts
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
```

然后把新源文件登记进 `tsconfig.json` 的 `include` 数组（追加到 `src/routes.ts` 之后）：

```json
  "include": [
    "src/paths.ts",
    "src/index.ts",
    "src/tools.ts",
    "src/templates.ts",
    "src/routes.ts",
    "src/builtin-templates.ts"
  ]
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: PASS — 三个内置模板断言全绿，既有断言无回归

- [ ] **Step 5: 提交**

```bash
git add src/builtin-templates.ts scripts/smoke-plugin.mjs
git commit -m "feat(host): builtin template metadata module"
```

---

### Task 2: 任务存储层

**Files:**
- Create: `src/tasks.ts`
- Modify: `tsconfig.json`（登记 `src/tasks.ts`——同 Task 1 的白名单要求）
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

在 `scripts/smoke-plugin.mjs` 的 `disposeRoutes()` 之前（Task 1 插入块之后）插入：

```js
/* ═══ 1.5 任务存储层（src/tasks.ts → lib/tasks.js）═══ */

const tasksMod = await import('../lib/tasks.js')
{
  const created = tasksMod.createTask({
    title: 'Q3 经营复盘',
    brief: { topic: '把 Q3 经营数据做成面向管理层的季度汇报', format: 'pptx' },
    workspace: { id: 'ws1', name: '季度汇报', path: '/tmp/ws1' },
  })
  check('createTask 落盘并写入索引', typeof created.id === 'string' && tasksMod.loadIndex().tasks.length === 1)
  check('任务目录与 materials 子目录已建立', existsSync(tasksMod.materialsDir(created.id)))

  const loaded = tasksMod.loadTask(created.id)
  check('loadTask 往返一致（标题/主题/状态）',
    loaded?.title === 'Q3 经营复盘' && loaded?.brief.topic.includes('Q3') && loaded?.status === 'creating')

  const advanced = tasksMod.updateTask(created.id, { status: 'analyzing', sessionId: 'sess-1' })
  check('updateTask 推进状态与会话', advanced.status === 'analyzing' && advanced.sessionId === 'sess-1')

  const outlined = tasksMod.saveOutline(created.id, [
    { title: '结论摘要', purpose: '先给结论', bullets: ['收入 +18%'], pageType: 'KPI 结论页' },
    { title: '核心指标' },
  ])
  check('saveOutline 版本自增并转 waiting-outline',
    outlined.outlineVersion === 1 && outlined.outline?.pages.length === 2 && outlined.status === 'waiting-outline')
  check('大纲落盘 outline-v1.json', existsSync(join(tasksMod.taskDir(created.id), 'outline-v1.json')))

  let versionRejected = false
  try { tasksMod.confirmOutline(created.id, 99) } catch (error) { versionRejected = error.code === 'bad-request' }
  check('确认版本不匹配被拒绝（防串版本确认）', versionRejected)

  const confirmed = tasksMod.confirmOutline(created.id, 1)
  check('confirmOutline 记录确认版本并转 building',
    confirmed.confirmedOutlineVersion === 1 && confirmed.status === 'building')
}

// 素材落盘：basename 安全化 + 空/超限拒绝
{
  const task = tasksMod.createTask({
    title: '素材测试',
    brief: { topic: '素材', format: 'pptx' },
    workspace: { id: 'ws1', name: 'W', path: '/tmp/w' },
  })
  const written = await tasksMod.writeMaterial(
    task.id, '../../evil.xlsx',
    (async function* () { yield Buffer.alloc(1024, 3) })(),
    10 * 1024 * 1024,
  )
  check('素材 basename 安全化（拒绝目录穿越）', written.name === 'evil.xlsx' && !written.path.includes('..'))
  check('素材落盘并有字节数', existsSync(written.path) && written.size === 1024
    && tasksMod.loadTask(task.id)?.materials.length === 1)

  let emptyRejected = false
  try {
    await tasksMod.writeMaterial(task.id, 'empty.txt', (async function* { })(), 1024)
  } catch (error) { emptyRejected = error.code === 'bad-request' }
  check('空素材被拒绝且不留半截文件', emptyRejected)

  let tooLargeRejected = false
  try {
    await tasksMod.writeMaterial(task.id, 'big.bin', (async function* () { yield Buffer.alloc(4096, 1) })(), 1024)
  } catch (error) { tooLargeRejected = error.code === 'bad-request' }
  check('超限素材被拒绝', tooLargeRejected)

  let badIdRejected = false
  try { tasksMod.taskDir('../../etc') } catch (error) { badIdRejected = error.code === 'bad-request' }
  check('非法 taskId 拼路径前被拒绝', badIdRejected)
}

// 韧性与上限
{
  const corrupt = tasksMod.createTask({
    title: '损坏任务',
    brief: { topic: 'x', format: 'html' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  writeFileSync(tasksMod.taskFile(corrupt.id), '{oops 坏 JSON', 'utf8')
  check('任务 JSON 损坏 → loadTask 返回 null（不抛错）', tasksMod.loadTask(corrupt.id) === null)
  check('损坏任务留底 .corrupt-*',
    readdirSync(tasksMod.taskDir(corrupt.id)).some(name => name.startsWith('task.json.corrupt-')))

  for (let i = 0; i < tasksMod.MAX_INDEX_TASKS + 5; i += 1) {
    tasksMod.createTask({
      title: '批量 ' + i,
      brief: { topic: 't', format: 'pptx' },
      workspace: { id: 'w', name: 'w', path: '/p' },
    })
  }
  check('索引按上限裁剪（= MAX_INDEX_TASKS）',
    tasksMod.loadIndex().tasks.length === tasksMod.MAX_INDEX_TASKS, String(tasksMod.loadIndex().tasks.length))

  const waiting = tasksMod.createTask({
    title: '待确认',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  tasksMod.saveOutline(waiting.id, [{ title: '第一页' }])
  const priority = tasksMod.listTasks()
  check('列表按恢复优先级排序（等待确认排最前）', priority[0]?.id === waiting.id, String(priority[0]?.status))

  const target = tasksMod.createTask({
    title: '待删除',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  const targetDir = tasksMod.taskDir(target.id)
  tasksMod.deleteTask(target.id)
  check('deleteTask 移除索引与任务目录',
    !existsSync(targetDir) && !tasksMod.loadIndex().tasks.some(item => item.id === target.id))
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL — `Cannot find module '.../lib/tasks.js'`

- [ ] **Step 3: 实现存储层**

创建 `src/tasks.ts`：

```ts
/**
 * 演示任务存储层（host 侧，零 npm 依赖）。
 *
 * 立场（沿用 templates.ts 的存储纪律）：
 * - 单用户低频写入，不做文件锁：全部写入 tmp + rename 原子替换；
 * - 单任务损坏（坏 JSON / 形态不符）改名 *.corrupt-* 留底，列表由索引兜底，
 *   绝不让后续写入用空数据静默覆盖既有记录；
 * - index.json 只存列表渲染所需的轻量字段，详情按需读 <taskId>/task.json；
 * - 目录名即 taskId（生成后不可变；重命名只改 task.json 与索引标题）；
 * - 全部路径在 TASKS_ROOT 之下闭合，taskId 经白名单校验后才拼路径。
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { DSH_HOME } from './templates.js'

/** 任务存储根（与模板库同属插件存储根；DSH_HOME 口径见 templates.ts）。 */
export const TASKS_ROOT = join(DSH_HOME, 'super-ppts', 'tasks')
export const TASK_INDEX_FILE = join(TASKS_ROOT, 'index.json')

/** 索引保留上限：超出只裁剪索引，不删除任务目录与产物。 */
export const MAX_INDEX_TASKS = 50

/** 单任务事件上限（防止长期任务把 task.json 撑大）。 */
const MAX_EVENTS = 200

export type TaskStatus =
  | 'creating'
  | 'waiting-launch'
  | 'analyzing'
  | 'waiting-outline'
  | 'needs-input'
  | 'building'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface TaskMaterial {
  id: string
  name: string
  size: number
  /** 素材绝对路径（TASKS_ROOT 之下）。 */
  path: string
  status: 'uploading' | 'ready' | 'error'
  error?: string
}

export interface OutlinePage {
  id: string
  title: string
  purpose?: string
  bullets: string[]
  pageType?: string
}

export interface Outline {
  version: number
  pages: OutlinePage[]
}

export interface TaskArtifact {
  type: 'pptx' | 'pdf' | 'html'
  path: string
  status: 'ready' | 'missing' | 'error'
}

export interface TaskEvent {
  at: string
  kind: string
  text: string
}

export interface TaskBrief {
  topic: string
  audience?: string
  scenario?: string
  pageCount?: string
  format: 'pptx' | 'html'
  /** null = 明确不使用模板；undefined/缺省 = 跟随设置页默认模板。 */
  templateId?: string | null
  templateName?: string
  templateSource?: 'builtin' | 'user'
  templateFingerprint?: string
  style?: string
  styleNotes?: string
  outputDir?: string
  renderReview?: string
}

export interface TaskWorkspace {
  id: string
  name: string
  path: string
}

export interface TaskStage {
  key: string
  index: number
  total: number
  detail?: string
}

export interface TaskRecord {
  id: string
  title: string
  status: TaskStatus
  stage?: TaskStage
  workspace: TaskWorkspace
  sessionId?: string
  brief: TaskBrief
  materials: TaskMaterial[]
  outline?: Outline
  outlineVersion: number
  confirmedOutlineVersion?: number
  events: TaskEvent[]
  artifacts: TaskArtifact[]
  createdAt: string
  updatedAt: string
}

/** 索引条目：列表渲染只读它，避免逐任务读盘。 */
export interface TaskIndexEntry {
  id: string
  title: string
  status: TaskStatus
  format: 'pptx' | 'html'
  workspaceId: string
  workspaceName: string
  createdAt: string
  updatedAt: string
}

interface TaskIndex {
  tasks: TaskIndexEntry[]
}

export class TaskStoreError extends Error {
  constructor(
    readonly code: 'bad-request' | 'not-found' | 'fs-error',
    message: string,
  ) {
    super(message)
  }
}

/** taskId 白名单（拼路径前必经：杜绝 ../ 逃逸）。 */
const TASK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i

export function newTaskId(): string {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function newMaterialId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** 校验并返回安全 taskId。 */
export function assertTaskId(id: string): string {
  const value = String(id ?? '').trim()
  if (!TASK_ID_RE.test(value)) throw new TaskStoreError('bad-request', `非法任务 id：${String(id)}`)
  return value
}

export function taskDir(id: string): string {
  return join(TASKS_ROOT, assertTaskId(id))
}

export function taskFile(id: string): string {
  return join(taskDir(id), 'task.json')
}

export function materialsDir(id: string): string {
  return join(taskDir(id), 'materials')
}

export function outlineFile(id: string, version: number): string {
  return join(taskDir(id), `outline-v${version}.json`)
}

/** 原子写 JSON：tmp + rename（进程崩溃不留半截文件）。 */
function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
}

/** 损坏文件留底：改名为 *.corrupt-<时间戳>-<随机>（尽力而为，失败不阻断）。 */
function quarantine(file: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 8)
  try {
    renameSync(file, `${file}.corrupt-${stamp}-${rand}`)
  } catch {
    // 留底失败（只读盘等）不阻断读取
  }
}

function emptyIndex(): TaskIndex {
  return { tasks: [] }
}

/** 读索引；缺失回落空索引；损坏留底后回落空索引（不抛错）。 */
export function loadIndex(): TaskIndex {
  if (!existsSync(TASK_INDEX_FILE)) return emptyIndex()
  try {
    const parsed: unknown = JSON.parse(readFileSync(TASK_INDEX_FILE, 'utf8'))
    const tasks = (parsed as { tasks?: unknown } | null)?.tasks
    if (!Array.isArray(tasks)) {
      quarantine(TASK_INDEX_FILE)
      return emptyIndex()
    }
    const valid = tasks.filter((item): item is TaskIndexEntry => {
      if (item === null || typeof item !== 'object') return false
      const entry = item as TaskIndexEntry
      return typeof entry.id === 'string' && typeof entry.status === 'string' && typeof entry.title === 'string'
    })
    return { tasks: valid }
  } catch {
    quarantine(TASK_INDEX_FILE)
    return emptyIndex()
  }
}

export function saveIndex(index: TaskIndex): void {
  writeJsonAtomic(TASK_INDEX_FILE, index)
}

/** 读任务详情；缺失或损坏返回 null（列表由索引兜底）。 */
export function loadTask(id: string): TaskRecord | null {
  const file = taskFile(id)
  if (!existsSync(file)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || typeof (parsed as TaskRecord).id !== 'string') {
      quarantine(file)
      return null
    }
    const record = parsed as TaskRecord
    return {
      ...record,
      materials: Array.isArray(record.materials) ? record.materials : [],
      events: Array.isArray(record.events) ? record.events : [],
      artifacts: Array.isArray(record.artifacts) ? record.artifacts : [],
      outlineVersion: typeof record.outlineVersion === 'number' ? record.outlineVersion : 0,
    }
  } catch {
    quarantine(file)
    return null
  }
}

/** 读任务；不存在即抛 not-found（工具与路由的统一入口）。 */
export function requireTask(id: string): TaskRecord {
  const task = loadTask(id)
  if (task === null) throw new TaskStoreError('not-found', `任务不存在：${String(id)}`)
  return task
}

function indexEntryOf(task: TaskRecord): TaskIndexEntry {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    format: task.brief.format,
    workspaceId: task.workspace.id,
    workspaceName: task.workspace.name,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

/** 写任务详情并同步索引（索引按 updatedAt 倒序裁剪到上限）。 */
export function saveTask(task: TaskRecord): TaskRecord {
  writeJsonAtomic(taskFile(task.id), task)
  const index = loadIndex()
  const others = index.tasks.filter(item => item.id !== task.id)
  const merged = [indexEntryOf(task), ...others]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, MAX_INDEX_TASKS)
  saveIndex({ tasks: merged })
  return task
}

export interface CreateTaskInput {
  title: string
  brief: TaskBrief
  workspace: TaskWorkspace
  status?: TaskStatus
}

/** 创建任务：先写盘再返回（写失败回收空目录，不留孤儿）。 */
export function createTask(input: CreateTaskInput): TaskRecord {
  const title = String(input.title ?? '').trim()
  if (title === '') throw new TaskStoreError('bad-request', '任务标题不能为空')
  const topic = String(input.brief?.topic ?? '').trim()
  if (topic === '') throw new TaskStoreError('bad-request', '任务主题不能为空')
  const now = new Date().toISOString()
  const task: TaskRecord = {
    id: newTaskId(),
    title,
    status: input.status ?? 'creating',
    workspace: {
      id: String(input.workspace?.id ?? ''),
      name: String(input.workspace?.name ?? ''),
      path: String(input.workspace?.path ?? ''),
    },
    brief: { ...input.brief, topic },
    materials: [],
    outlineVersion: 0,
    events: [{ at: now, kind: 'created', text: '任务已创建' }],
    artifacts: [],
    createdAt: now,
    updatedAt: now,
  }
  mkdirSync(materialsDir(task.id), { recursive: true })
  try {
    saveTask(task)
  } catch (error) {
    try { rmSync(taskDir(task.id), { recursive: true, force: true }) } catch { /* 尽力而为 */ }
    throw error instanceof TaskStoreError ? error : new TaskStoreError('fs-error', String(error))
  }
  return task
}

export interface UpdateTaskPatch {
  title?: string
  status?: TaskStatus
  stage?: TaskStage | null
  sessionId?: string | null
  brief?: Partial<TaskBrief>
}

export function updateTask(id: string, patch: UpdateTaskPatch): TaskRecord {
  const task = requireTask(id)
  if (patch.title !== undefined) {
    const title = String(patch.title).trim()
    if (title === '') throw new TaskStoreError('bad-request', '任务标题不能为空')
    task.title = title
  }
  if (patch.status !== undefined) task.status = patch.status
  if (patch.stage !== undefined) {
    if (patch.stage === null) delete task.stage
    else task.stage = patch.stage
  }
  if (patch.sessionId !== undefined) {
    if (patch.sessionId === null) delete task.sessionId
    else task.sessionId = String(patch.sessionId)
  }
  if (patch.brief !== undefined) task.brief = { ...task.brief, ...patch.brief }
  task.updatedAt = new Date().toISOString()
  return saveTask(task)
}

function pushEvent(task: TaskRecord, kind: string, text: string): void {
  task.events = [...task.events, { at: new Date().toISOString(), kind, text }].slice(-MAX_EVENTS)
  task.updatedAt = new Date().toISOString()
}

export function appendEvent(id: string, kind: string, text: string): TaskRecord {
  const task = requireTask(id)
  pushEvent(task, kind, text)
  return saveTask(task)
}

/**
 * 保存大纲：版本号自增、落盘 outline-vN.json、任务转 waiting-outline。
 * 规范化在存储层完成（页面 id 缺失即补、标题为空即兜底），保证读侧形态稳定。
 */
export function saveOutline(id: string, pages: OutlinePage[]): TaskRecord {
  const task = requireTask(id)
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new TaskStoreError('bad-request', '大纲至少需要一页')
  }
  const version = task.outlineVersion + 1
  const outline: Outline = {
    version,
    pages: pages.map((page, index) => ({
      id: typeof page?.id === 'string' && page.id !== '' ? page.id : `p${index + 1}`,
      title: String(page?.title ?? '').trim() || `第 ${index + 1} 页`,
      purpose: page?.purpose === undefined ? undefined : String(page.purpose),
      bullets: Array.isArray(page?.bullets) ? page.bullets.map(item => String(item)) : [],
      pageType: page?.pageType === undefined ? undefined : String(page.pageType),
    })),
  }
  writeJsonAtomic(outlineFile(id, version), outline)
  task.outline = outline
  task.outlineVersion = version
  task.status = 'waiting-outline'
  delete task.confirmedOutlineVersion
  pushEvent(task, 'outline', `已生成大纲 v${version}（${outline.pages.length} 页），等待确认`)
  return saveTask(task)
}

/** 确认大纲；版本不符即拒绝（防串版本确认）。 */
export function confirmOutline(id: string, version: number): TaskRecord {
  const task = requireTask(id)
  const target = Number(version)
  if (!Number.isInteger(target) || target !== task.outlineVersion) {
    throw new TaskStoreError('bad-request', `大纲版本不匹配（当前 v${task.outlineVersion}）`)
  }
  task.confirmedOutlineVersion = target
  task.status = 'building'
  pushEvent(task, 'confirm', `已确认大纲 v${target}`)
  return saveTask(task)
}

export function setStatus(id: string, status: TaskStatus): TaskRecord {
  const task = requireTask(id)
  task.status = status
  pushEvent(task, 'status', `状态 → ${status}`)
  return saveTask(task)
}

export function addArtifact(id: string, artifact: TaskArtifact): TaskRecord {
  const task = requireTask(id)
  task.artifacts = [
    ...task.artifacts.filter(item => item.type !== artifact.type),
    { type: artifact.type, path: String(artifact.path), status: artifact.status },
  ]
  pushEvent(task, 'artifact', `产物已登记：${artifact.type} → ${artifact.path}`)
  return saveTask(task)
}

/** 删除任务记录与任务目录（产物文件在工作区，不在任务目录，故不被删除）。 */
export function deleteTask(id: string): void {
  const target = assertTaskId(id)
  const index = loadIndex()
  saveIndex({ tasks: index.tasks.filter(item => item.id !== target) })
  try { rmSync(taskDir(target), { recursive: true, force: true }) } catch { /* 索引已一致，目录清理尽力而为 */ }
}

/** 恢复优先级：等待用户操作 → 生成中/可启动 → 失败 → 完成 → 取消。 */
const STATUS_PRIORITY: Record<TaskStatus, number> = {
  'waiting-outline': 0,
  'needs-input': 0,
  'creating': 1,
  'waiting-launch': 1,
  'analyzing': 1,
  'building': 1,
  'reviewing': 1,
  'failed': 2,
  'completed': 3,
  'cancelled': 4,
}

export interface ListTasksFilter {
  status?: TaskStatus
  workspaceId?: string
}

export function listTasks(filter: ListTasksFilter = {}): TaskIndexEntry[] {
  return loadIndex().tasks
    .filter(item => filter.status === undefined || item.status === filter.status)
    .filter(item => filter.workspaceId === undefined || item.workspaceId === filter.workspaceId)
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 9
      const pb = STATUS_PRIORITY[b.status] ?? 9
      if (pa !== pb) return pa - pb
      return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0
    })
}

/** 素材名安全化：只取 basename，剔除路径分隔、控制字符与首部点。 */
export function safeMaterialName(raw: string): string {
  const base = String(raw ?? '').split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/^\.+/, '').replace(/[\u0000-\u001f]/g, '').trim()
  if (cleaned === '') throw new TaskStoreError('bad-request', '素材文件名无效')
  return cleaned.slice(0, 120)
}

export interface MaterialUploadResult {
  name: string
  size: number
  path: string
}

/**
 * 流式写素材到任务 materials 目录并登记到任务记录。
 * 超限即断、失败即清理（不留半截文件）；文件名经 safeMaterialName 安全化。
 */
export async function writeMaterial(
  taskId: string,
  rawName: string,
  body: AsyncIterable<unknown>,
  limitBytes: number,
): Promise<MaterialUploadResult> {
  const task = requireTask(taskId)
  const name = safeMaterialName(rawName)
  const dir = materialsDir(task.id)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `${Date.now().toString(36)}-${name}`)
  const fd = openSync(target, 'wx')
  let total = 0
  try {
    for await (const chunk of body) {
      const buffer = Buffer.from(chunk as Uint8Array)
      total += buffer.length
      if (total > limitBytes) {
        throw new TaskStoreError('bad-request', `素材超过大小上限（≤ ${Math.round(limitBytes / 1024 / 1024)} MB）`)
      }
      writeSync(fd, buffer)
    }
  } catch (error) {
    closeSync(fd)
    try { rmSync(target, { force: true }) } catch { /* 兜底清理 */ }
    throw error
  }
  closeSync(fd)
  if (total === 0) {
    try { rmSync(target, { force: true }) } catch { /* 兜底清理 */ }
    throw new TaskStoreError('bad-request', '素材内容为空')
  }
  const material: TaskMaterial = {
    id: newMaterialId(),
    name,
    size: statSync(target).size,
    path: target,
    status: 'ready',
  }
  task.materials = [...task.materials, material]
  pushEvent(task, 'material', `素材已上传：${name}`)
  saveTask(task)
  return { name: material.name, size: material.size, path: material.path }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: PASS — 任务存储断言全绿；既有 templates/routes 断言无回归

- [ ] **Step 5: 提交**

```bash
git add src/tasks.ts scripts/smoke-plugin.mjs
git commit -m "feat(host): task store (index + per-task dir + outline versions + materials)"
```

---

### Task 3: 任务 API 路由

**Files:**
- Modify: `src/routes.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

在 `scripts/smoke-plugin.mjs` 的 `disposeRoutes()` 之前插入：

```js
/* ═══ 1.6 任务 API 路由 ═══ */
{
  const created = await callApi('tasks.create', {
    title: '路由任务',
    brief: { topic: '路由主题', format: 'pptx' },
    workspace: { id: 'ws-route', name: '路由工作区', path: '/tmp/route' },
  })
  check('tasks.create 返回任务记录', created.json.ok === true && typeof created.json.value.id === 'string')
  const id = created.json.value.id

  check('tasks.get 返回任务详情', (await callApi('tasks.get', { id })).json.value.title === '路由任务')

  const missing = await callApi('tasks.get', { id: 'nope-000000' })
  check('tasks.get 未知 id → 404 not-found', missing.status === 404 && missing.json.error?.code === 'not-found')

  const listed = await callApi('tasks.list', {})
  check('tasks.list 返回索引条目', listed.json.ok && listed.json.value.tasks.some(item => item.id === id))

  const badCreate = await callApi('tasks.create', { title: '缺 brief' })
  check('tasks.create 缺 brief → 400', badCreate.status === 400)

  const outlined = await callApi('tasks.outline', { id, pages: [{ title: 'A' }, { title: 'B' }] })
  check('tasks.outline 保存并转等待确认', outlined.json.ok && outlined.json.value.status === 'waiting-outline')

  check('tasks.confirmOutline 版本不符 → 400', (await callApi('tasks.confirmOutline', { id, version: 42 })).status === 400)

  const confirmed = await callApi('tasks.confirmOutline', { id, version: 1 })
  check('tasks.confirmOutline 成功转 building', confirmed.json.ok && confirmed.json.value.status === 'building')

  const renamed = await callApi('tasks.update', { id, patch: { title: '路由任务改名' } })
  check('tasks.update 改名生效', renamed.json.ok && renamed.json.value.title === '路由任务改名')

  check('tasks.delete 移除任务目录', (await callApi('tasks.delete', { id })).json.ok && !existsSync(tasksMod.taskDir(id)))
}

/* ═══ 1.7 素材上传路由 ═══ */
{
  const created = await callApi('tasks.create', {
    title: '素材路由',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  const id = created.json.value.id

  async function callMaterialUpload(url, body) {
    const handler = routes.get('/super-ppts/tasks/upload')
    const req = {
      method: 'POST',
      url,
      headers: { host: '127.0.0.1:60864' },
      async *[Symbol.asyncIterator]() { yield body },
    }
    let resolveRes
    const pending = new Promise(resolve => { resolveRes = resolve })
    const mocked = {
      writeHead(status) { mocked._status = status },
      end(payload) { resolveRes({ status: mocked._status, body: payload }) },
    }
    await handler(req, mocked)
    const result = await pending
    return { status: result.status, json: JSON.parse(result.body) }
  }

  check('素材上传路由已注册', typeof routes.get('/super-ppts/tasks/upload') === 'function')

  const uploaded = await callMaterialUpload(
    '/super-ppts/tasks/upload?taskId=' + encodeURIComponent(id) + '&name=' + encodeURIComponent('数据.xlsx'),
    Buffer.alloc(2048, 5),
  )
  check('素材上传成功并登记到任务', uploaded.status === 200 && uploaded.json.ok && uploaded.json.value.name === '数据.xlsx')

  const badTask = await callMaterialUpload('/super-ppts/tasks/upload?taskId=nope-000000&name=x.txt', Buffer.alloc(16, 1))
  check('未知任务素材上传 → 404', badTask.status === 404)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL — `tasks.create` 返回 404 `unknown api method "tasks.create"`（断言 `created.json.ok === true` 不成立）

- [ ] **Step 3: 实现路由扩展**

在 `src/routes.ts` 顶部把导入块替换为（新增 tasks 与 builtin 导入）：

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import { BUILTIN_TEMPLATES } from './builtin-templates.js'
import {
  TemplateStoreError,
  addTemplate,
  deleteTemplate,
  loadRegistry,
  renameTemplate,
  setDefaultTemplate,
  updatePrefs,
  writeUploadTemp,
} from './templates.js'
import {
  TaskStoreError,
  confirmOutline,
  createTask,
  deleteTask,
  loadTask,
  saveOutline,
  updateTask,
  writeMaterial,
  type ListTasksFilter,
  type OutlinePage,
  type TaskBrief,
  type TaskStatus,
  type TaskWorkspace,
  type UpdateTaskPatch,
} from './tasks.js'
```

在 `writeError` 中，`TemplateStoreError` 分支之后加入 `TaskStoreError` 分支：

```ts
  if (error instanceof TaskStoreError) {
    const status = error.code === 'not-found' ? 404 : error.code === 'fs-error' ? 500 : 400
    writeJson(res, status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
```

把 `buildPptsApiHandlers()` 整体替换为：

```ts
/** JSON 操作面：method → handler（templates.* / prefs.* / tasks.*）。 */
export function buildPptsApiHandlers(): Record<string, (payload: unknown) => unknown> {
  return {
    // templates.list 附带内置模板元数据：用户模板字段口径不变（向后兼容），
    // builtinTemplates 为新增字段，面板据此分组展示两类来源。
    'templates.list': () => ({ ...loadRegistry(), builtinTemplates: BUILTIN_TEMPLATES }),
    'templates.rename': (payload) => {
      const id = requireString(payload, 'id')
      const name = requireString(payload, 'name')
      const description = optionalString(payload, 'description')
      return renameTemplate(id, name, description)
    },
    'templates.delete': (payload) => {
      deleteTemplate(requireString(payload, 'id'))
      return { deleted: true }
    },
    'templates.setDefault': (payload) => {
      const record = payload as Record<string, unknown> | null
      const id = record?.id
      if (id !== null && typeof id !== 'string') throw new PptsRouteError('bad-request', 'invalid "id"')
      setDefaultTemplate(id as string | null)
      return loadRegistry()
    },
    'prefs.update': (payload) => {
      const record = payload as Record<string, unknown> | null
      return updatePrefs(record?.patch)
    },
    'tasks.list': (payload) => {
      const record = payload as Record<string, unknown> | null
      const filter: ListTasksFilter = {}
      const status = record?.status
      if (typeof status === 'string' && status !== '') filter.status = status as TaskStatus
      const workspaceId = record?.workspaceId
      if (typeof workspaceId === 'string' && workspaceId !== '') filter.workspaceId = workspaceId
      return { tasks: listTasks(filter) }
    },
    'tasks.get': (payload) => {
      const id = requireString(payload, 'id')
      const task = loadTask(id)
      if (task === null) throw new PptsRouteError('not-found', `任务不存在：${id}`, 404)
      return task
    },
    'tasks.create': (payload) => {
      const record = payload as Record<string, unknown> | null
      const brief = record?.brief
      if (brief === null || typeof brief !== 'object') {
        throw new PptsRouteError('bad-request', 'missing or invalid "brief"')
      }
      const workspace = record?.workspace
      return createTask({
        title: requireString(payload, 'title'),
        brief: brief as TaskBrief,
        workspace: (workspace !== null && typeof workspace === 'object' ? workspace : { id: '', name: '', path: '' }) as TaskWorkspace,
      })
    },
    'tasks.update': (payload) => {
      const record = payload as Record<string, unknown> | null
      const patch = record?.patch
      if (patch === null || typeof patch !== 'object') {
        throw new PptsRouteError('bad-request', 'missing or invalid "patch"')
      }
      return updateTask(requireString(payload, 'id'), patch as UpdateTaskPatch)
    },
    'tasks.delete': (payload) => {
      deleteTask(requireString(payload, 'id'))
      return { deleted: true }
    },
    'tasks.outline': (payload) => {
      const record = payload as Record<string, unknown> | null
      const pages = record?.pages
      if (!Array.isArray(pages)) throw new PptsRouteError('bad-request', 'missing or invalid "pages"')
      return saveOutline(requireString(payload, 'id'), pages as OutlinePage[])
    },
    'tasks.confirmOutline': (payload) => {
      const record = payload as Record<string, unknown> | null
      const version = record?.version
      if (typeof version !== 'number') throw new PptsRouteError('bad-request', 'missing or invalid "version"')
      return confirmOutline(requireString(payload, 'id'), version)
    },
  }
}
```

注意：`buildPptsApiHandlers()` 上方原有的注释 `/** JSON 操作面：method → handler（templates.* / prefs.*）。 */` 一并被上面这段替换。

- [ ] **Step 4: 实现素材上传路由**

在 `src/routes.ts` 的 `registerPptsRoutes` 内，`/super-ppts/upload` 的 `disposers.push(...)` 之后、`return () => {` 之前插入：

```ts
  // 素材上传：任务目录内的原始流式落盘（与 /upload 同款信任围栏与限额）。
  disposers.push(ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/super-ppts/tasks/upload',
    handler: async (req, res) => {
      if (!fenceRequest(req, trustedHosts)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const taskId = url.searchParams.get('taskId') ?? ''
        const name = url.searchParams.get('name') ?? ''
        writeOk(res, await writeMaterial(taskId, name, req, options.uploadLimitBytes))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dsh-super-ppts: /super-ppts/tasks/upload route'))
```

同时把 `scripts/smoke-plugin.mjs` 中这两行断言更新为三条路由：

```js
check('路由已注册（api + upload + tasks/upload）',
  routes.has('/super-ppts/api/*') && routes.has('/super-ppts/upload') && routes.has('/super-ppts/tasks/upload'))
check('effect 已登记', effects.length === 3)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: PASS — 任务 API 与素材上传断言全绿；`效果已登记` 为 3

- [ ] **Step 6: 提交**

```bash
git add src/routes.ts scripts/smoke-plugin.mjs
git commit -m "feat(host): task API surface + material upload route"
```

---

### Task 4: `ppts_task` 状态桥工具

**Files:**
- Modify: `src/tools.ts`
- Modify: `src/index.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

在 `scripts/smoke-plugin.mjs` 中，把这一行（约 326 行）：

```js
  const { pptsCheckTool, pptsRenderTool, pptsTemplatesTool } = await import('../lib/tools.js')
  const tools = [pptsCheckTool, pptsRenderTool, pptsTemplatesTool]
```

替换为：

```js
  const { pptsCheckTool, pptsRenderTool, pptsTemplatesTool, pptsTaskTool } = await import('../lib/tools.js')
  const tools = [pptsCheckTool, pptsRenderTool, pptsTemplatesTool, pptsTaskTool]
```

然后在该 `{ ... }` 块（工具 schema 合规块）**之后**插入新块：

```js
// ppts_task 状态桥行为：阶段上报 / 大纲提交即停 / 确认可见 / 产物登记 / 失败记录
{
  const { runTask, pptsTaskTool } = await import('../lib/tools.js')
  const store = await import('../lib/tasks.js')
  const task = store.createTask({
    title: '工具任务',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })

  const staged = runTask({ action: 'stage', taskId: task.id, stageKey: 'analyzing', stageIndex: 1, stageTotal: 6, detail: '读取素材' })
  check('ppts_task stage 上报阶段并推进状态', staged.ok === true && store.loadTask(task.id)?.status === 'analyzing')

  const outlined = runTask({ action: 'outline', taskId: task.id, pages: [{ title: '结论' }, { title: '指标' }] })
  check('ppts_task outline 转等待确认并提示停下',
    outlined.ok === true && outlined.status === 'waiting-outline' && /确认/.test(outlined.message))

  const before = runTask({ action: 'get', taskId: task.id })
  check('ppts_task get 反映未确认（版本 0）',
    before.ok === true && before.status === 'waiting-outline' && before.confirmedOutlineVersion === 0)

  store.confirmOutline(task.id, 1)
  const after = runTask({ action: 'get', taskId: task.id })
  check('ppts_task get 反映已确认版本', after.confirmedOutlineVersion === 1)

  const artifact = runTask({ action: 'artifact', taskId: task.id, artifactType: 'pptx', artifactPath: '/tmp/deck.pptx' })
  check('ppts_task artifact 登记产物',
    artifact.ok === true && store.loadTask(task.id)?.artifacts[0]?.path === '/tmp/deck.pptx')

  const needsInput = runTask({ action: 'needs-input', taskId: task.id, question: '利润下降口径？' })
  check('ppts_task needs-input 转等待补充',
    needsInput.ok === true && store.loadTask(task.id)?.status === 'needs-input')

  const failed = runTask({ action: 'fail', taskId: task.id, stageKey: 'reviewing', reason: '渲染失败' })
  check('ppts_task fail 记录失败状态与原因',
    failed.ok === true && store.loadTask(task.id)?.status === 'failed'
      && /渲染失败/.test(store.loadTask(task.id)?.events.at(-1)?.text ?? ''))

  check('ppts_task 未知任务 → ok:false', runTask({ action: 'get', taskId: 'nope-000000' }).ok === false)

  // 输出值合规（运行时校验器可用时）
  try {
    const dshTools = await import(RUNTIME_NODE_MODULES + '/@deepseek-ai/dsh-tools/lib/index.js')
    const violations = dshTools.validateJsonSchemaValue(pptsTaskTool.output.schema, runTask({ action: 'get', taskId: task.id }))
    check('ppts_task 输出值合规（运行时校验器）',
      violations === undefined || violations.length === 0,
      Array.isArray(violations) ? violations.join('; ').slice(0, 200) : '')
  } catch {
    console.log('SKIP  ppts_task 输出值校验（运行时 dsh-tools 不可用）')
  }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL — `pptsTaskTool is not defined` / `runTask is not a function`

- [ ] **Step 3: 实现工具**

在 `src/tools.ts` 顶部导入块中加入 tasks 与 builtin 导入（放在 templates 导入之后）：

```ts
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from './builtin-templates.js'
import {
  TaskStoreError,
  addArtifact,
  appendEvent,
  requireTask,
  saveOutline,
  setStatus,
  updateTask,
  type OutlinePage,
  type TaskStatus,
} from './tasks.js'
```

注意：`BUILTIN_TEMPLATES` / `type BuiltinTemplate` 在 Task 5 才会被用到；若本任务先落地，TypeScript 可能报未使用导入——`tsconfig.json` 未开 `noUnusedLocals`，编译不会失败；如需保持干净，可把该行留到 Task 5 再加。

在 `src/tools.ts` 文件末尾追加：

```ts
/* ── ppts_task：演示任务状态桥（面板 Agent 之间唯一的显式状态通道） ──
 * 面板创建任务后把 taskId 写进 Brief，Agent 必须经本工具上报阶段与大纲；
 * 提交大纲后任务转 waiting-outline 并「停下等确认」——这是防止高成本生成
 * 在结构未确认前启动的闸门。用户确认后，面板以同一会话提交继续指令，
 * Agent 用 action=get 读到 confirmedOutlineVersion 后继续生成。 */

export interface PptsTaskParams {
  action: 'stage' | 'outline' | 'artifact' | 'needs-input' | 'fail' | 'get'
  /** 任务 id（由工作台创建任务时写入 Brief 的「任务 ID」）。 */
  taskId: string
  /** action=stage：阶段键（analyzing / planning / building / reviewing）。 */
  stageKey?: string
  stageIndex?: number
  stageTotal?: number
  detail?: string
  /** action=outline：页面结构（标题必填，其余可选）。 */
  pages?: OutlinePage[]
  /** action=artifact：产物类型与路径。 */
  artifactType?: 'pptx' | 'pdf' | 'html'
  artifactPath?: string
  /** action=needs-input：需要用户回答的具体问题。 */
  question?: string
  /** action=fail：失败阶段与原因。 */
  reason?: string
}

export interface PptsTaskResult {
  ok: boolean
  message: string
  taskId?: string
  status?: TaskStatus
  outlineVersion?: number
  confirmedOutlineVersion?: number
  pageCount?: number
}

/** 阶段键 → 任务状态（面板据此渲染阶段时间线）。 */
const STAGE_STATUS: Record<string, TaskStatus> = {
  analyzing: 'analyzing',
  planning: 'analyzing',
  building: 'building',
  reviewing: 'reviewing',
}

/** 任务状态桥：Agent 上报阶段/大纲/产物/补充/失败，或读取当前确认状态。 */
export function runTask(params: PptsTaskParams): PptsTaskResult {
  const taskId = String(params?.taskId ?? '').trim()
  if (taskId === '') return { ok: false, message: '缺少 taskId（取工作台 Brief 中的「任务 ID」）' }
  try {
    const task = requireTask(taskId)
    switch (params.action) {
      case 'stage': {
        const key = String(params.stageKey ?? '').trim()
        if (key === '') return { ok: false, message: 'action=stage 需要 stageKey' }
        const next = updateTask(taskId, {
          stage: {
            key,
            index: Number(params.stageIndex ?? 0),
            total: Number(params.stageTotal ?? 0),
            detail: params.detail === undefined ? undefined : String(params.detail),
          },
        })
        const mapped = STAGE_STATUS[key]
        const withStatus = mapped === undefined ? next : setStatus(taskId, mapped)
        return {
          ok: true,
          message: `阶段已上报：${key}`,
          taskId,
          status: withStatus.status,
          outlineVersion: withStatus.outlineVersion,
          confirmedOutlineVersion: withStatus.confirmedOutlineVersion ?? 0,
        }
      }
      case 'outline': {
        const saved = saveOutline(taskId, Array.isArray(params.pages) ? params.pages : [])
        return {
          ok: true,
          message: `大纲已记录（v${saved.outlineVersion}，${saved.outline?.pages.length ?? 0} 页）。`
            + '请立即停止后续生成，等待用户在工作台确认大纲后再继续（不要先生成 PPTX/HTML）。',
          taskId,
          status: saved.status,
          outlineVersion: saved.outlineVersion,
          confirmedOutlineVersion: saved.confirmedOutlineVersion ?? 0,
          pageCount: saved.outline?.pages.length ?? 0,
        }
      }
      case 'artifact': {
        const type = params.artifactType
        const path = String(params.artifactPath ?? '').trim()
        if (type !== 'pptx' && type !== 'pdf' && type !== 'html') {
          return { ok: false, message: 'action=artifact 需要 artifactType（pptx / pdf / html）' }
        }
        if (path === '') return { ok: false, message: 'action=artifact 需要 artifactPath' }
        const saved = addArtifact(taskId, { type, path, status: 'ready' })
        return { ok: true, message: `产物已登记：${type} → ${path}`, taskId, status: saved.status }
      }
      case 'needs-input': {
        const question = String(params.question ?? '').trim()
        if (question === '') return { ok: false, message: 'action=needs-input 需要 question' }
        appendEvent(taskId, 'needs-input', question)
        const saved = setStatus(taskId, 'needs-input')
        return { ok: true, message: `已请求用户补充：${question}`, taskId, status: saved.status }
      }
      case 'fail': {
        const reason = String(params.reason ?? '').trim()
        if (reason === '') return { ok: false, message: 'action=fail 需要 reason' }
        appendEvent(taskId, 'fail', reason)
        const failed = setStatus(taskId, 'failed')
        return { ok: true, message: `已记录失败：${reason}（可重试当前阶段）`, taskId, status: failed.status }
      }
      case 'get':
      default:
        return {
          ok: true,
          message: task.status === 'waiting-outline'
            ? '大纲尚未确认：请等待用户在工作台确认后再继续生成。'
            : `任务状态：${task.status}`,
          taskId,
          status: task.status,
          outlineVersion: task.outlineVersion,
          confirmedOutlineVersion: task.confirmedOutlineVersion ?? 0,
          pageCount: task.outline?.pages.length ?? 0,
        }
    }
  } catch (error) {
    const message = error instanceof TaskStoreError ? error.message : String(error)
    return { ok: false, message: `任务状态桥失败：${message}` }
  }
}

并在文件末尾追加工具定义：

```ts
export const pptsTaskTool: DshToolDefinition = {
  name: 'ppts_task',
  description:
    '演示任务状态桥（工作台创建的任务专用）。当 Brief 中带有「任务 ID：<id>」时必须使用本工具：' +
    'action=stage 上报阶段（analyzing/planning/building/reviewing）；' +
    'action=outline 提交页面大纲（{title,purpose,bullets,pageType}[]）——提交后任务转入「等待确认大纲」，' +
    '你必须立即停止后续生成，等用户在工作台确认；' +
    'action=get 读取当前状态与 confirmedOutlineVersion（收到「大纲已确认」消息后可先用它核对）；' +
    'action=artifact 登记产物路径；action=needs-input 请求用户补充信息；action=fail 记录失败原因与可恢复动作。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['stage', 'outline', 'artifact', 'needs-input', 'fail', 'get'],
        description: 'stage=上报阶段；outline=提交大纲并停下等确认；artifact=登记产物；needs-input=请求补充；fail=记录失败；get=读取状态',
      },
      taskId: { type: 'string', description: '任务 id（Brief 中的「任务 ID」）' },
      stageKey: { type: 'string', description: 'action=stage：阶段键（analyzing / planning / building / reviewing）' },
      stageIndex: { type: 'number', description: 'action=stage：当前阶段序号（从 1 起）' },
      stageTotal: { type: 'number', description: 'action=stage：阶段总数' },
      detail: { type: 'string', description: 'action=stage：当前阶段的具体说明（面板会展示）' },
      pages: { type: 'array', items: { type: 'object' }, description: 'action=outline：页面数组，每页 {id?,title,purpose?,bullets?,pageType?}' },
      artifactType: { type: 'string', enum: ['pptx', 'pdf', 'html'], description: 'action=artifact：产物类型' },
      artifactPath: { type: 'string', description: 'action=artifact：产物绝对路径' },
      question: { type: 'string', description: 'action=needs-input：需要用户回答的问题' },
      reason: { type: 'string', description: 'action=fail：失败原因（面板展示并可重试）' },
    },
    required: ['action', 'taskId'],
    additionalProperties: false,
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string' },
        taskId: { type: 'string' },
        status: { type: 'string' },
        outlineVersion: { type: 'number' },
        confirmedOutlineVersion: { type: 'number' },
        pageCount: { type: 'number' },
      },
      required: ['ok', 'message'],
    },
    render: jsonRender,
  },
  timeoutMs: 10_000,
  execute: async (args: PptsTaskParams) => runTask(args),
}
```

在 `src/index.ts` 中注册该工具：把导入行

```ts
import { pptsCheckTool, pptsRenderTool, pptsTemplatesTool, type DshToolDefinition } from './tools.js'
```

替换为：

```ts
import { pptsCheckTool, pptsRenderTool, pptsTaskTool, pptsTemplatesTool, type DshToolDefinition } from './tools.js'
```

并把工具注册块

```ts
  if (config.registerTools !== false) {
    disposers.push(ctx.tools.register(pptsCheckTool))
    disposers.push(ctx.tools.register(pptsRenderTool))
    disposers.push(ctx.tools.register(pptsTemplatesTool))
  }
```

替换为：

```ts
  if (config.registerTools !== false) {
    disposers.push(ctx.tools.register(pptsCheckTool))
    disposers.push(ctx.tools.register(pptsRenderTool))
    disposers.push(ctx.tools.register(pptsTemplatesTool))
    disposers.push(ctx.tools.register(pptsTaskTool))
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: PASS — `ppts_task` 行为与 schema 断言全绿；插件树加载块中的工具 schema 通告仍为 1 条 wire

- [ ] **Step 5: 提交**

```bash
git add src/tools.ts src/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(host): ppts_task state bridge tool (stage/outline gate/artifact/fail)"
```

---

### Task 5: 内置模板下发 + 能力通告更新

**Files:**
- Modify: `src/tools.ts`（`runTemplates` 附带内置模板）
- Modify: `src/index.ts`（`SUPER_PPTS_GUIDANCE`）
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

在 `scripts/smoke-plugin.mjs` 的 `disposeRoutes()` 之前插入：

```js
/* ═══ 1.8 内置模板随清单下发 ═══ */
{
  const result = await callApi('templates.list', {})
  check('templates.list 附带 builtinTemplates（≥ 4）',
    result.json.ok && Array.isArray(result.json.value.builtinTemplates) && result.json.value.builtinTemplates.length >= 4)
  check('内置模板带 source 标识',
    result.json.value.builtinTemplates.every(item => item.source === 'builtin' && typeof item.name === 'string'))
  check('用户模板字段口径不变（templates 仍为数组）', Array.isArray(result.json.value.templates))
}
```

并在插件树加载块内（`check('能力通告 section 已注册', ...)` 之后）插入：

```js
  check('能力通告含任务状态桥说明（ppts_task + 大纲确认）',
    typeof sections[0].text === 'string' && sections[0].text.includes('ppts_task') && sections[0].text.includes('大纲'),
    String(sections[0].text ?? '').slice(0, 80))
  check('插件树注册任务素材路由', routes.has('/super-ppts/tasks/upload'))
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL — `builtinTemplates` 为 undefined；能力通告不含 `ppts_task`

- [ ] **Step 3: 让 `ppts_templates` 附带内置模板**

在 `src/tools.ts` 的 `runTemplates` 返回类型中，`templates?: TemplateToolEntry[]` 之后加入 `builtinTemplates?: readonly BuiltinTemplate[]`，并在 list 分支的 `result` 构造中加入该字段：

```ts
    const result: {
      ok: true
      message: string
      count: number
      defaultTemplate?: TemplateToolEntry
      prefs: PptsPrefs
      templates: TemplateToolEntry[]
      builtinTemplates: readonly BuiltinTemplate[]
      hint?: string
    } = {
      ok: true,
      message: templates.length === 0 ? '模板库为空' : `共 ${templates.length} 个模板`,
      count: templates.length,
      prefs: registry.prefs,
      templates,
      builtinTemplates: BUILTIN_TEMPLATES,
    }
```

同时把函数签名替换为：

```ts
export function runTemplates(params: PptsTemplatesParams = {}):
  | {
    ok: true
    message: string
    count?: number
    defaultTemplate?: TemplateToolEntry | null
    prefs?: PptsPrefs
    templates?: TemplateToolEntry[]
    builtinTemplates?: readonly BuiltinTemplate[]
    template?: TemplateToolEntry
    hint?: string
  }
  | { ok: false; message: string } {
```

并在 `src/tools.ts` 顶部加入导入：

```ts
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from './builtin-templates.js'
```

在 `pptsTemplatesTool.output.schema.properties` 中加入：

```ts
        builtinTemplates: { type: 'array', items: { type: 'object' }, description: '插件内置模板（source=builtin，无 .pptx 基底，由技能线按大纲生成）' },
```

在 `pptsTemplatesTool.description` 末尾追加：

```ts
    + '返回中的 builtinTemplates 为插件内置模板（source=builtin，随插件版本提供，不可删除）；'
    + 'templates 为用户上传模板（source=user 口径，见各自 isDefault）。'
```

- [ ] **Step 4: 更新能力通告**

在 `src/index.ts` 中，把 `SUPER_PPTS_GUIDANCE` 常量替换为：

```ts
export const SUPER_PPTS_GUIDANCE = `本机已安装 dsh-super-ppts 插件（演示文稿超级插件）。双交付形态：1) PPTX 可编辑交付——设计流程编排（需求确认→页面结构→视觉方向锁定→生成→PPTX→PDF→PNG 渲染验收→返工），引擎为 pptx-designer Python 库（用 ppts_check 工具自检环境）；2) HTML 在线演示交付——8 种形态（翻页演示 slide-deck、流程图 flowchart、协议可视化 protocol-viz、架构图动画 arch-diagram、卡片剧场 card-theater、学霸笔记 scholar-notes、视频分镜 video-shots、手机 UI 演示 phone-ui），单文件 HTML 直接浏览器打开。用户提到「做PPT / 演示文稿 / 幻灯片 / 汇报 / 演示动画 / 翻页 HTML」时：先确认交付形态（可编辑 PPTX 还是 HTML 演示），再按插件包根 skills/ 对应技能线的工作流执行（包根见本通告所属插件的安装位置，不要猜测路径）。模板能力：内置模板（source=builtin，随插件版本提供）与用户上传模板（设置页「演示文稿」维护，source=user）都经 ppts_templates 查询；凡用户要求「按模板 X 制作 / 用我的模板」，或 Brief 涉及模板：先调 ppts_templates 拿模板信息与偏好，再按技能线 VI Build 模板化路径生成。任务状态桥：若用户消息或 Brief 中出现「任务 ID：<id>」（由侧边栏「演示文稿」工作台创建的任务），必须用 ppts_task 上报进度——action=stage 上报阶段，action=outline 提交页面大纲（{title,purpose,bullets,pageType}[]）后**立即停止**，等待用户在工作台确认大纲；收到「大纲已确认」消息后再继续生成，并用 ppts_task get 核对 confirmedOutlineVersion；完成后用 action=artifact 登记产物路径；缺信息用 needs-input，失败用 fail。`
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: PASS — 内置模板下发与能力通告断言全绿

- [ ] **Step 6: 提交**

```bash
git add src/tools.ts src/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(host): builtin templates in ppts_templates + task bridge guidance"
```

---

### Task 6: README 数据面文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

在 `README.md` 的「原生工具 / Native tools」表格中，`ppts_templates` 行之后插入一行：

```markdown
| `ppts_task` | 演示任务状态桥：工作台创建的任务经它上报阶段、提交大纲（提交后停下等用户确认）、登记产物、请求补充、记录失败 |
```

在「用户模板库与生成偏好 / User templates & preferences」章节之后新增一节：

```markdown
## 演示任务数据面 / Presentation task surface

侧边栏「演示文稿」工作台的任务数据落在 `<DSH_HOME>/super-ppts/tasks/`：
`index.json` 存列表所需轻量字段，`<taskId>/task.json` 存详情，
`<taskId>/outline-vN.json` 存每次大纲版本，`<taskId>/materials/` 存本次素材。

host 侧 HTTP 面（沿用 `/super-ppts` 信任围栏与 `{ok,value}` 信封）：

| 路由 | 作用 |
|---|---|
| `POST /super-ppts/api/tasks.list` | 任务列表（可按状态 / 工作区筛选） |
| `POST /super-ppts/api/tasks.get` | 任务详情（含大纲、产物、事件） |
| `POST /super-ppts/api/tasks.create` | 创建任务 |
| `POST /super-ppts/api/tasks.update` | 改标题 / 推进状态 / 绑定会话 |
| `POST /super-ppts/api/tasks.delete` | 删除任务记录与任务目录（不删产物文件） |
| `POST /super-ppts/api/tasks.outline` | 保存大纲（版本自增） |
| `POST /super-ppts/api/tasks.confirmOutline` | 确认大纲版本（版本不符即拒绝） |
| `POST /super-ppts/tasks/upload?taskId=&name=` | 素材流式上传落盘到任务目录 |

Task data lives under `<DSH_HOME>/super-ppts/tasks/`; the routes above mirror the
template store's trust fence and envelope conventions.
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: presentation task data surface (routes + storage layout)"
```

---

## 验收（Plan 1 完成判据）

1. `npm run build && npm run smoke` 全绿，无既有断言回归。
2. `lib/builtin-templates.js` / `lib/tasks.js` 随构建产出，包内自足（零新增依赖）。
3. 任务存储层：创建 / 读取 / 更新 / 删除 / 大纲版本 / 确认版本 / 素材落盘 / 损坏留底 / 索引裁剪 均有断言覆盖。
4. HTTP 面：`tasks.*` 七个方法与素材上传路由均有断言覆盖，错误码符合 `{ok,error:{code,message}}` 信封。
5. `ppts_task` 已注册进插件树（真 cordis + 真 ToolRuntime 加载通过），schema 通过运行时校验器。
6. 能力通告包含任务状态桥说明（`ppts_task` + 大纲确认闸门）。
7. 未改动 `lib/client.js`，面板行为与 1.3.1 一致（无回归）。

## 交给 Plan 2 的冻结契约

Plan 2（client 面板）可直接依赖以下已实现并测试过的接口：

```text
GET  任务数据：POST /super-ppts/api/tasks.list | tasks.get
写入：tasks.create | tasks.update | tasks.delete
大纲：tasks.outline（版本自增）| tasks.confirmOutline（版本必须匹配）
素材：POST /super-ppts/tasks/upload?taskId=&name=（原始流式）
模板：POST /super-ppts/api/templates.list → { templates[], defaultTemplate, prefs, builtinTemplates[] }
```

`TaskRecord` / `TaskStatus` / `Outline` / `TaskMaterial` 类型定义见本计划 Task 2 的 `src/tasks.ts`。
