import { useState } from 'react'

function getDefaultDates(): { start: string; end: string } {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return {
    start: yesterday.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0]
  }
}

export function ReportViewer(): JSX.Element {
  const defaults = getDefaultDates()
  const [spaceName, setSpaceName] = useState('')
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [report, setReport] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (): Promise<void> => {
    if (!spaceName.trim()) return
    setIsLoading(true)
    setError(null)
    setReport(null)
    const result = await window.electronAPI.generateReport({
      spaceName: spaceName.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined
    })
    if (result.success) setReport(result.report)
    else setError(result.error)
    setIsLoading(false)
  }

  const handleAnalyze = async (): Promise<void> => {
    if (!spaceName.trim()) return
    setIsLoading(true)
    setError(null)
    setReport(null)

    // 1. 메시지 수집
    const result = await window.electronAPI.generateReport({
      spaceName: spaceName.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined
    })

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    // 2. issue-collector 에이전트 세션 찾거나 생성
    const sessions = await window.electronAPI.listSessions()
    let issueSession = sessions.find(
      (s: any) => s.session?.agentType === 'issue-collector'
    )
    if (!issueSession) {
      issueSession = await window.electronAPI.createSession('issue-collector')
    }

    // 3. 수집된 데이터를 에이전트에게 전달하여 AI 분석 요청
    const period = `${startDate || defaults.start} ~ ${endDate || defaults.end}`
    const analysisPrompt = `다음은 Google Chat 스페이스(${spaceName})에서 ${period} 기간 동안 수집된 대화 내용입니다.

${result.analysisContext}

---
위 대화 내용을 분석하여 이슈 리포트를 생성해주세요.
- 문맥을 파악하여 실제 이슈를 식별하고 분류해주세요
- 우선순위를 판단해주세요 (Critical / High / Medium / Low)
- 같은 이슈에 대한 여러 멘션은 통합해주세요
- 이슈가 아닌 일반 대화는 무시해주세요`

    await window.electronAPI.sendMessage(issueSession.id || issueSession.session?.id, analysisPrompt)
    setReport('AI 분석이 issue-collector 에이전트 대화창에서 진행 중입니다. 채팅 패널을 확인해주세요.')
    setIsLoading(false)
  }

  const inputStyle = {
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)'
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        Google Chat 이슈 리포트
      </h3>

      <div className="flex flex-col gap-2 mb-3">
        <input
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          placeholder="spaces/XXXXXXXXX"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle}
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={inputStyle}
          />
          <span className="self-center text-sm" style={{ color: 'var(--text-muted)' }}>~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={inputStyle}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={!spaceName.trim() || isLoading}
            className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isLoading ? '처리 중...' : '키워드 리포트'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!spaceName.trim() || isLoading}
            className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
            style={{ background: '#7c3aed', color: '#fff' }}
          >
            {isLoading ? '처리 중...' : 'AI 분석'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm mb-3" style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
          {error}
        </div>
      )}
      {report && (
        <div className="rounded-lg p-4 text-sm whitespace-pre-wrap"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
          {report}
        </div>
      )}
    </div>
  )
}
