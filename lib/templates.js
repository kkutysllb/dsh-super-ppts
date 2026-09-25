/**
 * 模板库存储层（host 侧，零 npm 依赖）。
 *
 * 设计立场（对照插件工程红线）：
 * - 模板是二进制资产（.pptx）、清单是低频单用户配置——自管文件而非
 *   settings 服务：`ppts_templates` 工具在任何部署形态下都能直接读，
 *   也不引入可选服务的降级分支；
 * - registry.json 一律原子写（tmp + rename）。单用户低频操作，不做文件锁；
 * - 清单损坏（坏 JSON / 形态不对）读取时先改名 *.corrupt-* 留底再回落默认，
 *   绝不让后续写入用空数据覆盖既有模板记录；
 * - 模板 id 与文件名解耦：id 随机生成，重命名只改清单不动文件，删除才删文件；
 * - 全部路径在存储根 <DSH_HOME>/super-ppts/ 之下闭合：清单里的 file 字段只在本
 *   模块写入口生成，读取方（路由/工具）不按清单外路径落盘；
 * - 模板名称唯一（trim 后精确比对）：主场景是「按名称制作 PPT」，重名会让
 *   名称→路径解析产生歧义，宁可上传/重命名时拒绝。
 */
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync, statSync, writeFileSync, writeSync, } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
/**
 * 宿主 home 解析（零依赖复刻宿主 home-paths 的取值优先级）：
 * `$QILIN_HOME`（非空白）→ `$DSH_HOME`（非空白）→ `~/.dsh`。QiLin 注入
 * QILIN_HOME 并把 DSH_HOME 钉定到同一处，DSH 只注入 DSH_HOME，KCoder
 * 桌面端把 DSH_HOME 指到 ~/.kcoder——插件数据必须跟随宿主 home，不能写死。
 */
export const DSH_HOME = (() => {
    const fromEnv = process.env.QILIN_HOME ?? process.env.DSH_HOME;
    if (fromEnv !== undefined && fromEnv.trim().length > 0)
        return resolve(fromEnv);
    return join(homedir(), '.dsh');
})();
/** 存储根（模板目录与清单的父目录）。 */
export const STORE_ROOT = join(DSH_HOME, 'super-ppts');
/** 历史版本写死的存储根（DSH_HOME 解析引入前）；仅当它不是当前根时作为迁移源。 */
const LEGACY_STORE_ROOT = join(homedir(), '.dsh', 'super-ppts');
/** 模板二进制目录。 */
export const TEMPLATE_DIR = join(STORE_ROOT, 'templates');
/** 清单文件。 */
export const REGISTRY_FILE = join(STORE_ROOT, 'registry.json');
/** 名称/描述长度上限（校验口径同时用于路由层与工具层）。 */
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 200;
/** 存储层可预期失败（路由层映射为 wire 错误码）。 */
export class TemplateStoreError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
export const PREFS_DEFAULTS = {
    defaultFormat: 'ask',
    renderReview: 'deliverable-only',
    outputDir: '',
    styleNotes: '',
};
const PPTX_MAGIC = [0x50, 0x4b, 0x03, 0x04];
/** .pptx 即 zip 容器：校验 PK\x03\x04 魔数（上传首块必查，防非 PPTX 落盘）。 */
export function looksLikePptx(buffer) {
    return buffer.length >= 4 && PPTX_MAGIC.every((byte, index) => buffer[index] === byte);
}
/** 生成模板 id：时间戳 base36 + 随机后缀（重命名/删除都不影响其他记录）。 */
export function newTemplateId() {
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
/** 名称校验：trim 后 1..NAME_MAX；返回 trim 结果。 */
export function validateName(raw) {
    const name = String(raw ?? '').trim();
    if (name.length === 0)
        throw new TemplateStoreError('bad-request', '模板名称不能为空');
    if (name.length > NAME_MAX)
        throw new TemplateStoreError('bad-request', `模板名称过长（≤ ${NAME_MAX} 字符）`);
    return name;
}
/** 描述校验：trim 后 0..DESCRIPTION_MAX；返回 trim 结果。 */
export function validateDescription(raw) {
    const description = String(raw ?? '').trim();
    if (description.length > DESCRIPTION_MAX) {
        throw new TemplateStoreError('bad-request', `描述过长（≤ ${DESCRIPTION_MAX} 字符）`);
    }
    return description;
}
/** 清单形态粗校验：对象且 templates 字段（若存在）为数组。 */
function looksLikeRegistry(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const templates = value.templates;
    return templates === undefined || Array.isArray(templates);
}
/** 损坏清单留底：registry.json 改名为 registry.json.corrupt-<时间戳>-<随机>（尽力而为）。 */
function quarantineCorruptRegistry() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    // 随机后缀：连续两次损坏读取可能落在同一毫秒，纯时间戳会互相覆盖留底
    const rand = Math.random().toString(36).slice(2, 8);
    try {
        renameSync(REGISTRY_FILE, `${REGISTRY_FILE}.corrupt-${stamp}-${rand}`);
    }
    catch {
        // 留底失败（只读盘等）不阻断读取：回落默认的行为与旧版一致
    }
}
/**
 * 旧存储根迁移：历史版本把数据写死 ~/.dsh/super-ppts/，在 $DSH_HOME 部署下
 * （如 KCoder 桌面端 ~/.kcoder）读不到。当前根没有清单而历史根有清单时，
 * 把清单与模板二进制整体搬过来（best-effort，失败静默跳过不阻断读取）。
 */
function importLegacyStore() {
    if (LEGACY_STORE_ROOT === STORE_ROOT)
        return;
    if (existsSync(REGISTRY_FILE))
        return;
    const legacyRegistry = join(LEGACY_STORE_ROOT, 'registry.json');
    if (!existsSync(legacyRegistry))
        return;
    try {
        const legacyTemplates = join(LEGACY_STORE_ROOT, 'templates');
        mkdirSync(TEMPLATE_DIR, { recursive: true });
        copyFileSync(legacyRegistry, REGISTRY_FILE);
        if (existsSync(legacyTemplates)) {
            for (const name of readdirSync(legacyTemplates)) {
                const target = join(TEMPLATE_DIR, name);
                if (!existsSync(target))
                    copyFileSync(join(legacyTemplates, name), target);
            }
        }
        // 强制重锚：迁移后记录不应再依赖旧根路径（旧根可能随后被清理）
        const migrated = loadRegistry();
        saveRegistry({
            ...migrated,
            templates: migrated.templates.map(item => reanchorRecord(item, true) ?? item),
        });
    }
    catch {
        // 迁移失败不阻断读取：下次启动重试
    }
}
/**
 * 清单 file 路径自愈：历史部署可能记着旧 home 的绝对路径（如 ~/.dsh/...），
 * 二进制实际在当前存储根。按模板 id 重锚到 TEMPLATE_DIR/<id>.pptx；
 * 记录形态不合法（缺 id）时返回 null 由调用方丢弃。
 */
function reanchorRecord(record, force = false) {
    if (record === null || typeof record !== 'object')
        return null;
    if (typeof record.id !== 'string' || record.id === '')
        return null;
    if (!force && typeof record.file === 'string' && record.file !== '' && existsSync(record.file))
        return record;
    const candidate = join(TEMPLATE_DIR, `${record.id}.pptx`);
    if (existsSync(candidate))
        return { ...record, file: candidate };
    return record;
}
/**
 * 读清单。缺文件回落默认（首次运行的正常形态）；存在但坏 JSON / 形态不对时
 * 先留底再回落默认——此后 saveRegistry 落的是干净新清单，既有模板记录保存在
 * *.corrupt-* 里可人工恢复，不会被空数据静默覆盖（存储层绝不阻断插件加载）。
 * 读取前先尝试旧存储根迁移；成功解析后对 file 字段做按 id 自愈。
 */
export function loadRegistry() {
    importLegacyStore();
    try {
        const parsed = JSON.parse(readRegistryText());
        if (!looksLikeRegistry(parsed)) {
            quarantineCorruptRegistry();
            return { templates: [], defaultTemplate: null, prefs: { ...PREFS_DEFAULTS } };
        }
        const shape = parsed;
        const templates = (Array.isArray(shape.templates) ? shape.templates : [])
            .map(item => reanchorRecord(item))
            .filter((item) => item !== null);
        return {
            templates,
            defaultTemplate: typeof shape.defaultTemplate === 'string' && templates.some(item => item.id === shape.defaultTemplate)
                ? shape.defaultTemplate
                : null,
            prefs: { ...PREFS_DEFAULTS, ...(shape.prefs ?? {}) },
        };
    }
    catch {
        // readFileSync ENOENT（清单不存在）也落这里：用 existsSync 区分「缺失」与「损坏」
        if (existsSync(REGISTRY_FILE))
            quarantineCorruptRegistry();
        return { templates: [], defaultTemplate: null, prefs: { ...PREFS_DEFAULTS } };
    }
}
function readRegistryText() {
    return readFileSync(REGISTRY_FILE, 'utf8');
}
/** 原子写清单：tmp + rename（进程崩溃也不会留下半截 JSON）。 */
export function saveRegistry(registry) {
    mkdirSync(STORE_ROOT, { recursive: true });
    const tmp = `${REGISTRY_FILE}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
    renameSync(tmp, REGISTRY_FILE);
}
function assertUniqueName(registry, name, excludeId) {
    const clash = registry.templates.some(item => item.name === name && item.id !== excludeId);
    if (clash)
        throw new TemplateStoreError('conflict', `模板名称已存在：${name}`);
}
function requireTemplate(registry, id) {
    const record = registry.templates.find(item => item.id === id);
    if (!record)
        throw new TemplateStoreError('not-found', `模板不存在：${id}`);
    return record;
}
/* ── 模板缩略图（2026-09-25 真机反馈：用户模板占位底在暗色主题下像「白板」）──
 * 上传时生成真实预览，两级兜底（best-effort，绝不阻断上传主流程）：
 * ① 内嵌预览提取：PowerPoint/WPS 保存的 pptx 自带 docProps/thumbnail.*，
 *    零进程成本（zip 中央目录定位 + zlib 解压）；
 * ② 渲染链兜底：soffice → pdf → pdftoppm 第 1 页（≤480px JPEG）——
 *    python-pptx 等程序生成的 pptx 没有内嵌预览，只有这条路能出真图；
 * 都不可用（如无 soffice）→ 不写缩略图，客户端走主题化占位底。 */
/** 模板缩略图落盘路径（按扩展名探测）；不存在返回 null。 */
export function thumbFileFor(id) {
    if (!/^[a-z0-9]+$/.test(id))
        return null;
    for (const ext of ['jpg', 'png']) {
        const candidate = join(TEMPLATE_DIR, `${id}.thumb.${ext}`);
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
/** zip 中央目录定位单个条目（零依赖）：返回压缩数据区 offset/压缩方式/压缩长度；找不到返回 null。 */
function readZipEntry(file, wanted) {
    const buf = readFileSync(file);
    const EOCD_SIG = 0x06054b50;
    const CEN_SIG = 0x02014b50;
    const LOC_SIG = 0x04034b50;
    let eocd = -1;
    const floor = Math.max(0, buf.length - 22 - 65535);
    for (let i = buf.length - 22; i >= floor; i -= 1) {
        if (buf.readUInt32LE(i) === EOCD_SIG) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0)
        return null;
    const entries = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    for (let n = 0; n < entries; n += 1) {
        if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN_SIG)
            return null;
        const compression = buf.readUInt16LE(p + 10);
        const csize = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const local = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
        if (name === wanted) {
            if (local + 30 > buf.length || buf.readUInt32LE(local) !== LOC_SIG)
                return null;
            const offset = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
            if (offset + csize > buf.length)
                return null;
            return { compression, offset, csize };
        }
        p += 46 + nameLen + extraLen + commentLen;
    }
    return null;
}
/** ① 内嵌预览提取：docProps/thumbnail.{jpeg,jpg,png} → <id>.thumb.<ext>。 */
function extractEmbeddedThumb(pptxPath, id) {
    const candidates = [
        ['docProps/thumbnail.jpeg', 'jpg'],
        ['docProps/thumbnail.jpg', 'jpg'],
        ['docProps/thumbnail.png', 'png'],
    ];
    for (const [entryName, ext] of candidates) {
        const entry = readZipEntry(pptxPath, entryName);
        if (entry === null || entry.csize === 0 || entry.csize > 8 * 1024 * 1024)
            continue;
        const buf = readFileSync(pptxPath);
        const raw = buf.subarray(entry.offset, entry.offset + entry.csize);
        const data = entry.compression === 8 ? inflateRawSync(raw) : raw;
        if (data.length < 128)
            continue;
        writeFileSync(join(TEMPLATE_DIR, `${id}.thumb.${ext}`), data);
        return ext;
    }
    return undefined;
}
/** ② 渲染链兜底：soffice → pdf → pdftoppm 第 1 页（≤480px JPEG）→ <id>.thumb.jpg。 */
function renderFirstSlideThumb(pptxPath, id) {
    return new Promise(resolveDone => {
        const workDir = join(tmpdir(), `ppts-thumb-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        try {
            mkdirSync(workDir, { recursive: true });
        }
        catch {
            resolveDone(undefined);
            return;
        }
        const cleanup = () => { try {
            rmSync(workDir, { recursive: true, force: true });
        }
        catch { /* 尽力而为 */ } };
        execFile('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', workDir, pptxPath], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }, sofficeError => {
            if (sofficeError) {
                cleanup();
                resolveDone(undefined);
                return;
            }
            const pdfPath = join(workDir, `${basename(pptxPath).replace(/\.pptx$/i, '')}.pdf`);
            if (!existsSync(pdfPath)) {
                cleanup();
                resolveDone(undefined);
                return;
            }
            execFile('pdftoppm', ['-jpeg', '-f', '1', '-l', '1', '-scale-to', '480', pdfPath, join(workDir, 'thumb')], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }, ppmError => {
                try {
                    if (ppmError) {
                        resolveDone(undefined);
                        return;
                    }
                    // pdftoppm 按文档页数补零（thumb-1.jpg / thumb-01.jpg 都可能）
                    const produced = readdirSync(workDir).filter(name => /^thumb-.*\.jpg$/.test(name)).sort();
                    if (produced.length === 0) {
                        resolveDone(undefined);
                        return;
                    }
                    copyFileSync(join(workDir, produced[0]), join(TEMPLATE_DIR, `${id}.thumb.jpg`));
                    resolveDone('jpg');
                }
                catch {
                    resolveDone(undefined);
                }
                finally {
                    cleanup();
                }
            });
        });
    });
}
/**
 * 生成模板缩略图（best-effort）：内嵌预览提取 → 渲染链兜底 → undefined。
 * 绝不抛错——缩略图缺失只影响外观，不影响模板可用性。
 */
export async function generateTemplateThumb(pptxPath, id) {
    try {
        const embedded = extractEmbeddedThumb(pptxPath, id);
        if (embedded !== undefined)
            return embedded;
    }
    catch { /* 提取失败走渲染兜底 */ }
    // 非 zip 容器（截断/垃圾文件）不值得起渲染链——soffice 只会对牛弹琴
    try {
        if (!tailHasEocd(pptxPath))
            return undefined;
    }
    catch { /* 读失败按无图处理 */ }
    try {
        return await renderFirstSlideThumb(pptxPath, id);
    }
    catch {
        return undefined;
    }
}
/**
 * 登记一个已落盘的上传临时文件：搬入模板目录、生成缩略图并写入清单。
 * 调用方（上传路由）负责临时文件的校验与失败清理；本函数内的失败会
 * 尝试回滚已 rename 的正式文件，保证清单与磁盘一致。
 */
export async function addTemplate(name, description, tmpFile) {
    const cleanName = validateName(name);
    const cleanDescription = validateDescription(description);
    const registry = loadRegistry();
    assertUniqueName(registry, cleanName);
    const id = newTemplateId();
    const finalPath = join(TEMPLATE_DIR, `${id}.pptx`);
    mkdirSync(TEMPLATE_DIR, { recursive: true });
    try {
        renameSync(tmpFile, finalPath);
    }
    catch (error) {
        throw new TemplateStoreError('fs-error', `模板落盘失败：${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        // 缩略图 best-effort：失败不回滚模板本体（客户端走占位底）。
        const thumb = await generateTemplateThumb(finalPath, id);
        const record = {
            id,
            name: cleanName,
            description: cleanDescription,
            file: finalPath,
            size: statSync(finalPath).size,
            uploadedAt: new Date().toISOString(),
            ...(thumb !== undefined ? { thumb } : {}),
        };
        registry.templates.push(record);
        saveRegistry(registry);
        return record;
    }
    catch (error) {
        // 清单写失败：回滚正式文件，不留孤儿二进制。
        try {
            rmSync(finalPath, { force: true });
        }
        catch { /* 尽力而为 */ }
        throw error instanceof TemplateStoreError ? error : new TemplateStoreError('fs-error', String(error));
    }
}
/** 重命名 / 改描述（只改清单，不动文件）。 */
export function renameTemplate(id, name, description) {
    const cleanName = validateName(name);
    const registry = loadRegistry();
    const record = requireTemplate(registry, id);
    assertUniqueName(registry, cleanName, id);
    record.name = cleanName;
    if (description !== undefined)
        record.description = validateDescription(description);
    saveRegistry(registry);
    return record;
}
/** 删除模板：清单移除 + 默认引用清理 + 删文件与缩略图（文件缺失不视为失败）。 */
export function deleteTemplate(id) {
    const registry = loadRegistry();
    const record = requireTemplate(registry, id);
    registry.templates = registry.templates.filter(item => item.id !== id);
    if (registry.defaultTemplate === id)
        registry.defaultTemplate = null;
    saveRegistry(registry);
    try {
        rmSync(record.file, { force: true });
    }
    catch { /* 清单已一致，文件清理尽力而为 */ }
    for (const ext of ['jpg', 'png']) {
        try {
            rmSync(join(TEMPLATE_DIR, `${id}.thumb.${ext}`), { force: true });
        }
        catch { /* 尽力而为 */ }
    }
}
/** 设默认模板；null = 取消默认。 */
export function setDefaultTemplate(id) {
    const registry = loadRegistry();
    if (id === null) {
        registry.defaultTemplate = null;
    }
    else {
        requireTemplate(registry, id);
        registry.defaultTemplate = id;
    }
    saveRegistry(registry);
}
const FORMATS = ['ask', 'pptx', 'html'];
const REVIEW_LEVELS = ['deliverable-only', 'always', 'off'];
/** 偏好更新（白名单校验：非法值/未知键一律拒绝，不做静默修正）。 */
export function updatePrefs(patch) {
    if (patch === null || typeof patch !== 'object') {
        throw new TemplateStoreError('bad-request', 'prefs patch 必须是对象');
    }
    const input = patch;
    const registry = loadRegistry();
    const next = { ...registry.prefs };
    if (input.defaultFormat !== undefined) {
        if (!FORMATS.includes(input.defaultFormat)) {
            throw new TemplateStoreError('bad-request', `defaultFormat 仅支持 ${FORMATS.join(' / ')}`);
        }
        next.defaultFormat = input.defaultFormat;
    }
    if (input.renderReview !== undefined) {
        if (!REVIEW_LEVELS.includes(input.renderReview)) {
            throw new TemplateStoreError('bad-request', `renderReview 仅支持 ${REVIEW_LEVELS.join(' / ')}`);
        }
        next.renderReview = input.renderReview;
    }
    if (input.outputDir !== undefined) {
        const value = String(input.outputDir).trim();
        if (value.length > 500)
            throw new TemplateStoreError('bad-request', 'outputDir 过长（≤ 500 字符）');
        next.outputDir = value;
    }
    if (input.styleNotes !== undefined) {
        const value = String(input.styleNotes);
        if (value.length > 2000)
            throw new TemplateStoreError('bad-request', 'styleNotes 过长（≤ 2000 字符）');
        next.styleNotes = value;
    }
    registry.prefs = next;
    saveRegistry(registry);
    return next;
}
/**
 * 流式写上传体到临时文件（模板目录内 .part 后缀），返回临时文件路径。
 * 首块校验 PK 魔数、收尾校验 zip EOCD；累计超限立即中止并清理。调用方失败时无需清理
 * （本函数已兜底），成功时把返回路径交给 addTemplate()。
 */
export async function writeUploadTemp(body, limitBytes) {
    mkdirSync(TEMPLATE_DIR, { recursive: true });
    // 随机后缀 + 'wx'（已存在即失败）：临时名不可预测也不可抢占，杜绝符号链接/预占位竞态
    const tmp = join(TEMPLATE_DIR, `upload-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.part`);
    const fd = openSync(tmp, 'wx');
    let total = 0;
    let first = true;
    try {
        for await (const chunk of body) {
            const buffer = Buffer.from(chunk);
            if (first) {
                first = false;
                if (!looksLikePptx(buffer)) {
                    throw new TemplateStoreError('bad-request', '不是有效的 .pptx 文件（缺少 zip 魔数）');
                }
            }
            total += buffer.length;
            if (total > limitBytes) {
                throw new TemplateStoreError('bad-request', `模板文件超过大小上限（≤ ${Math.round(limitBytes / 1024 / 1024)} MB）`);
            }
            writeSync(fd, buffer);
        }
    }
    catch (error) {
        closeSync(fd);
        try {
            rmSync(tmp, { force: true });
        }
        catch { /* 兜底清理 */ }
        throw error;
    }
    closeSync(fd);
    if (total === 0) {
        try {
            rmSync(tmp, { force: true });
        }
        catch { /* 兜底清理 */ }
        throw new TemplateStoreError('bad-request', '上传内容为空');
    }
    // zip 粗校验：EOCD（PK\x05\x06）必在文件尾部——拦截截断/改名的非 zip 文件
    if (!tailHasEocd(tmp)) {
        try {
            rmSync(tmp, { force: true });
        }
        catch { /* 兜底清理 */ }
        throw new TemplateStoreError('bad-request', '不是有效的 .pptx 文件（zip 结构不完整）');
    }
    return tmp;
}
/** zip 粗校验：文件尾部 64KB 内能找到 EOCD 签名（PK\x05\x06）即为合法 zip 容器。 */
function tailHasEocd(file) {
    const size = statSync(file).size;
    const fd = openSync(file, 'r');
    try {
        const len = Math.min(size, 66_000);
        const buf = Buffer.alloc(len);
        readSync(fd, buf, 0, len, size - len);
        return buf.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) !== -1;
    }
    finally {
        closeSync(fd);
    }
}
