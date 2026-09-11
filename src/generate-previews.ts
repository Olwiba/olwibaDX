import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export interface PreviewEntry {
  name: string;
  urlPath?: string;
  /** Override config.selector for this entry (e.g. null for full-page captures). */
  selector?: string | null;
}

export interface GeneratePreviewsConfig {
  baseUrl: string;
  outputDir: string;
  components: PreviewEntry[];
  selector?: string | null;
  themes?: ('light' | 'dark')[];
  manifestPath?: string;
  executablePath?: string;
  padding?: number;
  viewport?: { width?: number; height?: number };
  /**
   * Cookies to set before navigating, for pages that only render when signed in.
   *
   * Without these, capturing an authenticated page silently photographs its
   * signed-out state — a sign-in form or an empty shell — and the result looks
   * like a working screenshot. Use a fixture account; never a real user's
   * session, since whatever it can see ends up in an image on disk.
   */
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
}

export interface ManifestEntry {
  name: string;
  theme: 'light' | 'dark';
  file: string;
  width: number;
  height: number;
}

export function resolvePreviewOutputPath(
  outputDir: string,
  componentName: string,
  theme: 'light' | 'dark',
  includeTheme: boolean,
): { filename: string; filepath: string } {
  if (
    !componentName ||
    componentName === '.' ||
    componentName === '..' ||
    path.isAbsolute(componentName) ||
    componentName.includes('/') ||
    componentName.includes('\\')
  ) {
    throw new Error(`Invalid preview component name: ${componentName}`);
  }

  const filename = includeTheme
    ? `${componentName}-${theme}.png`
    : `${componentName}.png`;
  const resolvedOutputDir = path.resolve(outputDir);
  const filepath = path.resolve(resolvedOutputDir, filename);
  const relativePath = path.relative(resolvedOutputDir, filepath);

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid preview component name: ${componentName}`);
  }

  return { filename, filepath };
}

function findChromePath(): string {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(
    'No Chrome/Edge executable found. Pass executablePath in config or install Chrome.',
  );
}

/**
 * Collapses a preview frame down to the height of what it is actually showing.
 *
 * Docs sandboxes render into an iframe, and a page can ask for a tall canvas so
 * an application shell has somewhere to be. That is right for the page and
 * wrong for a screenshot: a chat bubble photographed inside a 640px frame is
 * mostly empty pixels, and every page asking for that canvas produced an image
 * of exactly the same height regardless of its contents.
 *
 * The iframe is written with `srcDoc`, so it is same-origin and its document
 * can be measured from here. Runs in the page, stringified by Puppeteer.
 *
 * Deliberately conservative. It only shrinks, never grows, and it leaves the
 * frame alone unless the content is both measurable and meaningfully shorter.
 * A shell whose children size themselves against the frame would otherwise
 * collapse to nothing the moment the frame stopped being tall.
 */
// Typed loosely on purpose: this package targets Node and carries no DOM lib,
// because everything else in it runs in a terminal. The body below is
// stringified by Puppeteer and executed in the page, where these globals exist.
function shrinkFrameToContent(selector: string): void {
  const d: any = (globalThis as any).document;
  const wrapper: any = d?.querySelector(selector);
  if (!wrapper) return;

  const iframe = wrapper.querySelector('iframe');
  if (!iframe) return;

  let doc: any = null;
  try {
    doc = iframe.contentDocument;
  } catch {
    // Cross-origin. Nothing to measure, so leave the frame as the page built it.
    return;
  }
  if (!doc) return;

  const root = doc.getElementById('sandbox-root') ?? doc.body;
  if (!root) return;

  // A fixed-canvas sandbox pins html, body and the mount node to `height:100%`,
  // which stretches whatever is inside them to the full frame. Measuring
  // against that chain always reports the frame's own height, so release it
  // first. The sandbox does the same thing when it sizes itself to content.
  const chain = [doc.documentElement, doc.body, root];
  const saved = chain.map((node: any) => node?.getAttribute('style') ?? null);
  const restore = () => {
    chain.forEach((node: any, index: number) => {
      if (!node) return;
      if (saved[index] === null) node.removeAttribute('style');
      else node.setAttribute('style', saved[index]);
    });
  };

  for (const node of chain as any[]) {
    if (!node) continue;
    node.style.height = '';
    node.style.minHeight = '';
  }

  // The union of the children's boxes rather than the root's own height: the
  // root is a flex column and may still be taller than what it contains.
  let contentHeight = 0;
  for (const child of Array.from(root.children) as any[]) {
    contentHeight = Math.max(contentHeight, child.getBoundingClientRect().bottom);
  }
  contentHeight = Math.ceil(contentHeight);

  const frameHeight = iframe.clientHeight;
  // Below this, assume the demo sized itself against the frame and has just
  // collapsed now that the frame stopped being tall. An application shell does
  // exactly that, and shrinking it would photograph a sliver.
  const PLAUSIBLE = 120;
  const WORTH_IT = 24;

  if (contentHeight < PLAUSIBLE || contentHeight > frameHeight - WORTH_IT) {
    restore();
    return;
  }

  // The released chain stays released: the capture should show the content
  // laid out naturally, not re-stretched to a frame it no longer fills.
  //
  // Both elements, and the wrapper is the one that matters. It carries the
  // fixed height inline and the iframe inside it is `h-full`, so shrinking
  // only the frame changes nothing that a screenshot would see: the capture is
  // measured from the wrapper's box. Its `min-height` floor has to go with it.
  iframe.style.height = `${contentHeight}px`;
  wrapper.style.height = `${contentHeight}px`;
  wrapper.style.minHeight = '0';
}

export async function generatePreviews(config: GeneratePreviewsConfig): Promise<void> {
  const {
    baseUrl,
    outputDir,
    components,
    selector = '[data-slot="component-preview-canvas"]',
    themes = ['light', 'dark'],
    manifestPath,
    executablePath,
    padding = 0,
    viewport,
    cookies,
  } = config;

  const vw = viewport?.width ?? 1280;
  const vh = viewport?.height ?? 800;

  for (const component of components) {
    for (const theme of themes) {
      resolvePreviewOutputPath(outputDir, component.name, theme, themes.length > 1);
    }
  }

  try {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Preview dev server is unreachable at ${baseUrl}${detail}`);
  }

  const chromePath = executablePath ?? findChromePath();
  console.log(`Using browser: ${chromePath}`);

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const manifest: ManifestEntry[] = [];
  const captureFailures: Error[] = [];

  try {
    for (const component of components) {
      const urlPath = component.urlPath ?? `/docs/components/${component.name}`;
      const url = `${baseUrl}${urlPath}`;
      const captureSelector =
        component.selector !== undefined ? component.selector : selector;

      for (const theme of themes) {
        const page = await browser.newPage();
        try {
          // next-themes (Fumadocs RootProvider) defaults to system — match OS unless we override early.
          await page.emulateMediaFeatures([
            { name: 'prefers-color-scheme', value: theme },
          ]);

          // Run before page scripts (next-themes / ModeSwitcher) so light captures stay light.
          await page.evaluateOnNewDocument(
            `((scheme) => {
              const isDark = scheme === 'dark';
              const apply = () => {
                const root = document.documentElement;
                root.classList.toggle('dark', isDark);
                root.style.colorScheme = scheme;
              };
              try { localStorage.setItem('theme', scheme); } catch {}
              apply();
              new MutationObserver(apply).observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class'],
              });
            })(${JSON.stringify(theme)})`,
          );

          await page.setViewport({ width: vw, height: vh });

          if (cookies && cookies.length > 0) {
            const { hostname } = new URL(baseUrl);
            await page.setCookie(
              ...cookies.map((cookie) => ({
                path: '/',
                domain: hostname,
                ...cookie,
              })),
            );
          }

          await page.goto(url, { waitUntil: 'networkidle0' });

          await page.evaluate(
            `((scheme) => {
              const isDark = scheme === 'dark';
              document.documentElement.classList.toggle('dark', isDark);
              document.documentElement.style.colorScheme = scheme;
              try { localStorage.setItem('theme', scheme); } catch {}
            })(${JSON.stringify(theme)})`,
          );

          await page.waitForFunction(
            `(scheme) => document.documentElement.classList.contains('dark') === (scheme === 'dark')`,
            { timeout: 5000 },
            theme,
          );
          await new Promise((r) => setTimeout(r, 300));

          const { filename, filepath } = resolvePreviewOutputPath(
            outputDir,
            component.name,
            theme,
            themes.length > 1,
          );

          if (captureSelector === null) {
            await page.screenshot({ path: filepath, clip: { x: 0, y: 0, width: vw, height: vh } });
            manifest.push({ name: component.name, theme, file: filename, width: vw, height: vh });
          } else {
            const el = await page.waitForSelector(captureSelector, { timeout: 10_000 });
            if (!el) throw new Error(`Selector not found: ${captureSelector}`);

            await page.evaluate(
              `document.querySelector(${JSON.stringify(captureSelector)}).style.minHeight = '0'`,
            );
            await page.evaluate(shrinkFrameToContent, captureSelector);
            await new Promise((r) => setTimeout(r, 150));

            const box = await el.boundingBox();
            if (!box) throw new Error(`Could not get bounding box for: ${captureSelector}`);

            if (padding > 0) {
              const clip = {
                x: Math.max(0, box.x - padding),
                y: Math.max(0, box.y - padding),
                width: box.width + padding * 2,
                height: box.height + padding * 2,
              };
              await page.screenshot({ path: filepath, clip });
              manifest.push({
                name: component.name,
                theme,
                file: filename,
                width: Math.round(clip.width),
                height: Math.round(clip.height),
              });
            } else {
              await el.screenshot({ path: filepath });
              manifest.push({
                name: component.name,
                theme,
                file: filename,
                width: Math.round(box.width),
                height: Math.round(box.height),
              });
            }
          }

          console.log(`✓ ${filename}`);
        } catch (err) {
          console.error(`✗ ${component.name} (${theme}):`, err);
          const detail = err instanceof Error ? err.message : String(err);
          captureFailures.push(
            new Error(`Failed to capture ${component.name} (${theme}): ${detail}`),
          );
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (captureFailures.length > 0) {
    throw new AggregateError(
      captureFailures,
      `Failed to generate ${captureFailures.length} preview capture(s)`,
    );
  }

  const resolvedManifestPath = manifestPath ?? path.join(outputDir, 'manifest.json');
  fs.mkdirSync(path.dirname(resolvedManifestPath), { recursive: true });
  fs.writeFileSync(resolvedManifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nGenerated ${manifest.length} previews → ${outputDir}`);
}
