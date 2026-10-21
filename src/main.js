const { app, BrowserWindow, WebContentsView, ipcMain, session, shell, dialog, Tray, Menu, screen, clipboard, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ============ 反检测配置 ============
app.commandLine.appendSwitch('disable-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Windows 任务栏图标：必须在 ready 之前设置 AppUserModelId
app.setAppUserModelId('com.aishub.ai-hub');

const CHROME_UA = (() => {
  const chromeVersion = process.versions.chrome || '131.0.0.0';
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
})();

// 全局兜底 UA：覆盖所有 partition 会话与窗口（含隐藏中转窗），
// 否则中转窗携带 Electron UA 访问 accounts.google.com 会被 Google 拦截为“不安全浏览器”
app.userAgentFallback = CHROME_UA;

/* ============ Google 登录环境补齐 ============
 * Google 在提交密码后做更深指纹检查，仅改 UA 不够：
 * 1) Chromium 自动发送的 Sec-CH-UA 头只有 "Chromium" 无 "Google Chrome"，与 UA 中的 Chrome/x 矛盾
 * 2) JS 侧 navigator.userAgentData.brands 同样缺 "Google Chrome"，且无 window.chrome 对象
 * 3) navigator.plugins 为空（未开 plugins）是嵌入式浏览器特征
 * 逐项补齐一致性，避免“此浏览器或应用可能不安全”拦截 */
const googleHardenedSessions = new WeakSet();
function hardenSessionForGoogle(sessionObj) {
  if (!sessionObj || googleHardenedSessions.has(sessionObj)) return;
  googleHardenedSessions.add(sessionObj);
  const ver = process.versions.chrome || '131.0.0.0';
  const major = ver.split('.')[0];
  sessionObj.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.google.com/*'] },
    (details, callback) => {
      const h = details.requestHeaders;
      h['Sec-CH-UA'] = `"Not/A)Brand";v="8", "Chromium";v="${major}", "Google Chrome";v="${major}"`;
      h['Sec-CH-UA-Full-Version-List'] = `"Not/A)Brand";v="8.0.0.0", "Chromium";v="${ver}", "Google Chrome";v="${ver}"`;
      h['Sec-CH-UA-Platform'] = '"Windows"';
      h['Sec-CH-UA-Mobile'] = '?0';
      callback({ requestHeaders: h });
    }
  );
  // 放宽 Google 页面的 CSP：允许内联脚本，使 preload 注入的主世界 shim 能在页面脚本前执行
  sessionObj.webRequest.onHeadersReceived(
    { urls: ['https://*.google.com/*'] },
    (details, callback) => {
      const headers = details.responseHeaders;
      let cspKey = null;
      for (const key of Object.keys(headers)) {
        if (/^content-security-policy/i.test(key)) { cspKey = key; break; }
      }
      if (cspKey) {
        let val = Array.isArray(headers[cspKey]) ? headers[cspKey][0] : headers[cspKey];
        if (typeof val === 'string') {
          // 1. 移除 require-trusted-types-for（否则 script.textContent 赋值被拦截）
          val = val.replace(/require-trusted-types-for[^;]*;?/g, '');
          // 2. 修改 script-src：移除非 nonce/hash，确保 unsafe-inline
          val = val.replace(/script-src[^;]*/, (m) => {
            let cleaned = m.replace(/'nonce-[^']*'/g, '').replace(/'sha256-[^']*'/g, '').replace(/'sha384-[^']*'/g, '').replace(/'sha512-[^']*'/g, '');
            return cleaned.includes("'unsafe-inline'") ? cleaned : cleaned + " 'unsafe-inline'";
          });
          // 3. 如果没有 script-src 指令，添加一个允许内联脚本的
          if (!/script-src/.test(val)) {
            val = "script-src 'unsafe-inline' 'unsafe-eval' *;" + val;
          }
          headers[cspKey] = [val];
        }
      }
      callback({ responseHeaders: headers });
    }
  );
}

function isGoogleUrl(u) {
  try { return /(^|\.)google\.com$/i.test(new URL(u).hostname); } catch { return false; }
}

// 主世界注入 Chrome 环境补齐脚本（executeJavaScript 走主进程通道，不受页面 CSP 限制）
// 注意：必须在 did-start-navigation 时注入，才能在页面内联脚本读取指纹前生效。
// tab-preload.js 运行在隔离世界，其对 navigator/window 的修改页面不可见，所以这里要全部补一遍。
function injectChromeEnvShim(wc) {
  const ver = process.versions.chrome || '131.0.0.0';
  const major = ver.split('.')[0];
  const sysVer = (process.getSystemVersion ? process.getSystemVersion() : '') || '';
  const build = parseInt(String(sysVer).split('.')[2] || '0', 10) || 0;
  const platformVersion = build >= 22000 ? '15.0.0' : '10.0.0';
  wc.executeJavaScript(`(function(){
    try {
      // window.chrome（强制覆盖属性，即使 window.chrome 已存在）
      window.chrome = window.chrome || {};
      window.chrome.runtime = window.chrome.runtime || {};
      window.chrome.app = window.chrome.app || { isInstalled: false, InstallState: { DISABLED: 'disabled' }, RunningState: { RUNNING: 'running', CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run' }, getDetails: function(){}, installState: function(){ return 'disabled'; } };
      window.chrome.csi = window.chrome.csi || function(){ return { startE: Date.now(), onloadT: Date.now(), pageT: 0, tran: 15 }; };
      window.chrome.loadTimes = window.chrome.loadTimes || function(){ return { commitLoadTime: Date.now()/1000, connectionInfo: 'h2', finishDocumentLoadTime: Date.now()/1000, finishLoadTime: Date.now()/1000, firstPaintAfterLoadTime: 0, firstPaintTime: Date.now()/1000, navigationType: 'Other', npnNegotiatedProtocol: 'h2', requestTime: Date.now()/1000, startLoadTime: Date.now()/1000, wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true, wasNpnNegotiated: true }; };

      // navigator.userAgentData（Sec-CH-UA 的 JS 侧来源，必须含 Google Chrome）
      var brands = [
        { brand: 'Not/A)Brand', version: '8' },
        { brand: 'Chromium', version: '${major}' },
        { brand: 'Google Chrome', version: '${major}' }
      ];
      var fullList = [
        { brand: 'Not/A)Brand', version: '8.0.0.0' },
        { brand: 'Chromium', version: '${ver}' },
        { brand: 'Google Chrome', version: '${ver}' }
      ];
      var uaData = {
        brands: brands,
        mobile: false,
        platform: 'Windows',
        toJSON: function(){ return { brands: brands, mobile: false, platform: 'Windows' }; },
        getHighEntropyValues: function(hints){
          var all = { architecture: 'x86', bitness: '64', model: '', platform: 'Windows', platformVersion: '${platformVersion}', uaFullVersion: '${ver}', fullVersionList: fullList, wow64: false };
          var out = {};
          (hints || []).forEach(function(k){ if (k in all) out[k] = all[k]; });
          return Promise.resolve(out);
        }
      };
      Object.defineProperty(navigator, 'userAgentData', { get: function(){ return uaData; }, configurable: true });

      // navigator.webdriver（Electron 默认已为 false，这里强制覆盖以防自动化特征残留）
      Object.defineProperty(navigator, 'webdriver', { get: function(){ return false; }, configurable: true });

      // navigator.plugins（Chromium 110+ 默认空数组，是嵌入式浏览器特征，伪造 Chrome 常见插件）
      var fakePlugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
      ];
      var pluginArr = Object.create(PluginArray.prototype);
      fakePlugins.forEach(function(p, i){
        var plugin = Object.create(Plugin.prototype);
        plugin.name = p.name; plugin.filename = p.filename; plugin.description = p.description;
        plugin.length = 0;
        pluginArr[i] = plugin;
        pluginArr[p.name] = plugin;
      });
      Object.defineProperty(pluginArr, 'length', { value: fakePlugins.length });
      pluginArr.item = function(i){ return this[i] || null; };
      pluginArr.namedItem = function(n){ return this[n] || null; };
      pluginArr.refresh = function(){};
      Object.defineProperty(navigator, 'plugins', { get: function(){ return pluginArr; }, configurable: true });

      // navigator.languages
      Object.defineProperty(navigator, 'languages', { get: function(){ return ['zh-CN', 'zh', 'en']; }, configurable: true });

      // navigator.vendor / platform
      Object.defineProperty(navigator, 'vendor', { get: function(){ return 'Google Inc.'; }, configurable: true });
      Object.defineProperty(navigator, 'platform', { get: function(){ return 'Win32'; }, configurable: true });

      // navigator.hardwareConcurrency / deviceMemory
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: function(){ return 8; }, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { get: function(){ return 8; }, configurable: true });

      // WebGL vendor/renderer 伪装
      try {
        var getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(p){
          if (p === 37445) return 'Google Inc. (Intel)';
          if (p === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)';
          return getParameter.apply(this, arguments);
        };
      } catch(e) {}
    } catch (e) {}
  })();`).catch(() => {});
}

// 检测是否通过自启动启动（--autostart 参数由注册表自启动项传递）
const isAutoStart = process.argv.includes('--autostart');

// 预设 AI 网站
const PRESETS = [
  { name: 'ChatGPT',     url: 'https://chat.openai.com/' },
  { name: 'Gemini',      url: 'https://gemini.google.com/' },
  { name: '豆包',        url: 'https://www.doubao.com/chat/' },
  { name: '文心一言',    url: 'https://yiyan.baidu.com/' },
  { name: '通义千问',    url: 'https://tongyi.aliyun.com/qianwen/' },
  { name: 'Kimi',        url: 'https://kimi.moonshot.cn/' },
  { name: 'DeepSeek',    url: 'https://chat.deepseek.com/' },
  { name: '智谱清言',    url: 'https://chatglm.cn/' },
  { name: 'Xiaomi MIMO',   url: 'https://aistudio.xiaomimimo.com/' },
  { name: '即梦',       url: 'https://jimeng.jianying.com/ai-tool/home' }
];

// 配置文件路径（在 app ready 后计算，确保路径正确）
let configPath = '';
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

// 全局状态
let mainWindow = null;
let tabs = [];
let views = new Map();
let activeTabId = null;
let previousTabId = null;  // 进入设置页前的标签，用于返回
let downloadPanelWin = null;
let panelJustClosedAt = 0;
let panelAutoShown = false;  // 是否为下载自动弹出（失焦不自动关闭）
let tray = null;
let isQuitting = false;  // 是否真正退出（区分关闭最小化）

// 下载管理
const downloads = [];  // { id, filename, url, totalBytes, receivedBytes, state, savePath, paused }
const downloadItems = new Map();  // id -> DownloadItem 实例（不可序列化，单独维护）
let downloadDir = '';   // 当前下载目录
const DOWNLOAD_DIR_KEY = 'downloadDir';

// 通用设置
let settings = {
  autoLaunch: false,        // 开机自动启动
  minimizeToTray: true,     // 点击关闭按钮最小化到托盘
  launchMinimizedToTray: false,  // 启动时最小化到托盘
  alwaysOnTop: false,       // 主窗口置顶
  openLinksInNewTab: false, // 网站想开新标签的链接：true=应用内新标签，false=当前标签加载
  toolbarButtons: {         // 工具栏按钮显隐（默认全显示）
    back: true, forward: true, reload: true, home: true,
    alwaysOnTop: true, download: true, promptSidebar: true, settings: true
  },
  toolbarOrder: [           // 工具栏顺序（key 或 'sep'，仅含可见项）
    'back','forward','sep','reload','home','sep','alwaysOnTop','download','promptSidebar','sep','settings'
  ]
};

// 窗口状态
let windowState = null;     // { x, y, width, height, isMaximized }

const TAB_BAR_HEIGHT = 42;
const PROMPT_SIDEBAR_WIDTH = 240;
let promptSidebarVisible = false;

/* ============ 配置持久化 ============ */
function loadConfig() {
  configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.tabs)) tabs = data.tabs;
      if (data.downloadDir) downloadDir = data.downloadDir;
      if (data.settings) {
        settings = { ...settings, ...data.settings };
      }
      if (data.windowState) {
        windowState = data.windowState;
      }
      console.log(`[AI-Hub] 配置加载成功: ${tabs.length} 个标签, 路径: ${configPath}`);
    } else {
      console.log(`[AI-Hub] 配置文件不存在: ${configPath}`);
    }
  } catch (err) {
    console.error('加载配置失败:', err);
    tabs = [];
  }
  // 同步开机自启状态
  applyAutoLaunch();
}

function saveConfig() {
  if (!configPath) configPath = getConfigPath();
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // ephemeral 临时标签（网站 window.open 转发产生）不持久化，重启后不保留
    const persistTabs = tabs.filter(t => !t.ephemeral);
    fs.writeFileSync(configPath, JSON.stringify({ tabs: persistTabs, downloadDir, settings, windowState }, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存配置失败:', err);
  }
}

// ============ 自启动日志（打包后用于调试） ============
function autostartLog(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'autostart-debug.log');
    const line = `[${new Date().toLocaleString()}] ${msg}\n`;
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch (_) {}
}

// 启动时清空旧日志，只保留本次会话
try {
  const logPath = path.join(app.getPath('userData'), 'autostart-debug.log');
  if (fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf-8');
} catch (_) {}

// ============ 新窗口/弹窗跳转调试日志（每次启动清空，只留本次会话） ============
function popupDebugLog(msg) {
  const line = `[${new Date().toLocaleString()}] ${msg}\n`;
  console.log('[popup-debug]', msg);
  try {
    const logPath = path.join(app.getPath('userData'), 'windowopen-debug.log');
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch (_) {}
}

// 启动时清空旧的跳转调试日志
try {
  const logPath = path.join(app.getPath('userData'), 'windowopen-debug.log');
  if (fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf-8');
} catch (_) {}
// ============ Windows 注册表自启动管理 ============
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE_NAME = 'AI-Hub';

function setAutoStart(enabled, minimizeOnStart) {
  if (process.platform !== 'win32') return;
  const { execSync } = require('child_process');
  try {
    const exePath = app.getPath('exe');
    if (enabled) {
      const appPath = app.isPackaged ? '' : ` ${path.join(__dirname, '..')}`;
      let value = `"${exePath}"${appPath}`;
      if (minimizeOnStart) value += ' --autostart';
      autostartLog(`写入注册表值: ${value}`);
      // 用 PowerShell 写注册表，避免 cmd.exe 引号解析问题
      const psValue = value.replace(/'/g, "''");
      execSync(`powershell -NoProfile -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${REG_VALUE_NAME}' -Value '${psValue}'"`);
    } else {
      autostartLog('删除注册表项');
      execSync(`powershell -NoProfile -Command "Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${REG_VALUE_NAME}' -ErrorAction SilentlyContinue"`);
    }
    const result = execSync(`powershell -NoProfile -Command "(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${REG_VALUE_NAME}' -ErrorAction SilentlyContinue).'${REG_VALUE_NAME}'"`, { encoding: 'utf-8' });
    autostartLog(`注册表当前值: ${result.trim()}`);
  } catch (e) {
    autostartLog(`注册表操作失败: ${e.message}`);
  }
}

// 应用开机自启设置
function applyAutoLaunch() {
  autostartLog(`isPackaged: ${app.isPackaged} | autoLaunch: ${settings.autoLaunch} | minimizeOnStart: ${settings.launchMinimizedToTray}`);
  setAutoStart(settings.autoLaunch, settings.launchMinimizedToTray);
}

// 窗口状态保存（debounce 500ms）
let saveWindowStateTimer = null;
function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  clearTimeout(saveWindowStateTimer);
  saveWindowStateTimer = setTimeout(() => {
    try {
      const isMaximized = mainWindow.isMaximized();
      const bounds = mainWindow.getBounds();
      windowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized
      };
      saveConfig();
    } catch {}
  }, 500);
}

// 检查窗口位置是否在屏幕内
function getValidWindowState() {
  if (!windowState) return null;
  const displays = screen.getAllDisplays();
  const { x, y, width, height } = windowState;
  const margin = 50;
  const inScreen = displays.some(d => {
    const { x: sx, y: sy, width: sw, height: sh } = d.bounds;
    return x + width > sx + margin && x < sx + sw - margin &&
           y + height > sy + margin && y < sy + sh - margin;
  });
  if (!inScreen) return null;
  return windowState;
}

/* ============ 加载失败错误页 ============ */
const ERROR_PAGE_PATH = path.join(__dirname, 'renderer', 'error.html');

// 监听主框架加载失败（断网、域名不存在、网站宕机、超时等），展示深色错误页
// homeUrl 为标签初始网址（用于“返回首页”）；登录弹窗无首页，传空字符串
function attachLoadErrorHandler(wc, homeUrl) {
  wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return;  // ERR_ABORTED：导航被主动中断（刷新/跳转中途），不提示
    const failedUrl = validatedURL || '';
    if (failedUrl.includes('error.html')) return;  // 错误页自身加载失败，避免循环
    try {
      wc.loadFile(ERROR_PAGE_PATH, {
        query: {
          url: failedUrl,
          home: homeUrl || '',
          code: String(errorCode),
          desc: errorDescription || ''
        }
      });
    } catch (e) {
      console.error('加载错误页失败:', e);
    }
  });
}

// 刷新：若当前正显示错误页，则重新加载失败的网址（等同于点“重新加载”）
function reloadOrRetry(wc) {
  try {
    const current = wc.getURL();
    if (current.includes('error.html')) {
      const target = new URL(current).searchParams.get('url')
                  || new URL(current).searchParams.get('home');
      if (target) {
        wc.loadURL(target);
        return;
      }
    }
  } catch (e) { /* 解析失败则按普通刷新处理 */ }
  wc.reload();
}

/* ============ 视图管理 ============ */
function createTabView(tab) {
  const view = new WebContentsView({
    webPreferences: {
      partition: tab.partition,
      contextIsolation: true,
      plugins: true,
      preload: path.join(__dirname, 'tab-preload.js')
    }
  });

  view.webContents.userAgent = CHROME_UA;
  hardenSessionForGoogle(view.webContents.session);
  // Google 页面导航开始时补齐 Chrome 环境特征（必须早于页面内联脚本读取指纹）
  view.webContents.on('did-start-navigation', (_e, url) => {
    if (!view.webContents.isDestroyed() && isGoogleUrl(url)) {
      injectChromeEnvShim(view.webContents);
    }
  });

  // 深色底：页面加载前/加载失败/网页无内容时不出现白屏
  view.setBackgroundColor('#0f0f10');
  // 断网/网站不可达等主框架加载失败 → 深色错误页
  attachLoadErrorHandler(view.webContents, tab.url);

  // 为该 partition 设置下载目录
  const dlDir = downloadDir || app.getPath('downloads');
  view.webContents.session.setDownloadPath(dlDir);

  // 下载监听：主动设置保存路径，避免弹框
  // 注意：共享同一 partition 的多个 view 拿到的是同一个 session 对象，
  // 不能每次创建 view 都注册一次，否则一次下载会被记录 N 次。
  if (view.webContents.session.listenerCount('will-download') === 0) {
    view.webContents.session.on('will-download', (event, item, webContents) => {
    const filename = item.getFilename() || 'download';
    // 使用用户设置的下载目录；不主动测试可写性，直接交由 Electron 处理失败
    let dir = downloadDir || app.getPath('downloads');
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error('创建下载目录失败:', e);
    }

    // 生成不冲突的完整保存路径
    let savePath = path.join(dir, filename);
    if (fs.existsSync(savePath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      let i = 1;
      while (fs.existsSync(path.join(dir, `${base} (${i})${ext}`))) i++;
      savePath = path.join(dir, `${base} (${i})${ext}`);
    }
    try {
      item.setSavePath(savePath);
    } catch (e) {
      console.error('设置下载路径失败:', e);
    }

    const downloadId = crypto.randomBytes(8).toString('hex');
    const downloadItem = {
      id: downloadId,
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: item.getReceivedBytes(),
      state: 'progressing',
      paused: false,
      savePath: savePath,
      unviewed: false  // 下载完成后置 true，用户查看面板后清除
    };
    downloads.unshift(downloadItem);
    if (downloads.length > 200) downloads.pop();
    downloadItems.set(downloadId, item);
    notifyDownloadsUpdated();

    item.on('updated', () => {
      downloadItem.receivedBytes = item.getReceivedBytes();
      downloadItem.totalBytes = item.getTotalBytes();
      notifyDownloadsUpdated();
    });

    item.on('done', (event, state) => {
      downloadItem.state = state;
      downloadItem.receivedBytes = item.getReceivedBytes();
      if (state === 'cancelled') downloadItem.paused = false;
      // 下载完成（无论成功/中断/取消）都标记为未查看，触发徽章变绿勾
      // 例外：面板当前已打开（用户正在查看），则视为已查看
      if (state === 'completed' || state === 'interrupted' || state === 'cancelled') {
        const panelOpen = downloadPanelWin && !downloadPanelWin.isDestroyed();
        downloadItem.unviewed = !panelOpen;
      }
      downloadItems.delete(downloadId);
      notifyDownloadsUpdated();
    });
  });
  }

  view.webContents.setWindowOpenHandler((details) => {
    const { url, disposition, features, referrer } = details;
    popupDebugLog(`[${tab.name}] setWindowOpenHandler 触发:\n` +
      `    url         = ${url}\n` +
      `    disposition = ${disposition}\n` +
      `    features    = ${features || '(空)'}\n` +
      `    referrer    = ${(referrer && referrer.url) || '(空)'}`);

    // SPA 常见手法：先 window.open('') 开空白窗，异步拿到地址后再跳转
    // （浏览器弹窗拦截要求 window.open 必须在用户手势同步栈内调用）
    // 以隐藏窗口放行，由 did-create-window 追踪真实跳转地址后再分流
    if (!url || url === 'about:blank' || url.startsWith('about:blank')) {
      popupDebugLog(`[${tab.name}] → 空白窗口请求，隐藏放行以追踪后续跳转`);
      return { action: 'allow', overrideBrowserWindowOptions: { show: false } };
    }
    return routeExternalOpen(url, details, tab, view.webContents);
  });

  // 捕获隐藏中转窗：等它跳转到真实地址，拦截并按正常开窗请求分流
  view.webContents.on('did-create-window', (childWin, details) => {
    popupDebugLog(`[${tab.name}] did-create-window: disposition=${details.disposition}, features=${details.features || '(空)'}`);

    const childWc = childWin.webContents;
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      popupDebugLog(`[${tab.name}] 中转窗结束（${reason}）`);
      try { if (!childWin.isDestroyed()) childWin.close(); } catch {}
    };

    // 跳转到真实地址：阻止中转窗继续加载，直接分流到新标签/弹窗
    childWc.on('will-navigate', (e, navUrl) => {
      popupDebugLog(`[${tab.name}] 中转窗 will-navigate → ${navUrl}`);
      if (/^https?:\/\//i.test(navUrl) && !settled) {
        settled = true;
        e.preventDefault();
        routeExternalOpen(navUrl, details, tab, view.webContents);
        finish('已捕获真实地址并分流');
      }
    });
    // 兜底：极少数情况下 will-navigate 未拦截到（重定向链等），did-navigate 再兜一次
    childWc.on('did-navigate', (_e, navUrl) => {
      if (/^https?:\/\//i.test(navUrl) && !settled) {
        settled = true;
        routeExternalOpen(navUrl, details, tab, view.webContents);
        finish('did-navigate 兜底分流');
      }
    });
    // 中转窗内再次开窗（罕见）：同样拦截分流，不允许弹出游离窗口
    childWc.setWindowOpenHandler((d) => {
      if (d.url && d.url !== 'about:blank' && !d.url.startsWith('about:blank')) {
        return routeExternalOpen(d.url, d, tab, view.webContents);
      }
      return { action: 'deny' };
    });
    childWin.on('closed', () => popupDebugLog(`[${tab.name}] 中转窗已关闭`));
    // 15 秒兜底：一直停留在空白页则自动关闭，避免残留隐藏窗口
    setTimeout(() => finish('15秒超时兜底'), 15000);
  });

  // 右键菜单：原生 Menu，跟随暗色主题
  view.webContents.on('context-menu', (event, params) => {
    const wc = view.webContents;
    if (wc.isDestroyed()) return;

    // 兼容 navigationHistory API（Electron 31+）与旧版
    const items = [];

    // 编辑组
    if (params.selectionText) {
      items.push({ label: '复制', accelerator: 'Ctrl+C', click: () => { if (!wc.isDestroyed()) wc.copy(); } });
    }
    if (params.isEditable && params.selectionText) {
      items.push({ label: '剪切', accelerator: 'Ctrl+X', click: () => { if (!wc.isDestroyed()) wc.cut(); } });
    }
    if (params.isEditable) {
      items.push({ label: '粘贴', accelerator: 'Ctrl+V', click: () => { if (!wc.isDestroyed()) wc.paste(); } });
    }
    items.push({ label: '全选', accelerator: 'Ctrl+A', click: () => { if (!wc.isDestroyed()) wc.selectAll(); } });

    // 链接 / 图片
    if (params.linkURL) {
      items.push({ label: '复制链接地址', click: () => clipboard.writeText(params.linkURL) });
      // 用户主动选择：始终开临时标签，不受「临时窗口在新标签页打开」开关影响
      if (/^https?:\/\//i.test(params.linkURL)) {
        items.push({ label: '在临时标签页打开', click: () => openEphemeralTab(params.linkURL, tab) });
        items.push({ label: '用默认浏览器打开', click: () => shell.openExternal(params.linkURL) });
      }
    } else {
      // 划词里的纯文本网址；选区落在链接上时已有 linkURL，走上面的分支避免重复出项
      const selectedUrl = extractFirstUrl(params.selectionText);
      if (selectedUrl) {
        items.push({ label: '在临时标签页打开', click: () => openEphemeralTab(selectedUrl, tab) });
        items.push({ label: '用默认浏览器打开', click: () => shell.openExternal(selectedUrl) });
      }
    }
    if (params.mediaType === 'image' && params.srcURL) {
      items.push({ label: '另存为图片', click: () => { if (!wc.isDestroyed()) wc.downloadURL(params.srcURL); } });
    }

    const menu = Menu.buildFromTemplate(items);
    menu.popup(mainWindow);
  });

  // 刷新/前进/后退快捷键：作用于当前标签（焦点在 webview 内时拦截）
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isCtrlR = input.key === 'r' && (input.control || input.meta);
    if (isCtrlR || input.key === 'F5') {
      event.preventDefault();
      if (viewIsAlive(view)) reloadOrRetry(view.webContents);
    } else if (input.alt && input.key === 'ArrowLeft') {
      event.preventDefault();
      goBackInActiveTab();
    } else if (input.alt && input.key === 'ArrowRight') {
      event.preventDefault();
      goForwardInActiveTab();
    }
  });

  // 导航完成/页面内导航 → 通知 renderer 更新前进/后退按钮状态
  view.webContents.on('did-navigate', () => emitNavState());
  view.webContents.on('did-navigate-in-page', () => emitNavState());
  // 临时标签（window.open 转发产生）：用网页真实标题替换初始的域名标签名
  view.webContents.on('page-title-updated', (_e, title) => {
    if (tab.ephemeral && title && title.trim() && title !== tab.name) {
      tab.name = title.length > 24 ? title.trim().slice(0, 24) + '…' : title.trim();
      notifyTabsUpdated();
    }
  });
  // 加载状态 → 标签转圈 + 顶部进度条
  view.webContents.on('did-start-loading', () => emitLoadingState(tab.id, true));
  view.webContents.on('did-stop-loading', () => {
    emitLoadingState(tab.id, false);
    emitNavState();
  });

  view.webContents.loadURL(tab.url);
  return view;
}

/* ============ 登录弹窗识别 ============ */
const LOGIN_KEYWORDS = [
  'oauth', 'login', 'auth', 'signin', 'sign-in', 'login-callback',
  'callback', 'consent', 'authorize', 'accounts.google',
  'accounts.microsoft', 'accounts.feishu', 'github.com/login', 'auth0', 'okta',
  'sso', 'credential', 'token', 'session',
  // 微信扫码登录（open.weixin.qq.com/connect/qrconnect 无 oauth/login 字样）
  'weixin.qq.com', 'open.weixin', 'wechat', 'wx.qq.com',
  // 各站 SSO 通行证域名（passport.baidu.com / passport.weibo.com 等）
  'passport'
];

function isLoginPopup(url) {
  const lower = url.toLowerCase();
  return LOGIN_KEYWORDS.some(kw => lower.includes(kw));
}

/* ============ 划词文本中的网址提取 ============ */
// 裸域名（没写 http:// 的）只认这些顶级域名；刻意不含 py/sh/rs/md/pl/do/so/cc，
// 因为它们在文本里几乎总是文件后缀（main.py、README.md、install.sh），认了会大量误判
const BARE_URL_TLDS = new Set([
  'com', 'net', 'org', 'cn', 'io', 'ai', 'dev', 'app', 'co', 'me', 'info', 'top', 'xyz',
  'edu', 'gov', 'mil', 'biz', 'name', 'pro', 'mobi', 'wiki', 'tv', 'us', 'uk', 'jp', 'kr',
  'tw', 'hk', 'sg', 'my', 'th', 'vn', 'id', 'ph', 'in', 'au', 'nz', 'ca', 'de', 'fr', 'es',
  'it', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'ru', 'ua', 'cz', 'tr', 'il', 'ae',
  'sa', 'za', 'br', 'mx', 'ar', 'cl', 'pt', 'gr', 'ie', 'online', 'site', 'tech', 'store',
  'shop', 'cloud', 'live', 'fun', 'vip', 'work', 'space', 'website', 'group', 'ltd', 'art',
  'design', 'blog', 'news', 'media', 'studio', 'tools', 'team', 'email', 'host', 'press',
  'zone', 'world', 'life', 'today', 'cool', 'school', 'software', 'network', 'systems',
  'solutions', 'agency', 'digital', 'link', 'page', 'club', 'pub'
]);

// 剥离句尾标点：半角标点本身是合法 URL 字符，但出现在句尾时要去掉
function trimUrlPunctuation(url) {
  let out = url.replace(/[》,.;:!?]+$/, '');
  // 结尾的 ) 仅在不配对时剥离（保留 Wikipedia 这类合法的带括号网址）
  while (out.endsWith(')') && out.split(')').length > out.split('(').length) {
    out = out.slice(0, -1);
  }
  return out;
}

// 从选中文字里取出第一个网址（纯文本网址用，返回绝对地址；没有则 null）
function extractFirstUrl(text) {
  if (!text) return null;
  // 中英文句读作为边界：网址常被中文句子包裹，不设边界会把后面的中文一起吞掉
  const re = /https?:\/\/[^\s<>"'`。，、；：！？）】》]+|(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:\/[^\s<>"'`。，、；：！？）】》]*)?/gi;
  let m;
  // 逐个候选校验：前面若被否掉（比如 README.md），要继续往后找真正的网址
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (/^https?:\/\//i.test(raw)) return trimUrlPunctuation(raw);
    // 裸域名必须是独立词：排除邮箱后缀，以及更长 token（路径、坐标）里的一截
    const prev = m.index > 0 ? text[m.index - 1] : '';
    if (/[a-z0-9._@-]/i.test(prev)) continue;
    const host = raw.split(/[/:]/)[0].toLowerCase();
    const tld = host.slice(host.lastIndexOf('.') + 1);
    // www. 开头基本可断定是网址，不受白名单限制；其余必须命中白名单
    // 裸域名没有协议，需补 https://，否则 BrowserView 无法加载
    if (host.startsWith('www.') || BARE_URL_TLDS.has(tld)) return trimUrlPunctuation('https://' + raw);
  }
  return null;
}

/* ============ 网站开窗请求的统一分流 ============ */
// 网站 window.open / target=_blank 转发到应用内新标签
// 复用父标签 partition 以共享登录态；ephemeral 临时标签不写入配置，重启后不保留
function openEphemeralTab(url, parentTab, { foreground = true } = {}) {
  let name = url;
  try {
    name = new URL(url).hostname;
  } catch { /* URL 解析失败则直接用原始 url 作为临时名 */ }
  const id = crypto.randomBytes(8).toString('hex');
  const tab = {
    id,
    name,
    url,
    partition: parentTab.partition,
    ephemeral: true
  };
  // 插入到父标签右侧紧邻位置（Chrome 行为；最新的子页面紧贴父标签）
  // 找不到父标签时兜底追加到末尾
  const parentIdx = tabs.findIndex(t => t.id === parentTab.id);
  if (parentIdx !== -1) tabs.splice(parentIdx + 1, 0, tab);
  else tabs.push(tab);
  saveConfig();
  notifyTabsUpdated();
  if (foreground) selectTab(id);
  return tab;
}

// 开窗请求分流（setWindowOpenHandler 与隐藏中转窗共用），返回 handler 结果
function routeExternalOpen(url, details, parentTab, sourceWc) {
  const disposition = (details && details.disposition) || '';
  const features = (details && details.features) || '';

  if (!/^https?:\/\//i.test(url)) {
    popupDebugLog(`[${parentTab.name}] → 非 http(s) 链接，deny: ${url}`);
    return { action: 'deny' };
  }
  // 登录 / OAuth 流程 → 独立登录弹窗
  if (isLoginPopup(url)) {
    popupDebugLog(`[${parentTab.name}] → 登录弹窗: ${url}`);
    openLoginPopup(url, parentTab.partition);
    return { action: 'deny' };
  }
  // 标签意图：foreground/background-tab，或未声明窗口尺寸的 window.open
  const isTabIntent = disposition === 'foreground-tab'
    || disposition === 'background-tab'
    || !/width\s*=|height\s*=/i.test(features);
  if (isTabIntent) {
    // 设置开关：开 → 应用内临时新标签；关 → 维持旧行为，当前标签加载
    if (settings.openLinksInNewTab) {
      popupDebugLog(`[${parentTab.name}] → 应用内新标签（${disposition || '无尺寸弹窗'}）: ${url}`);
      openEphemeralTab(url, parentTab, { foreground: disposition !== 'background-tab' });
    } else {
      popupDebugLog(`[${parentTab.name}] → 新标签开关关闭，当前标签页加载（${disposition || '无尺寸弹窗'}）: ${url}`);
      try { sourceWc.loadURL(url); } catch (e) { console.error('当前标签加载失败:', e); }
    }
    return { action: 'deny' };
  }
  // 带尺寸的小弹窗（图片查看器、设置面板等）→ 维持现状：当前标签页加载
  popupDebugLog(`[${parentTab.name}] → 小弹窗，当前标签页加载: ${url}`);
  try { sourceWc.loadURL(url); } catch (e) { console.error('当前标签加载失败:', e); }
  return { action: 'deny' };
}

/* ============ 登录弹窗 ============ */
let loginPopupWin = null;
function openLoginPopup(url, partition) {
  if (loginPopupWin) {
    try {
      if (typeof loginPopupWin.isDestroyed === 'function' && !loginPopupWin.isDestroyed()) {
        loginPopupWin.focus();
        loginPopupWin.webContents.loadURL(url);
        return;
      }
    } catch {}
    loginPopupWin = null;
  }
  const [winX, winY] = mainWindow.getPosition();
  const [winW, winH] = mainWindow.getSize();
  const pw = 480, ph = 600;
  loginPopupWin = new BrowserWindow({
    width: pw,
    height: ph,
    x: winX + Math.floor((winW - pw) / 2),
    y: winY + Math.floor((winH - ph) / 2),
    frame: true,
    resizable: true,
    maximizable: false,
    minimizable: true,
    parent: mainWindow,
    backgroundColor: '#17171a',
    title: '登录',
    webPreferences: {
      partition: partition,
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true,
      preload: path.join(__dirname, 'tab-preload.js')
    }
  });
  loginPopupWin.webContents.userAgent = CHROME_UA;
  hardenSessionForGoogle(loginPopupWin.webContents.session);
  // Google 页面导航开始时补齐 Chrome 环境特征（必须早于页面内联脚本读取指纹）
  loginPopupWin.webContents.on('did-start-navigation', (_e, url) => {
    if (!loginPopupWin.webContents.isDestroyed() && isGoogleUrl(url)) {
      injectChromeEnvShim(loginPopupWin.webContents);
    }
  });
  // 断网/网站不可达 → 深色错误页（登录弹窗无首页，仅提供重试）
  attachLoadErrorHandler(loginPopupWin.webContents, '');
  loginPopupWin.loadURL(url);
  loginPopupWin.on('closed', () => {
    loginPopupWin = null;
    if (activeTabId && views.has(activeTabId)) {
      try {
        const v = views.get(activeTabId);
        if (v && typeof v.webContents?.reload === 'function') {
          reloadOrRetry(v.webContents);
        }
      } catch {}
    }
  });
}

function layoutViews() {
  if (!mainWindow) return;
  const [width, height] = mainWindow.getContentSize();
  const contentTop = TAB_BAR_HEIGHT;
  const contentHeight = height - contentTop;
  const sidebarWidth = promptSidebarVisible ? PROMPT_SIDEBAR_WIDTH : 0;

  for (const [tabId, view] of views) {
    if (tabId === activeTabId) {
      view.setBounds({ x: 0, y: contentTop, width: width - sidebarWidth, height: contentHeight });
      view.webContents.focus();
    } else {
      view.setBounds({ x: 0, y: contentTop, width: 0, height: 0 });
    }
  }
}

function selectTab(tabId) {
  // 进入设置页时记录上一个标签
  if (!tabId && activeTabId) {
    previousTabId = activeTabId;
  }

  activeTabId = tabId;

  if (tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (!views.has(tabId)) {
      const view = createTabView(tab);
      mainWindow.contentView.addChildView(view);
      views.set(tabId, view);
    }
  }

  layoutViews();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab-activated', tabId);
    // 切换标签后同步前进/后退按钮状态
    emitNavState();
  }
}

function removeTabView(tabId) {
  if (views.has(tabId)) {
    const view = views.get(tabId);
    mainWindow.contentView.removeChildView(view);
    view.webContents.destroy();
    views.delete(tabId);
  }
}

/* ============ 主窗口 ============ */
function createMainWindow() {
  // 恢复窗口状态
  const validState = getValidWindowState();
  const windowOptions = {
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f0f10',
    title: 'AI Hub',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (validState) {
    windowOptions.x = validState.x;
    windowOptions.y = validState.y;
    windowOptions.width = validState.width;
    windowOptions.height = validState.height;
  } else {
    windowOptions.width = 1280;
    windowOptions.height = 800;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 确保窗口图标生效
  const iconPath = path.join(__dirname, '..', 'icon.ico');
  if (fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
  }

  // 移除应用菜单栏：autoHideMenuBar 仅自动隐藏，按 Alt 仍会唤出菜单
  // 彻底移除应用菜单，Alt 键不再触发顶部菜单栏
  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  // 恢复窗口置顶状态
  if (settings.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true);
  }

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('resize', () => { layoutViews(); saveWindowState(); });
  mainWindow.on('move', () => saveWindowState());
  mainWindow.on('maximize', () => saveWindowState());
  mainWindow.on('unmaximize', () => saveWindowState());

  // 恢复最大化状态
  if (validState && validState.isMaximized) {
    mainWindow.maximize();
  }

  // 关闭按钮：根据设置决定最小化到托盘或直接退出
  mainWindow.on('close', (e) => {
    if (!isQuitting && settings.minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
    // 未开启最小化到托盘 → 默认行为（关闭窗口 → 触发 window-all-closed）
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    views.clear();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`[AI-Hub] 主窗口加载完成, tabs: ${tabs.length} 个`);
    mainWindow.webContents.send('tabs-updated', tabs);
    // 启动时：有标签则默认打开第一个并刷新，无标签才显示设置页
    if (tabs.length > 0) {
      const firstTabId = tabs[0].id;
      selectTab(firstTabId);
      // 延迟刷新，确保 WebContentsView 布局完成
      setTimeout(() => {
        const v = views.get(firstTabId);
        if (v && viewIsAlive(v)) {
          reloadOrRetry(v.webContents);
        }
      }, 300);
    } else {
      selectTab(null);
    }
    // 仅自启动时最小化到托盘，手动启动正常显示
    if (settings.launchMinimizedToTray && isAutoStart) {
      mainWindow.hide();
    }
  });
}

function notifyTabsUpdated() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tabs-updated', tabs);
  }
}

/* ============ IPC ============ */
ipcMain.handle('get-tabs', () => tabs);
ipcMain.handle('get-presets', () => PRESETS);
ipcMain.handle('get-version', () => app.getVersion());

ipcMain.on('select-tab', (_, tabId) => {
  selectTab(tabId);
});

ipcMain.handle('add-tab', (_, { name, url }) => {
  if (!name || !url) return { ok: false, error: '名称和网址不能为空' };
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const id = crypto.randomBytes(8).toString('hex');
  const partition = `persist:aihub-${id}`;
  const tab = { id, name: name.trim(), url: url.trim(), partition };
  tabs.push(tab);
  saveConfig();
  notifyTabsUpdated();
  return { ok: true, tab };
});

ipcMain.handle('remove-tab', (_, tabId) => {
  if (!tabs.find(t => t.id === tabId)) return { ok: false };
  closeOneTab(tabId);
  return { ok: true };
});

ipcMain.handle('rename-tab', (_, { tabId, name }) => {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return { ok: false };
  tab.name = name.trim();
  saveConfig();
  notifyTabsUpdated();
  return { ok: true };
});

ipcMain.handle('reorder-tabs', (_, newOrder) => {
  if (!Array.isArray(newOrder)) return { ok: false };
  const newTabs = newOrder.map(id => tabs.find(t => t.id === id)).filter(Boolean);
  if (newTabs.length === tabs.length) {
    tabs = newTabs;
    saveConfig();
    notifyTabsUpdated();
    return { ok: true };
  }
  return { ok: false };
});

function viewIsAlive(v) {
  try {
    return v && typeof v.webContents?.reload === 'function';
  } catch { return false; }
}

// 获取当前活动标签的导航状态（后退/前进可用性）
// 兼容 navigationHistory API（Electron 31+）与旧版 canGoBack/canGoForward
function getNavState(view) {
  if (!viewIsAlive(view)) return { canGoBack: false, canGoForward: false };
  const wc = view.webContents;
  try {
    if (wc.navigationHistory) {
      return { canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward() };
    }
  } catch { /* fallthrough */ }
  try {
    return { canGoBack: !!wc.canGoBack(), canGoForward: !!wc.canGoForward() };
  } catch { /* 旧 API 已移除 */ }
  return { canGoBack: false, canGoForward: false };
}

// 向 renderer 推送当前活动标签的导航状态
function emitNavState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const view = activeTabId ? views.get(activeTabId) : null;
  mainWindow.webContents.send('nav-state-changed', getNavState(view));
}

// 向 renderer 推送某标签的加载状态（标签转圈 + 顶部进度条）
function emitLoadingState(tabId, loading) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('loading-state-changed', { tabId, loading });
}

// 活动标签后退
function goBackInActiveTab() {
  const view = activeTabId ? views.get(activeTabId) : null;
  if (!viewIsAlive(view)) return;
  const wc = view.webContents;
  try { if (wc.navigationHistory) { wc.navigationHistory.goBack(); return; } } catch {}
  try { if (wc.canGoBack && wc.canGoBack()) wc.goBack(); } catch {}
}

// 活动标签前进
function goForwardInActiveTab() {
  const view = activeTabId ? views.get(activeTabId) : null;
  if (!viewIsAlive(view)) return;
  const wc = view.webContents;
  try { if (wc.navigationHistory) { wc.navigationHistory.goForward(); return; } } catch {}
  try { if (wc.canGoForward && wc.canGoForward()) wc.goForward(); } catch {}
}

ipcMain.on('reload-tab', () => {
  if (!activeTabId) return;
  let view = views.get(activeTabId);
  if (!viewIsAlive(view)) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    view = createTabView(tab);
    mainWindow.contentView.addChildView(view);
    views.set(activeTabId, view);
    layoutViews();
  }
  if (viewIsAlive(view)) {
    reloadOrRetry(view.webContents);
  }
});

ipcMain.on('home-tab', () => {
  if (!activeTabId) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  let view = views.get(activeTabId);
  if (!viewIsAlive(view)) {
    view = createTabView(tab);
    mainWindow.contentView.addChildView(view);
    views.set(activeTabId, view);
    layoutViews();
  }
  if (viewIsAlive(view)) {
    view.webContents.loadURL(tab.url);
  }
});

// 前进/后退：作用于当前活动标签
ipcMain.on('go-back-tab', () => goBackInActiveTab());
ipcMain.on('go-forward-tab', () => goForwardInActiveTab());

// 窗口置顶切换：切换 alwaysOnTop 并持久化
ipcMain.on('toggle-always-on-top', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next);
  settings.alwaysOnTop = next;
  saveConfig();
  mainWindow.webContents.send('always-on-top-changed', next);
});

// 切换设置页（点击设置图标）
ipcMain.on('toggle-settings', () => {
  if (activeTabId) {
    // 当前在标签页 → 进入设置页，记录上一个标签
    selectTab(null);
  } else {
    // 当前在设置页 → 返回上一个标签，没有则返回第一个，没有标签则不操作
    if (tabs.length === 0) return;
    const targetId = (previousTabId && tabs.find(t => t.id === previousTabId))
      ? previousTabId
      : tabs[0].id;
    selectTab(targetId);
  }
});

// 下载面板窗口管理
function showDownloadPanel(auto = false) {
  if (downloadPanelWin && !downloadPanelWin.isDestroyed()) return;
  if (Date.now() - panelJustClosedAt < 300) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  panelAutoShown = auto;
  const [winX, winY] = mainWindow.getPosition();
  const [winW] = mainWindow.getSize();
  const pw = 340, ph = 460;

  downloadPanelWin = new BrowserWindow({
    width: pw,
    height: ph,
    x: winX + winW - pw - 12,
    y: winY + TAB_BAR_HEIGHT + 26,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    parent: mainWindow,
    skipTaskbar: true,
    backgroundColor: '#17171a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  downloadPanelWin.loadFile(path.join(__dirname, 'renderer', 'download-panel.html'));
  downloadPanelWin.once('ready-to-show', () => downloadPanelWin.show());
  downloadPanelWin.on('blur', () => {
    // 失焦即关闭（与之前一致）
    if (downloadPanelWin && !downloadPanelWin.isDestroyed()) {
      panelJustClosedAt = Date.now();
      downloadPanelWin.close();
    }
  });
  downloadPanelWin.on('closed', () => {
    downloadPanelWin = null;
    panelAutoShown = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-panel-closed');
    }
  });
  downloadPanelWin.webContents.on('did-finish-load', () => {
    downloadPanelWin.webContents.send('downloads-updated', downloads);
    downloadPanelWin.webContents.send('download-dir-updated', downloadDir || app.getPath('downloads'));
  });
}

function hideDownloadPanel() {
  if (downloadPanelWin && !downloadPanelWin.isDestroyed()) {
    panelJustClosedAt = Date.now();
    downloadPanelWin.close();
  }
}

// 手动切换下载面板（点击图标）
ipcMain.on('toggle-download-panel', () => {
  if (downloadPanelWin && !downloadPanelWin.isDestroyed()) {
    hideDownloadPanel();
  } else {
    showDownloadPanel(false);
  }
});

/* ============ 下载管理 ============ */
function notifyDownloadsUpdated() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('downloads-updated', downloads);
  }
  if (downloadPanelWin && !downloadPanelWin.isDestroyed()) {
    downloadPanelWin.webContents.send('downloads-updated', downloads);
  }
}

ipcMain.handle('get-downloads', () => downloads);

// 用户点击下载按钮查看面板时，清除所有未查看标记（让徽章从绿勾回到默认）
ipcMain.handle('mark-downloads-viewed', () => {
  let changed = false;
  for (const d of downloads) {
    if (d.unviewed) {
      d.unviewed = false;
      changed = true;
    }
  }
  if (changed) notifyDownloadsUpdated();
  return { ok: true };
});

ipcMain.handle('clear-downloads', () => {
  downloads.length = 0;
  notifyDownloadsUpdated();
  return { ok: true };
});

ipcMain.handle('open-file-location', (_, savePath) => {
  if (savePath) {
    shell.showItemInFolder(savePath);
  }
  return { ok: true };
});

// 下载控制：暂停 / 恢复 / 取消
ipcMain.handle('pause-download', (_, id) => {
  const item = downloadItems.get(id);
  const dl = downloads.find(d => d.id === id);
  if (item && dl && dl.state === 'progressing' && !dl.paused) {
    try { item.pause(); } catch (e) { console.error('暂停下载失败:', e); }
    dl.paused = true;
    notifyDownloadsUpdated();
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('resume-download', (_, id) => {
  const item = downloadItems.get(id);
  const dl = downloads.find(d => d.id === id);
  if (item && dl && dl.state === 'progressing' && dl.paused && item.canResume()) {
    try { item.resume(); } catch (e) { console.error('恢复下载失败:', e); }
    dl.paused = false;
    notifyDownloadsUpdated();
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('cancel-download', (_, id) => {
  const item = downloadItems.get(id);
  const dl = downloads.find(d => d.id === id);
  if (item && dl && dl.state === 'progressing') {
    try { item.cancel(); } catch (e) { console.error('取消下载失败:', e); }
    // 状态变更由 done 事件统一处理
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('set-download-dir', async () => {
  const parentWin = downloadPanelWin && !downloadPanelWin.isDestroyed() ? downloadPanelWin : mainWindow;
  const result = await dialog.showOpenDialog(parentWin, {
    title: '设置默认下载目录',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    downloadDir = result.filePaths[0];
    saveConfig();
    views.forEach(view => {
      view.webContents.session.setDownloadPath(downloadDir);
    });
    session.defaultSession.setDownloadPath(downloadDir);
    if (downloadPanelWin && !downloadPanelWin.isDestroyed()) {
      downloadPanelWin.webContents.send('download-dir-updated', downloadDir);
    }
    return { ok: true, dir: downloadDir };
  }
  return { ok: false };
});

ipcMain.handle('get-download-dir', () => downloadDir || app.getPath('downloads'));

/* ============ 通用设置 ============ */
ipcMain.handle('get-settings', () => settings);

ipcMain.handle('set-settings', (_, newSettings) => {
  const oldAutoLaunch = settings.autoLaunch;
  const oldLaunchMinimized = settings.launchMinimizedToTray;
  settings = { ...settings, ...newSettings };
  saveConfig();
  // 开机自启或启动最小化设置有变化 → 立即应用
  if (oldAutoLaunch !== settings.autoLaunch || oldLaunchMinimized !== settings.launchMinimizedToTray) {
    applyAutoLaunch();
  }
  return { ok: true, settings };
});

/* ============ 缓存/登录清理 ============ */
// 将复选框选项转换为 Electron storage 类型
// options: { cache, sw, cookie, local } 均为 boolean
function buildStorageOptions(options) {
  const storages = [];
  if (options.cache) storages.push('cachestorage');
  if (options.sw) storages.push('serviceworkers');
  if (options.cookie) storages.push('cookies');
  if (options.local) storages.push('localstorage');
  return storages;
}

// 清理所有标签的数据
// options: { cache, sw, cookie, local }
ipcMain.handle('clear-all-cache', async (_, options = { cache: true }) => {
  const tasks = [];
  const storages = buildStorageOptions(options);
  for (const tab of tabs) {
    if (!tab.partition) continue;
    const ses = session.fromPartition(tab.partition);
    if (options.cache) tasks.push(ses.clearCache());
    if (storages.length > 0) {
      tasks.push(ses.clearStorageData({ storages }));
    }
  }
  if (options.cache) tasks.push(session.defaultSession.clearCache());
  if (storages.length > 0) {
    tasks.push(session.defaultSession.clearStorageData({ storages }));
  }
  try {
    await Promise.all(tasks);
    return { ok: true };
  } catch (e) {
    console.error('清理失败:', e);
    return { ok: false, error: e.message };
  }
});

// 清理单个标签的数据
// options: { cache, sw, cookie, local }
ipcMain.handle('clear-tab-data', async (_, { tabId, options }) => {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || !tab.partition) return { ok: false, error: '标签不存在' };
  const ses = session.fromPartition(tab.partition);
  const storages = buildStorageOptions(options);
  try {
    if (options.cache) await ses.clearCache();
    if (storages.length > 0) {
      await ses.clearStorageData({ storages });
    }
    return { ok: true };
  } catch (e) {
    console.error('清理标签数据失败:', e);
    return { ok: false, error: e.message };
  }
});

/* ============ 提示词栏 ============ */
ipcMain.on('toggle-prompt-sidebar', () => {
  promptSidebarVisible = !promptSidebarVisible;
  layoutViews();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('prompt-sidebar-toggled', promptSidebarVisible);
  }
});

/* ============ 提示词存储 ============ */
let promptsDir = '';

function getPromptsDir() {
  if (!promptsDir) {
    promptsDir = path.join(app.getPath('userData'), 'prompts');
    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }
  }
  return promptsDir;
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function getGroupFilePath(groupName) {
  const fileName = sanitizeFileName(groupName) + '.txt';
  return path.join(getPromptsDir(), fileName);
}

function readGroupFile(groupName) {
  try {
    const filePath = getGroupFilePath(groupName);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(line => line.trim());
  } catch (err) {
    console.error(`读取分组文件失败: ${groupName}`, err);
    return [];
  }
}

function writeGroupFile(groupName, prompts) {
  try {
    const filePath = getGroupFilePath(groupName);
    const content = prompts.join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error(`写入分组文件失败: ${groupName}`, err);
    return false;
  }
}

function getAllGroups() {
  try {
    const dir = getPromptsDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.txt'))
      .map(f => f.replace(/\.txt$/, ''));
  } catch (err) {
    console.error('获取分组列表失败:', err);
    return [];
  }
}

function deleteGroupFile(groupName) {
  try {
    const filePath = getGroupFilePath(groupName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`删除分组文件失败: ${groupName}`, err);
    return false;
  }
}

function renameGroupFile(oldName, newName) {
  try {
    const oldPath = getGroupFilePath(oldName);
    const newPath = getGroupFilePath(newName);
    if (fs.existsSync(oldPath)) {
      if (fs.existsSync(newPath)) {
        return false; // 新名称已存在
      }
      fs.renameSync(oldPath, newPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`重命名分组文件失败: ${oldName} -> ${newName}`, err);
    return false;
  }
}

// IPC: 获取所有分组
ipcMain.handle('get-prompt-groups', () => {
  return getAllGroups();
});

// IPC: 获取某个分组的提示词
ipcMain.handle('get-prompts', (_, groupName) => {
  return readGroupFile(groupName);
});

// IPC: 添加分组
ipcMain.handle('add-prompt-group', (_, groupName) => {
  const name = sanitizeFileName(groupName);
  if (!name) return { ok: false, error: '分组名称不能为空' };
  const filePath = getGroupFilePath(name);
  if (fs.existsSync(filePath)) return { ok: false, error: '分组已存在' };
  if (writeGroupFile(name, [])) {
    return { ok: true, groups: getAllGroups() };
  }
  return { ok: false, error: '创建分组失败' };
});

// IPC: 重命名分组
ipcMain.handle('rename-prompt-group', (_, { oldName, newName }) => {
  const newNameSanitized = sanitizeFileName(newName);
  if (!newNameSanitized) return { ok: false, error: '分组名称不能为空' };
  if (renameGroupFile(oldName, newNameSanitized)) {
    return { ok: true, groups: getAllGroups() };
  }
  return { ok: false, error: '重命名失败，名称可能已存在' };
});

// IPC: 删除分组
ipcMain.handle('delete-prompt-group', (_, groupName) => {
  if (deleteGroupFile(groupName)) {
    return { ok: true, groups: getAllGroups() };
  }
  return { ok: false, error: '删除失败' };
});

// IPC: 添加提示词
ipcMain.handle('add-prompt', (_, { groupName, prompt }) => {
  if (!prompt || !prompt.trim()) return { ok: false, error: '提示词不能为空' };
  const prompts = readGroupFile(groupName);
  prompts.push(prompt.trim());
  if (writeGroupFile(groupName, prompts)) {
    return { ok: true, prompts };
  }
  return { ok: false, error: '添加失败' };
});

// IPC: 删除提示词
ipcMain.handle('delete-prompt', (_, { groupName, index }) => {
  const prompts = readGroupFile(groupName);
  if (index < 0 || index >= prompts.length) return { ok: false, error: '索引无效' };
  prompts.splice(index, 1);
  if (writeGroupFile(groupName, prompts)) {
    return { ok: true, prompts };
  }
  return { ok: false, error: '删除失败' };
});

// IPC: 编辑提示词
ipcMain.handle('edit-prompt', (_, { groupName, index, newPrompt }) => {
  if (!newPrompt || !newPrompt.trim()) return { ok: false, error: '提示词不能为空' };
  const prompts = readGroupFile(groupName);
  if (index < 0 || index >= prompts.length) return { ok: false, error: '索引无效' };
  prompts[index] = newPrompt.trim();
  if (writeGroupFile(groupName, prompts)) {
    return { ok: true, prompts };
  }
  return { ok: false, error: '编辑失败' };
});

// IPC: 复制到剪贴板
ipcMain.handle('copy-to-clipboard', (_, text) => {
  try {
    clipboard.writeText(text);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: 读取剪贴板文本
ipcMain.handle('get-clipboard-text', () => {
  try {
    return clipboard.readText();
  } catch (err) {
    return '';
  }
});

// IPC: 标签右键菜单（原生 Menu，层级高于 WebContentsView）
ipcMain.on('show-tab-menu', (_event, { tabId, x, y }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const items = [];

  items.push({
    label: '复制链接地址',
    click: () => clipboard.writeText(tab.url)
  });
  items.push({
    label: '用默认浏览器打开',
    click: () => shell.openExternal(tab.url)
  });

  const menu = Menu.buildFromTemplate(items);
  menu.popup(mainWindow, { x, y });
});

function closeOneTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  removeTabView(tabId);
  tabs.splice(idx, 1);
  if (activeTabId === tabId) {
    const neighbor = tabs[idx - 1] || tabs[idx] || null;
    selectTab(neighbor ? neighbor.id : null);
  }
  saveConfig();
  notifyTabsUpdated();
  layoutViews();
}

// IPC: 打开提示词存储目录
ipcMain.handle('open-prompt-dir', () => {
  try {
    const dir = getPromptsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    shell.openPath(dir);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ============ 托盘 ============ */
function createTray() {
  const iconPath = path.join(__dirname, '..', 'icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('AI Hub');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showMainWindow() },
    { label: '设置', click: () => openSettings() },
    { label: '退出', click: () => quitApp() }
  ]);

  tray.setContextMenu(contextMenu);
  // 单击托盘图标：显示/隐藏主窗口
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        showMainWindow();
      }
    } else {
      createMainWindow();
    }
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// 进入设置页（托盘菜单入口；窗口未加载则等待加载完成后再进设置页）
function openSettings() {
  showMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', () => selectTab(null));
    } else {
      selectTab(null);
    }
  }
}

function quitApp() {
  isQuitting = true;
  if (tray) tray.destroy();
  app.quit();
}

/* ============ 单实例锁 ============ */
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 第二次启动时聚焦已有窗口
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  /* ============ 应用生命周期 ============ */
  app.whenReady().then(() => {
    loadConfig();
    // 强制暗色主题：让原生右键菜单等系统组件跟随应用暗色风格
    nativeTheme.themeSource = 'dark';
    session.defaultSession.setUserAgent(CHROME_UA);
    hardenSessionForGoogle(session.defaultSession);

    // 设置默认下载目录
    const defaultDownloadDir = downloadDir || app.getPath('downloads');
    session.defaultSession.setDownloadPath(defaultDownloadDir);

    createMainWindow();
    createTray();
  });

  app.on('window-all-closed', () => {
    // 开启最小化到托盘 → 不退出，保持托盘运行
    // 未开启最小化到托盘 → 直接退出
    if (!settings.minimizeToTray) {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}
