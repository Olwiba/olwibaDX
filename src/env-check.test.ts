import { describe, expect, test } from 'bun:test';
import { checkEnv, formatEnvReport, parseEnv } from './env-check';

const EXAMPLE = `
# Private docs / purchase gate
DATABASE_URL=file:./dev.db
BETTER_AUTH_SECRET=change-me
PRO_CONTENT_GATED=true
UI_PRO_SIGNUPS_ENABLED=false
EMAIL_PROVIDER=preview
RESEND_API_KEY=
`;

describe('parsing', () => {
  test('keeps keys and discards values', () => {
    const parsed = parseEnv('FOO=secret-value\nBAR=');
    expect([...parsed.keys.keys()]).toEqual(['FOO', 'BAR']);
    expect(parsed.keys.get('FOO')).toBe(true);
    expect(parsed.keys.get('BAR')).toBe(false);
  });

  test('ignores comments and blank lines', () => {
    expect(parseEnv('# note\n\nFOO=1').keys.size).toBe(1);
  });

  test('accepts shell-style export', () => {
    expect([...parseEnv('export FOO=1').keys.keys()]).toEqual(['FOO']);
  });

  test('last assignment wins and the repeat is reported', () => {
    const parsed = parseEnv('FOO=\nFOO=1');
    expect(parsed.keys.get('FOO')).toBe(true);
    expect(parsed.duplicates).toEqual(['FOO']);
  });
});

describe('the failures this exists to catch', () => {
  // The VITE_ migration left keys addressing names nothing read, so the
  // private-docs gate was off for weeks while the file said it was on.
  test('a prefixed leftover is reported as a rename, not an unknown', () => {
    const result = checkEnv({
      example: EXAMPLE,
      actual: `
DATABASE_URL=x
BETTER_AUTH_SECRET=x
VITE_PRO_CONTENT_GATED=true
UI_PRO_SIGNUPS_ENABLED=false
EMAIL_PROVIDER=resend
`,
    });

    const renamed = result.findings.find((f) => f.kind === 'renamed');
    expect(renamed).toBeDefined();
    expect(renamed).toMatchObject({ key: 'VITE_PRO_CONTENT_GATED', looksLike: 'PRO_CONTENT_GATED' });

    // And the setting it was meant to carry is reported absent.
    expect(result.findings).toContainEqual({ kind: 'missing', key: 'PRO_CONTENT_GATED' });
  });

  test('a key typed with spaces is caught', () => {
    const result = checkEnv({
      example: EXAMPLE,
      actual: 'PRO CONTENT GATED=true',
    });

    const names = result.findings.map((f) => ('key' in f ? f.key : ''));
    expect(names).toContain('PRO CONTENT GATED');
  });
});

describe('reporting', () => {
  test('passes when the environment matches', () => {
    const result = checkEnv({
      example: EXAMPLE,
      actual: `
DATABASE_URL=x
BETTER_AUTH_SECRET=x
PRO_CONTENT_GATED=true
UI_PRO_SIGNUPS_ENABLED=false
EMAIL_PROVIDER=resend
`,
      // Blank in the example, so absence is deliberate.
      optional: ['RESEND_API_KEY'],
    });

    expect(result.findings).toEqual([]);
    expect(formatEnvReport(result)).toContain('PASS');
  });

  test('flags a key present but blank where the example shows a value', () => {
    const result = checkEnv({
      example: 'EMAIL_PROVIDER=preview',
      actual: 'EMAIL_PROVIDER=',
    });
    expect(result.findings).toContainEqual({ kind: 'empty', key: 'EMAIL_PROVIDER' });
  });

  test('a blank in both is left alone', () => {
    const result = checkEnv({ example: 'RESEND_API_KEY=', actual: 'RESEND_API_KEY=' });
    expect(result.findings).toEqual([]);
  });

  // The whole input is credentials. A report that echoes one is a worse
  // problem than the drift it found.
  test('never puts a value in the report', () => {
    const secret = 'sk-live-do-not-print-this';
    const result = checkEnv({
      example: 'DATABASE_URL=file:./dev.db\nAPI_KEY=example',
      actual: `API_KEY=${secret}\nSTRIPE_SECRET=${secret}\nnonsense-${secret}`,
    });

    const report = formatEnvReport(result);
    expect(report).not.toContain(secret);
    expect(report).toContain('STRIPE_SECRET');
  });
});
