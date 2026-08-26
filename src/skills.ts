export interface ManifestSkill {
  slug: string
  name: string
  description: string
  category?: string
  providers?: string[]
  examples?: string[]
  tip?: string | null
  contentUrl: string
}

export interface SkillsManifest {
  version: string
  skills: ManifestSkill[]
}

/** Returns true when a manifest slug is a safe, single directory name. */
export function isSafeSkillSlug(slug: string): boolean {
  return slug !== "." && slug !== ".." && /^[A-Za-z0-9._-]+$/.test(slug)
}
