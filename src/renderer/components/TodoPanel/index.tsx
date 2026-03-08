import { useEffect, useState, useRef } from 'react'
import { useTodoStore } from '../../stores/useTodoStore'
import { useSessionStore, AGENT_TYPES } from '../../stores/useSessionStore'
import { useUIStore } from '../../stores/useUIStore'

export function TodoPanel(): JSX.Element {
  const { todos, loadTodos, addTodo, toggleTodo, removeTodo } = useTodoStore()
  const { activeAgentType } = useSessionStore()
  const { toggleTodo: togglePanel } = useUIStore()
  const [newTodo, setNewTodo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const agentLabel = AGENT_TYPES.find((a) => a.id === activeAgentType)?.label || 'All'

  useEffect(() => {
    if (activeAgentType) loadTodos(activeAgentType)
  }, [activeAgentType])

  useEffect(() => {
    const unsub = window.electronAPI.onTodoUpdated((data) => {
      if (data.agentType === activeAgentType) loadTodos(data.agentType)
    })
    return () => unsub()
  }, [activeAgentType])

  const handleAdd = (): void => {
    if (!newTodo.trim() || !activeAgentType) return
    addTodo(activeAgentType, newTodo.trim())
    setNewTodo('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleAdd()
    }
  }

  const pending = todos.filter((t) => !t.done)
  const completed = todos.filter((t) => t.done)

  return (
    <aside className="w-72 flex flex-col h-full" style={{ background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-color)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Todo
        </h2>
        <button
          onClick={togglePanel}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 3L3 11M3 3L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* 에이전트 라벨 */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {agentLabel}
        </span>
      </div>

      {/* 입력 */}
      <div className="px-3 py-2">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="할 일 추가..."
            className="flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          />
          <button
            onClick={handleAdd}
            disabled={!newTodo.trim()}
            className="px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            +
          </button>
        </div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {pending.length === 0 && completed.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
            할 일이 없습니다
          </p>
        )}

        {pending.map((todo) => (
          <TodoItem
            key={todo.id}
            content={todo.content}
            done={false}
            onToggle={() => toggleTodo(todo.id, true)}
            onDelete={() => removeTodo(todo.id)}
          />
        ))}

        {completed.length > 0 && (
          <>
            <p className="text-[11px] mt-3 mb-1 px-1" style={{ color: 'var(--text-muted)' }}>
              완료 ({completed.length})
            </p>
            {completed.map((todo) => (
              <TodoItem
                key={todo.id}
                content={todo.content}
                done={true}
                onToggle={() => toggleTodo(todo.id, false)}
                onDelete={() => removeTodo(todo.id)}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

function TodoItem({ content, done, onToggle, onDelete }: {
  content: string; done: boolean
  onToggle: () => void; onDelete: () => void
}): JSX.Element {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="flex items-start gap-2 px-1.5 py-1.5 rounded-lg group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? 'var(--bg-hover)' : 'transparent' }}
    >
      <button
        onClick={onToggle}
        className="mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          borderColor: done ? 'var(--accent)' : 'var(--text-muted)',
          background: done ? 'var(--accent)' : 'transparent'
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <span
        className="flex-1 text-xs leading-relaxed"
        style={{
          color: done ? 'var(--text-muted)' : 'var(--text-secondary)',
          textDecoration: done ? 'line-through' : 'none'
        }}
      >
        {content}
      </span>
      {hover && (
        <button
          onClick={onDelete}
          className="mt-0.5 w-4 h-4 flex-shrink-0 flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}
