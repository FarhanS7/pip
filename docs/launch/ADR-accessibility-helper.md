# ADR 001: Windows UIAutomation Accessibility Helper Architecture

**Date:** 2026-09-08  
**Status:** Approved  
**Context:** Task B22 (Windows UIAutomation Feasibility Spike)

## 1. Problem Statement

Pip requires real-time screen grounding data (element bounds, accessibility roles, names, editable fields, protected password flags) across Windows applications (browsers, VS Code, File Explorer, native Win32/WinUI apps) to complement screenshot-based vision analysis. 

Querying native Windows UIAutomation (UIA) COM APIs can block, throw COM exceptions, or cause stack overflow during deep UI tree traversal. If executed directly inside Electron's Node.js main thread, a single unhandled COM exception or memory access violation would crash the entire desktop application.

## 2. Options Considered

### Option A: Direct N-API C++ Native Addon in Main Process
- **Pros:** Zero IPC IPC latency overhead (< 2ms).
- **Cons:** Any crash, access violation, or memory leak in the COM traversal crashes Electron's main process. Harder to set hard execution deadlines or kill stuck COM calls.

### Option B: Isolated Standalone Native Executable Helper Process (JSON stdio / Named Pipe)
- **Pros:** 
  - **100% Crash Isolation:** Helper process crash or deadlock is isolated and detected by Pip main process without crashing the desktop app.
  - **Hard Timeout Enforcement:** Main process can set a strict 500ms timeout per query and terminate/restart the helper process if responsive bounds are not returned.
  - **Bounded Traversal:** Enforces max depth (e.g. depth=5, max 100 elements) and redacts password fields before sending JSON to main process.
- **Cons:** Minimal stdio IPC serialization overhead (~5–10ms per query).

### Option C: PowerShell / COM Script Execution
- **Pros:** No compiled binary needed.
- **Cons:** High execution startup delay (500ms+ per call), restricted by PowerShell execution policies on corporate devices.

## 3. Decision

We adopt **Option B: Isolated Standalone Native Helper Process**.

1. The helper will be compiled into `resources/bin/pip-accessibility-helper.exe` (or invoked via isolated native sub-process in `native/accessibility-win`).
2. Main process communicates with the helper via structured JSON stdin/stdout IPC.
3. Every query has a strict 500ms timeout. If a query times out or the helper crashes, main process falls back to screenshot-only vision analysis.
4. Protected password input fields (`IsPassword == true` or role `Password`) are automatically scrubbed at the native helper layer before IPC transmission.

## 4. Measured Latency & Stability Target

- **Query Latency:** < 50ms for typical browser window / File Explorer window.
- **Max Memory Ceiling:** < 30 MiB RSS for helper process.
- **Crash Recovery:** Instant auto-restart on next query upon unhandled exception.
