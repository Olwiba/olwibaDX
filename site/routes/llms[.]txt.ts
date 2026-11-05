import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const [{ docsLlmsResponse }, { source }] = await Promise.all([import('@olwiba/docs/agent'), import('~/lib/source')]);
        return docsLlmsResponse(source, {
          full: false,
          title: 'olwibaDX',
          description:
            'Developer experience tooling for Olwiba and Genesis apps (@olwiba/dx): Vite dev-server plugins such as the dev banner and fake API, and CLI checks such as env-check, docs-check and copy-check. Installed as a devDependency.',
        });
      },
    },
  },
});
