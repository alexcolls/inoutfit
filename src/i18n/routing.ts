import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  // Our App Router structure is /[locale]/..., so locale prefix must always be present.
  localePrefix: 'always'
});

export type Locale = (typeof routing.locales)[number];
