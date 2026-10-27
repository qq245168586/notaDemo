import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { appConfig, assertRealAiConfig } from '@/config/ai';
import type { AgentResult, RecordingTask, ToolCallRecord } from '@/domain/types';
import type { TaskStore } from '@/server/store';

type ChatMessage = Record<string, unknown>;

const agentTools = [
  {
    type: 'function',
    function: {
      name: 'createTodo',
      description: '从用户的话中创建一条待办',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setReminder',
      description: '保存提醒内容和自然语言时间，不写入系统日历',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          when: { type: 'string' },
        },
        required: ['content', 'when'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchHistory',
      description: '按关键词查询历史录音和摘要',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
] as const;

async function chatCompletion(messages: ChatMessage[], tools?: unknown[]) {
  assertRealAiConfig();
  const response = await fetch(`${appConfig.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appConfig.ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: appConfig.ai.chatModel,
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      temperature: 0.1,
    }),
  });
  if (!response.ok) throw new Error(`AI请求失败: ${response.status} ${await response.text()}`);
  const body = await response.json();
  return body.choices?.[0]?.message as ChatMessage | undefined;
}

export async function transcribeAudio(task: RecordingTask, audioPath = task.audioPath) {
  if (appConfig.ai.mode === 'mock') {
    return (
      task.transcriptHint ??
      '明天下午三点完成 Nota 演示，提前一天提醒我，再查一下之前关于报价的记录。'
    );
  }

  assertRealAiConfig();
  const bytes = await fs.readFile(audioPath);
  if (appConfig.ai.asrProvider === 'alibaba-chat') {
    const extension = path.extname(audioPath).toLowerCase();
    const mime =
      extension === '.wav'
        ? 'audio/wav'
        : extension === '.mp3'
          ? 'audio/mpeg'
          : extension === '.aac'
            ? 'audio/aac'
            : extension === '.ogg'
              ? 'audio/ogg'
              : extension === '.webm'
                ? 'audio/webm'
                : 'audio/mp4';
    const response = await fetch(`${appConfig.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appConfig.ai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: appConfig.ai.asrModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: { data: `data:${mime};base64,${bytes.toString('base64')}` },
              },
            ],
          },
        ],
        asr_options: { enable_itn: true },
      }),
    });
    if (!response.ok) {
      throw new Error(`阿里ASR请求失败: ${response.status} ${await response.text()}`);
    }
    const body = await response.json();
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('阿里ASR没有返回文本');
    return text.trim();
  }

  const form = new FormData();
  form.append('model', appConfig.ai.asrModel);
  form.append('file', new Blob([new Uint8Array(bytes)]), path.basename(audioPath));
  const response = await fetch(`${appConfig.ai.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${appConfig.ai.apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(`ASR请求失败: ${response.status} ${await response.text()}`);
  const body = await response.json();
  if (!body.text) throw new Error('ASR没有返回文本');
  return String(body.text);
}

export async function correctTranscript(text: string) {
  if (appConfig.ai.mode === 'mock') {
    return text.replaceAll('诺塔', 'Nota').replaceAll('报架', '报价');
  }

  const message = await chatCompletion([
    {
      role: 'system',
      content:
        '只校准明显的语音识别错词，不改变事实，不补充信息。只返回完整校准文本，不要解释、摘要或添加开头。',
    },
    { role: 'user', content: text },
  ]);
  const content = message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('文本校准没有返回结果');
  return content.trim();
}

function executeTool(
  store: TaskStore,
  name: ToolCallRecord['name'],
  args: Record<string, unknown>,
) {
  if (name === 'createTodo') {
    return { id: randomUUID(), title: String(args.title ?? '未命名待办'), status: 'OPEN' };
  }
  if (name === 'setReminder') {
    return {
      id: randomUUID(),
      content: String(args.content ?? '提醒'),
      when: String(args.when ?? '待确认'),
    };
  }
  const query = String(args.query ?? '');
  return store.searchHistory(query).map((task) => ({
    taskId: task.id,
    createdAt: task.createdAt,
    summary: task.summary,
    transcript: task.correctedTranscript,
  }));
}

function recordTool(
  store: TaskStore,
  name: ToolCallRecord['name'],
  args: Record<string, unknown>,
): ToolCallRecord {
  return {
    id: randomUUID(),
    name,
    arguments: args,
    result: executeTool(store, name, args),
  };
}

export async function runAgent(store: TaskStore, text: string): Promise<AgentResult> {
  if (appConfig.ai.mode === 'mock') {
    const calls = [
      recordTool(store, 'createTodo', { title: '完成 Nota 演示' }),
      recordTool(store, 'setReminder', {
        content: '完成 Nota 演示',
        when: '明天下午三点前一天',
      }),
      recordTool(store, 'searchHistory', { query: '报价' }),
    ];
    return {
      summary: `用户安排了 Nota 演示，并希望设置提醒和查询历史报价。原文：${text}`,
      todos: [calls[0].result as Record<string, unknown>],
      reminders: [calls[1].result as Record<string, unknown>],
      toolCalls: calls,
    };
  }

  const toolCalls: ToolCallRecord[] = [];
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是语音备忘录Agent。根据文本自主选择工具，必要时可调用多个工具，最后用中文给出简短摘要。不要虚构时间、年份、联系人或结论；原文没有年份时必须保留为未指定年份。',
    },
    { role: 'user', content: text },
  ];

  let summary = '';
  for (let round = 0; round < 4; round += 1) {
    const message = await chatCompletion(messages, [...agentTools]);
    if (!message) throw new Error('Agent没有返回结果');
    messages.push(message);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) {
      summary = typeof message.content === 'string' ? message.content : '';
      break;
    }

    for (const call of calls as Array<Record<string, any>>) {
      const name = call.function?.name as ToolCallRecord['name'];
      if (!['createTodo', 'setReminder', 'searchHistory'].includes(name)) continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments ?? '{}');
      } catch {
        throw new Error(`工具参数不是合法JSON: ${name}`);
      }
      const recorded = recordTool(store, name, args);
      toolCalls.push(recorded);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(recorded.result),
      });
    }
  }

  if (!summary) summary = 'Agent已完成工具调用。';
  return {
    summary,
    todos: toolCalls.filter((item) => item.name === 'createTodo').map((item) => item.result as Record<string, unknown>),
    reminders: toolCalls
      .filter((item) => item.name === 'setReminder')
      .map((item) => item.result as Record<string, unknown>),
    toolCalls,
  };
}

export async function answerHistoryQuestion(store: TaskStore, question: string) {
  const call = recordTool(store, 'searchHistory', { query: question });
  if (appConfig.ai.mode === 'mock') {
    const rows = call.result as Array<Record<string, unknown>>;
    return {
      answer: rows.length ? `找到 ${rows.length} 条相关记录，请查看来源。` : '没有找到相关历史记录。',
      toolCalls: [call],
    };
  }

  const message = await chatCompletion([
    { role: 'system', content: '只能根据给定历史记录回答；没有证据就明确说没有找到。' },
    { role: 'user', content: JSON.stringify({ question, history: call.result }) },
  ]);
  return {
    answer: typeof message?.content === 'string' ? message.content : '没有返回答案。',
    toolCalls: [call],
  };
}
