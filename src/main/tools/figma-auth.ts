import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const KEYCHAIN_SERVICE = 'Claude Code-credentials'

interface McpOAuthEntry {
  serverName: string
  serverUrl: string
  accessToken: string
  expiresAt: number
  refreshToken?: string
  clientId?: string
  clientSecret?: string
}

interface ClaudeCodeCredentials {
  mcpOAuth?: Record<string, McpOAuthEntry>
}

/** macOS Keychain에서 Claude Code 자격증명 읽기 */
async function readClaudeKeychain(): Promise<ClaudeCodeCredentials | null> {
  try {
    const { stdout } = await execAsync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -w 2>/dev/null`
    )
    return JSON.parse(stdout.trim())
  } catch {
    return null
  }
}

/** Claude Code Keychain에서 Figma MCP 토큰 조회 */
async function getFigmaTokenFromKeychain(): Promise<McpOAuthEntry | null> {
  const creds = await readClaudeKeychain()
  if (!creds?.mcpOAuth) return null

  // serverUrl이 mcp.figma.com이고 accessToken이 있는 항목 찾기
  for (const entry of Object.values(creds.mcpOAuth)) {
    if (
      entry.serverUrl?.includes('mcp.figma.com') &&
      entry.accessToken &&
      entry.expiresAt > Date.now()
    ) {
      return entry
    }
  }
  return null
}

/** 현재 유효한 Figma access token 반환 */
export async function getFigmaAccessToken(): Promise<string | null> {
  const entry = await getFigmaTokenFromKeychain()
  return entry?.accessToken ?? null
}

/** 인증 상태 확인 */
export async function getAuthStatus(): Promise<{ authenticated: boolean; email?: string; source?: string }> {
  const entry = await getFigmaTokenFromKeychain()
  if (entry?.accessToken) {
    return { authenticated: true, source: 'Claude Code' }
  }
  return { authenticated: false }
}

/** 로그아웃 (AR-AI에서는 Keychain을 직접 수정하지 않음) */
export function clearAuth(): { success: boolean; message?: string } {
  return {
    success: false,
    message: 'Claude Code CLI에서 Figma MCP 연결을 해제하세요: claude mcp remove figma'
  }
}

/**
 * Claude Code CLI를 통해 Figma MCP 인증 시작
 * `claude mcp add`로 등록하면 Claude Code가 OAuth를 처리함
 */
export async function startOAuthFlow(): Promise<{ success: boolean; email?: string; error?: string }> {
  // 이미 유효한 토큰이 있으면 바로 반환
  const existing = await getFigmaTokenFromKeychain()
  if (existing?.accessToken) {
    return { success: true }
  }

  return {
    success: false,
    error: 'Claude Code에서 먼저 Figma MCP를 인증해주세요.\n터미널에서: claude mcp add figma --transport http https://mcp.figma.com/mcp'
  }
}
