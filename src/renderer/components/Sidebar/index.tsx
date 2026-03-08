import { useEffect, useState, useRef } from 'react'
import { useSessionStore, AGENT_TYPES } from '../../stores/useSessionStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSprintStore } from '../../stores/useSprintStore'

export function Sidebar(): JSX.Element {
  const { activeAgentType, loadingAgents, init, selectAgent } = useSessionStore()
  const { viewMode, setViewMode, sprintFile, openSprintFile, closeSprintFile } = useUIStore()
  const { docs, loadDocs } = useSprintStore()

  useEffect(() => {
    init()
    loadDocs()
    const unsub = window.electronAPI.onSprintChanged(() => {
      loadDocs()
    })
    return () => unsub()
  }, [])

  const handleSelectAgent = (agentId: string): void => {
    setViewMode('chat')
    closeSprintFile()
    selectAgent(agentId)
  }

  const handleSelectSprint = (fileName: string): void => {
    setViewMode('chat')
    openSprintFile(fileName)
  }

  return (
    <aside className="w-64 flex flex-col h-full" style={{ background: 'var(--bg-sidebar)' }}>
      <div className="flex-1 overflow-y-auto px-2 mt-4">
        {/* Sprint 셀렉터 */}
        <p className="text-[11px] font-medium uppercase tracking-wider px-2 mb-2" style={{ color: 'var(--text-muted)' }}>
          Sprint
        </p>
        <div className="px-2 mb-4">
          <SprintSelector
            docs={docs}
            selected={sprintFile}
            onSelect={handleSelectSprint}
            onClear={closeSprintFile}
          />
        </div>

        {/* Agents 섹션 */}
        <p className="text-[11px] font-medium uppercase tracking-wider px-2 mb-2" style={{ color: 'var(--text-muted)' }}>
          Agents
        </p>
        {AGENT_TYPES.map((agent) => {
          const isActive = activeAgentType === agent.id && viewMode === 'chat' && !sprintFile
          const isLoading = loadingAgents.has(agent.id)

          return (
            <button
              key={agent.id}
              onClick={() => handleSelectAgent(agent.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-left transition-colors"
              style={{
                background: isActive ? 'var(--bg-active)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <span className="text-base flex-shrink-0">{agent.icon}</span>
              <span className="flex-1 truncate" style={{ fontSize: '13px' }}>{agent.label}</span>
              {isLoading && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* 하단 설정 */}
      <div className="p-2" style={{ borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setViewMode('settings')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
          style={{
            background: viewMode === 'settings' ? 'var(--bg-active)' : 'transparent',
            color: viewMode === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
          onMouseEnter={(e) => {
            if (viewMode !== 'settings') e.currentTarget.style.background = 'var(--bg-hover)'
          }}
          onMouseLeave={(e) => {
            if (viewMode !== 'settings') e.currentTarget.style.background = 'transparent'
          }}
        >
          <span className="text-base">⚙</span>
          <span className="text-sm">설정</span>
        </button>
      </div>
    </aside>
  )
}

function SprintSelector({ docs, selected, onSelect, onClear }: {
  docs: { name: string }[]
  selected: string | null
  onSelect: (name: string) => void
  onClear: () => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedLabel = selected ? selected.replace(/\.md$/, '') : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors"
        style={{
          background: 'var(--bg-input)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-color)'}`,
          color: selectedLabel ? 'var(--text-primary)' : 'var(--text-muted)'
        }}
      >
        <span className="text-xs flex-shrink-0" style={{ opacity: 0.6 }}>📄</span>
        <span className="flex-1 truncate text-xs">
          {selectedLabel || (docs.length === 0 ? '문서 없음' : '문서 선택...')}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          className="flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && docs.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg z-50"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {selected && (
            <button
              onClick={() => { onClear(); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              선택 해제
            </button>
          )}
          {docs.map((doc) => {
            const label = doc.name.replace(/\.md$/, '')
            const isSelected = doc.name === selected
            return (
              <button
                key={doc.name}
                onClick={() => { onSelect(doc.name); setOpen(false) }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors"
                style={{
                  background: isSelected ? 'var(--bg-active)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ opacity: 0.5 }}>📄</span>
                <span className="truncate">{label}</span>
                {isSelected && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0 ml-auto">
                    <path d="M2 5L4.5 7.5L8 2.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
