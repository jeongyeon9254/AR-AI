import { useEffect, useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSprintStore } from '../../stores/useSprintStore'
import { useUIStore } from '../../stores/useUIStore'

function highlightText(node: Node, term: string): number {
  let count = 0
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    const lower = text.toLowerCase()
    const idx = lower.indexOf(term.toLowerCase())
    if (idx >= 0) {
      const span = document.createElement('span')
      span.className = 'search-highlight'
      const before = text.slice(0, idx)
      const match = text.slice(idx, idx + term.length)
      const after = text.slice(idx + term.length)
      const parent = node.parentNode!
      if (before) parent.insertBefore(document.createTextNode(before), node)
      span.textContent = match
      parent.insertBefore(span, node)
      if (after) parent.insertBefore(document.createTextNode(after), node)
      parent.removeChild(node)
      count = 1
      // 남은 after 텍스트에서 추가 매칭
      if (after && span.nextSibling) {
        count += highlightText(span.nextSibling, term)
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const children = Array.from(node.childNodes)
    for (const child of children) {
      count += highlightText(child, term)
    }
  }
  return count
}

function clearHighlights(container: HTMLElement): void {
  const highlights = container.querySelectorAll('.search-highlight, .search-highlight-active')
  highlights.forEach((el) => {
    const parent = el.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el)
      parent.normalize()
    }
  })
}

export function SprintViewer(): JSX.Element {
  const { sprintFile, closeSprintFile } = useUIStore()
  const { content, loading, readDoc } = useSprintStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [activeMatch, setActiveMatch] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

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

  // Ctrl+F 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape' && searchOpen) {
        closeSearch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen])

  // 검색어 변경 시 하이라이트
  useEffect(() => {
    if (!contentRef.current) return
    clearHighlights(contentRef.current)
    if (!searchTerm.trim()) {
      setMatchCount(0)
      setActiveMatch(0)
      return
    }
    const count = highlightText(contentRef.current, searchTerm.trim())
    setMatchCount(count)
    setActiveMatch(count > 0 ? 1 : 0)
    // 첫 매칭으로 스크롤
    if (count > 0) {
      scrollToMatch(1)
    }
  }, [searchTerm, content])

  const scrollToMatch = useCallback((index: number): void => {
    if (!contentRef.current) return
    const highlights = contentRef.current.querySelectorAll('.search-highlight')
    highlights.forEach((el) => el.classList.remove('search-highlight-active'))
    const target = highlights[index - 1]
    if (target) {
      target.classList.add('search-highlight-active')
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  const goNext = useCallback((): void => {
    if (matchCount === 0) return
    const next = activeMatch >= matchCount ? 1 : activeMatch + 1
    setActiveMatch(next)
    scrollToMatch(next)
  }, [activeMatch, matchCount, scrollToMatch])

  const goPrev = useCallback((): void => {
    if (matchCount === 0) return
    const prev = activeMatch <= 1 ? matchCount : activeMatch - 1
    setActiveMatch(prev)
    scrollToMatch(prev)
  }, [activeMatch, matchCount, scrollToMatch])

  const closeSearch = useCallback((): void => {
    setSearchOpen(false)
    setSearchTerm('')
    setMatchCount(0)
    setActiveMatch(0)
    if (contentRef.current) clearHighlights(contentRef.current)
  }, [])

  const handleSearchKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (e.shiftKey) goPrev()
      else goNext()
    }
  }

  const fileName = sprintFile?.replace(/\.md$/, '') || ''

  return (
    <main className="flex-1 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          📄 {fileName}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: searchOpen ? 'var(--accent)' : 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="검색 (Ctrl+F)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
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
      </div>

      {/* 검색 바 */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="검색..."
            className="flex-1 text-sm px-2 py-1 rounded focus:outline-none"
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          />
          {searchTerm && (
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              {matchCount > 0 ? `${activeMatch}/${matchCount}` : '결과 없음'}
            </span>
          )}
          <button onClick={goPrev} className="w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="이전 (Shift+Enter)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 9L6 3M6 3L3 6M6 3L9 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={goNext} className="w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="다음 (Enter)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 3L6 9M6 9L3 6M6 9L9 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={closeSearch} className="w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="닫기 (Esc)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
          ) : (
            <div className="sprint-markdown" ref={contentRef}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
