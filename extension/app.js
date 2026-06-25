/* ================================================================
   TabNest — Dashboard App (Pure Extension Edition)

   This file is the brain of the dashboard. Now that the dashboard
   IS the extension page (not inside an iframe), it can call
   chrome.tabs and chrome.storage directly — no postMessage bridge needed.

   What this file does:
   1. Reads open browser tabs directly via chrome.tabs.query()
   2. Groups tabs by domain with a landing pages category
   3. Renders domain cards, banners, and stats
   4. Handles all user actions (close tabs, save for later, focus tab)
   5. Stores "Saved for Later" tabs in chrome.storage.local (no server)
   ================================================================ */

'use strict';


/* ----------------------------------------------------------------
   CHROME TABS — Direct API Access

   Since this page IS the extension's new tab page, it has full
   access to chrome.tabs and chrome.storage. No middleman needed.
   ---------------------------------------------------------------- */

// All open tabs — populated by fetchOpenTabs()
let openTabs = [];
let quickLinks = [];
let bookmarkFolders = [];
let bookmarkBoardItems = [];
let bookmarkBoardCurrentFolder = null;
let bookmarkBoardStateById = {};
let bookmarkBoardSelectionStateById = {};
let bookmarkCollections = [];
let bookmarkCollectionModalMode = 'create';
let activeBookmarkCollectionId = '';
let bookmarkFolderSearchQuery = '';
let bookmarkBoardSearchQuery = '';
let bookmarkBoardSearchQueries = {};
let isBookmarkBoardCollapsed = false;
let currentLanguage = 'zh-CN';
let currentTheme = 'light';
let customBackgroundImage = '';
let lastRealTabCount = 0;
let isSessionPanelOpen = false;
let isStashMenuOpen = false;
let isSettingsModalOpen = false;
let currentSettingsPanel = 'appearance';
let quickLinksOpenMode = 'current-tab';
let bookmarkOpenMode = 'new-tab';
let bookmarkBoardDisplayLimit = 2;
let bookmarkBoardConfig = {
  boards: [],
  folderId: '',
  folderTitle: '',
  currentFolderId: '',
  currentFolderTitle: '',
};
let currentOpenTabsView = 'domains';
let draggedWindowTabState = null;
let dashboardRefreshTimer = null;
let activeQuickLinkMenuId = '';
let pendingConfirmAction = null;
let sessionModalMode = 'create';

const LANGUAGE_STORAGE_KEY = 'uiLanguage';
const THEME_STORAGE_KEY = 'uiTheme';
const QUICK_LINKS_STORAGE_KEY = 'quickLinks';
const BACKGROUND_IMAGE_STORAGE_KEY = 'customBackgroundImage';
const BACKGROUND_COLOR_STORAGE_KEY = 'customBackgroundColor';
const TAB_SESSIONS_STORAGE_KEY = 'tabSessions';
const QUICK_LINKS_OPEN_MODE_STORAGE_KEY = 'quickLinksOpenMode';
const BOOKMARK_BOARD_CONFIG_STORAGE_KEY = 'bookmarkBoardConfig';
const BOOKMARK_OPEN_MODE_STORAGE_KEY = 'bookmarkOpenMode';
const BOOKMARK_BOARD_COLLAPSED_STORAGE_KEY = 'bookmarkBoardCollapsed';
const BOOKMARK_BOARD_DISPLAY_LIMIT_STORAGE_KEY = 'bookmarkBoardDisplayLimit';
const BOOKMARK_COLLECTIONS_STORAGE_KEY = 'bookmarkCollections';
const OPEN_TABS_VIEW_STORAGE_KEY = 'openTabsView';
const SESSIONS_VIEWED_COUNT_KEY = 'sessionsViewedCount'; // New storage key
const BOOKMARK_BOARD_MAX_ENTRIES = 4;
const DEFAULT_BOOKMARK_BOARD_DISPLAY_LIMIT = 2;
const MAX_BACKGROUND_EDGE = 2200;
const MAX_BACKGROUND_STORAGE_LENGTH = 3_500_000;
const DEFAULT_BACKGROUND_COLOR = '#f8f5f0';
const DEFAULT_DARK_BACKGROUND_COLOR = '#10161d';

const MESSAGES = {
  'zh-CN': {
    languageName: '中文',
    languageShort: '中',
    languageSwitcherLabel: '切换语言',
    greetingMorning: '早上好',
    greetingAfternoon: '下午好',
    greetingEvening: '晚上好',
    tabOutDupeBanner: count => `你打开了 <strong>${count}</strong> 个 TabNest 标签页。只保留当前这个吗？`,
    closeExtras: '关闭多余标签',
    openTabs: '打开中的标签',
    openTabsViewLabel: '切换标签视图',
    openTabsViewDomains: '域名',
    openTabsViewWindows: '窗口',
    quickLinksTitle: '常用入口',
    quickLinksSubtitle: '',
    bookmarkBoardTitle: '书签工作台',
    bookmarkBoardSubtitle: '把某个书签目录里的内容直接铺开，省去层层点开的时间。',
    bookmarkBoardMetaSelected: (folder, count) => `${folder} · ${count} 个书签`,
    bookmarkBoardMetaWithFolders: (folder, bookmarkCount, folderCount) => `${folder} · ${bookmarkCount} 个书签 · ${folderCount} 个子目录`,
    bookmarkBoardSearchPlaceholder: '搜索当前目录书签',
    bookmarkBoardEmptyTitle: '先选择一个书签目录',
    bookmarkBoardEmpty: '把近期高频使用的书签目录固定到这里，首页会直接平铺展示其中的链接和子目录。',
    bookmarkBoardEmptyAction: '选择书签目录',
    bookmarkBoardEmptyNoResults: '当前目录里没有匹配结果。',
    bookmarkBoardEmptyFolder: '这个目录下还没有书签或子目录。',
    bookmarkBoardItemOpen: '打开书签',
    bookmarkBoardFolderOpen: '进入子目录',
    bookmarkBoardBack: '返回上级',
    bookmarkBoardCollapse: '收起',
    bookmarkBoardExpand: '展开',
    bookmarkBoardDelete: '删除书签',
    bookmarkBoardDeleteConfirm: title => `要删除书签“${title}”吗？`,
    bookmarkBoardAdd: '添加目录',
    bookmarkBoardBatchSelect: '批量打开',
    bookmarkBoardBatchCancel: '退出批量打开',
    bookmarkBoardBatchOpenSelected: '打开选中',
    bookmarkBoardBatchOpenAll: '打开当前目录',
    bookmarkBoardBatchSaveCollection: '保存为资料组合',
    bookmarkBoardBatchSelectAll: '全选书签',
    bookmarkBoardBatchClear: '清空',
    bookmarkBoardBatchSelectedCount: count => `已选 ${count} 个书签`,
    bookmarkBoardBatchItemToggle: '选择加入本次打开',
    bookmarkBoardBatchHint: '勾选想打开的书签，再一次打开',
    bookmarkCollectionTitle: '资料组合',
    bookmarkCollectionSubtitle: '把这次挑好的资料沉淀下来，下次可以直接一键开启。',
    bookmarkCollectionCount: count => `${count} 个书签`,
    bookmarkCollectionOpen: '一键开启',
    bookmarkCollectionDelete: '删除资料组合',
    bookmarkCollectionEmpty: '先在书签工作台里选择几条书签，再保存为资料组合。',
    bookmarkCollectionSaveTitle: '保存资料组合',
    bookmarkCollectionCreateMode: '新建组合',
    bookmarkCollectionAppendMode: '追加到已有组合',
    bookmarkCollectionSaveNameLabel: '组合名称',
    bookmarkCollectionExistingLabel: '选择已有组合',
    bookmarkCollectionSaveNamePlaceholder: '例如 出海开发资料 / 产品灵感 / 常用工具',
    bookmarkCollectionSaveHint: count => `将保存当前选中的 ${count} 个书签，后续可直接一键开启。`,
    bookmarkCollectionSaveSubmit: '保存组合',
    bookmarkCollectionAppendSubmit: '追加',
    bookmarkCollectionExistingPlaceholder: '请选择一个资料组合',
    bookmarkCollectionDeleteConfirm: title => `要删除资料组合“${title}”吗？`,
    bookmarkCollectionViewDetail: '查看详情',
    bookmarkCollectionDetailEyebrow: '资料组合详情',
    bookmarkCollectionDetailEmpty: '这个资料组合里暂时还没有书签。',
    bookmarkCollectionDetailOpenItem: '打开这条书签',
    bookmarkCollectionDetailOpenAll: '开启整个组合',
    bookmarkBoardRemove: '移除工作台',
    bookmarkBoardRemoveConfirm: title => `要从首页移除“${title}”这个书签工作台吗？不会删除原始书签。`,
    confirmDialogEyebrow: '请确认这一步操作',
    confirmDialogCancel: '取消',
    confirmDialogConfirm: '确定',
    quickLinksAddButton: '添加入口',
    quickLinksEmptyTitle: '固定几个常用网站，打开更快。',
    quickLinksEmptySubtitle: '',
    quickLinkAddCardTitle: '新增快捷入口',
    quickLinkAddCardSubtitle: '自定义名称和网址，做成你自己的起手板。',
    quickLinkMore: '更多操作',
    quickLinkEdit: '编辑',
    quickLinkDelete: '删除',
    quickLinkModalAddTitle: '新增常用入口',
    quickLinkModalAddFromTabTitle: '加入常用入口',
    quickLinkAddFromTabLabel: '常用',
    quickLinkModalEditTitle: '编辑常用入口',
    quickLinkModalClose: '关闭弹窗',
    quickLinkNameLabel: '名称',
    quickLinkNamePlaceholder: '例如 GitHub / 飞书 / 邮箱',
    quickLinkUrlLabel: '网址',
    quickLinkUrlPlaceholder: '例如 https://github.com',
    backgroundImageUpload: '上传图片',
    backgroundImageChange: '更换图片',
    backgroundImageClear: '恢复默认',
    settingsTitle: '偏好设置',
    settingsAppearance: '外观',
    settingsLinks: '快捷入口',
    settingsBookmarks: '书签目录',
    settingsLanguageLabel: '界面语言',
    settingsBackgroundLabel: '背景设置',
    settingsBackgroundHint: '上传你自己的图片作为背景。',
    settingsImageUploadLabel: '自定义图片',
    settingsLinkOpenModeLabel: '点击快捷入口时',
    settingsLinkOpenModeHint: '选择在当前页打开，或新开一个标签页打开。',
    settingsOpenModeCurrent: '当前标签页',
    settingsOpenModeCurrentDesc: '直接替换当前新标签页。',
    settingsOpenModeNew: '新标签页',
    settingsOpenModeNewDesc: '保留当前面板，另开页面。',
    settingsBookmarkFolderLabel: '要展示的书签目录',
    settingsBookmarkFolderHint: '选一个你近期常用的书签目录，首页会直接平铺展示其中的链接。',
    settingsBookmarkFolderSearchPlaceholder: '搜索书签目录名称',
    settingsBookmarkFolderEmpty: '没有找到可用的书签目录。',
    settingsBookmarkFolderClear: '清空选择',
    settingsBookmarkFolderSelected: '当前已选',
    settingsBookmarkBoardLimitLabel: '首页最多展示的书签工作台数量',
    settingsBookmarkBoardLimitHint: '默认展示 2 个，可在 1 到 4 个之间调整；数量越多首页信息越密集。',
    settingsBookmarkBoardLimitOption: count => String(count),
    settingsBookmarkBoardLimitUnit: '个',
    settingsBookmarkBoardLimitOptionDesc: count => count === 1 ? '更克制，适合只固定一个核心目录。'
      : count === 2 ? '默认推荐，兼顾效率和清爽。'
      : count === 3 ? '适合同时推进多个主题任务。'
      : '信息最密集，适合重度使用场景。',
    bookmarkBoardVisibleCountMeta: (visible, total) => `${visible} / ${total} 个工作台`,
    settingsBookmarkOpenModeLabel: '点击书签时',
    settingsBookmarkOpenModeHint: '选择替换当前新标签页，或在新标签页中打开。',
    settingsBookmarkFolderCount: count => `${count} 个目录`,
    settingsSaved: '设置已保存',
    toastThemeUpdated: '主题已切换',
    openSettings: '打开设置',
    closeSettings: '关闭设置',
    themeLightMode: '浅色模式',
    themeDarkMode: '深色模式',
    themeSwitchToLight: '切换到浅色模式',
    themeSwitchToDark: '切换到深色模式',
    sessionToolLabel: '打开最近会话',
    stashToolLabel: '打开快速收纳',
    stashMenuTitle: '收纳',
    stashMenuHint: '选择收纳范围',
    stashCurrentWindowHint: '仅收起当前这个 Chrome 窗口里的标签。',
    stashAllWindowsHint: '按窗口分别收起，方便之后逐个恢复。',
    quickLinkCancel: '取消',
    quickLinkSave: '保存入口',
    quickLinkUpdate: '保存修改',
    quickLinkDeleteConfirm: title => `要删除“${title}”这个快捷入口吗？`,
    toastQuickLinkInvalidName: '请输入入口名称',
    toastQuickLinkAdded: '快捷入口已添加',
    toastQuickLinkUpdated: '快捷入口已更新',
    toastQuickLinkDeleted: '快捷入口已删除',
    toastQuickLinkInvalidUrl: '请输入有效的网址',
    toastBookmarkFolderSaved: '书签目录已更新',
    toastBookmarkFolderCleared: '已清空书签目录',
    toastBookmarkBoardRemoved: '书签工作台已移除',
    toastBookmarkBoardLimitReached: `最多只能添加 ${BOOKMARK_BOARD_MAX_ENTRIES} 个书签工作台`,
    toastBookmarkOpenFailed: '打开书签失败',
    toastBookmarkBatchEmpty: '请先选择要打开的书签',
    toastBookmarkBatchOpened: count => `已打开 ${count} 个书签`,
    toastBookmarkBatchOpenedWithReuse: (opened, reused) => `已打开 ${opened} 个书签，复用 ${reused} 个已打开标签`,
    toastBookmarkCollectionSaved: '资料组合已保存',
    toastBookmarkCollectionUpdated: '已补充到资料组合，并自动去重',
    toastBookmarkCollectionDeleted: '资料组合已删除',
    toastBookmarkCollectionInvalidName: '请输入资料组合名称',
    toastBookmarkCollectionSelectExisting: '请选择要补充的资料组合',
    toastBookmarkCollectionEmpty: '请先选择要保存的书签',
    toastBookmarkDeleted: '书签已删除',
    toastBookmarkDeleteFailed: '删除书签失败',
    toastBookmarksUnavailable: '当前无法读取书签',
    toastBackgroundUpdated: '背景已更新',
    toastBackgroundCleared: '已恢复默认背景',
    toastBackgroundFailed: '背景设置失败，请换一张图片试试',
    sessionsTitle: '最近会话',
    sessionsEmpty: '记录并快速恢复之前的窗口标签。',
    sessionFabLabel: '收纳',
    sessionRecent: '最近会话',
    sessionPanelClose: '关闭收纳面板',
    sessionPanelPackButton: '保存标签组',
    sessionPanelPackDisabledHint: '暂无会话可打包',
    stashCurrentWindow: '当前窗口',
    stashAllWindows: '全部窗口',
    sessionSourceCurrentWindow: '当前窗口',
    sessionSourceAllWindows: '全部窗口',
    sessionSourceWindowSession: '窗口会话',
    sessionRestoreAll: '恢复全部',
    sessionRestoreTab: '恢复',
    sessionRename: '重命名',
    sessionPin: '固定保存',
    sessionUnpin: '取消固定',
    sessionPinnedBadge: '固定会话',
    sessionTemporaryBadge: '临时会话',
    sessionTabGroupBadge: '标签组',
    sessionTabGroupDefaultName: baseName => `标签组 · ${baseName}`,
    sessionModalCreateTitle: '保存工作会话',
    sessionModalEditTitle: '编辑工作会话',
    sessionNameLabel: '会话名称',
    sessionNamePlaceholder: '例如 出海资料 / 支付排查 / 招聘准备',
    sessionPinnedLabel: '固定保存',
    sessionPinnedHint: '固定后恢复不会消失，更适合长期复用的工作会话。',
    sessionSave: '保存会话',
    sessionUpdate: '更新会话',
    sessionDelete: '删除会话',
    sessionTabsCount: count => `${count} 个标签`,
    sessionWindowsCount: count => `${count} 个窗口`,
    sessionMoreTabs: count => `还有 ${count} 个标签`,
    sessionDeleteConfirm: title => `要删除“${title}”这个会话吗？`,
    toastSessionSaved: count => `已收纳 ${count} 个标签`,
    toastSessionRestored: count => `已恢复 ${count} 个标签`,
    toastSessionRestoredWithSkipped: (count, skipped) => `已恢复 ${count} 个标签，跳过 ${skipped} 个本地/内部标签`,
    toastSessionDeleted: '会话已删除',
    toastSessionUpdated: '工作会话已更新',
    toastSessionPinned: '已固定工作会话',
    toastSessionUnpinned: '已取消固定工作会话',
    toastSessionTabGroupPacked: (tabs, sessions) => `已把 ${sessions} 个会话打包为标签组，共 ${tabs} 个标签`,

    toastSessionTabGroupEmpty: '没有可打包的标签',
    toastSessionInvalidName: '请输入工作会话名称',
    toastSessionNothingToSave: '没有可收纳的标签',
    toastSessionSaveFailed: '收纳会话失败',
    toastSessionRestoreFailed: '恢复会话失败',
    savedForLater: '稍后保存',
    nothingSaved: '还没有保存内容。活在当下。',
    archive: '归档',
    archiveSearchPlaceholder: '搜索已归档的标签...',
    statOpenTabs: '打开标签',
    footerCreditEyebrow: '原作者',
    footerCreditMain: '原项目由 Zara Zhang 创作并开源',
    footerProjectLink: '原项目',
    footerAuthorLink: 'GitHub',
    inboxZeroTitle: '标签清零了。',
    inboxZeroSubtitle: '现在轻松多了。',
    domainsCount: count => `${count} 个域名`,
    windowsCount: count => `${count} 个窗口`,
    itemsCount: count => `${count} 项`,
    tabsOpenBadge: count => `${count} 个标签`,
    duplicateBadge: count => `${count} 个重复`,
    closeAllTabsAction: count => `关闭全部 ${count} 个标签`,
    closeDuplicatesAction: count => `关闭 ${count} 个重复项`,
    homepages: '主页',
    tabsLabel: '标签',
    moreTabs: count => `还有 ${count} 个`,
    justNow: '刚刚',
    minutesAgo: count => `${count} 分钟前`,
    hoursAgo: count => `${count} 小时前`,
    yesterday: '昨天',
    daysAgo: count => `${count} 天前`,
    saveForLaterTitle: '稍后保存',
    closeThisTabTitle: '关闭此标签',
    dismissTitle: '移除',
    noResults: '没有结果',
    toastClosedExtraTabOutTabs: '已关闭多余的 TabNest 标签页',
    toastTabClosed: '标签已关闭',
    toastTabReordered: '标签顺序已更新',
    toastTabReorderFailed: '调整标签顺序失败',
    toastTabReorderSameWindowOnly: '当前先支持同一窗口内拖拽排序',
    toastSaveFailed: '保存失败',
    toastSavedForLater: '已保存到稍后处理',
    toastClosedGroupTabs: (count, groupLabel) => `已从 ${groupLabel} 关闭 ${count} 个标签`,
    toastClosedDuplicates: '已关闭重复标签，并保留一份',
    toastClosedAllTabs: '所有标签已关闭，重新开始吧。',
    postByUser: username => `@${username} 的帖子`,
    githubIssue: (owner, repo, number) => `${owner}/${repo} Issue #${number}`,
    githubPr: (owner, repo, number) => `${owner}/${repo} PR #${number}`,
    githubPath: (owner, repo, path) => `${owner}/${repo} - ${path}`,
    youtubeVideo: 'YouTube 视频',
    redditPost: subreddit => `r/${subreddit} 帖子`,
    substackBy: name => `${capitalize(name)} 的 Substack`,
    githubPages: name => `${capitalize(name)}（GitHub Pages）`,
    localFiles: '本地文件',
    currentWindowTitle: '当前窗口',
    windowTitle: index => `窗口 ${index}`,
    windowPosition: index => `第 ${index} 个`,
    windowViewHint: '按浏览器真实顺序排列，可直接拖拽调整',
    activeTabBadge: '当前',
    pinnedTabBadge: '固定',
  },
  'en-US': {
    languageName: 'English',
    languageShort: 'EN',
    languageSwitcherLabel: 'Switch language',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    tabOutDupeBanner: count => `You have <strong>${count}</strong> TabNest tabs open. Keep just this one?`,
    closeExtras: 'Close extras',
    openTabs: 'Open tabs',
    openTabsViewLabel: 'Switch tab view',
    openTabsViewDomains: 'Domains',
    openTabsViewWindows: 'Windows',
    bookmarkBoardTitle: 'Bookmark board',
    bookmarkBoardSubtitle: 'Flatten one bookmark folder onto your new tab page for faster access.',
    bookmarkBoardMetaSelected: (folder, count) => `${folder} · ${count} bookmarks`,
    bookmarkBoardMetaWithFolders: (folder, bookmarkCount, folderCount) => `${folder} · ${bookmarkCount} bookmarks · ${folderCount} folders`,
    bookmarkBoardSearchPlaceholder: 'Search bookmarks in this folder',
    bookmarkBoardEmptyTitle: 'Choose a bookmark folder first',
    bookmarkBoardEmpty: 'Pin a high-frequency bookmark folder here and this page will flatten its links and subfolders for faster access.',
    bookmarkBoardEmptyAction: 'Choose folder',
    bookmarkBoardEmptyNoResults: 'No items match this search.',
    bookmarkBoardEmptyFolder: 'This folder does not contain bookmarks or subfolders yet.',
    bookmarkBoardItemOpen: 'Open bookmark',
    bookmarkBoardFolderOpen: 'Open folder',
    bookmarkBoardBack: 'Back',
    bookmarkBoardCollapse: 'Collapse',
    bookmarkBoardExpand: 'Expand',
    bookmarkBoardDelete: 'Delete bookmark',
    bookmarkBoardDeleteConfirm: title => `Delete bookmark "${title}"?`,
    bookmarkBoardAdd: 'Add folder',
    bookmarkBoardBatchSelect: 'Open multiple',
    bookmarkBoardBatchCancel: 'Exit multi-open',
    bookmarkBoardBatchOpenSelected: 'Open selected',
    bookmarkBoardBatchOpenAll: 'Open folder',
    bookmarkBoardBatchSaveCollection: 'Save as bundle',
    bookmarkBoardBatchSelectAll: 'Select all bookmarks',
    bookmarkBoardBatchClear: 'Clear',
    bookmarkBoardBatchSelectedCount: count => `${count} bookmarks selected`,
    bookmarkBoardBatchItemToggle: 'Add to multi-open',
    bookmarkBoardBatchHint: 'Pick the bookmarks you want, then open them together',
    bookmarkCollectionTitle: 'Resource bundles',
    bookmarkCollectionSubtitle: 'Save this picked set so you can launch it again with one click.',
    bookmarkCollectionCount: count => `${count} bookmark${count !== 1 ? 's' : ''}`,
    bookmarkCollectionOpen: 'Launch',
    bookmarkCollectionDelete: 'Delete bundle',
    bookmarkCollectionEmpty: 'Select a few bookmarks in the board first, then save them as a reusable bundle.',
    bookmarkCollectionSaveTitle: 'Save resource bundle',
    bookmarkCollectionCreateMode: 'Create new',
    bookmarkCollectionAppendMode: 'Add to existing',
    bookmarkCollectionSaveNameLabel: 'Bundle name',
    bookmarkCollectionExistingLabel: 'Choose a bundle',
    bookmarkCollectionSaveNamePlaceholder: 'For example Indie hacking / Product research / Tool stack',
    bookmarkCollectionSaveHint: count => `Save the ${count} selected bookmarks so you can launch them again later.`,
    bookmarkCollectionSaveSubmit: 'Save bundle',
    bookmarkCollectionAppendSubmit: 'Add',
    bookmarkCollectionExistingPlaceholder: 'Select a resource bundle',
    bookmarkCollectionDeleteConfirm: title => `Delete the bundle "${title}"?`,
    bookmarkCollectionViewDetail: 'View details',
    bookmarkCollectionDetailEyebrow: 'Bundle details',
    bookmarkCollectionDetailEmpty: 'This bundle does not contain bookmarks yet.',
    bookmarkCollectionDetailOpenItem: 'Open this bookmark',
    bookmarkCollectionDetailOpenAll: 'Launch bundle',
    bookmarkBoardRemove: 'Remove board',
    bookmarkBoardRemoveConfirm: title => `Remove "${title}" from the homepage? This will not delete the original bookmarks.`,
    confirmDialogEyebrow: 'Please confirm this action',
    confirmDialogCancel: 'Cancel',
    confirmDialogConfirm: 'Confirm',
    quickLinksTitle: 'Quick links',
    quickLinksSubtitle: '',
    quickLinksAddButton: 'Add link',
    quickLinksEmptyTitle: 'Pin a few favorites to get started.',
    quickLinksEmptySubtitle: '',
    quickLinkAddCardTitle: 'Add a shortcut',
    quickLinkAddCardSubtitle: 'Name it, paste the URL, and make this page your own.',
    quickLinkMore: 'More actions',
    quickLinkEdit: 'Edit',
    quickLinkDelete: 'Delete',
    quickLinkModalAddTitle: 'Add quick link',
    quickLinkModalAddFromTabTitle: 'Add open tab as quick link',
    quickLinkAddFromTabLabel: 'Add',
    quickLinkModalEditTitle: 'Edit quick link',
    quickLinkModalClose: 'Close dialog',
    quickLinkNameLabel: 'Name',
    quickLinkNamePlaceholder: 'For example GitHub / Slack / Mail',
    quickLinkUrlLabel: 'URL',
    quickLinkUrlPlaceholder: 'For example https://github.com',
    backgroundImageUpload: 'Upload image',
    backgroundImageChange: 'Change image',
    backgroundImageClear: 'Reset default',
    settingsTitle: 'Settings',
    settingsAppearance: 'Appearance',
    settingsLinks: 'Quick Links',
    settingsBookmarks: 'Bookmarks',
    settingsLanguageLabel: 'Interface language',
    settingsBackgroundLabel: 'Background',
    settingsBackgroundHint: 'Upload your own image as the background.',
    settingsImageUploadLabel: 'Custom image',
    settingsLinkOpenModeLabel: 'When clicking a quick link',
    settingsLinkOpenModeHint: 'Open it here, or open it in a new tab.',
    settingsOpenModeCurrent: 'Current tab',
    settingsOpenModeCurrentDesc: 'Replace this new tab directly.',
    settingsOpenModeNew: 'New tab',
    settingsOpenModeNewDesc: 'Keep this dashboard and open another tab.',
    settingsBookmarkFolderLabel: 'Bookmark folder to show',
    settingsBookmarkFolderHint: 'Choose a folder you use often and flatten it right onto the homepage.',
    settingsBookmarkFolderSearchPlaceholder: 'Search bookmark folders',
    settingsBookmarkFolderEmpty: 'No bookmark folders found.',
    settingsBookmarkFolderClear: 'Clear selection',
    settingsBookmarkFolderSelected: 'Selected',
    settingsBookmarkBoardLimitLabel: 'Maximum bookmark boards on the homepage',
    settingsBookmarkBoardLimitHint: 'Show 2 by default. You can adjust it from 1 to 4; more boards make the page denser.',
    settingsBookmarkBoardLimitOption: count => String(count),
    settingsBookmarkBoardLimitUnit: 'boards',
    settingsBookmarkBoardLimitOptionDesc: count => count === 1 ? 'More focused, great for one primary folder.'
      : count === 2 ? 'Recommended default for balance and clarity.'
      : count === 3 ? 'Useful when several themes are active at once.'
      : 'Densest layout, best for heavy usage.',
    bookmarkBoardVisibleCountMeta: (visible, total) => `${visible} / ${total} boards`,
    settingsBookmarkOpenModeLabel: 'When clicking a bookmark',
    settingsBookmarkOpenModeHint: 'Open it here, or open it in a new tab.',
    settingsBookmarkFolderCount: count => `${count} folders`,
    settingsSaved: 'Settings saved',
    toastThemeUpdated: 'Theme updated',
    openSettings: 'Open settings',
    closeSettings: 'Close settings',
    themeLightMode: 'Light mode',
    themeDarkMode: 'Dark mode',
    themeSwitchToLight: 'Switch to light mode',
    themeSwitchToDark: 'Switch to dark mode',
    sessionToolLabel: 'Open recent sessions',
    stashToolLabel: 'Open quick stash',
    stashMenuTitle: 'Stash',
    stashMenuHint: 'Choose a scope',
    stashCurrentWindowHint: 'Stash only the tabs from this Chrome window.',
    stashAllWindowsHint: 'Stash each window separately so you can restore them one by one.',
    quickLinkCancel: 'Cancel',
    quickLinkSave: 'Save link',
    quickLinkUpdate: 'Save changes',
    quickLinkDeleteConfirm: title => `Delete the quick link "${title}"?`,
    toastQuickLinkInvalidName: 'Enter a name for the link',
    toastQuickLinkAdded: 'Quick link added',
    toastQuickLinkUpdated: 'Quick link updated',
    toastQuickLinkDeleted: 'Quick link deleted',
    toastQuickLinkInvalidUrl: 'Enter a valid URL',
    toastBookmarkFolderSaved: 'Bookmark folder updated',
    toastBookmarkFolderCleared: 'Bookmark folder cleared',
    toastBookmarkBoardRemoved: 'Bookmark board removed',
    toastBookmarkBoardLimitReached: `You can add up to ${BOOKMARK_BOARD_MAX_ENTRIES} bookmark boards`,
    toastBookmarkOpenFailed: 'Could not open bookmark',
    toastBookmarkBatchEmpty: 'Choose bookmarks to open first',
    toastBookmarkBatchOpened: count => `Opened ${count} bookmarks`,
    toastBookmarkBatchOpenedWithReuse: (opened, reused) => `Opened ${opened} bookmarks and reused ${reused} existing tabs`,
    toastBookmarkCollectionSaved: 'Bundle saved',
    toastBookmarkCollectionUpdated: 'Bundle updated and deduped',
    toastBookmarkCollectionDeleted: 'Bundle deleted',
    toastBookmarkCollectionInvalidName: 'Enter a bundle name',
    toastBookmarkCollectionSelectExisting: 'Choose a bundle first',
    toastBookmarkCollectionEmpty: 'Choose bookmarks to save first',
    toastBookmarkDeleted: 'Bookmark deleted',
    toastBookmarkDeleteFailed: 'Could not delete bookmark',
    toastBookmarksUnavailable: 'Bookmarks are unavailable right now',
    toastBackgroundUpdated: 'Background updated',
    toastBackgroundCleared: 'Background reset',
    toastBackgroundFailed: 'Failed to update background',
    sessionsTitle: 'Sessions',
    sessionsEmpty: 'Stash the current window or all windows into a session, then restore the whole set later.',
    sessionFabLabel: 'Stash',
    sessionRecent: 'Recent sessions',
    sessionPanelClose: 'Close stash panel',
    sessionPanelPackButton: 'Save as tab group',
    sessionPanelPackDisabledHint: 'No sessions available to pack',
    stashCurrentWindow: 'Current window',
    stashAllWindows: 'All windows',
    sessionSourceCurrentWindow: 'Current window',
    sessionSourceAllWindows: 'All windows',
    sessionSourceWindowSession: 'Window session',
    sessionRestoreAll: 'Restore all',
    sessionRestoreTab: 'Open',
    sessionRename: 'Rename',
    sessionPin: 'Pin',
    sessionUnpin: 'Unpin',
    sessionPinnedBadge: 'Pinned',
    sessionTemporaryBadge: 'Temporary',
    sessionTabGroupBadge: 'Tab group',
    sessionTabGroupDefaultName: baseName => `Tab group · ${baseName}`,
    sessionModalCreateTitle: 'Save work session',
    sessionModalEditTitle: 'Edit work session',
    sessionNameLabel: 'Session name',
    sessionNamePlaceholder: 'For example Indie research / Payment debug / Hiring prep',
    sessionPinnedLabel: 'Keep pinned',
    sessionPinnedHint: 'Pinned sessions stay after restore and work better as reusable workspaces.',
    sessionSave: 'Save session',
    sessionUpdate: 'Update session',
    sessionDelete: 'Delete session',
    sessionTabsCount: count => `${count} tab${count !== 1 ? 's' : ''}`,
    sessionWindowsCount: count => `${count} window${count !== 1 ? 's' : ''}`,
    sessionMoreTabs: count => `${count} more tab${count !== 1 ? 's' : ''}`,
    sessionDeleteConfirm: title => `Delete the session "${title}"?`,
    toastSessionSaved: count => `Stashed ${count} tab${count !== 1 ? 's' : ''}`,
    toastSessionRestored: count => `Restored ${count} tab${count !== 1 ? 's' : ''}`,
    toastSessionRestoredWithSkipped: (count, skipped) => `Restored ${count} tab${count !== 1 ? 's' : ''}, skipped ${skipped} local/internal tab${skipped !== 1 ? 's' : ''}`,
    toastSessionDeleted: 'Session deleted',
    toastSessionUpdated: 'Work session updated',
    toastSessionPinned: 'Session pinned',
    toastSessionUnpinned: 'Session unpinned',
    toastSessionTabGroupPacked: (tabs, sessions) => `Packed ${sessions} sessions into a tab group with ${tabs} tab${tabs !== 1 ? 's' : ''}`,

    toastSessionTabGroupEmpty: 'No packable tabs left',
    toastSessionInvalidName: 'Enter a session name',
    toastSessionNothingToSave: 'No tabs to stash',
    toastSessionSaveFailed: 'Failed to stash tabs',
    toastSessionRestoreFailed: 'Failed to restore session',
    savedForLater: 'Saved for later',
    nothingSaved: 'Nothing saved. Living in the moment.',
    archive: 'Archive',
    archiveSearchPlaceholder: 'Search archived tabs...',
    statOpenTabs: 'Open tabs',
    footerCreditEyebrow: 'Original Creator',
    footerCreditMain: 'The original project was created and open-sourced by Zara Zhang',
    footerProjectLink: 'Original project',
    footerAuthorLink: 'GitHub',
    inboxZeroTitle: 'Inbox zero, but for tabs.',
    inboxZeroSubtitle: "You're free.",
    domainsCount: count => `${count} domain${count !== 1 ? 's' : ''}`,
    windowsCount: count => `${count} window${count !== 1 ? 's' : ''}`,
    itemsCount: count => `${count} item${count !== 1 ? 's' : ''}`,
    tabsOpenBadge: count => `${count} tab${count !== 1 ? 's' : ''} open`,
    duplicateBadge: count => `${count} duplicate${count !== 1 ? 's' : ''}`,
    closeAllTabsAction: count => `Close all ${count} tab${count !== 1 ? 's' : ''}`,
    closeDuplicatesAction: count => `Close ${count} duplicate${count !== 1 ? 's' : ''}`,
    homepages: 'Homepages',
    tabsLabel: 'tabs',
    moreTabs: count => `+${count} more`,
    justNow: 'just now',
    minutesAgo: count => `${count} min ago`,
    hoursAgo: count => `${count} hr${count !== 1 ? 's' : ''} ago`,
    yesterday: 'yesterday',
    daysAgo: count => `${count} days ago`,
    saveForLaterTitle: 'Save for later',
    closeThisTabTitle: 'Close this tab',
    dismissTitle: 'Dismiss',
    noResults: 'No results',
    toastClosedExtraTabOutTabs: 'Closed extra TabNest tabs',
    toastTabClosed: 'Tab closed',
    toastTabReordered: 'Tab order updated',
    toastTabReorderFailed: 'Failed to reorder tab',
    toastTabReorderSameWindowOnly: 'For now, drag sorting only works inside the same window',
    toastSaveFailed: 'Failed to save tab',
    toastSavedForLater: 'Saved for later',
    toastClosedGroupTabs: (count, groupLabel) => `Closed ${count} tab${count !== 1 ? 's' : ''} from ${groupLabel}`,
    toastClosedDuplicates: 'Closed duplicates, kept one copy each',
    toastClosedAllTabs: 'All tabs closed. Fresh start.',
    postByUser: username => `Post by @${username}`,
    githubIssue: (owner, repo, number) => `${owner}/${repo} Issue #${number}`,
    githubPr: (owner, repo, number) => `${owner}/${repo} PR #${number}`,
    githubPath: (owner, repo, path) => `${owner}/${repo} - ${path}`,
    youtubeVideo: 'YouTube Video',
    redditPost: subreddit => `r/${subreddit} post`,
    substackBy: name => `${capitalize(name)}'s Substack`,
    githubPages: name => `${capitalize(name)} (GitHub Pages)`,
    localFiles: 'Local Files',
    currentWindowTitle: 'Current window',
    windowTitle: index => `Window ${index}`,
    windowPosition: index => `#${index}`,
    windowViewHint: 'Shown in real browser order. Drag to rearrange.',
    activeTabBadge: 'Active',
    pinnedTabBadge: 'Pinned',
  },
};

function getMessages() {
  return MESSAGES[currentLanguage] || MESSAGES['en-US'];
}

function t(key, ...args) {
  const localized = getMessages()[key];
  if (typeof localized === 'function') return localized(...args);
  if (localized !== undefined) return localized;

  const fallback = MESSAGES['en-US'][key];
  return typeof fallback === 'function' ? fallback(...args) : fallback || '';
}

async function loadLanguagePreference() {
  try {
    const { [LANGUAGE_STORAGE_KEY]: storedLanguage } = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && MESSAGES[storedLanguage]) {
      currentLanguage = storedLanguage;
    } else {
      // Auto-detect based on browser language for first-time users
      const uiLang = (chrome.i18n.getUILanguage() || navigator.language || 'en').toLowerCase();
      currentLanguage = uiLang.startsWith('zh') ? 'zh-CN' : 'en-US';
    }
  } catch {
    currentLanguage = 'zh-CN';
  }
}

async function setLanguagePreference(language) {
  if (!MESSAGES[language] || language === currentLanguage) return;
  currentLanguage = language;
  try {
    await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
  } catch {
    // Ignore storage failures and keep the in-memory language.
  }
}

function syncLanguageSwitcher() {
  const switcher = document.getElementById('settingsLanguageSwitcher');
  if (switcher) switcher.setAttribute('aria-label', t('languageSwitcherLabel'));

  document.querySelectorAll('.settings-language-option').forEach(button => {
    const { language } = button.dataset;
    const isActive = language === currentLanguage;
    button.textContent = MESSAGES[language]?.languageShort || language;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.title = MESSAGES[language]?.languageName || language;
  });
}

function getDefaultBackgroundColor() {
  return currentTheme === 'dark' ? DEFAULT_DARK_BACKGROUND_COLOR : DEFAULT_BACKGROUND_COLOR;
}

function normalizeHexColor(color) {
  const value = String(color || '').trim();
  if (!/^#([\da-f]{3}|[\da-f]{6})$/i.test(value)) return '';
  if (value.length === 7) return value.toLowerCase();
  return `#${value.slice(1).split('').map(char => `${char}${char}`).join('').toLowerCase()}`;
}

function hexToRgb(color) {
  const normalized = normalizeHexColor(color);
  if (!normalized) return null;

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToRgbaString(color, alpha = 1) {
  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  const nextAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${nextAlpha})`;
}

function mixHexColors(baseColor, targetColor, weight = 0.5) {
  const base = hexToRgb(baseColor);
  const target = hexToRgb(targetColor);
  if (!base || !target) return normalizeHexColor(baseColor) || baseColor;

  const ratio = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: base.r + (target.r - base.r) * ratio,
    g: base.g + (target.g - base.g) * ratio,
    b: base.b + (target.b - base.b) * ratio,
  });
}

function getEffectiveBackgroundColor() {
  return getDefaultBackgroundColor();
}

function updateSolidSurfacePalette() {
  const effectiveBackground = getEffectiveBackgroundColor();
  const normalizedBackground = normalizeHexColor(effectiveBackground);
  if (!normalizedBackground) return;

  const isDark = currentTheme === 'dark';
  const surfaceColor = isDark
    ? mixHexColors(normalizedBackground, '#151c24', 0.58)
    : mixHexColors(normalizedBackground, '#ffffff', 0.86);
  const elevatedColor = isDark
    ? mixHexColors(normalizedBackground, '#1c2530', 0.7)
    : mixHexColors(normalizedBackground, '#ffffff', 0.92);
  const borderColor = isDark
    ? mixHexColors(normalizedBackground, '#4d5b69', 0.34)
    : mixHexColors(normalizedBackground, '#d7dee7', 0.62);
  const subtleLineColor = isDark
    ? mixHexColors(normalizedBackground, '#5b6978', 0.26)
    : mixHexColors(normalizedBackground, '#cfd9e6', 0.52);
  const shadowColor = isDark
    ? 'rgba(0, 0, 0, 0.26)'
    : rgbToRgbaString(mixHexColors(normalizedBackground, '#6f8fb2', 0.45), 0.12);

  document.body.style.setProperty('--solid-surface-bg', surfaceColor);
  document.body.style.setProperty('--solid-surface-elevated-bg', elevatedColor);
  document.body.style.setProperty('--solid-surface-border', borderColor);
  document.body.style.setProperty('--solid-surface-line', subtleLineColor);
  document.body.style.setProperty('--solid-surface-shadow', shadowColor);
}

function syncThemeToggleControl() {
  const themeTrigger = document.getElementById('themeToggleBtn');
  const themeState = document.getElementById('themeToggleState');
  if (!themeTrigger) return;

  const isDark = currentTheme === 'dark';
  const label = isDark ? t('themeSwitchToLight') : t('themeSwitchToDark');

  themeTrigger.classList.toggle('is-dark', isDark);
  themeTrigger.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  themeTrigger.setAttribute('aria-label', label);
  themeTrigger.setAttribute('data-tooltip', label);
  themeTrigger.title = ''; // Clear native tooltip to avoid overlap

  if (themeState) themeState.textContent = isDark ? t('themeDarkMode') : t('themeLightMode');
}

function applyThemePreference(theme) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('theme-dark', currentTheme === 'dark');
  document.body.classList.toggle('theme-light', currentTheme !== 'dark');
  applyBackgroundSelection({
    imageDataUrl: customBackgroundImage,
  });
  syncThemeToggleControl();
}

async function loadThemePreference() {
  try {
    const { [THEME_STORAGE_KEY]: storedTheme = 'light' } = await chrome.storage.local.get(THEME_STORAGE_KEY);
    applyThemePreference(storedTheme);
  } catch {
    applyThemePreference('light');
  }
}

async function setThemePreference(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  await chrome.storage.local.set({ [THEME_STORAGE_KEY]: nextTheme });
  applyThemePreference(nextTheme);
}

function syncBackgroundControls() {
  const triggerBtn = document.getElementById('backgroundImageTriggerBtn');
  const clearBtn = document.getElementById('backgroundImageClearBtn');
  const imageBlock = document.getElementById('settingsImageUploadBlock');
  const triggerLabel = customBackgroundImage ? t('backgroundImageChange') : t('backgroundImageUpload');

  if (triggerBtn) {
    triggerBtn.textContent = triggerLabel;
    triggerBtn.title = triggerLabel;
    triggerBtn.setAttribute('aria-label', triggerLabel);
    triggerBtn.classList.toggle('is-active', !!customBackgroundImage);
  }

  if (clearBtn) {
    clearBtn.textContent = t('backgroundImageClear');
    clearBtn.title = t('backgroundImageClear');
    clearBtn.setAttribute('aria-label', t('backgroundImageClear'));
    clearBtn.hidden = !customBackgroundImage;
  }

  if (imageBlock) imageBlock.classList.toggle('is-active', !!customBackgroundImage);
}

function setStashMenuOpen(nextOpen) {
  isStashMenuOpen = !!nextOpen;

  const trigger = document.getElementById('stashMenuTrigger');
  const menu = document.getElementById('stashMenu');

  if (isStashMenuOpen) {
    setSettingsModalOpen(false);
    setSessionPanelOpen(false);
  }

  if (trigger) trigger.setAttribute('aria-expanded', isStashMenuOpen ? 'true' : 'false');
  if (trigger) trigger.classList.toggle('is-active', isStashMenuOpen);
  if (menu) menu.style.display = isStashMenuOpen ? 'block' : 'none';
}

function setSessionPanelOpen(nextOpen) {
  isSessionPanelOpen = !!nextOpen;

  const trigger = document.getElementById('sessionFabTrigger');
  const panel = document.getElementById('sessionPanel');

  if (isSessionPanelOpen) {
    setSettingsModalOpen(false);
    setStashMenuOpen(false);
  }
  if (trigger) trigger.setAttribute('aria-expanded', isSessionPanelOpen ? 'true' : 'false');
  if (trigger) trigger.classList.toggle('is-active', isSessionPanelOpen);
  if (panel) panel.style.display = isSessionPanelOpen ? 'flex' : 'none';
}

async function markSessionsViewed() {
  try {
    const sessions = await getTabSessions();
    await chrome.storage.local.set({ [SESSIONS_VIEWED_COUNT_KEY]: sessions.length });
    // Re-render UI to hide/update badge
    await renderSessionsFloatingPanel();
  } catch (err) {
    // Ignore storage errors
  }
}

function setCurrentSettingsPanel(panel) {
  currentSettingsPanel = ['appearance', 'links', 'bookmarks'].includes(panel) ? panel : 'appearance';

  document.querySelectorAll('.settings-nav-item').forEach(button => {
    const isActive = button.dataset.settingsPanel === currentSettingsPanel;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  document.querySelectorAll('.settings-panel').forEach(panelEl => {
    panelEl.style.display = panelEl.dataset.settingsPanel === currentSettingsPanel ? 'flex' : 'none';
  });
}

function setSettingsModalOpen(nextOpen) {
  isSettingsModalOpen = !!nextOpen;

  const backdrop = document.getElementById('settingsModalBackdrop');
  const trigger = document.getElementById('settingsModalTrigger');
  if (backdrop) backdrop.style.display = isSettingsModalOpen ? 'flex' : 'none';
  if (trigger) {
    trigger.classList.toggle('is-active', isSettingsModalOpen);
    trigger.setAttribute('aria-expanded', isSettingsModalOpen ? 'true' : 'false');
    trigger.setAttribute('aria-label', isSettingsModalOpen ? t('closeSettings') : t('openSettings'));
    trigger.title = isSettingsModalOpen ? t('closeSettings') : t('openSettings');
  }

  if (isSettingsModalOpen) {
    setStashMenuOpen(false);
    setSessionPanelOpen(false);
    setCurrentSettingsPanel(currentSettingsPanel);
  }
}

function openBookmarkFolderSettings() {
  currentSettingsPanel = 'bookmarks';
  setSettingsModalOpen(true);
  setCurrentSettingsPanel('bookmarks');
  window.setTimeout(() => {
    document.getElementById('bookmarkFolderSearchInput')?.focus();
  }, 0);
}

async function loadQuickLinksOpenModePreference() {
  try {
    const { [QUICK_LINKS_OPEN_MODE_STORAGE_KEY]: storedMode = 'current-tab' } = await chrome.storage.local.get(QUICK_LINKS_OPEN_MODE_STORAGE_KEY);
    quickLinksOpenMode = storedMode === 'new-tab' ? 'new-tab' : 'current-tab';
  } catch {
    quickLinksOpenMode = 'current-tab';
  }
}

async function setQuickLinksOpenModePreference(mode) {
  quickLinksOpenMode = mode === 'new-tab' ? 'new-tab' : 'current-tab';
  await chrome.storage.local.set({ [QUICK_LINKS_OPEN_MODE_STORAGE_KEY]: quickLinksOpenMode });
}

function normalizeBookmarkBoardConfig(config = {}) {
  const folderId = String(config.folderId || '').trim();
  const folderTitle = String(config.folderTitle || '').trim();
  const legacyBoard = folderId
    ? [{
      id: folderId,
      folderId,
      folderTitle,
      currentFolderId: String(config.currentFolderId || folderId).trim(),
      currentFolderTitle: String(config.currentFolderTitle || folderTitle).trim(),
      collapsed: false,
    }]
    : [];
  const sourceBoards = Array.isArray(config.boards) && config.boards.length > 0 ? config.boards : legacyBoard;
  const seen = new Set();
  const boards = sourceBoards
    .map((board, index) => normalizeBookmarkBoardConfigEntry(board, index))
    .filter(board => {
      if (!board.folderId || seen.has(board.folderId)) return false;
      seen.add(board.folderId);
      return true;
    });
  const primary = boards[0] || {};
  return {
    boards,
    folderId: primary.folderId || folderId,
    folderTitle: primary.folderTitle || folderTitle,
    currentFolderId: primary.currentFolderId || String(config.currentFolderId || primary.folderId || folderId).trim(),
    currentFolderTitle: primary.currentFolderTitle || String(config.currentFolderTitle || primary.folderTitle || folderTitle).trim(),
  };
}

function normalizeBookmarkBoardConfigEntry(board = {}, index = 0) {
  const folderId = String(board.folderId || board.id || '').trim();
  const folderTitle = String(board.folderTitle || board.title || '').trim();
  const currentFolderId = String(board.currentFolderId || folderId).trim();
  const currentFolderTitle = String(board.currentFolderTitle || folderTitle).trim();
  return {
    id: String(board.id || folderId || `bookmark-board-${index}`).trim(),
    folderId,
    folderTitle,
    currentFolderId,
    currentFolderTitle,
    collapsed: board.collapsed === true,
  };
}

function getBookmarkBoardEntries() {
  return Array.isArray(bookmarkBoardConfig.boards) ? bookmarkBoardConfig.boards : [];
}

async function loadBookmarkBoardConfigPreference() {
  try {
    const { [BOOKMARK_BOARD_CONFIG_STORAGE_KEY]: storedConfig = {} } = await chrome.storage.local.get(BOOKMARK_BOARD_CONFIG_STORAGE_KEY);
    bookmarkBoardConfig = normalizeBookmarkBoardConfig(storedConfig);
    syncLegacyBookmarkBoardFields();
  } catch {
    bookmarkBoardConfig = normalizeBookmarkBoardConfig();
    syncLegacyBookmarkBoardFields();
  }
}

async function saveBookmarkBoardConfigPreference(config) {
  bookmarkBoardConfig = normalizeBookmarkBoardConfig(config);
  syncLegacyBookmarkBoardFields();
  await chrome.storage.local.set({ [BOOKMARK_BOARD_CONFIG_STORAGE_KEY]: bookmarkBoardConfig });
}

async function clearBookmarkBoardConfigPreference() {
  bookmarkBoardConfig = normalizeBookmarkBoardConfig();
  syncLegacyBookmarkBoardFields();
  await chrome.storage.local.remove(BOOKMARK_BOARD_CONFIG_STORAGE_KEY);
}

async function loadBookmarkOpenModePreference() {
  try {
    const { [BOOKMARK_OPEN_MODE_STORAGE_KEY]: storedMode = 'new-tab' } = await chrome.storage.local.get(BOOKMARK_OPEN_MODE_STORAGE_KEY);
    bookmarkOpenMode = storedMode === 'current-tab' ? 'current-tab' : 'new-tab';
  } catch {
    bookmarkOpenMode = 'new-tab';
  }
}

async function setBookmarkOpenModePreference(mode) {
  bookmarkOpenMode = mode === 'current-tab' ? 'current-tab' : 'new-tab';
  await chrome.storage.local.set({ [BOOKMARK_OPEN_MODE_STORAGE_KEY]: bookmarkOpenMode });
}

function normalizeBookmarkCollectionItem(item = {}, index = 0) {
  const title = String(item.title || '').trim();
  const url = String(item.url || '').trim();
  return {
    id: String(item.id || `bookmark-collection-item-${index}`),
    title: title || summarizeUrl(url),
    url,
    order: Number.isFinite(item.order) ? item.order : index,
  };
}

function normalizeBookmarkCollection(collection = {}, index = 0) {
  const items = Array.isArray(collection.items)
    ? collection.items
      .map((item, itemIndex) => normalizeBookmarkCollectionItem(item, itemIndex))
      .filter(item => item.url)
    : [];

  return {
    id: String(collection.id || `bookmark-collection-${Date.now()}-${index}`),
    name: String(collection.name || '').trim(),
    boardId: String(collection.boardId || '').trim(),
    boardTitle: String(collection.boardTitle || '').trim(),
    createdAt: String(collection.createdAt || new Date().toISOString()),
    items,
  };
}

function sortBookmarkCollections(list) {
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function mergeBookmarkCollectionItems(existingItems = [], incomingItems = []) {
  const merged = [];
  const seenUrls = new Set();
  const appendItems = [...existingItems, ...incomingItems];

  appendItems.forEach((item, index) => {
    const normalized = normalizeBookmarkCollectionItem(item, index);
    if (!normalized.url || seenUrls.has(normalized.url)) return;
    seenUrls.add(normalized.url);
    merged.push({
      ...normalized,
      order: merged.length,
    });
  });

  return merged;
}

async function loadBookmarkCollections() {
  try {
    const { [BOOKMARK_COLLECTIONS_STORAGE_KEY]: stored = [] } = await chrome.storage.local.get(BOOKMARK_COLLECTIONS_STORAGE_KEY);
    bookmarkCollections = sortBookmarkCollections(
      (stored || [])
        .map((collection, index) => normalizeBookmarkCollection(collection, index))
        .filter(collection => collection.name && collection.items.length > 0)
    );
  } catch {
    bookmarkCollections = [];
  }
}

async function saveBookmarkCollections(list) {
  bookmarkCollections = sortBookmarkCollections(
    (list || [])
      .map((collection, index) => normalizeBookmarkCollection(collection, index))
      .filter(collection => collection.name && collection.items.length > 0)
  );
  await chrome.storage.local.set({ [BOOKMARK_COLLECTIONS_STORAGE_KEY]: bookmarkCollections });
}

function getBookmarkCollectionById(collectionId) {
  return bookmarkCollections.find(item => item.id === collectionId) || null;
}

function closeBookmarkCollectionSelectMenu() {
  const menu = document.getElementById('bookmarkCollectionSelectMenu');
  const trigger = document.getElementById('bookmarkCollectionSelectTrigger');
  if (menu) menu.style.display = 'none';
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function syncBookmarkCollectionSelectControl() {
  const hiddenInput = document.getElementById('bookmarkCollectionExistingSelect');
  const valueEl = document.getElementById('bookmarkCollectionSelectValue');
  const menu = document.getElementById('bookmarkCollectionSelectMenu');
  const selectedId = hiddenInput instanceof HTMLInputElement ? hiddenInput.value : '';
  const selectedCollection = selectedId ? getBookmarkCollectionById(selectedId) : null;

  if (valueEl) {
    valueEl.textContent = selectedCollection?.name || t('bookmarkCollectionExistingPlaceholder');
    valueEl.classList.toggle('is-placeholder', !selectedCollection);
  }

  if (menu) {
    menu.innerHTML = [
      `<button type="button" class="bookmark-collection-select-option${selectedCollection ? '' : ' is-selected'}" data-action="select-bookmark-collection-option" data-bookmark-collection-id="">
        ${escapeHtml(t('bookmarkCollectionExistingPlaceholder'))}
      </button>`,
      ...bookmarkCollections.map(collection => `
        <button type="button" class="bookmark-collection-select-option${collection.id === selectedId ? ' is-selected' : ''}" data-action="select-bookmark-collection-option" data-bookmark-collection-id="${escapeHtml(collection.id)}">
          ${escapeHtml(collection.name)}
        </button>
      `),
    ].join('');
  }
}

function syncBookmarkCollectionModeControls() {
  const switchEl = document.getElementById('bookmarkCollectionModeSwitch');
  const existingField = document.getElementById('bookmarkCollectionExistingField');
  const existingLabel = document.getElementById('bookmarkCollectionExistingLabel');
  const existingSelect = document.getElementById('bookmarkCollectionExistingSelect');
  const nameLabel = document.getElementById('bookmarkCollectionNameLabel');
  const nameInput = document.getElementById('bookmarkCollectionNameInput');
  const nameField = nameLabel?.closest('.quick-link-field');

  if (switchEl) {
    switchEl.innerHTML = `
      <button type="button" class="bookmark-collection-mode-btn${bookmarkCollectionModalMode === 'create' ? ' is-active' : ''}" data-action="set-bookmark-collection-mode" data-bookmark-collection-mode="create" aria-pressed="${bookmarkCollectionModalMode === 'create' ? 'true' : 'false'}">
        ${escapeHtml(t('bookmarkCollectionCreateMode'))}
      </button>
      <button type="button" class="bookmark-collection-mode-btn${bookmarkCollectionModalMode === 'append' ? ' is-active' : ''}" data-action="set-bookmark-collection-mode" data-bookmark-collection-mode="append" aria-pressed="${bookmarkCollectionModalMode === 'append' ? 'true' : 'false'}"${bookmarkCollections.length === 0 ? ' disabled' : ''}>
        ${escapeHtml(t('bookmarkCollectionAppendMode'))}
      </button>
    `;
  }

  if (existingLabel) existingLabel.textContent = t('bookmarkCollectionExistingLabel');
  if (existingSelect instanceof HTMLInputElement && !bookmarkCollections.some(collection => collection.id === existingSelect.value)) {
    existingSelect.value = '';
  }

  const isAppendMode = bookmarkCollectionModalMode === 'append' && bookmarkCollections.length > 0;
  if (existingField) existingField.style.display = isAppendMode ? 'flex' : 'none';
  if (nameField instanceof HTMLElement) nameField.style.display = isAppendMode ? 'none' : 'flex';
  if (nameLabel) nameLabel.textContent = t('bookmarkCollectionSaveNameLabel');
  if (nameInput) {
    nameInput.disabled = isAppendMode;
    nameInput.required = !isAppendMode;
  }
  syncBookmarkCollectionSelectControl();
  if (!isAppendMode) closeBookmarkCollectionSelectMenu();
}

function normalizeBookmarkBoardDisplayLimit(limit) {
  const value = Number(limit);
  if (!Number.isFinite(value)) return DEFAULT_BOOKMARK_BOARD_DISPLAY_LIMIT;
  return Math.min(BOOKMARK_BOARD_MAX_ENTRIES, Math.max(1, Math.round(value)));
}

async function loadBookmarkBoardDisplayLimitPreference() {
  try {
    const { [BOOKMARK_BOARD_DISPLAY_LIMIT_STORAGE_KEY]: storedLimit = DEFAULT_BOOKMARK_BOARD_DISPLAY_LIMIT } = await chrome.storage.local.get(BOOKMARK_BOARD_DISPLAY_LIMIT_STORAGE_KEY);
    bookmarkBoardDisplayLimit = normalizeBookmarkBoardDisplayLimit(storedLimit);
  } catch {
    bookmarkBoardDisplayLimit = DEFAULT_BOOKMARK_BOARD_DISPLAY_LIMIT;
  }
}

async function setBookmarkBoardDisplayLimitPreference(limit) {
  bookmarkBoardDisplayLimit = normalizeBookmarkBoardDisplayLimit(limit);
  await chrome.storage.local.set({ [BOOKMARK_BOARD_DISPLAY_LIMIT_STORAGE_KEY]: bookmarkBoardDisplayLimit });
}

async function loadBookmarkBoardCollapsedPreference() {
  try {
    const stored = await chrome.storage.local.get(BOOKMARK_BOARD_COLLAPSED_STORAGE_KEY);
    if (Object.prototype.hasOwnProperty.call(stored, BOOKMARK_BOARD_COLLAPSED_STORAGE_KEY)) {
      isBookmarkBoardCollapsed = stored[BOOKMARK_BOARD_COLLAPSED_STORAGE_KEY] === true;
    } else {
      isBookmarkBoardCollapsed = !bookmarkBoardConfig.folderId;
    }
  } catch {
    isBookmarkBoardCollapsed = !bookmarkBoardConfig.folderId;
  }
}

async function setBookmarkBoardCollapsedPreference(collapsed) {
  isBookmarkBoardCollapsed = collapsed === true;
  await chrome.storage.local.set({ [BOOKMARK_BOARD_COLLAPSED_STORAGE_KEY]: isBookmarkBoardCollapsed });
}

async function loadOpenTabsViewPreference() {
  try {
    const { [OPEN_TABS_VIEW_STORAGE_KEY]: storedView = 'domains' } = await chrome.storage.local.get(OPEN_TABS_VIEW_STORAGE_KEY);
    currentOpenTabsView = storedView === 'windows' ? 'windows' : 'domains';
  } catch {
    currentOpenTabsView = 'domains';
  }
}

async function setOpenTabsViewPreference(view) {
  currentOpenTabsView = view === 'windows' ? 'windows' : 'domains';
  await chrome.storage.local.set({ [OPEN_TABS_VIEW_STORAGE_KEY]: currentOpenTabsView });
}

function syncOpenTabsViewControls() {
  const configs = [
    { id: 'openTabsDomainViewBtn', view: 'domains', label: t('openTabsViewDomains') },
    { id: 'openTabsWindowViewBtn', view: 'windows', label: t('openTabsViewWindows') },
  ];

  for (const config of configs) {
    const button = document.getElementById(config.id);
    if (!button) continue;
    const isActive = currentOpenTabsView === config.view;
    button.textContent = config.label;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.title = config.label;
  }
}

function syncQuickLinkOpenModeControls() {
  const configs = [
    {
      id: 'settingsOpenModeCurrentBtn',
      mode: 'current-tab',
      title: t('settingsOpenModeCurrent'),
      description: t('settingsOpenModeCurrentDesc'),
    },
    {
      id: 'settingsOpenModeNewBtn',
      mode: 'new-tab',
      title: t('settingsOpenModeNew'),
      description: t('settingsOpenModeNewDesc'),
    },
  ];

  for (const config of configs) {
    const button = document.getElementById(config.id);
    if (!button) continue;
    const isActive = quickLinksOpenMode === config.mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.innerHTML = `
      <span class="settings-choice-title">${escapeHtml(config.title)}</span>
      <span class="settings-choice-meta">${escapeHtml(config.description)}</span>`;
  }
}

function syncBookmarkOpenModeControls() {
  const configs = [
    {
      id: 'settingsBookmarkOpenModeCurrentBtn',
      mode: 'current-tab',
      title: t('settingsOpenModeCurrent'),
      description: t('settingsOpenModeCurrentDesc'),
    },
    {
      id: 'settingsBookmarkOpenModeNewBtn',
      mode: 'new-tab',
      title: t('settingsOpenModeNew'),
      description: t('settingsOpenModeNewDesc'),
    },
  ];

  for (const config of configs) {
    const button = document.getElementById(config.id);
    if (!button) continue;
    const isActive = bookmarkOpenMode === config.mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.innerHTML = `
      <span class="settings-choice-title">${escapeHtml(config.title)}</span>
      <span class="settings-choice-meta">${escapeHtml(config.description)}</span>`;
  }
}

function syncBookmarkBoardLimitControls() {
  const configs = [1, 2, 3, 4].map(count => ({
    id: `settingsBookmarkBoardLimit${count}Btn`,
    limit: count,
    title: t('settingsBookmarkBoardLimitOption', count),
    description: t('settingsBookmarkBoardLimitOptionDesc', count),
  }));
  const noteEl = document.getElementById('settingsBookmarkBoardLimitNote');

  for (const config of configs) {
    const button = document.getElementById(config.id);
    if (!button) continue;
    const isActive = bookmarkBoardDisplayLimit === config.limit;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.innerHTML = `
      <span class="bookmark-board-limit-option-count">${escapeHtml(config.title)}</span>
      <span class="bookmark-board-limit-option-label">${escapeHtml(t('settingsBookmarkBoardLimitUnit'))}</span>`;
  }

  const activeConfig = configs.find(config => config.limit === bookmarkBoardDisplayLimit);
  if (noteEl) noteEl.textContent = activeConfig?.description || '';
}

function syncBookmarkCollectionModalText() {
  const titleEl = document.getElementById('bookmarkCollectionModalTitle');
  const nameInput = document.getElementById('bookmarkCollectionNameInput');
  const hintEl = document.getElementById('bookmarkCollectionModalHint');
  const cancelBtn = document.getElementById('bookmarkCollectionCancelBtn');
  const submitBtn = document.getElementById('bookmarkCollectionSubmitBtn');
  const closeBtn = document.getElementById('bookmarkCollectionModalCloseBtn');
  const boardIdInput = document.getElementById('bookmarkCollectionBoardId');

  let selectedCount = 0;
  if (boardIdInput?.value) {
    const boardState = bookmarkBoardStateById[boardIdInput.value];
    const selectionState = getBookmarkBoardSelectionState(boardIdInput.value);
    const items = getBookmarkItemsForBatchActions(boardState?.items || []);
    selectedCount = items.filter(item => selectionState.selectedIds.includes(item.id)).length;
  }

  if (titleEl) titleEl.textContent = t('bookmarkCollectionSaveTitle');
  if (nameInput) nameInput.placeholder = t('bookmarkCollectionSaveNamePlaceholder');
  if (hintEl) hintEl.textContent = t('bookmarkCollectionSaveHint', selectedCount);
  if (cancelBtn) cancelBtn.textContent = t('confirmDialogCancel');
  if (submitBtn) submitBtn.textContent = bookmarkCollectionModalMode === 'append'
    ? t('bookmarkCollectionAppendSubmit')
    : t('bookmarkCollectionSaveSubmit');
  if (closeBtn) {
    closeBtn.textContent = '×';
    closeBtn.title = t('quickLinkModalClose');
  }
  syncBookmarkCollectionModeControls();
}

function renderBookmarkCollectionDetailList(collection) {
  if (!collection || !Array.isArray(collection.items) || collection.items.length === 0) return '';

  return collection.items.map(item => {
    const faviconUrl = escapeHtml(getFaviconSource(item.url, item.title, 32));
    const monogram = escapeHtml(getQuickLinkMonogram(item.title, item.url).slice(0, 2) || 'BK');
    const safeTitle = escapeHtml(item.title || summarizeUrl(item.url) || item.url);
    const safeUrl = escapeHtml(item.url);

    return `
      <button
        type="button"
        class="bookmark-collection-detail-item"
        data-action="open-bookmark-collection-item"
        data-bookmark-url="${safeUrl}"
        title="${safeTitle}"
        aria-label="${escapeHtml(t('bookmarkCollectionDetailOpenItem'))}"
      >
        <span class="bookmark-collection-detail-item-favicon">
          ${faviconUrl ? `<img src="${faviconUrl}" alt="" data-hide-on-error="true" data-show-fallback-on-error="next">` : ''}
          <span class="bookmark-collection-detail-item-fallback"${faviconUrl ? ' style="display:none"' : ''}>${monogram}</span>
        </span>
        <span class="bookmark-collection-detail-item-copy">
          <span class="bookmark-collection-detail-item-title">${safeTitle}</span>
        </span>
        <span class="bookmark-collection-detail-item-arrow" aria-hidden="true">›</span>
      </button>`;
  }).join('');
}

function syncBookmarkCollectionDetailModal() {
  const titleEl = document.getElementById('bookmarkCollectionDetailTitle');
  const eyebrowEl = document.getElementById('bookmarkCollectionDetailEyebrow');
  const metaEl = document.getElementById('bookmarkCollectionDetailMeta');
  const listEl = document.getElementById('bookmarkCollectionDetailList');
  const emptyEl = document.getElementById('bookmarkCollectionDetailEmpty');
  const closeBtn = document.getElementById('bookmarkCollectionDetailCloseBtn');
  const cancelBtn = document.getElementById('bookmarkCollectionDetailCancelBtn');
  const openBtn = document.getElementById('bookmarkCollectionDetailOpenBtn');
  const collection = getBookmarkCollectionById(activeBookmarkCollectionId);
  const itemCount = collection?.items?.length || 0;

  if (eyebrowEl) eyebrowEl.textContent = t('bookmarkCollectionDetailEyebrow');
  if (titleEl) titleEl.textContent = collection?.name || t('bookmarkCollectionTitle');
  if (metaEl) metaEl.textContent = t('bookmarkCollectionCount', itemCount);
  if (listEl) listEl.innerHTML = renderBookmarkCollectionDetailList(collection);
  if (emptyEl) {
    emptyEl.textContent = t('bookmarkCollectionDetailEmpty');
    emptyEl.style.display = itemCount === 0 ? 'flex' : 'none';
  }
  if (closeBtn) {
    closeBtn.textContent = '×';
    closeBtn.title = t('quickLinkModalClose');
    closeBtn.setAttribute('aria-label', t('quickLinkModalClose'));
  }
  if (cancelBtn) cancelBtn.textContent = t('confirmDialogCancel');
  if (openBtn) {
    openBtn.textContent = t('bookmarkCollectionDetailOpenAll');
    openBtn.disabled = itemCount === 0;
    openBtn.dataset.bookmarkCollectionId = collection?.id || '';
  }
}

function syncSessionModalText() {
  const titleEl = document.getElementById('sessionModalTitle');
  const nameLabel = document.getElementById('sessionNameLabel');
  const nameInput = document.getElementById('sessionNameInput');
  const pinnedLabel = document.getElementById('sessionPinnedLabel');
  const pinnedHint = document.getElementById('sessionPinnedHint');
  const cancelBtn = document.getElementById('sessionCancelBtn');
  const submitBtn = document.getElementById('sessionSubmitBtn');
  const closeBtn = document.getElementById('sessionModalCloseBtn');
  const idInput = document.getElementById('sessionIdInput');
  const isEditing = !!idInput?.value;

  if (titleEl) titleEl.textContent = isEditing ? t('sessionModalEditTitle') : t('sessionModalCreateTitle');
  if (nameLabel) nameLabel.textContent = t('sessionNameLabel');
  if (nameInput) nameInput.placeholder = t('sessionNamePlaceholder');
  if (pinnedLabel) pinnedLabel.textContent = t('sessionPinnedLabel');
  if (pinnedHint) pinnedHint.textContent = t('sessionPinnedHint');
  if (cancelBtn) cancelBtn.textContent = t('confirmDialogCancel');
  if (submitBtn) submitBtn.textContent = isEditing ? t('sessionUpdate') : t('sessionSave');
  if (closeBtn) {
    closeBtn.textContent = '×';
    closeBtn.title = t('quickLinkModalClose');
    closeBtn.setAttribute('aria-label', t('quickLinkModalClose'));
  }
}

function applyStaticText() {
  document.documentElement.lang = currentLanguage;

  const quickLinksTitle = document.getElementById('quickLinksTitle');
  const quickLinksSubtitle = document.getElementById('quickLinksSubtitle');
  const bookmarkBoardTitle = document.getElementById('bookmarkBoardTitle');
  const bookmarkBoardSubtitle = document.getElementById('bookmarkBoardSubtitle');
  const bookmarkBoardSearchInput = document.getElementById('bookmarkBoardSearchInput');
  const bookmarkBoardToggleBtn = document.getElementById('bookmarkBoardToggleBtn');
  const bookmarkBoardAddBtn = document.getElementById('bookmarkBoardAddBtn');
  const openTabsViewSwitcher = document.getElementById('openTabsViewSwitcher');
  const openTabsDomainViewBtn = document.getElementById('openTabsDomainViewBtn');
  const openTabsWindowViewBtn = document.getElementById('openTabsWindowViewBtn');
  const stashTrigger = document.getElementById('stashMenuTrigger');
  const sessionTrigger = document.getElementById('sessionFabTrigger');
  const settingsTrigger = document.getElementById('settingsModalTrigger');
  const themeTrigger = document.getElementById('themeToggleBtn');
  const stashMenuTitle = document.getElementById('stashMenuTitle');
  const stashMenuHint = document.getElementById('stashMenuHint');
  const sessionsTitle = document.getElementById('sessionsSectionTitle');
  const sessionsEmpty = document.getElementById('sessionsEmpty');
  const sessionRecentLabel = document.getElementById('sessionRecentLabel');
  const sessionPanelCloseBtn = document.querySelector('.session-panel-close');
  const stashCurrentWindowBtn = document.getElementById('stashCurrentWindowBtn');
  const stashAllWindowsBtn = document.getElementById('stashAllWindowsBtn');
  const deferredTitle = document.getElementById('deferredSectionTitle');
  const deferredEmpty = document.getElementById('deferredEmpty');
  const archiveLabel = document.getElementById('archiveToggleLabel');
  const archiveSearch = document.getElementById('archiveSearch');
  const statTabsLabel = document.getElementById('statTabsLabel');
  const footerCreditEyebrow = document.getElementById('footerCreditEyebrow');
  const footerCreditMain = document.getElementById('footerCreditMain');
  const footerProjectLink = document.getElementById('footerProjectLink');
  const footerAuthorLink = document.getElementById('footerAuthorLink');
  const closeTabOutDupesBtn = document.getElementById('closeTabOutDupesBtn');
  const quickLinkNameLabel = document.getElementById('quickLinkNameLabel');
  const quickLinkNameInput = document.getElementById('quickLinkNameInput');
  const quickLinkUrlLabel = document.getElementById('quickLinkUrlLabel');
  const quickLinkUrlInput = document.getElementById('quickLinkUrlInput');
  const quickLinkCancelBtn = document.getElementById('quickLinkCancelBtn');
  const quickLinkModalCloseBtn = document.getElementById('quickLinkModalCloseBtn');
  const bookmarkCollectionModalCloseBtn = document.getElementById('bookmarkCollectionModalCloseBtn');
  const bookmarkCollectionDetailCloseBtn = document.getElementById('bookmarkCollectionDetailCloseBtn');
  const sessionModalCloseBtn = document.getElementById('sessionModalCloseBtn');
  const settingsTitle = document.getElementById('settingsModalTitle');
  const settingsAppearanceTab = document.getElementById('settingsAppearanceTab');
  const settingsLinksTab = document.getElementById('settingsLinksTab');
  const settingsBookmarksTab = document.getElementById('settingsBookmarksTab');
  const settingsLanguageLabel = document.getElementById('settingsLanguageLabel');
  const settingsBackgroundLabel = document.getElementById('settingsBackgroundLabel');
  const settingsBackgroundHint = document.getElementById('settingsBackgroundHint');
  const settingsImageUploadLabel = document.getElementById('settingsImageUploadLabel');
  const settingsLinkOpenModeLabel = document.getElementById('settingsLinkOpenModeLabel');
  const settingsLinkOpenModeHint = document.getElementById('settingsLinkOpenModeHint');
  const settingsBookmarkFolderLabel = document.getElementById('settingsBookmarkFolderLabel');
  const settingsBookmarkFolderHint = document.getElementById('settingsBookmarkFolderHint');
  const bookmarkFolderSearchInput = document.getElementById('bookmarkFolderSearchInput');
  const settingsBookmarkBoardLimitLabel = document.getElementById('settingsBookmarkBoardLimitLabel');
  const settingsBookmarkBoardLimitHint = document.getElementById('settingsBookmarkBoardLimitHint');
  const settingsBookmarkOpenModeLabel = document.getElementById('settingsBookmarkOpenModeLabel');
  const settingsBookmarkOpenModeHint = document.getElementById('settingsBookmarkOpenModeHint');
  const bookmarkBoardBackBtn = document.getElementById('bookmarkBoardBackBtn');
  const settingsCloseBtn = document.getElementById('settingsModalCloseBtn');

  if (quickLinksTitle) quickLinksTitle.textContent = t('quickLinksTitle');
  if (quickLinksSubtitle) quickLinksSubtitle.textContent = t('quickLinksSubtitle');
  if (bookmarkBoardTitle) bookmarkBoardTitle.textContent = t('bookmarkBoardTitle');
  if (bookmarkBoardSubtitle) bookmarkBoardSubtitle.textContent = t('bookmarkBoardSubtitle');
  if (bookmarkBoardSearchInput) bookmarkBoardSearchInput.placeholder = t('bookmarkBoardSearchPlaceholder');
  if (bookmarkBoardAddBtn) {
    bookmarkBoardAddBtn.textContent = t('bookmarkBoardAdd');
    bookmarkBoardAddBtn.title = t('bookmarkBoardAdd');
    bookmarkBoardAddBtn.setAttribute('aria-label', t('bookmarkBoardAdd'));
  }
  if (bookmarkBoardToggleBtn) {
    const label = isBookmarkBoardCollapsed ? t('bookmarkBoardExpand') : t('bookmarkBoardCollapse');
    bookmarkBoardToggleBtn.textContent = label;
    bookmarkBoardToggleBtn.title = label;
    bookmarkBoardToggleBtn.setAttribute('aria-label', label);
    bookmarkBoardToggleBtn.setAttribute('aria-expanded', isBookmarkBoardCollapsed ? 'false' : 'true');
  }
  if (openTabsViewSwitcher) openTabsViewSwitcher.setAttribute('aria-label', t('openTabsViewLabel'));
  if (openTabsDomainViewBtn || openTabsWindowViewBtn) syncOpenTabsViewControls();
  if (stashTrigger) {
    stashTrigger.setAttribute('data-tooltip', t('stashToolLabel'));
    stashTrigger.setAttribute('aria-label', t('stashToolLabel'));
    stashTrigger.title = '';
  }
  if (sessionTrigger) {
    sessionTrigger.setAttribute('data-tooltip', t('sessionToolLabel'));
    sessionTrigger.setAttribute('aria-label', t('sessionToolLabel'));
    sessionTrigger.title = '';
  }
  if (themeTrigger) {
    syncThemeToggleControl();
  }
  if (stashMenuTitle) stashMenuTitle.textContent = t('stashMenuTitle');
  if (stashMenuHint) stashMenuHint.textContent = t('stashMenuHint');
  if (settingsTrigger) {
    const label = isSettingsModalOpen ? t('closeSettings') : t('openSettings');
    settingsTrigger.setAttribute('data-tooltip', label);
    settingsTrigger.setAttribute('aria-label', label);
    settingsTrigger.title = '';
  }
  if (sessionsTitle) sessionsTitle.textContent = t('sessionsTitle');
  if (sessionsEmpty) sessionsEmpty.textContent = t('sessionsEmpty');
  if (sessionRecentLabel) sessionRecentLabel.textContent = t('sessionRecent');
  if (sessionPanelCloseBtn) {
    sessionPanelCloseBtn.title = t('sessionPanelClose');
    sessionPanelCloseBtn.setAttribute('aria-label', t('sessionPanelClose'));
  }
  const sessionPanelPackBtn = document.getElementById('sessionPanelPackBtn');
  if (sessionPanelPackBtn instanceof HTMLButtonElement) {
    sessionPanelPackBtn.title = t('sessionPanelPackButton');
    sessionPanelPackBtn.setAttribute('aria-label', t('sessionPanelPackButton'));
  }
  if (stashCurrentWindowBtn) {
    stashCurrentWindowBtn.innerHTML = `
      <span class="stash-action-title">${escapeHtml(t('stashCurrentWindow'))}</span>
      <span class="stash-action-meta">${escapeHtml(t('stashCurrentWindowHint'))}</span>
    `;
  }
  if (stashAllWindowsBtn) {
    stashAllWindowsBtn.innerHTML = `
      <span class="stash-action-title">${escapeHtml(t('stashAllWindows'))}</span>
      <span class="stash-action-meta">${escapeHtml(t('stashAllWindowsHint'))}</span>
    `;
  }
  if (deferredTitle) deferredTitle.textContent = t('savedForLater');
  if (deferredEmpty) deferredEmpty.textContent = t('nothingSaved');
  if (archiveLabel) archiveLabel.textContent = t('archive');
  if (archiveSearch) archiveSearch.placeholder = t('archiveSearchPlaceholder');
  if (statTabsLabel) statTabsLabel.textContent = t('statOpenTabs');
  if (footerCreditEyebrow) footerCreditEyebrow.textContent = t('footerCreditEyebrow');
  if (footerCreditMain) footerCreditMain.textContent = t('footerCreditMain');
  if (footerProjectLink) footerProjectLink.textContent = t('footerProjectLink');
  if (footerAuthorLink) footerAuthorLink.textContent = t('footerAuthorLink');
  if (closeTabOutDupesBtn) closeTabOutDupesBtn.textContent = t('closeExtras');
  if (quickLinkNameLabel) quickLinkNameLabel.textContent = t('quickLinkNameLabel');
  if (quickLinkNameInput) quickLinkNameInput.placeholder = t('quickLinkNamePlaceholder');
  if (quickLinkUrlLabel) quickLinkUrlLabel.textContent = t('quickLinkUrlLabel');
  if (quickLinkUrlInput) quickLinkUrlInput.placeholder = t('quickLinkUrlPlaceholder');
  if (quickLinkCancelBtn) quickLinkCancelBtn.textContent = t('quickLinkCancel');
  if (quickLinkModalCloseBtn) quickLinkModalCloseBtn.textContent = '×';
  if (quickLinkModalCloseBtn) quickLinkModalCloseBtn.title = t('quickLinkModalClose');
  if (bookmarkCollectionModalCloseBtn) bookmarkCollectionModalCloseBtn.textContent = '×';
  if (bookmarkCollectionDetailCloseBtn) bookmarkCollectionDetailCloseBtn.textContent = '×';
  if (sessionModalCloseBtn) sessionModalCloseBtn.textContent = '×';
  if (settingsTitle) settingsTitle.textContent = t('settingsTitle');
  if (settingsAppearanceTab) settingsAppearanceTab.textContent = t('settingsAppearance');
  if (settingsLinksTab) settingsLinksTab.textContent = t('settingsLinks');
  if (settingsBookmarksTab) settingsBookmarksTab.textContent = t('settingsBookmarks');
  if (settingsLanguageLabel) settingsLanguageLabel.textContent = t('settingsLanguageLabel');
  if (settingsBackgroundLabel) settingsBackgroundLabel.textContent = t('settingsBackgroundLabel');
  if (settingsBackgroundHint) settingsBackgroundHint.textContent = t('settingsBackgroundHint');
  if (settingsImageUploadLabel) settingsImageUploadLabel.textContent = t('settingsImageUploadLabel');
  if (settingsLinkOpenModeLabel) settingsLinkOpenModeLabel.textContent = t('settingsLinkOpenModeLabel');
  if (settingsLinkOpenModeHint) settingsLinkOpenModeHint.textContent = t('settingsLinkOpenModeHint');
  if (settingsBookmarkFolderLabel) settingsBookmarkFolderLabel.textContent = t('settingsBookmarkFolderLabel');
  if (settingsBookmarkFolderHint) settingsBookmarkFolderHint.textContent = t('settingsBookmarkFolderHint');
  if (bookmarkFolderSearchInput) bookmarkFolderSearchInput.placeholder = t('settingsBookmarkFolderSearchPlaceholder');
  if (settingsBookmarkBoardLimitLabel) settingsBookmarkBoardLimitLabel.textContent = t('settingsBookmarkBoardLimitLabel');
  if (settingsBookmarkBoardLimitHint) settingsBookmarkBoardLimitHint.textContent = t('settingsBookmarkBoardLimitHint');
  if (settingsBookmarkOpenModeLabel) settingsBookmarkOpenModeLabel.textContent = t('settingsBookmarkOpenModeLabel');
  if (settingsBookmarkOpenModeHint) settingsBookmarkOpenModeHint.textContent = t('settingsBookmarkOpenModeHint');
  if (bookmarkBoardBackBtn) bookmarkBoardBackBtn.textContent = t('bookmarkBoardBack');
  if (settingsCloseBtn) {
    settingsCloseBtn.textContent = '×';
    settingsCloseBtn.title = t('closeSettings');
    settingsCloseBtn.setAttribute('aria-label', t('closeSettings'));
  }

  syncLanguageSwitcher();
  syncBackgroundControls();
  syncQuickLinkOpenModeControls();
  syncBookmarkBoardLimitControls();
  syncBookmarkOpenModeControls();
  syncOpenTabsViewControls();
  setCurrentSettingsPanel(currentSettingsPanel);
  syncQuickLinkModalText();
  syncBookmarkCollectionModalText();
  syncBookmarkCollectionDetailModal();
  syncSessionModalText();
}

function updateTabOutDupeBannerText(count) {
  const textEl = document.getElementById('tabOutDupeText');
  if (textEl) textEl.innerHTML = t('tabOutDupeBanner', count);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function summarizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url || '';
  }
}

function getQuickLinkMonogram(title, url) {
  const source = (title || summarizeUrl(url)).replace(/^https?:\/\//, '').trim();
  const parts = source.split(/[\s./_-]+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '+';
}

function getHostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getReadableTextColor(color) {
  const value = String(color || '').trim().toLowerCase();
  if (!value) return '#ffffff';

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map(part => part + part).join('')
      : hex;

    if (/^[0-9a-f]{6}$/.test(normalized)) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.64 ? '#1f1a17' : '#ffffff';
    }
  }

  const hslMatch = value.match(/hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)/);
  if (hslMatch) {
    const lightness = Number(hslMatch[1]);
    return lightness > 62 ? '#1f1a17' : '#ffffff';
  }

  return '#ffffff';
}

function getLocalFaviconDataUrl(url, title = '', size = 32) {
  const hostname = getHostnameFromUrl(url);
  const label = getQuickLinkMonogram(title, url).slice(0, size <= 16 ? 1 : 2) || '?';
  const background = hostname ? getBrandColor(hostname) : '#8b7f74';
  const foreground = getReadableTextColor(background);
  const fontSize = size <= 16 ? 11 : size <= 20 ? 12 : size <= 32 ? 14 : 24;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${Math.max(4, Math.round(size * 0.22))}" fill="${background}"/>
      <text x="50%" y="50%" fill="${foreground}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central">${escapeHtml(label)}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getChromeFaviconUrl(url, size = 32) {
  const pageUrl = String(url || '').trim();
  if (!pageUrl) return '';
  try {
    new URL(pageUrl);
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
  } catch {
    return '';
  }
}

function getFaviconSource(url, title = '', size = 32, fallbackUrl = '') {
  const candidate = String(fallbackUrl || '').trim();
  return candidate || getChromeFaviconUrl(url, size) || getLocalFaviconDataUrl(url, title, size);
}

function normalizeQuickLinkUrl(rawUrl) {
  let normalized = String(rawUrl || '').trim();
  if (!normalized) throw new Error('invalid-url');
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized)) normalized = `https://${normalized}`;

  const parsed = new URL(normalized);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('invalid-url');
  return parsed.toString();
}

function normalizeQuickLink(link, index = 0) {
  return {
    id: link.id || `quick-link-${Date.now()}-${index}`,
    title: String(link.title || '').trim(),
    url: String(link.url || '').trim(),
    createdAt: link.createdAt || new Date().toISOString(),
    order: Number.isFinite(link.order) ? link.order : index,
  };
}

function normalizeBookmarkFolder(folder, index = 0) {
  return {
    id: String(folder.id || ''),
    title: String(folder.title || '').trim() || (folder.id ? `Folder ${folder.id}` : ''),
    path: String(folder.path || '').trim(),
    depth: Number.isFinite(folder.depth) ? folder.depth : 0,
    order: Number.isFinite(folder.order) ? folder.order : index,
  };
}

function sortBookmarkFolders(list) {
  return [...list].sort((a, b) => {
    const pathCompare = String(a.path || '').localeCompare(String(b.path || ''), currentLanguage, { sensitivity: 'base' });
    if (pathCompare !== 0) return pathCompare;
    return String(a.title || '').localeCompare(String(b.title || ''), currentLanguage, { sensitivity: 'base' });
  });
}

function getBookmarkFolderDisplayName(folder) {
  const title = String(folder?.title || '').trim();
  if (!title) return '';
  return title;
}

function getBookmarkFolderDisplayPath(folder) {
  const path = String(folder?.path || '').trim();
  return path || getBookmarkFolderDisplayName(folder);
}

async function loadBookmarkFolders() {
  if (!chrome?.bookmarks?.getTree) {
    bookmarkFolders = [];
    return bookmarkFolders;
  }

  const tree = await chrome.bookmarks.getTree();
  const folders = [];

  const walk = (node, parents = []) => {
    if (!node) return;
    const title = String(node.title || '').trim();
    const nextParents = title ? [...parents, title] : parents;
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isFolder = hasChildren && !node.url;

    if (isFolder && nextParents.length > 0) {
      folders.push(normalizeBookmarkFolder({
        id: node.id,
        title,
        path: nextParents.join(' / '),
        depth: nextParents.length,
      }, folders.length));
    }

    if (hasChildren) {
      node.children.forEach(child => walk(child, nextParents));
    }
  };

  tree.forEach(rootNode => walk(rootNode, []));
  bookmarkFolders = sortBookmarkFolders(folders);
  return bookmarkFolders;
}

function normalizeBookmarkBoardItem(item, index = 0) {
  return {
    id: String(item.id || `bookmark-${index}`),
    type: item.type === 'folder' ? 'folder' : 'bookmark',
    title: String(item.title || '').trim() || summarizeUrl(item.url),
    url: String(item.url || '').trim(),
    path: String(item.path || '').trim(),
    parentId: String(item.parentId || ''),
    childCount: Number.isFinite(item.childCount) ? item.childCount : 0,
    dateAdded: Number(item.dateAdded || 0),
    order: index,
  };
}

function sortBookmarkBoardItems(items) {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    const pathCompare = String(a.path || '').localeCompare(String(b.path || ''), currentLanguage, { sensitivity: 'base' });
    if (pathCompare !== 0) return pathCompare;
    return String(a.title || '').localeCompare(String(b.title || ''), currentLanguage, { sensitivity: 'base' });
  });
}

async function loadBookmarkBoardItems(board = bookmarkBoardConfig) {
  const targetFolderId = board.currentFolderId || board.folderId;
  if (!targetFolderId || !chrome?.bookmarks?.getSubTree) {
    bookmarkBoardItems = [];
    bookmarkBoardCurrentFolder = null;
    return {
      items: bookmarkBoardItems,
      currentFolder: bookmarkBoardCurrentFolder,
    };
  }

  try {
    const [folderNode] = await chrome.bookmarks.getSubTree(targetFolderId);
    if (!folderNode) {
      bookmarkBoardItems = [];
      bookmarkBoardCurrentFolder = null;
      return bookmarkBoardItems;
    }

    bookmarkBoardCurrentFolder = {
      id: String(folderNode.id || ''),
      title: String(folderNode.title || board.folderTitle || '').trim(),
      parentId: String(folderNode.parentId || ''),
    };

    const directChildren = Array.isArray(folderNode.children) ? folderNode.children : [];
    const entries = directChildren.map((node, index) => {
      const title = String(node.title || '').trim();
      if (node.url) {
        return normalizeBookmarkBoardItem({
          id: node.id,
          type: 'bookmark',
          title: title || summarizeUrl(node.url),
          url: node.url,
          parentId: folderNode.id,
          dateAdded: Number(node.dateAdded || 0),
          order: index,
        }, index);
      }

      return normalizeBookmarkBoardItem({
        id: node.id,
        type: 'folder',
        title: title || `Folder ${node.id}`,
        parentId: folderNode.id,
        childCount: Array.isArray(node.children) ? node.children.length : 0,
        order: index,
      }, index);
    });

    bookmarkBoardItems = sortBookmarkBoardItems(entries);
    return {
      items: bookmarkBoardItems,
      currentFolder: bookmarkBoardCurrentFolder,
    };
  } catch (err) {
    console.warn('[tab-out] Could not load bookmark board items:', err);
    bookmarkBoardItems = [];
    bookmarkBoardCurrentFolder = null;
    return {
      items: bookmarkBoardItems,
      currentFolder: bookmarkBoardCurrentFolder,
    };
  }
}

async function searchBookmarksInFolderTree(folderId, folderPath = '') {
  if (!folderId || !chrome?.bookmarks?.getSubTree) return [];

  try {
    const [folderNode] = await chrome.bookmarks.getSubTree(folderId);
    if (!folderNode) return [];

    const rootTitle = String(folderNode.title || '').trim();
    const basePath = folderPath || rootTitle;
    const results = [];

    const walk = (node, parents = []) => {
      if (!node) return;
      const title = String(node.title || '').trim();

      if (node.url) {
        results.push(normalizeBookmarkBoardItem({
          id: node.id,
          type: 'bookmark',
          title: title || summarizeUrl(node.url),
          url: node.url,
          path: parents.join(' / '),
          parentId: String(node.parentId || ''),
          dateAdded: Number(node.dateAdded || 0),
        }, results.length));
        return;
      }

      const nextParents = title ? [...parents, title] : parents;
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach(child => walk(child, nextParents));
    };

    const children = Array.isArray(folderNode.children) ? folderNode.children : [];
    children.forEach(child => walk(child, basePath ? [basePath] : []));
    return results;
  } catch (err) {
    console.warn('[tab-out] Could not search bookmarks in folder tree:', err);
    return [];
  }
}

function applyBackgroundSelection({ imageDataUrl = '' } = {}) {
  customBackgroundImage = typeof imageDataUrl === 'string' ? imageDataUrl : '';
  updateSolidSurfacePalette();
  document.body.style.setProperty(
    '--custom-background-image',
    customBackgroundImage ? `url("${customBackgroundImage}")` : 'none'
  );
  document.body.style.setProperty(
    '--custom-background-color',
    getEffectiveBackgroundColor()
  );
  document.body.classList.toggle('has-custom-background', !!customBackgroundImage);
  document.body.classList.remove('has-solid-background');
  syncBackgroundControls();
}

async function loadBackgroundPreference() {
  try {
    const { [BACKGROUND_IMAGE_STORAGE_KEY]: storedBackground = '' } = await chrome.storage.local.get(BACKGROUND_IMAGE_STORAGE_KEY);
    await chrome.storage.local.remove(BACKGROUND_COLOR_STORAGE_KEY);
    applyBackgroundSelection({
      imageDataUrl: typeof storedBackground === 'string' ? storedBackground : '',
    });
  } catch {
    applyBackgroundSelection();
  }
}

async function saveBackgroundPreference(imageDataUrl) {
  await chrome.storage.local.set({ [BACKGROUND_IMAGE_STORAGE_KEY]: imageDataUrl });
  await chrome.storage.local.remove(BACKGROUND_COLOR_STORAGE_KEY);
  applyBackgroundSelection({ imageDataUrl });
}

async function clearBackgroundPreference() {
  await chrome.storage.local.remove([BACKGROUND_IMAGE_STORAGE_KEY, BACKGROUND_COLOR_STORAGE_KEY]);
  applyBackgroundSelection();
}

function loadImageFromUrl(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image-load-failed'));
    image.src = source;
  });
}

function getScaledDimensions(width, height, maxEdge) {
  const largestEdge = Math.max(width, height);
  if (largestEdge <= maxEdge) {
    return { width, height };
  }

  const ratio = maxEdge / largestEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function exportBackgroundCanvas(canvas) {
  const attempts = [
    ['image/webp', 0.82],
    ['image/webp', 0.72],
    ['image/jpeg', 0.8],
    ['image/jpeg', 0.7],
  ];

  let fallback = '';
  for (const [type, quality] of attempts) {
    const dataUrl = canvas.toDataURL(type, quality);
    fallback = dataUrl;
    if (dataUrl.length <= MAX_BACKGROUND_STORAGE_LENGTH) return dataUrl;
  }

  return fallback;
}

async function prepareBackgroundImage(file) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    throw new Error('invalid-image');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    let maxEdge = MAX_BACKGROUND_EDGE;
    let bestDataUrl = '';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { width, height } = getScaledDimensions(sourceWidth, sourceHeight, maxEdge);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas-unavailable');

      context.fillStyle = getEffectiveBackgroundColor();
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      bestDataUrl = exportBackgroundCanvas(canvas);
      if (bestDataUrl.length <= MAX_BACKGROUND_STORAGE_LENGTH) return bestDataUrl;

      maxEdge = Math.max(1280, Math.round(maxEdge * 0.82));
    }

    if (bestDataUrl.length > MAX_BACKGROUND_STORAGE_LENGTH) {
      throw new Error('background-too-large');
    }

    return bestDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function sortQuickLinks(list) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

async function getQuickLinks() {
  const { [QUICK_LINKS_STORAGE_KEY]: stored = [] } = await chrome.storage.local.get(QUICK_LINKS_STORAGE_KEY);
  return sortQuickLinks(stored.map((item, index) => normalizeQuickLink(item, index)).filter(item => item.title && item.url));
}

async function saveQuickLinks(list) {
  quickLinks = sortQuickLinks(list).map((item, index) => ({ ...normalizeQuickLink(item, index), order: index }));
  await chrome.storage.local.set({ [QUICK_LINKS_STORAGE_KEY]: quickLinks });
}

function renderQuickLinkCard(link) {
  const safeTitle = escapeHtml(link.title);
  const safeDomain = escapeHtml(summarizeUrl(link.url));
  const safeId = escapeHtml(link.id);
  const monogram = escapeHtml(getQuickLinkMonogram(link.title, link.url));
  const isMenuOpen = activeQuickLinkMenuId === link.id;
  const faviconUrl = escapeHtml(getFaviconSource(link.url, link.title, 64));

  return `
    <div class="quick-link-card quick-link-site-card clickable${isMenuOpen ? ' is-menu-open' : ''}" data-action="open-quick-link" data-quick-link-id="${safeId}" title="${safeTitle} · ${safeDomain}">
      <div class="quick-link-menu-shell" data-action="noop">
        <button type="button" class="quick-link-menu-trigger" data-action="toggle-quick-link-menu" data-quick-link-id="${safeId}" title="${t('quickLinkMore')}" aria-label="${t('quickLinkMore')}" aria-expanded="${isMenuOpen ? 'true' : 'false'}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="12" r="1.85" />
            <circle cx="12" cy="12" r="1.85" />
            <circle cx="18" cy="12" r="1.85" />
          </svg>
        </button>
        <div class="quick-link-menu"${isMenuOpen ? '' : ' hidden'}>
          <button type="button" class="quick-link-menu-item" data-action="edit-quick-link" data-quick-link-id="${safeId}">
            <span class="quick-link-menu-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5" /></svg>
            </span>
            <span>${t('quickLinkEdit')}</span>
          </button>
          <button type="button" class="quick-link-menu-item is-danger" data-action="delete-quick-link" data-quick-link-id="${safeId}">
            <span class="quick-link-menu-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.088-2.201a51.964 51.964 0 0 0-3.324 0C9.16 2.313 8.25 3.296 8.25 4.477v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
            </span>
            <span>${t('quickLinkDelete')}</span>
          </button>
        </div>
      </div>
      <div class="quick-link-avatar">
        ${faviconUrl ? `<img src="${faviconUrl}" alt="" data-hide-on-error="true" data-show-fallback-on-error="next">` : ''}
        <span class="quick-link-avatar-fallback"${faviconUrl ? ' style="display:none"' : ''}>${monogram}</span>
      </div>
      <div class="quick-link-copy">
        <div class="quick-link-name">${safeTitle}</div>
      </div>
    </div>`;
}

function renderQuickLinkAddCard() {
  return `
    <button type="button" class="quick-link-card quick-link-add-card" data-action="open-quick-link-modal" title="${t('quickLinkAddCardTitle')}" aria-label="${t('quickLinkAddCardTitle')}" data-tooltip="${t('quickLinkAddCardTitle')}">
      <div class="quick-link-add-symbol">+</div>
    </button>`;
}

function renderQuickLinkEmptyCard() {
  const subtitle = t('quickLinksEmptySubtitle');
  return `
    <div class="quick-link-empty-card">
      <div class="quick-link-empty-title">${t('quickLinksEmptyTitle')}</div>
      ${subtitle ? `<div class="quick-link-empty-subtitle">${subtitle}</div>` : ''}
    </div>`;
}

async function renderQuickLinksSection() {
  const grid = document.getElementById('quickLinksGrid');
  if (!grid) return;

  try {
    quickLinks = await getQuickLinks();
    if (activeQuickLinkMenuId && !quickLinks.some(link => link.id === activeQuickLinkMenuId)) {
      activeQuickLinkMenuId = '';
    }
    const cards = quickLinks.map(link => renderQuickLinkCard(link));
    if (quickLinks.length === 0) cards.unshift(renderQuickLinkEmptyCard());
    cards.push(renderQuickLinkAddCard());
    grid.innerHTML = cards.join('');
  } catch (err) {
    console.warn('[tab-out] Could not load quick links:', err);
    grid.innerHTML = `${renderQuickLinkEmptyCard()}${renderQuickLinkAddCard()}`;
  }
}

function renderBookmarkFolderOption(folder) {
  const safeId = escapeHtml(folder.id);
  const safeTitle = escapeHtml(getBookmarkFolderDisplayName(folder));
  const safePath = escapeHtml(getBookmarkFolderDisplayPath(folder));
  const isActive = getBookmarkBoardEntries().some(board => board.folderId === folder.id);

  return `
    <button type="button" class="bookmark-folder-option${isActive ? ' is-active' : ''}" data-action="select-bookmark-folder" data-bookmark-folder-id="${safeId}" aria-pressed="${isActive ? 'true' : 'false'}">
      <span class="bookmark-folder-option-title">${safeTitle}</span>
      <span class="bookmark-folder-option-path">${safePath}</span>
      ${isActive ? `<span class="bookmark-folder-option-badge">${escapeHtml(t('settingsBookmarkFolderSelected'))}</span>` : ''}
    </button>`;
}

function getBookmarkBoardEntry(boardId) {
  return getBookmarkBoardEntries().find(board => board.id === boardId || board.folderId === boardId) || null;
}

function syncLegacyBookmarkBoardFields() {
  const primary = getBookmarkBoardEntries()[0] || {};
  bookmarkBoardConfig = {
    ...bookmarkBoardConfig,
    folderId: primary.folderId || '',
    folderTitle: primary.folderTitle || '',
    currentFolderId: primary.currentFolderId || primary.folderId || '',
    currentFolderTitle: primary.currentFolderTitle || primary.folderTitle || '',
  };
}

function getBookmarkBoardSearchQuery(boardId) {
  return bookmarkBoardSearchQueries[boardId] || '';
}

function getVisibleBookmarkBoardEntries() {
  return getBookmarkBoardEntries().slice(0, bookmarkBoardDisplayLimit);
}

function getBookmarkBoardSelectionState(boardId) {
  if (!boardId) {
    return {
      isSelectionMode: false,
      selectedIds: [],
    };
  }

  const existing = bookmarkBoardSelectionStateById[boardId];
  if (existing) {
    return {
      isSelectionMode: !!existing.isSelectionMode,
      selectedIds: Array.isArray(existing.selectedIds) ? [...new Set(existing.selectedIds.map(id => String(id)))] : [],
    };
  }

  return {
    isSelectionMode: false,
    selectedIds: [],
  };
}

function setBookmarkBoardSelectionState(boardId, patch = {}) {
  if (!boardId) return;
  const current = getBookmarkBoardSelectionState(boardId);
  bookmarkBoardSelectionStateById = {
    ...bookmarkBoardSelectionStateById,
    [boardId]: {
      isSelectionMode: typeof patch.isSelectionMode === 'boolean' ? patch.isSelectionMode : current.isSelectionMode,
      selectedIds: Array.isArray(patch.selectedIds)
        ? [...new Set(patch.selectedIds.map(id => String(id)))]
        : current.selectedIds,
    },
  };
}

function clearBookmarkBoardSelectionState(boardId) {
  if (!boardId) return;
  delete bookmarkBoardSelectionStateById[boardId];
}

function getBookmarkItemsForBatchActions(items = []) {
  return items.filter(item => item.type === 'bookmark' && item.url);
}

async function openBookmarkUrls(urls = [], { mode = bookmarkOpenMode } = {}) {
  const normalizedUrls = [...new Set((urls || []).map(url => String(url || '').trim()).filter(Boolean))];
  if (normalizedUrls.length === 0) {
    return {
      openedCount: 0,
      reusedCount: 0,
      reusedTabs: [],
    };
  }

  try {
    const allTabs = await chrome.tabs.query({});
    const existingTabsByUrl = new Map();
    for (const tab of allTabs) {
      const tabUrl = getResolvedTabUrl(tab);
      if (!tabUrl || !isRealWebTab(tab)) continue;
      if (!existingTabsByUrl.has(tabUrl)) existingTabsByUrl.set(tabUrl, tab);
    }

    const urlsToOpen = [];
    const reusedTabs = [];

    for (const url of normalizedUrls) {
      const existingTab = existingTabsByUrl.get(url);
      if (existingTab) {
        reusedTabs.push(existingTab);
      } else {
        urlsToOpen.push(url);
      }
    }

    if (mode === 'current-tab' && urlsToOpen.length > 0) {
      const [firstUrl, ...restUrls] = urlsToOpen;
      const currentTab = await chrome.tabs.getCurrent();
      if (currentTab?.id) {
        await chrome.tabs.update(currentTab.id, { url: firstUrl, active: true });
      } else {
        await chrome.tabs.create({ url: firstUrl });
      }

      for (const url of restUrls) {
        await chrome.tabs.create({ url, active: false });
      }
    } else {
      for (const url of urlsToOpen) {
        await chrome.tabs.create({ url, active: false });
      }
    }

    return {
      openedCount: urlsToOpen.length,
      reusedCount: reusedTabs.length,
      reusedTabs,
    };
  } catch (err) {
    console.warn('[tab-out] Could not open bookmark URLs:', err);
    throw err;
  }
}

function restoreBookmarkBoardSearchFocus(boardId, selectionStart = null, selectionEnd = null) {
  if (!boardId) return;
  window.requestAnimationFrame(() => {
    const nextInput = document.querySelector(`.bookmark-board-search[data-action="search-bookmark-board"][data-bookmark-board-id="${CSS.escape(boardId)}"]`);
    if (!(nextInput instanceof HTMLInputElement)) return;
    try {
      nextInput.focus({ preventScroll: true });
    } catch {
      nextInput.focus();
    }
    if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
      nextInput.setSelectionRange(selectionStart, selectionEnd);
    }
  });
}

async function applyBookmarkBoardSearchInput(input, { restoreFocus = false } = {}) {
  if (!(input instanceof HTMLInputElement)) return;
  const boardId = input.dataset.bookmarkBoardId;
  if (!boardId) return;
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  setBookmarkBoardSearchQuery(boardId, input.value || '');
  await renderBookmarkBoardSection();
  if (restoreFocus) {
    restoreBookmarkBoardSearchFocus(boardId, selectionStart, selectionEnd);
  }
}

function setBookmarkBoardSearchQuery(boardId, query) {
  bookmarkBoardSearchQueries = {
    ...bookmarkBoardSearchQueries,
    [boardId]: query || '',
  };
  if (boardId === bookmarkBoardConfig.folderId) bookmarkBoardSearchQuery = query || '';
}

async function setBookmarkBoardRootFolder(folderId, { notify = true } = {}) {
  const folder = bookmarkFolders.find(item => item.id === folderId);
  if (!folder) return false;

  const existingBoards = getBookmarkBoardEntries();
  if (existingBoards.some(board => board.folderId === folder.id)) {
    await renderBookmarkBoardSection();
    if (notify) showToast(t('toastBookmarkFolderSaved'));
    return true;
  }
  if (existingBoards.length >= BOOKMARK_BOARD_MAX_ENTRIES) {
    if (notify) showToast(t('toastBookmarkBoardLimitReached'));
    return false;
  }
  const nextBoard = normalizeBookmarkBoardConfigEntry({
    id: folder.id,
    folderId: folder.id,
    folderTitle: getBookmarkFolderDisplayPath(folder),
    currentFolderId: folder.id,
    currentFolderTitle: getBookmarkFolderDisplayName(folder),
  });
  const boards = [...existingBoards, nextBoard];

  await saveBookmarkBoardConfigPreference({
    ...bookmarkBoardConfig,
    boards,
  });
  await setBookmarkBoardCollapsedPreference(false);
  bookmarkBoardSearchQuery = '';
  setBookmarkBoardSearchQuery(folder.id, '');
  bookmarkBoardItems = [];
  bookmarkBoardCurrentFolder = null;
  await renderBookmarkFolderPicker();
  await renderBookmarkBoardSection();
  if (notify) showToast(t('toastBookmarkFolderSaved'));
  return true;
}

async function updateBookmarkBoardEntry(boardId, patch = {}) {
  const boards = getBookmarkBoardEntries().map(board => (
    board.id === boardId || board.folderId === boardId
      ? normalizeBookmarkBoardConfigEntry({ ...board, ...patch })
      : board
  ));
  await saveBookmarkBoardConfigPreference({
    ...bookmarkBoardConfig,
    boards,
  });
}

async function removeBookmarkBoardEntry(boardId) {
  const board = getBookmarkBoardEntry(boardId);
  if (!board) return false;

  const boards = getBookmarkBoardEntries().filter(item => item.id !== board.id && item.folderId !== board.folderId);
  await saveBookmarkBoardConfigPreference({
    ...bookmarkBoardConfig,
    boards,
    folderId: '',
    folderTitle: '',
    currentFolderId: '',
    currentFolderTitle: '',
  });
  delete bookmarkBoardStateById[board.id];
  delete bookmarkBoardSearchQueries[board.id];
  delete bookmarkBoardSearchQueries[board.folderId];
  clearBookmarkBoardSelectionState(board.id);
  await renderBookmarkFolderPicker();
  await renderBookmarkBoardSection();
  showToast(t('toastBookmarkBoardRemoved'));
  return true;
}

async function renderBookmarkFolderPicker() {
  const listEl = document.getElementById('bookmarkFolderList');
  const emptyEl = document.getElementById('bookmarkFolderEmpty');
  const clearBtn = document.getElementById('bookmarkFolderClearBtn');
  const searchInput = document.getElementById('bookmarkFolderSearchInput');
  if (!listEl || !emptyEl || !clearBtn) return;

  if (searchInput) searchInput.value = bookmarkFolderSearchQuery;

  if (bookmarkFolders.length === 0) {
    try {
      await loadBookmarkFolders();
    } catch (err) {
      console.warn('[tab-out] Could not load bookmark folders:', err);
    }
  }

  const query = bookmarkFolderSearchQuery.trim().toLowerCase();
  const filteredFolders = bookmarkFolders.filter(folder => {
    if (!query) return true;
    const haystack = `${folder.title} ${folder.path}`.toLowerCase();
    return haystack.includes(query);
  });

  listEl.innerHTML = filteredFolders.map(renderBookmarkFolderOption).join('');
  const hasFolders = filteredFolders.length > 0;
  listEl.style.display = hasFolders ? 'grid' : 'none';
  emptyEl.style.display = hasFolders ? 'none' : 'block';
  emptyEl.textContent = t('settingsBookmarkFolderEmpty');
  clearBtn.hidden = getBookmarkBoardEntries().length === 0;
  clearBtn.textContent = t('settingsBookmarkFolderClear');
}

function renderBookmarkBoardCard(item, boardId = '', options = {}) {
  const safeTitle = escapeHtml(item.title);
  const safeUrl = escapeHtml(item.url);
  const safeId = escapeHtml(item.id);
  const safeBoardId = escapeHtml(boardId);
  const faviconUrl = escapeHtml(getFaviconSource(item.url, item.title, 32));
  const isSelectionMode = !!options.isSelectionMode;
  const isSelected = !!options.isSelected;

  return `
    <div class="bookmark-board-card bookmark-board-site-card${isSelectionMode ? ' is-selection-mode' : ''}${isSelected ? ' is-selected' : ''}" title="${safeTitle}">
      ${isSelectionMode ? `
        <button type="button" class="bookmark-board-select-toggle${isSelected ? ' is-selected' : ''}" data-action="toggle-bookmark-board-selection" data-bookmark-id="${safeId}" data-bookmark-board-id="${safeBoardId}" aria-pressed="${isSelected ? 'true' : 'false'}" title="${escapeHtml(t('bookmarkBoardBatchItemToggle'))}" aria-label="${escapeHtml(t('bookmarkBoardBatchItemToggle'))}">
          <span class="bookmark-board-select-indicator" aria-hidden="true"></span>
        </button>
      ` : ''}
      <button type="button" class="bookmark-board-card-main" data-action="${isSelectionMode ? 'toggle-bookmark-board-selection' : 'open-bookmark-board-item'}" data-bookmark-id="${safeId}" data-bookmark-board-id="${safeBoardId}" data-bookmark-url="${safeUrl}">
        <div class="bookmark-board-card-favicon">
          <img src="${faviconUrl}" alt="" data-hide-on-error="true" data-show-fallback-on-error="next">
          <span class="bookmark-board-card-fallback" style="display:none">${escapeHtml(getQuickLinkMonogram(item.title, item.url).slice(0, 2) || 'BK')}</span>
        </div>
        <div class="bookmark-board-card-copy">
          <div class="bookmark-board-card-title">${safeTitle}</div>
        </div>
      </button>
      <button type="button" class="bookmark-board-delete${isSelectionMode ? ' is-hidden' : ''}" data-action="delete-bookmark-board-item" data-bookmark-id="${safeId}" data-bookmark-board-id="${safeBoardId}" title="${escapeHtml(t('bookmarkBoardDelete'))}" aria-label="${escapeHtml(t('bookmarkBoardDelete'))}"${isSelectionMode ? ' tabindex="-1"' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.1" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>`;
}

function renderBookmarkBoardFolderCard(item, boardId = '') {
  const safeTitle = escapeHtml(item.title);
  const safeId = escapeHtml(item.id);
  const safeBoardId = escapeHtml(boardId);

  return `
    <div class="bookmark-board-card bookmark-board-folder-card" title="${safeTitle}">
      <button type="button" class="bookmark-board-card-main" data-action="open-bookmark-board-folder" data-bookmark-folder-id="${safeId}" data-bookmark-board-id="${safeBoardId}">
        <div class="bookmark-board-card-favicon bookmark-board-folder-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h3.18c.6 0 1.176.238 1.6.663l1.057 1.057c.424.424 1 .662 1.6.662H18A2.25 2.25 0 0 1 20.25 9.132V17.25A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25V6.75Z" />
          </svg>
        </div>
        <div class="bookmark-board-card-copy">
          <div class="bookmark-board-card-title">${safeTitle}</div>
        </div>
        <span class="bookmark-board-folder-arrow" aria-hidden="true">›</span>
      </button>
    </div>`;
}

function renderBookmarkCollectionCard(collection) {
  const safeId = escapeHtml(collection.id);
  const safeName = escapeHtml(collection.name);
  const boardTitle = collection.boardTitle ? escapeHtml(collection.boardTitle) : '';
  const countText = escapeHtml(t('bookmarkCollectionCount', collection.items.length));
  const titleAttr = boardTitle ? `${safeName} · ${boardTitle}` : safeName;

  return `
    <article class="bookmark-collection-card" title="${titleAttr}">
      <button type="button" class="bookmark-collection-card-main" data-action="open-bookmark-collection-detail" data-bookmark-collection-id="${safeId}" aria-label="${escapeHtml(t('bookmarkCollectionViewDetail'))}">
        <div class="bookmark-collection-card-copy">
          <div class="bookmark-collection-card-title">${safeName}</div>
          <div class="bookmark-collection-card-meta">${countText}</div>
        </div>
      </button>
      <div class="bookmark-collection-card-actions">
        <button type="button" class="bookmark-collection-card-btn is-primary" data-action="open-bookmark-collection" data-bookmark-collection-id="${safeId}">
          ${escapeHtml(t('bookmarkCollectionOpen'))}
        </button>
        <button type="button" class="bookmark-collection-card-btn is-danger" data-action="delete-bookmark-collection" data-bookmark-collection-id="${safeId}" title="${escapeHtml(t('bookmarkCollectionDelete'))}" aria-label="${escapeHtml(t('bookmarkCollectionDelete'))}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.9" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.088-2.201a51.964 51.964 0 0 0-3.324 0C9.16 2.313 8.25 3.296 8.25 4.477v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </article>`;
}

function renderBookmarkCollectionSection() {
  if (bookmarkCollections.length === 0) return '';

  return `
    <section class="bookmark-collection-shell">
      <div class="bookmark-collection-header">
        <div class="bookmark-collection-heading">
          <h3>${escapeHtml(t('bookmarkCollectionTitle'))}</h3>
          <p>${escapeHtml(t('bookmarkCollectionSubtitle'))}</p>
        </div>
      </div>
      <div class="bookmark-collection-grid">
        ${bookmarkCollections.map(renderBookmarkCollectionCard).join('')}
      </div>
    </section>`;
}

function renderBookmarkBoardGroupShell({ board, currentFolder, items, filteredItems }) {
  const boardId = escapeHtml(board.id);
  const currentTitle = currentFolder?.title || board.currentFolderTitle || board.folderTitle;
  const folderCount = items.filter(item => item.type === 'folder').length;
  const bookmarkCount = items.filter(item => item.type !== 'folder').length;
  const metaText = folderCount > 0
    ? t('bookmarkBoardMetaWithFolders', currentTitle, bookmarkCount, folderCount)
    : t('bookmarkBoardMetaSelected', currentTitle, bookmarkCount);
  const canGoBack = !!board.currentFolderId && board.currentFolderId !== board.folderId;
  const query = getBookmarkBoardSearchQuery(board.id);
  const selectionState = getBookmarkBoardSelectionState(board.id);
  const isSelectionMode = selectionState.isSelectionMode;
  const selectedIds = selectionState.selectedIds;
  const bookmarkItems = getBookmarkItemsForBatchActions(filteredItems);
  const selectedCount = bookmarkItems.filter(item => selectedIds.includes(item.id)).length;
  const canOpenSelected = selectedCount > 0;
  const canOpenAll = bookmarkItems.length > 0;
  const allSelected = canOpenAll && selectedCount === bookmarkItems.length;
  const hasSingleItem = filteredItems.length === 1;
  const bodyHtml = filteredItems.length === 0
    ? `<div class="bookmark-board-group-empty">${escapeHtml(items.length === 0 ? t('bookmarkBoardEmptyFolder') : t('bookmarkBoardEmptyNoResults'))}</div>`
    : `<div class="bookmark-board-list bookmark-board-group-list${hasSingleItem ? ' is-single-item' : ''}">
        ${filteredItems.map(item => item.type === 'folder'
          ? renderBookmarkBoardFolderCard(item, board.id)
          : renderBookmarkBoardCard(item, board.id, {
              isSelectionMode,
              isSelected: selectedIds.includes(item.id),
            })
        ).join('')}
      </div>`;

  return `
    <div class="bookmark-board-group${isSelectionMode ? ' is-selection-mode' : ''}" data-bookmark-board-id="${boardId}">
      <div class="bookmark-board-group-header">
        <div class="bookmark-board-group-copy">
          <div class="bookmark-board-group-title">${escapeHtml(currentTitle || board.folderTitle)}</div>
          <div class="bookmark-board-group-meta">${escapeHtml(metaText)}</div>
        </div>
        <div class="bookmark-board-group-tools">
          <button type="button" class="bookmark-board-batch-toggle${isSelectionMode ? ' is-active' : ''}" data-action="${isSelectionMode ? 'cancel-bookmark-board-selection-mode' : 'enter-bookmark-board-selection-mode'}" data-bookmark-board-id="${boardId}">
            ${escapeHtml(isSelectionMode ? t('bookmarkBoardBatchCancel') : t('bookmarkBoardBatchSelect'))}
          </button>
          ${canGoBack ? `<button type="button" class="bookmark-board-back" data-action="bookmark-board-go-up" data-bookmark-board-id="${boardId}">${escapeHtml(t('bookmarkBoardBack'))}</button>` : ''}
          <label class="bookmark-board-search-shell bookmark-board-group-search">
            <input type="search" class="bookmark-board-search" data-action="search-bookmark-board" data-bookmark-board-id="${boardId}" placeholder="${escapeHtml(t('bookmarkBoardSearchPlaceholder'))}" value="${escapeHtml(query)}">
          </label>
          <button type="button" class="bookmark-board-remove" data-action="remove-bookmark-board" data-bookmark-board-id="${boardId}" title="${escapeHtml(t('bookmarkBoardRemove'))}" aria-label="${escapeHtml(t('bookmarkBoardRemove'))}">×</button>
        </div>
      </div>
      ${isSelectionMode ? `
        <div class="bookmark-board-batch-bar">
          <div class="bookmark-board-batch-summary">
            <div class="bookmark-board-batch-meta">${escapeHtml(t('bookmarkBoardBatchSelectedCount', selectedCount))}</div>
            <div class="bookmark-board-batch-hint">${escapeHtml(t('bookmarkBoardBatchHint'))}</div>
          </div>
          <div class="bookmark-board-batch-actions">
            <button type="button" class="bookmark-board-batch-btn" data-action="${allSelected ? 'clear-all-bookmark-board-selection' : 'select-all-bookmark-board-items'}" data-bookmark-board-id="${boardId}"${canOpenAll ? '' : ' disabled'}>
              ${escapeHtml(allSelected ? t('bookmarkBoardBatchClear') : t('bookmarkBoardBatchSelectAll'))}
            </button>
            <button type="button" class="bookmark-board-batch-btn" data-action="save-bookmark-collection" data-bookmark-board-id="${boardId}"${canOpenSelected ? '' : ' disabled'}>
              ${escapeHtml(t('bookmarkBoardBatchSaveCollection'))}
            </button>
            <button type="button" class="bookmark-board-batch-btn" data-action="open-all-bookmark-board-items" data-bookmark-board-id="${boardId}"${canOpenAll ? '' : ' disabled'}>
              ${escapeHtml(t('bookmarkBoardBatchOpenAll'))}
            </button>
            <button type="button" class="bookmark-board-batch-btn is-primary" data-action="open-selected-bookmark-board-items" data-bookmark-board-id="${boardId}"${canOpenSelected ? '' : ' disabled'}>
              ${escapeHtml(t('bookmarkBoardBatchOpenSelected'))}
            </button>
          </div>
        </div>
      ` : ''}
      <div class="bookmark-board-group-body">
        ${bodyHtml}
      </div>
    </div>`;
}

async function renderBookmarkBoardSection() {
  const sectionEl = document.getElementById('bookmarkBoardSection');
  const listEl = document.getElementById('bookmarkBoardList');
  const emptyEl = document.getElementById('bookmarkBoardEmpty');
  const collectionEl = document.getElementById('bookmarkCollectionList');
  const metaEl = document.getElementById('bookmarkBoardMeta');
  const searchShell = document.getElementById('bookmarkBoardSearchShell');
  const searchInput = document.getElementById('bookmarkBoardSearchInput');
  const addBtn = document.getElementById('bookmarkBoardAddBtn');
  const backBtn = document.getElementById('bookmarkBoardBackBtn');
  const toggleBtn = document.getElementById('bookmarkBoardToggleBtn');
  if (!sectionEl || !listEl || !emptyEl || !metaEl || !searchShell || !searchInput || !collectionEl) return;

  searchInput.placeholder = t('bookmarkBoardSearchPlaceholder');
  searchInput.value = bookmarkBoardSearchQuery;
  if (backBtn) backBtn.textContent = t('bookmarkBoardBack');
  if (toggleBtn) {
    const toggleLabel = isBookmarkBoardCollapsed ? t('bookmarkBoardExpand') : t('bookmarkBoardCollapse');
    toggleBtn.textContent = toggleLabel;
    toggleBtn.title = toggleLabel;
    toggleBtn.setAttribute('aria-label', toggleLabel);
    toggleBtn.setAttribute('aria-expanded', isBookmarkBoardCollapsed ? 'false' : 'true');
  }
  sectionEl.classList.toggle('is-collapsed', isBookmarkBoardCollapsed);
  const totalBoards = getBookmarkBoardEntries().length;
  const isAtBoardLimit = totalBoards >= BOOKMARK_BOARD_MAX_ENTRIES;
  if (addBtn) {
    addBtn.textContent = t('bookmarkBoardAdd');
    addBtn.title = t('bookmarkBoardAdd');
    addBtn.setAttribute('aria-label', t('bookmarkBoardAdd'));
    addBtn.style.display = isBookmarkBoardCollapsed || totalBoards === 0 ? 'none' : 'inline-flex';
    addBtn.disabled = isAtBoardLimit;
    addBtn.classList.toggle('is-disabled', isAtBoardLimit);
  }

  if (isBookmarkBoardCollapsed) {
    sectionEl.style.display = 'block';
    listEl.classList.remove('has-multiple-boards');
    listEl.innerHTML = '';
    collectionEl.style.display = 'none';
    collectionEl.innerHTML = '';
    emptyEl.style.display = 'none';
    searchShell.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    metaEl.textContent = bookmarkBoardConfig.folderId
      ? (bookmarkBoardConfig.currentFolderTitle || bookmarkBoardConfig.folderTitle)
      : '';
    return;
  }

  const boards = getVisibleBookmarkBoardEntries();

  if (boards.length === 0) {
    sectionEl.style.display = 'block';
    listEl.classList.remove('has-multiple-boards');
    collectionEl.style.display = bookmarkCollections.length > 0 ? 'block' : 'none';
    collectionEl.innerHTML = renderBookmarkCollectionSection();
    metaEl.textContent = '';
    searchShell.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = `
      <div class="bookmark-board-empty-copy">
        <div class="bookmark-board-empty-title">${escapeHtml(t('bookmarkBoardEmptyTitle'))}</div>
        <p>${escapeHtml(t('bookmarkBoardEmpty'))}</p>
      </div>
      <button type="button" class="bookmark-board-empty-action" data-action="open-bookmark-folder-settings">
        <span class="bookmark-board-empty-action-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.9" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h3.18c.6 0 1.176.238 1.6.663l1.057 1.057c.424.424 1 .662 1.6.662H18A2.25 2.25 0 0 1 20.25 9.132V17.25A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25V6.75Z" />
          </svg>
        </span>
        <span>${escapeHtml(t('bookmarkBoardEmptyAction'))}</span>
        <span class="bookmark-board-empty-action-arrow" aria-hidden="true">›</span>
      </button>
    `;
    return;
  }

  if (bookmarkFolders.length === 0) {
    try {
      await loadBookmarkFolders();
    } catch (err) {
      console.warn('[tab-out] Could not load bookmark folders:', err);
    }
  }
  listEl.classList.toggle('has-multiple-boards', boards.length > 1);
  collectionEl.style.display = bookmarkCollections.length > 0 ? 'block' : 'none';
  collectionEl.innerHTML = renderBookmarkCollectionSection();
  searchShell.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';
  metaEl.textContent = totalBoards > 1
    ? t('bookmarkBoardVisibleCountMeta', Math.min(totalBoards, bookmarkBoardDisplayLimit), totalBoards)
    : '';
  emptyEl.style.display = 'none';

  const groupHtml = [];
  for (const board of boards) {
    const { items, currentFolder } = await loadBookmarkBoardItems(board);
    bookmarkBoardStateById[board.id] = { items, currentFolder };
    const query = getBookmarkBoardSearchQuery(board.id).trim().toLowerCase();
    let filteredItems = items;

    if (query) {
      const searchFolderId = currentFolder?.id || board.currentFolderId || board.folderId;
      const searchBaseTitle = currentFolder?.title || board.currentFolderTitle || board.folderTitle || '';
      const allBookmarks = await searchBookmarksInFolderTree(searchFolderId, searchBaseTitle);
      filteredItems = allBookmarks.filter(item => {
        const haystack = `${item.title} ${item.url}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    groupHtml.push(renderBookmarkBoardGroupShell({ board, currentFolder, items, filteredItems }));
  }

  listEl.innerHTML = groupHtml.join('');
}

function syncQuickLinkModalText() {
  const titleEl = document.getElementById('quickLinkModalTitle');
  const submitBtn = document.getElementById('quickLinkSubmitBtn');
  const idInput = document.getElementById('quickLinkId');
  const isEditing = !!idInput?.value;

  if (titleEl) titleEl.textContent = isEditing ? t('quickLinkModalEditTitle') : t('quickLinkModalAddTitle');
  if (submitBtn) submitBtn.textContent = isEditing ? t('quickLinkUpdate') : t('quickLinkSave');
}

function closeQuickLinkModal() {
  const backdrop = document.getElementById('quickLinkModalBackdrop');
  const form = document.getElementById('quickLinkForm');
  const idInput = document.getElementById('quickLinkId');
  if (backdrop) backdrop.style.display = 'none';
  if (form) form.reset();
  if (idInput) idInput.value = '';
  syncQuickLinkModalText();
}

function closeBookmarkCollectionModal() {
  const backdrop = document.getElementById('bookmarkCollectionModalBackdrop');
  const form = document.getElementById('bookmarkCollectionForm');
  const boardIdInput = document.getElementById('bookmarkCollectionBoardId');
  const existingSelect = document.getElementById('bookmarkCollectionExistingSelect');
  if (backdrop) backdrop.style.display = 'none';
  if (form) form.reset();
  if (boardIdInput) boardIdInput.value = '';
  if (existingSelect instanceof HTMLInputElement) existingSelect.value = '';
  bookmarkCollectionModalMode = 'create';
  closeBookmarkCollectionSelectMenu();
  syncBookmarkCollectionModalText();
}

function openBookmarkCollectionModal(boardId = '') {
  const backdrop = document.getElementById('bookmarkCollectionModalBackdrop');
  const boardIdInput = document.getElementById('bookmarkCollectionBoardId');
  const nameInput = document.getElementById('bookmarkCollectionNameInput');
  if (!backdrop || !boardIdInput || !nameInput) return;

  boardIdInput.value = boardId;
  bookmarkCollectionModalMode = bookmarkCollections.length > 0 ? 'append' : 'create';
  backdrop.style.display = 'flex';
  syncBookmarkCollectionModalText();
  setTimeout(() => {
    if (bookmarkCollectionModalMode === 'append') {
      const trigger = document.getElementById('bookmarkCollectionSelectTrigger');
      if (trigger instanceof HTMLButtonElement) trigger.focus();
      return;
    }
    nameInput.focus();
  }, 0);
}

function closeBookmarkCollectionDetailModal() {
  activeBookmarkCollectionId = '';
  const backdrop = document.getElementById('bookmarkCollectionDetailBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function openBookmarkCollectionDetailModal(collectionId = '') {
  const collection = getBookmarkCollectionById(collectionId);
  const backdrop = document.getElementById('bookmarkCollectionDetailBackdrop');
  if (!collection || !backdrop) return;

  activeBookmarkCollectionId = collection.id;
  backdrop.style.display = 'flex';
  syncBookmarkCollectionDetailModal();
  setTimeout(() => {
    const openBtn = document.getElementById('bookmarkCollectionDetailOpenBtn');
    if (openBtn instanceof HTMLButtonElement && !openBtn.disabled) openBtn.focus();
  }, 0);
}

function closeSessionModal() {
  const backdrop = document.getElementById('sessionModalBackdrop');
  const form = document.getElementById('sessionForm');
  const idInput = document.getElementById('sessionIdInput');
  const pinnedInput = document.getElementById('sessionPinnedInput');
  if (backdrop) backdrop.style.display = 'none';
  if (form) form.reset();
  if (idInput) idInput.value = '';
  if (pinnedInput instanceof HTMLInputElement) pinnedInput.checked = false;
  sessionModalMode = 'create';
  syncSessionModalText();
}

async function openSessionModal(sessionId = '') {
  const backdrop = document.getElementById('sessionModalBackdrop');
  const idInput = document.getElementById('sessionIdInput');
  const nameInput = document.getElementById('sessionNameInput');
  const pinnedInput = document.getElementById('sessionPinnedInput');
  if (!backdrop || !(idInput instanceof HTMLInputElement) || !(nameInput instanceof HTMLInputElement) || !(pinnedInput instanceof HTMLInputElement)) return;

  sessionModalMode = sessionId ? 'edit' : 'create';
  idInput.value = sessionId;
  nameInput.value = '';
  pinnedInput.checked = false;

  if (sessionId) {
    const sessions = await getTabSessions();
    const session = sessions.find(item => item.id === sessionId);
    if (!session) return;
    nameInput.value = session.name || getSessionTitle(session);
    pinnedInput.checked = !!session.pinned;
  }

  backdrop.style.display = 'flex';
  syncSessionModalText();
  setTimeout(() => {
    nameInput.focus();
    nameInput.select();
  }, 0);
}

function closeConfirmModal() {
  pendingConfirmAction = null;
  const backdrop = document.getElementById('confirmModalBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function openConfirmModal({ title, body, onConfirm, confirmLabel = '', eyebrow = '' }) {
  const backdrop = document.getElementById('confirmModalBackdrop');
  const titleEl = document.getElementById('confirmModalTitle');
  const bodyEl = document.getElementById('confirmModalBody');
  const eyebrowEl = document.getElementById('confirmModalEyebrow');
  const cancelBtn = document.getElementById('confirmModalCancelBtn');
  const confirmBtn = document.getElementById('confirmModalConfirmBtn');
  if (!backdrop || !titleEl || !bodyEl || !eyebrowEl || !cancelBtn || !confirmBtn) return;

  pendingConfirmAction = typeof onConfirm === 'function' ? onConfirm : null;
  titleEl.textContent = title || '';
  bodyEl.textContent = body || '';
  eyebrowEl.textContent = eyebrow || t('confirmDialogEyebrow');
  cancelBtn.textContent = t('confirmDialogCancel');
  confirmBtn.textContent = confirmLabel || t('confirmDialogConfirm');
  backdrop.style.display = 'flex';
}

function openQuickLinkModal(linkId = '', prefill = {}) {
  const backdrop = document.getElementById('quickLinkModalBackdrop');
  const idInput = document.getElementById('quickLinkId');
  const nameInput = document.getElementById('quickLinkNameInput');
  const urlInput = document.getElementById('quickLinkUrlInput');
  const link = quickLinks.find(item => item.id === linkId);

  if (!backdrop || !idInput || !nameInput || !urlInput) return;

  idInput.value = link?.id || '';
  nameInput.value = typeof prefill.title === 'string' && prefill.title ? prefill.title : (link?.title || '');
  urlInput.value = typeof prefill.url === 'string' && prefill.url ? prefill.url : (link?.url || '');
  backdrop.style.display = 'flex';
  syncQuickLinkModalText({ title: nameInput.value, url: urlInput.value });
  setTimeout(() => {
    if (!linkId && !prefill.title) nameInput.focus();
    else if (!linkId) urlInput.focus();
  }, 0);
}

async function openQuickLink(url) {
  const targetUrl = normalizeQuickLinkUrl(url);
  if (quickLinksOpenMode === 'new-tab') {
    await chrome.tabs.create({ url: targetUrl });
    return;
  }

  const currentTab = await chrome.tabs.getCurrent();

  if (currentTab?.id) {
    await chrome.tabs.update(currentTab.id, { url: targetUrl, active: true });
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    await chrome.tabs.update(activeTab.id, { url: targetUrl, active: true });
    return;
  }

  await chrome.tabs.create({ url: targetUrl });
}

/**
 * fetchOpenTabs()
 *
 * Reads all currently open browser tabs directly from Chrome.
 * Sets the extensionId flag so we can identify TabNest's own pages.
 */
async function fetchOpenTabs() {
  try {
    const extensionId = chrome.runtime.id;
    // The new URL for this page is now index.html (not newtab.html)
    const newtabUrl = `chrome-extension://${extensionId}/index.html`;

    const tabs = await chrome.tabs.query({});
    openTabs = tabs.map(t => {
      const resolvedUrl = getResolvedTabUrl(t);
      return {
        id:       t.id,
        url:      resolvedUrl,
        title:    getResolvedTabTitle(t),
        windowId: t.windowId,
        index:    Number.isFinite(t.index) ? t.index : 0,
        favIconUrl: t.favIconUrl,
        active:   t.active,
        pinned:   !!t.pinned,
        // Flag TabNest's own pages so we can detect duplicate new tabs
        isTabOut: resolvedUrl === newtabUrl || resolvedUrl === 'chrome://newtab/',
      };
    });
  } catch {
    // chrome.tabs API unavailable (shouldn't happen in an extension page)
    openTabs = [];
  }
}

/**
 * closeTabsByUrls(urls)
 *
 * Closes all open tabs whose hostname matches any of the given URLs.
 * After closing, re-fetches the tab list to keep our state accurate.
 *
 * Special case: file:// URLs are matched exactly (they have no hostname).
 */
async function closeTabsByUrls(urls) {
  if (!urls || urls.length === 0) return;

  // Separate file:// URLs (exact match) from regular URLs (hostname match)
  const targetHostnames = [];
  const exactUrls = new Set();

  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u);
    } else {
      try { targetHostnames.push(new URL(u).hostname); }
      catch { /* skip unparseable */ }
    }
  }

  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs
    .filter(tab => {
      const tabUrl = tab.url || '';
      if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
      try {
        const tabHostname = new URL(tabUrl).hostname;
        return tabHostname && targetHostnames.includes(tabHostname);
      } catch { return false; }
    })
    .map(tab => tab.id);

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabsExact(urls)
 *
 * Closes tabs by exact URL match (not hostname). Used for landing pages
 * so closing "Gmail inbox" doesn't also close individual email threads.
 */
async function closeTabsExact(urls) {
  if (!urls || urls.length === 0) return;
  const urlSet = new Set(urls);
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(t => urlSet.has(t.url)).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * focusTab(url)
 *
 * Switches Chrome to the tab with the given URL (exact match first,
 * then hostname fallback). Also brings the window to the front.
 */
async function focusTab(url) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  // Try exact URL match first
  let matches = allTabs.filter(t => t.url === url);

  // Fall back to hostname match
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }

  if (matches.length === 0) return;

  // Prefer a match in a different window so it actually switches windows
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

async function focusTabById(tabId) {
  if (!Number.isFinite(tabId)) return;
  const allTabs = await chrome.tabs.query({});
  const match = allTabs.find(tab => tab.id === tabId);
  if (!match) return;

  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

async function moveTabWithinWindow(draggedTabId, targetTabId, insertAfter = false) {
  if (!Number.isFinite(draggedTabId) || !Number.isFinite(targetTabId) || draggedTabId === targetTabId) return false;

  const allTabs = await chrome.tabs.query({});
  const draggedTab = allTabs.find(tab => tab.id === draggedTabId);
  const targetTab = allTabs.find(tab => tab.id === targetTabId);
  if (!draggedTab || !targetTab) return false;
  if (draggedTab.windowId !== targetTab.windowId) {
    throw new Error('cross-window-not-supported');
  }

  let nextIndex = targetTab.index + (insertAfter ? 1 : 0);
  if (draggedTab.index < nextIndex) nextIndex -= 1;
  if (draggedTab.index === nextIndex) return false;

  await chrome.tabs.move(draggedTab.id, { windowId: draggedTab.windowId, index: nextIndex });
  await fetchOpenTabs();
  return true;
}

/**
 * closeDuplicateTabs(urls, keepOne)
 *
 * Closes duplicate tabs for the given list of URLs.
 * keepOne=true → keep one copy of each, close the rest.
 * keepOne=false → close all copies.
 */
async function closeDuplicateTabs(urls, keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const toClose = [];

  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== keep.id) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabOutDupes()
 *
 * Closes all duplicate TabNest new-tab pages except the current one.
 */
async function closeTabOutDupes() {
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;

  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();
  const tabOutTabs = allTabs.filter(t =>
    t.url === newtabUrl || t.url === 'chrome://newtab/'
  );

  if (tabOutTabs.length <= 1) return;

  // Keep the active TabNest tab in the CURRENT window — that's the one the
  // user is looking at right now. Falls back to any active one, then the first.
  const keep =
    tabOutTabs.find(t => t.active && t.windowId === currentWindow.id) ||
    tabOutTabs.find(t => t.active) ||
    tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}


/* ----------------------------------------------------------------
   SAVED FOR LATER — chrome.storage.local

   Replaces the old server-side SQLite + REST API with Chrome's
   built-in key-value storage. Data persists across browser sessions
   and doesn't require a running server.

   Data shape stored under the "deferred" key:
   [
     {
       id: "1712345678901",          // timestamp-based unique ID
       url: "https://example.com",
       title: "Example Page",
       savedAt: "2026-04-04T10:00:00.000Z",  // ISO date string
       completed: false,             // true = checked off (archived)
       dismissed: false              // true = dismissed without reading
     },
     ...
   ]
   ---------------------------------------------------------------- */

/**
 * saveTabForLater(tab)
 *
 * Saves a single tab to the "Saved for Later" list in chrome.storage.local.
 * @param {{ url: string, title: string }} tab
 */
async function saveTabForLater(tab) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  deferred.push({
    id:        Date.now().toString(),
    url:       tab.url,
    title:     tab.title,
    savedAt:   new Date().toISOString(),
    completed: false,
    dismissed: false,
  });
  await chrome.storage.local.set({ deferred });
}

/**
 * getSavedTabs()
 *
 * Returns all saved tabs from chrome.storage.local.
 * Filters out dismissed items (those are gone for good).
 * Splits into active (not completed) and archived (completed).
 */
async function getSavedTabs() {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const visible = deferred.filter(t => !t.dismissed);
  return {
    active:   visible.filter(t => !t.completed),
    archived: visible.filter(t => t.completed),
  };
}

/**
 * checkOffSavedTab(id)
 *
 * Marks a saved tab as completed (checked off). It moves to the archive.
 */
async function checkOffSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.completed = true;
    tab.completedAt = new Date().toISOString();
    await chrome.storage.local.set({ deferred });
  }
}

/**
 * dismissSavedTab(id)
 *
 * Marks a saved tab as dismissed (removed from all lists).
 */
async function dismissSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.dismissed = true;
    await chrome.storage.local.set({ deferred });
  }
}

function getResolvedTabUrl(tab) {
  return String(tab?.url || tab?.pendingUrl || '').trim();
}

function getResolvedTabTitle(tab) {
  const url = getResolvedTabUrl(tab);
  return String(tab?.title || url).trim();
}

function isRealWebTab(tab) {
  const url = getResolvedTabUrl(tab);
  return (
    !!url &&
    !isBlockedSessionRestoreUrl(url)
  );
}

function isBlockedSessionRestoreUrl(url) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return true;
  return (
    normalizedUrl.startsWith('chrome://') ||
    normalizedUrl.startsWith('chrome-extension://') ||
    normalizedUrl.startsWith('about:') ||
    normalizedUrl.startsWith('edge://') ||
    normalizedUrl.startsWith('brave://') ||
    normalizedUrl.startsWith('file://') ||
    normalizedUrl.startsWith('devtools://')
  );
}

function normalizeSessionTab(tab, index = 0) {
  return {
    url: String(tab.url || '').trim(),
    title: String(tab.title || tab.url || '').trim(),
    windowId: Number.isFinite(tab.windowId) ? tab.windowId : 0,
    favIconUrl: String(tab.favIconUrl || '').trim(),
    order: Number.isFinite(tab.order) ? tab.order : index,
  };
}

function normalizeTabSession(session, index = 0) {
  const tabs = Array.isArray(session.tabs)
    ? session.tabs.map((tab, tabIndex) => normalizeSessionTab(tab, tabIndex)).filter(tab => tab.url)
    : [];
  const sourceType = ['all-windows', 'window-session', 'tab-group'].includes(session.sourceType)
    ? session.sourceType
    : 'current-window';

  return {
    id: session.id || `session-${Date.now()}-${index}`,
    createdAt: session.createdAt || new Date().toISOString(),
    sourceType,
    name: String(session.name || '').trim(),
    pinned: !!session.pinned,
    tabs,
  };
}

function sortTabSessions(list) {
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function getTabSessions() {
  const { [TAB_SESSIONS_STORAGE_KEY]: stored = [] } = await chrome.storage.local.get(TAB_SESSIONS_STORAGE_KEY);
  return sortTabSessions(stored.map((session, index) => normalizeTabSession(session, index)).filter(session => session.tabs.length > 0));
}

async function saveTabSessions(list) {
  const sessions = sortTabSessions(list.map((session, index) => normalizeTabSession(session, index)).filter(session => session.tabs.length > 0));
  await chrome.storage.local.set({ [TAB_SESSIONS_STORAGE_KEY]: sessions });
  return sessions;
}

function getSessionWindowCount(session) {
  return new Set((session.tabs || []).map(tab => tab.windowId).filter(Boolean)).size || 1;
}

function getSessionTopDomains(session, limit = 3) {
  const counts = new Map();

  for (const tab of session.tabs || []) {
    try {
      const domain = friendlyDomain(new URL(tab.url).hostname);
      counts.set(domain, (counts.get(domain) || 0) + 1);
    } catch {
      // Ignore malformed URLs.
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([domain]) => domain);
}

function getSessionTitle(session) {
  if (session?.name) return session.name;
  const sourceLabel = session.sourceType === 'all-windows'
    ? t('sessionSourceAllWindows')
    : session.sourceType === 'window-session'
      ? t('sessionSourceWindowSession')
      : t('sessionSourceCurrentWindow');
  const topDomains = getSessionTopDomains(session, 2);
  return topDomains.length > 0 ? `${sourceLabel} · ${topDomains.join(' / ')}` : sourceLabel;
}

async function queryRealTabsSnapshot() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter(isRealWebTab).map(tab => ({
    id: tab.id,
    url: getResolvedTabUrl(tab),
    title: getResolvedTabTitle(tab),
    windowId: tab.windowId,
    favIconUrl: tab.favIconUrl,
    active: tab.active,
    pinned: tab.pinned,
    order: Number.isFinite(tab.index) ? tab.index : 0,
  }));
}

async function stashTabsAsSession(tabs, sourceType) {
  if (!tabs || tabs.length === 0) return null;

  const sessions = await getTabSessions();
  const nextSession = normalizeTabSession({
    id: `session-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sourceType,
    name: '',
    pinned: false,
    tabs,
  }, sessions.length);

  await saveTabSessions([nextSession, ...sessions]);

  const tabIds = tabs.map(tab => tab.id).filter(Number.isFinite);
  if (tabIds.length > 0) {
    await chrome.tabs.remove(tabIds);
  }

  await fetchOpenTabs();
  return nextSession;
}

async function packAllSessionsAsTabGroup() {
  const sessions = await getTabSessions();
  if (sessions.length < 1) {
    showToast(t('toastSessionTabGroupEmpty'));
    return null;
  }

  const seen = new Set();
  const mergedTabs = [];
  for (const session of sessions) {
    for (const tab of session.tabs || []) {
      const url = String(tab.url || '').trim();
      if (!url || isBlockedSessionRestoreUrl(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      mergedTabs.push({
        url,
        title: String(tab.title || url).trim(),
        favIconUrl: String(tab.favIconUrl || '').trim(),
        windowId: Number.isFinite(tab.windowId) ? tab.windowId : 0,
        order: mergedTabs.length,
      });
    }
  }

  if (mergedTabs.length === 0) {
    showToast(t('toastSessionTabGroupEmpty'));
    return null;
  }

  const latest = sessions[0];
  const baseName = String(latest?.name || getSessionTitle(latest) || '').trim();
  const defaultName = t('sessionTabGroupDefaultName', baseName || new Date().toLocaleString());

  const nextSession = normalizeTabSession({
    id: `tabgroup-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sourceType: 'tab-group',
    name: defaultName,
    pinned: false,
    tabs: mergedTabs,
  }, 0);

  await saveTabSessions([nextSession, ...sessions]);
  return nextSession;
}

function buildSessionWindowGroups(tabs) {
  const groups = new Map();

  for (const tab of tabs || []) {
    const key = Number.isFinite(tab.windowId) && tab.windowId > 0 ? tab.windowId : 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tab);
  }

  return [...groups.entries()]
    .map(([windowId, windowTabs]) => ({
      windowId,
      tabs: [...windowTabs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      firstOrder: Math.min(...windowTabs.map(tab => Number.isFinite(tab.order) ? tab.order : 0)),
    }))
    .sort((a, b) => a.firstOrder - b.firstOrder || a.windowId - b.windowId);
}

async function stashWindowsAsSessions(tabs) {
  if (!tabs || tabs.length === 0) return [];

  const windowGroups = buildSessionWindowGroups(tabs);
  if (windowGroups.length === 0) return [];

  const sessions = await getTabSessions();
  const baseTimestamp = Date.now();
  const nextSessions = windowGroups.map((group, index) => normalizeTabSession({
    id: `session-${baseTimestamp}-${group.windowId || index}`,
    createdAt: new Date(baseTimestamp + index).toISOString(),
    sourceType: 'window-session',
    name: '',
    pinned: false,
    tabs: group.tabs,
  }, sessions.length + index));

  await saveTabSessions([...nextSessions, ...sessions]);

  const tabIds = tabs.map(tab => tab.id).filter(Number.isFinite);
  if (tabIds.length > 0) {
    await chrome.tabs.remove(tabIds);
  }

  await fetchOpenTabs();
  return nextSessions;
}

async function restoreTabsIntoCurrentWindow(tabs) {
  const currentWindow = await chrome.windows.getCurrent();
  const created = [];
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index];
    if (!tab?.url || isBlockedSessionRestoreUrl(tab.url)) continue;
    const opened = await chrome.tabs.create({
      windowId: currentWindow.id,
      url: tab.url,
      active: index === 0,
    });
    if (opened) created.push(opened);
  }
  return created;
}

async function restoreSession(sessionId) {
  const sessions = await getTabSessions();
  const session = sessions.find(item => item.id === sessionId);
  if (!session) throw new Error('session-not-found');

  const windowGroups = buildSessionWindowGroups(session.tabs);
  const restoreResults = [];
  for (let index = 0; index < windowGroups.length; index += 1) {
    const group = windowGroups[index];
    const restoredTabs = await restoreTabsIntoCurrentWindow(group.tabs);
    restoreResults.push({
      requested: group.tabs.length,
      restored: restoredTabs.length,
      skipped: group.tabs.filter(tab => isBlockedSessionRestoreUrl(tab.url)).length,
    });
  }

  const restoredCount = restoreResults.reduce((sum, item) => sum + item.restored, 0);
  const skippedCount = restoreResults.reduce((sum, item) => sum + item.skipped, 0);

  await saveTabSessions(session.pinned ? sessions : sessions.filter(item => item.id !== sessionId));
  await fetchOpenTabs();
  return {
    ...session,
    restoredCount,
    skippedCount,
  };
}

async function restoreSessionTab(sessionId, url) {
  const sessions = await getTabSessions();
  const session = sessions.find(item => item.id === sessionId);
  const tab = session?.tabs.find(item => item.url === url);
  if (!tab) throw new Error('session-tab-not-found');

  const currentWindow = await chrome.windows.getCurrent();
  await chrome.tabs.create({ windowId: currentWindow.id, url: tab.url, active: true });
  await fetchOpenTabs();
  return tab;
}

async function updateSession(sessionId, patch = {}) {
  const sessions = await getTabSessions();
  const target = sessions.find(item => item.id === sessionId);
  if (!target) throw new Error('session-not-found');

  const nextSessions = sessions.map(session => (
    session.id === sessionId
      ? normalizeTabSession({
          ...session,
          ...patch,
          name: typeof patch.name === 'string' ? patch.name.trim() : session.name,
          pinned: typeof patch.pinned === 'boolean' ? patch.pinned : session.pinned,
        })
      : session
  ));

  await saveTabSessions(nextSessions);
  return nextSessions.find(item => item.id === sessionId) || null;
}

async function refreshDashboardAfterSessionChange(delay = 280) {
  await new Promise(resolve => window.setTimeout(resolve, delay));
  await renderDashboard();
}

function scheduleDashboardRefresh(delay = 160) {
  if (dashboardRefreshTimer) {
    window.clearTimeout(dashboardRefreshTimer);
  }

  dashboardRefreshTimer = window.setTimeout(async () => {
    dashboardRefreshTimer = null;
    await renderDashboard();
  }, delay);
}

function registerChromeStateListeners() {
  if (!chrome?.tabs || !chrome?.storage?.onChanged) return;

  chrome.tabs.onCreated.addListener(() => {
    scheduleDashboardRefresh(120);
  });

  chrome.tabs.onRemoved.addListener(() => {
    scheduleDashboardRefresh(80);
  });

  chrome.tabs.onMoved.addListener(() => {
    scheduleDashboardRefresh(80);
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (!changeInfo.url && !changeInfo.title && !changeInfo.favIconUrl && !changeInfo.status) return;
    scheduleDashboardRefresh(changeInfo.status === 'complete' ? 80 : 180);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (
      !changes[TAB_SESSIONS_STORAGE_KEY] &&
      !changes[SESSIONS_VIEWED_COUNT_KEY] &&
      !changes[QUICK_LINKS_STORAGE_KEY] &&
      !changes[BOOKMARK_COLLECTIONS_STORAGE_KEY] &&
      !changes[BOOKMARK_BOARD_CONFIG_STORAGE_KEY] &&
      !changes[BOOKMARK_OPEN_MODE_STORAGE_KEY] &&
      !changes.deferred
    ) {
      return;
    }

    scheduleDashboardRefresh(60);
  });

  if (chrome?.bookmarks) {
    const refreshBookmarks = () => {
      bookmarkFolders = [];
      bookmarkBoardItems = [];
      scheduleDashboardRefresh(60);
    };

    chrome.bookmarks.onCreated?.addListener(refreshBookmarks);
    chrome.bookmarks.onRemoved?.addListener(refreshBookmarks);
    chrome.bookmarks.onChanged?.addListener(refreshBookmarks);
    chrome.bookmarks.onMoved?.addListener(refreshBookmarks);
    chrome.bookmarks.onChildrenReordered?.addListener(refreshBookmarks);
  }
}

async function deleteSession(sessionId) {
  const sessions = await getTabSessions();
  const nextSessions = sessions.filter(item => item.id !== sessionId);
  await saveTabSessions(nextSessions);
}


/* ----------------------------------------------------------------
   UI HELPERS
   ---------------------------------------------------------------- */

/**
 * playCloseSound()
 *
 * Plays a clean "swoosh" sound when tabs are closed.
 * Built entirely with the Web Audio API — no sound files needed.
 * A filtered noise sweep that descends in pitch, like air moving.
 */
function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    // Swoosh: shaped white noise through a sweeping bandpass filter
    const duration = 0.25;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate noise with a natural envelope (quick attack, smooth decay)
    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length;
      // Envelope: ramps up fast in first 10%, then fades out smoothly
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter sweeps from high to low — creates the "swoosh" character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);

    // Volume
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not supported — fail silently
  }
}

/**
 * shootConfetti(x, y)
 *
 * Shoots a burst of colorful confetti particles from the given screen
 * coordinates (typically the center of a card being closed).
 * Pure CSS + JS, no libraries.
 */
function shootConfetti(x, y) {
  const colors = [
    '#c8713a', // amber
    '#e8a070', // amber light
    '#5a7a62', // sage
    '#8aaa92', // sage light
    '#5a6b7a', // slate
    '#8a9baa', // slate light
    '#d4b896', // warm paper
    '#b35a5a', // rose
  ];

  const particleCount = 17;

  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('div');

    const isCircle = Math.random() > 0.5;
    const size = 5 + Math.random() * 6; // 5–11px
    const color = colors[Math.floor(Math.random() * colors.length)];

    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      opacity: 1;
    `;
    document.body.appendChild(el);

    // Physics: random angle and speed for the outward burst
    const angle   = Math.random() * Math.PI * 2;
    const speed   = 60 + Math.random() * 120;
    const vx      = Math.cos(angle) * speed;
    const vy      = Math.sin(angle) * speed - 80; // bias upward
    const gravity = 200;

    const startTime = performance.now();
    const duration  = 700 + Math.random() * 200; // 700–900ms

    function frame(now) {
      const elapsed  = (now - startTime) / 1000;
      const progress = elapsed / (duration / 1000);

      if (progress >= 1) { el.remove(); return; }

      const px = vx * elapsed;
      const py = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
      const opacity = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;
      const rotate  = elapsed * 200 * (isCircle ? 0 : 1);

      el.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) rotate(${rotate}deg)`;
      el.style.opacity = opacity;

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
}

/**
 * animateCardOut(card)
 *
 * Smoothly removes a mission card: fade + scale down, then confetti.
 * After the animation, checks if the grid is now empty.
 */
function animateCardOut(card) {
  if (!card) return;

  const rect = card.getBoundingClientRect();
  shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);

  card.classList.add('closing');
  setTimeout(() => {
    card.remove();
    checkAndShowEmptyState();
  }, 300);
}

/**
 * showToast(message)
 *
 * Brief pop-up notification at the bottom of the screen.
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

/**
 * checkAndShowEmptyState()
 *
 * Shows a cheerful "Inbox zero" message when all domain cards are gone.
 */
function checkAndShowEmptyState() {
  const missionsEl = document.getElementById('openTabsMissions');
  if (!missionsEl) return;

  const remaining = missionsEl.querySelectorAll('.mission-card:not(.closing)').length;
  if (remaining > 0) return;

  missionsEl.innerHTML = `
    <div class="missions-empty-state">
      <div class="empty-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div class="empty-title">${t('inboxZeroTitle')}</div>
      <div class="empty-subtitle">${t('inboxZeroSubtitle')}</div>
    </div>
  `;

  const countEl = document.getElementById('openTabsSectionCount');
  if (countEl) countEl.textContent = t('domainsCount', 0);
}

/**
 * timeAgo(dateStr)
 *
 * Converts an ISO date string into a human-friendly relative time.
 * "2026-04-04T10:00:00Z" → "2 hrs ago" or "yesterday"
 */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now  = new Date();
  const diffMins  = Math.floor((now - then) / 60000);
  const diffHours = Math.floor((now - then) / 3600000);
  const diffDays  = Math.floor((now - then) / 86400000);

  if (diffMins < 1) return t('justNow');
  if (diffMins < 60) return t('minutesAgo', diffMins);
  if (diffHours < 24) return t('hoursAgo', diffHours);
  if (diffDays === 1) return t('yesterday');
  return t('daysAgo', diffDays);
}

/**
 * getGreeting() — "Good morning / afternoon / evening"
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return t('greetingMorning');
  if (hour < 17) return t('greetingAfternoon');
  return t('greetingEvening');
}

/**
 * getDateDisplay() — "Friday, April 4, 2026"
 */
function getDateDisplay() {
  return new Date().toLocaleDateString(currentLanguage, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}


/* ----------------------------------------------------------------
   DOMAIN & TITLE CLEANUP HELPERS
   ---------------------------------------------------------------- */

// Map of known hostnames → friendly display names.
const FRIENDLY_DOMAINS = {
  'github.com':           'GitHub',
  'www.github.com':       'GitHub',
  'gist.github.com':      'GitHub Gist',
  'youtube.com':          'YouTube',
  'www.youtube.com':      'YouTube',
  'music.youtube.com':    'YouTube Music',
  'x.com':                'X',
  'www.x.com':            'X',
  'twitter.com':          'X',
  'www.twitter.com':      'X',
  'reddit.com':           'Reddit',
  'www.reddit.com':       'Reddit',
  'old.reddit.com':       'Reddit',
  'substack.com':         'Substack',
  'www.substack.com':     'Substack',
  'medium.com':           'Medium',
  'www.medium.com':       'Medium',
  'linkedin.com':         'LinkedIn',
  'www.linkedin.com':     'LinkedIn',
  'stackoverflow.com':    'Stack Overflow',
  'www.stackoverflow.com':'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'google.com':           'Google',
  'www.google.com':       'Google',
  'mail.google.com':      'Gmail',
  'docs.google.com':      'Google Docs',
  'drive.google.com':     'Google Drive',
  'calendar.google.com':  'Google Calendar',
  'meet.google.com':      'Google Meet',
  'gemini.google.com':    'Gemini',
  'chatgpt.com':          'ChatGPT',
  'www.chatgpt.com':      'ChatGPT',
  'chat.openai.com':      'ChatGPT',
  'claude.ai':            'Claude',
  'www.claude.ai':        'Claude',
  'code.claude.com':      'Claude Code',
  'notion.so':            'Notion',
  'www.notion.so':        'Notion',
  'figma.com':            'Figma',
  'www.figma.com':        'Figma',
  'slack.com':            'Slack',
  'app.slack.com':        'Slack',
  'discord.com':          'Discord',
  'www.discord.com':      'Discord',
  'wikipedia.org':        'Wikipedia',
  'en.wikipedia.org':     'Wikipedia',
  'amazon.com':           'Amazon',
  'www.amazon.com':       'Amazon',
  'netflix.com':          'Netflix',
  'www.netflix.com':      'Netflix',
  'spotify.com':          'Spotify',
  'open.spotify.com':     'Spotify',
  'vercel.com':           'Vercel',
  'www.vercel.com':       'Vercel',
  'npmjs.com':            'npm',
  'www.npmjs.com':        'npm',
  'developer.mozilla.org':'MDN',
  'arxiv.org':            'arXiv',
  'www.arxiv.org':        'arXiv',
  'huggingface.co':       'Hugging Face',
  'www.huggingface.co':   'Hugging Face',
  'producthunt.com':      'Product Hunt',
  'www.producthunt.com':  'Product Hunt',
  'xiaohongshu.com':      'RedNote',
  'www.xiaohongshu.com':  'RedNote',
  'local-files':          'Local Files',
};

function friendlyDomain(hostname) {
  if (!hostname) return '';
  if (hostname === 'local-files') return t('localFiles');
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname];

  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return t('substackBy', hostname.replace('.substack.com', ''));
  }
  if (hostname.endsWith('.github.io')) {
    return t('githubPages', hostname.replace('.github.io', ''));
  }

  let clean = hostname
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|co\.uk|co\.jp)$/, '');

  return clean.split('.').map(part => capitalize(part)).join(' ');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function stripTitleNoise(title) {
  if (!title) return '';
  // Strip leading notification count: "(2) Title"
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  // Strip inline counts like "Inbox (16,359)"
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  // Strip email addresses (privacy + cleaner display)
  title = title.replace(/\s*[\-\u2010-\u2015]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  // Clean X/Twitter format
  title = title.replace(/\s+on X:\s*/, ': ');
  title = title.replace(/\s*\/\s*X\s*$/, '');
  return title.trim();
}

function cleanTitle(title, hostname) {
  if (!title || !hostname) return title || '';

  const friendly = friendlyDomain(hostname);
  const domain   = hostname.replace(/^www\./, '');
  const seps     = [' - ', ' | ', ' — ', ' · ', ' – '];

  for (const sep of seps) {
    const idx = title.lastIndexOf(sep);
    if (idx === -1) continue;
    const suffix     = title.slice(idx + sep.length).trim();
    const suffixLow  = suffix.toLowerCase();
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return title;
}

function smartTitle(title, url) {
  if (!url) return title || '';
  let pathname = '', hostname = '';
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname; }
  catch { return title || ''; }

  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http');

  if ((hostname === 'x.com' || hostname === 'twitter.com' || hostname === 'www.x.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1];
    if (username) return titleIsUrl ? t('postByUser', username) : title;
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts;
      if (rest[0] === 'issues' && rest[1]) return t('githubIssue', owner, repo, rest[1]);
      if (rest[0] === 'pull'   && rest[1]) return t('githubPr', owner, repo, rest[1]);
      if (rest[0] === 'blob' || rest[0] === 'tree') return t('githubPath', owner, repo, rest.slice(2).join('/'));
      if (titleIsUrl) return `${owner}/${repo}`;
    }
  }

  if ((hostname === 'www.youtube.com' || hostname === 'youtube.com') && pathname === '/watch') {
    if (titleIsUrl) return t('youtubeVideo');
  }

  if ((hostname === 'www.reddit.com' || hostname === 'reddit.com' || hostname === 'old.reddit.com') && pathname.includes('/comments/')) {
    const parts  = pathname.split('/').filter(Boolean);
    const subIdx = parts.indexOf('r');
    if (subIdx !== -1 && parts[subIdx + 1]) {
      if (titleIsUrl) return t('redditPost', parts[subIdx + 1]);
    }
  }

  return title || url;
}


/* ----------------------------------------------------------------
   SVG ICON STRINGS
   ---------------------------------------------------------------- */
const ICONS = {
  tabs:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18" /></svg>`,
  close:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`,
  archive: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`,
  focus:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>`,
  pin:     `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.45.359 2.83.988 4.061L19 21l-1.5-6.01A4.482 4.482 0 0 0 16.5 12Zm0 0v4.5" /></svg>`,
};


/* ----------------------------------------------------------------
   IN-MEMORY STORE FOR OPEN-TAB GROUPS
   ---------------------------------------------------------------- */
let domainGroups = [];


/* ----------------------------------------------------------------
   HELPER: filter out browser-internal pages
   ---------------------------------------------------------------- */

/**
 * getRealTabs()
 *
 * Returns tabs that are real web pages — no chrome://, extension
 * pages, about:blank, etc.
 */
function getRealTabs() {
  return openTabs.filter(isRealWebTab);
}

/**
 * checkTabOutDupes()
 *
 * Counts how many TabNest pages are open. If more than 1,
 * shows a banner offering to close the extras.
 */
function checkTabOutDupes() {
  const tabOutTabs = openTabs.filter(t => t.isTabOut);
  const banner  = document.getElementById('tabOutDupeBanner');
  if (!banner) return;

  if (tabOutTabs.length > 1) {
    updateTabOutDupeBannerText(tabOutTabs.length);
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function renderOpenTabsSectionCount(domainCount, totalTabs) {
  return `${t('domainsCount', domainCount)} &nbsp;&middot;&nbsp; <button class="action-btn close-tabs" data-action="close-all-open-tabs" style="font-size:11px;padding:3px 10px;">${ICONS.close} ${t('closeAllTabsAction', totalTabs)}</button>`;
}

function renderOpenTabsWindowSectionCount(windowCount, totalTabs) {
  return `${t('windowsCount', windowCount)} &nbsp;&middot;&nbsp; <button class="action-btn close-tabs" data-action="close-all-open-tabs" style="font-size:11px;padding:3px 10px;">${ICONS.close} ${t('closeAllTabsAction', totalTabs)}</button>`;
}

function getDisplayUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') return t('localFiles');
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

function buildWindowGroups(tabs, currentWindowId) {
  const grouped = new Map();

  for (const tab of tabs) {
    if (!grouped.has(tab.windowId)) grouped.set(tab.windowId, []);
    grouped.get(tab.windowId).push(tab);
  }

  return [...grouped.entries()]
    .map(([windowId, windowTabs]) => ({
      windowId,
      isCurrent: windowId === currentWindowId,
      tabs: [...windowTabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)),
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return a.windowId - b.windowId;
    })
    .map((group, index) => ({
      ...group,
      order: index + 1,
    }));
}

function renderWindowCard(group) {
  const title = group.isCurrent ? t('currentWindowTitle') : t('windowTitle', group.order);
  const badge = group.isCurrent ? t('windowViewHint') : '';
  const rows = group.tabs.map((tab, rowIndex) => {
    const label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const safeTitle = escapeHtml(label || tab.url || '');
    const safeMeta = escapeHtml(getDisplayUrl(tab.url));
    const faviconUrl = escapeHtml(getFaviconSource(tab.url, tab.title, 32, tab.favIconUrl));

    return `
      <div class="window-tab-item${tab.active ? ' is-active' : ''}" draggable="true" data-action="focus-tab-id" data-tab-id="${tab.id}" data-window-id="${group.windowId}" data-tab-index="${tab.index}">
        <div class="window-tab-order">${rowIndex + 1}</div>
        <div class="window-tab-grip" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        ${faviconUrl ? `<img class="window-tab-favicon" src="${faviconUrl}" alt="" data-hide-on-error="true">` : '<span class="window-tab-favicon window-tab-favicon-fallback"></span>'}
        <div class="window-tab-copy">
          <div class="window-tab-title-row">
            <div class="window-tab-title">${safeTitle}</div>
            ${tab.active ? `<span class="window-tab-badge is-active">${escapeHtml(t('activeTabBadge'))}</span>` : ''}
            ${tab.pinned ? `<span class="window-tab-badge">${escapeHtml(t('pinnedTabBadge'))}</span>` : ''}
          </div>
          <div class="window-tab-meta">${safeMeta}</div>
        </div>
        <div class="window-tab-actions">
          <button class="window-tab-action" data-action="defer-single-tab-id" data-tab-id="${tab.id}" title="${t('saveForLaterTitle')}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.9" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
          </button>
          <button class="window-tab-action window-tab-action-pin" data-action="add-quick-link-from-tab-id" data-tab-id="${tab.id}" title="${t('quickLinkModalAddFromTabTitle')}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.45.359 2.83.988 4.061L19 21l-1.5-6.01A4.482 4.482 0 0 0 16.5 12Zm0 0v4.5" /></svg>
          </button>
          <button class="window-tab-action" data-action="close-single-tab-id" data-tab-id="${tab.id}" title="${t('closeThisTabTitle')}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  return `
    <article class="window-card" data-window-id="${group.windowId}">
      <div class="window-card-header">
        <div>
          <div class="window-card-title">${escapeHtml(title)}</div>
          <div class="window-card-subtitle">${escapeHtml(t('tabsOpenBadge', group.tabs.length))}</div>
        </div>
        ${badge ? `<div class="window-card-note">${escapeHtml(badge)}</div>` : ''}
      </div>
      <div class="window-tab-list" data-window-id="${group.windowId}">
        ${rows}
      </div>
    </article>`;
}


/* ----------------------------------------------------------------
   OVERFLOW CHIPS ("+N more" expand button in domain cards)
   ---------------------------------------------------------------- */

function buildOverflowChips(hiddenTabs, urlCounts = {}) {
  const hiddenChips = hiddenTabs.map(tab => {
    const label    = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const count    = urlCounts[tab.url] || 1;
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    const faviconUrl = getFaviconSource(tab.url, label, 16);
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      <img class="chip-favicon" src="${faviconUrl}" alt="" data-hide-on-error="true">
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${t('saveForLaterTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${t('closeThisTabTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-chips-overflow" style="display:none">${hiddenChips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">${t('moreTabs', hiddenTabs.length)}</span>
    </div>`;
}


/* ----------------------------------------------------------------
   DOMAIN CARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderDomainCard(group, groupIndex)
 *
 * Builds the HTML for one domain group card.
 * group = { domain: string, tabs: [{ url, title, id, windowId, active }] }
 */
function renderDomainCard(group) {
  const tabs      = group.tabs || [];
  const tabCount  = tabs.length;
  const isLanding = group.domain === '__landing-pages__';
  const stableId  = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-');

  // Count duplicates (exact URL match)
  const urlCounts = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls   = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const hasDupes   = dupeUrls.length > 0;
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  const tabBadge = `<span class="open-tabs-badge">
    ${ICONS.tabs}
    ${t('tabsOpenBadge', tabCount)}
  </span>`;

  const dupeBadge = hasDupes
    ? `<span class="open-tabs-badge duplicate-badge" style="color:var(--accent-amber);background:rgba(200,113,58,0.08);">
        ${t('duplicateBadge', totalExtras)}
      </span>`
    : '';

  // Deduplicate for display: show each URL once, with (Nx) badge if duped
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); }
  }

  const visibleTabs = uniqueTabs.slice(0, 8);
  const extraCount  = uniqueTabs.length - visibleTabs.length;

  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
    // For localhost tabs, prepend port number so you can tell projects apart
    try {
      const parsed = new URL(tab.url);
      if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
    } catch {}
    const count    = urlCounts[tab.url];
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    const faviconUrl = getFaviconSource(tab.url, label, 16);
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      <img class="chip-favicon" src="${faviconUrl}" alt="" data-hide-on-error="true">
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${t('saveForLaterTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-pin" data-action="open-quick-link-modal" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${t('quickLinkModalAddFromTabTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.45.359 2.83.988 4.061L19 21l-1.5-6.01A4.482 4.482 0 0 0 16.5 12Zm0 0v4.5" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${t('closeThisTabTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('') + (extraCount > 0 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts) : '');

  let actionsHtml = `
    <button class="action-btn close-tabs" data-action="close-domain-tabs" data-domain-id="${stableId}">
      ${ICONS.close}
      ${t('closeAllTabsAction', tabCount)}
    </button>`;

  if (hasDupes) {
    const dupeUrlsEncoded = dupeUrls.map(([url]) => encodeURIComponent(url)).join(',');
    actionsHtml += `
      <button class="action-btn" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}">
        ${t('closeDuplicatesAction', totalExtras)}
      </button>`;
  }

  const domain = group.domain || '';
  const brandColor = getBrandColor(domain);

  return `
    <div class="mission-card domain-card ${hasDupes ? 'has-amber-bar' : 'has-neutral-bar'}" 
         data-domain-id="${stableId}" 
         style="--brand-color: ${brandColor}; border-top-color: ${brandColor}CC">
      <div class="status-bar"></div>
      <div class="mission-content">
        <div class="mission-top">
          <span class="mission-name">${isLanding ? t('homepages') : (group.label || friendlyDomain(group.domain))}</span>
          ${tabBadge}
          ${dupeBadge}
        </div>
        <div class="mission-pages">${pageChips}</div>
        <div class="actions">${actionsHtml}</div>
      </div>
      <div class="mission-meta">
        <div class="mission-page-count">${tabCount}</div>
        <div class="mission-page-label">${t('tabsLabel')}</div>
      </div>
    </div>`;
}

/**
 * Returns a brand-aligned color for a given domain/hostname
 */
function getBrandColor(domain) {
  if (!domain) return 'var(--warm-gray)';
  
  const host = domain.toLowerCase();
  if (host.includes('google')) return '#4285F4';
  if (host.includes('github')) return '#A371F7';
  if (host.includes('youtube')) return '#FF0000';
  if (host.includes('facebook') || host.includes('fb.')) return '#1877F2';
  if (host.includes('twitter') || host.includes('x.com')) return '#1DA1F2';
  if (host.includes('linkedin')) return '#0A66C2';
  if (host.includes('figma')) return '#F24E1E';
  if (host.includes('doubao')) return '#6A5ACD';
  if (host.includes('feishu') || host.includes('lark')) return '#3370FF';
  if (host.includes('notion')) return '#000000';
  if (host.includes('stackoverflow')) return '#F48225';
  if (host.includes('reddit')) return '#FF4500';
  if (host.includes('bilibili')) return '#FB7299';
  if (host.includes('zhihu')) return '#0084FF';
  
  // Default fallback based on string hash for consistency
  let hash = 0;
  for (let i = 0; i < host.length; i++) {
    hash = host.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 60%)`;
}


/* ----------------------------------------------------------------
   TAB SESSIONS — Render Session Column
   ---------------------------------------------------------------- */

function renderSessionCard(session) {
  const sessionTitle = escapeHtml(getSessionTitle(session));
  const meta = `${t('sessionTabsCount', session.tabs.length)} · ${t('sessionWindowsCount', getSessionWindowCount(session))} · ${timeAgo(session.createdAt)}`;
  const domainSummary = escapeHtml(getSessionTopDomains(session, 3).join(' · '));
  const sessionId = escapeHtml(session.id);
  const isTabGroup = session.sourceType === 'tab-group';
  const statusModifier = session.pinned ? ' is-pinned' : isTabGroup ? ' is-tab-group' : '';
  const statusLabel = isTabGroup
    ? t('sessionTabGroupBadge')
    : session.pinned ? t('sessionPinnedBadge') : t('sessionTemporaryBadge');
  const previewTabs = session.tabs.slice(0, 4).map(tab => {
    const faviconUrl = escapeHtml(getFaviconSource(tab.url, tab.title, 32, tab.favIconUrl));
    const safeTitle = escapeHtml(tab.title || tab.url);
    const safeUrl = escapeHtml(tab.url);

    return `
      <div class="session-preview-row">
        <img class="session-preview-favicon" src="${faviconUrl}" alt="" data-hide-on-error="true">
        <div class="session-preview-title">${safeTitle}</div>
        <button type="button" class="session-preview-action" data-action="restore-session-tab" data-session-id="${escapeHtml(session.id)}" data-session-tab-url="${safeUrl}" title="${t('sessionRestoreTab')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
        </button>
      </div>`;
  }).join('');

  const moreCount = Math.max(0, session.tabs.length - 4);

  return `
    <article class="session-card${statusModifier}" data-session-id="${sessionId}">
      <div class="session-card-header">
        <div>
          <div class="session-card-status-row">
            <span class="session-card-status-badge${statusModifier}">${escapeHtml(statusLabel)}</span>
          </div>
          <div class="session-card-title">${sessionTitle}</div>
          <div class="session-card-meta">${meta}</div>
        </div>
        <div class="session-card-tools">
          <button type="button" class="session-card-tool" data-action="open-session-modal" data-session-id="${sessionId}" title="${escapeHtml(t('sessionRename'))}" aria-label="${escapeHtml(t('sessionRename'))}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.9" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button type="button" class="session-card-tool" data-action="toggle-session-pinned" data-session-id="${sessionId}" title="${escapeHtml(session.pinned ? t('sessionUnpin') : t('sessionPin'))}" aria-label="${escapeHtml(session.pinned ? t('sessionUnpin') : t('sessionPin'))}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.9" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 17.25v3.75m0-3.75L8.25 13.5m3.75 3.75 3.75-3.75M6 4.5h12l-2.25 6.75H8.25L6 4.5Z" />
            </svg>
          </button>
        </div>
      </div>
      ${domainSummary ? `<div class="session-card-domain-summary">${domainSummary}</div>` : ''}
      <div class="session-preview-list">
        ${previewTabs}
      </div>
      ${moreCount > 0 ? `<div class="session-preview-more">${t('sessionMoreTabs', moreCount)}</div>` : ''}
      <div class="session-card-actions">
        <button type="button" class="action-btn save-tabs" data-action="restore-session" data-session-id="${sessionId}">${t('sessionRestoreAll')}</button>
        <button type="button" class="action-btn danger" data-action="delete-session" data-session-id="${sessionId}">${t('sessionDelete')}</button>
      </div>
    </article>`;
}

async function renderSessionsFloatingPanel() {
  const tools = document.getElementById('floatingTools');
  const rail = document.getElementById('floatingToolsRail');
  const stashTrigger = document.getElementById('stashMenuTrigger');
  const countEl = document.getElementById('sessionsCount');
  const badgeEl = document.getElementById('sessionFabCount');
  const listEl = document.getElementById('sessionsList');
  const trigger = document.getElementById('sessionFabTrigger');
  const packBtn = document.getElementById('sessionPanelPackBtn');
  if (!tools || !rail || !stashTrigger || !countEl || !badgeEl || !listEl || !trigger) return;

  try {
    const sessions = await getTabSessions();
    const canStash = lastRealTabCount > 0;
    const hasSessions = sessions.length > 0;

    tools.style.display = 'flex';
    stashTrigger.hidden = !canStash;
    trigger.hidden = !hasSessions;
    rail.hidden = !canStash && !hasSessions;
    if (packBtn instanceof HTMLButtonElement) {
      const canPack = sessions.length >= 1;
      packBtn.disabled = !canPack;
      packBtn.title = canPack ? t('sessionPanelPackButton') : t('sessionPanelPackDisabledHint');
    }

    if (!canStash) {
      setStashMenuOpen(false);
    }

    if (!hasSessions) {
      setSessionPanelOpen(false);
      countEl.textContent = '';
      badgeEl.hidden = true;
      trigger.classList.toggle('has-sessions', false);
      listEl.innerHTML = '';
    } else {
      countEl.textContent = t('itemsCount', sessions.length);
      
      // Calculate unread/new sessions count
      const { [SESSIONS_VIEWED_COUNT_KEY]: viewedCount = 0 } = await chrome.storage.local.get(SESSIONS_VIEWED_COUNT_KEY);
      const unreadCount = Math.max(0, sessions.length - viewedCount);
      
      // If panel is open or unreadCount is 0, hide the badge
      if (isSessionPanelOpen || unreadCount === 0) {
        badgeEl.hidden = true;
      } else {
        badgeEl.textContent = String(unreadCount);
        badgeEl.hidden = false;
      }
      
      trigger.classList.toggle('has-sessions', true);
      listEl.innerHTML = sessions.map(session => renderSessionCard(session)).join('');
    }
  } catch (err) {
    console.warn('[tab-out] Could not load tab sessions:', err);
    rail.hidden = true;
    stashTrigger.hidden = true;
    trigger.hidden = true;
    setStashMenuOpen(false);
    setSessionPanelOpen(false);
  }
}

/* ----------------------------------------------------------------
   SAVED FOR LATER — Render Checklist Column
   ---------------------------------------------------------------- */

/**
 * renderDeferredColumn()
 *
 * Reads saved tabs from chrome.storage.local and renders the right-side
 * "Saved for Later" checklist column. Shows active items as a checklist
 * and completed items in a collapsible archive.
 */
async function renderDeferredColumn() {
  const column         = document.getElementById('deferredColumn');
  const deferredSection = document.getElementById('deferredSection');
  const list           = document.getElementById('deferredList');
  const empty          = document.getElementById('deferredEmpty');
  const countEl        = document.getElementById('deferredCount');
  const archiveEl      = document.getElementById('deferredArchive');
  const archiveCountEl = document.getElementById('archiveCount');
  const archiveList    = document.getElementById('archiveList');

  if (!column) return;

  try {
    const { active, archived } = await getSavedTabs();

    const hasDeferredUI = active.length > 0 || archived.length > 0;

    if (!hasDeferredUI) {
      column.style.display = 'none';
      return;
    }

    column.style.display = 'block';

    if (deferredSection) deferredSection.style.display = hasDeferredUI ? 'block' : 'none';

    // Render active checklist items
    if (active.length > 0) {
      countEl.textContent = t('itemsCount', active.length);
      list.innerHTML = active.map(item => renderDeferredItem(item)).join('');
      list.style.display = 'block';
      empty.style.display = 'none';
    } else {
      list.style.display = 'none';
      countEl.textContent = '';
      empty.style.display = 'block';
    }

    // Render archive section
    if (archived.length > 0) {
      archiveCountEl.textContent = `(${archived.length})`;
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      archiveEl.style.display = 'block';
    } else {
      archiveEl.style.display = 'none';
    }

  } catch (err) {
    console.warn('[tab-out] Could not load saved tabs:', err);
    column.style.display = 'none';
  }
}

/**
 * renderDeferredItem(item)
 *
 * Builds HTML for one active checklist item: checkbox, title link,
 * domain, time ago, dismiss button.
 */
function renderDeferredItem(item) {
  const domain = getHostnameFromUrl(item.url);
  const faviconUrl = getFaviconSource(item.url, item.title, 16);
  const ago = timeAgo(item.savedAt);

  return `
    <div class="deferred-item" data-deferred-id="${item.id}">
      <input type="checkbox" class="deferred-checkbox" data-action="check-deferred" data-deferred-id="${item.id}">
      <div class="deferred-info">
        <a href="${item.url}" target="_blank" rel="noopener" class="deferred-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
          <img src="${faviconUrl}" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" data-hide-on-error="true">${item.title || item.url}
        </a>
        <div class="deferred-meta">
          <span>${domain}</span>
          <span>${ago}</span>
        </div>
      </div>
      <button class="deferred-dismiss" data-action="dismiss-deferred" data-deferred-id="${item.id}" title="${t('dismissTitle')}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>`;
}

/**
 * renderArchiveItem(item)
 *
 * Builds HTML for one completed/archived item (simpler: just title + date).
 */
function renderArchiveItem(item) {
  const ago = item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt);
  return `
    <div class="archive-item" data-deferred-id="${item.id}">
      <a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
        ${item.title || item.url}
      </a>
      <span class="archive-item-date">${ago}</span>
      <button class="archive-dismiss" data-action="dismiss-archived" data-deferred-id="${item.id}" title="${t('dismissTitle')}" aria-label="${t('dismissTitle')}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>`;
}


/* ----------------------------------------------------------------
   MAIN DASHBOARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderStaticDashboard()
 *
 * The main render function:
 * 1. Paints greeting + date
 * 2. Fetches open tabs via chrome.tabs.query()
 * 3. Groups tabs by domain (with landing pages pulled out to their own group)
 * 4. Renders domain cards
 * 5. Updates footer stats
 * 6. Renders the "Saved for Later" checklist
 */
async function renderStaticDashboard() {
  applyStaticText();
  await renderQuickLinksSection();
  await loadBookmarkCollections();
  await renderBookmarkBoardSection();
  await renderBookmarkFolderPicker();

  // --- Header ---
  const greetingEl = document.getElementById('greeting');
  const dateEl     = document.getElementById('dateDisplay');
  if (greetingEl) greetingEl.textContent = getGreeting();
  if (dateEl)     dateEl.textContent     = getDateDisplay();

  // --- Fetch tabs ---
  await fetchOpenTabs();
  const currentWindow = await chrome.windows.getCurrent().catch(() => null);
  const currentWindowId = currentWindow?.id || 0;
  const realTabs = getRealTabs();
  lastRealTabCount = realTabs.length;

  // --- Group tabs by domain ---
  // Landing pages (Gmail inbox, Twitter home, etc.) get their own special group
  // so they can be closed together without affecting content tabs on the same domain.
  const LANDING_PAGE_PATTERNS = [
    { hostname: 'mail.google.com', test: (p, h) =>
        !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
    { hostname: 'x.com',               pathExact: ['/home'] },
    { hostname: 'www.linkedin.com',    pathExact: ['/'] },
    { hostname: 'github.com',          pathExact: ['/'] },
    { hostname: 'www.youtube.com',     pathExact: ['/'] },
    // Merge personal patterns from config.local.js (if it exists)
    ...(typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []),
  ];

  function isLandingPage(url) {
    try {
      const parsed = new URL(url);
      return LANDING_PAGE_PATTERNS.some(p => {
        // Support both exact hostname and suffix matching (for wildcard subdomains)
        const hostnameMatch = p.hostname
          ? parsed.hostname === p.hostname
          : p.hostnameEndsWith
            ? parsed.hostname.endsWith(p.hostnameEndsWith)
            : false;
        if (!hostnameMatch) return false;
        if (p.test)       return p.test(parsed.pathname, url);
        if (p.pathPrefix) return parsed.pathname.startsWith(p.pathPrefix);
        if (p.pathExact)  return p.pathExact.includes(parsed.pathname);
        return parsed.pathname === '/';
      });
    } catch { return false; }
  }

  domainGroups = [];
  const groupMap    = {};
  const landingTabs = [];

  // Custom group rules from config.local.js (if any)
  const customGroups = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : [];

  // Check if a URL matches a custom group rule; returns the rule or null
  function matchCustomGroup(url) {
    try {
      const parsed = new URL(url);
      return customGroups.find(r => {
        const hostMatch = r.hostname
          ? parsed.hostname === r.hostname
          : r.hostnameEndsWith
            ? parsed.hostname.endsWith(r.hostnameEndsWith)
            : false;
        if (!hostMatch) return false;
        if (r.pathPrefix) return parsed.pathname.startsWith(r.pathPrefix);
        return true; // hostname matched, no path filter
      }) || null;
    } catch { return null; }
  }

  for (const tab of realTabs) {
    try {
      if (isLandingPage(tab.url)) {
        landingTabs.push(tab);
        continue;
      }

      // Check custom group rules first (e.g. merge subdomains, split by path)
      const customRule = matchCustomGroup(tab.url);
      if (customRule) {
        const key = customRule.groupKey;
        if (!groupMap[key]) groupMap[key] = { domain: key, label: customRule.groupLabel, tabs: [] };
        groupMap[key].tabs.push(tab);
        continue;
      }

      let hostname;
      if (tab.url && tab.url.startsWith('file://')) {
        hostname = 'local-files';
      } else {
        hostname = new URL(tab.url).hostname;
      }
      if (!hostname) continue;

      if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] };
      groupMap[hostname].tabs.push(tab);
    } catch {
      // Skip malformed URLs
    }
  }

  if (landingTabs.length > 0) {
    groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };
  }

  // Sort: landing pages first, then domains from landing page sites, then by tab count
  // Collect exact hostnames and suffix patterns for priority sorting
  const landingHostnames = new Set(LANDING_PAGE_PATTERNS.map(p => p.hostname).filter(Boolean));
  const landingSuffixes = LANDING_PAGE_PATTERNS.map(p => p.hostnameEndsWith).filter(Boolean);
  function isLandingDomain(domain) {
    if (landingHostnames.has(domain)) return true;
    return landingSuffixes.some(s => domain.endsWith(s));
  }
  domainGroups = Object.values(groupMap).sort((a, b) => {
    const aIsLanding = a.domain === '__landing-pages__';
    const bIsLanding = b.domain === '__landing-pages__';
    if (aIsLanding !== bIsLanding) return aIsLanding ? -1 : 1;

    const aIsPriority = isLandingDomain(a.domain);
    const bIsPriority = isLandingDomain(b.domain);
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

    return b.tabs.length - a.tabs.length;
  });

  // --- Render domain cards ---
  const openTabsSection      = document.getElementById('openTabsSection');
  const openTabsMissionsEl   = document.getElementById('openTabsMissions');
  const openTabsWindowsEl    = document.getElementById('openTabsWindows');
  const openTabsSectionCount = document.getElementById('openTabsSectionCount');
  const openTabsSectionTitle = document.getElementById('openTabsSectionTitle');
  const windowGroups = buildWindowGroups(realTabs, currentWindowId);

  if (domainGroups.length > 0 && openTabsSection) {
    if (openTabsSectionTitle) openTabsSectionTitle.textContent = t('openTabs');
    if (openTabsSectionCount) {
      openTabsSectionCount.innerHTML = currentOpenTabsView === 'windows'
        ? renderOpenTabsWindowSectionCount(windowGroups.length, realTabs.length)
        : renderOpenTabsSectionCount(domainGroups.length, realTabs.length);
    }
    if (openTabsMissionsEl) {
      openTabsMissionsEl.style.display = currentOpenTabsView === 'windows' ? 'none' : 'block';
      if (currentOpenTabsView !== 'windows') {
        openTabsMissionsEl.innerHTML = domainGroups.map(g => renderDomainCard(g)).join('');
      }
    }
    if (openTabsWindowsEl) {
      openTabsWindowsEl.style.display = currentOpenTabsView === 'windows' ? 'grid' : 'none';
      if (currentOpenTabsView === 'windows') {
        openTabsWindowsEl.innerHTML = windowGroups.map(group => renderWindowCard(group)).join('');
      }
    }
    openTabsSection.style.display = 'block';
  } else if (openTabsSection) {
    openTabsSection.style.display = 'none';
  }

  // --- Footer stats ---
  const statTabs = document.getElementById('statTabs');
  if (statTabs) statTabs.textContent = openTabs.length;

  // --- Check for duplicate TabNest tabs ---
  checkTabOutDupes();

  // --- Render floating sessions tool ---
  await renderSessionsFloatingPanel();

  // --- Render "Saved for Later" column ---
  await renderDeferredColumn();
}

async function renderDashboard() {
  await fetchOpenTabs();
  await renderStaticDashboard();
}


/* ----------------------------------------------------------------
   EVENT HANDLERS — using event delegation

   One listener on document handles ALL button clicks.
   Think of it as one security guard watching the whole building
   instead of one per door.
   ---------------------------------------------------------------- */

document.addEventListener('click', async (e) => {
  // Walk up the DOM to find the nearest element with data-action
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  if (action === 'noop') return;

  if (action === 'set-language') {
    const language = actionEl.dataset.language;
    if (!language || language === currentLanguage) return;
    await setLanguagePreference(language);
    await renderDashboard();
    return;
  }

  if (action === 'set-open-tabs-view') {
    const view = actionEl.dataset.view;
    if (!view || view === currentOpenTabsView) return;
    await setOpenTabsViewPreference(view);
    await renderDashboard();
    return;
  }

  if (action === 'open-settings-modal') {
    setSettingsModalOpen(true);
    return;
  }

  if (action === 'open-bookmark-folder-settings') {
    if (getBookmarkBoardEntries().length >= BOOKMARK_BOARD_MAX_ENTRIES) {
      showToast(t('toastBookmarkBoardLimitReached'));
      return;
    }
    openBookmarkFolderSettings();
    return;
  }

  if (action === 'close-settings-modal') {
    setSettingsModalOpen(false);
    return;
  }

  if (action === 'show-settings-panel') {
    setCurrentSettingsPanel(actionEl.dataset.settingsPanel || 'appearance');
    return;
  }

  if (action === 'toggle-color-theme') {
    try {
      await setThemePreference(currentTheme === 'dark' ? 'light' : 'dark');
      showToast(t('toastThemeUpdated'));
    } catch (err) {
      console.warn('[tab-out] Could not update theme:', err);
    }
    return;
  }

  if (action === 'set-quick-link-open-mode') {
    const mode = actionEl.dataset.openMode;
    if (!mode || mode === quickLinksOpenMode) return;
    await setQuickLinksOpenModePreference(mode);
    syncQuickLinkOpenModeControls();
    showToast(t('settingsSaved'));
    return;
  }

  if (action === 'set-bookmark-open-mode') {
    const mode = actionEl.dataset.openMode;
    if (!mode || mode === bookmarkOpenMode) return;
    await setBookmarkOpenModePreference(mode);
    syncBookmarkOpenModeControls();
    showToast(t('settingsSaved'));
    return;
  }

  if (action === 'set-bookmark-board-display-limit') {
    const limit = Number(actionEl.dataset.bookmarkBoardLimit || 0);
    if (!limit || limit === bookmarkBoardDisplayLimit) return;
    await setBookmarkBoardDisplayLimitPreference(limit);
    syncBookmarkBoardLimitControls();
    await renderBookmarkBoardSection();
    showToast(t('settingsSaved'));
    return;
  }

  if (action === 'close-confirm-modal') {
    closeConfirmModal();
    return;
  }

  if (action === 'confirm-modal-submit') {
    const submit = pendingConfirmAction;
    closeConfirmModal();
    if (submit) await submit();
    return;
  }

  if (action === 'search-bookmark-board') return;

  if (action === 'toggle-bookmark-board') {
    await setBookmarkBoardCollapsedPreference(!isBookmarkBoardCollapsed);
    await renderBookmarkBoardSection();
    return;
  }

  if (action === 'select-bookmark-folder') {
    const folderId = actionEl.dataset.bookmarkFolderId;
    await setBookmarkBoardRootFolder(folderId);
    return;
  }

  if (action === 'clear-bookmark-folder') {
    await clearBookmarkBoardConfigPreference();
    bookmarkBoardItems = [];
    bookmarkBoardCurrentFolder = null;
    bookmarkBoardSearchQuery = '';
    bookmarkBoardStateById = {};
    bookmarkBoardSearchQueries = {};
    await renderBookmarkFolderPicker();
    await renderBookmarkBoardSection();
    showToast(t('toastBookmarkFolderCleared'));
    return;
  }

  if (action === 'remove-bookmark-board') {
    const boardId = actionEl.dataset.bookmarkBoardId;
    if (!boardId) return;
    const board = getBookmarkBoardEntry(boardId);
    if (!board) return;
    openConfirmModal({
      title: t('bookmarkBoardRemove'),
      body: t('bookmarkBoardRemoveConfirm', board.folderTitle || board.currentFolderTitle || ''),
      confirmLabel: t('confirmDialogConfirm'),
      onConfirm: async () => {
        await removeBookmarkBoardEntry(boardId);
      },
    });
    return;
  }

  if (action === 'choose-background-image') {
    const input = document.getElementById('backgroundImageInput');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = '';
    input.click();
    return;
  }

  if (action === 'clear-background-image') {
    try {
      await clearBackgroundPreference();
      showToast(t('toastBackgroundCleared'));
    } catch (err) {
      console.warn('[tab-out] Could not clear background:', err);
      showToast(t('toastBackgroundFailed'));
    }
    return;
  }

  if (action === 'toggle-stash-menu') {
    const trigger = document.getElementById('stashMenuTrigger');
    if (!trigger || trigger.hidden) return;
    setStashMenuOpen(!isStashMenuOpen);
    return;
  }

  if (action === 'toggle-session-panel') {
    const trigger = document.getElementById('sessionFabTrigger');
    if (!trigger || trigger.hidden) return;
    const nextOpen = !isSessionPanelOpen;
    setSessionPanelOpen(nextOpen);
    if (nextOpen) {
      await markSessionsViewed();
    }
    return;
  }

  if (action === 'close-session-modal') {
    e.preventDefault();
    e.stopPropagation();
    closeSessionModal();
    return;
  }

  if (action === 'stash-current-window') {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      const tabs = (await queryRealTabsSnapshot()).filter(tab => tab.windowId === currentWindow.id);
      if (tabs.length === 0) {
        showToast(t('toastSessionNothingToSave'));
        return;
      }

      const session = await stashTabsAsSession(tabs, 'current-window');
      setStashMenuOpen(false);
      await renderDashboard();
      showToast(t('toastSessionSaved', tabs.length));
      if (session?.id) await openSessionModal(session.id);
    } catch (err) {
      console.warn('[tab-out] Could not stash current window:', err);
      showToast(t('toastSessionSaveFailed'));
    }
    return;
  }

  if (action === 'stash-all-windows') {
    try {
      const tabs = await queryRealTabsSnapshot();
      if (tabs.length === 0) {
        showToast(t('toastSessionNothingToSave'));
        return;
      }

      const sessions = await stashWindowsAsSessions(tabs);
      setStashMenuOpen(false);
      await renderDashboard();
      showToast(t('toastSessionSaved', tabs.length));
      if (sessions.length === 1 && sessions[0]?.id) await openSessionModal(sessions[0].id);
    } catch (err) {
      console.warn('[tab-out] Could not stash all windows:', err);
      showToast(t('toastSessionSaveFailed'));
    }
    return;
  }

  if (action === 'restore-session') {
    const sessionId = actionEl.dataset.sessionId;
    if (!sessionId) return;

    try {
      const session = await restoreSession(sessionId);
      setSessionPanelOpen(false);
      await markSessionsViewed();
      await refreshDashboardAfterSessionChange(360);
      if (session.skippedCount > 0) {
        showToast(t('toastSessionRestoredWithSkipped', session.restoredCount, session.skippedCount));
      } else {
        showToast(t('toastSessionRestored', session.restoredCount));
      }
    } catch (err) {
      console.warn('[tab-out] Could not restore session:', err);
      showToast(t('toastSessionRestoreFailed'));
    }
    return;
  }

  if (action === 'restore-session-tab') {
    const sessionId = actionEl.dataset.sessionId;
    const url = actionEl.dataset.sessionTabUrl;
    if (!sessionId || !url) return;

    try {
      await restoreSessionTab(sessionId, url);
      await markSessionsViewed();
      await refreshDashboardAfterSessionChange(320);
    } catch (err) {
      console.warn('[tab-out] Could not restore session tab:', err);
      showToast(t('toastSessionRestoreFailed'));
    }
    return;
  }

  if (action === 'open-session-modal') {
    e.preventDefault();
    e.stopPropagation();
    await openSessionModal(actionEl.dataset.sessionId || '');
    return;
  }

  if (action === 'toggle-session-pinned') {
    e.preventDefault();
    e.stopPropagation();
    const sessionId = actionEl.dataset.sessionId;
    if (!sessionId) return;

    try {
      const sessions = await getTabSessions();
      const session = sessions.find(item => item.id === sessionId);
      if (!session) return;
      await updateSession(sessionId, { pinned: !session.pinned });
      await renderDashboard();
      showToast(t(session.pinned ? 'toastSessionUnpinned' : 'toastSessionPinned'));
    } catch (err) {
      console.warn('[tab-out] Could not toggle session pinned state:', err);
      showToast(t('toastSessionSaveFailed'));
    }
    return;
  }

  if (action === 'delete-session') {
    const sessionId = actionEl.dataset.sessionId;
    if (!sessionId) return;

    const sessions = await getTabSessions();
    const session = sessions.find(item => item.id === sessionId);
    if (!session) return;
    openConfirmModal({
      title: t('sessionDelete'),
      body: t('sessionDeleteConfirm', getSessionTitle(session)),
      onConfirm: async () => {
        await deleteSession(sessionId);
        await renderDashboard();
        showToast(t('toastSessionDeleted'));
      },
    });
    return;
  }

  if (action === 'pack-tab-group') {
    e.preventDefault();
    e.stopPropagation();
    const sessions = await getTabSessions();
    if (sessions.length < 1) {
      showToast(t('toastSessionTabGroupEmpty'));
      return;
    }
    const nextSession = await packAllSessionsAsTabGroup();
    if (!nextSession) return;
    await renderDashboard();
    showToast(t('toastSessionTabGroupPacked', nextSession.tabs.length, sessions.length));
    return;
  }

  if (action === 'open-quick-link-modal') {
    e.preventDefault();
    e.stopPropagation();
    const hadOpenQuickLinkMenu = !!activeQuickLinkMenuId;
    activeQuickLinkMenuId = '';
    if (hadOpenQuickLinkMenu) {
      await renderQuickLinksSection();
    }
    openQuickLinkModal(actionEl.dataset.quickLinkId || '', {
      title: actionEl.dataset.tabTitle || '',
      url: actionEl.dataset.tabUrl || '',
    });
    return;
  }

  if (action === 'add-quick-link-from-tab-id') {
    e.preventDefault();
    e.stopPropagation();
    const tabId = Number(actionEl.dataset.tabId);
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(item => item.id === tabId);
    if (!tab?.url) return;
    const safeTitle = String(tab.title || tab.url).trim();
    const safeUrl = String(tab.url).trim();
    const existing = quickLinks.find(item => item.url === safeUrl);
    if (existing) {
      openQuickLinkModal(existing.id);
      return;
    }
    openQuickLinkModal('', { title: safeTitle, url: safeUrl });
    return;
  }

  if (action === 'close-quick-link-modal') {
    e.preventDefault();
    e.stopPropagation();
    closeQuickLinkModal();
    return;
  }

  if (action === 'close-bookmark-collection-modal') {
    e.preventDefault();
    e.stopPropagation();
    closeBookmarkCollectionModal();
    return;
  }

  if (action === 'close-bookmark-collection-detail') {
    e.preventDefault();
    e.stopPropagation();
    closeBookmarkCollectionDetailModal();
    return;
  }

  if (action === 'set-bookmark-collection-mode') {
    e.preventDefault();
    e.stopPropagation();
    const mode = actionEl.dataset.bookmarkCollectionMode === 'append' ? 'append' : 'create';
    if (mode === 'append' && bookmarkCollections.length === 0) return;
    bookmarkCollectionModalMode = mode;
    closeBookmarkCollectionSelectMenu();
    syncBookmarkCollectionModalText();
    return;
  }

  if (action === 'toggle-bookmark-collection-select') {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById('bookmarkCollectionSelectMenu');
    const trigger = document.getElementById('bookmarkCollectionSelectTrigger');
    if (!menu || !trigger) return;
    const isOpen = menu.style.display === 'block';
    if (isOpen) {
      closeBookmarkCollectionSelectMenu();
    } else {
      syncBookmarkCollectionSelectControl();
      menu.style.display = 'block';
      trigger.setAttribute('aria-expanded', 'true');
    }
    return;
  }

  if (action === 'select-bookmark-collection-option') {
    e.preventDefault();
    e.stopPropagation();
    const hiddenInput = document.getElementById('bookmarkCollectionExistingSelect');
    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = actionEl.dataset.bookmarkCollectionId || '';
    }
    syncBookmarkCollectionSelectControl();
    closeBookmarkCollectionSelectMenu();
    return;
  }

  if (action === 'open-quick-link') {
    const hadOpenQuickLinkMenu = !!activeQuickLinkMenuId;
    activeQuickLinkMenuId = '';
    if (hadOpenQuickLinkMenu && quickLinksOpenMode === 'new-tab') {
      await renderQuickLinksSection();
    }
    const linkId = actionEl.dataset.quickLinkId;
    const link = quickLinks.find(item => item.id === linkId);
    if (!link) return;

    try {
      await openQuickLink(link.url);
    } catch (err) {
      console.warn('[tab-out] Could not open quick link:', err);
      showToast(t('toastQuickLinkInvalidUrl'));
    }
    return;
  }

  if (action === 'open-bookmark-board-item') {
    const url = actionEl.dataset.bookmarkUrl;
    if (!url) return;

    try {
      const result = await openBookmarkUrls([url]);
      if (result.reusedCount > 0 && result.reusedTabs[0]?.id) {
        await focusTabById(result.reusedTabs[0].id);
      }
    } catch (err) {
      console.warn('[tab-out] Could not open bookmark board item:', err);
      showToast(t('toastBookmarkOpenFailed'));
    }
    return;
  }

  if (action === 'enter-bookmark-board-selection-mode') {
    e.preventDefault();
    e.stopPropagation();
    const boardId = actionEl.dataset.bookmarkBoardId;
    if (!boardId) return;
    setBookmarkBoardSelectionState(boardId, {
      isSelectionMode: true,
      selectedIds: [],
    });
    await renderBookmarkBoardSection();
    return;
  }

  if (action === 'cancel-bookmark-board-selection-mode') {
    e.preventDefault();
    e.stopPropagation();
    const boardId = actionEl.dataset.bookmarkBoardId;
    if (!boardId) return;
    clearBookmarkBoardSelectionState(boardId);
    await renderBookmarkBoardSection();
    return;
  }

  if (action === 'toggle-bookmark-board-selection') {
    e.preventDefault();
    e.stopPropagation();
    const boardId = actionEl.dataset.bookmarkBoardId;
    const bookmarkId = actionEl.dataset.bookmarkId;
    if (!boardId || !bookmarkId) return;

    const current = getBookmarkBoardSelectionState(boardId);
    const nextSelectedIds = current.selectedIds.includes(bookmarkId)
      ? current.selectedIds.filter(id => id !== bookmarkId)
      : [...current.selectedIds, bookmarkId];

    setBookmarkBoardSelectionState(boardId, {
      isSelectionMode: true,
      selectedIds: nextSelectedIds,
    });
    await renderBookmarkBoardSection();
    return;
  }

  if (action === 'select-all-bookmark-board-items' || action === 'clear-all-bookmark-board-selection') {
    e.preventDefault();
    e.stopPropagation();
    const boardId = actionEl.dataset.bookmarkBoardId;
    const boardState = boardId ? bookmarkBoardStateById[boardId] : null;
    const items = boardState?.items || [];
    const bookmarkIds = getBookmarkItemsForBatchActions(items).map(item => item.id);
    if (!boardId) return;

    setBookmarkBoardSelectionState(boardId, {
      isSelectionMode: true,
      selectedIds: action === 'select-all-bookmark-board-items' ? bookmarkIds : [],
    });
    await renderBookmarkBoardSection();
    return;
  }

  if (action === 'save-bookmark-collection') {
    e.preventDefault();
    e.stopPropagation();
    const boardId = actionEl.dataset.bookmarkBoardId;
    const boardState = boardId ? bookmarkBoardStateById[boardId] : null;
    const items = getBookmarkItemsForBatchActions(boardState?.items || []);
    const selectionState = getBookmarkBoardSelectionState(boardId);
    const selectedItems = items.filter(item => selectionState.selectedIds.includes(item.id));
    if (!boardId || selectedItems.length === 0) {
      showToast(t('toastBookmarkCollectionEmpty'));
      return;
    }
    openBookmarkCollectionModal(boardId);
    return;
  }

  if (action === 'open-selected-bookmark-board-items' || action === 'open-all-bookmark-board-items') {
    e.preventDefault();
    e.stopPropagation();
    const boardId = actionEl.dataset.bookmarkBoardId;
    const boardState = boardId ? bookmarkBoardStateById[boardId] : null;
    const items = boardState?.items || [];
    const bookmarkItems = getBookmarkItemsForBatchActions(items);
    if (!boardId || bookmarkItems.length === 0) {
      showToast(t('toastBookmarkBatchEmpty'));
      return;
    }

    const selectionState = getBookmarkBoardSelectionState(boardId);
    const urls = action === 'open-all-bookmark-board-items'
      ? bookmarkItems.map(item => item.url)
      : bookmarkItems.filter(item => selectionState.selectedIds.includes(item.id)).map(item => item.url);

    if (urls.length === 0) {
      showToast(t('toastBookmarkBatchEmpty'));
      return;
    }

    try {
      const { openedCount, reusedCount } = await openBookmarkUrls(urls);
      clearBookmarkBoardSelectionState(boardId);
      await renderBookmarkBoardSection();
      showToast(
        reusedCount > 0
          ? t('toastBookmarkBatchOpenedWithReuse', openedCount, reusedCount)
          : t('toastBookmarkBatchOpened', openedCount)
      );
    } catch (err) {
      console.warn('[tab-out] Could not batch open bookmark board items:', err);
      showToast(t('toastBookmarkOpenFailed'));
    }
    return;
  }

  if (action === 'open-bookmark-collection') {
    e.preventDefault();
    e.stopPropagation();
    const collectionId = actionEl.dataset.bookmarkCollectionId;
    const collection = getBookmarkCollectionById(collectionId);
    if (!collection) return;

    try {
      const { openedCount, reusedCount } = await openBookmarkUrls(collection.items.map(item => item.url));
      showToast(
        reusedCount > 0
          ? t('toastBookmarkBatchOpenedWithReuse', openedCount, reusedCount)
          : t('toastBookmarkBatchOpened', openedCount)
      );
    } catch (err) {
      console.warn('[tab-out] Could not open bookmark collection:', err);
      showToast(t('toastBookmarkOpenFailed'));
    }
    return;
  }

  if (action === 'open-bookmark-collection-detail') {
    e.preventDefault();
    e.stopPropagation();
    const collectionId = actionEl.dataset.bookmarkCollectionId;
    if (!collectionId) return;
    openBookmarkCollectionDetailModal(collectionId);
    return;
  }

  if (action === 'open-bookmark-collection-from-detail') {
    e.preventDefault();
    e.stopPropagation();
    const collectionId = actionEl.dataset.bookmarkCollectionId || activeBookmarkCollectionId;
    const collection = getBookmarkCollectionById(collectionId);
    if (!collection) return;

    try {
      const { openedCount, reusedCount } = await openBookmarkUrls(collection.items.map(item => item.url));
      showToast(
        reusedCount > 0
          ? t('toastBookmarkBatchOpenedWithReuse', openedCount, reusedCount)
          : t('toastBookmarkBatchOpened', openedCount)
      );
    } catch (err) {
      console.warn('[tab-out] Could not open bookmark collection from detail modal:', err);
      showToast(t('toastBookmarkOpenFailed'));
    }
    return;
  }

  if (action === 'open-bookmark-collection-item') {
    e.preventDefault();
    e.stopPropagation();
    const url = actionEl.dataset.bookmarkUrl;
    if (!url) return;

    try {
      const { openedCount, reusedCount } = await openBookmarkUrls([url]);
      showToast(
        reusedCount > 0
          ? t('toastBookmarkBatchOpenedWithReuse', openedCount, reusedCount)
          : t('toastBookmarkBatchOpened', openedCount)
      );
    } catch (err) {
      console.warn('[tab-out] Could not open bookmark collection item:', err);
      showToast(t('toastBookmarkOpenFailed'));
    }
    return;
  }

  if (action === 'delete-bookmark-collection') {
    e.preventDefault();
    e.stopPropagation();
    const collectionId = actionEl.dataset.bookmarkCollectionId;
    const collection = getBookmarkCollectionById(collectionId);
    if (!collection) return;
    openConfirmModal({
      title: t('bookmarkCollectionDelete'),
      body: t('bookmarkCollectionDeleteConfirm', collection.name),
      onConfirm: async () => {
        if (activeBookmarkCollectionId === collectionId) closeBookmarkCollectionDetailModal();
        await saveBookmarkCollections(bookmarkCollections.filter(item => item.id !== collectionId));
        await renderBookmarkBoardSection();
        showToast(t('toastBookmarkCollectionDeleted'));
      },
    });
    return;
  }

  if (action === 'delete-bookmark-board-item') {
    e.preventDefault();
    e.stopPropagation();
    const bookmarkId = actionEl.dataset.bookmarkId;
    const boardId = actionEl.dataset.bookmarkBoardId;
    const boardState = boardId ? bookmarkBoardStateById[boardId] : null;
    const sourceItems = boardState?.items || bookmarkBoardItems;
    const item = sourceItems.find(entry => entry.type === 'bookmark' && entry.id === bookmarkId);
    if (!bookmarkId || !item) return;
    openConfirmModal({
      title: t('bookmarkBoardDelete'),
      body: t('bookmarkBoardDeleteConfirm', item.title),
      confirmLabel: t('confirmDialogConfirm'),
      onConfirm: async () => {
        try {
          await chrome.bookmarks.remove(bookmarkId);
          bookmarkBoardItems = [];
          if (boardId) delete bookmarkBoardStateById[boardId];
          if (boardId) {
            const current = getBookmarkBoardSelectionState(boardId);
            if (current.selectedIds.includes(bookmarkId)) {
              setBookmarkBoardSelectionState(boardId, {
                isSelectionMode: current.isSelectionMode,
                selectedIds: current.selectedIds.filter(id => id !== bookmarkId),
              });
            }
          }
          await renderBookmarkBoardSection();
          showToast(t('toastBookmarkDeleted'));
        } catch (err) {
          console.warn('[tab-out] Could not delete bookmark:', err);
          showToast(t('toastBookmarkDeleteFailed'));
        }
      },
    });
    return;
  }

  if (action === 'open-bookmark-board-folder') {
    const folderId = actionEl.dataset.bookmarkFolderId;
    const boardId = actionEl.dataset.bookmarkBoardId;
    const board = boardId ? getBookmarkBoardEntry(boardId) : null;
    const sourceItems = boardId ? (bookmarkBoardStateById[boardId]?.items || []) : bookmarkBoardItems;
    const folder = sourceItems.find(item => item.type === 'folder' && item.id === folderId);
    if (!folder) return;

    if (board) {
      await updateBookmarkBoardEntry(board.id, {
        currentFolderId: folder.id,
        currentFolderTitle: folder.title,
      });
      setBookmarkBoardSearchQuery(board.id, '');
      delete bookmarkBoardStateById[board.id];
      clearBookmarkBoardSelectionState(board.id);
    } else {
      await saveBookmarkBoardConfigPreference({
        ...bookmarkBoardConfig,
        currentFolderId: folder.id,
        currentFolderTitle: folder.title,
      });
    }
    bookmarkBoardItems = [];
    bookmarkBoardCurrentFolder = null;
    await renderBookmarkBoardSection();
    return;
  }

  if (action === 'bookmark-board-go-up') {
    const boardId = actionEl.dataset.bookmarkBoardId;
    const board = boardId ? getBookmarkBoardEntry(boardId) : null;
    if (board) {
      const currentFolderId = board.currentFolderId || board.folderId;
      if (!currentFolderId || currentFolderId === board.folderId) return;
      let currentFolder = bookmarkBoardStateById[board.id]?.currentFolder;
      if (!currentFolder?.parentId) {
        const state = await loadBookmarkBoardItems(board);
        currentFolder = state.currentFolder;
      }
      const parentId = currentFolder?.parentId || board.folderId;
      const nextFolderId = parentId === board.folderId || !parentId ? board.folderId : parentId;
      let nextTitle = board.folderTitle;
      try {
        const [parentNode] = await chrome.bookmarks.get(nextFolderId);
        if (parentNode?.title) nextTitle = parentNode.title;
      } catch {}
      await updateBookmarkBoardEntry(board.id, {
        currentFolderId: nextFolderId,
        currentFolderTitle: nextTitle,
      });
      setBookmarkBoardSearchQuery(board.id, '');
      delete bookmarkBoardStateById[board.id];
      clearBookmarkBoardSelectionState(board.id);
      await renderBookmarkBoardSection();
      return;
    }

    const currentFolderId = bookmarkBoardConfig.currentFolderId || bookmarkBoardConfig.folderId;
    if (!currentFolderId || currentFolderId === bookmarkBoardConfig.folderId) return;
    if (!bookmarkBoardCurrentFolder?.parentId) {
      await loadBookmarkBoardItems();
    }

    const parentId = bookmarkBoardCurrentFolder?.parentId || bookmarkBoardConfig.folderId;
    const nextFolderId = parentId === bookmarkBoardConfig.folderId || !parentId ? bookmarkBoardConfig.folderId : parentId;
    let nextTitle = bookmarkBoardConfig.folderTitle;

    try {
      const [parentNode] = await chrome.bookmarks.get(nextFolderId);
      if (parentNode?.title) nextTitle = parentNode.title;
    } catch {}

    await saveBookmarkBoardConfigPreference({
      ...bookmarkBoardConfig,
      currentFolderId: nextFolderId,
      currentFolderTitle: nextTitle,
    });
    bookmarkBoardSearchQuery = '';
    bookmarkBoardItems = [];
    bookmarkBoardCurrentFolder = null;
    await renderBookmarkBoardSection();
    return;
  }

  if (action === 'focus-tab-id') {
    const tabId = Number(actionEl.dataset.tabId);
    if (!Number.isFinite(tabId)) return;
    await focusTabById(tabId);
    return;
  }

  if (action === 'toggle-quick-link-menu') {
    e.preventDefault();
    e.stopPropagation();
    const linkId = actionEl.dataset.quickLinkId || '';
    activeQuickLinkMenuId = activeQuickLinkMenuId === linkId ? '' : linkId;
    await renderQuickLinksSection();
    return;
  }

  if (action === 'edit-quick-link') {
    e.preventDefault();
    e.stopPropagation();
    const hadOpenQuickLinkMenu = !!activeQuickLinkMenuId;
    activeQuickLinkMenuId = '';
    if (hadOpenQuickLinkMenu) {
      await renderQuickLinksSection();
    }
    openQuickLinkModal(actionEl.dataset.quickLinkId || '');
    return;
  }

  if (action === 'delete-quick-link') {
    e.preventDefault();
    e.stopPropagation();
    const linkId = actionEl.dataset.quickLinkId;
    const link = quickLinks.find(item => item.id === linkId);
    if (!link) return;
    openConfirmModal({
      title: t('quickLinkDelete'),
      body: t('quickLinkDeleteConfirm', link.title),
      onConfirm: async () => {
        activeQuickLinkMenuId = '';
        await saveQuickLinks(quickLinks.filter(item => item.id !== linkId));
        await renderQuickLinksSection();
        showToast(t('toastQuickLinkDeleted'));
      },
    });
    return;
  }

  // ---- Close duplicate TabNest tabs ----
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    playCloseSound();
    const banner = document.getElementById('tabOutDupeBanner');
    if (banner) {
      banner.style.transition = 'opacity 0.4s';
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1'; }, 400);
    }
    showToast(t('toastClosedExtraTabOutTabs'));
    return;
  }

  const card = actionEl.closest('.mission-card');

  // ---- Expand overflow chips ("+N more") ----
  if (action === 'expand-chips') {
    const overflowContainer = actionEl.parentElement.querySelector('.page-chips-overflow');
    if (overflowContainer) {
      overflowContainer.style.display = 'contents';
      actionEl.remove();
    }
    return;
  }

  // ---- Focus a specific tab ----
  if (action === 'focus-tab') {
    const tabUrl = actionEl.dataset.tabUrl;
    if (tabUrl) await focusTab(tabUrl);
    return;
  }

  // ---- Close a single tab ----
  if (action === 'close-single-tab') {
    e.stopPropagation(); // don't trigger parent chip's focus-tab
    const tabUrl = actionEl.dataset.tabUrl;
    if (!tabUrl) return;

    // Close the tab in Chrome directly
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    playCloseSound();

    // Animate the chip row out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      const rect = chip.getBoundingClientRect();
      shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => {
        chip.remove();
        // If the card now has no tabs, remove it too
        const parentCard = document.querySelector('.mission-card:has(.mission-pages:empty)');
        if (parentCard) animateCardOut(parentCard);
        document.querySelectorAll('.mission-card').forEach(c => {
          if (c.querySelectorAll('.page-chip[data-action="focus-tab"]').length === 0) {
            animateCardOut(c);
          }
        });
      }, 200);
    }

    // Update footer
    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;

    showToast(t('toastTabClosed'));
    return;
  }

  if (action === 'close-single-tab-id') {
    e.stopPropagation();
    const tabId = Number(actionEl.dataset.tabId);
    if (!Number.isFinite(tabId)) return;

    await chrome.tabs.remove(tabId);
    await fetchOpenTabs();
    await renderDashboard();
    playCloseSound();
    showToast(t('toastTabClosed'));
    return;
  }

  // ---- Save a single tab for later (then close it) ----
  if (action === 'defer-single-tab') {
    e.stopPropagation();
    const tabUrl   = actionEl.dataset.tabUrl;
    const tabTitle = actionEl.dataset.tabTitle || tabUrl;
    if (!tabUrl) return;

    // Save to chrome.storage.local
    try {
      await saveTabForLater({ url: tabUrl, title: tabTitle });
    } catch (err) {
      console.error('[tab-out] Failed to save tab:', err);
      showToast(t('toastSaveFailed'));
      return;
    }

    // Close the tab in Chrome
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    // Animate chip out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => chip.remove(), 200);
    }

    showToast(t('toastSavedForLater'));
    await renderDeferredColumn();
    return;
  }

  if (action === 'defer-single-tab-id') {
    e.stopPropagation();
    const tabId = Number(actionEl.dataset.tabId);
    if (!Number.isFinite(tabId)) return;

    const tab = openTabs.find(item => item.id === tabId);
    if (!tab?.url) return;

    try {
      await saveTabForLater({ url: tab.url, title: tab.title || tab.url });
    } catch (err) {
      console.error('[tab-out] Failed to save tab:', err);
      showToast(t('toastSaveFailed'));
      return;
    }

    await chrome.tabs.remove(tabId);
    await fetchOpenTabs();
    await renderDashboard();
    showToast(t('toastSavedForLater'));
    return;
  }

  // ---- Check off a saved tab (moves it to archive) ----
  if (action === 'check-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await checkOffSavedTab(id);

    // Animate: strikethrough first, then slide out
    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('checked');
      setTimeout(() => {
        item.classList.add('removing');
        setTimeout(() => {
          item.remove();
          renderDeferredColumn(); // refresh counts and archive
        }, 300);
      }, 800);
    }
    return;
  }

  // ---- Dismiss a saved tab (removes it entirely) ----
  if (action === 'dismiss-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 300);
    }
    return;
  }

  // ---- Dismiss an archived tab (removes it entirely) ----
  if (action === 'dismiss-archived') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.archive-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 300);
    }
    return;
  }

  // ---- Close all tabs in a domain group ----
  if (action === 'close-domain-tabs') {
    const domainId = actionEl.dataset.domainId;
    const group    = domainGroups.find(g => {
      return 'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId;
    });
    if (!group) return;

    const urls      = group.tabs.map(t => t.url);
    // Landing pages and custom groups (whose domain key isn't a real hostname)
    // must use exact URL matching to avoid closing unrelated tabs
    const useExact  = group.domain === '__landing-pages__' || !!group.label;

    if (useExact) {
      await closeTabsExact(urls);
    } else {
      await closeTabsByUrls(urls);
    }

    if (card) {
      playCloseSound();
      animateCardOut(card);
    }

    // Remove from in-memory groups
    const idx = domainGroups.indexOf(group);
    if (idx !== -1) domainGroups.splice(idx, 1);

    const groupLabel = group.domain === '__landing-pages__' ? t('homepages') : (group.label || friendlyDomain(group.domain));
    showToast(t('toastClosedGroupTabs', urls.length, groupLabel));

    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;

    return;
  }

  // ---- Close duplicates, keep one copy ----
  if (action === 'dedup-keep-one') {
    const urlsEncoded = actionEl.dataset.dupeUrls || '';
    const urls = urlsEncoded.split(',').map(u => decodeURIComponent(u)).filter(Boolean);
    if (urls.length === 0) return;

    await closeDuplicateTabs(urls, true);
    playCloseSound();

    // Hide the dedup button
    actionEl.style.transition = 'opacity 0.2s';
    actionEl.style.opacity    = '0';
    setTimeout(() => actionEl.remove(), 200);

    // Remove dupe badges from the card
    if (card) {
      card.querySelectorAll('.chip-dupe-badge').forEach(b => {
        b.style.transition = 'opacity 0.2s';
        b.style.opacity    = '0';
        setTimeout(() => b.remove(), 200);
      });
      card.querySelectorAll('.duplicate-badge').forEach(badge => {
        badge.style.transition = 'opacity 0.2s';
        badge.style.opacity    = '0';
        setTimeout(() => badge.remove(), 200);
      });
      card.classList.remove('has-amber-bar');
      card.classList.add('has-neutral-bar');
    }

    showToast(t('toastClosedDuplicates'));
    return;
  }

  // ---- Close ALL open tabs ----
  if (action === 'close-all-open-tabs') {
    const allUrls = openTabs
      .filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:'))
      .map(t => t.url);
    await closeTabsByUrls(allUrls);
    playCloseSound();

    document.querySelectorAll('#openTabsMissions .mission-card').forEach(c => {
      shootConfetti(
        c.getBoundingClientRect().left + c.offsetWidth / 2,
        c.getBoundingClientRect().top  + c.offsetHeight / 2
      );
      animateCardOut(c);
    });

    showToast(t('toastClosedAllTabs'));
    return;
  }
});

document.getElementById('quickLinkForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idInput = document.getElementById('quickLinkId');
  const nameInput = document.getElementById('quickLinkNameInput');
  const urlInput = document.getElementById('quickLinkUrlInput');
  if (!idInput || !nameInput || !urlInput) return;

  const title = nameInput.value.trim();
  const existingId = idInput.value.trim();
  let url;

  if (!title) {
    showToast(t('toastQuickLinkInvalidName'));
    nameInput.focus();
    return;
  }

  try {
    url = normalizeQuickLinkUrl(urlInput.value);
  } catch {
    showToast(t('toastQuickLinkInvalidUrl'));
    urlInput.focus();
    return;
  }

  const nextLink = normalizeQuickLink({
    id: existingId || `quick-link-${Date.now()}`,
    title,
    url,
    createdAt: existingId ? (quickLinks.find(item => item.id === existingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    order: existingId ? (quickLinks.find(item => item.id === existingId)?.order ?? quickLinks.length) : quickLinks.length,
  }, quickLinks.length);

  if (existingId) {
    await saveQuickLinks(quickLinks.map(item => item.id === existingId ? nextLink : item));
    showToast(t('toastQuickLinkUpdated'));
  } else {
    await saveQuickLinks([...quickLinks, nextLink]);
    showToast(t('toastQuickLinkAdded'));
  }

  await renderQuickLinksSection();
  closeQuickLinkModal();
});

document.getElementById('bookmarkCollectionForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const boardIdInput = document.getElementById('bookmarkCollectionBoardId');
  const nameInput = document.getElementById('bookmarkCollectionNameInput');
  const existingSelect = document.getElementById('bookmarkCollectionExistingSelect');
  if (!(boardIdInput instanceof HTMLInputElement) || !(nameInput instanceof HTMLInputElement)) return;

  const boardId = boardIdInput.value.trim();
  const board = getBookmarkBoardEntry(boardId);
  const boardState = boardId ? bookmarkBoardStateById[boardId] : null;
  const items = getBookmarkItemsForBatchActions(boardState?.items || []);
  const selectionState = getBookmarkBoardSelectionState(boardId);
  const selectedItems = items.filter(item => selectionState.selectedIds.includes(item.id));

  if (selectedItems.length === 0) {
    showToast(t('toastBookmarkCollectionEmpty'));
    closeBookmarkCollectionModal();
    return;
  }

  const incomingItems = selectedItems.map((item, index) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    order: index,
  }));

  if (bookmarkCollectionModalMode === 'append') {
    if (!(existingSelect instanceof HTMLInputElement) || !existingSelect.value) {
      showToast(t('toastBookmarkCollectionSelectExisting'));
      const trigger = document.getElementById('bookmarkCollectionSelectTrigger');
      if (trigger instanceof HTMLButtonElement) trigger.focus();
      return;
    }

    const targetCollectionId = existingSelect.value;
    const targetCollection = getBookmarkCollectionById(targetCollectionId);
    if (!targetCollection) {
      showToast(t('toastBookmarkCollectionSelectExisting'));
      const trigger = document.getElementById('bookmarkCollectionSelectTrigger');
      if (trigger instanceof HTMLButtonElement) trigger.focus();
      return;
    }

    const nextCollections = bookmarkCollections.map(collection => {
      if (collection.id !== targetCollectionId) return collection;
      return normalizeBookmarkCollection({
        ...collection,
        boardId: boardId || collection.boardId,
        boardTitle: collection.boardTitle || board?.folderTitle || board?.currentFolderTitle || '',
        items: mergeBookmarkCollectionItems(collection.items, incomingItems),
      });
    });

    await saveBookmarkCollections(nextCollections);
    clearBookmarkBoardSelectionState(boardId);
    closeBookmarkCollectionModal();
    await renderBookmarkBoardSection();
    showToast(t('toastBookmarkCollectionUpdated'));
    return;
  }

  const name = nameInput.value.trim();
  if (!name) {
    showToast(t('toastBookmarkCollectionInvalidName'));
    nameInput.focus();
    return;
  }

  const nextCollection = normalizeBookmarkCollection({
    id: `bookmark-collection-${Date.now()}`,
    name,
    boardId,
    boardTitle: board?.folderTitle || board?.currentFolderTitle || '',
    createdAt: new Date().toISOString(),
    items: mergeBookmarkCollectionItems([], incomingItems),
  }, bookmarkCollections.length);

  await saveBookmarkCollections([nextCollection, ...bookmarkCollections]);
  clearBookmarkBoardSelectionState(boardId);
  closeBookmarkCollectionModal();
  await renderBookmarkBoardSection();
  showToast(t('toastBookmarkCollectionSaved'));
});

document.getElementById('sessionForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idInput = document.getElementById('sessionIdInput');
  const nameInput = document.getElementById('sessionNameInput');
  const pinnedInput = document.getElementById('sessionPinnedInput');
  if (!(idInput instanceof HTMLInputElement) || !(nameInput instanceof HTMLInputElement) || !(pinnedInput instanceof HTMLInputElement)) return;

  const sessionId = idInput.value.trim();
  const name = nameInput.value.trim();
  const pinned = !!pinnedInput.checked;

  if (!name) {
    showToast(t('toastSessionInvalidName'));
    nameInput.focus();
    return;
  }

  try {
    await updateSession(sessionId, { name, pinned });
    closeSessionModal();
    await renderDashboard();
    showToast(t('toastSessionUpdated'));
  } catch (err) {
    console.warn('[tab-out] Could not update session:', err);
    showToast(t('toastSessionSaveFailed'));
  }
});

document.getElementById('quickLinkModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'quickLinkModalBackdrop') closeQuickLinkModal();
});

document.getElementById('bookmarkCollectionModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'bookmarkCollectionModalBackdrop') closeBookmarkCollectionModal();
});

document.getElementById('bookmarkCollectionDetailBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'bookmarkCollectionDetailBackdrop') closeBookmarkCollectionDetailModal();
});

document.getElementById('sessionModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'sessionModalBackdrop') closeSessionModal();
});

document.getElementById('settingsModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'settingsModalBackdrop') setSettingsModalOpen(false);
});

document.getElementById('confirmModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'confirmModalBackdrop') closeConfirmModal();
});

document.getElementById('bookmarkFolderSearchInput')?.addEventListener('input', async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  bookmarkFolderSearchQuery = input.value || '';
  await renderBookmarkFolderPicker();
});

document.getElementById('bookmarkBoardSearchInput')?.addEventListener('input', async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  bookmarkBoardSearchQuery = input.value || '';
  await renderBookmarkBoardSection();
});

document.addEventListener('input', async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.action !== 'search-bookmark-board') return;
  if ('isComposing' in e && e.isComposing) return;
  await applyBookmarkBoardSearchInput(input, { restoreFocus: true });
});

document.addEventListener('compositionend', async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.action !== 'search-bookmark-board') return;
  await applyBookmarkBoardSearchInput(input, { restoreFocus: true });
});

document.addEventListener('click', (e) => {
  if (!isSessionPanelOpen && !isStashMenuOpen) return;
  const tools = document.getElementById('floatingTools');
  if (!tools) return;
  if (tools.contains(e.target)) return;
  if (isStashMenuOpen) setStashMenuOpen(false);
  setSessionPanelOpen(false);
});

document.addEventListener('click', (e) => {
  if (!activeQuickLinkMenuId) return;
  if (e.target.closest('.quick-link-menu-shell')) return;
  activeQuickLinkMenuId = '';
  renderQuickLinksSection().catch(err => {
    console.warn('[tab-out] Could not close quick link menu:', err);
  });
});

document.addEventListener('click', (e) => {
  const selectShell = document.getElementById('bookmarkCollectionSelectShell');
  if (!selectShell) return;
  if (selectShell.contains(e.target)) return;
  closeBookmarkCollectionSelectMenu();
});

document.getElementById('backgroundImageInput')?.addEventListener('change', async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;

  const [file] = input.files || [];
  if (!file) return;

  try {
    const imageDataUrl = await prepareBackgroundImage(file);
    await saveBackgroundPreference(imageDataUrl);
    showToast(t('toastBackgroundUpdated'));
  } catch (err) {
    console.warn('[tab-out] Could not update background:', err);
    showToast(t('toastBackgroundFailed'));
  } finally {
    input.value = '';
  }
});

document.addEventListener('error', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLImageElement)) return;

  if (target.dataset.hideOnError === 'true') {
    target.style.display = 'none';
  }

  if (target.dataset.showFallbackOnError === 'next' && target.nextElementSibling instanceof HTMLElement) {
    target.nextElementSibling.style.display = 'flex';
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const backdrop = document.getElementById('quickLinkModalBackdrop');
  if (backdrop?.style.display === 'flex') closeQuickLinkModal();
  const bookmarkCollectionBackdrop = document.getElementById('bookmarkCollectionModalBackdrop');
  if (bookmarkCollectionBackdrop?.style.display === 'flex') closeBookmarkCollectionModal();
  const bookmarkCollectionDetailBackdrop = document.getElementById('bookmarkCollectionDetailBackdrop');
  if (bookmarkCollectionDetailBackdrop?.style.display === 'flex') closeBookmarkCollectionDetailModal();
  const sessionModalBackdrop = document.getElementById('sessionModalBackdrop');
  if (sessionModalBackdrop?.style.display === 'flex') closeSessionModal();
  const confirmBackdrop = document.getElementById('confirmModalBackdrop');
  if (confirmBackdrop?.style.display === 'flex') closeConfirmModal();
  if (isSettingsModalOpen) setSettingsModalOpen(false);
  if (isStashMenuOpen) setStashMenuOpen(false);
  if (isSessionPanelOpen) setSessionPanelOpen(false);
  if (activeQuickLinkMenuId) {
    activeQuickLinkMenuId = '';
    renderQuickLinksSection().catch(err => {
      console.warn('[tab-out] Could not close quick link menu:', err);
    });
  }
});

// ---- Archive toggle — expand/collapse the archive section ----
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#archiveToggle');
  if (!toggle) return;

  toggle.classList.toggle('open');
  const body = document.getElementById('archiveBody');
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
});

// ---- Archive search — filter archived items as user types ----
document.addEventListener('input', async (e) => {
  if (e.target.id !== 'archiveSearch') return;

  const q = e.target.value.trim().toLowerCase();
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;

  try {
    const { archived } = await getSavedTabs();

    if (q.length < 2) {
      // Show all archived items
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      return;
    }

    // Filter by title or URL containing the query string
    const results = archived.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.url  || '').toLowerCase().includes(q)
    );

    archiveList.innerHTML = results.map(item => renderArchiveItem(item)).join('')
      || `<div style="font-size:12px;color:var(--muted);padding:8px 0">${t('noResults')}</div>`;
  } catch (err) {
    console.warn('[tab-out] Archive search failed:', err);
  }
});

function clearWindowDragIndicators() {
  document.querySelectorAll('.window-tab-item.is-drop-before, .window-tab-item.is-drop-after').forEach(item => {
    item.classList.remove('is-drop-before', 'is-drop-after');
  });
}

document.addEventListener('dragstart', (e) => {
  if (currentOpenTabsView !== 'windows') return;
  const item = e.target.closest('.window-tab-item');
  if (!item) return;

  const tabId = Number(item.dataset.tabId);
  const windowId = Number(item.dataset.windowId);
  const tabIndex = Number(item.dataset.tabIndex);
  if (!Number.isFinite(tabId) || !Number.isFinite(windowId) || !Number.isFinite(tabIndex)) return;

  draggedWindowTabState = { tabId, windowId, tabIndex };
  item.classList.add('is-dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tabId));
  }
});

document.addEventListener('dragover', (e) => {
  if (currentOpenTabsView !== 'windows' || !draggedWindowTabState) return;
  const item = e.target.closest('.window-tab-item');
  if (!item) return;

  const targetTabId = Number(item.dataset.tabId);
  const targetWindowId = Number(item.dataset.windowId);
  if (!Number.isFinite(targetTabId) || !Number.isFinite(targetWindowId) || targetTabId === draggedWindowTabState.tabId) return;

  e.preventDefault();
  clearWindowDragIndicators();

  if (targetWindowId !== draggedWindowTabState.windowId) return;

  const rect = item.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // In a grid, we consider both X and Y. 
  // If the mouse is in the right half or bottom half of the card, we insert after.
  const isAfter = e.clientX > centerX || (e.clientX > rect.left && e.clientY > centerY);
  
  item.classList.add(isAfter ? 'is-drop-after' : 'is-drop-before');
});

document.addEventListener('drop', async (e) => {
  if (currentOpenTabsView !== 'windows' || !draggedWindowTabState) return;
  const item = e.target.closest('.window-tab-item');
  if (!item) return;

  e.preventDefault();
  const targetTabId = Number(item.dataset.tabId);
  const targetWindowId = Number(item.dataset.windowId);
  if (!Number.isFinite(targetTabId) || !Number.isFinite(targetWindowId) || targetTabId === draggedWindowTabState.tabId) {
    clearWindowDragIndicators();
    draggedWindowTabState = null;
    return;
  }

  const rect = item.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const insertAfter = e.clientX > centerX || (e.clientX > rect.left && e.clientY > centerY);
  
  clearWindowDragIndicators();

  if (targetWindowId !== draggedWindowTabState.windowId) {
    draggedWindowTabState = null;
    showToast(t('toastTabReorderSameWindowOnly'));
    return;
  }

  try {
    const moved = await moveTabWithinWindow(draggedWindowTabState.tabId, targetTabId, insertAfter);
    if (moved) {
      await renderDashboard();
      showToast(t('toastTabReordered'));
    }
  } catch (err) {
    console.warn('[tab-out] Could not reorder tab:', err);
    showToast(
      err instanceof Error && err.message === 'cross-window-not-supported'
        ? t('toastTabReorderSameWindowOnly')
        : t('toastTabReorderFailed')
    );
  } finally {
    draggedWindowTabState = null;
  }
});

document.addEventListener('dragend', () => {
  document.querySelectorAll('.window-tab-item.is-dragging').forEach(item => item.classList.remove('is-dragging'));
  clearWindowDragIndicators();
  draggedWindowTabState = null;
});


/* ----------------------------------------------------------------
   INITIALIZE
   ---------------------------------------------------------------- */
async function initializeApp() {
  await loadLanguagePreference();
  await loadThemePreference();
  await loadBackgroundPreference();
  await loadQuickLinksOpenModePreference();
  await loadBookmarkCollections();
  await loadBookmarkBoardConfigPreference();
  await loadBookmarkBoardDisplayLimitPreference();
  await loadBookmarkBoardCollapsedPreference();
  await loadBookmarkOpenModePreference();
  await loadOpenTabsViewPreference();
  registerChromeStateListeners();
  await renderDashboard();
}

initializeApp();
