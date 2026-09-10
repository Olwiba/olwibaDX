/**
 * Compares a real environment against the example that documents it.
 *
 * Pure string comparison, deliberately. The input is a file full of live
 * credentials, so it is never sent anywhere, never written to disk, and never
 * echoed back — the report names keys and says nothing about values.
 *
 * `.env.example` is the schema. Every repository already has one, which is what
 * makes this usable outside the repositories that have a typed schema, and
 * those are exactly the ones where environments have been rotting unnoticed.
 */

export type EnvFinding =
  | { kind: 'missing'; key: string }
  | { kind: 'unknown'; key: string }
  | { kind: 'renamed'; key: string; looksLike: string }
  | { kind: 'empty'; key: string }
  | { kind: 'malformed'; line: number; text: string }
  | { kind: 'duplicate'; key: string };

export interface EnvCheckResult {
  findings: EnvFinding[];
  /** Keys present in both, non-empty. Counted, never listed. */
  okCount: number;
  exampleCount: number;
  actualCount: number;
}

interface ParsedEnv {
  /** Key to whether it has a non-empty value. Values themselves are discarded. */
  keys: Map<string, boolean>;
  duplicates: string[];
  malformed: Array<{ line: number; text: string }>;
}

/**
 * Reads keys and discards values immediately.
 *
 * The value never leaves this function, so nothing downstream can leak one by
 * accident — including a future change to the report format.
 */
export function parseEnv(source: string): ParsedEnv {
  const keys = new Map<string, boolean>();
  const duplicates: string[] = [];
  const malformed: Array<{ line: number; text: string }> = [];

  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;

    // `export FOO=bar` is valid in a shell-sourced file.
    const withoutExport = line.replace(/^export\s+/, '');
    const eq = withoutExport.indexOf('=');

    if (eq <= 0) {
      // Reported by line number without the text where it could hold a value:
      // a line missing its `=` may still be a pasted secret.
      malformed.push({ line: index + 1, text: withoutExport.slice(0, 24) });
      return;
    }

    const key = withoutExport.slice(0, eq).trim();
    const value = withoutExport.slice(eq + 1).trim();

    if (keys.has(key)) duplicates.push(key);
    // A later assignment wins in most loaders, so the last one decides.
    keys.set(key, value !== '' && value !== '""' && value !== "''");
  });

  return { keys, duplicates, malformed };
}

/**
 * Whether an unrecognised key looks like a renamed version of a known one.
 *
 * This is the finding that matters. A stale key reads as configured — someone
 * scanning the file sees the name they expect in all but a prefix and stops
 * looking — so reporting it as a generic unknown would not tell anyone that the
 * setting it was meant to carry is unset.
 */
function findRenameCandidate(unknownKey: string, knownKeys: string[]): string | undefined {
  const normalise = (key: string) => key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const target = normalise(unknownKey);

  return knownKeys.find((known) => {
    const candidate = normalise(known);
    if (candidate === target) return true;
    // A prefix or suffix on an otherwise identical name: VITE_FOO against FOO.
    return (
      candidate.length >= 6 &&
      (target.endsWith(candidate) || target.startsWith(candidate))
    );
  });
}

export function checkEnv({
  example,
  actual,
  /** Keys allowed to be absent, e.g. optional credentials. */
  optional = [],
}: {
  example: string;
  actual: string;
  optional?: string[];
}): EnvCheckResult {
  const exampleEnv = parseEnv(example);
  const actualEnv = parseEnv(actual);
  const optionalSet = new Set(optional);

  const exampleKeys = [...exampleEnv.keys.keys()];
  const findings: EnvFinding[] = [];
  let okCount = 0;

  for (const key of exampleKeys) {
    // A blank in the example is the example saying this slot is optional — it
    // is showing the name without claiming a value belongs there. Absent then
    // means the same as blank, and reporting it drowns the real findings in
    // unset credentials for services this deployment does not use.
    const exampleDeclaresValue = exampleEnv.keys.get(key) === true;
    const isOptional = optionalSet.has(key) || !exampleDeclaresValue;

    if (!actualEnv.keys.has(key)) {
      if (!isOptional) findings.push({ kind: 'missing', key });
      continue;
    }

    const hasValue = actualEnv.keys.get(key) === true;

    // Blank where the example shows a value: the example is demonstrating that
    // something belongs there. Blank in both is a deliberate opt-out.
    if (!hasValue && !isOptional) {
      findings.push({ kind: 'empty', key });
      continue;
    }

    okCount += 1;
  }

  for (const key of actualEnv.keys.keys()) {
    if (exampleEnv.keys.has(key)) continue;

    const looksLike = findRenameCandidate(key, exampleKeys);
    findings.push(looksLike ? { kind: 'renamed', key, looksLike } : { kind: 'unknown', key });
  }

  for (const key of actualEnv.duplicates) findings.push({ kind: 'duplicate', key });
  for (const line of actualEnv.malformed) findings.push({ kind: 'malformed', ...line });

  return {
    findings,
    okCount,
    exampleCount: exampleEnv.keys.size,
    actualCount: actualEnv.keys.size,
  };
}

const ORDER: EnvFinding['kind'][] = [
  'renamed',
  'missing',
  'empty',
  'malformed',
  'duplicate',
  'unknown',
];

const LABELS: Record<EnvFinding['kind'], string> = {
  renamed: 'Renamed — set under a name nothing reads',
  missing: 'Missing',
  empty: 'Present but empty',
  malformed: 'Malformed line',
  duplicate: 'Set more than once',
  unknown: 'Unknown — not in the example',
};

/** Formats a report. Contains key names and counts only, never a value. */
export function formatEnvReport(result: EnvCheckResult): string {
  const lines: string[] = [];
  lines.push(
    `  ${result.actualCount} keys checked against ${result.exampleCount} in the example, ${result.okCount} correct`,
  );

  if (result.findings.length === 0) {
    lines.push('\nPASS — environment matches the example.');
    return lines.join('\n');
  }

  for (const kind of ORDER) {
    const group = result.findings.filter((finding) => finding.kind === kind);
    if (group.length === 0) continue;

    lines.push(`\n${LABELS[kind]}:`);
    for (const finding of group) {
      if (finding.kind === 'renamed') {
        lines.push(`  ✗ ${finding.key}  →  did you mean ${finding.looksLike}?`);
      } else if (finding.kind === 'malformed') {
        lines.push(`  ✗ line ${finding.line}: ${finding.text}…`);
      } else {
        lines.push(`  ✗ ${finding.key}`);
      }
    }
  }

  // Renames are called out because they are the ones that read as configured.
  const renamed = result.findings.filter((finding) => finding.kind === 'renamed').length;
  if (renamed > 0) {
    lines.push(
      `\n${renamed} key(s) look renamed. The setting they were meant to carry is unset,` +
        '\nwhich usually means a default is in force that nobody chose.',
    );
  }

  lines.push(`\nFAIL — ${result.findings.length} finding(s).`);
  return lines.join('\n');
}
