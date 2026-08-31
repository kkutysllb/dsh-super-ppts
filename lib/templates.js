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
 * - 全部路径在存储根 ~/.dsh/super-ppts/ 之下闭合：清单里的 file 字段只在本
 *   模块写入口生成，读取方（路由/工具）不按清单外路径落盘；
 * - 模板名称唯一（trim 后精确比对）：主场景是「按名称制作 PPT」，重名会让
 *   名称→路径解析产生歧义，宁可上传/重命名时拒绝。
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, statSync, writeFileSync, writeSync, } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
/** 存储根（模板目录与清单的父目录）。 */
export const STORE_ROOT = join(homedir(), '.dsh', 'super-ppts');
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
 * 读清单。缺文件回落默认（首次运行的正常形态）；存在但坏 JSON / 形态不对时
 * 先留底再回落默认——此后 saveRegistry 落的是干净新清单，既有模板记录保存在
 * *.corrupt-* 里可人工恢复，不会被空数据静默覆盖（存储层绝不阻断插件加载）。
 */
export function loadRegistry() {
    try {
        const parsed = JSON.parse(readRegistryText());
        if (!looksLikeRegistry(parsed)) {
            quarantineCorruptRegistry();
            return { templates: [], defaultTemplate: null, prefs: { ...PREFS_DEFAULTS } };
        }
        const shape = parsed;
        const templates = Array.isArray(shape.templates) ? shape.templates : [];
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
/**
 * 登记一个已落盘的上传临时文件：搬入模板目录并写入清单。
 * 调用方（上传路由）负责临时文件的校验与失败清理；本函数内的失败会
 * 尝试回滚已 rename 的正式文件，保证清单与磁盘一致。
 */
export function addTemplate(name, description, tmpFile) {
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
        const record = {
            id,
            name: cleanName,
            description: cleanDescription,
            file: finalPath,
            size: statSync(finalPath).size,
            uploadedAt: new Date().toISOString(),
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
/** 删除模板：清单移除 + 默认引用清理 + 删文件（文件缺失不视为失败）。 */
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
