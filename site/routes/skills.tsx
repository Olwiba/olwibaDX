import { createFileRoute } from '@tanstack/react-router';
import { cn } from '@olwiba/cn';
import { ArrowUpRight, Sparkles, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * A signpost, not a second copy.
 *
 * The agent skills and the browser toolbox live on olwiba.com and are
 * maintained there. Rebuilding either here would mean two versions of the same
 * list, and the copy on this site would be the stale one within a month. This
 * page exists so that someone who arrived for the CLI never has to already
 * know the rest of it is there.
 */
export const Route = createFileRoute('/skills')({
  head: () => ({
    meta: [
      { title: 'Skills & tools — olwibaDX' },
      {
        name: 'description',
        content:
          'Agent skills and browser-based developer tools from Olwiba, hosted on olwiba.com.',
      },
    ],
  }),
  component: Skills,
});

type Destination = {
  icon: LucideIcon;
  title: string;
  href: string;
  summary: string;
  detail: string;
  accent: boolean;
};

const destinations: Destination[] = [
  {
    icon: Sparkles,
    title: 'Agent Skills',
    href: 'https://olwiba.com/skills',
    summary: 'Reusable prompts and workflows for AI coding agents.',
    detail: 'Works with Claude Code, Cursor, AMP, Windsurf and others.',
    accent: true,
  },
  {
    icon: Wrench,
    title: 'Developer Toolbox',
    href: 'https://olwiba.com/toolbox',
    summary: 'Free browser-based tools — JSON, regex, hashes, colours, UUIDs.',
    detail: 'No sign-up, and nothing is sent to a server.',
    accent: false,
  },
];

function Skills() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Skills &amp; tools</h1>
      <p className="mt-2 text-muted-foreground">
        Two more things that live on olwiba.com, for when a CLI is not the shape of what you
        need.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {destinations.map((destination) => (
          <DestinationCard key={destination.href} {...destination} />
        ))}
      </div>

      <p className="mt-8 text-muted-foreground text-sm">
        Both are maintained on{' '}
        <a
          className="underline underline-offset-2 hover:text-foreground"
          href="https://olwiba.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          olwiba.com
        </a>
        . Neither is part of this package, so there is nothing here to install.
      </p>
    </div>
  );
}

function DestinationCard({ icon: Icon, title, href, summary, detail, accent }: Destination) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex flex-col gap-3 rounded-lg border p-5 transition-colors',
        accent ? 'hover:border-primary/50 hover:bg-primary/5' : 'hover:bg-accent/50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            accent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-4" />
        </span>
        <ArrowUpRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{summary}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </div>
    </a>
  );
}
