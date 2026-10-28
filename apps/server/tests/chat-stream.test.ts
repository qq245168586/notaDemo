import { describe, expect, it } from 'vitest';
import { readChatStream } from '@/server/chat-stream';

function response(lines: unknown[], complete = true) {
  const text = lines.map((line) => `data: ${JSON.stringify(line)}\r\n\r\n`).join('')
    + (complete ? 'data: [DONE]\n\n' : '');
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      // 刻意切开 UTF-8 字符、JSON 和 SSE 分隔符。
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  }));
}

describe('真实 SSE 拼接', () => {
  it('依次输出增量文字，并正确拼接分片工具参数', async () => {
    const previews: string[] = [];
    const result = await readChatStream(response([
      { choices: [{ delta: { content: '明天' } }] },
      { choices: [{ delta: { content: '开会', reasoning_content: '不展示的模型推理' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'a', function: { name: 'createTodo', arguments: '{"title":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"开会"}' } }] } }] },
    ]), (text) => { previews.push(text); });
    expect(previews).toEqual(['明天', '明天开会']);
    expect(result.tool_calls?.[0].function.arguments).toBe('{"title":"开会"}');
    expect(result.content).toBe('明天开会');
  });

  it('流中断时不把半截结果当成成功', async () => {
    await expect(readChatStream(response([
      { choices: [{ delta: { content: '半截' } }] },
    ], false), () => {})).rejects.toThrow('模型数据流中断');
  });
});
