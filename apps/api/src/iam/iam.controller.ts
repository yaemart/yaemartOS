import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { FeatureFlagService } from '../common/feature-flag/feature-flag.service';
import { CasbinService } from './casbin.service';

const KNOWN_OBJECTS = [
  'dashboard:read',
  'products:read',
  'products:write',
  'listings:read',
  'listings:write',
  'categories:read',
  'categories:write',
  'shops:read',
  'shops:write',
  'settings:read',
  'settings:write',
  'iam:read',
  'iam:write',
  'terminology:read',
  'terminology:write',
] as const;

/**
 * Feature flags included in the capabilities response.
 * When a flag is enabled, the key is added to the capabilities array,
 * allowing frontend components to gate features without a separate API call.
 * The API endpoints themselves are not affected (agents can always call them).
 */
const CAPABILITY_FLAGS = ['LISTING_MATRIX', 'LISTING_AI', 'BATCH_LISTING_GENERATE'] as const;

/** Serialisable descriptor for a REST action an agent may call. */
type ActionDescriptor = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
};

/**
 * Maps each permission string to the REST endpoints it unlocks.
 * Returned as `availableActions` in GET /iam/capabilities so agents can
 * discover the full API surface without reading documentation.
 */
const CAPABILITY_ACTIONS: Partial<Record<string, ActionDescriptor[]>> = {
  'dashboard:read': [{ method: 'GET', path: '/dashboard', description: '获取看板指标' }],
  'products:read': [
    { method: 'GET', path: '/products', description: '列出商品' },
    { method: 'GET', path: '/products/:id', description: '查看商品详情' },
  ],
  'products:write': [
    { method: 'POST', path: '/products', description: '创建商品' },
    { method: 'PATCH', path: '/products/:id', description: '更新商品' },
    { method: 'DELETE', path: '/products/:id', description: '删除商品' },
  ],
  'listings:read': [
    { method: 'GET', path: '/listings', description: '列出 Listing' },
    { method: 'GET', path: '/listings/:id', description: '查看 Listing 详情（含版本列表）' },
    { method: 'GET', path: '/listings/matrix', description: '获取 Listing 相似度矩阵分析' },
  ],
  'listings:write': [
    { method: 'POST', path: '/listings', description: '创建 Listing' },
    { method: 'PATCH', path: '/listings/:id', description: '更新 Listing 元信息' },
    { method: 'DELETE', path: '/listings/:id', description: '删除 Listing' },
    { method: 'POST', path: '/listings/:id/generate', description: 'AI 生成 Listing 草稿（同步）' },
    {
      method: 'POST',
      path: '/listings/:id/versions/:versionId/activate',
      description: '激活指定 Listing 版本',
    },
    {
      method: 'POST',
      path: '/listings/batch-generate',
      description: '跨平台批量 AI 生成 Listing',
    },
  ],
  'shops:read': [
    { method: 'GET', path: '/shops', description: '列出当前品牌的店铺' },
    { method: 'GET', path: '/shops/:id', description: '获取店铺详情' },
    { method: 'GET', path: '/shops/lingxing-available', description: '列出领星可绑定店铺' },
  ],
  'shops:write': [
    { method: 'POST', path: '/shops', description: '创建店铺记录' },
    { method: 'POST', path: '/shops/:id/bind', description: '绑定店铺到领星店铺 ID' },
    { method: 'PATCH', path: '/shops/:id/binding', description: '更新店铺绑定（切换同步/解绑）' },
    { method: 'DELETE', path: '/shops/:id', description: '删除店铺记录' },
  ],
  'settings:read': [
    { method: 'GET', path: '/settings/feature-flags', description: '列出所有 Feature Flag' },
    { method: 'GET', path: '/settings/ai-routing', description: '列出 AI 路由配置' },
    { method: 'GET', path: '/settings/connections', description: '服务连接健康状态' },
    { method: 'GET', path: '/settings/brands', description: '列出品牌及主题配置' },
    { method: 'GET', path: '/settings/ai-cost', description: 'AI 成本摘要与预算告警' },
  ],
  'settings:write': [
    { method: 'PUT', path: '/settings/feature-flags/:key', description: '设置 Feature Flag 值' },
    { method: 'PUT', path: '/settings/ai-routing/:key', description: '设置 AI 路由规则' },
    { method: 'PATCH', path: '/settings/brands/:id', description: '更新品牌主题' },
    { method: 'PUT', path: '/settings/ai-budget/:key', description: '设置 AI 预算上限' },
  ],
  'iam:read': [
    {
      method: 'GET',
      path: '/iam/capabilities',
      description: '获取当前用户权限、Feature Flag 及可调用动作列表',
    },
  ],
  'iam:write': [
    { method: 'GET', path: '/ai/mcp/tools', description: '列出 MCP 工具定义（供 Agent 发现）' },
    { method: 'POST', path: '/ai/mcp/query-inventory', description: '查询领星库存快照' },
    { method: 'POST', path: '/ai/mcp/listing-summary', description: '获取领星 ASIN Listing 摘要' },
    { method: 'POST', path: '/ai/mcp/keyword-suggestions', description: '获取领星关键词建议' },
  ],
  'terminology:read': [
    {
      method: 'GET',
      path: '/terminology',
      description: '列出品牌术语库（按 brandId + locale 筛选）',
    },
  ],
  'terminology:write': [
    { method: 'POST', path: '/terminology', description: '创建术语条目' },
    { method: 'PATCH', path: '/terminology/:id', description: '更新术语条目' },
    { method: 'DELETE', path: '/terminology/:id', description: '删除术语条目' },
    {
      method: 'POST',
      path: '/terminology/import',
      description: '批量导入术语 CSV（term,definition,example）',
    },
  ],
};

@Controller('iam')
export class IamController {
  constructor(
    private readonly casbin: CasbinService,
    private readonly tenantContext: TenantContextService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  @Get('capabilities')
  @UseGuards(JwtAuthGuard)
  async getCapabilities(@Req() req: Request) {
    const user = req.user as { id?: string; role?: string; brandId?: string } | undefined;
    if (!user?.role) {
      return { capabilities: [], availableActions: [] };
    }

    const brand = user.brandId ?? this.tenantContext.getTenant();
    const capabilities: string[] = [];

    for (const obj of KNOWN_OBJECTS) {
      const [resource, action] = obj.split(':');
      const allowed = await this.casbin.enforce({
        sub: user.role,
        obj: resource,
        act: action,
        brand,
        market: '*',
        platform: '*',
        shop: '*',
        category: '*',
        field: '*',
      });
      if (allowed) {
        capabilities.push(obj);
      }
    }

    const flagResults = await Promise.all(
      CAPABILITY_FLAGS.map((flag) => this.featureFlag.isEnabled(flag, brand)),
    );
    CAPABILITY_FLAGS.forEach((flag, i) => {
      if (flagResults[i]) {
        capabilities.push(flag);
      }
    });

    const availableActions: ActionDescriptor[] = capabilities.flatMap(
      (cap) => CAPABILITY_ACTIONS[cap] ?? [],
    );

    return { capabilities, availableActions };
  }
}
