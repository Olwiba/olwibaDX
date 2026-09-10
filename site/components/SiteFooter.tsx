import { DocsFooter } from '@olwiba/docs';

export function SiteFooter() {
  return (
    <DocsFooter
      changelogUrl="https://github.com/Olwiba/olwibaDX/blob/master/CHANGELOG.md"
      links={[
        {
          label: '🪲 Report a bug',
          href: 'https://github.com/Olwiba/olwibaDX/issues/new',
        },
        {
          label: '✨ Feature request',
          href: 'https://github.com/Olwiba/olwibaDX/issues/new',
        },
      ]}
    />
  );
}
