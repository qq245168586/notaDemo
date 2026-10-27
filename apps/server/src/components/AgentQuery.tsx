'use client';

import { useState } from 'react';
import type { ToolCallRecord } from '@/domain/types';
import { ToolCallList } from '@/components/ToolCallList';

export function AgentQuery() {
  const [question, setQuestion] = useState('我之前提过报价吗？');
  const [answer, setAnswer] = useState('');
  const [calls, setCalls] = useState<ToolCallRecord[]>([]);

  async function ask() {
    const response = await fetch('/api/agent/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const body = await response.json();
    setAnswer(body.answer ?? body.error);
    setCalls(body.toolCalls ?? []);
  }

  return (
    <section className="card agent-query">
      <p className="label">HISTORY AGENT</p>
      <h2>查询历史记录</h2>
      <div className="query-row">
        <input value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button type="button" onClick={() => void ask()}>查询</button>
      </div>
      {answer && <p className="agent-answer">{answer}</p>}
      <ToolCallList calls={calls} />
    </section>
  );
}
