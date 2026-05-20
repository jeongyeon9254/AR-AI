import { useState, useEffect, useRef, useCallback, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'inherit'
})

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const EXPORT_BG = '#0b0b0c'

function getSvgString(svgEl: SVGSVGElement): string {
  const cloned = svgEl.cloneNode(true) as SVGSVGElement
  if (!cloned.getAttribute('xmlns')) cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (!cloned.getAttribute('xmlns:xlink')) cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  cloned.style.backgroundColor = EXPORT_BG
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bgRect.setAttribute('x', '0')
  bgRect.setAttribute('y', '0')
  bgRect.setAttribute('width', '100%')
  bgRect.setAttribute('height', '100%')
  bgRect.setAttribute('fill', EXPORT_BG)
  cloned.insertBefore(bgRect, cloned.firstChild)
  return new XMLSerializer().serializeToString(cloned)
}

function MermaidDiagram({ code }: { code: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = `mmd-${Math.random().toString(36).slice(2)}`
    setReady(false)
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = svg
        setError(null)
        setReady(true)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message || 'mermaid render error')
      })
    return () => { cancelled = true }
  }, [code])

  const handleExportSvg = useCallback(() => {
    const svgEl = containerRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return
    const svgString = getSvgString(svgEl)
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    downloadBlob(blob, `diagram-${Date.now()}.svg`)
  }, [])

  const handleExportPng = useCallback(() => {
    const svgEl = containerRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return
    const svgString = getSvgString(svgEl)
    const bbox = svgEl.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(bbox.width))
    const height = Math.max(1, Math.ceil(bbox.height))
    const scale = 2
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        return
      }
      ctx.fillStyle = EXPORT_BG
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) return
        downloadBlob(blob, `diagram-${Date.now()}.png`)
      }, 'image/png')
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [])

  if (error) {
    return (
      <pre
        className="my-3 p-3 rounded-lg text-xs overflow-x-auto"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
      >
        {`// mermaid 렌더 실패: ${error}\n${code}`}
      </pre>
    )
  }

  return (
    <div className="relative group my-3">
      <div
        ref={containerRef}
        className="p-3 rounded-lg overflow-x-auto"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      />
      {ready && (
        <div
          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={handleExportSvg}
            className="px-2 py-1 text-[10px] rounded font-medium"
            style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            title="SVG로 저장"
          >
            SVG
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            className="px-2 py-1 text-[10px] rounded font-medium"
            style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            title="PNG로 저장 (2x)"
          >
            PNG
          </button>
        </div>
      )}
    </div>
  )
}
import { useSessionStore, AGENT_TYPES } from '../../stores/useSessionStore'
import type { ChatMessage, FileAttachmentInfo } from '../../stores/useSessionStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useProjectStore } from '../../stores/useProjectStore'
import type { ConsensusStageEvent } from '../../../preload/index'

interface ConsensusStageState {
  stage: 1 | 2 | 3
  status: 'running' | 'done' | 'error'
  stageName: string
  model: string
}

const CONSENSUS_STAGE_LABELS: Record<number, { icon: string; color: string }> = {
  1: { icon: '⬡', color: '#a78bfa' },
  2: { icon: '⬡', color: '#60a5fa' },
  3: { icon: '⬡', color: '#34d399' }
}

function ConsensusProgress({ stages }: { stages: ConsensusStageState[] }): JSX.Element {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl mb-3 text-xs"
      style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}
    >
      <span className="font-medium flex-shrink-0" style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.08em' }}>
        3-MODEL CONSENSUS
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {([1, 2, 3] as const).map((stageNum) => {
          const stageInfo = stages.find((s) => s.stage === stageNum)
          const meta = CONSENSUS_STAGE_LABELS[stageNum]
          const isRunning = stageInfo?.status === 'running'
          const isDone = stageInfo?.status === 'done'
          const isError = stageInfo?.status === 'error'
          const isPending = !stageInfo

          const stageNames: Record<number, string> = {
            1: 'Proposer',
            2: "Devil's Advocate",
            3: 'Arbitrator'
          }

          return (
            <div key={stageNum} className="flex items-center gap-1.5">
              {stageNum > 1 && (
                <div
                  className="w-4 h-px flex-shrink-0"
                  style={{ background: isDone || isError ? meta.color : 'var(--border-color)', opacity: 0.5 }}
                />
              )}
              <div className="flex items-center gap-1">
                <span
                  className="text-[11px]"
                  style={{
                    color: isDone ? meta.color : isRunning ? meta.color : isError ? '#f87171' : 'var(--text-muted)',
                    opacity: isPending ? 0.35 : 1,
                    animation: isRunning ? 'shimmer 1.2s ease-in-out infinite' : 'none'
                  }}
                >
                  {isError ? '✕' : isDone ? '✓' : meta.icon}
                </span>
                <span
                  style={{
                    color: isDone ? meta.color : isRunning ? meta.color : isError ? '#f87171' : 'var(--text-muted)',
                    opacity: isPending ? 0.35 : 1,
                    fontWeight: isRunning || isDone ? '600' : '400'
                  }}
                >
                  {stageNames[stageNum]}
                  {isRunning && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}> 진행 중...</span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
    <div className="flex items-center gap-4 py-3">
      <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
      <span
        className="text-[11px] px-3 py-1 rounded-full font-medium"
        style={{
          color: 'var(--text-muted)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)'
        }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
    </div>
  )
}

type ChoiceBlock = { question: string; options: string[] }
type RelatedBlock = { items: string[] }

// 어시스턴트 응답의 <choices question="..."> 블록을 파싱.
// 스트리밍 중 닫히지 않은 태그는 표시에서 제거.
function parseChoiceBlocks(content: string): { clean: string; choices: ChoiceBlock[] } {
  const lastOpen = content.lastIndexOf('<choices')
  const lastClose = content.lastIndexOf('</choices>')
  let buf = lastOpen > lastClose ? content.slice(0, lastOpen) : content

  const blocks: ChoiceBlock[] = []
  buf = buf.replace(
    /<choices\s+question="([^"]*)"\s*>([\s\S]*?)<\/choices>/g,
    (_full, q, body: string) => {
      const options = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-'))
        .map((l) => l.replace(/^-\s*/, '').trim())
        .filter(Boolean)
      if (options.length > 0) blocks.push({ question: q, options })
      return ''
    }
  )
  return { clean: buf.trim(), choices: blocks }
}

// 어시스턴트 응답의 <related> 블록을 파싱 (후속 질문 제안).
function parseRelatedBlock(content: string): { clean: string; related: RelatedBlock | null } {
  const lastOpen = content.lastIndexOf('<related')
  const lastClose = content.lastIndexOf('</related>')
  let buf = lastOpen > lastClose ? content.slice(0, lastOpen) : content

  let related: RelatedBlock | null = null
  buf = buf.replace(
    /<related\s*>([\s\S]*?)<\/related>/g,
    (_full, body: string) => {
      const items = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-'))
        .map((l) => l.replace(/^-\s*/, '').trim())
        .filter(Boolean)
      if (items.length > 0) related = { items }
      return ''
    }
  )
  return { clean: buf.trimEnd(), related }
}

function ChoiceButtons({ block }: { block: ChoiceBlock }): JSX.Element {
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="mt-3">
      {block.question && (
        <div
          className="text-xs mb-2 font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          {block.question}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {block.options.map((opt) => {
          const isPicked = picked === opt
          const disabled = picked !== null
          return (
            <button
              key={opt}
              disabled={disabled}
              onClick={() => {
                setPicked(opt)
                sendMessage(opt)
              }}
              className="text-xs px-3 py-2 rounded-lg transition-all"
              style={{
                background: isPicked ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: isPicked ? 'var(--accent)' : 'var(--text-primary)',
                border: `1px solid ${isPicked ? 'rgba(167,139,250,0.4)' : 'var(--border-color)'}`,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled && !isPicked ? 0.5 : 1
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RelatedQuestions({ block }: { block: RelatedBlock }): JSX.Element {
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--border-color)' }}>
      <div
        className="text-[11px] mb-2 font-medium flex items-center gap-1.5"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>💡</span>
        <span>관련해서 더 궁금하신가요?</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {block.items.map((q) => {
          const isPicked = picked === q
          const disabled = picked !== null
          return (
            <button
              key={q}
              disabled={disabled}
              onClick={() => {
                setPicked(q)
                sendMessage(q)
              }}
              className="text-xs px-3 py-2 rounded-lg text-left transition-all"
              style={{
                background: isPicked ? 'var(--accent-dim)' : 'transparent',
                color: isPicked ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${isPicked ? 'rgba(167,139,250,0.4)' : 'var(--border-color)'}`,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled && !isPicked ? 0.5 : 1
              }}
            >
              {q}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const MessageItem = memo(function MessageItem({ msg, agentIcon, showDate }: {
  msg: ChatMessage
  agentIcon?: string
  showDate: boolean
}): JSX.Element {
  const parsedChoices = msg.role === 'assistant'
    ? parseChoiceBlocks(msg.content)
    : { clean: msg.content, choices: [] as ChoiceBlock[] }
  const parsedRelated = msg.role === 'assistant'
    ? parseRelatedBlock(parsedChoices.clean)
    : { clean: parsedChoices.clean, related: null as RelatedBlock | null }
  const parsed = { clean: parsedRelated.clean, choices: parsedChoices.choices, related: parsedRelated.related }
  return (
    <div>
      {showDate && <DateDivider label={formatDateLabel(msg.createdAt)} />}
      <div className={msg.role === 'user' ? 'flex justify-end' : ''}>
        {msg.role === 'assistant' && (
          <div className="flex gap-3.5 items-start">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid rgba(167,139,250,0.25)',
                color: 'var(--accent)'
              }}
            >
              {agentIcon}
            </div>
            <div
              className="chat-markdown text-sm leading-relaxed pt-1 min-w-0"
              style={{ color: 'var(--text-primary)' }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      onClick={(e) => { e.preventDefault(); if (href) window.open(href, '_blank') }}
                      style={{ color: 'var(--accent)', cursor: 'pointer' }}
                    >
                      {children}
                    </a>
                  ),
                  code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '')
                    if (match?.[1] === 'mermaid') {
                      return <MermaidDiagram code={String(children).replace(/\n$/, '')} />
                    }
                    return <code className={className} {...props}>{children}</code>
                  }
                }}
              >{parsed.clean}</ReactMarkdown>
              {parsed.choices.map((block, i) => (
                <ChoiceButtons key={i} block={block} />
              ))}
              {parsed.related && <RelatedQuestions block={parsed.related} />}
            </div>
          </div>
        )}
        {msg.role === 'user' && (
          <div
            className="inline-block px-4 py-3 text-sm max-w-[80%]"
            style={{
              background: 'var(--bg-user-msg)',
              color: 'var(--text-primary)',
              borderRadius: '16px',
              border: '1px solid rgba(167,139,250,0.12)',
              lineHeight: '1.65'
            }}
          >
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2.5">
                {msg.attachments.map((att, i) =>
                  att.data && att.mediaType.startsWith('image/') ? (
                    <img
                      key={i}
                      src={`data:${att.mediaType};base64,${att.data}`}
                      alt={att.name}
                      className="max-w-[200px] max-h-[150px] rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
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
  const [inputFocused, setInputFocused] = useState(false)
  const [authStatus, setAuthStatus] = useState<{ isAuthenticating: boolean; message: string } | null>(null)
  const [consensusStages, setConsensusStages] = useState<ConsensusStageState[]>([])
  const activeAgentType = useSessionStore((s) => s.activeAgentType)
  const activeProjectId = useSessionStore((s) => s.activeProjectId)
  const messages = useSessionStore((s) => s.messages)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const clearChat = useSessionStore((s) => s.clearChat)
  const abortAgent = useSessionStore((s) => s.abortAgent)
  const addStreamChunk = useSessionStore((s) => s.addStreamChunk)
  const selectAgent = useSessionStore((s) => s.selectAgent)
  const isLoading = useSessionStore((s) =>
    s.activeSessionId ? !!s.loadingAgents[s.activeSessionId] : false
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { toggleTodo, todoOpen, goHome } = useUIStore()
  const { workspaceStatus, validateWorkspace } = useSettingsStore()
  const agentInfo = AGENT_TYPES.find((a) => a.id === activeAgentType)
  const { projects } = useProjectStore()
  const activeProject = projects.find((p) => p.id === activeProjectId)

  useEffect(() => {
    validateWorkspace()
  }, [])

  useEffect(() => {
    const unsubStream = window.electronAPI.onStreamChunk((chunk) => {
      addStreamChunk(chunk)
      // 스트리밍 완료 시 consensus 진행 상황 초기화
      if (chunk.done) {
        setConsensusStages([])
      }
    })
    const unsubAuth = window.electronAPI.onAuthStatus((status) => {
      setAuthStatus(status)
      if (!status.isAuthenticating) {
        setTimeout(() => setAuthStatus(null), 3000)
      }
    })
    const unsubConsensus = window.electronAPI.onConsensusStage((event: ConsensusStageEvent) => {
      setConsensusStages((prev) => {
        const filtered = prev.filter((s) => s.stage !== event.stage)
        return [...filtered, { stage: event.stage, status: event.status, stageName: event.stageName, model: event.model }]
          .sort((a, b) => a.stage - b.stage)
      })
    })
    // 에이전트 완료 이벤트 — consensus UI 초기화 (로딩 상태 해제는 App.tsx 전역 리스너가 담당)
    const unsubAgentDone = window.electronAPI.onAgentDone(() => {
      setConsensusStages([])
    })

    return () => {
      unsubStream()
      unsubAuth()
      unsubConsensus()
      unsubAgentDone()
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
    setConsensusStages([])
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
        <div className="text-center">
          <p
            className="text-3xl font-bold mb-3 tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            AR-AI
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            좌측에서 에이전트를 선택하여 대화를 시작하세요
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* 상단 바 */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {/* 뒤로가기 */}
          <button
            onClick={goHome}
            className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>홈</span>
          </button>

          {/* 구분자 + 프로젝트명 */}
          {activeProject && (
            <>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>/</span>
              <span
                className="text-xs truncate px-1.5 max-w-[120px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {activeProject.name}
              </span>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>/</span>
            </>
          )}

          {/* 에이전트 탭 — 프로젝트 모드: 5개 에이전트, 글로벌 모드: 활성 에이전트만 (issue-collector 또는 policy-manager) */}
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {AGENT_TYPES.filter((a) => activeProjectId
              ? ['fe-developer', 'be-developer', 'qa-expert', 'po', 'issue-collector'].includes(a.id)
              : a.id === activeAgentType
            ).map((agent) => (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent.id, activeProjectId || undefined)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs flex-shrink-0 transition-all relative"
                style={{
                  color: activeAgentType === agent.id ? 'var(--accent)' : 'var(--text-muted)',
                  background: activeAgentType === agent.id ? 'var(--accent-dim)' : 'transparent',
                  fontWeight: activeAgentType === agent.id ? '600' : '400'
                }}
                onMouseEnter={(e) => {
                  if (activeAgentType !== agent.id) {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeAgentType !== agent.id) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }
                }}
              >
                <span>{agent.icon}</span>
                <span>{agent.label}</span>
                {isLoading && activeAgentType === agent.id && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent)', animation: 'shimmer 1s ease-in-out infinite' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* 대화 초기화 버튼 */}
          <button
            onClick={() => { if (messages.length > 0 && confirm('이 에이전트의 대화를 초기화할까요?')) clearChat() }}
            disabled={isLoading || messages.length === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
            title="대화 초기화"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2 2V6H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.5 10A5.5 5.5 0 108 2.5C5.8 2.5 3.9 4 3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Todo 버튼 */}
          <button
            onClick={toggleTodo}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{
              color: todoOpen ? 'var(--accent)' : 'var(--text-muted)',
              background: todoOpen ? 'var(--accent-dim)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!todoOpen) {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!todoOpen) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }
            }}
            title="Todo"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
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
        <div
          className="px-5 py-2.5 text-xs flex items-center gap-2"
          style={{ background: 'rgba(120,53,15,0.4)', color: '#fcd34d', borderBottom: '1px solid rgba(120,83,15,0.5)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L11 10H1L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="6" y1="5" x2="6" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6" cy="9" r="0.5" fill="currentColor"/>
          </svg>
          <span>
            {workspaceStatus.missing[0]}
            {workspaceStatus.missing.length > 1 && ` 외 ${workspaceStatus.missing.length - 1}건`}
            {' — '}
            <span
              style={{ textDecoration: 'underline', cursor: 'pointer', opacity: 0.8 }}
              onClick={() => useUIStore.getState().setViewMode('settings')}
            >
              설정에서 확인
            </span>
          </span>
        </div>
      )}

      {/* 인증 배너 */}
      {authStatus && authStatus.isAuthenticating && (
        <div
          className="px-5 py-2.5 text-xs text-center"
          style={{ background: 'rgba(74,56,0,0.5)', color: '#fbbf24', borderBottom: '1px solid rgba(120,101,13,0.5)' }}
        >
          브라우저에서 Claude 로그인을 진행해주세요...
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-5 py-8 space-y-7">
          {messages.length === 0 && (
            <div className="text-center py-24">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl"
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(167,139,250,0.2)'
                }}
              >
                {agentInfo?.icon}
              </div>
              <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {agentInfo?.label}
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
            <div className="flex gap-3.5 items-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(167,139,250,0.25)',
                  color: 'var(--accent)'
                }}
              >
                {agentInfo?.icon}
              </div>
              <div className="flex flex-col gap-2 pt-1 flex-1 min-w-0">
                {consensusStages.length > 0 ? (
                  <ConsensusProgress stages={consensusStages} />
                ) : (
                  <div className="flex gap-1.5 items-center pt-1.5">
                    <span className="loading-dot w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', opacity: 0.6 }} />
                    <span className="loading-dot w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', opacity: 0.6 }} />
                    <span className="loading-dot w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', opacity: 0.6 }} />
                  </div>
                )}
              </div>
            </div>
          )}
          {isLoading && messages[messages.length - 1]?.role === 'assistant' && consensusStages.length > 0 && (
            <div className="flex gap-3.5 items-start">
              <div className="w-8 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <ConsensusProgress stages={consensusStages} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div
        className="px-5 pb-5 pt-3"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-6xl mx-auto">
          <div
            className="relative overflow-hidden transition-all"
            style={{
              background: 'var(--bg-elevated)',
              border: isDragOver
                ? '2px dashed var(--accent)'
                : inputFocused
                  ? '1px solid rgba(167,139,250,0.35)'
                  : '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: inputFocused
                ? '0 0 0 3px rgba(167,139,250,0.08)'
                : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
          >
            {/* 드래그 오버레이 */}
            {isDragOver && (
              <div
                className="absolute inset-0 flex items-center justify-center z-10"
                style={{ background: 'rgba(167,139,250,0.06)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                  파일을 여기에 놓으세요
                </span>
              </div>
            )}

            {/* 첨부파일 미리보기 */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-4">
                {pendingFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}
                  >
                    {file.previewUrl ? (
                      <img src={file.previewUrl} alt={file.name}
                        className="w-16 h-16 object-cover" />
                    ) : (
                      <div className="w-16 h-16 flex flex-col items-center justify-center px-1">
                        <span className="text-lg">{getFileIcon(file.mediaType)}</span>
                        <span
                          className="text-[9px] truncate w-full text-center mt-0.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
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
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={`${agentInfo?.label}에게 메시지 보내기...`}
              rows={1}
              className="w-full px-4 py-3.5 pr-20 text-sm resize-none focus:outline-none"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                maxHeight: '200px',
                caretColor: 'var(--accent)'
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1">
              {/* 파일 첨부 버튼 */}
              {!isLoading && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'var(--text-muted)', background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }}
                  title="파일 첨부 (이미지, PDF, 엑셀, CSV, 텍스트)"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M14 10V12.667A1.334 1.334 0 0112.667 14H3.333A1.334 1.334 0 012 12.667V10M11.333 5.333L8 2M8 2L4.667 5.333M8 2V10"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              {/* 전송/중지 버튼 */}
              {isLoading ? (
                <button
                  onClick={abortAgent}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'rgba(220,38,38,0.85)', color: '#fff' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.85)')}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"/>
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && pendingFiles.length === 0}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-25"
                  style={{
                    background: (input.trim() || pendingFiles.length > 0) ? 'var(--accent)' : 'var(--bg-hover)',
                    color: '#fff',
                    boxShadow: (input.trim() || pendingFiles.length > 0) ? '0 0 12px rgba(167,139,250,0.3)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (input.trim() || pendingFiles.length > 0) {
                      e.currentTarget.style.background = 'var(--accent-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = (input.trim() || pendingFiles.length > 0) ? 'var(--accent)' : 'var(--bg-hover)'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 14V2M8 2L3 7M8 2L13 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="text-center mt-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            AR-AI는 실수할 수 있습니다. 중요한 정보는 직접 확인하세요.
          </p>
        </div>
      </div>
    </main>
  )
}
