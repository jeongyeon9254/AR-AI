import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSprintStore } from '../../stores/useSprintStore'
import { useUIStore } from '../../stores/useUIStore'

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
            <div className="sprint-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
