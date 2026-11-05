import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import rehypePrettyCode from 'rehype-pretty-code';
import { docsMarkdownOptions } from '@olwiba/docs/agent';

export const docs = defineDocs({
  dir: 'content/docs',
  // Compiles each page's Markdown twin in, for /docs/*.md and /llms.txt.
  docs: { postprocess: { includeProcessedMarkdown: docsMarkdownOptions } },
});

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) => {
      plugins.shift();
      plugins.push([
        rehypePrettyCode,
        {
          theme: {
            dark: 'github-dark',
            light: 'github-light-default',
          },
        },
      ]);
      return plugins;
    },
  },
});
