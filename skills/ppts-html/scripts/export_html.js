#!/usr/bin/env node
/* HTML 演示导出 PDF/PNG：零依赖直驱 Chrome/Edge headless（shot.js 同款 findBrowser）。
   语义与 PPTX 线一致：导出是静态快照（PDF 定格当前初始状态，动效页要指定时刻
   的帧用 forms/video-shots/scripts/shot.js）。
   用法:
     node export_html.js <页面.html> [--pdf out.pdf] [--png out.png]
                         [--width 1920] [--height 1080] [--budget 8000]
   说明:
     - PDF 经临时副本注入 @page{size:Wpx Hpx;margin:0}——16:9 单页，不留白边，
       不依赖 CLI 缺失的纸张参数；--budget 是虚拟时间预算（ms），让入场动效
       定格到终态再打印。
     - PNG 为视口截图（W×H）。
   找不到浏览器时设环境变量 BROWSER_PATH 指定 chrome/edge 可执行文件。 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [, , file] = process.argv;
const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const pdfOut = arg('pdf'), pngOut = arg('png'), width = +(arg('width', 1920)), height = +(arg('height', 1080));
const budget = +(arg('budget', 8000));
if (!file || (!pdfOut && !pngOut)) {
  console.error('用法: node export_html.js <页面.html> [--pdf out.pdf] [--png out.png] [--width 1920] [--height 1080] [--budget 8000]');
  process.exit(1);
}
const srcPath = path.resolve(file);
if (!fs.existsSync(srcPath)) { console.error('✗ 页面不存在: ' + srcPath); process.exit(1); }

function findBrowser() {
  const cands = [];
  if (process.env.BROWSER_PATH) cands.push(process.env.BROWSER_PATH);
  if (process.platform === 'win32') {
    cands.push('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
  } else if (process.platform === 'darwin') {
    cands.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    cands.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/microsoft-edge');
  }
  for (const c of cands) { try { if (c && fs.existsSync(c)) return c; } catch (e) { } }
  return null;
}
const browser = findBrowser();
if (!browser) { console.error('✗ 未找到 Chrome/Edge，请设置环境变量 BROWSER_PATH'); process.exit(1); }

const src = fs.readFileSync(srcPath, 'utf8');
const tmpFiles = [];
function tmpCopy(injectHead) {
  const tmp = path.join(path.dirname(srcPath), '_export_tmp_' + Date.now() + Math.random().toString(36).slice(2, 6) + '.html');
  const injected = injectHead
    ? src.replace(/<\/head>/i, injectHead + '\n</head>')
    : src;
  fs.writeFileSync(tmp, injected);
  tmpFiles.push(tmp);
  return 'file:///' + tmp.replace(/\\/g, '/');
}
function cleanup() { for (const t of tmpFiles) { try { fs.unlinkSync(t); } catch (e) { } } }

try {
  if (pdfOut) {
    // @page 钉死 16:9 单页零边距；body 外边距清零，防导出 PDF 带灰边
    const pageCss = `<style>@page{size:${width}px ${height}px;margin:0}html,body{margin:0;padding:0}</style>`;
    execFileSync(browser, [
      '--headless', '--disable-gpu', '--no-pdf-header-footer',
      '--virtual-time-budget=' + budget,
      '--print-to-pdf=' + path.resolve(pdfOut),
      tmpCopy(pageCss),
    ], { stdio: 'pipe', timeout: 120000 });
    if (!fs.existsSync(pdfOut)) { console.error('✗ PDF 未产出'); process.exit(1); }
    console.log('saved: ' + pdfOut + ' (' + width + 'x' + height + ' 单页)');
  }
  if (pngOut) {
    execFileSync(browser, [
      '--headless', '--disable-gpu', '--hide-scrollbars',
      '--virtual-time-budget=' + budget,
      '--screenshot=' + path.resolve(pngOut),
      '--window-size=' + width + ',' + height,
      tmpCopy(false),
    ], { stdio: 'pipe', timeout: 120000 });
    if (!fs.existsSync(pngOut)) { console.error('✗ PNG 未产出'); process.exit(1); }
    console.log('saved: ' + pngOut + ' (视口 ' + width + 'x' + height + ')');
  }
} finally { cleanup(); }
