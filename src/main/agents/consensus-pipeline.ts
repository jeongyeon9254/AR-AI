import Anthropic from '@anthropic-ai/sdk'
import type { BrowserWindow } from 'electron'

export interface ConsensusStageEvent {
  sessionId: string
  stage: 1 | 2 | 3
  status: 'running' | 'done' | 'error'
  stageName: string
  model: string
}

const CRITIC_SYSTEM_PROMPT = `당신은 비판적 검토자(Devil's Advocate)입니다.
주어진 작업 결과물을 엄격하게 검토하세요.

검토 항목:
1. **정확성** — 원본 요청이 올바르게 구현되었는가?
2. **완전성** — 빠진 케이스, 엣지 케이스, 미처리 시나리오가 있는가?
3. **보안** — 취약점(XSS, SQL 인젝션, 인증 문제 등)이 있는가?
4. **성능** — 비효율적인 로직, 불필요한 복잡도가 있는가?
5. **코드 품질** — 가독성, 유지보수성, 프로젝트 컨벤션 준수 여부
6. **버그** — 잠재적 런타임 에러, null/undefined 처리 문제

문제를 발견하면 구체적으로 지적하세요. 문제가 없다면 "검토 완료: 주요 문제 없음"으로 응답하세요.

항상 한국어로 응답하세요.`

const ARBITRATOR_SYSTEM_PROMPT = `당신은 최종 결정자(Arbitrator)이자 수석 아키텍트입니다.
원본 요청, Stage 1의 제안, Stage 2의 비판을 종합하여 최고의 최종 답변을 도출하세요.

역할:
1. Stage 1 제안과 Stage 2 비판을 함께 분석
2. 타당한 비판은 반영하여 개선, 근거 없는 비판은 기각
3. 가장 정확하고 완전하며 실용적인 최종 답변 생성
4. Stage 1과 달라지는 부분이 있다면 그 이유를 간략히 언급

**중요**: 이것이 사용자에게 전달되는 최종 답변입니다. 완전하고 실행 가능한 내용을 제공하세요.

Todo 명령 규칙 (절대 준수):
사용자가 작업/태스크/할일/todo 생성을 요청했거나 Stage 1에 [TODO:ADD] 명령이 있었다면,
반드시 최종 답변 끝에 아래 형식을 포함하세요:
[TODO:ADD] 작업 제목
텍스트로만 "생성했습니다"라고 하는 것은 실제로 저장되지 않으므로 금지입니다.

항상 한국어로 응답하세요.`

/**
 * Stage 2 (Devil's Advocate / sonnet) + Stage 3 (Arbitrator / opus) 를 순차 실행합니다.
 * 각 단계 스트리밍은 chat:stream-chunk 로, 단계 상태는 chat:consensus-stage 로 전송됩니다.
 * 마지막에 done: true 청크를 전송하고 전체 합산 콘텐츠를 반환합니다.
 */
export async function runCriticAndArbitrator(options: {
  sessionId: string
  originalMessage: string
  stage1Output: string
  stage1AccumulatedContent: string
  mainWindow: BrowserWindow
  abortSignal?: AbortSignal
}): Promise<string> {
  const { sessionId, originalMessage, stage1Output, stage1AccumulatedContent, mainWindow, abortSignal } = options

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[Consensus] ANTHROPIC_API_KEY 미설정 — Stage 2/3 건너뜀')
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:stream-chunk', {
        sessionId,
        content: stage1AccumulatedContent,
        done: true
      })
    }
    return stage1AccumulatedContent
  }

  const client = new Anthropic({ apiKey })

  function emitStage(event: ConsensusStageEvent): void {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:consensus-stage', event)
    }
  }

  function sendChunk(content: string): void {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:stream-chunk', { sessionId, content, done: false })
    }
  }

  let stage2Output = ''
  let stage3Output = ''

  // ── Stage 2: Devil's Advocate (sonnet) ──────────────────────────────────
  emitStage({ sessionId, stage: 2, status: 'running', stageName: "Devil's Advocate", model: 'claude-sonnet-4-6' })
  sendChunk("\n\n---\n**Stage 2 · Devil's Advocate** *(sonnet)*\n\n")

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: CRITIC_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `[원본 요청]\n${originalMessage}\n\n[Stage 1: Proposer 결과]\n${stage1Output}\n\n위 결과물을 비판적으로 검토하세요.`
      }]
    })

    for await (const chunk of stream) {
      if (abortSignal?.aborted || mainWindow.isDestroyed()) break
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        stage2Output += chunk.delta.text
        sendChunk(chunk.delta.text)
      }
    }
    emitStage({ sessionId, stage: 2, status: 'done', stageName: "Devil's Advocate", model: 'claude-sonnet-4-6' })
  } catch (err) {
    console.error('[Consensus Stage 2 Error]', err)
    const errMsg = '*(Stage 2 오류로 건너뜀)*'
    stage2Output = errMsg
    sendChunk(errMsg)
    emitStage({ sessionId, stage: 2, status: 'error', stageName: "Devil's Advocate", model: 'claude-sonnet-4-6' })
  }

  // abort 시 done:true 미전송 — index.ts에서 이미 abort 확인 후 진입 안 하지만
  // 스트리밍 도중 abort된 경우를 위한 early return (중복 메시지 방지)
  if (abortSignal?.aborted) {
    return stage1AccumulatedContent
  }

  // ── Stage 3: Arbitrator (opus) ──────────────────────────────────────────
  emitStage({ sessionId, stage: 3, status: 'running', stageName: 'Arbitrator', model: 'claude-opus-4-6' })
  sendChunk('\n\n---\n**Stage 3 · Arbitrator — Final Answer** *(opus)*\n\n')

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      system: ARBITRATOR_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `[원본 요청]\n${originalMessage}\n\n[Stage 1: Proposer 결과]\n${stage1Output}\n\n[Stage 2: Devil's Advocate 검토]\n${stage2Output}\n\n위 내용을 종합하여 최종 최선의 답변을 제공하세요.`
      }]
    })

    for await (const chunk of stream) {
      if (abortSignal?.aborted || mainWindow.isDestroyed()) break
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        stage3Output += chunk.delta.text
        sendChunk(chunk.delta.text)
      }
    }
    emitStage({ sessionId, stage: 3, status: 'done', stageName: 'Arbitrator', model: 'claude-opus-4-6' })
  } catch (err) {
    console.error('[Consensus Stage 3 Error]', err)
    const errMsg = '*(Stage 3 오류로 건너뜀)*'
    stage3Output = errMsg
    sendChunk(errMsg)
    emitStage({ sessionId, stage: 3, status: 'error', stageName: 'Arbitrator', model: 'claude-opus-4-6' })
  }

  // 최종 전체 콘텐츠 조합
  const fullCombined = stage1AccumulatedContent
    + "\n\n---\n**Stage 2 · Devil's Advocate** *(sonnet)*\n\n"
    + stage2Output
    + '\n\n---\n**Stage 3 · Arbitrator — Final Answer** *(opus)*\n\n'
    + stage3Output

  // abort 시 done:true 미전송 — 중복 메시지 방지
  if (abortSignal?.aborted) {
    return fullCombined
  }

  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat:stream-chunk', { sessionId, content: fullCombined, done: true })
  }

  return fullCombined
}
