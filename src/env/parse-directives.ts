export type ParsedDirectives = {
  scope?: 'server' | 'client';
  required?: boolean;
  secret?: boolean;
  generate?: string;
  prompt?: string;
  module?: string;
  default?: string;
  description?: string;
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function tokenizeDirectives(content: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === ' ') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

export function parseGenesisDirectiveLine(line: string): ParsedDirectives | null {
  const match = line.match(/^#\s*@genesis\s+(.+)\s*$/);
  if (!match) return null;

  const directives: ParsedDirectives = {};

  for (const token of tokenizeDirectives(match[1]!)) {
    const eqIndex = token.indexOf('=');
    if (eqIndex === -1) {
      if (token === 'required') directives.required = true;
      if (token === 'secret') directives.secret = true;
      continue;
    }

    const key = token.slice(0, eqIndex);
    const value = unquote(token.slice(eqIndex + 1));

    switch (key) {
      case 'scope':
        if (value === 'server' || value === 'client') directives.scope = value;
        break;
      case 'required':
        directives.required = value === 'true';
        break;
      case 'secret':
        directives.secret = value === 'true';
        break;
      case 'generate':
        directives.generate = value;
        break;
      case 'prompt':
        directives.prompt = value;
        break;
      case 'module':
        directives.module = value;
        break;
      case 'default':
        directives.default = value;
        break;
      case 'description':
        directives.description = value;
        break;
      default:
        break;
    }
  }

  return directives;
}
