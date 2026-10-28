import { describe, expect, it } from 'vitest';
import { extractTimeMentions } from '@/server/time-mentions';

// 2026-10-28，周三，上海时间晚上十点。
const reference = '2026-10-28T14:00:00.000Z';

describe('点击时间添加提醒', () => {
  it('明天下午三点半按录音日期计算，不依赖打开页面的日期', () => {
    const [time] = extractTimeMentions('明天下午三点半约张总吃饭，提前一天提醒我。', reference);
    expect(time.quote).toBe('明天下午三点半');
    expect(time.startAt).toBe('2026-10-29T07:30:00.000Z');
    expect(time.remindBeforeMinutes).toBe(1440);
  });
  it('下周三不是未来七天内最近的周三；周天为星期日', () => {
    expect(extractTimeMentions('下周三下午三点开会', reference)[0].date).toBe('2026-11-04');
    expect(extractTimeMentions('下周天下午三点开会', reference)[0].date).toBe('2026-11-08');
  });
  it('支持分开的日期和24小时时刻，两个高亮均指向同一事项时间', () => {
    const times = extractTimeMentions('明天去祖安，约9:30开始打游戏。', reference);
    expect(times).toHaveLength(2);
    expect(times.map((time) => time.startAt)).toEqual(['2026-10-29T01:30:00.000Z', '2026-10-29T01:30:00.000Z']);
  });
  it('缺少时刻或缺少上午下午时不补造时间', () => {
    expect(extractTimeMentions('明天下午开会', reference)[0].startAt).toBeNull();
    expect(extractTimeMentions('明天三点开会', reference)[0].startAt).toBeNull();
  });
  it('无日期时不默认滚到明天，日期也不穿越句子继承', () => {
    expect(extractTimeMentions('下午三点开会', reference)[0].startAt).toBeNull();
    const times = extractTimeMentions('明天安排会议。下午三点出发。', reference);
    expect(times[1].date).toBeNull();
  });
  it('拒绝非法日期/时刻，并保留每个高亮的准确位置', () => {
    const text = '🎤 2026年2月30日下午三点开会。明天25:30出发。';
    for (const time of extractTimeMentions(text, reference)) {
      expect(time.startAt).toBeNull();
      expect(text.slice(time.start, time.end)).toBe(time.quote);
    }
  });
  it('不把时长当成时刻', () => {
    expect(extractTimeMentions('玩三小时，住一晚。', reference)).toEqual([]);
  });
  it('可用紧邻的下午活动补充三点半，但明确标为推定', () => {
    const times = extractTimeMentions('明天去峡谷，约三点半开始，下午玩三个小时，之后晚上去住一晚。', reference);
    expect(times[1].startAt).toBe('2026-10-29T07:30:00.000Z');
    expect(times[1].note).toContain('预填');
    expect(times[1].title).toBe('去峡谷');
    expect(times.at(-1)?.startAt).toBeNull();
  });
  it('英文时间可预填且维持录音的时区', () => {
    expect(extractTimeMentions('Tomorrow at 3 p.m. review the plan.', reference)[0].startAt).toBe('2026-10-29T07:00:00.000Z');
  });
});

describe('今晚与跨词语时间关联', () => {
  it('今晚我想在大概九点钟：当日21点，不顺延，也不变成上午', () => {
    const times = extractTimeMentions('今晚我想在大概九点钟的时候去一趟龙岗，然后明天上午去找张总。', reference);
    expect(times[0].quote).toBe('今晚');
    expect(times[0].startAt).toBe('2026-10-28T13:00:00.000Z');
    expect(times[1].startAt).toBe('2026-10-28T13:00:00.000Z');
    expect(times[2].date).toBe('2026-10-29');
    expect(times[2].startAt).toBeNull();
  });
  it('明早与明晚分别解析为9点和21点', () => {
    expect(extractTimeMentions('明早九点出发。', reference)[0].startAt).toBe('2026-10-29T01:00:00.000Z');
    expect(extractTimeMentions('明晚九点出发。', reference)[0].startAt).toBe('2026-10-29T13:00:00.000Z');
  });
});
