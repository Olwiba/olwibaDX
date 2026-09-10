'use client';

import { DocsHeader } from '@olwiba/docs';

const navItems = [
  { label: 'Docs', href: '/docs' },
  { label: 'Tools', href: '/docs/tools' },
  { label: 'Env check', href: '/tools/env-check' },
];

export function SiteHeader() {
  return (
    <DocsHeader
      logo={<>olwiba<span className="text-primary">DX</span></>}
      navItems={navItems}
      githubUrl="https://github.com/olwiba/olwibaDX"
    />
  );
}
