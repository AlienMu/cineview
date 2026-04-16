#!/bin/bash

# CineView 代码质量检查脚本
# 用于检查代码中的冗余和问题

echo "🔍 开始代码质量检查..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 错误计数
ERRORS=0

# 1. 检查未使用的变量和属性
echo "📋 检查未使用的变量和属性..."
UNUSED=$(pnpm tsc --noEmit 2>&1 | grep -E "(6133|6138)")
if [ -n "$UNUSED" ]; then
  echo -e "${RED}❌ 发现未使用的变量或属性:${NC}"
  echo "$UNUSED"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ 没有未使用的变量或属性${NC}"
fi
echo ""

# 2. 检查 any 类型使用
echo "📋 检查 any 类型使用..."
ANY_USAGE=$(grep -r ":\s*any" src --include="*.ts" --include="*.tsx" | grep -v "test.tsx" | grep -v "// @ts-")
if [ -n "$ANY_USAGE" ]; then
  echo -e "${RED}❌ 发现使用 any 类型:${NC}"
  echo "$ANY_USAGE"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ 没有使用 any 类型${NC}"
fi
echo ""

# 3. 运行 TypeScript 类型检查
echo "📋 运行 TypeScript 类型检查..."
if pnpm type-check > /dev/null 2>&1; then
  echo -e "${GREEN}✅ TypeScript 类型检查通过${NC}"
else
  echo -e "${RED}❌ TypeScript 类型检查失败${NC}"
  pnpm type-check
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. 运行 ESLint 检查
echo "📋 运行 ESLint 检查..."
LINT_OUTPUT=$(pnpm lint 2>&1)
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -E "✖.*error" | grep -oE "[0-9]+ error" | grep -oE "[0-9]+")
LINT_WARNINGS=$(echo "$LINT_OUTPUT" | grep -E "✖.*warning" | grep -oE "[0-9]+ warning" | grep -oE "[0-9]+")

if [ -n "$LINT_ERRORS" ] && [ "$LINT_ERRORS" -gt 0 ]; then
  echo -e "${RED}❌ ESLint 发现 $LINT_ERRORS 个错误${NC}"
  echo "$LINT_OUTPUT"
  ERRORS=$((ERRORS + 1))
elif [ -n "$LINT_WARNINGS" ] && [ "$LINT_WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  ESLint 发现 $LINT_WARNINGS 个警告（不影响提交）${NC}"
  echo "$LINT_OUTPUT" | grep "warning"
else
  echo -e "${GREEN}✅ ESLint 检查通过${NC}"
fi
echo ""

# 5. 运行测试
echo "📋 运行测试..."
if pnpm test --no-coverage > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 所有测试通过${NC}"
else
  echo -e "${RED}❌ 测试失败${NC}"
  pnpm test --no-coverage
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 6. 检查未使用的 import
echo "📋 检查未使用的 import..."
UNUSED_IMPORTS=$(grep -r "^import.*from" src --include="*.ts" --include="*.tsx" | wc -l)
echo "总共 $UNUSED_IMPORTS 个 import 语句"
echo -e "${GREEN}✅ Import 检查完成（需要手动审查）${NC}"
echo ""

# 7. 检查 console.log
echo "📋 检查 console.log..."
CONSOLE_LOGS=$(grep -r "console\.log" src --include="*.ts" --include="*.tsx" | grep -v "test.tsx" | grep -v "// console.log")
if [ -n "$CONSOLE_LOGS" ]; then
  echo -e "${YELLOW}⚠️  发现 console.log:${NC}"
  echo "$CONSOLE_LOGS"
else
  echo -e "${GREEN}✅ 没有 console.log${NC}"
fi
echo ""

# 8. 检查 TODO 和 FIXME
echo "📋 检查 TODO 和 FIXME..."
TODOS=$(grep -r "TODO\|FIXME" src --include="*.ts" --include="*.tsx")
if [ -n "$TODOS" ]; then
  echo -e "${YELLOW}⚠️  发现 TODO/FIXME:${NC}"
  echo "$TODOS"
else
  echo -e "${GREEN}✅ 没有 TODO/FIXME${NC}"
fi
echo ""

# 总结
echo "================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ 代码质量检查通过！${NC}"
  exit 0
else
  echo -e "${RED}❌ 发现 $ERRORS 个问题，请修复后再提交${NC}"
  exit 1
fi

