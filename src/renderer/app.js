// ============ AI-Hub 主界面逻辑 ============

// DOM 元素
const tabList = document.getElementById('tabList');
const settingsPage = document.getElementById('settingsPage');
const subList = document.getElementById('subList');
const presetGrid = document.getElementById('presetGrid');
const tabCount = document.getElementById('tabCount');
const customName = document.getElementById('customName');
const customUrl = document.getElementById('customUrl');
const addCustomBtn = document.getElementById('addCustomBtn');
let settingsBtn = document.getElementById('settingsBtn');
let backBtn = document.getElementById('backBtn');
let forwardBtn = document.getElementById('forwardBtn');
let reloadBtn = document.getElementById('reloadBtn');
let homeBtn = document.getElementById('homeBtn');
let alwaysOnTopBtn = document.getElementById('alwaysOnTopBtn');

// 工具栏按钮元数据（key → {id, title, svg}），数据驱动渲染
const TOOLBAR_ITEMS = {
  back: { id: 'backBtn', title: '后退', disabled: true, svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>' },
  forward: { id: 'forwardBtn', title: '前进', disabled: true, svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' },
  reload: { id: 'reloadBtn', title: '刷新当前标签', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>' },
  home: { id: 'homeBtn', title: '回到主页', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  alwaysOnTop: { id: 'alwaysOnTopBtn', title: '窗口置顶', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>' },
  download: { id: 'downloadBtn', title: '下载', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' },
  promptSidebar: { id: 'promptSidebarBtn', title: '提示词栏', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' },
  settings: { id: 'settingsBtn', title: '设置', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' }
};
const TOOLBAR_BTN_KEYS = ['back','forward','reload','home','alwaysOnTop','download','promptSidebar','settings'];
// 当前工具栏顺序/显隐状态（renderToolbar 使用）
let currentToolbarOrder = [];
let currentToolbarButtons = {};
let currentNavState = { canGoBack: false, canGoForward: false };
let currentAlwaysOnTop = false;
let currentPromptSidebarOpen = false;
let currentDownloads = [];
const clearAllCacheBtn = document.getElementById('clearAllCacheBtn');
const chkCache = document.getElementById('chkCache');
const chkSW = document.getElementById('chkSW');
const chkCookie = document.getElementById('chkCookie');
const chkLocal = document.getElementById('chkLocal');
const chkAutoLaunch = document.getElementById('chkAutoLaunch');
const chkMinimizeToTray = document.getElementById('chkMinimizeToTray');
const chkLaunchMinimizedToTray = document.getElementById('chkLaunchMinimizedToTray');
const toast = document.getElementById('toast');

// 工具栏显隐 checkbox
const toolbarCheckboxMap = {
  back: document.getElementById('chkToolbarBack'),
  forward: document.getElementById('chkToolbarForward'),
  reload: document.getElementById('chkToolbarReload'),
  home: document.getElementById('chkToolbarHome'),
  alwaysOnTop: document.getElementById('chkToolbarAlwaysOnTop'),
  download: document.getElementById('chkToolbarDownload'),
  promptSidebar: document.getElementById('chkToolbarPromptSidebar'),
  settings: document.getElementById('chkToolbarSettings')
};
// 按钮 id 映射（含两条分隔线）
const toolbarButtonIdMap = {
  back: 'backBtn', forward: 'forwardBtn', reload: 'reloadBtn', home: 'homeBtn',
  alwaysOnTop: 'alwaysOnTopBtn', download: 'downloadBtn',
  promptSidebar: 'promptSidebarBtn', settings: 'settingsBtn'
};

// 下载
let downloadBtn = document.getElementById('downloadBtn');
let downloadBadge = document.getElementById('downloadBadge');

// 状态
let currentTabs = [];
let presets = [];
let activeTabId = null;
let dragSrcId = null;
// 正在加载的标签 id 集合（标签转圈 + 顶部进度条）
const loadingTabs = new Set();
const loadingBar = document.getElementById('loadingBar');

// ============ Toast 提示 ============
let toastTimer = null;
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ============ 标签栏渲染 ============
function renderTabs() {
  tabList.innerHTML = '';

  if (currentTabs.length === 0) return;

  currentTabs.forEach(tab => {
    const el = document.createElement('button');
    el.className = 'tab'
      + (tab.id === activeTabId ? ' active' : '')
      + (loadingTabs.has(tab.id) ? ' loading' : '')
      + (tab.ephemeral ? ' ephemeral' : '');
    el.dataset.tabId = tab.id;
    el.title = tab.name + ' — ' + tab.url;
    // 临时标签（网站开窗转发产生）显示 × 可直接关闭；固定标签不显示
    const closeBtn = tab.ephemeral
      ? '<span class="tab-close" title="关闭标签"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></span>'
      : '';
    el.innerHTML = '<span class="tab-spinner"></span><span class="tab-text"></span>' + closeBtn;
    el.querySelector('.tab-text').textContent = tab.name;
    el.addEventListener('click', () => {
      window.api.selectTab(tab.id);
    });
    const closeEl = el.querySelector('.tab-close');
    if (closeEl) {
      closeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        window.api.removeTab(tab.id);
      });
    }
    tabList.appendChild(el);
  });
}

// 单个标签加载状态变化 → 切换标签转圈
function updateTabLoading(tabId, loading) {
  if (loading) loadingTabs.add(tabId); else loadingTabs.delete(tabId);
  const el = tabList.querySelector(`[data-tab-id="${tabId}"]`);
  if (el) el.classList.toggle('loading', loading);
  updateLoadingBar();
}

// 顶部进度条：仅活动标签加载时显示
function updateLoadingBar() {
  if (!loadingBar) return;
  loadingBar.classList.toggle('active', !!activeTabId && loadingTabs.has(activeTabId));
}

// ============ 页面切换 ============
function showSettingsPage() {
  settingsPage.classList.remove('hidden');
  if (settingsBtn) settingsBtn.classList.add('active');
}

function hideSettingsPage() {
  settingsPage.classList.add('hidden');
  if (settingsBtn) settingsBtn.classList.remove('active');
}

// ============ 订阅列表渲染 ============
function renderSubList() {
  subList.innerHTML = '';
  // 临时标签（网站开窗转发产生）不属于订阅项，不出现在设置列表中
  const fixedTabs = currentTabs.filter(t => !t.ephemeral);
  tabCount.textContent = fixedTabs.length + ' 项';

  if (fixedTabs.length === 0) {
    subList.innerHTML = '<div class="sub-empty">暂无固定项，从下方添加你常用的网址</div>';
    return;
  }

  fixedTabs.forEach((tab) => {
    const item = document.createElement('div');
    item.className = 'sub-item';
    item.draggable = true;
    item.dataset.id = tab.id;

    item.innerHTML = `
      <span class="sub-drag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/>
          <circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/>
          <circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/>
          <circle cx="15" cy="18" r="1.5"/>
        </svg>
      </span>
      <span class="sub-name"></span>
      <span class="sub-url"></span>
      <div class="sub-actions">
        <button class="sub-btn edit" title="编辑名称">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="sub-btn clean" title="清理缓存">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6l-6 6"/>
            <path d="M11 7l-4.5-4.5a1.5 1.5 0 0 0-2.12 0L2 4.88a1.5 1.5 0 0 0 0 2.12L6.5 11"/>
            <path d="M2 22l9-9"/>
            <path d="M16 8l6 6-4 4-6-6"/>
          </svg>
        </button>
        <button class="sub-btn delete" title="移除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          </svg>
        </button>
      </div>
    `;

    item.querySelector('.sub-name').textContent = tab.name;
    item.querySelector('.sub-name').title = tab.name;
    item.querySelector('.sub-url').textContent = tab.url;
    item.querySelector('.sub-url').title = tab.url;

    // 编辑按钮：点击进入内联编辑
    item.querySelector('.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCleanMenu();
      startRename(item, tab);
    });

    // 清理按钮：弹出菜单
    item.querySelector('.clean').addEventListener('click', (e) => {
      e.stopPropagation();
      showCleanMenu(e.currentTarget, tab);
    });

    item.querySelector('.delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      hideCleanMenu();
      const confirmed = await showConfirmDialog(
        e.currentTarget,
        `移除「${tab.name}」吗？`
      );
      if (!confirmed) return;
      // 自动清理该标签的所有数据
      await window.api.clearTabData({
        tabId: tab.id,
        options: { cache: true, sw: true, cookie: true, local: true }
      });
      const result = await window.api.removeTab(tab.id);
      if (result.ok) showToast('已移除 ' + tab.name);
    });

    item.addEventListener('dragstart', (e) => {
      dragSrcId = tab.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.sub-item').forEach(el => el.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragSrcId !== tab.id) item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (!dragSrcId || dragSrcId === tab.id) return;

      const fromIdx = currentTabs.findIndex(t => t.id === dragSrcId);
      const toIdx = currentTabs.findIndex(t => t.id === tab.id);
      if (fromIdx === -1 || toIdx === -1) return;

      const moved = currentTabs.splice(fromIdx, 1)[0];
      currentTabs.splice(toIdx, 0, moved);

      await window.api.reorderTabs(currentTabs.map(t => t.id));
      dragSrcId = null;
      showToast('顺序已更新');
    });

    subList.appendChild(item);
  });
}

// ============ 内联重命名 ============
function startRename(item, tab) {
  const nameEl = item.querySelector('.sub-name');
  if (!nameEl || nameEl.querySelector('input')) return;  // 已在编辑中

  const oldName = tab.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-input';
  input.value = oldName;
  input.maxLength = 20;

  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.focus();
  input.select();

  let saved = false;

  async function save() {
    if (saved) return;
    saved = true;
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      const result = await window.api.renameTab({ tabId: tab.id, name: newName });
      if (result.ok) {
        showToast('已重命名');
      } else {
        showToast('重命名失败', true);
        nameEl.textContent = oldName;
      }
    } else {
      nameEl.textContent = oldName;
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      saved = true;
      nameEl.textContent = oldName;
    }
  });
  input.addEventListener('blur', save);
}

// ============ 清理菜单（复选框形式） ============
let cleanMenuEl = null;
function showCleanMenu(anchor, tab) {
  hideCleanMenu();
  // 同步设置页的复选框状态
  const opts = getCleanOptions();
  cleanMenuEl = document.createElement('div');
  cleanMenuEl.className = 'clean-menu';
  cleanMenuEl.innerHTML = `
    <label class="checkbox-item"><input type="checkbox" data-storage="cache" ${opts.cache ? 'checked' : ''}> HTTP缓存</label>
    <label class="checkbox-item"><input type="checkbox" data-storage="sw" ${opts.sw ? 'checked' : ''}> Service Worker</label>
    <label class="checkbox-item"><input type="checkbox" data-storage="cookie" ${opts.cookie ? 'checked' : ''}> Cookie</label>
    <label class="checkbox-item"><input type="checkbox" data-storage="local" ${opts.local ? 'checked' : ''}> localStorage</label>
    <div class="clean-menu-btn-row">
      <span class="clean-menu-cancel">取消</span>
      <span class="clean-menu-confirm">清理</span>
    </div>
  `;
  document.body.appendChild(cleanMenuEl);

  const rect = anchor.getBoundingClientRect();
  const menuW = cleanMenuEl.offsetWidth;
  const menuH = cleanMenuEl.offsetHeight;
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  // 右侧空间不够则显示在左侧
  let left = rect.right + 4;
  if (left + menuW > winW - 8) {
    left = rect.left - menuW - 4;
  }
  // 下方空间不够则向上偏移
  let top = rect.top;
  if (top + menuH > winH - 8) {
    top = winH - menuH - 8;
  }
  if (top < 8) top = 8;
  cleanMenuEl.style.left = left + 'px';
  cleanMenuEl.style.top = top + 'px';

  // 确认清理
  cleanMenuEl.querySelector('.clean-menu-confirm').addEventListener('click', async () => {
    const options = readMenuOptions();
    hideCleanMenu();
    const result = await window.api.clearTabData({ tabId: tab.id, options });
    if (result.ok) {
      showToast(`已清理 ${tab.name}`);
    } else {
      showToast(result.error || '清理失败', true);
    }
  });

  // 取消
  cleanMenuEl.querySelector('.clean-menu-cancel').addEventListener('click', () => {
    hideCleanMenu();
  });

  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', hideCleanMenuOnce);
  }, 0);

  // 窗口 resize / 失去焦点 / Escape 键 → 关闭
  window.addEventListener('resize', hideCleanMenu);
  window.addEventListener('blur', hideCleanMenu);
  document.addEventListener('keydown', onCleanMenuKeydown);
}

function readMenuOptions() {
  const inputs = cleanMenuEl.querySelectorAll('input[type=checkbox]');
  const options = { cache: false, sw: false, cookie: false, local: false };
  inputs.forEach(input => {
    options[input.dataset.storage] = input.checked;
  });
  return options;
}

function getCleanOptions() {
  return {
    cache: chkCache.checked,
    sw: chkSW.checked,
    cookie: chkCookie.checked,
    local: chkLocal.checked
  };
}

function hideCleanMenuOnce(e) {
  if (cleanMenuEl && !cleanMenuEl.contains(e.target)) hideCleanMenu();
}

function onCleanMenuKeydown(e) {
  if (e.key === 'Escape') hideCleanMenu();
}

function hideCleanMenu() {
  if (cleanMenuEl) {
    cleanMenuEl.remove();
    cleanMenuEl = null;
    document.removeEventListener('click', hideCleanMenuOnce);
    window.removeEventListener('resize', hideCleanMenu);
    window.removeEventListener('blur', hideCleanMenu);
    document.removeEventListener('keydown', onCleanMenuKeydown);
  }
}

// ============ 通用确认弹窗 ============
function showConfirmDialog(anchor, message, { sidebar = false } = {}) {
  return new Promise((resolve) => {
    hideCleanMenu();
    const el = document.createElement('div');
    el.className = 'clean-menu';
    el.innerHTML = `
      <div style="padding:6px 10px;font-size:12px;color:var(--text-primary);line-height:1.5">${message}</div>
      <div class="clean-menu-btn-row">
        <span class="clean-menu-cancel">取消</span>
        <span class="clean-menu-confirm confirm-dialog-danger">确认</span>
      </div>
    `;
    document.body.appendChild(el);

    // 定位
    const rect = anchor.getBoundingClientRect();
    const menuW = el.offsetWidth;
    const menuH = el.offsetHeight;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let left;
    if (sidebar) {
      // 在侧边栏范围内居中
      const sidebarLeft = winW - 240;
      left = sidebarLeft + (240 - menuW) / 2;
    } else {
      // 锚点定位，右侧空间不够则显示在左侧
      left = rect.right + 4;
      if (left + menuW > winW - 8) {
        left = rect.left - menuW - 4;
      }
    }
    let top = rect.top;
    if (top + menuH > winH - 8) top = winH - menuH - 8;
    if (top < 8) top = 8;
    el.style.left = left + 'px';
    el.style.top = top + 'px';

    function close(result) {
      el.remove();
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    el.querySelector('.clean-menu-cancel').addEventListener('click', () => close(false));
    el.querySelector('.confirm-dialog-danger').addEventListener('click', () => close(true));

    function onDocClick(e) {
      if (!el.contains(e.target)) close(false);
    }
    function onClose() { close(false); }
    function onKeydown(e) {
      if (e.key === 'Escape') close(false);
    }

    setTimeout(() => {
      document.addEventListener('click', onDocClick);
    }, 0);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    document.addEventListener('keydown', onKeydown);
  });
}

// ============ 预设渲染 ============
function renderPresets() {
  presetGrid.innerHTML = '';
  presets.forEach(preset => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = preset.name;
    btn.addEventListener('click', async () => {
      const result = await window.api.addTab({ name: preset.name, url: preset.url });
      if (result.ok) showToast('已添加 ' + preset.name);
    });
    presetGrid.appendChild(btn);
  });
}

// ============ 工具函数 ============
async function addCustom() {
  const name = customName.value.trim();
  const url = customUrl.value.trim();
  if (!name || !url) {
    showToast('请填写名称和网址', true);
    return;
  }
  const result = await window.api.addTab({ name, url });
  if (result.ok) {
    customName.value = '';
    customUrl.value = '';
    showToast('已添加 ' + result.tab.name);
  } else {
    showToast(result.error || '添加失败', true);
  }
}

// 更新下载徽章
// 三态：进行中（红色圆点）→ 全部完成且未查看（绿色圆点）→ 用户点击后隐藏
function updateDownloadBadge(downloads) {
  if (!downloadBadge) return;  // 工具栏尚未渲染（downloadBadge 由 renderToolbar 创建）
  const activeCount = downloads.filter(d => d.state === 'progressing').length;
  const hasUnviewedDone = downloads.some(d => d.unviewed);

  if (activeCount > 0) {
    // 进行中：红色圆点
    downloadBadge.classList.remove('badge-done');
    downloadBadge.style.display = 'block';
  } else if (hasUnviewedDone) {
    // 全部完成且未查看：绿色圆点
    downloadBadge.classList.add('badge-done');
    downloadBadge.style.display = 'block';
  } else {
    downloadBadge.classList.remove('badge-done');
    downloadBadge.style.display = 'none';
  }
}

// ============ 事件绑定 ============
// 工具栏按钮事件已改为 #toolbarActions 委托（见 renderToolbar 段）

clearAllCacheBtn.addEventListener('click', async () => {
  const options = getCleanOptions();
  if (!options.cache && !options.sw && !options.cookie && !options.local) {
    showToast('请至少勾选一项', true);
    return;
  }
  clearAllCacheBtn.disabled = true;
  clearAllCacheBtn.textContent = '清理中...';
  const result = await window.api.clearAllCache(options);
  clearAllCacheBtn.disabled = false;
  clearAllCacheBtn.textContent = '清理';
  if (result.ok) {
    showToast('清理完成');
  } else {
    showToast(result.error || '清理失败', true);
  }
});

// 通用设置：开机自启
chkAutoLaunch.addEventListener('change', async () => {
  const result = await window.api.setSettings({ autoLaunch: chkAutoLaunch.checked });
  if (!result.ok) {
    chkAutoLaunch.checked = !chkAutoLaunch.checked;
  } else {
    showToast(chkAutoLaunch.checked ? '已开启 开机自动启动' : '已关闭 开机自动启动');
  }
});

// 通用设置：启动时最小化到托盘
chkLaunchMinimizedToTray.addEventListener('change', async () => {
  const result = await window.api.setSettings({ launchMinimizedToTray: chkLaunchMinimizedToTray.checked });
  if (!result.ok) {
    chkLaunchMinimizedToTray.checked = !chkLaunchMinimizedToTray.checked;
  } else {
    showToast(chkLaunchMinimizedToTray.checked ? '已开启 启动时最小化到托盘' : '已关闭 启动时最小化到托盘');
  }
});

// 通用设置：关闭时最小化到托盘
chkMinimizeToTray.addEventListener('change', async () => {
  const result = await window.api.setSettings({ minimizeToTray: chkMinimizeToTray.checked });
  if (!result.ok) {
    chkMinimizeToTray.checked = !chkMinimizeToTray.checked;
  } else {
    showToast(chkMinimizeToTray.checked ? '已开启 关闭时最小化到托盘' : '已关闭 关闭时最小化到托盘');
  }
});

// 通用设置：临时窗口在新标签页打开
chkOpenLinksInNewTab.addEventListener('change', async () => {
  const result = await window.api.setSettings({ openLinksInNewTab: chkOpenLinksInNewTab.checked });
  if (!result.ok) {
    chkOpenLinksInNewTab.checked = !chkOpenLinksInNewTab.checked;
  } else {
    showToast(chkOpenLinksInNewTab.checked ? '已开启 临时窗口在新标签页打开' : '已关闭 临时窗口在新标签页打开');
  }
});

// 存储管理：保存 checkbox 状态
function saveCleanOptions() {
  window.api.setSettings({
    cleanOptions: {
      cache: chkCache.checked,
      sw: chkSW.checked,
      cookie: chkCookie.checked,
      local: chkLocal.checked
    }
  });
}
chkCache.addEventListener('change', saveCleanOptions);
chkSW.addEventListener('change', saveCleanOptions);
chkCookie.addEventListener('change', saveCleanOptions);
chkLocal.addEventListener('change', saveCleanOptions);

// ============ 工具栏渲染（数据驱动）============
// 按 currentToolbarOrder + currentToolbarButtons 渲染按钮与分隔线
function renderToolbar() {
  const actions = document.getElementById('toolbarActions');
  if (!actions) return;
  actions.innerHTML = '';
  // 只渲染可见按钮 + sep
  const visibleOrder = currentToolbarOrder.filter(k => k === 'sep' || currentToolbarButtons[k] !== false);
  visibleOrder.forEach(key => {
    if (key === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'tab-bar-separator';
      actions.appendChild(sep);
    } else {
      const meta = TOOLBAR_ITEMS[key];
      if (!meta) return;
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.id = meta.id;
      btn.title = meta.title;
      if (meta.disabled) btn.disabled = true;
      btn.innerHTML = meta.svg;
      if (key === 'download') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.id = 'downloadBadge';
        badge.style.display = 'none';
        btn.appendChild(badge);
      }
      actions.appendChild(btn);
    }
  });
  // 分隔线智能隐藏：两侧需有可见按钮，否则隐藏（首尾/相邻 sep）
  const children = Array.from(actions.children);
  children.forEach((node, i) => {
    if (!node.classList.contains('tab-bar-separator')) return;
    const prevBtn = [...children.slice(0, i)].reverse().find(n => n.tagName === 'BUTTON');
    const nextBtn = children.slice(i + 1).find(n => n.tagName === 'BUTTON');
    node.style.display = (prevBtn && nextBtn) ? '' : 'none';
  });
  refreshToolbarDomRefs();
  applyToolbarState();
  if (downloadBadge) updateDownloadBadge(currentDownloads);
}

// 刷新工具栏按钮 DOM 引用（renderToolbar 后调用）
function refreshToolbarDomRefs() {
  backBtn = document.getElementById('backBtn');
  forwardBtn = document.getElementById('forwardBtn');
  reloadBtn = document.getElementById('reloadBtn');
  homeBtn = document.getElementById('homeBtn');
  alwaysOnTopBtn = document.getElementById('alwaysOnTopBtn');
  downloadBtn = document.getElementById('downloadBtn');
  downloadBadge = document.getElementById('downloadBadge');
  promptSidebarBtn = document.getElementById('promptSidebarBtn');
  settingsBtn = document.getElementById('settingsBtn');
}

// 应用按钮状态（disabled / active / badge）
function applyToolbarState() {
  if (backBtn) backBtn.disabled = !currentNavState.canGoBack;
  if (forwardBtn) forwardBtn.disabled = !currentNavState.canGoForward;
  if (alwaysOnTopBtn) alwaysOnTopBtn.classList.toggle('active', currentAlwaysOnTop);
  if (promptSidebarBtn) promptSidebarBtn.classList.toggle('active', currentPromptSidebarOpen);
}

// 工具栏点击事件委托（一次绑定，按钮重建不影响）
(() => {
  const actions = document.getElementById('toolbarActions');
  if (!actions) return;
  actions.addEventListener('click', (e) => {
    const btn = e.target.closest('button.icon-btn');
    if (!btn) return;
    switch (btn.id) {
      case 'settingsBtn': window.api.toggleSettings(); break;
      case 'downloadBtn':
        e.stopPropagation();
        (async () => { await window.api.markDownloadsViewed(); window.api.toggleDownloadPanel(); })();
        break;
      case 'backBtn': if (!btn.disabled) window.api.goBackTab(); break;
      case 'forwardBtn': if (!btn.disabled) window.api.goForwardTab(); break;
      case 'reloadBtn': window.api.reloadTab(); break;
      case 'homeBtn': window.api.homeTab(); break;
      case 'alwaysOnTopBtn': window.api.toggleAlwaysOnTop(); break;
      case 'promptSidebarBtn': togglePromptSidebar(); closeAllMenus(); break;
    }
  });
})();

// 规整顺序：去首尾 sep、合并相邻 sep
function normalizeOrder(order) {
  let o = [...order];
  while (o.length && o[0] === 'sep') o.shift();
  while (o.length && o[o.length - 1] === 'sep') o.pop();
  const merged = [];
  o.forEach(k => { if (k === 'sep' && merged[merged.length - 1] === 'sep') return; merged.push(k); });
  return merged;
}

// 根据显隐配置更新顺序（勾选加末尾 / 取消移除）+ 重新渲染
function applyToolbarVisibility(tb) {
  currentToolbarButtons = tb || {};
  const newOrder = [];
  currentToolbarOrder.forEach(k => {
    if (k === 'sep') newOrder.push('sep');
    else if (currentToolbarButtons[k] !== false) newOrder.push(k);
  });
  // 补新增勾选（之前隐藏、现勾选，不在旧 order 里）→ 加末尾
  TOOLBAR_BTN_KEYS.forEach(k => {
    if (currentToolbarButtons[k] !== false && !newOrder.includes(k)) newOrder.push(k);
  });
  currentToolbarOrder = normalizeOrder(newOrder);
  renderToolbar();
  syncCheckboxOrder();
}

// 按工具栏顺序同步设置页勾选项排列（已勾选按顺序，未勾选排末尾）
function syncCheckboxOrder() {
  const list = document.getElementById('toolbarCheckboxList');
  if (!list) return;
  const labelOf = {};
  Array.from(list.querySelectorAll('label.checkbox-item')).forEach(label => {
    const input = label.querySelector('input[type="checkbox"]');
    if (input) labelOf[input.id] = label;
  });
  const appended = new Set();
  currentToolbarOrder.forEach(k => {
    if (k === 'sep') return;
    const chk = toolbarCheckboxMap[k];
    const label = chk && labelOf[chk.id];
    if (label) { list.appendChild(label); appended.add(chk.id); }
  });
  Object.values(toolbarCheckboxMap).forEach(chk => {
    if (chk && !appended.has(chk.id) && labelOf[chk.id]) list.appendChild(labelOf[chk.id]);
  });
}

// 工具栏显隐：勾选变更即时保存并应用（顺序同步）
Object.entries(toolbarCheckboxMap).forEach(([key, chk]) => {
  if (!chk) return;
  chk.addEventListener('change', async () => {
    const next = {};
    Object.entries(toolbarCheckboxMap).forEach(([k, c]) => { if (c) next[k] = c.checked; });
    applyToolbarVisibility(next);
    await window.api.setSettings({ toolbarButtons: next, toolbarOrder: currentToolbarOrder });
  });
});

// ============ 工具栏排序浮层（模态）============
let sortDraft = null;       // 草稿顺序
let dragSrcIdx = null;      // 拖拽源索引
let dragOverIdx = null;     // 拖拽目标索引
const sortOverlay = document.getElementById('toolbarSortOverlay');
const sortMask = document.getElementById('toolbarSortMask');
const sortList = document.getElementById('toolbarSortList');

// 渲染排序列表（横排图标，可拖拽）
function renderSortList() {
  if (!sortList) return;
  sortList.innerHTML = '';
  sortDraft.forEach((key, idx) => {
    const item = document.createElement('div');
    item.className = key === 'sep' ? 'sort-item sort-sep' : 'sort-item';
    item.draggable = true;
    item.dataset.idx = idx;
    if (key === 'sep') {
      item.title = '分割线';
      item.innerHTML = '<div class="sort-sep-bar"></div>';
    } else {
      const meta = TOOLBAR_ITEMS[key];
      if (!meta) return;
      item.title = meta.title;
      item.innerHTML = meta.svg;
    }
    sortList.appendChild(item);
  });
}

// 打开排序模式
function openToolbarSort() {
  sortDraft = [...currentToolbarOrder];
  renderSortList();
  if (sortOverlay) sortOverlay.style.display = 'flex';
}

// 关闭排序模式（取消）
function closeToolbarSort() {
  sortDraft = null;
  dragSrcIdx = null;
  dragOverIdx = null;
  if (sortOverlay) sortOverlay.style.display = 'none';
}

// 确认：校验 + 持久化 + 同步渲染工具栏
async function confirmToolbarSort() {
  if (!sortDraft) return;
  currentToolbarOrder = normalizeOrder(sortDraft);
  sortDraft = null;
  dragSrcIdx = null;
  dragOverIdx = null;
  if (sortOverlay) sortOverlay.style.display = 'none';
  renderToolbar();
  syncCheckboxOrder();
  await window.api.setSettings({ toolbarOrder: currentToolbarOrder });
}

// 拖拽事件委托（dragover 仅视觉提示，drop 才重排，避免 DOM 重建导致拖拽中断）
if (sortList) {
  sortList.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.sort-item');
    if (!item) return;
    dragSrcIdx = Number(item.dataset.idx);
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    if (e.dataTransfer.setDragImage && item.classList.contains('sort-sep')) {
      e.dataTransfer.setDragImage(item, item.offsetWidth / 2, item.offsetHeight / 2);
    }
  });
  sortList.addEventListener('dragend', (e) => {
    const item = e.target.closest('.sort-item');
    if (item) item.classList.remove('dragging');
    document.querySelectorAll('.sort-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragSrcIdx = null;
    dragOverIdx = null;
  });
  sortList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dragSrcIdx === null) return;
    const item = e.target.closest('.sort-item');
    if (!item) return;
    const tgt = Number(item.dataset.idx);
    if (tgt === dragSrcIdx) return;
    document.querySelectorAll('.sort-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    item.classList.add('drag-over');
    dragOverIdx = tgt;
  });
  sortList.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragSrcIdx === null || dragOverIdx === null) return;
    const [moved] = sortDraft.splice(dragSrcIdx, 1);
    const insertAt = dragOverIdx > dragSrcIdx ? dragOverIdx - 1 : dragOverIdx;
    sortDraft.splice(insertAt, 0, moved);
    renderSortList();
    dragSrcIdx = null;
    dragOverIdx = null;
  });
}

// 排序按钮 + 四操作按钮 + 遮罩点击（=取消）
const toolbarSortBtn = document.getElementById('toolbarSortBtn');
if (toolbarSortBtn) toolbarSortBtn.addEventListener('click', openToolbarSort);
const sortAddSepBtn = document.getElementById('sortAddSep');
if (sortAddSepBtn) sortAddSepBtn.addEventListener('click', () => {
  if (!sortDraft) return;
  sortDraft.push('sep');
  renderSortList();
});
const sortRemoveSepBtn = document.getElementById('sortRemoveSep');
if (sortRemoveSepBtn) sortRemoveSepBtn.addEventListener('click', () => {
  if (!sortDraft) return;
  for (let i = sortDraft.length - 1; i >= 0; i--) {
    if (sortDraft[i] === 'sep') { sortDraft.splice(i, 1); break; }
  }
  renderSortList();
});
const sortCancelBtn = document.getElementById('sortCancel');
if (sortCancelBtn) sortCancelBtn.addEventListener('click', closeToolbarSort);
const sortConfirmBtn = document.getElementById('sortConfirm');
if (sortConfirmBtn) sortConfirmBtn.addEventListener('click', confirmToolbarSort);
if (sortMask) sortMask.addEventListener('click', closeToolbarSort);

addCustomBtn.addEventListener('click', addCustom);
customUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustom(); });
customName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') customUrl.focus();
});

// ============ IPC 监听 ============
window.api.onTabsUpdated((tabs) => {
  currentTabs = tabs;
  // 清理已移除标签的加载状态
  for (const id of loadingTabs) {
    if (!tabs.some(t => t.id === id)) loadingTabs.delete(id);
  }
  renderTabs();
  renderSubList();
  renderPresets();
  updateLoadingBar();
});

window.api.onTabActivated((tabId) => {
  activeTabId = tabId;
  renderTabs();
  updateLoadingBar();
  if (tabId) {
    hideSettingsPage();
  } else {
    showSettingsPage();
  }
});

// 标签加载状态 → 转圈 + 进度条
window.api.onLoadingStateChanged(({ tabId, loading }) => {
  updateTabLoading(tabId, loading);
});

// 导航状态：更新后退/前进按钮可用性（设置页时均为 false）
window.api.onNavStateChanged(({ canGoBack, canGoForward }) => {
  currentNavState = { canGoBack, canGoForward };
  applyToolbarState();
});

// 窗口置顶状态变化
window.api.onAlwaysOnTopChanged((onTop) => {
  currentAlwaysOnTop = onTop;
  applyToolbarState();
});

window.api.onDownloadsUpdated((downloads) => {
  currentDownloads = downloads;
  updateDownloadBadge(downloads);
});

// ============ 初始化 ============
(async () => {
  // 显示当前版本号（读取 package.json 的 version）
  try {
    const ver = await window.api.getVersion();
    const versionEl = document.getElementById('appVersion');
    if (versionEl) versionEl.textContent = `当前版本：v${ver}`;
  } catch (e) { /* 忽略版本读取失败 */ }

  [currentTabs, presets] = await Promise.all([
    window.api.getTabs(),
    window.api.getPresets()
  ]);
  renderTabs();
  renderSubList();
  renderPresets();
  // 启动时的页面切换由主进程通过 tab-activated 事件驱动
  const downloads = await window.api.getDownloads();
  updateDownloadBadge(downloads);
  // 加载通用设置
  const s = await window.api.getSettings();// 加载通用设置
  chkAutoLaunch.checked = !!s.autoLaunch;
  chkMinimizeToTray.checked = s.minimizeToTray !== false;  // 默认 true
  chkLaunchMinimizedToTray.checked = !!s.launchMinimizedToTray;
  chkOpenLinksInNewTab.checked = !!s.openLinksInNewTab;
  // 恢复工具栏顺序 + 显隐（数据驱动渲染）
  currentAlwaysOnTop = !!s.alwaysOnTop;
  currentToolbarOrder = Array.isArray(s.toolbarOrder) && s.toolbarOrder.length
    ? [...s.toolbarOrder]
    : ['back','forward','sep','reload','home','sep','alwaysOnTop','download','promptSidebar','sep','settings'];
  const tbCfg = s.toolbarButtons || {};
  Object.entries(toolbarCheckboxMap).forEach(([k, c]) => { if (c) c.checked = tbCfg[k] !== false; });
  applyToolbarVisibility(tbCfg);
  // 恢复缓存管理 checkbox 状态
  if (s.cleanOptions) {
    chkCache.checked = !!s.cleanOptions.cache;
    chkSW.checked = !!s.cleanOptions.sw;
    chkCookie.checked = !!s.cleanOptions.cookie;
    chkLocal.checked = !!s.cleanOptions.local;
  }

  // 初始化提示词栏
  initPromptSidebar();
})();

// ============ 提示词栏功能 ============
const DEFAULT_GROUP = '默认分组';
let promptGroups = [];
let currentPromptGroup = '';
let currentPrompts = [];
let isRenamingGroup = false;

const promptSidebar = document.getElementById('promptSidebar');
let promptSidebarBtn = document.getElementById('promptSidebarBtn');
const promptGroupSelect = document.getElementById('promptGroupSelect');
const groupSelectDisplay = document.getElementById('groupSelectDisplay');
const promptGroupDropdown = document.getElementById('promptGroupDropdown');
const groupMenuBtn = document.getElementById('groupMenuBtn');
const groupMenu = document.getElementById('groupMenu');
const promptList = document.getElementById('promptList');
const promptEmpty = document.getElementById('promptEmpty');

async function initPromptSidebar() {
  // 初始隐藏侧边栏（与主进程 promptSidebarVisible = false 同步）
  promptSidebar.classList.add('hidden');
  updateSettingsPageRight();
  
  // 加载分组列表
  await loadPromptGroups();
  
  // 确保至少有默认分组
  if (promptGroups.length === 0) {
    await ensureDefaultGroup();
  }
  
  // 恢复上次选中的分组，不存在则选第一个
  const s = await window.api.getSettings();
  currentPromptGroup = (s.lastPromptGroup && promptGroups.includes(s.lastPromptGroup))
    ? s.lastPromptGroup
    : promptGroups[0] || DEFAULT_GROUP;
  updateGroupDisplay();
  await loadPrompts(currentPromptGroup);
  
  // 空白处右键：新增提示词
  promptList.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.prompt-item') || e.target.closest('.prompt-item-edit-input')) return;
    e.preventDefault();
    e.stopPropagation();
    showPromptListContextMenu(e);
  });
}

async function ensureDefaultGroup() {
  const result = await window.api.addPromptGroup(DEFAULT_GROUP);
  if (result.ok) {
    promptGroups = result.groups;
  }
}

function togglePromptSidebar() {
  // 通过IPC通知主进程切换，主进程会回调 onPromptSidebarToggled
  window.api.togglePromptSidebar();
}

function updateSettingsPageRight() {
  const isHidden = promptSidebar.classList.contains('hidden');
  settingsPage.style.right = isHidden ? '0px' : '240px';
}

async function loadPromptGroups() {
  promptGroups = await window.api.getPromptGroups();
  renderPromptGroupSelect();
}

function renderPromptGroupSelect() {
  // 渲染下拉列表
  promptGroupDropdown.innerHTML = '';
  promptGroups.forEach(group => {
    const option = document.createElement('div');
    option.className = 'prompt-group-option';
    option.textContent = group;
    option.dataset.value = group;
    if (group === currentPromptGroup) {
      option.classList.add('selected');
    }
    option.addEventListener('click', async () => {
      currentPromptGroup = group;
      closeGroupDropdown();
      updateGroupDisplay();
      await loadPrompts(currentPromptGroup);
      window.api.setSettings({ lastPromptGroup: group });
    });
    promptGroupDropdown.appendChild(option);
  });
  updateGroupDisplay();
}

function updateGroupDisplay() {
  if (isRenamingGroup) return;
  groupSelectDisplay.textContent = currentPromptGroup || '选择分组';
  groupSelectDisplay.title = currentPromptGroup;
  // 更新下拉列表中的选中态
  const options = promptGroupDropdown.querySelectorAll('.prompt-group-option');
  options.forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === currentPromptGroup);
  });
}

function openGroupDropdown() {
  const rect = promptGroupSelect.getBoundingClientRect();
  promptGroupDropdown.style.left = rect.left + 'px';
  promptGroupDropdown.style.top = rect.bottom + 'px';
  promptGroupDropdown.style.width = rect.width + 'px';
  promptGroupDropdown.style.display = 'block';
  promptGroupSelect.classList.add('open');
}

function closeGroupDropdown() {
  promptGroupDropdown.style.display = 'none';
  promptGroupSelect.classList.remove('open');
}

async function loadPrompts(groupName) {
  if (!groupName) {
    currentPrompts = [];
    renderPromptList();
    return;
  }
  
  currentPrompts = await window.api.getPrompts(groupName);
  renderPromptList();
}

function renderPromptList() {
  promptList.innerHTML = '';
  
  if (!currentPromptGroup) {
    const empty = document.createElement('div');
    empty.className = 'prompt-empty';
    empty.innerHTML = '<span>选择分组查看提示词</span>';
    promptList.appendChild(empty);
    return;
  }
  
  if (currentPrompts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'prompt-empty';
    empty.innerHTML = '<span>暂无提示词，从下方添加</span>';
    promptList.appendChild(empty);
    return;
  }
  
  currentPrompts.forEach((prompt, index) => {
    const item = document.createElement('div');
    item.className = 'prompt-item collapsed';
    item.dataset.index = index;
    
    item.innerHTML = `
      <div class="prompt-item-text clamp"></div>
      <button class="prompt-expand-btn" title="展开/收起">
        <svg class="icon-chevron-down" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <svg class="icon-chevron-up" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 15 12 9 18 15"/>
        </svg>
      </button>
    `;
    
    const textEl = item.querySelector('.prompt-item-text');
    textEl.textContent = prompt;
    textEl.dataset.fullText = prompt;
    
    // 单击复制
    let hasSelection = false;
    
    item.addEventListener('mousedown', () => {
      hasSelection = false;
    });
    
    item.addEventListener('mouseup', () => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        hasSelection = true;
      }
    });
    
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.prompt-expand-btn')) return;
      if (e.target.closest('.prompt-item-edit-input')) return;
      if (hasSelection) {
        hasSelection = false;
        return;
      }
      
      const result = await window.api.copyToClipboard(prompt);
      if (result.ok) {
        showToast('提示词已复制');
      } else {
        showToast('复制失败', true);
      }
    });
    
    // 展开按钮点击
    item.querySelector('.prompt-expand-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePromptExpand(item);
    });
    
    // 右键菜单
    item.addEventListener('contextmenu', (e) => {
      // 如果在 textarea/input 编辑中，让全局处理器处理
      if (e.target.closest('.prompt-item-edit-input')) return;
      
      // 如果选中了文字，让全局处理器处理（显示复制菜单）
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;
      
      e.preventDefault();
      e.stopPropagation();
      showPromptItemContextMenu(e, index, item);
    });
    
    promptList.appendChild(item);
  });
  
  // 空白处右键（移到外部，避免重复绑定）
  // 已移至初始化部分
}

function togglePromptExpand(item) {
  const willCollapse = !item.classList.contains('collapsed');
  const textEl = item.querySelector('.prompt-item-text');
  
  if (willCollapse) {
    item.classList.add('collapsed');
    item.classList.remove('expanded');
    textEl.classList.add('clamp');
  } else {
    item.classList.remove('collapsed');
    item.classList.add('expanded');
    textEl.classList.remove('clamp');
  }
}

function startPromptEdit(item, index, oldPrompt) {
  const textEl = item.querySelector('.prompt-item-text');
  if (!textEl || textEl.querySelector('textarea')) return;
  
  // 自动展开
  item.classList.remove('collapsed');
  item.classList.add('expanded');
  textEl.classList.remove('clamp');
  
  const expandBtn = item.querySelector('.prompt-expand-btn');
  if (expandBtn) expandBtn.style.display = 'none';
  
  textEl.innerHTML = '';
  const textarea = document.createElement('textarea');
  textarea.className = 'prompt-item-edit-input';
  textarea.placeholder = '请输入提示词内容...';
  textarea.value = oldPrompt;
  textEl.appendChild(textarea);
  
  // 自动撑高
  function autoResize() {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
  textarea.addEventListener('input', autoResize);
  autoResize();
  
  textarea.focus();
  textarea.select();
  
  let saved = false;
  
  async function save() {
    if (saved) return;
    saved = true;
    const newPrompt = textarea.value.trim();
    if (newPrompt && newPrompt !== oldPrompt) {
      const result = await window.api.editPrompt(currentPromptGroup, index, newPrompt);
      if (result.ok) {
        currentPrompts = result.prompts;
        renderPromptList();
        showToast('已更新');
      } else {
        showToast(result.error || '编辑失败', true);
        renderPromptList();
      }
    } else {
      renderPromptList();
    }
  }
  
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      textarea.blur();
    } else if (e.key === 'Escape') {
      saved = true;
      renderPromptList();
    }
  });
  textarea.addEventListener('blur', save);
}

// ============ 右键菜单系统 ============
let contextMenuEl = null;
let contextMenuTarget = null;

function hideContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
    contextMenuTarget = null;
    document.removeEventListener('click', hideContextMenu, true);
    document.removeEventListener('mousedown', onContextMenuMouseDown, true);
    document.removeEventListener('keydown', onContextMenuKeydown);
  }
}

function onContextMenuKeydown(e) {
  if (e.key === 'Escape') hideContextMenu();
}

function positionContextMenu(el, x, y) {
  document.body.appendChild(el);
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;
  if (left + rect.width > vw) left = Math.max(0, vw - rect.width - 4);
  if (top + rect.height > vh) top = Math.max(0, vh - rect.height - 4);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  
  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, true);
    document.addEventListener('mousedown', onContextMenuMouseDown, true);
    document.addEventListener('keydown', onContextMenuKeydown);
  }, 0);
}

function onContextMenuMouseDown(e) {
  if (contextMenuEl && !contextMenuEl.contains(e.target)) {
    hideContextMenu();
  }
}

function showPromptItemContextMenu(e, index, item) {
  hideContextMenu();
  const isCollapsed = item.classList.contains('collapsed');
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  
  menu.innerHTML = `
    <div class="context-menu-item" data-action="copy">
      <span class="context-menu-text">复制</span>
    </div>
    <div class="context-menu-item" data-action="edit">
      <span class="context-menu-text">编辑</span>
    </div>
    <div class="context-menu-item" data-action="toggle">
      <span class="context-menu-text">${isCollapsed ? '展开' : '收起'}</span>
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item context-menu-danger" data-action="delete">
      <span class="context-menu-text">删除</span>
    </div>
  `;
  
  positionContextMenu(menu, e.clientX, e.clientY);
  contextMenuEl = menu;
  contextMenuTarget = { type: 'prompt-item', index, item };
  
  menu.querySelectorAll('.context-menu-item').forEach(mi => {
    mi.addEventListener('click', async () => {
      const action = mi.dataset.action;
      hideContextMenu();
      
      const prompt = currentPrompts[index];
      if (!prompt && action !== 'toggle') return;
      
      switch (action) {
        case 'copy':
          const r = await window.api.copyToClipboard(prompt);
          if (r.ok) showToast('提示词已复制');
          else showToast('复制失败', true);
          break;
        case 'edit':
          startPromptEdit(item, index, prompt);
          break;
        case 'toggle':
          togglePromptExpand(item);
          break;
        case 'delete':
          if (!await showConfirmDialog(item, '删除这个提示词吗？', { sidebar: true })) return;
          const result = await window.api.deletePrompt(currentPromptGroup, index);
          if (result.ok) {
            currentPrompts = result.prompts;
            renderPromptList();
            showToast('提示词已删除');
          } else {
            showToast(result.error || '删除失败', true);
          }
          break;
      }
    });
  });
}

function showPromptListContextMenu(e) {
  hideContextMenu();
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  
  menu.innerHTML = `
    <div class="context-menu-item" data-action="add">
      <span class="context-menu-text">新增提示词</span>
    </div>
  `;
  
  positionContextMenu(menu, e.clientX, e.clientY);
  contextMenuEl = menu;
  contextMenuTarget = { type: 'prompt-list' };
  
  menu.querySelector('.context-menu-item').addEventListener('click', () => {
    hideContextMenu();
    addNewPromptInline();
  });
}

function addNewPromptInline() {
  if (!currentPromptGroup) {
    showToast('请先选择分组', true);
    return;
  }
  
  const newIndex = currentPrompts.length;
  const item = document.createElement('div');
  item.className = 'prompt-item';
  item.dataset.index = newIndex;
  
  item.innerHTML = `
    <div class="prompt-item-text"></div>
  `;
  
  // 空列表时插到顶部（占位符前），有内容时追加到末尾
  const emptyEl = promptList.querySelector('.prompt-empty');
  if (emptyEl) {
    promptList.insertBefore(item, emptyEl);
  } else {
    promptList.appendChild(item);
  }
  const textEl = item.querySelector('.prompt-item-text');
  textEl.classList.add('editing');
  
  textEl.innerHTML = '';
  const textarea = document.createElement('textarea');
  textarea.className = 'prompt-item-edit-input';
  textarea.placeholder = '请输入内容...';
  textEl.appendChild(textarea);
  
  // 自动撑高
  function autoResize() {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
  textarea.addEventListener('input', autoResize);
  autoResize();
  
  textarea.focus();
  
  let saved = false;
  
  async function save() {
    if (saved) return;
    const newText = textarea.value.trim();
    if (!newText) {
      saved = true;
      item.remove();
      showToast('已取消');
      return;
    }
    
    const result = await window.api.addPrompt(currentPromptGroup, newText);
    if (result.ok) {
      currentPrompts = result.prompts;
      renderPromptList();
      showToast('提示词已添加');
    } else {
      showToast(result.error || '添加失败', true);
      item.remove();
    }
  }
  
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      textarea.blur();
    } else if (e.key === 'Escape') {
      saved = true;
      item.remove();
      showToast('已取消');
    }
  });
  textarea.addEventListener('blur', save);
}

// ============ 全局右键菜单 ============
document.addEventListener('contextmenu', (e) => {
  const target = e.target;
  const inPromptItem = target.closest('.prompt-item') || target.closest('.prompt-item-edit-input');
  const inPromptList = target.closest('.prompt-list') && !target.closest('.prompt-empty');
  const isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

  // 如果在输入框/文本框中，显示完整编辑菜单（优先于选中文字判断）
  if (isEditable) {
    const appRoot = document.getElementById('app');
    if (appRoot && appRoot.contains(target)) {
      e.preventDefault();
      e.stopPropagation();
      showInputContextMenu(e.clientX, e.clientY, target);
      return;
    }
  }

  // 非输入框区域选中文字时显示复制菜单
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';

  if (selectedText && selectedText.length > 0) {
    e.preventDefault();
    showSelectionContextMenu(e.clientX, e.clientY, selectedText);
    return;
  }

  // 如果在提示词项上且没有选中文本，由 prompt-item 处理
  if (inPromptItem) return;
  // 如果在提示词列表空白处，由 promptList 处理
  if (inPromptList) return;
});

function showSelectionContextMenu(x, y, selectedText) {
  hideContextMenu();
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  
  menu.innerHTML = `
    <div class="context-menu-item" data-action="copy">
      <span class="context-menu-text">复制</span>
      <span class="context-menu-shortcut">Ctrl+C</span>
    </div>
  `;
  
  positionContextMenu(menu, x, y);
  contextMenuEl = menu;
  
  menu.querySelector('.context-menu-item').addEventListener('click', async () => {
    hideContextMenu();
    await window.api.copyToClipboard(selectedText);
    showToast('已复制到剪贴板');
  });
}

function showInputContextMenu(x, y, inputEl) {
  hideContextMenu();
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  
  menu.innerHTML = `
    <div class="context-menu-item" data-action="cut">
      <span class="context-menu-text">剪切</span>
      <span class="context-menu-shortcut">Ctrl+X</span>
    </div>
    <div class="context-menu-item" data-action="copy">
      <span class="context-menu-text">复制</span>
      <span class="context-menu-shortcut">Ctrl+C</span>
    </div>
    <div class="context-menu-item" data-action="paste">
      <span class="context-menu-text">粘贴</span>
      <span class="context-menu-shortcut">Ctrl+V</span>
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="selectAll">
      <span class="context-menu-text">全选</span>
      <span class="context-menu-shortcut">Ctrl+A</span>
    </div>
  `;
  
  positionContextMenu(menu, x, y);
  contextMenuEl = menu;
  contextMenuTarget = { type: 'input', element: inputEl };
  
  menu.querySelectorAll('.context-menu-item').forEach(mi => {
    mi.addEventListener('click', async () => {
      const action = mi.dataset.action;
      hideContextMenu();
      
      if (!document.activeElement || document.activeElement !== inputEl) {
        inputEl.focus();
      }
      
      switch (action) {
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          const text = await window.api.getClipboardText();
          if (text) {
            const start = inputEl.selectionStart ?? inputEl.value.length;
            const end = inputEl.selectionEnd ?? inputEl.value.length;
            inputEl.value = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
            inputEl.selectionStart = inputEl.selectionEnd = start + text.length;
            inputEl.dispatchEvent(new Event('input'));
          }
          break;
        case 'selectAll':
          inputEl.select();
          break;
      }
    });
  });
}

// ============ 提示词栏事件绑定 ============

// 标签栏按钮：切换侧边栏
// promptSidebarBtn 点击已改为 #toolbarActions 委托

// 主进程回调：同步侧边栏显示状态
window.api.onPromptSidebarToggled((visible) => {
  currentPromptSidebarOpen = visible;
  if (visible) promptSidebar.classList.remove('hidden');
  else promptSidebar.classList.add('hidden');
  applyToolbarState();
  updateSettingsPageRight();
});

// 分组菜单按钮
groupMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeGroupDropdown();
  if (groupMenu.style.display === 'block') {
    groupMenu.style.display = 'none';
    return;
  }
  const rect = groupMenuBtn.getBoundingClientRect();
  groupMenu.style.left = (rect.right - 140) + 'px';
  groupMenu.style.top = (rect.bottom + 4) + 'px';
  groupMenu.style.display = 'block';
});

// 自定义下拉框点击
promptGroupSelect.addEventListener('click', (e) => {
  e.stopPropagation();
  if (promptGroupDropdown.style.display === 'block') {
    closeGroupDropdown();
  } else {
    closeAllMenus();
    openGroupDropdown();
  }
});

// 点击外部关闭菜单
document.addEventListener('click', (e) => {
  if (!e.target.closest('.prompt-group-menu') && !e.target.closest('#groupMenuBtn')) {
    groupMenu.style.display = 'none';
  }
  if (!e.target.closest('.prompt-group-dropdown') && !e.target.closest('#promptGroupSelect')) {
    closeGroupDropdown();
  }
});

function closeAllMenus() {
  groupMenu.style.display = 'none';
}

// 分组菜单项点击
groupMenu.querySelectorAll('.prompt-menu-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    e.stopPropagation();
    const action = item.dataset.action;
    closeAllMenus();
    
    switch (action) {
      case 'add-group':
        await addNewGroup();
        break;
      case 'rename-group':
        if (!currentPromptGroup) {
          showToast('请先选择分组', true);
          return;
        }
        startGroupRename();
        break;
      case 'open-dir':
        window.api.openPromptDir();
        break;
      case 'delete-group':
        await deleteCurrentGroup();
        break;
    }
  });
});

// 添加新分组（重名时自动递增：新分组→新分组1→新分组2...）
async function addNewGroup() {
  let name = '新分组';
  for (let i = 0; i < 100; i++) {
    const result = await window.api.addPromptGroup(name);
    if (result.ok) {
      promptGroups = result.groups;
      currentPromptGroup = name;
      renderPromptGroupSelect();
      await loadPrompts(currentPromptGroup);
      // 进入重命名状态
      startGroupRename();
      showToast('请输入分组名称');
      return;
    }
    // 分组已存在，尝试下一个名称
    name = '新分组' + (i + 1);
  }
  showToast('创建分组失败', true);
}

// 删除当前分组
async function deleteCurrentGroup() {
  if (!currentPromptGroup) {
    showToast('请先选择分组', true);
    return;
  }
  
  if (promptGroups.length <= 1) {
    showToast('至少保留一个分组', true);
    return;
  }
  
  if (!await showConfirmDialog(groupMenuBtn, `删除分组「${currentPromptGroup}」吗？`, { sidebar: true })) return;
  
  const oldName = currentPromptGroup;
  const result = await window.api.deletePromptGroup(currentPromptGroup);
  if (result.ok) {
    promptGroups = result.groups;
    // 选择第一个可用的分组
    currentPromptGroup = promptGroups[0] || '';
    renderPromptGroupSelect();
    await loadPrompts(currentPromptGroup);
    showToast('分组已移除');
  } else {
    showToast(result.error || '删除失败', true);
  }
}

// 分组重命名（浮动输入框）
function startGroupRename() {
  if (isRenamingGroup) return;
  if (!currentPromptGroup) return;
  
  isRenamingGroup = true;
  const oldName = currentPromptGroup;
  
  closeGroupDropdown();
  
  const rect = groupSelectDisplay.getBoundingClientRect();
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'prompt-group-rename-input';
  input.value = oldName;
  input.maxLength = 30;
  input.style.position = 'fixed';
  input.style.left = rect.left + 'px';
  input.style.top = rect.top + 'px';
  input.style.width = rect.width + 'px';
  input.style.height = rect.height + 'px';
  input.style.zIndex = '10001';
  
  document.body.appendChild(input);
  // 延迟聚焦，确保 DOM 已渲染完毕
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
  
  let saved = false;
  
  async function save() {
    if (saved) return;
    // 先标记，防止重复触发
    saved = true;
    
    const newName = input.value.trim();
    
    // 清理 UI
    isRenamingGroup = false;
    if (input.parentNode) input.remove();
    document.removeEventListener('mousedown', onDocMouseDown, true);
    
    if (!newName) {
      showToast('分组名称不能为空', true);
      return;
    }
    
    if (newName === oldName) {
      return;
    }
    
    if (promptGroups.includes(newName)) {
      showToast('分组名称已存在', true);
      return;
    }
    
    try {
      const result = await window.api.renamePromptGroup(oldName, newName);
      if (result.ok) {
        promptGroups = result.groups;
        currentPromptGroup = newName;
        renderPromptGroupSelect();
        window.api.setSettings({ lastPromptGroup: newName });
        showToast('已重命名');
      } else {
        showToast(result.error || '重命名失败', true);
      }
    } catch (err) {
      console.error('重命名分组失败:', err);
      showToast('重命名失败: ' + (err.message || err), true);
    }
  }
  
  function onDocMouseDown(e) {
    // 点击在输入框外部时，保存并关闭
    if (!input.contains(e.target)) {
      save();
    }
  }
  
  // 延迟注册 document mousedown，避免创建时自身事件干扰
  setTimeout(() => {
    document.addEventListener('mousedown', onDocMouseDown, true);
  }, 0);
  
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      saved = true;
      isRenamingGroup = false;
      if (input.parentNode) input.remove();
      document.removeEventListener('mousedown', onDocMouseDown, true);
    }
  });
  input.addEventListener('blur', save);
}
