import { ShopBindingList } from '@/components/shop/shop-binding-list';
import { listShops, listLingxingShops } from '@/lib/api/shop-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function ShopsPage({ params }: { params: { locale: string } }) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const [shops, lingxingShops] = await Promise.all([
    listShops(guard.accessToken, guard.user.brandId),
    listLingxingShops(guard.accessToken, guard.user.brandId),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">店铺管理</h1>
          <p className="mt-0.5 text-sm text-zinc-500">共 {shops.length} 个店铺</p>
        </div>
      </div>
      <ShopBindingList
        shops={shops}
        lingxingShops={lingxingShops}
        accessToken={guard.accessToken}
        brand={guard.user.brandId}
      />
    </div>
  );
}
