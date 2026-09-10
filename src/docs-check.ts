/**
 * Checks that every documentation page showing a component also documents it.
 *
 * A docs page that renders a preview is making a promise: this is a component
 * you can use. The properties table is the other half of that promise, and it
 * is the half that goes missing, because a page reads as finished long before
 * anyone writes the props down. Fourteen marketing pages and an `ErrorPage`
 * page that said in prose "takes no props" — it has seven — shipped that way
 * and nobody noticed until someone opened one on a phone.
 *
 * So the rule is mechanical: a preview implies an `<APIReference>`. Pages that
 * genuinely have no public surface to document opt out in the file, in a
 * comment that has to carry a reason.
 */

/** Marks a page as having nothing to document, and says why. */
const OPT_OUT = /api-reference:\s*none\b/;

/** What counts as showing a component off. */
const PREVIEW = /<(Sandbox|ComponentPreview)\b/;

const API_REFERENCE = /<APIReference\b/;

export type DocsFinding =
  | { kind: 'missing'; file: string }
  /** Opted out without saying why, which is how an opt-out becomes a habit. */
  | { kind: 'unexplained-opt-out'; file: string }
  /** Opted out and then documented it anyway — the comment is stale. */
  | { kind: 'redundant-opt-out'; file: string }
  /** The props array is not valid JavaScript, so the page cannot render. */
  | { kind: 'broken-props'; file: string; reason: string };

export interface DocsCheckResult {
  findings: DocsFinding[];
  /** Pages with a preview and a reference. Counted, not listed. */
  okCount: number;
  /** Pages with a preview and an explained opt-out. */
  exemptCount: number;
  /** Pages with no preview, which this says nothing about. */
  skippedCount: number;
}

export interface DocsPage {
  /** Path as it should be reported — repository-relative, forward slashes. */
  file: string;
  source: string;
}

/**
 * An opt-out needs a reason after the marker, on the same line or the ones
 * following it inside the same comment. `api-reference: none` on its own is
 * rejected: the point of the escape hatch is that using it is a decision
 * somebody wrote down.
 */
function optOutIsExplained(source: string): boolean {
  const match = source.match(/api-reference:\s*none\b([\s\S]{0,400})/);
  if (!match) return false;

  const tail = match[1] ?? '';
  // Stop at the end of the comment the marker sits in, so prose further down
  // the page cannot pass for a justification.
  const end = tail.indexOf('*/');
  const within = end === -1 ? tail : tail.slice(0, end);

  // Strip the punctuation an author uses to introduce the reason, plus the
  // comment gutter, and see whether any words are left.
  const words = within
    .replace(/^[\s—\-–:,.]+/, '')
    .replace(/^\s*\*/gm, '')
    .trim();

  return words.split(/\s+/).filter(Boolean).length >= 3;
}

/**
 * Every balanced `{...}` following a `props=` attribute.
 *
 * Matched by counting braces rather than by regex: the prop tables contain
 * object literals, so the first `}` is nowhere near the end of the attribute.
 */
function extractPropsExpressions(source: string): string[] {
  const found: string[] = [];
  const marker = 'props=';
  let index = source.indexOf(marker);

  while (index !== -1) {
    let cursor = index + marker.length;
    if (source[cursor] !== '{') {
      index = source.indexOf(marker, cursor);
      continue;
    }

    let depth = 0;
    const start = cursor;
    for (; cursor < source.length; cursor += 1) {
      if (source[cursor] === '{') depth += 1;
      else if (source[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    found.push(source.slice(start + 1, cursor));
    index = source.indexOf(marker, cursor);
  }

  return found;
}

/**
 * Confirms the prop table is JavaScript that runs.
 *
 * MDX does not evaluate a page's expressions until something renders it, so a
 * mis-escaped quote inside a description is invisible to every build step and
 * only shows up as a blank page. Evaluating the array here is the cheapest way
 * to find that out — the source being run is the repository's own.
 */
function propsFailure(source: string): string | null {
  for (const expression of extractPropsExpressions(source)) {
    let value: unknown;
    try {
      value = new Function(`return (${expression});`)();
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }

    if (!Array.isArray(value)) return 'props is not an array';

    for (const entry of value as Array<Record<string, unknown>>) {
      if (typeof entry?.name !== 'string' || typeof entry?.type !== 'string') {
        return `a prop entry is missing name or type: ${JSON.stringify(entry)}`;
      }
    }
  }

  return null;
}

export function checkDocs(pages: DocsPage[]): DocsCheckResult {
  const findings: DocsFinding[] = [];
  let okCount = 0;
  let exemptCount = 0;
  let skippedCount = 0;

  for (const page of pages) {
    const hasPreview = PREVIEW.test(page.source);
    const hasReference = API_REFERENCE.test(page.source);
    const optedOut = OPT_OUT.test(page.source);

    // Checked before anything else: a page whose table cannot run has a worse
    // problem than a page that has no table.
    const broken = hasReference ? propsFailure(page.source) : null;
    if (broken) {
      findings.push({ kind: 'broken-props', file: page.file, reason: broken });
      continue;
    }

    if (optedOut && hasReference) {
      findings.push({ kind: 'redundant-opt-out', file: page.file });
      continue;
    }

    if (!hasPreview) {
      // Index pages, guides, concept pages. Nothing is being shown off, so
      // there is nothing this can reasonably demand.
      skippedCount += 1;
      continue;
    }

    if (optedOut) {
      if (optOutIsExplained(page.source)) exemptCount += 1;
      else findings.push({ kind: 'unexplained-opt-out', file: page.file });
      continue;
    }

    if (hasReference) okCount += 1;
    else findings.push({ kind: 'missing', file: page.file });
  }

  return { findings, okCount, exemptCount, skippedCount };
}

export function formatDocsReport(result: DocsCheckResult): string {
  const lines: string[] = [];

  for (const finding of result.findings) {
    if (finding.kind === 'missing') {
      lines.push(
        `  ${finding.file}`,
        '    Shows a preview but has no <APIReference>. Add one, or opt out with',
        '    {/* api-reference: none — why */} if there is no public API here.',
      );
    } else if (finding.kind === 'broken-props') {
      lines.push(
        `  ${finding.file}`,
        `    Its <APIReference> props are not valid JavaScript, so the page will not render.`,
        `    ${finding.reason}`,
      );
    } else if (finding.kind === 'unexplained-opt-out') {
      lines.push(
        `  ${finding.file}`,
        '    Opts out of the API reference without a reason. Write one after the marker.',
      );
    } else {
      lines.push(
        `  ${finding.file}`,
        '    Opts out of the API reference and then has one. Remove the stale marker.',
      );
    }
  }

  const tally =
    `${result.okCount} documented, ${result.exemptCount} exempt, ` +
    `${result.skippedCount} without a preview`;

  if (result.findings.length === 0) {
    return `All documentation pages that show a component document it (${tally}).`;
  }

  return (
    `${result.findings.length} documentation page(s) need attention:\n` +
    `${lines.join('\n')}\n\n${tally}`
  );
}
