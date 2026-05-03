import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !['en', 'es', 'fr'].includes(locale)) {
    locale = 'en';
  }

  return {
    locale,
    messages: {},
  };
});
