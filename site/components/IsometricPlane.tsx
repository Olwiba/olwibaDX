import * as React from 'react';

export interface IsometricImage {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface IsometricPlaneProps {
  images: IsometricImage[];
  cols?: number;
  rows?: number;
  cardWidth?: number;
  cardHeight?: number | 'auto';
  scrollDuration?: number;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function buildGrid<T>(items: T[], rows: number, cols: number): T[][] {
  return Array.from({ length: rows }, (_, r) => {
    const rng = seededRng(r * 31 + 17);
    return Array.from({ length: cols }, () =>
      items[Math.floor(rng() * items.length)]
    );
  });
}

export function IsometricPlane({
  images,
  cols = 13,
  rows = 22,
  cardWidth = 176,
  cardHeight = 'auto',
  scrollDuration = 75,
}: IsometricPlaneProps) {
  const baseRows = React.useMemo(
    () => buildGrid(images, rows, cols),
    [images, rows, cols],
  );

  // The plane is decorative, but it was effectively invisible on a phone: the
  // desktop transform pushes it 180px right and scales it 1.6x, so on a 375px
  // viewport almost all of it sat outside the screen. Pulled back and scaled
  // down instead of hidden — the point of the thing is that it is seen.
  const [isoNarrow, setIsoNarrow] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)');
    const sync = () => setIsoNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || images.length === 0) return null;

  const h = cardHeight === 'auto' ? undefined : cardHeight;
  const tripled = [...baseRows, ...baseRows, ...baseRows];

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none animate-iso-fadein"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 flex items-center justify-center opacity-[0.18] dark:opacity-[0.12]"
        style={{ perspective: '700px', perspectiveOrigin: '50% 50%' }}
      >
        <div
          className="transform-gpu"
          style={{
            transform: isoNarrow
              ? 'translateX(0px) scale(1.05) rotateX(55deg) rotateZ(-45deg)'
              : 'translateX(180px) scale(1.6) rotateX(55deg) rotateZ(-45deg)',
            transformOrigin: 'center center',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="flex gap-3 will-change-transform"
            style={{ animation: `iso-scroll ${scrollDuration}s linear infinite` }}
          >
            {Array.from({ length: cols }, (_, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-3">
                {tripled.map((row, rowIdx) => {
                  const img = row[colIdx];
                  return (
                    <div
                      key={rowIdx}
                      className="bg-card border rounded-lg shrink-0 overflow-hidden"
                      style={{ width: cardWidth, height: h }}
                    >
                      <img
                        src={img.src}
                        alt={img.alt ?? ''}
                        width={img.width}
                        height={img.height}
                        className={h ? 'w-full h-full object-cover' : 'w-full h-auto block'}
                        loading="eager"
                        decoding="async"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
