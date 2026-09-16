/**
 * 演示任务存储层（host 侧，零 npm 依赖）。
 *
 * 立场（沿用 templates.ts 的存储纪律）：
 * - 单用户低频写入，不做文件锁：全部写入 tmp + rename 原子替换；
 * - 单任务损坏（坏 JSON / 形态不符）改名 *.corrupt-* 留底，列表由索引兜底，
 *   绝不让后续写入用空数据静默覆盖既有记录；
 * - index.json 只是列表缓存，**磁盘任务目录才是真源**：索引缺失 / 损坏 / 条目数少于
 *   「含 task.json 的任务目录」数时从任务目录重建；缓存里磁盘已无真源的条目（幽灵）
 *   在加载时剔除；不做上限裁剪（按 updatedAt 裁剪会让磁盘上存在的任务永久不可见，
 *   且恰好挤出「等待用户确认最久」的任务，与恢复优先级自相矛盾）；
 * - 目录名即 taskId（生成后不可变；重命名只改 task.json 与索引标题）；
 * - 全部路径在 TASKS_ROOT 之下闭合，taskId 与大纲版本号经校验后才拼路径。
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
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

/** 单任务事件上限（防止长期任务把 task.json 撑大）。 */
const MAX_EVENTS = 200

/** 任务标题长度上限（索引每次列表都读标题，超长标题会撑大索引）。 */
export const TITLE_MAX = 120

/** 任务主题长度上限。 */
export const TOPIC_MAX = 500

/** 持久化状态白名单（`draft` 是面板内存态，不入库；见规格「状态 → 恢复落点」）。 */
export const TASK_STATUSES = [
  'creating',
  'waiting-launch',
  'analyzing',
  'waiting-outline',
  'needs-input',
  'building',
  'reviewing',
  'completed',
  'failed',
  'cancelled',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/** 交付形态白名单。 */
export const TASK_FORMATS = ['pptx', 'html'] as const

export type TaskFormat = (typeof TASK_FORMATS)[number]

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
}

function isTaskFormat(value: unknown): value is TaskFormat {
  return typeof value === 'string' && (TASK_FORMATS as readonly string[]).includes(value)
}

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
  format: TaskFormat
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
  format: TaskFormat
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

/** 大纲文件路径；版本号先过值域校验（非正整数拼进文件名可越出 TASKS_ROOT）。 */
export function outlineFile(id: string, version: number): string {
  if (!Number.isInteger(version) || version <= 0) {
    throw new TaskStoreError('bad-request', `非法大纲版本号：${String(version)}`)
  }
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

/** 索引条目形态校验：7 个字段逐一查（消费方直接读它们，缺一个就会静默失序）。 */
function isIndexEntry(item: unknown): item is TaskIndexEntry {
  if (item === null || typeof item !== 'object') return false
  const entry = item as Partial<TaskIndexEntry>
  return typeof entry.id === 'string'
    && typeof entry.title === 'string'
    && typeof entry.status === 'string'
    && isTaskFormat(entry.format)
    && typeof entry.workspaceId === 'string'
    && typeof entry.workspaceName === 'string'
    && typeof entry.createdAt === 'string'
    && typeof entry.updatedAt === 'string'
}

/** 读索引文件；文件缺失 / 损坏返回 null（损坏留底，不抛错）。 */
function readIndexEntries(): TaskIndexEntry[] | null {
  if (!existsSync(TASK_INDEX_FILE)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(TASK_INDEX_FILE, 'utf8'))
    const tasks = (parsed as { tasks?: unknown } | null)?.tasks
    if (!Array.isArray(tasks)) {
      quarantine(TASK_INDEX_FILE)
      return null
    }
    // 不合格条目丢弃（不整份留底）：好条目继续可用，缺的条目由重建补齐。
    return tasks.filter(isIndexEntry)
  } catch {
    quarantine(TASK_INDEX_FILE)
    return null
  }
}

/** 磁盘任务目录名（只认 taskId 白名单内的目录；根不存在即空库）。 */
function taskDirNames(): string[] {
  try {
    return readdirSync(TASKS_ROOT, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && TASK_ID_RE.test(entry.name))
      .map(entry => entry.name)
  } catch {
    return []
  }
}

/**
 * 真源口径：磁盘上「含 task.json」的任务目录名集合。
 * 只做 existsSync 存在性判断、**不解析 JSON**：被 quarantine 掉 task.json 的目录（只剩
 * task.json.corrupt-*）不再计入 —— 否则「缓存条目数 < 目录名数」恒成立，每次 loadIndex
 * 都会全盘解析（缺陷 2）。返回 null = 目录列举失败，真源不可知：调用方保持「出错即用缓存」。
 */
function liveTaskDirs(): Set<string> | null {
  let names: string[]
  try {
    names = readdirSync(TASKS_ROOT, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && TASK_ID_RE.test(entry.name))
      .map(entry => entry.name)
  } catch {
    return null
  }
  return new Set(names.filter(name => existsSync(taskFile(name))))
}

function byUpdatedAtDesc(entries: TaskIndexEntry[]): TaskIndexEntry[] {
  return [...entries].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
}

/**
 * 扫描磁盘任务目录重建索引（真源扫描）。
 * 只认「task.json 存在且形态合规」的目录：被 quarantine 掉 task.json 的目录既不产出条目，
 * 也不该被当成「索引少了条目」，否则每次 loadIndex 都会触发重建（防抖）。
 */
function scanDiskIndex(): TaskIndexEntry[] {
  const entries: TaskIndexEntry[] = []
  for (const name of taskDirNames()) {
    const record = readTaskRecord(name)
    if (record === null) continue
    // 目录名即 taskId：索引 id 必须能回填 taskFile(id)（task.json 内 id 被改过时以目录为准）。
    entries.push({ ...indexEntryOf(record), id: name })
  }
  return byUpdatedAtDesc(entries)
}

/** 重建结果落盘（缓存写失败不阻断读取）。 */
function persistIndex(entries: TaskIndexEntry[]): void {
  try {
    saveIndex({ tasks: entries })
  } catch {
    // 索引只是缓存：落盘失败时内存结果仍然可用
  }
}

/**
 * 读索引。索引只是缓存、磁盘任务目录才是真源：
 * - 文件缺失 / 损坏 → 整份从磁盘重建；
 * - 缓存里 id 在磁盘上已无「含 task.json 的目录」的条目 = 幽灵条目（任务目录被手工删除，
 *   或 task.json 已被 quarantine 改名）→ 加载时剔除并回写索引，否则列表会一直显示一个
 *   loadTask() 返回 null、点不开的任务（缺陷 1）；
 * - 剔除后条目数仍不少于「含 task.json 的目录」数 → 直接用缓存（读取路径不写盘、不解析 JSON）；
 * - 少于 → 从磁盘重建补条目；重建补不出更多时仍用缓存。
 */
export function loadIndex(): TaskIndex {
  const cached = readIndexEntries()
  if (cached === null) {
    // 索引缺失 / 损坏：整份重建（空库不落盘，保持「无任务即无索引文件」）。
    const rebuilt = scanDiskIndex()
    if (rebuilt.length === 0) return emptyIndex()
    persistIndex(rebuilt)
    return { tasks: rebuilt }
  }
  const live = liveTaskDirs()
  // 真源不可知（目录列举失败）时不动缓存：不剔除条目、不重建，与修复前的降级行为一致。
  if (live === null) return { tasks: cached }
  const pruned = cached.filter(entry => live.has(entry.id))
  // 剔除过即回写：不落盘的话幽灵条目下次还会被读出来。
  if (pruned.length !== cached.length) persistIndex(pruned)
  if (pruned.length >= live.size) return { tasks: pruned }
  const rebuilt = scanDiskIndex()
  // 只有重建真能补出更多条目才重建：坏目录（task.json 已留底改名）不算「索引缺条目」。
  if (pruned.length >= rebuilt.length) return { tasks: pruned }
  if (rebuilt.length === 0) return emptyIndex()
  persistIndex(rebuilt)
  return { tasks: rebuilt }
}

export function saveIndex(index: TaskIndex): void {
  writeJsonAtomic(TASK_INDEX_FILE, index)
}

/** 任务记录最小形态：读取侧消费的字段类型必须成立，否则 quarantine（不让裸 TypeError 逃出）。 */
function isTaskRecordShape(value: unknown): value is TaskRecord {
  if (value === null || typeof value !== 'object') return false
  const record = value as Partial<TaskRecord>
  return typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.status === 'string'
    && typeof record.brief?.format === 'string'
    && typeof record.workspace?.id === 'string'
}

/**
 * 读单个任务记录（纯读 + 形态校验；不碰索引，故与 loadIndex 的重建互不递归）。
 * 缺失 / 损坏返回 null：坏数据改名 *.corrupt-* 留底，绝不让后续写入静默覆盖。
 */
function readTaskRecord(id: string): TaskRecord | null {
  const file = taskFile(id)
  if (!existsSync(file)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (!isTaskRecordShape(parsed)) {
      quarantine(file)
      return null
    }
    const record = parsed
    return {
      ...record,
      materials: Array.isArray(record.materials) ? record.materials : [],
      events: Array.isArray(record.events) ? record.events : [],
      artifacts: Array.isArray(record.artifacts) ? record.artifacts : [],
      outlineVersion: Number.isInteger(record.outlineVersion) ? record.outlineVersion : 0,
    }
  } catch {
    quarantine(file)
    return null
  }
}

/** 读任务详情；缺失或损坏返回 null（列表由索引兜底）。 */
export function loadTask(id: string): TaskRecord | null {
  return readTaskRecord(id)
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
    // 索引条目必须始终是合法值：不合格条目下次 load 会被谓词丢弃，
    // 手改过 format 的记录不能让任务从列表里静默消失，故非法值一律兜底为 pptx。
    format: task.brief?.format === 'html' ? 'html' : 'pptx',
    workspaceId: typeof task.workspace?.id === 'string' ? task.workspace.id : '',
    workspaceName: typeof task.workspace?.name === 'string' ? task.workspace.name : '',
    createdAt: typeof task.createdAt === 'string' ? task.createdAt : '',
    updatedAt: typeof task.updatedAt === 'string' ? task.updatedAt : '',
  }
}

/** 写任务详情并同步索引（无损：不裁剪条目，条目数 === 磁盘任务目录数）。 */
export function saveTask(task: TaskRecord): TaskRecord {
  writeJsonAtomic(taskFile(task.id), task)
  const others = loadIndex().tasks.filter(item => item.id !== task.id)
  saveIndex({ tasks: byUpdatedAtDesc([indexEntryOf(task), ...others]) })
  return task
}

export interface CreateTaskInput {
  title: string
  brief: TaskBrief
  workspace: TaskWorkspace
  status?: TaskStatus
}

/** 创建任务：先校验再写盘（写失败回收空目录，不留孤儿）。 */
export function createTask(input: CreateTaskInput): TaskRecord {
  const title = String(input.title ?? '').trim()
  if (title === '') throw new TaskStoreError('bad-request', '任务标题不能为空')
  if (title.length > TITLE_MAX) {
    throw new TaskStoreError('bad-request', `任务标题过长（≤ ${TITLE_MAX} 字）`)
  }
  const topic = String(input.brief?.topic ?? '').trim()
  if (topic === '') throw new TaskStoreError('bad-request', '任务主题不能为空')
  if (topic.length > TOPIC_MAX) {
    throw new TaskStoreError('bad-request', `任务主题过长（≤ ${TOPIC_MAX} 字）`)
  }
  if (!isTaskFormat(input.brief?.format)) {
    throw new TaskStoreError('bad-request', `未知交付形态：${String(input.brief?.format)}（限 ${TASK_FORMATS.join(' / ')}）`)
  }
  const status = input.status ?? 'creating'
  if (!isTaskStatus(status)) {
    throw new TaskStoreError('bad-request', `未知任务状态：${String(status)}`)
  }
  const now = new Date().toISOString()
  const task: TaskRecord = {
    id: newTaskId(),
    title,
    status,
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
    if (title.length > TITLE_MAX) {
      throw new TaskStoreError('bad-request', `任务标题过长（≤ ${TITLE_MAX} 字）`)
    }
    task.title = title
  }
  let statusChanged = false
  if (patch.status !== undefined) {
    if (!isTaskStatus(patch.status)) {
      throw new TaskStoreError('bad-request', `未知任务状态：${String(patch.status)}`)
    }
    if (patch.status !== task.status) {
      task.status = patch.status
      statusChanged = true
    }
  }
  if (patch.stage !== undefined) {
    if (patch.stage === null) delete task.stage
    else task.stage = patch.stage
  }
  if (patch.sessionId !== undefined) {
    if (patch.sessionId === null) delete task.sessionId
    else task.sessionId = String(patch.sessionId)
  }
  if (patch.brief !== undefined) {
    // 只合并「显式给出」的键：undefined 不是 null——null = 不使用模板（要落盘），
    // undefined = 跟随默认模板（不得写键，写了会被 JSON.stringify 丢掉，静默变成跟随默认）。
    const merged: Record<string, unknown> = { ...task.brief }
    for (const [key, value] of Object.entries(patch.brief)) {
      if (value === undefined) continue
      merged[key] = value
    }
    const topic = typeof merged.topic === 'string' ? merged.topic.trim() : ''
    if (topic === '') throw new TaskStoreError('bad-request', '任务主题不能为空')
    if (topic.length > TOPIC_MAX) {
      throw new TaskStoreError('bad-request', `任务主题过长（≤ ${TOPIC_MAX} 字）`)
    }
    if (!isTaskFormat(merged.format)) {
      throw new TaskStoreError('bad-request', `未知交付形态：${String(merged.format)}（限 ${TASK_FORMATS.join(' / ')}）`)
    }
    merged.topic = topic
    task.brief = merged as unknown as TaskBrief
  }
  if (statusChanged) pushEvent(task, 'status', `状态 → ${task.status}`)
  task.updatedAt = new Date().toISOString()
  return saveTask(task)
}

function pushEvent(task: TaskRecord, kind: string, text: string): void {
  const now = new Date().toISOString()
  task.events = [...task.events, { at: now, kind, text }].slice(-MAX_EVENTS)
  task.updatedAt = now
}

export function appendEvent(id: string, kind: string, text: string): TaskRecord {
  const task = requireTask(id)
  pushEvent(task, kind, text)
  return saveTask(task)
}

/**
 * 保存大纲：版本号自增、落盘 outline-vN.json、任务转 waiting-outline。
 * 规范化在存储层完成（页面 id 缺失即补、标题为空即兜底），保证读侧形态稳定。
 * 契约：生成新版本时调用方**须回传既有页 id**（只改内容不换 id，新增页才给新 id）——
 * 页 id 是「按 id 编辑某页」的唯一句柄，同版本内必须唯一。
 */
export function saveOutline(id: string, pages: OutlinePage[]): TaskRecord {
  const task = requireTask(id)
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new TaskStoreError('bad-request', '大纲至少需要一页')
  }
  const version = task.outlineVersion + 1
  const normalized: OutlinePage[] = pages.map((page, index) => {
    const rawId = typeof page?.id === 'string' ? page.id.trim() : ''
    return {
      id: rawId === '' ? `p${index + 1}` : rawId,
      title: String(page?.title ?? '').trim() || `第 ${index + 1} 页`,
      purpose: page?.purpose === undefined ? undefined : String(page.purpose),
      bullets: Array.isArray(page?.bullets) ? page.bullets.map(item => String(item)) : [],
      pageType: page?.pageType === undefined ? undefined : String(page.pageType),
    }
  })
  // 页 id 重复即拒绝：同版本内两个 p1 会让后续「按 id 编辑某页」无法消歧。
  const seen = new Set<string>()
  for (const page of normalized) {
    if (seen.has(page.id)) {
      throw new TaskStoreError('bad-request', `大纲页 id 重复：${page.id}`)
    }
    seen.add(page.id)
  }
  const outline: Outline = { version, pages: normalized }
  writeJsonAtomic(outlineFile(id, version), outline)
  task.outline = outline
  task.outlineVersion = version
  task.status = 'waiting-outline'
  delete task.confirmedOutlineVersion
  pushEvent(task, 'outline', `已生成大纲 v${version}（${outline.pages.length} 页），等待确认`)
  return saveTask(task)
}

/** 确认大纲；版本不符即拒绝（防串版本确认；v0 = 尚无大纲，不可确认）。 */
export function confirmOutline(id: string, version: number): TaskRecord {
  const task = requireTask(id)
  const target = Number(version)
  if (!Number.isInteger(target) || target <= 0 || target !== task.outlineVersion) {
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
  const known = index.tasks.some(item => item.id === target)
  const onDisk = existsSync(taskDir(target))
  // 索引与目录都不存在 = 真没这个任务：抛 not-found，让下游能区分 404 与删除成功。
  if (!known && !onDisk) throw new TaskStoreError('not-found', `任务不存在：${target}`)
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
  try {
    // 流式写有长窗口：必须在**新记录**上合并——沿用流开始前读到的旧记录整份回写，
    // 会静默吃掉流中途发生的 updateTask / appendEvent 等更新。
    const fresh = requireTask(taskId)
    fresh.materials = [...fresh.materials, material]
    pushEvent(fresh, 'material', `素材已上传：${name}`)
    saveTask(fresh)
  } catch (error) {
    // 登记失败：素材文件已落盘但没进索引 = 孤儿，删掉（对照 templates.ts 的 addTemplate 回滚纪律）。
    try { rmSync(target, { force: true }) } catch { /* 兜底清理 */ }
    throw error instanceof TaskStoreError ? error : new TaskStoreError('fs-error', String(error))
  }
  return { name: material.name, size: material.size, path: material.path }
}
