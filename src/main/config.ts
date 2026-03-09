import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import { loadBuiltinSkills, scanExternalSkills } from './skills'

export interface McpServerConfig {
  command: string
  args: string[]
  enabled: boolean
  /** 자동 생성된 서버 (레포 경로 기반 Serena 등) — 삭제 불가, 경로 변경 시 자동 갱신 */
  auto?: boolean
}

export interface SkillDefinition {
  name: string
  description: string
  content: string
  enabled: boolean
  /** 스킬 출처: 'builtin' | 'custom' | 'skills.sh:owner/repo' */
  source?: string
}

export interface AppSettings {
  coreFrontPath: string
  alphaReviewPath: string
  writePagePath: string
  widgetScriptPath: string
  sprintPath: string
  googleChatCredentialsPath: string
  googleChatDefaultSpace: string
  mcpServers: Record<string, McpServerConfig>
  agentMcpAssignments: Record<string, string[]>
  skills: SkillDefinition[]
  agentSkillAssignments: Record<string, string[]>
}

export interface WorkspaceStatus {
  coreFrontExists: boolean
  alphaReviewExists: boolean
  writePageExists: boolean
  widgetScriptExists: boolean
  sprintExists: boolean
  missing: string[]
}

const defaultMcpServers: Record<string, McpServerConfig> = {
  'context7': {
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    enabled: true
  },
  'playwright': {
    command: 'npx',
    args: ['-y', '@executeautomation/playwright-mcp-server'],
    enabled: true
  },
  'sequential-thinking': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    enabled: true
  }
}

const defaultAgentMcpAssignments: Record<string, string[]> = {
  'fe-developer': ['context7'],
  'be-developer': ['context7'],
  'issue-collector': [],
  'policy-expert': ['sequential-thinking'],
  'qa-expert': ['playwright', 'context7'],
  'po': ['sequential-thinking']
}

/** 레포 경로 → Serena MCP 서버명 매핑 */
const SERENA_REPO_MAP: { settingsKey: string; serverName: string }[] = [
  { settingsKey: 'coreFrontPath', serverName: 'serena-core-front' },
  { settingsKey: 'alphaReviewPath', serverName: 'serena-alpha-review' },
  { settingsKey: 'writePagePath', serverName: 'serena-write-page' },
  { settingsKey: 'widgetScriptPath', serverName: 'serena-widget-script' }
]

/** Serena 에이전트 기본 할당: 에이전트별로 어떤 Serena 인스턴스를 사용할지 */
const SERENA_AGENT_ASSIGNMENTS: Record<string, string[]> = {
  'fe-developer': ['serena-core-front', 'serena-write-page', 'serena-widget-script'],
  'be-developer': ['serena-alpha-review'],
  'issue-collector': ['serena-core-front', 'serena-alpha-review', 'serena-write-page', 'serena-widget-script'],
  'policy-expert': ['serena-core-front', 'serena-alpha-review', 'serena-write-page', 'serena-widget-script'],
  'qa-expert': ['serena-core-front', 'serena-alpha-review'],
  'po': ['serena-core-front', 'serena-alpha-review', 'serena-write-page', 'serena-widget-script']
}

function buildSerenaServer(projectPath: string): McpServerConfig {
  return {
    command: 'uvx',
    args: [
      '--from', 'git+https://github.com/oraios/serena',
      'serena', 'start-mcp-server',
      '--context', 'claude-code',
      '--project', projectPath
    ],
    enabled: true,
    auto: true
  }
}

/**
 * 설정된 레포 경로를 기반으로 Serena MCP 서버를 자동 생성합니다.
 * 경로가 존재하는 레포에 대해서만 생성합니다.
 */
function buildSerenaMcpServers(settings: Partial<AppSettings>): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {}
  for (const { settingsKey, serverName } of SERENA_REPO_MAP) {
    const path = settings[settingsKey as keyof AppSettings] as string
    if (path && existsSync(path)) {
      servers[serverName] = buildSerenaServer(path)
    }
  }
  return servers
}

/**
 * 존재하는 Serena 서버만 포함하도록 에이전트 할당을 필터링합니다.
 */
function buildSerenaAgentAssignments(availableServers: Record<string, McpServerConfig>): Record<string, string[]> {
  const assignments: Record<string, string[]> = {}
  for (const [agentId, serverNames] of Object.entries(SERENA_AGENT_ASSIGNMENTS)) {
    const available = serverNames.filter((name) => name in availableServers)
    if (available.length > 0) {
      assignments[agentId] = available
    }
  }
  return assignments
}

// 빌트인 스킬은 src/main/skills/*.md 파일에서 런타임 로드
let _defaultSkillsCache: SkillDefinition[] | null = null
function getDefaultSkills(): SkillDefinition[] {
  if (_defaultSkillsCache) return _defaultSkillsCache
  try {
    _defaultSkillsCache = loadBuiltinSkills()
  } catch {
    _defaultSkillsCache = []
  }
  return _defaultSkillsCache
}

function getDefaultSettings(): AppSettings {
  return {
    coreFrontPath: '',
    alphaReviewPath: '',
    writePagePath: '',
    widgetScriptPath: '',
    sprintPath: '',
    googleChatCredentialsPath: '',
    googleChatDefaultSpace: '',
    mcpServers: defaultMcpServers,
    agentMcpAssignments: defaultAgentMcpAssignments,
    skills: getDefaultSkills(),
    agentSkillAssignments: {}
  }
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

// settings 캐시 — readFileSync 반복 방지
let _settingsCache: AppSettings | null = null
let _settingsMtime: number = 0

/** settings 캐시 무효화 (설정 업데이트 시 호출) */
export function invalidateSettingsCache(): void {
  _settingsCache = null
}

export function getSettings(): AppSettings {
  const defaults = getDefaultSettings()
  const settingsPath = getSettingsPath()
  if (!existsSync(settingsPath)) {
    return { ...defaults }
  }

  // 파일 mtime 기반 캐시 — 변경 없으면 파싱 스킵
  try {
    const { statSync } = require('fs')
    const mtime = statSync(settingsPath).mtimeMs
    if (_settingsCache && mtime === _settingsMtime) {
      return _settingsCache
    }
    _settingsMtime = mtime
  } catch { /* stat 실패 시 캐시 무시 */ }

  try {
    const raw = readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw)
    // 스킬 병합: 저장된 스킬 + 새로 추가된 빌트인 스킬 + 외부 스킬 (skills.sh)
    const savedSkills: SkillDefinition[] = parsed.skills || []
    const savedSkillNames = new Set(savedSkills.map((s: SkillDefinition) => s.name))
    const builtinSkills = getDefaultSkills()
    const externalSkills = scanExternalSkills()
    const mergedSkills = [
      ...savedSkills,
      ...builtinSkills.filter((s) => !savedSkillNames.has(s.name)),
      ...externalSkills.filter((s) => !savedSkillNames.has(s.name))
    ]
    // MCP 병합: 기본 + 사용자 저장 (auto 제외) + Serena 자동 생성
    const savedMcpServers = parsed.mcpServers || {}
    // 저장된 설정에서 auto 서버 제거 (매번 재생성하므로)
    const userMcpServers: Record<string, McpServerConfig> = {}
    for (const [name, server] of Object.entries(savedMcpServers)) {
      if (!(server as McpServerConfig).auto) {
        userMcpServers[name] = server as McpServerConfig
      }
    }
    const mergedSettings = { ...defaults, ...parsed }
    const serenaServers = buildSerenaMcpServers(mergedSettings)
    const serenaAssignments = buildSerenaAgentAssignments(serenaServers)

    // 에이전트 MCP 할당 병합: 기본 + Serena 기본 + 사용자 저장
    const mergedAssignments: Record<string, string[]> = {}
    const allAgentIds = new Set([
      ...Object.keys(defaultAgentMcpAssignments),
      ...Object.keys(serenaAssignments),
      ...Object.keys(parsed.agentMcpAssignments || {})
    ])
    for (const agentId of allAgentIds) {
      const base = defaultAgentMcpAssignments[agentId] || []
      const serena = serenaAssignments[agentId] || []
      const saved = (parsed.agentMcpAssignments || {})[agentId]
      if (saved) {
        // 사용자가 저장한 할당 + Serena 자동 할당 (사용자가 제거한 Serena는 유지하지 않음)
        const savedSet = new Set(saved)
        // 사용자 저장에 없는 Serena 서버 중, 새로 추가된 것만 포함
        const newSerena = serena.filter((s: string) => !savedSet.has(s) && !(s in (savedMcpServers as Record<string, unknown>)))
        mergedAssignments[agentId] = [...new Set([...saved, ...newSerena])]
      } else {
        mergedAssignments[agentId] = [...new Set([...base, ...serena])]
      }
    }

    const result = {
      ...defaults,
      ...parsed,
      mcpServers: { ...defaultMcpServers, ...userMcpServers, ...serenaServers },
      agentMcpAssignments: mergedAssignments,
      skills: mergedSkills,
      agentSkillAssignments: parsed.agentSkillAssignments || {}
    }
    _settingsCache = result
    return result
  } catch {
    return { ...defaults }
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...partial }
  writeFileSync(getSettingsPath(), JSON.stringify(updated, null, 2))
  invalidateSettingsCache()
  return updated
}

/** 스킬 파일을 ~/.claude/commands/ 에 동기화 (비동기 — Main Process 블로킹 방지) */
export async function syncSkillFilesAsync(): Promise<void> {
  const settings = getSettings()
  const homeDir = app.getPath('home')
  const commandsDir = join(homeDir, '.claude', 'commands')

  if (!existsSync(commandsDir)) {
    await mkdir(commandsDir, { recursive: true })
  }

  await Promise.all(
    settings.skills
      .filter((skill) => skill.enabled)
      .map((skill) => writeFile(join(commandsDir, `${skill.name}.md`), skill.content, 'utf-8'))
  )
}

/** @deprecated 동기 버전 — 초기화 등 동기 컨텍스트에서만 사용 */
export function syncSkillFiles(): void {
  const settings = getSettings()
  const homeDir = app.getPath('home')
  const commandsDir = join(homeDir, '.claude', 'commands')

  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true })
  }

  for (const skill of settings.skills) {
    if (skill.enabled) {
      const filePath = join(commandsDir, `${skill.name}.md`)
      writeFileSync(filePath, skill.content, 'utf-8')
    }
  }
}

/** 워크스페이스 경로 유효성 검사 */
export function validateWorkspace(): WorkspaceStatus {
  const settings = getSettings()
  const missing: string[] = []

  const coreFrontExists = settings.coreFrontPath ? existsSync(settings.coreFrontPath) : false
  const alphaReviewExists = settings.alphaReviewPath ? existsSync(settings.alphaReviewPath) : false
  const writePageExists = settings.writePagePath ? existsSync(settings.writePagePath) : false
  const widgetScriptExists = settings.widgetScriptPath ? existsSync(settings.widgetScriptPath) : false
  const sprintExists = settings.sprintPath ? existsSync(settings.sprintPath) : false

  if (!settings.coreFrontPath) missing.push('Core-Front 경로가 설정되지 않았습니다')
  else if (!coreFrontExists) missing.push(`Core-Front 경로를 찾을 수 없습니다: ${settings.coreFrontPath}`)

  if (!settings.alphaReviewPath) missing.push('Alpha-Review 경로가 설정되지 않았습니다')
  else if (!alphaReviewExists) missing.push(`Alpha-Review 경로를 찾을 수 없습니다: ${settings.alphaReviewPath}`)

  if (settings.writePagePath && !writePageExists) missing.push(`작성페이지 경로를 찾을 수 없습니다: ${settings.writePagePath}`)

  if (settings.widgetScriptPath && !widgetScriptExists) missing.push(`위젯스크립트 경로를 찾을 수 없습니다: ${settings.widgetScriptPath}`)

  if (!settings.sprintPath) missing.push('Sprint 경로가 설정되지 않았습니다')
  else if (!sprintExists) missing.push(`Sprint 경로를 찾을 수 없습니다: ${settings.sprintPath}`)

  return { coreFrontExists, alphaReviewExists, writePageExists, widgetScriptExists, sprintExists, missing }
}
