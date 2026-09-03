#!/usr/bin/env python3
"""dsh-super-ppts PPTX 编译桥（pptx-designer 引擎）。

职责：
- --check       环境自检报告（Python 版本 / pip / pptx-designer / 渲染链 soffice+pdftoppm）；
                当前解释器低于 3.10 但专属 venv 解释器满足时不算 FAIL（生成走 venv）
- --ensure-deps 缺 pptx-designer 时自动安装：pip --user 优先，PEP 668 externally-
                managed 解释器（Homebrew Python 等）拒绝时降级到专属 venv
- --run <py>    运行 Build Mode 生成脚本（脚本内直接 import pptx_designer），运行后
                可用 --expect <glob> 校验产物存在
- --quick ...   FreeStyle 快路径：generate_ppt(query=...) 一句话生成

工程约定：
- 只用标准库 + 可选导入 pptx_designer；子进程一律参数数组（禁 shell 拼接）
- 脚本自身不写死业务样式；设计决策由技能层（skills/ppts-pptx）编排
"""

from __future__ import annotations

import argparse
import glob
import importlib.util
import os
import platform
import shutil
import subprocess
import sys

MIN_PYTHON = (3, 10)
PACKAGE = "pptx-designer"
IMPORT_NAME = "pptx_designer"

# 专属虚拟环境：PEP 668 externally-managed 解释器（Homebrew Python 等）拒绝
# pip --user，自动安装降级落到这里。放 ~/.dsh 下（dsh 家目录，写权限无忧），
# 跨安装位（真源仓 / 镜像 / link 安装）共享同一环境。
VENV_DIR = os.path.expanduser(os.path.join("~", ".dsh", "venvs", "dsh-super-ppts"))

# 常见 soffice 安装路径（shutil.which 覆盖 PATH 内场景，这里兜底 PATH 外的典型安装位）
# 注意：与 skills/ppts-pptx/scripts/render_pptx.py 的 probe_soffice() 保持一致——改一处同步另一处
SOFFICE_FALLBACKS = [
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",           # macOS
    "/usr/local/bin/soffice", "/usr/bin/soffice",                      # Linux
    "/opt/libreoffice/program/soffice",                                # Linux (手动安装)
]
# Windows 兜底在 probe_soffice() 内按环境变量展开，不在此硬编码盘符


def fail(message: str, code: int = 1) -> None:
    print(f"[super-ppts] ERROR: {message}")
    raise SystemExit(code)


def check_python_version() -> str:
    if sys.version_info >= MIN_PYTHON:
        return f"OK   python {platform.python_version()}"
    # 当前解释器过旧：生成路径（resolve_python）会回落到专属 venv，venv 满足即不阻断
    venv_version = venv_python_version()
    if venv_version and _version_tuple(venv_version) >= MIN_PYTHON:
        return (
            f"OK   python {platform.python_version()} < {'.'.join(map(str, MIN_PYTHON))}"
            f"，但专属 venv 满足要求（python {venv_version}: {VENV_DIR}），生成将走 venv"
        )
    hint = (
        f"venv 解释器 {venv_version} 同样过旧" if venv_version else f"无可用专属 venv（{VENV_DIR}）"
    )
    return (
        f"FAIL python {platform.python_version()} < {'.'.join(map(str, MIN_PYTHON))}"
        f"（请升级 Python 3.10+；{hint}）"
    )


def module_version(import_name: str) -> str | None:
    spec = importlib.util.find_spec(import_name)
    if spec is None:
        return None
    try:
        import importlib.metadata as metadata

        # PyPI 发行名与导入名不同（pptx-designer vs pptx_designer）
        for name in (PACKAGE, import_name, import_name.replace("_", "-")):
            try:
                return metadata.version(name)
            except metadata.PackageNotFoundError:
                continue
        return "installed(version-unknown)"
    except Exception:  # noqa: BLE001 - 元数据读取失败不应中断自检
        return "installed"


def check_package() -> str:
    version = module_version(IMPORT_NAME)
    if version is not None:
        return f"OK   {PACKAGE} {version}（当前解释器）"
    venv_version = venv_module_version()
    if venv_version is not None:
        return f"OK   {PACKAGE} {venv_version}（venv: {VENV_DIR}）"
    return f"MISS {PACKAGE} 未安装（运行本脚本 --ensure-deps 自动安装，或手动：{sys.executable} -m pip install --user {PACKAGE}）"


def venv_python() -> str:
    """专属 venv 的解释器路径（可能尚不存在）。"""
    exe = "python.exe" if platform.system() == "Windows" else "python"
    return os.path.join(VENV_DIR, "Scripts" if platform.system() == "Windows" else "bin", exe)


def venv_module_version() -> str | None:
    """venv 内的 pptx_designer 版本（子进程探测；venv 未建或缺包返回 None）。"""
    python = venv_python()
    if not os.path.isfile(python):
        return None
    try:
        result = subprocess.run(  # noqa: S603 - 参数数组，无 shell
            [python, "-c", "import importlib.metadata as m; print(m.version('pptx-designer'))"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 and result.stdout.strip() else None


def _version_tuple(text: str) -> tuple[int, ...]:
    """'3.14.3' → (3, 14, 3)；遇到非数字段即截断（对探测输出容错）。"""
    parts: list[int] = []
    for chunk in text.strip().split("."):
        if not chunk.isdigit():
            break
        parts.append(int(chunk))
    return tuple(parts)


def venv_python_version() -> str | None:
    """专属 venv 解释器版本（子进程探测；venv 未建或探测失败返回 None）。"""
    python = venv_python()
    if not os.path.isfile(python):
        return None
    try:
        result = subprocess.run(  # noqa: S603 - 参数数组，无 shell
            [python, "--version"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    # 版本号通常在 stdout（"Python 3.14.3"）；部分发行版打到 stderr，两处拼接兜底
    output = (result.stdout + result.stderr).strip()
    if result.returncode != 0 or not output:
        return None
    return output.split()[-1]


def resolve_python() -> str:
    """选可用的生成解释器：当前解释器优先，其次专属 venv；都没有则 fail 并给指引。"""
    if module_version(IMPORT_NAME) is not None:
        return sys.executable
    if venv_module_version() is not None:
        return venv_python()
    fail(
        f"{PACKAGE} 不可用（当前解释器与专属 venv 均未安装）。先执行：\n"
        f"  {sys.executable} {os.path.abspath(__file__)} --ensure-deps"
    )
    raise AssertionError("unreachable")  # fail() 必抛，此处仅为类型收窄


def probe_soffice() -> str | None:
    found = shutil.which("soffice")
    if found:
        return found
    for candidate in SOFFICE_FALLBACKS:
        if os.path.isfile(candidate):
            return candidate
    if platform.system() == "Windows":
        for env_key in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
            base = os.environ.get(env_key)
            if not base:
                continue
            candidate = os.path.join(base, "LibreOffice", "program", "soffice.exe")
            if os.path.isfile(candidate):
                return candidate
    return None


def check_render_chain() -> list[str]:
    lines: list[str] = []
    soffice = probe_soffice()
    lines.append(f"OK   soffice: {soffice}" if soffice else "WARN soffice 未找到（PNG 视觉验收不可用；安装 LibreOffice 后可启用，mac: brew install --cask libreoffice）")
    pdftoppm = shutil.which("pdftoppm")
    lines.append(f"OK   pdftoppm: {pdftoppm}" if pdftoppm else "WARN pdftoppm 未找到（PDF→PNG 需 poppler；mac: brew install poppler）")
    return lines


def _browser_hint_line() -> str:
    """轻量探测浏览器：playwright chromium 缓存目录，或常见系统浏览器（channel 兜底）。"""
    home = os.path.expanduser("~")
    caches = [
        os.path.join(home, "Library", "Caches", "ms-playwright"),   # macOS
        os.path.join(home, ".cache", "ms-playwright"),              # Linux
        os.path.join(home, "AppData", "Local", "ms-playwright"),    # Windows
    ]
    if any(os.path.isdir(path) for path in caches):
        return "OK   浏览器: playwright chromium 缓存在场"
    system_browsers = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    ]
    if shutil.which("chrome") or any(os.path.isfile(path) for path in system_browsers):
        return "OK   浏览器: 系统浏览器在场（html_capture 走 channel=chrome/msedge 兜底）"
    return "WARN 未发现浏览器（python3 -m playwright install chromium，或安装系统 Chrome/Edge）"


def check_media_chain() -> list[str]:
    """混合交付 Phase 1（动画嵌入）可选链。全部 WARN 语义——不阻断纯 PPTX
    生成与渲染验收，只影响 skills/ppts-pptx/scripts/html_capture.py 的可用性。"""
    lines: list[str] = []
    ffmpeg = shutil.which("ffmpeg")
    lines.append(f"OK   ffmpeg: {ffmpeg}" if ffmpeg
                 else "WARN ffmpeg 未找到（动画 GIF 合成不可用；mac: brew install ffmpeg）")
    if importlib.util.find_spec("playwright") is not None:
        lines.append("OK   playwright: 可导入（当前解释器）")
    else:
        lines.append("WARN playwright 未安装（HTML 快照/帧捕获不可用；python3 -m pip install --user playwright）")
    lines.append(_browser_hint_line())
    return lines


def _is_externally_managed(pip_output: str) -> bool:
    return "externally-managed-environment" in pip_output


def _install_into_venv() -> None:
    """PEP 668 降级路径：专属 venv 内安装（venv 归 ~/.dsh，需要时才创建）。"""
    import venv as venv_module

    if not os.path.isfile(venv_python()):
        print(f"[super-ppts] 创建专属 venv：{VENV_DIR}")
        venv_module.create(VENV_DIR, with_pip=True)
    print(f"[super-ppts] 正在安装 {PACKAGE}（venv）…")
    result = subprocess.run(  # noqa: S603
        [venv_python(), "-m", "pip", "install", PACKAGE],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0 and venv_module_version() is not None:
        print(f"[super-ppts] {PACKAGE} 安装成功（venv: {VENV_DIR}）")
        return
    if result.stderr:
        print(result.stderr[-800:])
    fail(
        f"{PACKAGE} 自动安装失败。请手动执行后重试：\n"
        f"  {sys.executable} -m pip install --user {PACKAGE}\n"
        f"  或: {venv_python()} -m pip install {PACKAGE}"
    )


def ensure_deps() -> None:
    if module_version(IMPORT_NAME) is not None or venv_module_version() is not None:
        print(f"[super-ppts] {PACKAGE} 已安装，跳过")
        return
    print(f"[super-ppts] 正在安装 {PACKAGE}（pip --user）…")
    result = subprocess.run(  # noqa: S603 - 参数数组，无 shell
        [sys.executable, "-m", "pip", "install", "--user", PACKAGE],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0 and module_version(IMPORT_NAME) is not None:
        print(f"[super-ppts] {PACKAGE} 安装成功（--user）")
        return
    if _is_externally_managed(result.stderr):
        print("[super-ppts] 当前解释器受 PEP 668 管理（拒绝 pip --user），降级到专属 venv")
    elif result.stderr:
        print(result.stderr[-800:])
    _install_into_venv()


def run_build_script(script: str, expect: str | None) -> None:
    if not os.path.isfile(script):
        fail(f"生成脚本不存在：{script}")
    print(f"[super-ppts] 运行生成脚本：{script}")
    result = subprocess.run([resolve_python(), script], check=False)  # noqa: S603
    if result.returncode != 0:
        fail(f"生成脚本退出码 {result.returncode}")
    if expect:
        matched = sorted(glob.glob(expect))
        if not matched:
            fail(f"产物校验失败：没有任何文件匹配 {expect}")
        print("[super-ppts] 产物校验通过：")
        for path in matched:
            print(f"  - {path}")


def quick_generate(query: str, style: str | None, output: str) -> None:
    if module_version(IMPORT_NAME) is None and venv_module_version() is None:
        print("[super-ppts] 缺少 pptx-designer，先执行 --ensure-deps …")
        ensure_deps()
    import textwrap

    driver = textwrap.dedent(
        f"""
        from pptx_designer import generate_ppt
        path = generate_ppt(
            query={query!r},
            style={style!r},
            output={output!r},
        )
        print(f"[super-ppts] 生成完成: {{path}}")
        """
    )
    result = subprocess.run(  # noqa: S603
        [resolve_python(), "-c", driver],
        check=False,
    )
    if result.returncode != 0:
        fail("快路径生成失败（详见上方引擎输出）；可改用 Build Mode：写生成脚本后 --run")


def print_check_report() -> bool:
    lines = [check_python_version(), check_package(), *check_render_chain(), *check_media_chain()]
    ok = all(not line.startswith(("FAIL",)) for line in lines) and not any(
        line.startswith("MISS") for line in lines
    )
    print("[super-ppts] 环境自检报告")
    for line in lines:
        print(f"  {line}")
    print(f"  => {'READY' if ok else 'NOT-READY（按上方提示修复后重跑 --check）'}")
    return ok


def main() -> None:
    parser = argparse.ArgumentParser(description="dsh-super-ppts PPTX 编译桥")
    parser.add_argument("--check", action="store_true", help="环境自检报告")
    parser.add_argument("--ensure-deps", action="store_true", help="安装缺失的 pptx-designer")
    parser.add_argument("--run", metavar="SCRIPT", help="运行 Build Mode 生成脚本")
    parser.add_argument("--expect", metavar="GLOB", help="配合 --run：生成后校验产物 glob")
    parser.add_argument("--quick", action="store_true", help="FreeStyle 快路径生成")
    parser.add_argument("--query", metavar="TEXT", help="快路径：一句话需求")
    parser.add_argument("--style", metavar="STYLE", help="快路径：风格（可选）")
    parser.add_argument("--output", metavar="PATH", help="快路径：输出 PPTX 路径")
    args = parser.parse_args()

    if args.check:
        raise SystemExit(0 if print_check_report() else 1)
    if args.ensure_deps:
        ensure_deps()
        return
    if args.run:
        run_build_script(args.run, args.expect)
        return
    if args.quick:
        if not args.query or not args.output:
            fail("--quick 需要 --query 与 --output")
        quick_generate(args.query, args.style, args.output)
        return
    parser.print_help()


if __name__ == "__main__":
    main()
