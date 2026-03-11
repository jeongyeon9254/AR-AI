import { useState, useEffect, useRef, useCallback, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSessionStore, AGENT_TYPES } from '../../stores/useSessionStore'
import type { ChatMessage, FileAttachmentInfo } from '../../stores/useSessionStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'

interface PendingFile {
  name: string
  data: string // base64
  mediaType: string
  previewUrl?: string // 이미지 미리보기용 data URL
}

const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv', 'text/plain', 'text/markdown'
]

const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.xlsx,.xls,.csv,.txt,.md'

function getFileIcon(mediaType: string): string {
  if (mediaType.startsWith('image/')) return '🖼'
  if (mediaType === 'application/pdf') return '📄'
  if (mediaType.includes('spreadsheet') || mediaType.includes('excel') || mediaType === 'text/csv') return '📊'
  return '📎'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // data:image/png;base64,xxxx → xxxx
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
            <div className="chat-markdown text-sm leading-relaxed pt-1 min-w-0"
              style={{ color: 'var(--text-primary)' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.open(href, '_blank') }} style={{ color: 'var(--accent)', cursor: 'pointer' }}>
                      {children}
                    </a>
                  )
                }}
              >{msg.content}</ReactMarkdown>
            </div>
          </div>
        )}
        {msg.role === 'user' && (
          <div className="inline-block px-4 py-2.5 rounded-2xl text-sm max-w-[80%]"
            style={{ background: 'var(--bg-user-msg)', color: 'var(--text-primary)' }}>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {msg.attachments.map((att, i) =>
                  att.data && att.mediaType.startsWith('image/') ? (
                    <img key={i} src={`data:${att.mediaType};base64,${att.data}`}
                      alt={att.name}
                      className="max-w-[200px] max-h-[150px] rounded-lg object-cover" />
                  ) : (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                      style={{ background: 'rgba(255,255,255,0.1)' }}>
                      {getFileIcon(att.mediaType)} {att.name}
                    </span>
                  )
                )}
              </div>
            )}
            {msg.content}
          </div>
        )}
      </div>
    </div>
  )
})

export function ChatPanel(): JSX.Element {
  const [input, setInput] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [authStatus, setAuthStatus] = useState<{ isAuthenticating: boolean; message: string } | null>(null)
  const activeAgentType = useSessionStore((s) => s.activeAgentType)
  const messages = useSessionStore((s) => s.messages)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const clearChat = useSessionStore((s) => s.clearChat)
  const abortAgent = useSessionStore((s) => s.abortAgent)
  const addStreamChunk = useSessionStore((s) => s.addStreamChunk)
  // 현재 에이전트의 로딩 상태만 구독 (boolean 값)
  const isLoading = useSessionStore((s) =>
    s.activeAgentType ? !!s.loadingAgents[s.activeAgentType] : false
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const newFiles: PendingFile[] = []
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) continue // 20MB 제한
      const mediaType = file.type || 'application/octet-stream'
      const data = await readFileAsBase64(file)
      const previewUrl = mediaType.startsWith('image/')
        ? `data:${mediaType};base64,${data}`
        : undefined
      newFiles.push({ name: file.name, data, mediaType, previewUrl })
    }
    setPendingFiles((prev) => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSend = (): void => {
    if ((!input.trim() && pendingFiles.length === 0) || !activeAgentType) return
    const msg = input || '첨부된 파일을 분석해주세요.'
    const attachments = pendingFiles.length > 0
      ? pendingFiles.map(({ name, data, mediaType }) => ({ name, data, mediaType }))
      : undefined
    setInput('')
    setPendingFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(msg, attachments)
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

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles: File[] = []
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      addFiles(imageFiles)
    }
  }, [addFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      e.target.value = '' // 같은 파일 재선택 가능하게
    }
  }, [addFiles])

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
        <div className="flex items-center gap-1">
          {/* 대화 초기화 버튼 */}
          <button
            onClick={() => { if (messages.length > 0 && confirm('이 에이전트의 대화를 초기화할까요?')) clearChat() }}
            disabled={isLoading || messages.length === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="대화 초기화"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2V6H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.5 10A5.5 5.5 0 108 2.5C5.8 2.5 3.9 4 3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Todo 버튼 */}
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
      <div className="px-4 pb-4 pt-2"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden transition-colors"
            style={{
              background: 'var(--bg-input)',
              border: isDragOver ? '2px dashed var(--accent)' : '1px solid var(--border-color)'
            }}>
            {/* 드래그 오버레이 */}
            {isDragOver && (
              <div className="absolute inset-0 flex items-center justify-center z-10"
                style={{ background: 'rgba(var(--accent-rgb, 99,102,241), 0.1)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                  파일을 여기에 놓으세요
                </span>
              </div>
            )}

            {/* 첨부파일 미리보기 */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pt-3">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}>
                    {file.previewUrl ? (
                      <img src={file.previewUrl} alt={file.name}
                        className="w-16 h-16 object-cover" />
                    ) : (
                      <div className="w-16 h-16 flex flex-col items-center justify-center px-1">
                        <span className="text-lg">{getFileIcon(file.mediaType)}</span>
                        <span className="text-[9px] truncate w-full text-center mt-0.5"
                          style={{ color: 'var(--text-muted)' }}>
                          {file.name.length > 10 ? file.name.slice(0, 8) + '…' : file.name}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: '#dc2626', color: '#fff' }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={`${agentInfo?.label}에게 메시지 보내기...`}
              rows={1}
              className="w-full px-4 py-3 pr-20 text-sm resize-none focus:outline-none"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                maxHeight: '200px'
              }}
            />
            <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileSelect} className="hidden" />

            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {/* 파일 첨부 버튼 */}
              {!isLoading && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  title="파일 첨부 (이미지, PDF, 엑셀, CSV, 텍스트)"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M14 10V12.667A1.334 1.334 0 0112.667 14H3.333A1.334 1.334 0 012 12.667V10M11.333 5.333L8 2M8 2L4.667 5.333M8 2V10"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              {/* 전송/중지 버튼 */}
              {isLoading ? (
                <button
                  onClick={abortAgent}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: '#dc2626', color: '#fff' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor"/>
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && pendingFiles.length === 0}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                  style={{ background: (input.trim() || pendingFiles.length > 0) ? 'var(--accent)' : 'transparent', color: '#fff' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 14V2M8 2L3 7M8 2L13 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="text-center mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            AR-AI는 실수할 수 있습니다. 중요한 정보는 직접 확인하세요.
          </p>
        </div>
      </div>
    </main>
  )
}
