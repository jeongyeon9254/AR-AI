import { useEffect, useState } from 'react'
import { useProjectStore, type Project, type KanbanTodo, type KanbanStatus } from '../../stores/useProjectStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSessionStore, AGENT_TYPES } from '../../stores/useSessionStore'

export function HomeView(): JSX.Element {
  const { projects, loadProjects, createProject, deleteProject, loadProjectTodos, projectTodos, updateTodoKanban, deleteTodo } = useProjectStore()
  const { setViewMode } = useUIStore()
  const { initProject, selectAgent, loadingAgents, agentSessions, openGlobalReportManager, openGlobalPolicyManager } = useSessionStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProjects()
  }, [])

  const handleCreate = async (): Promise<void> => {
    if (!newName.trim()) return
    setCreating(true)
    const project = await createProject(newName.trim())
    await initProject(project.id)
    setNewName('')
    setShowCreate(false)
    setCreating(false)
    // 채팅 페이지로 이동 (기본 에이전트: fe-developer)
    await selectAgent('fe-developer', project.id)
    setViewMode('chat')
  }

  const handleOpenChat = async (project: Project, agentType: string): Promise<void> => {
    await initProject(project.id)
    await selectAgent(agentType, project.id)
    setViewMode('chat')
  }

  const handleToggleProject = async (projectId: string): Promise<void> => {
    const next = new Set(expandedProjects)
    if (next.has(projectId)) {
      next.delete(projectId)
    } else {
      next.add(projectId)
      await loadProjectTodos(projectId)
    }
    setExpandedProjects(next)
  }

  const handleDeleteProject = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirm('그룹을 삭제하시겠습니까? 모든 채팅 기록이 삭제됩니다.')) return
    await deleteProject(id)
    setExpandedProjects((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* 상단 헤더 */}
      <header
        className="flex items-center justify-between px-7 py-5 flex-shrink-0"
      >
        <h1
          className="text-sm font-semibold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Alpha Review Agent
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => { await openGlobalReportManager(); setViewMode('chat') }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-color)', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            title="Google Chat 리포트 트래킹 - 프로젝트와 무관하게 전체 리포트 관리"
          >
            <span style={{ fontSize: '13px' }}>📋</span>
            <span>리포트 매니저</span>
          </button>
          <button
            onClick={async () => { await openGlobalPolicyManager(); setViewMode('chat') }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-color)', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            title="정책·이슈 Q&A - 정책 문서, 채팅 트러블슈팅, 코드베이스를 함께 참고하여 답변"
          >
            <span style={{ fontSize: '13px' }}>🧭</span>
            <span>폴리시 매니저</span>
          </button>
          <button
            onClick={() => setViewMode('settings')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-color)', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M10.5 6.5a4 4 0 01-.2.9l1.2.9-1 1.7-1.4-.5a4 4 0 01-.8.5l-.2 1.5h-2l-.2-1.5a4 4 0 01-.8-.5l-1.4.5-1-1.7 1.2-.9a4 4 0 010-1.8L2.7 4.5l1-1.7 1.4.5a4 4 0 01.8-.5L6.1 1.3h2l.2 1.5a4 4 0 01.8.5l1.4-.5 1 1.7-1.2.9a4 4 0 01.2.9z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>설정</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 0 0 rgba(167,139,250,0)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)'
              e.currentTarget.style.boxShadow = '0 0 16px rgba(167,139,250,0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)'
              e.currentTarget.style.boxShadow = '0 0 0 0 rgba(167,139,250,0)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span>그룹 추가</span>
          </button>
        </div>
      </header>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-7 py-6">
        {projects.length === 0 ? (
          <EmptyState onAdd={() => setShowCreate(true)} />
        ) : (
          <div className="max-w-5xl mx-auto" style={{ borderTop: '1px solid var(--border-color)' }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedProjects.has(project.id)}
                todos={projectTodos[project.id] || []}
                loadingAgents={loadingAgents}
                agentSessions={agentSessions}
                onToggle={() => handleToggleProject(project.id)}
                onDelete={(e) => handleDeleteProject(project.id, e)}
                onOpenChat={(agentType) => handleOpenChat(project, agentType)}
                onUpdateTodoKanban={(todoId, status) => updateTodoKanban(todoId, project.id, status)}
                onDeleteTodo={(todoId) => deleteTodo(todoId, project.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 프로젝트 생성 모달 */}
      {showCreate && (
        <CreateProjectModal
          value={newName}
          onChange={setNewName}
          onSubmit={handleCreate}
          onClose={() => { setShowCreate(false); setNewName('') }}
          creating={creating}
        />
      )}
    </main>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-8">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid rgba(167,139,250,0.2)'
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M4 6a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M4 16a2 2 0 012-2h7a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6z" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6"/>
            <path d="M19 16a2 2 0 012-2h1a2 2 0 012 2v6a2 2 0 01-2 2h-1a2 2 0 01-2-2v-6z" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4"/>
          </svg>
        </div>
        <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          아직 그룹이 없습니다
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          새 그룹을 만들어 AI 에이전트와<br />협업을 시작하세요
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 0 0 rgba(167,139,250,0)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent-hover)'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(167,139,250,0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--accent)'
          e.currentTarget.style.boxShadow = '0 0 0 0 rgba(167,139,250,0)'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span>그룹 추가하기</span>
      </button>
    </div>
  )
}

function CreateProjectModal({ value, onChange, onSubmit, onClose, creating }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onClose: () => void
  creating: boolean
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl p-7 w-[420px] shadow-2xl"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
        }}
      >
        <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>새 그룹</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit() } if (e.key === 'Escape') onClose() }}
          placeholder="그룹 이름을 입력하세요"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-5"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            transition: 'border-color 0.15s'
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-color)', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border-color)'
            }}
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={!value.trim() || creating}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            {creating ? '생성 중...' : '만들기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 프로젝트 카드 + 칸반보드 ──────────────────────────────────────

const KANBAN_COLUMNS: { status: KanbanStatus; label: string; color: string }[] = [
  { status: '대기',   label: '대기',   color: '#6b7280' },
  { status: '진행중', label: '진행중', color: '#60a5fa' },
  { status: '검토중', label: '검토중', color: '#fbbf24' },
  { status: '완료',   label: '완료',   color: '#34d399' }
]

const KANBAN_AGENTS = AGENT_TYPES.filter((a) => ['fe-developer', 'be-developer', 'qa-expert', 'po', 'issue-collector'].includes(a.id))

function ProjectCard({ project, expanded, todos, loadingAgents, agentSessions, onToggle, onDelete, onOpenChat, onUpdateTodoKanban, onDeleteTodo }: {
  project: Project
  expanded: boolean
  todos: KanbanTodo[]
  loadingAgents: Record<string, boolean>
  agentSessions: Record<string, string>
  onToggle: () => void
  onDelete: (e: React.MouseEvent) => void
  onOpenChat: (agentType: string) => void
  onUpdateTodoKanban: (todoId: string, status: KanbanStatus) => void
  onDeleteTodo: (todoId: string) => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="overflow-hidden"
      style={{ borderBottom: '1px solid var(--border-color)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 프로젝트 헤더 */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer"
        onClick={onToggle}
      >
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className="flex-shrink-0"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)',
            transition: 'transform 0.2s ease'
          }}
        >
          <path d="M4 2.5L9.5 7L4 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span
          className="font-semibold flex-1 truncate"
          style={{ color: 'var(--text-primary)', fontSize: '15px' }}
        >
          {project.name}
        </span>
        <div className="flex items-center gap-1.5">
          {KANBAN_AGENTS.map((agent) => {
            const sessionId = agentSessions[`${project.id}:${agent.id}`]
            const isActive = sessionId ? !!loadingAgents[sessionId] : false
            return (
              <button
                key={agent.id}
                onClick={(e) => { e.stopPropagation(); onOpenChat(agent.id) }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all relative"
                style={{
                  background: isActive ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: isActive ? '1px solid rgba(167,139,250,0.5)' : '1px solid var(--border-color)',
                  boxShadow: isActive ? '0 0 8px rgba(167,139,250,0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-dim)'
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive ? 'var(--accent-dim)' : 'var(--bg-secondary)'
                  e.currentTarget.style.borderColor = isActive ? 'rgba(167,139,250,0.5)' : 'var(--border-color)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title={`${agent.label}${isActive ? ' (작업 중)' : ''}`}
              >
                <span style={{ fontSize: '13px' }}>{agent.icon}</span>
                {isActive && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                    style={{ background: 'var(--accent)', boxShadow: '0 0 4px var(--accent)' }}
                  />
                )}
              </button>
            )
          })}
          <button
            onClick={onDelete}
            className="ml-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid rgba(248,113,113,0.2)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(248,113,113,0.1)'
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'
            }}
          >
            삭제
          </button>
        </div>
      </div>

      {/* 칸반보드 */}
      {expanded && (
        <div className="overflow-x-auto" style={{ borderTop: '1px solid var(--border-color)' }}>
          <KanbanBoard todos={todos} onUpdateStatus={onUpdateTodoKanban} onOpenChat={onOpenChat} onDeleteTodo={onDeleteTodo} />
        </div>
      )}
    </div>
  )
}

function KanbanBoard({ todos, onUpdateStatus, onOpenChat, onDeleteTodo }: {
  todos: KanbanTodo[]
  onUpdateStatus: (todoId: string, status: KanbanStatus) => void
  onOpenChat: (agentType: string) => void
  onDeleteTodo: (todoId: string) => void
}): JSX.Element {
  return (
    <div className="p-5">
      <div className="grid" style={{ gridTemplateColumns: `128px repeat(${KANBAN_COLUMNS.length}, 1fr)`, gap: '8px', minWidth: '700px' }}>
        {/* 헤더 row */}
        <div />
        {KANBAN_COLUMNS.map((col) => {
          const count = todos.filter((t) => t.kanbanStatus === col.status).length
          return (
            <div
              key={col.status}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{col.label}</span>
              {count > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
                >
                  {count}
                </span>
              )}
            </div>
          )
        })}

        {/* 에이전트 rows */}
        {KANBAN_AGENTS.map((agent) => {
          const agentTodos = todos.filter((t) => t.agentType === agent.id)
          return (
            <>
              <button
                key={`label-${agent.id}`}
                onClick={() => onOpenChat(agent.id)}
                className="flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-left transition-all"
                style={{ color: 'var(--text-secondary)', background: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                <span className="text-sm">{agent.icon}</span>
                <span className="text-xs font-medium truncate">{agent.label}</span>
              </button>

              {KANBAN_COLUMNS.map((col) => {
                const colTodos = agentTodos.filter((t) => t.kanbanStatus === col.status)
                return (
                  <div
                    key={`${agent.id}-${col.status}`}
                    className="rounded-xl p-2 min-h-[64px]"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const todoId = e.dataTransfer.getData('todoId')
                      if (todoId) onUpdateStatus(todoId, col.status)
                    }}
                  >
                    {colTodos.map((todo) => (
                      <KanbanCard key={todo.id} todo={todo} onDelete={() => onDeleteTodo(todo.id)} />
                    ))}
                  </div>
                )
              })}
            </>
          )
        })}
      </div>
    </div>
  )
}

function KanbanCard({ todo, onDelete }: { todo: KanbanTodo; onDelete: () => void }): JSX.Element {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData('todoId', todo.id)}
        onClick={() => setShowModal(true)}
        className="rounded-lg px-3 py-2 mb-1.5 text-xs cursor-pointer transition-all"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          lineHeight: '1.5'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-color)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        <p className="line-clamp-2">{todo.content}</p>
      </div>
      {showModal && (
        <TodoDetailModal
          todo={todo}
          onClose={() => setShowModal(false)}
          onDelete={() => { onDelete(); setShowModal(false) }}
        />
      )}
    </>
  )
}

function TodoDetailModal({ todo, onClose, onDelete }: {
  todo: KanbanTodo
  onClose: () => void
  onDelete: () => void
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-[480px] flex flex-col shadow-2xl"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '70vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-3 flex-shrink-0">
          <h3
            className="text-sm font-semibold leading-relaxed flex-1 pr-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {todo.content}
          </h3>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 메타 */}
        <div className="flex items-center gap-2 mb-4 flex-shrink-0">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
          >
            {todo.kanbanStatus}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {todo.agentType}
          </span>
        </div>

        {/* 본문 */}
        {todo.body ? (
          <div
            className="overflow-y-auto rounded-xl p-3 mb-4 text-xs leading-relaxed"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              minHeight: '80px',
              maxHeight: '300px',
              flexShrink: 1,
              overflowY: 'auto'
            }}
          >
            {todo.body}
          </div>
        ) : (
          <div className="flex items-center justify-center mb-4 py-6 flex-shrink-0">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>상세 내용 없음</span>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex justify-end flex-shrink-0">
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid rgba(248,113,113,0.2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)' }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
