import { describe, expect, test } from 'bun:test';
import { createHarnessZip, defaultHarnessConfig, generateHarnessFiles } from './harness-builder';

describe('harness builder', () => {
  test('generates the control-layer files and per-repository lodes', () => {
    const files = generateHarnessFiles(defaultHarnessConfig);
    const paths = files.map((file) => file.path);

    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('ECOSYSTEM.md');
    expect(paths).toContain('lode/design-system/overview.md');
    expect(paths).toContain('process/release.md');
    expect(files.find((file) => file.path === 'AGENTS.md')?.content).toContain('Prefer an upstream fix');
  });

  test('omits optional processes cleanly', () => {
    const files = generateHarnessFiles({
      ...defaultHarnessConfig,
      includeLode: false,
      includeReleaseProcess: false,
      includeVerificationProcess: false,
    });

    expect(files.some((file) => file.path.startsWith('lode/'))).toBe(false);
    expect(files.some((file) => file.path.startsWith('process/'))).toBe(false);
  });

  test('keeps agent steps contiguous without upstream-first guidance', () => {
    const files = generateHarnessFiles({
      ...defaultHarnessConfig,
      includeLode: true,
      upstreamFirst: false,
      includeVerificationProcess: true,
    });
    const agents = files.find((file) => file.path === 'AGENTS.md')?.content;

    expect(agents).toContain('3. Identify which repository owns the change.');
    expect(agents).toContain('4. Follow `process/verification.md` before reporting completion.');
    expect(agents).not.toContain('\n5. Follow `process/verification.md`');
  });

  test('creates a valid ZIP container with central directory records', () => {
    const files = generateHarnessFiles(defaultHarnessConfig);
    const zip = createHarnessZip(files);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 12, true)).toBe(files.length);
  });
});
