import { ipcMain, BrowserWindow } from 'electron'
import { SessionManager } from './sessions'
import { getSettings, updateSettings, validateWorkspace } from './config'
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, watch, FSWatcher } from 'fs'
import { join, basename } from 'path'
import { runAgent, setAgentSessionManager } from './agents'
import {
  collectIssues, formatIssueReport, formatMessagesForAnalysis,
  startOAuthFlow, getAuthStatus, clearAuth,
  type CollectOptions
} from './tools/google-chat'

let sessionManager: SessionManager
const activeAbortControllers = new Map<string, AbortController>()
let sprintWatcher: FSWatcher | null = null
let sprintWatchPath: string | null = null

function startSprintWatcher(mainWindow: BrowserWindow): void {
  const { sprintPath: sprint } = getSettings()

  // 同じパスなら再起動不要
  if (sprint === sprintWatchPath && sprintWatcher) return

  // 既存watcher停止
  if (sprintWatcher) {
    sprintWatcher.close()
    sprintWatcher = null
    sprintWatchPath = null
  }

  if (!sprint || !existsSync(sprint)) return

  let debounce: NodeJS.Timeout | null = null
  sprintWatcher = watch(sprint, (_eventType, filename) => {
    if (!filename?.endsWith('.md')) return
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      mainWindow.webContents.send('sprint:changed', { fileName: filename })
    }, 200)
  })
  sprintWatchPath = sprint
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  sessionManager = new SessionManager()
  setAgentSessionManager(sessionManager)

  // Sprint 폴더 감시 시작
  startSprintWatcher(mainWindow)

  // Session management
  ipcMain.handle('session:create', (_event, agentType: string) => {
    return sessionManager.create(agentType)
  })

  ipcMain.handle('session:list', () => {
    return sessionManager.list()
  })

  ipcMain.handle('session:get', (_event, id: string) => {
    return sessionManager.get(id)
  })

  ipcMain.handle('session:delete', (_event, id: string) => {
    activeAbortControllers.get(id)?.abort()
    activeAbortControllers.delete(id)
    return sessionManager.delete(id)
  })

  // Chat - Claude Agent SDK 연동
  ipcMain.handle('chat:send', async (_event, sessionId: string, message: string) => {
    try {
      // 세션 정보 조회하여 에이전트 타입 확인
      const sessionData = sessionManager.get(sessionId)
      if (!sessionData) {
        return { success: false, error: 'Session not found' }
      }

      // 사용자 메시지 저장
      sessionManager.addMessage(sessionId, 'user', message)

      // 이전 실행 중지
      activeAbortControllers.get(sessionId)?.abort()

      const abortController = new AbortController()
      activeAbortControllers.set(sessionId, abortController)

      // 에이전트 비동기 실행 (응답을 기다리지 않고 스트리밍)
      runAgent({
        sessionId,
        agentType: sessionData.session.agentType,
        message,
        mainWindow,
        abortSignal: abortController.signal
      })
        .then((assistantContent) => {
          activeAbortControllers.delete(sessionId)
          // 어시스턴트 응답을 SQLite에 저장
          sessionManager.addMessage(sessionId, 'assistant', assistantContent)
          // 세션당 최대 500개 메시지 유지 (자동 정리)
          sessionManager.pruneMessages(sessionId, 500)
        })
        .catch((error) => {
          activeAbortControllers.delete(sessionId)
          const errorMsg = `오류가 발생했습니다: ${error.message || error}`
          sessionManager.addMessage(sessionId, 'assistant', errorMsg)
          mainWindow.webContents.send('chat:stream-chunk', {
            sessionId,
            content: errorMsg,
            done: true
          })
        })

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 실행 중지
  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    const controller = activeAbortControllers.get(sessionId)
    if (controller) {
      controller.abort()
      activeAbortControllers.delete(sessionId)
      return { success: true }
    }
    return { success: false, error: 'No active query' }
  })

  // Settings
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_event, settings: Record<string, unknown>) => {
    const result = updateSettings(settings)
    // 設定変更時にwatcher再起動
    startSprintWatcher(mainWindow)
    return result
  })

  ipcMain.handle('workspace:validate', () => {
    return validateWorkspace()
  })

  // Storage management
  ipcMain.handle('storage:info', () => {
    const dbSize = sessionManager.getDbSize()
    return { dbSizeBytes: dbSize, dbSizeMB: (dbSize / 1024 / 1024).toFixed(2) }
  })

  ipcMain.handle('storage:clear-messages', (_event, sessionId: string) => {
    const deleted = sessionManager.clearMessages(sessionId)
    sessionManager.vacuum()
    return { deleted }
  })

  ipcMain.handle('storage:prune-messages', (_event, sessionId: string, keepCount: number) => {
    const deleted = sessionManager.pruneMessages(sessionId, keepCount)
    if (deleted > 0) sessionManager.vacuum()
    return { deleted }
  })

  // Todo management
  ipcMain.handle('todo:create', (_event, agentType: string, content: string) => {
    return sessionManager.createTodo(agentType, content)
  })

  ipcMain.handle('todo:list', (_event, agentType: string) => {
    return sessionManager.listTodos(agentType)
  })

  ipcMain.handle('todo:list-all', () => {
    return sessionManager.listAllTodos()
  })

  ipcMain.handle('todo:update', (_event, id: string, updates: { content?: string; done?: boolean }) => {
    return sessionManager.updateTodo(id, updates)
  })

  ipcMain.handle('todo:delete', (_event, id: string) => {
    return sessionManager.deleteTodo(id)
  })

  // Sprint 문서 관리
  ipcMain.handle('sprint:list', () => {
    const { sprintPath: sprint } = getSettings()
    if (!sprint || !existsSync(sprint)) return []
    try {
      return readdirSync(sprint)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => ({ name: f, path: join(sprint, f) }))
    } catch {
      return []
    }
  })

  ipcMain.handle('sprint:read', (_event, fileName: string) => {
    const { sprintPath: sprint } = getSettings()
    if (!sprint) return { success: false, error: 'Sprint 경로 미설정' }
    const filePath = join(sprint, basename(fileName))
    try {
      const content = readFileSync(filePath, 'utf-8')
      return { success: true, content, fileName: basename(fileName) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('sprint:write', (_event, fileName: string, content: string) => {
    const { sprintPath: sprint } = getSettings()
    if (!sprint) return { success: false, error: 'Sprint 경로 미설정' }
    const filePath = join(sprint, basename(fileName))
    try {
      writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('sprint:delete', (_event, fileName: string) => {
    const { sprintPath: sprint } = getSettings()
    if (!sprint) return { success: false, error: 'Sprint 경로 미설정' }
    const filePath = join(sprint, basename(fileName))
    try {
      unlinkSync(filePath)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // Google Chat 리포트 생성
  ipcMain.handle('report:generate', async (_event, options: CollectOptions) => {
    try {
      const report = await collectIssues(options)
      return {
        success: true,
        report: formatIssueReport(report),
        analysisContext: formatMessagesForAnalysis(report.rawMessages),
        raw: report
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // Google OAuth2 인증
  ipcMain.handle('google:auth-status', () => {
    return getAuthStatus()
  })

  ipcMain.handle('google:login', async () => {
    return startOAuthFlow()
  })

  ipcMain.handle('google:logout', () => {
    clearAuth()
    return { success: true }
  })
}
