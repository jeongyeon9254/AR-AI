import { useEffect, useRef } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { Settings } from './components/Settings'
import { TodoPanel } from './components/TodoPanel'
import { SprintViewer } from './components/SprintViewer'
import { HomeView } from './components/HomeView'
import { useUIStore } from './stores/useUIStore'
import { useSessionStore } from './stores/useSessionStore'
import { useProjectStore } from './stores/useProjectStore'

export default function App(): JSX.Element {
  const { viewMode, todoOpen, sprintFile } = useUIStore()
  const addStreamChunk = useSessionStore((s) => s.addStreamChunk)
  const forceStopLoading = useSessionStore((s) => s.forceStopLoading)
  const syncLoadingState = useSessionStore((s) => s.syncLoadingState)
  const agentSessionsRef = useRef(useSessionStore.getState().agentSessions)
  const loadProjectTodos = useProjectStore((s) => s.loadProjectTodos)
  const loadProjectTodosRef = useRef(loadProjectTodos)
  loadProjectTodosRef.current = loadProjectTodos

  useEffect(() => {
    // agentSessions 최신 상태를 ref로 추적
    return useSessionStore.subscribe((state) => {
      agentSessionsRef.current = state.agentSessions
    })
  }, [])

  // 전역 IPC 리스너 — ChatPanel이 unmount되어도 로딩 상태 정상 해제
  useEffect(() => {
    const unsubStream = window.electronAPI.onStreamChunk((chunk) => {
      addStreamChunk(chunk)
    })
    const unsubAgentDone = window.electronAPI.onAgentDone(({ sessionId }) => {
      forceStopLoading(sessionId)
    })
    // todo가 추가/변경되면 해당 projectId의 칸반보드 자동 갱신
    const unsubTodo = window.electronAPI.onTodoUpdated(({ agentType }) => {
      const sessions = agentSessionsRef.current
      const projectIds = new Set<string>()
      for (const key of Object.keys(sessions)) {
        if (key.endsWith(`:${agentType}`)) {
          const projectId = key.slice(0, key.lastIndexOf(':'))
          if (projectId) projectIds.add(projectId)
        }
      }
      projectIds.forEach((id) => loadProjectTodosRef.current(id))
    })
    const handleFocus = (): void => { syncLoadingState() }
    window.addEventListener('focus', handleFocus)
    return () => {
      unsubStream()
      unsubAgentDone()
      unsubTodo()
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  if (viewMode === 'home') {
    return <HomeView />
  }

  if (viewMode === 'settings') {
    return (
      <div className="flex h-screen">
        <Settings />
      </div>
    )
  }

  // chat view
  return (
    <div className="flex h-screen">
      {sprintFile ? <SprintViewer /> : <ChatPanel />}
      {todoOpen && !sprintFile && <TodoPanel />}
    </div>
  )
}
