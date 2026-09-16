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
