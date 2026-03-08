---
description: Angular/Core-Front 코딩 규칙, 스타일 가이드, E2E 테스트 가이드라인
---

# Core Front Angular Style Guide

## 1. Global Rules

### 1-1. Project Structure

- Core Front는 **Nx Monorepo**로 운영됩니다.
- Main Applications: `apps/super-admin`, `apps/core-dashboard`, `apps/alpha-push`, `apps/alpha-review`, `apps/alpha-upsell`
- 리뷰 시 **FSD 아키텍처를 위반하는 의존성**을 반드시 확인하세요.

### 1-2. Code Conventions

| 항목 | 규칙 | 예시 |
|:---|:---|:---|
| **변수 명명** | `camelCase`, 백엔드 응답 필드는 `snake_case` 허용 | `userName`, `user_id` |
| **배열 명명** | `xxxList` 접미사 사용 | `productList`, `userList` |
| **Boolean 명명** | `is + 동사/형용사` 구조 | `isActive`, `isLoaded` |
| **컴포넌트 멤버 순서** | Service Injection → Decorators → Member variables → ctor → Lifecycle hooks → Methods | - |
| **Import 순서** | Angular → 외부 라이브러리 → `shared-lib` enum/interface → `shared-lib` service → `shared-lib` component → 앱 코드 | - |
| **Template Binding 순서** | 구조 디렉티브(`@if`,`@for`) → 정적 속성 → Input(`[]`) → Output(`()`) | - |
| **스타일링** | LESS + BEM 변형 | `.insight_info--title_box--title` |

---

## 2. Angular 18+ Best Practices

### Components
- 항상 standalone 컴포넌트 사용 (Angular v20+에서는 `standalone: true` 생략)
- `input()`과 `output()` 함수 사용 (데코레이터 대신)
- `computed()`로 파생 상태 관리
- `changeDetection: ChangeDetectionStrategy.OnPush` 설정
- `ngClass` 대신 `class` 바인딩, `ngStyle` 대신 `style` 바인딩 사용
- `@HostBinding`/`@HostListener` 대신 `@Component`의 `host` 객체 사용

### State Management
- signals로 로컬 상태 관리
- `computed()`로 파생 상태
- `mutate` 대신 `update` 또는 `set` 사용

### Templates
- 네이티브 제어 흐름 사용: `@if`, `@for`, `@switch` (`*ngIf`, `*ngFor` 대신)
- Observable은 `async` 파이프로 처리
- 템플릿에서 화살표 함수, 정규표현식, `new Date()` 등 글로벌 사용 금지

### Services
- 단일 책임 원칙으로 설계
- `providedIn: 'root'` 옵션으로 싱글턴 서비스
- `inject()` 함수로 의존성 주입 (생성자 주입 대신)

### TypeScript
- strict 타입 체크 활성화
- `any` 사용 금지 → `unknown` 사용
- 선택적 체이닝(`?.`)과 nullish 병합(`??`) 활용
- `const` 우선, 템플릿 리터럴 사용
- 싱글 쿼트(`'`), 2칸 들여쓰기

### Performance
- `trackBy` 함수 사용
- pure pipe로 무거운 연산 처리
- `NgOptimizedImage`로 이미지 최적화 (인라인 base64 제외)
- deferrable views로 비필수 컴포넌트 지연 렌더링
- Core Web Vitals 최적화 (LCP, INP, CLS)

### Security
- Angular 내장 새니타이제이션 사용, `innerHTML` 회피
- 동적 콘텐츠는 trusted sanitization 메서드로 처리

### Accessibility
- AXE 체크 통과 필수
- WCAG AA 최소 기준 충족 (포커스 관리, 색상 대비, ARIA)

---

## 3. Rules by Folder

### `apps/core-dashboard/**`
- 비즈니스 로직은 도메인 레이어/서비스에 배치, 컴포넌트는 thin하게 유지
- **7단계 이상 중첩** 시 리팩토링 제안
- 네비게이션은 `LeftNavigationMenuBarService`, `ProjectLeftNavigationBarService` 패턴 준수

### `apps/super-admin/**`
- 복잡한 폼/테이블은 공통 컴포넌트(`@saladlabinc/ui`) 우선 사용
- 분산된 권한/접근 제어 로직은 전용 서비스/Guard로 분리

### `libs/**`
- 앱 수준 구현에 의존하면 안 됨
- 순환 의존성 확인 필수
- 타입/인터페이스는 Core Front 전체에서 재사용 가능하게 설계

### `apps/alpha-review/**`
- 리뷰 도메인 로직은 FSD 레이어(`entities`, `features`, `widgets`)에 배치
- Swiper, 위젯 옵션, API 호출 로직은 `entities` 또는 `shared-lib`로 분리

### `apps/alpha-push/**`, `apps/alpha-upsell/**`
- 캠페인/푸시/업셀 로직은 서비스/도메인 레이어에 배치
- 공통 로직은 `libs` 또는 `@core-front/shared-lib`로 추출

---

## 4. E2E Testing Guidelines (Playwright)

### Test Structure
- **Page Object Model (POM)** 패턴 필수: `*.page.ts` + `*.spec.ts`
- `test.describe()`로 관련 테스트 그룹화
- `beforeEach`에서 Page 객체 초기화

### Naming Conventions
- 테스트 케이스 ID: `TC-XXX` 형식 (예: `test('TC-001 초기 상태 확인', ...)`)
- 헬퍼 함수: `stepDelay(page)` (500ms), `getOptionRow(page, name)`, `getSwitchState(locator)`

### API Response Handling
```typescript
const responsePromise = waitForJsonResponse(page, '/api/endpoint');
await page.goto('/page');
const response = await responsePromise;
const data = await response.json();
```

### SaladLabInc Component Rules

**su-switch**: `role="switch"` div의 `btn-box-on`/`btn-box-off` 클래스로 상태 판단
```typescript
const switchDiv = page.locator('su-switch').locator('[role="switch"]');
const className = await switchDiv.getAttribute('class');
const isOn = className?.includes('btn-box-on');
```

**su-button**: `toBeDisabled()` 대신 `button-disabled` 클래스 체크
```typescript
const isDisabled = await page.locator('su-button').locator('div.button-disabled').isVisible();
```

**su-checkbox**: `div`의 `aria-checked` 속성으로 T/F 판단

**헤더 버튼**: `.admin-header-fixed-box` 하위에서 탐색
```typescript
const headerBox = page.locator('.admin-header-fixed-box');
const saveButton = headerBox.locator('su-button').filter({ hasText: '저장하기' });
```

**스낵바**: `su-feedback-msg` 요소
```typescript
await expect(page.locator('su-feedback-msg')).toBeVisible();
```

### Testing Best Practices
- 토글/스위치: ON→OFF, OFF→ON 양방향 테스트
- 프리뷰: 설정 변경 후 즉시 반영 확인
- Data Persistence: 초기값 저장 → 변경 → API 응답 비교
- 각 검증 단계: `✅` 이모지 콘솔 로그 출력
- `stepDelay` 500ms 기본, 임의 `setTimeout` 금지
- API 응답 타입은 기존 모델에서 import, 중복 인터페이스 금지

---

## 5. Review Rules
- 규칙 위반 시 **어느 섹션(Global/By Folder/E2E)을 위반**했는지 명시
- 가능하면 **수정된 코드 예시** 제안
- 모든 리뷰 코멘트는 **한국어**로 작성
