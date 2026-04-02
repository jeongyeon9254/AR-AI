import { contextBridge, ipcRenderer } from 'electron'

export interface ConsensusStageEvent {
  sessionId: string
  stage: 1 | 2 | 3
  status: 'running' | 'done' | 'error'
  stageName: string
  model: string
}

export interface ElectronAPI {
  createSession: (agentType: string) => Promise<any>
  listSessions: () => Promise<any[]>
  getSession: (id: string) => Promise<any>
  deleteSession: (id: string) => Promise<boolean>
  sendMessage: (sessionId: string, message: string, attachments?: Array<{ name: string; data: string; mediaType: string }>) => Promise<any>
  abortMessage: (sessionId: string) => Promise<any>
  onStreamChunk: (callback: (chunk: any) => void) => () => void
  onAuthStatus: (callback: (status: any) => void) => () => void
  onConsensusStage: (callback: (event: ConsensusStageEvent) => void) => () => void
  onAgentDone: (callback: (data: { sessionId: string }) => void) => () => void
  isAgentRunning: (sessionId: string) => Promise<boolean>
  getStorageInfo: () => Promise<{ dbSizeBytes: number; dbSizeMB: string }>
  clearMessages: (sessionId: string) => Promise<{ deleted: number }>
  pruneMessages: (sessionId: string, keepCount: number) => Promise<{ deleted: number }>
  createTodo: (agentType: string, content: string, projectId?: string, body?: string) => Promise<any>
  listTodos: (agentType: string) => Promise<any[]>
  listAllTodos: () => Promise<any[]>
  updateTodo: (id: string, updates: { content?: string; body?: string; done?: boolean; kanbanStatus?: string }) => Promise<any>
  deleteTodo: (id: string) => Promise<boolean>
  onTodoUpdated: (callback: (data: { agentType: string }) => void) => () => void
  onSprintChanged: (callback: (data: { fileName: string }) => void) => () => void
  listSprintDocs: () => Promise<{ name: string; path: string }[]>
  readSprintDoc: (fileName: string) => Promise<{ success: boolean; content?: string; fileName?: string; error?: string }>
  writeSprintDoc: (fileName: string, content: string) => Promise<{ success: boolean; error?: string }>
  deleteSprintDoc: (fileName: string) => Promise<{ success: boolean; error?: string }>
  getSettings: () => Promise<any>
  updateSettings: (settings: any) => Promise<any>
  validateWorkspace: () => Promise<{ rootExists: boolean; coreFrontExists: boolean; alphaReviewExists: boolean; sprintExists: boolean; missing: string[] }>
  generateReport: (options: { spaceName: string; startDate?: string; endDate?: string }) => Promise<any>
  googleAuthStatus: () => Promise<{ authenticated: boolean; email?: string; tokenPath: string }>
  googleLogin: () => Promise<{ success: boolean; email?: string; error?: string }>
  googleLogout: () => Promise<{ success: boolean }>
  figmaAuthStatus: () => Promise<{ authenticated: boolean; email?: string }>
  figmaLogin: () => Promise<{ success: boolean; email?: string; error?: string }>
  figmaLogout: () => Promise<{ success: boolean }>
  // Project management
  createProject: (name: string) => Promise<{ project: any; sessions: any[] }>
  listProjects: () => Promise<any[]>
  deleteProject: (id: string) => Promise<boolean>
  getProjectSessions: (projectId: string) => Promise<any[]>
  getProjectTodos: (projectId: string) => Promise<any[]>
}

const api: ElectronAPI = {
  createSession: (agentType: string) => ipcRenderer.invoke('session:create', agentType),
  listSessions: () => ipcRenderer.invoke('session:list'),
  getSession: (id: string) => ipcRenderer.invoke('session:get', id),
  deleteSession: (id: string) => ipcRenderer.invoke('session:delete', id),
  sendMessage: (sessionId: string, message: string, attachments?: Array<{ name: string; data: string; mediaType: string }>) =>
    ipcRenderer.invoke('chat:send', sessionId, message, attachments),
  abortMessage: (sessionId: string) => ipcRenderer.invoke('chat:abort', sessionId),
  onStreamChunk: (callback: (chunk: any) => void) => {
    const handler = (_event: any, chunk: any): void => callback(chunk)
    ipcRenderer.on('chat:stream-chunk', handler)
    return () => {
      ipcRenderer.removeListener('chat:stream-chunk', handler)
    }
  },
  onAuthStatus: (callback: (status: any) => void) => {
    const handler = (_event: any, status: any): void => callback(status)
    ipcRenderer.on('chat:auth-status', handler)
    return () => {
      ipcRenderer.removeListener('chat:auth-status', handler)
    }
  },
  onConsensusStage: (callback: (event: ConsensusStageEvent) => void) => {
    const handler = (_event: any, data: ConsensusStageEvent): void => callback(data)
    ipcRenderer.on('chat:consensus-stage', handler)
    return () => { ipcRenderer.removeListener('chat:consensus-stage', handler) }
  },
  onAgentDone: (callback: (data: { sessionId: string }) => void) => {
    const handler = (_event: any, data: { sessionId: string }): void => callback(data)
    ipcRenderer.on('chat:agent-done', handler)
    return () => { ipcRenderer.removeListener('chat:agent-done', handler) }
  },
  isAgentRunning: (sessionId: string) => ipcRenderer.invoke('chat:is-running', sessionId),
  getStorageInfo: () => ipcRenderer.invoke('storage:info'),
  clearMessages: (sessionId: string) => ipcRenderer.invoke('storage:clear-messages', sessionId),
  pruneMessages: (sessionId: string, keepCount: number) =>
    ipcRenderer.invoke('storage:prune-messages', sessionId, keepCount),
  createTodo: (agentType: string, content: string, projectId?: string, body?: string) =>
    ipcRenderer.invoke('todo:create', agentType, content, projectId, body),
  listTodos: (agentType: string) => ipcRenderer.invoke('todo:list', agentType),
  listAllTodos: () => ipcRenderer.invoke('todo:list-all'),
  updateTodo: (id: string, updates: { content?: string; body?: string; done?: boolean; kanbanStatus?: string }) =>
    ipcRenderer.invoke('todo:update', id, updates),
  deleteTodo: (id: string) => ipcRenderer.invoke('todo:delete', id),
  onTodoUpdated: (callback: (data: { agentType: string }) => void) => {
    const handler = (_event: any, data: any): void => callback(data)
    ipcRenderer.on('todo:updated', handler)
    return () => { ipcRenderer.removeListener('todo:updated', handler) }
  },
  onSprintChanged: (callback: (data: { fileName: string }) => void) => {
    const handler = (_event: any, data: any): void => callback(data)
    ipcRenderer.on('sprint:changed', handler)
    return () => { ipcRenderer.removeListener('sprint:changed', handler) }
  },
  listSprintDocs: () => ipcRenderer.invoke('sprint:list'),
  readSprintDoc: (fileName: string) => ipcRenderer.invoke('sprint:read', fileName),
  writeSprintDoc: (fileName: string, content: string) => ipcRenderer.invoke('sprint:write', fileName, content),
  deleteSprintDoc: (fileName: string) => ipcRenderer.invoke('sprint:delete', fileName),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  validateWorkspace: () => ipcRenderer.invoke('workspace:validate'),
  generateReport: (options: { spaceName: string; startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke('report:generate', options),
  googleAuthStatus: () => ipcRenderer.invoke('google:auth-status'),
  googleLogin: () => ipcRenderer.invoke('google:login'),
  googleLogout: () => ipcRenderer.invoke('google:logout'),
  figmaAuthStatus: () => ipcRenderer.invoke('figma:auth-status'),
  figmaLogin: () => ipcRenderer.invoke('figma:login'),
  figmaLogout: () => ipcRenderer.invoke('figma:logout'),
  createProject: (name: string) => ipcRenderer.invoke('project:create', name),
  listProjects: () => ipcRenderer.invoke('project:list'),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),
  getProjectSessions: (projectId: string) => ipcRenderer.invoke('project:sessions', projectId),
  getProjectTodos: (projectId: string) => ipcRenderer.invoke('project:todos', projectId)
}

contextBridge.exposeInMainWorld('electronAPI', api)
