/**
 * The subset of semver needed to answer "is this installed version allowed by
 * this declared range".
 *
 * Written out rather than taken as a dependency because this runs in front of
 * `bun install` — a check that cannot run until its own dependencies are
 * correct is no use when the thing being checked is whether they are.
 *
 * `Bun.semver` was the first attempt and was a mistake: the CLI ships with a
 * `#!/usr/bin/env node` shebang, so the gate runs under node, where `Bun` is
 * undefined. Every range silently counted as unverifiable — 65 of nestrrr's 79
 * dependencies went unchecked while the output claimed everything agreed.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** Dot-separated identifiers. Numeric ones compare numerically. */
  prerelease: Array<string | number>;
}

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(value: string): ParsedVersion | null {
  const match = VERSION.exec(value.trim());
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
      ? match[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : [],
  };
}

/** Negative when `a` precedes `b`. Build metadata is ignored, per the spec. */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // A version with a prerelease precedes the same version without one.
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const left = a.prerelease[i];
    const right = b.prerelease[i];
    // A shorter set of identifiers precedes a longer one that shares its prefix.
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;

    const leftIsNumber = typeof left === 'number';
    const rightIsNumber = typeof right === 'number';
    // Numeric identifiers always precede alphanumeric ones.
    if (leftIsNumber && !rightIsNumber) return -1;
    if (!leftIsNumber && rightIsNumber) return 1;
    return leftIsNumber ? (left as number) - (right as number) : String(left) < String(right) ? -1 : 1;
  }

  return 0;
}

/** Ordering over raw strings. `undefined` when either side will not parse. */
export function compare(a: string, b: string): number | undefined {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return undefined;
  return compareVersions(left, right);
}

type Operator = '<' | '<=' | '>' | '>=' | '=';

interface Comparator {
  operator: Operator;
  version: ParsedVersion;
}

/** `1.2.3`, `1.2`, `1`, `1.2.x`, `*`. Missing or wildcard parts come back null. */
function parsePartial(value: string): [number | null, number | null, number | null, string] | null {
  const match = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:[-+]([0-9A-Za-z.-]+))?$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const part = (raw: string | undefined) =>
    raw === undefined || raw === 'x' || raw === 'X' || raw === '*' ? null : Number(raw);

  return [part(match[1]), part(match[2]), part(match[3]), match[4] ?? ''];
}

function at(major: number, minor: number, patch: number, prerelease = ''): ParsedVersion {
  return parseVersion(`${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ''}`)!;
}

/**
 * One range atom to the comparators it stands for.
 *
 * Every form reduces to a lower bound and an upper bound, which is what keeps
 * the matching step below simple: it never has to know what a caret is.
 */
function expandAtom(atom: string): Comparator[] | null {
  const trimmed = atom.trim();
  if (trimmed === '' || trimmed === '*' || trimmed === 'x' || trimmed === 'X') return [];

  const operatorMatch = /^(<=|>=|<|>|=|\^|~)?\s*(.+)$/.exec(trimmed);
  if (!operatorMatch) return null;

  const operator = operatorMatch[1] ?? '';
  const parts = parsePartial(operatorMatch[2]);
  if (!parts) return null;

  const [major, minor, patch, prerelease] = parts;

  // `*` on its own, or a bare `x`, allows anything.
  if (major === null) return [];

  if (operator === '^') {
    const lower = at(major, minor ?? 0, patch ?? 0, prerelease);
    // The caret keeps the leftmost non-zero part. 0.x and 0.0.x are treated as
    // unstable, so the range narrows accordingly.
    const upper =
      major !== 0
        ? at(major + 1, 0, 0)
        : minor !== null && minor !== 0
          ? at(0, minor + 1, 0)
          : minor === null
            ? at(1, 0, 0)
            : patch === null
              ? at(0, 1, 0)
              : at(0, 0, patch + 1);
    return [
      { operator: '>=', version: lower },
      { operator: '<', version: upper },
    ];
  }

  if (operator === '~') {
    const lower = at(major, minor ?? 0, patch ?? 0, prerelease);
    // `~1` is the whole major; anything more specific pins the minor.
    const upper = minor === null ? at(major + 1, 0, 0) : at(major, minor + 1, 0);
    return [
      { operator: '>=', version: lower },
      { operator: '<', version: upper },
    ];
  }

  // A partial version behaves as a range even with a comparator in front:
  // `>=1.2` means `>=1.2.0`, and a bare `1.2` means `>=1.2.0 <1.3.0`.
  const isPartial = minor === null || patch === null;

  if (operator === '' || operator === '=') {
    if (!isPartial) return [{ operator: '=', version: at(major, minor, patch, prerelease) }];
    const upper = minor === null ? at(major + 1, 0, 0) : at(major, minor + 1, 0);
    return [
      { operator: '>=', version: at(major, minor ?? 0, 0) },
      { operator: '<', version: upper },
    ];
  }

  const version = at(major, minor ?? 0, patch ?? 0, prerelease);

  // `<1.2` excludes all of 1.2, whereas `<1.2.0` is the same bound written out.
  if (operator === '<' && isPartial) {
    return [{ operator: '<', version: at(major, minor ?? 0, 0) }];
  }
  // `>1.2` means everything after 1.2.x, so the bound moves up to the next minor.
  if (operator === '>' && isPartial) {
    const next = minor === null ? at(major + 1, 0, 0) : at(major, minor + 1, 0);
    return [{ operator: '>=', version: next }];
  }

  return [{ operator: operator as Operator, version }];
}

/** `1.2.3 - 2.3.4`, where the upper bound is inclusive and may be partial. */
function expandHyphen(range: string): Comparator[] | null {
  const halves = range.split(/\s+-\s+/);
  if (halves.length !== 2) return null;

  const lowerParts = parsePartial(halves[0]);
  const upperParts = parsePartial(halves[1]);
  if (!lowerParts || !upperParts) return null;

  const comparators: Comparator[] = [];

  if (lowerParts[0] !== null) {
    comparators.push({
      operator: '>=',
      version: at(lowerParts[0], lowerParts[1] ?? 0, lowerParts[2] ?? 0, lowerParts[3]),
    });
  }

  const [major, minor, patch, prerelease] = upperParts;
  if (major === null) return comparators;

  // An incomplete upper bound stays inclusive of everything under it:
  // `1.2.3 - 2.3` allows every 2.3.x.
  if (minor === null) comparators.push({ operator: '<', version: at(major + 1, 0, 0) });
  else if (patch === null) comparators.push({ operator: '<', version: at(major, minor + 1, 0) });
  else comparators.push({ operator: '<=', version: at(major, minor, patch, prerelease) });

  return comparators;
}

function matches(version: ParsedVersion, comparator: Comparator): boolean {
  const order = compareVersions(version, comparator.version);
  switch (comparator.operator) {
    case '<':
      return order < 0;
    case '<=':
      return order <= 0;
    case '>':
      return order > 0;
    case '>=':
      return order >= 0;
    case '=':
      return order === 0;
  }
}

/**
 * Whether `version` satisfies `range`. `undefined` when the range uses a form
 * this does not implement, which the caller reports as unchecked rather than
 * guessing at.
 */
export function satisfies(version: string, range: string): boolean | undefined {
  const parsed = parseVersion(version);
  if (!parsed) return undefined;

  const alternatives = range.split('||');
  let anyParsed = false;

  for (const alternative of alternatives) {
    const trimmed = alternative.trim();

    const comparators = /\s-\s/.test(trimmed)
      ? expandHyphen(trimmed)
      : trimmed
          .split(/\s+/)
          .filter(Boolean)
          .reduce<Comparator[] | null>((accumulated, atom) => {
            if (accumulated === null) return null;
            const expanded = expandAtom(atom);
            return expanded === null ? null : [...accumulated, ...expanded];
          }, []);

    if (comparators === null) continue;
    anyParsed = true;

    if (!comparators.every((comparator) => matches(parsed, comparator))) continue;

    // npm's prerelease rule: a prerelease version only satisfies a comparator
    // set when some comparator names the same major.minor.patch and is itself a
    // prerelease. Without this, `^1.0.0` would accept `2.0.0-beta.1`, which is
    // a different major that simply happens to sort below 2.0.0.
    if (parsed.prerelease.length > 0) {
      const allowed = comparators.some(
        (comparator) =>
          comparator.version.prerelease.length > 0 &&
          comparator.version.major === parsed.major &&
          comparator.version.minor === parsed.minor &&
          comparator.version.patch === parsed.patch,
      );
      if (!allowed) continue;
    }

    return true;
  }

  return anyParsed ? false : undefined;
}
