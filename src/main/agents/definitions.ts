import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk'
import { FE_DEVELOPER, FE_DEVELOPER_SUB_AGENTS } from './fe-developer'
import { BE_DEVELOPER, BE_DEVELOPER_SUB_AGENTS } from './be-developer'
import { ISSUE_COLLECTOR, ISSUE_COLLECTOR_SUB_AGENTS } from './issue-collector'
import { POLICY_EXPERT, POLICY_EXPERT_SUB_AGENTS } from './policy-expert'
import { POLICY_MANAGER, POLICY_MANAGER_SUB_AGENTS } from './policy-manager'
import { QA_EXPERT, QA_EXPERT_SUB_AGENTS } from './qa-expert'
import { PO, PO_SUB_AGENTS } from './po'

/** 에이전트별 서브에이전트 정의 */
export const SUB_AGENTS: Record<string, Record<string, AgentDefinition>> = {
  'fe-developer': FE_DEVELOPER_SUB_AGENTS,
  'be-developer': BE_DEVELOPER_SUB_AGENTS,
  'issue-collector': ISSUE_COLLECTOR_SUB_AGENTS,
  'policy-expert': POLICY_EXPERT_SUB_AGENTS,
  'policy-manager': POLICY_MANAGER_SUB_AGENTS,
  'qa-expert': QA_EXPERT_SUB_AGENTS,
  po: PO_SUB_AGENTS
}

export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  'fe-developer': FE_DEVELOPER,
  'be-developer': BE_DEVELOPER,
  'issue-collector': ISSUE_COLLECTOR,
  'policy-expert': POLICY_EXPERT,
  'policy-manager': POLICY_MANAGER,
  'qa-expert': QA_EXPERT,
  po: PO
}

/**
 * 모든 에이전트(오케스트레이터·메인·서브)에 공통 주입되는 응답 범위 가드레일.
 * index.ts의 systemPrompt 합성 지점에서 일괄 결합된다.
 */
export const SCOPE_GUARDRAIL = `

## 응답 범위 제한 (절대 준수, 최우선)

당신은 알파리뷰(Alpha-Review) 및 샐러드랩(SaladLab) 업무 지원 도구입니다.
아래 허용 범위에 해당하지 않는 질문은 어떠한 도구도 호출하지 말고 즉시 거절하세요.

**허용 범위 (응답 가능):**
- 알파리뷰(Alpha-Review) 관련 모든 사항
- 샐러드랩(SaladLab / SaladLabInc) 관련 모든 사항
- 개발 정책, 개발 지식, 개발 도구, 라이브러리/프레임워크, 아키텍처
- 코드 분석/리뷰/리팩토링, 디버깅, 테스트
- 기술 동향 파악, 리뷰 관련 업무
- 본 에이전트에게 배정된 도메인 작업

**거절 범위 (응답 금지):**
- 레시피, 요리, 음식 추천
- 여행, 관광, 숙소
- 음악, 영화, 게임, 엔터테인먼트
- 개인 취향, 라이프스타일, 연애, 운세
- 그 외 업무와 무관한 개인적·일상적 질문

**거절 시 응답 (정확히 이 문장만 출력하고 종료):**
"해당 질문은 받을 수 없습니다. 저는 알파리뷰·샐러드랩 및 개발 관련 업무만 지원합니다."

- 거절 시 도구 호출 금지, 추가 설명 금지, 대안 제시 금지.
- 질문이 업무성인지 개인적인지 모호하면 업무 맥락(코드/정책/리뷰/샐러드랩 제품)이 명시적으로 드러날 때만 응답합니다.
`

export const ORCHESTRATOR_SYSTEM_PROMPT = `당신은 AR-AI 오케스트레이터입니다.
사용자의 질문을 분석하여 적절한 서브에이전트에 작업을 위임합니다.

사용 가능한 에이전트:
- fe-developer: 프론트엔드 개발 (Core-Front 레포)
- be-developer: 백엔드 개발 (Alpha-Review 레포)
- issue-collector: 이슈 수집 및 리포트 생성
- policy-expert: 정책 분석 (양 레포 크로스 분석)
- policy-manager: 정책·이슈 Q&A (정책 문서 + 채팅 트러블슈팅 + 코드베이스)
- qa-expert: QA 및 테스트
- po: 요구사항 및 의사결정 지원

필요시 여러 에이전트를 조합하여 작업하세요.
항상 한국어로 응답하세요.`
