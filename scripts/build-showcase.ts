/**
 * Fetches the homepage showcase loops and encodes them for the web.
 *
 * The plane needs animation, not GIFs specifically. Shipping the sources as-is
 * would put ~34MB on the homepage, and re-encoding them as GIF makes them
 * *larger* — the originals are already palette-optimised, so there is nothing
 * left to win in that format. Measured on the worst of them: 11MB in, 12MB out.
 *
 * Animated WebP is ~9-20x smaller and still renders in an `<img>`, which is the
 * part that matters. The plane repeats the same handful of sources across a
 * grid of a few hundred cards; a browser shares one decode between every `<img>`
 * pointing at the same URL, where a few hundred `<video>` elements would each
 * want a decoder. WebM was the smallest of the three (0.28MB for that same
 * clip) and is unusable for exactly that reason.
 *
 * Requires ffmpeg on PATH. Run after changing SOURCES, and commit the output.
 */
import { mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Giphy CDN ids. The long query string in the original share URLs is tracking. */
const SOURCES = [
  'UrcKdoL5v9HiLP2OmS',
  'bZBmitwUwKtDa',
  'Hw8vYF4DNRCKY',
  'l2Je4anIOIU42GQk8',
  'JmOcVPAapkfmCuBiGs',
  '116EqoDZO8dX68',
  'B5cJiXSyMslby',
  'PLscHbw08qQ7qDhpPw',
  'tXLpxypfSXvUc',
  'QLcCBdBemDIqpbK6jA',
  'xiN0BXMETVsx0AxTXt',
  'RHBHqdYBUmmkw',
  'kfFJ4cZGlNGzRILfpW',
];

/** Twice the 176px card width the plane renders at, so it stays sharp on retina. */
const TARGET_WIDTH = 352;
/** Source loops run at 25-50fps and nothing here is fast enough to need it. */
const FPS = 15;

const OUT = resolve(import.meta.dirname, '../public/showcase');
const WORK = resolve(import.meta.dirname, '../.showcase-cache');

mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });

async function run(args: string[]) {
  const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${args[0]} failed: ${await new Response(proc.stderr).text()}`);
  }
}

let totalIn = 0;
let totalOut = 0;

for (const id of SOURCES) {
  const gif = join(WORK, `${id}.gif`);
  const webp = join(OUT, `${id}.webp`);
  const still = join(OUT, `${id}.still.webp`);

  // Cached so re-encoding does not re-download 34MB every time.
  let cached = false;
  try {
    cached = statSync(gif).size > 0;
  } catch {
    cached = false;
  }

  if (!cached) {
    const response = await fetch(`https://media.giphy.com/media/${id}/giphy.gif`);
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    await Bun.write(gif, await response.arrayBuffer());
  }

  await run([
    'ffmpeg', '-y', '-v', 'error',
    '-i', gif,
    // `min(iw, …)` so a source narrower than the target is left alone. Scaling
    // one up costs bytes and adds no detail — the smallest of these grew from
    // 183KB to 198KB before this guard existed.
    '-vf', `fps=${FPS},scale='min(${TARGET_WIDTH},iw)':-1:flags=lanczos`,
    '-loop', '0',
    '-c:v', 'libwebp',
    '-lossless', '0',
    '-q:v', '60',
    '-compression_level', '6',
    webp,
  ]);

  // A real single-frame asset lets the isometric plane keep its movement on
  // phones without asking mobile WebKit to decode hundreds of animated images.
  await run([
    'ffmpeg', '-y', '-v', 'error',
    '-i', gif,
    '-frames:v', '1',
    '-vf', `scale='min(${TARGET_WIDTH},iw)':-1:flags=lanczos`,
    '-c:v', 'libwebp',
    '-lossless', '0',
    '-q:v', '70',
    '-compression_level', '6',
    still,
  ]);

  const inSize = statSync(gif).size;
  const outSize = statSync(webp).size;
  totalIn += inSize;
  totalOut += outSize;

  console.log(
    `  ${id.padEnd(20)} ${(inSize / 1024 / 1024).toFixed(2)}MB -> ${(outSize / 1024).toFixed(0)}KB`,
  );
}

// Anything left behind is a source that was removed from SOURCES. Left in place
// it would keep being deployed while nothing referenced it.
const expected = new Set(SOURCES.flatMap((id) => [`${id}.webp`, `${id}.still.webp`]));
for (const file of readdirSync(OUT)) {
  if (!expected.has(file)) {
    rmSync(join(OUT, file));
    console.log(`  removed orphan ${file}`);
  }
}

console.log(
  `\n${SOURCES.length} loops, ${(totalIn / 1024 / 1024).toFixed(1)}MB -> ${(totalOut / 1024 / 1024).toFixed(2)}MB`,
);

// The plane sizes each card from its loop's real aspect ratio, so the
// dimensions have to travel with the files. Read back from the encoded output
// rather than the sources: these are what the browser actually loads.
const manifest: Array<{ file: string; still: string; width: number; height: number }> = [];
for (const id of SOURCES) {
  const bytes = new Uint8Array(await Bun.file(join(OUT, `${id}.webp`)).arrayBuffer());
  manifest.push({
    file: `${id}.webp`,
    still: `${id}.still.webp`,
    ...readWebpSize(bytes),
  });
}

await Bun.write(
  resolve(import.meta.dirname, '../site/showcase-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`wrote site/showcase-manifest.json`);

/**
 * Canvas dimensions from a VP8X chunk.
 *
 * Every animated WebP starts with one, and it carries the canvas size as two
 * 24-bit little-endian values minus one. Cheaper than decoding the image, and
 * it cannot disagree with the file the way a hardcoded table would.
 */
function readWebpSize(bytes: Uint8Array): { width: number; height: number } {
  const tag = String.fromCharCode(...bytes.slice(12, 16));
  if (tag !== 'VP8X') throw new Error(`expected VP8X, got ${tag}`);

  const read24 = (offset: number) =>
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)) + 1;

  return { width: read24(24), height: read24(27) };
}
