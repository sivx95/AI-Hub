# Debug Session: google-login-blocked

**Status**: [OPEN]
**Session ID**: google-login-blocked
**Created**: 2026-09-26

## Problem

Google 登录页显示"无法登录 / 此浏览器或应用可能不安全"，账号登录被拦截。
已尝试过 UA 伪装、Sec-CH-UA 头覆盖、navigator.userAgentData / window.chrome / plugins 修补，问题仍存在。

## Environment

- OS: Windows
- Electron: ^31.0.0 (Chromium ~131)
- 项目: AI-Hub (e:\Desktop\AI-Hub)

## Hypotheses

| ID | Hypothesis | Likelihood | Effort | Expected Signal |
|----|------------|------------|--------|-----------------|
| A | Sec-CH-UA 头未被 webRequest 实际修改（Chromium 在 webRequest 之后才加 client hint） | High | Low | 发到 google.com 的请求头 Sec-CH-UA 不含 "Google Chrome" |
| B | navigator.userAgentData shim 注入太晚或未在正确上下文执行 | High | Low | 页面读取到的 brands 不含 "Google Chrome"，或 shim 日志未输出 |
| C | navigator.plugins / WebGL 等指纹仍暴露嵌入式特征 | Medium | Medium | plugins.length===0 或 WebGL vendor 非 Chrome 典型值 |
| D | TLS/HTTP2 指纹 (JA3/JA4) 被 Google 识别为非 Chrome | Medium | High | 所有 header/JS 指纹都正确但仍被拦截 |
| E | window.chrome 对象不完整，缺 Google 检查的特定属性 | Low | Low | window.chrome 缺 runtime.loadTiming / csi 等 |

## Evidence Log

### Pre-fix run (2026-09-26)

**假设验证结果：**

| ID | Hypothesis | Status | Evidence |
|----|------------|--------|----------|
| A | Sec-CH-UA 头未被修改 | ❌ Rejected | 所有请求 modSecChUa 正确含 "Google Chrome";v="126" |
| B | userAgentData shim 未生效 | ❌ Rejected | shim 运行，brands 正确含 Google Chrome:126 |
| C | plugins 为空 | ❌ Rejected | pluginsLen: 3 |
| E | window.chrome 缺失 | ❌ Rejected | hasChrome: true |
| D | 时序问题：页面在 shim 前缓存了原始指纹 | ✅ Confirmed | 所有指纹在 shim 运行时正确，但仍被拦截。shim 通过 did-start-navigation+executeJavaScript 注入，不保证早于页面内联脚本 |

**根因**：注入时机不可靠。preload 运行在隔离世界，修改对页面不可见；executeJavaScript 可能晚于页面脚本。

## Status

[OPEN] — 实施修复中：将 shim 移至 preload 通过 <script> 标签注入主世界
