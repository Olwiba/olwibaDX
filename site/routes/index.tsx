import { createFileRoute, Link } from '@tanstack/react-router';
import * as React from 'react';
import { AsciiText, Button } from '@olwiba/cn';
import { WhyDialog } from '~/components/WhyDialog';
import { IsometricPlane, type IsometricImage } from '~/components/IsometricPlane';
import rawManifest from '../showcase-manifest.json';

type ManifestEntry = { file: string; width: number; height: number };

const showcase: IsometricImage[] = (rawManifest as ManifestEntry[]).map((entry) => ({
  src: `/showcase/${entry.file}`,
  width: entry.width,
  height: entry.height,
}));

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const [whyOpen, setWhyOpen] = React.useState(false);

  return (
    <div className="relative flex flex-col flex-1 min-h-[calc(100svh-var(--header-height)-var(--footer-height))] justify-center items-center px-4 py-16 text-center">
      {showcase.length > 0 && <IsometricPlane images={showcase} />}

      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-24 sm:h-64 bg-gradient-to-b from-background" />
        <div className="absolute inset-x-0 bottom-0 h-24 sm:h-64 bg-gradient-to-t from-background" />
        <div className="absolute inset-y-0 left-0 w-12 sm:w-64 bg-gradient-to-r from-background" />
        <div className="absolute inset-y-0 right-0 w-12 sm:w-64 bg-gradient-to-l from-background" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full">
        <AsciiText text="olwibaDX" accent="DX" accentColor="var(--primary)" />
        {/* It used to describe itself by the stack it belongs to, which only
            means something to someone already inside that stack. None of these
            tools are specific to it. */}
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Olwiba&apos;s effort to give developers super powers.
        </p>
        <div className="flex gap-4">
          <Button asChild>
            <Link to="/docs/$" params={{ _splat: '' }}>
              Get Started
            </Link>
          </Button>
          {/* Env check keeps its place in the header nav. What the homepage
              was missing was somewhere to explain itself. */}
          <Button variant="outline" onClick={() => setWhyOpen(true)}>
            Whaaat?
          </Button>
        </div>
      </div>

      <WhyDialog open={whyOpen} onOpenChange={setWhyOpen} />
    </div>
  );
}
