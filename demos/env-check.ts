import { checkEnv, formatEnvReport } from "../src/env-check"
import { demoHeader } from "./shared"

demoHeader(
  "environment check",
  "Dummy key names and values — nothing is read from your environment.",
)

const example = `
DATABASE_URL=file:./dev.db
BETTER_AUTH_SECRET=replace-me
BETTER_AUTH_URL=http://localhost:3000
PRO_CONTENT_GATED=false
UI_PRO_WAITLIST_ENABLED=false
EMAIL_FROM=hello@example.com
EMAIL_PROVIDER=console
NODE_ENV=development
ENABLE_SIGNUPS=false
ENABLE_JOBS=false
REDIS_URL=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
SENTRY_DSN=
`

const actual = `
DATABASE_URL=postgres://demo
BETTER_AUTH_SECRET=demo-secret
BETTER_AUTH_URL=https://app.example.com
VITE_PRO_CONTENT_GATED=true
EMAIL_PROVIDER=
NODE_ENV=production
DATABASE_URL=postgres://replacement
STRIPE_SECRET=demo-stripe-secret
NONSENSE-LINE-NO-EQUALS
`

process.stdout.write(`${formatEnvReport(checkEnv({ example, actual }))}\n`)
