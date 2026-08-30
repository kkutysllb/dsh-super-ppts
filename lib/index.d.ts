import { type DshToolDefinition } from './tools.js';
export declare const packageRoot: string;
/** Stable Cordis plugin name. */
export declare const name = "dsh-super-ppts";
/** apply 内访问的 ctx 服务（漏声明即抛 without inject）。 */
export declare const inject: string[];
export declare const SUPER_PPTS_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-super-ppts \u63D2\u4EF6\uFF08\u6F14\u793A\u6587\u7A3F\u8D85\u7EA7\u63D2\u4EF6\uFF09\u3002\u53CC\u4EA4\u4ED8\u5F62\u6001\uFF1A1) PPTX \u53EF\u7F16\u8F91\u4EA4\u4ED8\u2014\u2014\u8BBE\u8BA1\u6D41\u7A0B\u7F16\u6392\uFF08\u9700\u6C42\u786E\u8BA4\u2192\u9875\u9762\u7ED3\u6784\u2192\u89C6\u89C9\u65B9\u5411\u9501\u5B9A\u2192\u751F\u6210\u2192PPTX\u2192PDF\u2192PNG \u6E32\u67D3\u9A8C\u6536\u2192\u8FD4\u5DE5\uFF09\uFF0C\u5F15\u64CE\u4E3A pptx-designer Python \u5E93\uFF08\u7528 ppts_check \u5DE5\u5177\u81EA\u68C0\u73AF\u5883\uFF09\uFF1B2) HTML \u5728\u7EBF\u6F14\u793A\u4EA4\u4ED8\u2014\u20148 \u79CD\u5F62\u6001\uFF08\u7FFB\u9875\u6F14\u793A slide-deck\u3001\u6D41\u7A0B\u56FE flowchart\u3001\u534F\u8BAE\u53EF\u89C6\u5316 protocol-viz\u3001\u67B6\u6784\u56FE\u52A8\u753B arch-diagram\u3001\u5361\u7247\u5267\u573A card-theater\u3001\u5B66\u9738\u7B14\u8BB0 scholar-notes\u3001\u89C6\u9891\u5206\u955C video-shots\u3001\u624B\u673A UI \u6F14\u793A phone-ui\uFF09\uFF0C\u5355\u6587\u4EF6 HTML \u76F4\u63A5\u6D4F\u89C8\u5668\u6253\u5F00\u3002\u7528\u6237\u63D0\u5230\u300C\u505APPT / \u6F14\u793A\u6587\u7A3F / \u5E7B\u706F\u7247 / \u6C47\u62A5 / \u6F14\u793A\u52A8\u753B / \u7FFB\u9875 HTML\u300D\u65F6\uFF1A\u5148\u786E\u8BA4\u4EA4\u4ED8\u5F62\u6001\uFF08\u53EF\u7F16\u8F91 PPTX \u8FD8\u662F HTML \u6F14\u793A\uFF09\uFF0C\u518D\u6309\u63D2\u4EF6\u5305\u6839 skills/ \u5BF9\u5E94\u6280\u80FD\u7EBF\u7684\u5DE5\u4F5C\u6D41\u6267\u884C\uFF08\u5305\u6839\u89C1\u672C\u901A\u544A\u6240\u5C5E\u63D2\u4EF6\u7684\u5B89\u88C5\u4F4D\u7F6E\uFF0C\u4E0D\u8981\u731C\u6D4B\u8DEF\u5F84\uFF09\u3002";
export interface Config {
    enabled?: boolean;
    announceToAgent?: boolean;
    registerTools?: boolean;
}
interface SystemPromptService {
    section(spec: {
        name: string;
        order: number;
        text: string;
    }): () => void;
}
interface ToolsService {
    register(definition: DshToolDefinition): () => void;
}
/** apply 收到的 ctx 服务面（只列出 inject 声明过的）。 */
interface PluginContext {
    systemPrompt: SystemPromptService;
    tools: ToolsService;
}
/** 注册预设拷贝 + 能力通告 + 原生工具；返回组合 disposer。 */
export declare function apply(ctx: PluginContext, config?: Config): () => void;
export {};
