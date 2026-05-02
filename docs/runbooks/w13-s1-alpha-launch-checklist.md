# S1 Alpha 上线核查清单

**切片**：S1（W1–W13）  
**目标**：Homtone × 美国 × Amazon × 英文，5 名运营 alpha 试用  
**版本**：v1.0（W13）  
**Owner**：开发团队 + 运营负责人

---

## 阶段一：Pre-launch（上线前 48h）

> 以下所有项必须完成并签字，才可进入阶段二。

### 基础设施

- [ ] **DB 备份演练完成**  
      参考：`docs/runbooks/w13-db-backup.md §5`  
      备份文件：********\_******** SHA256：********\_********  
      执行人：********\_******** 签字：********\_********

- [ ] **密钥轮转完成**（JWT Secret + DB Password）  
      参考：`docs/runbooks/w13-secret-rotation.md`  
      执行人：********\_******** 签字：********\_********

- [ ] **M-01 压测 PASS**（staging 环境，P99 < 800ms，错误率 < 0.1%）  
      参考：`docs/reports/m01-template.md`  
      报告文件：`docs/reports/m01-_______________.md`  
      执行人：********\_******** 签字：********\_********

### CI/CD & 测试

- [ ] **所有 CI checks 绿**（`main` 分支）  
      GitHub Actions 链接：********\_********

- [ ] **单元测试全通过**（API 118+ 测试，Web 12+ 测试）  
      执行命令：`pnpm --filter @yaemartos/api test && pnpm --filter @yaemartos/web test`

- [ ] **E2E smoke tests 全通过**  
      执行命令：`./scripts/test-e2e-local.sh w4 w5 w6 w7 w8 w9w10 w11 w12`  
      执行人：********\_********

### Feature Flags 核查

- [ ] **API feature flag 配置正确**

  ```
  FEATURE_LISTING_AI=false
  FEATURE_LISTING_AI_HOMTONE=true
  ```

  验证：`GET /listings/:id/generate`（homtone 品牌 → 200；其他品牌 → 403）

- [ ] **前端 feature flag 配置正确**  
      `NEXT_PUBLIC_FEATURE_LISTING_AI=false`（全局关闭，homtone 通过后端 flag 控制）

### 健康检查

- [ ] **`/health/live` 返回 200**  
      命令：`curl https://api.staging.yaemartos.com/health/live`

- [ ] **`/health/ready` 返回 `{ "status": "ok", "db": "up" }`**  
      命令：`curl https://api.staging.yaemartos.com/health/ready`

### 数据就绪（依赖 W12 完成）

- [ ] **W12 路径 A 迁移完成**  
      参考：`docs/runbooks/w12-homtone-migration-runbook.md`  
      导入统计：total=**_ imported=_** failed=**_  
      准确率（M-07）：_** %（需 ≥ 95%）  
      运营签字：********\_********

- [ ] **全量在售 SKU 已入库**（Homtone 美国 Amazon）  
      Product 表行数：**_ Listing 表行数：_**

---

## 阶段二：Launch（T-0，上线当天）

> 按顺序执行，勿跳步。

- [ ] **T-2h：生产 DB 快照**  
      命令：`DIRECT_URL=<prod> ./scripts/backup-pg.sh`  
      标记为：`pre-launch`（上传到 GCS）  
      执行人：********\_********

- [ ] **T-1h：记录部署版本**  
      API commit hash：********\_********  
      Web commit hash：********\_********  
      部署时间：********\_********

- [ ] **T-0：部署至生产**  
      Harness/CI 流水线链接：********\_********  
      部署结果：✅ 成功 / ❌ 失败（→ 立即回滚）

- [ ] **部署后健康检查**  
      `curl https://api.yaemartos.com/health/ready` → `{ "status": "ok" }`

- [ ] **5 名运营账号权限核查**（IAM 已授权，可访问 Homtone 品牌数据）

  | 运营姓名 | 邮箱 | 品牌权限 | 核查结果 |
  | -------- | ---- | -------- | -------- |
  |          |      | Homtone  |          |
  |          |      | Homtone  |          |
  |          |      | Homtone  |          |
  |          |      | Homtone  |          |
  |          |      | Homtone  |          |

- [ ] **Alpha flag 开启确认**（生产环境）  
      `FEATURE_LISTING_AI_HOMTONE=true` 已生效

- [ ] **通知 5 名 alpha 用户**（邮件/IM，含登录链接和使用指南）

---

## 阶段三：Post-launch（T+24h 检查）

- [ ] **Sentry 无新 Error 级别告警**（上线后 24h 内）  
      Sentry 链接：********\_********

- [ ] **5 名运营完成至少一次全流程操作**
  - 登录 → 进入 Homtone 品牌 → 浏览产品列表 → 打开 Listing 编辑器
  - （可选）点击 AI 生成 Listing → 查看版本历史

- [ ] **全流程录屏存档**（至少 1 份）  
      录屏文件路径/链接：********\_********

- [ ] **运营反馈表收集**  
      参考：`docs/runbooks/w13-alpha-feedback-template.md`  
      已收集份数：\_\_\_（目标 5 份）

- [ ] **S1 alpha 启动声明**（开发负责人签字确认 S1 切片完成）  
      签字：********\_******** 日期：********\_********

---

## 快速回滚流程

若上线后发现阻塞性 Bug：

```
1. 在 Harness/CI 触发 rollback 到上一个稳定 deployment
2. 通知 5 名 alpha 用户暂停使用
3. 检查 Sentry + AuditLog 定位问题
4. 修复 → 重新走阶段二流程
```

回滚验证：`/health/ready` 恢复 ok + 运营可正常登录。

---

## 参考文档

- DB 备份：`docs/runbooks/w13-db-backup.md`
- 密钥轮转：`docs/runbooks/w13-secret-rotation.md`
- M-01 报告模板：`docs/reports/m01-template.md`
- W12 迁移 Runbook：`docs/runbooks/w12-homtone-migration-runbook.md`
- Alpha 反馈模板：`docs/runbooks/w13-alpha-feedback-template.md`
