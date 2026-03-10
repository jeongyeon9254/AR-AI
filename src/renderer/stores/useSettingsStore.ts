import { create } from 'zustand'

export interface McpServerConfig {
  command: string
  args: string[]
  enabled: boolean
  /** 자동 생성된 서버 (레포 경로 기반 Serena 등) */
  auto?: boolean
  /** MCP 서버 프로세스에 전달할 환경변수 */
  env?: Record<string, string>
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
