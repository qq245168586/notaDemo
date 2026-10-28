export type TextListener = (text: string) => Promise<void> | void;

/** 解析模型真实 SSE：拼接文本和分片工具参数，不暴露 reasoning_content。 */
export async function readChatStream(response: Response, onText: TextListener) {
  if (!response.body) throw new Error('模型没有返回数据流');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let finished = false;
  const calls = new Map<number, { id: string; type: string; function: { name: string; arguments: string } }>();

  async function readLine(line: string) {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data) return;
    if (data === '[DONE]') { finished = true; return; }
    const packet = JSON.parse(data);
    if (packet.error) throw new Error(packet.error.message ?? '模型流式请求失败');
    const choice = packet.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finished = true;
    const delta = choice.delta ?? {};
    if (typeof delta.content === 'string') {
      content += delta.content;
      await onText(content);
    }
    for (const part of delta.tool_calls ?? []) {
      const call = calls.get(part.index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
      if (part.id) call.id = part.id;
      call.function.name += part.function?.name ?? '';
      call.function.arguments += part.function?.arguments ?? '';
      calls.set(part.index, call);
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        await readLine(buffer.slice(0, newline).replace(/\r$/, ''));
        buffer = buffer.slice(newline + 1);
      }
      if (done) break;
    }
    if (buffer.trim()) await readLine(buffer);
    if (!finished) throw new Error('模型数据流中断，请重新开始');
    return { role: 'assistant', content, ...(calls.size ? { tool_calls: [...calls.values()] } : {}) };
  } finally {
    reader.releaseLock();
  }
}
