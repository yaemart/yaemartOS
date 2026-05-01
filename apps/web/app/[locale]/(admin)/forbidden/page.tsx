import Link from 'next/link';
import { Lock } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Lock className="mb-4 h-16 w-16 text-zinc-300" />
      <h1 className="text-2xl font-bold text-zinc-700">您没有访问此页面的权限</h1>
      <p className="mt-2 text-sm text-zinc-400">请联系管理员申请对应品牌/模块权限</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}
