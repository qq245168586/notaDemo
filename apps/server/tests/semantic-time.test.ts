import { describe, expect, it } from 'vitest';
import { mergeSemanticTimes } from '@/server/time-mentions';
const reference = '2026-10-28T09:00:07.524Z';
const source = '今晚我想在大概九点钟的时候去一趟龙岗，然后明天上午去找张总，下周日去小径湾。';
const evidence = '今晚我想在大概九点钟的时候去一趟龙岗';

describe('模型时间结果校验', () => {
  it('模型提供原文关联，程序计算时间并保留其他不完整时间', () => {
    const times = mergeSemanticTimes(source, reference, 'Asia/Shanghai', [{ quote: '九点钟', occurrence: 0,
      dateExpression: '今晚', periodExpression: '今晚', clockExpression: '九点钟', action: '去一趟龙岗', evidence }]);
    const clock = times.find(item => item.quote === '九点钟')!;
    expect(clock.startAt).toBe('2026-10-28T13:00:00.000Z');
    expect(clock.title).toBe('去一趟龙岗');
    expect(times.find(item => item.quote === '明天上午')?.startAt).toBeNull();
    expect(times.find(item => item.quote === '下周日')?.startAt).toBeNull();
    for (const item of times) expect(source.slice(item.start, item.end)).toBe(item.quote);
  });
  it('丢弃模型补出的时间和原文没有的事项', () => {
    const text = '明天上午去找张总';
    const times = mergeSemanticTimes(text, reference, 'Asia/Shanghai', [{ quote: '明天上午',
      dateExpression: '明天', periodExpression: '上午', clockExpression: '九点', action: '去找李总', evidence: text }]);
    expect(times[0].startAt).toBeNull();
    expect(times[0].title).not.toContain('李总');
  });
  it('日期字段非法时不能覆盖原有正确解析', () => {
    const times = mergeSemanticTimes(source, reference, 'Asia/Shanghai', [{ quote: '九点钟',
      dateExpression: '今晚我想', periodExpression: '今晚', clockExpression: '九点钟', action: '去一趟龙岗', evidence }]);
    expect(times.find(item => item.quote === '九点')?.startAt).toBe('2026-10-28T13:00:00.000Z');
  });
});
