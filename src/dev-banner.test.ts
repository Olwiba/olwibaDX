import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

describe('dev banner', () => {
  test('supports row colours on one segment without tinting the suffix', () => {
    const script = [
      `import { printBanner } from ${JSON.stringify(join(import.meta.dir, 'dev-banner.ts'))};`,
      "await printBanner({ segments: [",
      "{ text: 'genesis', colorHex: '#10b981', rowColors: ['#6ee7b7', '#10b981'], rowShadeColor: '#065f46' },",
      "{ text: 'start', colorHex: '#ffffff' }",
      "] });",
    ].join('')
    const result = Bun.spawnSync(['bun', '-e', script], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = result.stdout.toString()

    expect(result.exitCode).toBe(0)
    expect(output).toContain('\x1b[38;2;110;231;183m')
    expect(output).toContain('\x1b[38;2;16;185;129m')
    expect(output).toContain('\x1b[38;2;255;255;255m')
  })
})
