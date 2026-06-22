# 懂非懂 — 你好像懂了，又好像没懂

> AI 驱动的文化典故解读工具，帮你理解歌词、诗词、日常用语中的典故出处。
> TRAE AI 创造力大赛参赛作品

## 项目简介

"懂非懂"是一款纯前端单页应用，帮助用户解读中文文本中的文化典故。无论是歌词中的诗词引用、书摘中的历史典故，还是网络流行语的真实出处，只需粘贴文本，即可获得 AI 驱动的深度解读。

## 核心功能

- **智能解读**：输入歌词、诗词、书摘或角色名，AI 自动识别典故出处
- **种子数据库**：内置 60 条精选典故，覆盖歌词、诗词、历史、误传四大类别
- **可信度分级**：高（种子库匹配）/ 中（AI 推断）/ 低（纯 AI 生成）
- **每日一辨**：每日推送一个文化误传辨析，帮助用户纠正常见误解
- **知识卡片**：一键生成精美分享卡片，支持保存图片
- **历史与收藏**：本地持久化，随时回顾过往解读
- **版权合规**：自动截断引用内容，确保符合版权规范

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | 纯原生 JavaScript (ES6+)，无构建工具 |
| 样式 | CSS3 + CSS 变量，移动端优先 |
| 路由 | Hash-based SPA 路由 |
| 数据存储 | localStorage（前缀 dfd_）|
| AI 接口 | 阿里云 DashScope（通义千问 qwen-turbo）|
| 分享卡片 | html2canvas |

## 项目结构

```
dong-fei-dong/
├── index.html              # 入口页面
├── css/
│   ├── reset.css           # 样式重置
│   ├── variables.css       # 设计令牌
│   ├── layout.css          # 布局与页面切换
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

## 快速开始

### 本地开发

```bash
# 克隆仓库
git clone <repo-url>
cd dong-fei-dong

# 启动本地服务器
python3 -m http.server 8080

# 浏览器打开 http://localhost:8080
```

### 配置 API Key

在 `index.html` 的 `<head>` 中添加：

```html
<script>
  window.__DFD_CONFIG__ = {
    apiKey: 'your-dashscope-api-key'
  };
</script>
```

或使用环境变量注入（生产环境推荐）。

### 部署到 GitHub Pages

1. Fork 本仓库
2. 进入仓库 Settings -> Pages
3. Source 选择 Deploy from a branch，Branch 选择 main / (root)
4. 等待部署完成，访问 `https://<username>.github.io/dong-fei-dong/`

## 调试工具

在浏览器控制台中使用：

```javascript
// 查看所有调试命令
window.DFDDebug

// 常用命令
window.DFDDebug.dumpStorage()      // 查看 localStorage 内容
window.DFDDebug.clearAllStorage()  // 清空所有存储
window.DFDDebug.dumpSeedDB()       // 查看种子数据库
window.DFDDebug.setLogLevel('DEBUG') // 设置日志级别
window.DFDDebug.listModules()      // 查看已注册模块
```

## 浏览器兼容性

- Chrome 80+
- Safari 14+
- Firefox 78+
- 微信内置浏览器（iOS/Android）

## 开源协议

MIT License

## 参赛信息

- **赛事**：TRAE AI 创造力大赛
- **作品名**：懂非懂
- **赛道**：AI 应用创意
- **开发周期**：4 周（2026-06-23 ~ 2026-07-20）
