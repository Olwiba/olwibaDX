import { randomBytes, randomUUID } from 'node:crypto';
import type { EnvGenerateKind } from './types';

export function generateEnvValue(kind: EnvGenerateKind): string {
  switch (kind) {
    case 'random:base64:32':
      return randomBytes(32).toString('base64');
    case 'random:hex:32':
      return randomBytes(32).toString('hex');
    case 'uuid':
      return randomUUID();
    default:
      return randomUUID();
  }
}
