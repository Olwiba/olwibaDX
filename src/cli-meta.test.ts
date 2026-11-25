import { describe, expect, test } from 'bun:test'
import { describeCliPlatform, formatCliMeta } from './cli-meta'

const stripAnsi = (value: string) => value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')

describe('CLI metadata', () => {
  test('renders aligned metadata, a ready state and footer', () => {
    const output = stripAnsi(
      formatCliMeta({
        title: 'genesis-start · environment vault',
        description: 'Local encrypted deployment profiles',
        rows: [
          { label: 'Platform', value: 'Windows · x64 · Bun 1.4.2' },
          { label: 'Project', value: 'nestrrr' },
        ],
        ready: { label: 'View here:', value: 'http://localhost:50467' },
        footer: 'Press Ctrl+C to stop.',
      }),
    )

    expect(output).toContain('Platform  Windows · x64 · Bun 1.4.2')
    expect(output).toContain('Project   nestrrr')
    expect(output).toContain('View here: http://localhost:50467')
    expect(output).not.toContain('◆')
    expect(output).toEndWith('Press Ctrl+C to stop.\n')
  })

  test('describes Windows, macOS and Linux without assuming one shell', () => {
    expect(describeCliPlatform('win32', 'x64', 'Bun 1.4.2', 'unused')).toBe(
      'Windows · x64 · Bun 1.4.2',
    )
    expect(describeCliPlatform('darwin', 'arm64', 'Bun 1.4.2', '25.0.0')).toBe(
      'macOS 25.0.0 · arm64 · Bun 1.4.2',
    )
    expect(describeCliPlatform('linux', 'x64', 'Node 24', '6.8.0')).toBe(
      'Linux 6.8.0 · x64 · Node 24',
    )
  })
})
