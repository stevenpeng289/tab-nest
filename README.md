# TabNest

> 一个清爽的 Chrome 新标签页工作台，用来整理打开中的标签、书签工作台、资料组合和可恢复的浏览会话。

语言：**简体中文** | [English](README.en.md)

仓库：`Acorn2/tab-nest`

![TabNest 首页](site-assets/screenshots/homepage.png)

TabNest 会替换 Chrome 新标签页，把你已经打开的标签和常用链接整理成一个本地优先的工作台。产品名是 **TabNest**，GitHub 仓库名是 **`tab-nest`**。它可以按域名聚合标签，也可以切换到真实窗口顺序视图；可以把书签目录变成首页工作台，还能把当前窗口或全部窗口收纳成之后可恢复的会话。

无需服务器，无需账号，无追踪。安装就是加载已解压扩展，所有数据都留在你的浏览器里。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)
![Local First](https://img.shields.io/badge/Data-100%25%20local-d97745)

## 为什么做 TabNest？

- **一眼看清打开中的标签**：把真实网页标签按域名分组，主页类页面单独归类，清理时更有方向。
- **按真实窗口管理标签**：在窗口视图中查看每个 Chrome 窗口，并可拖拽调整同一窗口内的真实标签顺序。
- **快速关闭混乱标签**：关闭单个标签、关闭整个域名分组，或清理重复 URL 并保留一份。
- **关闭前先稍后保存**：把暂时不想处理的标签保存到“稍后保存”列表，再关闭当前标签。
- **把书签目录变成工作台**：固定书签目录、搜索目录内容、批量打开选中的链接，并保存成可复用的资料组合。
- **像 OneTab 一样收纳会话**：保存当前窗口或全部窗口，之后可恢复整个会话或单个标签。
- **个性化新标签页**：常用入口、浅色/深色主题、中英文界面、纯色背景和自定义背景图片。
- **本地优先**：偏好设置、稍后保存、书签工作台和会话都保存在 `chrome.storage.local`。

## 界面预览

### 主工作台

首屏结合常用入口和按域名分组的打开标签，帮助你快速理解当前浏览状态。

![主工作台](site-assets/screenshots/homepage.png)

### 窗口视图

切换到窗口视图后，可按 Chrome 窗口分别查看标签。拖拽同一窗口内的标签，会同步调整浏览器真实标签栏顺序。

![窗口视图](site-assets/screenshots/windowsPage.png)

### 快速收纳

通过右侧悬浮按钮，可以选择只收纳当前窗口，或按窗口收纳全部窗口。

![快速收纳](site-assets/screenshots/stash.png)

### 最近会话

已收纳的会话可以整体恢复，也可以只恢复其中某一个标签。

![最近会话](site-assets/screenshots/restore.png)

### 会话面板

最近会话面板常驻在新标签页旁侧，方便随时找回之前的工作现场。

![会话面板](site-assets/screenshots/opensession.png)

## 安装

TabNest 是纯 Chrome 扩展，不需要 Node.js、npm、后端服务或构建步骤。

### 方式一：下载安装包

适合只想安装使用的用户。

1. 打开 [Releases](https://github.com/Acorn2/tab-nest/releases)。
2. 下载最新版本里的 `tab-nest-v*.zip`。
3. 解压这个 zip 文件。
4. 打开 Chrome 扩展管理页。

```text
chrome://extensions
```

5. 打开右上角 **Developer mode / 开发者模式**。
6. 点击 **Load unpacked / 加载已解压的扩展程序**。
7. 选择刚刚解压出来的文件夹。
8. 新建一个标签页，TabNest 会立即出现。

### 方式二：从源码安装

适合想查看代码或参与开发的用户。

1. 克隆仓库。

```bash
git clone https://github.com/Acorn2/tab-nest.git
cd tab-nest
```

2. 打开 Chrome 扩展管理页。

```text
chrome://extensions
```

3. 打开右上角 **Developer mode / 开发者模式**。

4. 点击 **Load unpacked / 加载已解压的扩展程序**。

5. 选择本仓库中的 `extension/` 文件夹。

6. 新建一个标签页，TabNest 会立即出现。

你要选择的目录应类似：

```text
tab-nest/extension/
```

后续更新时，拉取最新代码后回到 `chrome://extensions` 刷新扩展即可。

```bash
git pull
```

## 下载与发布

用户安装包会通过 GitHub Releases 发布：

- 最新发布页：[github.com/Acorn2/tab-nest/releases](https://github.com/Acorn2/tab-nest/releases)
- 当前扩展版本：`1.2.0`
- 安装包命名：`tab-nest-v<version>.zip`

维护者可用脚本生成安装包：

```bash
bash scripts/package-extension.sh
```

脚本会读取 `extension/manifest.json` 中的版本号，并生成类似下面的文件：

```text
dist/tab-nest-v1.2.0.zip
```

发布流程见 [docs/RELEASE.md](docs/RELEASE.md)。

## GitHub 仓库信息建议

如果你正在完善 GitHub 右侧 About 区，可以使用：

- **Description**：`A local-first Chrome new tab workspace for tabs, bookmarks, and restorable sessions.`
- **Website**：启用 GitHub Pages 后填写项目主页地址
- **Topics**：`chrome-extension`, `manifest-v3`, `new-tab`, `tab-manager`, `bookmarks`, `productivity`, `local-first`

## 使用说明

### 打开中的标签

- 点击标签标题可跳转到对应标签，即使它在另一个 Chrome 窗口中。
- 点击单个标签行上的关闭按钮，可只关闭该标签。
- 点击域名分组底部按钮，可关闭该分组下全部标签。
- 使用重复标签清理功能，可保留一份重复 URL 并关闭多余页面。
- 在“域名”和“窗口”两种视图之间切换，按不同方式整理标签。

### 书签工作台

- 在设置中选择一个或多个书签目录，固定到首页。
- 在工作台中直接浏览子目录。
- 搜索当前书签目录。
- 批量选择书签并一次打开。
- 把选中的书签保存为可复用的资料组合。
- 在明确需要清理时，可直接删除单个 Chrome 书签。

### 会话收纳

- 使用右侧悬浮收纳按钮，保存当前窗口或全部窗口。
- 支持恢复整个会话，也支持恢复单个标签。
- 支持重命名、固定、取消固定和删除会话。
- 固定会话适合长期复用；临时会话适合短期清理。

### 个性化

- 添加常用网站快捷入口。
- 设置快捷入口和书签是在当前标签页打开，还是新标签页打开。
- 切换中文 / English。
- 切换浅色 / 深色主题。
- 使用纯色背景或上传自定义背景图片。

## 权限与隐私

TabNest 只申请功能所需的浏览器权限：

| 权限 | 用途 |
| --- | --- |
| `tabs` | 读取、聚焦、关闭和移动浏览器标签。 |
| `storage` | 在本地保存偏好设置、快捷入口、稍后保存、书签工作台配置、资料组合和会话。 |
| `bookmarks` | 读取用户选择的书签目录、浏览书签目录，并在用户主动操作时删除书签。 |
| `favicon` | 在标签、书签和会话列表中显示网站图标。 |

所有应用数据都保存在 `chrome.storage.local`。扩展不包含服务器、统计 SDK、账号系统或远程同步。

## 技术栈

| 模块 | 实现 |
| --- | --- |
| 扩展平台 | Chrome Extension Manifest V3 |
| 界面 | 原生 HTML、CSS、JavaScript |
| 存储 | `chrome.storage.local` |
| 标签操作 | `chrome.tabs` 和 `chrome.windows` API |
| 书签操作 | `chrome.bookmarks` API |
| 新标签页替换 | `chrome_url_overrides` |

## 项目结构

```text
tab-nest/
├── extension/
│   ├── app.js
│   ├── background.js
│   ├── boot.js
│   ├── index.html
│   ├── manifest.json
│   ├── style.css
│   └── icons/
├── site-assets/
│   └── screenshots/
├── index.html
├── privacy-policy.html
├── LICENSE
├── README.en.md
└── README.md
```

## 开发说明

项目没有构建流水线。修改 `extension/` 下的文件后，回到 `chrome://extensions` 刷新已加载的扩展即可。

常用文件：

- `extension/app.js`：工作台状态、渲染逻辑、标签操作、书签工作台、会话、设置和多语言。
- `extension/style.css`：扩展界面样式。
- `extension/index.html`：新标签页页面结构。
- `extension/background.js`：扩展图标 badge 数量更新。
- `index.html`：静态 GitHub Pages / 产品主页。
- `site-assets/screenshots/`：官网和 README 使用的产品截图。

## Roadmap 想法

- 导出 / 导入本地 TabNest 设置。
- 为常用清理动作增加可选快捷键。
- 增强会话搜索和过滤能力。
- 优化首次打开新标签页的引导体验。
- 提供更容易手动安装的打包产物。

## 致谢

TabNest 派生自 Zara Zhang 的原始 Tab Out 项目。

- 原作者：[Zara Zhang](https://github.com/zarazhangrui)
- 原项目：[tab-out](https://github.com/zarazhangrui/tab-out)

## 许可证

[MIT](LICENSE)
