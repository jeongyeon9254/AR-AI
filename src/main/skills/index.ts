import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { app } from 'electron'
import type { SkillDefinition } from '../config'

/** skills/*.md 파일에서 스킬 정의를 로드 */
export function loadBuiltinSkills(): SkillDefinition[] {
  // 가능한 경로들 (dev / production)
  const candidates = [
    join(__dirname, '../../src/main/skills'),        // dev: out/main -> src/main/skills
    join(app.getAppPath(), 'src/main/skills'),        // dev fallback
    join(app.getAppPath(), 'skills'),                  // production: asar 내부
    join(process.resourcesPath || '', 'skills')        // production: resources/skills
  ]

  for (const dir of candidates) {
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
      if (files.length === 0) continue
      return files.map((f) => parseSkillFile(join(dir, f), 'builtin'))
    } catch {
      continue
    }
  }
  return []
}

/**
 * 글로벌(~/.agents/skills/)에서 skills.sh로 설치된 외부 스킬을 스캔합니다.
 * skills-lock.json에서 출처 정보(owner/repo)를 읽어옵니다.
 */
export function scanExternalSkills(): SkillDefinition[] {
  const homeDir = app.getPath('home')

  // 글로벌 스킬 경로: ~/.agents/skills/
  const globalSkillsDir = join(homeDir, '.agents', 'skills')
  const globalLockPath = join(homeDir, 'skills-lock.json')

  const sourceMap = loadSkillsLock([globalLockPath])

  try {
    if (!existsSync(globalSkillsDir)) return []
    const entries = readdirSync(globalSkillsDir, { withFileTypes: true })
    const skills: SkillDefinition[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillMdPath = join(globalSkillsDir, entry.name, 'SKILL.md')
      if (!existsSync(skillMdPath)) continue

      const skill = parseSkillFile(skillMdPath, `skills.sh:${sourceMap[entry.name] || entry.name}`)
      // SKILL.md의 frontmatter name이 있으면 그것을 사용, 없으면 폴더명
      if (!skill.name || skill.name === 'SKILL') {
        skill.name = entry.name
      }
      skills.push(skill)
    }

    return skills
  } catch {
    return []
  }
}

/** skills-lock.json에서 스킬명 → source(owner/repo) 매핑 로드 */
function loadSkillsLock(candidates: string[]): Record<string, string> {
  for (const lockPath of candidates) {
    try {
      if (!existsSync(lockPath)) continue
      const raw = readFileSync(lockPath, 'utf-8')
      const lock = JSON.parse(raw)
      const map: Record<string, string> = {}
      if (lock.skills) {
        for (const [name, info] of Object.entries(lock.skills)) {
          map[name] = (info as any).source || name
        }
      }
      return map
    } catch {
      continue
    }
  }
  return {}
}

function parseSkillFile(filePath: string, source: string): SkillDefinition {
  const raw = readFileSync(filePath, 'utf-8')
  const name = basename(filePath, '.md')

  let description = ''
  let content = raw
  let parsedName = ''

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (fmMatch) {
    const frontmatter = fmMatch[1]
    content = fmMatch[2].trim()
    const descMatch = frontmatter.match(/description:\s*(.+)/)
    if (descMatch) description = descMatch[1].trim()
    const nameMatch = frontmatter.match(/name:\s*(.+)/)
    if (nameMatch) parsedName = nameMatch[1].trim()
  }

  return { name: parsedName || name, description, content, enabled: true, source }
}
