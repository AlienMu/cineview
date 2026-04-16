#!/bin/bash

# CineView 死代码清理脚本
# 执行前请确保已经提交所有更改到git

set -e  # 遇到错误立即退出

echo "🔍 CineView 死代码清理脚本"
echo "================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在cineview目录下运行此脚本"
    exit 1
fi

# 检查git状态
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  警告: 有未提交的更改"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📋 将要删除的文件:"
echo "  - src/hooks/useDragProgress.ts"
echo "  - src/hooks/useDragProgress.test.ts"
echo "  - src/hooks/useAnimationRegistry.ts"
echo "  - src/hooks/useAnimationRegistry.test.ts"
echo ""

read -p "确认删除? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消操作"
    exit 1
fi

echo ""
echo "🗑️  删除未使用的Hooks..."

# 删除文件
rm -f src/hooks/useDragProgress.ts
rm -f src/hooks/useDragProgress.test.ts
rm -f src/hooks/useAnimationRegistry.ts
rm -f src/hooks/useAnimationRegistry.test.ts

echo "✅ 文件已删除"
echo ""

echo "📝 更新 src/index.ts..."

# 从index.ts中移除导出
sed -i '' '/useAnimationRegistry/d' src/index.ts
sed -i '' '/useDragProgress/d' src/index.ts

echo "✅ 导出已移除"
echo ""

echo "📝 更新 src/types/index.ts..."

# 创建临时文件来删除AnimationRegistry相关类型
cat > /tmp/remove_types.sed << 'EOF'
/^\/\*\*$/,/^export interface AnimationRegistry {$/{
  /^export interface AnimationRegistry {$/,/^}$/d
}
/^\/\*\*$/,/^export interface AnimationRegistryItem {$/{
  /^export interface AnimationRegistryItem {$/,/^}$/d
}
EOF

# 应用sed脚本
sed -i '' -f /tmp/remove_types.sed src/types/index.ts

# 删除导出行
sed -i '' '/AnimationRegistryItem/d' src/types/index.ts
sed -i '' '/AnimationRegistry/d' src/types/index.ts

echo "✅ 类型定义已清理"
echo ""

echo "🧪 运行测试..."
pnpm test --passWithNoTests 2>&1 | tail -10

echo ""
echo "🔍 运行类型检查..."
pnpm type-check

echo ""
echo "🔍 运行lint..."
pnpm lint

echo ""
echo "✨ 格式化代码..."
pnpm format > /dev/null 2>&1

echo ""
echo "📊 统计..."
echo "删除的代码行数:"
git diff --stat

echo ""
echo "✅ 清理完成!"
echo ""
echo "📋 后续步骤:"
echo "  1. 检查 git diff 确认更改正确"
echo "  2. 运行 pnpm test 确保所有测试通过"
echo "  3. 更新 CHANGELOG.md"
echo "  4. 提交更改: git commit -m 'refactor: remove unused hooks'"
echo ""
