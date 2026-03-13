import { google } from 'googleapis'
import { app, shell } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { getSettings } from '../config'

export interface ChatMessage {
  sender: string
  text: string
  createTime: string
  threadId?: string
  messageName?: string  // spaces/xxx/messages/xxx 형식
}

export interface IssueReport {
  startDate: string
  endDate: string
  spaceName: string
  totalMessages: number
  issues: { summary: string; sender: string; time: string; threadId?: string }[]
  rawMessages: ChatMessage[]
}

export interface CollectOptions {
  spaceName: string
  startDate?: string  // YYYY-MM-DD (기본: 어제)
  endDate?: string    // YYYY-MM-DD (기본: 오늘)
  pageSize?: number   // 기본: 500
}

const SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/userinfo.email'
]

const REDIRECT_PORT = 18234
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`

/** 토큰 저장 경로 */
function getTokenPath(): string {
  return join(app.getPath('userData'), 'google-chat-token.json')
}

/** 저장된 토큰 로드 */
function loadSavedToken(): any | null {
  const tokenPath = getTokenPath()
  if (!existsSync(tokenPath)) return null
  try {
    return JSON.parse(readFileSync(tokenPath, 'utf-8'))
  } catch {
    return null
  }
}

/** 토큰 저장 */
function saveToken(token: any): void {
  writeFileSync(getTokenPath(), JSON.stringify(token, null, 2))
}

/** OAuth2 클라이언트 생성 */
function createOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
  const settings = getSettings()
  if (!settings.googleChatCredentialsPath) {
    throw new Error('Google OAuth 클라이언트 정보가 설정되지 않았습니다. 설정에서 경로를 지정해주세요.')
  }

  const raw = JSON.parse(readFileSync(settings.googleChatCredentialsPath, 'utf-8'))
  // OAuth credentials.json 형식: { installed: { client_id, client_secret, ... } }
  // 또는 { web: { client_id, client_secret, ... } }
  const creds = raw.installed || raw.web
  if (!creds) {
    throw new Error('올바른 OAuth 클라이언트 JSON 파일이 아닙니다. Google Cloud Console에서 "Desktop App" 타입으로 생성해주세요.')
  }

  return new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI)
}

/** Google Chat 메시지 링크 생성 (스레드 댓글창이 열리도록) */
function buildMessageLink(messageName?: string, threadId?: string): string | null {
  if (!messageName) return null
  // messageName: "spaces/AAQAl9Ef9UA/messages/xxxxxx"
  const parts = messageName.split('/')
  if (parts.length >= 4) {
    const spaceId = parts[1]
    const messageId = parts[3]
    // threadId: "spaces/AAQAl9Ef9UA/threads/yyyyyy"
    const threadParts = threadId?.split('/')
    const threadKey = threadParts && threadParts.length >= 4 ? threadParts[3] : undefined
    if (threadKey) {
      return `https://chat.google.com/room/${spaceId}/${threadKey}/${messageId}`
    }
    return `https://chat.google.com/room/${spaceId}/${messageId}`
  }
  return null
}

/** 인증된 OAuth2 클라이언트 가져오기 (토큰 자동 갱신) */
function buildAuth(): InstanceType<typeof google.auth.OAuth2> {
  const client = createOAuth2Client()
  const token = loadSavedToken()

  if (!token) {
    throw new Error('Google Chat 인증이 필요합니다. 설정에서 "Google 로그인" 버튼을 눌러주세요.')
  }

  if (!token.refresh_token) {
    throw new Error('Google 인증 정보에 refresh_token이 없습니다. 설정에서 Google 계정을 다시 로그인해주세요.')
  }

  client.setCredentials(token)

  // 토큰 갱신 시 자동 저장 — null 값은 제외하여 refresh_token 보존
  client.on('tokens', (newTokens) => {
    const filtered: Record<string, any> = {}
    for (const [k, v] of Object.entries(newTokens)) {
      if (v !== null && v !== undefined) filtered[k] = v
    }
    const merged = { ...token, ...filtered }
    console.log('[Google OAuth] Token refreshed, saving. hasRefreshToken:', !!merged.refresh_token)
    saveToken(merged)
  })

  return client
}

/**
 * OAuth2 인증 플로우 시작
 * 브라우저에서 Google 로그인 → 로컬 서버에서 콜백 수신 → 토큰 저장
 */
export function startOAuthFlow(): Promise<{ success: boolean; email?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const client = createOAuth2Client()

      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      })

      // 로컬 HTTP 서버로 콜백 수신
      const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:${REDIRECT_PORT}`)

        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404)
          res.end()
          return
        }

        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body><h2>인증 실패</h2><p>창을 닫아주세요.</p></body></html>')
          server.close()
          resolve({ success: false, error: `Google 인증 거부: ${error}` })
          return
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body><h2>인증 코드 없음</h2><p>창을 닫고 다시 시도해주세요.</p></body></html>')
          server.close()
          resolve({ success: false, error: '인증 코드를 받지 못했습니다.' })
          return
        }

        try {
          const tokenResponse = await client.getToken(code)
          const tokens = tokenResponse.tokens
          console.log('[Google OAuth] Token obtained:', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            scope: tokens.scope
          })

          if (!tokens.access_token) {
            throw new Error('액세스 토큰을 받지 못했습니다. OAuth 클라이언트 설정을 확인해주세요.')
          }

          client.setCredentials(tokens)
          saveToken(tokens)

          // 사용자 이메일 가져오기 (실패해도 로그인은 성공)
          let email = '인증됨'
          try {
            const oauth2 = google.oauth2({ version: 'v2', auth: client })
            const userInfo = await oauth2.userinfo.get()
            email = userInfo.data.email || email
          } catch (infoErr) {
            console.log('[Google OAuth] userinfo 조회 실패 (무시):', infoErr)
          }

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<html><body><h2>인증 완료!</h2><p>${email}로 로그인되었습니다.</p><p>이 창을 닫아주세요.</p></body></html>`)
          server.close()
          resolve({ success: true, email })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error('[Google OAuth] Token exchange failed:', errMsg)
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<html><body><h2>토큰 교환 실패</h2><p>${errMsg}</p><p>창을 닫고 다시 시도해주세요.</p></body></html>`)
          server.close()
          resolve({ success: false, error: errMsg })
        }
      })

      server.listen(REDIRECT_PORT, () => {
        shell.openExternal(authUrl)
      })

      // 2분 타임아웃
      setTimeout(() => {
        server.close()
        resolve({ success: false, error: '인증 타임아웃 (2분 초과)' })
      }, 120000)
    } catch (err) {
      resolve({ success: false, error: err instanceof Error ? err.message : String(err) })
    }
  })
}

/** 현재 인증 상태 확인 */
export function getAuthStatus(): { authenticated: boolean; email?: string; tokenPath: string; hasRefreshToken?: boolean } {
  const tokenPath = getTokenPath()
  const token = loadSavedToken()
  return {
    authenticated: !!token && !!token.refresh_token,
    hasRefreshToken: !!token?.refresh_token,
    tokenPath
  }
}

/** 인증 해제 (토큰 삭제) */
export function clearAuth(): void {
  const tokenPath = getTokenPath()
  if (existsSync(tokenPath)) {
    writeFileSync(tokenPath, '')
  }
}

/**
 * Google Chat API를 통해 특정 스페이스의 메시지를 수집합니다.
 * 날짜 범위를 지정할 수 있으며, 페이지네이션을 지원합니다.
 */
export async function collectMessages(options: CollectOptions): Promise<ChatMessage[]> {
  const auth = buildAuth()
  const chat = google.chat({ version: 'v1', auth })

  // 날짜 범위 계산
  const now = new Date()
  let start: Date
  let end: Date

  if (options.startDate) {
    start = new Date(options.startDate + 'T00:00:00')
  } else {
    start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
  }

  if (options.endDate) {
    end = new Date(options.endDate + 'T23:59:59')
  } else {
    end = new Date(now)
    end.setHours(23, 59, 59, 999)
  }

  const pageSize = options.pageSize || 500
  const allMessages: ChatMessage[] = []
  let pageToken: string | undefined

  do {
    const response = await chat.spaces.messages.list({
      parent: options.spaceName,
      filter: `createTime > "${start.toISOString()}" AND createTime < "${end.toISOString()}"`,
      pageSize,
      pageToken
    })

    const messages = (response.data.messages || []).map((msg: any) => ({
      sender: msg.sender?.displayName || 'Unknown',
      text: msg.text || '',
      createTime: msg.createTime || '',
      threadId: msg.thread?.name || undefined,
      messageName: msg.name || undefined
    }))

    allMessages.push(...messages)
    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return allMessages
}

/**
 * 수집된 메시지에서 이슈 키워드로 필터링합니다.
 */
export function filterIssueMessages(messages: ChatMessage[]): ChatMessage[] {
  const issueKeywords = [
    '이슈', '버그', '오류', '에러', '장애', '긴급', '문제', '수정', '핫픽스',
    'bug', 'error', 'issue', 'critical', 'hotfix', 'fix', 'broken', 'fail',
    '안됨', '안돼', '동작안', '작동안', '먹통', '크래시', 'crash'
  ]

  return messages.filter((msg) =>
    issueKeywords.some((keyword) => msg.text.toLowerCase().includes(keyword.toLowerCase()))
  )
}

/**
 * Google Chat 메시지를 수집하고 이슈 리포트를 생성합니다.
 */
export async function collectIssues(options: CollectOptions): Promise<IssueReport> {
  const messages = await collectMessages(options)
  const issueMessages = filterIssueMessages(messages)

  const now = new Date()
  const startDate = options.startDate || (() => {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()
  const endDate = options.endDate || now.toISOString().split('T')[0]

  return {
    startDate,
    endDate,
    spaceName: options.spaceName,
    totalMessages: messages.length,
    issues: issueMessages.map((msg) => ({
      summary: msg.text.substring(0, 300),
      sender: msg.sender,
      time: msg.createTime,
      threadId: msg.threadId
    })),
    rawMessages: messages
  }
}

/**
 * 이슈 리포트를 마크다운 형식으로 포맷팅합니다.
 */
export function formatIssueReport(report: IssueReport): string {
  const lines: string[] = [
    `# 이슈 리포트 (${report.startDate} ~ ${report.endDate})`,
    '',
    `**채널:** ${report.spaceName}`,
    `**총 메시지:** ${report.totalMessages}개`,
    `**이슈 관련 메시지:** ${report.issues.length}개`,
    ''
  ]

  if (report.issues.length === 0) {
    lines.push('> 이슈 관련 메시지가 없습니다.')
  } else {
    lines.push('## 이슈 목록', '')
    report.issues.forEach((issue, i) => {
      const time = new Date(issue.time).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      lines.push(`### ${i + 1}. ${issue.sender} (${time})`)
      lines.push(issue.summary)
      lines.push('')
    })
  }

  return lines.join('\n')
}

/**
 * 에이전트 분석용: 전체 대화를 컨텍스트로 변환합니다.
 * 에이전트가 AI 분석을 수행할 수 있도록 원본 메시지를 구조화합니다.
 */
export function formatMessagesForAnalysis(messages: ChatMessage[]): string {
  if (messages.length === 0) return '수집된 메시지가 없습니다.'

  // 스레드별로 그룹화
  const threads = new Map<string, ChatMessage[]>()
  const noThread: ChatMessage[] = []

  for (const msg of messages) {
    if (msg.threadId) {
      const existing = threads.get(msg.threadId) || []
      existing.push(msg)
      threads.set(msg.threadId, existing)
    } else {
      noThread.push(msg)
    }
  }

  const lines: string[] = [`## 수집된 대화 (총 ${messages.length}개 메시지)\n`]

  // 스레드 대화
  if (threads.size > 0) {
    lines.push(`### 스레드 대화 (${threads.size}개 스레드)\n`)
    let threadIdx = 1
    for (const [, msgs] of threads) {
      lines.push(`#### 스레드 ${threadIdx} (${msgs.length}개 메시지)`)
      for (const msg of msgs) {
        const time = new Date(msg.createTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        const link = buildMessageLink(msg.messageName, msg.threadId)
        lines.push(`- **${msg.sender}** (${time}): ${msg.text}${link ? ` [링크](${link})` : ''}`)
      }
      lines.push('')
      threadIdx++
    }
  }

  // 단독 메시지
  if (noThread.length > 0) {
    lines.push(`### 개별 메시지 (${noThread.length}개)\n`)
    for (const msg of noThread) {
      const time = new Date(msg.createTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      const link = buildMessageLink(msg.messageName, msg.threadId)
      lines.push(`- **${msg.sender}** (${time}): ${msg.text}${link ? ` [링크](${link})` : ''}`)
    }
  }

  return lines.join('\n')
}
