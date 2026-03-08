import { useState } from 'react'

interface GuideSection {
  id: string
  title: string
  content: JSX.Element
}

const sections: GuideSection[] = [
  {
    id: 'overview',
    title: '개요',
    content: (
      <div className="space-y-3">
        <p>
          AR-AI는 <Strong>Claude Agent SDK 기반 멀티 에이전트 자동 워크플로우 도구</Strong>입니다.
          6개의 전문가 에이전트가 여러 레포지토리를 넘나들며 코드 분석, 이슈 수집, 정책 검증, QA, 기획까지 수행합니다.
        </p>
        <InfoBox>
          이 가이드는 AR-AI를 처음 설정하는 분을 위한 단계별 안내입니다.
          아래 섹션을 순서대로 따라가면 모든 설정을 완료할 수 있습니다.
        </InfoBox>
      </div>
    )
  },
  {
    id: 'agents',
    title: '에이전트 소개',
    content: (
      <div className="space-y-3">
        <p>AR-AI에는 6개의 전문가 에이전트가 있습니다. 각 에이전트는 독립적으로 또는 협력하여 작업합니다.</p>
        <Table headers={['에이전트', '역할', '주요 작업 범위']}>
          <Tr cells={['FE Developer', '프론트엔드 개발자', 'Core-Front, 작성페이지, 위젯스크립트 코드 분석/수정/빌드']} />
          <Tr cells={['BE Developer', '백엔드 개발자', 'Alpha-Review API 코드 분석/수정/테스트']} />
          <Tr cells={['Issue Manager', '이슈 수집가', 'Google Chat에서 이슈 수집, AI 분석으로 리포트 생성']} />
          <Tr cells={['Policy Manager', '정책 전문가', 'FE/BE 전체 레포를 크로스 분석하여 정책 불일치 검출']} />
          <Tr cells={['QA Manager', 'QA 전문가', '테스트 케이스 관리, E2E 테스트, 코드 리뷰']} />
          <Tr cells={['Project Owner', '프로덕트 오너', '요구사항 정리, PRD/계획, 스프린트 관리']} />
        </Table>
      </div>
    )
  },
  {
    id: 'repos',
    title: '1단계: 레포지토리 경로',
    content: (
      <div className="space-y-3">
        <p>에이전트가 코드를 분석하려면 각 레포지토리의 <Strong>로컬 절대 경로</Strong>를 설정해야 합니다.</p>
        <Table headers={['항목', '설명', '필수 여부']}>
          <Tr cells={['Core-Front (FE)', 'Nx 기반 Angular 프론트엔드 모노레포', '필수']} />
          <Tr cells={['Alpha-Review (BE)', '백엔드 API 레포지토리', '필수']} />
          <Tr cells={['작성페이지 (FE)', '작성페이지 프론트엔드 레포지토리', '선택']} />
          <Tr cells={['위젯스크립트 (FE)', '위젯스크립트 프론트엔드 레포지토리', '선택']} />
          <Tr cells={['Sprint', '스프린트 관리 문서 경로', '필수']} />
        </Table>
        <InfoBox>
          경로 입력 후 저장하면 상태 표시가 나타납니다.{'\n'}
          <Dot color="#4ade80" /> <span style={{ color: '#4ade80' }}>연결됨</span> — 경로가 존재합니다{'\n'}
          <Dot color="#f87171" /> <span style={{ color: '#f87171' }}>경로 없음</span> — 경로를 다시 확인해주세요
        </InfoBox>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          예시: <Code>/Users/username/projects/Core-Front</Code>
        </p>
      </div>
    )
  },
  {
    id: 'auth',
    title: '2단계: Claude 인증',
    content: (
      <div className="space-y-3">
        <p>
          AR-AI는 로컬에 설치된 Claude Code의 인증을 공유합니다.
          별도 API 키가 필요 없습니다.
        </p>
        <Steps>
          <Step n={1}>터미널에서 <Code>claude</Code> 명령어가 실행되는지 확인</Step>
          <Step n={2}>AR-AI에서 처음 대화를 시작하면 브라우저에서 자동 로그인 진행</Step>
          <Step n={3}>로그인 완료 후 에이전트 사용 가능</Step>
        </Steps>
        <WarnBox>
          Claude Code가 설치되어 있지 않다면 먼저{' '}
          <Code>npm install -g @anthropic-ai/claude-code</Code>로 설치해주세요.
        </WarnBox>
      </div>
    )
  },
  {
    id: 'google-chat',
    title: '3단계: Google Chat 연동 (선택)',
    content: (
      <div className="space-y-3">
        <p>
          Issue Manager 에이전트가 Google Chat 스페이스에서 이슈를 자동 수집하려면 OAuth 인증이 필요합니다.
          이 기능을 사용하지 않는다면 건너뛰어도 됩니다.
        </p>
        <Steps>
          <Step n={1}>Google Cloud Console에서 프로젝트 생성</Step>
          <Step n={2}>Chat API 활성화 후, OAuth 2.0 클라이언트 ID 생성 (Desktop App 타입)</Step>
          <Step n={3}>다운로드한 JSON 파일 경로를 <Strong>OAuth 클라이언트 JSON</Strong>에 입력</Step>
          <Step n={4}>이슈를 수집할 스페이스 ID를 <Strong>기본 스페이스</Strong>에 입력 (예: <Code>spaces/XXXXXXXXX</Code>)</Step>
          <Step n={5}><Strong>Google 로그인</Strong> 버튼 클릭하여 본인 계정으로 인증</Step>
        </Steps>
      </div>
    )
  },
  {
    id: 'mcp',
    title: '4단계: MCP 서버',
    content: (
      <div className="space-y-3">
        <p>
          MCP(Model Context Protocol) 서버는 에이전트에게 추가 기능을 제공합니다.
          각 에이전트별로 필요한 MCP 서버를 할당할 수 있습니다.
        </p>
        <H4>기본 제공 서버</H4>
        <Table headers={['서버', '기능', '기본 할당']}>
          <Tr cells={['context7', '최신 라이브러리 문서 조회', 'FE, BE, QA']} />
          <Tr cells={['playwright', '브라우저 자동화, E2E 테스트', 'QA']} />
          <Tr cells={['sequential-thinking', '복잡한 추론 체인', 'Policy, PO']} />
        </Table>

        <H4>Serena (자동 생성)</H4>
        <p>
          레포지토리 경로를 설정하면 <Badge color="#1e3a2f" textColor="#4ade80">auto</Badge> 배지가 붙은
          Serena MCP 서버가 자동으로 생성됩니다.
        </p>
        <p>
          Serena는 LSP(Language Server Protocol)를 활용하여 코드를 <Strong>시맨틱하게 분석</Strong>합니다.
          단순 텍스트 검색이 아닌 심볼 레벨(함수, 클래스, 변수)로 코드를 이해합니다.
        </p>
        <Table headers={['기능', '설명']}>
          <Tr cells={['find_symbol', '함수/클래스/변수의 정확한 정의 위치 검색']} />
          <Tr cells={['find_referencing_symbols', '특정 심볼을 사용하는 모든 코드 탐색']} />
          <Tr cells={['get_symbols_overview', '파일/모듈의 전체 심볼 구조 한눈에 보기']} />
          <Tr cells={['rename_symbol', '심볼 이름 일괄 변경 (리팩토링)']} />
        </Table>
        <WarnBox>
          Serena를 사용하려면 <Code>uv</Code> (Python 패키지 매니저)가 설치되어 있어야 합니다.{'\n'}
          설치: <Code>curl -LsSf https://astral.sh/uv/install.sh | sh</Code>
        </WarnBox>

        <H4>에이전트 할당</H4>
        <p>
          각 MCP 서버 카드 하단의 에이전트 버튼을 클릭하면 해당 에이전트에 서버를 할당/해제할 수 있습니다.
          활성화된 버튼(색상 강조)은 해당 에이전트가 이 서버를 사용한다는 뜻입니다.
        </p>

        <H4>커스텀 서버 추가</H4>
        <p>
          <Strong>+ MCP 서버 추가</Strong> 버튼으로 직접 MCP 서버를 등록할 수 있습니다.
          서버 이름, 실행 커맨드, 인자를 입력하세요.
        </p>
      </div>
    )
  },
  {
    id: 'skills',
    title: '5단계: 스킬',
    content: (
      <div className="space-y-3">
        <p>
          스킬은 에이전트에게 특정 작업 패턴을 가르치는 <Strong>프롬프트 템플릿</Strong>입니다.
          활성화된 스킬은 모든 에이전트가 작업 상황에 맞게 자동으로 선택하여 사용합니다.
        </p>

        <H4>스킬 종류</H4>
        <Table headers={['종류', '설명', '관리']}>
          <Tr cells={['빌트인', '기본 제공 스킬 (코드리뷰, 리팩토링, 테스트 등)', '보기/편집/토글']} />
          <Tr cells={['커스텀', '사용자가 직접 추가한 스킬', '보기/편집/삭제/토글']} />
          <Tr cells={['skills.sh 외부', 'skills.sh에서 설치한 커뮤니티 스킬', '보기/토글만 가능']} />
        </Table>

        <H4>skills.sh 스킬 설치</H4>
        <p>
          <A href="https://skills.sh">skills.sh</A>는 AI 에이전트용 오픈 스킬 마켓플레이스입니다.
          터미널에서 글로벌로 설치하면 AR-AI가 자동으로 인식합니다.
        </p>
        <CodeBlock>{`# 글로벌 설치 (모든 레포에서 사용 가능)
npx skills add <owner/repo> -g -y

# 예시: Vercel React 베스트 프랙티스 설치
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices -g -y

# 설치된 스킬 목록 확인
npx skills list -g`}</CodeBlock>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          설치 후 AR-AI 설정을 다시 열면 <Badge color="#3b2f63" textColor="#a78bfa">skills.sh</Badge> 배지와 함께 스킬이 나타납니다.
        </p>
      </div>
    )
  },
  {
    id: 'workflow',
    title: '사용 팁',
    content: (
      <div className="space-y-3">
        <H4>기본 사용법</H4>
        <Steps>
          <Step n={1}>좌측 사이드바에서 에이전트를 선택</Step>
          <Step n={2}>채팅창에 작업 내용을 입력</Step>
          <Step n={3}>에이전트가 자동으로 코드 분석, 수정, 테스트 수행</Step>
        </Steps>

        <H4>에이전트 활용 예시</H4>
        <Table headers={['원하는 작업', '사용할 에이전트', '예시 메시지']}>
          <Tr cells={['코드 분석/수정', 'FE / BE Developer', '"UserService의 로그인 로직을 분석해줘"']} />
          <Tr cells={['이슈 수집', 'Issue Manager', '"오늘 Google Chat 이슈 트래킹해줘"']} />
          <Tr cells={['정책 검증', 'Policy Manager', '"결제 관련 정책이 FE/BE에서 일치하는지 확인해줘"']} />
          <Tr cells={['테스트', 'QA Manager', '"리뷰 목록 페이지 E2E 테스트 작성해줘"']} />
          <Tr cells={['기획/PRD', 'Project Owner', '"리뷰 AI 분석 기능 PRD 작성해줘"']} />
        </Table>

        <H4>설정 변경 후</H4>
        <p>
          설정을 변경한 후에는 반드시 <Strong>저장</Strong> 버튼을 눌러주세요.
          MCP 서버나 스킬 변경은 다음 대화부터 적용됩니다.
        </p>
      </div>
    )
  }
]

// --- 유틸 컴포넌트 ---

function Strong({ children }: { children: React.ReactNode }): JSX.Element {
  return <strong style={{ color: 'var(--text-primary)' }}>{children}</strong>
}

function Code({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: '#e2e8f0', fontFamily: 'monospace' }}>
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: string }): JSX.Element {
  return (
    <pre className="text-[11px] rounded-lg p-3 overflow-x-auto leading-relaxed" style={{ background: '#0d1117', color: '#e2e8f0', fontFamily: 'monospace' }}>
      {children}
    </pre>
  )
}

function InfoBox({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg p-3 text-xs leading-relaxed whitespace-pre-line" style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
      {children}
    </div>
  )
}

function WarnBox({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg p-3 text-xs leading-relaxed whitespace-pre-line" style={{ background: '#451a03', border: '1px solid #78350f', color: '#fcd34d' }}>
      {children}
    </div>
  )
}

function H4({ children }: { children: React.ReactNode }): JSX.Element {
  return <h4 className="text-sm font-semibold pt-1" style={{ color: 'var(--text-primary)' }}>{children}</h4>
}

function Badge({ children, color, textColor }: { children: React.ReactNode; color: string; textColor: string }): JSX.Element {
  return <span className="text-[10px] px-1.5 py-0.5 rounded inline-block" style={{ background: color, color: textColor }}>{children}</span>
}

function Dot({ color }: { color: string }): JSX.Element {
  return <span style={{ color }}>●</span>
}

function A({ href, children }: { href: string; children: React.ReactNode }): JSX.Element {
  return <span className="underline" style={{ color: 'var(--accent)' }}>{children} ({href})</span>
}

function Steps({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="space-y-2 pl-1">{children}</div>
}

function Step({ n, children }: { n: number; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex gap-2.5 text-xs items-start">
      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ background: 'var(--accent)', color: '#fff' }}>
        {n}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{children}</span>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'var(--bg-tertiary)' }}>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Tr({ cells }: { cells: string[] }): JSX.Element {
  return (
    <tr style={{ borderTop: '1px solid var(--border-color)' }}>
      {cells.map((c, i) => (
        <td key={i} className="px-3 py-2" style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{c}</td>
      ))}
    </tr>
  )
}

// --- 메인 컴포넌트 ---

export function SetupGuide({ onClose }: { onClose: () => void }): JSX.Element {
  const [activeSection, setActiveSection] = useState('overview')

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="m-auto w-full max-w-3xl max-h-[85vh] flex rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 좌측 네비게이션 */}
        <nav className="w-48 flex-shrink-0 py-5 px-3 space-y-0.5 overflow-y-auto" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
          <div className="px-2 pb-3 mb-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>설정 가이드</h3>
          </div>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className="w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors"
              style={{
                color: activeSection === s.id ? 'var(--text-primary)' : 'var(--text-muted)',
                background: activeSection === s.id ? 'var(--bg-hover)' : 'transparent',
                fontWeight: activeSection === s.id ? 600 : 400
              }}
            >
              {s.title}
            </button>
          ))}
        </nav>

        {/* 우측 콘텐츠 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {sections.find((s) => s.id === activeSection)?.title}
            </h2>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              닫기
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {sections.find((s) => s.id === activeSection)?.content}
          </div>
        </div>
      </div>
    </div>
  )
}
