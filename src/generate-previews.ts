import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export interface PreviewEntry {
  name: string;
  urlPath?: string;
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
}

export interface ManifestEntry {
  name: string;
  theme: 'light' | 'dark';
  file: string;
  width: number;
  height: number;
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
  } = config;

  const vw = viewport?.width ?? 1280;
  const vh = viewport?.height ?? 800;

  try {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error();
  } catch {
    console.error(`\nDev server not running at ${baseUrl}.\nStart it first, then re-run iso:generate.\n`);
    process.exit(1);
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

  try {
    for (const component of components) {
      const urlPath = component.urlPath ?? `/docs/components/${component.name}`;
      const url = `${baseUrl}${urlPath}`;

      for (const theme of themes) {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: vw, height: vh });
          await page.goto(url, { waitUntil: 'networkidle0' });

          if (theme === 'dark') {
            await page.evaluate("document.documentElement.classList.add('dark')");
            await new Promise((r) => setTimeout(r, 150));
          }

          const filename =
            themes.length > 1 ? `${component.name}-${theme}.png` : `${component.name}.png`;
          const filepath = path.join(outputDir, filename);

          if (selector === null) {
            await page.screenshot({ path: filepath, clip: { x: 0, y: 0, width: vw, height: vh } });
            manifest.push({ name: component.name, theme, file: filename, width: vw, height: vh });
          } else {
            const el = await page.waitForSelector(selector, { timeout: 10_000 });
            if (!el) throw new Error(`Selector not found: ${selector}`);

            await page.evaluate(
              `document.querySelector(${JSON.stringify(selector)}).style.minHeight = '0'`,
            );
            await new Promise((r) => setTimeout(r, 100));

            const box = await el.boundingBox();
            if (!box) throw new Error(`Could not get bounding box for: ${selector}`);

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
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const resolvedManifestPath = manifestPath ?? path.join(outputDir, 'manifest.json');
  fs.mkdirSync(path.dirname(resolvedManifestPath), { recursive: true });
  fs.writeFileSync(resolvedManifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nGenerated ${manifest.length} previews → ${outputDir}`);
}
