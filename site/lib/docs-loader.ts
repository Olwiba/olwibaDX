// Keep the fumadocs server runtime (node:path) out of the client bundle: the
// source module is only reachable through dynamic imports inside
// createServerOnlyFn, so the Start compiler can strip it from the browser
// build. Same pattern as the olwibaCN / olwibaDOCS docs loaders.
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import { extractTextFromReactNode, type PageLoaderData, type TocItem } from '@olwiba/docs';
import type { ReactNode } from 'react';

const loadDocsData = createServerOnlyFn(async (slugs: string[]): Promise<PageLoaderData> => {
  const [{ notFound }, { findNeighbour }, { source }] = await Promise.all([
    import('@tanstack/react-router'),
    import('fumadocs-core/page-tree'),
    import('~/lib/source'),
  ]);

  const page = source.getPage(slugs);
  if (!page) throw notFound();

  const pageTree = source.getPageTree();
  const neighbours = findNeighbour(pageTree, page.url);
  const rawContent = await page.data.getText('raw');

  return {
    path: page.path,
    url: page.url,
    pageTree: await source.serializePageTree(pageTree),
    frontmatter: {
      title: page.data.title,
      description: page.data.description,
    },
    toc: (page.data.toc ?? []).map((item: { title?: ReactNode; url: string; depth: number }) => ({
      title: extractTextFromReactNode(item.title),
      url: item.url,
      depth: item.depth,
    })) as TocItem[],
    rawContent,
    neighbours: {
      previous: neighbours.previous ? { url: neighbours.previous.url, name: extractTextFromReactNode(neighbours.previous.name) } : null,
      next: neighbours.next ? { url: neighbours.next.url, name: extractTextFromReactNode(neighbours.next.name) } : null,
    },
  } satisfies PageLoaderData;
});

export const serverLoader = createServerFn({
  method: 'GET',
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => loadDocsData(slugs));
