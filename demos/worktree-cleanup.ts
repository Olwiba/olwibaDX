import { demoHeader } from "./shared"

demoHeader(
  "worktree cleanup",
  "Illustrative data only — no repositories or worktrees will be changed.",
)

process.stdout.write(String.raw`Repo: atlas-platform
Path: C:\Workspace\atlas-platform
Fetching latest from origin...

Worktrees needing attention (not automatically removed):
  feature/enterprise-billing
    uncommitted changes
    C:\Workspace\worktrees\atlas-enterprise-billing
  fix/auth-callback
    remote branch exists; merge into master not confirmed
    C:\Workspace\worktrees\atlas-auth-callback
  spike/offline-mode
    remote branch deleted; merge into master not confirmed
    C:\Workspace\worktrees\atlas-offline-mode

Worktrees to remove:
  feat/analytics-dashboard - branch merged into master - ~6144 MB
    C:\Workspace\worktrees\atlas-analytics-dashboard
  feat/team-invitations - branch merged into master - ~5376 MB
    C:\Workspace\worktrees\atlas-team-invitations
  refactor/database-layer - branch merged into master - ~4608 MB
    C:\Workspace\worktrees\atlas-database-layer
  docs/api-reference - branch merged into master (remote branch deleted) - ~3584 MB
    C:\Workspace\worktrees\atlas-api-reference
  chore/framework-upgrade - branch merged into master - ~4992 MB
    C:\Workspace\worktrees\atlas-framework-upgrade
  fix/mobile-navigation - branch merged into master (remote branch deleted) - ~3968 MB
    C:\Workspace\worktrees\atlas-mobile-navigation
Total space to reclaim: ~28672 MB

[DRY RUN] No changes made.
Summary: 6 safely removable; 3 needing attention.
`)
