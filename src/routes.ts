/**
 * /super-ppts HTTP 面（host 侧）：设置页 client 与 host 的唯一通道。
 *
 * - POST /super-ppts/upload?name=&description=   raw .pptx 流式上传（octet-stream）
 * - POST /super-ppts/api/<method>                JSON 操作面（templates.* / prefs.*）
 *
 * 信任围栏：行为同位镜像 dsh-client-connection /api 网关围栏（loopback Host
 * 或 trustedHosts 放行；跨站浏览器标记拒之门外）——这是 DNS-rebind / 跨站
 * 防御，不是认证。trustedHosts 经 ctx.get('webRuntime') 软探测：未声明服务
 * 不影响加载，非 web 部署自然退化为纯 loopback。
 *
 * 响应信封：{ok:true,value} / {ok:false,error:{code,message}}（与生态内
 * 插件路由约定一致，client 侧统一解包）。
 *
 * 工程红线：不引入新依赖（node:http 类型 + templates.ts 存储层）；上传体
 * 流式落盘、限额即断，失败不留半截文件（见 templates.writeUploadTemp）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
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

/** node http 请求头值形态（string | string[] | undefined 的窄子集）。 */
type HeaderValue = string | string[] | undefined

/** webServer 服务面（结构镜像 dsh-host-webserver 的 WebRoute）。 */
export interface PptsWebServerFace {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** 路由注册收到的 ctx 面（effect 为 cordis ctx 自带，返回 disposer；get 为软探测读）。 */
export interface PptsRoutesContext {
  webServer: PptsWebServerFace
  effect(fn: () => () => void, name?: string): () => void
  get(name: string): unknown
}

/** wire 层可预期失败。 */
export class PptsRouteError extends Error {
  constructor(
    readonly code: 'bad-request' | 'not-found' | 'forbidden' | 'method-error' | 'too-large' | 'conflict' | 'internal',
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/** JSON 请求体上限（本 API 只承载小消息；模板字节走 /upload 原始通道）。 */
const MAX_BODY_BYTES = 1 << 20

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** 信任围栏：Host header loopback / trustedHosts 精确匹配才放行。 */
export function fenceRequest(req: IncomingMessage, trustedHosts: readonly string[]): boolean {
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  let authority: URL
  try {
    authority = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (isLoopbackHostname(authority.hostname)) return true
  return trustedHosts.some(entry => entry === host || entry === authority.hostname)
}

/** 读并解析 JSON 请求体（有界；坏 JSON → bad-request）。 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk as Uint8Array)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new PptsRouteError('too-large', 'request body too large', 413)
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new PptsRouteError('bad-request', 'request body is not valid JSON')
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function writeOk(res: ServerResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof PptsRouteError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof TemplateStoreError) {
    const status = error.code === 'not-found' ? 404 : error.code === 'conflict' ? 409 : error.code === 'fs-error' ? 500 : 400
    writeJson(res, status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  writeJson(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
}

/** 从 JSON payload 取 string 字段（缺失/类型不符 → bad-request）。 */
function requireString(payload: unknown, key: string): string {
  const record = payload as Record<string, unknown> | null
  const value = record?.[key]
  if (typeof value !== 'string' || value === '') {
    throw new PptsRouteError('bad-request', `missing or invalid "${key}"`)
  }
  return value
}

function optionalString(payload: unknown, key: string): string | undefined {
  const record = payload as Record<string, unknown> | null
  const value = record?.[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new PptsRouteError('bad-request', `invalid "${key}"`)
  return value
}

/** JSON 操作面：method → handler（templates.* / prefs.*）。 */
export function buildPptsApiHandlers(): Record<string, (payload: unknown) => unknown> {
  return {
    'templates.list': () => loadRegistry(),
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
  }
}

export interface PptsRoutesOptions {
  /** 上传体积上限（字节；来自插件 Config.uploadLimitMb）。 */
  uploadLimitBytes: number
}

/** 注册 /super-ppts 路由（api + upload）；返回组合 disposer 由 effect 回收。 */
export function registerPptsRoutes(ctx: PptsRoutesContext, options: PptsRoutesOptions): () => void {
  const webRuntime = ctx.get('webRuntime') as { trustedHosts?: readonly string[] } | undefined
  const trustedHosts = Array.isArray(webRuntime?.trustedHosts) ? webRuntime.trustedHosts : []
  const handlers = buildPptsApiHandlers()

  const disposers: Array<() => void> = []

  disposers.push(ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/super-ppts/api',
    handler: async (req, res) => {
      if (!fenceRequest(req, trustedHosts)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith('/super-ppts/api/') ? pathname.slice('/super-ppts/api/'.length) : undefined
      if (method === undefined || method.includes('/')) {
        writeError(res, new PptsRouteError('not-found', 'unknown api method', 404))
        return
      }
      try {
        const handler = handlers[method]
        if (handler === undefined) throw new PptsRouteError('not-found', `unknown api method "${method}"`, 404)
        writeOk(res, await handler(await readJsonBody(req)))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dsh-super-ppts: /super-ppts/api routes'))

  disposers.push(ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/super-ppts/upload',
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
        const name = url.searchParams.get('name') ?? ''
        const description = url.searchParams.get('description') ?? ''
        const tmp = await writeUploadTemp(req, options.uploadLimitBytes)
        writeOk(res, addTemplate(name, description, tmp))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dsh-super-ppts: /super-ppts/upload route'))

  return () => {
    for (const dispose of disposers) {
      try { dispose() } catch { /* 回收失败不阻断卸载 */ }
    }
  }
}
