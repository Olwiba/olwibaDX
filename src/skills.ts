export type Skill = {
  name: string
  source: string | null
  description: string
}

export type SkillsManifest = {
  version: string
  skills: Skill[]
}
