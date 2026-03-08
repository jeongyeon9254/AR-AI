import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk'
import { FE_DEVELOPER, FE_DEVELOPER_SUB_AGENTS } from './fe-developer'
import { BE_DEVELOPER, BE_DEVELOPER_SUB_AGENTS } from './be-developer'
import { ISSUE_COLLECTOR, ISSUE_COLLECTOR_SUB_AGENTS } from './issue-collector'
import { POLICY_EXPERT, POLICY_EXPERT_SUB_AGENTS } from './policy-expert'
import { QA_EXPERT, QA_EXPERT_SUB_AGENTS } from './qa-expert'
import { PO, PO_SUB_AGENTS } from './po'

/** 에이전트별 서브에이전트 정의 */
export const SUB_AGENTS: Record<string, Record<string, AgentDefinition>> = {
  'fe-developer': FE_DEVELOPER_SUB_AGENTS,
  'be-developer': BE_DEVELOPER_SUB_AGENTS,
  'issue-collector': ISSUE_COLLECTOR_SUB_AGENTS,
  'policy-expert': POLICY_EXPERT_SUB_AGENTS,
  'qa-expert': QA_EXPERT_SUB_AGENTS,
  po: PO_SUB_AGENTS
}

export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  'fe-developer': FE_DEVELOPER,
  'be-developer': BE_DEVELOPER,
  'issue-collector': ISSUE_COLLECTOR,
  'policy-expert': POLICY_EXPERT,
  'qa-expert': QA_EXPERT,
  po: PO
}

export const ORCHESTRATOR_SYSTEM_PROMPT = `당신은 AR-AI 오케스트레이터입니다.
사용자의 질문을 분석하여 적절한 서브에이전트에 작업을 위임합니다.

사용 가능한 에이전트:
- fe-developer: 프론트엔드 개발 (Core-Front 레포)
- be-developer: 백엔드 개발 (Alpha-Review 레포)
- issue-collector: 이슈 수집 및 리포트 생성
- policy-expert: 정책 분석 (양 레포 크로스 분석)
- qa-expert: QA 및 테스트
- po: 요구사항 및 의사결정 지원

필요시 여러 에이전트를 조합하여 작업하세요.
항상 한국어로 응답하세요.`
