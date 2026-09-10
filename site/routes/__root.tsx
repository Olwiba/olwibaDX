import { createDocsRoot } from '@olwiba/docs';
import { SiteHeader } from '~/components/SiteHeader';
import { SiteFooter } from '~/components/SiteFooter';
import { ThemeStyle } from '~/components/ThemeStyle';
import { projectConfig } from '~/project.config';
import appCss from '~/styles/app.css?url';

export const Route = createDocsRoot({
  meta: {
    title: 'olwibaDX - Developer tooling for the olwiba stack',
    description:
      'Dev banners, asset generation, and environment checking. Usable from the command line or the browser.',
    ogImage: 'https://dx.olwiba.com/og-image.png',
  },
  favicons: [
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon/favicon-16.png' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon/favicon-32.png' },
    { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon/favicon-48.png' },
    { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/favicon/favicon-64.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
  ],
  header: SiteHeader,
  footer: SiteFooter,
  initialTheme: projectConfig.theme.initialDocsTheme,
  cssUrl: appCss,
  wrapper: ThemeStyle,
});
