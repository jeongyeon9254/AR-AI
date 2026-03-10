import { BrowserWindow, shell } from 'electron'
import { spawn, exec } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { promisify } from 'util'

const execAsync = promisify(exec)
import { app } from 'electron'
import { AGENT_DEFINITIONS, ORCHESTRATOR_SYSTEM_PROMPT, SUB_AGENTS } from './definitions'
import { getSettings, syncSkillFilesAsync } from '../config'
import { getContextBoard } from '../context-board'
import { SessionManager } from '../sessions'
import { collectIssues, formatMessagesForAnalysis } from '../tools/google-chat'

let _sessionManager: SessionManager | null = null
export function setAgentSessionManager(sm: SessionManager): void {
  _sessionManager = sm
}
function getSessionManager(): SessionManager | null {
  return _sessionManager
}

// 에이전트별 SDK 세션 ID 관리 (대화 연속성)
const sdkSessionMap = new Map<string, string>()

// 셸 환경 캐시 — 첫 호출 시 비동기 초기화 후 재사용
let _cachedShellPath: string | null = null
let _cachedNodeBin: string | null = null

/** 특정 에이전트의 SDK 세션을 리셋합니다 (새 대화 시작) */
export function resetSdkSession(agentType: string): void {
  sdkSessionMap.delete(agentType)
}

/** 모든 에이전트의 SDK 세션을 리셋합니다 */
export function resetAllSdkSessions(): void {
  sdkSessionMap.clear()
}

export interface AgentRunOptions {
  sessionId: string
  agentType: string
  message: string
  mainWindow: BrowserWindow
  abortSignal?: AbortSignal
}

// ── Worktree 관리 (policy-expert 전용) ──

interface WorktreeInfo {
  originalPath: string
  worktreePath: string
  label: string
}

const WORKTREE_BASE_DIR = join(app.getPath('temp'), 'ar-ai-worktrees')

/** 레포지토리의 main 브랜치를 가리키는 worktree를 비동기로 생성합니다 */
async function createMainWorktreeAsync(repoPath: string, label: string): Promise<WorktreeInfo | null> {
  try {
    // git 레포인지 확인
    await execAsync('git rev-parse --git-dir', { cwd: repoPath })

    // fetch로 원격 최신화
    await execAsync('git fetch origin', { cwd: repoPath, timeout: 30000 })

    // main 브랜치 존재 확인 (main 또는 master)
    let mainBranch = 'main'
    try {
      await execAsync('git rev-parse --verify origin/main', { cwd: repoPath })
    } catch {
      try {
        await execAsync('git rev-parse --verify origin/master', { cwd: repoPath })
        mainBranch = 'master'
      } catch {
        console.warn(`[Worktree] ${label}: main/master 브랜치를 찾을 수 없습니다`)
        return null
      }
    }

    const worktreePath = join(WORKTREE_BASE_DIR, label)

    // 기존 worktree가 있으면 제거
    if (existsSync(worktreePath)) {
      try {
        await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: repoPath })
      } catch {
        rmSync(worktreePath, { recursive: true, force: true })
      }
    }

    // worktree 디렉토리 확보
    mkdirSync(WORKTREE_BASE_DIR, { recursive: true })

    // detached HEAD로 worktree 생성 (브랜치 충돌 방지)
    await execAsync(`git worktree add --detach "${worktreePath}" origin/${mainBranch}`, {
      cwd: repoPath,
      timeout: 30000
    })

    const { stdout } = await execAsync('git rev-parse --short HEAD', { cwd: worktreePath })
    const commitHash = stdout.trim()
    console.log(`[Worktree] ${label}: origin/${mainBranch} (${commitHash}) → ${worktreePath}`)

    return { originalPath: repoPath, worktreePath, label }
  } catch (err) {
    console.error(`[Worktree] ${label}: worktree 생성 실패`, err)
    return null
  }
}

/** 생성한 worktree들을 비동기로 정리합니다 */
async function cleanupWorktreesAsync(worktrees: WorktreeInfo[]): Promise<void> {
  await Promise.all(worktrees.map(async (wt) => {
    try {
      await execAsync(`git worktree remove "${wt.worktreePath}" --force`, {
        cwd: wt.originalPath
      })
      console.log(`[Worktree] ${wt.label}: 정리 완료`)
    } catch {
      try {
        rmSync(wt.worktreePath, { recursive: true, force: true })
        await execAsync('git worktree prune', { cwd: wt.originalPath })
      } catch {
        console.warn(`[Worktree] ${wt.label}: 정리 실패 (수동 삭제 필요)`)
      }
    }
  }))
}

/**
 * policy-expert용: 각 레포의 main worktree를 생성하고
 * worktree 경로로 대체된 cwd/additionalDirectories를 반환합니다.
 */
async function buildPolicyWorktreesAsync(): Promise<{
  worktrees: WorktreeInfo[]
  cwd: string | undefined
  additionalDirectories: string[]
  worktreeContext: string
}> {
  const s = getSettings()
  const repos: { path: string; label: string }[] = []
  if (s.coreFrontPath) repos.push({ path: s.coreFrontPath, label: 'core-front' })
  if (s.alphaReviewPath) repos.push({ path: s.alphaReviewPath, label: 'alpha-review' })
  if (s.writePagePath) repos.push({ path: s.writePagePath, label: 'write-page' })
  if (s.widgetScriptPath) repos.push({ path: s.widgetScriptPath, label: 'widget-script' })

  // 병렬로 worktree 생성
  const results = await Promise.all(
    repos.map((repo) => createMainWorktreeAsync(repo.path, repo.label))
  )

  const worktrees: WorktreeInfo[] = []
  const dirs: string[] = []
  const contextLines: string[] = []

  for (let i = 0; i < repos.length; i++) {
    const wt = results[i]
    if (wt) {
      worktrees.push(wt)
      dirs.push(wt.worktreePath)
      try {
        const { stdout } = await execAsync('git rev-parse --short HEAD', { cwd: wt.worktreePath })
        contextLines.push(`- ${wt.label}: ${wt.worktreePath} (main@${stdout.trim()})`)
      } catch {
        contextLines.push(`- ${wt.label}: ${wt.worktreePath}`)
      }
    } else {
      dirs.push(repos[i].path)
      contextLines.push(`- ${repos[i].label}: ${repos[i].path} (원본 경로, worktree 생성 실패)`)
    }
  }

  // Sprint 경로는 worktree 불필요 (문서이므로)
  if (s.sprintPath) dirs.push(s.sprintPath)

  const worktreeContext = contextLines.length > 0
    ? `\n\n[시스템] main 브랜치 워크트리가 자동 생성되었습니다. 아래 경로에서 분석하세요:\n${contextLines.join('\n')}\n다른 에이전트의 작업 브랜치와 독립된 main 브랜치입니다.`
    : ''

  return {
    worktrees,
    cwd: dirs[0] || undefined,
    additionalDirectories: dirs,
    worktreeContext
  }
}

/** cwd는 FE 경로를 기본으로 (첫 번째 설정된 경로) */
function buildCwd(): string | undefined {
  const s = getSettings()
  return s.coreFrontPath || s.alphaReviewPath || s.writePagePath || s.widgetScriptPath || s.sprintPath || undefined
}

/** 모든 에이전트에 설정된 경로를 추가 디렉토리로 전달 */
function buildAdditionalDirectories(): string[] {
  const s = getSettings()
  const dirs: string[] = []
  if (s.coreFrontPath) dirs.push(s.coreFrontPath)
  if (s.alphaReviewPath) dirs.push(s.alphaReviewPath)
  if (s.writePagePath) dirs.push(s.writePagePath)
  if (s.widgetScriptPath) dirs.push(s.widgetScriptPath)
  if (s.sprintPath) dirs.push(s.sprintPath)
  return dirs
}

export async function runAgent(options: AgentRunOptions): Promise<string> {
  const { sessionId, agentType, message, mainWindow, abortSignal } = options

  // ESM 모듈을 dynamic import로 로드
  const { query } = await import('@anthropic-ai/claude-agent-sdk')

  const isOrchestrator = agentType === 'orchestrator'
  const agentDef = AGENT_DEFINITIONS[agentType]

  // 분석 전용 에이전트는 main worktree를 사용하여 다른 에이전트 작업과 독립
  const WORKTREE_AGENTS = ['issue-collector']
  const usesWorktree = WORKTREE_AGENTS.includes(agentType)
  let activeWorktrees: WorktreeInfo[] = []
  let worktreeContext = ''

  let cwd: string | undefined
  let additionalDirectories: string[]

  if (usesWorktree) {
    const wt = await buildPolicyWorktreesAsync()
    activeWorktrees = wt.worktrees
    cwd = wt.cwd
    additionalDirectories = wt.additionalDirectories
    worktreeContext = wt.worktreeContext
  } else {
    cwd = buildCwd()
    additionalDirectories = buildAdditionalDirectories()
  }

  const cleanEnv = { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'ar-ai/0.1.0' }
  delete cleanEnv.CLAUDECODE

  // 셸 PATH 캐싱 — 비동기로 초기화
  if (_cachedShellPath === null) {
    try {
      const { stdout } = await execAsync('zsh -ilc "echo $PATH" 2>/dev/null || bash -ilc "echo $PATH" 2>/dev/null', {
        timeout: 5000
      })
      _cachedShellPath = stdout.trim()
    } catch {
      const fallbackPaths = ['/usr/local/bin', '/opt/homebrew/bin']
      _cachedShellPath = [...fallbackPaths, process.env.PATH || ''].join(':')
    }
  }
  cleanEnv.PATH = _cachedShellPath

  // 패키징된 앱에서 cli.js는 app.asar.unpacked에 위치
  const cliPath = join(
    app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
    'node_modules',
    '@anthropic-ai',
    'claude-agent-sdk',
    'cli.js'
  )

  // node 절대 경로 캐싱 — 비동기로 초기화
  if (_cachedNodeBin === null) {
    try {
      const { stdout } = await execAsync('zsh -ilc "which node" 2>/dev/null || bash -ilc "which node" 2>/dev/null', {
        timeout: 5000
      })
      _cachedNodeBin = stdout.trim()
    } catch {
      _cachedNodeBin = 'node'
      for (const p of ['/usr/local/bin/node', '/opt/homebrew/bin/node']) {
        if (existsSync(p)) { _cachedNodeBin = p; break }
      }
    }
    console.log('[AR-AI] Node binary:', _cachedNodeBin)
  }
  const nodeBin = _cachedNodeBin
  console.log('[AR-AI] CLI path:', cliPath, 'exists:', existsSync(cliPath))

  // SDK 세션 resume으로 대화 연속성 유지
  const existingSdkSession = sdkSessionMap.get(agentType)

  // 에이전트별 토큰/턴 최적화
  const ANALYSIS_AGENTS = ['policy-expert', 'issue-collector', 'po', 'qa-expert']
  const isAnalysisAgent = ANALYSIS_AGENTS.includes(agentType)
  const maxTurns = isAnalysisAgent ? 15 : 30
  const maxTokens = isAnalysisAgent ? 4096 : 8192

  const queryOptions: any = {
    pathToClaudeCodeExecutable: cliPath,
    // spawnClaudeCodeProcess: node 절대 경로로 직접 spawn하여 PATH 문제 우회
    spawnClaudeCodeProcess: (spawnOpts: { command: string; args: string[]; cwd?: string; env: Record<string, string | undefined>; signal: AbortSignal }) => {
      // SDK가 command='node', args=['cli.js', ...flags]로 전달함
      // command를 node 절대 경로로 교체
      const cmd = spawnOpts.command === 'node' ? nodeBin : spawnOpts.command
      const child = spawn(cmd, spawnOpts.args, {
        cwd: spawnOpts.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: spawnOpts.env as NodeJS.ProcessEnv,
        signal: spawnOpts.signal,
        windowsHide: true
      })
      child.stderr?.on('data', (data: Buffer) => {
        console.log('[AR-AI SDK stderr]', data.toString())
      })
      // EPIPE 에러 억제 — abort 시 닫힌 stdin에 쓰기 시도하면 발생
      child.stdin?.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code !== 'EPIPE') {
          console.error('[AR-AI SDK stdin error]', err)
        }
      })
      child.stdout?.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code !== 'EPIPE') {
          console.error('[AR-AI SDK stdout error]', err)
        }
      })
      return {
        stdin: child.stdin,
        stdout: child.stdout,
        get killed() { return child.killed },
        get exitCode() { return child.exitCode },
        kill: (signal: NodeJS.Signals) => child.kill(signal),
        on: child.on.bind(child) as any,
        once: child.once.bind(child) as any,
        off: child.off.bind(child) as any
      }
    },
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    allowedTools: ['Read', 'Edit', 'Glob', 'Grep', 'Bash', 'Write', 'Agent'],
    cwd,
    additionalDirectories: additionalDirectories.length > 0 ? additionalDirectories : undefined,
    maxTurns,
    maxTokens,
    env: cleanEnv
  }

  if (existingSdkSession) {
    queryOptions.resume = existingSdkSession
  }

  // 공유 컨텍스트 보드 + Todo 목록을 system prompt에 주입
  const contextBoard = getContextBoard()
  const sharedContext = contextBoard.buildContextText()

  const sm = getSessionManager()
  const currentTodos = sm ? sm.listTodos(agentType) : []
  const todoContext = currentTodos.length > 0
    ? `\n\n---\n📝 나의 Todo 목록:\n${currentTodos.map((t) => `- [${t.done ? 'x' : ' '}] ${t.content} (id: ${t.id})`).join('\n')}\n---`
    : ''

  const todoInstruction = `\n\nTodo 관리: 응답 끝에 다음 명령을 사용하여 할 일을 관리할 수 있습니다.
[TODO:ADD] 할 일 내용
[TODO:DONE] todo-id
[TODO:DELETE] todo-id
여러 개를 동시에 사용할 수 있습니다. 필요할 때만 사용하세요.`

  // 스킬 파일 동기화 + 설정 로드
  await syncSkillFilesAsync()
  const settings = getSettings()
  const assignedMcpNames = settings.agentMcpAssignments[agentType] || []
  const mcpServersConfig: Record<string, Record<string, unknown>> = {}
  for (const name of assignedMcpNames) {
    const server = settings.mcpServers[name]
    if (server && server.enabled) {
      if (server.type === 'http') {
        // HTTP 기반 MCP 서버
        const headers: Record<string, string> = { ...(server.headers || {}) }
        // Figma 서버에 토큰 자동 주입
        if (name === 'figma' && settings.figmaAccessToken) {
          headers['X-Figma-Token'] = settings.figmaAccessToken
        }
        mcpServersConfig[name] = {
          type: 'http',
          url: server.url,
          ...(Object.keys(headers).length > 0 ? { headers } : {})
        }
      } else {
        // Stdio 기반 MCP 서버
        const serverEntry: Record<string, unknown> = {
          command: server.command, args: server.args
        }
        const envVars: Record<string, string> = { ...(server.env || {}) }
        if (Object.keys(envVars).length > 0) {
          serverEntry.env = envVars
        }
        mcpServersConfig[name] = serverEntry
      }
    }
  }
  if (Object.keys(mcpServersConfig).length > 0) {
    queryOptions.mcpServers = mcpServersConfig
  }

  // [DEBUG] MCP 서버 전달 확인
  console.log(`[AR-AI MCP Debug] agent=${agentType}, resume=${!!existingSdkSession}, assignedMcpNames=${JSON.stringify(assignedMcpNames)}, mcpServersConfig keys=${JSON.stringify(Object.keys(mcpServersConfig))}`)
  for (const [name, cfg] of Object.entries(mcpServersConfig)) {
    if ((cfg as any).type === 'http') {
      const c = cfg as { url: string; headers?: Record<string, string> }
      console.log(`[AR-AI MCP Debug]   ${name}: type=http, url=${c.url}, headers=${c.headers ? Object.keys(c.headers).join(',') : 'none'}`)
    } else {
      const c = cfg as { command: string; args: string[]; env?: Record<string, string> }
      console.log(`[AR-AI MCP Debug]   ${name}: type=stdio, command=${c.command}, args=${JSON.stringify(c.args)}, env keys=${c.env ? Object.keys(c.env).join(',') : 'none'}`)
    }
  }

  // 활성화된 전체 스킬 목록 (에이전트가 알아서 선택)
  const enabledSkills = settings.skills.filter((s) => s.enabled)

  const skillContext = enabledSkills.length > 0
    ? `\n\n사용 가능한 스킬:\n${enabledSkills.map((s) =>
        `- /${s.name}: ${s.description}`
      ).join('\n')}\n\n작업에 적합한 스킬이 있으면 해당 스킬의 지침에 따라 작업을 수행하세요. 여러 스킬을 조합할 수도 있습니다.`
    : ''

  // 서브에이전트에는 스킬 이름 목록만 전달 (토큰 절약)
  const subAgentSkillContext = enabledSkills.length > 0
    ? `\n\n사용 가능한 스킬: ${enabledSkills.map((s) => `/${s.name}`).join(', ')}`
    : ''

  // MCP 실행 환경 컨텍스트: 에이전트가 자신에게 주입된 MCP 서버를 정확히 인지하도록 안내
  const mcpKeys = Object.keys(mcpServersConfig)
  const mcpEnvironmentContext = mcpKeys.length > 0
    ? `\n\n## 실행 환경 안내
당신은 AR-AI 앱에서 Claude Agent SDK를 통해 실행되고 있습니다.
아래 MCP 서버가 이미 자동으로 주입되어 있으므로 별도 설정 없이 바로 사용할 수 있습니다:
${mcpKeys.map((name) => `- ${name}`).join('\n')}

중요:
- .mcp.json이나 ~/.claude.json을 확인하거나 수정할 필요가 없습니다.
- MCP 서버 설정을 사용자에게 안내하지 마세요. AR-AI 앱이 자동으로 관리합니다.
- API 토큰이나 인증 정보를 응답에 절대 포함하지 마세요.`
    : ''

  if (isOrchestrator) {
    queryOptions.systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT + sharedContext + todoContext + todoInstruction
    queryOptions.agents = AGENT_DEFINITIONS
  } else if (agentDef) {
    queryOptions.systemPrompt = agentDef.prompt + worktreeContext + mcpEnvironmentContext + skillContext + sharedContext + todoContext + todoInstruction
    // MCP 서버가 할당된 경우 allowedTools를 설정하지 않음 (MCP 도구가 mcp__서버명__도구명 패턴이라 화이트리스트로 차단됨)
    // MCP가 없으면 기존대로 allowedTools로 제한
    if (Object.keys(mcpServersConfig).length > 0) {
      queryOptions.disallowedTools = []  // 모든 도구 허용 (시스템 프롬프트로 가이드)
      delete queryOptions.allowedTools
    } else {
      queryOptions.allowedTools = [...(agentDef.tools || ['Read', 'Grep', 'Glob'])]
    }

    // 서브에이전트 할당 — MCP + 스킬 컨텍스트를 각 서브에이전트에 전파
    const subAgents = SUB_AGENTS[agentType]
    if (subAgents) {
      const mcpSpec = Object.keys(mcpServersConfig).length > 0 ? mcpServersConfig : undefined
      const enrichedAgents: Record<string, any> = {}
      for (const [name, agent] of Object.entries(subAgents)) {
        // 서브에이전트도 MCP가 있으면 allowedTools 제한 해제
        const subAgentTools = mcpSpec ? {} : { tools: agent.tools }
        enrichedAgents[name] = {
          ...agent,
          ...subAgentTools,
          // 서브에이전트에는 스킬 이름 목록만 전달 (토큰 절약)
          prompt: agent.prompt + subAgentSkillContext,
          // MCP 서버를 서브에이전트에도 전파 (SDK는 자동 상속하지 않음)
          // AgentMcpServerSpec[] = Array<string | Record<string, config>>
          ...(mcpSpec ? { mcpServers: Object.keys(mcpSpec).map((n) => ({ [n]: mcpSpec[n] })) } : {})
        }
      }
      queryOptions.agents = enrichedAgents
    }
  }

  // issue-collector 전처리: 이슈 트래킹 요청 감지 시 Google Chat 데이터 자동 수집
  let enrichedMessage = message
  if (agentType === 'issue-collector') {
    enrichedMessage = await preprocessIssueCollectorMessage(message, mainWindow, sessionId)
  }

  let fullContent = ''

  try {
    for await (const sdkMessage of query({ prompt: enrichedMessage, options: queryOptions })) {
      // abort 또는 창 닫힘 시 즉시 루프 탈출
      if (abortSignal?.aborted || mainWindow.isDestroyed()) break

      console.log('[AR-AI SDK Message]', sdkMessage.type)

      // [DEBUG] SDK init 메시지에서 MCP 서버 상태 확인
      if (sdkMessage.type === 'system' && (sdkMessage as any).subtype === 'init') {
        const initMsg = sdkMessage as any
        if (initMsg.mcp_servers) {
          console.log('[AR-AI MCP Debug] Init mcp_servers:', JSON.stringify(initMsg.mcp_servers))
        }
        if (initMsg.tools) {
          const mcpTools = (initMsg.tools as string[]).filter((t: string) => t.startsWith('mcp__'))
          console.log(`[AR-AI MCP Debug] MCP tools available (${mcpTools.length}):`, mcpTools.length > 0 ? mcpTools.join(', ') : 'NONE')
        }
      }

      // 첫 메시지에서 SDK 세션 ID 캡처 → 다음 대화에서 resume 용
      if ('session_id' in sdkMessage && (sdkMessage as any).session_id) {
        sdkSessionMap.set(agentType, (sdkMessage as any).session_id)
      }

      if (sdkMessage.type === 'auth_status') {
        const authMsg = sdkMessage as any
        if (authMsg.isAuthenticating) {
          for (const line of authMsg.output || []) {
            if (line.includes('https://')) {
              const urlMatch = line.match(/(https:\/\/[^\s]+)/)
              if (urlMatch) {
                shell.openExternal(urlMatch[1])
              }
            }
          }
          mainWindow.webContents.send('chat:auth-status', {
            isAuthenticating: true,
            message: authMsg.output?.join('\n') || '로그인 중...'
          })
        } else {
          mainWindow.webContents.send('chat:auth-status', {
            isAuthenticating: false,
            message: authMsg.error || '인증 완료'
          })
        }
        continue
      }

      const chunk = extractContent(sdkMessage)
      if (chunk) {
        fullContent += chunk
        mainWindow.webContents.send('chat:stream-chunk', {
          sessionId,
          content: chunk,
          done: false
        })
      }

      if (sdkMessage.type === 'result' && 'is_error' in sdkMessage && (sdkMessage as any).is_error) {
        const resultMsg = (sdkMessage as any).result || 'Unknown error'
        fullContent += `\n[에러] ${resultMsg}`
        mainWindow.webContents.send('chat:stream-chunk', {
          sessionId,
          content: `\n[에러] ${resultMsg}`,
          done: false
        })
      }
    }
  } catch (error: any) {
    // abort로 인한 에러는 정상 종료 — 무시
    const isAbortError = abortSignal?.aborted ||
      error?.code === 'EPIPE' ||
      error?.message?.includes('EPIPE') ||
      error?.name === 'AbortError' ||
      error?.message?.includes('aborted')
    if (isAbortError) {
      console.log('[AR-AI] Agent aborted:', agentType)
    } else {
      console.error('[AR-AI Agent Error]', error?.message, error?.stack)
      const parts: string[] = []
      if (error?.message) parts.push(`message: ${error.message}`)
      if (error?.stderr) parts.push(`stderr: ${error.stderr}`)
      if (error?.stdout) parts.push(`stdout: ${error.stdout}`)
      if (parts.length === 0) parts.push(String(error))
      fullContent = `오류가 발생했습니다:\n${parts.join('\n')}`
    }
  }

  // worktree 정리 (비동기, fire-and-forget — 응답 지연 방지)
  if (activeWorktrees.length > 0) {
    cleanupWorktreesAsync(activeWorktrees).catch((err) =>
      console.warn('[Worktree] 정리 중 오류:', err)
    )
  }

  const finalContent = fullContent || '응답이 없습니다.'

  // 공유 컨텍스트 보드에 요약 기록 (에러가 아닌 경우만)
  if (fullContent && !fullContent.startsWith('오류가 발생했습니다')) {
    const summary = extractSummary(message, fullContent)
    contextBoard.add(agentType, summary)

    // Todo 명령 파싱 및 실행
    if (!mainWindow.isDestroyed()) {
      processTodoCommands(agentType, fullContent, mainWindow)
    }
  }

  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat:stream-chunk', {
      sessionId,
      content: finalContent,
      done: true
    })
  }

  return finalContent
}

/** 에이전트 응답에서 [TODO:*] 명령을 파싱하여 실행 */
function processTodoCommands(agentType: string, content: string, mainWindow: BrowserWindow): void {
  const sm = getSessionManager()
  if (!sm) return
  let changed = false

  // [TODO:ADD] 내용
  const addMatches = content.matchAll(/\[TODO:ADD\]\s*(.+)/g)
  for (const m of addMatches) {
    sm.createTodo(agentType, m[1].trim())
    changed = true
  }

  // [TODO:DONE] id
  const doneMatches = content.matchAll(/\[TODO:DONE\]\s*(\S+)/g)
  for (const m of doneMatches) {
    sm.updateTodo(m[1].trim(), { done: true })
    changed = true
  }

  // [TODO:DELETE] id
  const deleteMatches = content.matchAll(/\[TODO:DELETE\]\s*(\S+)/g)
  for (const m of deleteMatches) {
    sm.deleteTodo(m[1].trim())
    changed = true
  }

  if (changed) {
    mainWindow.webContents.send('todo:updated', { agentType })
  }
}

/** 사용자 질문 + 응답에서 간단한 요약 생성 (토큰 절약을 위해 로컬 추출) */
function extractSummary(userMessage: string, response: string): string {
  // 질문 요약 (최대 30자)
  const question = userMessage.slice(0, 30).replace(/\n/g, ' ')
  // 응답 첫 줄에서 핵심 (최대 80자)
  const firstLine = response.split('\n').find((l) => l.trim().length > 5) || response
  const answer = firstLine.slice(0, 80).replace(/\n/g, ' ')
  return `Q: ${question}${userMessage.length > 30 ? '...' : ''} → ${answer}${firstLine.length > 80 ? '...' : ''}`
}

function extractContent(message: any): string | null {
  if (message.type === 'assistant' && message.message?.content) {
    const textBlocks = message.message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
    return textBlocks.length > 0 ? textBlocks.join('') : null
  }

  return null
}

/**
 * issue-collector 메시지 전처리:
 * "이슈 트래킹", "이슈 수집", "이슈 분석" 등의 요청을 감지하면
 * Google Chat API에서 메시지를 수집하여 원본 메시지에 첨부합니다.
 */
async function preprocessIssueCollectorMessage(
  message: string,
  mainWindow: BrowserWindow,
  sessionId: string
): Promise<string> {
  // 이슈 트래킹 관련 키워드 감지
  const trackingPatterns = [
    /이슈\s*트래킹/,
    /이슈\s*수집/,
    /이슈\s*분석/,
    /이슈\s*리포트/,
    /이슈\s*확인/,
    /이슈\s*모[아으]/,
    /이슈\s*정리/,
    /이슈\s*파악/,
    /이슈\s*요약/,
    /채팅?\s*분석/,
    /대화\s*내용/,
    /대화\s*분석/,
    /대화\s*가져/,
    /메시지\s*수집/,
    /메시지\s*가져/,
    /메시지\s*분석/,
    /구글\s*챗/,
    /google\s*chat/i,
    /chat\.google\.com/,
    /스쿼드/,
    /스페이스.*가져/,
    /채널.*이슈/
  ]

  const isTrackingRequest = trackingPatterns.some((p) => p.test(message))
  if (!isTrackingRequest) return message

  const settings = getSettings()
  // 메시지에서 스페이스 URL/ID 추출, 없으면 기본 설정 사용
  const spaceName = extractSpaceName(message, settings.googleChatDefaultSpace)
  if (!spaceName) {
    return message + '\n\n[시스템] Google Chat 기본 스페이스가 설정되지 않았습니다. 설정에서 기본 스페이스를 등록해주세요.'
  }
  if (!settings.googleChatCredentialsPath) {
    return message + '\n\n[시스템] Google Chat 인증 정보가 설정되지 않았습니다. 설정에서 Credentials 경로를 등록해주세요.'
  }

  // 날짜 파싱: "3월7일", "3/7", "2025-03-07", "어제", "오늘", "이번주" 등
  const dates = parseDateFromMessage(message)

  // 수집 중 알림
  mainWindow.webContents.send('chat:stream-chunk', {
    sessionId,
    content: `Google Chat 메시지를 수집하고 있습니다 (${dates.startDate} ~ ${dates.endDate})...\n\n`,
    done: false
  })

  try {
    const report = await collectIssues({
      spaceName,
      startDate: dates.startDate,
      endDate: dates.endDate
    })

    const analysisContext = formatMessagesForAnalysis(report.rawMessages)

    return `${message}

---
[시스템에서 자동 수집한 Google Chat 데이터]
- 스페이스: ${spaceName}
- 기간: ${dates.startDate} ~ ${dates.endDate}
- 수집된 메시지: ${report.totalMessages}개
- 키워드 필터링된 이슈 후보: ${report.issues.length}개

${analysisContext}
---

위 데이터를 분석하여 이슈 리포트를 생성해주세요.`
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const is404 = errMsg.includes('404') || errMsg.includes('Not Found')
    const hint = is404
      ? '\n가능한 원인: 스페이스 ID가 잘못되었거나, 로그인한 계정이 해당 스페이스에 접근 권한이 없습니다.\n설정에서 Google 계정을 다시 로그인하거나, 스페이스 URL을 확인해주세요.'
      : ''
    return message + `\n\n[시스템] Google Chat 메시지 수집 중 오류가 발생했습니다: ${errMsg}${hint}\n\n이 에러 내용을 사용자에게 전달하세요. 직접 API를 호출하지 마세요.`
  }
}

/** Google Chat URL 또는 스페이스 ID에서 spaces/XXX 형식을 추출합니다 */
function extractSpaceName(message: string, defaultSpace: string): string {
  // URL 형식: https://chat.google.com/room/AAQAm5mNpMk 또는 /app/chat/AAQAm5mNpMk
  const urlMatch = message.match(/chat\.google\.com\/(?:room|app\/chat)\/([A-Za-z0-9_-]+)/)
  if (urlMatch) return `spaces/${urlMatch[1]}`

  // spaces/XXX 형식이 직접 포함된 경우
  const spaceMatch = message.match(/spaces\/([A-Za-z0-9_-]+)/)
  if (spaceMatch) return `spaces/${spaceMatch[1]}`

  return defaultSpace
}

/** Date를 로컬 타임존 기준 YYYY-MM-DD로 변환 (toISOString은 UTC라 KST에서 하루 밀림) */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 사용자 메시지에서 날짜를 파싱합니다 */
function parseDateFromMessage(message: string): { startDate: string; endDate: string } {
  const now = new Date()
  const year = now.getFullYear()

  // "YYYY-MM-DD" 형식
  const isoMatch = message.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const date = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
    return { startDate: date, endDate: date }
  }

  // "M월D일" or "M/D" 형식
  const koreanMatch = message.match(/(\d{1,2})월\s*(\d{1,2})일/)
  const slashMatch = message.match(/(\d{1,2})\/(\d{1,2})/)
  const dateMatch = koreanMatch || slashMatch
  if (dateMatch) {
    const month = dateMatch[1].padStart(2, '0')
    const day = dateMatch[2].padStart(2, '0')
    // 범위: "3월5일~3월7일" or "3월5일부터 3월7일"
    const rangeMatch = message.match(/(\d{1,2})월\s*(\d{1,2})일\s*[~\-부터]\s*(\d{1,2})월\s*(\d{1,2})일/)
    if (rangeMatch) {
      const startMonth = rangeMatch[1].padStart(2, '0')
      const startDay = rangeMatch[2].padStart(2, '0')
      const endMonth = rangeMatch[3].padStart(2, '0')
      const endDay = rangeMatch[4].padStart(2, '0')
      return {
        startDate: `${year}-${startMonth}-${startDay}`,
        endDate: `${year}-${endMonth}-${endDay}`
      }
    }
    const date = `${year}-${month}-${day}`
    return { startDate: date, endDate: date }
  }

  // "어제"
  if (/어제/.test(message)) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return { startDate: toLocalDateString(yesterday), endDate: toLocalDateString(yesterday) }
  }

  // "오늘"
  if (/오늘/.test(message)) {
    return { startDate: toLocalDateString(now), endDate: toLocalDateString(now) }
  }

  // "이번주"
  if (/이번\s*주/.test(message)) {
    const monday = new Date(now)
    monday.setDate(monday.getDate() - monday.getDay() + 1)
    return {
      startDate: toLocalDateString(monday),
      endDate: toLocalDateString(now)
    }
  }

  // "지난 N일"
  const lastNDays = message.match(/지난\s*(\d+)\s*일/)
  if (lastNDays) {
    const daysAgo = new Date(now)
    daysAgo.setDate(daysAgo.getDate() - parseInt(lastNDays[1]))
    return {
      startDate: toLocalDateString(daysAgo),
      endDate: toLocalDateString(now)
    }
  }

  // 기본: 어제~오늘
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return {
    startDate: toLocalDateString(yesterday),
    endDate: toLocalDateString(now)
  }
}
