// 标签页专用 preload 脚本 - 反检测
// 注意：preload 运行在隔离世界，对 navigator/window 的修改页面不可见。
// 因此通过 <script> 标签注入主世界，保证在页面内联脚本之前执行。

const chromeVer = process.versions.chrome || '126.0.0.0';
const chromeMajor = chromeVer.split('.')[0];

// 主世界注入：通过 <script> 标签让代码在页面主世界同步执行
// preload 先于页面脚本运行，因此此处注入的 shim 一定早于页面内联脚本
function injectMainWorldShim() {
  let host;
  try { host = window.location.hostname; } catch { return; }
  if (!/(^|\.)google\.com$/i.test(host)) return;

  const shim = `(function(){
    try {
      // window.chrome（强制覆盖属性，即使 window.chrome 已存在）
      window.chrome = window.chrome || {};
      window.chrome.runtime = window.chrome.runtime || {};
      window.chrome.app = window.chrome.app || { isInstalled: false, InstallState: { DISABLED: 'disabled' }, RunningState: { RUNNING: 'running', CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run' }, getDetails: function(){}, installState: function(){ return 'disabled'; } };
      window.chrome.csi = window.chrome.csi || function(){ return { startE: Date.now(), onloadT: Date.now(), pageT: 0, tran: 15 }; };
      window.chrome.loadTimes = window.chrome.loadTimes || function(){ return { commitLoadTime: Date.now()/1000, connectionInfo: 'h2', finishDocumentLoadTime: Date.now()/1000, finishLoadTime: Date.now()/1000, firstPaintAfterLoadTime: 0, firstPaintTime: Date.now()/1000, navigationType: 'Other', npnNegotiatedProtocol: 'h2', requestTime: Date.now()/1000, startLoadTime: Date.now()/1000, wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true, wasNpnNegotiated: true }; };

      // navigator.userAgentData
      var brands = [
        { brand: 'Not/A)Brand', version: '8' },
        { brand: 'Chromium', version: '${chromeMajor}' },
        { brand: 'Google Chrome', version: '${chromeMajor}' }
      ];
      var fullList = [
        { brand: 'Not/A)Brand', version: '8.0.0.0' },
        { brand: 'Chromium', version: '${chromeVer}' },
        { brand: 'Google Chrome', version: '${chromeVer}' }
      ];
      var uaData = {
        brands: brands,
        mobile: false,
        platform: 'Windows',
        toJSON: function(){ return { brands: brands, mobile: false, platform: 'Windows' }; },
        getHighEntropyValues: function(hints){
          var all = { architecture: 'x86', bitness: '64', model: '', platform: 'Windows', platformVersion: '15.0.0', uaFullVersion: '${chromeVer}', fullVersionList: fullList, wow64: false };
          var out = {};
          (hints || []).forEach(function(k){ if (k in all) out[k] = all[k]; });
          return Promise.resolve(out);
        }
      };
      Object.defineProperty(navigator, 'userAgentData', { get: function(){ return uaData; }, configurable: true });

      // navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', { get: function(){ return false; }, configurable: true });

      // navigator.plugins
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
          if (p === 37445) return 'Google Inc. (Intel)';  // UNMASKED_VENDOR_WEBGL
          if (p === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)';  // UNMASKED_RENDERER_WEBGL
          return getParameter.apply(this, arguments);
        };
      } catch(e) {}
    } catch (e) {}
  })();`;

  const target = document.head || document.documentElement;
  if (target) {
    const script = document.createElement('script');
    script.textContent = shim;
    target.appendChild(script);
    script.remove();
  }
}

// 立即尝试注入
injectMainWorldShim();

// 兜底：如果 documentElement 还没出现，用 MutationObserver + 轮询等待其出现后立即注入
// （<html> 是第一个被解析的元素，此时页面内的 <script> 还没运行）
if (!document.documentElement) {
  let injected = false;
  const tryInject = () => {
    if (injected) return;
    if (document.documentElement) {
      injected = true;
      injectMainWorldShim();
    }
  };
  const obs = new MutationObserver(tryInject);
  obs.observe(document, { childList: true, subtree: true });
  // 轮询兜底（每 0ms 检查一次，最多 100 次）
  let tries = 0;
  const poll = () => {
    if (injected) return;
    tryInject();
    if (!injected && ++tries < 100) setTimeout(poll, 0);
  };
  setTimeout(poll, 0);
}

// DOMContentLoaded 兜底（最晚注入，确保至少有一次）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectMainWorldShim, { once: true });
}
