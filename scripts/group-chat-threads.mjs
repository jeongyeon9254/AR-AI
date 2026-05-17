// review_squad/messages.json 을 topic_id 기준 스레드로 그룹핑.
// 분류:
//   - yeonjae_troubleshooting : 정연재 참여 + 트러블슈팅 신호
//   - yeonjae_general         : 정연재 참여 + 그 외 (사담만 있는 스레드 제거)
//   - important_others        : 정연재 미참여 + 중요 (트러블슈팅 / 다인 / 장문)
// 출력: src/docs/chat/review_squad/threads/*.json + _summary.md
//
// 재실행: `node scripts/group-chat-threads.mjs`

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SRC = path.join(ROOT, 'src/docs/chat/review_squad/messages.json');
const OUT_DIR = path.join(ROOT, 'src/docs/chat/review_squad/threads');

const YEONJAE_NAMES = new Set(['정연재']);

// 메시지 단위 사담 패턴 (스레드 전체 사담 판정용; 개별 메시지 삭제는 안 함)
const CHITCHAT_PATTERNS = [
  /^[ㅋㅎ\s]+$/,
  /^넵+\.?$/, /^네+\.?$/, /^예+\.?$/, /^옙+\.?$/,
  /^감사합니다[.!~]?$/, /^감사+[.!~]?$/, /^감솨+[.!~]?$/,
  /^굳+\.?$/, /^오케이+\.?$/i, /^ok+\.?$/i, /^okay+\.?$/i,
  /^확인+\.?$/, /^확인했(어요|습니다)[.!]?$/,
  /^넵 감사합니다[.!]?$/, /^넵넵+\.?$/,
  /^고생(하셨|많으셨|많으|많이)[어요습니다셨음]+[.!~]?$/,
  /^수고+(하셨어요|하셨습니다|많으셨어요)?[.!~]?$/,
  /^👍+$/u, /^🙏+$/u, /^❤️+$/u, /^✅+$/u,
  /^좋아요[.!~]?$/, /^좋습니다[.!~]?$/, /^좋네요[.!~]?$/,
  /^알겠습니다[.!]?$/, /^넹+\.?$/,
];

// 스레드 전체를 사담으로 판정하는 강한 패턴 (제목/본문 어디에든 나오면 사담 가중)
const CHITCHAT_STRONG_PATTERNS = [
  /점심.*같이 먹/, /같이 먹는 날/, /배달주문/, /배달 주문/,
  /오늘은 수요일/, /오늘은 월요일/, /오늘은 화요일/, /오늘은 목요일/, /오늘은 금요일/,
  /회식 (장소|메뉴|일정)/, /생일 축하/, /결혼 축하/, /돌잔치/,
  /커피챗/, /다과/, /간식/, /야식/,
];

// 단순 운영/사내 공지 (인수인계 컨텍스트로는 노이즈)
const ADMIN_NOTICE_PATTERNS = [
  /\[연차[\s공유일정]/, /\[휴가[\s공유일정]/, /\[반차[\s공유]/,
  /연차 ?공유/, /휴가 ?일정 ?공유/, /반차 ?공유/, /민방위/,
  /Wi-?Fi.*비번/i, /비번.*Wi-?Fi/i, /Saladlab-\dth/,
  /구글챗 데스크톱앱/,
];

// 트러블슈팅 키워드
const TS_KEYWORDS = [
  '에러', '오류', '버그', '안 됨', '안돼', '안되', '안 되', '막힘', '막혀',
  '문제', '이슈', '이상해', '이상하', '왜 안', '왜안', '작동 안',
  '안 나옴', '안나옴', '안 뜨', '안뜨', '안 보이', '안보이', '안 뜸',
  '깨짐', '깨져', '깨지', '멈춤', '멈춰', '멈추',
  '죽음', '죽었', '죽어', '죽네', '죽는',
  '실패', '리젝트', '롤백', '장애', '핫픽스', '긴급', '무한로딩',
  '충돌', 'conflict', 'crash', 'error', 'bug', 'fail', 'failed',
  'exception', 'null point', 'undefined', 'reject',
  '안 켜', '안켜', '안 들어가', '로그인 안', '빌드 실패', '배포 실패',
  '500', '502', '503', '504', '404',
];

// 비참여 중요 스레드 신호 (트러블슈팅 외)
const IMPORTANT_KEYWORDS = [
  '결정', '정책', '방향', '정해', '정함', '정합시다', '정리',
  '스펙', '기획', '릴리즈', '배포 일정', '배포일정', '롤아웃',
  '컨벤션', '가이드', '원칙', '아키텍처', '구조', '설계',
  '회의록', '회의 정리', '디시전', 'decision', '의사결정',
  '포스트모템', 'postmortem', 'rca', '재발방지',
];

function parseKDate(s) {
  if (!s) return null;
  const m = s.match(/(\d+)년 (\d+)월 (\d+)일 \S+ (오전|오후) (\d+)시 (\d+)분 (\d+)초 UTC/);
  if (!m) return null;
  let [, y, mo, d, ampm, h, mi, se] = m;
  h = parseInt(h, 10);
  if (ampm === '오후' && h !== 12) h += 12;
  if (ampm === '오전' && h === 12) h = 0;
  return new Date(Date.UTC(+y, +mo - 1, +d, h, +mi, +se));
}

function isSystemMsg(m) {
  if (!m.text) return true; // 텍스트 없는 메시지 (멤버십 변경 등)
  const t = m.text;
  if (t === 'Updated room membership.') return true;
  if (t.startsWith('I shared an item')) return true;
  return false;
}

function isChitChatText(text) {
  if (!text) return true;
  const t = text.trim();
  if (t.length === 0) return true;
  if (CHITCHAT_PATTERNS.some((re) => re.test(t))) return true;
  // 매우 짧은 인사
  if (t.length <= 5 && /^[안녕하세요반가워요잘부탁드립니다입니다네넵예]+[.!~?ㅎㅋ]*$/.test(t)) return true;
  return false;
}

function containsAny(text, keywords) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function summarizeAnnotations(anns) {
  if (!anns || !anns.length) return null;
  return anns
    .map((a) => {
      if (a.drive_metadata) return `[Drive] ${a.drive_metadata.title || a.drive_metadata.id}`;
      if (a.user_mention) return `@${a.user_mention.name || a.user_mention.user_id}`;
      if (a.url_metadata) return `[Link] ${a.url_metadata.url}`;
      return `[${Object.keys(a).filter((k) => k !== 'start_index' && k !== 'length').join(',')}]`;
    })
    .filter(Boolean);
}

// === 메인 ===
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const messages = raw.messages;

// 스레드 빌드
const threadMap = new Map();
for (const msg of messages) {
  const tid = msg.topic_id;
  if (!tid) continue;
  if (!threadMap.has(tid)) threadMap.set(tid, []);
  threadMap.get(tid).push(msg);
}

for (const [tid, msgs] of threadMap) {
  msgs.sort((a, b) => {
    const da = parseKDate(a.created_date);
    const db = parseKDate(b.created_date);
    return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
  });
}

const buckets = {
  yeonjae_troubleshooting: [],
  yeonjae_general: [],
  important_others: [],
};
const dropReasons = {};
function drop(reason) {
  dropReasons[reason] = (dropReasons[reason] || 0) + 1;
}

for (const [tid, msgs] of threadMap) {
  const realMsgs = msgs.filter((m) => !isSystemMsg(m));
  if (realMsgs.length === 0) {
    drop('system-only');
    continue;
  }

  const substantiveCount = realMsgs.filter(
    (m) => m.text && m.text.length > 10 && !isChitChatText(m.text),
  ).length;

  const allText = realMsgs.map((m) => m.text || '').join('\n');
  const hasTrouble = containsAny(allText, TS_KEYWORDS);
  const hasImportantKw = containsAny(allText, IMPORTANT_KEYWORDS);
  const yeonjaeIn = realMsgs.some((m) => YEONJAE_NAMES.has(m.creator?.name));
  const uniqueAuthors = new Set(realMsgs.map((m) => m.creator?.name).filter(Boolean));

  // 점심/회식/생일 등 강한 사담 시그널: 트러블슈팅 키워드가 없으면 무조건 제거
  const isStrongChitChat = CHITCHAT_STRONG_PATTERNS.some((re) => re.test(allText));
  if (isStrongChitChat && !hasTrouble) {
    drop('strong-chit-chat');
    continue;
  }

  // 연차/Wi-Fi 비번/단순 안내성 공지: 트러블슈팅/중요 키워드 없으면 제거
  const isAdminNotice = ADMIN_NOTICE_PATTERNS.some((re) => re.test(allText));
  if (isAdminNotice && !hasTrouble && !hasImportantKw) {
    drop('admin-notice');
    continue;
  }

  // 스레드 사담 판정: 실질 메시지가 0개이고 트러블슈팅/중요 키워드도 없으면 제거
  if (substantiveCount === 0 && !hasTrouble && !hasImportantKw) {
    drop('chit-chat-only');
    continue;
  }

  // 첫 의미있는 메시지에서 타이틀 추출
  const titleMsg = realMsgs.find(
    (m) => m.text && m.text.length > 5 && !isChitChatText(m.text),
  );
  const title = (titleMsg?.text || realMsgs[0]?.text || '')
    .slice(0, 120)
    .replace(/\s+/g, ' ');

  const threadObj = {
    topic_id: tid,
    title,
    participants: [...uniqueAuthors],
    yeonjae_participated: yeonjaeIn,
    message_count: realMsgs.length,
    substantive_count: substantiveCount,
    date_start: realMsgs[0]?.created_date,
    date_end: realMsgs[realMsgs.length - 1]?.created_date,
    has_troubleshooting: hasTrouble,
    has_important_keyword: hasImportantKw,
    messages: realMsgs.map((m) => {
      const out = {
        author: m.creator?.name || '(unknown)',
        time: m.created_date,
        text: m.text || '',
      };
      const ann = summarizeAnnotations(m.annotations);
      if (ann) out.annotations = ann;
      return out;
    }),
  };

  if (yeonjaeIn && hasTrouble) {
    buckets.yeonjae_troubleshooting.push(threadObj);
  } else if (yeonjaeIn) {
    buckets.yeonjae_general.push(threadObj);
  } else {
    // 연재 미참여 중요도 판정 (엄격하게)
    //   - 최소 실질 메시지 3개 이상이어야 함 (짧은 단발성 공지 제외)
    //   - 그리고 (트러블슈팅 OR 중요 키워드 OR 다인+장문) 중 하나라도 충족
    const longEnough = substantiveCount >= 3 && realMsgs.length >= 5;
    const isDiscussion = uniqueAuthors.size >= 4 && realMsgs.length >= 10;
    const isImportant =
      longEnough && (hasTrouble || hasImportantKw || isDiscussion);
    if (isImportant) {
      buckets.important_others.push(threadObj);
    } else {
      drop('not-important-non-yeonjae');
    }
  }
}

const sortByDate = (a, b) =>
  (parseKDate(a.date_start)?.getTime() ?? 0) -
  (parseKDate(b.date_start)?.getTime() ?? 0);
for (const k of Object.keys(buckets)) buckets[k].sort(sortByDate);

// 출력
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, threads] of Object.entries(buckets)) {
  fs.writeFileSync(
    path.join(OUT_DIR, `${name}.json`),
    JSON.stringify(threads, null, 2),
  );
}

// 인덱스 마크다운: 각 스레드 한 줄씩
function writeIndex(name, threads) {
  const lines = [`# ${name}`, '', `총 ${threads.length} 스레드`, ''];
  for (const t of threads) {
    const date = t.date_start?.match(/(\d+년 \d+월 \d+일)/)?.[1] || '';
    const ts = t.has_troubleshooting ? '🔧 ' : '';
    lines.push(
      `- ${ts}**${date}** · ${t.participants.join(', ')} · ${t.message_count}msg — ${t.title}`,
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}.index.md`), lines.join('\n'));
}
for (const [name, threads] of Object.entries(buckets)) writeIndex(name, threads);

// 요약
const summary = [
  '# Review Squad 스레드 그룹핑 결과',
  '',
  `생성: ${new Date().toISOString()}`,
  `소스: \`${path.relative(ROOT, SRC)}\``,
  '',
  '## 통계',
  `- 원본 메시지: ${messages.length}`,
  `- 원본 스레드: ${threadMap.size}`,
  '',
  '## 분류',
  `- 🔧 \`yeonjae_troubleshooting\` — 연재님 참여 트러블슈팅: **${buckets.yeonjae_troubleshooting.length}** 스레드`,
  `- 💬 \`yeonjae_general\` — 연재님 참여 일반: **${buckets.yeonjae_general.length}** 스레드`,
  `- ⭐ \`important_others\` — 연재님 미참여 중요: **${buckets.important_others.length}** 스레드`,
  '',
  '## 제거',
  ...Object.entries(dropReasons).map(([k, v]) => `- ${k}: ${v}`),
  '',
  '## AR-AI 사용 가이드',
  '',
  '`*.json` 파일이 RAG/컨텍스트 소스. 각 스레드는 `topic_id`로 고유 식별.',
  '연재님 미참여 스레드도 트러블슈팅/정책/회의록 키워드가 있으면 포함됨.',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, '_summary.md'), summary);

console.log(summary);
