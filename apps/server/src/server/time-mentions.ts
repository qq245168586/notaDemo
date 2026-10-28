import type { TimeMention } from '@/domain/types';

const numeral = '[零〇一二两三四五六七八九十\\d]{1,3}';
const datePattern = `(?:\\d{4}年)?${numeral}月${numeral}[日号]|\\d{4}-\\d{1,2}-\\d{1,2}|大后天|后天|明天|今天|今晚|明晚|今早|明早|(?:下下|下|本|这)?(?:周|星期)[一二三四五六日天]|the day after tomorrow|tomorrow|today`;
const period = '凌晨|早上|上午|中午|下午|傍晚|晚上';
const clock = `\\d{1,2}(?:[:：]\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)|\\d{1,2}[:：]\\d{2}|${numeral}[点时](?:半|一刻|三刻|${numeral}分?)?`;
const combinedPeriods: Record<string, string> = { 今晚: '晚上', 明晚: '晚上', 今早: '早上', 明早: '早上' };

export function chineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value.includes('十')) {
    const [a, b] = value.split('十');
    return (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0);
  }
  return digits[value] ?? NaN;
}

function localParts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(values.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

function instant(day: string, time: string, timezone: string) {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, date, hour, minute);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess), timezone);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (actual === target) return new Date(guess).toISOString();
    guess += target - actual;
  }
  return null; // 夏令时不存在的本地时刻需要用户确认。
}

function resolveDate(token: string, reference: Date, timezone: string): string | null {
  const p = localParts(reference, timezone);
  let day = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const relative: Record<string, number> = { 今天: 0, 今晚: 0, 今早: 0, 明天: 1, 明晚: 1, 明早: 1, 后天: 2, 大后天: 3, today: 0, tomorrow: 1, 'the day after tomorrow': 2 };
  if (token.toLowerCase() in relative) {
    day.setUTCDate(day.getUTCDate() + relative[token.toLowerCase()]);
  } else {
    const weekday = token.match(/^(下下|下|本|这)?(?:周|星期)([一二三四五六日天])$/);
    const explicit = token.match(/^(?:(\d{4})年)?(.+)月(.+)[日号]$/) ?? token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (weekday) {
      const index = '一二三四五六日天'.indexOf(weekday[2]);
      const target = index >= 6 ? 6 : index;
      const today = (day.getUTCDay() + 6) % 7;
      const weeks = weekday[1] === '下下' ? 2 : weekday[1] === '下' ? 1 : 0;
      let delta = target - today + weeks * 7;
      if (!weekday[1] && delta < 0) delta += 7;
      day.setUTCDate(day.getUTCDate() + delta);
    } else if (explicit) {
      const year = explicit[1] ? Number(explicit[1]) : p.year;
      const month = chineseNumber(explicit[2]);
      const date = chineseNumber(explicit[3]);
      day = new Date(Date.UTC(year, month - 1, date));
      if (day.getUTCFullYear() !== year || day.getUTCMonth() !== month - 1 || day.getUTCDate() !== date) return null;
    } else return null;
  }
  return day.toISOString().slice(0, 10);
}

function resolveTime(token: string): string | null {
  token = token.replace(/今晚|明晚|今早|明早/g, word => combinedPeriods[word]);
  const match = token.match(new RegExp(clock, 'i'));
  if (!match) return null;
  const raw = match[0];
  let hour: number;
  let minute = 0;
  if (/[:：]|[ap]\.?m/i.test(raw)) {
    const numbers = raw.match(/\d+/g)!;
    hour = Number(numbers[0]); minute = Number(numbers[1] ?? 0);
  } else {
    const [h, tail] = raw.split(/[点时]/);
    hour = chineseNumber(h);
    minute = tail === '半' ? 30 : tail === '一刻' ? 15 : tail === '三刻' ? 45 : tail ? chineseNumber(tail.replace('分', '')) : 0;
    if (hour <= 12 && !new RegExp(period).test(token)) return null;
  }
  if ((/下午|晚上|傍晚|p\.?m/i.test(token)) && hour < 12) hour += 12;
  if (/凌晨|早上|上午|a\.?m/i.test(token) && hour === 12) hour = 0;
  if (/中午/.test(token) && hour < 11) hour += 12;
  if (hour > 23 || minute > 59 || hour < 0 || minute < 0 || !Number.isFinite(hour + minute)) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function actionTitle(context: string, quote: string) {
  const clauses = context.split(/[，,]/);
  const index = Math.max(0, clauses.findIndex((clause) => clause.includes(quote)));
  const options = [clauses[index], ...clauses.slice(0, index).reverse(), ...clauses.slice(index + 1)];
  for (const clause of options) {
    const title = clause.replace(new RegExp(`${datePattern}|${clock}|${period}`, 'gi'), '')
      .replace(/约|大概|左右|开始|开场|之后|然后|再/g, '').trim();
    if (title.length >= 2) return title.slice(0, 80);
  }
  return '录音事项';
}

/** 日期运算由代码完成，以录音创建时间为基准，不让模型心算日期。 */
export function extractTimeMentions(text: string, createdAt: string, timezone = 'Asia/Shanghai'): TimeMention[] {
  const reference = new Date(createdAt);
  if (Number.isNaN(reference.getTime())) return [];
  const pattern = new RegExp(`(?:${datePattern})(?:\\s*(?:at|约)?\\s*(?:${period})?\\s*(?:${clock})?)?|(?:${period})\\s*(?:${clock})?|${clock}`, 'gi');
  let carriedDate: string | null = null;
  let carriedPeriod: string | null = null;
  let lastEnd = 0;
  const found: TimeMention[] = [];
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    const quote = match[0].trimEnd();
    const end = start + quote.length;
    const previous = text.slice(lastEnd, start);
    if (/[。！？!?；;\n]/.test(previous)) { carriedDate = null; carriedPeriod = null; }
    const dateToken = quote.match(new RegExp(datePattern, 'i'))?.[0];
    const date: string | null = dateToken ? resolveDate(dateToken, reference, timezone) : carriedDate;
    if (dateToken) { carriedDate = date; carriedPeriod = null; }
    const ownPeriod = quote.match(new RegExp(period))?.[0] ?? combinedPeriods[dateToken ?? ''];
    if (ownPeriod) carriedPeriod = ownPeriod;
    let time = resolveTime(quote);
    let inferredPeriod = false;
    const followingPeriod = carriedPeriod ?? text.slice(end).match(/^\s*(?:左右)?(?:开始|开场)?[，,\s]*(上午|下午|晚上|早上)(?:玩|开始|进行|开会|上课)/)?.[1];
    if (!time && followingPeriod && new RegExp(clock, 'i').test(quote)) {
      time = resolveTime(followingPeriod + quote);
      inferredPeriod = time !== null;
    }
    const left = Math.max(...['。', '！', '？', '\n', ';', '；'].map((s) => text.lastIndexOf(s, start - 1))) + 1;
    const right = text.slice(end).search(/[。！？!?；;\n]/);
    const context = text.slice(left, right < 0 ? text.length : end + right).trim();
    const advance = context.match(new RegExp(`提前(${numeral})(天|小时|分钟)`));
    const remindBeforeMinutes = advance ? chineseNumber(advance[1]) * (advance[2] === '天' ? 1440 : advance[2] === '小时' ? 60 : 1) : 0;
    found.push({ id: `time-${start}-${end}`, start, end, quote, context,
      title: actionTitle(context, quote),
      date, time, startAt: date && time ? instant(date, time, timezone) : null,
      remindBeforeMinutes, note: !date ? '缺少日期，请补选' : !time ? '缺少具体时间或上午/下午，请确认'
        : inferredPeriod ? `依据紧邻的“${followingPeriod}”预填，请确认；时区 ${timezone}` : `以录音创建时间为基准，时区 ${timezone}` });
    lastEnd = end;
  }
  // “明天去开会，约9:30开始”中的“明天”和“9:30”指向同一时间。
  for (let i = 0; i < found.length - 1; i++) {
    const a = found[i], b = found[i + 1];
    if (a.date && !a.time && b.date === a.date && b.time && a.context === b.context && !new RegExp(period).test(a.quote)) {
      a.time = b.time; a.startAt = b.startAt; a.note = b.note;
    }
  }
  return found;
}

/** 校验模型只引用原文，再由代码计算日期；模型不直接生成时间戳。 */
export function mergeSemanticTimes(text: string, createdAt: string, timezone: string, candidates: unknown): TimeMention[] {
  const fallback = extractTimeMentions(text, createdAt, timezone);
  if (!Array.isArray(candidates)) return fallback;
  const accepted: TimeMention[] = [];
  for (const value of candidates.slice(0, 30)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    const read = (key: string) => typeof item[key] === 'string' ? (item[key] as string).trim() : '';
    const quote = read('quote'), evidence = read('evidence'), dateText = read('dateExpression');
    const periodText = read('periodExpression'), clockText = read('clockExpression'), action = read('action');
    if (!quote || !evidence || !text.includes(evidence) || !evidence.includes(quote)) continue;
    if ([dateText, periodText, clockText, action].some(part => part && !evidence.includes(part))) continue;
    if (dateText && !new RegExp(`^(?:${datePattern})$`, 'i').test(dateText)) continue;
    if (periodText && !new RegExp(`^(?:${period}|今晚|明晚|今早|明早)$`).test(periodText)) continue;
    if (clockText && !new RegExp(`^(?:${clock})(?:钟)?$`, 'i').test(clockText)) continue;
    // 高亮必须是时间原词，不把整句动作变成链接。
    if (!new RegExp(`${datePattern}|${clock}|${period}`, 'i').test(quote)) continue;
    const occurrence = item.occurrence ?? 0;
    if (!Number.isInteger(occurrence) || Number(occurrence) < 0 || Number(occurrence) > 100) continue;
    let start = -1;
    for (let i = 0; i <= Number(occurrence); i++) { start = text.indexOf(quote, start + 1); if (start < 0) break; }
    if (start < 0) continue;
    // 同名时间只关联包含该次出现的证据片段。
    let evidenceStart = text.indexOf(evidence);
    while (evidenceStart >= 0 && !(evidenceStart <= start && evidenceStart + evidence.length >= start + quote.length)) {
      evidenceStart = text.indexOf(evidence, evidenceStart + 1);
    }
    if (evidenceStart < 0) continue;
    const date = dateText ? resolveDate(dateText, new Date(createdAt), timezone) : null;
    const effectivePeriod = periodText || combinedPeriods[dateText] || '';
    const time = clockText ? resolveTime(effectivePeriod + clockText) : null;
    const end = start + quote.length;
    if (accepted.some(other => other.start < end && other.end > start)) continue;
    const previous = fallback.find(other => other.start < end && other.end > start);
    // 不用一个不完整的模型输出覆盖已有明确时间。
    if (previous?.startAt && !(date && time)) continue;
    accepted.push({ id: `time-${start}-${end}`, start, end, quote, context: evidence,
      title: action || previous?.title || '录音事项', date, time,
      startAt: date && time ? instant(date, time, timezone) : null,
      remindBeforeMinutes: previous?.remindBeforeMinutes ?? 0,
      note: date && time
        ? `根据原文“${dateText}”和“${periodText || combinedPeriods[dateText] || ''}${clockText}”解析；以录音日期为基准，时区 ${timezone}`
        : date ? '原文没有明确具体时刻，请补选时间' : '原文没有明确日期，请补选日期',
    });
  }
  return [...fallback.filter(old => !accepted.some(item => item.start < old.end && item.end > old.start)), ...accepted]
    .sort((a, b) => a.start - b.start);
}
