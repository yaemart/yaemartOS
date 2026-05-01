# 密钥轮转 Runbook

**适用范围**：yaemartOS S1 alpha 上线前密钥轮转  
**版本**：v1.0（W13）  
**Owner**：开发团队  
**周期**：上线前强制一次；之后按季度轮转

---

## 1. JWT Secret 轮转

### 背景

`JWT_SECRET` 用于签发和验证所有用户 token。轮转后旧 token 立即失效，用户需重新登录。

### 零停机滚动方案（生产推荐）

```
阶段 1：新旧 secret 共存
  → 设置 JWT_SECRET=<新>，JWT_SECRET_LEGACY=<旧>
  → 验证 token 时：先用新 secret 验，失败则用 legacy secret 验
  → 保留 legacy 24h（等旧 token 自然过期）

阶段 2：完全切换
  → 24h 后删除 JWT_SECRET_LEGACY
```

> S1 alpha 阶段（5 人）可接受直接替换（用户重新登录），无需零停机方案。

### 执行步骤

```bash
# 1. 生成新 secret（至少 32 字节）
openssl rand -base64 32

# 2. 更新 API 环境变量
#    Staging: 更新 .env.staging / Neon env vars
#    Production: 更新 Harness secrets / K8s Secret
#    字段名: JWT_SECRET

# 3. 重启 API 服务（应用新 secret）

# 4. 验证：用旧 token 请求 /health/ready（应返回 401）
curl -H "Authorization: Bearer <旧token>" http://localhost:4000/listings
# 期望: 401 Unauthorized

# 5. 重新登录获取新 token，验证正常
```

### 签字记录

| 字段                 | 值                                |
| -------------------- | --------------------------------- |
| **轮转日期**         |                                   |
| **新 secret 生成人** |                                   |
| **环境**             | staging / production              |
| **验证结果**         | 旧 token 失效 ✓ / 新 token 正常 ✓ |
| **签字**             |                                   |

---

## 2. 数据库密码轮转（Neon）

### 执行步骤

```bash
# 1. Neon 控制台 → Project → Settings → Reset database password
#    注意：同时会重置 DATABASE_URL 和 DIRECT_URL

# 2. 更新所有使用数据库的服务的环境变量：
#    apps/api: DATABASE_URL, DIRECT_URL
#    CI/CD: GitHub Secrets / Harness Secrets

# 3. 触发 API 重启（新连接串生效）

# 4. 验证：
curl http://localhost:4000/health/ready
# 期望: { "status": "ok", "db": "up" }
```

### 签字记录

| 字段         | 值            |
| ------------ | ------------- |
| **轮转日期** |               |
| **执行人**   |               |
| **环境**     |               |
| **验证结果** | DB 连接正常 ✓ |
| **签字**     |               |

---

## 3. 第三方 API Key 轮转

### Gemini API Key

1. Google AI Studio → API Keys → 创建新 key
2. 更新 `GEMINI_API_KEY` 环境变量
3. 验证：`POST /listings/:id/generate`（mock listing）
4. 删除旧 key

### Cloudinary

1. Cloudinary 控制台 → Settings → Security → Generate new API Secret
2. 更新 `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`
3. 验证图片上传功能

### 领星 ERP OpenAPI

1. 领星后台 → 开发者中心 → 重新生成 App Secret
2. 更新 `LINGXING_APP_KEY` + `LINGXING_APP_SECRET`
3. 验证：`GET /lingxing/shop-list`

---

## 4. 轮转频率建议

| 密钥类型   | S1 频率         | 触发条件（立即轮转）   |
| ---------- | --------------- | ---------------------- |
| JWT Secret | 上线前 + 每季度 | 疑似泄露、团队成员离职 |
| DB 密码    | 上线前 + 每半年 | 疑似泄露               |
| Gemini Key | 按需            | 疑似泄露               |
| 领星 Key   | 按需            | 疑似泄露、合同续签     |

---

## 5. 紧急轮转（疑似泄露）

```
1. 立即在控制台撤销/重置泄露的 key
2. 检查 AuditLog 表中该 key 生效期间的写操作
3. 通知团队 + 记录事件
4. 按上述步骤补发新 key 并更新所有环境
5. 填写安全事件记录（docs/runbooks/security-incidents.md）
```
