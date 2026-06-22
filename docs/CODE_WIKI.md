# 懂非懂 (DongFeiDong) Code Wiki

> AI 驱动的文化典故解读工具，帮你理解歌词、诗词、日常用语中的典故出处。
> 版本：1.0.0 | 技术栈：纯原生 JavaScript (ES6+) + CSS3 + localStorage

---

## 目录

1. [项目概述](#1-项目概述)
2. [项目架构](#2-项目架构)
3. [核心模块详解](#3-核心模块详解)
4. [页面模块](#4-页面模块)
5. [组件模块](#5-组件模块)
6. [工具模块](#6-工具模块)
7. [数据模型](#7-数据模型)
8. [依赖关系](#8-依赖关系)
9. [项目运行](#9-项目运行)
10. [调试工具](#10-调试工具)

---

## 1. 项目概述

### 1.1 项目简介

"懂非懂"是一款纯前端单页应用（SPA），帮助用户解读中文文本中的文化典故。适用于歌词中的诗词引用、书摘中的历史典故、网络流行语的真实出处等场景。

### 1.2 核心功能

| 功能 | 描述 |
|------|------|
| 智能解读 | 输入歌词、诗词、书摘或角色名，AI 自动识别典故出处 |
| 种子数据库 | 内置 60 条精选典故，覆盖歌词、诗词、历史、误传四大类别 |
| 可信度分级 | 高（种子库匹配）/ 中（AI 推断）/ 低（纯 AI 生成） |
| 每日一辨 | 每日推送一个文化误传辨析 |
| 知识卡片 | 一键生成精美分享卡片，支持保存图片 |
| 历史与收藏 | 本地持久化，随时回顾过往解读 |
| 版权合规 | 自动截断引用内容，确保符合版权规范 |

### 1.3 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | 纯原生 JavaScript (ES6+)，无构建工具 |
| 样式 | CSS3 + CSS 变量，移动端优先 |
| 路由 | Hash-based SPA 路由 |
| 数据存储 | localStorage（前缀 `dfd_`）|
| AI 接口 | 阿里云 DashScope（通义千问 qwen-turbo）|
| 分享卡片 | html2canvas |

---

## 2. 项目架构

### 2.1 目录结构

```
dong-fei-dong/
├── index.html              # 入口页面
├── css/
│   ├── reset.css           # 样式重置
│   ├── variables.css       # 设计令牌（CSS 变量）
│   ├── layout.css           # 布局与页面切换
│   └── components.css      # 组件样式
├── js/
│   ├── app.js              # 应用入口与初始化
│   ├── router.js           # 路由管理
│   ├── logger.js           # 日志系统
│   ├── store.js            # localStorage 封装
│   ├── seed-data.js        # 种子数据库
│   ├── api.js              # AI 接口调用
│   ├── components/         # 可复用组件
│   │   ├── toast.js        # Toast 提示
│   │   ├── modal.js        # 弹窗系统
│   │   ├── credibility.js  # 可信度标签
│   │   └── card-generator.js # 知识卡片生成
│   ├── pages/              # 页面模块
│   │   ├── home.js         # 首页
│   │   ├── result.js       # 解读结果页
│   │   ├── history.js      # 历史记录页
│   │   ├── favorites.js    # 收藏页
│   │   └── daily.js        # 每日一辨页
│   └── utils/              # 工具函数
│       ├── helpers.js      # 通用工具
│       ├── copyright.js    # 版权过滤
│       └── lang-detect.js  # 中文检测
├── data/
│   └── seed.json           # 种子数据（60条）
└── assets/
    └── illustrations.js    # SVG 插画
```

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   app-container                      │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │              app-header                       │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │             pages-container                   │    │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ...       │    │   │
│  │  │  │  home  │ │ result │ │history │           │    │   │
│  │  │  └────────┘ └────────┘ └────────┘           │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │              bottom-nav                        │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         JS 模块                              │
├─────────────────────────────────────────────────────────────┤
│  核心层（Core）                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ logger  │ │  store  │ │ router  │ │app.js   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│  数据层（Data）                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ seed-data   │  │    api.js   │  │illustrations│         │
│  │   .js       │  │ (AI调用)    │  │   .js       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  页面层（Pages）                                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │  home  │ │ result │ │history │ │favorites│ │ daily  │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
├─────────────────────────────────────────────────────────────┤
│  组件层（Components）                                       │
│  ┌────────┐ ┌────────┐ ┌────────────┐ ┌────────────┐       │
│  │  toast │ │ modal  │ │ credibility│ │card-generator│     │
│  └────────┘ └────────┘ └────────────┘ └────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  工具层（Utils）                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ helpers  │ │copyright │ │lang-detect│                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 设计理念

- **IIFE 单例模式**：所有模块使用 IIFE 封装，挂载到 `window` 全局对象
- **PageObject 模式**：页面模块继承基础 `PageObject` 类，实现 `onShow()` / `onHide()` 生命周期
- **事件驱动**：通过 Router 的 `onRouteChange` 回调驱动页面切换
- **降级策略**：关键功能（如 html2canvas、Clipboard API）都有降级方案

---

## 3. 核心模块详解

### 3.1 app.js - 应用入口

**文件路径**: `js/app.js`

**职责**:
- 初始化各核心模块（Logger、Store、Router）
- 注册路由变化监听，驱动页面模块的生命周期
- 设置全局错误处理（同步错误 + 未捕获 Promise 异常）
- 暴露 `window.DFDDebug` 调试工具
- 维护模块注册表

**关键函数**:

| 函数 | 描述 |
|------|------|
| `registerModule(name, module)` | 注册模块到注册表 |
| `registerPageModule(pageName, pageModule)` | 注册页面模块 |
| `handleRouteChange(newPage, params)` | 处理路由变化，调用页面生命周期 |
| `createDebugTools()` | 创建调试工具对象 |

**全局对象**:

| 对象 | 描述 |
|------|------|
| `window.App` | 应用单例，提供版本、模块注册、状态查询等接口 |
| `window.DFDDebug` | 调试工具，提供存储查看、日志控制、模拟测试等功能 |

### 3.2 router.js - 路由管理

**文件路径**: `js/router.js`

**职责**:
- 基于 URL hash 的前端路由（`#/home`, `#/result` 等）
- 页面切换与底部导航高亮
- 浏览器前进/后退支持
- 路由变更回调通知

**路由配置**:

| Hash | 页面 |
|------|------|
| `#/home` | home（首页） |
| `#/result` | result（解读结果） |
| `#/history` | history（历史记录） |
| `#/favorites` | favorites（收藏） |
| `#/daily` | daily（每日一辨详情） |

**关键函数**:

| 函数 | 描述 |
|------|------|
| `Router.init()` | 初始化路由，绑定 hashchange 事件 |
| `Router.navigate(path)` | 导航到指定路径 |
| `Router.getCurrentRoute()` | 获取当前路由名称 |
| `Router.onRouteChange(callback)` | 注册路由变更监听 |

### 3.3 logger.js - 日志系统

**文件路径**: `js/logger.js`

**职责**:
- 四级日志功能（DEBUG / INFO / WARN / ERROR）
- 彩色控制台输出
- 模块标识
- 内存日志历史查询

**日志级别**:

| 级别 | 值 | 颜色 | 用途 |
|------|---|------|------|
| DEBUG | 0 | 灰色 | 开发调试 |
| INFO | 1 | 蓝色 | 一般信息 |
| WARN | 2 | 橙色 | 警告 |
| ERROR | 3 | 红色 | 错误 |

**关键函数**:

| 函数 | 描述 |
|------|------|
| `Logger.debug(module, message, context)` | 输出 DEBUG 日志 |
| `Logger.info(module, message, context)` | 输出 INFO 日志 |
| `Logger.warn(module, message, context)` | 输出 WARN 日志 |
| `Logger.error(module, message, context)` | 输出 ERROR 日志 |
| `Logger.getHistory()` | 获取内存日志历史 |
| `Logger._setMinLevel(level)` | 设置最低日志级别 |

### 3.4 store.js - 本地存储管理

**文件路径**: `js/store.js`

**职责**:
- 封装 localStorage 操作，带命名空间前缀 `dfd_`
- 管理历史记录、收藏、反馈、每日辟谣等业务数据
- 存储配额溢出时自动清理

**存储键名**:

| 键名 | 类型 | 描述 |
|------|------|------|
| `dfd_history` | Array | 查询历史数组 |
| `dfd_favorites` | Array | 收藏的结果 ID 数组 |
| `dfd_feedback` | Array | 反馈记录数组 |
| `dfd_daily` | Object | 每日辟谣信息 |
| `dfd_hot_keywords` | Array | 热门关键词数组 |
| `dfd_last_input` | Object | 上次输入 |

**关键函数**:

| 函数 | 描述 |
|------|------|
| `Store.get(key)` | 读取数据 |
| `Store.set(key, value)` | 写入数据（含配额溢出处理） |
| `Store.remove(key)` | 删除数据 |
| `Store.clear(key?)` | 清除数据 |
| `Store.getHistory()` | 获取历史记录 |
| `Store.addHistory(item)` | 添加历史记录 |
| `Store.toggleFavorite(id)` | 切换收藏状态 |
| `Store.isFavorited(id)` | 检查是否已收藏 |
| `Store.getUsage()` | 获取存储使用统计 |

### 3.5 seed-data.js - 种子数据库

**文件路径**: `js/seed-data.js`

**职责**:
- 加载 `data/seed.json` 典故数据
- 构建 ID 索引和关键词倒排索引
- 提供搜索、筛选、随机获取等查询接口

**关键函数**:

| 函数 | 描述 |
|------|------|
| `SeedDB.load(url?)` | 异步加载种子数据 |
| `SeedDB.search(inputText, inputType?)` | 搜索典故（子串匹配 + 得分排序） |
| `SeedDB.getById(id)` | 根据 ID 获取单条记录 |
| `SeedDB.getByType(inputType)` | 根据输入类型获取记录 |
| `SeedDB.getByCategory(category)` | 根据分类获取记录 |
| `SeedDB.getRandom(count?)` | 获取随机记录 |
| `SeedDB.getAll()` | 获取所有记录 |
| `SeedDB.isLoaded()` | 检查数据是否已加载 |

### 3.6 api.js - AI 解读接口

**文件路径**: `js/api.js`

**职责**:
- 调用阿里云 DashScope API（通义千问 qwen-turbo）
- 构建系统提示词和用户消息
- 解析 AI 响应并验证字段
- 错误处理与超时控制

**配置常量**:

| 常量 | 值 |
|------|---|
| API_ENDPOINT | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| MODEL | `qwen-turbo` |
| TIMEOUT_MS | 10000（10秒）|

**关键函数**:

| 函数 | 描述 |
|------|------|
| `AIInterpreter.interpret(inputText, inputType, context?)` | 调用 AI 解读 |
| `AIInterpreter.buildSystemPrompt()` | 构建系统提示词 |
| `AIInterpreter.parseResponse(responseBody)` | 解析 AI 响应 |
| `AIInterpreter.isAvailable()` | 检查 API 是否可用 |

**AI 响应格式**:

```json
{
  "allusion_title": "典故标题（最长50字）",
  "source": "出处来源（格式：作者·作品）",
  "original_text": "原文引用（最长500字）",
  "interpretation": "白话解释（100~300字）",
  "pop_culture": [
    {
      "work": "引用的作品名称",
      "creator": "创作者",
      "type": "作品类型",
      "usage": "引用场景描述"
    }
  ],
  "confidence": 0.8
}
```

---

## 4. 页面模块

### 4.1 PageObject 基类

所有页面模块继承的基础类：

```javascript
class PageObject {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector)
  }
  $(selector) { return this.container.querySelector(selector) }
  $$(selector) { return this.container.querySelectorAll(selector) }
  onShow() {}   // 页面显示时调用
  onHide() {}   // 页面隐藏时调用
}
```

### 4.2 home.js - 首页

**文件路径**: `js/pages/home.js`

**职责**:
- 输入文本的实时校验与字数统计
- 类型选择器（含智能推荐）
- 解读按钮（校验 → 导航到结果页）
- 每日一辨卡片展示
- 热门关键词标签

**关键功能**:

| 功能 | 描述 |
|------|------|
| 输入校验 | 10-500 字符，中文占比 >= 50% |
| 类型推荐 | 根据关键词命中数自动推荐类型 |
| 每日一辨 | 使用日期哈希取模，确保每天固定一条 |
| 热门关键词 | 从 SeedDB 提取关键词去重显示 |

**关键函数**:

| 函数 | 描述 |
|------|------|
| `HomePage.onShow()` | 页面显示时恢复输入、加载每日一辨 |
| `_validateInput()` | 校验输入并更新按钮状态 |
| `_checkTypeRecommendation(text)` | 智能类型推荐 |
| `_loadDailyDebunk()` | 加载每日一辨内容 |

### 4.3 result.js - 解读结果页

**文件路径**: `js/pages/result.js`

**职责**:
- 编排解读流程：SeedDB → AIInterpreter → CopyrightFilter → Store
- 渲染解读结果（标题、来源、原文、解读、流行文化、相关典故）
- 收藏、分享、重试、反馈等交互

**解读流程**:

```
用户输入 → SeedDB 搜索
              ↓ 命中
         种子库结果 → 版权过滤 → 渲染
              ↓ 未命中
         AIInterpreter.interpret()
              ↓
         版权过滤 → 渲染
```

**关键函数**:

| 函数 | 描述 |
|------|------|
| `ResultPage.onShow()` | 读取状态，启动解读或使用缓存 |
| `_runInterpretation(inputText, inputType)` | 执行完整解读流程 |
| `_renderResult(data)` | 渲染解读结果 |
| `_renderPopCulture(popCulture)` | 渲染流行文化引用 |
| `_renderRelated(related)` | 渲染相关典故 |
| `_saveToHistory(inputText, inputType, resultData)` | 保存到历史记录 |

### 4.4 history.js - 历史记录页

**文件路径**: `js/pages/history.js`

**职责**:
- 从 Store 加载历史记录并渲染列表
- 按类型筛选
- 点击条目跳转到结果页
- 长按/删除单条记录
- 清空全部（带确认弹窗）

**关键函数**:

| 函数 | 描述 |
|------|------|
| `HistoryPage.onShow()` | 加载并渲染历史记录 |
| `_createHistoryItem(item)` | 创建历史记录 DOM 元素 |
| `_onItemClick(item)` | 跳转结果页 |
| `_onDeleteItemClick(id, el)` | 删除单条记录 |

### 4.5 favorites.js - 收藏页

**文件路径**: `js/pages/favorites.js`

**职责**:
- 从 Store 加载收藏列表并渲染
- 按类型筛选
- 点击条目跳转到结果页
- 单条取消收藏
- 清空全部

**关键函数**:

| 函数 | 描述 |
|------|------|
| `FavoritesPage.onShow()` | 加载并渲染收藏列表 |
| `_createFavoriteItem(item)` | 创建收藏条目 DOM 元素 |
| `_onUnfavoriteClick(id, el)` | 取消收藏 |

### 4.6 daily.js - 每日一辨详情页

**文件路径**: `js/pages/daily.js`

**职责**:
- 从 SeedDB 加载 misconception 类别数据
- 使用日期种子选取当日辟谣条目
- 展示误传版本、真相还原、来源考证
- 支持"昨日"/"明日"按钮浏览其他条目

**关键函数**:

| 函数 | 描述 |
|------|------|
| `DailyPage.onShow()` | 加载并渲染每日一辨 |
| `_renderDailyItem()` | 渲染指定日期的条目 |
| `_bindNavButtons()` | 绑定日期导航按钮 |

---

## 5. 组件模块

### 5.1 toast.js - Toast 通知

**文件路径**: `js/components/toast.js`

**职责**: 提供轻量级的消息提示功能

**预设消息**:

| ID | 消息 | 类型 |
|----|------|------|
| T1 | 解读完成 | success |
| T2 | 已添加到收藏 | success |
| T3 | 已取消收藏 | info |
| T4 | 反馈已提交 | success |
| T5 | 已提交 | success |
| T6 | 网络连接异常 | error |
| T7 | 当前仅支持简体中文内容 | warning |
| T8 | 输入内容至少需要10个字符 | warning |
| T9 | 请求过于频繁 | warning |
| T10 | 服务暂时不可用 | error |

**关键函数**:

| 函数 | 描述 |
|------|------|
| `Toast.show(message, type, duration)` | 显示 Toast |
| `Toast.hide(toastElement)` | 手动隐藏 Toast |
| `Toast.showPreset(presetKey)` | 显示预设 Toast |

### 5.2 modal.js - 模态对话框

**文件路径**: `js/components/modal.js`

**职责**: 提供模态弹窗功能，支持自定义内容和预设弹窗

**预设弹窗**:

| 编号 | 类型 | 描述 |
|------|------|------|
| M1 | 反馈弹窗 | 收集用户详细反馈 |
| M2 | 分享弹窗 | 预览并复制/保存卡片 |
| M3 | 确认清空弹窗 | 确认删除操作 |

**关键函数**:

| 函数 | 描述 |
|------|------|
| `Modal.show(options)` | 显示自定义弹窗 |
| `Modal.hide()` | 关闭弹窗 |
| `Modal.showFeedbackModal(resultId, feedbackType)` | 显示反馈弹窗 |
| `Modal.showShareModal(resultData)` | 显示分享弹窗 |
| `Modal.showConfirmClearModal(itemType)` | 显示确认清空弹窗 |

### 5.3 credibility.js - 可信度标签

**文件路径**: `js/components/credibility.js`

**职责**: 根据置信度分数渲染可信度标签

**等级划分**:

| 等级 | 分数范围 | 标签 | 颜色 |
|------|----------|------|------|
| HIGH | >= 0.75 | 高可信度 | 绿色 |
| MEDIUM | >= 0.5 | 中等可信度 | 橙色 |
| LOW | < 0.5 | 仅供参考 | 红色 |

**关键函数**:

| 函数 | 描述 |
|------|------|
| `CredibilityTag.render(score, container)` | 渲染标签到容器 |
| `CredibilityTag.update(container, score)` | 更新已有标签 |
| `CredibilityTag.getLevel(score)` | 获取等级 |
| `CredibilityTag.getLabel(score)` | 获取标签文本 |

### 5.4 card-generator.js - 知识卡片生成器

**文件路径**: `js/components/card-generator.js`

**职责**: 将解读结果生成为可分享的知识卡片图片

**关键函数**:

| 函数 | 描述 |
|------|------|
| `CardGenerator.generateCard(resultData)` | 生成卡片 DOM 元素 |
| `CardGenerator.captureAsImage(cardEl, title)` | 截图下载 PNG |
| `CardGenerator.captureAsText(resultData)` | 生成纯文本摘要 |
| `CardGenerator.share(resultData)` | 分享入口（优先截图，降级文本） |

---

## 6. 工具模块

### 6.1 helpers.js - 通用工具

**文件路径**: `js/utils/helpers.js`

**函数列表**:

| 函数 | 描述 |
|------|------|
| `Helpers.debounce(fn, delay)` | 防抖函数 |
| `Helpers.throttle(fn, limit)` | 节流函数 |
| `Helpers.deepClone(obj)` | 深拷贝（JSON 序列化） |
| `Helpers.formatDate(timestamp, format)` | 日期格式化 |
| `Helpers.generateId(prefix)` | 生成唯一 ID |
| `Helpers.truncateText(text, maxLength, suffix)` | 文本截断 |
| `Helpers.escapeHtml(str)` | HTML 转义 |
| `Helpers.sanitizeInput(text)` | 输入净化 |
| `Helpers.parseJSON(str, fallback)` | 安全 JSON 解析 |
| `Helpers.isChineseText(text)` | 判断是否中文文本 |
| `Helpers.calculateTextStats(text)` | 计算文本统计 |

### 6.2 copyright.js - 版权合规

**文件路径**: `js/utils/copyright.js`

**职责**: 对 AI 解读结果进行版权过滤

**关键函数**:

| 函数 | 描述 |
|------|------|
| `CopyrightFilter.filterLyric(text, maxLength)` | 过滤歌词引用（截断至约2句） |
| `CopyrightFilter.filterBookExcerpt(text, maxLength)` | 过滤书摘引用 |
| `CopyrightFilter.addSourceAttribution(text, source)` | 添加来源标注 |
| `CopyrightFilter.filterAIOutput(result)` | 综合版权合规处理 |
| `CopyrightFilter.checkCompliance(text, inputType)` | 检查文本合规性 |

### 6.3 lang-detect.js - 中文语言检测

**文件路径**: `js/utils/lang-detect.js`

**职责**: 提供文本语言判断、输入验证

**配置常量**:

| 常量 | 值 |
|------|---|
| MIN_LENGTH | 10 |
| MAX_LENGTH | 500 |
| CJK_THRESHOLD | 0.5（50%）|

**关键函数**:

| 函数 | 描述 |
|------|------|
| `LangDetect.isChinese(text)` | 判断是否有效中文内容 |
| `LangDetect.getLanguageHint(text)` | 获取语言类型提示 |
| `LangDetect.validateInput(text)` | 验证用户输入 |

---

## 7. 数据模型

### 7.1 种子数据 (seed.json)

```json
{
  "id": "lyric-001",
  "category": "lyric",
  "input_type": "歌词",
  "title": "青花瓷——天青色等烟雨",
  "keywords": ["天青色等烟雨", "青花瓷", "汝窑", "天青色", "烟雨"],
  "summary": "方文山以汝窑烧制典故入词...",
  "detail": "「天青色等烟雨...」",
  "source": "《青花瓷》/ 周杰伦专辑《我很忙》",
  "author": "方文山",
  "era": "当代",
  "tags": ["周杰伦", "方文山", "汝窑", "瓷器", "古风歌词"],
  "difficulty": "medium",
  "pop_culture": [
    {"work": "青花瓷", "creator": "周杰伦/方文山", "type": "music", "usage": "歌曲核心意象..."}
  ],
  "confidence": 0.98,
  "verified": true,
  "created_at": "2026-06-18T00:00:00.000Z"
}
```

**字段说明**:

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 唯一标识符 |
| category | string | 分类（lyric/poetry/historical/misconception） |
| input_type | string | 输入类型（歌词/书摘/角色名/典故/通用） |
| title | string | 典故标题 |
| keywords | array | 关键词数组（用于搜索匹配） |
| summary | string | 摘要 |
| detail | string | 详细解读 |
| source | string | 出处来源 |
| pop_culture | array | 流行文化引用 |
| confidence | number | 置信度（0-1） |

### 7.2 历史记录项

```javascript
{
  id: "r_abc123",
  inputText: "天青色等烟雨",
  inputType: "歌词",
  title: "青花瓷——天青色等烟雨",
  credibility: "高",
  timestamp: "2026-06-18T10:30:00.000Z",
  resultData: { /* 解读结果对象 */ }
}
```

### 7.3 解读结果对象

```javascript
{
  allusion_title: "典故标题",
  source: "出处来源",
  original_text: "原文引用",
  interpretation: "白话解释",
  pop_culture: [
    { work, creator, type, usage }
  ],
  confidence: 0.95,
  credibility: "高",
  id: "r_abc123"
}
```

---

## 8. 依赖关系

### 8.1 脚本加载顺序

```
1. assets/illustrations.js      # SVG 插画（无依赖）
2. js/logger.js                  # 日志系统（无依赖）
3. js/store.js                   # 存储管理（依赖 Logger）
4. js/router.js                  # 路由系统（依赖 Logger）
5. js/seed-data.js                # 种子数据库（依赖 Logger）
6. js/api.js                      # AI 接口（依赖 Logger）
7. js/components/toast.js         # Toast（无依赖）
8. js/components/modal.js         # Modal（依赖 Toast）
9. js/components/credibility.js  # 可信度（依赖 Logger）
10. js/components/card-generator.js # 卡片生成（依赖 Logger, Toast, Modal, Helpers）
11. js/utils/helpers.js           # 工具函数（无依赖）
12. js/utils/copyright.js         # 版权过滤（依赖 Helpers）
13. js/utils/lang-detect.js       # 语言检测（依赖 Helpers）
14. js/pages/home.js              # 首页（依赖多项）
15. js/pages/result.js            # 结果页（依赖多项）
16. js/pages/history.js           # 历史页（依赖多项）
17. js/pages/favorites.js         # 收藏页（依赖多项）
18. js/pages/daily.js             # 每日一辨（依赖多项）
19. js/app.js                     # 应用入口（依赖以上所有）
```

### 8.2 模块依赖图

```
app.js
├── logger.js
├── store.js
│   └── logger.js
├── router.js
│   └── logger.js
└── SeedDB
    └── logger.js
         │
         ▼
    ┌─────────────────────────────────────────┐
    │              页面模块                     │
    │  home.js / result.js / history.js       │
    │  / favorites.js / daily.js              │
    └─────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────┐
    │              组件模块                     │
    │  toast.js / modal.js / credibility.js   │
    │  card-generator.js                      │
    └─────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────┐
    │              工具模块                     │
    │  helpers.js / copyright.js /           │
    │  lang-detect.js                         │
    └─────────────────────────────────────────┘
```

### 8.3 window 全局对象

| 对象 | 类型 | 描述 |
|------|------|------|
| `window.Logger` | 单例 | 日志系统 |
| `window.Store` | 单例 | 存储管理 |
| `window.Router` | 单例 | 路由管理 |
| `window.SeedDB` | 单例 | 种子数据库 |
| `window.AIInterpreter` | 单例 | AI 解读接口 |
| `window.Toast` | 单例 | Toast 提示 |
| `window.Modal` | 单例 | Modal 弹窗 |
| `window.CredibilityTag` | 单例 | 可信度标签 |
| `window.CardGenerator` | 单例 | 卡片生成器 |
| `window.Helpers` | 对象 | 工具函数 |
| `window.CopyrightFilter` | 对象 | 版权过滤 |
| `window.LangDetect` | 对象 | 语言检测 |
| `window.Illustrations` | 对象 | SVG 插画 |
| `window.App` | 对象 | 应用单例 |
| `window.DFDDebug` | 对象 | 调试工具 |
| `window.DFDPages` | 对象 | 页面模块注册表 |
| `window.DFDState` | 对象 | 临时状态（跨页面传递数据）|
| `window.__DFD_CONFIG__` | 对象 | 应用配置（含 API Key）|

---

## 9. 项目运行

### 9.1 环境要求

- Python 3（用于本地服务器）
- 现代浏览器（Chrome 80+, Safari 14+, Firefox 78+）
- 阿里云 DashScope API Key

### 9.2 本地开发

```bash
# 克隆仓库
git clone <repo-url>
cd dong-fei-dong

# 启动本地服务器
python3 -m http.server 8080

# 浏览器打开 http://localhost:8080
```

### 9.3 配置 API Key

在 `index.html` 的 `<head>` 中修改：

```html
<script>
  window.__DFD_CONFIG__ = {
    apiKey: 'your-dashscope-api-key'
  };
</script>
```

获取方式：访问 https://dashscope.aliyun.com/ → API-KEY 管理 → 创建新 Key

### 9.4 部署到 GitHub Pages

1. Fork 本仓库
2. 进入仓库 Settings → Pages
3. Source 选择 Deploy from a branch，Branch 选择 main / (root)
4. 等待部署完成

---

## 10. 调试工具

### 10.1 DFDDebug 控制台命令

在浏览器控制台中使用 `window.DFDDebug`：

```javascript
// 查看所有调试命令
window.DFDDebug

// 常用命令
window.DFDDebug.dumpStorage()      // 查看 localStorage 内容
window.DFDDebug.clearAllStorage()  // 清空所有存储
window.DFDDebug.dumpSeedDB()       // 查看种子数据库
window.DFDDebug.setLogLevel('DEBUG') // 设置日志级别
window.DFDDebug.listModules()      // 查看已注册模块
window.DFDDebug.getAppInfo()       // 获取应用信息
```

### 10.2 模拟测试

```javascript
// 模拟 AI 超时
window.DFDDebug.mockAITimeout()

// 模拟 AI 不可用
window.DFDDebug.mockAIUnavailable()
```

### 10.3 日志历史

```javascript
// 获取最近 100 条日志
Logger.getHistory()

// 设置日志级别
Logger._setMinLevel(0)  // DEBUG
Logger._setMinLevel(1)  // INFO
Logger._setMinLevel(2)  // WARN
Logger._setMinLevel(3)  // ERROR
```

---

## 附录

### A. CSS 设计令牌

详见 `css/variables.css`：

| 类别 | 变量 | 默认值 | 用途 |
|------|------|--------|------|
| 色彩 | `--bg` | `#F7F5F0` | 主背景 |
| | `--accent` | `#B85C38` | 强调色 |
| | `--ink` | `#2C2A26` | 主文字 |
| 字体 | `--font` | InstrumentSans | 主字体 |
| | `--font-serif` | Lora | 衬线字体 |
| 层级 | `--z-nav` | 100 | 底部导航 |
| | `--z-modal` | 200 | 弹窗 |
| | `--z-toast` | 300 | 提示 |

### B. 浏览器兼容性

- Chrome 80+
- Safari 14+
- Firefox 78+
- 微信内置浏览器（iOS/Android）

### C. 开源协议

MIT License
