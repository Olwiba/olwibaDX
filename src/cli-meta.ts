import { arch, platform, release } from 'node:os'
import pc from 'picocolors'

export type CliMetaTone = 'default' | 'accent' | 'success' | 'muted'

export interface CliMetaRow {
  label: string
  value: string
  tone?: CliMetaTone
}

export interface CliMetaOptions {
  title: string
  description?: string
  rows: CliMetaRow[]
  ready?: CliMetaRow
  footer?: string
}

const PLATFORM_NAMES: Record<string, string> = {
  aix: 'AIX',
  darwin: 'macOS',
  freebsd: 'FreeBSD',
  linux: 'Linux',
  openbsd: 'OpenBSD',
  sunos: 'SunOS',
  win32: 'Windows',
}

function paint(value: string, tone: CliMetaTone = 'default'): string {
  if (tone === 'accent') return pc.cyan(value)
  if (tone === 'success') return pc.green(value)
  if (tone === 'muted') return pc.dim(value)
  return value
}

function describeRuntime(): string {
  const bunVersion = (process.versions as NodeJS.ProcessVersions & { bun?: string }).bun
  return bunVersion ? `Bun ${bunVersion}` : `Node ${process.versions.node}`
}

export function describeCliPlatform(
  platformName = platform(),
  architecture = arch(),
  runtime = describeRuntime(),
  osRelease = release(),
): string {
  const name = PLATFORM_NAMES[platformName] ?? platformName
  const version = platformName === 'win32' ? '' : ` ${osRelease}`
  return `${name}${version} · ${architecture} · ${runtime}`
}

export function formatCliMeta(options: CliMetaOptions): string {
  const labelWidth = Math.max(0, ...options.rows.map((row) => row.label.length))
  const lines = [pc.bold(pc.green(options.title))]

  if (options.description) lines.push(pc.dim(options.description))
  lines.push('')

  for (const row of options.rows) {
    lines.push(`${pc.dim(row.label.padEnd(labelWidth))}  ${paint(row.value, row.tone)}`)
  }

  if (options.ready) {
    if (options.rows.length) lines.push('')
    lines.push(
      `${pc.bold(options.ready.label)} ${paint(options.ready.value, options.ready.tone ?? 'accent')}`,
    )
  }

  if (options.footer) lines.push('', pc.dim(options.footer))
  return `${lines.join('\n')}\n`
}

export function printCliMeta(options: CliMetaOptions): void {
  process.stdout.write(`\n${formatCliMeta(options)}`)
}
