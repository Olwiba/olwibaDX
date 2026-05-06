import { chromium } from 'playwright';
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
  selector?: string;
  themes?: ('light' | 'dark')[];
  manifestPath?: string;
}

export interface ManifestEntry {
  name: string;
  theme: 'light' | 'dark';
  file: string;
  width: number;
  height: number;
}

export async function generatePreviews(config: GeneratePreviewsConfig): Promise<void> {
  const {
    baseUrl,
    outputDir,
    components,
    selector = '[data-slot="component-preview-canvas"]',
    themes = ['light', 'dark'],
    manifestPath,
  } = config;

  try {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
  } catch {
    throw new Error(`Dev server not reachable at ${baseUrl}. Start it first.`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const manifest: ManifestEntry[] = [];

  try {
    for (const component of components) {
      const urlPath = component.urlPath ?? `/docs/components/${component.name}`;
      const url = `${baseUrl}${urlPath}`;

      for (const theme of themes) {
        const page = await browser.newPage();
        try {
          await page.goto(url, { waitUntil: 'networkidle' });

          if (theme === 'dark') {
            await page.evaluate("document.documentElement.classList.add('dark')");
            await page.waitForTimeout(150);
          }

          const el = page.locator(selector).first();
          await el.waitFor({ state: 'visible', timeout: 10_000 });

          const filename = themes.length > 1
            ? `${component.name}-${theme}.png`
            : `${component.name}.png`;
          const filepath = path.join(outputDir, filename);

          await el.screenshot({ path: filepath });

          const box = await el.boundingBox();
          manifest.push({
            name: component.name,
            theme,
            file: filename,
            width: Math.round(box?.width ?? 0),
            height: Math.round(box?.height ?? 0),
          });

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
