import { create } from 'zustand'

export const AGENT_TYPES = [
  { id: 'fe-developer', label: 'FE Developer', icon: '🖥' },
  { id: 'be-developer', label: 'BE Developer', icon: '⚙' },
  { id: 'issue-collector', label: 'Issue Manager', icon: '📋' },
  { id: 'policy-expert', label: 'Policy Manager', icon: '📜' },
  { id: 'qa-expert', label: 'QA Manager', icon: '🧪' },
  { id: 'po', label: 'Project Owner', icon: '📊' }
] as const

export interface Session {
  id: string
  agentType: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface FileAttachmentInfo {
  name: string
  mediaType: string
  /** base64 데이터 (이미지 미리보기용, 큰 파일은 생략) */
  data?: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  attachments?: FileAttachmentInfo[]
  createdAt: string
}

interface SessionState {
  // projectId+agentType → sessionId
  agentSessions: Record<string, string>
  sessions: Session[]
  activeAgentType: string | null
  activeProjectId: string | null
  activeSessionId: string | null  // 현재 활성 세션 ID (직접 추적)
  messages: ChatMessage[]
  loadingAgents: Record<string, boolean>  // sessionId → boolean
  streamingMessageId: string | null

  init: () => Promise<void>
  initProject: (projectId: string) => Promise<void>
  selectAgent: (agentType: string, projectId?: string) => Promise<void>
  sendMessage: (content: string, attachments?: Array<{ name: string; data: string; mediaType: string }>) => void
  clearChat: () => Promise<void>
  abortAgent: () => Promise<void>
  addStreamChunk: (chunk: any) => void
  forceStopLoading: (sessionId: string) => void
  syncLoadingState: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  agentSessions: {},
  sessions: [],
  activeAgentType: null,
  activeProjectId: null,
  activeSessionId: null,
  messages: [],
  loadingAgents: {},
  streamingMessageId: null,

  // 기존 레거시 init (projectId 없는 세션용)
  init: async () => {
    const sessions = await window.electronAPI.listSessions()
    set({ sessions })
  },

  // 프로젝트별 세션 초기화
  initProject: async (projectId: string) => {
    const sessions = await window.electronAPI.getProjectSessions(projectId)
    const agentSessions: Record<string, string> = { ...get().agentSessions }
    for (const session of sessions) {
      agentSessions[`${projectId}:${session.agentType}`] = session.id
    }
    set((state) => ({ sessions: [...state.sessions.filter((s) => s.projectId !== projectId), ...sessions], agentSessions }))
  },

  selectAgent: async (agentType: string, projectId?: string) => {
    const { agentSessions } = get()
    const key = projectId ? `${projectId}:${agentType}` : agentType
    const sessionId = agentSessions[key]
    if (!sessionId) return

    set({ activeAgentType: agentType, activeProjectId: projectId || null, activeSessionId: sessionId, messages: [], streamingMessageId: null })

    const result = await window.electronAPI.getSession(sessionId)
    if (get().activeAgentType !== agentType) return
    set({ messages: result?.messages || [] })

    // 메인 프로세스와 로딩 상태 동기화 — 실제 실행 중이지 않으면 stale 상태 해제
    if (get().loadingAgents[sessionId]) {
      try {
        const isRunning = await window.electronAPI.isAgentRunning(sessionId)
        if (!isRunning) get().forceStopLoading(sessionId)
      } catch {
        // 무시
      }
    }
  },

  sendMessage: (content: string, attachments?: Array<{ name: string; data: string; mediaType: string }>) => {
    const { activeAgentType, activeProjectId, agentSessions } = get()
    if (!activeAgentType) return

    const key = activeProjectId ? `${activeProjectId}:${activeAgentType}` : activeAgentType
    const sessionId = agentSessions[key]
    if (!sessionId) return

    // UI 표시용 첨부파일 정보 (이미지만 data 포함, 나머지는 이름만)
    const attachmentInfos: FileAttachmentInfo[] | undefined = attachments?.map((a) => ({
      name: a.name,
      mediaType: a.mediaType,
      data: a.mediaType.startsWith('image/') ? a.data : undefined
    }))

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content,
      attachments: attachmentInfos,
      createdAt: new Date().toISOString()
    }

    set((state) => ({
      messages: [...state.messages, userMessage],
      loadingAgents: { ...state.loadingAgents, [sessionId]: true }
    }))

    // IPC를 fire-and-forget으로 처리 — UI 블로킹 방지
    window.electronAPI.sendMessage(sessionId, content, attachments)
      .then((result) => {
        // 세션 not found 등 메인 프로세스에서 실패 반환 시 로딩 상태 해제
        if (result && !result.success) {
          get().forceStopLoading(sessionId)
        }
      })
      .catch((err) => {
        console.error('[sendMessage] IPC error:', err)
        // IPC 채널 자체 실패 시에도 로딩 상태 해제
        get().forceStopLoading(sessionId)
      })
  },

  clearChat: async () => {
    const { activeAgentType, activeProjectId, agentSessions } = get()
    if (!activeAgentType) return

    const key = activeProjectId ? `${activeProjectId}:${activeAgentType}` : activeAgentType
    const sessionId = agentSessions[key]
    if (!sessionId) return

    await window.electronAPI.clearMessages(sessionId)
    set({ messages: [], streamingMessageId: null })
  },

  abortAgent: async () => {
    const { activeAgentType, activeProjectId, agentSessions } = get()
    if (!activeAgentType) return

    const key = activeProjectId ? `${activeProjectId}:${activeAgentType}` : activeAgentType
    const sessionId = agentSessions[key]
    if (!sessionId) return

    await window.electronAPI.abortMessage(sessionId)

    // 스트리밍 메시지 제거, 로딩 해제
    set((state) => {
      const { [sessionId]: _, ...rest } = state.loadingAgents
      const messages = state.streamingMessageId
        ? state.messages.filter((m) => m.id !== state.streamingMessageId)
        : state.messages
      return { loadingAgents: rest, streamingMessageId: null, messages }
    })
  },

  addStreamChunk: (chunk: any) => {
    if (chunk.done) {
      set((state) => {
        const chunkSid = chunk.sessionId
        // set() 콜백 내부에서 최신 state 값으로 비교 (stale closure 방지)
        const isActive = chunkSid === state.activeSessionId
        const wasLoading = !!state.loadingAgents[chunkSid]
        const newLoadingAgents = Object.fromEntries(
          Object.entries(state.loadingAgents).filter(([k]) => k !== chunkSid)
        )

        if (isActive && wasLoading) {
          // 정상 완료: 스트리밍 메시지를 최종 메시지로 교체
          const messagesWithoutStreaming = state.messages.filter(
            (m) => m.id !== state.streamingMessageId
          )
          return {
            messages: [
              ...messagesWithoutStreaming,
              {
                id: crypto.randomUUID(),
                sessionId: chunkSid,
                role: 'assistant' as const,
                content: chunk.content,
                createdAt: new Date().toISOString()
              }
            ],
            loadingAgents: newLoadingAgents,
            streamingMessageId: null
          }
        } else if (isActive && !wasLoading && state.streamingMessageId) {
          // abort 후 late done:true 도착 — 스트리밍 메시지만 제거, 새 메시지 추가 안 함
          return {
            messages: state.messages.filter((m) => m.id !== state.streamingMessageId),
            loadingAgents: newLoadingAgents,
            streamingMessageId: null
          }
        } else {
          // 비활성 세션: loadingAgents만 정리
          return { loadingAgents: newLoadingAgents }
        }
      })
    } else {
      // done: false 청크는 현재 최신 activeSessionId 기준으로 처리
      set((state) => {
        if (chunk.sessionId !== state.activeSessionId) return state

        if (state.streamingMessageId) {
          return {
            messages: state.messages.map((m) =>
              m.id === state.streamingMessageId
                ? { ...m, content: m.content + chunk.content }
                : m
            )
          }
        } else {
          const newId = crypto.randomUUID()
          return {
            streamingMessageId: newId,
            messages: [
              ...state.messages,
              {
                id: newId,
                sessionId: chunk.sessionId,
                role: 'assistant' as const,
                content: chunk.content,
                createdAt: new Date().toISOString()
              }
            ]
          }
        }
      })
    }
  },

  // 특정 세션의 로딩 상태를 강제 해제
  forceStopLoading: (sessionId: string) => {
    set((state) => {
      if (!state.loadingAgents[sessionId]) return state
      const { [sessionId]: _, ...rest } = state.loadingAgents
      return {
        loadingAgents: rest,
        // 해당 세션의 스트리밍 메시지도 정리
        streamingMessageId: state.activeSessionId === sessionId ? null : state.streamingMessageId,
        messages: state.activeSessionId === sessionId && state.streamingMessageId
          ? state.messages.filter((m) => m.id !== state.streamingMessageId)
          : state.messages
      }
    })
  },

  // 메인 프로세스의 실행 상태와 loadingAgents 동기화
  syncLoadingState: async () => {
    const { loadingAgents } = get()
    const loadingSessionIds = Object.keys(loadingAgents)
    if (loadingSessionIds.length === 0) return

    await Promise.all(
      loadingSessionIds.map(async (sessionId) => {
        try {
          const isRunning = await window.electronAPI.isAgentRunning(sessionId)
          if (!isRunning) {
            get().forceStopLoading(sessionId)
          }
        } catch {
          // IPC 실패 시 무시
        }
      })
    )
  }
}))
