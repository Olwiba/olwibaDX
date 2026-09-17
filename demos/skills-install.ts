import { demoHeader } from "./shared"

demoHeader(
  "skills installer",
  "Illustrative manifest and selections — no network requests or files are created.",
)

process.stdout.write(`Fetching manifest from https://olwiba.com/skills/manifest.json

Available skills (4):

   1. release-train — Publish a package and update its downstream consumers
   2. lode-record — Record durable repository knowledge in the lode
   3. preview-capture — Regenerate documentation previews after a component change
   4. env-drift — Compare a deployment environment against its example

Enter skill numbers (e.g. 1,3,5), 'all', or blank to cancel: 1,3,4

  ✓ release-train
  ✓ preview-capture
  ✓ env-drift

3 installed, 0 failed
Location: .claude/skills/
`)
