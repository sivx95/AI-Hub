const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 标签操作
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  getPresets: () => ipcRenderer.invoke('get-presets'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  selectTab: (tabId) => ipcRenderer.send('select-tab', tabId),
  addTab: (data) => ipcRenderer.invoke('add-tab', data),
  removeTab: (tabId) => ipcRenderer.invoke('remove-tab', tabId),
  renameTab: (data) => ipcRenderer.invoke('rename-tab', data),
  reorderTabs: (order) => ipcRenderer.invoke('reorder-tabs', order),
  reloadTab: () => ipcRenderer.send('reload-tab'),
  homeTab: () => ipcRenderer.send('home-tab'),
  goBackTab: () => ipcRenderer.send('go-back-tab'),
  goForwardTab: () => ipcRenderer.send('go-forward-tab'),

  // 窗口置顶
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  onAlwaysOnTopChanged: (cb) => ipcRenderer.on('always-on-top-changed', (_, onTop) => cb(onTop)),

  // 导航状态（前进/后退可用性）
  onNavStateChanged: (cb) => ipcRenderer.on('nav-state-changed', (_, state) => cb(state)),

  // 标签加载状态（转圈 + 进度条）
  onLoadingStateChanged: (cb) => ipcRenderer.on('loading-state-changed', (_, state) => cb(state)),

  // 设置/下载面板切换
  toggleSettings: () => ipcRenderer.send('toggle-settings'),
  toggleDownloadPanel: () => ipcRenderer.send('toggle-download-panel'),

  // 下载
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  markDownloadsViewed: () => ipcRenderer.invoke('mark-downloads-viewed'),
  openFileLocation: (savePath) => ipcRenderer.invoke('open-file-location', savePath),
  setDownloadDir: () => ipcRenderer.invoke('set-download-dir'),
  getDownloadDir: () => ipcRenderer.invoke('get-download-dir'),
  pauseDownload: (id) => ipcRenderer.invoke('pause-download', id),
  resumeDownload: (id) => ipcRenderer.invoke('resume-download', id),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),

  // 通用设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),

  // 缓存/登录清理
  clearAllCache: (options) => ipcRenderer.invoke('clear-all-cache', options),
  clearTabData: (data) => ipcRenderer.invoke('clear-tab-data', data),

  // 提示词存储
  getPromptGroups: () => ipcRenderer.invoke('get-prompt-groups'),
  getPrompts: (groupName) => ipcRenderer.invoke('get-prompts', groupName),
  addPromptGroup: (groupName) => ipcRenderer.invoke('add-prompt-group', groupName),
  renamePromptGroup: (oldName, newName) => ipcRenderer.invoke('rename-prompt-group', { oldName, newName }),
  deletePromptGroup: (groupName) => ipcRenderer.invoke('delete-prompt-group', groupName),
  addPrompt: (groupName, prompt) => ipcRenderer.invoke('add-prompt', { groupName, prompt }),
  deletePrompt: (groupName, index) => ipcRenderer.invoke('delete-prompt', { groupName, index }),
  editPrompt: (groupName, index, newPrompt) => ipcRenderer.invoke('edit-prompt', { groupName, index, newPrompt }),

  // 剪贴板
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  openPromptDir: () => ipcRenderer.invoke('open-prompt-dir'),

  // 提示词栏
  togglePromptSidebar: () => ipcRenderer.send('toggle-prompt-sidebar'),
  onPromptSidebarToggled: (cb) => ipcRenderer.on('prompt-sidebar-toggled', (_, visible) => cb(visible)),

  // 事件
  onTabsUpdated: (cb) => ipcRenderer.on('tabs-updated', (_, tabs) => cb(tabs)),
  onTabActivated: (cb) => ipcRenderer.on('tab-activated', (_, tabId) => cb(tabId)),
  onDownloadsUpdated: (cb) => ipcRenderer.on('downloads-updated', (_, downloads) => cb(downloads)),
  onDownloadDirUpdated: (cb) => ipcRenderer.on('download-dir-updated', (_, dir) => cb(dir)),
  onDownloadPanelClosed: (cb) => ipcRenderer.on('download-panel-closed', () => cb())
});
