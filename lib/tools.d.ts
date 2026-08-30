export declare const packageRoot: string;
interface PythonCandidate {
    cmd: string;
    args: readonly string[];
}
/** 依次探测候选 Python（py -3 → python3 → python），返回第一个可执行者。 */
export declare function findPython(): Promise<PythonCandidate | null>;
export interface PptsCheckResult {
    ok: boolean;
    message: string;
    report?: string;
}
/** 环境自检：委托 compiler/build_pptx.py --check 输出统一报告。 */
export declare function runCheck(): Promise<PptsCheckResult>;
export interface PptsRenderParams {
    /** 待验收的 PPTX 绝对路径或相对当前工作目录的路径。 */
    pptxPath: string;
    /** PNG 输出目录，缺省为 PPTX 同目录下 ./render_review/。 */
    outDir?: string;
}
export interface PptsRenderResult {
    ok: boolean;
    message: string;
    output?: string;
}
/** 渲染验收：PPTX → PDF → PNG，供视觉复核与返工。 */
export declare function runRender(params: PptsRenderParams): Promise<PptsRenderResult>;
/** dsh tools registry 接受的最小定义形态（见 @deepseek-ai/dsh-tools register()）。 */
export interface DshToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output: {
        schema: Record<string, unknown>;
        render: (args: unknown, value: unknown) => Array<{
            type: string;
            text: string;
        }>;
    };
    timeoutMs?: number;
    execute: (args: any) => Promise<unknown>;
}
export declare const pptsCheckTool: DshToolDefinition;
export declare const pptsRenderTool: DshToolDefinition;
export {};
