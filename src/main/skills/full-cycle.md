---
description: 자율 완결 개발 사이클 — Plan → 개발 → TC 생성/수정 → 리뷰까지 일괄 수행
---

# Full Cycle Development

$ARGUMENTS

## 개요
Plan 생성부터 개발, TC(Test Case) 생성/수정, 코드 리뷰까지 **사용자 개입 없이 자율적으로 완결**하는 개발 사이클입니다.

## 실행 플로우

```
Phase 1: Plan 생성
  ├── Goal 문서 확인/분석
  ├── 코드베이스 탐색 (explore)
  ├── 요구사항/리스크 분석 (metis)
  └── Pre-plan → Plan 확정

Phase 2: 개발
  ├── Task별 서브에이전트 할당
  ├── 병렬 실행 (독립 Task)
  ├── 코드 작성/수정
  └── 빌드/타입체크 검증

Phase 3: TC 생성/수정
  ├── 개발 범위에 해당하는 기존 TC 탐색
  ├── 영향받는 TC 수정
  ├── 신규 TC 작성 (Playwright POM 패턴)
  └── apps/alpha-review/e2e/ 하위에 배치

Phase 4: 리뷰
  ├── 코드 품질 리뷰 (angular-master)
  ├── TC 커버리지 검증
  ├── 빌드/테스트 실행
  └── 최종 결과 보고
```

## Phase 1: Plan 생성

### 1-1. Goal 확인
```
Goal 문서(.claude/goal/[기능명].md)를 읽는다.
없으면 사용자에게 작성을 요청하고 중단한다.
```

### 1-2. 분석 (병렬 실행)
동시에 실행:
- **explore/explore-medium** → 관련 코드 탐색 (컴포넌트, 서비스, 라우트, 타입)
- **metis** → 요구사항 갭, 리스크, 누락된 엣지 케이스 분석

### 1-3. Plan 작성
분석 결과를 기반으로 `.claude/plan/[기능명].md` 생성:
- 요구사항 요약
- 수용 기준 (Acceptance Criteria)
- Task 목록 (Phase별, Agent 할당, 파일 참조)
- 리스크 & 대응
- TC 계획 (어떤 TC를 추가/수정해야 하는지)

## Phase 2: 개발

### 2-1. Task 실행 규칙
| Task 유형 | 에이전트 | 실행 방식 |
|-----------|----------|-----------|
| 단순 파일 수정 | sisyphus-junior-low | 순차 |
| 컴포넌트 구현 | fe-code-writer / frontend-engineer | 병렬 가능 |
| 복잡한 아키텍처 변경 | sisyphus-junior-high | 순차 |
| API 연동 | be-code-writer | 순차 |
| 스타일링 | frontend-engineer-low | 병렬 가능 |

### 2-2. 개발 중 검증
각 Task 완료 후:
1. 타입체크: `npx tsc --noEmit` (또는 `nx build <project> --configuration=local`)
2. 린트: 해당 프로젝트 린트 실행
3. 실패 시 즉시 수정 후 다음 Task로 진행

### 2-3. Plan 업데이트
Task 완료 시 `.claude/plan/[기능명].md`에서 체크:
```markdown
- [x] TASK-001: 컴포넌트 생성 | ✅ DONE
```

## Phase 3: TC 생성/수정

### 3-1. 기존 TC 탐색
```
apps/alpha-review/e2e/ 하위에서:
1. 개발 범위와 관련된 기존 *.spec.ts 파일 탐색
2. 영향받는 Page Object (*.page.ts) 파일 확인
3. 공통 헬퍼/fixture 확인
```

### 3-2. TC 수정 판단 기준
| 상황 | 액션 |
|------|------|
| 기존 TC의 Selector가 변경됨 | Page Object 수정 |
| 기존 기능의 동작이 변경됨 | Spec 파일의 assertion 수정 |
| 새 UI 요소가 추가됨 | 기존 TC에 검증 항목 추가 |
| 완전히 새로운 기능 | 신규 TC 작성 |

### 3-3. 신규 TC 작성 규칙
- **qa-master** 서브에이전트에 위임
- POM 패턴: `[기능명].page.ts` + `[기능명].spec.ts`
- TC ID: 기존 TC의 마지막 번호 이어서 부여
- 기존 테스트 코드의 패턴/헬퍼 함수 재사용
- SaladLabInc 컴포넌트 규칙 준수

### 3-4. TC 검증
작성된 TC의 문법/구조 검증:
- import 경로 확인
- Page Object의 locator 유효성
- Assertion 패턴 일관성

## Phase 4: 리뷰

### 4-1. 코드 리뷰 (병렬 실행)
동시에 실행:
- **angular-master** → Angular 스타일 가이드 준수 여부, 아키텍처 적합성
- **oracle-medium** → 잠재적 버그, 성능 이슈, 보안 취약점

### 4-2. TC 리뷰
- TC가 개발 범위를 충분히 커버하는지 확인
- 누락된 엣지 케이스가 없는지 검증
- 기존 TC와의 중복 여부 확인

### 4-3. 최종 검증
```bash
# 빌드 확인
pnpm build:dashboard:prod  # 또는 해당 앱

# 테스트 실행
nx test <project-name>
```

### 4-4. 결과 보고
```markdown
## Full Cycle 완료 보고

### 개발 결과
- 변경된 파일: [목록]
- 신규 파일: [목록]

### TC 결과
- 수정된 TC: [목록]
- 신규 TC: [목록]
- TC 커버리지: [개발 범위 대비]

### 리뷰 결과
- 코드 품질: [PASS/FAIL + 상세]
- 빌드: [PASS/FAIL]
- 테스트: [PASS/FAIL]

### Plan 상태
- 전체 Task: N개 완료 / M개 중
- Status: COMPLETED
```

## 주의사항

1. **Goal 문서 필수** — 없으면 시작하지 않음
2. **빌드 실패 시 중단하지 않음** — 원인 분석 후 수정하고 계속 진행
3. **TC는 반드시 기존 패턴 참고** — 독자적인 패턴 사용 금지
4. **리뷰에서 FAIL 시** — 해당 항목 수정 후 재검증
5. **한국어 응답** — 모든 문서, Plan, 보고서는 한국어
