import { createFileRoute } from '@tanstack/react-router';
import { DocsPage, clientLoader, getDocsSlugsFromPath, serverLoader } from '~/lib/docs-page';
import type { PageLoaderData } from '@olwiba/docs';

export const Route = createFileRoute('/docs/$')({
  server: {
    handlers: {
      // Markdown for agents (`.md`, `?mode=agent`, `Accept: text/markdown`); everything else renders the page.
      GET: async ({ request, params, next }) => {
        const [{ docsAgentResponse }, { source }] = await Promise.all([import('@olwiba/docs/agent'), import('~/lib/source')]);
        return (await docsAgentResponse(source, request, params._splat)) ?? next();
      },
    },
  },
  component: Page,
  loader: async ({ location }) => {
    const locationSlugs = getDocsSlugsFromPath(location.pathname);
    const slugs = locationSlugs;
    const data = (await serverLoader({ data: slugs })) as PageLoaderData;
    await clientLoader.preload(data.path);
    return data;
  },
});

function Page() {
  const loaderData = Route.useLoaderData() as PageLoaderData;
  return <DocsPage loaderData={loaderData} />;
}
