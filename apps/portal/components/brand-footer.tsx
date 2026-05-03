const BRAND = process.env.NEXT_PUBLIC_BRAND ?? 'homtone';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BrandFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-brand-surface px-4 py-6 text-center">
      <p className="text-xs text-brand-text-secondary">
        © {year} {capitalize(BRAND)}. All rights reserved.
      </p>
    </footer>
  );
}
