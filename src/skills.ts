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
