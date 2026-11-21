import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Textarea,
} from '@olwiba/cn';
import { Download, FileCode2, FolderTree, Plus, Trash2 } from 'lucide-react';
import {
  createHarnessZip,
  defaultHarnessConfig,
  generateHarnessFiles,
  type HarnessConfig,
} from '../../../src/harness-builder';

export const Route = createFileRoute('/tools/harness-builder')({
  component: HarnessBuilder,
});

const agentOptions = ['Claude Code', 'Codex', 'Cursor', 'Windsurf'];

function HarnessBuilder() {
  const [config, setConfig] = React.useState<HarnessConfig>(defaultHarnessConfig);
  const files = React.useMemo(() => generateHarnessFiles(config), [config]);
  const [selectedPath, setSelectedPath] = React.useState('AGENTS.md');
  const selectedFile = files.find((file) => file.path === selectedPath) ?? files[0];

  const update = <Key extends keyof HarnessConfig>(key: Key, value: HarnessConfig[Key]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const updateRepository = (index: number, key: 'name' | 'path' | 'role', value: string) => {
    update(
      'repositories',
      config.repositories.map((repository, repositoryIndex) =>
        repositoryIndex === index ? { ...repository, [key]: value } : repository,
      ),
    );
  };

  const addRepository = () => {
    update('repositories', [
      ...config.repositories,
      { name: `repo-${config.repositories.length + 1}`, path: `repos/repo-${config.repositories.length + 1}`, role: '' },
    ]);
  };

  const removeRepository = (index: number) => {
    if (config.repositories.length === 1) return;
    update('repositories', config.repositories.filter((_, repositoryIndex) => repositoryIndex !== index));
  };

  const toggleAgent = (agent: string, checked: boolean) => {
    update('agents', checked ? [...config.agents, agent] : config.agents.filter((item) => item !== agent));
  };

  const download = () => {
    const zip = createHarnessZip(files);
    const bytes = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${toSlug(config.name) || 'repository-harness'}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-3xl">
        <Badge variant="secondary">Nexus pattern</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Build your repository harness</h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Generate the coordination layer around your repositories: ownership, agent instructions,
          durable context and common processes. Your repositories keep their own Git histories.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Name the system</CardTitle>
              <CardDescription>This is the control layer, not an application or package.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="harness-name">Harness name</Label>
                <Input
                  id="harness-name"
                  value={config.name}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="My Nexus"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="harness-description">Purpose</Label>
                <Textarea
                  id="harness-description"
                  value={config.description}
                  onChange={(event) => update('description', event.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>2. Map the repositories</CardTitle>
                <CardDescription>State what each independent repository owns.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addRepository}>
                <Plus className="size-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.repositories.map((repository, index) => (
                <div key={index} className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`repo-name-${index}`}>Name</Label>
                    <Input
                      id={`repo-name-${index}`}
                      value={repository.name}
                      onChange={(event) => updateRepository(index, 'name', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`repo-path-${index}`}>Path</Label>
                    <Input
                      id={`repo-path-${index}`}
                      value={repository.path}
                      onChange={(event) => updateRepository(index, 'path', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`repo-role-${index}`}>Owns</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`repo-role-${index}`}
                        value={repository.role}
                        onChange={(event) => updateRepository(index, 'role', event.target.value)}
                        placeholder="Shared infrastructure, product code, deployment..."
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${repository.name}`}
                        disabled={config.repositories.length === 1}
                        onClick={() => removeRepository(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Choose the operating rules</CardTitle>
              <CardDescription>These become readable Markdown, not hidden framework behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Option
                id="upstream-first"
                checked={config.upstreamFirst}
                onCheckedChange={(checked) => update('upstreamFirst', checked)}
                title="Upstream-first ownership"
                description="Shared defects are fixed at the highest valid owner before consumers are patched."
              />
              <Option
                id="include-lode"
                checked={config.includeLode}
                onCheckedChange={(checked) => update('includeLode', checked)}
                title="Durable agent context"
                description="Adds a lightweight Lode structure for overviews, ideas and active plans."
              />
              <Option
                id="include-verification"
                checked={config.includeVerificationProcess}
                onCheckedChange={(checked) => update('includeVerificationProcess', checked)}
                title="Shared verification process"
                description="Adds a common contract for focused checks and consumer validation."
              />
              <Option
                id="include-release"
                checked={config.includeReleaseProcess}
                onCheckedChange={(checked) => update('includeReleaseProcess', checked)}
                title="Shared release process"
                description="Adds dependency-order release guidance without replacing repository automation."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Name the coding agents</CardTitle>
              <CardDescription>The instructions remain portable across tools.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {agentOptions.map((agent) => (
                <label key={agent} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox
                    checked={config.agents.includes(agent)}
                    onCheckedChange={(checked) => toggleAgent(agent, checked === true)}
                  />
                  {agent}
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FolderTree className="size-5 text-primary" /> Your harness
                  </CardTitle>
                  <CardDescription>{files.length} generated files, built in this browser.</CardDescription>
                </div>
                <Button onClick={download} disabled={!config.repositories.some((repository) => repository.name.trim())}>
                  <Download className="size-4" /> Download ZIP
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid min-h-[540px] grid-cols-[150px_minmax(0,1fr)] sm:grid-cols-[190px_minmax(0,1fr)]">
                <div className="border-r bg-muted/15 p-2">
                  {files.map((file) => (
                    <button
                      type="button"
                      key={file.path}
                      onClick={() => setSelectedPath(file.path)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[11px] transition-colors ${
                        selectedFile?.path === file.path ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <FileCode2 className="size-3 shrink-0" />
                      <span className="truncate">{file.path}</span>
                    </button>
                  ))}
                </div>
                <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-relaxed text-muted-foreground">
                  {selectedFile?.content}
                </pre>
              </div>
            </CardContent>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            The ZIP is generated locally. Nothing is uploaded. Read the{' '}
            <a href="/docs/harness-builder" className="underline underline-offset-4">pattern guide</a>{' '}
            before installing it.
          </p>
        </div>
      </div>
    </main>
  );
}

function Option({
  id,
  checked,
  onCheckedChange,
  title,
  description,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5" />
      <div>
        <Label htmlFor={id} className="cursor-pointer">{title}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
