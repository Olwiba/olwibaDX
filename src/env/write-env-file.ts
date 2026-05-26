import { readFileSync, writeFileSync } from 'node:fs';
import type { EnvWriteOptions } from './types';
import { parseEnvExample } from './parse-env-example';

function quoteEnvValue(value: string): string {
  if (/[\s#"'=]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function writeEnvFile({ examplePath, outputPath, values }: EnvWriteOptions): void {
  const source = readFileSync(examplePath, 'utf8');
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const specs = parseEnvExample(source);
  const specByKey = new Map(specs.variables.map((variable) => [variable.key, variable]));

  const output = lines.map((line) => {
    const trimmed = line.trim();
    const assignment = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!assignment) return line;

    const key = assignment[1]!;
    if (!(key in values)) return line;

    const spec = specByKey.get(key);
    const value = quoteEnvValue(values[key]!);
    const padding = line.match(/^(\s*)/)?.[1] ?? '';
    return `${padding}${key}=${value}`;
  });

  writeFileSync(outputPath, `${output.join('\n').replace(/\n?$/, '')}\n`, 'utf8');
}
