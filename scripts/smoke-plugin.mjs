#!/usr/bin/env node
/**
 * dsh-super-ppts 插件冒烟测试（零依赖，node scripts/smoke-plugin.mjs）。
 *
 * 覆盖两处交付面：
 * 1. host：templates.ts 存储层 + routes.ts HTTP 面（mock req/res 全流程：
 *    上传 → 列表 → 重命名 → 设默认 → 偏好更新 → 删除）；
 * 2. client：lib/client.js 的 ModuleLoader 自注册形态（stub React +
 *    stub ctx.slots/ctx.locale，断言 settings.section 注册参数）；
 * 3. 混合交付：embed_animation.py 的 GIF/快照嵌入与超链接 rel
 *    （系统 python3 + python-pptx 不可用时自动 SKIP，不计失败）。
 *
 * 隔离：HOME 重定向到临时目录，测试不触碰真实 ~/.dsh/super-ppts。
 */
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'

const packageRoot = dirname(fileURLToPath(import.meta.url)) + '/..'

// dsh 运行时 node_modules 定位：优先 DSH_RUNTIME_NODE_MODULES 覆盖；未设时回落本机
// KCoder 安装位（换机器路径不存在 → 自动退回手写 schema 遍历兜底，弱化但不缺失）。
const RUNTIME_NODE_MODULES = process.env.DSH_RUNTIME_NODE_MODULES
  ?? '/Users/libing/Library/Application Support/KCoder/kcoder-runtime/node_modules'

let failures = 0
const REAL_HOME = process.env.HOME // host/client 测试会重定向 HOME；python 用户站点（pip --user）依赖真实 HOME
function check(name, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL'
  console.log(`\x1b[${condition ? 32 : 31}m${mark}\x1b[0m  ${name}${detail ? ' — ' + detail : ''}`)
  if (!condition) failures += 1
}

/* ═══ 1. host 侧：存储 + 路由 ═══ */

const fakeHome = mkdtempSync(join(tmpdir(), 'ppts-smoke-'))
process.env.HOME = fakeHome
// 关键隔离：本机 shell 可能带着全局 DSH_HOME（如 KCoder 桌面端 ~/.kcoder）。
// 存储根现在跟随 $DSH_HOME，不先删掉它冒烟就会读写真实用户数据（教训：2026-09-16）。
delete process.env.DSH_HOME

const { registerPptsRoutes } = await import('../lib/routes.js')
const { addTemplate, loadRegistry, REGISTRY_FILE } = await import('../lib/templates.js')

// mock ctx：收集注册的路由；effect 记录 disposer
const routes = new Map()
const effects = []
const ctx = {
  webServer: {
    register(route) {
      routes.set(route.kind === 'exact' ? route.path : route.path + '/*', route.handler)
      return () => routes.delete(route.kind === 'exact' ? route.path : route.path + '/*')
    },
  },
  effect(fn, name) { effects.push(name); const d = fn(); return d },
  get() { return undefined },
}

const disposeRoutes = registerPptsRoutes(ctx, { uploadLimitBytes: 10 * 1024 * 1024 })
check('路由已注册（api + upload + tasks/upload）',
  routes.has('/super-ppts/api/*') && routes.has('/super-ppts/upload') && routes.has('/super-ppts/tasks/upload'))
check('effect 已登记', effects.length === 3)

function mockRes() {
  return new Promise((resolve) => {
    const chunks = []
    const res = {
      writeHead(status, headers) { res._status = status; res._headers = headers },
      end(body) { chunks.push(body); resolve({ status: res._status, body: chunks.join('') }) },
    }
    return res
  })
}

async function callApi(method, payload) {
  const handler = routes.get('/super-ppts/api/*')
  const req = {
    method: 'POST',
    url: '/super-ppts/api/' + method,
    headers: { host: '127.0.0.1:60864' },
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(payload ?? {}), 'utf8') },
  }
  const res = await (async () => { let resolveRes; const p = new Promise(r => resolveRes = r); 
    const mocked = {
      writeHead(status) { mocked._status = status },
      end(body) { resolveRes({ status: mocked._status, body }) },
    }
    await handler(req, mocked)
    return p
  })()
  return { status: res.status, json: JSON.parse(res.body) }
}

// 信任围栏：loopback 放行、跨站 Host 拒绝
{
  const api = routes.get('/super-ppts/api/*')
  const req = { method: 'POST', url: '/super-ppts/api/templates.list', headers: { host: 'evil.example' }, async *[Symbol.asyncIterator]() {} }
  let captured
  const res = { writeHead(s) { captured = s }, end(body) { captured = [captured, body] } }
  await api(req, res)
  check('围栏拒绝非 loopback Host（403）', Array.isArray(captured) && captured[0] === 403)
}

// 未知 method → 404
{
  const r = await callApi('nope.nothing', {})
  check('未知 API method → 404', r.status === 404 && r.json.ok === false)
}

// 上传：PK 魔数 + 载荷
async function upload(name, description, body, expectOk) {
  const handler = routes.get('/super-ppts/upload')
  const req = {
    method: 'POST',
    url: '/super-ppts/upload?name=' + encodeURIComponent(name) + '&description=' + encodeURIComponent(description),
    headers: { host: '127.0.0.1:60864' },
    async *[Symbol.asyncIterator]() { yield body },
  }
  let resolveRes
  const p = new Promise(r => resolveRes = r)
  const mocked = { writeHead(s) { mocked._status = s }, end(b) { resolveRes({ status: mocked._status, body: b }) } }
  await handler(req, mocked)
  const result = await p
  return { status: result.status, json: JSON.parse(result.body), expectOk }
}

// 最小伪 pptx：PK 魔数 + 填充 + 22 字节 EOCD（PK\x05\x06，上传 zip 粗校验所需）
const eocd = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)])
const pptxBytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2048, 7), eocd])
{
  const r = await upload('品牌模板A', '深蓝商务风', pptxBytes)
  check('上传成功（200，ok 信封）', r.status === 200 && r.json.ok === true && r.json.value.name === '品牌模板A')
}
{
  const r = await upload('非PPTX', '', Buffer.alloc(64, 1))
  check('非 zip 魔数拒绝（bad-request）', r.status === 400 && r.json.error?.code === 'bad-request')
}
{
  const r = await upload('品牌模板A', '', pptxBytes)
  check('重名上传拒绝（conflict）', r.status === 409 && r.json.error?.code === 'conflict')
}
{
  const r = await upload('', '', pptxBytes)
  check('空名称拒绝（bad-request）', r.status === 400)
}
{
  const r = await upload('无EOCD', '', Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2048, 1)]))
  check('zip 结构不完整拒绝（EOCD 粗校验）', r.status === 400 && r.json.error?.code === 'bad-request')
}

// templates.list
{
  const r = await callApi('templates.list', {})
  const value = r.json.value
  check('templates.list 返回清单', r.json.ok && Array.isArray(value.templates) && value.templates.length === 1)
  check('prefs 默认值齐备', value.prefs.defaultFormat === 'ask' && value.prefs.renderReview === 'deliverable-only')
}

// rename + setDefault + prefs.update + delete
{
  const list = (await callApi('templates.list', {})).json.value
  const id = list.templates[0].id
  let r = await callApi('templates.rename', { id, name: '品牌模板B', description: '更新后的描述' })
  check('重命名成功', r.json.ok && r.json.value.name === '品牌模板B')
  r = await callApi('templates.setDefault', { id })
  check('设默认成功', r.json.ok && r.json.value.defaultTemplate === id)
  r = await callApi('prefs.update', { patch: { defaultFormat: 'pptx', styleNotes: '多用图表' } })
  check('偏好更新成功（返回更新后的 prefs）', r.json.ok && r.json.value.defaultFormat === 'pptx' && r.json.value.styleNotes === '多用图表')
  r = await callApi('prefs.update', { patch: { defaultFormat: 'bogus' } })
  check('非法偏好值拒绝', r.json.ok === false && r.status === 400)
  r = await callApi('templates.delete', { id })
  check('删除成功且默认引用清理', r.json.ok && (await callApi('templates.list', {})).json.value.defaultTemplate === null)
  const filePath = join(fakeHome, '.dsh', 'super-ppts', 'templates')
  check('删除后模板目录无残留 .pptx', !existsSync(join(filePath, id + '.pptx')))
}

// 存储层直查：清单原子性（存在且可解析）
{
  const registry = JSON.parse(readFileSync(REGISTRY_FILE, 'utf8'))
  check('清单 JSON 合法（原子写）', Array.isArray(registry.templates) && registry.templates.length === 0)
}

// 存储层韧性：清单损坏（坏 JSON / 形态不对）读取时留底 .corrupt-*，
// 不被后续 saveRegistry 用空数据静默覆盖（回归：audit #2）
{
  writeFileSync(REGISTRY_FILE, '{oops 坏 JSON', 'utf8')
  const bad = loadRegistry()
  check('坏 JSON 回落空库（不抛错）', Array.isArray(bad.templates) && bad.templates.length === 0)
  writeFileSync(REGISTRY_FILE, '{"templates": 42}', 'utf8')
  const wrongShape = loadRegistry()
  check('形态不对（templates 非数组）回落空库（不抛错）', Array.isArray(wrongShape.templates) && wrongShape.templates.length === 0)
  const backups = readdirSync(join(fakeHome, '.dsh', 'super-ppts')).filter(n => n.startsWith('registry.json.corrupt-'))
  check('损坏清单留底 .corrupt-*（2 份）', backups.length === 2, backups.join(', ').slice(0, 120))
  check('留底后 registry.json 已让位（可安全重写）', !existsSync(REGISTRY_FILE))
}

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
  const materialsBefore = readdirSync(tasksMod.materialsDir(task.id)).length
  try {
    await tasksMod.writeMaterial(task.id, 'empty.txt', (async function* () { /* 空流：0 chunk */ })(), 1024)
  } catch (error) { emptyRejected = error.code === 'bad-request' }
  check('空素材被拒绝且不留半截文件',
    emptyRejected && readdirSync(tasksMod.materialsDir(task.id)).length === materialsBefore)

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

  // 索引无损：55 > 旧的 50 条上限。旧实现按 updatedAt 裁剪索引，会把最早的任务挤出且永久不可见。
  const BULK_TASKS = 55
  const bulkIds = []
  for (let i = 0; i < BULK_TASKS; i += 1) {
    bulkIds.push(tasksMod.createTask({
      title: '批量 ' + i,
      brief: { topic: 't', format: 'pptx' },
      workspace: { id: 'w', name: 'w', path: '/p' },
    }).id)
  }
  // 真源口径：只数「含 task.json」的目录。上方「损坏任务」的 task.json 已被 quarantine 改名，
  // 该目录不再是索引真源 —— 旧口径（数全部目录）把它的幽灵条目算进等式，恰好让等式成立。
  const diskTaskDirs = readdirSync(tasksMod.TASKS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(tasksMod.TASKS_ROOT, entry.name, 'task.json'))).length
  const indexEntries = tasksMod.loadIndex().tasks.length
  check('索引无损（条目数 === 磁盘任务目录数，不再按上限裁剪）',
    indexEntries === diskTaskDirs, `index=${indexEntries} disk=${diskTaskDirs}`)
  check('曾被挤出索引的早期任务仍可见（listTasks 全量返回）',
    tasksMod.listTasks().some(item => item.id === bulkIds[0]))

  // 可区分场景：更新的 creating 任务 vs 更旧的 waiting-outline 任务。
  // 若优先级表被旁路、退化成纯时间排序，creating 会排在前 —— 这条断言才有鉴别力。
  const waiting = tasksMod.createTask({
    title: '待确认',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  tasksMod.saveOutline(waiting.id, [{ title: '第一页' }])
  const fresh = tasksMod.createTask({
    title: '更新但无需用户处理',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  // saveOutline 会把 updatedAt 刷成当前时间：用 saveTask 把「等待确认」压成更旧的时间戳，
  // 否则两个任务时间相近，断言会被「时间新」蒙过。
  const staleStamp = new Date(Date.now() - 3600_000).toISOString()
  tasksMod.saveTask({ ...tasksMod.requireTask(waiting.id), updatedAt: staleStamp })
  const priority = tasksMod.listTasks()
  const freshEntry = priority.find(item => item.id === fresh.id)
  check('列表按恢复优先级排序（更旧的 waiting-outline 排在更新的 creating 之前）',
    priority[0]?.id === waiting.id && priority[0]?.status === 'waiting-outline'
      && freshEntry?.updatedAt > staleStamp,
    `top=${priority[0]?.status}@${priority[0]?.updatedAt} / creating@${freshEntry?.updatedAt}`)

  const target = tasksMod.createTask({
    title: '待删除',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  const targetDir = tasksMod.taskDir(target.id)
  tasksMod.deleteTask(target.id)
  check('deleteTask 移除索引与任务目录',
    !existsSync(targetDir) && !tasksMod.loadIndex().tasks.some(item => item.id === target.id))

  // index.json 损坏留底分支（此前零覆盖）：写坏 → 不抛错、留底 *.corrupt-*、从磁盘任务目录重建
  const probe = tasksMod.createTask({
    title: '索引重建探针',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  writeFileSync(tasksMod.TASK_INDEX_FILE, '{oops 坏索引', 'utf8')
  let indexSurvived = true
  let recovered = { tasks: [] }
  try { recovered = tasksMod.loadIndex() } catch { indexSurvived = false }
  check('index.json 损坏 → 留底 *.corrupt-* 并从磁盘任务目录重建',
    indexSurvived && recovered.tasks.some(item => item.id === probe.id)
      && readdirSync(tasksMod.TASKS_ROOT).some(name => name.startsWith('index.json.corrupt-')),
    `rebuilt=${recovered.tasks.length}`)
}

// 幽灵条目：手工删掉任务目录后，索引里的条目必须在下次 loadIndex 被剔除并回写。
// 反例（修复前）：缓存条目数 >= 目录名数 判定命中快路径，幽灵条目留在列表里，
// 而 loadTask(它) 恒为 null —— 面板上多出一个点不开的任务。
{
  const ghost = tasksMod.createTask({
    title: '手工删目录探针',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  check('前置：新任务已进索引与列表',
    tasksMod.loadIndex().tasks.some(item => item.id === ghost.id)
      && tasksMod.listTasks().some(item => item.id === ghost.id))

  rmSync(tasksMod.taskDir(ghost.id), { recursive: true, force: true })
  const reloaded = tasksMod.loadIndex()
  const persisted = JSON.parse(readFileSync(tasksMod.TASK_INDEX_FILE, 'utf8'))
  check('幽灵条目（任务目录已手工删除）在 loadIndex 时被剔除并回写索引',
    !reloaded.tasks.some(item => item.id === ghost.id)
      && !tasksMod.listTasks().some(item => item.id === ghost.id)
      && !persisted.tasks.some(item => item.id === ghost.id),
    `reloaded=${reloaded.tasks.length} persisted=${persisted.tasks.length}`)
}

// 真源计数口径：只有「含 task.json 的目录」才算索引真源，无 task.json 的残留目录（quarantine
// 后的目录、空目录）不得触发全盘扫描。见证物：全盘扫描会解析每个 task.json，并对坏 JSON 做
// quarantine 留底 —— 快路径完全不碰文件，故坏 task.json 必须原样留在磁盘上。
{
  const healthy = tasksMod.createTask({
    title: '口径探针（健康）',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  const laterBroken = tasksMod.createTask({
    title: '口径探针（task.json 将写坏）',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  // 模拟 quarantine 残留：有目录、无 task.json（旧口径把它计进「目录数」→ 每次 load 全盘重建）
  mkdirSync(join(tasksMod.TASKS_ROOT, 'kresiduereadme'), { recursive: true })
  // 坏 JSON 但文件仍在：该目录仍计入真源口径，此时索引条目数 === 含 task.json 的目录数
  writeFileSync(tasksMod.taskFile(laterBroken.id), '{oops 坏 JSON', 'utf8')
  const dirsWithJson = readdirSync(tasksMod.TASKS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(tasksMod.TASKS_ROOT, entry.name, 'task.json'))).length
  const allDirs = readdirSync(tasksMod.TASKS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).length
  const listed = tasksMod.listTasks()
  const jsonIntact = existsSync(tasksMod.taskFile(laterBroken.id))
  check('真源口径 = 含 task.json 的目录数 → 无 task.json 的残留目录不再触发全盘扫描',
    listed.length === dirsWithJson && allDirs > dirsWithJson && jsonIntact
      && listed.some(item => item.id === healthy.id) && listed.some(item => item.id === laterBroken.id),
    `index=${listed.length} withJson=${dirsWithJson} allDirs=${allDirs} brokenJsonIntact=${jsonIntact}`)
}

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

  // workspace 不再兜底空串 id（否则该任务过滤不到也修不了）→ 与 brief 同款 400
  const badWorkspace = await callApi('tasks.create', { title: '缺 workspace', brief: { topic: 't', format: 'pptx' } })
  check('tasks.create 缺 workspace → 400 bad-request',
    badWorkspace.status === 400 && badWorkspace.json.error?.code === 'bad-request',
    `status=${badWorkspace.status} code=${badWorkspace.json.error?.code}`)

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

  // method/host 可覆盖：本路由的信任围栏与方法守卫要靠这里反向验证（围栏或守卫
  // 被漏拷时冒烟必须变红）。body 传 null 即空 async iterator——405/403 分支不消费
  // 请求体，无需也不能喂载荷（避免挂起）。
  async function callMaterialUpload(url, body, { method = 'POST', host = '127.0.0.1:60864' } = {}) {
    const handler = routes.get('/super-ppts/tasks/upload')
    const req = {
      method,
      url,
      headers: { host },
      async *[Symbol.asyncIterator]() { if (body !== null) yield body },
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

  // 信任围栏：非 loopback Host 一律 403（与 /super-ppts/api 同款 fenceRequest）
  const fenced = await callMaterialUpload('/super-ppts/tasks/upload?taskId=x&name=x.txt', null, { host: 'evil.example' })
  check('素材路由围栏拒绝非 loopback Host（403 forbidden）',
    fenced.status === 403 && fenced.json.error?.code === 'forbidden',
    `status=${fenced.status} code=${fenced.json.error?.code}`)

  // 方法守卫：非 POST → 405（与 /super-ppts/api、/super-ppts/upload 同款）
  const wrongMethod = await callMaterialUpload('/super-ppts/tasks/upload?taskId=x&name=x.txt', null, { method: 'GET' })
  check('素材路由非 POST → 405 method-error',
    wrongMethod.status === 405 && wrongMethod.json.error?.code === 'method-error',
    `status=${wrongMethod.status} code=${wrongMethod.json.error?.code}`)

  const uploaded = await callMaterialUpload(
    '/super-ppts/tasks/upload?taskId=' + encodeURIComponent(id) + '&name=' + encodeURIComponent('数据.xlsx'),
    Buffer.alloc(2048, 5),
  )
  check('素材上传成功并登记到任务', uploaded.status === 200 && uploaded.json.ok && uploaded.json.value.name === '数据.xlsx')

  const badTask = await callMaterialUpload('/super-ppts/tasks/upload?taskId=nope-000000&name=x.txt', Buffer.alloc(16, 1))
  check('未知任务素材上传 → 404', badTask.status === 404)
}

/* ═══ 1.8 内置模板随清单下发 ═══ */
{
  const result = await callApi('templates.list', {})
  check('templates.list 附带 builtinTemplates（≥ 4）',
    result.json.ok && Array.isArray(result.json.value.builtinTemplates) && result.json.value.builtinTemplates.length >= 4)
  check('内置模板带 source 标识',
    result.json.value.builtinTemplates.every(item => item.source === 'builtin' && typeof item.name === 'string'))
  check('用户模板字段口径不变（templates 仍为数组）', Array.isArray(result.json.value.templates))

  // 路由面（Task 3 已落地）与工具面是两条独立下发路径：上面的 callApi 走
  // /super-ppts/api，这里补一条 runTemplates（ppts_templates 的 execute 本体）
  // 断言，避免「路由绿了、工具没带」这种单边回归漏网。
  const toolList = (await import('../lib/tools.js')).runTemplates({ action: 'list' })
  check('ppts_templates（工具面）list 附带 builtinTemplates（≥ 4）',
    toolList.ok === true && Array.isArray(toolList.builtinTemplates) && toolList.builtinTemplates.length >= 4,
    `ok=${toolList.ok} builtin=${Array.isArray(toolList.builtinTemplates) ? toolList.builtinTemplates.length : typeof toolList.builtinTemplates}`)
}

/* ═══ 1.9 素材变更面（删除 / 状态）+ 产物存在性投影 ═══ */
{
  // —— 存储层：removeMaterial（记录先一致、文件清理尽力而为）——
  const store = tasksMod.createTask({
    title: '素材删除',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  const doomed = await tasksMod.writeMaterial(
    store.id, '待删.xlsx',
    (async function* () { yield Buffer.alloc(512, 4) })(),
    1024 * 1024,
  )
  const doomedId = tasksMod.loadTask(store.id).materials.find(item => item.name === '待删.xlsx').id
  const removed = tasksMod.removeMaterial(store.id, doomedId)
  check('removeMaterial 从记录中摘除素材',
    removed.materials.length === 0 && !removed.materials.some(item => item.id === doomedId))
  check('removeMaterial 删除素材文件（磁盘已无残留）', !existsSync(doomed.path))
  check('removeMaterial 记录落盘一致（loadTask 反映为空）', tasksMod.loadTask(store.id).materials.length === 0)

  let removeNotFound = false
  try { tasksMod.removeMaterial(store.id, 'm000000000') } catch (error) { removeNotFound = error.code === 'not-found' }
  check('removeMaterial 未知 materialId → not-found', removeNotFound)

  // —— 存储层：setMaterialStatus（error 写原因、ready 清原因）——
  await tasksMod.writeMaterial(
    store.id, '解析.xlsx',
    (async function*() { yield Buffer.alloc(256, 6) })(),
    1024 * 1024,
  )
  const parsedId = tasksMod.loadTask(store.id).materials.find(item => item.name === '解析.xlsx').id
  const errored = tasksMod.setMaterialStatus(store.id, parsedId, 'error', '第 3 行缺列：无法解析')
  check('setMaterialStatus 报 error：状态与原因落盘',
    errored.materials[0].status === 'error' && errored.materials[0].error === '第 3 行缺列：无法解析'
      && tasksMod.loadTask(store.id).materials[0].error === '第 3 行缺列：无法解析')
  const restored = tasksMod.setMaterialStatus(store.id, parsedId, 'ready')
  check('setMaterialStatus 报 ready：error 字段被清除（不留过期报错）',
    restored.materials[0].status === 'ready' && restored.materials[0].error === undefined
      && tasksMod.loadTask(store.id).materials[0].error === undefined)

  let badMaterialStatus = false
  try { tasksMod.setMaterialStatus(store.id, parsedId, 'bogus') } catch (error) { badMaterialStatus = error.code === 'bad-request' }
  check('setMaterialStatus 非法状态 → bad-request', badMaterialStatus)

  let statusNotFound = false
  try { tasksMod.setMaterialStatus(store.id, 'm000000000', 'ready') } catch (error) { statusNotFound = error.code === 'not-found' }
  check('setMaterialStatus 未知 materialId → not-found', statusNotFound)

  // —— 路由面：tasks.materialDelete / tasks.materialStatus ——
  const routed = await callApi('tasks.create', {
    title: '素材路由变更',
    brief: { topic: 't', format: 'pptx' },
    workspace: { id: 'w', name: 'w', path: '/p' },
  })
  const routeId = routed.json.value.id

  const routeFile = await tasksMod.writeMaterial(
    routeId, '路由素材.txt',
    (async function*() { yield Buffer.alloc(128, 8) })(),
    1024 * 1024,
  )
  const routeMaterialId = tasksMod.loadTask(routeId).materials[0].id
  const deletedRoute = await callApi('tasks.materialDelete', { id: routeId, materialId: routeMaterialId })
  check('tasks.materialDelete 成功：返回更新后的记录且文件已删',
    deletedRoute.status === 200 && deletedRoute.json.ok === true
      && deletedRoute.json.value.materials.length === 0 && !existsSync(routeFile.path),
    `status=${deletedRoute.status} materials=${deletedRoute.json.value?.materials?.length}`)
  const deleteMissing = await callApi('tasks.materialDelete', { id: routeId, materialId: routeMaterialId })
  check('tasks.materialDelete 未知素材 → 404 not-found',
    deleteMissing.status === 404 && deleteMissing.json.error?.code === 'not-found',
    `status=${deleteMissing.status} code=${deleteMissing.json.error?.code}`)

  const routeFile2 = await tasksMod.writeMaterial(
    routeId, '路由状态.txt',
    (async function*() { yield Buffer.alloc(64, 9) })(),
    1024 * 1024,
  )
  const routeMaterialId2 = tasksMod.loadTask(routeId).materials[0].id
  const statusRoute = await callApi('tasks.materialStatus', {
    id: routeId, materialId: routeMaterialId2, status: 'error', error: '编码不支持',
  })
  check('tasks.materialStatus 成功：状态与原因写入记录',
    statusRoute.status === 200 && statusRoute.json.ok === true
      && statusRoute.json.value.materials[0].status === 'error'
      && statusRoute.json.value.materials[0].error === '编码不支持',
    `status=${statusRoute.status} materialStatus=${statusRoute.json.value?.materials?.[0]?.status}`)
  const statusBad = await callApi('tasks.materialStatus', { id: routeId, materialId: routeMaterialId2, status: 'bogus' })
  check('tasks.materialStatus 非法 status → 400 bad-request',
    statusBad.status === 400 && statusBad.json.error?.code === 'bad-request',
    `status=${statusBad.status} code=${statusBad.json.error?.code}`)
  const statusMissing = await callApi('tasks.materialStatus', { id: routeId, materialId: 'm000000000', status: 'ready' })
  check('tasks.materialStatus 未知素材 → 404 not-found', statusMissing.status === 404)

  // —— 路由面：tasks.list 的 status 白名单（拼错不再静默返回空列表）——
  const badListStatus = await callApi('tasks.list', { status: 'buiding' })
  check('tasks.list 非法 status → 400 bad-request',
    badListStatus.status === 400 && badListStatus.json.error?.code === 'bad-request',
    `status=${badListStatus.status} tasks=${JSON.stringify(badListStatus.json.value?.tasks ?? null).slice(0, 40)}`)
  const goodListStatus = await callApi('tasks.list', { status: 'creating' })
  check('tasks.list 合法 status 仍可过滤',
    goodListStatus.status === 200 && goodListStatus.json.ok === true && Array.isArray(goodListStatus.json.value.tasks))

  // —— 路由面：tasks.get 的产物存在性只读投影 ——
  const ghostArtifact = join(fakeHome, 'never-generated.pptx')
  const liveArtifact = join(fakeHome, 'generated.pdf')
  writeFileSync(liveArtifact, 'pdf-bytes')
  tasksMod.addArtifact(routeId, { type: 'pptx', path: ghostArtifact, status: 'ready' })
  tasksMod.addArtifact(routeId, { type: 'pdf', path: liveArtifact, status: 'ready' })
  const projected = (await callApi('tasks.get', { id: routeId })).json.value
  const ghostProjected = projected.artifacts.find(item => item.type === 'pptx')
  const liveProjected = projected.artifacts.find(item => item.type === 'pdf')
  check('tasks.get 产物存在性投影：文件缺失 → missing',
    ghostProjected?.status === 'missing', `status=${ghostProjected?.status}`)
  check('tasks.get 产物存在性投影：文件在位 → ready', liveProjected?.status === 'ready')
  check('产物投影是只读的（磁盘仍为 ready，未写回 missing）',
    tasksMod.loadTask(routeId).artifacts.find(item => item.type === 'pptx')?.status === 'ready')

  // —— 工具面：ppts_task 的 material 回报与未知 action ——
  const { runTask } = await import('../lib/tools.js')
  const reported = runTask({
    action: 'material', taskId: routeId, materialId: routeMaterialId2,
    materialStatus: 'error', detail: '工具面：编码不支持',
  })
  check('ppts_task material 回报素材状态（工具面 → 存储层）',
    reported.ok === true && reported.materialId === routeMaterialId2 && reported.materialStatus === 'error'
      && tasksMod.loadTask(routeId).materials[0].error === '工具面：编码不支持',
    `ok=${reported.ok} message=${String(reported.message).slice(0, 60)}`)
  const typedBack = runTask({ action: 'material', taskId: routeId, materialId: routeMaterialId2, materialStatus: 'ready' })
  check('ppts_task material 报 ready 时清除原因',
    typedBack.ok === true && tasksMod.loadTask(routeId).materials[0].error === undefined)

  const unknownAction = runTask({ action: 'nope', taskId: routeId })
  check('ppts_task 未知 action → ok:false（不再静默等同 get）',
    unknownAction.ok === false && /未知 action/.test(unknownAction.message) && unknownAction.message.includes('nope'),
    `ok=${unknownAction.ok} message=${String(unknownAction.message).slice(0, 80)}`)
}

disposeRoutes()
check('disposer 后路由已注销', routes.size === 0)

/* ═══ 2. client 侧：ModuleLoader 形态 ═══ */

const clientSource = await readFile(join(packageRoot, 'lib', 'client.js'), 'utf8')

/* ── client 元素树助手（无 DOM：断言遍历 stub React 产出的树） ── */

/** 深度优先收集全部元素节点（含根）。 */
function collectElements(node, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const item of node) collectElements(item, out); return out }
  if (node.$$el !== true) return out
  out.push(node)
  for (const child of node.children ?? []) collectElements(child, out)
  return out
}

/** 取元素的 className（client 用 className 标注可断言的结构）。 */
function classOf(element) {
  return String(element?.props?.className ?? '')
}

/** 按 className 子串筛选元素。 */
function byClass(tree, fragment) {
  return collectElements(tree).filter(element => classOf(element).includes(fragment))
}

/** 取渲染树中的全部文本内容（用于断言文案在场）。 */
function textOf(node, out = []) {
  if (node === null || node === undefined) return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { for (const item of node) textOf(item, out); return out }
  if (node.$$el === true) { for (const child of node.children ?? []) textOf(child, out) }
  return out
}

function treeText(tree) { return textOf(tree).join('') }

/** 按标签名筛选元素（type 可能是字符串标签或函数组件）。 */
function byTag(tree, tag) {
  return collectElements(tree).filter(element => element.type === tag)
}

/** 找到第一个满足断言的元素。 */
function findElement(tree, predicate) {
  return collectElements(tree).find(predicate)
}

/** renderTree 递归深度上限（防御组件自引用：stub 无 reconciler，不会有 React 的报错兜底）。 */
const RENDER_DEPTH_LIMIT = 32

/**
 * 递归渲染函数型元素（stub React 没有 reconciler，需要显式展开函数组件）。
 * 语义：
 * - type 是函数 → 调用它（传 props），对返回值继续展开；
 * - type 是字符串（div/button/span/textarea/input…）→ 保留为宿主元素，对其 children 继续展开；
 * - 其它（null/undefined/布尔/字符串/数字）→ 原样返回；
 * - 防无限递归：用 depth 限制（默认 32），超限抛出可读错误。
 * 展开后返回的树可以被既有助手（byClass / treeText 等）直接遍历。
 *
 * 纯函数：不修改入参（宿主元素按浅拷贝重建，children 递归替换）。
 * 函数组件只传 props（stub 无 context，第二参数恒为 undefined）。
 */
function renderTree(node, depth = 0) {
  if (depth > RENDER_DEPTH_LIMIT) throw new Error('renderTree 递归过深（可能是组件自引用）')
  if (node === null || node === undefined) return node
  if (typeof node === 'function') {
    // 裸函数组件（等价 React <Comp />，无元素包裹）：props 取空对象，仍只传一个参数
    return renderTree(node({}, undefined), depth + 1)
  }
  if (typeof node !== 'object') return node // 字符串 / 数字 / 布尔 → 原样返回
  if (Array.isArray(node)) return node.map(item => renderTree(item, depth + 1))
  if (node.$$el !== true) return node // 非元素对象（style / 普通数据）→ 原样返回
  if (typeof node.type === 'function') {
    // 函数组件：只传 props，第二参数（context）传 undefined
    return renderTree(node.type(node.props ?? {}, undefined), depth + 1)
  }
  // 宿主元素（type 为字符串标签；未知 type 也按宿主处理，不调用）→ 保留元素，递归展开 children
  return { ...node, children: (node.children ?? []).map(child => renderTree(child, depth + 1)) }
}

/** renderTree + byClass 的组合（断言里最常用）。 */
function renderedByClass(tree, fragment) { return byClass(renderTree(tree), fragment) }
function renderedText(tree) { return treeText(renderTree(tree)) }

// stub React：覆盖 client.js 用到的 createElement + hooks。
// useState 支持函数式更新（client 的列表改写会用到）；useEffect 记录 fn 以便断言副作用注册。
const hookLog = { effects: [], memos: [] }
const stubReact = {
  createElement(type, props, ...children) {
    const flat = []
    // React 语义：嵌套数组要摊平，null/false 子节点要丢弃——断言遍历依赖这一点
    const push = (value) => {
      if (Array.isArray(value)) { for (const item of value) push(item); return }
      if (value === null || value === undefined || value === false || value === true) return
      flat.push(value)
    }
    for (const child of children) push(child)
    return { $$el: true, type, props: props ?? {}, children: flat }
  },
  useState(initial) {
    const state = { value: typeof initial === 'function' ? initial() : initial }
    return [state.value, (next) => {
      state.value = typeof next === 'function' ? next(state.value) : next
    }]
  },
  useEffect(fn) { hookLog.effects.push(fn) },
  useMemo(fn) { hookLog.memos.push(fn); return fn() },
  useCallback(fn) { return fn },
  useRef(initial) { return { current: initial } },
}

let loadedModule = null
const sandboxWindow = {
  __ModuleLoader__: {
    load(spec) {
      const requireCache = new Map()
      const fakeRequire = (name) => {
        if (name === 'react') return stubReact
        throw new Error('unexpected require: ' + name)
      }
      loadedModule = spec.factory(fakeRequire)
      loadedModule.__id = spec.id
    },
  },
}

// client 侧 fetch 记录桩：stub React 不执行 useEffect，因此只有断言里点击
// 「开始制作」这类显式交互才会真的打到数据面——把请求抓下来断言信封与载荷。
const fetchCalls = []
const stubFetch = (url, init) => {
  let body = null
  try { body = init && init.body ? JSON.parse(String(init.body)) : null } catch { body = null }
  fetchCalls.push({ url: String(url), body })
  return Promise.resolve({
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ ok: true, value: { id: 'task-smoke-1', status: 'waiting-launch' } })),
  })
}

// vm 沙箱的全局对象（contextified 后即 bundle 内的 globalThis）：client bundle
// 里的裸 fetch 解析到它的 fetch 属性，因此断言需要临时替换网络层时换这里
// ——外层 realm 的 globalThis 与 bundle 无关（两处都换仅为本文件的干净复原）。
const sandboxGlobal = { window: sandboxWindow, console, fetch: stubFetch }
vm.runInNewContext(clientSource, sandboxGlobal)
{
  check('client 自注册（__ModuleLoader__.load）', loadedModule !== null && loadedModule.__id === 'dsh-super-ppts')
  check('client 声明 inject 服务', Array.isArray(loadedModule.inject) && loadedModule.inject.includes('slots') && loadedModule.inject.includes('locale'))
}

// locale.register 收集（外层作用域）：除存在性外把字典本体也留存，
// Plan 2b Task 3b 的 i18n 断言按语言取字典键（zhDict()/enDict()）。
const dictCalls = []
const zhDict = () => (dictCalls.find((d) => d.ns === 'superPpts') || {}).dicts?.zh || {}
const enDict = () => (dictCalls.find((d) => d.ns === 'superPpts') || {}).dicts?.en || {}

// stub ctx：断言 settings.section 注册参数
{
  const registrations = []
  const ctxStub = {
    slots: {
      inject(slotType, loader) {
        registrations.push({ slotType })
        loader()
      },
      register(options, component) {
        registrations.push({ options, component, registered: true })
        return () => {}
      },
    },
    locale: {
      register(ns, dicts) { dictCalls.push({ ns, has: !!dicts.zh && !!dicts.en, dicts }); return () => {} },
      bind(ns) { return (key, params) => (dictsStub[ns]?.[key] ?? key) },
    },
    effect(fn, name) { const d = fn(); return typeof d === 'function' ? d : () => {} },
  }
  const dictsStub = null
  loadedModule.apply(ctxStub)
  const section = registrations.find(r => r.slotType === 'settings.section')
  check('client 注册 settings.section', !!section)
  const reg = registrations.find(r => r.registered)
  check('settings.section 参数（id/order/label/locale/name）', !!reg && reg.options.id === 'super-ppts' && reg.options.order === 20
    && typeof reg.options.label === 'function' && reg.options.locale === 'superPpts' && reg.options.name === 'settings.section')
  check('组件可调用（返回 React 元素树）', !!reg && typeof reg.component === 'function')
  check('双语字典已注册（zh+en）', dictCalls.length === 1 && dictCalls[0].has)
}

// 降级安全：ctx.slots 缺失 / slots.inject 抛错时 apply 不得抛（boot 不炸）
{
  let threw = false
  try {
    loadedModule.apply({ locale: { register: () => () => {}, bind: () => (k) => k }, effect: (fn) => fn() })
  } catch (e) { threw = true }
  check('ctx.slots 缺失时 apply 不抛（静默降级）', !threw)
  let threw2 = false
  try {
    loadedModule.apply({
      slots: { inject() { throw new Error('legacy build') } },
      locale: { register: () => () => {}, bind: () => (k) => k },
      effect: (fn) => fn(),
    })
  } catch (e) { threw2 = true }
  check('slots.inject 抛错时 apply 不抛（console 诊断降级）', !threw2)
}

// client 双源同构哨兵：src/client/index.ts（类型参考）与 lib/client.js（手写产物）
// 靠人工保持同构（BUILD NOTE 约定）——校验承载性不变量两侧同时在场，漂移即 FAIL。
{
  const ts = readFileSync(join(packageRoot, 'src', 'client', 'index.ts'), 'utf8')
  const js = clientSource
  const pairs = [
    ["['slots', 'locale', 'sessions', 'uiConversation', 'uiWorkspace', 'workspaces', 'layout']", '["slots", "locale", "sessions", "uiConversation", "uiWorkspace", "workspaces", "layout"]'],   // cordis inject 声明
    ['super-ppts', 'super-ppts'],                     // settings.section id
    ['superPpts', 'superPpts'],                       // locale 命名空间
    ['settings.section', 'settings.section'],         // slot 类型
    ['order: 20', 'order: 20'],                       // 导航排序
    ['data-dsh-super-ppts-settings-nav', 'data-dsh-super-ppts-settings-nav'], // 导航图标标记
    ['sessions.create', 'sessions.create'],                           // 会话桥(无会话先建真会话)
    ['sidebar.panellist', 'sidebar.panellist'],                       // 左侧栏图标行
    ["key: 'super-ppts-panel'", '"super-ppts-panel"'],                // main keyed 主面板(同 id)
    ['conversation.input', 'conversation.input'],                     // 0.1.16 草稿桥(会话输入注册面)
    ['setDraft', 'setDraft'],                                         // 输入框程序化写入
    ['uiWorkspace', 'uiWorkspace'],                                   // 工作区导航服务
    ['openWorkspace', 'openWorkspace'],                               // 跨工作区落点
    ['useWorkspaces', 'useWorkspaces'],                               // 工作台工作区行(全局标准 hook)
    ['makePanelsView', 'makePanelsView'],                             // 任务面板壳(视图状态机,main keyed)
    ['SP_VIEW_NEW', 'SP_VIEW_NEW'],                                   // 视图常量(默认落点=新建任务)
    ['viewForStatus', 'viewForStatus'],                               // 任务状态 → 恢复落点视图
    ['statusGroupOf', 'statusGroupOf'],                               // 任务状态 → 分组(最近任务)
    ['makeNewTaskView', 'makeNewTaskView'],                           // 新建任务视图(Task 3;视图根自持类名)
    ['makeRecentView', 'makeRecentView'],                             // 最近任务视图(Task 7;状态分组,待处理优先)
    ['makeTemplatePicker', 'makeTemplatePicker'],                     // 模板选择器(Task 4;内置+用户分组,来源文本可辨)
    ['buildBriefFrom', 'buildBriefFrom'],                             // brief 组装(templateId 三态保真)
    ['createTask', 'createTask'],                                     // 任务落盘桥(Task 6 起为 createTaskAndStart 第 1 步)
    ['uploadMaterial', 'uploadMaterial'],                             // 素材上传(Task 5;原始流式 POST)
    ['/super-ppts/tasks/upload', '/super-ppts/tasks/upload'],         // 任务素材路由(与 host routes.ts 同路径)
    ['sendToChatV3', 'sendToChatV3'],                                 // 会话桥 v3(Task 6;模块级,sendToChatV3(ctx,text,ws))
    ['createTaskAndStart', 'createTaskAndStart'],                     // 任务启动编排(Task 6;落盘→上传→提交→状态推进)
    ['buildTaskPrompt', 'buildTaskPrompt'],                           // 投递给 Agent 的 Brief 组装(内嵌任务 ID)
    ['tasks.create', 'tasks.create'],                                 // 先落盘再启动(顺序不可颠倒)
    ['submit', 'submit'],                                             // v3 关键一步:自动提交(用户无需回车)
    ['SP_VIEW_TASK', 'SP_VIEW_TASK'],                                 // 任务详情视图(Plan 2b;打开任务的路由落点)
    ['isPollingStatus', 'isPollingStatus'],                           // 活跃态白名单(终态停止轮询)
    ['startTaskPolling', 'startTaskPolling'],                         // 轮询循环(可注入 schedule,3s 固定间隔)
    ['buildContinuePrompt', 'buildContinuePrompt'],                   // 大纲确认后的继续生成指令(Task 2)
    ['buildOutlineRevisePrompt', 'buildOutlineRevisePrompt'],         // 自然语言修改大纲指令(Task 2)
    ['progressSteps', 'progressSteps'],                               // 六阶段时间线映射纯函数(Task 4)
    ['lastEventOfKind', 'lastEventOfKind'],                           // 最近指定 kind 事件(失败原因/needs-input 问题,Task 4)
    ['copyText', 'copyText'],                                         // 剪贴板复制原语(不可用静默降级,Task 5)
    ['routeSubView', 'routeSubView'],                                 // 详情路由判定(壳层分发与冒烟共用,Task 6)
    ['openTaskRecord', 'openTaskRecord'],                             // 打开任务:tasks.get 完整记录,绝不抛(Task 6)
    ['makeOutlineReviewView', 'makeOutlineReviewView'],               // 大纲确认视图(Plan 2b Task 3;确认门+未保存态)
    ['makeProgressView', 'makeProgressView'],                         // 生成进度视图(Plan 2b Task 4;六阶段时间线+恢复变体)
    ['makeResultView', 'makeResultView'],                             // 结果视图(Plan 2b Task 5;产物引用+继续修改)
    ['sendToSession', 'sendToSession'],                               // 壳层→视图的会话消息桥(Plan 2b Task 6;apply 绑 ctx)
    ['ensureDetailView', 'ensureDetailView'],                         // 详情视图组件类型缓存(实现后审查修正;防轮询 remount;props 优先 opts 兜底)
  ]
  const missing = []
  for (const [tsKey, jsKey] of pairs) {
    if (!ts.includes(tsKey)) missing.push(`src 缺 ${tsKey}`)
    if (!js.includes(jsKey)) missing.push(`lib 缺 ${jsKey}`)
  }
  check('client 双源同构哨兵（src/client/index.ts ↔ lib/client.js）', missing.length === 0, missing.join('; ').slice(0, 200))
}

// 工具 schema 合规：优先用运行时 dsh-tools 的真校验器（assertSupportedJsonSchema
// + validateJsonSchemaValue——type 数组会让插件树加载失败、引擎无法启动），
// 运行时不在时退回手写静态遍历。
{
  const { pptsCheckTool, pptsRenderTool, pptsTemplatesTool, pptsTaskTool } = await import('../lib/tools.js')
  const tools = [pptsCheckTool, pptsRenderTool, pptsTemplatesTool, pptsTaskTool]
  let validator = null
  try {
    const dshTools = await import(RUNTIME_NODE_MODULES + '/@deepseek-ai/dsh-tools/lib/index.js')
    validator = { assert: dshTools.assertSupportedJsonSchema, value: dshTools.validateJsonSchemaValue }
  } catch { /* 无运行时环境：退回手写遍历 */ }

  if (validator) {
    let staticsOk = true
    let detail = ''
    for (const tool of tools) {
      for (const [label, schema] of [['parameters', tool.parameters], ['output.schema', tool.output?.schema]]) {
        try { validator.assert(schema) } catch (e) { staticsOk = false; detail = `${tool.name}.${label}: ${e.message}` }
      }
    }
    check('工具 schema 通过 dsh-tools 真校验器（静态子集）', staticsOk, detail)

    // 运行时输出值校验：空库（无 defaultTemplate 字段）与非空库（有）两条分支
    const { addTemplate, setDefaultTemplate } = await import('../lib/templates.js')
    const { runTemplates } = await import('../lib/tools.js')
    const emptyResult = runTemplates({})
    const emptyViolations = validator.value(pptsTemplatesTool.output.schema, emptyResult)
    check('空库输出值合规（defaultTemplate 字段缺省）', emptyViolations === undefined || emptyViolations?.length === 0, Array.isArray(emptyViolations) ? emptyViolations.join('; ').slice(0, 200) : '')
    const tmpPptx = join(fakeHome, 'tmp-check.pptx')
    writeFileSync(tmpPptx, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 9)]))
    const record = addTemplate('校验模板', '', tmpPptx)
    setDefaultTemplate(record.id)
    const withDefaultResult = runTemplates({})
    const withDefaultViolations = validator.value(pptsTemplatesTool.output.schema, withDefaultResult)
    check('非空库输出值合规（含 defaultTemplate 条目）', withDefaultViolations === undefined || withDefaultViolations?.length === 0, Array.isArray(withDefaultViolations) ? withDefaultViolations.join('; ').slice(0, 200) : '')
  } else {
    const violations = []
    const walk = (node, path) => {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) return
      if (Array.isArray(node.type)) violations.push(path + '.type 是数组（必须单一字符串）')
      for (const [key, child] of Object.entries(node.properties ?? {})) walk(child, path + '.properties.' + key)
      if (node.items !== undefined) walk(node.items, path + '.items')
    }
    for (const tool of tools) {
      walk(tool.parameters, tool.name + '.parameters')
      walk(tool.output?.schema, tool.name + '.output.schema')
    }
    check('工具 schema 全部单一 type（手写遍历兜底）', violations.length === 0, violations.join('; ').slice(0, 200))
  }
}

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

  // 实现后审查修正（major）：completed 全链路可达——done 动作收口生命周期
  // （buildContinuePrompt 要求 Agent「推进到 completed」，此前无任何动作可达）
  const done = runTask({ action: 'done', taskId: task.id })
  check('ppts_task done 标记 completed 并留状态事件（产物登记后收口）',
    done.ok === true && done.status === 'completed' && done.taskId === task.id
    && store.loadTask(task.id)?.status === 'completed'
    && /completed/.test(String(store.loadTask(task.id)?.events.at(-1)?.text ?? '')))
  check('ppts_task done 未知任务 → ok:false', runTask({ action: 'done', taskId: 'nope-done-0' }).ok === false)
  check('ppts_task 参数 schema action enum 含 done',
    Array.isArray(pptsTaskTool.parameters.properties.action.enum)
    && pptsTaskTool.parameters.properties.action.enum.includes('done'))
  check('ppts_task description 教学 done（产物登记后标记完成）',
    pptsTaskTool.description.includes('done'))

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

// 插件树加载终局闸门：真 cordis Context + 真 dsh-tools ToolRuntime（引擎同款
// register 校验路径）完整跑一遍 lib/index.js 的 apply()——用户报的引擎拒启
// 正是 ToolRuntime.register 里的 assertSupportedJsonSchema 抛的。
{
  const runtimeRoot = RUNTIME_NODE_MODULES
  try {
    const cordis = await import(runtimeRoot + '/@deepseek-ai/cordis/lib/index.js')
    const { ToolRuntime } = await import(runtimeRoot + '/@deepseek-ai/dsh-tools/lib/index.js')
    const plugin = await import('../lib/index.js')
    const ctx = new cordis.Context()
    // ToolRuntime 构造期会调 ctx.systemPrompt.tools(...)（schema 通告 wire），
    // 必须先提供带 tools() 的 systemPrompt 再实例化。
    const sections = []
    const wires = []
    ctx.systemPrompt = {
      section: (spec) => { sections.push(spec); return () => {} },
      tools: (fn) => { wires.push(fn); return () => {} },
    }
    new ToolRuntime(ctx) // 提供 ctx.tools（register 内跑真 schema 校验）
    const routes = new Map()
    ctx.webServer = { register: (route) => { routes.set(route.path, route); return () => routes.delete(route.path) } }
    // 0.1.16 适配：预置旧版本残留的预设目录，apply 后必须被清理
    const legacyPresetDir = join(fakeHome, '.dsh', '.agent-presets', 'super-ppts')
    mkdirSync(legacyPresetDir, { recursive: true })
    writeFileSync(join(legacyPresetDir, 'preset.yml'), 'name: stale', 'utf8')
    const dispose = plugin.apply(ctx, {})
    check('插件树加载：apply() 全量通过（真 cordis + 真 ToolRuntime）', typeof dispose === 'function')
    check('能力通告 section 已注册', sections.length === 1 && sections[0].name === 'plugin:dsh-super-ppts')
    check('能力通告含任务状态桥说明（ppts_task + 大纲确认）',
      typeof sections[0].text === 'string' && sections[0].text.includes('ppts_task') && sections[0].text.includes('大纲'),
      String(sections[0].text ?? '').slice(0, 80))
    check('插件树注册任务素材路由', routes.has('/super-ppts/tasks/upload'))
    check('工具 schema 通告 wire 已建立', wires.length === 1)
    check('设置页路由已注册（api + upload）', routes.has('/super-ppts/api') && routes.has('/super-ppts/upload'))
    check('旧预设目录已清理（0.1.16 适配）', !existsSync(legacyPresetDir))
    if (typeof dispose === 'function') dispose()
  } catch (error) {
    check('插件树加载：apply() 全量通过（真 cordis + 真 ToolRuntime）', false, String(error.message || error).slice(0, 300))
  }
}

/* ═══ 4.5 数据根解析（$DSH_HOME）与存量自愈 ═══ */

{
  // 默认解析：HOME 已指向 fakeHome 且 DSH_HOME 已删除 → ~/.dsh/super-ppts
  const mod = await import('../lib/templates.js')
  check('默认数据根（无 DSH_HOME → ~/.dsh/super-ppts）', mod.STORE_ROOT === join(fakeHome, '.dsh', 'super-ppts'), mod.STORE_ROOT)

  // DSH_HOME 覆盖（KCoder 桌面端形态）：子进程独立解析，避免污染本进程常量
  const alt = mkdtempSync(join(tmpdir(), 'ppts-dsh-home-'))
  const child = execFileSync(process.execPath, [
    '--input-type=module', '-e',
    'const m = await import(' + JSON.stringify('file://' + join(packageRoot, 'lib/templates.js')) + ');\n' +
    'console.log(m.STORE_ROOT)',
  ], { env: { ...process.env, DSH_HOME: alt }, encoding: 'utf8' })
  check('DSH_HOME 覆盖数据根（KCoder 桌面端形态）', child.trim() === join(alt, 'super-ppts'), child.trim())

  // 旧存储根迁移：HOME=legacyHome（含 .dsh/super-ppts 数据）+ DSH_HOME=新根 →
  // loadRegistry 把清单与二进制搬进新根，并把记录 file 按 id 重锚
  const legacyHome = mkdtempSync(join(tmpdir(), 'ppts-legacy-home-'))
  const legacyStore = join(legacyHome, '.dsh', 'super-ppts')
  mkdirSync(join(legacyStore, 'templates'), { recursive: true })
  writeFileSync(join(legacyStore, 'templates', 'told.pptx'), 'legacy')
  writeFileSync(join(legacyStore, 'registry.json'), JSON.stringify({
    templates: [{ id: 'told', name: '旧模板', description: '', file: join(legacyStore, 'templates', 'told.pptx'), size: 6, uploadedAt: '2026-01-01T00:00:00.000Z' }],
    defaultTemplate: null,
    prefs: {},
  }))
  const alt2 = mkdtempSync(join(tmpdir(), 'ppts-legacy-dsh-'))
  const child2 = execFileSync(process.execPath, [
    '--input-type=module', '-e',
    'import { existsSync } from "node:fs";\n' +
    'const m = await import(' + JSON.stringify('file://' + join(packageRoot, 'lib/templates.js')) + ');\n' +
    'const r = m.loadRegistry();\n' +
    'console.log(JSON.stringify({ migrated: existsSync(m.REGISTRY_FILE), count: r.templates.length, file: r.templates[0] && r.templates[0].file }))',
  ], { env: { ...process.env, HOME: legacyHome, DSH_HOME: alt2 }, encoding: 'utf8' })
  let legacyResult = {}
  try { legacyResult = JSON.parse(child2.trim()) } catch { /* 解析失败落 check */ }
  check('旧存储根迁移（$DSH_HOME 读取时搬移 legacy 数据）', legacyResult.migrated === true && legacyResult.count === 1, String(child2.trim()).slice(0, 200))
  check('迁移后记录 file 重锚到新根', legacyResult.file === join(alt2, 'super-ppts', 'templates', 'told.pptx'), String(legacyResult.file))
  rmSync(alt, { recursive: true, force: true })
  rmSync(legacyHome, { recursive: true, force: true })
  rmSync(alt2, { recursive: true, force: true })

  // 清单 file 坏路径自愈（当前根内）：二进制在位 → 按 id 重锚
  mkdirSync(mod.TEMPLATE_DIR, { recursive: true })
  writeFileSync(join(mod.TEMPLATE_DIR, 'theal000001.pptx'), 'heal')
  mod.saveRegistry({ templates: [{ id: 'theal000001', name: '自愈模板', description: '', file: '/nonexistent/theal000001.pptx', size: 4, uploadedAt: '2026-01-01T00:00:00.000Z' }], defaultTemplate: null, prefs: { defaultFormat: 'ask', renderReview: 'deliverable-only', outputDir: '', styleNotes: '' } })
  const healed = mod.loadRegistry()
  check('清单 file 坏路径按 id 自愈', healed.templates[0]?.file === join(mod.TEMPLATE_DIR, 'theal000001.pptx'), String(healed.templates[0]?.file))
}

/* ═══ 5. 混合交付 Phase 1：动画嵌入脚本 ═══ */

// 依赖系统 python3 + python-pptx（插件运行链本身经 pptx-designer 传递依赖它）；
// 不可用时打印 SKIP 不计失败——冒烟主体（host + client）不受影响。
{
  const embedScript = join(packageRoot, 'skills', 'ppts-pptx', 'scripts', 'embed_animation.py')
  const pyEnv = { ...process.env, HOME: REAL_HOME } // 保用户站点解析（pip --user 的 python-pptx）
  let pyOk = true
  try {
    execFileSync('python3', ['-c', 'import pptx'], { stdio: 'ignore', env: pyEnv })
  } catch {
    pyOk = false
  }
  if (!existsSync(embedScript)) pyOk = false
  if (!pyOk) {
    console.log('SKIP  动画嵌入测试（python3 / python-pptx / 脚本缺失）')
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'sp-embed-smoke-'))
    const driver = join(dir, 'test_embed.py')
    // Python 驱动：造 2 页空 deck → GIF 嵌第 1 页（含超链接+note）→ 快照嵌第 2 页
    // → 解包断言 media 部件与 External 超链接 rel。fixture 用 1x1 微型图（合法 GIF/PNG）。
    writeFileSync(driver, [
      "import base64, os, subprocess, sys, tempfile, zipfile",
      "tmp = tempfile.mkdtemp(prefix='sp-embed-')",
      "os.chdir(tmp)",
      "open('tiny.gif', 'wb').write(base64.b64decode(",
      "    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'))",
      "open('tiny.png', 'wb').write(base64.b64decode(",
      "    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))",
      "open('tiny.html', 'w').write('<html><body>interactive</body></html>')",
      "from pptx import Presentation",
      "prs = Presentation()",
      "prs.slides.add_slide(prs.slide_layouts[6])",
      "prs.slides.add_slide(prs.slide_layouts[6])",
      "prs.save('deck.pptx')",
      "embed = sys.argv[1]",
      "r1 = subprocess.run([sys.executable, embed, '--pptx', 'deck.pptx', '--slide', '1',",
      "                     '--gif', 'tiny.gif', '--html', 'tiny.html', '--note', 'see html',",
      "                     '--output', 'deck.anim.pptx'], capture_output=True, text=True)",
      "r2 = subprocess.run([sys.executable, embed, '--pptx', 'deck.anim.pptx', '--slide', '2',",
      "                     '--snapshot', 'tiny.png', '--html', 'tiny.html',",
      "                     '--output', 'deck.anim.pptx'], capture_output=True, text=True)",
      "detail = ''",
      "gif_ok = r1.returncode == 0 and 'EMBED_OK' in r1.stdout",
      "png_ok = r2.returncode == 0 and 'EMBED_OK' in r2.stdout",
      "if os.path.exists('deck.anim.pptx'):",
      "    z = zipfile.ZipFile('deck.anim.pptx')",
      "    media = [n for n in z.namelist() if n.startswith('ppt/media/')]",
      "    rels1 = z.read('ppt/slides/_rels/slide1.xml.rels').decode()",
      "    rels2 = z.read('ppt/slides/_rels/slide2.xml.rels').decode()",
      "    gif_ok = gif_ok and any(n.endswith('.gif') for n in media) and 'tiny.html' in rels1 and 'External' in rels1",
      "    png_ok = png_ok and any(n.endswith('.png') for n in media) and 'tiny.html' in rels2 and 'External' in rels2",
      "else:",
      "    detail = 'deck.anim.pptx 未产出; '",
      "if not gif_ok:",
      "    detail += 'GIF rc=%s out=%s err=%s; ' % (r1.returncode, r1.stdout[-160:], r1.stderr[-160:])",
      "if not png_ok:",
      "    detail += 'PNG rc=%s out=%s err=%s' % (r2.returncode, r2.stdout[-160:], r2.stderr[-160:])",
      "print('EMBED_GIF_OK' if gif_ok else 'EMBED_GIF_FAIL')",
      "print('EMBED_PNG_OK' if png_ok else 'EMBED_PNG_FAIL')",
      "if detail:",
      "    print('DETAIL ' + detail)",
    ].join('\n'))
    try {
      const out = execFileSync('python3', [driver, embedScript], { encoding: 'utf8', env: pyEnv })
      const detail = (out.split('\n').find(line => line.startsWith('DETAIL')) || '').slice(0, 220)
      check('动画嵌入：GIF + 相对超链接（embed_animation.py）', out.includes('EMBED_GIF_OK'), detail)
      check('动画嵌入：快照兜底 + 外链 rel', out.includes('EMBED_PNG_OK'), detail)
    } catch (error) {
      check('动画嵌入：GIF + 相对超链接（embed_animation.py）', false, String(error.message || error).slice(0, 220))
      check('动画嵌入：快照兜底 + 外链 rel', false, '同上（驱动进程失败）')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

/* ═══ client 左侧栏接入对账（0.1.5 panellist + main keyed）═══ */

{
  const client = readFileSync(join(packageRoot, 'lib/client.js'), 'utf8')
  check('client 注册 sidebar.panellist + main 双 slot（同 id super-ppts-panel）',
    client.includes('name: "sidebar.panellist"') && client.includes('name: "main"') && client.includes('"super-ppts-panel"'))
  check('client 软探测回退（宿主 ≤0.1.4 静默跳过）', client.includes('宿主无左侧栏 slot'))
  check('任务面板读全局工作区 hook（useWorkspaces 选择器，新建任务视图）', client.includes('useWorkspaces(function'))
  check('任务视图状态完备（新建空态/最近错误/素材空态/重试）', client.includes('recentError') && client.includes('materialEmpty') && client.includes('retry'))
  // 守门匹配定义形态：历史沿革注释提及该组件名不算死代码复活
  check('旧工作台已移除', !client.includes('function makeWorkbenchComponent'))
}

/* ═══ client 面板壳：视图状态机 ═══ */
{
  const registrations = []
  const ctxStub = {
    slots: {
      inject(slotType, loader) { loader() },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
    locale: {
      register() { return () => {} },
      bind() { return (key) => key },
    },
    sessions: {
      list: { getSnapshot: () => ({ current: 'sess-1' }) },
      scope: () => ({ conversation: { input: { for: () => ({ setDraft() {}, submit() {} }) } } }),
      create: async () => 'sess-new',
      open() {},
    },
    workspaces: { list: { getSnapshot: () => ({ items: [], phase: 'ready' }) } },
    layout: { selectPanel() {} },
    effect(fn) { return fn() },
  }
  loadedModule.apply(ctxStub)
  const panel = registrations.find(r => r.options.name === 'main')
  check('client 注册 main keyed 面板', !!panel && panel.options.key === 'super-ppts-panel')
  const tree = panel.component({ useWorkspaces: (selector) => selector({ items: [], phase: 'ready' }) })
  // 断言走渲染入口：stub React 不调用函数组件，子组件内部结构（sp-tabs / 视图根类名）
  // 只有先 renderTree 展开才可见。
  check('面板壳渲染出视图切换（新建任务 / 最近任务）',
    renderedByClass(tree, 'sp-tabs').length === 1
      && renderedText(renderedByClass(tree, 'sp-tabs')[0]).includes('newTask')
      && renderedText(renderedByClass(tree, 'sp-tabs')[0]).includes('recent'))
  check('默认落在新建任务视图', renderedByClass(tree, 'sp-view-new-task').length === 1)
  check('面板壳不存在嵌套自建侧边栏/全屏容器',
    renderedByClass(tree, 'sp-sidebar').length === 0 && renderedByClass(tree, 'sp-fullscreen').length === 0)
}

/* ═══ client 新建任务视图：默认极简 + 可展开完整配置 ═══ */
{
  const registrations = []
  let dictsSeen = null
  const ctxStub = {
    slots: {
      inject(slotType, loader) { loader() },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
    locale: {
      register(ns, dicts) { dictsSeen = dicts; return () => {} },
      bind() { return (key) => key },
    },
    sessions: {
      list: { getSnapshot: () => ({ current: 'sess-1' }) },
      scope: () => ({ conversation: { input: { for: () => ({ setDraft() {}, submit() {} }) } } }),
      create: async () => 'sess-new',
      open() {},
    },
    workspaces: { list: { getSnapshot: () => ({ items: [], phase: 'ready' }) } },
    layout: { selectPanel() {} },
    effect(fn) { return fn() },
  }
  loadedModule.apply(ctxStub)
  const panel = registrations.find(r => r.options.name === 'main')
  const tree = panel.component({
    useWorkspaces: (selector) => selector({
      items: [{ workspaceId: 'ws1', path: '/tmp/ws1', title: '季度汇报', sessionIds: [] }],
      phase: 'ready',
    }),
  })

  // 断言一律走渲染入口（renderedByClass / renderedText）：stub React 不调用函数组件，
  // 视图内部结构只有先 renderTree 展开才可见（裸 byClass 看不到子组件内部）。
  check('新建任务：主题输入是主入口（textarea 在场）',
    renderedByClass(tree, 'sp-topic-input').length === 1 && renderedByClass(tree, 'sp-topic-input')[0].type === 'textarea')
  check('新建任务：交付形态是两张卡片而非下拉框',
    renderedByClass(tree, 'sp-format-card').length === 2
      && renderedByClass(tree, 'sp-format-card').every(el => el.type === 'button'))
  check('新建任务：默认只显示极简路径（更多选项默认折叠）',
    renderedByClass(tree, 'sp-advanced-body').length === 0
      && renderedByClass(tree, 'sp-advanced-toggle').length === 1)
  check('新建任务：主按钮是「开始制作」而非「放入输入框」',
    renderedByClass(tree, 'sp-start').length === 1
      && !renderedText(tree).includes('sendToChat'))
  check('新建任务：无嵌套侧边栏/全屏容器', renderedByClass(tree, 'sp-sidebar').length === 0)
  check('新建任务：未填主题时主按钮禁用',
    renderedByClass(tree, 'sp-start')[0].props.disabled === true)

  // 渲染一次并复用同一棵树：stub React 每次 renderTree 都会新建组件实例，跨实例
  // 拿到的元素不属于同一次渲染，交互断言必须落在同一个快照上。
  const rendered = renderTree(tree)
  check('新建任务：快速开始 8 个 chip（q1..q8，均为可点按钮）',
    byClass(rendered, 'sp-quick-chip').length === 8
      && byClass(rendered, 'sp-quick-chip').every(el => el.type === 'button' && typeof el.props.onClick === 'function'))
  // 注意：sp-config-summary 是折叠态下唯一命中该片段的容器（展开明细 sp-config-summary-extra 只在展开后出现）
  check('新建任务：配置摘要一行 5 项（主题/形态/模板/素材数/页数）',
    byClass(rendered, 'sp-config-summary').length === 1
      && byClass(rendered, 'sp-summary-item').length === 5)
  check('新建任务：素材入口 + 列表 + 隐藏多选文件输入在场',
    byClass(rendered, 'sp-material-add').length === 1
      && byClass(rendered, 'sp-material-list').length === 1
      && byClass(rendered, 'sp-material-input').length === 1
      && byClass(rendered, 'sp-material-input')[0].props.type === 'file'
      && byClass(rendered, 'sp-material-input')[0].props.multiple === true)
  check('新建任务：模板入口已在场（Task 4 已接真实选择器，见后置断言块）', byClass(rendered, 'sp-tpl-open').length === 1)

  // stub React 的 useState 值快照在渲染时就已固定（无 reconciler），因此「填主题再点开始」
  // 在同一次渲染里观察不到状态更新——改为断言守卫：主题为空时点主按钮**不发请求**。
  byClass(rendered, 'sp-start')[0].props.onClick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  check('新建任务：主题为空时点「开始制作」不发请求（trim 空即返回）', fetchCalls.length === 0)

  // 最小桥（Task 6 会被 createTaskAndStart 替换，形状契约不变）：直接调桥断言真实载荷。
  const { buildBriefFrom, createTask } = loadedModule.__testHooks
  const bridgeResult = await createTask({
    title: '季度经营数据汇报',
    brief: buildBriefFrom({ topic: ' 季度经营数据汇报 ', format: 'pptx', templateChoice: '' }),
    workspace: { id: 'ws1', name: '季度汇报', path: '/tmp/ws1' },
    materials: [],
  })
  const createCall = fetchCalls[0]
  check('最小桥 createTask：tasks.create 落盘 + phase 停在 waiting-launch（不假装已启动）',
    fetchCalls.length === 1 && createCall.url.endsWith('/super-ppts/api/tasks.create')
      && createCall.body.title === '季度经营数据汇报'
      && createCall.body.brief.topic === '季度经营数据汇报'
      && createCall.body.brief.format === 'pptx'
      && createCall.body.workspace.id === 'ws1'
      && bridgeResult.phase === 'waiting-launch' && bridgeResult.task.id === 'task-smoke-1')
  check('最小桥 createTask：未选模板 → 载荷 brief 不带 templateId 键（跟随默认）',
    !Object.prototype.hasOwnProperty.call(createCall.body.brief, 'templateId'))

  const briefFollow = buildBriefFrom({ topic: ' 主题A ', format: 'pptx', templateChoice: '' })
  const briefNone = buildBriefFrom({ topic: '主题B', format: 'html', templateChoice: 'none' })
  const briefTpl = buildBriefFrom({
    topic: '主题C', format: 'pptx',
    templateChoice: { id: 'tpl-1', name: '品牌模板', source: 'user' },
  })
  check('buildBriefFrom 三态①：templateChoice 为空 → 不写 templateId 键（跟随默认）',
    !('templateId' in briefFollow) && briefFollow.topic === '主题A' && briefFollow.format === 'pptx')
  check('buildBriefFrom 三态②：templateChoice="none" → templateId: null（不使用模板）',
    Object.prototype.hasOwnProperty.call(briefNone, 'templateId') && briefNone.templateId === null
      && briefNone.format === 'html')
  check('buildBriefFrom 三态③：具体模板对象 → 写 id / name / source',
    briefTpl.templateId === 'tpl-1' && briefTpl.templateName === '品牌模板' && briefTpl.templateSource === 'user')

  const zhKeys = Object.keys(dictsSeen.zh).sort()
  const enKeys = Object.keys(dictsSeen.en).sort()
  check('新建任务：文案键 zh/en 两侧键名完全一致（数量 + 逐位比对）',
    zhKeys.length === enKeys.length && zhKeys.every((key, index) => key === enKeys[index]),
    `zh ${zhKeys.length} / en ${enKeys.length}`)
  check('新建任务：Task 3 Step 4 文案键齐备（双侧）',
    ['startTask', 'topicPlaceholder', 'advancedOptions', 'configSummary', 'formatPptxCard', 'formatHtmlCard',
      'formatPptxHint', 'formatHtmlHint', 'taskStarted', 'taskWaitingLaunch', 'taskCreateFailed',
      'materialAdd', 'materialList', 'materialRemove', 'topicRequired']
      .every(key => key in dictsSeen.zh && key in dictsSeen.en))
}

/* ═══ client 模板选择器：内置与用户模板必须分组且来源可辨 ═══ */
{
  const registrations = []
  let dictsSeen = null
  const ctxStub = {
    slots: {
      inject(slotType, loader) { loader() },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
    locale: {
      register(ns, dicts) { dictsSeen = dicts; return () => {} },
      bind() { return (key) => key },
    },
    sessions: {
      list: { getSnapshot: () => ({ current: 'sess-1' }) },
      scope: () => ({ conversation: { input: { for: () => ({ setDraft() {}, submit() {} }) } } }),
      create: async () => 'sess-new',
      open() {},
    },
    workspaces: { list: { getSnapshot: () => ({ items: [], phase: 'ready' }) } },
    layout: { selectPanel() {} },
    effect(fn) { return fn() },
  }
  loadedModule.apply(ctxStub)
  const panel = registrations.find(r => r.options.name === 'main')
  const tree = panel.component({})
  // 模板选择器在展开「更多制作选项」后才出现（快速路径保持极简）
  const advancedToggle = byClass(tree, 'sp-advanced-toggle')[0]
  // 直接构造选择器组件的渲染结果做结构断言（不依赖交互模拟）
  const picker = loadedModule.__testHooks.makeTemplatePicker(
    (key) => key,
    {
      builtin: [
        { id: 'builtin-exec-review', source: 'builtin', name: '高管经营汇报', scenario: '季度汇报', tags: ['商务'], ratio: '16:9', accent: '#2F6FEB' },
      ],
      user: [
        { id: 't1', name: '公司品牌模板', description: '季度汇报用', isDefault: true },
      ],
      onPick: function () {},
      onClose: function () {},
    },
  )
  const rendered = picker({})
  check('模板选择器：内置与用户模板分组渲染',
    byClass(rendered, 'sp-tpl-group-builtin').length === 1
      && byClass(rendered, 'sp-tpl-group-user').length === 1)
  check('模板选择器：来源标签可辨（不依赖颜色）',
    byClass(rendered, 'sp-tpl-source').length >= 2
      && treeText(rendered).includes('tplBuiltin') && treeText(rendered).includes('tplUser'))
  check('模板选择器：每张卡片有占位预览与名称',
    byClass(rendered, 'sp-tpl-card').length === 2
      && byClass(rendered, 'sp-tpl-thumb').length === 2
      && treeText(rendered).includes('高管经营汇报')
      && treeText(rendered).includes('公司品牌模板'))
  check('模板选择器：默认模板有默认标记', byClass(rendered, 'sp-tpl-default').length === 1)
  check('模板选择器：「不使用模板」与「跟随默认」是两个不同选项',
    byClass(rendered, 'sp-tpl-none').length === 1
      && byClass(rendered, 'sp-tpl-follow').length === 1)

  // 结构契约的其余部分：筛选/搜索/使用按钮/管理入口 + 入口接线（Task 4 Step 5）。
  check('模板选择器：筛选（全部/内置/我的）+ 搜索框 + 使用按钮 + 管理入口在场',
    byClass(rendered, 'sp-tpl-filter').length === 1
      && byClass(rendered, 'sp-tpl-filter')[0].children.length === 3
      && byClass(rendered, 'sp-tpl-search').length === 1
      && byClass(rendered, 'sp-tpl-use').length === 2
      && byClass(rendered, 'sp-tpl-manage').length === 1)
  // stub React 的 useState 不触发重渲染 → 「点入口后打开」观察不到；改为断言入口
  // 可点 + 挂载点在场（源码对账）+ 折叠态不渲染选择器（快速路径保持极简）。
  const viewRendered = renderTree(tree)
  check('新建任务：模板入口已接到真实选择器（入口可点 + 挂载点在场 + 折叠态不渲染）',
    typeof byClass(viewRendered, 'sp-tpl-open')[0].props.onClick === 'function'
      && clientSource.includes('makeTemplatePicker(t, {')
      && byClass(viewRendered, 'sp-tpl-picker').length === 0)

  check('模板选择器：Task 4 Step 4 文案键齐备（双侧）',
    ['tplPickerTitle', 'tplFilterAll', 'tplFilterBuiltin', 'tplFilterUser', 'tplSearch',
      'tplBuiltin', 'tplUser', 'tplNone', 'tplNoneHint', 'tplFollow', 'tplFollowHint', 'tplManage', 'tplUse']
      .every(key => key in dictsSeen.zh && key in dictsSeen.en))
}

/* ═══ client 素材上传 ═══ */
{
  const uploaded = []
  const fakeFetch = (url, init) => {
    uploaded.push({ url: url, method: init && init.method })
    return Promise.resolve({
      text: () => Promise.resolve(JSON.stringify({ ok: true, value: { name: 'Q3.xlsx', size: 2048, path: '/tmp/m/Q3.xlsx' } })),
    })
  }
  // client bundle 跑在 vm 沙箱里：它的 globalThis 是 sandboxGlobal（裸 fetch 解析到
  // 该对象的 fetch 属性）。按计划同时替换外层 realm 的 globalThis.fetch，两处都在
  // finally 里复原——否则会污染后续断言（块末的复原探针会验证这一点）。
  const originalFetch = globalThis.fetch
  const originalSandboxFetch = sandboxGlobal.fetch
  globalThis.fetch = fakeFetch
  sandboxGlobal.fetch = fakeFetch
  try {
    const result = await loadedModule.__testHooks.uploadMaterial('k123', new BlobContent('Q3.xlsx', 2048))
    check('素材上传：走任务素材路由且带 taskId 与文件名',
      uploaded.length === 1
        && uploaded[0].url.indexOf('/super-ppts/tasks/upload') === 0
        && uploaded[0].url.indexOf('taskId=k123') !== -1
        && decodeURIComponent(uploaded[0].url).indexOf('name=Q3.xlsx') !== -1
        && uploaded[0].method === 'POST')
    check('素材上传：返回宿主登记的素材信息', result && result.name === 'Q3.xlsx' && result.size === 2048)
  } finally {
    globalThis.fetch = originalFetch
    sandboxGlobal.fetch = originalSandboxFetch
  }

  let failed = false
  const rejectFetch = () => Promise.resolve({ text: () => Promise.resolve(JSON.stringify({ ok: false, error: { code: 'bad-request', message: '素材超过大小上限' } })) })
  globalThis.fetch = rejectFetch
  sandboxGlobal.fetch = rejectFetch
  try {
    await loadedModule.__testHooks.uploadMaterial('k123', new BlobContent('big.bin', 10))
  } catch (error) { failed = /大小上限/.test(String(error && error.message)) }
  finally {
    globalThis.fetch = originalFetch
    sandboxGlobal.fetch = originalSandboxFetch
  }
  check('素材上传：宿主拒绝时抛出可读错误（不静默吞掉）', failed)
  check('素材上传：断言后 fetch 已复原（两处引用都与断言前一致，不污染后续断言）',
    globalThis.fetch === originalFetch && sandboxGlobal.fetch === originalSandboxFetch)

  // 行为级复原探针：复原后再走一次真实数据面（createTask → api → fetch），
  // 必须重新落到本套件自己的记录桩上（fetchCalls 增长、fakeFetch 不再被调用）
  // ——引用相等只能证明赋值复原，这一步证明 bundle 内的裸 fetch 也真的换回来了。
  const callsBeforeProbe = fetchCalls.length
  await loadedModule.__testHooks.createTask({
    title: '复原探针',
    brief: { topic: '复原探针', format: 'pptx' },
    workspace: { id: '', name: '', path: '' },
    materials: [],
  })
  check('素材上传：复原后数据面仍走记录桩（假 fetch 不残留）',
    fetchCalls.length === callsBeforeProbe + 1 && uploaded.length === 1
      && fetchCalls[fetchCalls.length - 1].url.endsWith('/super-ppts/api/tasks.create'))
}

/* ═══ client 会话桥 v3：直接开始制作（setDraft + submit） ═══ */
{
  const calls = []
  const ctxStub = {
    slots: { inject(slotType, loader) { loader() }, register() { return () => {} } },
    locale: { register() { return () => {} }, bind() { return (key) => key } },
    sessions: {
      list: { getSnapshot: () => ({ current: 'sess-1' }) },
      scope(id) {
        calls.push({ scope: id });
        return { conversation: { input: { for: () => ({
          setDraft(text) { calls.push({ setDraft: text }) },
          submit() { calls.push({ submit: true }) },
        }) } } };
      },
      create: async () => 'sess-new',
      open(id) { calls.push({ open: id }) },
    },
    workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws1', sessionIds: ['sess-1'] }], phase: 'ready' }) } },
    layout: { selectPanel() {} },
    effect(fn) { return fn() },
  }
  loadedModule.apply(ctxStub)
  const result = await loadedModule.__testHooks.sendToChatV3(ctxStub, '任务 ID：k123\n主题：Q3 复盘', 'ws1')
  check('会话桥 v3：把 Brief 写入会话输入框（setDraft）',
    calls.some(call => typeof call.setDraft === 'string' && call.setDraft.indexOf('任务 ID：k123') !== -1))
  check('会话桥 v3：随后自动提交（submit），用户无需回车',
    calls.some(call => call.submit === true) && result === 'submitted')
  check('会话桥 v3：setDraft 先于 submit',
    calls.findIndex(call => call.setDraft) < calls.findIndex(call => call.submit))

  // 降级：输入面不可达时必须回退剪贴板，而不是静默失败
  const noInputCtx = JSON.parse(JSON.stringify({ sessions: null }))
  noInputCtx.sessions = { list: { getSnapshot: () => ({ current: 'sess-1' }) }, scope: () => undefined, create: async () => 's', open() {} }
  const fallbackResult = await loadedModule.__testHooks.sendToChatV3(noInputCtx, 'brief text', '')
  check('会话桥 v3：输入面不可达时降级剪贴板（返回 copied 或 none，不抛错）',
    fallbackResult === 'copied' || fallbackResult === 'none')
}

/* ═══ client 会话桥 v3 · 任务启动编排（Task 6 补充断言） ═══
   计划 Step 1 只覆盖桥本身；下面把「先落盘再启动」「提交不可达 → 可恢复状态」
   两个硬约束钉成断言：落盘失败必须明确报错（不得假装已创建），启动链路失败
   必须置 waiting-launch（可重试），而不是 failed/started。 */
{
  const order = []
  const drafts = []
  const makeCtx = (shell) => ({
    slots: { inject(slotType, loader) { loader() }, register() { return () => {} } },
    locale: { register() { return () => {} }, bind() { return (key) => key } },
    sessions: {
      list: { getSnapshot: () => ({ current: 'sess-1' }) },
      scope() { return { conversation: { input: { for: () => shell } } } },
      create: async () => 'sess-new',
      open() {},
    },
    workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws1', sessionIds: ['sess-1'] }], phase: 'ready' }) } },
    layout: { selectPanel() {} },
    effect(fn) { return fn() },
  })
  const shellOk = {
    setDraft(text) { order.push('setDraft'); drafts.push(text) },
    submit() { order.push('submit') },
  }
  const taskRecord = { id: 'task-1', status: 'creating', brief: { topic: 'Q3 复盘', format: 'pptx' }, materials: [] }
  const makeFetch = (failCreate) => (url, init) => {
    const path = String(url).split('?')[0]
    const body = init && init.body ? JSON.parse(String(init.body)) : {}
    if (path.endsWith('/super-ppts/api/tasks.create')) {
      order.push(failCreate ? 'tasks.create:rejected' : 'tasks.create')
      return Promise.resolve({ text: () => Promise.resolve(JSON.stringify(failCreate
        ? { ok: false, error: { code: 'fs-error', message: '任务记录写入失败' } }
        : { ok: true, value: taskRecord })) })
    }
    order.push('tasks.update:' + (body.patch && body.patch.status))
    return Promise.resolve({ text: () => Promise.resolve(JSON.stringify({ ok: true, value: Object.assign({}, taskRecord, body.patch) })) })
  }
  const startInput = (materials) => ({
    title: 'Q3 复盘',
    brief: { topic: 'Q3 复盘', format: 'pptx' },
    workspace: { id: 'ws1', name: '季度', path: '/tmp/ws1' },
    materials: materials || [],
  })

  const originalFetch = globalThis.fetch
  const originalSandboxFetch = sandboxGlobal.fetch
  try {
    const fakeFetch = makeFetch(false)
    globalThis.fetch = fakeFetch
    sandboxGlobal.fetch = fakeFetch
    const started = await loadedModule.__testHooks.createTaskAndStart(makeCtx(shellOk), startInput())
    check('编排：先落盘（tasks.create）再启动（setDraft → submit），顺序不可颠倒',
      order[0] === 'tasks.create' && order.indexOf('setDraft') > 0
        && order.indexOf('setDraft') < order.indexOf('submit'))
    check('编排：提交成功 → phase "started" 且任务状态推进到 analyzing',
      started.phase === 'started' && started.task.status === 'analyzing'
        && order.indexOf('tasks.update:analyzing') !== -1)
    check('编排：投递给 Agent 的 Brief 内嵌「任务 ID：」（Agent 据此调 ppts_task）',
      drafts.length === 1 && drafts[0].indexOf('任务 ID：task-1') !== -1)

    // 素材：视图条目形如 { name, size, status, file, upload }——真实字节在 file，
    // 上传通道在 upload；两者都要被编排用上（taskId + 原始 File），路径进 Brief。
    order.length = 0; drafts.length = 0
    const uploads = []
    const rawFile = new BlobContent('Q3.xlsx', 2048)
    await loadedModule.__testHooks.createTaskAndStart(makeCtx(shellOk), startInput([{
      name: 'Q3.xlsx', size: 2048, status: 'pending', file: rawFile,
      upload: (taskId, raw) => {
        uploads.push({ taskId, raw })
        return Promise.resolve({ name: 'Q3.xlsx', size: 2048, path: '/tmp/m/Q3.xlsx' })
      },
    }]))
    check('编排：素材按视图条目（file 字节 + upload 通道）逐个上传，路径写进 Brief',
      uploads.length === 1 && uploads[0].taskId === 'task-1' && uploads[0].raw === rawFile
        && drafts[0].indexOf('/tmp/m/Q3.xlsx') !== -1)

    // 单素材失败不阻塞启动（只记错误，phase 照常推进）
    order.length = 0; drafts.length = 0
    const failedUpload = await loadedModule.__testHooks.createTaskAndStart(makeCtx(shellOk), startInput([{
      name: 'broken.bin', size: 4, status: 'pending', file: new BlobContent('broken.bin', 4),
      upload: () => Promise.reject(new Error('素材超过大小上限')),
    }]))
    check('编排：单个素材上传失败不阻塞启动（phase 仍为 started）',
      failedUpload.phase === 'started' && order.indexOf('submit') !== -1)

    // 提交面不可达（shell 无 submit）→ 不得假装已启动，任务置 waiting-launch
    order.length = 0; drafts.length = 0
    const noSubmit = await loadedModule.__testHooks.createTaskAndStart(makeCtx({
      setDraft(text) { order.push('setDraft'); drafts.push(text) },
    }), startInput())
    check('编排：submit 缺失 → phase "waiting-launch" + 任务置 waiting-launch（可重试），绝不 started',
      noSubmit.phase === 'waiting-launch' && noSubmit.task.status === 'waiting-launch'
        && order.indexOf('tasks.update:waiting-launch') !== -1 && order.indexOf('submit') === -1)

    // 落盘失败 → 明确报错，且不得发生任何会话写入/提交（无孤儿启动）
    order.length = 0; drafts.length = 0
    const failFetch = makeFetch(true)
    globalThis.fetch = failFetch
    sandboxGlobal.fetch = failFetch
    let createRejected = false
    await loadedModule.__testHooks.createTaskAndStart(makeCtx(shellOk), startInput())
      .catch((error) => { createRejected = /任务记录写入失败/.test(String(error && error.message)) })
    check('编排：落盘失败 → 明确报错且不产生任何会话写入/提交（不得假装已创建）',
      createRejected && order.length === 1 && order[0] === 'tasks.create:rejected' && drafts.length === 0)
  } finally {
    globalThis.fetch = originalFetch
    sandboxGlobal.fetch = originalSandboxFetch
  }
  check('编排：断言后 fetch 已复原（两处引用都与断言前一致）',
    globalThis.fetch === originalFetch && sandboxGlobal.fetch === originalSandboxFetch)
}

/* ═══ client 最近任务视图：待处理优先 + 状态可扫（Task 7）═══
   stub 无重渲染（useState 变化不会触发再渲染），因此断言走「直接构建 tasks
   数组 + 直接调用 makeRecentView 工厂」，不模拟点击后观察状态；点击行为本身
   只断言「按钮真的挂了 onClick」。 */
{
  const t = (key) => key
  const recentOpts = (over) => Object.assign(
    { tasks: [], loadErr: '', refresh: function () { return Promise.resolve() } },
    over,
  )
  const groupEls = (tree) => collectElements(renderTree(tree))
    .filter(el => classOf(el).indexOf('sp-group-') === 0)
  const view = loadedModule.__testHooks.makeRecentView(t, recentOpts({
    tasks: [
      { id: 'k1', title: 'Q3 经营复盘', status: 'waiting-outline', format: 'pptx', workspaceName: '季度汇报', updatedAt: '2026-09-16T04:00:00.000Z' },
      { id: 'k2', title: '产品发布演示', status: 'building', format: 'html', workspaceName: '产品', updatedAt: '2026-09-16T05:00:00.000Z' },
      { id: 'k3', title: '技术分享', status: 'completed', format: 'pptx', workspaceName: '技术', updatedAt: '2026-09-15T05:00:00.000Z' },
      { id: 'k4', title: '失败的任务', status: 'failed', format: 'pptx', workspaceName: '技术', updatedAt: '2026-09-15T06:00:00.000Z' },
    ],
  }))
  const tree = view({})
  // 空分组不渲染：只留一条已完成任务时，四个分组容器里只应出现 done 一个
  const doneOnly = groupEls(loadedModule.__testHooks.makeRecentView(t, recentOpts({
    tasks: [{ id: 'k3', title: '技术分享', status: 'completed', format: 'pptx', workspaceName: '技术', updatedAt: '2026-09-15T05:00:00.000Z' }],
  }))({}))
  check('最近任务：按状态分组渲染且空分组不渲染（待处理 / 进行中 / 失败 / 已完成）',
    renderedByClass(tree, 'sp-group-attention').length === 1
      && renderedByClass(tree, 'sp-group-active').length === 1
      && renderedByClass(tree, 'sp-group-failed').length === 1
      && renderedByClass(tree, 'sp-group-done').length === 1
      && doneOnly.length === 1 && classOf(doneOnly[0]) === 'sp-group-done')
  check('最近任务：待处理分组排在最前',
    groupEls(tree).length === 4 && classOf(groupEls(tree)[0]) === 'sp-group-attention')
  check('最近任务：每条显示标题/状态/工作区且可点击恢复',
    renderedByClass(tree, 'sp-task-item').length === 4
      && renderedByClass(tree, 'sp-task-open').length === 4
      && renderedByClass(tree, 'sp-task-open').every(el => typeof el.props.onClick === 'function')
      && renderedByClass(tree, 'sp-task-status').length === 4
      && renderedByClass(tree, 'sp-work-name').length === 4
      && renderedText(tree).includes('Q3 经营复盘')
      && renderedText(tree).includes('季度汇报')
      && renderedText(tree).includes('taskStatusWaitingOutline'))
  check('最近任务：空列表给出可执行引导（而不是空白）',
    renderedText(loadedModule.__testHooks.makeRecentView(t, recentOpts())({})).includes('recentEmpty')
      && groupEls(loadedModule.__testHooks.makeRecentView(t, recentOpts())({})).length === 0)
  const errTree = loadedModule.__testHooks.makeRecentView(t, recentOpts({ loadErr: 'boom' }))({})
  check('最近任务：错误态可重试',
    renderedByClass(errTree, 'sp-recent-error').length === 1
      && renderedByClass(errTree, 'sp-recent-retry').length === 1
      && renderedByClass(errTree, 'sp-recent-retry').every(el => typeof el.props.onClick === 'function')
      && renderedText(errTree).includes('recentError'))
}

/* ═══ Plan 2b Task 1：视图路由基元 + 活跃任务轮询 ═══
   stub React 不执行 useEffect、useState 不触发重渲染——轮询循环的调度必须
   可注入：断言传假 schedule（记录 fn / 间隔），真实 React 走默认实现。 */
{
  const H = loadedModule.__testHooks
  try {
    // D1 修正后的恢复落点（规格「状态 → 恢复落点」表）
    check('viewForStatus: waiting-outline → outline',
      H.viewForStatus('waiting-outline') === 'outline')
    check('viewForStatus: creating/waiting-launch/needs-input/failed/cancelled → progress',
      H.viewForStatus('creating') === 'progress' && H.viewForStatus('waiting-launch') === 'progress'
      && H.viewForStatus('needs-input') === 'progress' && H.viewForStatus('failed') === 'progress'
      && H.viewForStatus('cancelled') === 'progress')
    check('viewForStatus: analyzing/building/reviewing → progress; completed → result',
      H.viewForStatus('analyzing') === 'progress' && H.viewForStatus('building') === 'progress'
      && H.viewForStatus('reviewing') === 'progress' && H.viewForStatus('completed') === 'result')
    check('viewForStatus: 未知/空 → SP_VIEW_NEW',
      H.viewForStatus(undefined) === H.SP_VIEW_NEW && H.viewForStatus('whatever') === H.SP_VIEW_NEW)

    // 轮询白名单：规格「面板侧刷新策略」固定四个活跃态
    check('isPollingStatus: 四个活跃态 true', H.isPollingStatus('analyzing') && H.isPollingStatus('building')
      && H.isPollingStatus('reviewing') && H.isPollingStatus('waiting-outline'))
    check('isPollingStatus: 终态/等待用户/未知 false',
      !H.isPollingStatus('completed') && !H.isPollingStatus('failed') && !H.isPollingStatus('cancelled')
      && !H.isPollingStatus('needs-input') && !H.isPollingStatus('creating')
      && !H.isPollingStatus('waiting-launch') && !H.isPollingStatus(undefined))

    // startTaskPolling：可注入 schedule 的轮询循环（真实 React effect 走默认实现）
    const ticks = []
    let rescheduleCount = 0
    let cancelled = false
    const scheduled = []
    const pollTaskActive = { id: 'k1', status: 'building' }
    const pollTaskDone = { id: 'k1', status: 'completed' }
    const pollQueue = [pollTaskActive, pollTaskDone]
    const pollApi = (method, body) => {
      check('startTaskPolling: 轮询请求 tasks.get + id', method === 'tasks.get' && body.id === 'k1')
      return Promise.resolve(pollQueue.length > 0 ? pollQueue.shift() : pollTaskActive)
    }
    const cancelPoll = H.startTaskPolling('k1', (record) => ticks.push(record), {
      api: pollApi,
      schedule: (fn, ms) => {
        check('startTaskPolling: 调度间隔 = SP_POLL_MS', ms === H.SP_POLL_MS && H.SP_POLL_MS === 3000)
        rescheduleCount += 1
        scheduled.push(fn)
        return () => { cancelled = true }
      },
    })
    // 第 1 轮 loop：active → onTick + 重新调度
    await scheduled[0]()
    check('startTaskPolling: onTick 收到 tasks.get 记录', ticks.length === 1 && ticks[0].status === 'building')
    check('startTaskPolling: 活跃态继续调度', rescheduleCount === 2 && typeof scheduled[1] === 'function')
    // 第 2 轮：终态 → onTick 但不再调度
    await scheduled[1]()
    check('startTaskPolling: 终态停止调度', ticks.length === 2 && rescheduleCount === 2)
    // cancel 幂等（随后调用不抛）
    let cancelThrew = false
    try { cancelPoll(); cancelPoll() } catch { cancelThrew = true }
    check('startTaskPolling: cancel 可重复调用', !cancelThrew && cancelled)

    // 轮询请求失败（网络抖动）不终止循环：继续调度
    let errReschedule = 0
    const scheduledErr = []
    H.startTaskPolling('k2', () => {}, {
      api: () => Promise.reject(new Error('boom')),
      schedule: (fn) => { errReschedule += 1; scheduledErr.push(fn); return () => {} },
    })
    await scheduledErr[0]()
    check('startTaskPolling: 请求失败继续轮询', errReschedule === 2)

    // 实现后审查修正：not-found 类错误（任务已被删除）→ 停轮询，不空转；
    // 中文文案「不存在」同样停。其它错误维持继续（上方 boom 断言不回归）。
    let nfReschedule = 0
    const scheduledNf = []
    H.startTaskPolling('k3', () => {}, {
      api: () => Promise.reject(new Error('HTTP 404')),
      schedule: (fn) => { nfReschedule += 1; scheduledNf.push(fn); return () => {} },
    })
    await scheduledNf[0]()
    check('startTaskPolling: HTTP 404（not-found 类）停止调度（被删任务不空转）', nfReschedule === 1)
    let nfRescheduleZh = 0
    const scheduledNfZh = []
    H.startTaskPolling('k4', () => {}, {
      api: () => Promise.reject(new Error('任务不存在')),
      schedule: (fn) => { nfRescheduleZh += 1; scheduledNfZh.push(fn); return () => {} },
    })
    await scheduledNfZh[0]()
    check('startTaskPolling: 「不存在」文案同样停止调度', nfRescheduleZh === 1)
  } catch (error) {
    // 符号缺失/行为异常时整体记 FAIL（不让未捕获异常中断后续既有断言）
    check('Plan 2b Task 1 断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ Plan 2b Task 2：任务提示词构建器（纯函数）═══
   纯字符串组装（不触 ctx / React）；后续 Task 3/4/5 的视图经会话桥投递给 Agent。 */
{
  const B = loadedModule.__testHooks
  try {
    const task = {
      id: 'k9',
      status: 'waiting-outline',
      workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
      outlineVersion: 2,
      confirmedOutlineVersion: 2,
      outline: { version: 2, pages: [{ id: 'p1', title: '结论摘要', bullets: ['a'] }, { id: 'p2', title: '核心指标', bullets: [] }] },
      brief: { topic: 'Q3 经营复盘', format: 'pptx' },
      materials: [{ name: 'q3.xlsx', size: 1, path: '/t/k9/materials/q3.xlsx', status: 'ready' }],
      artifacts: [],
      events: [],
    }
    const full = B.buildTaskPrompt(task)
    check('buildContinuePrompt: 含任务 id / 已确认版本 / 页数 / artifact 登记要求', (() => {
      const text = B.buildContinuePrompt(task)
      return text.includes('任务 ID：k9') && text.includes('v2') && text.includes('2 页')
        && text.includes('artifact') && text.includes('completed')
    })())
    check('buildOutlineRevisePrompt: 含任务 id / 当前版本 / 指令 / outline 动作 / 停等确认', (() => {
      const text = B.buildOutlineRevisePrompt(task, '合并第 3、4 页')
      return text.includes('任务 ID：k9') && text.includes('v2') && text.includes('合并第 3、4 页')
        && text.includes('outline') && text.includes('等待用户')
    })())
    check('buildOutlineRevisePrompt: 空指令抛错', (() => {
      try { B.buildOutlineRevisePrompt(task, '   '); return false } catch { return true }
    })())
    check('buildNeedsInputPrompt: 含任务 id / 问题 / 回答', (() => {
      const text = B.buildNeedsInputPrompt(task, '利润口径？', '只看华东区')
      return text.includes('任务 ID：k9') && text.includes('利润口径？') && text.includes('只看华东区')
    })())
    check('buildNeedsInputPrompt: 空回答抛错', (() => {
      try { B.buildNeedsInputPrompt(task, 'q', '  '); return false } catch { return true }
    })())
    check('buildContinueEditPrompt: 含任务 id / 产物路径 / 只重做相关部分', (() => {
      const withArtifacts = Object.assign({}, task, { artifacts: [{ type: 'pptx', path: '/ws/deck.pptx', status: 'ready' }] })
      const text = B.buildContinueEditPrompt(withArtifacts, '把第 3 页改成折线图')
      return text.includes('任务 ID：k9') && text.includes('/ws/deck.pptx') && text.includes('把第 3 页改成折线图')
    })())
    check('buildContinueEditPrompt: 空指令抛错', (() => {
      try { B.buildContinueEditPrompt(task, ''); return false } catch { return true }
    })())
    check('buildRegeneratePrompt: 含任务 id / 产物类型 / 重新登记要求', (() => {
      const text = B.buildRegeneratePrompt(task, { type: 'pptx', path: '/ws/old.pptx', status: 'missing' })
      return text.includes('任务 ID：k9') && text.includes('pptx') && text.includes('artifact')
    })())
    check('buildTaskPrompt 不回归：Brief 文本仍含任务 id 与素材路径（Task 6 契约）',
      full.includes('任务 ID：k9') && full.includes('/t/k9/materials/q3.xlsx'))
  } catch (error) {
    // 符号缺失/行为异常时整体记 FAIL（不让未捕获异常中断后续既有断言）
    check('Plan 2b Task 2 断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ Plan 2b Task 3a：大纲页操作纯函数 ═══
   多字段页列表编辑一律下沉为模块级纯函数（stub React 无重渲染），视图只做
   setState 接线；冒烟直接断言纯函数的拷贝/换位/唯一 id/归一化比较语义。 */
{
  const O = loadedModule.__testHooks.outlineOps
  try {
    const pages = [
      { id: 'p1', title: '结论摘要', purpose: '快速理解结论', bullets: ['收入+18%'], pageType: '结论页' },
      { id: 'p2', title: '核心指标', bullets: ['a', 'b'] },
      { id: 'p3', title: '趋势', bullets: [] },
    ]
    check('clonePages 深拷贝（改副本不动原数组）', (() => {
      // 整理级修正（计划笔误）：原文 pages3() 每次调用重建样本，"改副本不动原数组"
      // 无从对照；改用本块共享 pages——同一源实例上验证 title/bullets 均不被副本改动波及。
      const clone = O.clonePages(pages)
      clone[0].title = 'X'; clone[1].bullets.push('Z')
      return pages[0].title === '结论摘要' && pages[1].bullets.length === 2
    })())
    check('movePage: 上移换位且不越界', O.movePage([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], 1, -1)[1].id === 'p1')
    check('movePage: 越界返回原顺序（不抛）',
      O.movePage([{ id: 'p1' }, { id: 'p2' }], 0, -1)[0].id === 'p1'
      && O.movePage([{ id: 'p1' }, { id: 'p2' }], 1, 1)[1].id === 'p2')
    check('copyPage: 复制到后一位且 id 全局唯一', (() => {
      const next = O.copyPage([{ id: 'p1', title: 'A' }, { id: 'p2', title: 'B' }], 0)
      // 强化（反向验证可测性）：连续 id 样本下 uniquePageId 永不碰撞，
      // 追加碰撞让步用例——副本 id 必须避开**已占用**的 p2（uniquePageId 去重）。
      const clash = O.copyPage([{ id: 'p2', title: 'B' }], 0)
      return next.length === 3 && next[1].title === 'A' && next[1].id !== 'p1' && next[1].id !== 'p2'
        && clash.length === 2 && clash[1].id !== 'p2' && clash[0].id === 'p2'
    })())
    check('addPage: 追加新页（唯一 id + 注入标题）', (() => {
      const next = O.addPage([{ id: 'p1' }, { id: 'p2' }], '新页面')
      const clash = O.addPage([{ id: 'p2' }], '新页面') // 同上：p2 已占用时必须让步
      return next.length === 3 && next[2].id !== 'p1' && next[2].id !== 'p2' && next[2].title === '新页面'
        && clash.length === 2 && clash[1].id !== 'p2'
    })())
    check('removePage: 删除目标页', O.removePage([{ id: 'p1' }, { id: 'p2' }], 0).length === 1)
    check('parseBullets: 丢空行、保留内容原样', JSON.stringify(O.parseBullets('a\n\n b \n')) === JSON.stringify(['a', ' b ']))
    check('outlineDiffers: 同构 false / 改标题或要点或类型 true', (() => {
      const saved = [{ id: 'p1', title: 'A', bullets: ['x'], pageType: '结论页' }]
      const same = O.clonePages(saved)
      const t = O.clonePages(saved); t[0].title = 'B'
      const b = O.clonePages(saved); b[0].bullets = ['x', 'y']
      const ty = O.clonePages(saved); ty[0].pageType = '对比页'
      const pu = O.clonePages(saved); pu[0].purpose = '目的'
      return !O.outlineDiffers(same, saved) && O.outlineDiffers(t, saved)
        && O.outlineDiffers(b, saved) && O.outlineDiffers(ty, saved) && O.outlineDiffers(pu, saved)
    })())
    check('outlineDiffers: undefined 与空串的 purpose 视为相同', (() => {
      const saved = [{ id: 'p1', title: 'A', bullets: [] }]
      const local = [{ id: 'p1', title: 'A', bullets: [], purpose: '' }]
      return !O.outlineDiffers(local, saved)
    })())
  } catch (error) {
    // 符号缺失/行为异常时整体记 FAIL（不让未捕获异常中断后续既有断言）
    check('Plan 2b Task 3a 断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ Plan 2b Task 3b：大纲确认视图（stub React 直接渲染 + 点击断言）═══
   面板的核心控制点：大纲必须经用户确认才继续生成。stub 无重渲染——dirty 由
   渲染期纯函数直算，异步链一律 await；共享状态（apiCallsOutline/sent/…）
   每条断言前经 resetCase() 重置（计划注记的实现）。 */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  let apiCallsOutline = []; let sent = []; let updatedWith = null; let backed = false; let extra = null
  const outlineTask = () => ({
    id: 'k1', title: 'Q3 经营复盘', status: 'waiting-outline',
    workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
    brief: { topic: 'Q3 经营复盘', format: 'pptx' },
    outlineVersion: 1,
    outline: { version: 1, pages: [
      { id: 'p1', title: '结论摘要', purpose: '帮助管理层快速理解', bullets: ['收入同比增长 18%'], pageType: '结论页' },
      { id: 'p2', title: '核心经营指标', bullets: ['利润率下降 2.4pt'], pageType: 'KPI 数据页' },
    ] },
    materials: [], artifacts: [],
    events: [{ at: '2026-09-16T04:00:00.000Z', kind: 'outline', text: '已生成大纲 v1（2 页）' }],
  })
  // 整理级修正：计划原文的形参 extra 遮蔽了外层 let extra，各例 `extra = {...}`
  // 全部失效——去掉形参，读外层变量（计划注记「每条 check 前重置 extra」的语义）。
  const outlineOpts = () => Object.assign({
    task: outlineTask(),
    api: (method, body) => { apiCallsOutline.push({ method, body }); return Promise.resolve(Object.assign({}, outlineTask(), { outlineVersion: (body && body.pages ? 2 : outlineTask().outlineVersion), status: method === 'tasks.confirmOutline' ? 'building' : 'waiting-outline', confirmedOutlineVersion: method === 'tasks.confirmOutline' ? (body && body.version) : undefined })) },
    sendToSession: (text, wsId) => { sent.push({ text, wsId }); return Promise.resolve('submitted') },
    onUpdated: (next) => { updatedWith = next },
    onBack: () => { backed = true },
  }, extra || {})
  const resetCase = () => { apiCallsOutline = []; sent = []; updatedWith = null; backed = false; extra = null }
  const outlineTree = () => H.makeOutlineReviewView(t, outlineOpts())({})
  try {
    resetCase()
    const tree = outlineTree()
    check('大纲视图根类名 sp-view-outline', !!byClass(tree, 'sp-view-outline').length)
    check('大纲视图渲染页卡片×2 + 页标题输入', (() => {
      // 整理级修正：byClass 是子串匹配，容器 sp-outline-page**s** 会顺带命中
      // 片段 sp-outline-page——页卡片改用全等等值筛选（语义不变：卡片计数）。
      const pages = collectElements(tree).filter((el) => classOf(el) === 'sp-outline-page')
      const titles = byClass(tree, 'sp-page-title')
      return pages.length === 2 && titles.length === 2 && titles[0].props.value === '结论摘要'
    })())
    check('大纲视图渲染目的/要点/类型控件 + 页操作四钮 + 首页 up 禁用', (() => {
      const page = collectElements(tree).filter((el) => classOf(el) === 'sp-outline-page')[0]
      return !!findElement(page, (el) => classOf(el) === 'sp-page-purpose')
        && !!findElement(page, (el) => classOf(el) === 'sp-page-bullets')
        && !!findElement(page, (el) => classOf(el) === 'sp-page-type')
        && !!findElement(page, (el) => classOf(el) === 'sp-page-up') && !!findElement(page, (el) => classOf(el) === 'sp-page-down')
        && !!findElement(page, (el) => classOf(el) === 'sp-page-copy') && !!findElement(page, (el) => classOf(el) === 'sp-page-delete')
        && findElement(page, (el) => classOf(el) === 'sp-page-up').props.disabled === true
    })())
    check('页类型下拉含规格十类（以值抽查标题页/流程图/结束页）', (() => {
      // 强化（任务书：十类齐全必须真断言）：下拉恰 10 个 option + 十键文案齐全，
      // 覆盖原文的三点抽查（title/flow/end 在十键之内）。
      const sel = findElement(tree, (el) => classOf(el) === 'sp-page-type')
      const texts = treeText(sel)
      const KEYS = ['pageTypeTitle', 'pageTypeSummary', 'pageTypeKpi', 'pageTypeTrend', 'pageTypeCompare',
        'pageTypeTimeline', 'pageTypeFlow', 'pageTypeCase', 'pageTypePlan', 'pageTypeEnd']
      return !!(sel.props && Array.isArray(sel.children)) && sel.children.length === 10
        && KEYS.every((k) => texts.includes(k))
    })())
    check('主按钮 sp-outline-confirm 存在且未 busy 可点；back 按钮存在', (() => {
      const btn = findElement(tree, (el) => classOf(el) === 'sp-outline-confirm')
      return !!btn && btn.props.disabled !== true && !!findElement(tree, (el) => classOf(el) === 'sp-back')
    })())

    resetCase()
    check('有注入的未保存修改 → sp-outline-dirty-banner + sp-outline-save 出现', (() => {
      const modified = outlineTask().outline.pages.map((p, i) => i === 0 ? Object.assign({}, p, { title: '改过的标题' }) : Object.assign({}, p))
      extra = { initialPages: modified }
      const dirtyTree = H.makeOutlineReviewView(t, outlineOpts())({})
      const ok = !!byClass(dirtyTree, 'sp-outline-dirty-banner').length && !!findElement(dirtyTree, (el) => classOf(el) === 'sp-outline-save')
      extra = null
      return ok
    })())

    resetCase()
    check('修改指令为空点「让 Agent 修改」→ send 不被调用 + 错误横幅', await (async () => {
      const revTree = outlineTree()
      const btn = findElement(revTree, (el) => classOf(el) === 'sp-outline-revise')
      await btn.props.onClick()
      return sent.length === 0 && !!findElement(revTree, (el) => classOf(el) === 'sp-msg-err')
    })())

    resetCase()
    check('注入修改指令 → 点修改 → sendToSession 收到含指令与任务 id 的文本（未自动确认大纲）', await (async () => {
      extra = { reviseText: '合并第 3、4 页' }
      const revTree = H.makeOutlineReviewView(t, outlineOpts())({})
      const btn = findElement(revTree, (el) => classOf(el) === 'sp-outline-revise')
      await btn.props.onClick()
      extra = null
      return sent.length === 1 && sent[0].text.includes('合并第 3、4 页') && sent[0].text.includes('任务 ID：k1')
        && sent[0].wsId === 'ws1' && apiCallsOutline.every((c) => c.method !== 'tasks.confirmOutline')
    })())

    resetCase()
    check('确认大纲（无未保存修改）→ confirmOutline(version=outlineVersion) → 继续 send 继续指令 → onUpdated 收 building 记录', await (async () => {
      const tree2 = outlineTree()
      const btn = findElement(tree2, (el) => classOf(el) === 'sp-outline-confirm')
      await btn.props.onClick()
      const outlineCall = apiCallsOutline.every((c) => c.method !== 'tasks.outline') // 干净态不先存
      const confirmCall = apiCallsOutline.find((c) => c.method === 'tasks.confirmOutline')
      return outlineCall && !!confirmCall && confirmCall.body.version === 1 && sent.length === 1
        && sent[0].text.includes('继续') && updatedWith && updatedWith.status === 'building'
    })())

    resetCase()
    check('注入未保存修改 → 点确认 → 先 tasks.outline（v2）再 confirmOutline(version=2)', await (async () => {
      const modified = outlineTask().outline.pages.map((p, i) => i === 0 ? Object.assign({}, p, { title: '新结论' }) : Object.assign({}, p))
      extra = { initialPages: modified }
      const tree3 = H.makeOutlineReviewView(t, outlineOpts())({})
      const btn = findElement(tree3, (el) => classOf(el) === 'sp-outline-confirm')
      await btn.props.onClick()
      extra = null
      const savedCall = apiCallsOutline.find((c) => c.method === 'tasks.outline')
      const confirmCall2 = apiCallsOutline.find((c) => c.method === 'tasks.confirmOutline')
      return !!savedCall && savedCall.body.pages[0].title === '新结论' && !!confirmCall2 && confirmCall2.body.version === 2
    })())

    resetCase()
    check('sendToSession 返回 copied → 提示粘贴横幅且任务保持已确认（不再 send 第二次）', await (async () => {
      extra = { sendToSession: (text, ws) => { sent.push({ text, ws }); return Promise.resolve('copied') } }
      const tree4 = H.makeOutlineReviewView(t, outlineOpts())({})
      const btn = findElement(tree4, (el) => classOf(el) === 'sp-outline-confirm')
      await btn.props.onClick()
      extra = null
      return sent.length === 1 && !!findElement(tree4, (el) => classOf(el) === 'sp-msg-err')
    })())

    resetCase()
    check('confirmOutline 版本不匹配（400）→ 重取 tasks.get 并载入新版本 + 提示', await (async () => {
      let gets = 0
      extra = {
        api: (method, body) => {
          apiCallsOutline.push({ method, body })
          if (method === 'tasks.confirmOutline') return Promise.reject(new Error('大纲版本不匹配（当前 v3）'))
          if (method === 'tasks.get') { gets += 1; return Promise.resolve(Object.assign(outlineTask(), { outlineVersion: 3, outline: { version: 3, pages: [{ id: 'p1', title: 'Agent 改过的页', bullets: [] }] } })) }
          return Promise.resolve(outlineTask())
        },
      }
      const tree5 = H.makeOutlineReviewView(t, outlineOpts())({})
      const btn = findElement(tree5, (el) => classOf(el) === 'sp-outline-confirm')
      await btn.props.onClick()
      extra = null
      return gets === 1 && !!findElement(tree5, (el) => classOf(el) === 'sp-outline-resync')
    })())

    resetCase()
    check('dirty 时点返回 → 未保存确认行存在且干净态隐藏；dirty 的 back 被守卫拦住（不 onBack）', await (async () => {
      const cleanTree = outlineTree()
      const confirmRow = findElement(cleanTree, (el) => classOf(el) === 'sp-revise-dirty-confirm')
      const hiddenWhenClean = !!confirmRow && !!confirmRow.props.style && confirmRow.props.style.display === 'none'
      const backBtn = findElement(cleanTree, (el) => classOf(el) === 'sp-back')
      await backBtn.props.onClick()
      const cleanBacked = backed; backed = false
      const modified = outlineTask().outline.pages.map((p, i) => i === 0 ? Object.assign({}, p, { title: 'X' }) : Object.assign({}, p))
      extra = { initialPages: modified }
      const dirtyTree2 = H.makeOutlineReviewView(t, outlineOpts())({})
      await findElement(dirtyTree2, (el) => classOf(el) === 'sp-back').props.onClick()
      const hasConfirm = !!findElement(dirtyTree2, (el) => classOf(el) === 'sp-discard-confirm')
      extra = null
      // 判别力所在：dirty 的 back 必须被 requestBack 守卫拦住——backed 仍 false；
      // 若守卫被删，onBack 会直接触发 → 本断言 FAIL（反向验证锚点）
      return cleanBacked === true && hiddenWhenClean === true && hasConfirm === true && backed === false
    })())

    resetCase()
    check('仅剩一页时删除按钮禁用（防误删到空大纲）', (() => {
      const single = outlineTask()
      single.outline = { version: 1, pages: [{ id: 'p1', title: '独苗', bullets: [] }] }
      extra = { task: single }
      const oneTree = H.makeOutlineReviewView(t, outlineOpts())({})
      extra = null
      return findElement(oneTree, (el) => classOf(el) === 'sp-page-delete').props.disabled === true
    })())

    resetCase()
    check('无大纲记录（outlineVersion 0）→ sp-outline-empty 空态', (() => {
      const noOutline = outlineTask(); noOutline.outline = undefined; noOutline.outlineVersion = 0
      extra = { task: noOutline }
      const emptyTree = H.makeOutlineReviewView(t, outlineOpts())({})
      extra = null
      return !!byClass(emptyTree, 'sp-outline-empty').length
    })())

    resetCase()
    check('i18n 字典含大纲视图全部键（zh+en）', (() => {
      const keys = ['outlineConfirm', 'outlineSave', 'outlineRevise', 'outlineAdd', 'pageNew',
        'pageTypeTitle', 'pageTypeSummary', 'pageTypeKpi', 'pageTypeTrend', 'pageTypeCompare',
        'pageTypeTimeline', 'pageTypeFlow', 'pageTypeCase', 'pageTypePlan', 'pageTypeEnd']
      return keys.every((k) => zhDict()[k] !== undefined && enDict()[k] !== undefined)
    })())
  } catch (error) {
    // 符号缺失/行为异常时整体记 FAIL（不让未捕获异常中断后续既有断言）
    check('Plan 2b Task 3b 断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ Plan 2b Task 4：生成进度视图（六阶段时间线 + 状态变体 + 操作接线）═══
   stub React 不重渲染：变体按 task prop 条件渲染（各断言直接换 task）；
   answerText 与 Task 3 reviseText 同法经 options 注入初值；点击后出现的行
   （sp-msg-ok / sp-msg-err）常驻渲染、display 切换。异步点击一律
   check(name, await (async () => …)())——check 是同步的，裸传 Promise 恒 truthy。 */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  const baseTask = (over) => Object.assign({
    id: 'k1', title: 'Q3 经营复盘', status: 'building',
    workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
    brief: { topic: 'Q3', format: 'pptx' }, outlineVersion: 1,
    outline: { version: 1, pages: [{ id: 'p1', title: 'a', bullets: [] }, { id: 'p2', title: 'b', bullets: [] }] },
    stage: { key: 'building', index: 3, total: 6, detail: '正在生成第 4/9 页：区域表现' },
    materials: [], artifacts: [],
    events: [
      { at: '2026-09-16T04:05:00.000Z', kind: 'status', text: '状态 → building' },
      { at: '2026-09-16T04:03:00.000Z', kind: 'outline', text: '已生成大纲 v1（2 页），等待确认' },
      { at: '2026-09-16T04:02:00.000Z', kind: 'stage', text: '阶段 → building（3/6）' },
    ],
  }, over)
  // 整理级修正：计划原文先 `const sent = []` 后又整行重复 let 声明
  // backedToOutline / openedSession（重复声明 SyntaxError）——合并为一行；
  // sent 恒不整体替换（reset 用 length=0）保持 const，apiCalls 重赋值保持 let。
  const sent = []; let apiCalls = []; let backedToOutline = false; let updatedWith = null; let openedSession = false; let extra = null
  const progressOpts = () => Object.assign({
    task: baseTask(),
    api: (method, body) => { apiCalls.push({ method, body }); return Promise.resolve(baseTask({ status: body && body.patch && body.patch.status ? body.patch.status : 'building' })) },
    sendToSession: (text, ws) => { sent.push({ text, ws }); return Promise.resolve('submitted') },
    onUpdated: (next) => { updatedWith = next },
    onBackToOutline: () => { backedToOutline = true },
    openSession: () => { openedSession = true },
  }, extra || {})
  const progressTree = () => H.makeProgressView(t, progressOpts())({})
  // 整理级修正：reset 补 updatedWith = null（计划原文漏清，Task 3 resetCase 同法）。
  const reset = () => { sent.length = 0; apiCalls = []; backedToOutline = false; openedSession = false; updatedWith = null; extra = null }
  try {
    const PS = H.progressSteps
    // 纯函数：阶段映射（标题的「尾步 active」与判定式 every(pending) 矛盾——
    // 以判定式为准，计划 Step 3 骨架注释亦写「无汇报：全部 pending」）。
    check('progressSteps: 无 stage → 全 pending', (() => {
      const steps = PS(null)
      return steps.length === 6 && steps.every((s) => s.state === 'pending')
    })())
    check('progressSteps: 3/6 → 前两步 done、第三步 active、后三步 pending', (() => {
      const steps = PS({ index: 3, total: 6, key: 'building' })
      return steps[0].state === 'done' && steps[1].state === 'done' && steps[2].state === 'active' && steps[5].state === 'pending'
    })())
    check('progressSteps: 任意 total 归一映射（total=12, index=4 → 第 2 步 active）', PS({ index: 4, total: 12, key: 'x' })[1].state === 'active')
    // 语义级强化：4/12*6 恰为整值（2.0），Math.ceil 与 Math.round 不可判别
    // ——补一条非整比例断言，锁死计划 Step 5 反向验证（ceil→round 必须 FAIL 一条）。
    check('progressSteps: 非整比例向上取整（total=5, index=2 → 2.4 → 第 3 步 active、第 2 步 done）', (() => {
      const steps = PS({ index: 2, total: 5, key: 'building' })
      return steps[1].state === 'done' && steps[2].state === 'active'
    })())
    check('lastEventOfKind: 取该 kind 最新一条（fail 原因 / needs-input 问题都用它）', (() => {
      const task = baseTask({ status: 'failed', events: [
        { at: '2026-09-16T05:00:00.000Z', kind: 'fail', text: '渲染失败：字体缺失' },
        { at: '2026-09-16T04:05:00.000Z', kind: 'status', text: '状态 → building' },
      ] })
      const earlier = baseTask({ status: 'failed', events: [
        { at: '2026-09-16T04:00:00.000Z', kind: 'fail', text: '较早的失败' },
        { at: '2026-09-16T05:00:00.000Z', kind: 'fail', text: '渲染失败：字体缺失' },
      ] })
      return H.lastEventOfKind(task, 'fail')?.text === '渲染失败：字体缺失'
        && H.lastEventOfKind(earlier, 'fail')?.text === '渲染失败：字体缺失'
        && H.lastEventOfKind(task, 'nope') === null
    })())

    reset()
    const tree = progressTree()
    // 整理级修正：byClass 子串匹配会顺带命中容器 sp-steps——步计数改 token 拆分
    // （Task 3 同法，语义不变：六步 + 三种状态类名在场）；标题含根类名→补断言。
    check('进度视图根类名 + 固定六阶段时间线（done/active/pending 类名）', (() => {
      const steps = collectElements(tree).filter((el) => String(classOf(el)).split(/\s+/).indexOf('sp-step') !== -1)
      return !!byClass(tree, 'sp-view-progress').length && steps.length === 6
        && !!byClass(tree, 'sp-step-done').length && !!byClass(tree, 'sp-step-active').length && !!byClass(tree, 'sp-step-pending').length
    })())
    check('渲染 stage 说明行 + detail + 事件列表（≤5 条）', (() => {
      const events = byClass(tree, 'sp-event')
      return !!byClass(tree, 'sp-progress-line').length && !!byClass(tree, 'sp-progress-detail').length
        && events.length > 0 && events.length <= 5
    })())
    check('进行中：sp-open-session 与 sp-cancel 存在', !!findElement(tree, (el) => classOf(el) === 'sp-open-session') && !!findElement(tree, (el) => classOf(el) === 'sp-cancel'))

    reset()
    check('点取消任务 → tasks.update status=cancelled → onUpdated', await (async () => {
      const tree2 = progressTree()
      await findElement(tree2, (el) => classOf(el) === 'sp-cancel').props.onClick()
      const call = apiCalls.find((c) => c.method === 'tasks.update')
      return !!call && call.body.patch.status === 'cancelled' && updatedWith && updatedWith.status === 'cancelled'
    })())

    reset()
    check('点打开会话 → openSession 被调用', await (async () => {
      await findElement(progressTree(), (el) => classOf(el) === 'sp-open-session').props.onClick()
      return openedSession === true
    })())

    reset()
    // 标题含 sp-launch-recovery → 补容器在场断言（变体按 task.status 条件渲染）。
    check('waiting-launch 变体：sp-launch-recovery + 重试启动 → send 完整 Brief（buildTaskPrompt 文本）→ submitted → status analyzing → onUpdated', await (async () => {
      extra = { task: baseTask({ status: 'waiting-launch' }) }
      const tree3 = progressTree()
      const hasRecovery = !!findElement(tree3, (el) => classOf(el) === 'sp-launch-recovery')
      await findElement(tree3, (el) => classOf(el) === 'sp-launch-retry').props.onClick()
      extra = null
      return hasRecovery && sent.length === 1 && sent[0].text.includes('任务 ID：k1') && sent[0].text.includes('请制作一份演示文稿')
        && updatedWith && updatedWith.status === 'analyzing'
    })())

    reset()
    check('needs-input 变体：问题文本来自最后一条 needs-input 事件；注入回答点发送 → send 补充信息提示', await (async () => {
      extra = { task: baseTask({ status: 'needs-input', events: [{ at: 't', kind: 'needs-input', text: '利润下降口径？' }] }), answerText: '只看华东区' }
      const tree4 = progressTree()
      await findElement(tree4, (el) => classOf(el) === 'sp-needs-input-send').props.onClick()
      extra = null
      return treeText(tree4).includes('利润下降口径？') && sent.length === 1
        && sent[0].text.includes('利润下降口径？') && sent[0].text.includes('只看华东区')
    })())

    reset()
    // 计划注记（Step 1 尾）：本视图至少断言 needs-input 发送后 copied → sp-msg-err 一条。
    check('needs-input 发送 copied（未达会话）→ sp-msg-err 一条在场且不推进状态', await (async () => {
      extra = {
        task: baseTask({ status: 'needs-input', events: [{ at: 't', kind: 'needs-input', text: '利润下降口径？' }] }),
        answerText: '只看华东区',
        sendToSession: (text, ws) => { sent.push({ text, ws }); return Promise.resolve('copied') },
      }
      const copiedTree = progressTree()
      await findElement(copiedTree, (el) => classOf(el) === 'sp-needs-input-send').props.onClick()
      extra = null
      const errRows = collectElements(copiedTree).filter((el) => classOf(el) === 'sp-msg-err')
      return sent.length === 1 && errRows.length === 1 && updatedWith === null
    })())

    reset()
    check('failed 变体：显示失败原因（最后一条事件）+ sp-fail-retry → send 继续指令 + sp-fail-back-outline → onBackToOutline', await (async () => {
      extra = { task: baseTask({ status: 'failed', events: [{ at: 't', kind: 'fail', text: '渲染验收失败：字体缺失' }] }) }
      const tree5 = progressTree()
      await findElement(tree5, (el) => classOf(el) === 'sp-fail-retry').props.onClick()
      await findElement(tree5, (el) => classOf(el) === 'sp-fail-back-outline').props.onClick()
      extra = null
      return treeText(tree5).includes('字体缺失') && sent.length === 1 && sent[0].text.includes('继续') && backedToOutline === true
    })())

    reset()
    check('cancelled：只读终态提示 sp-terminal-note，无取消/重试按钮', (() => {
      extra = { task: baseTask({ status: 'cancelled' }) }
      const cancelledTree = H.makeProgressView(t, progressOpts())({})
      extra = null
      const liveTree = H.makeProgressView(t, progressOpts())({})
      return !!byClass(cancelledTree, 'sp-terminal-note').length
        && !findElement(cancelledTree, (el) => classOf(el) === 'sp-cancel')
        && !!findElement(liveTree, (el) => classOf(el) === 'sp-cancel')
    })())

    reset()
    check('i18n 键齐全（zh+en）', (() => {
      const keys = ['stageReceive', 'stageAnalyze', 'stageOutline', 'stageBuild', 'stagePackage', 'stageReview',
        'openSession', 'cancelTask', 'launchRecovery', 'launchRetry', 'needsInput', 'inputAnswer', 'inputSend',
        'errorRecovery', 'failRetry', 'failBackOutline', 'terminalNote', 'waitingStage']
      return keys.every((k) => zhDict()[k] !== undefined && enDict()[k] !== undefined)
    })())
  } catch (error) {
    // 符号缺失/行为异常时整体记 FAIL（不让未捕获异常中断后续既有断言）
    check('Plan 2b Task 4 断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ Plan 2b Task 5：结果视图（产物条目 + 复制路径 + 自然语言继续修改）═══
   stub React 不重渲染：快捷 chip 的 onClick 真接线（真实 React 可观察
   setContinueText），冒烟按计划断到「四个 chip 且 onClick 是函数且点击后
   sent 仍空」——这是该约束下的最大可证性（Task 3 同类处理）；continueText
   与 Task 3/4 的 reviseText/answerText 同法经 options 注入初值；提示行
   （sp-msg-ok / sp-msg-err）常驻渲染、display 切换；异步断言一律
   check(name, await (async () => …)())。navigator.clipboard 临时挂到
   sandboxGlobal（bundle 所在 vm realm 的 globalThis——外层 realm 与 bundle
   无关），断言后必须还原。 */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  const resultTask = (over) => Object.assign({
    id: 'k1', title: 'Q3 经营复盘', status: 'completed',
    workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
    brief: { topic: 'Q3 经营复盘', format: 'pptx' },
    outlineVersion: 1, outline: { version: 1, pages: [{ id: 'p1', title: 'a', bullets: [] }, { id: 'p2', title: 'b', bullets: [] }, { id: 'p3', title: 'c', bullets: [] }] },
    materials: [], artifacts: [
      { type: 'pptx', path: '/ws/Q3-review.pptx', status: 'ready' },
      { type: 'pdf', path: '/ws/Q3-review.pdf', status: 'missing' },
    ],
    events: [],
  }, over)
  // 整理级修正（任务书列明的计划 setup 瑕疵，断言语义与数量不变）：
  //  ① resultTask 去掉多余键 events2: undefined；
  //  ② let apiCallsR 前置与 sent 同处声明（计划原文先用后声明），并删去
  //     死变量 apiCalls——resultOpts/resetR 通篇用的都是 apiCallsR（③）。
  const sent = []; let apiCallsR = []; let updatedWith = null; let extra = null
  const resultOpts = () => Object.assign({
    task: resultTask(),
    api: (method, body) => { apiCallsR.push({ method, body }); return Promise.resolve(Object.assign({}, resultTask(), body && body.patch && body.patch.status ? { status: body.patch.status } : {})) },
    sendToSession: (text, ws) => { sent.push({ text, ws }); return Promise.resolve('submitted') },
    onUpdated: (next) => { updatedWith = next },
  }, extra || {})
  const resetR = () => { sent.length = 0; apiCallsR = []; updatedWith = null; extra = null }
  const resultTree = () => H.makeResultView(t, resultOpts())({})
  // 整理级修正：byClass('sp-artifact') 子串匹配会顺带命中容器 sp-artifacts /
  // sp-artifact-* 子元素（Task 3/4 sp-step/sp-outline-page 同法）——产物条目
  // 计数改 token 全等筛选（语义不变：条目卡片数）。
  const artifactItems = (tree) => collectElements(tree).filter((el) => classOf(el) === 'sp-artifact')
  try {
    const tree = resultTree()
    // 标题含根类名 → 判定式补根类名在场（Task 4 同法；语义只增强不削弱）。
    // 实现后审查修正：摘要措辞按 brief.format 分流（resultSummaryPptx /
    // resultSummaryHtml），不再把 {format} 原值填进文案。
    check('结果视图根类名 + 摘要行含页数与 PPTX 形态文案（resultSummaryPptx 分流）', (() => {
      const summary = byClass(tree, 'sp-result-summary')
      return !!byClass(tree, 'sp-view-result').length
        && !!summary.length && treeText(summary).includes('3 页') && treeText(summary).includes('PPTX')
        && !treeText(summary).includes('HTML')
    })())
    check('结果摘要按 brief.format 分流：html 任务 → HTML 在线演示文案', (() => {
      extra = { task: resultTask({ brief: { topic: 'Q3 经营复盘', format: 'html' } }) }
      const htmlTree = resultTree()
      extra = null
      const summary = byClass(htmlTree, 'sp-result-summary')
      return !!summary.length && treeText(summary).includes('HTML') && treeText(summary).includes('3 页')
    })())
    check('产物条目×2：ready 徽标 + missing 丢失提示 + 路径文本 + 复制按钮', (() => {
      const items = artifactItems(tree)
      return items.length === 2
        && !!findElement(items[1], (el) => classOf(el) === 'sp-artifact-copy')
        && treeText(items[1]).includes('missing') || treeText(items[1]).includes('artifactMissing')
    })())
    check('点复制路径 → copyText 收到产物路径（stub navigator.clipboard）', await (async () => {
      const written = []
      sandboxGlobal.navigator = { clipboard: { writeText: (s) => { written.push(s); return Promise.resolve() } } }
      try {
        const tree2 = resultTree()
        // 整理级修正：计划原文在全树找第一个 sp-artifact-copy（= pptx 条目），
        // 断言的却是第二个条目的 pdf 路径——点击对象与期望路径对齐（语义不变：
        // 点某条目的复制按钮 → 写入的是该条目的路径）。
        await findElement(artifactItems(tree2)[1], (el) => classOf(el) === 'sp-artifact-copy').props.onClick()
      } finally {
        sandboxGlobal.navigator = undefined
      }
      return written.length === 1 && written[0] === '/ws/Q3-review.pdf'
    })())
    check('复制在无 navigator 时静默不抛', await (async () => {
      let threw = false
      try { await H.copyText('/ws/x.pptx', { writeText: async () => {} }) } catch (e) { threw = true }
      // 第二参注入实现；缺省 navigator 缺失也必须不抛
      let threw2 = false
      try { await H.copyText('/ws/x.pptx') } catch (e) { threw2 = true }
      return !threw && !threw2
    })())
    check('无产物 → sp-artifacts-empty 空态', (() => {
      extra = { task: resultTask({ artifacts: [] }) }
      const tree3 = resultTree()
      extra = null
      return !!byClass(tree3, 'sp-artifacts-empty').length
    })())
    check('注入修改要求 → 提交修改 → send 含要求与任务 id → submitted → tasks.update building → onUpdated', await (async () => {
      resetR(); extra = { continueText: '把第 3 页改成折线图' }
      const tree4 = resultTree()
      await findElement(tree4, (el) => classOf(el) === 'sp-result-submit').props.onClick()
      extra = null
      const call = apiCallsR.find((c) => c.method === 'tasks.update')
      return sent.length === 1 && sent[0].text.includes('把第 3 页改成折线图') && sent[0].text.includes('任务 ID：k1')
        && !!call && call.body.patch.status === 'building' && updatedWith && updatedWith.status === 'building'
    })())
    check('继续修改发送失败（copied/none）→ sp-msg-err 且状态不变', await (async () => {
      resetR(); extra = { sendToSession: () => Promise.resolve('none'), continueText: '压缩到 7 页' }
      const tree4 = resultTree()
      await findElement(tree4, (el) => classOf(el) === 'sp-result-submit').props.onClick()
      extra = null
      return !!findElement(tree4, (el) => classOf(el) === 'sp-msg-err') && apiCallsR.every((c) => c.method !== 'tasks.update')
    })())
    check('快捷 chip 填入文案（四个 chip 的 onClick 调 onContinueText 不发送）', (() => {
      resetR()
      const chips = byClass(resultTree(), 'sp-result-quick-chip')
      return chips.length === 4 && chips.every((chip) => typeof chip.props.onClick === 'function') && sent.length === 0
    })())
    check('产物丢失条目的「重新生成」→ send buildRegeneratePrompt 文本（含类型与原路径）', await (async () => {
      resetR()
      const tree5 = resultTree()
      const missingItem = artifactItems(tree5)[1]
      await findElement(missingItem, (el) => classOf(el) === 'sp-artifact-regen').props.onClick()
      return sent.length === 1 && sent[0].text.includes('pdf') && sent[0].text.includes('/ws/Q3-review.pdf')
    })())
    check('i18n 键齐全（zh+en）', (() => {
      const keys = ['resultSummaryPptx', 'resultSummaryHtml', 'artifactReady', 'artifactMissing', 'artifactRegen', 'copyPath',
        'artifactsEmpty', 'continueEdit', 'continueSubmit', 'quickRedoPage', 'quickRestyle', 'quickShrink', 'quickRerender']
      return keys.every((k) => zhDict()[k] !== undefined && enDict()[k] !== undefined)
    })())
  } catch (error) {
    // 符号缺失/行为异常时整体记 FAIL（不让未捕获异常中断后续既有断言）
    check('Plan 2b Task 5 断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ Plan 2b Task 6：壳层接线（联动逻辑下沉为可断言的模块级函数）═══
   壳层联动依赖 stub React 不执行的 effect，因此断言策略按计划原文：
   1) openTask 逻辑下沉为模块级 openTaskRecord(entry, deps)（返回 promise，await 判定）；
   2) 路由判定 routeSubView(record)；3) forcedSub 清除判定 shouldClearForced(prev, next)；
   4) 壳层渲染（tabs=2）+ effect 注册后手动执行命中 tasks.list；5) 分发/轮询接线用
   **可破坏的静态锚点**断言（删接线即 FAIL，全部非恒真：定义行/导出行都不满足）。
   整理级修正（计划 setup 瑕疵，断言语义与数量不变）：
    ① shellTasks 前置到使用处之前——计划原文在其声明前引用，const TDZ 必抛；
    ② tabCount 用 token 精确匹配——byClass('sp-tab') 子串会顺带命中容器 sp-tabs
      （计数 3≠2；语义不变：视图切换按钮数）。 */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  const shellTasks = [
    { id: 'k-wait', title: '等待大纲', status: 'waiting-outline', format: 'pptx', workspaceName: 'ws', updatedAt: '2026-09-16T05:00:00.000Z' },
    { id: 'k-done', title: '已完成', status: 'completed', format: 'pptx', workspaceName: 'ws', updatedAt: '2026-09-16T04:00:00.000Z' },
  ]
  try {
    // —— routeSubView 三落点（= viewForStatus 的记录形态包装）——
    check('routeSubView: waiting-outline → 大纲视图工厂落点', H.routeSubView({ status: 'waiting-outline' }) === 'outline')
    check('routeSubView: building/failed/needs-input → progress；completed → result', (() => {
      return H.routeSubView({ status: 'building' }) === 'progress'
        && H.routeSubView({ status: 'failed' }) === 'progress'
        && H.routeSubView({ status: 'needs-input' }) === 'progress'
        && H.routeSubView({ status: 'completed' }) === 'result'
    })())

    // —— openTaskRecord（成功 → onReady；404/异常 → onMissing 且绝不抛）——
    const onReady = []; let missingCount = 0
    const openApi = (method, body) => {
      if (method === 'tasks.get' && body.id === 'k404') return Promise.reject(new Error('HTTP 404'))
      if (method === 'tasks.get') return Promise.resolve({ id: body.id, status: 'waiting-outline', outline: { version: 1, pages: [] } })
      return Promise.resolve({ tasks: [] })
    }
    await H.openTaskRecord({ id: 'k1' }, { api: openApi, onReady: (r) => onReady.push(r), onMissing: () => { missingCount += 1 } })
    check('openTaskRecord: 成功 → onReady 收到完整记录', onReady.length === 1 && onReady[0].id === 'k1')
    await H.openTaskRecord({ id: 'k404' }, { api: openApi, onReady: (r) => onReady.push(r), onMissing: () => { missingCount += 1 } })
    check('openTaskRecord: 404 → onMissing 被调且不抛', missingCount === 1 && onReady.length === 1)

    // —— forcedSub 清除判定 ——
    check('shouldClearForced: 路由变化才清除（同视图刷新不清）',
      H.shouldClearForced({ status: 'building' }, { status: 'waiting-outline' }) === true
      && H.shouldClearForced({ status: 'building' }, { status: 'building' }) === false
      && H.shouldClearForced({ status: 'failed' }, { status: 'waiting-outline' }) === true)

    // —— attention 提示行（AC 2：存在待确认任务时顶部提示）——
    check('attentionEntries: 抽出 attention 组条目（waiting-outline/needs-input），空列表 → 空',
      H.attentionEntries(shellTasks).length === 1 && H.attentionEntries(shellTasks)[0].id === 'k-wait'
      && H.attentionEntries([]).length === 0 && H.attentionEntries(null).length === 0)
    check('attentionEntries: attention 组多条按 updatedAt 倒序（首条=最近更新，非 attention 剔除）', (() => {
      const many = [
        { id: 'a', status: 'needs-input', updatedAt: '2026-09-14T01:00:00.000Z' },
        { id: 'b', status: 'waiting-outline', updatedAt: '2026-09-16T01:00:00.000Z' },
        { id: 'c', status: 'building', updatedAt: '2026-09-17T01:00:00.000Z' },
        { id: 'd', status: 'needs-input', updatedAt: '2026-09-15T01:00:00.000Z' },
      ]
      const got = H.attentionEntries(many).map((e) => e.id)
      return got.length === 3 && got.join('') === 'bda'
    })())
    check('壳层静态锚点：sp-attention-hint 类名与 attentionEntries 已接线',
      clientSource.includes('sp-attention-hint') && clientSource.includes('attentionEntries'))
    check('壳层新类名有样式定义：sp-attention-hint / sp-task-error', (() => {
      const defined = (name) => new RegExp('\\.' + name + '(?![A-Za-z0-9_-])').test(clientSource)
      return defined('sp-attention-hint') && defined('sp-task-error')
    })())

    // —— 壳层渲染（tabs）与 effect 注册（refreshTasks / 轮询）——
    let shellApiCalls = []
    const shellApi = (method, body) => {
      shellApiCalls.push({ method, body })
      if (method === 'tasks.list') return Promise.resolve({ tasks: shellTasks })
      return Promise.resolve({ id: 'k-wait', status: 'waiting-outline', outline: { version: 1, pages: [] } })
    }
    const beforeEffects = hookLog.effects.length
    const panel = H.MakePanelsView(t, { api: shellApi, sendToSession: () => Promise.resolve('submitted') })({})
    const tabCount = collectElements(panel).filter((el) => /(^|\s)sp-tab(\s|$)/.test(classOf(el))).length
    // 手动执行已注册的 effect（refreshTasks / 轮询；返回函数则调用其 cancel）
    const registered = hookLog.effects.slice(beforeEffects)
    for (const fn of registered) { try { const d = fn(); if (typeof d === 'function') d(); } catch { /* 断言型 effect 容错 */ } }
    check('壳层渲染 tabs（新建任务/最近任务）', tabCount === 2)
    check('effect 注册了 tasks.list 刷新（手动执行后命中 tasks.list）', shellApiCalls.some((c) => c.method === 'tasks.list'))
    check('壳层初始渲染不出现 sp-attention-hint（tasks=null → attentionEntries 空，提示行依赖列表数据）',
      byClass(panel, 'sp-attention-hint').length === 0)

    // —— 轮询/任务态接线的静态锚点。原「三工厂 createElement 调用点」锚点
    //    由实现后审查修正块取代：内联工厂调用正是 remount 根因，分发必须
    //    经 ensureDetailView 缓存组件类型（锚点见下方审查修正块）——
    check('壳层轮询锚点：详情 effect 用 isPollingStatus(active.status) 判定 + startTaskPolling(active.id 接线',
      clientSource.includes('startTaskPolling(active.id')
      && clientSource.includes('isPollingStatus(active.status)'))
    check('壳层任务态锚点：SP_VIEW_TASK 参与视图分发 + taskOpenFailed 错误横幅接线',
      clientSource.includes('view === SP_VIEW_TASK') && clientSource.includes('t("taskOpenFailed")'))
    check('新 i18n 键齐全（zh+en）：attentionHint / taskOpenFailed',
      zhDict().attentionHint !== undefined && zhDict().taskOpenFailed !== undefined
      && enDict().attentionHint !== undefined && enDict().taskOpenFailed !== undefined)
  } catch (error) {
    // 符号缺失/行为异常时整体记 FAIL（不让未捕获异常中断后续既有断言）
    check('Plan 2b Task 6 断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ Plan 2b 实现后审查修正（Fix 1）：详情视图组件身份稳定（防轮询 remount）═══
   真 React 按 element type 身份决定 unmount/remount：壳层分发若每次 render 内联
   makeX(t, detail) 调工厂（工厂每次返回**新函数对象**=新类型），轮询 tick 的
   setActive 一触发重渲染就把详情视图整个重建——大纲未保存编辑每 3s 被静默重置
   （stub React 单渲染测不到，这是本块断言存在的理由）。修复两侧协同：
   ① 三视图组件 props 优先、工厂 opts 兜底读 live task/回调（冒烟 `makeX(t,opts)({})`
      旧形态零改动兼容）；② 壳层经模块级 ensureDetailView(cacheRef, sub, taskId, make)
      按 (sub|taskId) 缓存组件类型。saveOnly/resync 的 dirty 基线从 useRef 手管改为
      「task prop 的派生值」——保存/重取成功经 onUpdated(record) 让宿主前移基线。 */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  try {
    // —— ensureDetailView：(sub|taskId) 稳定 → 同一组件类型对象、工厂只执行一次 ——
    check('ensureDetailView: 同 (sub,id) 两次调用返回同一组件类型且工厂单次执行；sub/taskId 变化即重建', (() => {
      let calls = 0
      const make = () => { calls += 1; return function Cached() { return null } }
      const ref = { current: null }
      const a1 = H.ensureDetailView(ref, 'outline', 'k1', make)
      const a2 = H.ensureDetailView(ref, 'outline', 'k1', make)
      const afterA = calls // 复用则应仍为 1
      const b1 = H.ensureDetailView(ref, 'progress', 'k1', make)
      const afterB = calls // sub 变化 → 重建
      const c1 = H.ensureDetailView(ref, 'progress', 'k2', make)
      const c2 = H.ensureDetailView(ref, 'progress', 'k2', make)
      return typeof a1 === 'function' && a1 === a2 && afterA === 1
        && b1 !== a1 && afterB === 2 && c1 !== b1 && c1 === c2 && calls === 3
    })())

    // —— 三视图 props 优先 opts 兜底（宿主传 live props；未传 props 回落 opts）——
    const detailTask = (over) => Object.assign({
      id: 'k1', title: '标题-A', status: 'waiting-outline',
      workspace: { id: 'ws1', name: 'w', path: '/p' },
      brief: { topic: 'x', format: 'pptx' }, outlineVersion: 1,
      outline: { version: 1, pages: [{ id: 'p1', title: '页面甲', bullets: [] }] },
      materials: [], artifacts: [], events: [],
    }, over)
    const propsFirst = (makeFn, taskProps) => {
      const Comp = makeFn(t, {
        task: detailTask({}), api: () => Promise.resolve({}),
        sendToSession: () => Promise.resolve('none'),
        onUpdated: () => {}, onBack: () => {},
      })
      const withProps = treeText(renderTree(Comp({ task: detailTask(taskProps) })))
      const withoutProps = treeText(renderTree(Comp({})))
      return withProps.includes(taskProps.title) && !withProps.includes('标题-A') && withoutProps.includes('标题-A')
    }
    check('大纲视图 props.task 优先 opts.task（props 未传回落 opts：冒烟旧形态兼容）',
      propsFirst(H.makeOutlineReviewView, { id: 'k2', title: '标题-B1' }))
    check('进度视图 props.task 优先 opts.task（props task 变体/标题按 live 记录渲染）',
      propsFirst(H.makeProgressView, { id: 'k2', title: '标题-B2', status: 'completed' }))
    check('结果视图 props.task 优先 opts.task',
      propsFirst(H.makeResultView, { id: 'k2', title: '标题-B3', status: 'completed' }))

    // —— 壳层分发静态锚点（可破坏：恢复内联工厂/去掉缓存即 FAIL）——
    check('壳层详情分发无内联工厂调用（防 remount）',
      !/React\.createElement\(\s*make(OutlineReview|Progress|Result)View\(/.test(clientSource))
    check('壳层经 ensureDetailView 缓存组件类型（三工厂在 make 回调内惰性创建）',
      /ensureDetailView\(detailRef/.test(clientSource)
      && clientSource.includes('makeOutlineReviewView(t,')
      && clientSource.includes('makeProgressView(t,')
      && clientSource.includes('makeResultView(t,'))

    // —— saveOnly 行为改动：保存成功 → onUpdated 收到 tasks.outline 返回记录 ——
    // （dirty 基线不再 useRef 手管：宿主 setActive → props task 前移 savedPages）
    const saveOnlyResult = await (async () => {
      let updated = null
      const calls = []
      const savedRecord = detailTask({
        outlineVersion: 2,
        outline: { version: 2, pages: [{ id: 'p1', title: '改过的标题', bullets: [] }] },
      })
      const Comp = H.makeOutlineReviewView(t, {
        task: detailTask({}),
        api: (m, b) => { calls.push({ m, b }); return Promise.resolve(savedRecord) },
        initialPages: [{ id: 'p1', title: '改过的标题', bullets: [] }],
        onUpdated: (next) => { updated = next },
      })
      const tree = renderTree(Comp({}))
      await findElement(tree, (el) => classOf(el) === 'sp-outline-save').props.onClick()
      return calls.some((c) => c.m === 'tasks.outline') && !!updated && updated.outlineVersion === 2
    })()
    check('点 sp-outline-save → tasks.outline 成功 → onUpdated 收到返回记录（基线经 props 前移）', saveOnlyResult)
  } catch (error) {
    check('Plan 2b 审查修正（详情视图身份）断言块无异常执行', false, String(error && error.message).slice(0, 160))
  }
}

/* ═══ client 样式：宿主 token + 无嵌套布局（Task 8）═══
   规格「宿主边界与布局约束」：面板是宿主 main 区里的**普通块**——不自建全屏
   容器、不出现 100vw/100vh/position:fixed，宽度与滚动交还宿主；颜色/边框走
   宿主 token（--dsw-alias-*）。断言直接读源码文本（无 DOM 可算样式）。 */
{
  const css = readFileSync(join(packageRoot, 'lib', 'client.js'), 'utf8')
  // 类名边界匹配：避免 .sp-tab 被 .sp-tabs 的样式“顺带满足”
  const defined = (name) => new RegExp('\\.' + name + '(?![A-Za-z0-9_-])').test(css)
  check('样式引用宿主 alias token（--dsw-alias-*）', css.includes('--dsw-alias-border-l'))
  check('样式未引入自有全屏/固定定位容器',
    !/\.sp-(panels|view-[a-z-]+)\s*\{[^}]*position:\s*fixed/.test(css)
      && !/\.sp-(panels|view-[a-z-]+)\s*\{[^}]*100vh/.test(css))
  check('样式未使用 100vw（宽度交还宿主）', !/\.sp-(panels|view-[a-z-]+)[^{]*\{[^}]*100vw/.test(css))
  // 「新增类名均有样式定义」：面板壳 + 新建任务 + 模板选择器 + 最近任务
  // （Task 3/4/5/7 渲染的类名一并纳入，避免出现无样式的半成品视图）
  const required = [
    'sp-panels', 'sp-panels-head', 'sp-panels-title', 'sp-tabs', 'sp-tab', 'sp-tab-active',
    'sp-view-new-task', 'sp-view-recent', 'sp-new-title', 'sp-topic-input',
    'sp-quick-row', 'sp-quick-chip', 'sp-formats', 'sp-format-card', 'sp-format-card-active',
    'sp-fmt-title', 'sp-fmt-hint', 'sp-advanced-toggle', 'sp-advanced-body',
    'sp-config-summary', 'sp-config-summary-line', 'sp-config-summary-extra',
    'sp-summary-title', 'sp-summary-item', 'sp-start',
    'sp-material-add', 'sp-material-input', 'sp-material-list', 'sp-material-item',
    'sp-material-name', 'sp-material-meta', 'sp-material-remove',
    'sp-tpl-open', 'sp-tpl-picker', 'sp-tpl-toolbar', 'sp-tpl-title', 'sp-tpl-close',
    'sp-tpl-filter', 'sp-tpl-search', 'sp-tpl-count', 'sp-tpl-group', 'sp-tpl-group-head',
    'sp-tpl-group-builtin', 'sp-tpl-group-user', 'sp-tpl-grid', 'sp-tpl-card', 'sp-tpl-body',
    'sp-tpl-head', 'sp-tpl-thumb', 'sp-tpl-scenario', 'sp-tpl-tags', 'sp-tpl-tag',
    'sp-tpl-source', 'sp-tpl-default', 'sp-tpl-use', 'sp-tpl-none', 'sp-tpl-follow',
    'sp-tpl-manage', 'sp-tpl-foot',
    'sp-task-item', 'sp-task-head', 'sp-task-title', 'sp-task-status', 'sp-task-meta',
    'sp-task-list', 'sp-task-group-title', 'sp-task-time', 'sp-task-open', 'sp-work-name',
    'sp-group-attention', 'sp-group-active', 'sp-group-failed', 'sp-group-done',
    'sp-recent-empty', 'sp-recent-error', 'sp-recent-retry',
    // 生成进度视图（Plan 2b Task 4 契约类名，全部须有样式定义）
    'sp-view-progress', 'sp-progress-head', 'sp-progress-line', 'sp-steps', 'sp-step',
    'sp-step-done', 'sp-step-active', 'sp-step-pending', 'sp-progress-detail',
    'sp-progress-events', 'sp-event', 'sp-launch-recovery', 'sp-launch-retry',
    'sp-launch-cancel', 'sp-needs-input', 'sp-input-answer', 'sp-needs-input-send',
    'sp-error-recovery', 'sp-fail-retry', 'sp-fail-back-outline', 'sp-cancel',
    'sp-open-session', 'sp-terminal-note',
    // 结果视图（Plan 2b Task 5 契约类名，全部须有样式定义）
    'sp-view-result', 'sp-result-head', 'sp-result-summary', 'sp-artifacts', 'sp-artifact',
    'sp-artifact-type', 'sp-artifact-status', 'sp-artifact-path', 'sp-artifact-copy',
    'sp-artifact-regen', 'sp-artifacts-empty', 'sp-result-continue', 'sp-result-continue-text',
    'sp-result-submit', 'sp-result-quick', 'sp-result-quick-chip',
  ]
  const unstyled = required.filter(name => !defined(name))
  check('新增视图类名均有样式定义', unstyled.length === 0, unstyled.join(', '))
}

/** 伪 File：client 只用到 name 与流式 body，测试里给最小替身。 */
function BlobContent(name, size) { this.name = name; this.size = size }

/* ═══ 清理与结论 ═══ */

rmSync(fakeHome, { recursive: true, force: true })
console.log('')
if (failures > 0) {
  console.log(`\x1b[31m冒烟失败：${failures} 项\x1b[0m`)
  process.exit(1)
}
console.log('\x1b[32m冒烟通过：host + client 全部检查项 ✓\x1b[0m')
