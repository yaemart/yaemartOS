# yaemartOS — 1Password Vault 结构与命名约定

> 用途：统一团队密钥管理。所有密钥**仅**通过此 vault 共享，禁止 IM / 邮件 / 文档明文传递。  
> 关联文档：`docs/yaemartOS-implementation-plan.md` §17.4 / `docs/W1-D1-checklist.md` 第 1 节。  
> 决策权：tech lead（vault 管理员）+ CEO（最终密钥访问审批权）。

---

## 1. Vault 总览

### 1.1 Vault 命名

| Vault 名称          | 用途                                                   | 成员                       |
| ------------------- | ------------------------------------------------------ | -------------------------- |
| `yaemartos-prod`    | 生产环境密钥                                           | tech lead + CEO（仅 2 人） |
| `yaemartos-staging` | 预发布环境密钥                                         | tech lead + dev #2         |
| `yaemartos-dev`     | 开发环境密钥（测试用 key）                             | tech lead + dev #2         |
| `yaemartos-shared`  | 团队共享：仪表盘登录、文档站、客户支持账号等非敏感凭证 | 全员                       |

> **关键原则**：生产密钥与开发密钥**永不共用同一个 vault**。任何 dev 都不应能访问生产密钥（除非紧急 P0 事故时由 CEO 临时授权）。

### 1.2 角色与权限

| 角色       | prod | staging | dev | shared              |
| ---------- | ---- | ------- | --- | ------------------- |
| CEO        | RW   | R       | R   | RW                  |
| tech lead  | RW   | RW      | RW  | RW                  |
| dev #2     | —    | RW      | RW  | RW                  |
| 运营 PM    | —    | —       | —   | R（仅 shared）      |
| 客服负责人 | —    | —       | —   | R（仅 shared）      |
| 法务       | —    | —       | —   | —                   |
| 财务       | —    | —       | —   | R（仅财务相关条目） |

> **R = Read-only**，**RW = Read+Write**。

---

## 2. Item 命名约定

### 2.1 命名格式

```
<service>/<scope>/<purpose>[/<env>]

字段说明：
  service:   外部服务名（小写）       gemini, sentry, cloudinary, lingxing, postgres, redis, ses, github
  scope:     范围（小写）             api, oauth, smtp, db, cache, webhook, deploy
  purpose:   用途（小写，连字符）      key, secret, password, token, dsn, conn-string
  env:       环境（可选）              prod, staging, dev — 仅 shared/共用 vault 需标注；专用 vault 不需要
```

### 2.2 命名示例

> 假设位于 `yaemartos-dev` vault，无需 env 后缀。

```
gemini/api/key                       # Google Gemini API key
gemini/api/key-fallback              # 备用 key
sentry/web/dsn                       # Web 项目 Sentry DSN
sentry/api/dsn                       # API 项目 Sentry DSN
cloudinary/api/cloud-name
cloudinary/api/key
cloudinary/api/secret
postgres/db/conn-string-app          # 应用连接字符串
postgres/db/conn-string-migrate      # 迁移用账号（更高权限）
redis/cache/url
lingxing/api/app-id
lingxing/api/app-secret
lingxing/api/test-account            # 联系人 / 测试账号备注
ses/smtp/access-key                  # （或 resend、postmark 视实际选型）
ses/smtp/secret
ses/smtp/from-address
google-oauth/oauth/client-id
google-oauth/oauth/client-secret
facebook-oauth/oauth/app-id
facebook-oauth/oauth/app-secret
github/deploy/personal-access-token  # CI/CD 使用
```

### 2.3 字段填写规范

每个 item 必填字段：

| 字段                      | 说明                                           | 例                                                                                 |
| ------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `username`                | 登录用户名/账号                                | `support@yaemartos.com`                                                            |
| `password` / `credential` | 密钥/密码                                      | `***`                                                                              |
| `website`                 | 服务后台 URL                                   | `https://console.cloud.google.com`                                                 |
| `notes`                   | 用途说明、申请人、申请日期、配额限制、过期时间 | `Gemini API key for dev. Created 2026-04-30 by Alice. Quota: 1000 RPM. No expiry.` |
| **tags**                  | 至少 1 个 tag                                  | `s1`, `gemini`, `prod`, `expires-2027-04-30`                                       |

> **特别注意**：`notes` 必须写明谁在什么时候申请的，方便日后审计追溯。

### 2.4 文件附件

- OAuth client 的 JSON 凭证文件（如 Google Service Account）→ 直接上传到 item
- SSH private key → 单独 item，命名 `<service>/ssh/private-key`
- 证书文件（pem / pfx）→ 单独 item，命名 `<service>/cert/<domain>`

---

## 3. .env 模板与同步

### 3.1 仓库内 `.env.local.example`

```bash
# ========== 1Password vault: yaemartos-dev ==========
# 在 1Password 中复制对应 item 的值粘贴到 .env.local（已 gitignored）

# Google Gemini (item: gemini/api/key)
GEMINI_API_KEY=

# Sentry (items: sentry/web/dsn, sentry/api/dsn)
NEXT_PUBLIC_SENTRY_DSN_WEB=
SENTRY_DSN_API=

# Cloudinary (items: cloudinary/api/*)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Postgres (item: postgres/db/conn-string-app)
DATABASE_URL=

# Redis (item: redis/cache/url)
REDIS_URL=

# Lingxing (items: lingxing/api/*)
LINGXING_APP_ID=
LINGXING_APP_SECRET=

# OAuth (items: google-oauth/oauth/*, facebook-oauth/oauth/*)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
FACEBOOK_OAUTH_APP_ID=
FACEBOOK_OAUTH_APP_SECRET=

# SMTP (items: ses/smtp/*)
SMTP_ACCESS_KEY=
SMTP_SECRET=
SMTP_FROM=
```

### 3.2 同步流程

| 操作           | 流程                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **新成员入职** | tech lead 在 1Password 邀请 → 加入对应 vault → 分享 `.env.local.example` → 该成员逐项从 vault 拷贝到 `.env.local`                       |
| **新增密钥**   | 申请人在 1Password 创建 item（按 §2 规范）→ 在 PR 中更新 `.env.local.example`（仅添加变量名，不填值） → reviewer 确认 vault item 已存在 |
| **轮换密钥**   | tech lead 在外部服务（如 Google Cloud）生成新 key → 更新 1Password item → 通知团队拉取新值 → 旧 key 在外部服务延迟 7 天禁用             |
| **离职**       | tech lead 立即将该成员移出全部 vault → 24h 内轮换该成员可能接触过的密钥                                                                 |

### 3.3 禁止行为

- ❌ 在 IM / 邮件 / 飞书 / 钉钉 任何即时通信工具明文发密钥
- ❌ 在 commit message / PR description / issue 评论里贴密钥
- ❌ 在 `.env` 而非 `.env.local` 写真实值（前者可能被 commit）
- ❌ 在 `console.log` / 错误日志 / Sentry 上下文里直接输出密钥
- ❌ 把生产密钥同步到 dev 环境
- ❌ 多人共用同一个 1Password 个人账号

---

## 4. 生产环境密钥管理（额外严格）

### 4.1 存放位置

生产密钥**不放本地** `.env.local`：

- 部署平台密钥管理（Vercel / AWS Secrets Manager / Doppler 等，D-1 选定）
- 1Password `yaemartos-prod` 仅作"应急副本"
- 部署工具读取部署平台密钥管理而非 1Password（避免人工同步漂移）

### 4.2 访问审计

- `yaemartos-prod` 启用 1Password Audit Log（Business 套餐及以上）
- 任何 `yaemartos-prod` 的访问记录每月 review
- 异常访问（非工作时间、异地 IP）触发告警

### 4.3 应急访问

- CEO 持有 `yaemartos-prod` 的"打破玻璃"账号（emergency access）
- 仅用于：tech lead 不可达 + 生产 P0 事故
- 使用后 24h 内全部生产密钥强制轮换

---

## 5. 审计与合规

### 5.1 月度 review

每月 1 日 tech lead 执行：

- [ ] 列出所有 vault item 与最后修改时间
- [ ] 标记 > 6 个月未轮换的 key（`stale` tag）
- [ ] 检查 stale key 在外部服务的最后调用时间
- [ ] 闲置 > 90 天的 key 直接禁用并归档
- [ ] 离职/调岗员工的 vault 成员清理
- [ ] 审计日志异常访问 review

### 5.2 季度 review

每个切片末（S1 W13、S2 W26、...）：

- [ ] 全量密钥轮换计划（高敏感密钥）
- [ ] vault 结构 review，按 §2 规范修正不合规命名
- [ ] 与法务对齐：是否新增数据出境/隐私合规要求

### 5.3 应急轮换触发条件

满足任一即立刻轮换：

- 员工离职 / 调岗
- 密钥可能被 commit 到 git（即便已删除 commit）
- 第三方服务 breach 公告
- 生产 P0/P1 事故复盘怀疑密钥泄漏
- vault 异常访问告警

---

## 6. W1 D-1 落地清单

- [ ] tech lead 创建 4 个 vault：`yaemartos-prod` / `staging` / `dev` / `shared`
- [ ] 邀请 dev #2 + CEO 按 §1.2 权限矩阵加入
- [ ] 录入 D-1 行政准备产生的全部密钥（按 §2 命名规范）
- [ ] 提交 `.env.local.example` 到仓库（仅变量名，无值）
- [ ] CONTRIBUTING.md 引用本文档
- [ ] 在 README 加入"密钥管理"章节链接

---

_版本：v1.0 | 创建日期：2026-04-30 | 下次评审：每月 1 日 + 切片末_
