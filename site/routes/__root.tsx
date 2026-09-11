import { createDocsRoot } from '@olwiba/docs';
import { SiteHeader } from '~/components/SiteHeader';
import { SiteFooter } from '~/components/SiteFooter';
import { ThemeStyle } from '~/components/ThemeStyle';
import { projectConfig } from '~/project.config';
import appCss from '~/styles/app.css?url';

export const Route = createDocsRoot({
  meta: {
    // The metadata is what search results and link previews show, so it says
    // the same thing the page does. It used to describe the package by the
    // stack it belongs to, which none of these tools are actually specific to.
    title: 'olwibaDX - Developer super powers, from the command line',
    description:
      "Olwiba's effort to give developers super powers. Dev banners, asset generation, environment checking and documentation checks — from the command line or the browser.",
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
