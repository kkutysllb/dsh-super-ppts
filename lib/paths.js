/**
 * 插件包根定位（单一真源）。
 *
 * 此前 index.ts / tools.ts 各自用 import.meta.url 算了一遍 packageRoot，
 * 收拢到本模块：两侧 import 同一实现，并经 re-export 保持原公开面不变。
 * 编译产物位于 lib/，包根即其上一级——真源仓与打包安装位形态同构。
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** 插件包根绝对路径（presets/ skills/ compiler/ 的父目录）。 */
export const packageRoot = resolve(__dirname, '..');
