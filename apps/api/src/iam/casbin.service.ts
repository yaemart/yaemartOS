import { Injectable, OnModuleInit } from '@nestjs/common';
import { newEnforcer, newModel } from 'casbin';

type EnforceInput = {
  sub: string;
  obj: string;
  act: string;
  brand: string;
  market: string;
  platform: string;
  shop: string;
  category: string;
  field: string;
};

const MODEL_TEXT = `
[request_definition]
r = sub, obj, act, brand, market, platform, shop, category, field

[policy_definition]
p = sub, obj, act, brand, market, platform, shop, category, field, eft

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = (p.sub == r.sub || p.sub == "*") && (p.obj == r.obj || p.obj == "*") && (p.act == r.act || p.act == "*") && (p.brand == r.brand || p.brand == "*") && (p.market == r.market || p.market == "*") && (p.platform == r.platform || p.platform == "*") && (p.shop == r.shop || p.shop == "*") && (p.category == r.category || p.category == "*") && (p.field == r.field || p.field == "*")
`;

@Injectable()
export class CasbinService implements OnModuleInit {
  private enforcer!: Awaited<ReturnType<typeof newEnforcer>>;

  async onModuleInit() {
    const model = newModel();
    model.loadModelFromText(MODEL_TEXT);
    this.enforcer = await newEnforcer(model);

    // Default policy: admin can do everything.
    await this.enforcer.addPolicy('admin', '*', '*', '*', '*', '*', '*', '*', '*', 'allow');
    // Default policy: operator can read auth:me within brand.
    await this.enforcer.addPolicy(
      'operator',
      'auth:me',
      'read',
      '*',
      '*',
      '*',
      '*',
      '*',
      '*',
      'allow',
    );
    // Operator can perform any action on listings/products/categories within brand.
    // Brand-dimension enforcement is handled by the Guard at request time.
    await this.enforcer.addPolicy(
      'operator',
      'listings',
      '*',
      '*',
      '*',
      '*',
      '*',
      '*',
      '*',
      'allow',
    );
    await this.enforcer.addPolicy(
      'operator',
      'products',
      '*',
      '*',
      '*',
      '*',
      '*',
      '*',
      '*',
      'allow',
    );
    await this.enforcer.addPolicy(
      'operator',
      'categories',
      '*',
      '*',
      '*',
      '*',
      '*',
      '*',
      '*',
      'allow',
    );
  }

  async enforce(input: EnforceInput): Promise<boolean> {
    return this.enforcer.enforce(
      input.sub,
      input.obj,
      input.act,
      input.brand,
      input.market,
      input.platform,
      input.shop,
      input.category,
      input.field,
    );
  }
}
