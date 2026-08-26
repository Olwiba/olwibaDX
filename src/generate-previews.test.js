import { afterEach, describe, expect, test } from 'bun:test';
import path from 'node:path';
import {
  generatePreviews,
  resolvePreviewOutputPath,
} from './generate-previews';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('resolvePreviewOutputPath', () => {
  test.each(['../escape', 'nested/name', 'nested\\name', '/absolute', 'C:\\absolute'])(
    'rejects unsafe component name %s',
    (name) => {
      expect(() => resolvePreviewOutputPath('previews', name, 'light', true)).toThrow(
        `Invalid preview component name: ${name}`,
      );
    },
  );

  test('returns a contained output path and filename', () => {
    const result = resolvePreviewOutputPath('previews', 'button', 'dark', true);

    expect(result.filename).toBe('button-dark.png');
    expect(result.filepath).toBe(path.resolve('previews', 'button-dark.png'));
  });
});

test('generatePreviews rejects with context when baseUrl is unreachable', async () => {
  globalThis.fetch = () => Promise.reject(new Error('connection refused'));

  await expect(
    generatePreviews({
      baseUrl: 'http://127.0.0.1:49999',
      outputDir: 'previews',
      components: [],
    }),
  ).rejects.toThrow('Preview dev server is unreachable at http://127.0.0.1:49999');
});
