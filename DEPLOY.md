# 懂非懂 — 部署指南

## 部署方式一：GitHub Pages（推荐）

### 步骤

1. **创建 GitHub 仓库**
   - 访问 https://github.com/new
   - Repository name: `dong-fei-dong`
   - 选择 Public（公开）
   - 勾选 "Add a README file"
   - 点击 "Create repository"

2. **上传代码**
   ```bash
   # 克隆仓库到本地
   git clone https://github.com/YOUR_USERNAME/dong-fei-dong.git
   cd dong-fei-dong

   # 将所有项目文件复制到仓库目录
   # （将 dong-fei-dong/ 目录下的所有文件复制到此目录）

   # 提交并推送
   git add .
   git commit -m "Initial commit: 懂非懂 v1.0.0"
   git push origin main
   ```

3. **启用 GitHub Pages**
   - 进入仓库 Settings -> Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main"，文件夹选择 "/ (root)"
   - 点击 Save
   - 等待 1-2 分钟，访问 `https://YOUR_USERNAME.github.io/dong-fei-dong/`

## 部署方式二：Vercel（推荐，国内访问更快）

1. 访问 https://vercel.com
2. 使用 GitHub 账号登录
3. 点击 "Add New Project"
4. 导入 `dong-fei-dong` 仓库
5. Framework Preset 选择 "Other"
6. 点击 Deploy
7. 等待部署完成，获得 `https://dong-fei-dong.vercel.app` 域名

## 部署方式三：Netlify

1. 访问 https://app.netlify.com/drop
2. 将 `dong-fei-dong` 文件夹直接拖拽到页面中
3. 自动部署，获得随机域名
4. 可在 Site settings 中自定义域名

## 部署方式四：腾讯云/阿里云 OSS

1. 购买对象存储服务（OSS/COS）
2. 创建存储桶，开启静态网站托管
3. 上传所有文件到存储桶根目录
4. 配置自定义域名（可选）
5. 获得访问地址

## 配置 API Key

**重要**：部署后需要在页面中配置 DashScope API Key。

### 方式一：环境变量（推荐生产环境）
在部署平台配置环境变量 `DFD_API_KEY`，然后修改 `index.html` 中的配置脚本读取该变量。

### 方式二：直接修改 index.html（开发测试）
在 `index.html` 的 `<head>` 中找到：
```html
<script>
  window.__DFD_CONFIG__ = {
    apiKey: 'YOUR_API_KEY_HERE'
  };
</script>
```
将 `YOUR_API_KEY_HERE` 替换为你的 DashScope API Key。

**获取 API Key**：
1. 访问 https://dashscope.aliyun.com/
2. 注册/登录阿里云账号
3. 进入 "API-KEY 管理" 创建新 Key
4. 复制 Key 到配置中

## 注意事项

1. **CSP 策略**：已内置 Content-Security-Policy，确保 API 域名 `dashscope.aliyuncs.com` 在 `connect-src` 中
2. **HTTPS**：生产环境务必使用 HTTPS，否则部分浏览器 API（如 Clipboard）可能受限
3. **API 配额**：DashScope 免费额度有限，高流量时请监控用量
4. **版权合规**：已内置自动截断，无需额外配置

## 验证部署

部署完成后，打开浏览器访问部署地址，检查：
- [ ] 首页正常加载，每日一辨卡片显示
- [ ] 输入文本后点击解读，结果页正常渲染
- [ ] 收藏功能正常（☆ 变 ★）
- [ ] 历史记录页正常显示
- [ ] 每日一辨详情页三板块正常
- [ ] 控制台无红色错误
