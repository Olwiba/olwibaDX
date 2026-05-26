export type EnvScope = 'server' | 'client';

export type EnvGenerateKind = 'random:base64:32' | 'random:hex:32' | 'uuid';

export type EnvVarSpec = {
  key: string;
  defaultValue: string;
  exampleValue: string;
  scope: EnvScope;
  required: boolean;
  secret: boolean;
  generate?: EnvGenerateKind;
  prompt?: string;
  module: string;
  description: string[];
  line: number;
};

export type EnvExampleDocument = {
  preamble: string[];
  variables: EnvVarSpec[];
};

export type EnvWriteOptions = {
  examplePath: string;
  outputPath: string;
  values: Record<string, string>;
};
