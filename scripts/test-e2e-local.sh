#!/usr/bin/env bash
set -euo pipefail

# ── yaemartOS 本地 E2E 一键复测 ──────────────────────────────
#
# 使用方法：
#   ./scripts/test-e2e-local.sh              # 跑全量 e2e
#   ./scripts/test-e2e-local.sh w5 w6        # 仅跑 W5 + W6
#   ./scripts/test-e2e-local.sh w4           # 仅跑 W4
#
# 依赖前置：
#   1. Docker Compose 已启动（postgres + redis + elasticsearch）
#   2. pnpm install 已完成
#   3. Playwright browsers 已安装（pnpm exec playwright install chromium）
# ─────────────────────────────────────────────────────────────

# ── 构建 workspace 包（nest start 运行时需要 JS 产物）──────────
echo "▶ 构建 @yaemartos/lingxing-client..."
pnpm --filter @yaemartos/lingxing-client run build

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/yaemartos_dev}"
export DIRECT_URL="${DIRECT_URL:-postgresql://postgres:postgres@localhost:5432/yaemartos_dev}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-mock-key}"
export CLOUDINARY_CLOUD_NAME="${CLOUDINARY_CLOUD_NAME:-mock}"
export CLOUDINARY_API_KEY="${CLOUDINARY_API_KEY:-mock}"
export CLOUDINARY_API_SECRET="${CLOUDINARY_API_SECRET:-mock}"
export ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
export LINGXING_APP_KEY="${LINGXING_APP_KEY:-mock-key}"
export LINGXING_APP_SECRET="${LINGXING_APP_SECRET:-mock-secret}"
export LINGXING_BASE_URL="${LINGXING_BASE_URL:-https://mock-lingxing.test}"
export LINGXING_ALLOWED_SHOP_IDS="${LINGXING_ALLOWED_SHOP_IDS:-}"

WEEK_MAP_w4="tests/e2e/w4-auth-admin.spec.ts tests/e2e/w4-permission-guard.spec.ts tests/e2e/w4-brand-switch.spec.ts tests/e2e/w4-es-health.spec.ts"
WEEK_MAP_w5="tests/e2e/w5-category-crud.spec.ts"
WEEK_MAP_w6="tests/e2e/w6-product-crud.spec.ts"
WEEK_MAP_w7="tests/e2e/w7-lingxing-shop-binding.spec.ts"
WEEK_MAP_w8="tests/e2e/w8-mcp-bridge.spec.ts"
WEEK_MAP_w12="tests/e2e/w12-homtone-path-a-migration.spec.ts"

if [ $# -eq 0 ]; then
  echo "▶ 跑全量 e2e"
  pnpm test:e2e
else
  FILES=""
  for week in "$@"; do
    key="WEEK_MAP_${week}"
    val="${!key:-}"
    if [ -z "$val" ]; then
      echo "⚠ 未知 week: $week（可选：w4 w5 w6 w7 w8 w12）"
      exit 1
    fi
    FILES="$FILES $val"
  done
  echo "▶ 跑指定 e2e：$FILES"
  pnpm test:e2e $FILES
fi
