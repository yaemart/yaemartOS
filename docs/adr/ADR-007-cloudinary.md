# ADR-007：Cloudinary 资产管理

| 字段     | 取值                                                                |
| -------- | ------------------------------------------------------------------- |
| 状态     | Proposed（W4 实施时评审）                                           |
| 提议日期 | 2026-04-30                                                          |
| 决策日期 | _S1 W4 评审通过后填写_                                              |
| 决策人   | tech lead + dev #2                                                  |
| 关联文档 | `yaemartOS-implementation-plan.md` §3 文件存储 / §6 W4 / §8 W36-W37 |
| 取代     | 无                                                                  |

---

## 1. 上下文

§3 已决策 **Cloudinary**（内置 CDN + 图像转换）替代 AWS S3 + imgproxy，原因：

- Manual PDF / 包装文件 / 图片素材统一管理
- 内置图像转换（压缩 / 裁剪 / 格式转换）
- CDN 全球加速
- 4 品牌文件资产需按 brand 目录隔离（合规 + 管理清晰）

文件类型多样：

| 类型                | 格式              | 典型大小  | 使用场景              |
| ------------------- | ----------------- | --------- | --------------------- |
| Listing 主图 / 副图 | JPEG / PNG / WEBP | 0.5-5MB   | Amazon/Walmart 商品页 |
| A+ 模块图           | JPEG / PNG        | 1-10MB    | Amazon A+             |
| 品牌 LOGO           | SVG / PNG         | 50-500KB  | 门户/手册/包装        |
| Manual PDF          | PDF               | 5-50MB    | 客户中心下载          |
| 包装文案 PDF        | PDF               | 1-10MB    | 供应商打样            |
| 培训课程封面        | JPEG / PNG        | 0.5-2MB   | 培训系统              |
| 培训视频（v2.x）    | MP4               | 50-500MB  | v2.x 暂不引入         |
| 工单附件            | 任意              | ≤ 20MB/件 | 客户工单              |
| 保修发票图片        | JPEG / PNG / PDF  | 0.5-5MB   | 保修注册              |

---

## 2. 决策

### 2.1 账号结构

```
Cloudinary Account: yaemartos
├── Cloud Name: yaemartos（全局唯一）
├── Environment: prod   （上传前缀 prod/）
└── Environment: dev    （上传前缀 dev/，低质量 transformation 节省 credit）
```

> 单账号双前缀（非双账号），避免多账号管理成本。dev 前缀下资产不计 production CDN 流量。

### 2.2 Folder 结构（Public ID 命名）

```
<env>/<brand>/<asset_type>/<identifier>[/<variant>]

字段：
  env:         prod | dev | staging
  brand:       homtone | spoonlemon | davivy | tysun | shared
  asset_type:  listing | aplus | logo | manual | packaging | training | ticket | warranty | brand-assets
  identifier:  产品 ID / 手册语言 / 任意唯一标识（kebab-case）
  variant:     (可选) main | thumb | mobile | 序号

例：
  prod/homtone/listing/B0XXX1-slow-cooker-6qt/main
  prod/homtone/listing/B0XXX1-slow-cooker-6qt/alt-1
  prod/homtone/listing/B0XXX1-slow-cooker-6qt/alt-2
  prod/homtone/aplus/B0XXX1-slow-cooker-6qt/module-1
  prod/homtone/logo/primary
  prod/homtone/logo/white-bg
  prod/homtone/manual/slow-cooker-6qt/en
  prod/homtone/manual/slow-cooker-6qt/es
  prod/homtone/manual/slow-cooker-6qt/fr
  prod/homtone/manual/slow-cooker-6qt/de
  prod/homtone/packaging/slow-cooker-6qt/us-en-v1
  prod/homtone/warranty/receipt-uuid-xxxx            ← 保修发票（私有）
  prod/homtone/ticket/attachment-uuid-xxxx           ← 工单附件（私有）
  prod/shared/training/course-01/cover               ← 培训课封面（跨品牌）
```

### 2.3 访问控制

| 资产类型                 | 访问模式                          | 实现                    |
| ------------------------ | --------------------------------- | ----------------------- |
| Listing 主图 / A+ / Logo | **Public**（CDN 直接访问）        | 不含签名 URL            |
| Manual PDF               | **Public**（客户中心直接下载）    | 不含签名                |
| 包装 PDF                 | **Authenticated**（内部使用）     | Signed URL（TTL 1h）    |
| 工单附件                 | **Private**（仅客服 / 当事人）    | Signed URL（TTL 15min） |
| 保修发票                 | **Private**（仅运营 / 当事人）    | Signed URL（TTL 15min） |
| 培训课封面               | **Public**                        | 不含签名                |
| dev/\* 全部              | **Restricted**（仅内网 / 开发者） | Signed URL 或 IP 白名单 |

> Signed URL 生成由 `CloudinaryService.signUrl(publicId, ttlSec)` 统一封装，禁止业务代码直接拼接。

### 2.4 Transformation 规范

#### Listing 主图

```
Amazon 要求：JPEG，最小 1000px，最大 10000px，纯白背景，正方形
Walmart 要求：JPEG，最小 1500px，≤ 25MB

自动 transformation（上传后异步生成）：
  main_2000:    f_jpg,q_85,w_2000,h_2000,c_pad,b_white
  main_1500:    f_jpg,q_85,w_1500,h_1500,c_pad,b_white
  thumb_500:    f_webp,q_70,w_500,h_500,c_pad,b_white
  mobile_800:   f_webp,q_75,w_800,h_800,c_pad,b_white
```

#### A+ 模块图

```
  aplus_full:   f_jpg,q_80,w_970             （Amazon A+ max 970px）
  aplus_mobile: f_webp,q_75,w_600
```

#### Logo

```
  logo_svg:     f_svg                         （直接透明底）
  logo_300:     f_png,w_300,e_trim             （裁剪空白）
  logo_white:   f_png,w_300,e_colorize,co_white （白色版）
```

#### Manual PDF（不做 transformation，保留原版）

```
  direct_download: fl_attachment,dn_<product>-manual-<locale>.pdf
```

#### 工单 / 保修附件（仅压缩，不变形）

```
  safe_preview: f_jpg,q_70,w_1200            （图片类，预览用）
  original:     fl_attachment                 （原文件下载）
```

### 2.5 上传 API 封装（`CloudinaryService`）

```typescript
// packages/cloudinary/src/cloudinary.service.ts
@Injectable()
export class CloudinaryService {

  /**
   * 上传资产（通用）
   */
  async upload(input: UploadInput): Promise<UploadResult> {
    const publicId = this.buildPublicId(input);
    const result = await cloudinary.uploader.upload(input.source, {
      public_id:    publicId,
      folder:       `${this.env}/${input.brand}/${input.assetType}`,
      resource_type: input.resourceType ?? 'auto',
      access_mode:  PRIVATE_TYPES.includes(input.assetType) ? 'authenticated' : 'public',
      tags:         [input.brand, input.assetType, this.env],
      context:      { brand: input.brand, product_id: input.productId ?? '' },
    });
    return { publicId: result.public_id, url: result.secure_url, bytes: result.bytes };
  }

  /**
   * 生成 Signed URL（私有资产访问）
   */
  signUrl(publicId: string, ttlSec: number = 900): string {
    return cloudinary.url(publicId, {
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + ttlSec,
      resource_type: 'raw',
    });
  }

  /**
   * 删除资产（软删除：先改 tag，再 cron 物理删除）
   */
  async softDelete(publicId: string, requestedBy: string): Promise<void> {
    await cloudinary.uploader.add_tag(`deleted_by_${requestedBy}`, [publicId]);
    await cloudinary.uploader.add_tag('pending_delete', [publicId]);
    // 审计日志
    await this.audit.log({ action: 'asset.soft_delete', publicId, requestedBy });
  }

  /**
   * 获取资产元数据
   */
  async getMeta(publicId: string): Promise<AssetMeta> { ... }

  /**
   * Transformation URL 生成（按预设规格）
   */
  transformUrl(publicId: string, preset: TransformPreset): string {
    const t = TRANSFORM_PRESETS[preset];
    return cloudinary.url(publicId, t);
  }
}

type UploadInput = {
  source:       string | Buffer | Readable;
  brand:        Brand;
  assetType:    AssetType;
  identifier:   string;
  variant?:     string;
  productId?:   string;
  resourceType?: 'image' | 'raw' | 'video' | 'auto';
};

type TransformPreset =
  | 'listing_main_2000' | 'listing_main_1500' | 'listing_thumb_500' | 'listing_mobile_800'
  | 'aplus_full' | 'aplus_mobile'
  | 'logo_300' | 'logo_white'
  | 'manual_download'
  | 'attachment_preview';
```

### 2.6 资产生命周期

```
上传
  ↓
存活期（产品在售 / 手册有效 / 工单活跃）
  ↓
软删除请求（tag: pending_delete）
  ↓ 保留 30 天（支持误删恢复）
物理删除（cron 每日凌晨扫 pending_delete + 创建时间 > 30 天）
```

> 例外：保修发票、工单附件保留 **7 年**（法务要求，合规保存期）。

### 2.7 品牌隔离保证

1. 所有上传通过 `CloudinaryService.upload()` —— **禁止直接调 SDK**（lint 规则 `@yaemartos/no-direct-cloudinary-upload`）
2. 上传时强制注入 `brand` tag + context
3. 返回 URL 包含品牌前缀，后端 API 可验证路径合法性
4. 签名 URL 包含 `brand` 声明，防跨品牌伪造
5. 运营后台按 brand 维度过滤资产列表（依赖 Cloudinary tag 搜索）

### 2.8 成本控制

| 措施                          | 说明                                                                    |
| ----------------------------- | ----------------------------------------------------------------------- |
| dev 环境低质量 transformation | dev/\* 资产 q_40，节省 credit                                           |
| 重复上传检测                  | 上传前计算 MD5，命中 cache 直接返回已有 public_id                       |
| 未使用资产定期清理            | 每月 cron 扫"最近 90 天无访问"资产 → 进软删除队列（人工确认后物理删除） |
| transformation 按需生成       | 不预生成全部规格，首次访问生成 + CDN cache                              |
| credit 告警                   | 80% 用量触发 Sentry 告警（对应 §5.1 S3 指标采集）                       |

---

## 3. 落地切片节奏

| 切片       | 增量                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| **S1 W4**  | `CloudinaryService` 骨架 + 上传 + signUrl + 基础 preset；Listing 主图上传 |
| **S1 W4**  | folder 结构确认；dev / prod 双前缀；lint 规则                             |
| **S2 W16** | Walmart Listing 图规格 preset                                             |
| **S3 W36** | Manual PDF 上传 + `fl_attachment` 直链 + 多语言命名                       |
| **S3 W36** | 保修发票上传（Private + 7 年保留标记）                                    |
| **S3 W38** | 工单附件上传（Private + Signed URL 15min）                                |
| **S4 W43** | 成本控制 cron（未使用资产月度扫描）                                       |
| **S6 W66** | Manual PDF 多版本管理（v1 / v2 存档策略）                                 |

---

## 4. 验收

- [ ] `CloudinaryService` 接口全部实现 + 单元测试覆盖 ≥ 80%
- [ ] Listing 主图上传成功，4 种 preset URL 可访问
- [ ] 保修发票上传为 `authenticated`，Signed URL 15min 过期验证通过
- [ ] 品牌隔离：上传 Homtone 资产无法通过 Spoonlemon 路径访问（返回 403）
- [ ] lint 规则 `@yaemartos/no-direct-cloudinary-upload` CI 通过
- [ ] 软删除 + 30 天恢复窗口 + 物理删除 cron 验证

---

## 5. 风险与未决项

| 风险                          | 缓解                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| Cloudinary credit 超限        | 80% 告警 + 开发环境低质量压缩 + 月度清理                    |
| 大 PDF 上传超时（手册 50MB）  | 分块上传（Cloudinary large file upload API）                |
| CDN 缓存导致资产更新不及时    | 上传后调 `cloudinary.uploader.invalidate()` 清缓存          |
| 保修发票 7 年保留与成本的矛盾 | 7 年资产单独 tag `long_term_retain`，排除在月度清理扫描之外 |
| Cloudinary 服务中断           | fallback 到本地暂存 + 队列重传（BullMQ）                    |

---

_版本：v0.1 提案 | 最后修订：2026-04-30 | 实施评审：S1 W4_
