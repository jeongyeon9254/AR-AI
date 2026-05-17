# Alpha Review 정책 문서 인덱스

이 디렉토리는 https://guide.alph.kr/ 의 공식 가이드를 폴더 트리로 정리한 정책 문서입니다.

## 사용 목적

폴리시 매니저(policy-expert 에이전트)가 사용자로부터 기능 관련 질문을 받았을 때, **"이런 기능인지" 역으로 확인**하기 위한 참고 자료로 사용합니다. 각 `policy.md`는 다음을 포함합니다.

- **frontmatter**: `title`, `parent`, `source_url`(원본 가이드 페이지 URL), `fetched_at`
- **본문**: 기능 설명 / 메뉴 위치 / 설정 방법 / 옵션 / 정책·제약 / FAQ / 하위 페이지 링크

## 폴더 트리

```
src/docs/policy/
├── INDEX.md (이 파일)
│
├── 관리자페이지가이드/
│   ├── 리뷰관리/policy.md
│   │   ├── 리뷰목록페이지/policy.md
│   │   ├── 게시지급설정/policy.md
│   │   └── 리뷰데이터엑셀다운로드/policy.md
│   │
│   ├── 스태프리뷰/policy.md
│   │   ├── 스태프리뷰작성/policy.md
│   │   └── 대량업로드/policy.md
│   │
│   ├── 위젯디자인설정/policy.md
│   │   ├── 공통디자인설정/policy.md
│   │   ├── 배너이미지삽입/policy.md
│   │   ├── 고객공지사항/policy.md
│   │   ├── 심플포토위젯/policy.md
│   │   ├── 평점게시판위젯/policy.md
│   │   ├── 상품목록형위젯/policy.md
│   │   ├── 베스트리뷰위젯/policy.md
│   │   ├── 스토리SNS위젯/policy.md
│   │   ├── 채팅플로팅스마트픽위젯/policy.md
│   │   ├── 키워드리뷰위젯/policy.md
│   │   ├── 롤링브리핑위젯/policy.md
│   │   └── 공지사항커스텀에디터위젯/policy.md
│   │
│   ├── 포인트및지급설정/policy.md
│   │   ├── 빠른리뷰/policy.md
│   │   ├── 리뷰뱃지/policy.md
│   │   ├── 베스트리뷰선정/policy.md
│   │   ├── 미검증리뷰/policy.md
│   │   ├── 키워드알림및필터/policy.md
│   │   ├── 리뷰작성조건설정/policy.md
│   │   ├── 알림톡및메시지설정/policy.md
│   │   ├── 사용내역과결제기록/policy.md
│   │   ├── 비회원리뷰작성가능여부/policy.md
│   │   └── 비회원Npay적립금/policy.md
│   │
│   └── 리뷰작성페이지설정/policy.md
│
└── 기능둘러보기/
    ├── 설문리뷰/policy.md
    │
    ├── 리뷰요청/policy.md
    │   └── 알림톡기본기능/policy.md
    │
    ├── 키워드리뷰/policy.md
    │
    ├── 소셜리뷰연동/policy.md
    │   ├── 인스타그램게시물연동/policy.md
    │   └── 네이버블로그게시물연동/policy.md
    │
    └── 상품간리뷰연결/policy.md
```

## 폴리시 매니저 사용 가이드

1. **질문 수신** — 사용자가 알파리뷰 기능에 대해 묻거나 정책 관련 트러블슈팅을 요청
2. **트리 탐색** — 이 INDEX.md의 트리에서 관련 메뉴를 찾고 해당 `policy.md` 읽음
3. **확인 응답** — 정책 문서 내용을 바탕으로 "이런 기능을 말씀하시는 게 맞을까요?" 식으로 역질문하여 의도 확인
4. **출처 인용** — 답변 시 해당 policy.md의 `source_url`을 함께 제공해 공식 가이드로 안내

## 생성 정보

- 소스: https://guide.alph.kr/
- 생성일: 2026-05-17
- 메인 메뉴: 10개 (관리자 페이지 가이드 5 + 기능 둘러보기 5)
- 깊이-1 자식: 30개
- 총 policy.md: 40개
- 생성 스크립트: 없음 (직접 + general-purpose 에이전트 위임으로 생성)

## 미처리 (깊이-2 이상)

깊이-1 자식 페이지들 안에서 추가로 발견된 깊이-2 URL이 약 25~30개 있으나, 일부는 다른 메인 메뉴의 자식이거나 FAQ 글로벌 페이지여서 매핑이 모호합니다. 필요 시 별도 작업으로 진행 가능합니다.
