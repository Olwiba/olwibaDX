import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@olwiba/cn';
import { checkEnv, formatEnvReport, type EnvFinding } from '../../../src/env-check';
import { envPresets } from '~/lib/env-presets';

export const Route = createFileRoute('/tools/env-check')({
  component: EnvCheckTool,
});

const CUSTOM = '__custom__';

const LABELS: Record<EnvFinding['kind'], string> = {
  renamed: 'Renamed — set under a name nothing reads',
  missing: 'Missing',
  empty: 'Present but empty',
  malformed: 'Malformed line',
  duplicate: 'Set more than once',
  unknown: 'Unknown — not in the example',
};

const ORDER: EnvFinding['kind'][] = [
  'renamed',
  'missing',
  'empty',
  'malformed',
  'duplicate',
  'unknown',
];

/** Renames read as configured, so they are the ones worth colouring loudest. */
const TONE: Record<EnvFinding['kind'], string> = {
  renamed: 'text-destructive',
  missing: 'text-destructive',
  empty: 'text-destructive',
  malformed: 'text-muted-foreground',
  duplicate: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

/**
 * The same comparison the CLI runs, in a page.
 *
 * `checkEnv` is imported from the package source rather than reimplemented, so
 * there is exactly one definition of what a finding is. It takes two strings
 * and returns key names — no filesystem, no network, nothing to configure —
 * which is what makes it work unchanged in a browser.
 *
 * Everything below is `useState`. There is no loader, no server function and no
 * form element on this route: the pasted environment is a real one, and the
 * only way to be sure it is not transmitted is for there to be no code that
 * could transmit it.
 */
function EnvCheckTool() {
  const [presetId, setPresetId] = React.useState(envPresets[0]?.id ?? CUSTOM);
  const [customExample, setCustomExample] = React.useState('');
  const [actual, setActual] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const example =
    presetId === CUSTOM
      ? customExample
      : (envPresets.find((preset) => preset.id === presetId)?.example ?? '');

  const result = React.useMemo(() => {
    if (example.trim() === '' || actual.trim() === '') return null;
    return checkEnv({ example, actual });
  }, [example, actual]);

  // Key names and counts only. `formatEnvReport` is the CLI's formatter, and it
  // is covered by a test asserting no value reaches the output.
  const copyReport = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(formatEnvReport(result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Environment check</h1>
      <p className="mt-2 text-muted-foreground">
        Compares a real environment against the example that documents it, and names the keys
        that drifted. The finding that matters is a renamed key: it reads as configured while
        the setting it was meant to carry sits unset.
      </p>

      <Alert className="mt-6">
        <AlertTitle>Nothing leaves this page</AlertTitle>
        <AlertDescription>
          The comparison runs in your browser. Values are discarded as they are read — only key
          names are compared, and only key names appear in the result. There is no request to
          send them anywhere, and no AI involved.
        </AlertDescription>
      </Alert>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>1. The example</CardTitle>
          <CardDescription>
            The schema to check against. Pick one of the bundled ones, or paste your own
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={presetId} onValueChange={setPresetId}>
            <SelectTrigger className="w-full sm:w-96">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {envPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Paste my own example…</SelectItem>
            </SelectContent>
          </Select>

          {presetId === CUSTOM ? (
            <div className="space-y-2">
              <Label htmlFor="example">Your .env.example</Label>
              <Textarea
                id="example"
                value={customExample}
                onChange={(event) => setCustomExample(event.target.value)}
                placeholder={'DATABASE_URL=file:./dev.db\nAPI_KEY=\n'}
                rows={8}
                className="font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                A key left blank here is read as optional — the example is showing the name
                without claiming a value belongs there.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {countKeys(example)} keys in this example.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>2. The environment</CardTitle>
          <CardDescription>
            Paste the real thing — the whole file, secrets and all. It is read once in this tab
            and never stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="actual" className="sr-only">
            Your environment
          </Label>
          <Textarea
            id="actual"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
            placeholder={'DATABASE_URL=postgres://…\nAPI_KEY=…\n'}
            rows={10}
            className="font-mono text-xs"
            spellCheck={false}
            autoComplete="off"
            /* Password managers offer to capture anything that looks like a
               credential field. This is a page full of them. */
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />
          {actual !== '' && (
            <Button variant="ghost" size="sm" onClick={() => setActual('')}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>
                {result.findings.length === 0
                  ? 'Pass'
                  : `${result.findings.length} finding${result.findings.length === 1 ? '' : 's'}`}
              </CardTitle>
              <CardDescription>
                {result.actualCount} keys checked against {result.exampleCount} in the example,{' '}
                {result.okCount} correct.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={copyReport}>
              {copied ? 'Copied' : 'Copy report'}
            </Button>
          </CardHeader>
          <CardContent>
            {result.findings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Environment matches the example.
              </p>
            ) : (
              <div className="space-y-5">
                {ORDER.map((kind) => {
                  const group = result.findings.filter((finding) => finding.kind === kind);
                  if (group.length === 0) return null;

                  return (
                    <div key={kind}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                        {LABELS[kind]}
                        <Badge variant="secondary">{group.length}</Badge>
                      </h3>
                      <ul className="space-y-1 font-mono text-xs">
                        {group.map((finding, index) => (
                          <li key={index} className={TONE[kind]}>
                            {finding.kind === 'renamed' ? (
                              <>
                                {finding.key} <span className="text-muted-foreground">→</span> did
                                you mean {finding.looksLike}?
                              </>
                            ) : finding.kind === 'malformed' ? (
                              <>
                                line {finding.line}: {finding.text}…
                              </>
                            ) : (
                              finding.key
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        The same check runs in a terminal:{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">bunx @olwiba/dx env-check</code>.
        See{' '}
        <a className="underline underline-offset-4" href="/docs/tools/env-check">
          the docs
        </a>{' '}
        for the flags.
      </p>
    </div>
  );
}

function countKeys(example: string) {
  return example
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== '' && !trimmed.startsWith('#') && trimmed.includes('=');
    }).length;
}
