export type HarnessRepository = {
  name: string;
  path: string;
  role: string;
};

export type HarnessConfig = {
  name: string;
  description: string;
  repositories: HarnessRepository[];
  agents: string[];
  includeLode: boolean;
  includeReleaseProcess: boolean;
  includeVerificationProcess: boolean;
  upstreamFirst: boolean;
};

export type HarnessFile = {
  path: string;
  content: string;
};

export const defaultHarnessConfig: HarnessConfig = {
  name: 'My Nexus',
  description: 'A multi-repository control layer for humans and coding agents.',
  repositories: [
    { name: 'design-system', path: 'repos/design-system', role: 'Shared primitives and tokens' },
    { name: 'platform', path: 'repos/platform', role: 'Reusable application capabilities' },
    { name: 'product', path: 'repos/product', role: 'Product-specific code and composition' },
  ],
  agents: ['Claude Code', 'Codex', 'Cursor'],
  includeLode: true,
  includeReleaseProcess: true,
  includeVerificationProcess: true,
  upstreamFirst: true,
};

export function generateHarnessFiles(config: HarnessConfig): HarnessFile[] {
  const name = clean(config.name) || 'Repository Harness';
  const description = clean(config.description) || 'A control layer for a multi-repository workspace.';
  const repositories = config.repositories
    .map((repository) => ({
      name: slug(repository.name),
      path: normalisePath(repository.path),
      role: clean(repository.role),
    }))
    .filter((repository) => repository.name && repository.path);
  const agents = config.agents.map(clean).filter(Boolean);

  const files: HarnessFile[] = [
    { path: 'README.md', content: readme(name, description, repositories) },
    { path: 'AGENTS.md', content: agentsFile(name, repositories, agents, config) },
    { path: 'ECOSYSTEM.md', content: ecosystemFile(name, description, repositories, config) },
    { path: 'harness.json', content: `${JSON.stringify({ ...config, name, description, repositories, agents }, null, 2)}\n` },
    { path: '.gitignore', content: gitignore(repositories) },
    { path: 'repos/README.md', content: reposReadme(repositories) },
  ];

  if (config.includeVerificationProcess) {
    files.push({ path: 'process/verification.md', content: verificationProcess(repositories) });
  }

  if (config.includeReleaseProcess) {
    files.push({ path: 'process/release.md', content: releaseProcess(repositories) });
  }

  if (config.includeLode) {
    files.push({ path: 'lode/SCHEMA.md', content: lodeSchema(repositories) });
    for (const repository of repositories) {
      files.push({ path: `lode/${repository.name}/overview.md`, content: lodeOverview(repository) });
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function createHarnessZip(files: HarnessFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map((file) => {
    const name = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    return { name, data, crc: crc32(data), offset: 0 };
  });

  const localSize = entries.reduce((total, entry) => total + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = entries.reduce((total, entry) => total + 46 + entry.name.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let cursor = 0;

  for (const entry of entries) {
    entry.offset = cursor;
    write32(view, cursor, 0x04034b50);
    write16(view, cursor + 4, 20);
    write16(view, cursor + 6, 0x0800);
    write16(view, cursor + 8, 0);
    write16(view, cursor + 10, 0);
    write16(view, cursor + 12, 0x0021);
    write32(view, cursor + 14, entry.crc);
    write32(view, cursor + 18, entry.data.length);
    write32(view, cursor + 22, entry.data.length);
    write16(view, cursor + 26, entry.name.length);
    write16(view, cursor + 28, 0);
    output.set(entry.name, cursor + 30);
    output.set(entry.data, cursor + 30 + entry.name.length);
    cursor += 30 + entry.name.length + entry.data.length;
  }

  const centralOffset = cursor;
  for (const entry of entries) {
    write32(view, cursor, 0x02014b50);
    write16(view, cursor + 4, 20);
    write16(view, cursor + 6, 20);
    write16(view, cursor + 8, 0x0800);
    write16(view, cursor + 10, 0);
    write16(view, cursor + 12, 0);
    write16(view, cursor + 14, 0x0021);
    write32(view, cursor + 16, entry.crc);
    write32(view, cursor + 20, entry.data.length);
    write32(view, cursor + 24, entry.data.length);
    write16(view, cursor + 28, entry.name.length);
    write16(view, cursor + 30, 0);
    write16(view, cursor + 32, 0);
    write16(view, cursor + 34, 0);
    write16(view, cursor + 36, 0);
    write32(view, cursor + 38, 0);
    write32(view, cursor + 42, entry.offset);
    output.set(entry.name, cursor + 46);
    cursor += 46 + entry.name.length;
  }

  write32(view, cursor, 0x06054b50);
  write16(view, cursor + 4, 0);
  write16(view, cursor + 6, 0);
  write16(view, cursor + 8, entries.length);
  write16(view, cursor + 10, entries.length);
  write32(view, cursor + 12, cursor - centralOffset);
  write32(view, cursor + 16, centralOffset);
  write16(view, cursor + 20, 0);

  return output;
}

function readme(name: string, description: string, repositories: HarnessRepository[]) {
  return `# ${name}\n\n${description}\n\n## Start here\n\n1. Move this harness directory beside or above your repositories.\n2. Put each independent repository at the path listed in \`ECOSYSTEM.md\`.\n3. Open the harness root in your coding agent.\n4. Ask the agent to read \`AGENTS.md\` before making changes.\n\nThe harness coordinates repositories. It does not combine their Git histories.\n\n## Repositories\n\n${repositoryTable(repositories)}\n`;
}

function agentsFile(name: string, repositories: HarnessRepository[], agents: string[], config: HarnessConfig) {
  const verificationStep = 3 + Number(config.includeLode) + Number(config.upstreamFirst);

  return `# Agent instructions for ${name}\n\n## Start here\n\nBefore changing code:\n\n1. Read \`ECOSYSTEM.md\`.\n${config.includeLode ? '2. Read `lode/SCHEMA.md`, then the owning repository\'s `lode/<repo>/overview.md`.\n3.' : '2.'} Identify which repository owns the change.\n${config.upstreamFirst ? `${config.includeLode ? '4' : '3'}. Prefer an upstream fix over a downstream workaround.\n` : ''}${config.includeVerificationProcess ? `${verificationStep}. Follow \`process/verification.md\` before reporting completion.\n` : ''}\n## Repository routing\n\n${repositories.map((repository) => `- \`${repository.name}\` at \`${repository.path}\`: ${repository.role || 'Define this repository\'s ownership.'}`).join('\n')}\n\n## Working rules\n\n- Treat each child repository as independent.\n- Check its Git status before editing.\n- Do not hide an upstream defect with a product-only patch.\n- Keep changes scoped to the repository that owns the behavior.\n- Report verification honestly. A plausible result is not a verified result.\n- Do not push, release, deploy or merge unless the user asks.\n\n## Expected agents\n\n${agents.length ? agents.map((agent) => `- ${agent}`).join('\n') : '- Any coding agent that can read repository instructions.'}\n`;
}

function ecosystemFile(name: string, description: string, repositories: HarnessRepository[], config: HarnessConfig) {
  return `# ${name} ecosystem\n\n${description}\n\n## Core model\n\nThis directory is a coordination layer around independent repositories. Humans and agents reason about the system here, then make changes inside the repository that owns the behavior.\n\n${config.upstreamFirst ? '## Upstream-first rule\n\nWhen a shared capability causes a downstream symptom, fix the highest valid shared owner first. Update consumers only after the upstream behavior is proven.\n\n' : ''}## Repository map\n\n${repositoryTable(repositories)}\n\n## Dependency direction\n\nDocument the direction explicitly. A common shape is:\n\n\`shared foundation -> reusable platform -> product\`\n\nAvoid circular ownership. If two repositories repeatedly need coordinated edits, clarify their contract here.\n\n## Change sequence\n\n1. Describe the behavior at ecosystem level.\n2. Identify the owning repository.\n3. Check whether the symptom is caused upstream.\n4. Implement in dependency order.\n5. Verify the owner and affected consumers.\n${config.includeReleaseProcess ? '6. Follow `process/release.md` when the user asks to ship.\n' : ''}`;
}

function verificationProcess(repositories: HarnessRepository[]) {
  return `# Verification process\n\n## Before editing\n\n- Confirm the owning repository from \`ECOSYSTEM.md\`.\n- Check its branch and working tree.\n- Read repository-local instructions and scripts.\n\n## After editing\n\n1. Run the smallest focused check that proves the changed behavior.\n2. Run the repository's normal static checks.\n3. Inspect the final diff.\n4. If shared behavior changed, verify at least one affected consumer.\n5. State exactly which checks passed, failed or were not run.\n\n## Repository checklist\n\n${repositories.map((repository) => `- [ ] \`${repository.name}\`: define its canonical test, typecheck and build commands.`).join('\n')}\n`;
}

function releaseProcess(repositories: HarnessRepository[]) {
  return `# Release process\n\nUse this only when the user explicitly asks to ship, release, push, merge or deploy.\n\n1. Confirm every intended repository is clean apart from the release changes.\n2. Release shared dependencies before consumers.\n3. Use each repository's existing release automation. Do not reproduce release mechanics manually.\n4. Verify the published artifact or deployment, not only the command exit code.\n5. Update and verify consumers against the published version.\n6. Record exact versions, commits and remaining blockers.\n\n## Dependency order\n\nSet the real order for your system:\n\n${repositories.map((repository, index) => `${index + 1}. \`${repository.name}\``).join('\n')}\n`;
}

function lodeSchema(repositories: HarnessRepository[]) {
  return `---\ntype: meta\ntitle: Lode schema\ndescription: Durable repository knowledge and active plans for this harness.\n---\n\n# Lode schema\n\nThe lode is source-controlled technical memory. It is not chat history or a changelog.\n\n## Layout\n\n\`\`\`text\nlode/\n  SCHEMA.md\n${repositories.map((repository) => `  ${repository.name}/\n    overview.md\n    ideas/\n    plans/`).join('\n')}\n\`\`\`\n\n## Rules\n\n- \`overview.md\` contains durable architecture, contracts and gotchas.\n- \`ideas/*.md\` contains exploration without task lists.\n- \`plans/*.md\` contains executor-ready work with done criteria.\n- Delete completed plans and fold durable lessons into the overview.\n- Git history is the changelog.\n`;
}

function lodeOverview(repository: HarnessRepository) {
  return `---\ntype: overview\ntitle: ${repository.name} overview\ndescription: Durable operating context for ${repository.name}.\n---\n\n# ${repository.name}\n\n## What this is\n\n${repository.role || 'Describe this repository.'}\n\n## Key architectural decisions\n\n- Add the decisions an agent must preserve.\n\n## What lives here\n\n- Add the main surfaces and entry points.\n\n## Constraints and gotchas\n\n- Add known boundaries, release rules and recurring pitfalls.\n`;
}

function reposReadme(repositories: HarnessRepository[]) {
  return `# Repositories\n\nPlace independent Git repositories at these paths:\n\n${repositories.map((repository) => `- \`${repository.path}\` - ${repository.role || repository.name}`).join('\n')}\n\nThe harness should ignore their contents. Each child keeps its own remote, branches and release lifecycle.\n`;
}

function gitignore(repositories: HarnessRepository[]) {
  const roots = new Set(repositories.map((repository) => repository.path.split('/')[0]).filter(Boolean));
  return `${[...roots].map((root) => `/${root}/*\n!/${root}/README.md`).join('\n')}\n/lode/tmp/\n`;
}

function repositoryTable(repositories: HarnessRepository[]) {
  if (!repositories.length) return '_Add repositories in `harness.json`._';
  return `| Repository | Path | Owns |\n| --- | --- | --- |\n${repositories.map((repository) => `| \`${repository.name}\` | \`${repository.path}\` | ${repository.role || 'Not defined'} |`).join('\n')}`;
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function slug(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalisePath(value: string) {
  return value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

function write16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
