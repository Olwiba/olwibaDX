import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';

export interface PreviewEntry {
  name: string;
  urlPath?: string;
}

export interface DevServerConfig {
  command: string[];
  cwd: string;
  readyTimeout?: number;
}

export interface GeneratePreviewsConfig {
  baseUrl: string;
  outputDir: string;
  components: PreviewEntry[];
  selector?: string;
  themes?: ('light' | 'dark')[];
  manifestPath?: string;
  devServer?: DevServerConfig;
}

export interface ManifestEntry {
  name: string;
  theme: 'light' | 'dark';
  file: string;
  width: number;
  height: number;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let elapsed = 0;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 500));
    elapsed += 500;
    if (elapsed % 5000 === 0) {
      process.stdout.write(`\r  … waiting for server (${Math.round(elapsed / 1000)}s)`);
    }
  }
  throw new Error(`Dev server not ready at ${url} after ${timeoutMs}ms`);
}

function killServer(proc: ChildProcess): void {
  if (proc.pid == null) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-proc.pid, 'SIGTERM');
    }
  } catch { /* already dead */ }
}

export async function generatePreviews(config: GeneratePreviewsConfig): Promise<void> {
  const {
    baseUrl,
    outputDir,
    components,
    selector = '[data-slot="component-preview-canvas"]',
    themes = ['light', 'dark'],
    manifestPath,
    devServer,
  } = config;

  let serverProcess: ChildProcess | null = null;

  try {
    let serverAlreadyRunning = false;
    try {
      const res = await fetch(baseUrl);
      serverAlreadyRunning = res.ok;
    } catch { /* not up */ }

    if (serverAlreadyRunning) {
      console.log(`Dev server already running at ${baseUrl}, skipping spawn.\n`);
    } else if (devServer) {
      const [cmd, ...args] = devServer.command;
      serverProcess = spawn(cmd!, args, {
        cwd: devServer.cwd,
        stdio: 'ignore',
        detached: process.platform !== 'win32',
      });
      console.log(`Starting: ${devServer.command.join(' ')}`);
      await waitForServer(baseUrl, devServer.readyTimeout ?? 60_000);
      console.log('\nDev server ready.\n');
    } else {
      throw new Error(
        `Dev server not reachable at ${baseUrl}. Start it first or pass devServer config.`,
      );
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

            const filename =
              themes.length > 1 ? `${component.name}-${theme}.png` : `${component.name}.png`;
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
  } finally {
    if (serverProcess) killServer(serverProcess);
  }
}
