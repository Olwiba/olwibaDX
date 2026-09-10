# Deploying the docs site

The site at `dx.olwiba.com` is built from this repository by the `Dockerfile` at the root.
It is a static documentation site with an interactive tool page: no database, no
authentication, no email, no outbound calls.

That is the short version of why this is the easiest deployment in the stack. There is
nothing to configure.

## Before you start

Nothing. No secrets to mint, no tokens to scope, no environment variables to set.

`.env.example` has one key, `OPS_WEBHOOK_RELEASES`, and it is for the release script rather
than the site. The container reads no environment except `PORT`, which Coolify sets.

## Coolify

1. **New Resource → Application → Public Repository**
   Repository: `https://github.com/Olwiba/olwibaDX`
   Branch: `master`

2. **Build Pack: Dockerfile**
   Dockerfile location: `/Dockerfile`
   Base directory: `/`

   Leave the build command empty. The Dockerfile runs `bun run web:build` itself.

3. **Port**
   Ports Exposed: `3000`

   `server.ts` reads `PORT` and falls back to 3000. Coolify sets it, so this matches
   whatever it picks.

4. **Domain**
   `https://dx.olwiba.com`

   Set this before the first deploy. Coolify provisions the certificate from this field,
   and changing it later means re-issuing.

5. **Environment variables**
   None. Leave the section empty.

   If you are copying settings from the olwibaUI-Pro app, do not bring its variables over —
   that app has a database and an auth secret, and this one has neither.

6. **Deploy.**

   First build pulls the bun image and installs ~90 packages; expect a few minutes. Later
   builds reuse the `deps` layer unless `package.json` or `bun.lock` changed.

## DNS

One record, at Cloudflare:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| `A` | `dx` | *your Coolify host IP* | Proxied |

No redirect list and no bulk redirect rule. `uip.olwiba.com → ui.olwiba.com` needed those
because a domain moved; nothing is moving here, `dx.olwiba.com` is new.

## Checking it worked

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://dx.olwiba.com/
curl -sS -o /dev/null -w '%{http_code}\n' https://dx.olwiba.com/docs
curl -sS -o /dev/null -w '%{http_code}\n' https://dx.olwiba.com/tools/env-check
curl -sS -o /dev/null -w '%{http_code}\n' https://dx.olwiba.com/og-image.png
```

Four `200`s. The last one matters on its own: the OG image is referenced by absolute URL in
`site/routes/__root.tsx`, so a link preview is the one thing that breaks silently if the
domain is wrong.

## What is in the image

The runner stage copies `dist`, `content`, `server.ts`, `node_modules` and `package.json`.
That set has been checked by running the built server with exactly those paths present:
`/docs` needs `content/`, and nothing needs the generated `.source/`, which is why it is
gitignored and not copied.

The client bundle is ~12MB. The two 11MB README wordmark GIFs used to live in `public/` and
were being served with it; they are in `.github/assets/` now. If you add anything large to
`public/`, it goes into the image and out over the wire — that directory is the website's
static root, not a place to park files.

## The tool page

`/tools/env-check` accepts a pasted environment, which is a file full of live credentials.
It compares in the browser: no loader, no server function, no form element, and the built
chunks contain no `fetch`, no `XMLHttpRequest` and no `sendBeacon`.

Two things follow from that, and both are worth keeping true:

- **Do not add analytics or error monitoring to this site** without excluding that route.
  A breadcrumb recorder that captures input values would defeat the whole point, and it
  would do it quietly.
- **Do not put the route behind anything that inspects request bodies.** There is no
  request. Keep it that way.

## Regenerating things

The bundled `.env.example` presets are baked into the bundle at build time, so adding or
renaming a variable in any repository needs:

```bash
bun run presets:generate
```

Commit the result. It reads the sibling repositories under `repos/`, so it only works from
a full checkout of the workspace, and it warns rather than silently dropping a preset when
one is missing.

Icons and the OG card come from this repository's own generator:

```bash
bun src/cli.ts generate-assets --name olwibaDX --icon terminal --color "#f97316"
```

Note that it also writes a `manifest.json` that nothing links: `DocsRootFavicon.rel` in
`@olwiba/docs` is typed `'icon' | 'apple-touch-icon'`, so the site cannot reference a
manifest. Harmless, but the file is dead weight until that type is widened.
