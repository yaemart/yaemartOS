import { Link } from '@/navigation';

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold text-brand-text">yaemartOS</h1>
        <p className="text-sm text-brand-text-secondary">跨境电商运营系统</p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dev"
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Dev Preview (⌘1-5 切换)
          </Link>
          <Link
            href="/listing/prd-001"
            className="rounded-md border px-4 py-2 text-sm font-medium text-brand-text hover:bg-zinc-50 transition-colors"
          >
            Listing Editor
          </Link>
        </div>
      </div>
    </div>
  );
}
