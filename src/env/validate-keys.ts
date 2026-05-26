import type { EnvExampleDocument } from './types';

export type EnvKeyValidationResult = {
  ok: boolean;
  missingInExample: string[];
  extraInExample: string[];
};

export function validateEnvExampleKeys(
  document: EnvExampleDocument,
  expectedKeys: readonly string[],
): EnvKeyValidationResult {
  const expected = new Set(expectedKeys);
  const found = new Set(document.variables.map((variable) => variable.key));

  const missingInExample = [...expected].filter((key) => !found.has(key)).sort();
  const extraInExample = [...found].filter((key) => !expected.has(key)).sort();

  return {
    ok: missingInExample.length === 0 && extraInExample.length === 0,
    missingInExample,
    extraInExample,
  };
}
