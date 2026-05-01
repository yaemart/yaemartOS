import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'yaemartOS — 跨境电商运营系统',
  description: '4 品牌跨境电商运营管理平台',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
