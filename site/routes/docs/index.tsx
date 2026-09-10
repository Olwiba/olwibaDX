import { createFileRoute } from '@tanstack/react-router';
import { DocsPage, clientLoader, serverLoader } from '~/lib/docs-page';
import type { PageLoaderData } from '@olwiba/docs';

export const Route = createFileRoute('/docs/')({
  component: Page,
  loader: async () => {
    const slugs = [''];
    const data = (await serverLoader({ data: slugs })) as PageLoaderData;
    await clientLoader.preload(data.path);
    return data;
  },
});

function Page() {
  const loaderData = Route.useLoaderData() as PageLoaderData;
  return <DocsPage loaderData={loaderData} />;
}
