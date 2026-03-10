import { create } from 'zustand'

/** stdio 기반 MCP 서버 (로컬 프로세스) */
export interface McpStdioServerConfig {
  type?: 'stdio'
  command: string
  args: string[]
  enabled: boolean
  auto?: boolean
  env?: Record<string, string>
}

/** HTTP 기반 MCP 서버 (원격 URL) */
export interface McpHttpServerConfig {
  type: 'http'
  url: string
  headers?: Record<string, string>
  enabled: boolean
  auto?: boolean
}

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig

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
  figmaAccessToken: string
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

interface SettingsState {
  settings: AppSettings
  workspaceStatus: WorkspaceStatus | null
  isLoaded: boolean
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  validateWorkspace: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    coreFrontPath: '',
    alphaReviewPath: '',
    writePagePath: '',
    widgetScriptPath: '',
    sprintPath: '',
    googleChatCredentialsPath: '',
    googleChatDefaultSpace: '',
    figmaAccessToken: '',
    mcpServers: {},
    agentMcpAssignments: {},
    skills: [],
    agentSkillAssignments: {}
  },
  workspaceStatus: null,
  isLoaded: false,

  loadSettings: async () => {
    const settings = await window.electronAPI.getSettings()
    set({ settings, isLoaded: true })
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const updated = await window.electronAPI.updateSettings(partial)
    set({ settings: updated })
  },

  validateWorkspace: async () => {
    const status = await window.electronAPI.validateWorkspace()
    set({ workspaceStatus: status })
  }
}))
