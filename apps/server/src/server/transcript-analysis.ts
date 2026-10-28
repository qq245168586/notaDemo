import { appConfig } from '@/config/ai';
import type { RecordingTask, TranscriptReview } from '@/domain/types';
import { chatCompletion } from '@/server/model';
import { extractSemanticTimeMentions } from '@/server/semantic-time';

/** 生成可核查的校验结论与依据摘要，不返回模型内部思维链。 */
export async function analyzeTranscript(task: RecordingTask) {
  const text = task.correctedTranscript ?? task.rawTranscript ?? '';
  const timeMentions = await extractSemanticTimeMentions(text, task.createdAt);
  const fallback: TranscriptReview = {
    summary: '未提供声学置信度。这里只能对文字进行复核，不能据此保证转写准确。',
    findings: [], source: 'text_review', model: appConfig.ai.chatModel,
  };
  const original = task.rawTranscript ?? '';
  if (original && original !== text) {
    let left = 0, right = 0;
    while (left < original.length && left < text.length && original[left] === text[left]) left++;
    while (right < original.length - left && right < text.length - left && original[original.length - 1 - right] === text[text.length - 1 - right]) right++;
    fallback.changes = { before: original.slice(left, original.length - right), after: text.slice(left, text.length - right) };
  }
  if (appConfig.ai.mode === 'mock') return { review: fallback, timeMentions };
  const message = await chatCompletion([
    { role: 'system', content: `你是转写文本审校器。输出可供用户核查的简短结论和证据摘要，不输出内部推理过程。
只根据给定原始转写和校准文本检查同音错词、专名、时间和信息增添。你没有重新听音频，没有声学置信度，不得声称听到了什么，不得编造百分比分数。
游戏语境里的专名或同音词尤其需要核对；无法确定就标记存疑并给候选，不要直接当成正确。不要为凑数虚构问题。
用户提供的专名候选：${appConfig.ai.vocabulary}。这些是词汇表候选，不是该片段的正确答案。删除片段可能包含识别错的专名；不能仅因为“不通顺”就认定是口误或赘词，必须标明需核对原音。
仅返回JSON：{"summary":"两句以内的校验结论", "findings":[{"original":"文本中原词", "candidate":"候选词或校准后的词", "decision":"存疑/保留/已修改", "evidence":"不超过100字的上下文依据及局限"}]}。
最多6个findings。original必须原样存在于输入，已修改的candidate必须存在于校准文本。` },
    { role: 'user', content: JSON.stringify({ original: task.rawTranscript, corrected: text,
      times: timeMentions.map(({ id, quote, context }) => ({ id, quote, context })) }) },
  ]);
  const content = typeof message?.content === 'string' ? message.content : '';
  const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
  const findings: TranscriptReview['findings'] = [];
  for (const item of Array.isArray(parsed.findings) ? parsed.findings.slice(0, 6) : []) {
    const original = String(item.original ?? '').slice(0, 120);
    if (!original || !(task.rawTranscript ?? '').includes(original) && !text.includes(original)) continue;
    const candidate = String(item.candidate ?? '').slice(0, 120);
    const decision = item.decision === '已修改' && candidate && text.includes(candidate) ? '已修改'
      : item.decision === '保留' ? '保留' : '存疑';
    findings.push({ original, candidate, decision, evidence: String(item.evidence ?? '缺少充分依据，建议核对原音频').slice(0, 180) });
  }
  if (fallback.changes) {
    const before = fallback.changes.before;
    // 删改是可证实的事实，“音频说错了/是赘词”不是，不能照搬模型的肯定语气。
    const relevant = /游戏|王者|英雄联盟|峡谷|区服|艾欧尼亚|祖安/.test(original)
      ? appConfig.ai.vocabulary.split(/[、,，]/).filter((word) => word && word !== 'Nota') : [];
    const remaining = findings.filter((item) => !before || !item.original.includes(before) && !before.includes(item.original));
    findings.splice(0, findings.length, {
      original: before || '（原文此处无内容）', candidate: relevant.join('、'), decision: '存疑（规则核验）',
      evidence: relevant.length
        ? `游戏语境中可回听比对用户术语表候选；文本曾被删改，不能仅凭通顺认定为赘词。候选不代表识别答案。`
        : '文本发生了删改；没有原音核对证据，不能认定改后更准确，建议对照原始转写并回听。',
    }, ...remaining);
  }
  const summary = fallback.changes
    ? '检测到校准删改，需核对原音。下面分别展示实际文本变动、词语候选和文本复核依据。'
    : String(parsed.summary ?? fallback.summary).slice(0, 400);
  return { review: { ...fallback, summary, findings }, timeMentions };
}
