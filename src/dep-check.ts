/**
 * Compares what a project declares against what is actually installed.
 *
 * The failure this exists for is not a missing package — a missing package
 * announces itself the moment something imports it. It is a *stale* one: the
 * pin moved, nobody reinstalled, and every import still resolves. The dev
 * server boots, the types check, and the code runs against a version two
 * releases behind the one it was written for. That has bitten this ecosystem
 * more than once, most expensively when a `@olwiba/ui-pro` pin sat eight
 * versions behind the prop the consuming code already used, and a stale
 * `node_modules` made it compile locally right up until CI saw it.
 *
 * So presence is the cheap half. Version agreement is the half that pays.
 *
 * Pure: every filesystem read is injected. The CLI wrapper in `cli.ts` supplies
 * the real ones.
 */

import { compare, satisfies } from './semver';

export type DepFinding =
  /** Declared, nothing on disk. */
  | { kind: 'missing'; name: string; wanted: string }
  /** Declared as an exact version, an older one installed. */
  | { kind: 'stale'; name: string; wanted: string; installed: string }
  /** Declared as an exact version, a newer one installed. */
  | { kind: 'ahead'; name: string; wanted: string; installed: string }
  /** Declared as a range, installed version outside it. */
  | { kind: 'drifted'; name: string; wanted: string; installed: string }
  /** On disk but its manifest could not be read or had no version. */
  | { kind: 'unreadable'; name: string; wanted: string };

export interface DepCheckResult {
  findings: DepFinding[];
  /** Findings that should stop a dev server: `missing`, `stale`, `unreadable`. */
  blocking: number;
  /** Findings that should print and let the run continue: `drifted`. */
  warnings: number;
  /** Declared, installed, and in agreement. */
  okCount: number;
  /** Declared but not comparable — protocol specs, or ranges with no evaluator. */
  skippedCount: number;
}

export interface DepCheckInput {
  declared: Array<{ name: string; range: string }>;
  /** Installed version, or `null` when nothing is on disk under that name. */
  installedVersion: (name: string) => string | null | undefined;
  /**
   * Range evaluator. Return `undefined` to say "cannot evaluate this range",
   * which is counted as skipped rather than guessed at.
   *
   * Injected because the only dependency-free evaluator available here is
   * `Bun.semver`, and this module has to stay runnable under plain node.
   */
  satisfies?: (version: string, range: string) => boolean | undefined;
  /**
   * Version ordering: negative when `a` precedes `b`. Return `undefined` when
   * the pair cannot be ordered.
   *
   * Only used to tell apart the two ways an exact pin can disagree, which are
   * different problems with different fixes — see `ahead` below.
   */
  compare?: (a: string, b: string) => number | undefined;
}

/**
 * A bare `1.2.3`, with no range operator of any kind.
 *
 * This is the case worth being strict about. An exact pin is somebody saying
 * "this version, specifically", so a different version on disk is unambiguously
 * wrong — no judgement call, no range semantics to argue about. Every
 * `@olwiba/*` dependency in this ecosystem is pinned exactly, by convention,
 * which is what makes a strict rule here safe rather than noisy.
 */
export function isExactPin(range: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.\-+]+)?$/.test(range.trim());
}

/**
 * Specs that name a source rather than a version.
 *
 * `workspace:`, `link:` and `file:` resolve to a directory whose version is
 * whatever that directory says today; comparing it to the spec is meaningless.
 * `npm:` aliases install under a different name than they declare. Git and URL
 * specs have no version to compare at all. All skipped, and counted, so the
 * report can say how much it did not look at.
 */
export function isUncomparableSpec(range: string): boolean {
  const value = range.trim();
  return (
    /^(workspace|link|file|npm|git|git\+ssh|git\+https|github|gitlab|bitbucket|catalog|portal):/i.test(
      value,
    ) ||
    /^(https?|ssh):\/\//i.test(value) ||
    value === '*' ||
    value === '' ||
    value === 'latest'
  );
}

export function checkDeps({
  declared,
  installedVersion,
  satisfies,
  compare,
}: DepCheckInput): DepCheckResult {
  const findings: DepFinding[] = [];
  let okCount = 0;
  let skippedCount = 0;

  for (const { name, range } of declared) {
    if (isUncomparableSpec(range)) {
      skippedCount += 1;
      continue;
    }

    const installed = installedVersion(name);

    if (installed == null) {
      findings.push({ kind: 'missing', name, wanted: range });
      continue;
    }

    if (installed === '') {
      findings.push({ kind: 'unreadable', name, wanted: range });
      continue;
    }

    if (isExactPin(range)) {
      const pin = range.trim();
      if (installed === pin) {
        okCount += 1;
        continue;
      }

      // Which side is newer decides what kind of problem this is.
      //
      // Older than the pin means an install was missed: the declared version is
      // the intent and the code on disk is behind it. That is the drift worth
      // stopping a dev server for.
      //
      // Newer than the pin is almost always workspace hoisting — the root
      // install resolved one copy for every member and took the highest, so a
      // member whose pin lags ends up with a newer package than it asked for.
      // `bun install` will not "fix" that, it will redo it; the fix is to raise
      // the pin. Blocking on it would wedge every lagging workspace member.
      const order = compare?.(installed, pin);
      findings.push({
        kind: order !== undefined && order > 0 ? 'ahead' : 'stale',
        name,
        wanted: range,
        installed,
      });
      continue;
    }

    const satisfied = satisfies?.(installed, range);

    // `undefined` means the evaluator declined, not that the range failed.
    // Guessing here would either invent failures on ranges nobody can parse or
    // silently pass everything; counting it as unchecked is the honest option.
    if (satisfied === undefined) {
      skippedCount += 1;
      continue;
    }

    if (satisfied) okCount += 1;
    else findings.push({ kind: 'drifted', name, wanted: range, installed });
  }

  const blocking = findings.filter(
    (finding) => finding.kind !== 'drifted' && finding.kind !== 'ahead',
  ).length;

  return {
    findings,
    blocking,
    warnings: findings.length - blocking,
    okCount,
    skippedCount,
  };
}

/**
 * The evaluator, when running under Bun.
 *
 * `Bun.semver.satisfies` is a full range implementation already in the runtime,
 * so using it costs nothing and adds no dependency. Under node it is absent and
 * range checks downgrade to skipped — exact pins, which is where this check
 * earns its keep, still work everywhere.
 */
/**
 * The evaluators, from this package's own semver implementation.
 *
 * Deliberately not `Bun.semver`: the CLI runs under node via its shebang, so
 * reaching for a Bun global meant every range counted as unverifiable in the
 * one place the check is actually wired in.
 */
export function defaultSatisfies(version: string, range: string): boolean | undefined {
  return satisfies(version, range);
}

export function defaultCompare(a: string, b: string): number | undefined {
  return compare(a, b);
}

const ORDER: DepFinding['kind'][] = ['stale', 'missing', 'unreadable', 'ahead', 'drifted'];

/** Short reason, printed inline per row rather than as a group heading. */
const LABELS: Record<DepFinding['kind'], string> = {
  stale: 'stale',
  missing: 'missing',
  unreadable: 'unreadable',
  ahead: 'ahead',
  drifted: 'drifted',
};

/**
 * Colour, when the output is going somewhere that can show it.
 *
 * Off for a pipe or a file, and off when `NO_COLOR` is set, so a CI log or a
 * redirect gets clean text rather than escape codes. The report is built as a
 * string, so the decision is made once here rather than at each call site.
 */
const env = process.env ?? {};
const colorEnabled =
  !('NO_COLOR' in env) && (Boolean(process.stdout?.isTTY) || Boolean(env.FORCE_COLOR));

const paint = (code: string, value: string) =>
  colorEnabled ? `[${code}m${value}[0m` : value;

const red = (value: string) => paint('31', value);
const green = (value: string) => paint('32', value);
const yellow = (value: string) => paint('33', value);
const bold = (value: string) => paint('1', value);
const dim = (value: string) => paint('2', value);

/**
 * Formats a report in the shape Raygun.Frontend's `scripts/depcheck.mjs` uses,
 * so the two read the same across projects: a bracketed prefix, a count, a flat
 * indented list one package per line, then the install instruction.
 *
 * Two departures, both because this checks more than presence does. Rows carry
 * the reason and the version pair, since "stale" and "missing" want different
 * things done about them and neither is legible from a bare name. And rows are
 * marked `x` or `!` rather than only `x`, because a hoisted package is not a
 * problem you can install your way out of.
 */
export function formatDepReport(result: DepCheckResult): string {
  const lines: string[] = [];

  if (result.findings.length === 0) {
    const skipped =
      result.skippedCount > 0 ? ` (${result.skippedCount} without a version to compare)` : '';
    return `${green('[dep-check]')} ${dim(`all ${result.okCount} packages match package.json${skipped}`)}`;
  }

  const count = result.findings.length;
  lines.push(`\n${red(bold(`[dep-check] ${count} problem package${count === 1 ? '' : 's'}:`))}\n`);

  const ordered = ORDER.flatMap((kind) =>
    result.findings.filter((finding) => finding.kind === kind),
  );
  const nameWidth = Math.max(...ordered.map((finding) => finding.name.length));
  const reasonWidth = Math.max(...ordered.map((finding) => LABELS[finding.kind].length));

  for (const finding of ordered) {
    // Blocking findings stop whatever called this, so they carry the stronger
    // mark and colour. A warning painted red says the opposite of what it means.
    const isBlocking = finding.kind !== 'ahead' && finding.kind !== 'drifted';
    const mark = isBlocking ? red('x') : yellow('!');
    const value = isBlocking ? red : yellow;
    const name = bold(finding.name.padEnd(nameWidth));
    const reason = dim(LABELS[finding.kind].padEnd(reasonWidth));

    const detail =
      finding.kind === 'missing'
        ? `${dim('nothing installed,')} ${finding.wanted} ${dim('required')}`
        : finding.kind === 'unreadable'
          ? `${dim('no version in its manifest,')} ${finding.wanted} ${dim('required')}`
          : `${value(finding.installed)} ${dim('installed,')} ${finding.wanted} ${dim('required')}`;

    lines.push(`  ${mark} ${name}  ${reason}  ${detail}`);
  }

  lines.push('');
  lines.push(
    `  ${yellow('Run')} ${bold('bun install')} ${yellow('to install dependencies.')}`,
  );

  // Only worth saying when something is actually ahead, because it is the one
  // row `bun install` will not fix: reinstalling reproduces the hoist.
  if (result.findings.some((finding) => finding.kind === 'ahead')) {
    lines.push(
      `  ${dim('Packages marked')} ${yellow('ahead')} ${dim('are usually workspace hoisting. Raise the pin instead.')}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}
