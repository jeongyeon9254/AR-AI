import { useEffect } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { Settings } from './components/Settings'
import { TodoPanel } from './components/TodoPanel'
import { SprintViewer } from './components/SprintViewer'
import { HomeView } from './components/HomeView'
import { useUIStore } from './stores/useUIStore'
import { useSessionStore } from './stores/useSessionStore'

export default function App(): JSX.Element {
  const { viewMode, todoOpen, sprintFile } = useUIStore()
  const addStreamChunk = useSessionStore((s) => s.addStreamChunk)
  const forceStopLoading = useSessionStore((s) => s.forceStopLoading)
  const syncLoadingState = useSessionStore((s) => s.syncLoadingState)

  // 전역 IPC 리스너 — ChatPanel이 unmount되어도 로딩 상태 정상 해제
  useEffect(() => {
    const unsubStream = window.electronAPI.onStreamChunk((chunk) => {
      addStreamChunk(chunk)
    })
    const unsubAgentDone = window.electronAPI.onAgentDone(({ sessionId }) => {
      forceStopLoading(sessionId)
    })
    const handleFocus = (): void => { syncLoadingState() }
    window.addEventListener('focus', handleFocus)
    return () => {
      unsubStream()
      unsubAgentDone()
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
