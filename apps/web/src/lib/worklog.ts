import type { WorkLog } from '@/lib/types';

/**
 * 업무 일지 = 체크리스트. 서버에는 지금처럼 한 덩어리 글로 저장하고,
 * 줄마다 '- [ ] 내용' / '- [x] 내용' 으로 적어 체크 여부를 담는다.
 * 예전에 자유 글로 쓴 일지도 줄 단위로 그대로 읽혀서(체크 안 된 항목) 기록이 사라지지 않는다.
 */
export interface LogItem {
  done: boolean;
  text: string;
}

const CHECK_LINE = /^\s*[-*]\s*\[([ xX])\]\s?(.*)$/;

export const parseLog = (content: string): LogItem[] =>
  (content ?? '')
    .split('\n')
    .map((raw) => {
      const m = raw.match(CHECK_LINE);
      if (m) return { done: m[1].toLowerCase() === 'x', text: m[2].trim() };
      const t = raw.replace(/^\s*[-*>\s]+/, '').trim();
      return { done: false, text: t };
    })
    .filter((i) => i.text.length > 0);

export const serializeLog = (items: LogItem[]) =>
  items
    .filter((i) => i.text.trim())
    .map((i) => `- [${i.done ? 'x' : ' '}] ${i.text.trim()}`)
    .join('\n');

/** 아직 체크 안 한 일지 항목 — 적은 날짜와 원본 일지를 들고 다닌다 (체크하면 그 날짜 일지를 고쳐 저장) */
export interface PendingLogItem {
  key: string;
  /** 항목을 적은 날짜 'YYYY-MM-DD' */
  date: string;
  text: string;
  /** 그 날짜 일지 안에서의 순번 */
  index: number;
  log: WorkLog;
  /** 본인 일지여야 체크할 수 있다 (일지 저장은 본인 것만 가능) */
  mine: boolean;
}

/**
 * 기간 안의 일지에서 체크 안 된 항목만 모은다 — 날짜가 지나도 [진행 중]에 계속 남기는 목록.
 * 오래된 것부터(오름차순) 정렬해서, 밀린 항목이 위에 오게 한다.
 */
export function pendingLogItems(logs: WorkLog[] | null | undefined, myUserId?: string): PendingLogItem[] {
  const out: PendingLogItem[] = [];
  for (const log of logs ?? []) {
    const date = log.logDate.slice(0, 10);
    parseLog(log.content).forEach((it, index) => {
      if (it.done) return;
      out.push({
        key: `${log.id}-${index}`,
        date,
        text: it.text,
        index,
        log,
        // 목록에 작성자가 없으면 본인 것만 조회한 경우다
        mine: !log.user || log.user.id === myUserId,
      });
    });
  }
  out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  return out;
}

/** 항목 하나를 완료로 바꾼 뒤 저장할 본문 */
export const withItemDone = (content: string, index: number): string =>
  serializeLog(parseLog(content).map((it, i) => (i === index ? { ...it, done: true } : it)));
