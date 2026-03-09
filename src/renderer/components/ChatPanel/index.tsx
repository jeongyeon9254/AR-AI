import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { useSessionStore, AGENT_TYPES } from '../../stores/useSessionStore'
import type { ChatMessage } from '../../stores/useSessionStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.slice(m.indexOf('\n') + 1, m.lastIndexOf('```')).trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSameDay(date, today)) return '오늘'
  if (isSameDay(date, yesterday)) return '어제'

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[date.getDay()]

  if (year === today.getFullYear()) return `${month}월 ${day}일 (${weekday})`
  return `${year}년 ${month}월 ${day}일 (${weekday})`
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10)
}

function DateDivider({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
      <span className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
    </div>
  )
}

const MessageItem = memo(function MessageItem({ msg, agentIcon, showDate }: {
  msg: ChatMessage
  agentIcon?: string
  showDate: boolean
}): JSX.Element {
  return (
    <div>
      {showDate && <DateDivider label={formatDateLabel(msg.createdAt)} />}
      <div className={msg.role === 'user' ? 'flex justify-end' : ''}>
        {msg.role === 'assistant' && (
          <div className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {agentIcon}
            </div>
            <div className="text-sm leading-relaxed pt-1 whitespace-pre-wrap min-w-0"
              style={{ color: 'var(--text-primary)' }}>
              {stripMarkdown(msg.content)}
            </div>
          </div>
        )}
        {msg.role === 'user' && (
          <div className="inline-block px-4 py-2.5 rounded-2xl text-sm max-w-[80%]"
            style={{ background: 'var(--bg-user-msg)', color: 'var(--text-primary)' }}>
            {msg.content}
          </div>
        )}
      </div>
    </div>
  )
})

export function ChatPanel(): JSX.Element {
  const [input, setInput] = useState('')
  const [authStatus, setAuthStatus] = useState<{ isAuthenticating: boolean; message: string } | null>(null)
  const activeAgentType = useSessionStore((s) => s.activeAgentType)
  const messages = useSessionStore((s) => s.messages)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const abortAgent = useSessionStore((s) => s.abortAgent)
  const addStreamChunk = useSessionStore((s) => s.addStreamChunk)
  // 현재 에이전트의 로딩 상태만 구독 (boolean 값)
  const isLoading = useSessionStore((s) =>
    s.activeAgentType ? !!s.loadingAgents[s.activeAgentType] : false
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { toggleTodo, todoOpen } = useUIStore()
  const { workspaceStatus, validateWorkspace } = useSettingsStore()
  const agentInfo = AGENT_TYPES.find((a) => a.id === activeAgentType)

  useEffect(() => {
    validateWorkspace()
  }, [])

  useEffect(() => {
    const unsubStream = window.electronAPI.onStreamChunk((chunk) => {
      addStreamChunk(chunk)
    })
    const unsubAuth = window.electronAPI.onAuthStatus((status) => {
      setAuthStatus(status)
      if (!status.isAuthenticating) {
        setTimeout(() => setAuthStatus(null), 3000)
      }
    })
    return () => {
      unsubStream()
      unsubAuth()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages, activeAgentType])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [activeAgentType])

  const handleSend = (): void => {
    if (!input.trim() || !activeAgentType) return
    const msg = input
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInput(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  // 에이전트 미선택 상태
  if (!activeAgentType) {
    return (
      <main className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          <p className="text-3xl mb-3" style={{ color: 'var(--text-secondary)' }}>AR-AI</p>
          <p className="text-sm">좌측에서 에이전트를 선택하여 대화를 시작하세요</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {agentInfo?.icon} {agentInfo?.label}
        </span>
        <button
          onClick={toggleTodo}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: todoOpen ? 'var(--accent)' : 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Todo"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="2" y="10" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
            <line x1="8.5" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <line x1="8.5" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* 워크스페이스 경고 배너 */}
      {workspaceStatus && workspaceStatus.missing.length > 0 && (
        <div className="px-4 py-2 text-xs"
          style={{ background: '#451a03', color: '#fcd34d', borderBottom: '1px solid #78350f' }}>
          {workspaceStatus.missing[0]}
          {workspaceStatus.missing.length > 1 && ` 외 ${workspaceStatus.missing.length - 1}건`}
          {' — '}
          <span style={{ textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => useUIStore.getState().setViewMode('settings')}>
            설정에서 확인
          </span>
        </div>
      )}

      {/* 인증 배너 */}
      {authStatus && authStatus.isAuthenticating && (
        <div className="px-4 py-2 text-sm text-center"
          style={{ background: '#4a3800', color: '#fbbf24', borderBottom: '1px solid #78650d' }}>
          브라우저에서 Claude 로그인을 진행해주세요...
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-lg mb-1" style={{ color: 'var(--text-secondary)' }}>
                {agentInfo?.icon} {agentInfo?.label}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                무엇을 도와드릴까요?
              </p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const prevMsg = messages[idx - 1]
            const showDate = !prevMsg || getDateKey(msg.createdAt) !== getDateKey(prevMsg.createdAt)
            return (
              <MessageItem
                key={msg.id}
                msg={msg}
                agentIcon={agentInfo?.icon}
                showDate={showDate}
              />
            )
          })}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {agentInfo?.icon}
              </div>
              <div className="flex gap-1 items-center pt-2">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--text-muted)', animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--text-muted)', animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--text-muted)', animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`${agentInfo?.label}에게 메시지 보내기...`}
              rows={1}
              className="w-full px-4 py-3 pr-12 text-sm resize-none focus:outline-none"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                maxHeight: '200px'
              }}
            />
            {isLoading ? (
              <button
                onClick={abortAgent}
                className="absolute right-2 bottom-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: '#dc2626', color: '#fff' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-2 bottom-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ background: input.trim() ? 'var(--accent)' : 'transparent', color: '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 14V2M8 2L3 7M8 2L13 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
          <p className="text-center mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            AR-AI는 실수할 수 있습니다. 중요한 정보는 직접 확인하세요.
          </p>
        </div>
      </div>
    </main>
  )
}
