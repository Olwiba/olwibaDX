'use client';

import { Github } from 'lucide-react';
import { DocsHeader, cn } from '@olwiba/docs';

const navItems = [
  { label: 'Docs', href: '/docs' },
  { label: 'Tools', href: '/docs/tools' },
];

const REPO = 'https://github.com/Olwiba/olwibaDX';

export function SiteHeader() {
  return (
    <DocsHeader
      logo={<>olwiba<span className="text-primary">DX</span></>}
      navItems={navItems}
      /* Not `githubUrl`: that renders the word "GitHub", and across the stack
         these links are named after the repository they open so a tab full of
         them is readable. Same reason olwibaUI-Pro builds its own. The
         packageable fix is a label prop on DocsHeader. */
      rightSlot={<RepoLink href={REPO} label="olwibaDX" />}
    />
  );
}

function RepoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Github className="size-4 shrink-0" />
      <span>{label}</span>
    </a>
  );
}
