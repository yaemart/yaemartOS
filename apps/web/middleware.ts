import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es'],
  defaultLocale: 'en',
});

export const config = {
  // Exclude Next.js internals, static files, and /api/* routes from i18n middleware.
  // Without this exclusion, next-intl would rewrite /api/auth/login → /en/api/auth/login,
  // causing 404s since API routes live outside the [locale] segment.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
