#!/usr/bin/env bash
# ============================================================
# yaemartOS — PostgreSQL 备份脚本
#
# 用法：
#   ./scripts/backup-pg.sh
#
# 环境变量：
#   DIRECT_URL  必填，Neon/Postgres 直连 URL（非 pooled）
#               格式: postgresql://user:pass@host/dbname?sslmode=require
#   BACKUP_DIR  可选，备份输出目录（默认: ./backups）
#
# 依赖：pg_dump（PostgreSQL 客户端工具）
#   macOS: brew install libpq && export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
#   Linux: apt-get install postgresql-client
#
# 备份文件命名: yaemartos_YYYYMMDD_HHMMSS.sql.gz
# 上传到远端（手动或 CI）: gsutil cp / aws s3 cp
# ============================================================
set -euo pipefail

# ── 检查依赖 ─────────────────────────────────────────────────
if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump 未安装。请先安装 PostgreSQL 客户端工具。"
  exit 1
fi

# ── 读取配置 ─────────────────────────────────────────────────
DB_URL="${DIRECT_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ 环境变量 DIRECT_URL 未设置。"
  echo "   提示：Neon 需使用直连 URL（非 pooled），否则 pg_dump 会报错。"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yaemartos_${TIMESTAMP}.sql.gz"

# ── 执行备份 ─────────────────────────────────────────────────
echo "▶ 开始备份 → $BACKUP_FILE"
pg_dump \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  "$DB_URL" | gzip > "$BACKUP_FILE"

# ── 校验 ─────────────────────────────────────────────────────
if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "❌ 备份文件为空，请检查 DIRECT_URL 或 pg_dump 是否正常。"
  exit 1
fi

CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
SIZE=$(du -sh "$BACKUP_FILE" | awk '{print $1}')

echo "✅ 备份完成"
echo "   文件：$BACKUP_FILE"
echo "   大小：$SIZE"
echo "   SHA256：$CHECKSUM"
echo ""
echo "📤 上传到远端（按需执行）："
echo "   GCS: gsutil cp $BACKUP_FILE gs://YOUR_BUCKET/yaemartos-backups/"
echo "   S3:  aws s3 cp $BACKUP_FILE s3://YOUR_BUCKET/yaemartos-backups/"
