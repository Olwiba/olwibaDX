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
interface BunSemver {
  satisfies?: (version: string, range: string) => boolean;
  order?: (a: string, b: string) => number;
}

function bunSemver(): BunSemver | undefined {
  return (globalThis as { Bun?: { semver?: BunSemver } }).Bun?.semver;
}

export function defaultSatisfies(version: string, range: string): boolean | undefined {
  const fn = bunSemver()?.satisfies;
  if (typeof fn !== 'function') return undefined;
  try {
    return fn(version, range);
  } catch {
    return undefined;
  }
}

/** Ordering counterpart to `defaultSatisfies`. Same runtime, same caveat. */
export function defaultCompare(a: string, b: string): number | undefined {
  const fn = bunSemver()?.order;
  if (typeof fn !== 'function') return undefined;
  try {
    return fn(a, b);
  } catch {
    return undefined;
  }
}

const ORDER: DepFinding['kind'][] = ['stale', 'missing', 'unreadable', 'ahead', 'drifted'];

const LABELS: Record<DepFinding['kind'], string> = {
  stale: 'Stale — an older version is installed than package.json pins',
  missing: 'Missing — declared but not installed',
  unreadable: 'Unreadable — installed but its manifest has no version',
  ahead: 'Ahead — a newer version is installed than package.json pins',
  drifted: 'Drifted — installed version is outside the declared range',
};

const ADVICE: Partial<Record<DepFinding['kind'], string>> = {
  stale: 'Run `bun install` to bring node_modules in line.',
  missing: 'Run `bun install` to bring node_modules in line.',
  unreadable: 'Run `bun install` to bring node_modules in line.',
  ahead:
    'Usually workspace hoisting: the root install resolved one copy for every member\n' +
    '  and took the highest. Raise the pin in package.json rather than reinstalling.',
};

export function formatDepReport(result: DepCheckResult): string {
  const lines: string[] = [];
  const checked = result.okCount + result.findings.length;

  if (result.findings.length === 0) {
    const skipped = result.skippedCount > 0 ? `, ${result.skippedCount} not comparable` : '';
    return `[dep-check] ${result.okCount} of ${checked} dependencies agree with package.json${skipped}`;
  }

  lines.push(
    `\n[dep-check] ${result.findings.length} of ${checked} dependencies disagree with package.json\n`,
  );

  for (const kind of ORDER) {
    const group = result.findings.filter((finding) => finding.kind === kind);
    if (group.length === 0) continue;

    lines.push(`${LABELS[kind]}:`);
    const width = Math.max(...group.map((finding) => finding.name.length));
    for (const finding of group) {
      const name = finding.name.padEnd(width);
      if (finding.kind === 'missing') {
        lines.push(`  ✗ ${name}  wants ${finding.wanted}, nothing installed`);
      } else if (finding.kind === 'unreadable') {
        lines.push(`  ✗ ${name}  wants ${finding.wanted}, installed copy has no version`);
      } else {
        lines.push(`  ✗ ${name}  wants ${finding.wanted}, has ${finding.installed}`);
      }
    }
    lines.push('');
  }

  // One line of advice per kind actually present, deduplicated — three groups
  // that all want `bun install` should say so once.
  const seen = new Set<string>();
  for (const kind of ORDER) {
    if (!result.findings.some((finding) => finding.kind === kind)) continue;
    const advice = ADVICE[kind];
    if (!advice || seen.has(advice)) continue;
    seen.add(advice);
    lines.push(`  ${advice}`);
  }

  lines.push('');
  return lines.join('\n');
}
