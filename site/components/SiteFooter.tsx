import { DocsFooter } from '@olwiba/docs';
// Named import so only this key is bundled, not the whole manifest.
import { version } from '../../package.json';

export function SiteFooter() {
  return (
    <DocsFooter
      versions={[
        { version, href: 'https://github.com/Olwiba/olwibaDX/blob/master/CHANGELOG.md' },
      ]}
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
