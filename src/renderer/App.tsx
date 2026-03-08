import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { Settings } from './components/Settings'
import { TodoPanel } from './components/TodoPanel'
import { SprintViewer } from './components/SprintViewer'
import { useUIStore } from './stores/useUIStore'

export default function App(): JSX.Element {
  const { viewMode, todoOpen, sprintFile } = useUIStore()

  const renderMain = (): JSX.Element => {
    if (viewMode === 'settings') return <Settings />
    if (sprintFile) return <SprintViewer />
    return <ChatPanel />
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      {renderMain()}
      {todoOpen && viewMode === 'chat' && !sprintFile && <TodoPanel />}
    </div>
  )
}
