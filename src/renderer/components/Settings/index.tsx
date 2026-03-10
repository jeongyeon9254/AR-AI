import { useEffect, useState } from 'react'
import { useSettingsStore, McpServerConfig, SkillDefinition } from '../../stores/useSettingsStore'
import { useUIStore } from '../../stores/useUIStore'
import { SetupGuide } from './SetupGuide'

const AGENT_LIST = [
  { id: 'fe-developer', label: 'FE Developer' },
  { id: 'be-developer', label: 'BE Developer' },
  { id: 'issue-collector', label: 'Issue Manager' },
  { id: 'policy-expert', label: 'Policy Manager' },
  { id: 'qa-expert', label: 'QA Manager' },
  { id: 'po', label: 'Project Owner' }
]

export function Settings(): JSX.Element {
  const { settings, workspaceStatus, loadSettings, updateSettings, validateWorkspace } = useSettingsStore()
  const { setViewMode } = useUIStore()
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    loadSettings()
    validateWorkspace()
  }, [])

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const handleChange = (key: string, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (): Promise<void> => {
    await updateSettings(form)
    await validateWorkspace()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasWarnings = workspaceStatus && workspaceStatus.missing.length > 0

  return (
    <main className="flex-1 flex flex-col overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>설정</h2>
            <button
              onClick={() => setShowGuide(true)}
              className="text-xs px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)' }}
            >
              설정 가이드
            </button>
          </div>
          <button
            onClick={() => setViewMode('chat')}
            className="text-sm px-3 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            닫기
          </button>
        </div>

        {showGuide && <SetupGuide onClose={() => setShowGuide(false)} />}

        {/* 워크스페이스 경고 */}
        {hasWarnings && (
          <div className="rounded-xl p-4" style={{ background: '#451a03', border: '1px solid #78350f' }}>
            <p className="text-sm font-medium mb-2" style={{ color: '#fbbf24' }}>
              워크스페이스 경로를 확인해주세요
            </p>
            {workspaceStatus!.missing.map((msg, i) => (
              <p key={i} className="text-xs mt-1" style={{ color: '#fcd34d' }}>
                • {msg}
              </p>
            ))}
          </div>
        )}

        {/* 레포지토리 경로 */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            레포지토리 경로
          </h3>
          <div className="space-y-4">
            <FieldWithStatus
              label="Core-Front (FE)"
              value={form.coreFrontPath}
              onChange={(v) => handleChange('coreFrontPath', v)}
              placeholder="/path/to/Core-Front"
              desc="프론트엔드 레포지토리 절대 경로"
              exists={workspaceStatus?.coreFrontExists}
            />
            <FieldWithStatus
              label="Alpha-Review (BE)"
              value={form.alphaReviewPath}
              onChange={(v) => handleChange('alphaReviewPath', v)}
              placeholder="/path/to/Alpha-Review"
              desc="백엔드 레포지토리 절대 경로"
              exists={workspaceStatus?.alphaReviewExists}
            />
            <FieldWithStatus
              label="작성페이지 (FE)"
              value={form.writePagePath}
              onChange={(v) => handleChange('writePagePath', v)}
              placeholder="/path/to/WritePage"
              desc="작성페이지 프론트엔드 레포지토리 절대 경로"
              exists={workspaceStatus?.writePageExists}
            />
            <FieldWithStatus
              label="위젯스크립트 (FE)"
              value={form.widgetScriptPath}
              onChange={(v) => handleChange('widgetScriptPath', v)}
              placeholder="/path/to/WidgetScript"
              desc="위젯스크립트 프론트엔드 레포지토리 절대 경로"
              exists={workspaceStatus?.widgetScriptExists}
            />
            <FieldWithStatus
              label="Sprint"
              value={form.sprintPath}
              onChange={(v) => handleChange('sprintPath', v)}
              placeholder="/path/to/Sprint"
              desc="스프린트 관리 문서 경로"
              exists={workspaceStatus?.sprintExists}
            />
          </div>
        </section>

        {/* Claude 인증 */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Claude 인증
          </h3>
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              로컬 Claude Code의 인증을 사용합니다.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              첫 대화 시 자동으로 브라우저에서 로그인이 진행됩니다.
            </p>
          </div>
        </section>

        {/* Google Chat */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Google Chat 연동
          </h3>
          <div className="space-y-4">
            <Field label="OAuth 클라이언트 JSON" value={form.googleChatCredentialsPath}
              onChange={(v) => handleChange('googleChatCredentialsPath', v)}
              placeholder="/path/to/oauth-credentials.json"
              desc="Google Cloud Console에서 Desktop App 타입으로 생성한 OAuth 클라이언트 JSON" />
            <Field label="기본 스페이스" value={form.googleChatDefaultSpace || ''}
              onChange={(v) => handleChange('googleChatDefaultSpace', v)}
              placeholder="spaces/XXXXXXXXX" desc="Issue Manager가 이슈 트래킹 시 사용할 기본 스페이스" />
            <GoogleAuthButton />
          </div>
        </section>

        {/* MCP 서버 */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            MCP 서버
          </h3>
          <McpServerManager
            servers={form.mcpServers || {}}
            assignments={form.agentMcpAssignments || {}}
            onServersChange={(servers) => setForm((prev) => ({ ...prev, mcpServers: servers }))}
            onAssignmentsChange={(assignments) => setForm((prev) => ({ ...prev, agentMcpAssignments: assignments }))}
          />
        </section>

        {/* 스킬 */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            스킬
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            활성화된 스킬은 모든 에이전트가 작업에 따라 자동으로 선택하여 사용합니다.
          </p>
          <SkillManager
            skills={form.skills || []}
            onSkillsChange={(skills) => setForm((prev) => ({ ...prev, skills }))}
          />
        </section>

        {/* 저장 */}
        <div className="flex items-center gap-3">
          <button onClick={handleSave}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}>
            저장
          </button>
          {saved && <span className="text-sm" style={{ color: '#4ade80' }}>저장되었습니다</span>}
        </div>

      </div>
    </main>
  )
}

function GoogleAuthButton(): JSX.Element {
  const [status, setStatus] = useState<{ authenticated: boolean; email?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.googleAuthStatus().then(setStatus)
  }, [])

  const handleLogin = async (): Promise<void> => {
    setIsLoading(true)
    setMessage(null)
    const result = await window.electronAPI.googleLogin()
    if (result.success) {
      setStatus({ authenticated: true, email: result.email })
      setMessage(`${result.email}로 로그인 완료`)
    } else {
      setMessage(result.error || '로그인 실패')
    }
    setIsLoading(false)
  }

  const handleLogout = async (): Promise<void> => {
    await window.electronAPI.googleLogout()
    setStatus({ authenticated: false })
    setMessage(null)
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {status?.authenticated
              ? `Google 계정 연결됨${status.email ? ` (${status.email})` : ''}`
              : 'Google 계정 미연결'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            본인 Google 계정으로 로그인하여 접근 가능한 스페이스의 대화를 가져옵니다.
          </p>
        </div>
        {status?.authenticated ? (
          <button onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: '#f87171', border: '1px solid #7f1d1d' }}>
            연결 해제
          </button>
        ) : (
          <button onClick={handleLogin} disabled={isLoading}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
            style={{ background: '#4285f4', color: '#fff' }}>
            {isLoading ? '로그인 중...' : 'Google 로그인'}
          </button>
        )}
      </div>
      {message && (
        <p className="text-xs mt-2" style={{ color: status?.authenticated ? '#4ade80' : '#f87171' }}>
          {message}
        </p>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, desc }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder: string; desc: string
}): JSX.Element {
  return (
    <div>
      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: '1px solid var(--border-color)'
        }} />
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  )
}

function FieldWithStatus({ label, value, onChange, placeholder, desc, exists }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder: string; desc: string; exists?: boolean
}): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</label>
        {value && exists !== undefined && (
          <span className="text-[10px]" style={{ color: exists ? '#4ade80' : '#f87171' }}>
            {exists ? '● 연결됨' : '● 경로 없음'}
          </span>
        )}
      </div>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: `1px solid ${value && exists === false ? '#7f1d1d' : 'var(--border-color)'}`
        }} />
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  )
}

function McpServerManager({ servers, assignments, onServersChange, onAssignmentsChange }: {
  servers: Record<string, McpServerConfig>
  assignments: Record<string, string[]>
  onServersChange: (s: Record<string, McpServerConfig>) => void
  onAssignmentsChange: (a: Record<string, string[]>) => void
}): JSX.Element {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'stdio' | 'http'>('stdio')
  const [newCommand, setNewCommand] = useState('npx')
  const [newArgs, setNewArgs] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const serverNames = Object.keys(servers)

  const handleAddServer = (): void => {
    if (!newName.trim()) return
    if (newType === 'http') {
      if (!newUrl.trim()) return
      onServersChange({
        ...servers,
        [newName.trim()]: { type: 'http', url: newUrl.trim(), enabled: true }
      })
    } else {
      const argsArray = newArgs.split(/\s+/).filter(Boolean)
      onServersChange({
        ...servers,
        [newName.trim()]: { command: newCommand, args: argsArray, enabled: true }
      })
    }
    setNewName('')
    setNewType('stdio')
    setNewCommand('npx')
    setNewArgs('')
    setNewUrl('')
    setAdding(false)
  }

  const handleRemoveServer = (name: string): void => {
    const next = { ...servers }
    delete next[name]
    onServersChange(next)
    // 할당에서도 제거
    const nextAssign = { ...assignments }
    for (const agentId of Object.keys(nextAssign)) {
      nextAssign[agentId] = (nextAssign[agentId] || []).filter((n) => n !== name)
    }
    onAssignmentsChange(nextAssign)
  }

  const handleToggleServer = (name: string): void => {
    onServersChange({
      ...servers,
      [name]: { ...servers[name], enabled: !servers[name].enabled }
    })
  }

  const handleToggleAssignment = (agentId: string, serverName: string): void => {
    const current = assignments[agentId] || []
    const next = current.includes(serverName)
      ? current.filter((n) => n !== serverName)
      : [...current, serverName]
    onAssignmentsChange({ ...assignments, [agentId]: next })
  }

  return (
    <div className="space-y-4">
      {/* 서버 목록 */}
      {serverNames.map((name) => {
        const isAuto = !!servers[name].auto
        const isSerena = name.startsWith('serena-')
        // auto 서버의 args에서 --project 경로 추출 (stdio 타입만)
        const projectPath = isAuto && servers[name].type !== 'http'
          ? (() => { const s = servers[name] as any; const idx = s.args?.indexOf('--project'); return idx >= 0 ? s.args[idx + 1] || '' : '' })()
          : ''
        return (
        <div key={name} className="rounded-xl p-4" style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${isSerena ? '#1e3a2f' : 'var(--border-color)'}`
        }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button onClick={() => handleToggleServer(name)}
                className="w-8 h-4 rounded-full relative transition-colors"
                style={{ background: servers[name].enabled ? '#4ade80' : '#555' }}>
                <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                  style={{ left: servers[name].enabled ? '17px' : '2px' }} />
              </button>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
              {isAuto && (
                <span className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: '#1e3a2f', color: '#4ade80' }}>
                  auto
                </span>
              )}
            </div>
            {!isAuto && (
              <button onClick={() => handleRemoveServer(name)}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: '#f87171' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                삭제
              </button>
            )}
          </div>
          {isAuto ? (
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Serena (시맨틱 코드 분석) — {projectPath}
            </p>
          ) : servers[name].type === 'http' ? (
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              HTTP — {servers[name].url}
            </p>
          ) : (
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              {(servers[name] as any).command} {(servers[name] as any).args?.join(' ')}
            </p>
          )}
          {/* 에이전트 할당 */}
          <div className="flex flex-wrap gap-1.5">
            {AGENT_LIST.map((agent) => {
              const isAssigned = (assignments[agent.id] || []).includes(name)
              return (
                <button key={agent.id} onClick={() => handleToggleAssignment(agent.id, name)}
                  className="text-[11px] px-2 py-1 rounded-md transition-colors"
                  style={{
                    background: isAssigned ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: isAssigned ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${isAssigned ? 'var(--accent)' : 'var(--border-color)'}`
                  }}>
                  {agent.label}
                </button>
              )
            })}
          </div>
        </div>
        )
      })}

      {/* 서버 추가 */}
      {adding ? (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }}>
          <div className="flex gap-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="서버 이름" className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
            <select value={newType} onChange={(e) => setNewType(e.target.value as 'stdio' | 'http')}
              className="rounded-lg px-2 py-1.5 text-sm focus:outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
              <option value="stdio">stdio</option>
              <option value="http">HTTP</option>
            </select>
          </div>
          {newType === 'http' ? (
            <input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
              placeholder="URL (https://example.com/mcp)"
              className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
          ) : (
            <>
              <input type="text" value={newCommand} onChange={(e) => setNewCommand(e.target.value)}
                placeholder="command (npx, uvx, node...)"
                className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
              <input type="text" value={newArgs} onChange={(e) => setNewArgs(e.target.value)}
                placeholder="args (공백으로 구분: -y @package/name)"
                className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
            </>
          )}
          <div className="flex gap-2">
            <button onClick={handleAddServer}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              추가
            </button>
            <button onClick={() => { setAdding(false); setNewType('stdio') }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--text-muted)' }}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-2 rounded-xl text-sm transition-colors"
          style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}>
          + MCP 서버 추가
        </button>
      )}
    </div>
  )
}

function SkillManager({ skills, onSkillsChange }: {
  skills: SkillDefinition[]
  onSkillsChange: (s: SkillDefinition[]) => void
}): JSX.Element {
  const [viewingSkill, setViewingSkill] = useState<string | null>(null)
  const [editingSkill, setEditingSkill] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newContent, setNewContent] = useState('')
  const [editContent, setEditContent] = useState('')

  const handleToggleSkill = (name: string): void => {
    onSkillsChange(skills.map((s) => s.name === name ? { ...s, enabled: !s.enabled } : s))
  }

  const handleRemoveSkill = (name: string): void => {
    onSkillsChange(skills.filter((s) => s.name !== name))
    if (viewingSkill === name) setViewingSkill(null)
    if (editingSkill === name) setEditingSkill(null)
  }

  const handleAddSkill = (): void => {
    if (!newName.trim() || !newContent.trim()) return
    onSkillsChange([...skills, {
      name: newName.trim().toLowerCase().replace(/\s+/g, '-'),
      description: newDesc.trim(),
      content: newContent.trim(),
      enabled: true
    }])
    setNewName('')
    setNewDesc('')
    setNewContent('')
    setAdding(false)
  }

  const handleStartEdit = (skill: SkillDefinition): void => {
    setEditingSkill(skill.name)
    setEditContent(skill.content)
    setViewingSkill(null)
  }

  const handleSaveEdit = (name: string): void => {
    onSkillsChange(skills.map((s) => s.name === name ? { ...s, content: editContent } : s))
    setEditingSkill(null)
  }

  const isExternal = (skill: SkillDefinition): boolean => !!skill.source?.startsWith('skills.sh:')
  const getExternalSource = (skill: SkillDefinition): string => skill.source?.replace('skills.sh:', '') || ''

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <div key={skill.name}>
          <div className="rounded-xl p-4" style={{
            background: 'var(--bg-secondary)',
            border: `1px solid ${viewingSkill === skill.name || editingSkill === skill.name ? 'var(--accent)' : isExternal(skill) ? '#3b2f63' : 'var(--border-color)'}`
          }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggleSkill(skill.name)}
                  className="w-8 h-4 rounded-full relative transition-colors"
                  style={{ background: skill.enabled ? '#4ade80' : '#555' }}>
                  <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: skill.enabled ? '17px' : '2px' }} />
                </button>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  /{skill.name}
                </span>
                {isExternal(skill) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: '#3b2f63', color: '#a78bfa' }}>
                    skills.sh
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => viewingSkill === skill.name ? setViewingSkill(null) : (setViewingSkill(skill.name), setEditingSkill(null))}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  {viewingSkill === skill.name ? '접기' : '보기'}
                </button>
                {!isExternal(skill) && (
                  <>
                    <button onClick={() => editingSkill === skill.name ? setEditingSkill(null) : handleStartEdit(skill)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: 'var(--accent)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      {editingSkill === skill.name ? '취소' : '편집'}
                    </button>
                    <button onClick={() => handleRemoveSkill(skill.name)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: '#f87171' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{skill.description}</p>
            {isExternal(skill) && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                출처: {getExternalSource(skill)}
              </p>
            )}
          </div>

          {/* 스킬 내용 뷰어 */}
          {viewingSkill === skill.name && (
            <div className="mt-1 rounded-xl p-4" style={{
              background: '#1a1a2e',
              border: '1px solid var(--border-color)'
            }}>
              <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {skill.content}
              </pre>
            </div>
          )}

          {/* 스킬 편집 */}
          {editingSkill === skill.name && (
            <div className="mt-1 rounded-xl p-4 space-y-2" style={{
              background: '#1a1a2e',
              border: '1px solid var(--accent)'
            }}>
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none resize-y leading-relaxed"
                style={{
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)', fontFamily: 'monospace'
                }} />
              <button onClick={() => handleSaveEdit(skill.name)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                적용
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 스킬 추가 */}
      {adding ? (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }}>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="스킬 이름 (예: review-api)"
            className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
          <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="설명 (예: API 엔드포인트 리뷰)"
            className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
            placeholder="스킬 프롬프트 내용 (마크다운)"
            rows={6}
            className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none resize-y"
            style={{
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border-color)', fontFamily: 'monospace'
            }} />
          <div className="flex gap-2">
            <button onClick={handleAddSkill}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              추가
            </button>
            <button onClick={() => { setAdding(false); setNewName(''); setNewDesc(''); setNewContent('') }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--text-muted)' }}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-2 rounded-xl text-sm transition-colors"
          style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}>
          + 스킬 추가
        </button>
      )}
    </div>
  )
}
