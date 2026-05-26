import { readFileSync } from 'node:fs';
import type { EnvExampleDocument, EnvGenerateKind, EnvScope, EnvVarSpec } from './types';
import { parseGenesisDirectiveLine } from './parse-directives';

function unquoteEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function inferScope(key: string, scope?: EnvScope): EnvScope {
  if (scope) return scope;
  return key.startsWith('VITE_') ? 'client' : 'server';
}

function isGenerateKind(value: string | undefined): value is EnvGenerateKind {
  return value === 'random:base64:32' || value === 'random:hex:32' || value === 'uuid';
}

export function parseEnvExample(content: string): EnvExampleDocument {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const preamble: string[] = [];
  const variables: EnvVarSpec[] = [];

  let pendingDescription: string[] = [];
  let pendingDirective: ReturnType<typeof parseGenesisDirectiveLine> | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const trimmed = line.trim();

    if (!trimmed) {
      pendingDescription = [];
      continue;
    }

    if (trimmed.startsWith('# @genesis')) {
      pendingDirective = parseGenesisDirectiveLine(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      if (!pendingDirective) {
        preamble.push(line);
        pendingDescription.push(trimmed.replace(/^#\s?/, ''));
      } else if (!trimmed.startsWith('# @')) {
        pendingDescription.push(trimmed.replace(/^#\s?/, ''));
      }
      continue;
    }

    const assignment = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!assignment) continue;

    const key = assignment[1]!;
    const exampleValue = unquoteEnvValue(assignment[2] ?? '');
    const directive = pendingDirective ?? {};
    const defaultValue = directive.default ?? exampleValue;
    const scope = inferScope(key, directive.scope);
    const generate = isGenerateKind(directive.generate) ? directive.generate : undefined;

    variables.push({
      key,
      defaultValue,
      exampleValue,
      scope,
      required: directive.required ?? false,
      secret: directive.secret ?? false,
      generate,
      prompt: directive.prompt,
      module: directive.module ?? 'always-in',
      description: [
        ...(directive.description ? [directive.description] : []),
        ...pendingDescription,
      ],
      line: index + 1,
    });

    pendingDescription = [];
    pendingDirective = null;
  }

  return { preamble, variables };
}

export function parseEnvExampleFile(path: string): EnvExampleDocument {
  return parseEnvExample(readFileSync(path, 'utf8'));
}
