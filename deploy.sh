#!/bin/bash
# 懂非懂 - 部署脚本
# 使用方式：export DASHSCOPE_API_KEY=your_key && ./deploy.sh

set -e

echo "=== 懂非懂 部署脚本 ==="
echo ""

# 检查环境变量
if [ -z "$DASHSCOPE_API_KEY" ]; then
  echo "❌ 错误：未设置 DASHSCOPE_API_KEY 环境变量"
  echo "请先执行：export DASHSCOPE_API_KEY=your_actual_api_key"
  exit 1
fi

echo "✅ 检测到 DASHSCOPE_API_KEY 环境变量"

# 备份原始文件
echo "📋 正在备份 index.html..."
cp index.html index.html.bak

# 替换 API Key
echo "🔄 正在注入 API Key..."
sed -i.bak "s/YOUR_API_KEY_HERE/$DASHSCOPE_API_KEY/g" index.html

# 清理临时文件
rm -f index.html.bak

echo "✅ API Key 注入成功！"
echo ""
echo "🚀 部署完成，可直接访问 index.html"
echo ""
echo "📝 注意：如果需要恢复原始文件，请执行：cp index.html.bak index.html"