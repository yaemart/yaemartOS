# DB 备份 Runbook

**适用范围**：yaemartOS PostgreSQL（Neon）  
**版本**：v1.0（W13 S1 alpha 上线）  
**Owner**：开发团队

---

## 1. 前提条件

- 本地已安装 `pg_dump`（PostgreSQL 客户端工具）
  - macOS：`brew install libpq && export PATH="/opt/homebrew/opt/libpq/bin:$PATH"`
  - Linux：`sudo apt-get install postgresql-client`
- 已设置 `DIRECT_URL` 环境变量（Neon **直连 URL**，非 pooled）
  - 在 Neon 控制台 → Project → Connection Details → Connection string（去掉 `?pgbouncer=true`）

> ⚠️ **Neon 注意事项**：`pg_dump` 必须使用 direct connection URL，pooled URL（含 `-pooler.neon.tech`）不支持。

---

## 2. 执行备份

```bash
# 加载环境变量（本地 .env.local 或手动设置）
export DIRECT_URL="postgresql://user:pass@host.neon.tech/dbname?sslmode=require"

# 执行备份（输出到 ./backups/ 目录）
./scripts/backup-pg.sh

# 可选：指定输出目录
BACKUP_DIR=/tmp/yaemartos-backup ./scripts/backup-pg.sh
```

脚本输出示例：

```
▶ 开始备份 → ./backups/yaemartos_20260501_220000.sql.gz
✅ 备份完成
   文件：./backups/yaemartos_20260501_220000.sql.gz
   大小：2.3M
   SHA256：a1b2c3d4...
```

---

## 3. 上传到远端存储（S1 阶段手动）

```bash
# GCS（推荐）
gsutil cp ./backups/yaemartos_*.sql.gz gs://YOUR_BUCKET/yaemartos-backups/

# AWS S3
aws s3 cp ./backups/yaemartos_*.sql.gz s3://YOUR_BUCKET/yaemartos-backups/
```

S1 阶段手动执行，保留最近 7 份。S4 引入 cronjob 自动化。

---

## 4. 恢复演练

```bash
# 1. 解压备份
gunzip -k ./backups/yaemartos_YYYYMMDD_HHMMSS.sql.gz

# 2. 恢复到临时数据库（演练时使用独立测试库）
psql "$RESTORE_TEST_URL" < ./backups/yaemartos_YYYYMMDD_HHMMSS.sql

# 3. 验证恢复
psql "$RESTORE_TEST_URL" -c "SELECT COUNT(*) FROM \"public\".\"Product\";"
psql "$RESTORE_TEST_URL" -c "SELECT COUNT(*) FROM \"public\".\"Listing\";"

# 4. 清理
rm ./backups/yaemartos_YYYYMMDD_HHMMSS.sql
```

---

## 5. 上线前演练签字记录

> 每次 S1 alpha 上线前完成一次备份 + 恢复演练，填写以下记录。

| 字段         | 值                              |
| ------------ | ------------------------------- |
| **演练日期** |                                 |
| **备份文件** |                                 |
| **备份大小** |                                 |
| **SHA256**   |                                 |
| **恢复验证** | Product 表行数 / Listing 表行数 |
| **执行人**   |                                 |
| **签字确认** |                                 |

---

## 6. 存储保留策略（S1）

| 类别              | 保留数量  | 存储位置                    |
| ----------------- | --------- | --------------------------- |
| 每日手动备份      | 最近 7 份 | 本地 + GCS                  |
| 上线前快照        | 永久保留  | GCS（标记 `pre-launch`）    |
| 迁移前快照（W12） | 永久保留  | GCS（标记 `pre-migration`） |
