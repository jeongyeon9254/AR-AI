# AR-AI

Claude Agent SDK 기반 멀티 에이전트 자동 워크플로우 GUI 툴

## 아키텍처

- **Electron** 데스크톱 앱 (서버 없음, IPC 통신)
- **Main Process**: Claude Agent SDK 실행, SQLite 세션관리, IPC 핸들러
- **Renderer**: React + Vite + Tailwind CSS + Zustand

## 프로젝트 구조

```
src/
  main/           → Electron Main Process
    agents/       → 에이전트 정의 및 실행
    sessions/     → SQLite 세션 저장소
    tools/        → 커스텀 도구 (Google Chat 등)
    config.ts     → 사용자 설정 관리
    ipc-handlers.ts → IPC 핸들러
  preload/        → IPC 브릿지
  renderer/       → React UI
    components/   → UI 컴포넌트
    stores/       → Zustand 상태관리
```

## 에이전트

6개 전문가 에이전트:
- `fe-developer`: 프론트엔드 개발자 (Core-Front)
- `be-developer`: 백엔드 개발자 (Alpha-Review)
- `issue-collector`: 이슈 수집가
- `policy-expert`: 정책 전문가 (크로스 레포 분석)
- `qa-expert`: QA 전문가
- `po`: Product Owner

## 규칙

1. 이 프로젝트의 스킬과 CLAUDE.md 규칙을 1차로 따름
2. Core-Front, Alpha-Review 각 레포의 로컬 룰을 2차로 따름
3. 항상 한국어로 응답
4. TypeScript strict 모드 사용

## 개발 명령어

- `npm run dev` — 개발 서버 실행
- `npm run build` — 프로덕션 빌드
- `npm run dist` — 앱 패키징
