/** 存储根（模板目录与清单的父目录）。 */
export declare const STORE_ROOT: string;
/** 模板二进制目录。 */
export declare const TEMPLATE_DIR: string;
/** 清单文件。 */
export declare const REGISTRY_FILE: string;
/** 名称/描述长度上限（校验口径同时用于路由层与工具层）。 */
export declare const NAME_MAX = 60;
export declare const DESCRIPTION_MAX = 200;
/** 存储层可预期失败（路由层映射为 wire 错误码）。 */
export declare class TemplateStoreError extends Error {
    readonly code: 'bad-request' | 'not-found' | 'conflict' | 'fs-error';
    constructor(code: 'bad-request' | 'not-found' | 'conflict' | 'fs-error', message: string);
}
export interface TemplateRecord {
    /** 稳定 id（与文件名解耦：重命名不动文件）。 */
    id: string;
    /** 唯一显示名（用户指定，agent 按名解析）。 */
    name: string;
    /** 可选描述（用途/风格备注）。 */
    description: string;
    /** .pptx 绝对路径（存储根之下）。 */
    file: string;
    /** 字节数。 */
    size: number;
    /** 上传时间（ISO 8601）。 */
    uploadedAt: string;
}
/** 生成偏好（设置页可改，经 ppts_templates 打包给 agent）。 */
export interface PptsPrefs {
    /** 默认交付形态：ask=每次询问 / pptx / html。 */
    defaultFormat: 'ask' | 'pptx' | 'html';
    /** 渲染验收策略：deliverable-only=仅交付级必验 / always=每轮都验 / off。 */
    renderReview: 'deliverable-only' | 'always' | 'off';
    /** 输出目录；空 = 会话工作目录。支持 ~ 前缀。 */
    outputDir: string;
    /** 风格偏好备注（自由文本，agent 的全局审美基线）。 */
    styleNotes: string;
}
export interface Registry {
    templates: TemplateRecord[];
    /** 默认模板 id；null = 未设置（或被删后清理）。 */
    defaultTemplate: string | null;
    prefs: PptsPrefs;
}
export declare const PREFS_DEFAULTS: PptsPrefs;
/** .pptx 即 zip 容器：校验 PK\x03\x04 魔数（上传首块必查，防非 PPTX 落盘）。 */
export declare function looksLikePptx(buffer: Buffer): boolean;
/** 生成模板 id：时间戳 base36 + 随机后缀（重命名/删除都不影响其他记录）。 */
export declare function newTemplateId(): string;
/** 名称校验：trim 后 1..NAME_MAX；返回 trim 结果。 */
export declare function validateName(raw: string): string;
/** 描述校验：trim 后 0..DESCRIPTION_MAX；返回 trim 结果。 */
export declare function validateDescription(raw: unknown): string;
/** 读清单；缺文件 / 坏 JSON 一律回落默认（存储层绝不阻断插件加载）。 */
export declare function loadRegistry(): Registry;
/** 原子写清单：tmp + rename（进程崩溃也不会留下半截 JSON）。 */
export declare function saveRegistry(registry: Registry): void;
/**
 * 登记一个已落盘的上传临时文件：搬入模板目录并写入清单。
 * 调用方（上传路由）负责临时文件的校验与失败清理；本函数内的失败会
 * 尝试回滚已 rename 的正式文件，保证清单与磁盘一致。
 */
export declare function addTemplate(name: string, description: string, tmpFile: string): TemplateRecord;
/** 重命名 / 改描述（只改清单，不动文件）。 */
export declare function renameTemplate(id: string, name: string, description?: string): TemplateRecord;
/** 删除模板：清单移除 + 默认引用清理 + 删文件（文件缺失不视为失败）。 */
export declare function deleteTemplate(id: string): void;
/** 设默认模板；null = 取消默认。 */
export declare function setDefaultTemplate(id: string | null): void;
/** 偏好更新（白名单校验：非法值/未知键一律拒绝，不做静默修正）。 */
export declare function updatePrefs(patch: unknown): PptsPrefs;
/**
 * 流式写上传体到临时文件（模板目录内 .part 后缀），返回临时文件路径。
 * 首块校验 PK 魔数；累计超限立即中止并清理。调用方失败时无需清理
 * （本函数已兜底），成功时把返回路径交给 addTemplate()。
 */
export declare function writeUploadTemp(body: AsyncIterable<unknown>, limitBytes: number): Promise<string>;
/** 供工具/路由快速判断清单是否已初始化（存在即 true，内容有效性由 loadRegistry 兜底）。 */
export declare function registryExists(): boolean;
