import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageRoot } from './paths.js';
import { BUILTIN_TEMPLATES } from './builtin-templates.js';
import { TemplateStoreError, addTemplate, deleteTemplate, loadRegistry, renameTemplate, setDefaultTemplate, thumbFileFor, updatePrefs, writeUploadTemp, } from './templates.js';
import { TASK_STATUSES, TaskStoreError, confirmOutline, createTask, deleteTask, listTasks, loadTask, removeMaterial, saveOutline, setMaterialStatus, updateTask, writeMaterial, } from './tasks.js';
/** wire 层可预期失败。 */
export class PptsRouteError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
/** JSON 请求体上限（本 API 只承载小消息；模板字节走 /upload 原始通道）。 */
const MAX_BODY_BYTES = 1 << 20;
function isLoopbackHostname(hostname) {
    if (hostname === 'localhost' || hostname === '[::1]')
        return true;
    const parts = hostname.split('.');
    return parts.length === 4
        && parts[0] === '127'
        && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** 信任围栏：Host header loopback / trustedHosts 精确匹配才放行。 */
export function fenceRequest(req, trustedHosts) {
    const host = req.headers.host;
    if (typeof host !== 'string' || host === '')
        return false;
    let authority;
    try {
        authority = new URL(`http://${host}`);
    }
    catch {
        return false;
    }
    if (isLoopbackHostname(authority.hostname))
        return true;
    return trustedHosts.some(entry => entry === host || entry === authority.hostname);
}
/**
 * 同源粗校验（CSRF 纵深防御，与 fenceRequest 叠加，security-audit-host M3）：
 * 浏览器跨站请求必带 Origin；其 host 与请求 Host / loopback / trustedHosts
 * 都不一致即拒绝。无 Origin（curl 等非浏览器客户端）放行——Host 围栏仍然
 * 生效；不可解析或非 http(s) 的 Origin（'null' / 自定义 scheme）不武断拒绝，
 * 交给围栏与 content-type 契约兜底（跨站攻击者的 Origin 必是 http(s)）。
 */
function originAllowed(req, trustedHosts) {
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || origin === '')
        return true;
    let authority;
    try {
        authority = new URL(origin);
    }
    catch {
        return true;
    }
    if (authority.protocol !== 'http:' && authority.protocol !== 'https:')
        return true;
    const host = req.headers.host;
    if (typeof host === 'string' && host !== '' && authority.host === host)
        return true;
    if (isLoopbackHostname(authority.hostname))
        return true;
    return trustedHosts.some(entry => entry === authority.host || entry === authority.hostname);
}
/**
 * JSON 操作面 content-type 契约（CSRF 主防御，security-audit-host M3）：
 * 跨站 <form> 只能提交 urlencoded / multipart / text/plain——要求
 * application/json 后表单 CSRF 天然不可达；fetch/XHR 带 JSON content-type
 * 又必然触发 CORS 预检，而本服务从不回 CORS 头，预检必败。
 */
function isJsonContentType(req) {
    const header = req.headers['content-type'];
    if (typeof header !== 'string' || header === '')
        return false;
    const mediaType = (header.split(';')[0] ?? '').trim().toLowerCase();
    return mediaType === 'application/json';
}
/** 跨站请求的统一 403 响应（fence 与 origin 两道围栏共用文案口径）。 */
function writeForbidden(res) {
    writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } });
}
/** 读并解析 JSON 请求体（有界；坏 JSON → bad-request）。 */
async function readJsonBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buffer = Buffer.from(chunk);
        total += buffer.length;
        if (total > MAX_BODY_BYTES)
            throw new PptsRouteError('too-large', 'request body too large', 413);
        chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim() === '')
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new PptsRouteError('bad-request', 'request body is not valid JSON');
    }
}
function writeJson(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}
function writeOk(res, value) {
    writeJson(res, 200, { ok: true, value });
}
function writeError(res, error) {
    if (error instanceof PptsRouteError) {
        writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
        return;
    }
    if (error instanceof TemplateStoreError) {
        const status = error.code === 'not-found' ? 404 : error.code === 'conflict' ? 409 : error.code === 'fs-error' ? 500 : 400;
        writeJson(res, status, { ok: false, error: { code: error.code, message: error.message } });
        return;
    }
    if (error instanceof TaskStoreError) {
        const status = error.code === 'not-found' ? 404 : error.code === 'fs-error' ? 500 : 400;
        writeJson(res, status, { ok: false, error: { code: error.code, message: error.message } });
        return;
    }
    // 未知异常不回传 message（可能含绝对路径等内部细节）：详情只进 host 日志
    console.error('[dsh-super-ppts] internal error:', error);
    writeJson(res, 500, { ok: false, error: { code: 'internal', message: 'internal error' } });
}
/** 从 JSON payload 取 string 字段（缺失/类型不符 → bad-request）。 */
function requireString(payload, key) {
    const record = payload;
    const value = record?.[key];
    if (typeof value !== 'string' || value === '') {
        throw new PptsRouteError('bad-request', `missing or invalid "${key}"`);
    }
    return value;
}
function optionalString(payload, key) {
    const record = payload;
    const value = record?.[key];
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string')
        throw new PptsRouteError('bad-request', `invalid "${key}"`);
    return value;
}
/** JSON 操作面：method → handler（templates.* / prefs.* / tasks.*）。 */
export function buildPptsApiHandlers() {
    return {
        // templates.list 附带内置模板元数据：用户模板字段口径不变（向后兼容），
        // builtinTemplates 为新增字段，面板据此分组展示两类来源。
        'templates.list': () => ({ ...loadRegistry(), builtinTemplates: BUILTIN_TEMPLATES }),
        'templates.rename': (payload) => {
            const id = requireString(payload, 'id');
            const name = requireString(payload, 'name');
            const description = optionalString(payload, 'description');
            return renameTemplate(id, name, description);
        },
        'templates.delete': (payload) => {
            deleteTemplate(requireString(payload, 'id'));
            return { deleted: true };
        },
        'templates.setDefault': (payload) => {
            const record = payload;
            const id = record?.id;
            if (id !== null && typeof id !== 'string')
                throw new PptsRouteError('bad-request', 'invalid "id"');
            setDefaultTemplate(id);
            return loadRegistry();
        },
        'prefs.update': (payload) => {
            const record = payload;
            return updatePrefs(record?.patch);
        },
        'tasks.list': (payload) => {
            const record = payload;
            const filter = {};
            const status = record?.status;
            // 状态白名单：非法值直接 400，而不是原样透传给 listTasks —— 拼错状态（buiding）
            // 会被过滤器全部拒掉、静默返回空列表，在面板上表现为「任务全丢了」，排查成本极高。
            if (status !== undefined && status !== null && status !== '') {
                if (typeof status !== 'string' || !TASK_STATUSES.includes(status)) {
                    throw new PptsRouteError('bad-request', `未知任务状态：${String(status)}（限 ${TASK_STATUSES.join(' / ')}）`);
                }
                filter.status = status;
            }
            const workspaceId = record?.workspaceId;
            if (typeof workspaceId === 'string' && workspaceId !== '')
                filter.workspaceId = workspaceId;
            return { tasks: listTasks(filter) };
        },
        'tasks.get': (payload) => {
            const id = requireString(payload, 'id');
            const task = loadTask(id);
            if (task === null)
                throw new PptsRouteError('not-found', `任务不存在：${id}`, 404);
            // 产物存在性投影（只读）：产物文件在工作区，用户可能移走 / 删除，甚至只是外置盘没挂载。
            // 每次读详情按 existsSync 重算 status，面板才能提示「产物缺失，可重新生成」。
            // 刻意不落盘：读路径不产生写副作用，文件恢复原位后状态自然回到 ready。
            return {
                ...task,
                artifacts: task.artifacts.map(item => ({
                    ...item,
                    status: existsSync(item.path) ? 'ready' : 'missing',
                })),
            };
        },
        'tasks.create': (payload) => {
            const record = payload;
            const brief = record?.brief;
            if (brief === null || typeof brief !== 'object') {
                throw new PptsRouteError('bad-request', 'missing or invalid "brief"');
            }
            // workspace 与 brief 同等对待：兜底成空串 id 会让该任务既被 tasks.list 的
            // workspaceId 过滤拒绝、又无法经 UpdateTaskPatch（无 workspace 键）补救。
            const workspace = record?.workspace;
            if (workspace === null || typeof workspace !== 'object') {
                throw new PptsRouteError('bad-request', 'missing or invalid "workspace"');
            }
            return createTask({
                title: requireString(payload, 'title'),
                brief: brief,
                workspace: workspace,
            });
        },
        'tasks.update': (payload) => {
            const record = payload;
            const patch = record?.patch;
            if (patch === null || typeof patch !== 'object') {
                throw new PptsRouteError('bad-request', 'missing or invalid "patch"');
            }
            return updateTask(requireString(payload, 'id'), patch);
        },
        'tasks.delete': (payload) => {
            deleteTask(requireString(payload, 'id'));
            return { deleted: true };
        },
        'tasks.outline': (payload) => {
            const record = payload;
            const pages = record?.pages;
            if (!Array.isArray(pages))
                throw new PptsRouteError('bad-request', 'missing or invalid "pages"');
            return saveOutline(requireString(payload, 'id'), pages);
        },
        'tasks.confirmOutline': (payload) => {
            const record = payload;
            const version = record?.version;
            if (typeof version !== 'number')
                throw new PptsRouteError('bad-request', 'missing or invalid "version"');
            return confirmOutline(requireString(payload, 'id'), version);
        },
        // 素材变更面：删除（失败素材可删掉后继续，见规格失败模式表）与状态回报
        // （Agent 读取素材后回写 ready / error，面板据此显示「解析失败 · 可重试或删除」）。
        'tasks.materialDelete': (payload) => {
            return removeMaterial(requireString(payload, 'id'), requireString(payload, 'materialId'));
        },
        'tasks.materialStatus': (payload) => {
            const record = payload;
            const status = record?.status;
            // 白名单前置校验：非法状态一旦透传，存储层虽会抛错，但错误码语义不如这里直白。
            if (status !== 'ready' && status !== 'error') {
                throw new PptsRouteError('bad-request', `未知素材状态：${String(status)}（限 ready / error）`);
            }
            return setMaterialStatus(requireString(payload, 'id'), requireString(payload, 'materialId'), status, optionalString(payload, 'error'));
        },
    };
}
/** 注册 /super-ppts 路由（api + upload）；返回组合 disposer 由 effect 回收。 */
export function registerPptsRoutes(ctx, options) {
    const webRuntime = ctx.get('webRuntime');
    const trustedHosts = Array.isArray(webRuntime?.trustedHosts) ? webRuntime.trustedHosts : [];
    const handlers = buildPptsApiHandlers();
    const disposers = [];
    disposers.push(ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/super-ppts/api',
        handler: async (req, res) => {
            if (!fenceRequest(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
                return;
            }
            if (!originAllowed(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            if (!isJsonContentType(req)) {
                writeJson(res, 415, { ok: false, error: { code: 'method-error', message: 'content-type must be application/json' } });
                return;
            }
            const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
            const method = pathname.startsWith('/super-ppts/api/') ? pathname.slice('/super-ppts/api/'.length) : undefined;
            if (method === undefined || method.includes('/')) {
                writeError(res, new PptsRouteError('not-found', 'unknown api method', 404));
                return;
            }
            try {
                const handler = handlers[method];
                if (handler === undefined)
                    throw new PptsRouteError('not-found', `unknown api method "${method}"`, 404);
                writeOk(res, await handler(await readJsonBody(req)));
            }
            catch (error) {
                writeError(res, error);
            }
        },
    }), 'dsh-super-ppts: /super-ppts/api routes'));
    disposers.push(ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: '/super-ppts/upload',
        handler: async (req, res) => {
            if (!fenceRequest(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
                return;
            }
            // 原始流通道没有 content-type 契约可用（客户端发 octet-stream），跨站
            // 表单在理论上可借 text/plain 伪造「恰好以 PK 魔数开头」的请求体——
            // Origin 同源校验把这条路也封掉（跨站攻击者的 Origin 必异源）。
            if (!originAllowed(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            try {
                const url = new URL(req.url ?? '/', 'http://dsh.internal');
                const name = url.searchParams.get('name') ?? '';
                const description = url.searchParams.get('description') ?? '';
                const tmp = await writeUploadTemp(req, options.uploadLimitBytes);
                writeOk(res, await addTemplate(name, description, tmp));
            }
            catch (error) {
                writeError(res, error);
            }
        },
    }), 'dsh-super-ppts: /super-ppts/upload route'));
    // 模板缩略图：GET /super-ppts/templates/thumb/<id>（上传时生成的 <id>.thumb.*）。
    // 同款信任围栏；id 白名单（newTemplateId 形态 [a-z0-9]+）防路径穿越；
    // 图片不可变（id 不复用）→ 私有长缓存。
    disposers.push(ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/super-ppts/templates/thumb',
        handler: (req, res) => {
            if (!fenceRequest(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
                return;
            }
            const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
            const id = decodeURIComponent(pathname.slice('/super-ppts/templates/thumb/'.length));
            const file = thumbFileFor(id);
            if (file === null) {
                writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'thumbnail not found' } });
                return;
            }
            try {
                const body = readFileSync(file);
                res.writeHead(200, {
                    'content-type': file.endsWith('.png') ? 'image/png' : 'image/jpeg',
                    'content-length': String(body.length),
                    'cache-control': 'private, max-age=86400',
                });
                res.end(req.method === 'HEAD' ? undefined : body);
            }
            catch {
                writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'thumbnail not found' } });
            }
        },
    }), 'dsh-super-ppts: template thumbnail route'));
    // 内置模板真缩略图：GET /super-ppts/templates/builtin-thumb/<id>——样例 deck
    // 首页截图（assets/builtin-thumbs/<id>.jpg，由 scripts/build-builtin-decks.py
    // 生成并随包分发）。id 白名单（builtin-* 形态 [a-z0-9-]）防路径穿越；真图
    // 缺失时返回 404，client onError 回落 thumbSvg data URI（设计示意）。
    disposers.push(ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/super-ppts/templates/builtin-thumb',
        handler: (req, res) => {
            if (!fenceRequest(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
                return;
            }
            const url = new URL(req.url ?? '/', 'http://dsh.internal');
            const id = decodeURIComponent(url.pathname.slice('/super-ppts/templates/builtin-thumb/'.length));
            if (!/^[a-z0-9-]+$/.test(id)) {
                writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'thumbnail not found' } });
                return;
            }
            // 页码：?page=N（样例 deck 多页浏览；缺省 1 = 卡片封面层）。N 越界即 404，
            // 文件形态 <id>.jpg（第 1 页）/<id>-N.jpg（N≥2，由 build-builtin-decks.py 渲染）。
            const pageRaw = url.searchParams.get('page') ?? '1';
            const page = Number(pageRaw);
            if (!Number.isInteger(page) || page < 1 || page > 99) {
                writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'thumbnail not found' } });
                return;
            }
            const file = join(packageRoot, 'skills', 'ppts-pptx', 'assets', 'builtin-thumbs', page === 1 ? `${id}.jpg` : `${id}-${page}.jpg`);
            try {
                if (!existsSync(file))
                    throw new Error('missing');
                const body = readFileSync(file);
                res.writeHead(200, {
                    'content-type': 'image/jpeg',
                    'content-length': String(body.length),
                    'cache-control': 'private, max-age=86400',
                });
                res.end(req.method === 'HEAD' ? undefined : body);
            }
            catch {
                writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'thumbnail not found' } });
            }
        },
    }), 'dsh-super-ppts: builtin template thumbnail route'));
    // 素材上传：任务目录内的原始流式落盘（与 /upload 同款信任围栏、Origin
    // 同源校验与限额）。
    disposers.push(ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: '/super-ppts/tasks/upload',
        handler: async (req, res) => {
            if (!fenceRequest(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
                return;
            }
            if (!originAllowed(req, trustedHosts)) {
                writeForbidden(res);
                return;
            }
            try {
                const url = new URL(req.url ?? '/', 'http://dsh.internal');
                const taskId = url.searchParams.get('taskId') ?? '';
                const name = url.searchParams.get('name') ?? '';
                writeOk(res, await writeMaterial(taskId, name, req, options.uploadLimitBytes));
            }
            catch (error) {
                writeError(res, error);
            }
        },
    }), 'dsh-super-ppts: /super-ppts/tasks/upload route'));
    return () => {
        for (const dispose of disposers) {
            try {
                dispose();
            }
            catch { /* 回收失败不阻断卸载 */ }
        }
    };
}
