import browserCollections from 'fumadocs-mdx:collections/browser';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import {
  mdxComponents,
  CopyCommandButton,
  DocsLayout,
  FeedbackSidebarItem,
  type PageLoaderData,
  type SidebarSection,
} from '@olwiba/docs';
import { getFeedbackConfig, submitFeedback } from '~/lib/feedback-server';

export { serverLoader } from '~/lib/docs-loader';

/**
 * No sandbox registry and no component previews.
 *
 * The other sites document components, which have to be rendered to be
 * understood. These pages document command-line tools, where the runnable
 * artifact is a terminal and the useful thing on the page is a copyable
 * command. The interactive tools live on their own routes under /tools.
 */
export const sidebarSections: SidebarSection[] = [
  { name: 'Get Started', href: '/docs' },
  { name: 'Tools', href: '/docs/tools' },
];

export function getDocsSlugsFromPath(pathname: string) {
  const docsPrefix = '/docs';
  if (pathname === docsPrefix || pathname === `${docsPrefix}/`) return [''];

  if (!pathname.startsWith(`${docsPrefix}/`)) return [''];

  const rest = pathname.slice(docsPrefix.length + 1);
  return rest ? rest.split('/').filter(Boolean) : [''];
}

export const clientLoader = browserCollections.docs.createClientLoader({
  component({ default: MDX }) {
    return (
      <div className="w-full flex-1">
        <MDX
          components={{
            ...defaultMdxComponents,
            ...mdxComponents,
            CopyCommandButton,
          }}
        />
      </div>
    );
  },
});

function DocsContent({ path }: { path: string }) {
  return <>{clientLoader.useContent(path, undefined)}</>;
}

export function DocsPage({ loaderData }: { loaderData: PageLoaderData }) {
  const data = useFumadocsLoader(loaderData);

  return (
    <DocsLayout
      loaderData={loaderData}
      pageTree={data.pageTree as any}
      sections={sidebarSections}
      sidebarBottomSlot={
        <FeedbackSidebarItem
          getConfig={() => getFeedbackConfig()}
          submit={(payload) => submitFeedback({ data: payload })}
        />
      }
    >
      <DocsContent path={data.path} />
    </DocsLayout>
  );
}
