#!/usr/bin/env node
/**
 * dsh-super-ppts 插件冒烟测试（零依赖，node scripts/smoke-plugin.mjs）。
 *
 * 覆盖两处交付面：
 * 1. host：templates.ts 存储层 + routes.ts HTTP 面（mock req/res 全流程：
 *    上传 → 列表 → 重命名 → 设默认 → 偏好更新 → 删除）；
 * 2. client：lib/client.js 的 ModuleLoader 自注册形态（stub React +
 *    stub ctx.slots/ctx.locale，断言 settings.section 注册参数）。
 *
 * 隔离：HOME 重定向到临时目录，测试不触碰真实 ~/.dsh/super-ppts。
 */
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import vm from 'node:vm'

const packageRoot = dirname(fileURLToPath(import.meta.url)) + '/..'

let failures = 0
function check(name, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL'
  console.log(`\x1b[${condition ? 32 : 31}m${mark}\x1b[0m  ${name}${detail ? ' — ' + detail : ''}`)
  if (!condition) failures += 1
}

/* ═══ 1. host 侧：存储 + 路由 ═══ */

const fakeHome = mkdtempSync(join(tmpdir(), 'ppts-smoke-'))
process.env.HOME = fakeHome

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
check('路由已注册（api + upload）', routes.has('/super-ppts/api/*') && routes.has('/super-ppts/upload'))
check('effect 已登记', effects.length === 2)

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

const pptxBytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2048, 7)])
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

disposeRoutes()
check('disposer 后路由已注销', routes.size === 0)

/* ═══ 2. client 侧：ModuleLoader 形态 ═══ */

const clientSource = await readFile(join(packageRoot, 'lib', 'client.js'), 'utf8')

// stub React：只覆盖 client.js 用到的 createElement + hooks
function stubElement(type, props, ...children) {
  return { $$el: true, type, props: props ?? {}, children }
}
const hookLog = { effects: [] }
const stubReact = {
  createElement: stubElement,
  useState(initial) { const s = { value: initial }; return [s.value, v => { s.value = v }] },
  useEffect(fn) { hookLog.effects.push(fn) },
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

vm.runInNewContext(clientSource, { window: sandboxWindow, console })
{
  check('client 自注册（__ModuleLoader__.load）', loadedModule !== null && loadedModule.__id === 'dsh-super-ppts')
  check('client 声明 inject 服务', Array.isArray(loadedModule.inject) && loadedModule.inject.includes('slots') && loadedModule.inject.includes('locale'))
}

// stub ctx：断言 settings.section 注册参数
{
  const registrations = []
  const dictCalls = []
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
      register(ns, dicts) { dictCalls.push({ ns, has: !!dicts.zh && !!dicts.en }); return () => {} },
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

/* ═══ 清理与结论 ═══ */

rmSync(fakeHome, { recursive: true, force: true })
console.log('')
if (failures > 0) {
  console.log(`\x1b[31m冒烟失败：${failures} 项\x1b[0m`)
  process.exit(1)
}
console.log('\x1b[32m冒烟通过：host + client 全部检查项 ✓\x1b[0m')
