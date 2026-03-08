---
description: PRD/기능 계획 워크플로우 — Goal → Pre-plan → 고도화 → Plan 확정 → 실행
---

# Planning Workflow

$ARGUMENTS

## 워크플로우

```
Goal(사용자) → Pre-plan(Claude) → 고도화(협업) → Plan 확정(사용자) → 실행(오케스트레이션)
```

## 단계별 상세

### 1단계: Goal (사용자)
- `.claude/goal/[기능명].md` 파일 확인
- reference 자료 포함 여부 확인
- **Goal 문서 없이 시작 금지** — 없으면 사용자에게 작성 요청

### 2단계: Pre-plan (Claude)
- Goal 분석 후 `.claude/pre-plan/[기능명].md` 작성
- 분석 에이전트 활용:
  - `metis` → 요구사항/리스크/누락된 질문 분석
  - `explore` / `explore-medium` → 코드베이스 탐색 (관련 파일, 기존 패턴)
- Pre-plan 내용:
  - 요구사항 요약
  - 영향 범위 분석 (어떤 앱/모듈에 영향)
  - 기술적 접근 방식
  - 리스크 및 미해결 질문
  - 대략적 Task 분해

### 3단계: 고도화 (협업)
- 사용자가 Pre-plan 검토
- 피드백 반영하여 Pre-plan 수정
- 반복: 사용자 컨펌될 때까지

### 4단계: Plan 확정 (사용자)
- 사용자가 확정하면 `.claude/plan/[기능명].md`로 이동
- 계획 에이전트 활용:
  - `prometheus` → 전략적 계획 수립, TODO 구조화
  - `momus` → 계획 비평 및 품질 검증
- Plan 파일 구조:
  ```markdown
  # [기능명] Plan

  Created: [timestamp]
  Status: CONFIRMED

  ## 요구사항 요약
  - [bullet points]

  ## 수용 기준
  - [ ] AC1: [테스트 가능한 기준]
  - [ ] AC2: [테스트 가능한 기준]

  ## Task 목록

  ### Phase 1: [Phase Name]
  - [ ] TASK-001: [설명] | Agent: [agent-type] | Files: [file:line]
  - [ ] TASK-002: [설명] | Agent: [agent-type] | Files: [file:line]

  ### Phase 2: [Phase Name]
  - [ ] TASK-003: [설명] | Agent: [agent-type] | Files: [file:line]

  ## 리스크 & 대응
  | 리스크 | 영향 | 대응 |
  |--------|------|------|
  | [risk] | H/M/L | [mitigation] |

  ## 검증 단계
  - [ ] [verification step]
  ```

### 5단계: 실행 (오케스트레이션)
- Plan의 Task를 기반으로 에이전트 실행
- Task 완료 시 Plan 파일에서 체크 (`[x]`)
- Phase 완료 시 상태 업데이트

## 에이전트 역할 매핑

| 단계 | 에이전트 | 용도 |
|------|----------|------|
| 분석 | `metis` | 요구사항/리스크 분석, 누락 질문 발견 |
| 분석 | `explore` / `explore-medium` | 코드베이스 탐색, 관련 파일 찾기 |
| 계획 | `prometheus` | 전략적 계획 수립, TODO 구조화 |
| 계획 | `momus` | 계획 비평, 품질 검증 |
| 구현 | `frontend-engineer[-high]` | UI/컴포넌트 작업 |
| 구현 | `angular-master` | Angular 아키텍처/코드 리뷰 |
| 구현 | `sisyphus-junior[-high]` | 비즈니스 로직 구현 |
| 구현 | `oracle` | 아키텍처 판단/디버깅 자문 |
| 검증 | `qa-tester` | E2E/CLI 테스트 |
| 검증 | `document-writer` | 문서화 |

## 실행 패턴

### 병렬 실행 조건
- 2개 이상 독립 작업
- 각 작업 예상 시간 >30초
- 작업 간 의존성 없음

### 순차 실행 조건
- 의존성 존재 (B가 A 결과에 의존)
- 이전 결과에 따라 다음 결정이 달라짐

### 백그라운드 실행
- 빌드, 테스트, 패키지 설치
- 결과를 기다리지 않고 다음 작업 진행

## 주의사항

1. **Goal 문서 없이 시작 금지** — 반드시 `.claude/goal/[기능명].md` 확인
2. **Pre-plan 사용자 컨펌 필수** — 컨펌 없이 Plan으로 넘어가지 않음
3. **한국어 응답** — 모든 문서 및 응답은 한국어
4. **Plan 수정 이력** — 큰 변경 시 이유를 Plan 파일에 기록
