import { useEffect } from 'react'
import { useSprintStore } from '../../stores/useSprintStore'
import { useUIStore } from '../../stores/useUIStore'

function renderMarkdown(text: string): JSX.Element[] {
  const lines = text.split('\n')
  const elements: JSX.Element[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 헤딩
    const h1 = line.match(/^# (.+)/)
    if (h1) {
      elements.push(<h1 key={i} className="text-xl font-bold mt-6 mb-3" style={{ color: 'var(--text-primary)' }}>{h1[1]}</h1>)
      continue
    }
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-5 mb-2" style={{ color: 'var(--text-primary)' }}>{h2[1]}</h2>)
      continue
    }
    const h3 = line.match(/^### (.+)/)
    if (h3) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>{h3[1]}</h3>)
      continue
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-4" style={{ borderColor: 'var(--border-color)' }} />)
      continue
    }

    // 체크박스 리스트
    const checkbox = line.match(/^(\s*)- \[([ x])\] (.+)/)
    if (checkbox) {
      const checked = checkbox[2] === 'x'
      elements.push(
        <div key={i} className="flex items-start gap-2 py-0.5" style={{ paddingLeft: checkbox[1].length * 8 }}>
          <span className="mt-0.5 text-xs" style={{ color: checked ? 'var(--accent)' : 'var(--text-muted)' }}>
            {checked ? '☑' : '☐'}
          </span>
          <span className="text-sm" style={{ color: checked ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: checked ? 'line-through' : 'none' }}>
            {formatInline(checkbox[3])}
          </span>
        </div>
      )
      continue
    }

    // 불릿 리스트
    const bullet = line.match(/^(\s*)[-*+] (.+)/)
    if (bullet) {
      elements.push(
        <div key={i} className="flex items-start gap-2 py-0.5" style={{ paddingLeft: bullet[1].length * 8 }}>
          <span className="mt-1 text-[8px]" style={{ color: 'var(--text-muted)' }}>●</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatInline(bullet[2])}</span>
        </div>
      )
      continue
    }

    // 숫자 리스트
    const numbered = line.match(/^(\s*)\d+\. (.+)/)
    if (numbered) {
      elements.push(
        <p key={i} className="text-sm py-0.5" style={{ color: 'var(--text-secondary)', paddingLeft: numbered[1].length * 8 }}>
          {formatInline(line.trim())}
        </p>
      )
      continue
    }

    // 빈 줄
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
      continue
    }

    // 일반 텍스트
    elements.push(
      <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {formatInline(line)}
      </p>
    )
  }

  return elements
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
}

export function SprintViewer(): JSX.Element {
  const { sprintFile, closeSprintFile } = useUIStore()
  const { content, loading, readDoc } = useSprintStore()

  useEffect(() => {
    if (sprintFile) readDoc(sprintFile)
  }, [sprintFile])

  useEffect(() => {
    const unsub = window.electronAPI.onSprintChanged((data) => {
      if (sprintFile && data.fileName === sprintFile) {
        readDoc(sprintFile)
      }
    })
    return () => unsub()
  }, [sprintFile])

  const fileName = sprintFile?.replace(/\.md$/, '') || ''

  return (
    <main className="flex-1 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          📄 {fileName}
        </span>
        <button
          onClick={closeSprintFile}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 3L3 11M3 3L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
          ) : (
            renderMarkdown(content)
          )}
        </div>
      </div>
    </main>
  )
}
