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
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface SessionState {
  // 에이전트별 영속 세션 매핑 (agentType → sessionId)
  agentSessions: Record<string, string>
  sessions: Session[]
  activeAgentType: string | null
  messages: ChatMessage[]
  loadingAgents: Set<string> // 현재 작업 중인 에이전트 추적
  streamingMessageId: string | null

  init: () => Promise<void>
  selectAgent: (agentType: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  abortAgent: () => Promise<void>
  addStreamChunk: (chunk: any) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  agentSessions: {},
  sessions: [],
  activeAgentType: null,
  messages: [],
  loadingAgents: new Set(),
  streamingMessageId: null,

  // 앱 시작 시 초기화: 각 에이전트별 세션 확인/생성
  init: async () => {
    const sessions = await window.electronAPI.listSessions()
    const agentSessions: Record<string, string> = {}

    // 기존 세션 매핑
    for (const session of sessions) {
      if (!agentSessions[session.agentType]) {
        agentSessions[session.agentType] = session.id
      }
    }

    // 없는 에이전트 세션 생성
    for (const agent of AGENT_TYPES) {
      if (!agentSessions[agent.id]) {
        const newSession = await window.electronAPI.createSession(agent.id)
        agentSessions[agent.id] = newSession.id
        sessions.push(newSession)
      }
    }

    set({ sessions, agentSessions })
  },

  selectAgent: async (agentType: string) => {
    const { agentSessions } = get()
    const sessionId = agentSessions[agentType]
    if (!sessionId) return

    const result = await window.electronAPI.getSession(sessionId)
    set({
      activeAgentType: agentType,
      messages: result?.messages || [],
      streamingMessageId: null
    })
  },

  sendMessage: async (content: string) => {
    const { activeAgentType, agentSessions } = get()
    if (!activeAgentType) return

    const sessionId = agentSessions[activeAgentType]
    if (!sessionId) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    }

    set((state) => ({
      messages: [...state.messages, userMessage],
      loadingAgents: new Set([...state.loadingAgents, activeAgentType])
    }))

    await window.electronAPI.sendMessage(sessionId, content)
  },

  abortAgent: async () => {
    const { activeAgentType, agentSessions } = get()
    if (!activeAgentType) return

    const sessionId = agentSessions[activeAgentType]
    if (!sessionId) return

    await window.electronAPI.abortMessage(sessionId)

    // 스트리밍 메시지 제거, 로딩 해제
    set((state) => {
      const newLoadingAgents = new Set(state.loadingAgents)
      newLoadingAgents.delete(activeAgentType)
      const messages = state.streamingMessageId
        ? state.messages.filter((m) => m.id !== state.streamingMessageId)
        : state.messages
      return { loadingAgents: newLoadingAgents, streamingMessageId: null, messages }
    })
  },

  addStreamChunk: (chunk: any) => {
    const { activeAgentType, agentSessions, streamingMessageId } = get()

    // 현재 보고 있는 에이전트의 세션인지 확인
    const activeSessionId = activeAgentType ? agentSessions[activeAgentType] : null
    const isActiveSession = chunk.sessionId === activeSessionId

    if (chunk.done) {
      // 어떤 에이전트의 세션이 완료되었는지 찾기
      const completedAgent = Object.entries(agentSessions).find(
        ([, sid]) => sid === chunk.sessionId
      )?.[0]

      if (isActiveSession) {
        set((state) => {
          const messagesWithoutStreaming = state.messages.filter(
            (m) => m.id !== state.streamingMessageId
          )
          const newLoadingAgents = new Set(state.loadingAgents)
          if (completedAgent) newLoadingAgents.delete(completedAgent)

          return {
            messages: [
              ...messagesWithoutStreaming,
              {
                id: crypto.randomUUID(),
                sessionId: chunk.sessionId,
                role: 'assistant' as const,
                content: chunk.content,
                createdAt: new Date().toISOString()
              }
            ],
            loadingAgents: newLoadingAgents,
            streamingMessageId: null
          }
        })
      } else {
        // 다른 에이전트 세션 완료 → 로딩 상태만 해제
        set((state) => {
          const newLoadingAgents = new Set(state.loadingAgents)
          if (completedAgent) newLoadingAgents.delete(completedAgent)
          return { loadingAgents: newLoadingAgents }
        })
      }
    } else if (isActiveSession) {
      // 현재 보고 있는 에이전트의 스트리밍 → UI 업데이트
      if (streamingMessageId) {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === state.streamingMessageId
              ? { ...m, content: m.content + chunk.content }
              : m
          )
        }))
      } else {
        const newId = crypto.randomUUID()
        set((state) => ({
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
        }))
      }
    }
  }
}))
